import express from 'express';
import { auth } from '../middleware/auth.js';
import { checkSubscription } from '../middleware/subscription.js';
import Customer from '../models/Customer.js';
import MilkDelivery from '../models/MilkDelivery.js';
import CustomerPayment from '../models/CustomerPayment.js';
import { logActivity } from '../utils/helpers.js';

const router = express.Router();
router.use(auth, checkSubscription);

// ════════════════════════════════════════
//  CUSTOMERS CRUD
// ════════════════════════════════════════

// GET all customers (with search/filter)
router.get('/customers', async (req, res, next) => {
  try {
    const { search, status, sort = 'name', page = 1, limit = 100 } = req.query;
    const filter = { farmId: req.user.farmId };
    if (status) filter.status = status;
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { village: { $regex: search, $options: 'i' } },
      ];
    }
    const sortMap = { name: { name: 1 }, recent: { createdAt: -1 }, quantity: { dailyQuantity: -1 }, balance: { balance: -1 } };
    const total = await Customer.countDocuments(filter);
    const customers = await Customer.find(filter)
      .sort(sortMap[sort] || { name: 1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .lean();
    res.json({ success: true, data: customers, pagination: { total, page: Number(page), pages: Math.ceil(total / limit) } });
  } catch (err) { next(err); }
});

// GET single customer with summary
router.get('/customers/:id', async (req, res, next) => {
  try {
    const customer = await Customer.findOne({ _id: req.params.id, farmId: req.user.farmId }).lean();
    if (!customer) return res.status(404).json({ success: false, message: 'Customer not found' });

    // Get current month summary
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const [deliveries, payments] = await Promise.all([
      MilkDelivery.aggregate([
        { $match: { customerId: customer._id, date: { $gte: monthStart, $lte: monthEnd } } },
        { $group: { _id: null, totalQty: { $sum: '$quantity' }, totalAmt: { $sum: '$amount' }, count: { $sum: 1 } } },
      ]),
      CustomerPayment.aggregate([
        { $match: { customerId: customer._id, date: { $gte: monthStart, $lte: monthEnd } } },
        { $group: { _id: null, totalPaid: { $sum: '$amount' } } },
      ]),
    ]);

    const monthSummary = {
      totalQuantity: deliveries[0]?.totalQty || 0,
      totalAmount: deliveries[0]?.totalAmt || 0,
      deliveryCount: deliveries[0]?.count || 0,
      totalPaid: payments[0]?.totalPaid || 0,
      due: (deliveries[0]?.totalAmt || 0) - (payments[0]?.totalPaid || 0),
    };

    res.json({ success: true, data: { ...customer, monthSummary } });
  } catch (err) { next(err); }
});

// CREATE customer
router.post('/customers', async (req, res, next) => {
  try {
    const { name, phone, address, village, dailyQuantity, ratePerLiter, deliveryTime, notes } = req.body;
    if (!name || dailyQuantity == null || ratePerLiter == null) {
      return res.status(400).json({ success: false, message: 'Name, daily quantity, and rate are required' });
    }
    const customer = await Customer.create({
      farmId: req.user.farmId, name, phone, address, village,
      dailyQuantity: Number(dailyQuantity), ratePerLiter: Number(ratePerLiter),
      deliveryTime: deliveryTime || 'morning', notes,
    });
    await logActivity(req.user.farmId, 'customer', '🏘️', `New milk customer added: ${name} (${dailyQuantity}L/day)`);
    res.status(201).json({ success: true, data: customer });
  } catch (err) { next(err); }
});

// UPDATE customer
router.put('/customers/:id', async (req, res, next) => {
  try {
    const updates = {};
    const allowed = ['name', 'phone', 'address', 'village', 'dailyQuantity', 'ratePerLiter', 'deliveryTime', 'status', 'notes'];
    allowed.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });
    const customer = await Customer.findOneAndUpdate(
      { _id: req.params.id, farmId: req.user.farmId }, updates, { new: true }
    );
    if (!customer) return res.status(404).json({ success: false, message: 'Customer not found' });
    res.json({ success: true, data: customer });
  } catch (err) { next(err); }
});

// DELETE customer
router.delete('/customers/:id', async (req, res, next) => {
  try {
    const customer = await Customer.findOneAndDelete({ _id: req.params.id, farmId: req.user.farmId });
    if (!customer) return res.status(404).json({ success: false, message: 'Customer not found' });
    await MilkDelivery.deleteMany({ customerId: customer._id });
    await CustomerPayment.deleteMany({ customerId: customer._id });
    await logActivity(req.user.farmId, 'customer', '🗑️', `Customer deleted: ${customer.name}`);
    res.json({ success: true, message: 'Customer and all related records deleted' });
  } catch (err) { next(err); }
});

// ════════════════════════════════════════
//  MILK DELIVERIES
// ════════════════════════════════════════

// GET deliveries (filtered)
router.get('/deliveries', async (req, res, next) => {
  try {
    const { customerId, startDate, endDate, page = 1, limit = 100 } = req.query;
    const filter = { farmId: req.user.farmId };
    if (customerId) filter.customerId = customerId;
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) filter.date.$lte = new Date(endDate + 'T23:59:59');
    }
    const total = await MilkDelivery.countDocuments(filter);
    const deliveries = await MilkDelivery.find(filter)
      .populate('customerId', 'name phone village dailyQuantity')
      .sort({ date: -1, session: 1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .lean();
    res.json({ success: true, data: deliveries, pagination: { total, page: Number(page), pages: Math.ceil(total / limit) } });
  } catch (err) { next(err); }
});

// POST single delivery
router.post('/deliveries', async (req, res, next) => {
  try {
    const { customerId, date, quantity, ratePerLiter, session, notes } = req.body;
    if (!customerId || !date || quantity == null) {
      return res.status(400).json({ success: false, message: 'Customer, date, and quantity are required' });
    }
    const customer = await Customer.findOne({ _id: customerId, farmId: req.user.farmId });
    if (!customer) return res.status(404).json({ success: false, message: 'Customer not found' });

    const rate = ratePerLiter || customer.ratePerLiter;
    const qty = Number(quantity);
    const isExtra = qty > customer.dailyQuantity;

    const delivery = await MilkDelivery.findOneAndUpdate(
      { farmId: req.user.farmId, customerId, date: new Date(date), session: session || 'morning' },
      { quantity: qty, ratePerLiter: rate, amount: qty * rate, isExtra, notes, farmId: req.user.farmId },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // Update customer balance
    await recalcBalance(customer._id);

    res.status(201).json({ success: true, data: delivery });
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ success: false, message: 'Delivery already recorded for this customer/date/session' });
    next(err);
  }
});

// POST bulk deliveries (mark all active customers for a date)
router.post('/deliveries/bulk', async (req, res, next) => {
  try {
    const { date, session = 'morning', entries } = req.body;
    // entries: [{ customerId, quantity, ratePerLiter? }]
    if (!date || !entries?.length) {
      return res.status(400).json({ success: false, message: 'Date and entries are required' });
    }

    const results = [];
    for (const entry of entries) {
      if (!entry.customerId || entry.quantity == null) continue;
      const customer = await Customer.findOne({ _id: entry.customerId, farmId: req.user.farmId }).lean();
      if (!customer) continue;

      const rate = entry.ratePerLiter || customer.ratePerLiter;
      const qty = Number(entry.quantity);

      try {
        const delivery = await MilkDelivery.findOneAndUpdate(
          { farmId: req.user.farmId, customerId: entry.customerId, date: new Date(date), session },
          { quantity: qty, ratePerLiter: rate, amount: qty * rate, isExtra: qty > customer.dailyQuantity, notes: entry.notes || '', farmId: req.user.farmId },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
        results.push(delivery);
      } catch (e) {
        // Skip duplicates
      }
    }

    // Recalc balances for affected customers
    const customerIds = [...new Set(entries.map(e => e.customerId))];
    for (const cid of customerIds) await recalcBalance(cid);

    res.json({ success: true, data: results, count: results.length });
  } catch (err) { next(err); }
});

// Auto-fill: get today's entry form with all active customers pre-filled
router.get('/deliveries/daily-sheet', async (req, res, next) => {
  try {
    const date = req.query.date || new Date().toISOString().slice(0, 10);
    const session = req.query.session || 'morning';
    const customers = await Customer.find({ farmId: req.user.farmId, status: 'active' }).sort({ name: 1 }).lean();

    const existing = await MilkDelivery.find({
      farmId: req.user.farmId,
      date: new Date(date),
      session,
    }).lean();

    const existingMap = {};
    existing.forEach(d => { existingMap[d.customerId.toString()] = d; });

    const sheet = customers.map(c => ({
      customerId: c._id,
      name: c.name,
      phone: c.phone,
      village: c.village,
      dailyQuantity: c.dailyQuantity,
      ratePerLiter: c.ratePerLiter,
      deliveryTime: c.deliveryTime,
      // Pre-fill with existing or default
      quantity: existingMap[c._id.toString()]?.quantity ?? c.dailyQuantity,
      recorded: !!existingMap[c._id.toString()],
      deliveryId: existingMap[c._id.toString()]?._id || null,
    }));

    res.json({ success: true, data: sheet, date, session });
  } catch (err) { next(err); }
});

// DELETE delivery
router.delete('/deliveries/:id', async (req, res, next) => {
  try {
    const delivery = await MilkDelivery.findOneAndDelete({ _id: req.params.id, farmId: req.user.farmId });
    if (!delivery) return res.status(404).json({ success: false, message: 'Delivery not found' });
    await recalcBalance(delivery.customerId);
    res.json({ success: true, message: 'Deleted' });
  } catch (err) { next(err); }
});

// ════════════════════════════════════════
//  PAYMENTS
// ════════════════════════════════════════

// GET payments
router.get('/payments', async (req, res, next) => {
  try {
    const { customerId, startDate, endDate } = req.query;
    const filter = { farmId: req.user.farmId };
    if (customerId) filter.customerId = customerId;
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) filter.date.$lte = new Date(endDate + 'T23:59:59');
    }
    const payments = await CustomerPayment.find(filter)
      .populate('customerId', 'name phone')
      .sort({ date: -1 })
      .lean();
    res.json({ success: true, data: payments });
  } catch (err) { next(err); }
});

// POST payment
router.post('/payments', async (req, res, next) => {
  try {
    const { customerId, date, amount, method, notes, month } = req.body;
    if (!customerId || !amount) {
      return res.status(400).json({ success: false, message: 'Customer and amount are required' });
    }
    const customer = await Customer.findOne({ _id: customerId, farmId: req.user.farmId });
    if (!customer) return res.status(404).json({ success: false, message: 'Customer not found' });

    const payment = await CustomerPayment.create({
      farmId: req.user.farmId, customerId, date: date ? new Date(date) : new Date(),
      amount: Number(amount), method: method || 'cash', notes, month,
    });

    // Update balance
    customer.balance = Math.max(0, customer.balance - Number(amount));
    await customer.save();

    res.status(201).json({ success: true, data: payment });
  } catch (err) { next(err); }
});

// DELETE payment
router.delete('/payments/:id', async (req, res, next) => {
  try {
    const payment = await CustomerPayment.findOneAndDelete({ _id: req.params.id, farmId: req.user.farmId });
    if (!payment) return res.status(404).json({ success: false, message: 'Payment not found' });
    await recalcBalance(payment.customerId);
    res.json({ success: true, message: 'Payment deleted' });
  } catch (err) { next(err); }
});

// ════════════════════════════════════════
//  REPORTS & SUMMARIES
// ════════════════════════════════════════

// Monthly ledger — per customer breakdown for a month
router.get('/monthly-ledger', async (req, res, next) => {
  try {
    const { year, month } = req.query;
    const y = Number(year) || new Date().getFullYear();
    const m = Number(month) || (new Date().getMonth() + 1);
    const startDate = new Date(y, m - 1, 1);
    const endDate = new Date(y, m, 0, 23, 59, 59);

    const [deliveries, payments, customers] = await Promise.all([
      MilkDelivery.aggregate([
        { $match: { farmId: req.user.farmId, date: { $gte: startDate, $lte: endDate } } },
        { $group: {
          _id: '$customerId',
          totalQty: { $sum: '$quantity' },
          totalAmt: { $sum: '$amount' },
          deliveryCount: { $sum: 1 },
          avgRate: { $avg: '$ratePerLiter' },
        }},
      ]),
      CustomerPayment.aggregate([
        { $match: { farmId: req.user.farmId, date: { $gte: startDate, $lte: endDate } } },
        { $group: { _id: '$customerId', totalPaid: { $sum: '$amount' } } },
      ]),
      Customer.find({ farmId: req.user.farmId }).lean(),
    ]);

    const deliveryMap = {};
    deliveries.forEach(d => { deliveryMap[d._id.toString()] = d; });
    const paymentMap = {};
    payments.forEach(p => { paymentMap[p._id.toString()] = p; });

    const ledger = customers.map(c => {
      const del = deliveryMap[c._id.toString()] || { totalQty: 0, totalAmt: 0, deliveryCount: 0, avgRate: c.ratePerLiter };
      const pay = paymentMap[c._id.toString()] || { totalPaid: 0 };
      return {
        _id: c._id,
        name: c.name,
        phone: c.phone,
        village: c.village,
        dailyQuantity: c.dailyQuantity,
        ratePerLiter: c.ratePerLiter,
        status: c.status,
        totalQuantity: del.totalQty,
        totalAmount: del.totalAmt,
        deliveryCount: del.deliveryCount,
        avgRate: del.avgRate,
        totalPaid: pay.totalPaid,
        due: del.totalAmt - pay.totalPaid,
        balance: c.balance,
      };
    }).filter(c => c.status === 'active' || c.totalQuantity > 0);

    // Totals
    const totals = {
      totalCustomers: ledger.length,
      totalQuantity: ledger.reduce((s, c) => s + c.totalQuantity, 0),
      totalAmount: ledger.reduce((s, c) => s + c.totalAmount, 0),
      totalPaid: ledger.reduce((s, c) => s + c.totalPaid, 0),
      totalDue: ledger.reduce((s, c) => s + c.due, 0),
    };

    res.json({ success: true, data: { ledger, totals, month: `${y}-${String(m).padStart(2, '0')}` } });
  } catch (err) { next(err); }
});

// Daily summary — all customers for a specific date
router.get('/daily-summary', async (req, res, next) => {
  try {
    const date = req.query.date || new Date().toISOString().slice(0, 10);
    const dayStart = new Date(date);
    const dayEnd = new Date(date + 'T23:59:59');

    const deliveries = await MilkDelivery.find({
      farmId: req.user.farmId,
      date: { $gte: dayStart, $lte: dayEnd },
    }).populate('customerId', 'name phone village').sort({ 'customerId.name': 1 }).lean();

    const totalQty = deliveries.reduce((s, d) => s + d.quantity, 0);
    const totalAmt = deliveries.reduce((s, d) => s + d.amount, 0);

    res.json({
      success: true,
      data: {
        date,
        deliveries,
        totals: { totalQuantity: totalQty, totalAmount: totalAmt, customerCount: new Set(deliveries.map(d => d.customerId?._id?.toString())).size },
      },
    });
  } catch (err) { next(err); }
});

// Customer history — all deliveries for a specific customer
router.get('/customer-history/:customerId', async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const filter = { farmId: req.user.farmId, customerId: req.params.customerId };
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) filter.date.$lte = new Date(endDate + 'T23:59:59');
    }
    const [deliveries, payments, customer] = await Promise.all([
      MilkDelivery.find(filter).sort({ date: -1 }).lean(),
      CustomerPayment.find({ farmId: req.user.farmId, customerId: req.params.customerId, ...(filter.date ? { date: filter.date } : {}) }).sort({ date: -1 }).lean(),
      Customer.findOne({ _id: req.params.customerId, farmId: req.user.farmId }).lean(),
    ]);

    const totalQty = deliveries.reduce((s, d) => s + d.quantity, 0);
    const totalAmt = deliveries.reduce((s, d) => s + d.amount, 0);
    const totalPaid = payments.reduce((s, p) => s + p.amount, 0);

    res.json({
      success: true,
      data: {
        customer,
        deliveries,
        payments,
        summary: { totalQuantity: totalQty, totalAmount: totalAmt, totalPaid, due: totalAmt - totalPaid },
      },
    });
  } catch (err) { next(err); }
});

// ════════════════════════════════════════
//  HELPER
// ════════════════════════════════════════

async function recalcBalance(customerId) {
  const totalDelivered = await MilkDelivery.aggregate([
    { $match: { customerId: typeof customerId === 'string' ? new (await import('mongoose')).default.Types.ObjectId(customerId) : customerId } },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]);
  const totalPaid = await CustomerPayment.aggregate([
    { $match: { customerId: typeof customerId === 'string' ? new (await import('mongoose')).default.Types.ObjectId(customerId) : customerId } },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]);
  const balance = (totalDelivered[0]?.total || 0) - (totalPaid[0]?.total || 0);
  await Customer.findByIdAndUpdate(customerId, { balance: Math.max(0, balance) });
}

export default router;
