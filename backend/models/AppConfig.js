import mongoose from 'mongoose';

const appConfigSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true }, // 'global' — single doc
  employeeRoles: { type: [String], default: ['Milker', 'Feeder', 'Cleaner', 'Manager', 'Helper', 'Driver', 'Veterinary', 'Other'] },
  cattleCategories: { type: [String], default: ['milking', 'dry', 'heifer', 'calf', 'bull', 'pregnant'] },
  cattleBreeds: { type: [String], default: ['Holstein Friesian', 'Sahiwal', 'Gir', 'Murrah', 'Jersey', 'Red Sindhi', 'Tharparkar', 'Hariana', 'Rathi', 'Kankrej', 'Crossbred', 'Other'] },
  healthRecordTypes: { type: [String], default: ['vaccination', 'treatment', 'checkup', 'deworming'] },
  expenseCategories: { type: [String], default: ['feed', 'medicine', 'equipment', 'salary', 'transport', 'maintenance', 'other'] },
  revenueCategories: { type: [String], default: ['milk_sale', 'cattle_sale', 'manure_sale', 'other'] },
  feedTypes: { type: [String], default: ['Green Fodder', 'Dry Hay', 'Silage', 'Concentrate', 'Cotton Seed', 'Mustard Cake', 'Wheat Bran', 'Rice Bran', 'Mineral Mix', 'Other'] },
  paymentMethods: { type: [String], default: ['cash', 'upi', 'bank', 'other'] },
  milkDeliverySessions: { type: [String], default: ['morning', 'evening'] },
}, { timestamps: true });

export default mongoose.model('AppConfig', appConfigSchema);
