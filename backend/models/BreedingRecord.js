import mongoose from 'mongoose';

const breedingRecordSchema = new mongoose.Schema({
  farmId: { type: mongoose.Schema.Types.ObjectId, ref: 'Farm', required: true },
  cattleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Cattle', required: true },
  breedingDate: { type: Date, required: true },
  method: { type: String, enum: ['natural', 'artificial'], required: true },
  bullInfo: { type: String, default: '' },
  inseminatorName: { type: String, default: '' },
  expectedDelivery: Date,
  actualDelivery: Date,
  status: { type: String, enum: ['bred', 'confirmed', 'delivered', 'failed'], default: 'bred' },
  offspring: { type: String, default: '' },
  notes: { type: String, default: '' },
}, { timestamps: true });

breedingRecordSchema.index({ farmId: 1, breedingDate: -1 });

export default mongoose.model('BreedingRecord', breedingRecordSchema);
