const pug = require('pug');
const fs = require('fs');
const path = require('path');
const moment = require('moment');
const { loadSettings } = require('../../middlewares/settings');
const useLanguage = require('../../locale/useLanguage');
const { useMoney, useDate } = require('../../settings');

// 'report' is the Dashboard Summary Report, which is built from live figures
// rather than from a stored document, so it is the one entry here with no model
// behind it.
const pugFiles = ['invoice', 'offer', 'quote', 'payment', 'report'];

require('dotenv').config({ path: '.env' });
require('dotenv').config({ path: '.env.local' });

// --- Naming ------------------------------------------------------------------
//
// A downloaded PDF used to be called `<entity>-<ObjectId>.pdf`, which puts a
// database key in front of the customer. Every one of these documents already
// carries a number and a year — the same ones printed on the page — so the file
// is named after those instead.
const PDF_NAME_PREFIX = {
  invoice: 'Invoice',
  quote: 'Quote',
  offer: 'Offer',
  payment: 'Payment_Receipt',
  // The dashboard report has no number of its own; its `number` is the date it
  // was generated, given as YYYY-MM-DD, so it lands as
  // Dashboard_Report_2026-09-16.pdf.
  report: 'Dashboard_Report',
};

/**
 * The base name for a document's PDF, without the extension.
 *
 * Everything outside [A-Za-z0-9._-] is replaced. That is not cosmetic: the
 * result is interpolated into a Content-Disposition header, where a quote or a
 * newline arriving from a document field would let that field break out of the
 * header — and it also keeps the name valid on every filesystem.
 *
 * Falls back to the document id when there is no number yet, so a file is never
 * named after nothing.
 */
const pdfDocumentName = (modelName, doc) => {
  const key = String(modelName || '').toLowerCase();

  const clean = (value) =>
    String(value === undefined || value === null ? '' : value)
      .replace(/[^A-Za-z0-9._-]+/g, '-')
      .replace(/^-+|-+$/g, '');

  // The four document types have their spelling fixed above. Anything else is
  // capitalised rather than lower-cased, so adding a fifth entity cannot quietly
  // start shipping files named "widget_1.pdf".
  const fallbackPrefix = clean(key).replace(/^[a-z]/, (letter) => letter.toUpperCase());
  const prefix = PDF_NAME_PREFIX[key] || fallbackPrefix || 'Document';

  const number = clean(doc && doc.number);
  const year = clean(doc && doc.year);

  if (!number) {
    return `${prefix}_${clean(doc && doc._id) || 'document'}`;
  }

  return year ? `${prefix}_${number}_${year}` : `${prefix}_${number}`;
};

// --- Header and footer -------------------------------------------------------
//
// Puppeteer's default header and footer print the page's date, title and URL,
// which on a hosted backend means the customer receives a PDF stamped with
// 3pl-dynamics-erp-system-backend.vercel.app. Both templates are overridden so
// that address cannot appear: neither uses the title/url/date classes at all.
//
// Two things these templates must do. They do not inherit the page's styles and
// start at font-size 0, so each sets its own family and size or the text is
// invisible. And they are drawn inside the page margin, so renderHtmlToPdf has
// to leave one tall enough to hold them.
const PDF_HEADER_TEXT = 'Powered by 3PL Dynamics';

const PDF_TEMPLATE_STYLE =
  'width:100%; padding:0 40px; text-align:center; ' +
  'font-family:Helvetica,Arial,sans-serif; font-size:9px; color:#8c8c8c;';

const headerTemplate = `<div style="${PDF_TEMPLATE_STYLE}">${PDF_HEADER_TEXT}</div>`;

const footerTemplate = `<div style="${PDF_TEMPLATE_STYLE}"><span class="pageNumber"></span> / <span class="totalPages"></span></div>`;

// Top and bottom only. The templates render in the margin box, so at 0 they
// would print straight over the document's own content; left and right stay 0
// because the templates handle their own horizontal padding and the invoice
// layout expects the full page width.
const PDF_MARGIN = { top: '44px', right: '0px', bottom: '44px', left: '0px' };

async function getBrowser() {
  const isServerless = !!(
    process.env.VERCEL ||
    process.env.AWS_LAMBDA_FUNCTION_NAME ||
    process.env.LAMBDA_TASK_ROOT ||
    process.env.NODE_ENV === 'production'
  );

  if (isServerless) {
    try {
      const chromium = require('@sparticuz/chromium');
      const puppeteer = require('puppeteer-core');
      return await puppeteer.launch({
        args: [
          ...chromium.args,
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--single-process',
          '--no-zygote',
          '--hide-scrollbars',
          '--disable-web-security',
        ],
        defaultViewport: chromium.defaultViewport,
        executablePath: await chromium.executablePath(),
        headless: chromium.headless,
        ignoreHTTPSErrors: true,
      });
    } catch (e) {
      console.warn('Serverless chromium launch error:', e.message);
    }
  }

  // Local development fallback: try installed Chrome/Edge
  try {
    const localPaths = [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
      '/usr/bin/google-chrome',
      '/usr/bin/chromium-browser',
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    ];
    const execPath = localPaths.find((p) => fs.existsSync(p));
    if (execPath) {
      const puppeteer = require('puppeteer-core');
      return await puppeteer.launch({
        executablePath: execPath,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
        headless: true,
      });
    }
  } catch (e) {
    console.warn('Local browser launch error:', e.message);
  }

  return null;
}

async function renderHtmlToPdf(htmlContent, format = 'A4') {
  let browser = null;
  try {
    browser = await getBrowser();
    if (browser) {
      const page = await browser.newPage();
      // 'domcontentloaded' completes quickly in memory without waiting on external requests
      await page.setContent(htmlContent, {
        waitUntil: 'domcontentloaded',
        timeout: 8000,
      });
      const pdfBuffer = await page.pdf({
        format: format || 'A4',
        printBackground: true,
        displayHeaderFooter: true,
        headerTemplate,
        footerTemplate,
        margin: PDF_MARGIN,
      });
      await browser.close();
      browser = null;
      return { pdfBuffer };
    }
  } catch (err) {
    console.error('Browser PDF generation error:', err.message);
    if (browser) {
      try {
        await browser.close();
      } catch (_) {}
    }
  }

  return { htmlContent };
}

exports.generatePdf = async (
  modelName,
  info = { filename: 'pdf_file', format: 'A4', targetLocation: '' },
  result,
  callback
) => {
  try {
    const { targetLocation } = info;

    if (pugFiles.includes(modelName.toLowerCase())) {
      // Tenant isolation: render the PDF with the settings of the admin who owns
      // the document, never with another tenant's configuration.
      const settings = await loadSettings(info.adminId);
      const selectedLang = settings['idurar_app_language'];
      const translate = useLanguage({ selectedLang });

      const {
        currency_symbol,
        currency_position,
        decimal_sep,
        thousand_sep,
        cent_precision,
        zero_format,
      } = settings;

      const { moneyFormatter } = useMoney({
        settings: {
          currency_symbol,
          currency_position,
          decimal_sep,
          thousand_sep,
          cent_precision,
          zero_format,
        },
      });
      const { dateFormat } = useDate({ settings });

      // In-memory logo processing: ensure no self-fetching HTTP requests
      if (settings.company_logo && !settings.company_logo.startsWith('data:')) {
        try {
          const logoPath = path.join(__dirname, '..', '..', settings.company_logo);
          if (fs.existsSync(logoPath)) {
            const ext = path.extname(logoPath).slice(1) || 'png';
            const logoBuffer = fs.readFileSync(logoPath);
            settings.company_logo = `data:image/${ext};base64,${logoBuffer.toString('base64')}`;
          }
        } catch (e) {
          console.error('Error inlining company logo:', e);
        }
      }
      settings.public_server_file = '';

      const htmlContent = pug.renderFile(
        path.join(__dirname, '..', '..', 'pdf', modelName + '.pug'),
        {
          model: result,
          settings,
          translate,
          dateFormat,
          moneyFormatter,
          moment: moment,
          // Becomes the document's <title>, which is both the PDF's embedded
          // Title and what a browser shows in its own print header. Without it
          // a browser printing the HTML fallback labels the page with the
          // backend's URL, because that is all it has to go on.
          pdfTitle: pdfDocumentName(modelName, result),
        }
      );

      const { pdfBuffer } = await renderHtmlToPdf(htmlContent, info.format);

      if (targetLocation && pdfBuffer) {
        try {
          const dir = path.dirname(targetLocation);
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }
          fs.writeFileSync(targetLocation, pdfBuffer);
        } catch (err) {
          console.warn('Could not write targetLocation to disk:', err.message);
        }
      }

      if (callback && typeof callback === 'function') {
        await callback();
      }

      return { pdfBuffer, htmlContent };
    }
  } catch (error) {
    console.error('generatePdf error:', error);
    throw new Error(error.message || error);
  }
};

// Used by the download handler to name the file the browser saves.
exports.pdfDocumentName = pdfDocumentName;
