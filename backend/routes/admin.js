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
import BreedingRecord from '../models/BreedingRecord.js';
import FeedRecord from '../models/FeedRecord.js';
import Expense from '../models/Expense.js';
import Customer from '../models/Customer.js';
import MilkDelivery from '../models/MilkDelivery.js';
import Insurance from '../models/Insurance.js';
import Plan from '../models/Plan.js';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import ContactMessage from '../models/ContactMessage.js';
import Notification from '../models/Notification.js';

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
    // Flatten pricing and custom plan config for frontend
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
        // Custom plan config flattened
        customPlanEnabled: content.customPlanConfig?.enabled !== false,
        customPlanHeading: content.customPlanConfig?.heading || '🛠️ Build Your Own Plan',
        customPlanSubheading: content.customPlanConfig?.subheading || 'Select only the modules you need. Pay for what you use!',
        customPlanMinPrice: content.customPlanConfig?.minMonthlyPrice || 200,
        customPlanCattlePrice: content.customPlanConfig?.modulePrices?.cattle || 50,
        customPlanMilkPrice: content.customPlanConfig?.modulePrices?.milk || 50,
        customPlanHealthPrice: content.customPlanConfig?.modulePrices?.health || 40,
        customPlanBreedingPrice: content.customPlanConfig?.modulePrices?.breeding || 40,
        customPlanFeedPrice: content.customPlanConfig?.modulePrices?.feed || 30,
        customPlanFinancePrice: content.customPlanConfig?.modulePrices?.finance || 40,
        customPlanMilkDeliveryPrice: content.customPlanConfig?.modulePrices?.milkDelivery || 50,
        customPlanEmployeesPrice: content.customPlanConfig?.modulePrices?.employees || 40,
        customPlanInsurancePrice: content.customPlanConfig?.modulePrices?.insurance || 30,
        customPlanReportsPrice: content.customPlanConfig?.modulePrices?.reports || 40,
        customPlanChatbotPrice: content.customPlanConfig?.modulePrices?.chatbot || 60,
      },
    });
  } catch (err) { next(err); }
});

// Update settings
router.put('/settings', async (req, res, next) => {
  try {
    const { 
      upiId, upiName, monthlyPrice, quarterlyPrice, halfyearlyPrice, yearlyPrice, trialDays, 
      supportEmail, supportPhone, contactAddress, heroTitle, heroSubtitle, testimonials, 
      statsActiveFarms, statsCattleManaged, statsMilkRecords, statsUptime,
      customPlanEnabled, customPlanHeading, customPlanSubheading, customPlanMinPrice,
      customPlanCattlePrice, customPlanMilkPrice, customPlanHealthPrice, customPlanBreedingPrice,
      customPlanFeedPrice, customPlanFinancePrice, customPlanMilkDeliveryPrice, customPlanEmployeesPrice,
      customPlanInsurancePrice, customPlanReportsPrice, customPlanChatbotPrice
    } = req.body;
    
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
    
    // Custom Plan Configuration
    if (customPlanEnabled !== undefined || customPlanHeading !== undefined || customPlanSubheading !== undefined || 
        customPlanMinPrice !== undefined || customPlanCattlePrice !== undefined) {
      content.customPlanConfig = {
        enabled: customPlanEnabled !== undefined ? customPlanEnabled : content.customPlanConfig?.enabled !== false,
        heading: customPlanHeading !== undefined ? customPlanHeading : content.customPlanConfig?.heading || '🛠️ Build Your Own Plan',
        subheading: customPlanSubheading !== undefined ? customPlanSubheading : content.customPlanConfig?.subheading || 'Select only the modules you need. Pay for what you use!',
        minMonthlyPrice: customPlanMinPrice !== undefined ? customPlanMinPrice : content.customPlanConfig?.minMonthlyPrice || 200,
        modulePrices: {
          cattle: customPlanCattlePrice !== undefined ? customPlanCattlePrice : content.customPlanConfig?.modulePrices?.cattle || 50,
          milk: customPlanMilkPrice !== undefined ? customPlanMilkPrice : content.customPlanConfig?.modulePrices?.milk || 50,
          health: customPlanHealthPrice !== undefined ? customPlanHealthPrice : content.customPlanConfig?.modulePrices?.health || 40,
          breeding: customPlanBreedingPrice !== undefined ? customPlanBreedingPrice : content.customPlanConfig?.modulePrices?.breeding || 40,
          feed: customPlanFeedPrice !== undefined ? customPlanFeedPrice : content.customPlanConfig?.modulePrices?.feed || 30,
          finance: customPlanFinancePrice !== undefined ? customPlanFinancePrice : content.customPlanConfig?.modulePrices?.finance || 40,
          milkDelivery: customPlanMilkDeliveryPrice !== undefined ? customPlanMilkDeliveryPrice : content.customPlanConfig?.modulePrices?.milkDelivery || 50,
          employees: customPlanEmployeesPrice !== undefined ? customPlanEmployeesPrice : content.customPlanConfig?.modulePrices?.employees || 40,
          insurance: customPlanInsurancePrice !== undefined ? customPlanInsurancePrice : content.customPlanConfig?.modulePrices?.insurance || 30,
          reports: customPlanReportsPrice !== undefined ? customPlanReportsPrice : content.customPlanConfig?.modulePrices?.reports || 40,
          chatbot: customPlanChatbotPrice !== undefined ? customPlanChatbotPrice : content.customPlanConfig?.modulePrices?.chatbot || 60,
        },
      };
    }
    
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

// ════════════════════════════════════════
//  BROADCAST NOTIFICATIONS
// ════════════════════════════════════════

router.post('/notifications/broadcast', async (req, res, next) => {
  try {
    const { title, message, severity = 'info', targetUserIds } = req.body;
    if (!title || !message) return res.status(400).json({ success: false, message: 'Title and message are required' });

    let users;
    if (targetUserIds && targetUserIds.length > 0) {
      users = await User.find({ _id: { $in: targetUserIds } }).select('_id farmId').lean();
    } else {
      users = await User.find({ role: 'user' }).select('_id farmId').lean();
    }

    const notifications = users.map(u => ({
      farmId: u.farmId,
      userId: u._id,
      title,
      message,
      severity,
      type: 'admin_broadcast',
      refId: `broadcast_${Date.now()}_${u._id}`,
    }));

    await Notification.insertMany(notifications, { ordered: false }).catch(() => {});
    console.log(`[ADMIN] Broadcast sent: "${title}" to ${users.length} users by admin=${req.user._id}`);
    res.json({ success: true, message: `Broadcast sent to ${users.length} users`, count: users.length });
  } catch (err) { next(err); }
});

// ════════════════════════════════════════
//  USER FARM DATA
// ════════════════════════════════════════

router.get('/users/:id/farm-data', async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select('name email farmId').populate('farmId', 'name').lean();
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    if (!user.farmId) return res.json({ success: true, data: { user, farmData: null, message: 'User has no farm' } });

    const fid = user.farmId._id;
    const [cattle, milkRecords, healthRecords, breedingRecords, expenses, revenues, feedRecords, insuranceRecords, employees, customers, deliveries] = await Promise.all([
      Cattle.find({ farmId: fid }).select('name tagNumber breed status gender').lean(),
      MilkRecord.countDocuments({ farmId: fid }),
      HealthRecord.countDocuments({ farmId: fid }),
      BreedingRecord.countDocuments({ farmId: fid }),
      Expense.countDocuments({ farmId: fid }),
      Revenue.countDocuments({ farmId: fid }),
      FeedRecord.countDocuments({ farmId: fid }),
      Insurance.countDocuments({ farmId: fid }),
      Employee.countDocuments({ farmId: fid }),
      Customer.countDocuments({ farmId: fid }),
      MilkDelivery.countDocuments({ farmId: fid }),
    ]);

    res.json({
      success: true,
      data: {
        user,
        farmData: {
          cattle: { list: cattle, count: cattle.length },
          milkRecords, healthRecords, breedingRecords,
          expenses, revenues, feedRecords, insuranceRecords,
          employees, customers, deliveries,
        },
      },
    });
  } catch (err) { next(err); }
});

// ════════════════════════════════════════
//  PLATFORM EXPORT
// ════════════════════════════════════════

// Helper: convert array of objects to CSV string
function arrayToCSV(data, columns) {
  if (!data.length) return columns.map(c => c.label).join(',') + '\n';
  const header = columns.map(c => `"${c.label}"`).join(',');
  const rows = data.map(row => columns.map(c => {
    let val = typeof c.key === 'function' ? c.key(row) : (row[c.key] ?? '');
    if (val instanceof Date) val = val.toISOString();
    if (typeof val === 'object') val = JSON.stringify(val);
    return `"${String(val).replace(/"/g, '""')}"`;
  }).join(','));
  return [header, ...rows].join('\n');
}

router.get('/export', async (req, res, next) => {
  try {
    const { format } = req.query; // 'csv' | 'pdf' | default json
    const [users, payments, subscriptions, revenueAgg] = await Promise.all([
      User.find().select('-password -profilePhoto').populate('farmId', 'name city state').lean(),
      Payment.find().populate('userId', 'name email').sort('-createdAt').lean(),
      Subscription.find().populate('userId', 'name email').sort('-endDate').lean(),
      Payment.aggregate([
        { $match: { status: 'verified' } },
        { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
      ]),
    ]);

    const dateStr = new Date().toISOString().slice(0, 10);

    // ── CSV Export ──
    if (format === 'csv') {
      const userCols = [
        { label: 'Name', key: 'name' },
        { label: 'Email', key: 'email' },
        { label: 'Phone', key: 'phone' },
        { label: 'Role', key: 'role' },
        { label: 'Blocked', key: r => r.isBlocked ? 'Yes' : 'No' },
        { label: 'Farm', key: r => r.farmId?.name || '' },
        { label: 'City', key: r => r.farmId?.city || '' },
        { label: 'State', key: r => r.farmId?.state || '' },
        { label: 'Registered', key: r => r.createdAt ? new Date(r.createdAt).toLocaleDateString('en-IN') : '' },
        { label: 'Last Login', key: r => r.lastLogin ? new Date(r.lastLogin).toLocaleDateString('en-IN') : 'Never' },
      ];
      const paymentCols = [
        { label: 'User', key: r => r.userId?.name || '' },
        { label: 'Email', key: r => r.userId?.email || '' },
        { label: 'Plan', key: 'plan' },
        { label: 'Amount (₹)', key: 'amount' },
        { label: 'Status', key: 'status' },
        { label: 'Transaction ID', key: 'upiTransactionId' },
        { label: 'Payment Method', key: r => r.paymentMethod || 'upi_manual' },
        { label: 'Date', key: r => r.createdAt ? new Date(r.createdAt).toLocaleDateString('en-IN') : '' },
      ];
      const subCols = [
        { label: 'User', key: r => r.userId?.name || '' },
        { label: 'Email', key: r => r.userId?.email || '' },
        { label: 'Plan', key: 'plan' },
        { label: 'Active', key: r => r.isActive ? 'Yes' : 'No' },
        { label: 'Start Date', key: r => r.startDate ? new Date(r.startDate).toLocaleDateString('en-IN') : '' },
        { label: 'End Date', key: r => r.endDate ? new Date(r.endDate).toLocaleDateString('en-IN') : '' },
      ];

      const csv = `DAIRYPRO PLATFORM EXPORT - ${dateStr}\n\n` +
        `=== USERS (${users.length}) ===\n` + arrayToCSV(users, userCols) + '\n\n' +
        `=== PAYMENTS (${payments.length}) ===\n` + arrayToCSV(payments, paymentCols) + '\n\n' +
        `=== SUBSCRIPTIONS (${subscriptions.length}) ===\n` + arrayToCSV(subscriptions, subCols) + '\n\n' +
        `=== REVENUE SUMMARY ===\n` +
        `"Total Revenue (₹)","${revenueAgg[0]?.total || 0}"\n` +
        `"Verified Payments","${revenueAgg[0]?.count || 0}"\n`;

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename=dairypro-export-${dateStr}.csv`);
      return res.send(csv);
    }

    // ── PDF Export ──
    if (format === 'pdf') {
      const PDFDocument = (await import('pdfkit')).default;
      const doc = new PDFDocument({ size: 'A4', margin: 40, bufferPages: true });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=dairypro-export-${dateStr}.pdf`);
      doc.pipe(res);

      // Title
      doc.fontSize(20).font('Helvetica-Bold').text('DairyPro Platform Export', { align: 'center' });
      doc.fontSize(10).font('Helvetica').text(`Generated: ${new Date().toLocaleString('en-IN')}`, { align: 'center' });
      doc.moveDown(1);

      // Summary box
      const totalRevenue = revenueAgg[0]?.total || 0;
      const totalVerified = revenueAgg[0]?.count || 0;
      doc.fontSize(12).font('Helvetica-Bold').text('Platform Summary');
      doc.fontSize(10).font('Helvetica');
      doc.text(`Total Users: ${users.filter(u => u.role === 'user').length}`);
      doc.text(`Total Admins: ${users.filter(u => u.role === 'admin').length}`);
      doc.text(`Total Payments: ${payments.length}`);
      doc.text(`Active Subscriptions: ${subscriptions.filter(s => s.isActive && new Date(s.endDate) >= new Date()).length}`);
      doc.text(`Total Revenue: Rs. ${totalRevenue.toLocaleString('en-IN')}`);
      doc.text(`Verified Payments: ${totalVerified}`);
      doc.moveDown(1);

      // Users table
      doc.fontSize(12).font('Helvetica-Bold').text(`Users (${users.length})`);
      doc.moveDown(0.3);
      doc.fontSize(8).font('Helvetica');
      for (const u of users.slice(0, 200)) {
        if (doc.y > 720) doc.addPage();
        doc.text(`${u.name} | ${u.email} | ${u.phone || '-'} | ${u.role} | Farm: ${u.farmId?.name || '-'} | ${u.isBlocked ? 'BLOCKED' : 'Active'} | Joined: ${u.createdAt ? new Date(u.createdAt).toLocaleDateString('en-IN') : '-'}`, { width: 520 });
      }
      if (users.length > 200) doc.text(`... and ${users.length - 200} more users`);
      doc.moveDown(1);

      // Payments table
      if (doc.y > 650) doc.addPage();
      doc.fontSize(12).font('Helvetica-Bold').text(`Payments (${payments.length})`);
      doc.moveDown(0.3);
      doc.fontSize(8).font('Helvetica');
      for (const p of payments.slice(0, 200)) {
        if (doc.y > 720) doc.addPage();
        doc.text(`${p.userId?.name || '-'} | ${p.plan} | Rs.${p.amount} | ${p.status} | TXN: ${p.upiTransactionId || '-'} | ${p.createdAt ? new Date(p.createdAt).toLocaleDateString('en-IN') : '-'}`, { width: 520 });
      }
      if (payments.length > 200) doc.text(`... and ${payments.length - 200} more payments`);
      doc.moveDown(1);

      // Subscriptions
      if (doc.y > 650) doc.addPage();
      doc.fontSize(12).font('Helvetica-Bold').text(`Subscriptions (${subscriptions.length})`);
      doc.moveDown(0.3);
      doc.fontSize(8).font('Helvetica');
      for (const s of subscriptions.slice(0, 200)) {
        if (doc.y > 720) doc.addPage();
        const active = s.isActive && new Date(s.endDate) >= new Date();
        doc.text(`${s.userId?.name || '-'} | ${s.plan} | ${active ? 'ACTIVE' : 'Expired'} | ${s.startDate ? new Date(s.startDate).toLocaleDateString('en-IN') : '-'} to ${s.endDate ? new Date(s.endDate).toLocaleDateString('en-IN') : '-'}`, { width: 520 });
      }
      if (subscriptions.length > 200) doc.text(`... and ${subscriptions.length - 200} more subscriptions`);

      doc.end();
      return;
    }

    // ── Default: JSON ──
    res.json({
      success: true,
      data: {
        exportedAt: new Date().toISOString(),
        users,
        payments,
        subscriptions,
        revenueSummary: {
          totalRevenue: revenueAgg[0]?.total || 0,
          totalVerifiedPayments: revenueAgg[0]?.count || 0,
        },
      },
    });
  } catch (err) { next(err); }
});

// ════════════════════════════════════════
//  CONTACT / SUPPORT MESSAGES
// ════════════════════════════════════════

router.get('/contact-messages', async (req, res, next) => {
  try {
    const { status } = req.query;
    const filter = {};
    if (status) filter.status = status;
    const { skip, limit, page } = paginate(req.query.page, req.query.limit);
    const total = await ContactMessage.countDocuments(filter);
    const pages = Math.ceil(total / limit);
    const messages = await ContactMessage.find(filter).populate('userId', 'name email').sort('-createdAt').skip(skip).limit(limit).lean();
    res.json({ success: true, data: messages, pagination: { page, pages, total, limit } });
  } catch (err) { next(err); }
});

router.put('/contact-messages/:id', async (req, res, next) => {
  try {
    const msg = await ContactMessage.findById(req.params.id);
    if (!msg) return res.status(404).json({ success: false, message: 'Message not found' });
    const { status, adminReply } = req.body;
    if (status) msg.status = status;
    if (adminReply !== undefined) msg.adminReply = adminReply;
    await msg.save();
    console.log(`[ADMIN] Contact message updated: id=${msg._id} status=${msg.status} by admin=${req.user._id}`);
    res.json({ success: true, data: msg });
  } catch (err) { next(err); }
});

// ════════════════════════════════════════
//  IMPERSONATION
// ════════════════════════════════════════

router.post('/users/:id/impersonate', async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select('_id name email role').lean();
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const token = jwt.sign(
      { userId: user._id, impersonatedBy: req.user._id },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    console.log(`[ADMIN] Impersonation: admin=${req.user._id} impersonating user=${user._id} (${user.email})`);
    res.json({ success: true, token, user: { _id: user._id, name: user.name, email: user.email, role: user.role }, expiresIn: '1 hour' });
  } catch (err) { next(err); }
});

// ════════════════════════════════════════
//  BULK ACTIONS
// ════════════════════════════════════════

router.post('/users/bulk-block', async (req, res, next) => {
  try {
    const { userIds } = req.body;
    if (!userIds || !userIds.length) return res.status(400).json({ success: false, message: 'User IDs required' });
    const result = await User.updateMany(
      { _id: { $in: userIds }, role: { $ne: 'admin' } },
      { isBlocked: true }
    );
    console.log(`[ADMIN] Bulk block: ${result.modifiedCount} users blocked by admin=${req.user._id}`);
    res.json({ success: true, message: `${result.modifiedCount} users blocked`, modifiedCount: result.modifiedCount });
  } catch (err) { next(err); }
});

router.post('/users/bulk-notify', async (req, res, next) => {
  try {
    const { userIds, title, message, severity = 'info' } = req.body;
    if (!userIds || !userIds.length || !title || !message) {
      return res.status(400).json({ success: false, message: 'User IDs, title and message required' });
    }
    const users = await User.find({ _id: { $in: userIds } }).select('_id farmId').lean();
    const notifications = users.map(u => ({
      farmId: u.farmId,
      userId: u._id,
      title,
      message,
      severity,
      type: 'admin_notification',
      refId: `bulk_notify_${Date.now()}_${u._id}`,
    }));
    await Notification.insertMany(notifications, { ordered: false }).catch(() => {});
    console.log(`[ADMIN] Bulk notify: ${users.length} users notified by admin=${req.user._id}`);
    res.json({ success: true, message: `Notification sent to ${users.length} users`, count: users.length });
  } catch (err) { next(err); }
});

// ═══════════════════════════════════════
// SEED DUMMY DATA (admin only)
// ═══════════════════════════════════════
router.post('/seed-dummy-data', async (req, res, next) => {
  try {
    const farmDoc = await Farm.findOne({ userId: req.user.id }) || await Farm.findOne();
    if (!farmDoc) return res.status(400).json({ success: false, message: 'No farm found' });
    const farmId = farmDoc._id;
    const d = (daysAgo) => { const dt = new Date(); dt.setDate(dt.getDate() - daysAgo); return dt; };
    const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
    const results = {};

    // 1. CATTLE (10)
    const cattleData = [
      { tagNumber: 'GIR-001', breed: 'Gir', gender: 'female', category: 'milking', dateOfBirth: d(1200), weight: 420, color: 'Red & White', lactationNumber: 3, lastCalvingDate: d(60) },
      { tagNumber: 'HF-002', breed: 'Holstein Friesian', gender: 'female', category: 'milking', dateOfBirth: d(1500), weight: 550, color: 'Black & White', lactationNumber: 4, lastCalvingDate: d(90) },
      { tagNumber: 'SAH-003', breed: 'Sahiwal', gender: 'female', category: 'milking', dateOfBirth: d(1100), weight: 380, color: 'Reddish Brown', lactationNumber: 2, lastCalvingDate: d(45) },
      { tagNumber: 'JER-004', breed: 'Jersey', gender: 'female', category: 'milking', dateOfBirth: d(1300), weight: 400, color: 'Brown', lactationNumber: 3, lastCalvingDate: d(120) },
      { tagNumber: 'MUR-005', breed: 'Murrah', gender: 'female', category: 'milking', dateOfBirth: d(1000), weight: 500, color: 'Black', lactationNumber: 2, lastCalvingDate: d(30) },
      { tagNumber: 'CB-006', breed: 'Crossbred', gender: 'female', category: 'pregnant', dateOfBirth: d(900), weight: 440, color: 'Brown & White' },
      { tagNumber: 'GIR-007', breed: 'Gir', gender: 'female', category: 'dry', dateOfBirth: d(1600), weight: 390, color: 'Red', lactationNumber: 5 },
      { tagNumber: 'HF-008', breed: 'Holstein Friesian', gender: 'female', category: 'heifer', dateOfBirth: d(500), weight: 280, color: 'Black & White' },
      { tagNumber: 'SAH-009', breed: 'Sahiwal', gender: 'male', category: 'bull', dateOfBirth: d(800), weight: 620, color: 'Brown' },
      { tagNumber: 'JER-010', breed: 'Jersey', gender: 'female', category: 'calf', dateOfBirth: d(90), weight: 65, color: 'Light Brown' },
    ];
    const cattleIds = [];
    for (const c of cattleData) {
      const existing = await Cattle.findOne({ farmId, tagNumber: c.tagNumber });
      if (existing) { cattleIds.push(existing._id); continue; }
      const doc = await Cattle.create({ farmId, ...c });
      cattleIds.push(doc._id);
    }
    results.cattle = cattleIds.length;

    // 2. MILK RECORDS (8 days × 5 milking cattle)
    const milkingIds = cattleIds.slice(0, 5);
    let milkCount = 0;
    for (let day = 0; day < 8; day++) {
      const date = new Date(d(day).toDateString());
      for (const cId of milkingIds) {
        const existing = await MilkRecord.findOne({ farmId, cattleId: cId, date });
        if (existing) continue;
        const morn = +(rand(3, 8) + Math.random()).toFixed(1);
        const eve = +(rand(2, 6) + Math.random()).toFixed(1);
        await MilkRecord.create({
          farmId, cattleId: cId, date,
          morningYield: morn, morningFat: +(rand(35, 50) / 10).toFixed(1), morningSNF: +(rand(80, 90) / 10).toFixed(1),
          eveningYield: eve, eveningFat: +(rand(35, 48) / 10).toFixed(1), eveningSNF: +(rand(80, 88) / 10).toFixed(1),
        });
        milkCount++;
      }
    }
    results.milkRecords = milkCount;

    // 3. HEALTH RECORDS (10)
    const healthData = [
      { cattleId: cattleIds[0], date: d(5), type: 'vaccination', description: 'FMD Vaccination', medicine: 'Raksha FMD', cost: 150, nextDueDate: d(-180), vetName: 'Dr. Sharma' },
      { cattleId: cattleIds[1], date: d(10), type: 'vaccination', description: 'HS Vaccination', medicine: 'Alum HS Vaccine', cost: 120, nextDueDate: d(-175), vetName: 'Dr. Sharma' },
      { cattleId: cattleIds[2], date: d(3), type: 'treatment', description: 'Mastitis treatment - right front quarter', medicine: 'Ceftriaxone + Meloxicam', cost: 800, vetName: 'Dr. Patel' },
      { cattleId: cattleIds[3], date: d(15), type: 'deworming', description: 'Routine deworming', medicine: 'Albendazole 10ml', cost: 80, nextDueDate: d(-75), vetName: 'Dr. Sharma' },
      { cattleId: cattleIds[4], date: d(7), type: 'checkup', description: 'Pregnancy confirmation checkup', cost: 300, vetName: 'Dr. Patel' },
      { cattleId: cattleIds[5], date: d(20), type: 'vaccination', description: 'Brucellosis Vaccination', medicine: 'S19 Vaccine', cost: 200, nextDueDate: d(-150), vetName: 'Dr. Kumar' },
      { cattleId: cattleIds[6], date: d(2), type: 'treatment', description: 'Hoof trimming and treatment', medicine: 'Topical spray', cost: 250, vetName: 'Dr. Patel' },
      { cattleId: cattleIds[7], date: d(12), type: 'vaccination', description: 'BQ (Black Quarter) Vaccination', medicine: 'BQ Vaccine', cost: 100, nextDueDate: d(-5), vetName: 'Dr. Sharma' },
      { cattleId: cattleIds[8], date: d(8), type: 'checkup', description: 'General health checkup - all okay', cost: 200, vetName: 'Dr. Kumar' },
      { cattleId: cattleIds[9], date: d(1), type: 'deworming', description: 'Calf deworming', medicine: 'Fenbendazole 5ml', cost: 50, nextDueDate: d(-85), vetName: 'Dr. Sharma' },
    ];
    for (const h of healthData) { await HealthRecord.create({ farmId, ...h }); }
    results.healthRecords = healthData.length;

    // 4. BREEDING RECORDS (8)
    const breedingData = [
      { cattleId: cattleIds[0], breedingDate: d(60), method: 'artificial', inseminatorName: 'Ramesh Kumar', bullInfo: 'HF Bull #CB-421', status: 'confirmed', expectedDelivery: d(-222) },
      { cattleId: cattleIds[1], breedingDate: d(90), method: 'artificial', inseminatorName: 'Ramesh Kumar', bullInfo: 'Jersey Bull #J-115', status: 'confirmed', expectedDelivery: d(-192) },
      { cattleId: cattleIds[2], breedingDate: d(45), method: 'natural', bullInfo: 'Sahiwal Bull SAH-009', status: 'bred', expectedDelivery: d(-237) },
      { cattleId: cattleIds[3], breedingDate: d(120), method: 'artificial', inseminatorName: 'Suresh Singh', bullInfo: 'Gir Bull #G-88', status: 'confirmed', expectedDelivery: d(-162) },
      { cattleId: cattleIds[4], breedingDate: d(30), method: 'artificial', inseminatorName: 'Ramesh Kumar', bullInfo: 'Murrah Bull #M-55', status: 'bred', expectedDelivery: d(-252) },
      { cattleId: cattleIds[5], breedingDate: d(200), method: 'artificial', inseminatorName: 'Suresh Singh', bullInfo: 'HF Bull #CB-421', status: 'confirmed', expectedDelivery: d(-82) },
      { cattleId: cattleIds[6], breedingDate: d(300), method: 'natural', bullInfo: 'Gir Bull #G-88', status: 'delivered', actualDelivery: d(20), offspring: 'Female calf', expectedDelivery: d(18) },
      { cattleId: cattleIds[7], breedingDate: d(150), method: 'artificial', inseminatorName: 'Ramesh Kumar', bullInfo: 'Jersey Bull #J-115', status: 'failed', notes: 'Repeat breeding required' },
    ];
    for (const b of breedingData) { await BreedingRecord.create({ farmId, ...b }); }
    results.breedingRecords = breedingData.length;

    // 5. FEED RECORDS (10)
    const feedData = [
      { date: d(1), feedType: 'Green Fodder', quantity: 200, unit: 'kg', cost: 1200, notes: 'Napier grass from own field' },
      { date: d(1), feedType: 'Dry Hay', quantity: 80, unit: 'kg', cost: 800, notes: 'Wheat straw' },
      { date: d(2), feedType: 'Concentrate', quantity: 50, unit: 'kg', cost: 1500, notes: 'Amul Dan 20% protein' },
      { date: d(3), feedType: 'Cotton Seed', quantity: 30, unit: 'kg', cost: 900 },
      { date: d(3), feedType: 'Mineral Mix', quantity: 5, unit: 'kg', cost: 350, notes: 'Agrimin Forte' },
      { date: d(5), feedType: 'Silage', quantity: 100, unit: 'kg', cost: 600, notes: 'Maize silage' },
      { date: d(5), feedType: 'Mustard Cake', quantity: 25, unit: 'kg', cost: 750 },
      { date: d(7), feedType: 'Green Fodder', quantity: 180, unit: 'kg', cost: 1080 },
      { date: d(7), feedType: 'Wheat Bran', quantity: 40, unit: 'kg', cost: 600 },
      { date: d(10), feedType: 'Rice Bran', quantity: 30, unit: 'kg', cost: 420 },
    ];
    for (const f of feedData) { await FeedRecord.create({ farmId, ...f }); }
    results.feedRecords = feedData.length;

    // 6. EXPENSES (10)
    const expenseData = [
      { date: d(1), category: 'feed', description: 'Monthly cattle feed supply', amount: 15000 },
      { date: d(3), category: 'medicine', description: 'FMD and HS vaccines batch', amount: 2500 },
      { date: d(5), category: 'equipment', description: 'Milking machine servicing', amount: 3500 },
      { date: d(7), category: 'salary', description: 'Employee salary advance - Raju', amount: 5000 },
      { date: d(8), category: 'transport', description: 'Milk tanker transportation', amount: 2000 },
      { date: d(10), category: 'maintenance', description: 'Cattle shed roof repair', amount: 8000 },
      { date: d(12), category: 'feed', description: 'Mineral mix and concentrate', amount: 4500 },
      { date: d(15), category: 'medicine', description: 'Mastitis treatment medicines', amount: 1200 },
      { date: d(18), category: 'equipment', description: 'New water trough installation', amount: 6000 },
      { date: d(20), category: 'other', description: 'Electricity bill - farm', amount: 3200 },
    ];
    for (const e of expenseData) { await Expense.create({ farmId, ...e }); }
    results.expenses = expenseData.length;

    // 7. REVENUE (10)
    const revenueData = [
      { date: d(1), category: 'milk_sale', description: 'Daily milk sale - retail', amount: 4500, milkSaleType: 'retail', milkQuantity: 75, milkRate: 60 },
      { date: d(2), category: 'milk_sale', description: 'Dairy cooperative collection', amount: 8400, milkSaleType: 'dairy', milkQuantity: 120, milkRate: 70 },
      { date: d(3), category: 'milk_sale', description: 'Daily milk sale - retail', amount: 4200, milkSaleType: 'retail', milkQuantity: 70, milkRate: 60 },
      { date: d(5), category: 'milk_sale', description: 'Dairy cooperative collection', amount: 8750, milkSaleType: 'dairy', milkQuantity: 125, milkRate: 70 },
      { date: d(7), category: 'milk_sale', description: 'Daily milk sale - retail', amount: 4800, milkSaleType: 'retail', milkQuantity: 80, milkRate: 60 },
      { date: d(8), category: 'manure_sale', description: 'Cow dung manure - sold to farmer', amount: 3000 },
      { date: d(10), category: 'milk_sale', description: 'Dairy cooperative collection', amount: 9100, milkSaleType: 'dairy', milkQuantity: 130, milkRate: 70 },
      { date: d(12), category: 'other', description: 'Government subsidy received', amount: 15000 },
      { date: d(15), category: 'milk_sale', description: 'Daily milk sale - retail', amount: 5100, milkSaleType: 'retail', milkQuantity: 85, milkRate: 60 },
      { date: d(20), category: 'manure_sale', description: 'Vermicompost sale', amount: 5000 },
    ];
    for (const r of revenueData) { await Revenue.create({ farmId, ...r }); }
    results.revenue = revenueData.length;

    // 8. EMPLOYEES (8)
    const employeeData = [
      { name: 'Raju Yadav', phone: '+91 9876543210', village: 'Mandvi', role: 'Milker', monthlySalary: 12000, joinDate: d(365) },
      { name: 'Sita Devi', phone: '+91 9876543211', village: 'Mandvi', role: 'Milker', monthlySalary: 11000, joinDate: d(300) },
      { name: 'Mohan Lal', phone: '+91 9876543212', village: 'Bharuch', role: 'Feeder', monthlySalary: 10000, joinDate: d(500) },
      { name: 'Bhim Singh', phone: '+91 9876543213', village: 'Anand', role: 'Cleaner', monthlySalary: 9000, joinDate: d(200) },
      { name: 'Lakshmi Bai', phone: '+91 9876543214', village: 'Mandvi', role: 'Helper', monthlySalary: 8500, joinDate: d(150) },
      { name: 'Arjun Patel', phone: '+91 9876543215', village: 'Vadodara', role: 'Manager', monthlySalary: 18000, joinDate: d(730), bankAccount: '12345678901234', ifsc: 'SBIN0001234' },
      { name: 'Kiran Solanki', phone: '+91 9876543216', village: 'Anand', role: 'Driver', monthlySalary: 11000, joinDate: d(180) },
      { name: 'Gopal Das', phone: '+91 9876543217', village: 'Bharuch', role: 'Veterinary', monthlySalary: 20000, joinDate: d(400), notes: 'Part-time vet' },
    ];
    let empCount = 0;
    for (const e of employeeData) {
      const existing = await Employee.findOne({ farmId, name: e.name });
      if (!existing) { await Employee.create({ farmId, ...e }); empCount++; }
    }
    results.employees = empCount;

    // 9. CUSTOMERS (8)
    const customerData = [
      { name: 'Ramesh Sharma', phone: '+91 9988776601', village: 'Mandvi', dailyQuantity: 2, ratePerLiter: 60, deliveryTime: 'morning' },
      { name: 'Sunita Patel', phone: '+91 9988776602', village: 'Bharuch', dailyQuantity: 3, ratePerLiter: 58, deliveryTime: 'morning' },
      { name: 'Vijay Kumar', phone: '+91 9988776603', village: 'Anand', dailyQuantity: 5, ratePerLiter: 55, deliveryTime: 'both', notes: 'Sweet shop owner' },
      { name: 'Meena Devi', phone: '+91 9988776604', village: 'Mandvi', dailyQuantity: 1.5, ratePerLiter: 60, deliveryTime: 'morning' },
      { name: 'Prakash Joshi', phone: '+91 9988776605', village: 'Vadodara', dailyQuantity: 4, ratePerLiter: 55, deliveryTime: 'evening' },
      { name: 'Anita Singh', phone: '+91 9988776606', village: 'Anand', dailyQuantity: 2, ratePerLiter: 60, deliveryTime: 'morning' },
      { name: 'Govind Rao', phone: '+91 9988776607', village: 'Bharuch', dailyQuantity: 10, ratePerLiter: 50, deliveryTime: 'both', notes: 'Tea stall - bulk buyer' },
      { name: 'Kavita Bhen', phone: '+91 9988776608', village: 'Mandvi', dailyQuantity: 1, ratePerLiter: 62, deliveryTime: 'morning' },
    ];
    const custIds = [];
    for (const c of customerData) {
      const existing = await Customer.findOne({ farmId, name: c.name });
      if (existing) { custIds.push(existing._id); continue; }
      const doc = await Customer.create({ farmId, ...c });
      custIds.push(doc._id);
    }
    results.customers = custIds.length;

    // 10. MILK DELIVERIES (7 days)
    let delCount = 0;
    for (let day = 0; day < 7; day++) {
      const date = new Date(d(day).toDateString());
      for (const custId of custIds) {
        const cust = await Customer.findById(custId);
        if (!cust) continue;
        const sessions = cust.deliveryTime === 'both' ? ['morning', 'evening'] : [cust.deliveryTime || 'morning'];
        for (const session of sessions) {
          const existing = await MilkDelivery.findOne({ farmId, customerId: custId, date, session });
          if (existing) continue;
          const qty = +(cust.dailyQuantity + (Math.random() * 0.4 - 0.2)).toFixed(1);
          await MilkDelivery.create({ farmId, customerId: custId, date, quantity: qty, ratePerLiter: cust.ratePerLiter, amount: qty * cust.ratePerLiter, session });
          delCount++;
        }
      }
    }
    results.milkDeliveries = delCount;

    // 11. INSURANCE (7)
    const insuranceData = [
      { cattleId: cattleIds[0], provider: 'National Insurance', policyNumber: 'NIC-2024-001', sumInsured: 80000, premium: 3200, startDate: d(200), endDate: d(-165), status: 'active', govtScheme: 'PMFBY' },
      { cattleId: cattleIds[1], provider: 'United India Insurance', policyNumber: 'UII-2024-045', sumInsured: 120000, premium: 4800, startDate: d(180), endDate: d(-185), status: 'active' },
      { cattleId: cattleIds[2], provider: 'National Insurance', policyNumber: 'NIC-2024-002', sumInsured: 70000, premium: 2800, startDate: d(150), endDate: d(-215), status: 'active', govtScheme: 'PMFBY' },
      { cattleId: cattleIds[3], provider: 'Oriental Insurance', policyNumber: 'OIC-2024-078', sumInsured: 90000, premium: 3600, startDate: d(100), endDate: d(-265), status: 'active' },
      { cattleId: cattleIds[4], provider: 'National Insurance', policyNumber: 'NIC-2024-003', sumInsured: 100000, premium: 4000, startDate: d(120), endDate: d(-245), status: 'active', govtScheme: 'State Dairy Scheme' },
      { cattleId: cattleIds[5], provider: 'United India Insurance', policyNumber: 'UII-2023-088', sumInsured: 85000, premium: 3400, startDate: d(400), endDate: d(35), status: 'expired' },
      { cattleId: cattleIds[8], provider: 'Oriental Insurance', policyNumber: 'OIC-2024-099', sumInsured: 150000, premium: 6000, startDate: d(90), endDate: d(-275), status: 'active', notes: 'Premium bull' },
    ];
    for (const ins of insuranceData) { await Insurance.create({ farmId, ...ins }); }
    results.insurance = insuranceData.length;

    await logActivity(farmId, 'system', 'Dummy data seeded via admin panel');

    res.json({ success: true, message: 'Dummy data seeded successfully!', data: results });
  } catch (err) { next(err); }
});

// ═══════════════════════════════════════
// DELETE DUMMY DATA (admin only)
// ═══════════════════════════════════════
router.delete('/seed-dummy-data', async (req, res, next) => {
  try {
    const farmDoc = await Farm.findOne({ userId: req.user.id }) || await Farm.findOne();
    if (!farmDoc) return res.status(400).json({ success: false, message: 'No farm found' });
    const farmId = farmDoc._id;

    // Known dummy tag numbers and names
    const dummyTags = ['GIR-001', 'HF-002', 'SAH-003', 'JER-004', 'MUR-005', 'CB-006', 'GIR-007', 'HF-008', 'SAH-009', 'JER-010'];
    const dummyEmployees = ['Raju Yadav', 'Sita Devi', 'Mohan Lal', 'Bhim Singh', 'Lakshmi Bai', 'Arjun Patel', 'Kiran Solanki', 'Gopal Das'];
    const dummyCustomers = ['Ramesh Sharma', 'Sunita Patel', 'Vijay Kumar', 'Meena Devi', 'Prakash Joshi', 'Anita Singh', 'Govind Rao', 'Kavita Bhen'];
    const dummyPolicies = ['NIC-2024-001', 'UII-2024-045', 'NIC-2024-002', 'OIC-2024-078', 'NIC-2024-003', 'UII-2023-088', 'OIC-2024-099'];

    const results = {};

    // Find dummy cattle IDs first (needed for related records)
    const dummyCattle = await Cattle.find({ farmId, tagNumber: { $in: dummyTags } });
    const dummyCattleIds = dummyCattle.map(c => c._id);

    // Delete milk records for dummy cattle
    const milkDel = await MilkRecord.deleteMany({ farmId, cattleId: { $in: dummyCattleIds } });
    results.milkRecords = milkDel.deletedCount;

    // Delete health records for dummy cattle
    const healthDel = await HealthRecord.deleteMany({ farmId, cattleId: { $in: dummyCattleIds } });
    results.healthRecords = healthDel.deletedCount;

    // Delete breeding records for dummy cattle
    const breedDel = await BreedingRecord.deleteMany({ farmId, cattleId: { $in: dummyCattleIds } });
    results.breedingRecords = breedDel.deletedCount;

    // Delete insurance for dummy cattle
    const insDel = await Insurance.deleteMany({ farmId, policyNumber: { $in: dummyPolicies } });
    results.insurance = insDel.deletedCount;

    // Delete dummy cattle
    const cattleDel = await Cattle.deleteMany({ farmId, tagNumber: { $in: dummyTags } });
    results.cattle = cattleDel.deletedCount;

    // Delete dummy employees
    const empDel = await Employee.deleteMany({ farmId, name: { $in: dummyEmployees } });
    results.employees = empDel.deletedCount;

    // Delete dummy customers and their deliveries
    const dummyCusts = await Customer.find({ farmId, name: { $in: dummyCustomers } });
    const dummyCustIds = dummyCusts.map(c => c._id);
    const delDel = await MilkDelivery.deleteMany({ farmId, customerId: { $in: dummyCustIds } });
    results.milkDeliveries = delDel.deletedCount;
    const custDel = await Customer.deleteMany({ farmId, name: { $in: dummyCustomers } });
    results.customers = custDel.deletedCount;

    // Delete dummy feed records (by known descriptions)
    const feedDel = await FeedRecord.deleteMany({ farmId, notes: { $in: ['Napier grass from own field', 'Wheat straw', 'Amul Dan 20% protein', 'Agrimin Forte', 'Maize silage', ''] }, feedType: { $in: ['Green Fodder', 'Dry Hay', 'Concentrate', 'Cotton Seed', 'Mineral Mix', 'Silage', 'Mustard Cake', 'Wheat Bran', 'Rice Bran'] } });
    results.feedRecords = feedDel.deletedCount;

    // Delete dummy expenses (by known descriptions)
    const dummyExpDescs = ['Monthly cattle feed supply', 'FMD and HS vaccines batch', 'Milking machine servicing', 'Employee salary advance - Raju', 'Milk tanker transportation', 'Cattle shed roof repair', 'Mineral mix and concentrate', 'Mastitis treatment medicines', 'New water trough installation', 'Electricity bill - farm'];
    const expDel = await Expense.deleteMany({ farmId, description: { $in: dummyExpDescs } });
    results.expenses = expDel.deletedCount;

    // Delete dummy revenue (by known descriptions)
    const dummyRevDescs = ['Daily milk sale - retail', 'Dairy cooperative collection', 'Cow dung manure - sold to farmer', 'Government subsidy received', 'Vermicompost sale'];
    const revDel = await Revenue.deleteMany({ farmId, description: { $in: dummyRevDescs } });
    results.revenue = revDel.deletedCount;

    await logActivity(farmId, 'system', 'Dummy data deleted via admin panel');

    res.json({ success: true, message: 'Dummy data deleted successfully!', data: results });
  } catch (err) { next(err); }
});

export default router;
