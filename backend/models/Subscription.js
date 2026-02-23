import mongoose from 'mongoose';

const subscriptionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  plan: { type: String, enum: ['trial', 'monthly', 'quarterly', 'halfyearly', 'yearly'], required: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

subscriptionSchema.index({ userId: 1, endDate: -1 });

export default mongoose.model('Subscription', subscriptionSchema);
