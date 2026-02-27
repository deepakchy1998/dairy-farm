import mongoose from 'mongoose';

const landingContentSchema = new mongoose.Schema({
  upiId: { type: String, default: '' },
  upiName: { type: String, default: '' },
  heroTitle: { type: String, default: 'Manage Your Dairy Farm Smarter' },
  heroSubtitle: { type: String, default: 'Track cattle, milk production, health records, breeding, finances — all in one place. Built for Indian dairy farmers.' },
  supportPhone: { type: String, default: '+91 98765 43210' },
  supportEmail: { type: String, default: 'support@dairypro.in' },
  contactAddress: { type: String, default: 'Punjab, India' },
  pricing: {
    monthly: { type: Number, default: 499 },
    quarterly: { type: Number, default: 1299 },
    halfyearly: { type: Number, default: 2499 },
    yearly: { type: Number, default: 4499 },
    trialDays: { type: Number, default: 5 },
  },
  testimonials: [{
    name: String,
    location: String,
    text: String,
    stars: { type: Number, default: 5 },
  }],
  stats: {
    activeFarms: { type: String, default: '500+' },
    cattleManaged: { type: String, default: '50,000+' },
    milkRecords: { type: String, default: '10L+' },
    uptime: { type: String, default: '99.9%' },
  },
  customPlanConfig: {
    enabled: { type: Boolean, default: true },
    heading: { type: String, default: '🛠️ Build Your Own Plan' },
    subheading: { type: String, default: 'Select only the modules you need. Pay for what you use!' },
    minMonthlyPrice: { type: Number, default: 200 },
    modulePrices: {
      cattle: { type: Number, default: 50 },
      milk: { type: Number, default: 50 },
      health: { type: Number, default: 40 },
      breeding: { type: Number, default: 40 },
      feed: { type: Number, default: 30 },
      finance: { type: Number, default: 40 },
      milkDelivery: { type: Number, default: 50 },
      employees: { type: Number, default: 40 },
      insurance: { type: Number, default: 30 },
      reports: { type: Number, default: 40 },
      chatbot: { type: Number, default: 60 },
    },
  },
  // Features section (the 12 feature cards)
  features: [{
    icon: { type: String, default: '' },
    title: { type: String, default: '' },
    description: { type: String, default: '' },
    sortOrder: { type: Number, default: 0 },
  }],

  // Module detail cards (the "12 Powerful Modules" section with bullet points)
  moduleDetails: [{
    icon: { type: String, default: '' },
    title: { type: String, default: '' },
    points: [{ type: String }],
    sortOrder: { type: Number, default: 0 },
  }],

  // "Why Farmers Love DairyPro" cards
  whyUsCards: [{
    icon: { type: String, default: '' },
    title: { type: String, default: '' },
    description: { type: String, default: '' },
    sortOrder: { type: Number, default: 0 },
  }],

  // "How It Works" steps
  howItWorks: [{
    emoji: { type: String, default: '' },
    title: { type: String, default: '' },
    description: { type: String, default: '' },
    sortOrder: { type: Number, default: 0 },
  }],

  // Plan feature bullets shown on landing pricing cards
  planFeatures: [{ type: String }],

  // FAQ items
  faqs: [{
    q: { type: String, default: '' },
    a: { type: String, default: '' },
  }],

  // Section visibility toggles
  sectionVisibility: {
    features: { type: Boolean, default: true },
    moduleDetails: { type: Boolean, default: true },
    whyUs: { type: Boolean, default: true },
    customPlan: { type: Boolean, default: true },
    pricing: { type: Boolean, default: true },
    testimonials: { type: Boolean, default: true },
    howItWorks: { type: Boolean, default: true },
    downloadApp: { type: Boolean, default: true },
    faq: { type: Boolean, default: true },
    contact: { type: Boolean, default: true },
  },
}, { timestamps: true });

export default mongoose.model('LandingContent', landingContentSchema);
