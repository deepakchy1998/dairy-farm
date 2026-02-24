import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import { checkSubscription } from '../middleware/subscription.js';
import Insurance from '../models/Insurance.js';
import { paginate, logActivity } from '../utils/helpers.js';

const router = Router();
router.use(auth, checkSubscription);

// List insurance records
router.get('/', async (req, res, next) => {
  try {
    const { cattleId, status, page, limit } = req.query;
    const filter = { farmId: req.user.farmId };
    if (cattleId) filter.cattleId = cattleId;
    if (status) filter.status = status;

    const p = paginate(page, limit);
    const [data, total] = await Promise.all([
      Insurance.find(filter).populate('cattleId', 'tagNumber breed').sort('-endDate').skip(p.skip).limit(p.limit).lean(),
      Insurance.countDocuments(filter),
    ]);

    res.json({ success: true, data, pagination: { page: p.page, pages: Math.ceil(total / p.limit), total } });
  } catch (err) { next(err); }
});

// Create
router.post('/', async (req, res, next) => {
  try {
    const data = await Insurance.create({ ...req.body, farmId: req.user.farmId });
    await logActivity(req.user.farmId, 'insurance', '🛡️', `Insurance added for cattle`);
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
});

// Update
router.put('/:id', async (req, res, next) => {
  try {
    const data = await Insurance.findOneAndUpdate(
      { _id: req.params.id, farmId: req.user.farmId },
      req.body,
      { new: true, runValidators: true }
    );
    if (!data) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

// Delete
router.delete('/:id', async (req, res, next) => {
  try {
    const data = await Insurance.findOneAndDelete({ _id: req.params.id, farmId: req.user.farmId });
    if (!data) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, message: 'Deleted' });
  } catch (err) { next(err); }
});

export default router;
