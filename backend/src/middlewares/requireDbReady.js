const connectDB = require('../utils/connectDB');

/**
 * Express middleware that guarantees MongoDB is connected before any route
 * handler fires.
 *
 * WHY THIS EXISTS
 *
 * On Vercel Serverless, Express starts accepting requests the instant the
 * module is loaded. If the DB connection is still in flight (or has failed),
 * every Mongoose operation issued by a controller will be buffered — and with
 * `bufferCommands: false` (set in connectDB.js) they will throw immediately
 * instead of hanging for 10 seconds.
 *
 * This middleware sits before every `/api` route and `await`s the cached
 * connection promise. There are only three outcomes:
 *
 *   1. Already connected → the await resolves instantly (< 1 ms).
 *   2. Connection in flight → the await waits for the same handshake every
 *      concurrent request is also waiting on (no duplicate connections).
 *   3. Connection fails → the catch block returns a structured 500 before any
 *      controller code runs, so the client gets a clear error instead of a
 *      Mongoose buffering timeout.
 *
 * PLACEMENT
 *
 * Must be `app.use`'d **before** any router that touches the database.
 * In app.js this is mounted as:
 *
 *     app.use(requireDbReady);          // ← first
 *     app.use('/api', coreAuthRouter);  // ← then routes
 */
async function requireDbReady(req, res, next) {
  try {
    await connectDB();
    next();
  } catch (error) {
    console.error('requireDbReady: DB connection failed for', req.method, req.originalUrl);
    return res.status(500).json({
      success: false,
      result: null,
      message: 'Database connection failed',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}

module.exports = requireDbReady;
