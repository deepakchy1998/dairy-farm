import { Router } from 'express';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import { auth } from '../middleware/auth.js';
import Payment from '../models/Payment.js';
import Subscription from '../models/Subscription.js';
import LandingContent from '../models/LandingContent.js';

const router = Router();
router.use(auth);

const PLAN_DAYS = { monthly: 30, quarterly: 90, halfyearly: 180, yearly: 365 };
const PLAN_PRICES = { monthly: 499, quarterly: 1299, halfyearly: 2499, yearly: 4499 };

function getRazorpay() {
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    return null;
  }
  return new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
}

// Check if Razorpay is configured
router.get('/config', (req, res) => {
  const enabled = !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
  res.json({
    success: true,
    data: {
      enabled,
      keyId: enabled ? process.env.RAZORPAY_KEY_ID : null,
    },
  });
});

// Create Razorpay order
router.post('/create-order', async (req, res, next) => {
  try {
    const razorpay = getRazorpay();
    if (!razorpay) {
      return res.status(503).json({ success: false, message: 'Razorpay is not configured. Please contact admin.' });
    }

    const { plan } = req.body;
    if (!plan || !PLAN_DAYS[plan]) {
      return res.status(400).json({ success: false, message: 'Invalid plan selected' });
    }

    // Get admin-set price or default
    const content = await LandingContent.findOne();
    const amount = content?.pricing?.[plan] || PLAN_PRICES[plan];

    // Check for existing pending Razorpay payment
    const pendingPayment = await Payment.findOne({ userId: req.user._id, status: 'pending', paymentMethod: 'razorpay' });
    if (pendingPayment) {
      // Expire old pending razorpay payment
      pendingPayment.status = 'expired';
      await pendingPayment.save();
    }

    let order;
    try {
      order = await razorpay.orders.create({
        amount: amount * 100, // Razorpay expects paise
        currency: 'INR',
        receipt: `dp_${req.user._id.toString().slice(-8)}_${Date.now()}`,
        notes: {
          userId: req.user._id.toString(),
          plan,
        },
      });
    } catch (rzErr) {
      console.error('Razorpay order creation failed:', rzErr.error || rzErr.message || rzErr);
      return res.status(502).json({ success: false, message: 'Payment gateway error. Please check Razorpay credentials or try again.' });
    }

    // Store as pending payment
    try {
      await Payment.create({
        userId: req.user._id,
        plan,
        amount,
        upiTransactionId: order.id, // Store Razorpay order ID here
        paymentMethod: 'razorpay',
        razorpayOrderId: order.id,
        status: 'pending',
        ipAddress: req.ip,
        userAgent: (req.headers['user-agent'] || '').slice(0, 500),
        expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 min expiry for razorpay
      });
    } catch (dbErr) {
      console.error('Failed to save razorpay payment record:', dbErr.message);
      // Still proceed — order was created on Razorpay
    }

    res.json({
      success: true,
      data: {
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        keyId: process.env.RAZORPAY_KEY_ID,
        name: 'DairyPro',
        description: `${plan.charAt(0).toUpperCase() + plan.slice(1)} Plan Subscription`,
        prefill: {
          name: req.user.name,
          email: req.user.email,
          contact: req.user.phone || '',
        },
      },
    });
  } catch (err) {
    console.error('Razorpay create order error:', err);
    next(err);
  }
});

// Verify Razorpay payment & auto-activate subscription
router.post('/verify-payment', async (req, res, next) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ success: false, message: 'Missing payment verification data' });
    }

    // Verify signature
    const secret = process.env.RAZORPAY_KEY_SECRET;
    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto.createHmac('sha256', secret).update(body).digest('hex');

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ success: false, message: 'Payment verification failed. Invalid signature.' });
    }

    // Find the pending payment
    const payment = await Payment.findOne({
      razorpayOrderId: razorpay_order_id,
      userId: req.user._id,
      status: 'pending',
    });

    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment record not found' });
    }

    // Update payment as verified
    payment.status = 'verified';
    payment.razorpayPaymentId = razorpay_payment_id;
    payment.razorpaySignature = razorpay_signature;
    payment.verifiedBy = req.user._id; // Auto-verified
    payment.adminNote = 'Auto-verified via Razorpay';
    await payment.save();

    // Auto-activate subscription
    const days = PLAN_DAYS[payment.plan] || 30;
    const existing = await Subscription.findOne({
      userId: req.user._id,
      isActive: true,
      endDate: { $gte: new Date() },
    }).sort('-endDate');

    const startDate = existing ? new Date(existing.endDate) : new Date();
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + days);

    await Subscription.create({
      userId: req.user._id,
      plan: payment.plan,
      startDate,
      endDate,
    });

    // Notify user
    try {
      const Notification = (await import('../models/Notification.js')).default;
      const User = (await import('../models/User.js')).default;
      const user = await User.findById(req.user._id).select('farmId').lean();
      await Notification.create({
        farmId: user?.farmId || req.user._id,
        userId: req.user._id,
        title: '✅ Subscription Activated!',
        message: `Your ${payment.plan} plan has been activated via Razorpay. Valid until ${endDate.toLocaleDateString('en-IN')}.`,
        severity: 'info',
        type: 'subscription_activated',
        actionUrl: '/subscription',
        refId: `razorpay_activated_${payment._id}`,
      }).catch(() => {});
    } catch (err) { console.error('Notification error:', err.message); }

    res.json({
      success: true,
      message: 'Payment verified! Subscription activated instantly.',
      data: {
        plan: payment.plan,
        amount: payment.amount,
        endDate,
      },
    });
  } catch (err) {
    console.error('Razorpay verify error:', err);
    next(err);
  }
});

export default router;
