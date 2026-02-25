import mongoose from 'mongoose';

const healthRecordSchema = new mongoose.Schema({
  farmId: { type: mongoose.Schema.Types.ObjectId, ref: 'Farm', required: true },
  cattleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Cattle', required: true },
  date: { type: Date, required: true },
  type: { type: String, required: true },
  description: { type: String, required: true },
  medicine: { type: String, default: '' },
  cost: { type: Number, default: 0 },
  nextDueDate: Date,
  vetName: { type: String, default: '' },
  notes: { type: String, default: '' },
}, { timestamps: true });

healthRecordSchema.index({ farmId: 1, date: -1 });

export default mongoose.model('HealthRecord', healthRecordSchema);
