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
  // App behavior settings
  notificationRetentionDays: { type: Number, default: 30 },
  maxBackupRecords: { type: Number, default: 500 },
  trialDays: { type: Number, default: 5 },
  maxFileUploadMB: { type: Number, default: 2 },
  sessionTimeoutHours: { type: Number, default: 24 },
  maintenanceMode: { type: Boolean, default: false },
  maintenanceMessage: { type: String, default: 'The app is currently under maintenance. Please try again later.' },
  welcomeMessage: { type: String, default: '' },
  currencySymbol: { type: String, default: '₹' },
  dateFormat: { type: String, default: 'DD/MM/YYYY' },
  milkUnit: { type: String, default: 'liters' },
  weightUnit: { type: String, default: 'kg' },
  // Branding
  appName: { type: String, default: 'DairyPro' },
  appLogo: { type: String, default: '🐄' },
  appTagline: { type: String, default: 'Smart Dairy Farm Management' },
  chatbotName: { type: String, default: 'DairyPro AI' },
  chatbotWelcome: { type: String, default: "Namaste! 🐄 I have full access to your farm — cattle, milk, health, finance, staff & customers. Ask anything!" },
  chatbotFullWelcome: { type: String, default: '' },
  chatbotSuggestions: { type: [String], default: ['How is my farm doing?', 'Analyze milk production', 'Which cattle need attention?', 'How to increase profit?'] },
  chatbotQuickActions: [{
    label: { type: String },
    message: { type: String },
    sortOrder: { type: Number, default: 0 },
  }],
  // Feature toggles
  chatBubbleEnabled: { type: Boolean, default: true },
  customPlanEnabled: { type: Boolean, default: true },
  customPlanMinPrice: { type: Number, default: 200 },
  customPlanMaxPrice: { type: Number, default: 5000 },
  customPlanModulePrices: {
    type: Map,
    of: Number,
    default: {
      cattle: 50, milk: 50, health: 40, breeding: 40, feed: 30,
      finance: 40, milkDelivery: 50, employees: 40, insurance: 30,
      reports: 40,
    },
  },
  modulesEnabled: {
    type: Map,
    of: Boolean,
    default: {
      cattle: true, milk: true, health: true, breeding: true, feed: true,
      finance: true, milkDelivery: true, employees: true, insurance: true,
      reports: true, chatbot: true,
    },
  },
}, { timestamps: true });

export default mongoose.model('AppConfig', appConfigSchema);
