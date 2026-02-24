import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import { checkSubscription } from '../middleware/subscription.js';
import Cattle from '../models/Cattle.js';
import MilkRecord from '../models/MilkRecord.js';
import HealthRecord from '../models/HealthRecord.js';
import BreedingRecord from '../models/BreedingRecord.js';
import { paginate, logActivity } from '../utils/helpers.js';

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
    // Auto-increment lactation number when lastCalvingDate is set
    if (req.body.lastCalvingDate) {
      const existing = await Cattle.findOne({ _id: req.params.id, farmId: req.user.farmId });
      if (existing && (!existing.lastCalvingDate || new Date(req.body.lastCalvingDate).getTime() !== new Date(existing.lastCalvingDate).getTime())) {
        req.body.lactationNumber = (existing.lactationNumber || 0) + 1;
      }
    }
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

// GET /api/cattle/:id/lactation — Get lactation info
router.get('/:id/lactation', async (req, res, next) => {
  try {
    const cattle = await Cattle.findOne({ _id: req.params.id, farmId: req.user.farmId }).lean();
    if (!cattle) return res.status(404).json({ success: false, message: 'Cattle not found' });

    let dim = null;
    if (cattle.lastCalvingDate && cattle.category === 'milking') {
      dim = Math.floor((Date.now() - new Date(cattle.lastCalvingDate)) / 86400000);
    }

    const milkQuery = cattle.lastCalvingDate
      ? { farmId: req.user.farmId, cattleId: cattle._id, date: { $gte: cattle.lastCalvingDate } }
      : { farmId: req.user.farmId, cattleId: cattle._id };

    const milkRecords = await MilkRecord.find(milkQuery).sort('date').lean();

    const weeklyAvg = [];
    if (milkRecords.length > 0 && cattle.lastCalvingDate) {
      const startDate = new Date(cattle.lastCalvingDate);
      const weeks = {};
      milkRecords.forEach(r => {
        const weekNum = Math.floor((new Date(r.date) - startDate) / (7 * 86400000));
        if (!weeks[weekNum]) weeks[weekNum] = { total: 0, count: 0 };
        weeks[weekNum].total += r.totalYield;
        weeks[weekNum].count++;
      });
      for (const [week, data] of Object.entries(weeks)) {
        weeklyAvg.push({ week: parseInt(week) + 1, avg: +(data.total / data.count).toFixed(1) });
      }
    }

    const predictedDryOff = cattle.lastCalvingDate
      ? new Date(new Date(cattle.lastCalvingDate).getTime() + 305 * 86400000)
      : null;

    res.json({
      success: true,
      data: {
        lactationNumber: cattle.lactationNumber || 0,
        lastCalvingDate: cattle.lastCalvingDate,
        dim,
        predictedDryOff,
        dryOffDate: cattle.dryOffDate,
        expectedDryDate: cattle.expectedDryDate,
        totalMilkThisLactation: milkRecords.reduce((s, r) => s + r.totalYield, 0),
        avgDailyYield: milkRecords.length > 0 ? +(milkRecords.reduce((s, r) => s + r.totalYield, 0) / milkRecords.length).toFixed(1) : 0,
        lactationCurve: weeklyAvg.sort((a, b) => a.week - b.week),
      },
    });
  } catch (err) { next(err); }
});

// POST /api/cattle/:id/weight — Add weight entry
router.post('/:id/weight', async (req, res, next) => {
  try {
    const { date, weight, notes } = req.body;
    if (!date || !weight) return res.status(400).json({ success: false, message: 'Date and weight required' });
    
    const cattle = await Cattle.findOneAndUpdate(
      { _id: req.params.id, farmId: req.user.farmId },
      { 
        $push: { weightHistory: { date, weight, notes } },
        $set: { weight: weight }
      },
      { new: true }
    );
    if (!cattle) return res.status(404).json({ success: false, message: 'Not found' });
    
    await logActivity(req.user.farmId, 'cattle', '⚖️', `Weight recorded: ${weight}kg for Tag ${cattle.tagNumber}`);
    res.json({ success: true, data: cattle });
  } catch (err) { next(err); }
});

// GET /api/cattle/:id/weight — Get weight history
router.get('/:id/weight', async (req, res, next) => {
  try {
    const cattle = await Cattle.findOne({ _id: req.params.id, farmId: req.user.farmId }).select('weightHistory tagNumber').lean();
    if (!cattle) return res.status(404).json({ success: false, message: 'Not found' });
    
    const sorted = (cattle.weightHistory || []).sort((a, b) => new Date(b.date) - new Date(a.date));
    res.json({ success: true, data: sorted });
  } catch (err) { next(err); }
});

export default router;
