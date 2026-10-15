import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import Joi from 'joi';
import { User } from '../models/User.js';

const registerSchema = Joi.object({
  name: Joi.string().trim().min(2).max(60).required(),
  email: Joi.string().trim().lowercase().email().required(),
  password: Joi.string().min(6).custom(validatePasswordLength).required()
});

// POST /api/auth/register
export async function register(req, res, next) {
  try {
    const { value, error } = registerSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.message });

    const existing = await User.findOne({ email: value.email });
    if (existing) return res.status(409).json({ message: 'Email already used' });

    const password = await bcrypt.hash(value.password, 10);
    const user = await User.create({ name: value.name, email: value.email, password });
    const token = signToken(user);
    res.status(201).json({ token, user: publicUser(user) });
  } catch (err) {
    // The unique index also handles two registrations arriving together.
    if (err.code === 11000) return res.status(409).json({ message: 'Email already used' });
    next(err);
  }
}

const loginSchema = Joi.object({
  email: Joi.string().trim().lowercase().email().required(),
  password: Joi.string().custom(validatePasswordLength).required()
});

// POST /api/auth/login
export async function login(req, res, next) {
  try {
    const { value, error } = loginSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.message });

    const user = await User.findOne({ email: value.email }).select('+password');
    if (!user) return res.status(401).json({ message: 'Invalid credentials' });

    const ok = await user.comparePassword(value.password);
    if (!ok) return res.status(401).json({ message: 'Invalid credentials' });

    const token = signToken(user);
    res.json({ token, user: publicUser(user) });
  } catch (err) { next(err); }
}

// GET /api/auth/me
export async function me(req, res, next) {
  try {
    const user = await User.findById(req.user.id).lean();
    if (!user) return res.status(401).json({ message: 'Account no longer exists' });
    res.json({ user: publicUser(user) });
  } catch (err) { next(err); }
}

function signToken(user) {
  const payload = { id: user._id.toString(), name: user.name };
  return jwt.sign(payload, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
}

function validatePasswordLength(value, helpers) {
  // bcrypt ignores bytes after the 72nd; reject rather than silently truncate.
  if (Buffer.byteLength(value, 'utf8') > 72) {
    return helpers.message('Password must be at most 72 UTF-8 bytes');
  }
  return value;
}

function publicUser(u) {
  return { id: u._id?.toString() || u.id, name: u.name, email: u.email };
}
