import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import ContactMessage from '../models/ContactMessage.js';

const router = Router();

// User submits support request (auth protected)
router.post('/', auth, async (req, res, next) => {
  try {
    const { subject, message } = req.body;
    if (!subject || !message) {
      return res.status(400).json({ success: false, message: 'Subject and message are required' });
    }
    const contact = await ContactMessage.create({
      userId: req.user._id,
      farmId: req.user.farmId || undefined,
      name: req.user.name,
      email: req.user.email,
      subject,
      message,
    });
    res.status(201).json({ success: true, data: contact, message: 'Support request submitted successfully' });
  } catch (err) { next(err); }
});

// User can view their own support messages
router.get('/my', auth, async (req, res, next) => {
  try {
    const messages = await ContactMessage.find({ userId: req.user._id }).sort('-createdAt').limit(50).lean();
    res.json({ success: true, data: messages });
  } catch (err) { next(err); }
});

export default router;
