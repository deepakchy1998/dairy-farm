import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import { checkSubscription } from '../middleware/subscription.js';
import FeedRecord from '../models/FeedRecord.js';
import { paginate, dateFilter, logActivity } from '../utils/helpers.js';

const router = Router();
router.use(auth, checkSubscription);

router.get('/', async (req, res, next) => {
  try {
    const farmId = req.user.farmId;
    const { feedType, startDate, endDate, page, limit } = req.query;
    const filter = { farmId, ...dateFilter(startDate, endDate) };
    if (feedType) filter.feedType = { $regex: feedType, $options: 'i' };
    const p = paginate(page, limit);
    const [data, total] = await Promise.all([
      FeedRecord.find(filter).sort('-date').skip(p.skip).limit(p.limit),
      FeedRecord.countDocuments(filter),
    ]);
    res.json({ success: true, data, pagination: { page: p.page, pages: Math.ceil(total / p.limit), total } });
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const record = await FeedRecord.create({ ...req.body, farmId: req.user.farmId });
    await logActivity(req.user.farmId, 'expense', '🌾', `Feed: ${record.feedType} — ${record.quantity} ${record.unit}`);
    res.status(201).json({ success: true, data: record });
  } catch (err) { next(err); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const record = await FeedRecord.findOneAndUpdate({ _id: req.params.id, farmId: req.user.farmId }, req.body, { new: true, runValidators: true });
    if (!record) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: record });
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const record = await FeedRecord.findOneAndDelete({ _id: req.params.id, farmId: req.user.farmId });
    if (!record) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, message: 'Deleted' });
  } catch (err) { next(err); }
});

export default router;
