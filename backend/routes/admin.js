import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import { admin } from '../middleware/admin.js';
import User from '../models/User.js';
import Farm from '../models/Farm.js';
import Cattle from '../models/Cattle.js';
import Payment from '../models/Payment.js';
import Subscription from '../models/Subscription.js';
import Revenue from '../models/Revenue.js';
import LandingContent from '../models/LandingContent.js';

const router = Router();
router.use(auth, admin);

const PLAN_DAYS = { monthly: 30, quarterly: 90, halfyearly: 180, yearly: 365 };

// List users
router.get('/users', async (req, res, next) => {
  try {
    const users = await User.find().select('-password').populate('farmId', 'name city state').sort('-createdAt');
    res.json({ success: true, data: users });
  } catch (err) { next(err); }
});

// List payments
router.get('/payments', async (req, res, next) => {
  try {
    const payments = await Payment.find().populate('userId', 'name email').sort('-createdAt');
    res.json({ success: true, data: payments });
  } catch (err) { next(err); }
});

// Verify payment
router.put('/payments/:id/verify', async (req, res, next) => {
  try {
    const payment = await Payment.findById(req.params.id);
    if (!payment) return res.status(404).json({ success: false, message: 'Payment not found' });
    if (payment.status === 'verified') return res.status(400).json({ success: false, message: 'Already verified' });

    payment.status = 'verified';
    payment.verifiedBy = req.user._id;
    await payment.save();

    // Create/extend subscription
    const days = PLAN_DAYS[payment.plan] || 30;
    const existing = await Subscription.findOne({ userId: payment.userId, isActive: true, endDate: { $gte: new Date() } }).sort('-endDate');
    const startDate = existing ? new Date(existing.endDate) : new Date();
    const endDate = new Date(startDate.getTime() + days * 24 * 60 * 60 * 1000);

    await Subscription.create({ userId: payment.userId, plan: payment.plan, startDate, endDate });

    res.json({ success: true, data: payment, message: 'Payment verified and subscription activated' });
  } catch (err) { next(err); }
});

// Reject payment
router.put('/payments/:id/reject', async (req, res, next) => {
  try {
    const payment = await Payment.findById(req.params.id);
    if (!payment) return res.status(404).json({ success: false, message: 'Payment not found' });
    payment.status = 'rejected';
    await payment.save();
    res.json({ success: true, data: payment });
  } catch (err) { next(err); }
});

// Admin stats
router.get('/stats', async (req, res, next) => {
  try {
    const [totalUsers, totalFarms, totalCattle, totalRevenue] = await Promise.all([
      User.countDocuments(),
      Farm.countDocuments(),
      Cattle.countDocuments({ status: 'active' }),
      Revenue.aggregate([{ $group: { _id: null, total: { $sum: '$amount' } } }]),
    ]);
    res.json({
      success: true,
      data: { totalUsers, totalFarms, totalCattle, totalRevenue: totalRevenue[0]?.total || 0 },
    });
  } catch (err) { next(err); }
});

// Update landing content
router.put('/landing', async (req, res, next) => {
  try {
    let content = await LandingContent.findOne();
    if (content) {
      Object.assign(content, req.body);
      await content.save();
    } else {
      content = await LandingContent.create(req.body);
    }
    res.json({ success: true, data: content });
  } catch (err) { next(err); }
});

// Get landing content
router.get('/landing', async (req, res, next) => {
  try {
    const content = await LandingContent.findOne();
    res.json({ success: true, data: content });
  } catch (err) { next(err); }
});

export default router;
