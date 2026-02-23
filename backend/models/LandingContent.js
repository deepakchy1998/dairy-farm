import mongoose from 'mongoose';

const landingContentSchema = new mongoose.Schema({
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
}, { timestamps: true });

export default mongoose.model('LandingContent', landingContentSchema);
