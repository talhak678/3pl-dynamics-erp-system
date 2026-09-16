const custom = require('../../controllers/pdfController');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const os = require('os');

module.exports = downloadPdf = async (req, res, { directory, id }) => {
  try {
    const modelName = directory.slice(0, 1).toUpperCase() + directory.slice(1);
    if (mongoose.models[modelName]) {
      const Model = mongoose.model(modelName);
      const result = await Model.findOne({
        _id: id,
      }).exec();

      // Throw error if no result
      if (!result) {
        throw { name: 'ValidationError' };
      }

      // Continue process if result is returned

      // Two names, deliberately. The temp file on disk stays keyed by id so two
      // documents sharing a number can never collide in the shared temp
      // directory. The name the browser saves under is the professional one.
      const fileId = modelName.toLowerCase() + '-' + result._id + '.pdf';
      const downloadName = custom.pdfDocumentName(modelName, result);
      const folderPath = modelName.toLowerCase();
      // Use os.tmpdir() for Vercel compatibility (read-only filesystem)
      const tmpDir = path.join(os.tmpdir(), 'download', folderPath);
      if (!fs.existsSync(tmpDir)) {
        fs.mkdirSync(tmpDir, { recursive: true });
      }
      const targetLocation = path.join(tmpDir, fileId);
      // The /download route is public (client-facing links), so the tenant is
      // derived from the document itself rather than from a session.
      const { pdfBuffer, htmlContent } = await custom.generatePdf(
        modelName,
        {
          filename: folderPath,
          format: 'A4',
          targetLocation,
          adminId: result.createdBy,
        },
        result
      );

      if (pdfBuffer) {
        res.setHeader('Content-Type', 'application/pdf');
        // This header, not the URL, is what names the saved file. The route
        // path still ends in the id — the handler parses the id out of it — so
        // the professional name has to come from here or not at all.
        res.setHeader('Content-Disposition', `attachment; filename="${downloadName}.pdf"`);
        res.setHeader('Content-Length', pdfBuffer.length);
        return res.end(pdfBuffer);
      } else if (htmlContent) {
        const printableHtml = htmlContent.includes('window.print()')
          ? htmlContent
          : htmlContent.replace(
              '</body>',
              '<script>window.onload = function() { window.print(); };</script></body>'
            );
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.send(printableHtml);
      } else {
        throw new Error('PDF generation produced no output');
      }
    } else {
      return res.status(404).json({
        success: false,
        result: null,
        message: `Model '${modelName}' does not exist`,
      });
    }
  } catch (error) {
    // If error is thrown by Mongoose due to required validations
    if (error.name == 'ValidationError') {
      return res.status(400).json({
        success: false,
        result: null,
        error: error.message,
        message: 'Required fields are not supplied',
      });
    } else if (error.name == 'BSONTypeError') {
      // If error is thrown by Mongoose due to invalid ID
      return res.status(400).json({
        success: false,
        result: null,
        error: error.message,
        message: 'Invalid ID',
      });
    } else {
      // Server Error
      return res.status(500).json({
        success: false,
        result: null,
        error: error.message,
        message: error.message,
        controller: 'downloadPDF.js',
      });
    }
  }
};
