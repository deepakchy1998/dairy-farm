import mongoose from 'mongoose';

const customerSchema = new mongoose.Schema({
  farmId: { type: mongoose.Schema.Types.ObjectId, ref: 'Farm', required: true },
  name: { type: String, required: true, trim: true },
  phone: { type: String, default: '', trim: true },
  address: { type: String, default: '', trim: true },
  village: { type: String, default: '', trim: true },
  dailyQuantity: { type: Number, required: true, min: 0 }, // Fixed daily litres
  ratePerLiter: { type: Number, required: true, min: 0 },  // ₹ per liter
  deliveryTime: { type: String, default: 'morning' },
  status: { type: String, enum: ['active', 'paused', 'closed'], default: 'active' },
  startDate: { type: Date, default: Date.now },
  balance: { type: Number, default: 0 }, // Outstanding amount (positive = customer owes)
  notes: { type: String, default: '' },
}, { timestamps: true });

customerSchema.index({ farmId: 1, status: 1 });
customerSchema.index({ farmId: 1, name: 1 });

export default mongoose.model('Customer', customerSchema);
