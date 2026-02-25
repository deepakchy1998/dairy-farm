import mongoose from 'mongoose';

const salaryPaymentSchema = new mongoose.Schema({
  farmId: { type: mongoose.Schema.Types.ObjectId, ref: 'Farm', required: true },
  employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
  month: { type: String, required: true }, // e.g., '2026-02'
  baseSalary: { type: Number, required: true },
  daysWorked: { type: Number, default: 0 },
  totalDays: { type: Number, default: 0 }, // Working days in month
  halfDays: { type: Number, default: 0 },
  absentDays: { type: Number, default: 0 },
  overtimeHours: { type: Number, default: 0 },
  overtimeAmount: { type: Number, default: 0 },
  deductions: { type: Number, default: 0 },
  deductionNotes: { type: String, default: '' },
  advance: { type: Number, default: 0 }, // Advance deducted this month
  bonus: { type: Number, default: 0 },
  bonusNotes: { type: String, default: '' },
  netSalary: { type: Number, required: true },
  paidAmount: { type: Number, default: 0 },
  paidDate: { type: Date },
  method: { type: String, enum: ['cash', 'upi', 'bank', 'other'], default: 'cash' },
  status: { type: String, enum: ['pending', 'partial', 'paid'], default: 'pending' },
  notes: { type: String, default: '' },
}, { timestamps: true });

salaryPaymentSchema.index({ farmId: 1, employeeId: 1, month: 1 }, { unique: true });
salaryPaymentSchema.index({ farmId: 1, month: 1 });

export default mongoose.model('SalaryPayment', salaryPaymentSchema);
