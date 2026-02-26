import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  plan: { type: String, required: true },
  amount: { type: Number, required: true },
  upiTransactionId: { type: String, required: true },
  screenshot: { type: String, default: '' }, // base64 image
  paymentMethod: { type: String, enum: ['upi_manual', 'razorpay'], default: 'upi_manual' },
  razorpayOrderId: { type: String, default: '' },
  razorpayPaymentId: { type: String, default: '' },
  razorpaySignature: { type: String, default: '' },
  ipAddress: { type: String, default: '' },
  userAgent: { type: String, default: '' },
  status: { type: String, enum: ['pending', 'verified', 'rejected', 'expired'], default: 'pending' },
  verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  adminNote: { type: String, default: '' },
  expiresAt: { type: Date }, // Auto-expire unverified payments after 48hrs
  customDays: { type: Number },
  customModules: [{ type: String }],
}, { timestamps: true });

// Prevent duplicate transaction IDs (only for non-rejected/expired)
paymentSchema.index(
  { upiTransactionId: 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $in: ['pending', 'verified'] } },
  }
);

paymentSchema.index({ userId: 1, createdAt: -1 });

export default mongoose.model('Payment', paymentSchema);
