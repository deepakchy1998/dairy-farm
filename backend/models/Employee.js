import mongoose from 'mongoose';

const employeeSchema = new mongoose.Schema({
  farmId: { type: mongoose.Schema.Types.ObjectId, ref: 'Farm', required: true },
  name: { type: String, required: true, trim: true },
  phone: { type: String, default: '', trim: true },
  address: { type: String, default: '', trim: true },
  village: { type: String, default: '', trim: true },
  role: { type: String, required: true, trim: true }, // e.g., Milker, Feeder, Cleaner, Manager, Helper
  monthlySalary: { type: Number, required: true, min: 0 },
  dailyWage: { type: Number, default: 0 }, // For daily wage workers (if 0, uses monthly salary)
  joinDate: { type: Date, default: Date.now },
  status: { type: String, enum: ['active', 'on-leave', 'resigned', 'terminated'], default: 'active' },
  emergencyContact: { type: String, default: '' },
  aadhar: { type: String, default: '' }, // Aadhar number (optional)
  bankAccount: { type: String, default: '' },
  ifsc: { type: String, default: '' },
  profilePhoto: { type: String, default: '' },
  notes: { type: String, default: '' },
  totalAdvance: { type: Number, default: 0 }, // Outstanding advance amount
}, { timestamps: true });

employeeSchema.index({ farmId: 1, status: 1 });
employeeSchema.index({ farmId: 1, name: 1 });

export default mongoose.model('Employee', employeeSchema);
