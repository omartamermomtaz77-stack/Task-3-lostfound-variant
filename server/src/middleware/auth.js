import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';

export async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const match = /^Bearer\s+(\S+)$/i.exec(authHeader);
  if (!match) return res.status(401).json({ message: 'Missing or invalid Bearer token' });

  let payload;
  try {
    payload = jwt.verify(match[1], process.env.JWT_SECRET, { algorithms: ['HS256'] });
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }

  if (!payload || typeof payload !== 'object' || typeof payload.id !== 'string' ||
      !/^[a-f\d]{24}$/i.test(payload.id)) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }

  try {
    const user = await User.findById(payload.id).select('name');
    if (!user) return res.status(401).json({ message: 'Account no longer exists' });
    req.user = { id: user._id.toString(), name: user.name };
    return next();
  } catch (err) {
    return next(err);
  }
}
