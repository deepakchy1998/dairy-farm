import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import { checkSubscription } from '../middleware/subscription.js';
import MilkRecord from '../models/MilkRecord.js';
import Cattle from '../models/Cattle.js';
import { paginate, dateFilter, logActivity } from '../utils/helpers.js';

const router = Router();
router.use(auth, checkSubscription);

// List milk records
router.get('/', async (req, res, next) => {
  try {
    const farmId = req.user.farmId;
    const { cattleId, startDate, endDate, page, limit } = req.query;
    const filter = { farmId, ...dateFilter(startDate, endDate) };
    if (cattleId) filter.cattleId = cattleId;
    const p = paginate(page, limit);
    const [data, total] = await Promise.all([
      MilkRecord.find(filter).populate('cattleId', 'tagNumber breed').sort('-date').skip(p.skip).limit(p.limit).lean(),
      MilkRecord.countDocuments(filter),
    ]);
    res.json({ success: true, data, pagination: { page: p.page, pages: Math.ceil(total / p.limit), total } });
  } catch (err) { next(err); }
});

// Daily summary
router.get('/daily-summary', async (req, res, next) => {
  try {
    const farmId = req.user.farmId;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
    const records = await MilkRecord.find({ farmId, date: { $gte: today, $lt: tomorrow } }).populate('cattleId', 'tagNumber breed');
    const totalMorning = records.reduce((s, r) => s + (r.morningYield || 0), 0);
    const totalEvening = records.reduce((s, r) => s + (r.eveningYield || 0), 0);
    const totalAfternoon = records.reduce((s, r) => s + (r.afternoonYield || 0), 0);
    const totalYield = records.reduce((s, r) => s + (r.totalYield || 0), 0);
    res.json({ success: true, data: { totalMorning, totalEvening, totalAfternoon, totalYield, recordCount: records.length, records } });
  } catch (err) { next(err); }
});

// Monthly summary
router.get('/monthly-summary', async (req, res, next) => {
  try {
    const farmId = req.user.farmId;
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const month = parseInt(req.query.month) || new Date().getMonth() + 1;
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0, 23, 59, 59, 999);
    const days = await MilkRecord.aggregate([
      { $match: { farmId, date: { $gte: start, $lte: end } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } }, total: { $sum: '$totalYield' } } },
      { $sort: { _id: 1 } },
    ]);
    res.json({ success: true, data: { days } });
  } catch (err) { next(err); }
});

// Analytics
router.get('/analytics', async (req, res, next) => {
  try {
    const data = await MilkRecord.aggregate([
      { $match: { farmId: req.user.farmId } },
      { $group: { _id: '$cattleId', totalYield: { $sum: '$totalYield' } } },
    ]);
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

// PDF for single cattle
router.get('/pdf/:cattleId', async (req, res, next) => {
  try {
    const farmId = req.user.farmId;
    const cattle = await Cattle.findOne({ _id: req.params.cattleId, farmId });
    if (!cattle) return res.status(404).json({ success: false, message: 'Cattle not found' });
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const records = await MilkRecord.find({ farmId, cattleId: cattle._id, date: { $gte: start } }).sort('date');
    const total = records.reduce((s, r) => s + r.totalYield, 0);
    const rows = records.map(r => `<tr><td>${r.date.toLocaleDateString('en-IN')}</td><td>${r.morningYield || '-'}</td><td>${r.afternoonYield || '-'}</td><td>${r.eveningYield || '-'}</td><td><strong>${r.totalYield.toFixed(1)}</strong></td></tr>`).join('');
    const html = `<!DOCTYPE html><html><head><title>Milk Report - ${cattle.tagNumber}</title><style>body{font-family:sans-serif;padding:20px}table{width:100%;border-collapse:collapse;margin-top:15px}th,td{border:1px solid #ddd;padding:8px;text-align:center}th{background:#059669;color:white}h1{color:#059669}</style></head><body><h1>🐄 Milk Report — Tag No ${cattle.tagNumber}</h1><p>Breed: ${cattle.breed} | Month: ${now.toLocaleString('en-IN',{month:'long',year:'numeric'})}</p><p><strong>Total: ${total.toFixed(1)} L</strong></p><table><tr><th>Date</th><th>Morning (L)</th><th>Afternoon (L)</th><th>Evening (L)</th><th>Total (L)</th></tr>${rows}</table></body></html>`;
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (err) { next(err); }
});

// PDF report for filtered records
router.get('/pdf-report', async (req, res, next) => {
  try {
    const farmId = req.user.farmId;
    const { startDate, endDate, cattleId } = req.query;
    const filter = { farmId, ...dateFilter(startDate, endDate) };
    if (cattleId) filter.cattleId = cattleId;
    const records = await MilkRecord.find(filter).populate('cattleId', 'tagNumber breed').sort('date');
    const total = records.reduce((s, r) => s + r.totalYield, 0);
    const rows = records.map(r => `<tr><td>${r.date.toLocaleDateString('en-IN')}</td><td>${r.cattleId?.tagNumber || '-'}</td><td>${r.morningYield || '-'}</td><td>${r.afternoonYield || '-'}</td><td>${r.eveningYield || '-'}</td><td><strong>${r.totalYield.toFixed(1)}</strong></td></tr>`).join('');
    const html = `<!DOCTYPE html><html><head><title>Milk Report</title><style>body{font-family:sans-serif;padding:20px}table{width:100%;border-collapse:collapse;margin-top:15px}th,td{border:1px solid #ddd;padding:8px;text-align:center}th{background:#059669;color:white}h1{color:#059669}</style></head><body><h1>🥛 Milk Production Report</h1><p>${startDate || 'All'} to ${endDate || 'Now'} | Records: ${records.length} | Total: ${total.toFixed(1)} L</p><table><tr><th>Date</th><th>Tag</th><th>Morning</th><th>Afternoon</th><th>Evening</th><th>Total</th></tr>${rows}</table></body></html>`;
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (err) { next(err); }
});

// POST /api/milk/calculate-rate — Calculate milk payment based on fat/SNF
router.post('/calculate-rate', async (req, res, next) => {
  try {
    const { quantity, fat, snf, ratePerFat = 7.5, baseRate = 0 } = req.body;
    if (!quantity || !fat) {
      return res.status(400).json({ success: false, message: 'Quantity and fat% are required' });
    }
    const fatBasedAmount = quantity * fat * ratePerFat;
    const ts = fat + (snf || 8.5);
    const tsBasedRate = ts * 0.4;
    const tsBasedAmount = quantity * tsBasedRate;
    const withBaseRate = baseRate > 0 ? (baseRate * quantity) + ((fat - 3.5) * 2 * quantity) : 0;

    res.json({
      success: true,
      data: {
        quantity, fat, snf: snf || 8.5,
        fatBased: { ratePerFat, amount: +fatBasedAmount.toFixed(2) },
        tsBased: { ts: +ts.toFixed(1), ratePerLiter: +tsBasedRate.toFixed(2), amount: +tsBasedAmount.toFixed(2) },
        baseRateBased: baseRate > 0 ? { baseRate, amount: +withBaseRate.toFixed(2) } : null,
      },
    });
  } catch (err) { next(err); }
});

// Create milk record (upsert by cattle+date)
router.post('/', async (req, res, next) => {
  try {
    const farmId = req.user.farmId;
    const { cattleId, date, morningYield, morningFat, morningSNF, afternoonYield, afternoonFat, afternoonSNF, eveningYield, eveningFat, eveningSNF } = req.body;
    if (!cattleId || !date) return res.status(400).json({ success: false, message: 'Cattle and date required' });

    // Validate yields (max 100L per session is extreme but safe upper bound)
    const yields = [morningYield, afternoonYield, eveningYield].filter(y => y != null);
    if (yields.some(y => y < 0 || y > 100)) {
      return res.status(400).json({ success: false, message: 'Milk yield must be between 0 and 100 litres' });
    }
    // Validate fat% (0-15 is realistic range)
    const fats = [morningFat, afternoonFat, eveningFat].filter(f => f != null && f !== '');
    if (fats.some(f => f < 0 || f > 15)) {
      return res.status(400).json({ success: false, message: 'Fat percentage must be between 0 and 15%' });
    }

    const recordDate = new Date(date); recordDate.setHours(0, 0, 0, 0);
    let record = await MilkRecord.findOne({ farmId, cattleId, date: recordDate });
    if (record) {
      Object.assign(record, { morningYield, morningFat, morningSNF, afternoonYield, afternoonFat, afternoonSNF, eveningYield, eveningFat, eveningSNF });
      await record.save();
    } else {
      record = await MilkRecord.create({ farmId, cattleId, date: recordDate, morningYield, morningFat, morningSNF, afternoonYield, afternoonFat, afternoonSNF, eveningYield, eveningFat, eveningSNF });
    }
    const cattle = await Cattle.findById(cattleId);
    await logActivity(farmId, 'milk', '🥛', `Milk recorded for Tag ${cattle?.tagNumber || 'Unknown'}: ${record.totalYield.toFixed(1)}L`);
    res.status(201).json({ success: true, data: record });
  } catch (err) { next(err); }
});

// Update
router.put('/:id', async (req, res, next) => {
  try {
    const record = await MilkRecord.findOne({ _id: req.params.id, farmId: req.user.farmId });
    if (!record) return res.status(404).json({ success: false, message: 'Record not found' });
    const fields = ['morningYield', 'morningFat', 'morningSNF', 'afternoonYield', 'afternoonFat', 'afternoonSNF', 'eveningYield', 'eveningFat', 'eveningSNF', 'date'];
    fields.forEach(f => { if (req.body[f] !== undefined) record[f] = req.body[f]; });
    if (req.body.date) { const d = new Date(req.body.date); d.setHours(0,0,0,0); record.date = d; }
    await record.save();
    res.json({ success: true, data: record });
  } catch (err) { next(err); }
});

// Delete
router.delete('/:id', async (req, res, next) => {
  try {
    const record = await MilkRecord.findOneAndDelete({ _id: req.params.id, farmId: req.user.farmId });
    if (!record) return res.status(404).json({ success: false, message: 'Record not found' });
    res.json({ success: true, message: 'Deleted' });
  } catch (err) { next(err); }
});

export default router;
