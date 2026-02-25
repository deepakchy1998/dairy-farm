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
      data: {
        plans,
        upiId: content?.upiId || (content?.supportPhone ? `${content.supportPhone}@upi` : 'dairypro@upi'),
        upiName: content?.upiName || 'DairyPro',
      },
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

export default router;
