import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import { subscriptionStatus } from '../middleware/subscription.js';
import Subscription from '../models/Subscription.js';
import Payment from '../models/Payment.js';
import LandingContent from '../models/LandingContent.js';
import Plan from '../models/Plan.js';

const router = Router();

// Plans — public pricing info (dynamic from DB)
router.get('/plans', async (req, res, next) => {
  try {
    const content = await LandingContent.findOne();
    let plans = await Plan.find({ isActive: true }).sort('sortOrder createdAt').lean();

    // If no dynamic plans exist, seed defaults (one-time migration)
    if (plans.length === 0) {
      const pricing = content?.pricing || { monthly: 499, halfyearly: 2499, yearly: 4499 };
      const defaults = [
        { name: 'monthly', label: 'Monthly', price: pricing.monthly, days: 30, period: '/month', sortOrder: 1, features: ['All features included', 'Unlimited cattle & records', 'AI Farm Assistant', 'Reports & Analytics'] },
        { name: 'halfyearly', label: 'Half Yearly', price: pricing.halfyearly, days: 180, period: '/6 months', sortOrder: 2, isPopular: true, features: ['All features included', 'Unlimited cattle & records', 'AI Farm Assistant', 'Reports & Analytics'] },
        { name: 'yearly', label: 'Yearly', price: pricing.yearly, days: 365, period: '/year', sortOrder: 3, features: ['All features included', 'Unlimited cattle & records', 'AI Farm Assistant', 'Reports & Analytics'] },
      ];
      await Plan.insertMany(defaults);
      plans = await Plan.find({ isActive: true }).sort('sortOrder createdAt').lean();
    }

    res.json({
      success: true,
      data: { plans },
    });
  } catch (err) { next(err); }
});

// Full subscription status — used by frontend to decide paywall
router.get('/current', auth, subscriptionStatus, async (req, res, next) => {
  try {
    const subscription = req.subscription || null;
    const isActive = req.subscriptionActive;
    const daysLeft = req.daysLeft || 0;

    // Check if there's a pending payment
    const pendingPayment = await Payment.findOne({ userId: req.user._id, status: 'pending' });

    // Get subscription history
    const history = await Subscription.find({ userId: req.user._id })
      .sort('-endDate').limit(5);

    res.json({
      success: true,
      data: {
        isActive,
        subscription,
        daysLeft,
        hasPendingPayment: !!pendingPayment,
        pendingPayment: pendingPayment || null,
        isAdmin: req.user.role === 'admin',
        history,
      },
    });
  } catch (err) { next(err); }
});

// Custom plan calculator — public endpoint for pricing calculation
router.post('/custom-plan', async (req, res, next) => {
  try {
    const { modules, period = 'monthly' } = req.body;

    if (!Array.isArray(modules) || modules.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Please select at least one module'
      });
    }

    if (!['monthly', 'halfyearly', 'yearly'].includes(period)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid period. Must be monthly, halfyearly, or yearly'
      });
    }

    // Get pricing config from AppConfig
    const AppConfig = (await import('../models/AppConfig.js')).default;
    const appCfg = await AppConfig.findOne({ key: 'global' }).lean();
    
    if (appCfg?.customPlanEnabled === false) {
      return res.status(404).json({ success: false, error: 'Custom plans are not available' });
    }

    // Calculate monthly price
    let monthlyPrice = 0;
    const rawPrices = appCfg?.customPlanModulePrices instanceof Map
      ? Object.fromEntries(appCfg.customPlanModulePrices)
      : (appCfg?.customPlanModulePrices || { cattle: 50, milk: 50, health: 40, breeding: 40, feed: 30, finance: 40, milkDelivery: 50, employees: 40, insurance: 30, reports: 40 });

    const otherPrices = Object.values(rawPrices).sort((a, b) => a - b);
    const mid = Math.floor(otherPrices.length / 2);
    const chatbotPrice = otherPrices.length % 2 === 0
      ? Math.round((otherPrices[mid - 1] + otherPrices[mid]) / 2)
      : otherPrices[mid];
    const modulePrices = { ...rawPrices, chatbot: chatbotPrice };
    
    for (const module of modules) {
      if (modulePrices[module]) monthlyPrice += modulePrices[module];
    }

    const minPrice = appCfg?.customPlanMinPrice || 200;
    const maxPrice = appCfg?.customPlanMaxPrice || 5000;
    if (monthlyPrice < minPrice) monthlyPrice = minPrice;
    if (monthlyPrice > maxPrice) monthlyPrice = maxPrice;

    // Calculate total price based on period
    let totalPrice = monthlyPrice;
    let days = 30;

    switch (period) {
      case 'halfyearly':
        totalPrice = monthlyPrice * 6;
        days = 180;
        break;
      case 'yearly':
        totalPrice = monthlyPrice * 12;
        days = 365;
        break;
      default: // monthly
        days = 30;
        break;
    }

    res.json({
      success: true,
      data: {
        monthlyPrice,
        totalPrice,
        period,
        days,
        modules
      }
    });

  } catch (err) { 
    next(err); 
  }
});

export default router;
