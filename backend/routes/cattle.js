import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import { checkSubscription } from '../middleware/subscription.js';
import Cattle from '../models/Cattle.js';
import MilkRecord from '../models/MilkRecord.js';
import HealthRecord from '../models/HealthRecord.js';
import BreedingRecord from '../models/BreedingRecord.js';
import { paginate } from '../utils/helpers.js';

const router = Router();
router.use(auth, checkSubscription);

// List cattle
router.get('/', async (req, res, next) => {
  try {
    const farmId = req.user.farmId;
    const { search, category, status, gender, page, limit } = req.query;
    const filter = { farmId };
    if (category) filter.category = category;
    if (status) filter.status = status;
    else filter.status = 'active'; // default to active
    if (gender) filter.gender = gender;
    if (search) {
      filter.$or = [
        { tagNumber: { $regex: search, $options: 'i' } },
        { breed: { $regex: search, $options: 'i' } },
      ];
    }
    const p = paginate(page, limit);
    const [data, total] = await Promise.all([
      Cattle.find(filter).sort('-createdAt').skip(p.skip).limit(p.limit).lean(),
      Cattle.countDocuments(filter),
    ]);
    res.json({ success: true, data, pagination: { page: p.page, pages: Math.ceil(total / p.limit), total } });
  } catch (err) { next(err); }
});

// Analytics - cattle IDs with milk records
router.get('/analytics', async (req, res, next) => {
  try {
    const data = await MilkRecord.aggregate([
      { $match: { farmId: req.user.farmId } },
      { $group: { _id: '$cattleId' } },
    ]);
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

// Single cattle
router.get('/:id', async (req, res, next) => {
  try {
    const cattle = await Cattle.findOne({ _id: req.params.id, farmId: req.user.farmId });
    if (!cattle) return res.status(404).json({ success: false, message: 'Cattle not found' });
    
    // Get related records
    const [milkRecords, healthRecords, breedingRecords] = await Promise.all([
      MilkRecord.find({ cattleId: cattle._id }).sort('-date').limit(30),
      HealthRecord.find({ cattleId: cattle._id }).sort('-date').limit(20),
      BreedingRecord.find({ cattleId: cattle._id }).sort('-breedingDate').limit(10),
    ]);
    
    res.json({ success: true, data: { ...cattle.toObject(), milkRecords, healthRecords, breedingRecords } });
  } catch (err) { next(err); }
});

// Create cattle
router.post('/', async (req, res, next) => {
  try {
    const farmId = req.user.farmId;
    const exists = await Cattle.findOne({ farmId, tagNumber: req.body.tagNumber });
    if (exists) return res.status(400).json({ success: false, message: 'Tag number already exists in your farm' });
    const cattle = await Cattle.create({ ...req.body, farmId });
    res.status(201).json({ success: true, data: cattle });
  } catch (err) { next(err); }
});

// Update cattle
router.put('/:id', async (req, res, next) => {
  try {
    const cattle = await Cattle.findOneAndUpdate(
      { _id: req.params.id, farmId: req.user.farmId },
      req.body,
      { new: true, runValidators: true }
    );
    if (!cattle) return res.status(404).json({ success: false, message: 'Cattle not found' });
    res.json({ success: true, data: cattle });
  } catch (err) { next(err); }
});

// Delete cattle
router.delete('/:id', async (req, res, next) => {
  try {
    const cattle = await Cattle.findOneAndDelete({ _id: req.params.id, farmId: req.user.farmId });
    if (!cattle) return res.status(404).json({ success: false, message: 'Cattle not found' });
    res.json({ success: true, message: 'Cattle deleted' });
  } catch (err) { next(err); }
});

export default router;
