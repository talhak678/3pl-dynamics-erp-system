const mongoose = require('mongoose');
const connectDB = require('./utils/connectDB');

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

/**
 * Kick off the database connection eagerly.
 *
 * connectDB() stores its promise on `global.__mongo_conn`, so this call is
 * safe to make at module-load time: if the module is loaded again on the same
 * Vercel micro-VM, the second call piggybacks on the first. The
 * requireDbReady middleware in app.js will await the same promise before any
 * route handler fires, so there is no race between "DB connecting" and "first
 * request arrives".
 *
 * On a traditional long-running server this behaves identically to the old
 * `mongoose.connect()` call — the only difference is the options object and
 * the global cache, neither of which changes anything for a process that stays
 * alive.
 */
connectDB().catch(() => {
  // connectDB already logs the error. The catch here prevents an
  // unhandledRejection during module-load from crashing the process before
  // the server starts. The requireDbReady middleware will return 500 for every
  // request until the connection succeeds on a retry.
});

mongoose.connection.on('error', (error) => {
  console.error('MongoDB runtime error:', error);
});

mongoose.connection.on('disconnected', () => {
  console.warn('MongoDB disconnected — next request will attempt reconnection.');
  // Clear the global cache so the next invocation of connectDB() retries
  // instead of awaiting a stale promise.
  if (global.__mongo_conn) {
    global.__mongo_conn.promise = null;
    global.__mongo_conn.connected = false;
  }
});

if (require.main === module) {
  app.listen(port, () => {
    console.log(`Express running → On PORT : ${port}`);
  });
}

module.exports = app;
