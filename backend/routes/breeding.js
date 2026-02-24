import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import { checkSubscription } from '../middleware/subscription.js';
import BreedingRecord from '../models/BreedingRecord.js';
import Cattle from '../models/Cattle.js';
import { paginate, dateFilter, logActivity } from '../utils/helpers.js';

const router = Router();
router.use(auth, checkSubscription);

// GET /api/breeding/heat-calendar — Upcoming heat predictions
router.get('/heat-calendar', async (req, res, next) => {
  try {
    const farmId = req.user.farmId;
    const femaleCattle = await Cattle.find({
      farmId, status: 'active', gender: 'female',
      category: { $nin: ['pregnant', 'calf'] },
    }).lean();

    const predictions = [];
    for (const cow of femaleCattle) {
      const lastBreeding = await BreedingRecord.findOne({ farmId, cattleId: cow._id }).sort('-breedingDate').lean();
      let lastHeatDate = lastBreeding?.breedingDate || cow.lastCalvingDate;
      if (!lastHeatDate) continue;

      const now = new Date();
      let nextHeat = new Date(lastHeatDate);
      while (nextHeat < now) {
        nextHeat = new Date(nextHeat.getTime() + 21 * 86400000);
      }

      predictions.push({
        cattleId: cow._id, tagNumber: cow.tagNumber, breed: cow.breed, category: cow.category,
        lastHeatDate: new Date(nextHeat.getTime() - 21 * 86400000),
        predictedNextHeat: nextHeat,
        breedingWindow: { start: nextHeat, end: new Date(nextHeat.getTime() + 18 * 3600000) },
        daysUntilHeat: Math.ceil((nextHeat - now) / 86400000),
      });
    }

    predictions.sort((a, b) => a.daysUntilHeat - b.daysUntilHeat);
    res.json({ success: true, data: predictions });
  } catch (err) { next(err); }
});

// List
router.get('/', async (req, res, next) => {
  try {
    const farmId = req.user.farmId;
    const { cattleId, status, startDate, endDate, page, limit } = req.query;
    const filter = { farmId, ...dateFilter(startDate, endDate, 'breedingDate') };
    if (cattleId) filter.cattleId = cattleId;
    if (status) filter.status = status;
    const p = paginate(page, limit);
    const [data, total] = await Promise.all([
      BreedingRecord.find(filter).populate('cattleId', 'tagNumber breed').sort('-breedingDate').skip(p.skip).limit(p.limit).lean(),
      BreedingRecord.countDocuments(filter),
    ]);
    res.json({ success: true, data, pagination: { page: p.page, pages: Math.ceil(total / p.limit), total } });
  } catch (err) { next(err); }
});

// Create
router.post('/', async (req, res, next) => {
  try {
    const body = { ...req.body, farmId: req.user.farmId };
    if (!body.expectedDelivery && body.breedingDate) {
      const d = new Date(body.breedingDate);
      d.setDate(d.getDate() + 280);
      body.expectedDelivery = d;
    }
    const record = await BreedingRecord.create(body);
    await logActivity(req.user.farmId, 'breeding', '🐣', `Breeding recorded: ${record.method} insemination`);
    res.status(201).json({ success: true, data: record });
  } catch (err) { next(err); }
});

// Update
router.put('/:id', async (req, res, next) => {
  try {
    const record = await BreedingRecord.findOneAndUpdate(
      { _id: req.params.id, farmId: req.user.farmId }, req.body, { new: true, runValidators: true }
    );
    if (!record) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: record });
  } catch (err) { next(err); }
});

// Delete
router.delete('/:id', async (req, res, next) => {
  try {
    const record = await BreedingRecord.findOneAndDelete({ _id: req.params.id, farmId: req.user.farmId });
    if (!record) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, message: 'Deleted' });
  } catch (err) { next(err); }
});

export default router;
