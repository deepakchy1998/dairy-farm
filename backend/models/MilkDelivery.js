import mongoose from 'mongoose';

const milkDeliverySchema = new mongoose.Schema({
  farmId: { type: mongoose.Schema.Types.ObjectId, ref: 'Farm', required: true },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
  date: { type: Date, required: true },
  quantity: { type: Number, required: true, min: 0 }, // Litres delivered
  ratePerLiter: { type: Number, required: true, min: 0 },
  amount: { type: Number, required: true }, // quantity × rate
  session: { type: String, default: 'morning' },
  isExtra: { type: Boolean, default: false }, // Extra beyond fixed daily quantity
  notes: { type: String, default: '' },
}, { timestamps: true });

// One entry per customer per date per session
milkDeliverySchema.index({ farmId: 1, customerId: 1, date: 1, session: 1 }, { unique: true });
milkDeliverySchema.index({ farmId: 1, date: -1 });
milkDeliverySchema.index({ customerId: 1, date: -1 });

// Auto-calculate amount
milkDeliverySchema.pre('save', function (next) {
  this.amount = this.quantity * this.ratePerLiter;
  next();
});

export default mongoose.model('MilkDelivery', milkDeliverySchema);
