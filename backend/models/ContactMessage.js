import mongoose from 'mongoose';

const contactMessageSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  farmId: { type: mongoose.Schema.Types.ObjectId, ref: 'Farm' },
  name: { type: String, required: true },
  email: { type: String, required: true },
  subject: { type: String, required: true },
  message: { type: String, required: true },
  status: { type: String, enum: ['open', 'replied', 'closed'], default: 'open' },
  adminReply: { type: String, default: '' },
}, { timestamps: true });

contactMessageSchema.index({ userId: 1, createdAt: -1 });
contactMessageSchema.index({ status: 1, createdAt: -1 });

export default mongoose.model('ContactMessage', contactMessageSchema);
