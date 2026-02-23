import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import Notification from '../models/Notification.js';
import Cattle from '../models/Cattle.js';
import MilkRecord from '../models/MilkRecord.js';
import HealthRecord from '../models/HealthRecord.js';
import BreedingRecord from '../models/BreedingRecord.js';
import Expense from '../models/Expense.js';
import Revenue from '../models/Revenue.js';
import Subscription from '../models/Subscription.js';

const router = Router();
router.use(auth);

// Helper to create notification if not exists
async function createIfNew(data) {
  try {
    await Notification.create(data);
  } catch (err) {
    if (err.code !== 11000) console.error('Notification error:', err.message); // Ignore duplicates
  }
}

// Auto-generate smart notifications
router.post('/generate', async (req, res, next) => {
  try {
    const farmId = req.user.farmId;
    const userId = req.user._id;
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    // 1. Overdue vaccinations
    const overdue = await HealthRecord.find({
      farmId,
      nextDueDate: { $lt: today, $gte: new Date(Date.now() - 30 * 86400000) },
    }).populate('cattleId', 'tagNumber breed').limit(10);

    for (const h of overdue) {
      await createIfNew({
        farmId, userId,
        title: `⚠️ Overdue: ${h.description}`,
        message: `Tag ${h.cattleId?.tagNumber} (${h.cattleId?.breed}) — ${h.description} was due on ${new Date(h.nextDueDate).toLocaleDateString('en-IN')}. Please attend to it immediately.`,
        severity: 'critical',
        type: 'vaccination_overdue',
        actionUrl: '/health',
        refId: `vacc_overdue_${h._id}_${todayStr}`,
      });
    }

    // 2. Upcoming vaccinations (within 3 days)
    const threeDays = new Date(Date.now() + 3 * 86400000);
    const upcoming = await HealthRecord.find({
      farmId, nextDueDate: { $gte: today, $lte: threeDays },
    }).populate('cattleId', 'tagNumber breed').limit(10);

    for (const h of upcoming) {
      const daysLeft = Math.ceil((new Date(h.nextDueDate) - today) / 86400000);
      await createIfNew({
        farmId, userId,
        title: `💉 Vaccination in ${daysLeft} day${daysLeft > 1 ? 's' : ''}`,
        message: `Tag ${h.cattleId?.tagNumber} — ${h.description} due on ${new Date(h.nextDueDate).toLocaleDateString('en-IN')}.`,
        severity: 'warning',
        type: 'vaccination_upcoming',
        actionUrl: '/health',
        refId: `vacc_upcoming_${h._id}_${todayStr}`,
      });
    }

    // 3. Expected deliveries within 7 days
    const sevenDays = new Date(Date.now() + 7 * 86400000);
    const deliveries = await BreedingRecord.find({
      farmId, status: { $in: ['bred', 'confirmed'] },
      expectedDelivery: { $gte: today, $lte: sevenDays },
    }).populate('cattleId', 'tagNumber breed');

    for (const b of deliveries) {
      const daysLeft = Math.ceil((new Date(b.expectedDelivery) - today) / 86400000);
      await createIfNew({
        farmId, userId,
        title: `🐣 Delivery expected in ${daysLeft} day${daysLeft > 1 ? 's' : ''}`,
        message: `Tag ${b.cattleId?.tagNumber} (${b.cattleId?.breed}) — expected delivery on ${new Date(b.expectedDelivery).toLocaleDateString('en-IN')}.`,
        severity: daysLeft <= 2 ? 'critical' : 'warning',
        type: 'breeding_delivery',
        actionUrl: '/breeding',
        refId: `delivery_${b._id}_${todayStr}`,
      });
    }

    // 4. Low milk production alert (compare today vs 7-day avg)
    const todayStart = new Date(today); todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart); todayEnd.setDate(todayEnd.getDate() + 1);
    const weekAgo = new Date(Date.now() - 7 * 86400000);

    const [todayMilkAgg, weekMilkAgg] = await Promise.all([
      MilkRecord.aggregate([
        { $match: { farmId, date: { $gte: todayStart, $lt: todayEnd } } },
        { $group: { _id: null, total: { $sum: '$totalYield' } } },
      ]),
      MilkRecord.aggregate([
        { $match: { farmId, date: { $gte: weekAgo, $lt: todayStart } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } }, total: { $sum: '$totalYield' } } },
      ]),
    ]);

    const todayTotal = todayMilkAgg[0]?.total || 0;
    const weekAvg = weekMilkAgg.length > 0
      ? weekMilkAgg.reduce((s, d) => s + d.total, 0) / weekMilkAgg.length
      : 0;

    if (todayTotal > 0 && weekAvg > 0 && todayTotal < weekAvg * 0.75) {
      const drop = ((1 - todayTotal / weekAvg) * 100).toFixed(0);
      await createIfNew({
        farmId, userId,
        title: `📉 Milk production dropped ${drop}%`,
        message: `Today's milk (${todayTotal.toFixed(1)}L) is significantly lower than 7-day average (${weekAvg.toFixed(1)}L). Check for health issues or missed recordings.`,
        severity: 'warning',
        type: 'low_milk',
        actionUrl: '/milk',
        refId: `low_milk_${todayStr}`,
      });
    }

    // 5. Expense exceeding revenue this month
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const [expAgg, revAgg] = await Promise.all([
      Expense.aggregate([{ $match: { farmId, date: { $gte: monthStart } } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
      Revenue.aggregate([{ $match: { farmId, date: { $gte: monthStart } } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
    ]);
    const totalExp = expAgg[0]?.total || 0;
    const totalRev = revAgg[0]?.total || 0;

    if (totalExp > totalRev && totalExp > 0 && today.getDate() > 10) {
      await createIfNew({
        farmId, userId,
        title: `💸 Expenses exceeding revenue`,
        message: `This month: Expenses ₹${totalExp.toLocaleString('en-IN')} > Revenue ₹${totalRev.toLocaleString('en-IN')}. Net loss: ₹${(totalExp - totalRev).toLocaleString('en-IN')}.`,
        severity: 'warning',
        type: 'expense_alert',
        actionUrl: '/finance',
        refId: `expense_alert_${today.getFullYear()}_${today.getMonth()}`,
      });
    }

    // 6. Subscription expiring soon
    const sub = await Subscription.findOne({
      userId, isActive: true, endDate: { $gte: today },
    }).sort('-endDate');

    if (sub) {
      const daysLeft = Math.ceil((new Date(sub.endDate) - today) / 86400000);
      if (daysLeft <= 3 && daysLeft > 0) {
        await createIfNew({
          farmId, userId,
          title: `⏰ Subscription expiring in ${daysLeft} day${daysLeft > 1 ? 's' : ''}`,
          message: `Your ${sub.plan} plan expires on ${new Date(sub.endDate).toLocaleDateString('en-IN')}. Renew now to avoid interruption.`,
          severity: 'critical',
          type: 'subscription_expiring',
          actionUrl: '/subscription',
          refId: `sub_expire_${sub._id}_${todayStr}`,
        });
      }
    }

    // 7. No milk recorded today (after 10 AM IST)
    const istHour = new Date().getUTCHours() + 5.5;
    if (istHour >= 10 && todayTotal === 0) {
      const activeMilking = await Cattle.countDocuments({ farmId, status: 'active', category: 'milking' });
      if (activeMilking > 0) {
        await createIfNew({
          farmId, userId,
          title: `📝 No milk recorded today`,
          message: `You have ${activeMilking} milking cattle but no milk records for today. Don't forget to record!`,
          severity: 'info',
          type: 'no_milk_today',
          actionUrl: '/milk',
          refId: `no_milk_${todayStr}`,
        });
      }
    }

    // Cleanup old notifications (older than 30 days)
    await Notification.deleteMany({ farmId, createdAt: { $lt: new Date(Date.now() - 30 * 86400000) } });

    res.json({ success: true, message: 'Notifications generated' });
  } catch (err) { next(err); }
});

// Get notifications
router.get('/', async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const data = await Notification.find({ userId: req.user._id })
      .sort('-createdAt').limit(limit);
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

// Get unread count
router.get('/count', async (req, res, next) => {
  try {
    const unread = await Notification.countDocuments({ userId: req.user._id, read: false });
    res.json({ success: true, data: { unread } });
  } catch (err) { next(err); }
});

// Mark one as read
router.put('/:id/read', async (req, res, next) => {
  try {
    await Notification.findOneAndUpdate({ _id: req.params.id, userId: req.user._id }, { read: true });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// Mark all as read
router.put('/read-all', async (req, res, next) => {
  try {
    await Notification.updateMany({ userId: req.user._id, read: false }, { read: true });
    res.json({ success: true });
  } catch (err) { next(err); }
});

export default router;
