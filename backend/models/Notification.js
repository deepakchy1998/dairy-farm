import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
  farmId: { type: mongoose.Schema.Types.ObjectId, ref: 'Farm', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  message: { type: String, required: true },
  severity: { type: String, enum: ['info', 'warning', 'critical'], default: 'info' },
  type: { type: String, required: true }, // vaccination_due, breeding_due, low_milk, expense_alert, etc.
  actionUrl: { type: String, default: '' },
  read: { type: Boolean, default: false },
  refId: { type: String, default: '' }, // Dedup key to avoid duplicate notifications
}, { timestamps: true });

notificationSchema.index({ farmId: 1, userId: 1, createdAt: -1 });
notificationSchema.index({ refId: 1 }, { unique: true, sparse: true });

export default mongoose.model('Notification', notificationSchema);
