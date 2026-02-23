import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import { checkSubscription } from '../middleware/subscription.js';
import Revenue from '../models/Revenue.js';
import Expense from '../models/Expense.js';
import MilkRecord from '../models/MilkRecord.js';
import Cattle from '../models/Cattle.js';

const router = Router();
router.use(auth, checkSubscription);

// Profit & Loss
router.get('/profit-loss', async (req, res, next) => {
  try {
    const farmId = req.user.farmId;
    const months = parseInt(req.query.months) || 6;
    const start = new Date();
    start.setMonth(start.getMonth() - months);
    start.setDate(1); start.setHours(0, 0, 0, 0);

    const [revenue, expense] = await Promise.all([
      Revenue.aggregate([
        { $match: { farmId, date: { $gte: start } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$date' } }, total: { $sum: '$amount' } } },
        { $sort: { _id: 1 } },
      ]),
      Expense.aggregate([
        { $match: { farmId, date: { $gte: start } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$date' } }, total: { $sum: '$amount' } } },
        { $sort: { _id: 1 } },
      ]),
    ]);

    const totalRevenue = revenue.reduce((s, r) => s + r.total, 0);
    const totalExpense = expense.reduce((s, r) => s + r.total, 0);
    res.json({ success: true, data: { revenue, expense, totalRevenue, totalExpense, netProfit: totalRevenue - totalExpense } });
  } catch (err) { next(err); }
});

// Milk analytics
router.get('/milk-analytics', async (req, res, next) => {
  try {
    const farmId = req.user.farmId;
    const months = parseInt(req.query.months) || 6;
    const start = new Date();
    start.setMonth(start.getMonth() - months);
    start.setDate(1); start.setHours(0, 0, 0, 0);

    const [monthly, topCattle] = await Promise.all([
      MilkRecord.aggregate([
        { $match: { farmId, date: { $gte: start } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$date' } }, total: { $sum: '$totalYield' } } },
        { $sort: { _id: 1 } },
      ]),
      MilkRecord.aggregate([
        { $match: { farmId, date: { $gte: start } } },
        { $group: { _id: '$cattleId', total: { $sum: '$totalYield' }, count: { $sum: 1 } } },
        { $addFields: { avg: { $divide: ['$total', '$count'] } } },
        { $sort: { total: -1 } },
        { $limit: 10 },
        { $lookup: { from: 'cattles', localField: '_id', foreignField: '_id', as: 'cattle' } },
        { $unwind: '$cattle' },
      ]),
    ]);

    res.json({ success: true, data: { monthly, topCattle } });
  } catch (err) { next(err); }
});

// Cattle analytics
router.get('/cattle-analytics', async (req, res, next) => {
  try {
    const farmId = req.user.farmId;
    const [byCategory, byBreed, byGender, byStatus] = await Promise.all([
      Cattle.aggregate([{ $match: { farmId, status: 'active' } }, { $group: { _id: '$category', count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
      Cattle.aggregate([{ $match: { farmId, status: 'active' } }, { $group: { _id: '$breed', count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
      Cattle.aggregate([{ $match: { farmId, status: 'active' } }, { $group: { _id: '$gender', count: { $sum: 1 } } }]),
      Cattle.aggregate([{ $match: { farmId } }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    ]);
    res.json({ success: true, data: { byCategory, byBreed, byGender, byStatus } });
  } catch (err) { next(err); }
});

// Expense breakdown
router.get('/expense-breakdown', async (req, res, next) => {
  try {
    const farmId = req.user.farmId;
    const months = parseInt(req.query.months) || 6;
    const start = new Date();
    start.setMonth(start.getMonth() - months);
    start.setDate(1); start.setHours(0, 0, 0, 0);

    const byCategory = await Expense.aggregate([
      { $match: { farmId, date: { $gte: start } } },
      { $group: { _id: '$category', total: { $sum: '$amount' }, count: { $sum: 1 } } },
      { $sort: { total: -1 } },
    ]);
    res.json({ success: true, data: { byCategory } });
  } catch (err) { next(err); }
});

export default router;
