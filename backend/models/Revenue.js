import mongoose from 'mongoose';

const revenueSchema = new mongoose.Schema({
  farmId: { type: mongoose.Schema.Types.ObjectId, ref: 'Farm', required: true },
  date: { type: Date, required: true },
  category: { type: String, required: true },
  description: { type: String, default: '' },
  amount: { type: Number, required: true },
  milkSaleType: { type: String, enum: ['retail', 'dairy', 'other', ''], default: '' },
  milkQuantity: { type: Number },
  milkRate: { type: Number },
  // Cattle sale fields
  cattleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Cattle' },
  cattleTagNumber: { type: String },
  buyerName: { type: String },
  buyerPhone: { type: String },
  buyerAddress: { type: String },
}, { timestamps: true });

revenueSchema.index({ farmId: 1, date: -1 });

export default mongoose.model('Revenue', revenueSchema);
