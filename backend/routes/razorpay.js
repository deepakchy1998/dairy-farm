import { Router } from 'express';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import { auth } from '../middleware/auth.js';
import Payment from '../models/Payment.js';
import Subscription from '../models/Subscription.js';
import Plan from '../models/Plan.js';

const router = Router();

// ═══════════════════════════════════════════
//  RAZORPAY INSTANCE (Singleton)
// ═══════════════════════════════════════════
let razorpayInstance = null;
function getRazorpay() {
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) return null;
  if (!razorpayInstance) {
    razorpayInstance = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
  }
  return razorpayInstance;
}

// ═══════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════
async function activateSubscription(userId, planName, paymentId) {
  const planDoc = await Plan.findOne({ name: planName });
  
  let days = planDoc?.days || 30;
  
  // If no plan doc (custom plan), use payment amount to determine days
  if (!planDoc) {
    // Custom plan — get days from payment document
    const payment = await Payment.findById(paymentId).lean();
    days = payment?.customDays || 30;
  }

  // Check for existing active subscription to extend
  const existing = await Subscription.findOne({
    userId,
    isActive: true,
    endDate: { $gte: new Date() },
  }).sort('-endDate');

  const startDate = existing ? new Date(existing.endDate) : new Date();
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + days);

  const sub = await Subscription.create({
    userId,
    plan: planName,
    startDate,
    endDate,
    paymentId,
  });

  // Send notification
  try {
    const Notification = (await import('../models/Notification.js')).default;
    const User = (await import('../models/User.js')).default;
    const user = await User.findById(userId).select('farmId').lean();
    await Notification.create({
      farmId: user?.farmId || userId,
      userId,
      title: '✅ Subscription Activated!',
      message: `Your ${planName} plan is now active. Valid until ${endDate.toLocaleDateString('en-IN')}.`,
      severity: 'info',
      type: 'subscription_activated',
      actionUrl: '/subscription',
      refId: `sub_activated_${paymentId || sub._id}`,
    }).catch(() => {});
  } catch (err) { console.error('Notification error:', err.message); }

  return { startDate, endDate, days };
}

// ═══════════════════════════════════════════
//  PUBLIC: Config check
// ═══════════════════════════════════════════
router.get('/config', auth, (req, res) => {
  const enabled = !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
  res.json({
    success: true,
    data: {
      enabled,
      keyId: enabled ? process.env.RAZORPAY_KEY_ID : null,
    },
  });
});

// ═══════════════════════════════════════════
//  CREATE ORDER (Authenticated)
// ═══════════════════════════════════════════
router.post('/create-order', auth, async (req, res, next) => {
  try {
    const razorpay = getRazorpay();
    if (!razorpay) {
      return res.status(503).json({ success: false, message: 'Payment gateway is not configured.' });
    }

    const { plan } = req.body;
    if (!plan) {
      return res.status(400).json({ success: false, message: 'Plan is required' });
    }

    const planDoc = await Plan.findOne({ name: plan, isActive: true });

    // Support custom plan
    let customPlanPrice = null;
    let customPlanDays = null;
    if (!planDoc && plan === 'custom') {
      const { modules: selectedModules, period: customPeriod = 'monthly' } = req.body;
      if (!Array.isArray(selectedModules) || selectedModules.length === 0) {
        return res.status(400).json({ success: false, message: 'Custom plan requires selected modules' });
      }
      // Calculate price
      const LandingContent = (await import('../models/LandingContent.js')).default;
      const content = await LandingContent.findOne();
      const config = content?.customPlanConfig;
      if (!config?.enabled) return res.status(400).json({ success: false, message: 'Custom plans not available' });
      
      const rawPrices = config.modulePrices || {};
      const otherPrices = Object.entries(rawPrices).filter(([k]) => k !== 'chatbot').map(([, v]) => v).sort((a, b) => a - b);
      const mid = Math.floor(otherPrices.length / 2);
      const chatbotPrice = otherPrices.length % 2 === 0 ? Math.round((otherPrices[mid - 1] + otherPrices[mid]) / 2) : otherPrices[mid];
      const modulePrices = { ...rawPrices, chatbot: chatbotPrice };
      
      let monthlyPrice = selectedModules.reduce((t, m) => t + (modulePrices[m] || 0), 0);
      if (monthlyPrice < config.minMonthlyPrice) monthlyPrice = config.minMonthlyPrice;
      
      const multipliers = { monthly: 1, halfyearly: 6, yearly: 12 };
      const daysMap = { monthly: 30, halfyearly: 180, yearly: 365 };
      customPlanPrice = monthlyPrice * (multipliers[customPeriod] || 1);
      customPlanDays = daysMap[customPeriod] || 30;
    }

    if (!planDoc && !customPlanPrice) {
      return res.status(400).json({ success: false, message: 'Invalid or inactive plan' });
    }

    const orderPrice = customPlanPrice || planDoc.price;
    const orderDays = customPlanDays || planDoc.days;
    const orderLabel = planDoc?.label || 'Custom Plan';

    // Expire any old pending razorpay payments for this user
    await Payment.updateMany(
      { userId: req.user._id, status: 'pending', paymentMethod: 'razorpay' },
      { status: 'expired' }
    );

    // Create Razorpay order
    let order;
    try {
      order = await razorpay.orders.create({
        amount: orderPrice * 100, // paise
        currency: 'INR',
        receipt: `dp_${req.user._id.toString().slice(-8)}_${Date.now()}`,
        notes: {
          userId: req.user._id.toString(),
          plan,
          userName: req.user.name,
          userEmail: req.user.email,
        },
      });
    } catch (rzErr) {
      console.error('Razorpay order creation failed:', rzErr.error || rzErr.message || rzErr);
      return res.status(502).json({ success: false, message: 'Payment gateway error. Please try again.' });
    }

    // Store pending payment
    await Payment.create({
      userId: req.user._id,
      plan,
      amount: orderPrice,
      upiTransactionId: order.id,
      paymentMethod: 'razorpay',
      razorpayOrderId: order.id,
      status: 'pending',
      ipAddress: req.ip,
      userAgent: (req.headers['user-agent'] || '').slice(0, 500),
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      customDays: orderDays,
      customModules: req.body.modules,
    });

    res.json({
      success: true,
      data: {
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        keyId: process.env.RAZORPAY_KEY_ID,
        name: 'DairyPro',
        description: `${orderLabel} Subscription`,
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

// ═══════════════════════════════════════════
//  VERIFY PAYMENT (Client-side callback)
// ═══════════════════════════════════════════
router.post('/verify-payment', auth, async (req, res, next) => {
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
      console.error(`⚠️ Invalid Razorpay signature: user=${req.user._id} order=${razorpay_order_id}`);
      return res.status(400).json({ success: false, message: 'Payment verification failed.' });
    }

    // Find the pending payment (idempotency: check if already verified)
    const payment = await Payment.findOne({ razorpayOrderId: razorpay_order_id, userId: req.user._id });
    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment record not found' });
    }

    // Idempotency: already verified
    if (payment.status === 'verified') {
      return res.json({ success: true, message: 'Payment already verified.', data: { plan: payment.plan, amount: payment.amount } });
    }

    // Double-verify with Razorpay API (server-to-server check)
    try {
      const razorpay = getRazorpay();
      const rzPayment = await razorpay.payments.fetch(razorpay_payment_id);
      if (rzPayment.status !== 'captured' && rzPayment.status !== 'authorized') {
        console.error(`⚠️ Razorpay payment not captured: status=${rzPayment.status} user=${req.user._id}`);
        return res.status(400).json({ success: false, message: `Payment status is ${rzPayment.status}. Please try again.` });
      }
      // Verify amount matches
      if (rzPayment.amount !== payment.amount * 100) {
        console.error(`⚠️ Amount mismatch: expected=${payment.amount * 100} got=${rzPayment.amount} user=${req.user._id}`);
        return res.status(400).json({ success: false, message: 'Payment amount mismatch.' });
      }
    } catch (fetchErr) {
      console.error('Razorpay fetch payment error:', fetchErr.message);
      // If fetch fails, still proceed with signature verification (it's cryptographically secure)
    }

    // Update payment
    payment.status = 'verified';
    payment.razorpayPaymentId = razorpay_payment_id;
    payment.razorpaySignature = razorpay_signature;
    payment.verifiedBy = req.user._id;
    payment.adminNote = 'Auto-verified via Razorpay';
    await payment.save();

    // Activate subscription
    const result = await activateSubscription(req.user._id, payment.plan, payment._id);

    console.log(`✅ Payment verified: user=${req.user._id} plan=${payment.plan} amount=₹${payment.amount} rzpay=${razorpay_payment_id}`);

    res.json({
      success: true,
      message: 'Payment successful! Subscription activated.',
      data: { plan: payment.plan, amount: payment.amount, endDate: result.endDate },
    });
  } catch (err) {
    console.error('Razorpay verify error:', err);
    next(err);
  }
});

// ═══════════════════════════════════════════
//  WEBHOOK (Server-to-server, no auth)
//  Most reliable: Razorpay calls this directly
// ═══════════════════════════════════════════
router.post('/webhook', async (req, res) => {
  try {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

    // Verify webhook signature
    if (webhookSecret) {
      const signature = req.headers['x-razorpay-signature'];
      if (!signature) {
        console.error('⚠️ Webhook: Missing signature header');
        return res.status(400).json({ status: 'error' });
      }

      const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
      const expectedSig = crypto.createHmac('sha256', webhookSecret).update(rawBody).digest('hex');

      if (expectedSig !== signature) {
        console.error('⚠️ Webhook: Invalid signature');
        return res.status(400).json({ status: 'error' });
      }
    }

    const event = req.body;
    const eventType = event?.event;

    console.log(`[WEBHOOK] Received: ${eventType}`);

    if (eventType === 'payment.captured' || eventType === 'order.paid') {
      const rzPayment = event.payload?.payment?.entity;
      const rzOrder = event.payload?.order?.entity || {};
      const orderId = rzPayment?.order_id || rzOrder?.id;
      const paymentId = rzPayment?.id;

      if (!orderId) {
        console.error('⚠️ Webhook: No order_id in payload');
        return res.json({ status: 'ok' });
      }

      // Find the payment
      const payment = await Payment.findOne({ razorpayOrderId: orderId });
      if (!payment) {
        console.error(`⚠️ Webhook: Payment not found for order=${orderId}`);
        return res.json({ status: 'ok' });
      }

      // Already verified (idempotent)
      if (payment.status === 'verified') {
        return res.json({ status: 'ok', message: 'Already processed' });
      }

      // Verify amount
      if (rzPayment?.amount && rzPayment.amount !== payment.amount * 100) {
        console.error(`⚠️ Webhook: Amount mismatch order=${orderId}`);
        payment.status = 'rejected';
        payment.adminNote = 'Webhook: Amount mismatch';
        await payment.save();
        return res.json({ status: 'ok' });
      }

      // Mark as verified
      payment.status = 'verified';
      payment.razorpayPaymentId = paymentId;
      payment.adminNote = 'Auto-verified via Razorpay Webhook';
      await payment.save();

      // Activate subscription
      await activateSubscription(payment.userId, payment.plan, payment._id);

      console.log(`✅ Webhook: Subscription activated user=${payment.userId} plan=${payment.plan} amount=₹${payment.amount}`);
    }

    if (eventType === 'payment.failed') {
      const rzPayment = event.payload?.payment?.entity;
      const orderId = rzPayment?.order_id;
      if (orderId) {
        await Payment.findOneAndUpdate(
          { razorpayOrderId: orderId, status: 'pending' },
          { status: 'rejected', adminNote: `Payment failed: ${rzPayment?.error_description || 'Unknown error'}` }
        );
        console.log(`❌ Webhook: Payment failed order=${orderId}`);
      }
    }

    res.json({ status: 'ok' });
  } catch (err) {
    console.error('Webhook error:', err);
    res.status(500).json({ status: 'error' });
  }
});

// ═══════════════════════════════════════════
//  PAYMENT HISTORY (Authenticated)
// ═══════════════════════════════════════════
router.get('/my-payments', auth, async (req, res, next) => {
  try {
    const payments = await Payment.find({ userId: req.user._id })
      .sort('-createdAt')
      .limit(20)
      .lean();
    res.json({ success: true, data: payments });
  } catch (err) { next(err); }
});

export default router;
