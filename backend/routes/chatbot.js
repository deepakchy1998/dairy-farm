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

  const systemPrompt = `You are "DairyPro AI" 🐄 — a smart, fast dairy farm assistant for Indian farmers.

CORE RULES:
- Use REAL farm data below. Be specific: tag numbers, exact ₹ amounts, dates, percentages.
- Support Hindi, English, Hinglish — reply in the farmer's language. If Hindi, use English numbers/units.
- Be concise: bullet points, bold numbers. No long paragraphs.
- Use ⚠️🚨✅ emojis for urgency. Compare with last month when available.
- If data is empty/zero, suggest adding records from the relevant app section.
- For health issues: always recommend consulting a veterinarian.
- Proactively calculate ratios and per-unit metrics (per cow, per liter, per day).

RESPONSE FORMAT RULES:
- When user asks for analysis: provide structured report with sections — Summary, Key Metrics, Trends, Recommendations.
- Use tables (markdown) for comparisons. Use bullet points for lists.
- For financial queries: ALWAYS show Revenue, Expense, Profit, and month-over-month change %.
- When data shows a problem: suggest 3 actionable steps to fix it.

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

  // Last 10 messages for better context
  if (history?.length) {
    for (const msg of history.slice(-10)) {
      contents.push({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }],
      });
    }
  }

  contents.push({ role: 'user', parts: [{ text: message }] });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  const startTime = Date.now();

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents,
          generationConfig: {
            temperature: 0.4,
            maxOutputTokens: 3000,
            topP: 0.9,
            topK: 40,
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

    // AI response
    const reply = await askGemini(message, history || [], farmContext);
    console.log(`[DairyPro AI] Total request in ${Date.now() - reqStart}ms`);
    res.json({ success: true, data: { reply } });
  } catch (err) {
    console.error('Chatbot error:', err.message);
    return res.json({
      success: true,
      data: {
        reply: `⚠️ AI assistant temporarily unavailable. ${err.message}\n\nQuick commands you can try:\n- **/alerts** — See active farm alerts\n- **/milk** — Today's milk production\n\nPlease try again shortly.`,
      },
    });
  }
});

export default router;
