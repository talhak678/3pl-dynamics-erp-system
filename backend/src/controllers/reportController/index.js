const fs = require('fs');
const path = require('path');
const moment = require('moment');

const custom = require('../pdfController');
const { resolveModules } = require('../../utils/moduleList');
const { canSeePipeline, buildPipelineReport } = require('./salesPipeline');

// The assembled controllers, not the summary modules sitting beside them.
//
// Four of the five export a plain (req, res) handler, but clientController's is a
// factory — async (Model, req, res) — and only the controller that owns it knows
// to bind the model in (see clientController/index.js). Calling the raw module
// therefore shifts every argument by one: the factory's Model receives the
// express request, its req receives the response stand-in below, and its res
// receives undefined, so the first property it reads throws.
//
// These are the same objects the router hands its routes, so the report can
// never call a differently-wired handler than the dashboard page does.
const {
  invoiceController,
  quoteController,
  offerController,
  paymentController,
  clientController,
  leadController,
} = require('../appControllers');

// The same asset the sidebar renders (frontend/src/style/images/light-logo.png),
// copied under src/public because vercel.json already ships that directory into
// the function bundle. It is inlined as a data URI rather than linked, so the
// PDF needs no network fetch to draw it.
const LOGO_FILE = path.join(__dirname, '..', '..', 'public', '3pl-logo.png');

// Read once per warm lambda. The file is ~190KB, and this is called on every
// report, so re-reading and re-encoding it each time would be wasted work.
let cachedLogo;

const logoDataUri = () => {
  if (cachedLogo !== undefined) return cachedLogo;

  try {
    const bytes = fs.readFileSync(LOGO_FILE);
    cachedLogo = `data:image/png;base64,${bytes.toString('base64')}`;
  } catch (error) {
    // A report without its logo is still a complete report; a report that
    // throws because of one is not.
    console.error('Dashboard report could not read the logo:', error.message);
    cachedLogo = '';
  }

  return cachedLogo;
};

/**
 * Runs one of the existing summary controllers and hands back the payload it
 * would have sent.
 *
 * The report is assembled from the very handlers the dashboard itself calls,
 * rather than from a second set of aggregations written for the PDF. That is
 * deliberate: duplicate queries are duplicate truths, and the moment one of them
 * is corrected the page and the printed report start disagreeing about the same
 * month's figures. Reusing them means the two cannot drift apart at all.
 *
 * The controller only ever reaches res.status().json(), so a two-method stand-in
 * is the whole of what it needs — no Express response is involved.
 */
const collect = async (handler, req) => {
  // A controller that failed to assemble would otherwise surface as the opaque
  // "handler is not a function" from the call at the bottom of this function.
  if (typeof handler !== 'function') {
    throw new Error('Dashboard report could not load a summary controller');
  }

  let payload = null;

  const res = {
    status() {
      return this;
    },
    json(body) {
      payload = body && body.result ? body.result : null;
      return this;
    },
  };

  await handler(req, res);

  return payload;
};

/**
 * The dashboard summary as a PDF, for the account asking for it.
 *
 * Sections are limited to the modules the account actually holds, which is the
 * same rule the dashboard applies to its cards. Without it a restricted tenant
 * would receive a report containing figures they are not permitted to see on
 * screen — the PDF would quietly become a way around the permission.
 */
const downloadDashboardReport = async (req, res) => {
  try {
    const admin = req.admin || {};
    const granted = resolveModules(admin);
    const can = (moduleKey) => granted.includes(moduleKey);

    // Asked before the fetch rather than after it, so the leads are read only for
    // an account whose report will actually carry them. An employee holding
    // `lead` is not a pipeline role and gets no section, and reading the whole
    // workspace's leads to discard them would be work with no purpose.
    const wantsPipeline = canSeePipeline(admin);

    const [invoice, quote, offer, payment, client, leads] = await Promise.all([
      can('invoice') ? collect(invoiceController.summary, req) : null,
      can('quote') ? collect(quoteController.summary, req) : null,
      can('offer') ? collect(offerController.summary, req) : null,
      can('payment') ? collect(paymentController.summary, req) : null,
      can('customer') ? collect(clientController.summary, req) : null,
      wantsPipeline ? collect(leadController.listAll, req) : null,
    ]);

    // Built from the leads listAll just returned rather than from a query of its
    // own, so the isolation the Sales Executive is owed is applied once, by the
    // handler the pipeline page itself calls. Returns null for an account with
    // no pipeline - no `lead` grant, or a role that does not work leads - and
    // the template then renders no pipeline section at all.
    const pipeline = await buildPipelineReport({ admin, leads });

    const fullName = [admin.name, admin.surname].filter(Boolean).join(' ').trim();

    const model = {
      // Doubles as the file name (Dashboard_Report_<date>) and as the document
      // title, which is what a browser puts in its own print header.
      number: moment().format('YYYY-MM-DD'),
      generatedAt: moment().format('DD MMMM YYYY [at] HH:mm'),
      user: {
        name: fullName || 'User',
        email: admin.email || '',
      },
      logo: logoDataUri(),
      invoice,
      quote,
      offer,
      payment,
      client,
      pipeline,
    };

    const { pdfBuffer, htmlContent } = await custom.generatePdf(
      'report',
      // The tenant, not the caller: an employee downloading the report must get
      // it rendered with the company's currency, date format and logo, which are
      // settings rows owned by the account that owns the workspace.
      { filename: 'report', format: 'A4', targetLocation: '', adminId: admin.tenantId },
      model
    );

    if (pdfBuffer) {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${custom.pdfDocumentName('report', model)}.pdf"`
      );
      res.setHeader('Content-Length', pdfBuffer.length);
      return res.end(pdfBuffer);
    }

    // No browser on this host, so the same graceful degradation every other
    // download uses: hand back a page that opens its own print dialog.
    if (htmlContent) {
      const printableHtml = htmlContent.includes('window.print()')
        ? htmlContent
        : htmlContent.replace(
            '</body>',
            '<script>window.onload = function() { window.print(); };</script></body>'
          );
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.send(printableHtml);
    }

    throw new Error('Report generation produced no output');
  } catch (error) {
    console.error('Dashboard report error:', error);

    return res.status(500).json({
      success: false,
      result: null,
      message: error.message || 'Could not generate the dashboard report',
    });
  }
};

module.exports = { downloadDashboardReport };
