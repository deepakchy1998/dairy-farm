import mongoose from 'mongoose';

const milkRecordSchema = new mongoose.Schema({
  farmId: { type: mongoose.Schema.Types.ObjectId, ref: 'Farm', required: true },
  cattleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Cattle', required: true },
  date: { type: Date, required: true },
  morningYield: { type: Number, default: 0 },
  morningFat: { type: Number },
  morningSNF: { type: Number },
  afternoonYield: { type: Number, default: 0 },
  afternoonFat: { type: Number },
  afternoonSNF: { type: Number },
  eveningYield: { type: Number, default: 0 },
  eveningFat: { type: Number },
  eveningSNF: { type: Number },
  totalYield: { type: Number, default: 0 },
}, { timestamps: true });

milkRecordSchema.index({ farmId: 1, cattleId: 1, date: 1 }, { unique: true });

milkRecordSchema.pre('save', function (next) {
  this.totalYield = (this.morningYield || 0) + (this.afternoonYield || 0) + (this.eveningYield || 0);
  next();
});

export default mongoose.model('MilkRecord', milkRecordSchema);
