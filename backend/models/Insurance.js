import mongoose from 'mongoose';

const insuranceSchema = new mongoose.Schema({
  farmId: { type: mongoose.Schema.Types.ObjectId, ref: 'Farm', required: true },
  cattleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Cattle', required: true },
  provider: { type: String, required: true, trim: true },
  policyNumber: { type: String, required: true, trim: true },
  sumInsured: { type: Number, required: true },
  premium: { type: Number, required: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  status: { type: String, enum: ['active', 'expired', 'claimed', 'cancelled'], default: 'active' },
  claimAmount: { type: Number, default: 0 },
  claimDate: { type: Date },
  claimStatus: { type: String, enum: ['none', 'filed', 'approved', 'rejected'], default: 'none' },
  notes: { type: String, default: '' },
  govtScheme: { type: String, default: '' },
}, { timestamps: true });

insuranceSchema.index({ farmId: 1, cattleId: 1 });
insuranceSchema.index({ farmId: 1, endDate: 1 });

export default mongoose.model('Insurance', insuranceSchema);
