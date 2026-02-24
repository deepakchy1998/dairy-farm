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
  salePrice: { type: Number, default: 0 },
  saleDate: { type: Date },
  deathDate: { type: Date },
  deathCause: { type: String, default: '' },
  exitReason: { type: String, default: '' }, // sold, died, gifted, etc.
  image: { type: String, default: '' },
  lactationNumber: { type: Number, default: 0 },
  lastCalvingDate: { type: Date },
  dryOffDate: { type: Date },
  expectedDryDate: { type: Date },
  weightHistory: [{
    date: { type: Date, required: true },
    weight: { type: Number, required: true },
    notes: { type: String, default: '' },
  }],
}, { timestamps: true });

cattleSchema.index({ farmId: 1, tagNumber: 1 }, { unique: true });

export default mongoose.model('Cattle', cattleSchema);
