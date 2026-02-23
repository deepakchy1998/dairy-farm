import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import { subscriptionStatus } from '../middleware/subscription.js';
import Subscription from '../models/Subscription.js';
import Payment from '../models/Payment.js';
import LandingContent from '../models/LandingContent.js';

const router = Router();

// Plans — public pricing info
router.get('/plans', async (req, res, next) => {
  try {
    const content = await LandingContent.findOne();
    const pricing = content?.pricing || { monthly: 499, quarterly: 1299, halfyearly: 2499, yearly: 4499 };
    res.json({
      success: true,
      data: {
        monthly: pricing.monthly,
        quarterly: pricing.quarterly,
        halfyearly: pricing.halfyearly,
        yearly: pricing.yearly,
        upiId: content?.supportPhone ? `${content.supportPhone}@upi` : 'dairypro@upi',
        upiName: 'DairyPro',
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
