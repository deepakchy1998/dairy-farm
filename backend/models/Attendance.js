import mongoose from 'mongoose';

const attendanceSchema = new mongoose.Schema({
  farmId: { type: mongoose.Schema.Types.ObjectId, ref: 'Farm', required: true },
  employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
  date: { type: Date, required: true },
  status: { type: String, enum: ['present', 'absent', 'half-day', 'leave', 'holiday'], required: true },
  checkIn: { type: String, default: '' },  // e.g., '06:30'
  checkOut: { type: String, default: '' }, // e.g., '18:00'
  overtime: { type: Number, default: 0 },  // Extra hours
  notes: { type: String, default: '' },
}, { timestamps: true });

attendanceSchema.index({ farmId: 1, employeeId: 1, date: 1 }, { unique: true });
attendanceSchema.index({ farmId: 1, date: -1 });

export default mongoose.model('Attendance', attendanceSchema);
