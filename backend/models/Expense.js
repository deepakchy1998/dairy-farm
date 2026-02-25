import mongoose from 'mongoose';

const expenseSchema = new mongoose.Schema({
  farmId: { type: mongoose.Schema.Types.ObjectId, ref: 'Farm', required: true },
  date: { type: Date, required: true },
  category: { type: String, required: true },
  description: { type: String, default: '' },
  amount: { type: Number, required: true },
}, { timestamps: true });

expenseSchema.index({ farmId: 1, date: -1 });

export default mongoose.model('Expense', expenseSchema);
