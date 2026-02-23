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

const router = Router();
router.use(auth, checkSubscription);

// ─── In-memory cache per farm (TTL: 60s) ───
const farmCache = new Map();
const CACHE_TTL = 60_000; // 1 minute

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
    milk: ['milk', 'dudh', 'doodh', 'yield', 'production', 'litre', 'liter', 'fat', 'snf'],
    cattle: ['cattle', 'cow', 'gaay', 'gai', 'bull', 'calf', 'heifer', 'animal', 'janwar', 'pashu', 'tag', 'breed'],
    health: ['health', 'vaccine', 'vaccination', 'treatment', 'sick', 'bimar', 'vet', 'medicine', 'dawai', 'checkup', 'deworming', 'disease'],
    breeding: ['breeding', 'pregnant', 'delivery', 'insemination', 'bachha', 'garbh', 'heat', 'cycle', 'calving'],
    expense: ['expense', 'kharcha', 'cost', 'spending', 'budget', 'paisa'],
    revenue: ['revenue', 'income', 'aay', 'kamai', 'sale', 'bikri', 'profit', 'munafa', 'loss'],
    feed: ['feed', 'chara', 'fodder', 'khana', 'dana', 'silage', 'nutrition'],
    finance: ['finance', 'money', 'paise', 'hisab', 'balance', 'profit', 'loss'],
  };

  for (const [topic, keywords] of Object.entries(map)) {
    if (keywords.some(k => lower.includes(k))) topics.add(topic);
  }

  // General/overview queries fetch everything
  const overviewWords = ['summary', 'overview', 'status', 'haal', 'report', 'dashboard', 'sab', 'everything', 'farm', 'all'];
  if (overviewWords.some(w => lower.includes(w)) || topics.size === 0) {
    return ['milk', 'cattle', 'health', 'breeding', 'expense', 'revenue', 'feed'];
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

  // Execute all queries in parallel
  const keys = Object.keys(queries);
  const results = await Promise.all(Object.values(queries));
  const data = {};
  keys.forEach((k, i) => { data[k] = results[i]; });

  // ─── Build context string ───
  const lines = [];
  lines.push(`=== FARM DATA (Live, ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'full', timeStyle: 'short' })}) ===`);
  lines.push(`Farm: ${data.farm?.name || 'Unknown'} | Active Cattle: ${data.cattleCount}`);

  if (topics.includes('cattle') && data.cattleByCategory) {
    lines.push(`\n📊 CATTLE:`);
    lines.push(`By Category: ${data.cattleByCategory.map(c => `${c._id}: ${c.count}`).join(', ') || 'None'}`);
    lines.push(`By Breed: ${data.cattleByBreed?.map(c => `${c._id}: ${c.count}`).join(', ') || 'None'}`);
    if (data.soldDead?.length) lines.push(`Sold/Dead: ${data.soldDead.map(c => `${c._id}: ${c.count}`).join(', ')}`);
    if (data.recentCattle?.length) {
      lines.push(`Cattle List: ${data.recentCattle.map(c => `Tag ${c.tagNumber}(${c.breed},${c.category},${c.gender}${c.weight ? ','+c.weight+'kg' : ''})`).join('; ')}`);
    }
  }

  if (topics.includes('milk')) {
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
  }

  if (topics.includes('health')) {
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
  }

  if (topics.includes('breeding')) {
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
  }

  if (topics.includes('expense') || topics.includes('revenue')) {
    const totalExp = data.monthExpenses?.reduce((s, e) => s + e.total, 0) || 0;
    const totalRev = data.monthRevenue?.reduce((s, r) => s + r.total, 0) || 0;
    const prevExp = data.prevMonthExpenses?.[0]?.total || 0;
    const prevRev = data.prevMonthRevenue?.[0]?.total || 0;
    const profit = totalRev - totalExp;

    lines.push(`\n💰 FINANCE (This Month):`);
    lines.push(`Revenue: ₹${totalRev.toLocaleString('en-IN')} (last month: ₹${prevRev.toLocaleString('en-IN')})`);
    if (data.monthRevenue?.length) lines.push(`  Sources: ${data.monthRevenue.map(r => `${r._id.replace('_', ' ')}: ₹${r.total.toLocaleString('en-IN')}`).join(', ')}`);
    lines.push(`Expense: ₹${totalExp.toLocaleString('en-IN')} (last month: ₹${prevExp.toLocaleString('en-IN')})`);
    if (data.monthExpenses?.length) lines.push(`  Breakdown: ${data.monthExpenses.map(e => `${e._id}: ₹${e.total.toLocaleString('en-IN')}(${e.count})`).join(', ')}`);
    lines.push(`Net Profit: ₹${profit.toLocaleString('en-IN')} ${profit >= 0 ? '📈' : '📉'}`);
  }

  if (topics.includes('feed') && data.monthFeed?.length) {
    const totalFeedCost = data.monthFeed.reduce((s, f) => s + f.totalCost, 0);
    lines.push(`\n🌾 FEED (This Month): Total ₹${totalFeedCost.toLocaleString('en-IN')}`);
    lines.push(`Types: ${data.monthFeed.map(f => `${f._id}: ${f.totalQty}kg, ₹${f.totalCost.toLocaleString('en-IN')}`).join('; ')}`);
  }

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

  if (alerts.length) {
    lines.push(`\n⚡ ALERTS: ${alerts.join(' | ')}`);
  }

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

RULES:
- Answer using REAL farm data below. Be specific (tag numbers, exact ₹ amounts, dates).
- Support Hindi & English — reply in whatever language the farmer uses. Mix is OK (Hinglish).
- Be concise: use bullet points, bold numbers. No long paragraphs.
- For actionable alerts: use ⚠️🚨✅ emojis to highlight urgency.
- Give practical Indian dairy farming advice when asked.
- Compare with last month's data when available to show trends.
- If data is empty/zero, suggest the farmer to add records from the app.
- For health issues: always recommend consulting a veterinarian for serious concerns.

SMART FEATURES you should proactively do:
- 📊 Spot trends (milk going up/down, expenses increasing)
- ⚠️ Flag problems (low yield cattle, overdue vaccinations, losses)
- 💡 Give tips (feed optimization, breeding timing, cost reduction)
- 🏆 Highlight top performers
- 📈 Compare month-over-month when data available
- 🔔 Remind about upcoming events (deliveries, vaccinations)

${farmContext}`;

  const contents = [];

  // Only last 6 messages for speed
  if (history?.length) {
    for (const msg of history.slice(-6)) {
      contents.push({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }],
      });
    }
  }

  contents.push({ role: 'user', parts: [{ text: message }] });

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents,
        generationConfig: {
          temperature: 0.6,
          maxOutputTokens: 800,
          topP: 0.85,
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

  const data = await response.json();
  const reply = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!reply) throw new Error('Empty AI response');
  return reply;
}

// ─── Quick commands (instant, no AI call) ───
function handleQuickCommand(message, farmContext) {
  const lower = message.trim().toLowerCase();

  // Direct shortcuts for ultra-fast response
  if (lower === '/alerts' || lower === 'alerts') {
    const alertMatch = farmContext.match(/⚡ ALERTS: (.+)/);
    return alertMatch ? `⚡ **Active Alerts:**\n${alertMatch[1].split(' | ').map(a => `- ${a}`).join('\n')}` : '✅ No active alerts! Your farm is running smoothly.';
  }
  if (lower === '/milk' || lower === 'aaj ka dudh') {
    const milkMatch = farmContext.match(/Today: (.+?)(?:\n|$)/);
    return milkMatch ? `🥛 **Today's Milk:** ${milkMatch[1]}` : '🥛 No milk data recorded today. Add records from Milk section.';
  }

  return null; // Not a quick command
}

// ─── Main route ───
router.post('/ask', async (req, res, next) => {
  try {
    const { message, history } = req.body;
    if (!message) return res.status(400).json({ success: false, message: 'Message required' });

    const farmId = req.user.farmId;
    const topics = detectTopics(message);
    const farmContext = await buildFarmContext(farmId, topics);

    // Try quick commands first (instant response)
    const quickReply = handleQuickCommand(message, farmContext);
    if (quickReply) {
      return res.json({ success: true, data: { reply: quickReply } });
    }

    // AI response
    const reply = await askGemini(message, history || [], farmContext);
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
