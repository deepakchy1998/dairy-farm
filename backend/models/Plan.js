import mongoose from 'mongoose';

const planSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true }, // e.g. 'monthly', 'yearly', 'premium_quarterly'
  label: { type: String, required: true }, // Display name: 'Monthly', 'Yearly'
  price: { type: Number, required: true },
  days: { type: Number, required: true },
  period: { type: String, default: '' }, // e.g. '/month', '/year'
  features: [{ type: String }], // e.g. ['All features', 'Unlimited cattle']
  isPopular: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
  sortOrder: { type: Number, default: 0 },
}, { timestamps: true });

planSchema.index({ isActive: 1, sortOrder: 1 });

export default mongoose.model('Plan', planSchema);
