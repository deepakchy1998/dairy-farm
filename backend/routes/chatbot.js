import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import { checkSubscription } from '../middleware/subscription.js';
import Cattle from '../models/Cattle.js';
import MilkRecord from '../models/MilkRecord.js';
import HealthRecord from '../models/HealthRecord.js';
import BreedingRecord from '../models/BreedingRecord.js';
import Expense from '../models/Expense.js';
import Revenue from '../models/Revenue.js';
import FeedRecord from '../models/FeedRecord.js';
import Farm from '../models/Farm.js';
import Customer from '../models/Customer.js';
import MilkDelivery from '../models/MilkDelivery.js';
import CustomerPayment from '../models/CustomerPayment.js';
import Employee from '../models/Employee.js';
import Attendance from '../models/Attendance.js';

const router = Router();
router.use(auth, checkSubscription);

// ─── In-memory cache per farm (TTL: 60s) ───
const farmCache = new Map();
const CACHE_TTL = 30_000; // 30 seconds for fresher data

function getCachedData(farmId) {
  const key = farmId.toString();
  const cached = farmCache.get(key);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data;
  return null;
}

function setCachedData(farmId, data) {
  farmCache.set(farmId.toString(), { data, ts: Date.now() });
  // Cleanup old entries
  if (farmCache.size > 100) {
    const now = Date.now();
    for (const [k, v] of farmCache) {
      if (now - v.ts > CACHE_TTL * 5) farmCache.delete(k);
    }
  }
}

// ─── Smart context builder (only fetches what's needed) ───
function detectTopics(message) {
  const lower = message.toLowerCase();
  const topics = new Set();

  const map = {
    milk: ['milk', 'dudh', 'doodh', 'yield', 'production', 'litre', 'liter', 'fat', 'snf', 'utpadan', 'paidawar', 'dudh kitna'],
    cattle: ['cattle', 'cow', 'gaay', 'gai', 'bull', 'calf', 'heifer', 'animal', 'janwar', 'pashu', 'tag', 'breed', 'bhains', 'bakri', 'bail', 'bhainsa', 'bachhda', 'bachhdi', 'maweshi'],
    health: ['health', 'vaccine', 'vaccination', 'treatment', 'sick', 'bimar', 'vet', 'medicine', 'dawai', 'checkup', 'deworming', 'disease', 'teeka', 'ilaaj', 'bimari', 'bukhar', 'kharish', 'pet dard', 'than', 'mastitis'],
    breeding: ['breeding', 'pregnant', 'delivery', 'insemination', 'bachha', 'garbh', 'heat', 'cycle', 'calving', 'gaabhan', 'byaana', 'janm', 'heat par', 'garmi'],
    expense: ['expense', 'kharcha', 'cost', 'spending', 'budget', 'paisa', 'kharcha kitna', 'bill', 'bijli'],
    revenue: ['revenue', 'income', 'aay', 'kamai', 'sale', 'bikri', 'profit', 'munafa', 'loss', 'kitna kamaya', 'bikri kitna'],
    feed: ['feed', 'chara', 'fodder', 'khana', 'dana', 'silage', 'nutrition', 'khuraak', 'bhusa', 'khal', 'choker', 'sarson khal'],
    insurance: ['insurance', 'bima', 'policy', 'claim', 'insured', 'beema', 'suraksha'],
    lactation: ['lactation', 'dim', 'days in milk', 'dry off', 'calving'],
    weight: ['weight', 'wajan', 'vajan', 'kg', 'kilo'],
    finance: ['finance', 'money', 'paise', 'hisab', 'balance', 'profit', 'loss'],
    delivery: ['delivery', 'customer', 'grahak', 'khata', 'dudh khata', 'household', 'village', 'gaon', 'payment', 'due', 'collection', 'baatna', 'gharon mein', 'ghar ghar'],
    employee: ['employee', 'karmchari', 'staff', 'worker', 'salary', 'tankhwah', 'attendance', 'hajri', 'advance', 'naukar', 'mazdoor', 'pagaar', 'chutti'],
    report: ['report', 'chart', 'graph', 'analytics', 'analysis', 'comparison'],
  };

  for (const [topic, keywords] of Object.entries(map)) {
    if (keywords.some(k => lower.includes(k))) topics.add(topic);
  }

  // General/overview queries fetch everything
  const overviewWords = ['summary', 'overview', 'status', 'haal', 'report', 'dashboard', 'sab', 'everything', 'farm', 'all'];
  if (overviewWords.some(w => lower.includes(w)) || topics.size === 0) {
    return ['milk', 'cattle', 'health', 'breeding', 'expense', 'revenue', 'feed', 'insurance', 'delivery', 'employee', 'report'];
  }

  // Finance = expense + revenue
  if (topics.has('finance')) { topics.add('expense'); topics.add('revenue'); }

  return [...topics];
}

async function buildFarmContext(farmId, topics) {
  // Check cache first
  const cached = getCachedData(farmId);
  if (cached) return cached;

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const prevMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const weekFromNow = new Date(); weekFromNow.setDate(weekFromNow.getDate() + 14);
  const monthFromNow = new Date(); monthFromNow.setDate(monthFromNow.getDate() + 30);

  const queries = {};

  // Always get farm info and basic cattle count
  queries.farm = Farm.findById(farmId).lean();
  queries.cattleCount = Cattle.countDocuments({ farmId, status: 'active' });

  if (topics.includes('cattle')) {
    queries.cattleByCategory = Cattle.aggregate([{ $match: { farmId, status: 'active' } }, { $group: { _id: '$category', count: { $sum: 1 } } }]);
    queries.cattleByBreed = Cattle.aggregate([{ $match: { farmId, status: 'active' } }, { $group: { _id: '$breed', count: { $sum: 1 } } }]);
    queries.recentCattle = Cattle.find({ farmId, status: 'active' }).select('tagNumber breed category gender dateOfBirth weight').sort('-createdAt').limit(25).lean();
    queries.soldDead = Cattle.aggregate([{ $match: { farmId, status: { $in: ['sold', 'dead'] } } }, { $group: { _id: '$status', count: { $sum: 1 } } }]);
  }

  if (topics.includes('milk')) {
    queries.todayMilk = MilkRecord.aggregate([
      { $match: { farmId, date: { $gte: today, $lt: tomorrow } } },
      { $group: { _id: null, total: { $sum: '$totalYield' }, morning: { $sum: '$morningYield' }, afternoon: { $sum: '$afternoonYield' }, evening: { $sum: '$eveningYield' }, count: { $sum: 1 } } },
    ]);
    queries.yesterdayMilk = MilkRecord.aggregate([
      { $match: { farmId, date: { $gte: new Date(today.getTime() - 86400000), $lt: today } } },
      { $group: { _id: null, total: { $sum: '$totalYield' } } },
    ]);
    queries.monthMilk = MilkRecord.aggregate([
      { $match: { farmId, date: { $gte: monthStart } } },
      { $group: { _id: null, total: { $sum: '$totalYield' }, count: { $sum: 1 }, avgFat: { $avg: '$morningFat' } } },
    ]);
    queries.prevMonthMilk = MilkRecord.aggregate([
      { $match: { farmId, date: { $gte: prevMonthStart, $lt: monthStart } } },
      { $group: { _id: null, total: { $sum: '$totalYield' } } },
    ]);
    queries.topCattle = MilkRecord.aggregate([
      { $match: { farmId, date: { $gte: monthStart } } },
      { $group: { _id: '$cattleId', total: { $sum: '$totalYield' }, days: { $sum: 1 }, avgMorning: { $avg: '$morningYield' }, avgEvening: { $avg: '$eveningYield' } } },
      { $sort: { total: -1 } }, { $limit: 5 },
      { $lookup: { from: 'cattles', localField: '_id', foreignField: '_id', as: 'cattle' } },
      { $unwind: '$cattle' },
    ]);
    queries.lowCattle = MilkRecord.aggregate([
      { $match: { farmId, date: { $gte: monthStart } } },
      { $group: { _id: '$cattleId', total: { $sum: '$totalYield' }, days: { $sum: 1 } } },
      { $sort: { total: 1 } }, { $limit: 3 },
      { $lookup: { from: 'cattles', localField: '_id', foreignField: '_id', as: 'cattle' } },
      { $unwind: '$cattle' },
    ]);
    queries.weeklyTrend = MilkRecord.aggregate([
      { $match: { farmId, date: { $gte: new Date(today.getTime() - 7 * 86400000) } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } }, total: { $sum: '$totalYield' } } },
      { $sort: { _id: 1 } },
    ]);
  }

  if (topics.includes('health')) {
    queries.upcomingHealth = HealthRecord.find({
      farmId, nextDueDate: { $gte: new Date(), $lte: weekFromNow },
    }).populate('cattleId', 'tagNumber breed').sort('nextDueDate').limit(10).lean();
    queries.overdueHealth = HealthRecord.find({
      farmId, nextDueDate: { $lt: new Date(), $gte: new Date(Date.now() - 30 * 86400000) },
    }).populate('cattleId', 'tagNumber breed').sort('nextDueDate').limit(10).lean();
    queries.monthHealthCount = HealthRecord.aggregate([
      { $match: { farmId, date: { $gte: monthStart } } },
      { $group: { _id: '$type', count: { $sum: 1 }, totalCost: { $sum: '$cost' } } },
    ]);
  }

  if (topics.includes('breeding')) {
    queries.activeBreeding = BreedingRecord.find({
      farmId, status: { $in: ['bred', 'confirmed'] },
    }).populate('cattleId', 'tagNumber breed').sort('expectedDelivery').limit(10).lean();
    queries.upcomingDeliveries = BreedingRecord.find({
      farmId, status: { $in: ['bred', 'confirmed'] },
      expectedDelivery: { $gte: new Date(), $lte: monthFromNow },
    }).populate('cattleId', 'tagNumber breed').sort('expectedDelivery').lean();
    queries.recentDeliveries = BreedingRecord.find({
      farmId, status: 'delivered',
      actualDelivery: { $gte: new Date(Date.now() - 30 * 86400000) },
    }).populate('cattleId', 'tagNumber breed').sort('-actualDelivery').limit(5).lean();
    queries.breedingStats = BreedingRecord.aggregate([
      { $match: { farmId, breedingDate: { $gte: new Date(Date.now() - 365 * 86400000) } } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);
  }

  if (topics.includes('expense')) {
    queries.monthExpenses = Expense.aggregate([
      { $match: { farmId, date: { $gte: monthStart } } },
      { $group: { _id: '$category', total: { $sum: '$amount' }, count: { $sum: 1 } } },
      { $sort: { total: -1 } },
    ]);
    queries.prevMonthExpenses = Expense.aggregate([
      { $match: { farmId, date: { $gte: prevMonthStart, $lt: monthStart } } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);
  }

  if (topics.includes('revenue')) {
    queries.monthRevenue = Revenue.aggregate([
      { $match: { farmId, date: { $gte: monthStart } } },
      { $group: { _id: '$category', total: { $sum: '$amount' }, count: { $sum: 1 } } },
      { $sort: { total: -1 } },
    ]);
    queries.prevMonthRevenue = Revenue.aggregate([
      { $match: { farmId, date: { $gte: prevMonthStart, $lt: monthStart } } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);
  }

  if (topics.includes('feed')) {
    queries.monthFeed = FeedRecord.aggregate([
      { $match: { farmId, date: { $gte: monthStart } } },
      { $group: { _id: '$feedType', totalQty: { $sum: '$quantity' }, totalCost: { $sum: '$cost' }, entries: { $sum: 1 } } },
      { $sort: { totalCost: -1 } },
    ]);
  }

  // Milk Delivery (Dudh Khata)
  if (topics.includes('delivery')) {
    queries.activeCustomers = Customer.countDocuments({ farmId, status: 'active' });
    queries.totalCustomerDue = Customer.aggregate([
      { $match: { farmId, status: 'active' } },
      { $group: { _id: null, totalBalance: { $sum: '$balance' }, totalDailyQty: { $sum: '$dailyQuantity' } } },
    ]);
    queries.monthDeliveries = MilkDelivery.aggregate([
      { $match: { farmId, date: { $gte: monthStart } } },
      { $group: { _id: null, totalQty: { $sum: '$quantity' }, totalAmt: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]);
    queries.monthCustPayments = CustomerPayment.aggregate([
      { $match: { farmId, date: { $gte: monthStart } } },
      { $group: { _id: null, totalPaid: { $sum: '$amount' } } },
    ]);
    queries.topDueCustomers = Customer.find({ farmId, status: 'active', balance: { $gt: 0 } }).sort('-balance').limit(5).select('name balance dailyQuantity').lean();
  }

  // Employees
  if (topics.includes('employee')) {
    queries.activeEmployees = Employee.countDocuments({ farmId, status: 'active' });
    queries.totalSalaryBill = Employee.aggregate([
      { $match: { farmId, status: 'active' } },
      { $group: { _id: null, totalSalary: { $sum: '$monthlySalary' }, totalAdvance: { $sum: '$totalAdvance' } } },
    ]);
    queries.todayAttendance = Attendance.aggregate([
      { $match: { farmId, date: today } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);
    queries.employeeRoles = Employee.aggregate([
      { $match: { farmId, status: 'active' } },
      { $group: { _id: '$role', count: { $sum: 1 }, avgSalary: { $avg: '$monthlySalary' } } },
    ]);
  }

  // Insurance
  try {
    const Insurance = (await import('../models/Insurance.js')).default;
    queries.activeInsurance = Insurance.countDocuments({ farmId, status: 'active' });
    queries.expiringInsurance = Insurance.find({
      farmId, status: 'active', endDate: { $lte: new Date(Date.now() + 30 * 86400000) }
    }).populate('cattleId', 'tagNumber').limit(5).lean();
  } catch {}

  // Execute all queries in parallel (with error resilience)
  const keys = Object.keys(queries);
  const results = await Promise.allSettled(Object.values(queries));
  const data = {};
  keys.forEach((k, i) => {
    data[k] = results[i].status === 'fulfilled' ? results[i].value : null;
  });

  // ─── Build context string ───
  const lines = [];
  lines.push(`=== FARM DATA (Live, ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'full', timeStyle: 'short' })}) ===`);
  lines.push(`Farm: ${data.farm?.name || 'Unknown'} | Active Cattle: ${data.cattleCount}`);

  try { if (topics.includes('cattle') && data.cattleByCategory) {
    lines.push(`\n📊 CATTLE:`);
    lines.push(`By Category: ${data.cattleByCategory.map(c => `${c._id}: ${c.count}`).join(', ') || 'None'}`);
    lines.push(`By Breed: ${data.cattleByBreed?.map(c => `${c._id}: ${c.count}`).join(', ') || 'None'}`);
    if (data.soldDead?.length) lines.push(`Sold/Dead: ${data.soldDead.map(c => `${c._id}: ${c.count}`).join(', ')}`);
    if (data.recentCattle?.length) {
      lines.push(`Cattle List: ${data.recentCattle.map(c => `Tag ${c.tagNumber}(${c.breed},${c.category},${c.gender}${c.weight ? ','+c.weight+'kg' : ''})`).join('; ')}`);
    }
  } } catch(e) { /* cattle context failed */ }

  try { if (topics.includes('milk')) {
    const td = data.todayMilk?.[0] || { total: 0, morning: 0, afternoon: 0, evening: 0, count: 0 };
    const yd = data.yesterdayMilk?.[0]?.total || 0;
    const mm = data.monthMilk?.[0] || { total: 0, count: 0 };
    const pm = data.prevMonthMilk?.[0]?.total || 0;
    const change = yd > 0 ? ((td.total - yd) / yd * 100).toFixed(1) : 'N/A';
    const monthChange = pm > 0 ? ((mm.total - pm) / pm * 100).toFixed(1) : 'N/A';

    lines.push(`\n🥛 MILK:`);
    lines.push(`Today: ${td.total.toFixed(1)}L (M:${td.morning.toFixed(1)} A:${td.afternoon.toFixed(1)} E:${td.evening.toFixed(1)}) — ${td.count} cattle | vs Yesterday: ${change}%`);
    lines.push(`This Month: ${mm.total.toFixed(1)}L | Last Month: ${pm.toFixed(1)}L | Change: ${monthChange}%`);

    if (data.weeklyTrend?.length) {
      lines.push(`7-Day Trend: ${data.weeklyTrend.map(d => `${d._id.slice(5)}:${d.total.toFixed(0)}L`).join(', ')}`);
    }
    if (data.topCattle?.length) {
      lines.push(`🏆 Top Producers: ${data.topCattle.map((c, i) => `${i + 1}.Tag ${c.cattle.tagNumber}(${c.cattle.breed})=${c.total.toFixed(1)}L/${c.days}d, avg ${(c.total / c.days).toFixed(1)}L/d`).join('; ')}`);
    }
    if (data.lowCattle?.length) {
      lines.push(`⚠️ Low Producers: ${data.lowCattle.map(c => `Tag ${c.cattle.tagNumber}=${c.total.toFixed(1)}L/${c.days}d`).join('; ')}`);
    }
  } } catch(e) { /* milk context failed */ }

  try { if (topics.includes('health')) {
    lines.push(`\n💉 HEALTH:`);
    if (data.monthHealthCount?.length) {
      lines.push(`This Month: ${data.monthHealthCount.map(h => `${h._id}: ${h.count} (₹${h.totalCost})`).join(', ')}`);
    }
    if (data.overdueHealth?.length) {
      lines.push(`🚨 OVERDUE: ${data.overdueHealth.map(h => `Tag ${h.cattleId?.tagNumber}: ${h.description} was due ${new Date(h.nextDueDate).toLocaleDateString('en-IN')}`).join('; ')}`);
    }
    if (data.upcomingHealth?.length) {
      lines.push(`Upcoming (14d): ${data.upcomingHealth.map(h => `Tag ${h.cattleId?.tagNumber}: ${h.description} due ${new Date(h.nextDueDate).toLocaleDateString('en-IN')}`).join('; ')}`);
    } else {
      lines.push(`No upcoming vaccinations ✅`);
    }
  } } catch(e) { /* health context failed */ }

  try { if (topics.includes('breeding')) {
    lines.push(`\n🐣 BREEDING:`);
    if (data.breedingStats?.length) {
      lines.push(`Year Stats: ${data.breedingStats.map(b => `${b._id}: ${b.count}`).join(', ')}`);
    }
    if (data.upcomingDeliveries?.length) {
      lines.push(`🔜 Deliveries (30d): ${data.upcomingDeliveries.map(b => `Tag ${b.cattleId?.tagNumber}: ${b.status}, exp ${new Date(b.expectedDelivery).toLocaleDateString('en-IN')}`).join('; ')}`);
    }
    if (data.recentDeliveries?.length) {
      lines.push(`Recent Births: ${data.recentDeliveries.map(b => `Tag ${b.cattleId?.tagNumber}: delivered ${new Date(b.actualDelivery).toLocaleDateString('en-IN')}${b.offspring ? ', offspring: ' + b.offspring : ''}`).join('; ')}`);
    }
    if (data.activeBreeding?.length) {
      lines.push(`Active: ${data.activeBreeding.map(b => `Tag ${b.cattleId?.tagNumber}(${b.method},${b.status})`).join('; ')}`);
    }
  } } catch(e) { /* breeding context failed */ }

  try { if (topics.includes('expense') || topics.includes('revenue')) {
    const totalExpF = data.monthExpenses?.reduce((s, e) => s + e.total, 0) || 0;
    const totalRevF = data.monthRevenue?.reduce((s, r) => s + r.total, 0) || 0;
    const prevExp = data.prevMonthExpenses?.[0]?.total || 0;
    const prevRev = data.prevMonthRevenue?.[0]?.total || 0;
    const profit = totalRevF - totalExpF;

    lines.push(`\n💰 FINANCE (This Month):`);
    lines.push(`Revenue: ₹${totalRevF.toLocaleString('en-IN')} (last month: ₹${prevRev.toLocaleString('en-IN')})`);
    if (data.monthRevenue?.length) lines.push(`  Sources: ${data.monthRevenue.map(r => `${r._id.replace('_', ' ')}: ₹${r.total.toLocaleString('en-IN')}`).join(', ')}`);
    lines.push(`Expense: ₹${totalExpF.toLocaleString('en-IN')} (last month: ₹${prevExp.toLocaleString('en-IN')})`);
    if (data.monthExpenses?.length) lines.push(`  Breakdown: ${data.monthExpenses.map(e => `${e._id}: ₹${e.total.toLocaleString('en-IN')}(${e.count})`).join(', ')}`);
    lines.push(`Net Profit: ₹${profit.toLocaleString('en-IN')} ${profit >= 0 ? '📈' : '📉'}`);
  } } catch(e) { /* finance context failed */ }

  try { if (topics.includes('feed') && data.monthFeed?.length) {
    const totalFeedCostF = data.monthFeed.reduce((s, f) => s + f.totalCost, 0);
    lines.push(`\n🌾 FEED (This Month): Total ₹${totalFeedCostF.toLocaleString('en-IN')}`);
    lines.push(`Types: ${data.monthFeed.map(f => `${f._id}: ${f.totalQty}kg, ₹${f.totalCost.toLocaleString('en-IN')}`).join('; ')}`);
  } } catch(e) { /* feed context failed */ }

  // ─── Smart alerts ───
  const alerts = [];
  if (data.overdueHealth?.length) alerts.push(`🚨 ${data.overdueHealth.length} overdue vaccination(s)!`);
  if (data.upcomingDeliveries?.length) alerts.push(`🐣 ${data.upcomingDeliveries.length} delivery expected within 30 days`);
  if (data.lowCattle?.length) {
    const low = data.lowCattle.filter(c => c.days > 3 && c.total / c.days < 3);
    if (low.length) alerts.push(`⚠️ ${low.length} cattle producing <3L/day avg — check health`);
  }
  const totalExp = data.monthExpenses?.reduce((s, e) => s + e.total, 0) || 0;
  const totalRev = data.monthRevenue?.reduce((s, r) => s + r.total, 0) || 0;
  if (totalExp > totalRev && totalExp > 0) alerts.push(`📉 Expenses (₹${totalExp}) exceeding revenue (₹${totalRev}) this month`);
  const custDue = data.totalCustomerDue?.[0]?.totalBalance || 0;
  if (custDue > 5000) alerts.push(`💸 ₹${custDue.toLocaleString('en-IN')} outstanding from milk customers — consider collecting`);
  const attAbsent = (data.todayAttendance || []).find(a => a._id === 'absent')?.count || 0;
  if (attAbsent > 0) alerts.push(`👷 ${attAbsent} employee(s) absent today`);

  // ─── Trend detection & anomaly alerts ───
  const weeklyTrend = data.weeklyTrend || [];
  if (weeklyTrend.length >= 3) {
    const last3 = weeklyTrend.slice(-3);
    if (last3[0].total > last3[1].total && last3[1].total > last3[2].total) {
      alerts.push('📉 Milk production declining for 3 consecutive days — investigate feed/health');
    }
  }

  const totalFeedCost = data.monthFeed?.reduce((s, f) => s + f.totalCost, 0) || 0;
  if (totalFeedCost > 0 && totalRev > 0 && totalFeedCost / totalRev > 0.4) {
    alerts.push(`⚠️ Feed cost is ${(totalFeedCost/totalRev*100).toFixed(0)}% of revenue — optimize feed mix`);
  }

  if (data.expiringInsurance?.length) {
    alerts.push(`🛡️ ${data.expiringInsurance.length} insurance policy expiring within 30 days — renew soon`);
  }

  if (alerts.length) {
    lines.push(`\n⚡ ALERTS: ${alerts.join(' | ')}`);
  }

  // ─── Computed analytics ───
  try {
    const activeCattle = data.cattleCount || 0;
    const monthMilkTotal = data.monthMilk?.[0]?.total || 0;
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const daysElapsed = Math.max(today.getDate(), 1);
    const milkingCattle = data.topCattle?.length || activeCattle || 1;
    const mDel = data.monthDeliveries?.[0] || { totalAmt: 0 };
    const mPay = data.monthCustPayments?.[0] || { totalPaid: 0 };
    const totalSalary = data.totalSalaryBill?.[0]?.totalSalary || 0;

    const avgMilkPerCow = milkingCattle > 0 ? (monthMilkTotal / milkingCattle / daysElapsed).toFixed(1) : 'N/A';
    const feedCostPerLiter = monthMilkTotal > 0 ? (totalFeedCost / monthMilkTotal).toFixed(1) : 'N/A';
    const revenuePerCow = activeCattle > 0 ? Math.round(totalRev / activeCattle) : 'N/A';
    const expensePerCowDay = activeCattle > 0 ? (totalExp / activeCattle / daysElapsed).toFixed(1) : 'N/A';
    const collectionEff = mDel.totalAmt > 0 ? ((mPay.totalPaid / mDel.totalAmt) * 100).toFixed(1) : 'N/A';
    const salaryToRevenue = totalRev > 0 ? ((totalSalary / totalRev) * 100).toFixed(1) : 'N/A';
    const avgDailyMilk = daysElapsed > 0 ? monthMilkTotal / daysElapsed : 0;
    const projectedMonthMilk = (avgDailyMilk * daysInMonth).toFixed(0);
    const dailyAvgRevenue = daysElapsed > 0 ? (totalRev / daysElapsed).toFixed(0) : 0;
    const dailyAvgExpense = daysElapsed > 0 ? (totalExp / daysElapsed).toFixed(0) : 0;
    const projectedProfit = Math.round((dailyAvgRevenue - dailyAvgExpense) * daysInMonth);

    lines.push(`\n📈 COMPUTED ANALYTICS:`);
    lines.push(`Avg Milk Per Cow/Day: ${avgMilkPerCow}L | Feed Cost Per Liter: ₹${feedCostPerLiter}`);
    lines.push(`Revenue Per Cow/Month: ₹${revenuePerCow} | Expense Per Cow/Day: ₹${expensePerCowDay}`);
    lines.push(`Collection Efficiency: ${collectionEff}% | Salary-to-Revenue: ${salaryToRevenue}%`);
    lines.push(`Projected Month Milk: ${projectedMonthMilk}L | Projected Month Profit: ₹${projectedProfit.toLocaleString('en-IN')}`);
    lines.push(`Daily Avg Revenue: ₹${Number(dailyAvgRevenue).toLocaleString('en-IN')} | Daily Avg Expense: ₹${Number(dailyAvgExpense).toLocaleString('en-IN')}`);
  } catch (e) {
    // Analytics computation failed silently
  }

  // Milk Delivery context
  try { if (topics.includes('delivery') && (data.activeCustomers > 0 || data.monthDeliveries?.[0])) {
    const custDueD = data.totalCustomerDue?.[0] || { totalBalance: 0, totalDailyQty: 0 };
    const mDelD = data.monthDeliveries?.[0] || { totalQty: 0, totalAmt: 0, count: 0 };
    const mPayD = data.monthCustPayments?.[0] || { totalPaid: 0 };
    lines.push(`\n🏘️ DUDH KHATA (Milk Delivery):`);
    lines.push(`Active Customers: ${data.activeCustomers || 0} | Daily Delivery: ${custDueD.totalDailyQty.toFixed(1)}L`);
    lines.push(`This Month: ${mDelD.totalQty.toFixed(1)}L delivered | ₹${mDelD.totalAmt.toFixed(0)} billed | ₹${mPayD.totalPaid.toFixed(0)} collected`);
    lines.push(`Outstanding Due: ₹${custDueD.totalBalance.toFixed(0)}`);
    if (data.topDueCustomers?.length) {
      lines.push(`Top Dues: ${data.topDueCustomers.map(c => `${c.name}: ₹${c.balance.toFixed(0)}`).join(', ')}`);
    }
  } } catch(e) { /* delivery context failed */ }

  // Employee context
  try { if (topics.includes('employee') && (data.activeEmployees > 0)) {
    const sal = data.totalSalaryBill?.[0] || { totalSalary: 0, totalAdvance: 0 };
    const attMap = {};
    (data.todayAttendance || []).forEach(a => { attMap[a._id] = a.count; });
    lines.push(`\n👷 EMPLOYEES:`);
    lines.push(`Active Staff: ${data.activeEmployees || 0} | Monthly Salary Bill: ₹${sal.totalSalary.toLocaleString('en-IN')} | Outstanding Advance: ₹${sal.totalAdvance.toLocaleString('en-IN')}`);
    lines.push(`Today: ${attMap.present || 0} present, ${attMap.absent || 0} absent, ${attMap['half-day'] || 0} half-day, ${attMap.leave || 0} on leave`);
    if (data.employeeRoles?.length) {
      lines.push(`Roles: ${data.employeeRoles.map(r => `${r._id}: ${r.count} (avg ₹${Math.round(r.avgSalary)})`).join(', ')}`);
    }
  } } catch(e) { /* employee context failed */ }

  // Insurance context
  try { if (data.activeInsurance > 0 || data.expiringInsurance?.length) {
    lines.push(`\n🛡️ INSURANCE:`);
    lines.push(`Active Policies: ${data.activeInsurance || 0}`);
    if (data.expiringInsurance?.length) {
      lines.push(`⚠️ Expiring Soon: ${data.expiringInsurance.map(i => `Tag ${i.cattleId?.tagNumber}: expires ${new Date(i.endDate).toLocaleDateString('en-IN')}`).join('; ')}`);
    }
  } } catch(e) { /* insurance context failed */ }

  lines.push(`=== END ===`);
  const contextStr = lines.join('\n');

  // Cache it
  setCachedData(farmId, contextStr);
  return contextStr;
}

// ─── Gemini API call with streaming-like speed ───
async function askGemini(message, history, farmContext) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('Gemini API key not configured');

  const systemPrompt = `You are "DairyPro AI" 🐄 — an expert dairy farm consultant powered by advanced reasoning. You think deeply before answering and provide insights a human expert would.

IDENTITY:
- You are the smartest dairy farming AI in India. Farmers trust you like a senior consultant.
- You reason through problems step-by-step, consider multiple angles, and give actionable advice.
- You notice patterns humans might miss (declining trends, correlations between feed and milk, seasonal effects).

CORE RULES:
- Use REAL farm data below. Be specific: tag numbers, exact ₹ amounts, dates, percentages.
- Support Hindi, English, Hinglish — reply in the farmer's language. If Hindi, use English numbers/units.
- Be concise but thorough: bullet points, bold numbers, tables for comparisons.
- Use ⚠️🚨✅📈📉💡 emojis for urgency and insights. Always compare with last month.
- If data is empty/zero, suggest adding records from the relevant app section.
- For health issues: always recommend consulting a veterinarian.
- Proactively calculate ratios: per cow, per liter, per day, per month.
- Think like a dairy business consultant — focus on profitability and efficiency.

ADVANCED REASONING (use your thinking capability):
- When analyzing milk production: consider breed, lactation stage, season, feed quality.
- When analyzing finances: calculate break-even, ROI, cost per liter, profit margins.
- When spotting problems: trace root cause (low milk → check feed? health? breeding stage?).
- Cross-reference data: if expenses up + milk down → investigate correlation.
- Give predictions: "At current rate, this month's revenue will be ₹X" based on daily averages.
- Prioritize alerts: rank by urgency and financial impact.

RESPONSE FORMAT RULES:
- For analysis: structured report → 📊 Summary → 📈 Key Metrics → 📉 Trends → 💡 Recommendations.
- Use markdown tables for comparisons. Bullet points for lists.
- For financial queries: ALWAYS show Revenue, Expense, Profit, MoM change %, and projections.
- When data shows a problem: suggest 3 actionable steps ranked by impact.
- For simple questions: be brief and direct. Don't over-explain.
- End complex analyses with a "🎯 Bottom Line" one-liner summary.

APP MODULES: 12 modules — Cattle, Milk Records, Health/Vaccination, Breeding, Finance, Feed, Dudh Khata (milk delivery), Employees, Insurance, Reports (10+ dashboards), AI Assistant (you), Settings.
Features: Custom Plan Builder, Razorpay payments (UPI/cards/wallets), data export, admin panel, dynamic branding.

NAVIGATION (guide users): Cattle→+Add, Milk Records→Add entry, Health→Add record, Breeding→Track, Finance→Revenue/Expense, Feed→Add, Dudh Khata→Customers/Deliveries/Payments, Employees→Attendance/Salary, Insurance→Add policy, Reports→10 tabs, Settings→Backup/Profile, Subscription→Plans/Pay.

INDIAN DAIRY EXPERTISE:
- Breeds: Gir, Sahiwal, Murrah, HF, Jersey, Crossbred (know typical yields)
- Cooperative systems (Amul model, fat/SNF pricing: qty × fat% × rate)
- Govt schemes: DEDS, NDP, Rashtriya Gokul Mission, Pashu Dhan Bima, KCC
- Seasons: summer heat stress, monsoon fodder, winter peak milk
- Diseases: FMD, HS, BQ, Mastitis, Theileriosis (vaccination schedules)
- Feed: Napier, Berseem, Lucerne, dry fodder, concentrates, mineral mix

SMART BEHAVIOR:
- Spot trends, flag problems, give tips, highlight top producers
- Lactation analysis (DIM, 305-day standard), heat prediction (21-day cycle)
- Break-even analysis, seasonal comparison, cost per animal per day
- Dudh Khata: collection rate, payment reminders, customer strategy
- Employee: attendance patterns, salary analysis, absenteeism trends

${farmContext}`;

  const contents = [];

  // Last 15 messages for deep context (2.5 Flash has 1M token window)
  if (history?.length) {
    for (const msg of history.slice(-15)) {
      contents.push({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }],
      });
    }
  }

  contents.push({ role: 'user', parts: [{ text: message }] });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);
  const startTime = Date.now();

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents,
          generationConfig: {
            temperature: 0.5,
            maxOutputTokens: 8000,
            topP: 0.95,
            topK: 64,
          },
          safetySettings: [
            { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
          ],
        }),
      }
    );

    // Retry once on 429 (rate limit) with 2s delay
    if (response.status === 429) {
      console.warn('[DairyPro AI] Rate limited, retrying in 2s...');
      await new Promise(r => setTimeout(r, 2000));
      const retry = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: systemPrompt }] },
            contents,
            generationConfig: { temperature: 0.5, maxOutputTokens: 8000, topP: 0.95, topK: 64 },
            safetySettings: [
              { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
              { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
              { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
              { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
            ],
          }),
        }
      );
      if (retry.ok) {
        const retryData = await retry.json();
        const retryReply = retryData.candidates?.[0]?.content?.parts?.[0]?.text;
        if (retryReply) return retryReply;
      }
      throw new Error('🤖 AI assistant is busy right now. Please wait 30 seconds and try again. Meanwhile, use quick commands like /help, /milk, /alerts!');
    }

    if (!response.ok) {
      const err = await response.text();
      console.error('Gemini error:', response.status, err.slice(0, 200));
      throw new Error(`Gemini API error (${response.status})`);
    }

    const respData = await response.json();
    const reply = respData.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!reply) throw new Error('Empty AI response');

    const elapsed = Date.now() - startTime;
    console.log(`[DairyPro AI] Query processed in ${elapsed}ms`);

    return reply;
  } catch (err) {
    if (err.name === 'AbortError') {
      const elapsed = Date.now() - startTime;
      console.warn(`[DairyPro AI] Request timed out after ${elapsed}ms`);
      throw new Error('AI response timed out — please try a simpler question');
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

// ─── Quick commands (instant, no AI call) ───
function handleQuickCommand(message, farmContext) {
  const lower = message.trim().toLowerCase();

  // Help command - return formatted list of all quick commands
  if (lower === '/help' || lower === 'help') {
    return `🤖 **DairyPro AI Quick Commands:**

**📊 Farm Status:**
- **/alerts** — Active farm alerts & warnings
- **/milk** — Today's milk production summary
- **/cattle** — Cattle overview by category & breed
- **/health** — Health records & vaccination status
- **/breeding** — Breeding status & upcoming deliveries
- **/feed** — Feed consumption & costs
- **/finance** — Revenue, expenses & profit/loss
- **/staff** — Employee status & attendance
- **/dues** — Customer outstanding dues (Dudh Khata)
- **/insurance** — Insurance policy status

**🔧 App Info:**
- **/modules** — List all 12 app modules
- **/help** — This help menu

**🧠 What I Can Do:**
✅ Real-time farm data analysis with exact numbers
✅ Smart alerts (overdue vaccines, low yield, high dues)
✅ Milk production trends & per-cow efficiency
✅ Feed cost per liter calculation
✅ Revenue per cow & break-even analysis
✅ Breeding cycle predictions & conception rates
✅ Employee salary & attendance insights
✅ Customer payment collection strategy
✅ Indian govt scheme guidance (DEDS, PMFBY, KCC)
✅ Hindi, English & Hinglish support

Just ask anything in natural language! 🐄`;
  }

  // Modules command - return list of all 12 modules
  if (lower === '/modules') {
    return `📋 **DairyPro App Modules (12 Total):**

1. 🐄 **Cattle Management** — Add/manage cattle with full profiles
2. 🥛 **Milk Records** — Track daily yield with fat/SNF analysis
3. 💉 **Health & Vaccination** — Medical records & reminder system
4. 🐣 **Breeding** — AI/natural breeding & pregnancy tracking
5. 💰 **Finance** — Revenue/expense tracking with profit analysis
6. 🌾 **Feed Management** — Feed costs & quantity optimization
7. 🏘️ **Dudh Khata** — Milk delivery & customer payment system
8. 👷 **Employees** — Staff management & attendance tracking
9. 🛡️ **Insurance** — Policy management & expiry alerts
10. 📊 **Reports** — 10+ interactive dashboards & analytics
11. 🤖 **AI Assistant** — That's me! Smart farming insights
12. ⚙️ **Settings** — Farm profile & system configuration

💡 **New:** Custom Plan Builder lets you pay only for modules you need!`;
  }

  // Direct shortcuts for ultra-fast response
  if (lower === '/alerts' || lower === 'alerts') {
    const alertMatch = farmContext.match(/⚡ ALERTS: (.+)/);
    return alertMatch ? `⚡ **Active Alerts:**\n${alertMatch[1].split(' | ').map(a => `- ${a}`).join('\n')}` : '✅ No active alerts! Your farm is running smoothly.';
  }
  if (lower === '/milk' || lower === 'aaj ka dudh') {
    const milkMatch = farmContext.match(/Today: (.+?)(?:\n|$)/);
    return milkMatch ? `🥛 **Today's Milk:** ${milkMatch[1]}` : '🥛 No milk data recorded today. Add records from Milk section.';
  }

  if (lower === '/staff' || lower === '/employees') {
    const staffMatch = farmContext.match(/👷 EMPLOYEES:\n(.+?)(?:\n[^A-Za-z]|$)/s);
    return staffMatch ? `👷 **Employees:**\n${staffMatch[1]}` : '👷 No employee data. Add employees from the Employees section.';
  }
  if (lower === '/dues' || lower === '/khata') {
    const khataMatch = farmContext.match(/🏘️ DUDH KHATA[^:]*:\n([\s\S]+?)(?:\n[^A-Za-z]|\n⚡|\n===|$)/);
    return khataMatch ? `🏘️ **Dudh Khata:**\n${khataMatch[1].trim()}` : '🏘️ No milk delivery data. Add customers from Dudh Khata section.';
  }

  if (lower === '/finance' || lower === '/profit' || lower === '/hisab') {
    const finMatch = farmContext.match(/💰 FINANCE[^:]*:\n([\s\S]+?)(?:\n🌾|\n⚡|\n🏘️|\n👷|\n🛡️|\n===|$)/);
    return finMatch ? `💰 **Finance:**\n${finMatch[1].trim()}` : '💰 No finance data. Add expenses/revenue from Finance section.';
  }

  if (lower === '/cattle' || lower === '/pashu') {
    const cattleMatch = farmContext.match(/📊 CATTLE:\n([\s\S]+?)(?:\n🥛|\n💉|\n⚡|\n===|$)/);
    return cattleMatch ? `🐄 **Cattle:**\n${cattleMatch[1].trim()}` : '🐄 No cattle data. Add cattle from Cattle section.';
  }

  if (lower === '/health' || lower === '/vaccine') {
    const healthMatch = farmContext.match(/💉 HEALTH:\n([\s\S]+?)(?:\n🐣|\n💰|\n⚡|\n===|$)/);
    return healthMatch ? `💉 **Health:**\n${healthMatch[1].trim()}` : '💉 No health records. Add records from Health section.';
  }

  if (lower === '/breeding' || lower === '/garbh') {
    const breedMatch = farmContext.match(/🐣 BREEDING:\n([\s\S]+?)(?:\n💰|\n🌾|\n⚡|\n===|$)/);
    return breedMatch ? `🐣 **Breeding:**\n${breedMatch[1].trim()}` : '🐣 No breeding records. Add records from Breeding section.';
  }

  if (lower === '/feed' || lower === '/chara') {
    const feedMatch = farmContext.match(/🌾 FEED[^:]*:\n?([\s\S]+?)(?:\n⚡|\n🏘️|\n👷|\n🛡️|\n===|$)/);
    return feedMatch ? `🌾 **Feed:**\n${feedMatch[1].trim()}` : '🌾 No feed records. Add records from Feed section.';
  }

  if (lower === '/insurance' || lower === '/bima') {
    const insMatch = farmContext.match(/🛡️ INSURANCE:\n([\s\S]+?)(?:\n⚡|\n===|$)/);
    return insMatch ? `🛡️ **Insurance:**\n${insMatch[1].trim()}` : '🛡️ No insurance data. Add policies from Insurance section.';
  }

  if (lower === '/summary' || lower === '/farm' || lower === 'farm status') {
    return null; // Let AI handle full summary for richer response
  }

  return null; // Not a quick command
}

// ─── Smart Local Fallback Engine (works without AI) ───
// This is a comprehensive conversational + data engine that handles:
// 1. Greetings & general chat
// 2. Dairy farming knowledge (breeds, diseases, feed, govt schemes, etc.)
// 3. Farm-specific data queries with real-time data
// 4. Advice & recommendations based on farm data

// ── Dairy Knowledge Base ──
const DAIRY_KNOWLEDGE = {
  // Greetings
  greetings: {
    patterns: ['hello', 'hi', 'hey', 'namaste', 'namaskar', 'good morning', 'good evening', 'good afternoon', 'good night', 'shubh', 'pranam', 'jai hind', 'ram ram', 'sat sri akal', 'kaise ho', 'kya haal', 'how are you', 'wassup', 'sup', 'hlo', 'hii', 'hiii'],
    responses: [
      "Namaste! 🐄 Main hoon aapka **DairyPro AI Assistant**. Aapki farm ke baare mein kuch bhi poochho — milk, cattle, health, finance — sab data mere paas hai!\n\n💡 Try: *\"aaj ka dudh kitna hai?\"* ya *\"farm ka haal batao\"*",
      "Hello! 🙏 Welcome to **DairyPro AI**. I have complete access to your farm data — cattle, milk records, health, breeding, finance, employees & more.\n\nAsk me anything! For example:\n- \"Show today's milk production\"\n- \"Which cattle need vaccination?\"\n- \"Farm ka profit kitna hai?\"\n\nOr type **/help** for all commands 🐄",
      "Hey! 👋 DairyPro AI here — aapka smart dairy farming assistant!\n\nMain aapki farm ka **real-time data** dekh sakta hoon. Bataiye kya jaanna hai? 🥛\n\n⚡ Quick: /milk /cattle /health /finance /alerts",
    ],
  },

  // Thank you
  thanks: {
    patterns: ['thank', 'thanks', 'thanku', 'thnx', 'dhanyawad', 'shukriya', 'bahut accha', 'great', 'awesome', 'nice', 'perfect', 'good job', 'well done', 'helpful', 'bohot badiya'],
    responses: [
      "Shukriya! 🙏 Agar aur kuch jaanna ho toh pooch lo. Main hamesha ready hoon! 🐄",
      "Thank you! 😊 Koi bhi sawal ho farm ke baare mein — main yahan hoon. Happy farming! 🌾",
      "Glad I could help! 🐄✨ Remember, you can always type **/help** to see what all I can do!",
    ],
  },

  // Who are you
  identity: {
    patterns: ['who are you', 'kaun ho', 'kaun hai', 'kya hai tu', 'what are you', 'what can you do', 'kya kar sakta', 'tum kya ho', 'your name', 'tera naam', 'introduce', 'about you'],
    responses: [
      "Main hoon **DairyPro AI** 🐄 — aapka smart dairy farm assistant!\n\n**Mujhe pata hai:**\n- 🥛 Aapki daily milk production\n- 🐄 Saare cattle ki details\n- 💉 Vaccination & health records\n- 🐣 Breeding & pregnancy status\n- 💰 Revenue, expenses & profit\n- 🌾 Feed costs & management\n- 🏘️ Dudh delivery & customer dues\n- 👷 Employee attendance & salary\n- 🛡️ Insurance policies\n\n**Main kar sakta hoon:**\n- ✅ Real-time farm data analysis\n- ✅ Smart alerts & reminders\n- ✅ Hindi, English & Hinglish support\n- ✅ Dairy farming tips & advice\n- ✅ Govt scheme guidance\n\nBataiye, kya help chahiye? 😊",
    ],
  },

  // Goodbye
  goodbye: {
    patterns: ['bye', 'goodbye', 'alvida', 'good night', 'see you', 'tata', 'chalo', 'ok bye', 'theek hai'],
    responses: [
      "Alvida! 🙏 Apna aur apni gaay-bhains ka khayal rakhna. Jab bhi zaroorat ho, main yahan hoon! 🐄",
      "Bye! 👋 Happy farming! Koi bhi sawal ho toh wapas aa jaana. 🌾",
    ],
  },

  // How to increase milk
  increase_milk: {
    patterns: ['increase milk', 'dudh badhao', 'milk badhao', 'zyada dudh', 'jyada dudh', 'more milk', 'improve milk', 'boost milk', 'dudh kaise badhaye', 'milk production badhao', 'yield improve', 'yield badhao', 'utpadan badhao', 'dudh kam', 'milk kam', 'low milk', 'milk nahi aa raha'],
    responses: [
      "## 🥛 Dudh Badhane ke 10 Tarike\n\n### 🌾 Feed Management\n1. **Balanced diet** — 60% green fodder + 40% dry + concentrate\n2. **Mineral mixture** — Daily 50g per animal (calcium, phosphorus important)\n3. **Clean water** — 80-100 liters/day per cow (water = milk!)\n4. **Concentrate feed** — 1 kg per 2.5L milk produced above maintenance\n\n### 🏥 Health & Comfort\n5. **Deworming** — Every 3 months (parasites reduce milk 10-20%)\n6. **Mastitis check** — Test regularly, treat early\n7. **Cool shade** — Heat stress reduces milk up to 25%\n8. **Clean shed** — Hygiene prevents infections\n\n### 🐄 Management\n9. **Regular milking time** — Same time daily, 3x milking gives 10-15% more\n10. **Good breeding** — AI with proven HF/Jersey bulls for better calves\n\n### 💡 Pro Tips\n- **Ajwain water** in winter boosts digestion\n- **Soybean meal** is cheaper protein than cattle feed\n- **Napier grass** gives best green fodder yield per acre\n- Record milk daily in app to track trends!\n\n⚕️ *If sudden drop: check for fever, mastitis, or heat stress first*",
    ],
  },

  // Feed advice
  feed_advice: {
    patterns: ['what to feed', 'kya khilaye', 'best feed', 'chara kya', 'feed plan', 'diet plan', 'ration', 'khuraak', 'feed schedule', 'kya dana', 'concentrate', 'fodder', 'silage kya', 'azolla', 'napier', 'berseem', 'lucerne'],
    responses: [
      "## 🌾 Ideal Feed Plan for Dairy Cattle\n\n### Daily Ration (per milking cow):\n\n| Feed Type | Quantity | Purpose |\n|-----------|----------|--------|\n| 🟢 Green Fodder | 25-30 kg | Energy + vitamins |\n| 🟤 Dry Fodder | 5-6 kg | Fiber for digestion |\n| 🟡 Concentrate | 1 kg per 2.5L milk | Protein + energy |\n| 💊 Mineral Mix | 50g | Calcium, phosphorus |\n| 🧂 Salt | 30g | Electrolytes |\n| 💧 Water | 80-100L | Essential |\n\n### Best Green Fodder Options:\n- **Napier/Elephant Grass** — Highest yield, grows year-round\n- **Berseem** — Best winter fodder, high protein\n- **Lucerne (Alfalfa)** — Premium protein, good for high yielders\n- **Maize/Jowar** — Good energy, makes great silage\n\n### Concentrate Mix (Home-made, cheaper!):\n- Maize/Barley — 35%\n- Mustard Cake — 25%\n- Wheat Bran — 20%\n- Rice Bran — 15%\n- Mineral Mix — 3%\n- Salt — 2%\n\n### 💡 Cost-Saving Tips:\n- Grow **Azolla** — free protein supplement (doubles in 5 days!)\n- Make **silage** from extra maize — saves monsoon fodder\n- **Urea-treated straw** — cheapest dry fodder option\n\n📝 *Track feed costs in the app's Feed section to optimize spending!*",
    ],
  },

  // Disease & health
  disease: {
    patterns: ['disease', 'bimari', 'bukhar', 'fever', 'mastitis', 'fmd', 'foot mouth', 'khurak', 'diarr', 'dast', 'bloat', 'afara', 'tick', 'kilni', 'worm', 'kida', 'pet dard', 'stomach', 'theileria', 'babesia', 'brucella', 'swelling', 'sujan', 'lameness', 'langda', 'eye', 'aankh', 'skin', 'chamdi', 'cough', 'khansi'],
    responses: [
      "## 💉 Common Cattle Diseases & First Aid\n\n### 🚨 Emergency Diseases:\n\n**Foot & Mouth Disease (FMD / Khurpaka-Munhpaka)**\n- Symptoms: Fever, blisters on mouth/feet, drooling, won't eat\n- First Aid: Wash wounds with KMnO4 (lal dawa), apply boroglycerin\n- Prevention: FMD vaccine every 6 months\n\n**Hemorrhagic Septicemia (Galghotu/HS)**\n- Symptoms: High fever, swollen throat, difficulty breathing\n- Treatment: Emergency vet needed! Antibiotic injection\n- Prevention: HS vaccine before monsoon (May-June)\n\n**Black Quarter (BQ / Lathuda)**\n- Symptoms: Sudden lameness, swelling on legs/hip, gas under skin\n- Treatment: Penicillin injection, vet emergency\n- Prevention: BQ vaccine yearly\n\n### ⚠️ Common Problems:\n\n**Mastitis (Than ki sujan)**\n- Symptoms: Swollen udder, clots in milk, pain\n- Prevention: Clean milking, teat dip, dry cow therapy\n\n**Bloat (Afara)**\n- Emergency: Trocar if severe, give vegetable oil + walking\n- Prevention: Don't feed wet legumes, give dry fodder first\n\n**Tick Fever (Theileriosis)**\n- Symptoms: High fever, swollen lymph nodes, anemia\n- Prevention: Regular tick spray/dip, keep shed clean\n\n### 📅 Vaccination Schedule:\n- **FMD** — Every 6 months\n- **HS** — Yearly (before monsoon)\n- **BQ** — Yearly\n- **Brucellosis** — Once (4-8 month female calves)\n- **Deworming** — Every 3 months\n\n⚕️ **Important:** Yeh sirf first-aid info hai. Hamesha **veterinary doctor** ko dikhayein!",
    ],
  },

  // Govt schemes
  govt_schemes: {
    patterns: ['govt scheme', 'government scheme', 'sarkari yojana', 'yojana', 'subsidy', 'loan', 'kcc', 'kisan credit', 'nabard', 'dairy loan', 'pashudhan', 'gokul mission', 'deds', 'pmfby', 'animal husbandry', 'rashtriya', 'naip', 'mudra'],
    responses: [
      "## 🏛️ Dairy Farming ke Liye Government Schemes\n\n### 💰 Major Schemes:\n\n**1. Rashtriya Gokul Mission**\n- Indigenous breed development & conservation\n- Gokul Gram, AI centers, breed improvement\n- Apply through: State Animal Husbandry Dept\n\n**2. DEDS (Dairy Entrepreneurship Development Scheme)**\n- Loan up to ₹7 lakh for dairy unit (10 animals)\n- **25% subsidy** (33% for SC/ST)\n- Through NABARD → apply at your bank\n\n**3. Kisan Credit Card (KCC)**\n- Now available for **animal husbandry** too!\n- Loan up to ₹3 lakh at **4% interest** (with subsidy)\n- Apply at any bank with land/cattle documents\n\n**4. National Livestock Mission**\n- Feed/fodder development, breed improvement\n- Entrepreneurship in poultry, sheep, goat, pig\n- Insurance subsidy for livestock\n\n**5. Pashu Dhan Bima Yojana (Livestock Insurance)**\n- Insurance at subsidized premium\n- Covers death due to disease, accident, natural calamity\n- Apply at District Animal Husbandry office\n\n### 📋 Documents Usually Needed:\n- Aadhar Card\n- Bank Account\n- Land papers (if applicable)\n- Cattle details/ear tags\n- Veterinary health certificate\n\n### 💡 How to Apply:\n1. Visit **District Animal Husbandry Office**\n2. Or apply through **nearest bank** (for DEDS/KCC)\n3. Check **state-specific schemes** — many states add extra subsidies\n\n📱 *Track all expenses in DairyPro Finance section for loan applications!*",
    ],
  },

  // Breeding advice
  breeding_advice: {
    patterns: ['when to breed', 'kab karaye', 'heat sign', 'garmi ke lakshan', 'ai kab', 'artificial insemination', 'best time breed', 'pregnancy check', 'garbh jaanch', 'calving', 'byaana', 'repeat breeding', 'not conceiving', 'garbh nahi', 'pregnancy tips', 'bull selection', 'semen', 'conception'],
    responses: [
      "## 🐣 Breeding Guide for Dairy Cattle\n\n### 🔥 Heat (Garmi) Signs:\n- Restlessness, mounting other cattle\n- Swollen, red vulva with clear mucus discharge\n- Reduced milk yield, frequent urination\n- Standing to be mounted (**standing heat** — best time for AI!)\n\n### ⏰ Best Time for AI:\n- Heat lasts **12-18 hours**\n- **AM-PM Rule:** If heat detected in morning → AI in evening\n- If heat detected in evening → AI next morning\n- Best: **12-18 hours after heat onset**\n\n### 📅 Important Numbers:\n| Parameter | Value |\n|-----------|-------|\n| Heat cycle | Every **21 days** |\n| Pregnancy duration | **280-285 days** (9 months 10 days) |\n| First breeding age | **15-18 months** (or 250-275 kg weight) |\n| After calving | Wait **60-90 days** before breeding |\n| Dry off | **60 days** before expected calving |\n\n### 🎯 Improve Conception Rate:\n1. **Correct heat detection** — observe 3 times daily\n2. **Good nutrition** — mineral mix is critical!\n3. **Healthy uterus** — treat any infection before breeding\n4. **Quality semen** — use government AI center or tested bulls\n5. **Stress-free** — don't breed in extreme heat/transport stress\n\n### ❌ Repeat Breeding (baar baar na thaharna):\n- Check for uterine infection\n- Ensure proper heat detection timing\n- Test for Brucellosis\n- Add mineral mix + Vitamin E + Selenium\n\n### 🏆 Breed Selection for AI:\n- **HF semen** — High milk (15-20L/day), needs good management\n- **Jersey** — Good fat%, moderate yield, heat tolerant\n- **Sahiwal/Gir** — Desi, hardy, A2 milk, lower yield\n- **Crossbred** — Best of both worlds for Indian conditions\n\n📝 *Record all breeding events in the app's Breeding section for tracking!*\n⚕️ *Get pregnancy confirmed by vet after 60-90 days*",
    ],
  },

  // Profit tips
  profit_tips: {
    patterns: ['profit', 'munafa', 'earn more', 'zyada kamai', 'save money', 'paise bachao', 'business tip', 'improve profit', 'loss ho raha', 'cost cutting', 'kharcha kam', 'revenue badhao', 'income badhao', 'paisa kaise', 'profitable'],
    responses: [
      "## 💰 Dairy Farm Profit Badhane ke Tips\n\n### 📈 Revenue Badhao:\n1. **Value addition** — Sell paneer, ghee, dahi instead of raw milk (2-3x margin)\n2. **Direct selling** — Sell door-to-door at ₹60-80/L instead of dairy at ₹30-35/L\n3. **A2 milk branding** — Desi cow milk sells at ₹80-120/L\n4. **Vermicompost** — Gobar se khaad banao, ₹8-12/kg\n5. **Biogas plant** — Save ₹2000-3000/month on LPG/fuel\n\n### 📉 Kharcha Kam Karo:\n1. **Grow your own fodder** — Napier grass on 0.5 acre feeds 10 cows\n2. **Homemade concentrate** — 30% cheaper than market cattle feed\n3. **Azolla cultivation** — Free protein supplement\n4. **Silage making** — Save monsoon surplus for lean months\n5. **Solar water heater** — Warm water in winter, less fuel cost\n\n### 🧠 Smart Management:\n- **Cull low producers** — Feed cost same but low milk = loss\n- **Regular deworming** — Improves milk by 10-20% instantly\n- **3x milking** — 10-15% more milk from same cow\n- **Good breeding** — Next generation should produce 20%+ more\n- **Track everything** — Use DairyPro to know exact cost per liter!\n\n### 🎯 Break-Even Formula:\n```\nCost per liter = Total monthly expense ÷ Total monthly milk (liters)\n```\nIf selling price > cost per liter → **You're profitable!** 📈\n\n💡 *Check your Finance section for real-time profit tracking*",
    ],
  },

  // Milk fat/SNF
  milk_quality: {
    patterns: ['fat', 'snf', 'fat badhao', 'fat kam', 'milk quality', 'fat percentage', 'cream', 'malai', 'dudh patla', 'thin milk', 'fat test', 'lactometer', 'adulteration'],
    responses: [
      "## 🥛 Milk Fat & SNF Guide\n\n### Normal Values:\n| Breed | Fat % | SNF % |\n|-------|-------|-------|\n| HF | 3.5-4.0 | 8.5-9.0 |\n| Jersey | 4.5-5.5 | 9.0-9.5 |\n| Sahiwal | 4.5-5.0 | 9.0-9.5 |\n| Gir | 4.5-5.2 | 9.0-9.5 |\n| Murrah Buffalo | 6.5-7.5 | 9.0-9.5 |\n\n### Fat Badhane ke Tarike:\n1. **Dry fodder increase** — More fiber = more fat\n2. **Coconut cake** — Best fat booster (500g/day)\n3. **Mustard oil cake** — Good fat + protein source\n4. **Bypass fat** — 100-150g/day for high yielders\n5. **Cotton seed** — Natural fat supplement\n6. **Evening milking** — Usually has higher fat than morning\n\n### Fat Kam Hone ke Kaaran:\n- ❌ Too much green fodder, less dry fodder\n- ❌ Acidosis (too much grain/concentrate)\n- ❌ Hot weather / heat stress\n- ❌ Early lactation (first 60 days fat is naturally lower)\n\n### 💰 Payment Formula (Cooperative):\n```\nPayment = Quantity (L) × Fat % × Rate per kg fat\n```\nExample: 10L × 4.0% × ₹8.50 = **₹340**\n\n💡 *Record fat% in Milk Records for tracking trends per cow!*",
    ],
  },

  // Calf care
  calf_care: {
    patterns: ['calf', 'bachda', 'bachhda', 'bachdi', 'newborn', 'naya janma', 'calf care', 'bacche ki', 'colostrum', 'kheej', 'calf feeding', 'calf health', 'calf growth'],
    responses: [
      "## 🍼 Calf Care Guide (Bachhde ki Dekhbhal)\n\n### First 24 Hours (CRITICAL!):\n1. **Clean nose & mouth** immediately\n2. **Colostrum (Kheej)** — Feed within **1 hour** of birth!\n   - 1/10th of body weight in first feeding\n   - Contains antibodies = life-saving immunity\n3. **Navel care** — Apply tincture iodine on navel cord\n4. **Keep warm** — Dry with clean cloth, keep in warm area\n\n### Feeding Schedule:\n| Age | Feed | Quantity |\n|-----|------|----------|\n| 0-3 days | Colostrum | 2-3L × 3 times/day |\n| 4-30 days | Whole milk | 3-4L × 2 times/day |\n| 1-3 months | Milk + calf starter | Milk 3L + start grain |\n| 3-6 months | Reduce milk, more grain | Wean by 3-4 months |\n| 6+ months | Green + dry fodder + concentrate | Full ration |\n\n### 💉 Vaccination for Calves:\n- **Deworming** — At 15 days, then monthly till 6 months\n- **FMD** — First at 4 months, booster at 5 months\n- **HS + BQ** — At 6 months\n- **Brucellosis** — Female calves: 4-8 months (one time only!)\n\n### ⚠️ Common Calf Problems:\n- **Diarrhea (Dast)** — ORS + electrolytes, keep hydrated\n- **Pneumonia** — Keep dry, avoid cold drafts\n- **Navel infection** — Daily iodine application for 3 days\n\n💡 *Add each calf to Cattle section to track growth & health from day 1!*",
    ],
  },

  // Weather / seasonal
  seasonal: {
    patterns: ['summer', 'garmi', 'winter', 'sardi', 'monsoon', 'barish', 'season', 'mausam', 'heat stress', 'cold', 'thand', 'fog', 'dhund'],
    responses: [
      "## 🌤️ Seasonal Dairy Management\n\n### ☀️ Summer (March-June):\n- **Heat stress** reduces milk 20-30%!\n- Provide **shade, fans, sprinklers**\n- Extra water — 100-120L/cow/day\n- Feed during cooler hours (early morning/night)\n- Add **electrolytes** to water\n- Light-colored shed roof reflects heat\n\n### 🌧️ Monsoon (July-September):\n- **Vaccinate before monsoon** — HS, BQ, FMD\n- Keep shed **dry and clean** — prevent hoof problems\n- Deworm all animals\n- Watch for **tick fever** (Theileriosis)\n- Make **silage** from excess green fodder\n- Prevent bloat — don't feed wet legumes directly\n\n### ❄️ Winter (November-February):\n- This is **peak milk season** — maximize production!\n- Give warm water (lukewarm, not cold)\n- Extra concentrate feed for energy\n- Protect from cold drafts, especially calves\n- Foggy conditions → respiratory problems, keep ventilated\n- Best time for **breeding** — calving will be in peak season\n\n💡 *Check your milk trends across seasons in the Reports section!*",
    ],
  },

  // App help / how to use
  app_help: {
    patterns: ['how to use', 'app kaise', 'kaise use', 'how to add', 'kaise daalu', 'feature', 'tutorial', 'guide', 'sikhao', 'settings', 'export', 'backup', 'data download'],
    responses: [
      "## 📱 DairyPro App Guide\n\n### Quick Start:\n1. **Add Cattle** → Cattle section → + button → fill details\n2. **Record Milk** → Milk Records → + → select animal → enter yield\n3. **Track Health** → Health → + → vaccination/treatment\n4. **Record Expenses** → Finance → Expense → + → enter details\n\n### 🔑 Key Features:\n- **Dashboard** — Overview of entire farm at a glance\n- **Reports** — 10+ interactive charts & analytics\n- **Dudh Khata** — Manage customer deliveries & payments\n- **Employees** — Attendance, salary, advance tracking\n- **AI Assistant** — That's me! Ask anything about your farm\n- **Notifications** — Smart alerts for vaccines, payments, etc.\n\n### 💡 Pro Tips:\n- Use **Dark Mode** 🌙 from top-right toggle\n- **Export data** to CSV from Reports section\n- Set up **notifications** to never miss vaccines\n- **Subscription** page shows your plan & all available modules\n\nKoi specific feature ke baare mein jaanna hai? Pooch lo! 😊",
    ],
  },

  // Jokes / fun
  fun: {
    patterns: ['joke', 'mazak', 'funny', 'hasa', 'laugh', 'bore', 'entertainment', 'masti', 'timepass'],
    responses: [
      "Haha! 😄 Ek dairy joke sunao?\n\n🐄 *\"Gaay ne doosri gaay se kaha — Tujhe pata hai duniya mein sabse zyada kya bechte hain? DUDH! Aur sabse zyada kya peete hain? Bhi DUDH!\"* 😂\n\n...Okay okay, main farming mein better hoon jokes se 😅\n\nChalo kuch useful karte hain — **/alerts** se farm check karo ya koi sawal poocho! 🐄",
      "😄 You know what?\n\n*A good dairy farmer is like a good DJ — both know the importance of good CULTURE!* 🎵🐄\n\n(Yogurt culture... get it? 😅)\n\nAnyway, let's get back to farming! Kya jaanna hai? 🌾",
    ],
  },
};

// ── Conversational matcher ──
function matchConversation(message) {
  const lower = message.toLowerCase().trim();

  // Remove common filler words for better matching
  const cleaned = lower.replace(/[?.!,]+/g, '').trim();

  for (const [key, entry] of Object.entries(DAIRY_KNOWLEDGE)) {
    for (const pattern of entry.patterns) {
      if (cleaned.includes(pattern) || cleaned === pattern) {
        const responses = entry.responses;
        return responses[Math.floor(Math.random() * responses.length)];
      }
    }
  }
  return null;
}

// ── Main local response generator ──
function generateLocalResponse(message, farmContext, topics) {
  const lower = message.toLowerCase();
  const lines = [];
  let matched = false;

  // ─── STEP 1: Check conversational patterns FIRST ───
  const conversationalReply = matchConversation(message);

  // For greetings, thanks, goodbye, identity, fun — return directly (no farm data needed)
  const pureConversationKeys = ['greetings', 'thanks', 'identity', 'goodbye', 'fun'];
  for (const key of pureConversationKeys) {
    const entry = DAIRY_KNOWLEDGE[key];
    const cleaned = lower.replace(/[?.!,]+/g, '').trim();
    if (entry.patterns.some(p => cleaned.includes(p) || cleaned === p)) {
      // For greetings, also append a brief farm summary if we have data
      if (key === 'greetings') {
        const farmName = farmContext.match(/Farm: ([^\|]+)/)?.[1]?.trim() || '';
        const cattleCount = farmContext.match(/Active Cattle: (\d+)/)?.[1] || '0';
        const todayMilk = farmContext.match(/Today: ([\d.]+)L/)?.[1];
        const alertData = farmContext.match(/⚡ ALERTS: (.+)/)?.[1];

        let greeting = conversationalReply;
        if (cattleCount !== '0') {
          greeting += `\n\n---\n📊 **Quick Glance — ${farmName}**\n- 🐄 Cattle: **${cattleCount}**`;
          if (todayMilk) greeting += `\n- 🥛 Today's Milk: **${todayMilk}L**`;
          if (alertData) {
            const alertCount = alertData.split(' | ').length;
            greeting += `\n- ⚠️ **${alertCount} alert(s)** need attention`;
          }
        }
        return greeting;
      }
      return conversationalReply;
    }
  }

  // ─── STEP 2: Check knowledge-base topics (advice/tips — may also include farm data) ───
  if (conversationalReply) {
    // Knowledge response found — append relevant farm data if available
    let response = conversationalReply;

    // If asking about feed, also show their feed data
    if (lower.match(/feed|chara|khilaye|fodder|khuraak|dana/)) {
      const feedData = farmContext.match(/🌾 FEED[^:]*:[\n\r]+([\s\S]+?)(?=\n[🐄🥛💉🐣💰🏘️👷🛡️⚡📈===]|$)/)?.[1]?.trim();
      if (feedData) response += `\n\n---\n### 📊 Your Farm's Feed Data (This Month):\n${feedData.split('\n').filter(l=>l.trim()).map(l => `- ${l.trim()}`).join('\n')}`;
    }

    // If asking about breeding, show their breeding data
    if (lower.match(/breed|heat|garmi|garbh|pregnan|calving|byaana/)) {
      const breedData = farmContext.match(/🐣 BREEDING:[\n\r]+([\s\S]+?)(?=\n[🐄🥛💉💰🌾🏘️👷🛡️⚡📈===]|$)/)?.[1]?.trim();
      if (breedData) response += `\n\n---\n### 📊 Your Farm's Breeding Status:\n${breedData.split('\n').filter(l=>l.trim()).map(l => `- ${l.trim()}`).join('\n')}`;
    }

    // If asking about health/disease, show their health data
    if (lower.match(/disease|bimari|vaccine|health|dawai|mastitis|fmd/)) {
      const healthData = farmContext.match(/💉 HEALTH:[\n\r]+([\s\S]+?)(?=\n[🐄🥛🐣💰🌾🏘️👷🛡️⚡📈===]|$)/)?.[1]?.trim();
      if (healthData) response += `\n\n---\n### 📊 Your Farm's Health Status:\n${healthData.split('\n').filter(l=>l.trim()).map(l => `- ${l.trim()}`).join('\n')}`;
    }

    // If asking about profit/finance, show their finance data
    if (lower.match(/profit|munafa|earn|kamai|cost|kharcha|revenue|income/)) {
      const finData = farmContext.match(/💰 FINANCE[^:]*:[\n\r]+([\s\S]+?)(?=\n[🐄🥛💉🐣🌾🏘️👷🛡️⚡📈===]|$)/)?.[1]?.trim();
      if (finData) response += `\n\n---\n### 📊 Your Farm's Finance:\n${finData.split('\n').filter(l=>l.trim()).map(l => `- ${l.trim()}`).join('\n')}`;
    }

    return response;
  }

  // ─── STEP 3: Farm data queries (original logic, improved formatting) ───

  // Parse farm context helpers
  const extractSection = (emoji, name) => {
    const regex = new RegExp(`${emoji}[^:]*${name}[^:]*:\\n([\\s\\S]+?)(?=\\n[\\n🐄🥛💉🐣💰🌾🏘️👷🛡️⚡📈===]|$)`);
    const match = farmContext.match(regex);
    return match ? match[1].trim() : null;
  };

  const extractValue = (pattern) => {
    const match = farmContext.match(pattern);
    return match ? match[1] : null;
  };

  const farmName = extractValue(/Farm: ([^\|]+)/) || 'Your Farm';
  const cattleCount = extractValue(/Active Cattle: (\d+)/) || '0';

  // Helper: format section data as bullet points
  const formatAsBullets = (data) => {
    if (!data) return [];
    return data.split('\n').filter(l => l.trim()).map(l => {
      const trimmed = l.trim();
      if (trimmed.includes(';') && trimmed.length > 80) {
        const parts = trimmed.split(';').map(p => p.trim()).filter(Boolean);
        const header = trimmed.match(/^([^:]+):/)?.[1];
        if (header && parts.length > 1) {
          return `**${header}:**\n${parts.map(p => `  - ${p.replace(/^[^:]+:\s*/, '')}`).join('\n')}`;
        }
      }
      return `- ${trimmed}`;
    });
  };

  // ─── Summary / Overview ───
  if (['summary', 'overview', 'status', 'haal', 'kaisa', 'farm', 'sab', 'everything', 'all', 'report', 'dashboard'].some(w => lower.includes(w)) || topics.length > 3) {
    lines.push(`## 📊 ${farmName.trim()} — Farm Status Report\n`);
    lines.push(`| Metric | Value |`);
    lines.push(`|--------|-------|`);
    lines.push(`| 🐄 Active Cattle | **${cattleCount}** |`);

    const milkData = extractSection('🥛', 'MILK');
    if (milkData) {
      const todayMatch = milkData.match(/Today: ([\d.]+)L/);
      const morningMatch = milkData.match(/M:([\d.]+)/);
      const eveningMatch = milkData.match(/E:([\d.]+)/);
      const monthMatch = milkData.match(/This Month: ([\d.]+)L/);
      if (todayMatch) lines.push(`| 🥛 Today's Milk | **${todayMatch[1]}L** (M: ${morningMatch?.[1] || '0'}L, E: ${eveningMatch?.[1] || '0'}L) |`);
      if (monthMatch) lines.push(`| 📅 This Month | **${monthMatch[1]}L** |`);
    }

    const finData = extractSection('💰', 'FINANCE');
    if (finData) {
      const revMatch = finData.match(/Revenue: (₹[\d,]+)/);
      const expMatch = finData.match(/Expense: (₹[\d,]+)/);
      const profitMatch = finData.match(/Net Profit: (₹[\d,-]+)/);
      if (revMatch) lines.push(`| 💰 Revenue | **${revMatch[1]}** |`);
      if (expMatch) lines.push(`| 💸 Expense | **${expMatch[1]}** |`);
      if (profitMatch) lines.push(`| 📈 Net Profit | **${profitMatch[1]}** |`);
    }

    lines.push('');

    const healthData = extractSection('💉', 'HEALTH');
    if (healthData) {
      const overdue = healthData.match(/🚨 OVERDUE: (.+)/);
      const upcoming = healthData.match(/Upcoming[^:]*: (.+)/);
      if (overdue) lines.push(`### 🚨 Overdue Vaccinations\n${overdue[1].split(';').map(a => `- ${a.trim()}`).join('\n')}\n`);
      else if (upcoming) lines.push(`### 💉 Upcoming Vaccinations\n${upcoming[1].split(';').map(a => `- ${a.trim()}`).join('\n')}\n`);
      else lines.push(`✅ No upcoming vaccinations\n`);
    }

    const deliveryData = extractSection('🏘️', 'DUDH KHATA');
    if (deliveryData) {
      lines.push(`### 🏘️ Dudh Khata`);
      deliveryData.split('\n').slice(0, 3).forEach(l => { if (l.trim()) lines.push(`- ${l.trim()}`); });
      lines.push('');
    }

    const empData = extractSection('👷', 'EMPLOYEES');
    if (empData) {
      const staffLine = empData.match(/Active Staff: [^\n]+/);
      if (staffLine) lines.push(`👷 ${staffLine[0]}\n`);
    }

    const alertData = extractValue(/⚡ ALERTS: (.+)/);
    if (alertData) {
      lines.push(`### ⚡ Active Alerts`);
      alertData.split(' | ').forEach(a => lines.push(`- ${a}`));
      lines.push('');
    }

    const analytics = extractSection('📈', 'COMPUTED');
    if (analytics) {
      lines.push(`### 📈 Key Metrics`);
      analytics.split('\n').forEach(l => { if (l.trim() && l.includes(':')) lines.push(`- ${l.trim()}`); });
    }

    matched = true;
  }

  // ─── Topic-specific data sections ───
  const topicHandlers = [
    { topic: 'milk', emoji: '🥛', section: 'MILK', title: 'Milk Production Report', tip: 'Check feed quality and cattle health if production is declining.' },
    { topic: 'cattle', emoji: '📊', section: 'CATTLE', title: 'Cattle Report', extra: () => `**Total Active:** ${cattleCount}\n` },
    { topic: 'health', emoji: '💉', section: 'HEALTH', title: 'Health & Vaccination Report', footer: '⚕️ *Always consult your veterinarian for treatment decisions.*' },
    { topic: 'breeding', emoji: '🐣', section: 'BREEDING', title: 'Breeding Report' },
    { topic: 'feed', emoji: '🌾', section: 'FEED', title: 'Feed Report' },
    { topic: 'delivery', emoji: '🏘️', section: 'DUDH KHATA', title: 'Dudh Khata (Milk Delivery)' },
    { topic: 'employee', emoji: '👷', section: 'EMPLOYEES', title: 'Employee Report' },
    { topic: 'insurance', emoji: '🛡️', section: 'INSURANCE', title: 'Insurance Report' },
  ];

  // Finance = expense + revenue
  if (!matched && (topics.includes('expense') || topics.includes('revenue'))) {
    const finData = extractSection('💰', 'FINANCE');
    if (finData) {
      lines.push(`## 💰 Finance Report\n`);
      formatAsBullets(finData).forEach(l => lines.push(l));
    } else {
      lines.push(`💰 No finance data.\n\n**How to add:** Go to **Finance** → add revenue or expense entries.`);
    }
    matched = true;
  }

  for (const handler of topicHandlers) {
    if (!matched && topics.includes(handler.topic)) {
      const data = extractSection(handler.emoji, handler.section);
      if (data) {
        lines.push(`## ${handler.emoji} ${handler.title}\n`);
        if (handler.extra) lines.push(handler.extra());
        formatAsBullets(data).forEach(l => lines.push(l));
        if (handler.footer) lines.push(`\n${handler.footer}`);
        // Add contextual tips based on data content
        if (data.includes('declining') || data.includes('📉')) {
          lines.push(`\n💡 **Tip:** ${handler.tip || 'Review recent changes that might have caused this trend.'}`);
        }
      } else {
        const moduleNames = { milk: 'Milk Records', cattle: 'Cattle', health: 'Health', breeding: 'Breeding', feed: 'Feed', delivery: 'Dudh Khata', employee: 'Employees', insurance: 'Insurance' };
        lines.push(`${handler.emoji} No ${handler.topic} records found.\n\n**How to add:** Go to **${moduleNames[handler.topic] || handler.title}** → tap **+ Add** to get started.`);
      }
      matched = true;
      break;
    }
  }

  // ─── Alerts specific ───
  if (!matched && lower.includes('alert')) {
    const alertData = extractValue(/⚡ ALERTS: (.+)/);
    if (alertData) {
      lines.push(`## ⚡ Active Alerts\n`);
      alertData.split(' | ').forEach(a => lines.push(`- ${a}`));
    } else {
      lines.push(`✅ **No active alerts!** Your farm is running smoothly.`);
    }
    matched = true;
  }

  // ─── Generic fallback — show structured report + helpful prompt ───
  if (!matched) {
    // Check if it looks like a general question we should try to answer conversationally
    const isQuestion = lower.includes('?') || lower.startsWith('kya') || lower.startsWith('kaise') || lower.startsWith('kab') || lower.startsWith('kitna') || lower.startsWith('kaun') || lower.startsWith('how') || lower.startsWith('what') || lower.startsWith('when') || lower.startsWith('why') || lower.startsWith('which') || lower.startsWith('where');

    if (isQuestion) {
      lines.push(`🤔 Hmm, let me share what I know from your farm data!\n`);
    }

    lines.push(`## 📊 ${farmName.trim()} — Farm Report\n`);
    lines.push(`🐄 **Active Cattle:** ${cattleCount}\n`);

    const sections = [
      ['🥛', 'MILK', 'Milk Production'], ['📊', 'CATTLE', 'Cattle Overview'],
      ['💉', 'HEALTH', 'Health & Vaccination'], ['🐣', 'BREEDING', 'Breeding'],
      ['💰', 'FINANCE', 'Finance'], ['🌾', 'FEED', 'Feed'],
      ['🏘️', 'DUDH KHATA', 'Dudh Khata'], ['👷', 'EMPLOYEES', 'Employees'],
      ['🛡️', 'INSURANCE', 'Insurance']
    ];

    let hasAnyData = false;
    for (const [emoji, key, title] of sections) {
      const data = extractSection(emoji, key);
      if (data) {
        hasAnyData = true;
        lines.push(`### ${emoji} ${title}`);
        data.split('\n').filter(l => l.trim()).slice(0, 4).forEach(l => lines.push(`- ${l.trim()}`));
        lines.push('');
      }
    }

    if (!hasAnyData) {
      lines.push(`Looks like your farm data is empty! Start by adding:\n1. 🐄 **Cattle** → Add your animals\n2. 🥛 **Milk Records** → Record daily production\n3. 💰 **Finance** → Track income & expenses\n`);
    }

    const alertData = extractValue(/⚡ ALERTS: (.+)/);
    if (alertData) {
      lines.push(`### ⚡ Alerts`);
      alertData.split(' | ').forEach(a => lines.push(`- ${a}`));
      lines.push('');
    }

    const analytics = extractSection('📈', 'COMPUTED');
    if (analytics) {
      lines.push(`### 📈 Key Metrics`);
      analytics.split('\n').filter(l => l.trim()).forEach(l => lines.push(`- ${l.trim()}`));
    }

    lines.push(`\n💡 *You can also ask me about:*\n- Dairy farming tips & advice\n- How to increase milk production\n- Feed plans & nutrition\n- Cattle diseases & vaccination schedules\n- Government schemes & subsidies\n- Breeding management`);
  }

  // Footer
  lines.push(`\n---`);
  lines.push(`📡 *Live farm data* • ⚡ */help /milk /cattle /finance /health /alerts*`);

  return lines.join('\n');
}

// ─── Main route ───
router.post('/ask', async (req, res, next) => {
  try {
    const { message, history } = req.body;
    if (!message) return res.status(400).json({ success: false, message: 'Message required' });

    const reqStart = Date.now();
    const farmId = req.user.farmId;
    const topics = detectTopics(message);
    const farmContext = await buildFarmContext(farmId, topics);

    // Try quick commands first (instant response)
    const quickReply = handleQuickCommand(message, farmContext);
    if (quickReply) {
      console.log(`[DairyPro AI] Quick command in ${Date.now() - reqStart}ms`);
      return res.json({ success: true, data: { reply: quickReply } });
    }

    // Try AI response, fall back to local engine on failure
    try {
      const reply = await askGemini(message, history || [], farmContext);
      console.log(`[DairyPro AI] AI response in ${Date.now() - reqStart}ms`);
      return res.json({ success: true, data: { reply } });
    } catch (aiErr) {
      console.warn(`[DairyPro AI] AI failed (${aiErr.message}), using local fallback engine`);
      const localReply = generateLocalResponse(message, farmContext, topics);
      console.log(`[DairyPro AI] Local fallback in ${Date.now() - reqStart}ms`);
      return res.json({ success: true, data: { reply: localReply } });
    }
  } catch (err) {
    console.error('Chatbot critical error:', err.message);
    return res.json({
      success: true,
      data: {
        reply: `😔 Something went wrong. Please try these quick commands:\n\n- **/help** — All commands\n- **/alerts** — Farm alerts\n- **/milk** — Today's milk\n- **/finance** — Revenue & expenses\n- **/cattle** — Cattle overview\n- **/staff** — Employee status\n- **/dues** — Customer dues`,
      },
    });
  }
});

export default router;
