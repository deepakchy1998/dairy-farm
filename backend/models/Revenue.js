import mongoose from 'mongoose';

const revenueSchema = new mongoose.Schema({
  farmId: { type: mongoose.Schema.Types.ObjectId, ref: 'Farm', required: true },
  date: { type: Date, required: true },
  category: { type: String, enum: ['milk_sale', 'cattle_sale', 'manure_sale', 'other'], required: true },
  description: { type: String, default: '' },
  amount: { type: Number, required: true },
  milkSaleType: { type: String, enum: ['retail', 'dairy', 'other', ''], default: '' },
  milkQuantity: { type: Number },
  milkRate: { type: Number },
}, { timestamps: true });

revenueSchema.index({ farmId: 1, date: -1 });

export default mongoose.model('Revenue', revenueSchema);
