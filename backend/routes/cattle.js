import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import { checkSubscription } from '../middleware/subscription.js';
import { validate, validateQuery } from '../middleware/validate.js';
import { createCattleSchema, updateCattleSchema, addWeightSchema, cattleQuerySchema } from '../validators/cattle.js';
import Cattle from '../models/Cattle.js';
import MilkRecord from '../models/MilkRecord.js';
import HealthRecord from '../models/HealthRecord.js';
import BreedingRecord from '../models/BreedingRecord.js';
import { paginate, logActivity } from '../utils/helpers.js';

const router = Router();
router.use(auth, checkSubscription);

// List cattle
router.get('/', validateQuery(cattleQuerySchema), async (req, res, next) => {
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
// Cattle profile — full details with stats for profile page
router.get('/:id/profile', async (req, res, next) => {
  try {
    const farmId = req.user.farmId;
    const cattle = await Cattle.findOne({ _id: req.params.id, farmId }).lean();
    if (!cattle) return res.status(404).json({ success: false, message: 'Cattle not found' });

    // Last 90 days of milk records
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const [milkRecords, healthRecords, breedingRecords] = await Promise.all([
      MilkRecord.find({ farmId, cattleId: cattle._id, date: { $gte: ninetyDaysAgo } }).sort('-date').lean(),
      HealthRecord.find({ farmId, cattleId: cattle._id }).sort('-date').limit(20).lean(),
      BreedingRecord.find({ farmId, cattleId: cattle._id }).sort('-breedingDate').limit(10).lean(),
    ]);

    // Calculate stats
    const totalMilk = milkRecords.reduce((s, r) => s + (r.totalYield || 0), 0);
    const avgDailyMilk = milkRecords.length > 0 ? totalMilk / milkRecords.length : 0;
    const totalHealthCost = healthRecords.reduce((s, r) => s + (r.cost || 0), 0);
    const activeBreeding = breedingRecords.find(b => ['pending', 'confirmed'].includes(b.status));

    const stats = {
      totalMilk,
      avgDailyMilk,
      milkRecordCount: milkRecords.length,
      totalHealthCost,
      breedingCount: breedingRecords.length,
      activeBreeding: activeBreeding ? { status: activeBreeding.status, expectedDelivery: activeBreeding.expectedDelivery } : null,
    };

    res.json({ success: true, data: { cattle, milkRecords, healthRecords, breedingRecords, stats } });
  } catch (err) { next(err); }
});

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
router.post('/', validate(createCattleSchema), async (req, res, next) => {
  try {
    const farmId = req.user.farmId;
    const exists = await Cattle.findOne({ farmId, tagNumber: req.body.tagNumber });
    if (exists) return res.status(400).json({ success: false, message: 'Tag number already exists in your farm' });
    const cattle = await Cattle.create({ ...req.body, farmId });
    await logActivity(farmId, 'cattle', '🐄', `New cattle added: Tag ${cattle.tagNumber}`);
    res.status(201).json({ success: true, data: cattle });
  } catch (err) { next(err); }
});

// Update cattle
router.put('/:id', validate(updateCattleSchema), async (req, res, next) => {
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
    await logActivity(req.user.farmId, 'cattle', '✏️', `Cattle updated: Tag ${cattle.tagNumber}`);
    res.json({ success: true, data: cattle });
  } catch (err) { next(err); }
});

// Delete cattle
router.delete('/:id', async (req, res, next) => {
  try {
    const farmId = req.user.farmId;

    // Check for active insurance
    try {
      const Insurance = (await import('../models/Insurance.js')).default;
      const activeInsurance = await Insurance.countDocuments({ cattleId: req.params.id, farmId, status: 'active' });
      if (activeInsurance > 0) {
        return res.status(400).json({ success: false, message: 'Cannot delete cattle with active insurance policies. Cancel the insurance first.' });
      }
    } catch {}

    // Check for active breeding
    const activeBreeding = await BreedingRecord.countDocuments({ 
      cattleId: req.params.id, farmId, status: { $in: ['bred', 'confirmed'] } 
    });
    if (activeBreeding > 0) {
      return res.status(400).json({ success: false, message: 'Cannot delete cattle with active breeding records. Update breeding status first.' });
    }

    const cattle = await Cattle.findOneAndDelete({ _id: req.params.id, farmId });
    if (!cattle) return res.status(404).json({ success: false, message: 'Cattle not found' });
    await logActivity(farmId, 'cattle', '🗑️', `Cattle deleted: Tag ${cattle.tagNumber}`);
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
router.post('/:id/weight', validate(addWeightSchema), async (req, res, next) => {
  try {
    const { date, weight, notes } = req.body;
    
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

// ─── Cattle Performance PDF (for sharing with buyers) ───
router.get('/:id/pdf', async (req, res, next) => {
  try {
    const farmId = req.user.farmId;
    const cattle = await Cattle.findOne({ _id: req.params.id, farmId }).lean();
    if (!cattle) return res.status(404).json({ success: false, message: 'Cattle not found' });

    // Fetch last 6 months of milk records
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const milkRecords = await MilkRecord.find({ farmId, cattleId: cattle._id, date: { $gte: sixMonthsAgo } }).sort('date').lean();
    const totalMilk = milkRecords.reduce((s, r) => s + (r.totalYield || 0), 0);
    const avgDaily = milkRecords.length > 0 ? totalMilk / milkRecords.length : 0;
    const avgFat = milkRecords.filter(r => r.morningFat > 0).length > 0
      ? milkRecords.reduce((s, r) => s + (r.morningFat || 0), 0) / milkRecords.filter(r => r.morningFat > 0).length : 0;

    // Monthly summary
    const monthlyMap = {};
    milkRecords.forEach(r => {
      const key = new Date(r.date).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
      if (!monthlyMap[key]) monthlyMap[key] = { total: 0, days: 0 };
      monthlyMap[key].total += r.totalYield || 0;
      monthlyMap[key].days += 1;
    });
    const monthlyRows = Object.entries(monthlyMap).map(([month, d]) =>
      `<tr><td>${month}</td><td>${d.days}</td><td>${d.total.toFixed(1)}</td><td>${(d.total / d.days).toFixed(1)}</td></tr>`
    ).join('');

    // Health records
    const healthRecords = await HealthRecord.find({ farmId, cattleId: cattle._id }).sort('-date').limit(10).lean();
    const healthRows = healthRecords.map(r =>
      `<tr><td>${new Date(r.date).toLocaleDateString('en-IN')}</td><td>${r.type}</td><td>${r.description}</td><td>${r.medicine || '-'}</td></tr>`
    ).join('');

    // Breeding records
    const breedingRecords = await BreedingRecord.find({ farmId, cattleId: cattle._id }).sort('-breedingDate').limit(5).lean();
    const breedingRows = breedingRecords.map(r =>
      `<tr><td>${new Date(r.breedingDate).toLocaleDateString('en-IN')}</td><td>${r.method === 'artificial' ? 'AI' : 'Natural'}</td><td>${r.bullDetails || '-'}</td><td>${r.status}</td></tr>`
    ).join('');

    const now = new Date();
    const age = cattle.dateOfBirth ? Math.floor((now - new Date(cattle.dateOfBirth)) / (365.25 * 24 * 60 * 60 * 1000)) : null;

    const html = `<!DOCTYPE html><html><head><title>Cattle Profile - ${cattle.tagNumber}</title>
<style>
  body{font-family:Arial,sans-serif;padding:25px;color:#333;max-width:800px;margin:0 auto}
  h1{color:#059669;margin-bottom:5px}
  h2{color:#059669;font-size:16px;margin-top:25px;border-bottom:2px solid #059669;padding-bottom:5px}
  table{width:100%;border-collapse:collapse;margin:10px 0}
  th{background:#059669;color:white;padding:8px 10px;text-align:left;font-size:13px}
  td{padding:7px 10px;border-bottom:1px solid #e5e7eb;font-size:13px}
  tr:nth-child(even){background:#f9fafb}
  .info-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:10px 0}
  .info-item{background:#f0fdf4;padding:10px;border-radius:8px}
  .info-item .label{font-size:11px;color:#6b7280;text-transform:uppercase}
  .info-item .value{font-size:16px;font-weight:bold;color:#059669}
  .stats{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:15px 0}
  .stat{background:#ecfdf5;padding:12px;border-radius:8px;text-align:center}
  .stat .num{font-size:22px;font-weight:bold;color:#059669}
  .stat .lbl{font-size:11px;color:#6b7280}
  .footer{margin-top:30px;text-align:center;color:#9ca3af;font-size:11px;border-top:1px solid #e5e7eb;padding-top:10px}
  @media print{body{padding:15px}}
</style></head><body>
<h1>🐄 Cattle Profile — Tag No ${cattle.tagNumber}</h1>
<p style="color:#6b7280;margin-top:0">Generated on ${now.toLocaleDateString('en-IN', { day:'2-digit', month:'long', year:'numeric' })}</p>

<div class="info-grid">
  <div class="info-item"><div class="label">Breed</div><div class="value">${cattle.breed}</div></div>
  <div class="info-item"><div class="label">Category</div><div class="value">${cattle.category}</div></div>
  <div class="info-item"><div class="label">Gender</div><div class="value">${cattle.gender}</div></div>
  <div class="info-item"><div class="label">Weight</div><div class="value">${cattle.weight ? cattle.weight + ' kg' : '-'}</div></div>
  ${age !== null ? `<div class="info-item"><div class="label">Age</div><div class="value">${age} years</div></div>` : ''}
  ${cattle.lactationNumber ? `<div class="info-item"><div class="label">Lactation</div><div class="value">L-${cattle.lactationNumber}</div></div>` : ''}
  ${cattle.generation ? `<div class="info-item"><div class="label">Generation</div><div class="value">${cattle.generation}</div></div>` : ''}
  ${cattle.source ? `<div class="info-item"><div class="label">Source</div><div class="value">${cattle.source === 'purchased' ? 'Purchased' : 'Born on Farm'}</div></div>` : ''}
</div>

${milkRecords.length > 0 ? `
<h2>🥛 Milk Performance (Last 6 Months)</h2>
<div class="stats">
  <div class="stat"><div class="num">${totalMilk.toFixed(0)}L</div><div class="lbl">Total Milk</div></div>
  <div class="stat"><div class="num">${avgDaily.toFixed(1)}L</div><div class="lbl">Avg / Day</div></div>
  <div class="stat"><div class="num">${milkRecords.length}</div><div class="lbl">Records</div></div>
  <div class="stat"><div class="num">${avgFat > 0 ? avgFat.toFixed(1) + '%' : '-'}</div><div class="lbl">Avg Fat</div></div>
</div>
<table><tr><th>Month</th><th>Days Recorded</th><th>Total (L)</th><th>Avg/Day (L)</th></tr>${monthlyRows}</table>
` : '<p style="color:#9ca3af;font-style:italic">No milk records in last 6 months</p>'}

${healthRows ? `
<h2>💉 Health Records (Last 10)</h2>
<table><tr><th>Date</th><th>Type</th><th>Description</th><th>Medicine</th></tr>${healthRows}</table>
` : ''}

${breedingRows ? `
<h2>🐣 Breeding History</h2>
<table><tr><th>Date</th><th>Method</th><th>Bull Details</th><th>Status</th></tr>${breedingRows}</table>
` : ''}

<div class="footer">
  <p>🐄 DairyPro — Cattle Performance Report</p>
</div>
</body></html>`;

    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (err) { next(err); }
});

export default router;
