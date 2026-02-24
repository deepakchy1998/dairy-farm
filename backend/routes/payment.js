import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import Payment from '../models/Payment.js';
import LandingContent from '../models/LandingContent.js';

const router = Router();
router.use(auth);

const PLAN_PRICES = { monthly: 499, quarterly: 1299, halfyearly: 2499, yearly: 4499 };

// Create payment with screenshot proof
router.post('/', async (req, res, next) => {
  try {
    const { plan, upiTransactionId, screenshot } = req.body;
    if (!plan || !upiTransactionId) {
      return res.status(400).json({ success: false, message: 'Plan and UPI Transaction ID are required' });
    }

    // Validate transaction ID format (only alphanumeric, 6-35 chars)
    const cleanTxnId = upiTransactionId.trim();
    if (!/^[a-zA-Z0-9]{6,35}$/.test(cleanTxnId)) {
      return res.status(400).json({ success: false, message: 'Invalid UPI Transaction ID. Enter only the numeric/alphanumeric transaction ID from your payment receipt (6-35 characters, no spaces or special characters).' });
    }

    // Validate plan exists and get admin-set price
    const content = await LandingContent.findOne();
    const amount = content?.pricing?.[plan] || PLAN_PRICES[plan];
    if (!amount) return res.status(400).json({ success: false, message: 'Invalid plan selected' });

    // Check for duplicate transaction ID
    const existing = await Payment.findOne({
      upiTransactionId: upiTransactionId.trim(),
      status: { $in: ['pending', 'verified'] },
    });
    if (existing) {
      return res.status(400).json({ success: false, message: 'This UPI Transaction ID has already been used. Please enter a unique transaction ID.' });
    }

    // Check for pending payment — only one pending at a time
    const pendingPayment = await Payment.findOne({ userId: req.user._id, status: 'pending' });
    if (pendingPayment) {
      return res.status(400).json({ success: false, message: 'You already have a pending payment. Please wait for admin verification or contact support.' });
    }

    // Auto-expire after 48 hours
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

    const payment = await Payment.create({
      userId: req.user._id,
      plan,
      amount,
      upiTransactionId: upiTransactionId.trim(),
      screenshot: screenshot || '',
      expiresAt,
    });

    // Notify admin about new payment
    try {
      const Notification = (await import('../models/Notification.js')).default;
      const adminUsers = await (await import('../models/User.js')).default.find({ role: 'admin' }).select('_id farmId').lean();
      for (const admin of adminUsers) {
        await Notification.create({
          farmId: admin.farmId || payment.userId,
          userId: admin._id,
          title: '💰 New Payment Received',
          message: `New ${plan} plan payment of ₹${amount} received. TXN: ${cleanTxnId}. Please verify.`,
          severity: 'warning',
          type: 'payment_received',
          actionUrl: '/admin',
          refId: `payment_received_${payment._id}`,
        }).catch(() => {}); // Ignore duplicate
      }
    } catch (err) { console.error('Admin notification error:', err.message); }

    res.status(201).json({ success: true, data: payment, message: 'Payment submitted! Admin will verify within 24 hours.' });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ success: false, message: 'This UPI Transaction ID is already in use.' });
    }
    next(err);
  }
});

// My payments
router.get('/my', async (req, res, next) => {
  try {
    // Auto-expire old pending payments
    await Payment.updateMany(
      { userId: req.user._id, status: 'pending', expiresAt: { $lt: new Date() } },
      { status: 'expired' }
    );
    const data = await Payment.find({ userId: req.user._id }).sort('-createdAt').limit(20);
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

export default router;
