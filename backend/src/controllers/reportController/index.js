const fs = require('fs');
const path = require('path');
const moment = require('moment');

const custom = require('../pdfController');
const { resolveModules } = require('../../utils/moduleList');

const invoiceSummary = require('../appControllers/invoiceController/summary');
const quoteSummary = require('../appControllers/quoteController/summary');
const offerSummary = require('../appControllers/offerController/summary');
const paymentSummary = require('../appControllers/paymentController/summary');
const clientSummary = require('../appControllers/clientController/summary');

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

    const [invoice, quote, offer, payment, client] = await Promise.all([
      can('invoice') ? collect(invoiceSummary, req) : null,
      can('quote') ? collect(quoteSummary, req) : null,
      can('offer') ? collect(offerSummary, req) : null,
      can('payment') ? collect(paymentSummary, req) : null,
      can('customer') ? collect(clientSummary, req) : null,
    ]);

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
    };

    const { pdfBuffer, htmlContent } = await custom.generatePdf(
      'report',
      { filename: 'report', format: 'A4', targetLocation: '', adminId: admin._id },
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
