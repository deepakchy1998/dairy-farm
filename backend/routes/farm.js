import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import { checkSubscription } from '../middleware/subscription.js';
import Farm from '../models/Farm.js';
import Cattle from '../models/Cattle.js';
import MilkRecord from '../models/MilkRecord.js';
import Revenue from '../models/Revenue.js';
import Expense from '../models/Expense.js';
import HealthRecord from '../models/HealthRecord.js';
import BreedingRecord from '../models/BreedingRecord.js';
import { dateFilter } from '../utils/helpers.js';

const router = Router();
router.use(auth);

// Get farm
router.get('/', async (req, res, next) => {
  try {
    const farm = await Farm.findById(req.user.farmId);
    if (!farm) return res.status(404).json({ success: false, message: 'Farm not found' });
    const totalCattle = await Cattle.countDocuments({ farmId: farm._id, status: 'active' });
    res.json({ success: true, data: { ...farm.toObject(), totalCattle } });
  } catch (err) { next(err); }
});

// Update farm
router.put('/', async (req, res, next) => {
  try {
    const { name, address, city, state, phone, description } = req.body;
    const farm = await Farm.findByIdAndUpdate(req.user.farmId, { name, address, city, state, phone, description }, { new: true });
    const totalCattle = await Cattle.countDocuments({ farmId: farm._id, status: 'active' });
    res.json({ success: true, data: { ...farm.toObject(), totalCattle } });
  } catch (err) { next(err); }
});

// Dashboard
router.get('/dashboard', checkSubscription, async (req, res, next) => {
  try {
    const farmId = req.user.farmId;
    const { startDate, endDate } = req.query;
    const dFilter = dateFilter(startDate, endDate);

    // Total cattle
    const totalCattle = await Cattle.countDocuments({ farmId, status: 'active' });

    // Cattle by category
    const cattleByCatArr = await Cattle.aggregate([
      { $match: { farmId, status: 'active' } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
    ]);
    const cattleByCategory = {};
    cattleByCatArr.forEach(c => { cattleByCategory[c._id] = c.count; });

    // Today's milk
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const todayMilkAgg = await MilkRecord.aggregate([
      { $match: { farmId, date: { $gte: today, $lt: tomorrow } } },
      { $group: { _id: null, total: { $sum: '$totalYield' }, morning: { $sum: '$morningYield' }, evening: { $sum: '$eveningYield' } } },
    ]);
    const todayMilk = todayMilkAgg[0] || { total: 0, morning: 0, evening: 0 };

    // Revenue & expense for period
    const revAgg = await Revenue.aggregate([
      { $match: { farmId, ...dFilter } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);
    const expAgg = await Expense.aggregate([
      { $match: { farmId, ...dFilter } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);
    const monthlyRevenue = revAgg[0]?.total || 0;
    const totalExpense = expAgg[0]?.total || 0;
    const profit = monthlyRevenue - totalExpense;

    // Milk trend (daily)
    const milkTrend = await MilkRecord.aggregate([
      { $match: { farmId, ...dFilter } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } }, total: { $sum: '$totalYield' } } },
      { $sort: { _id: 1 } },
    ]);

    // Top cattle
    const topCattle = await MilkRecord.aggregate([
      { $match: { farmId, ...dFilter } },
      { $group: { _id: '$cattleId', totalYield: { $sum: '$totalYield' } } },
      { $sort: { totalYield: -1 } },
      { $limit: 5 },
      { $lookup: { from: 'cattles', localField: '_id', foreignField: '_id', as: 'cattle' } },
      { $unwind: '$cattle' },
    ]);

    // Expense breakdown
    const expenseBreakdown = await Expense.aggregate([
      { $match: { farmId, ...dFilter } },
      { $group: { _id: '$category', total: { $sum: '$amount' } } },
      { $sort: { total: -1 } },
    ]);

    // Upcoming vaccinations (7 days)
    const weekFromNow = new Date();
    weekFromNow.setDate(weekFromNow.getDate() + 7);
    const upcomingVaccinations = await HealthRecord.find({
      farmId, nextDueDate: { $gte: new Date(), $lte: weekFromNow },
    }).populate('cattleId', 'tagNumber breed').sort('nextDueDate').limit(10);

    // Expected deliveries (30 days)
    const monthFromNow = new Date();
    monthFromNow.setDate(monthFromNow.getDate() + 30);
    const expectedDeliveries = await BreedingRecord.find({
      farmId, status: { $in: ['bred', 'confirmed'] },
      expectedDelivery: { $gte: new Date(), $lte: monthFromNow },
    }).populate('cattleId', 'tagNumber breed').sort('expectedDelivery');

    res.json({
      success: true,
      data: {
        totalCattle, todayMilk, monthlyRevenue, totalExpense: totalExpense, profit,
        cattleByCategory, milkTrend, topCattle, expenseBreakdown,
        upcomingVaccinations, expectedDeliveries,
      },
    });
  } catch (err) { next(err); }
});

export default router;
