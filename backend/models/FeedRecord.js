import mongoose from 'mongoose';

const feedRecordSchema = new mongoose.Schema({
  farmId: { type: mongoose.Schema.Types.ObjectId, ref: 'Farm', required: true },
  date: { type: Date, required: true },
  feedType: { type: String, required: true, trim: true },
  quantity: { type: Number, required: true },
  unit: { type: String, enum: ['kg', 'quintal', 'ton'], default: 'kg' },
  cost: { type: Number, default: 0 },
  notes: { type: String, default: '' },
}, { timestamps: true });

feedRecordSchema.index({ farmId: 1, date: -1 });

export default mongoose.model('FeedRecord', feedRecordSchema);
