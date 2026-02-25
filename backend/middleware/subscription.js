import Subscription from '../models/Subscription.js';

// Plan duration limits — server-enforced maximum days per plan
const MAX_PLAN_DAYS = { trial: 10, monthly: 35, quarterly: 100, halfyearly: 195, yearly: 375, manual: 400 };

// Strict subscription check — blocks ALL routes when expired
export const checkSubscription = async (req, res, next) => {
  try {
    // Admin always passes
    if (req.user?.role === 'admin') return next();

    const now = new Date();
    const sub = await Subscription.findOne({
      userId: req.user._id,
      isActive: true,
      endDate: { $gte: now },
    }).lean();

    if (!sub) {
      return res.status(403).json({
        success: false,
        message: 'Your subscription has expired. Please renew to continue using DairyPro.',
        code: 'SUBSCRIPTION_EXPIRED',
        expired: true,
      });
    }

    // Server-side integrity check: verify subscription duration is within allowed limits
    const durationDays = Math.ceil((new Date(sub.endDate) - new Date(sub.startDate)) / (1000 * 60 * 60 * 24));
    const maxDays = MAX_PLAN_DAYS[sub.plan] || 400;
    if (durationDays > maxDays) {
      // Subscription has been tampered with — deactivate it
      await Subscription.findByIdAndUpdate(sub._id, { isActive: false });
      console.error(`⚠️ Tampered subscription detected: user=${req.user._id} plan=${sub.plan} duration=${durationDays}d max=${maxDays}d`);
      return res.status(403).json({
        success: false,
        message: 'Subscription validation failed. Please contact support.',
        code: 'SUBSCRIPTION_INVALID',
      });
    }

    // Attach subscription info to request
    req.subscription = sub;
    req.daysLeft = Math.ceil((new Date(sub.endDate) - now) / (1000 * 60 * 60 * 24));

    next();
  } catch (err) {
    next(err);
  }
};

// Lightweight check — just returns status, doesn't block
export const subscriptionStatus = async (req, res, next) => {
  try {
    if (req.user?.role === 'admin') {
      req.subscriptionActive = true;
      return next();
    }
    const sub = await Subscription.findOne({
      userId: req.user._id,
      isActive: true,
      endDate: { $gte: new Date() },
    }).lean();
    req.subscriptionActive = !!sub;
    req.subscription = sub;
    req.daysLeft = sub ? Math.ceil((new Date(sub.endDate) - new Date()) / (1000 * 60 * 60 * 24)) : 0;
    next();
  } catch (err) {
    next(err);
  }
};
