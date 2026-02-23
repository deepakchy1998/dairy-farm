import mongoose from 'mongoose';

const activitySchema = new mongoose.Schema({
  farmId: { type: mongoose.Schema.Types.ObjectId, ref: 'Farm', required: true },
  type: { type: String, required: true },
  icon: { type: String, default: '📋' },
  message: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
});

activitySchema.index({ farmId: 1, timestamp: -1 });

export default mongoose.model('Activity', activitySchema);
