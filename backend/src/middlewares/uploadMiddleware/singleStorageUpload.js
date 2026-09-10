const multer = require('multer');
const path = require('path');

const fileFilter = require('./utils/LocalfileFilter');

const singleStorageUpload = ({
  entity,
  fileType = 'default',
  uploadFieldName = 'file',
  fieldName = 'file',
}) => {
  // Use memoryStorage instead of diskStorage for Vercel compatibility
  const memStorage = multer.memoryStorage();

  let filterType = fileFilter(fileType);

  const upload = multer({ storage: memStorage, fileFilter: filterType }).single('file');

  // Return a middleware that runs multer, then converts the buffer to a Base64 data URI
  return (req, res, next) => {
    upload(req, res, (err) => {
      if (err) {
        return res.status(400).json({
          success: false,
          result: null,
          message: 'File upload error: ' + err.message,
        });
      }

      if (req.file) {
        // Convert buffer to Base64 data URI
        const base64 = req.file.buffer.toString('base64');
        const dataUri = `data:${req.file.mimetype};base64,${base64}`;

        // Set the data URI on the request body for the controller to save to MongoDB
        req.body[fieldName] = dataUri;
      }

      next();
    });
  };
};

module.exports = singleStorageUpload;
