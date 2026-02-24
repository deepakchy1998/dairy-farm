import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import { checkSubscription } from '../middleware/subscription.js';
import Expense from '../models/Expense.js';
import { paginate, dateFilter, logActivity } from '../utils/helpers.js';

const router = Router();
router.use(auth, checkSubscription);

router.get('/', async (req, res, next) => {
  try {
    const farmId = req.user.farmId;
    const { category, startDate, endDate, page, limit } = req.query;
    const filter = { farmId, ...dateFilter(startDate, endDate) };
    if (category) filter.category = category;
    const p = paginate(page, limit);
    const [data, total] = await Promise.all([
      Expense.find(filter).sort('-date').skip(p.skip).limit(p.limit).lean(),
      Expense.countDocuments(filter),
    ]);
    res.json({ success: true, data, pagination: { page: p.page, pages: Math.ceil(total / p.limit), total } });
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const record = await Expense.create({ ...req.body, farmId: req.user.farmId });
    await logActivity(req.user.farmId, 'expense', '💸', `Expense: ${record.category} — ₹${record.amount}`);
    res.status(201).json({ success: true, data: record });
  } catch (err) { next(err); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const record = await Expense.findOneAndUpdate({ _id: req.params.id, farmId: req.user.farmId }, req.body, { new: true, runValidators: true });
    if (!record) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: record });
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const record = await Expense.findOneAndDelete({ _id: req.params.id, farmId: req.user.farmId });
    if (!record) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, message: 'Deleted' });
  } catch (err) { next(err); }
});

export default router;
