const mail = async (req, res) => {
  return res.status(503).json({
    success: false,
    result: null,
    message: 'Mail service is not configured. Please set up an email provider.',
  });
};

module.exports = mail;
