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
import { paginate, logActivity } from '../utils/helpers.js';
import Activity from '../models/Activity.js';
import MilkRecord from '../models/MilkRecord.js';
import HealthRecord from '../models/HealthRecord.js';
import Employee from '../models/Employee.js';
import Customer from '../models/Customer.js';
import Plan from '../models/Plan.js';
import crypto from 'crypto';

const router = Router();
router.use(auth, admin);

// Dynamic plan days lookup
async function getPlanDays(planName) {
  const plan = await Plan.findOne({ name: planName });
  if (plan) return plan.days;
  const fallback = { monthly: 30, quarterly: 90, halfyearly: 180, yearly: 365 };
  return fallback[planName] || 30;
}



// Search/filter users
router.get('/users', async (req, res, next) => {
  try {
    const { search, status, subscription: subFilter } = req.query;
    const { skip, limit, page } = paginate(req.query.page, req.query.limit);
    const filter = {};
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
      ];
    }
    if (status === 'blocked') filter.isBlocked = true;
    if (status === 'active') filter.isBlocked = { $ne: true };
    const total = await User.countDocuments(filter);
    const pages = Math.ceil(total / limit);
    const users = await User.find(filter).select('-password -profilePhoto').populate('farmId', 'name city state').sort('-createdAt').skip(skip).limit(limit).lean();
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
    const days = await getPlanDays(payment.plan);
    const existing = await Subscription.findOne({ userId: payment.userId, isActive: true, endDate: { $gte: new Date() } }).sort('-endDate');
    const startDate = existing ? new Date(existing.endDate) : new Date();
    const endDate = new Date(startDate.getTime() + days * 24 * 60 * 60 * 1000);

    await Subscription.create({ userId: payment.userId, plan: payment.plan, startDate, endDate });

    // Notify user about payment verification
    try {
      const Notification = (await import('../models/Notification.js')).default;
      await Notification.create({
        farmId: (await User.findById(payment.userId).select('farmId').lean())?.farmId,
        userId: payment.userId,
        title: '✅ Payment Verified',
        message: `Your payment of ₹${payment.amount} for ${payment.plan} plan has been verified. Subscription is now active for ${days} days. Thank you!`,
        severity: 'info',
        type: 'payment_verified',
        actionUrl: '/subscription',
        refId: `payment_verified_${payment._id}`,
      });
    } catch (err) { console.error('Notification error:', err.message); }

    console.log(`[ADMIN] Payment verified: user=${payment.userId} plan=${payment.plan} amount=₹${payment.amount} txn=${payment.upiTransactionId} by admin=${req.user._id}`);
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

    // Notify user about payment rejection
    try {
      const Notification = (await import('../models/Notification.js')).default;
      await Notification.create({
        farmId: (await User.findById(payment.userId).select('farmId').lean())?.farmId,
        userId: payment.userId,
        title: '❌ Payment Rejected',
        message: `Your payment of ₹${payment.amount} (TXN: ${payment.upiTransactionId}) was rejected.${payment.adminNote ? ' Reason: ' + payment.adminNote : ''} Please submit a new payment with a valid transaction ID.`,
        severity: 'warning',
        type: 'payment_rejected',
        actionUrl: '/subscription',
        refId: `payment_rejected_${payment._id}`,
      });
    } catch (err) { console.error('Notification error:', err.message); }

    res.json({ success: true, data: payment });
  } catch (err) { next(err); }
});

// Manually extend/grant subscription to a user
router.post('/subscription/grant', async (req, res, next) => {
  try {
    const { userId, plan, days } = req.body;
    if (!userId) return res.status(400).json({ success: false, message: 'User ID required' });

    const grantDays = days || await getPlanDays(plan);
    const existing = await Subscription.findOne({ userId, isActive: true, endDate: { $gte: new Date() } }).sort('-endDate');
    const startDate = existing ? new Date(existing.endDate) : new Date();
    const endDate = new Date(startDate.getTime() + grantDays * 24 * 60 * 60 * 1000);

    const sub = await Subscription.create({ userId, plan: plan || 'manual', startDate, endDate });
    console.log(`[ADMIN] Subscription granted: user=${userId} plan=${plan || 'manual'} days=${grantDays} by admin=${req.user._id}`);

    // Notify user
    try {
      const Notification = (await import('../models/Notification.js')).default;
      const targetUser = await User.findById(userId).select('farmId').lean();
      await Notification.create({
        farmId: targetUser?.farmId,
        userId,
        title: '🎉 Subscription Granted',
        message: `You have been granted ${grantDays} days of ${plan || 'premium'} subscription by admin. Enjoy DairyPro!`,
        severity: 'info',
        type: 'subscription_granted',
        actionUrl: '/subscription',
        refId: `sub_granted_${sub._id}`,
      });
    } catch (err) { console.error('Notification error:', err.message); }

    res.json({ success: true, data: sub, message: `Subscription granted for ${grantDays} days` });
  } catch (err) { next(err); }
});

// Revoke a user's subscription
router.post('/subscription/revoke', async (req, res, next) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ success: false, message: 'User ID required' });
    await Subscription.updateMany({ userId, isActive: true }, { isActive: false });
    console.log(`[ADMIN] Subscription revoked: user=${userId} by admin=${req.user._id}`);

    // Notify user
    try {
      const Notification = (await import('../models/Notification.js')).default;
      const targetUser = await User.findById(userId).select('farmId').lean();
      await Notification.create({
        farmId: targetUser?.farmId,
        userId,
        title: '⚠️ Subscription Revoked',
        message: 'Your subscription has been revoked by admin. Please renew to continue using DairyPro.',
        severity: 'critical',
        type: 'subscription_revoked',
        actionUrl: '/subscription',
        refId: `sub_revoked_${userId}_${Date.now()}`,
      });
    } catch (err) { console.error('Notification error:', err.message); }

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

// Revenue dashboard (alias for stats with extra data)
router.get('/revenue-dashboard', async (req, res, next) => {
  try {
    const [totalUsers, totalFarms, activeSubscriptions, pendingPayments] = await Promise.all([
      User.countDocuments({ role: 'user' }),
      Farm.countDocuments(),
      Subscription.countDocuments({ isActive: true, endDate: { $gte: new Date() } }),
      Payment.countDocuments({ status: 'pending' }),
    ]);

    // Total revenue from verified payments
    const totalRevenueAgg = await Payment.aggregate([
      { $match: { status: 'verified' } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);
    const totalRevenue = totalRevenueAgg[0]?.total || 0;

    // Monthly revenue (last 12 months)
    const monthlyRevenue = await Payment.aggregate([
      { $match: { status: 'verified', createdAt: { $gte: new Date(Date.now() - 365 * 86400000) } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } }, total: { $sum: '$amount' } } },
      { $sort: { _id: 1 } },
    ]);

    // Plan distribution
    const planDistribution = await Subscription.aggregate([
      { $match: { isActive: true, endDate: { $gte: new Date() } } },
      { $group: { _id: '$plan', count: { $sum: 1 } } },
    ]);

    // User growth (last 12 months)
    const userGrowth = await User.aggregate([
      { $match: { role: 'user', createdAt: { $gte: new Date(Date.now() - 365 * 86400000) } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);

    // Payment status breakdown
    const paymentStatusBreakdown = await Payment.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 }, total: { $sum: '$amount' } } },
    ]);

    // Payment method breakdown (razorpay vs manual)
    const paymentMethodBreakdown = await Payment.aggregate([
      { $match: { status: 'verified' } },
      { $group: { _id: { $ifNull: ['$paymentMethod', 'upi_manual'] }, count: { $sum: 1 }, total: { $sum: '$amount' } } },
    ]);

    // Daily revenue (last 30 days)
    const dailyRevenue = await Payment.aggregate([
      { $match: { status: 'verified', createdAt: { $gte: new Date(Date.now() - 30 * 86400000) } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, total: { $sum: '$amount' }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);

    // Subscriptions expiring soon (next 7 days)
    const expiringSoon = await Subscription.countDocuments({
      isActive: true,
      endDate: { $gte: new Date(), $lte: new Date(Date.now() + 7 * 86400000) },
    });

    // Recent signups (last 7 days)
    const recentSignups = await User.countDocuments({
      role: 'user',
      createdAt: { $gte: new Date(Date.now() - 7 * 86400000) },
    });

    // Top plans by revenue
    const topPlansByRevenue = await Payment.aggregate([
      { $match: { status: 'verified' } },
      { $group: { _id: '$plan', totalRevenue: { $sum: '$amount' }, count: { $sum: 1 } } },
      { $sort: { totalRevenue: -1 } },
    ]);

    // Conversion rate: users with active sub / total users
    const conversionRate = totalUsers > 0 ? Math.round((activeSubscriptions / totalUsers) * 100) : 0;

    // Average revenue per user (ARPU)
    const arpu = activeSubscriptions > 0 ? Math.round(totalRevenue / activeSubscriptions) : 0;

    res.json({
      success: true,
      data: {
        totalUsers, totalFarms, activeSubscriptions, pendingPayments, totalRevenue,
        monthlyRevenue, planDistribution, userGrowth, paymentStatusBreakdown,
        paymentMethodBreakdown, dailyRevenue, expiringSoon, recentSignups,
        topPlansByRevenue, conversionRate, arpu,
      },
    });
  } catch (err) { next(err); }
});

// Get settings (landing content as settings)
router.get('/settings', async (req, res, next) => {
  try {
    let content = await LandingContent.findOne().lean();
    if (!content) content = {};
    // Flatten pricing for frontend
    res.json({
      success: true,
      data: {
        ...content,
        upiId: content.upiId || '',
        upiName: content.upiName || '',
        monthlyPrice: content.pricing?.monthly || 499,
        quarterlyPrice: content.pricing?.quarterly || 1299,
        halfyearlyPrice: content.pricing?.halfyearly || 2499,
        yearlyPrice: content.pricing?.yearly || 4499,
        trialDays: content.pricing?.trialDays || 5,
      },
    });
  } catch (err) { next(err); }
});

// Update settings
router.put('/settings', async (req, res, next) => {
  try {
    const { upiId, upiName, monthlyPrice, quarterlyPrice, halfyearlyPrice, yearlyPrice, trialDays, supportEmail, supportPhone, contactAddress, heroTitle, heroSubtitle, testimonials, statsActiveFarms, statsCattleManaged, statsMilkRecords, statsUptime } = req.body;
    
    let content = await LandingContent.findOne();
    if (!content) content = new LandingContent();
    
    if (heroTitle !== undefined) content.heroTitle = heroTitle;
    if (heroSubtitle !== undefined) content.heroSubtitle = heroSubtitle;
    if (supportPhone !== undefined) content.supportPhone = supportPhone;
    if (supportEmail !== undefined) content.supportEmail = supportEmail;
    if (contactAddress !== undefined) content.contactAddress = contactAddress;
    if (testimonials !== undefined) content.testimonials = testimonials;
    if (upiId !== undefined) content.upiId = upiId;
    if (upiName !== undefined) content.upiName = upiName;
    
    // Stats
    if (statsActiveFarms !== undefined) content.stats = { ...content.stats?.toObject?.() || content.stats || {}, activeFarms: statsActiveFarms };
    if (statsCattleManaged !== undefined) content.stats = { ...content.stats?.toObject?.() || content.stats || {}, cattleManaged: statsCattleManaged };
    if (statsMilkRecords !== undefined) content.stats = { ...content.stats?.toObject?.() || content.stats || {}, milkRecords: statsMilkRecords };
    if (statsUptime !== undefined) content.stats = { ...content.stats?.toObject?.() || content.stats || {}, uptime: statsUptime };
    
    // Pricing
    content.pricing = {
      monthly: monthlyPrice || content.pricing?.monthly || 499,
      quarterly: quarterlyPrice || content.pricing?.quarterly || 1299,
      halfyearly: halfyearlyPrice || content.pricing?.halfyearly || 2499,
      yearly: yearlyPrice || content.pricing?.yearly || 4499,
      trialDays: trialDays || content.pricing?.trialDays || 5,
    };
    
    await content.save();
    res.json({ success: true, data: content });
  } catch (err) { next(err); }
});

// Block user
router.put('/users/:id/block', async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    if (user.role === 'admin') return res.status(400).json({ success: false, message: 'Cannot block admin' });
    user.isBlocked = true;
    await user.save();
    res.json({ success: true, message: 'User blocked' });
  } catch (err) { next(err); }
});

// Unblock user
router.put('/users/:id/unblock', async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    user.isBlocked = false;
    user.loginAttempts = 0;
    user.lockUntil = undefined;
    await user.save();
    res.json({ success: true, message: 'User unblocked' });
  } catch (err) { next(err); }
});

// ════════════════════════════════════════
//  USER DETAIL & MANAGEMENT
// ════════════════════════════════════════

// Get detailed user info
router.get('/users/:id/detail', async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select('-password -profilePhoto').populate('farmId').lean();
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const [subscription, payments, cattleCount, milkCount, healthCount, employeeCount, customerCount, activities] = await Promise.all([
      Subscription.find({ userId: user._id }).sort('-endDate').limit(10).lean(),
      Payment.find({ userId: user._id }).sort('-createdAt').limit(10).lean(),
      user.farmId ? Cattle.countDocuments({ farmId: user.farmId._id, status: 'active' }) : 0,
      user.farmId ? MilkRecord.countDocuments({ farmId: user.farmId._id }) : 0,
      user.farmId ? HealthRecord.countDocuments({ farmId: user.farmId._id }) : 0,
      user.farmId ? Employee.countDocuments({ farmId: user.farmId._id }) : 0,
      user.farmId ? Customer.countDocuments({ farmId: user.farmId._id }) : 0,
      user.farmId ? Activity.find({ farmId: user.farmId._id }).sort('-timestamp').limit(20).lean() : [],
    ]);

    const activeSub = subscription.find(s => s.isActive && new Date(s.endDate) >= new Date());

    res.json({
      success: true,
      data: {
        user,
        subscription: { current: activeSub || null, history: subscription },
        payments,
        farmStats: { cattle: cattleCount, milkRecords: milkCount, healthRecords: healthCount, employees: employeeCount, customers: customerCount },
        recentActivity: activities,
      },
    });
  } catch (err) { next(err); }
});

// Force password reset — generates new password
router.post('/users/:id/force-reset', async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    if (user.role === 'admin') return res.status(400).json({ success: false, message: 'Cannot reset admin password from here' });

    const newPassword = crypto.randomBytes(4).toString('hex'); // 8 char random password
    user.password = newPassword;
    user.loginAttempts = 0;
    user.lockUntil = undefined;
    await user.save();

    console.log(`[ADMIN] Force password reset: user=${user._id} email=${user.email} by admin=${req.user._id}`);
    res.json({ success: true, message: `Password reset. New temporary password: ${newPassword}`, tempPassword: newPassword });
  } catch (err) { next(err); }
});

// Delete user and all their data
router.delete('/users/:id', async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    if (user.role === 'admin') return res.status(400).json({ success: false, message: 'Cannot delete admin account' });

    const farmId = user.farmId;

    // Delete all user data
    await Promise.all([
      Subscription.deleteMany({ userId: user._id }),
      Payment.deleteMany({ userId: user._id }),
      farmId ? Cattle.deleteMany({ farmId }) : null,
      farmId ? MilkRecord.deleteMany({ farmId }) : null,
      farmId ? HealthRecord.deleteMany({ farmId }) : null,
      farmId ? Employee.deleteMany({ farmId }) : null,
      farmId ? Customer.deleteMany({ farmId }) : null,
      farmId ? Activity.deleteMany({ farmId }) : null,
      farmId ? Farm.findByIdAndDelete(farmId) : null,
      // Also delete from other models
      farmId ? (await import('../models/BreedingRecord.js')).default.deleteMany({ farmId }) : null,
      farmId ? (await import('../models/FeedRecord.js')).default.deleteMany({ farmId }) : null,
      farmId ? (await import('../models/Expense.js')).default.deleteMany({ farmId }) : null,
      farmId ? (await import('../models/Revenue.js')).default.deleteMany({ farmId }) : null,
      farmId ? (await import('../models/Insurance.js')).default.deleteMany({ farmId }) : null,
      farmId ? (await import('../models/Notification.js')).default.deleteMany({ farmId }) : null,
      farmId ? (await import('../models/MilkDelivery.js')).default.deleteMany({ farmId }) : null,
      farmId ? (await import('../models/CustomerPayment.js')).default.deleteMany({ farmId }) : null,
      farmId ? (await import('../models/Attendance.js')).default.deleteMany({ farmId }) : null,
      farmId ? (await import('../models/SalaryPayment.js')).default.deleteMany({ farmId }) : null,
    ].filter(Boolean));

    await User.findByIdAndDelete(user._id);

    console.log(`[ADMIN] User deleted: userId=${user._id} email=${user.email} farm=${farmId} by admin=${req.user._id}`);
    res.json({ success: true, message: `User "${user.name}" and all their data permanently deleted` });
  } catch (err) { next(err); }
});

// Change user role
router.put('/users/:id/role', async (req, res, next) => {
  try {
    const { role } = req.body;
    if (!['user', 'admin'].includes(role)) return res.status(400).json({ success: false, message: 'Invalid role' });
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    user.role = role;
    await user.save();
    console.log(`[ADMIN] Role changed: user=${user._id} newRole=${role} by admin=${req.user._id}`);
    res.json({ success: true, message: `Role changed to ${role}` });
  } catch (err) { next(err); }
});

// ════════════════════════════════════════
//  USER-SPECIFIC OVERRIDES
// ════════════════════════════════════════

// Get user overrides
router.get('/users/:id/overrides', async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select('name email userOverrides farmEnabled chatBubbleEnabled').lean();
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    // Convert Map to plain object
    const overrides = user.userOverrides || {};
    if (overrides.modulesEnabled instanceof Map) {
      overrides.modulesEnabled = Object.fromEntries(overrides.modulesEnabled);
    }
    res.json({ success: true, data: { ...overrides, farmEnabled: user.farmEnabled, chatBubbleEnabled: user.chatBubbleEnabled } });
  } catch (err) { next(err); }
});

// Update user overrides
router.put('/users/:id/overrides', async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const { modulesEnabled, chatBubbleEnabled, farmEnabled, maxCattle, maxEmployees, maxCustomers, customNotes } = req.body;

    // Direct user fields
    if (chatBubbleEnabled !== undefined) user.chatBubbleEnabled = !!chatBubbleEnabled;
    if (farmEnabled !== undefined) user.farmEnabled = !!farmEnabled;

    // Build overrides object
    const overrides = user.userOverrides || {};

    if (modulesEnabled && typeof modulesEnabled === 'object') {
      const allowed = ['cattle', 'milk', 'health', 'breeding', 'feed', 'finance', 'milkDelivery', 'employees', 'insurance', 'reports', 'chatbot'];
      const modules = {};
      for (const key of allowed) {
        if (modulesEnabled[key] !== undefined) modules[key] = !!modulesEnabled[key];
      }
      overrides.modulesEnabled = modules;
    }
    if (maxCattle !== undefined) overrides.maxCattle = Number(maxCattle) || null;
    if (maxEmployees !== undefined) overrides.maxEmployees = Number(maxEmployees) || null;
    if (maxCustomers !== undefined) overrides.maxCustomers = Number(maxCustomers) || null;
    if (customNotes !== undefined) overrides.customNotes = String(customNotes || '');

    user.userOverrides = overrides;
    await user.save();

    console.log(`[ADMIN] User overrides updated: user=${user._id} by admin=${req.user._id}`);
    res.json({ success: true, message: 'User settings updated', data: user.userOverrides });
  } catch (err) { next(err); }
});

// ════════════════════════════════════════
//  AUDIT LOGS
// ════════════════════════════════════════

router.get('/audit-logs', async (req, res, next) => {
  try {
    const { limit: lim = 100 } = req.query;
    // Get all activities across all farms, most recent first
    const logs = await Activity.find().sort('-timestamp').limit(Number(lim)).lean();
    res.json({ success: true, data: logs });
  } catch (err) { next(err); }
});

// ════════════════════════════════════════
//  PAYMENT FILTERS
// ════════════════════════════════════════

// Payment screenshot viewer (admin only — already behind admin middleware)
router.get('/payments/:id/screenshot', async (req, res, next) => {
  try {
    const payment = await Payment.findById(req.params.id).select('screenshot').lean();
    if (!payment) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: { screenshot: payment.screenshot } });
  } catch (err) { next(err); }
});

// ════════════════════════════════════════
//  SUBSCRIPTION PLANS MANAGEMENT
// ════════════════════════════════════════

// List all plans (admin sees all including inactive)
router.get('/plans', async (req, res, next) => {
  try {
    const plans = await Plan.find().sort('sortOrder createdAt');
    res.json({ success: true, data: plans });
  } catch (err) { next(err); }
});

// Create plan
router.post('/plans', async (req, res, next) => {
  try {
    const { name, label, price, days, period, features, isPopular, isActive, sortOrder } = req.body;
    if (!name || !label || !price || !days) {
      return res.status(400).json({ success: false, message: 'Name, label, price and days are required' });
    }
    const plan = await Plan.create({
      name: name.toLowerCase().replace(/\s+/g, '_'),
      label, price, days,
      period: period || '',
      features: features || ['All features included', 'Unlimited cattle & records', 'AI Farm Assistant', 'Reports & Analytics'],
      isPopular: isPopular || false,
      isActive: isActive !== false,
      sortOrder: sortOrder || 0,
    });
    console.log(`[ADMIN] Plan created: ${plan.name} ₹${plan.price}/${plan.days}d by admin=${req.user._id}`);
    res.status(201).json({ success: true, data: plan });
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ success: false, message: 'Plan with this name already exists' });
    next(err);
  }
});

// Update plan
router.put('/plans/:id', async (req, res, next) => {
  try {
    const plan = await Plan.findById(req.params.id);
    if (!plan) return res.status(404).json({ success: false, message: 'Plan not found' });
    const { label, price, days, period, features, isPopular, isActive, sortOrder } = req.body;
    if (label !== undefined) plan.label = label;
    if (price !== undefined) plan.price = price;
    if (days !== undefined) plan.days = days;
    if (period !== undefined) plan.period = period;
    if (features !== undefined) plan.features = features;
    if (isPopular !== undefined) plan.isPopular = isPopular;
    if (isActive !== undefined) plan.isActive = isActive;
    if (sortOrder !== undefined) plan.sortOrder = sortOrder;
    await plan.save();
    console.log(`[ADMIN] Plan updated: ${plan.name} by admin=${req.user._id}`);
    res.json({ success: true, data: plan });
  } catch (err) { next(err); }
});

// Delete plan
router.delete('/plans/:id', async (req, res, next) => {
  try {
    const plan = await Plan.findById(req.params.id);
    if (!plan) return res.status(404).json({ success: false, message: 'Plan not found' });
    await plan.deleteOne();
    console.log(`[ADMIN] Plan deleted: ${plan.name} by admin=${req.user._id}`);
    res.json({ success: true, message: `Plan "${plan.label}" deleted` });
  } catch (err) { next(err); }
});

// System health
router.get('/system-health', async (req, res, next) => {
  try {
    const mongoose = (await import('mongoose')).default;
    const dbState = ['disconnected', 'connected', 'connecting', 'disconnecting'][mongoose.connection.readyState];
    const memUsage = process.memoryUsage();
    res.json({
      success: true,
      data: {
        database: dbState,
        uptime: Math.floor(process.uptime()),
        memory: { rss: Math.round(memUsage.rss / 1024 / 1024) + 'MB', heap: Math.round(memUsage.heapUsed / 1024 / 1024) + 'MB' },
        nodeVersion: process.version,
        environment: process.env.NODE_ENV || 'development',
      },
    });
  } catch (err) { next(err); }
});

export default router;
