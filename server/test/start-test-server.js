import { randomBytes } from 'node:crypto';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../src/app.js';
import { User } from '../src/models/User.js';
import { Item } from '../src/models/Item.js';

// Browser tests never load .env or write to the configured application database.
process.env.JWT_SECRET = randomBytes(32).toString('hex');
process.env.JWT_EXPIRES_IN = '1h';
const mongo = await MongoMemoryServer.create();
await mongoose.connect(mongo.getUri());
await Promise.all([User.init(), Item.init()]);
const server = app.listen(4001, '127.0.0.1');

async function stop() {
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
  await mongoose.disconnect();
  await mongo.stop();
  process.exit(0);
}

process.on('SIGINT', stop);
process.on('SIGTERM', stop);
