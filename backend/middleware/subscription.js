import Subscription from '../models/Subscription.js';

export const checkSubscription = async (req, res, next) => {
  try {
    if (req.user?.role === 'admin') return next();
    const sub = await Subscription.findOne({
      userId: req.user._id,
      isActive: true,
      endDate: { $gte: new Date() },
    });
    if (!sub) {
      return res.status(403).json({ success: false, message: 'Active subscription required. Please subscribe to continue.' });
    }
    next();
  } catch (err) {
    next(err);
  }
};
