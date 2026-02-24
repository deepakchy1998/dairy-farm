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
import { paginate } from '../utils/helpers.js';

const router = Router();
router.use(auth, admin);

const PLAN_DAYS = { monthly: 30, quarterly: 90, halfyearly: 180, yearly: 365 };

// List users with subscription status
router.get('/users', async (req, res, next) => {
  try {
    const { skip, limit, page } = paginate(req.query.page, req.query.limit);
    const total = await User.countDocuments();
    const pages = Math.ceil(total / limit);
    const users = await User.find().select('-password').populate('farmId', 'name city state').sort('-createdAt').skip(skip).limit(limit).lean();
    // Attach subscription info
    const userIds = users.map(u => u._id);
    const subs = await Subscription.find({ userId: { $in: userIds }, isActive: true, endDate: { $gte: new Date() } }).sort('-endDate');
    const subMap = {};
    subs.forEach(s => { if (!subMap[s.userId.toString()]) subMap[s.userId.toString()] = s; });

    const enriched = users.map(u => ({
      ...u,
      subscription: subMap[u._id.toString()] || null,
      subscriptionActive: !!subMap[u._id.toString()],
    }));
    res.json({ success: true, data: enriched, pagination: { page, pages, total, limit } });
  } catch (err) { next(err); }
});

// List payments with filters
router.get('/payments', async (req, res, next) => {
  try {
    const { status } = req.query;
    const filter = {};
    if (status) filter.status = status;

    // Auto-expire old pending
    await Payment.updateMany(
      { status: 'pending', expiresAt: { $lt: new Date() } },
      { status: 'expired' }
    );

    const { skip, limit, page } = paginate(req.query.page, req.query.limit);
    const total = await Payment.countDocuments(filter);
    const pages = Math.ceil(total / limit);
    const payments = await Payment.find(filter).populate('userId', 'name email phone').sort('-createdAt').skip(skip).limit(limit);
    res.json({ success: true, data: payments, pagination: { page, pages, total, limit } });
  } catch (err) { next(err); }
});

// Verify payment — activates subscription
router.put('/payments/:id/verify', async (req, res, next) => {
  try {
    const payment = await Payment.findById(req.params.id);
    if (!payment) return res.status(404).json({ success: false, message: 'Payment not found' });
    if (payment.status === 'verified') return res.status(400).json({ success: false, message: 'Already verified' });
    if (payment.status === 'expired') return res.status(400).json({ success: false, message: 'Payment expired. User must resubmit.' });

    payment.status = 'verified';
    payment.verifiedBy = req.user._id;
    payment.adminNote = req.body.adminNote || '';
    await payment.save();

    // Create/extend subscription
    const days = PLAN_DAYS[payment.plan] || 30;
    const existing = await Subscription.findOne({ userId: payment.userId, isActive: true, endDate: { $gte: new Date() } }).sort('-endDate');
    const startDate = existing ? new Date(existing.endDate) : new Date();
    const endDate = new Date(startDate.getTime() + days * 24 * 60 * 60 * 1000);

    await Subscription.create({ userId: payment.userId, plan: payment.plan, startDate, endDate });

    res.json({ success: true, data: payment, message: `Subscription activated for ${days} days` });
  } catch (err) { next(err); }
});

// Reject payment
router.put('/payments/:id/reject', async (req, res, next) => {
  try {
    const payment = await Payment.findById(req.params.id);
    if (!payment) return res.status(404).json({ success: false, message: 'Payment not found' });
    payment.status = 'rejected';
    payment.adminNote = req.body.adminNote || '';
    await payment.save();
    res.json({ success: true, data: payment });
  } catch (err) { next(err); }
});

// Manually extend/grant subscription to a user
router.post('/subscription/grant', async (req, res, next) => {
  try {
    const { userId, plan, days } = req.body;
    if (!userId) return res.status(400).json({ success: false, message: 'User ID required' });

    const grantDays = days || PLAN_DAYS[plan] || 30;
    const existing = await Subscription.findOne({ userId, isActive: true, endDate: { $gte: new Date() } }).sort('-endDate');
    const startDate = existing ? new Date(existing.endDate) : new Date();
    const endDate = new Date(startDate.getTime() + grantDays * 24 * 60 * 60 * 1000);

    const sub = await Subscription.create({ userId, plan: plan || 'manual', startDate, endDate });
    res.json({ success: true, data: sub, message: `Subscription granted for ${grantDays} days` });
  } catch (err) { next(err); }
});

// Revoke a user's subscription
router.post('/subscription/revoke', async (req, res, next) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ success: false, message: 'User ID required' });
    await Subscription.updateMany({ userId, isActive: true }, { isActive: false });
    res.json({ success: true, message: 'Subscription revoked' });
  } catch (err) { next(err); }
});

// Admin stats
router.get('/stats', async (req, res, next) => {
  try {
    const [totalUsers, totalFarms, totalCattle, totalRevenue, activeSubscriptions, pendingPayments, totalPaymentRevenue] = await Promise.all([
      User.countDocuments({ role: 'user' }),
      Farm.countDocuments(),
      Cattle.countDocuments({ status: 'active' }),
      Revenue.aggregate([{ $group: { _id: null, total: { $sum: '$amount' } } }]),
      Subscription.countDocuments({ isActive: true, endDate: { $gte: new Date() } }),
      Payment.countDocuments({ status: 'pending' }),
      Payment.aggregate([{ $match: { status: 'verified' } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
    ]);
    res.json({
      success: true,
      data: {
        totalUsers, totalFarms, totalCattle,
        totalRevenue: totalRevenue[0]?.total || 0,
        activeSubscriptions, pendingPayments,
        totalPaymentRevenue: totalPaymentRevenue[0]?.total || 0,
      },
    });
  } catch (err) { next(err); }
});

// Update landing content (pricing, UPI ID, etc)
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

router.get('/landing', async (req, res, next) => {
  try {
    const content = await LandingContent.findOne();
    res.json({ success: true, data: content });
  } catch (err) { next(err); }
});

export default router;
