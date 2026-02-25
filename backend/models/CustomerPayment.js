import mongoose from 'mongoose';

const customerPaymentSchema = new mongoose.Schema({
  farmId: { type: mongoose.Schema.Types.ObjectId, ref: 'Farm', required: true },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
  date: { type: Date, required: true },
  amount: { type: Number, required: true, min: 0 },
  method: { type: String, enum: ['cash', 'upi', 'bank', 'other'], default: 'cash' },
  notes: { type: String, default: '' },
  month: { type: String, default: '' }, // e.g., '2026-02' — which month this payment is for
}, { timestamps: true });

customerPaymentSchema.index({ farmId: 1, customerId: 1, date: -1 });
customerPaymentSchema.index({ farmId: 1, date: -1 });

export default mongoose.model('CustomerPayment', customerPaymentSchema);
