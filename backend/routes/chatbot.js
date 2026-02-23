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

const router = Router();
router.use(auth, checkSubscription);

// Keyword maps (English + Hindi)
const TOPICS = {
  milk: ['milk', 'dudh', 'doodh', 'yield', 'production', 'litre', 'liter', 'morning', 'evening'],
  cattle: ['cattle', 'cow', 'gaay', 'gai', 'bull', 'calf', 'heifer', 'animal', 'janwar', 'pashu', 'tag'],
  health: ['health', 'vaccine', 'vaccination', 'treatment', 'sick', 'bimar', 'doctor', 'vet', 'medicine', 'dawai', 'checkup', 'deworming'],
  breeding: ['breeding', 'pregnant', 'delivery', 'insemination', 'calf', 'bachha', 'garbh'],
  expense: ['expense', 'kharcha', 'cost', 'spending', 'lागत'],
  revenue: ['revenue', 'income', 'aay', 'kamai', 'sale', 'bikri', 'profit', 'munafa'],
  feed: ['feed', 'chara', 'fodder', 'khana', 'dana'],
  hello: ['hello', 'hi', 'hey', 'namaste', 'namaskar', 'hlo'],
  help: ['help', 'madad', 'sahayata', 'kya kar sakte', 'what can you'],
};

function detectTopic(msg) {
  const lower = msg.toLowerCase();
  for (const [topic, keywords] of Object.entries(TOPICS)) {
    if (keywords.some(k => lower.includes(k))) return topic;
  }
  return null;
}

router.post('/ask', async (req, res, next) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ success: false, message: 'Message required' });

    const farmId = req.user.farmId;
    const topic = detectTopic(message);
    let reply = '';

    const today = new Date(); today.setHours(0, 0, 0, 0);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    if (topic === 'hello') {
      reply = `Namaste! 🐄 I'm your DairyPro Farm Assistant. I can help you with:\n\n- 🥛 **Milk production** data\n- 🐄 **Cattle** information\n- 💉 **Health** records\n- 🐣 **Breeding** status\n- 💰 **Finance** (expense/revenue)\n- 🌾 **Feed** records\n\nAsk me anything about your farm! Hindi mein bhi puch sakte ho.`;
    } else if (topic === 'help') {
      reply = `Here's what you can ask me:\n\n- "Aaj ka dudh kitna hai?" — Today's milk\n- "Kitni gaay hain?" — Cattle count\n- "Vaccination due kab hai?" — Upcoming vaccinations\n- "Is mahine ka kharcha?" — Monthly expenses\n- "Revenue kitna hua?" — Revenue details\n- "Breeding status" — Pregnancy updates\n- "Feed cost?" — Feed expenses\n\nI understand both Hindi and English! 🇮🇳`;
    } else if (topic === 'milk') {
      const todayRecords = await MilkRecord.find({ farmId, date: { $gte: today } });
      const todayTotal = todayRecords.reduce((s, r) => s + r.totalYield, 0);
      const todayMorning = todayRecords.reduce((s, r) => s + (r.morningYield || 0), 0);
      const todayEvening = todayRecords.reduce((s, r) => s + (r.eveningYield || 0), 0);

      const monthRecords = await MilkRecord.find({ farmId, date: { $gte: monthStart } });
      const monthTotal = monthRecords.reduce((s, r) => s + r.totalYield, 0);

      const topCattle = await MilkRecord.aggregate([
        { $match: { farmId, date: { $gte: monthStart } } },
        { $group: { _id: '$cattleId', total: { $sum: '$totalYield' } } },
        { $sort: { total: -1 } },
        { $limit: 3 },
        { $lookup: { from: 'cattles', localField: '_id', foreignField: '_id', as: 'cattle' } },
        { $unwind: '$cattle' },
      ]);

      const topList = topCattle.map((c, i) => `${i + 1}. Tag ${c.cattle.tagNumber} (${c.cattle.breed}) — ${c.total.toFixed(1)}L`).join('\n');

      reply = `🥛 **Milk Production Summary**\n\n**Today:**\n- Morning: ${todayMorning.toFixed(1)}L\n- Evening: ${todayEvening.toFixed(1)}L\n- Total: **${todayTotal.toFixed(1)}L** (${todayRecords.length} cattle recorded)\n\n**This Month:** ${monthTotal.toFixed(1)}L total\n\n🏆 **Top Producers (Month):**\n${topList || 'No data yet'}`;
    } else if (topic === 'cattle') {
      const totalActive = await Cattle.countDocuments({ farmId, status: 'active' });
      const byCategory = await Cattle.aggregate([
        { $match: { farmId, status: 'active' } },
        { $group: { _id: '$category', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]);
      const catList = byCategory.map(c => `- ${c._id}: **${c.count}**`).join('\n');
      reply = `🐄 **Cattle Summary**\n\nTotal Active: **${totalActive}**\n\n**By Category:**\n${catList || 'No cattle added yet'}`;
    } else if (topic === 'health') {
      const upcoming = await HealthRecord.find({
        farmId, nextDueDate: { $gte: new Date(), $lte: new Date(Date.now() + 14 * 86400000) },
      }).populate('cattleId', 'tagNumber').sort('nextDueDate').limit(5);

      const monthHealth = await HealthRecord.countDocuments({ farmId, date: { $gte: monthStart } });

      const upList = upcoming.map(u => `- Tag ${u.cattleId?.tagNumber}: ${u.description} — Due: ${u.nextDueDate.toLocaleDateString('en-IN')}`).join('\n');

      reply = `💉 **Health Summary**\n\nRecords this month: **${monthHealth}**\n\n**Upcoming Due (14 days):**\n${upList || 'No upcoming vaccinations/treatments! ✅'}`;
    } else if (topic === 'breeding') {
      const active = await BreedingRecord.find({ farmId, status: { $in: ['bred', 'confirmed'] } })
        .populate('cattleId', 'tagNumber breed').sort('expectedDelivery').limit(5);

      const list = active.map(b => `- Tag ${b.cattleId?.tagNumber}: ${b.status} — Expected: ${b.expectedDelivery ? b.expectedDelivery.toLocaleDateString('en-IN') : 'N/A'}`).join('\n');

      reply = `🐣 **Breeding Summary**\n\nActive pregnancies: **${active.length}**\n\n${list || 'No active breeding records'}`;
    } else if (topic === 'expense') {
      const monthExp = await Expense.aggregate([
        { $match: { farmId, date: { $gte: monthStart } } },
        { $group: { _id: '$category', total: { $sum: '$amount' } } },
        { $sort: { total: -1 } },
      ]);
      const total = monthExp.reduce((s, e) => s + e.total, 0);
      const list = monthExp.map(e => `- ${e._id}: ₹${e.total.toLocaleString('en-IN')}`).join('\n');

      reply = `💸 **Expense Summary (This Month)**\n\nTotal: **₹${total.toLocaleString('en-IN')}**\n\n**By Category:**\n${list || 'No expenses recorded'}`;
    } else if (topic === 'revenue') {
      const monthRev = await Revenue.aggregate([
        { $match: { farmId, date: { $gte: monthStart } } },
        { $group: { _id: '$category', total: { $sum: '$amount' } } },
        { $sort: { total: -1 } },
      ]);
      const totalRev = monthRev.reduce((s, r) => s + r.total, 0);

      const monthExpTotal = await Expense.aggregate([
        { $match: { farmId, date: { $gte: monthStart } } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]);
      const expTotal = monthExpTotal[0]?.total || 0;
      const profit = totalRev - expTotal;

      const list = monthRev.map(r => `- ${r._id.replace('_', ' ')}: ₹${r.total.toLocaleString('en-IN')}`).join('\n');

      reply = `💰 **Revenue Summary (This Month)**\n\nTotal Revenue: **₹${totalRev.toLocaleString('en-IN')}**\nTotal Expense: ₹${expTotal.toLocaleString('en-IN')}\nNet Profit: **₹${profit.toLocaleString('en-IN')}** ${profit >= 0 ? '📈' : '📉'}\n\n**By Source:**\n${list || 'No revenue recorded'}`;
    } else if (topic === 'feed') {
      const monthFeed = await FeedRecord.aggregate([
        { $match: { farmId, date: { $gte: monthStart } } },
        { $group: { _id: '$feedType', totalQty: { $sum: '$quantity' }, totalCost: { $sum: '$cost' } } },
        { $sort: { totalCost: -1 } },
      ]);
      const totalCost = monthFeed.reduce((s, f) => s + f.totalCost, 0);
      const list = monthFeed.map(f => `- ${f._id}: ${f.totalQty} kg — ₹${f.totalCost.toLocaleString('en-IN')}`).join('\n');

      reply = `🌾 **Feed Summary (This Month)**\n\nTotal Cost: **₹${totalCost.toLocaleString('en-IN')}**\n\n**By Type:**\n${list || 'No feed records'}`;
    } else {
      reply = `I'm not sure what you're asking about. 🤔\n\nTry asking about:\n- 🥛 Milk — "aaj ka dudh kitna hai?"\n- 🐄 Cattle — "kitni gaay hain?"\n- 💉 Health — "vaccination due kab hai?"\n- 💰 Finance — "is mahine ka kharcha?"\n- 🐣 Breeding — "breeding status"\n- 🌾 Feed — "feed cost?"\n\nHindi mein bhi puch sakte ho!`;
    }

    res.json({ success: true, data: { reply } });
  } catch (err) { next(err); }
});

export default router;
