const dns = require('dns');
try {
  dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);
} catch (e) {
  // ignore
}

const path = require('path');
const dotenv = require(path.resolve('backend/node_modules/dotenv'));
dotenv.config({ path: 'backend/.env' });
const mongoose = require(path.resolve('backend/node_modules/mongoose'));

async function inspectAndPurge() {
  try {
    console.log('Connecting to database...');
    await mongoose.connect(process.env.DATABASE, {
      serverSelectionTimeoutMS: 15000,
    });
    console.log('Connected successfully!');

    const targetCollections = [
      'websiteconfigs',
      'productsyncs',
      'onlineorders',
      'customersyncs',
    ];

    const collections = await mongoose.connection.db.listCollections().toArray();
    const existingNames = collections.map((c) => c.name.toLowerCase());
    console.log('Existing DB collections:', existingNames);

    const report = {};

    for (const name of targetCollections) {
      if (existingNames.includes(name)) {
        const col = mongoose.connection.db.collection(name);
        const countBefore = await col.countDocuments({});
        const deleteResult = await col.deleteMany({});
        report[name] = {
          countBefore,
          deletedCount: deleteResult.deletedCount,
          remaining: await col.countDocuments({}),
        };
      } else {
        report[name] = {
          countBefore: 0,
          deletedCount: 0,
          remaining: 0,
          note: 'Collection not present in database',
        };
      }
    }

    console.log('PURGE REPORT:');
    console.log(JSON.stringify(report, null, 2));

    await mongoose.disconnect();
    console.log('Database disconnected successfully.');
  } catch (err) {
    console.error('Purge script error:', err);
    process.exit(1);
  }
}

inspectAndPurge();
