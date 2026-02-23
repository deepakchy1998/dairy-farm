import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import Activity from '../models/Activity.js';

const router = Router();
router.use(auth);

router.get('/recent', async (req, res, next) => {
  try {
    const since = new Date();
    since.setHours(since.getHours() - 48);
    const data = await Activity.find({ farmId: req.user.farmId, timestamp: { $gte: since } })
      .sort('-timestamp').limit(20);
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

export default router;
