import dotenv from 'dotenv';
dotenv.config();
import app from './app.js';
import { connectDB } from './config/db.js';

const PORT = process.env.PORT || 4000;

async function bootstrap() {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'change-me') {
    throw new Error('Set JWT_SECRET to a random secret in server/.env before starting the API');
  }
  await connectDB();
  app.listen(PORT, () => {
    console.log(`API listening on http://localhost:${PORT}`);
  });
}
bootstrap().catch(err => {
  console.error('Could not start API:', err.message);
  process.exit(1);
});
