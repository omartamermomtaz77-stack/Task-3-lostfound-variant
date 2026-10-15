import Joi from 'joi';
import { Item } from '../models/Item.js';

const itemSchema = Joi.object({
  title: Joi.string().trim().min(2).required(),
  description: Joi.string().allow(''),
  category: Joi.string().valid('electronics', 'clothing', 'documents', 'accessories', 'other').default('other'),
  status: Joi.string().valid('lost', 'found', 'claimed').default('lost'),
  location: Joi.string().trim().allow('').default(''),
  // the reporter is always the logged-in user, never taken from the body
  reportedBy: Joi.forbidden()
});

export async function getAllItems(req, res, next) {
  try {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.category) filter.category = req.query.category;

    const items = await Item.find(filter)
      .populate('reportedBy', 'name email')
      .sort({ createdAt: -1 })
      .lean();
    res.json({ items });
  } catch (err) { next(err); }
}

export async function getItem(req, res, next) {
  try {
    const item = await Item.findById(req.params.id).populate('reportedBy', 'name email');
    if (!item) return res.status(404).json({ message: 'Item not found' });
    res.json({ item });
  } catch (err) { next(err); }
}

export async function createItem(req, res, next) {
  try {
    const { value, error } = itemSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.message });

    const doc = await Item.create({ ...value, reportedBy: req.user.id });
    await doc.populate('reportedBy', 'name email');
    res.status(201).json({ item: doc });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ message: 'Duplicate item at this location' });
    next(err);
  }
}

export async function updateItem(req, res, next) {
  try {
    const existing = await Item.findById(req.params.id);
    if (!existing) return res.status(404).json({ message: 'Item not found' });
    if (existing.reportedBy?.toString() !== req.user.id) {
      return res.status(403).json({ message: 'You can only edit items you reported' });
    }

    const { title, description, category, status, location } = existing;
    const current = { title, description, category, status, location };
    const merged = { ...current, ...req.body };
    const { value, error } = itemSchema.validate(merged, { abortEarly: false });
    if (error) return res.status(400).json({ message: error.message });

    const doc = await Item.findByIdAndUpdate(req.params.id, { $set: value }, { new: true, runValidators: true })
      .populate('reportedBy', 'name email');
    res.json({ item: doc });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ message: 'Duplicate item at this location' });
    next(err);
  }
}

export async function deleteItem(req, res, next) {
  try {
    const existing = await Item.findById(req.params.id);
    if (!existing) return res.status(404).json({ message: 'Item not found' });
    if (existing.reportedBy?.toString() !== req.user.id) {
      return res.status(403).json({ message: 'You can only delete items you reported' });
    }

    await existing.deleteOne();
    res.json({ ok: true });
  } catch (err) { next(err); }
}
