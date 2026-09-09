const mongoose = require('mongoose');

process.on('unhandledRejection', (error) => {
  console.error('Unhandled promise rejection:', error);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
});

require('dotenv').config({ path: '.env' });
require('dotenv').config({ path: '.env.local' });

let app;
try {
  app = require('./app');
} catch (error) {
  console.error('Backend startup failed:', error);
  throw error;
}

const port = process.env.PORT || 8888;
const databaseUrl = process.env.DATABASE;

if (!databaseUrl) {
  console.error('DATABASE environment variable is required');
} else {
  mongoose
    .connect(databaseUrl)
    .then(() => console.log('MongoDB connected'))
    .catch((error) => console.error('MongoDB connection failed:', error));
}

mongoose.connection.on('error', (error) => {
  console.error('MongoDB runtime error:', error);
});

if (require.main === module) {
  app.listen(port, () => {
    console.log(`Express running → On PORT : ${port}`);
  });
}

module.exports = app;
