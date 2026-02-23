import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import Subscription from '../models/Subscription.js';
import LandingContent from '../models/LandingContent.js';

const router = Router();

// Plans (public-ish, but auth needed for context)
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
        upiId: 'dairypro@upi',
        upiName: 'DairyPro',
      },
    });
  } catch (err) { next(err); }
});

// Current subscription
router.get('/current', auth, async (req, res, next) => {
  try {
    const subscription = await Subscription.findOne({ userId: req.user._id, isActive: true, endDate: { $gte: new Date() } }).sort('-endDate');
    const isActive = !!subscription;
    const daysLeft = subscription ? Math.ceil((new Date(subscription.endDate) - new Date()) / (1000 * 60 * 60 * 24)) : 0;
    res.json({ success: true, data: { isActive, subscription, daysLeft } });
  } catch (err) { next(err); }
});

export default router;
