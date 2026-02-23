import mongoose from 'mongoose';

const farmSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  address: { type: String, default: '' },
  city: { type: String, default: '' },
  state: { type: String, default: '' },
  phone: { type: String, default: '' },
  description: { type: String, default: '' },
}, { timestamps: true });

export default mongoose.model('Farm', farmSchema);
