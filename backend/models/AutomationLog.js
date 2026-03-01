import mongoose from 'mongoose';

const automationLogSchema = new mongoose.Schema({
  farmId: { type: mongoose.Schema.Types.ObjectId, ref: 'Farm', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, required: true }, // milk_prefill, attendance_prefill, delivery_generate, salary_calculate, recurring_expense, heat_predict, dryoff_remind
  date: { type: Date, required: true },
  summary: { type: String, default: '' },
  recordsCreated: { type: Number, default: 0 },
  recordsSkipped: { type: Number, default: 0 },
  details: { type: mongoose.Schema.Types.Mixed, default: {} },
  status: { type: String, enum: ['success', 'partial', 'failed'], default: 'success' },
}, { timestamps: true });

// One automation per type per farm per day
automationLogSchema.index({ farmId: 1, type: 1, date: 1 }, { unique: true });
automationLogSchema.index({ farmId: 1, createdAt: -1 });

export default mongoose.model('AutomationLog', automationLogSchema);
