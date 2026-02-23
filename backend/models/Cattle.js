import mongoose from 'mongoose';

const cattleSchema = new mongoose.Schema({
  farmId: { type: mongoose.Schema.Types.ObjectId, ref: 'Farm', required: true },
  tagNumber: { type: String, required: true, trim: true },
  breed: { type: String, required: true, trim: true },
  gender: { type: String, enum: ['male', 'female'], required: true },
  dateOfBirth: { type: Date },
  category: { type: String, enum: ['milking', 'dry', 'heifer', 'calf', 'bull', 'pregnant'], required: true },
  status: { type: String, enum: ['active', 'sold', 'dead'], default: 'active' },
  purchaseDate: Date,
  purchasePrice: Number,
  weight: Number,
  color: { type: String, default: '' },
  motherTag: { type: String, default: '' },
  fatherTag: { type: String, default: '' },
  notes: { type: String, default: '' },
  image: { type: String, default: '' },
}, { timestamps: true });

cattleSchema.index({ farmId: 1, tagNumber: 1 }, { unique: true });

export default mongoose.model('Cattle', cattleSchema);
