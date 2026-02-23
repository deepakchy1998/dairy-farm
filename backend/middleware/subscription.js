import Subscription from '../models/Subscription.js';

// Strict subscription check — blocks ALL routes when expired
export const checkSubscription = async (req, res, next) => {
  try {
    // Admin always passes
    if (req.user?.role === 'admin') return next();

    const sub = await Subscription.findOne({
      userId: req.user._id,
      isActive: true,
      endDate: { $gte: new Date() },
    });

    if (!sub) {
      return res.status(403).json({
        success: false,
        message: 'Your subscription has expired. Please renew to continue using DairyPro.',
        code: 'SUBSCRIPTION_EXPIRED',
        expired: true,
      });
    }

    // Attach subscription info to request
    req.subscription = sub;
    req.daysLeft = Math.ceil((new Date(sub.endDate) - new Date()) / (1000 * 60 * 60 * 24));

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
    });
    req.subscriptionActive = !!sub;
    req.subscription = sub;
    req.daysLeft = sub ? Math.ceil((new Date(sub.endDate) - new Date()) / (1000 * 60 * 60 * 24)) : 0;
    next();
  } catch (err) {
    next(err);
  }
};
