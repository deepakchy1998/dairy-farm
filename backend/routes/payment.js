import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import Payment from '../models/Payment.js';
import LandingContent from '../models/LandingContent.js';

const router = Router();
router.use(auth);

const PLAN_PRICES = { monthly: 499, quarterly: 1299, halfyearly: 2499, yearly: 4499 };

// Create payment
router.post('/', async (req, res, next) => {
  try {
    const { plan, upiTransactionId } = req.body;
    if (!plan || !upiTransactionId) return res.status(400).json({ success: false, message: 'Plan and transaction ID required' });
    
    const content = await LandingContent.findOne();
    const amount = content?.pricing?.[plan] || PLAN_PRICES[plan];
    if (!amount) return res.status(400).json({ success: false, message: 'Invalid plan' });

    const payment = await Payment.create({ userId: req.user._id, plan, amount, upiTransactionId });
    res.status(201).json({ success: true, data: payment });
  } catch (err) { next(err); }
});

// My payments
router.get('/my', async (req, res, next) => {
  try {
    const data = await Payment.find({ userId: req.user._id }).sort('-createdAt');
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

export default router;
