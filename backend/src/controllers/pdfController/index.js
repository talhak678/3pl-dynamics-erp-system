const pug = require('pug');
const fs = require('fs');
const path = require('path');
const moment = require('moment');
const { loadSettings } = require('../../middlewares/settings');
const useLanguage = require('../../locale/useLanguage');
const { useMoney, useDate } = require('../../settings');

const pugFiles = ['invoice', 'offer', 'quote', 'payment'];

require('dotenv').config({ path: '.env' });
require('dotenv').config({ path: '.env.local' });

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
        margin: { top: '0px', right: '0px', bottom: '0px', left: '0px' },
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
      const settings = await loadSettings();
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
