const mongoose = require('mongoose');

/**
 * Global MongoDB connection cache for Vercel Serverless.
 *
 * WHY THIS EXISTS
 *
 * On Vercel, every request may land on a fresh Lambda micro-VM (a "cold
 * start"). Without caching the connection promise, each cold start calls
 * mongoose.connect() independently. Worse, two concurrent requests hitting the
 * same VM before the first connect() resolves will each start their own
 * connection — doubling the pool against a cluster that already saw a wave of
 * connects from the previous cold start.
 *
 * The pattern below stores the in-flight promise on Node's `global` object (the
 * only thing that survives between invocations on the same VM) so the second
 * caller awaits the same handshake the first started.
 *
 * HOW THE OPTIONS WERE CHOSEN
 *
 *   bufferCommands: false
 *     Mongoose normally queues operations issued before the connection opens
 *     (the "buffer"). In a serverless function with a 10-second wall clock,
 *     that buffer is a trap: the operation sits there until bufferTimeoutMS
 *     (default 10 000 ms) expires and then throws — which is exactly the error
 *     the user sees ("buffering timed out after 10000ms"). Disabling it makes
 *     the operation fail immediately if the connection is not ready, which is
 *     what the requireDbReady middleware is designed to catch.
 *
 *   serverSelectionTimeoutMS: 5000
 *     The driver keeps retrying server selection for 30 seconds by default.
 *     On a serverless function that will be killed in 10s, 30s of retries is
 *     wasted compute. 5s gives Atlas a fair chance (its SRV lookup + TLS
 *     handshake is normally < 2s) while leaving time for the function to
 *     return a proper 500 instead of being killed mid-retry.
 *
 *   socketTimeoutMS: 45000
 *     How long to wait for a response to an individual operation after the
 *     socket is established. The default (0 = no timeout) risks hanging a
 *     function until Vercel kills it; 45s is generous but bounded.
 *
 *   maxPoolSize: 10
 *     The default of 100 is sized for a long-lived server. A serverless
 *     function handles one request (or a small burst) and then idles. 10
 *     connections is more than enough and avoids exhausting Atlas's 500-
 *     connection M0/M2/M5 ceiling when dozens of VMs spin up at once.
 */

const MONGO_OPTIONS = {
  bufferCommands: false,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
  maxPoolSize: 10,
};

/**
 * Returns a promise that resolves to the cached Mongoose connection.
 *
 * Safe to call from multiple places (middleware, server.js, scripts) — only the
 * first call actually connects; subsequent calls await the same promise.
 *
 * @returns {Promise<typeof mongoose>}
 */
async function connectDB() {
  const uri = process.env.DATABASE;

  if (!uri) {
    throw new Error(
      'DATABASE environment variable is not set. ' +
        'MongoDB cannot connect without a connection string.'
    );
  }

  // ── Global cache ────────────────────────────────────────────────────────
  // `global.__mongo_conn` survives between invocations on the same Vercel VM.
  // On a traditional server it is also harmless — it just means reconnect()
  // is never called twice.
  if (!global.__mongo_conn) {
    global.__mongo_conn = { promise: null, connected: false };
  }

  const cache = global.__mongo_conn;

  // Already connected and the connection is still alive.
  if (cache.connected && mongoose.connection.readyState === 1) {
    return mongoose;
  }

  // A connect() is already in flight — piggyback on it.
  if (cache.promise) {
    await cache.promise;
    return mongoose;
  }

  // First call on this VM — start the handshake.
  cache.promise = mongoose
    .connect(uri, MONGO_OPTIONS)
    .then((m) => {
      cache.connected = true;
      console.log('MongoDB connected (serverless-optimized)');
      return m;
    })
    .catch((err) => {
      // Clear the cache so the next invocation retries instead of awaiting a
      // permanently rejected promise.
      cache.promise = null;
      cache.connected = false;
      console.error('MongoDB connection failed:', err.message);
      throw err;
    });

  await cache.promise;
  return mongoose;
}

module.exports = connectDB;
