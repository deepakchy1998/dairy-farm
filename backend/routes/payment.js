import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import Payment from '../models/Payment.js';

const router = Router();
router.use(auth);

// Payment history (legacy + razorpay combined)
router.get('/my', async (req, res, next) => {
  try {
    const payments = await Payment.find({ userId: req.user._id })
      .sort('-createdAt')
      .limit(20)
      .lean();
    res.json({ success: true, data: payments });
  } catch (err) { next(err); }
});

export default router;
