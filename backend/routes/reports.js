import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import { checkSubscription } from '../middleware/subscription.js';
import Revenue from '../models/Revenue.js';
import Expense from '../models/Expense.js';
import MilkRecord from '../models/MilkRecord.js';
import Cattle from '../models/Cattle.js';
import HealthRecord from '../models/HealthRecord.js';
import BreedingRecord from '../models/BreedingRecord.js';
import Employee from '../models/Employee.js';
import Attendance from '../models/Attendance.js';
import SalaryPayment from '../models/SalaryPayment.js';
import FeedRecord from '../models/FeedRecord.js';
import Customer from '../models/Customer.js';
import MilkDelivery from '../models/MilkDelivery.js';
import CustomerPayment from '../models/CustomerPayment.js';

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

// Milk quality & session analytics
router.get('/milk-quality', async (req, res, next) => {
  try {
    const farmId = req.user.farmId;
    const months = parseInt(req.query.months) || 6;
    const start = new Date();
    start.setMonth(start.getMonth() - months);
    start.setDate(1); start.setHours(0, 0, 0, 0);

    const [avgFatSNF, sessionWise, dailyTrend] = await Promise.all([
      // Monthly avg fat & SNF
      MilkRecord.aggregate([
        { $match: { farmId, date: { $gte: start } } },
        { $group: {
          _id: { $dateToString: { format: '%Y-%m', date: '$date' } },
          avgFat: { $avg: '$avgFat' },
          avgSNF: { $avg: '$avgSNF' },
          totalYield: { $sum: '$totalYield' },
          records: { $sum: 1 },
        }},
        { $sort: { _id: 1 } },
      ]),
      // Session-wise production
      MilkRecord.aggregate([
        { $match: { farmId, date: { $gte: start } } },
        { $group: {
          _id: null,
          morning: { $sum: '$morningYield' },
          afternoon: { $sum: { $ifNull: ['$afternoonYield', 0] } },
          evening: { $sum: '$eveningYield' },
        }},
      ]),
      // Daily production last 30 days
      MilkRecord.aggregate([
        { $match: { farmId, date: { $gte: new Date(Date.now() - 30 * 86400000) } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } }, total: { $sum: '$totalYield' }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
    ]);

    res.json({ success: true, data: { avgFatSNF, sessionWise: sessionWise[0] || {}, dailyTrend } });
  } catch (err) { next(err); }
});

// Health analytics
router.get('/health-analytics', async (req, res, next) => {
  try {
    const farmId = req.user.farmId;
    const months = parseInt(req.query.months) || 6;
    const start = new Date();
    start.setMonth(start.getMonth() - months);
    start.setDate(1); start.setHours(0, 0, 0, 0);

    const [byType, monthlyHealth, totalCost, upcomingDue] = await Promise.all([
      HealthRecord.aggregate([
        { $match: { farmId, date: { $gte: start } } },
        { $group: { _id: '$type', count: { $sum: 1 }, totalCost: { $sum: { $ifNull: ['$cost', 0] } } } },
        { $sort: { count: -1 } },
      ]),
      HealthRecord.aggregate([
        { $match: { farmId, date: { $gte: start } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$date' } }, count: { $sum: 1 }, cost: { $sum: { $ifNull: ['$cost', 0] } } } },
        { $sort: { _id: 1 } },
      ]),
      HealthRecord.aggregate([
        { $match: { farmId, date: { $gte: start } } },
        { $group: { _id: null, total: { $sum: { $ifNull: ['$cost', 0] } } } },
      ]),
      HealthRecord.countDocuments({ farmId, nextDueDate: { $gte: new Date(), $lte: new Date(Date.now() + 30 * 86400000) } }),
    ]);

    res.json({ success: true, data: { byType, monthlyHealth, totalCost: totalCost[0]?.total || 0, upcomingDue } });
  } catch (err) { next(err); }
});

// Employee & attendance analytics
router.get('/employee-analytics', async (req, res, next) => {
  try {
    const farmId = req.user.farmId;
    const months = parseInt(req.query.months) || 6;
    const start = new Date();
    start.setMonth(start.getMonth() - months);
    start.setDate(1); start.setHours(0, 0, 0, 0);

    const [totalEmployees, byRole, attendanceSummary, monthlySalary, totalSalaryPaid] = await Promise.all([
      Employee.countDocuments({ farmId, status: 'active' }),
      Employee.aggregate([
        { $match: { farmId, status: 'active' } },
        { $group: { _id: '$role', count: { $sum: 1 }, totalSalary: { $sum: '$monthlySalary' } } },
        { $sort: { count: -1 } },
      ]),
      Attendance.aggregate([
        { $match: { farmId, date: { $gte: start } } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      SalaryPayment.aggregate([
        { $match: { farmId, createdAt: { $gte: start } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } }, total: { $sum: '$paidAmount' }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
      SalaryPayment.aggregate([
        { $match: { farmId, createdAt: { $gte: start } } },
        { $group: { _id: null, total: { $sum: '$paidAmount' } } },
      ]),
    ]);

    res.json({ success: true, data: { totalEmployees, byRole, attendanceSummary, monthlySalary, totalSalaryPaid: totalSalaryPaid[0]?.total || 0 } });
  } catch (err) { next(err); }
});

// Feed analytics
router.get('/feed-analytics', async (req, res, next) => {
  try {
    const farmId = req.user.farmId;
    const months = parseInt(req.query.months) || 6;
    const start = new Date();
    start.setMonth(start.getMonth() - months);
    start.setDate(1); start.setHours(0, 0, 0, 0);

    const [byType, monthlyFeed] = await Promise.all([
      FeedRecord.aggregate([
        { $match: { farmId, date: { $gte: start } } },
        { $group: { _id: '$feedType', totalQty: { $sum: '$quantity' }, totalCost: { $sum: { $ifNull: ['$cost', 0] } }, count: { $sum: 1 } } },
        { $sort: { totalCost: -1 } },
      ]),
      FeedRecord.aggregate([
        { $match: { farmId, date: { $gte: start } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$date' } }, totalCost: { $sum: { $ifNull: ['$cost', 0] } }, totalQty: { $sum: '$quantity' } } },
        { $sort: { _id: 1 } },
      ]),
    ]);

    res.json({ success: true, data: { byType, monthlyFeed } });
  } catch (err) { next(err); }
});

// Dudh Khata (customer) analytics
router.get('/customer-analytics', async (req, res, next) => {
  try {
    const farmId = req.user.farmId;
    const months = parseInt(req.query.months) || 6;
    const start = new Date();
    start.setMonth(start.getMonth() - months);
    start.setDate(1); start.setHours(0, 0, 0, 0);

    const [totalCustomers, monthlyDelivery, topCustomers, totalDelivered, totalPaid] = await Promise.all([
      Customer.countDocuments({ farmId, status: 'active' }),
      MilkDelivery.aggregate([
        { $match: { farmId, date: { $gte: start } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$date' } }, totalQty: { $sum: '$quantity' }, totalAmt: { $sum: '$amount' } } },
        { $sort: { _id: 1 } },
      ]),
      MilkDelivery.aggregate([
        { $match: { farmId, date: { $gte: start } } },
        { $group: { _id: '$customerId', totalQty: { $sum: '$quantity' }, totalAmt: { $sum: '$amount' } } },
        { $sort: { totalAmt: -1 } },
        { $limit: 10 },
        { $lookup: { from: 'customers', localField: '_id', foreignField: '_id', as: 'customer' } },
        { $unwind: '$customer' },
      ]),
      MilkDelivery.aggregate([
        { $match: { farmId, date: { $gte: start } } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      CustomerPayment.aggregate([
        { $match: { farmId, date: { $gte: start } } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
    ]);

    res.json({
      success: true,
      data: {
        totalCustomers,
        monthlyDelivery,
        topCustomers,
        totalDelivered: totalDelivered[0]?.total || 0,
        totalPaid: totalPaid[0]?.total || 0,
        totalDue: (totalDelivered[0]?.total || 0) - (totalPaid[0]?.total || 0),
      },
    });
  } catch (err) { next(err); }
});

// Revenue breakdown by category
router.get('/revenue-breakdown', async (req, res, next) => {
  try {
    const farmId = req.user.farmId;
    const months = parseInt(req.query.months) || 6;
    const start = new Date();
    start.setMonth(start.getMonth() - months);
    start.setDate(1); start.setHours(0, 0, 0, 0);

    const byCategory = await Revenue.aggregate([
      { $match: { farmId, date: { $gte: start } } },
      { $group: { _id: '$category', total: { $sum: '$amount' }, count: { $sum: 1 } } },
      { $sort: { total: -1 } },
    ]);
    res.json({ success: true, data: { byCategory } });
  } catch (err) { next(err); }
});

export default router;
