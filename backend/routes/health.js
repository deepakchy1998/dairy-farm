import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import { checkSubscription } from '../middleware/subscription.js';
import HealthRecord from '../models/HealthRecord.js';
import { paginate, dateFilter, logActivity } from '../utils/helpers.js';

const router = Router();
router.use(auth, checkSubscription);

// List
router.get('/', async (req, res, next) => {
  try {
    const farmId = req.user.farmId;
    const { type, cattleId, startDate, endDate, page, limit } = req.query;
    const filter = { farmId, ...dateFilter(startDate, endDate) };
    if (type) filter.type = type;
    if (cattleId) filter.cattleId = cattleId;
    const p = paginate(page, limit);
    const [data, total] = await Promise.all([
      HealthRecord.find(filter).populate('cattleId', 'tagNumber breed').sort('-date').skip(p.skip).limit(p.limit),
      HealthRecord.countDocuments(filter),
    ]);
    res.json({ success: true, data, pagination: { page: p.page, pages: Math.ceil(total / p.limit), total } });
  } catch (err) { next(err); }
});

// Upcoming
router.get('/upcoming', async (req, res, next) => {
  try {
    const days = parseInt(req.query.days) || 7;
    const future = new Date(); future.setDate(future.getDate() + days);
    const data = await HealthRecord.find({
      farmId: req.user.farmId,
      nextDueDate: { $gte: new Date(), $lte: future },
    }).populate('cattleId', 'tagNumber breed').sort('nextDueDate').limit(20);
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

// Create
router.post('/', async (req, res, next) => {
  try {
    const record = await HealthRecord.create({ ...req.body, farmId: req.user.farmId });
    await logActivity(req.user.farmId, 'health', '💉', `${record.type} recorded: ${record.description}`);
    res.status(201).json({ success: true, data: record });
  } catch (err) { next(err); }
});

// Update
router.put('/:id', async (req, res, next) => {
  try {
    const record = await HealthRecord.findOneAndUpdate(
      { _id: req.params.id, farmId: req.user.farmId }, req.body, { new: true, runValidators: true }
    );
    if (!record) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: record });
  } catch (err) { next(err); }
});

// Delete
router.delete('/:id', async (req, res, next) => {
  try {
    const record = await HealthRecord.findOneAndDelete({ _id: req.params.id, farmId: req.user.farmId });
    if (!record) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, message: 'Deleted' });
  } catch (err) { next(err); }
});

export default router;
