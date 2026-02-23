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

// Gather farm data context for Gemini
async function getFarmContext(farmId) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const weekFromNow = new Date(); weekFromNow.setDate(weekFromNow.getDate() + 14);

  const [
    totalCattle,
    cattleByCategory,
    todayMilk,
    monthMilk,
    topCattle,
    upcomingHealth,
    monthExpenses,
    monthRevenue,
    activeBreeding,
    monthFeed,
    recentCattle,
  ] = await Promise.all([
    Cattle.countDocuments({ farmId, status: 'active' }),
    Cattle.aggregate([{ $match: { farmId, status: 'active' } }, { $group: { _id: '$category', count: { $sum: 1 } } }]),
    MilkRecord.aggregate([{ $match: { farmId, date: { $gte: today, $lt: tomorrow } } }, { $group: { _id: null, total: { $sum: '$totalYield' }, morning: { $sum: '$morningYield' }, afternoon: { $sum: '$afternoonYield' }, evening: { $sum: '$eveningYield' }, count: { $sum: 1 } } }]),
    MilkRecord.aggregate([{ $match: { farmId, date: { $gte: monthStart } } }, { $group: { _id: null, total: { $sum: '$totalYield' }, count: { $sum: 1 } } }]),
    MilkRecord.aggregate([
      { $match: { farmId, date: { $gte: monthStart } } },
      { $group: { _id: '$cattleId', total: { $sum: '$totalYield' }, days: { $sum: 1 } } },
      { $sort: { total: -1 } }, { $limit: 5 },
      { $lookup: { from: 'cattles', localField: '_id', foreignField: '_id', as: 'cattle' } },
      { $unwind: '$cattle' },
    ]),
    HealthRecord.find({ farmId, nextDueDate: { $gte: new Date(), $lte: weekFromNow } }).populate('cattleId', 'tagNumber breed').sort('nextDueDate').limit(10).lean(),
    Expense.aggregate([{ $match: { farmId, date: { $gte: monthStart } } }, { $group: { _id: '$category', total: { $sum: '$amount' }, count: { $sum: 1 } } }, { $sort: { total: -1 } }]),
    Revenue.aggregate([{ $match: { farmId, date: { $gte: monthStart } } }, { $group: { _id: '$category', total: { $sum: '$amount' }, count: { $sum: 1 } } }, { $sort: { total: -1 } }]),
    BreedingRecord.find({ farmId, status: { $in: ['bred', 'confirmed'] } }).populate('cattleId', 'tagNumber breed').sort('expectedDelivery').limit(10).lean(),
    FeedRecord.aggregate([{ $match: { farmId, date: { $gte: monthStart } } }, { $group: { _id: '$feedType', totalQty: { $sum: '$quantity' }, totalCost: { $sum: '$cost' } } }, { $sort: { totalCost: -1 } }]),
    Cattle.find({ farmId, status: 'active' }).select('tagNumber breed category gender').sort('-createdAt').limit(20).lean(),
  ]);

  const todayData = todayMilk[0] || { total: 0, morning: 0, afternoon: 0, evening: 0, count: 0 };
  const monthMilkData = monthMilk[0] || { total: 0, count: 0 };
  const totalExpense = monthExpenses.reduce((s, e) => s + e.total, 0);
  const totalRevenue = monthRevenue.reduce((s, r) => s + r.total, 0);
  const totalFeedCost = monthFeed.reduce((s, f) => s + f.totalCost, 0);

  return `
=== FARM DATA (Real-time) ===
Date: ${new Date().toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}

📊 CATTLE SUMMARY:
- Total Active: ${totalCattle}
- By Category: ${cattleByCategory.map(c => `${c._id}: ${c.count}`).join(', ') || 'None'}
- Recent Cattle: ${recentCattle.map(c => `Tag ${c.tagNumber} (${c.breed}, ${c.category})`).join('; ') || 'None'}

🥛 MILK PRODUCTION:
- Today: Total ${todayData.total.toFixed(1)}L (Morning: ${todayData.morning.toFixed(1)}L, Afternoon: ${todayData.afternoon.toFixed(1)}L, Evening: ${todayData.evening.toFixed(1)}L) — ${todayData.count} cattle recorded
- This Month: ${monthMilkData.total.toFixed(1)}L total, ${monthMilkData.count} records
- Top Producers (Month): ${topCattle.map((c, i) => `${i + 1}. Tag ${c.cattle.tagNumber} (${c.cattle.breed}) — ${c.total.toFixed(1)}L in ${c.days} days, avg ${(c.total / c.days).toFixed(1)}L/day`).join('; ') || 'No data'}

💉 UPCOMING HEALTH/VACCINATIONS (Next 14 days):
${upcomingHealth.length > 0 ? upcomingHealth.map(h => `- Tag ${h.cattleId?.tagNumber}: ${h.description} — Due: ${new Date(h.nextDueDate).toLocaleDateString('en-IN')}`).join('\n') : '- No upcoming vaccinations/treatments ✅'}

🐣 ACTIVE BREEDING:
${activeBreeding.length > 0 ? activeBreeding.map(b => `- Tag ${b.cattleId?.tagNumber}: ${b.status}, Method: ${b.method}${b.expectedDelivery ? `, Expected: ${new Date(b.expectedDelivery).toLocaleDateString('en-IN')}` : ''}`).join('\n') : '- No active breeding records'}

💸 EXPENSES (This Month):
- Total: ₹${totalExpense.toLocaleString('en-IN')}
- By Category: ${monthExpenses.map(e => `${e._id}: ₹${e.total.toLocaleString('en-IN')} (${e.count} entries)`).join(', ') || 'None'}

💰 REVENUE (This Month):
- Total: ₹${totalRevenue.toLocaleString('en-IN')}
- By Source: ${monthRevenue.map(r => `${r._id.replace('_', ' ')}: ₹${r.total.toLocaleString('en-IN')}`).join(', ') || 'None'}
- Net Profit: ₹${(totalRevenue - totalExpense).toLocaleString('en-IN')} ${totalRevenue - totalExpense >= 0 ? '📈' : '📉'}

🌾 FEED (This Month):
- Total Cost: ₹${totalFeedCost.toLocaleString('en-IN')}
- By Type: ${monthFeed.map(f => `${f._id}: ${f.totalQty}kg, ₹${f.totalCost.toLocaleString('en-IN')}`).join(', ') || 'None'}
=== END FARM DATA ===
`.trim();
}

// Call Gemini API
async function askGemini(message, history, farmContext) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Gemini API key not configured');
  }

  const systemPrompt = `You are "DairyPro Assistant" 🐄 — a smart, friendly AI farm assistant for an Indian dairy farmer. 

Your role:
- Answer questions about the farmer's dairy farm using the REAL farm data provided below
- Support both Hindi and English (respond in whichever language the farmer uses)
- Give practical, actionable advice for dairy farming
- Use Indian context (₹ currency, Indian breeds, local practices)
- Be concise but thorough — use markdown formatting (bold, lists, tables)
- If asked about data not available, say so honestly
- For general dairy farming questions (not about their specific farm), use your knowledge

${farmContext}

Important: Always base your answers on the real farm data above when the question is about their farm. Be specific with numbers and tag numbers.`;

  // Build messages for Gemini
  const contents = [];

  // Add conversation history
  if (history && history.length > 0) {
    for (const msg of history.slice(-10)) { // Last 10 messages for context
      contents.push({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }],
      });
    }
  }

  // Add current message
  contents.push({
    role: 'user',
    parts: [{ text: message }],
  });

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents,
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1024,
          topP: 0.9,
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
    console.error('Gemini API error:', err);
    throw new Error('Failed to get response from AI');
  }

  const data = await response.json();
  const reply = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!reply) throw new Error('Empty response from AI');
  return reply;
}

router.post('/ask', async (req, res, next) => {
  try {
    const { message, history } = req.body;
    if (!message) return res.status(400).json({ success: false, message: 'Message required' });

    const farmId = req.user.farmId;

    // Gather real farm data
    const farmContext = await getFarmContext(farmId);

    // Call Gemini
    const reply = await askGemini(message, history || [], farmContext);

    res.json({ success: true, data: { reply } });
  } catch (err) {
    console.error('Chatbot error:', err.message);
    // Fallback if Gemini fails
    if (err.message.includes('API key') || err.message.includes('Failed') || err.message.includes('Empty')) {
      return res.json({
        success: true,
        data: {
          reply: `⚠️ AI assistant is temporarily unavailable. Error: ${err.message}\n\nPlease try again in a moment, or check if the Gemini API key is configured correctly.`,
        },
      });
    }
    next(err);
  }
});

export default router;
