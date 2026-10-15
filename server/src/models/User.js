import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    // stores the bcrypt hash, never the plain-text password
    password: { type: String, required: true, select: false }
  },
  { timestamps: true }
);

userSchema.methods.comparePassword = async function (password) {
  return bcrypt.compare(password, this.password);
};

export const User = mongoose.model('User', userSchema);
