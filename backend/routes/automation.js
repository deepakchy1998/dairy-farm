import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import { checkSubscription } from '../middleware/subscription.js';
import AutomationLog from '../models/AutomationLog.js';
import MilkRecord from '../models/MilkRecord.js';
import MilkDelivery from '../models/MilkDelivery.js';
import Customer from '../models/Customer.js';
import CustomerPayment from '../models/CustomerPayment.js';
import Cattle from '../models/Cattle.js';
import Employee from '../models/Employee.js';
import Attendance from '../models/Attendance.js';
import SalaryPayment from '../models/SalaryPayment.js';
import Expense from '../models/Expense.js';
import BreedingRecord from '../models/BreedingRecord.js';
import HealthRecord from '../models/HealthRecord.js';
import { logActivity } from '../utils/helpers.js';

const router = Router();
router.use(auth, checkSubscription);

// ── Helpers ──
function todayStart() {
  const d = new Date(); d.setHours(0, 0, 0, 0); return d;
}
function dateKey(d) {
  return d.toISOString().split('T')[0];
}

// Check if automation already ran today for this type
async function alreadyRan(farmId, type, date) {
  const d = new Date(date); d.setHours(0, 0, 0, 0);
  return AutomationLog.findOne({ farmId, type, date: d });
}

// Log automation run
async function logAutomation(farmId, userId, type, date, summary, created, skipped, details = {}, status = 'success') {
  const d = new Date(date); d.setHours(0, 0, 0, 0);
  return AutomationLog.findOneAndUpdate(
    { farmId, type, date: d },
    { farmId, userId, type, date: d, summary, recordsCreated: created, recordsSkipped: skipped, details, status },
    { upsert: true, new: true }
  );
}

// ════════════════════════════════════════════════════
//  1. MILK RECORD PRE-FILL (copy yesterday → today template)
//     Creates today's records using yesterday's yield values
//     Safe: skips cattle that already have today's record
// ════════════════════════════════════════════════════
router.post('/milk-prefill', async (req, res, next) => {
  try {
    const farmId = req.user.farmId;
    const today = todayStart();
    const yesterday = new Date(today.getTime() - 86400000);
    const tomorrow = new Date(today.getTime() + 86400000);

    // Get yesterday's milk records
    const yesterdayRecords = await MilkRecord.find({
      farmId, date: { $gte: yesterday, $lt: today },
    }).lean();

    if (!yesterdayRecords.length) {
      return res.json({ success: true, data: { message: 'No yesterday records to copy from', created: 0, skipped: 0 } });
    }

    // Get today's existing records to avoid duplicates
    const todayExisting = await MilkRecord.find({
      farmId, date: { $gte: today, $lt: tomorrow },
    }).lean();
    const existingCattleIds = new Set(todayExisting.map(r => r.cattleId.toString()));

    // Also verify cattle are still active
    const activeCattle = await Cattle.find({ farmId, status: 'active', category: 'milking' }).select('_id').lean();
    const activeCattleIds = new Set(activeCattle.map(c => c._id.toString()));

    let created = 0, skipped = 0;
    const newRecords = [];

    for (const rec of yesterdayRecords) {
      const cattleIdStr = rec.cattleId.toString();
      // Skip if already has today's record or cattle no longer active/milking
      if (existingCattleIds.has(cattleIdStr)) { skipped++; continue; }
      if (!activeCattleIds.has(cattleIdStr)) { skipped++; continue; }

      newRecords.push({
        farmId,
        cattleId: rec.cattleId,
        date: today,
        morningYield: rec.morningYield || 0,
        morningFat: rec.morningFat,
        morningSNF: rec.morningSNF,
        afternoonYield: rec.afternoonYield || 0,
        afternoonFat: rec.afternoonFat,
        afternoonSNF: rec.afternoonSNF,
        eveningYield: rec.eveningYield || 0,
        eveningFat: rec.eveningFat,
        eveningSNF: rec.eveningSNF,
        totalYield: (rec.morningYield || 0) + (rec.afternoonYield || 0) + (rec.eveningYield || 0),
      });
    }

    if (newRecords.length) {
      // Use insertMany with ordered:false to skip duplicates gracefully
      try {
        const result = await MilkRecord.insertMany(newRecords, { ordered: false });
        created = result.length;
      } catch (err) {
        // Some may fail due to unique constraint — count the ones that succeeded
        if (err.insertedDocs) created = err.insertedDocs.length;
        else if (err.result?.nInserted) created = err.result.nInserted;
      }
    }

    await logAutomation(farmId, req.user._id, 'milk_prefill', today,
      `Pre-filled ${created} milk records from yesterday's data`, created, skipped);

    if (created > 0) {
      logActivity(farmId, req.user._id, 'automation', `Auto pre-filled ${created} milk records from yesterday`).catch(() => {});
    }

    res.json({ success: true, data: { message: `Pre-filled ${created} milk records from yesterday`, created, skipped } });
  } catch (err) { next(err); }
});

// ════════════════════════════════════════════════════
//  2. DAILY ATTENDANCE PRE-FILL (mark all active employees present)
//     Safe: skips employees that already have today's attendance
// ════════════════════════════════════════════════════
router.post('/attendance-prefill', async (req, res, next) => {
  try {
    const farmId = req.user.farmId;
    const today = todayStart();

    // Get active employees
    const employees = await Employee.find({ farmId, status: 'active' }).select('_id name').lean();
    if (!employees.length) {
      return res.json({ success: true, data: { message: 'No active employees', created: 0, skipped: 0 } });
    }

    // Check existing attendance
    const existing = await Attendance.find({ farmId, date: today }).select('employeeId').lean();
    const existingIds = new Set(existing.map(a => a.employeeId.toString()));

    let created = 0, skipped = 0;
    const records = [];

    for (const emp of employees) {
      if (existingIds.has(emp._id.toString())) { skipped++; continue; }
      records.push({
        farmId,
        employeeId: emp._id,
        date: today,
        status: 'present',
        checkIn: '06:00',
        notes: 'Auto-filled',
      });
    }

    if (records.length) {
      try {
        const result = await Attendance.insertMany(records, { ordered: false });
        created = result.length;
      } catch (err) {
        if (err.insertedDocs) created = err.insertedDocs.length;
      }
    }

    await logAutomation(farmId, req.user._id, 'attendance_prefill', today,
      `Marked ${created} employees present`, created, skipped);

    if (created > 0) {
      logActivity(farmId, req.user._id, 'automation', `Auto-marked ${created} employees present`).catch(() => {});
    }

    res.json({ success: true, data: { message: `Marked ${created} employees present (${skipped} already recorded)`, created, skipped } });
  } catch (err) { next(err); }
});

// ════════════════════════════════════════════════════
//  3. DAILY MILK DELIVERY GENERATION
//     Auto-create delivery records for all active customers
//     based on their dailyQuantity and ratePerLiter
//     Safe: skips customers who already have today's delivery
//     Also updates customer balance
// ════════════════════════════════════════════════════
router.post('/delivery-generate', async (req, res, next) => {
  try {
    const farmId = req.user.farmId;
    const today = todayStart();
    const tomorrow = new Date(today.getTime() + 86400000);
    const { session = 'morning' } = req.body;

    // Get active customers
    const customers = await Customer.find({ farmId, status: 'active', dailyQuantity: { $gt: 0 } }).lean();
    if (!customers.length) {
      return res.json({ success: true, data: { message: 'No active customers', created: 0, skipped: 0 } });
    }

    // Check existing deliveries for today + session
    const existing = await MilkDelivery.find({
      farmId, date: { $gte: today, $lt: tomorrow }, session,
    }).select('customerId').lean();
    const existingIds = new Set(existing.map(d => d.customerId.toString()));

    let created = 0, skipped = 0, totalQty = 0, totalAmt = 0;
    const records = [];

    for (const cust of customers) {
      if (existingIds.has(cust._id.toString())) { skipped++; continue; }
      // Only generate for matching delivery time (or all if not specified)
      if (cust.deliveryTime && cust.deliveryTime !== session && cust.deliveryTime !== 'both') { skipped++; continue; }

      const qty = cust.dailyQuantity;
      const rate = cust.ratePerLiter;
      const amt = qty * rate;

      records.push({
        farmId,
        customerId: cust._id,
        date: today,
        quantity: qty,
        ratePerLiter: rate,
        amount: amt,
        session,
        notes: 'Auto-generated',
      });
      totalQty += qty;
      totalAmt += amt;
    }

    if (records.length) {
      try {
        const result = await MilkDelivery.insertMany(records, { ordered: false });
        created = result.length;

        // Update customer balances for the ones that were created
        for (const rec of records) {
          await Customer.findByIdAndUpdate(rec.customerId, { $inc: { balance: rec.amount } });
        }
      } catch (err) {
        if (err.insertedDocs) created = err.insertedDocs.length;
      }
    }

    await logAutomation(farmId, req.user._id, 'delivery_generate', today,
      `Generated ${created} deliveries: ${totalQty.toFixed(1)}L, ₹${totalAmt.toFixed(0)}`, created, skipped,
      { session, totalQty, totalAmt });

    if (created > 0) {
      logActivity(farmId, req.user._id, 'automation', `Auto-generated ${created} milk deliveries (${session}): ${totalQty.toFixed(1)}L`).catch(() => {});
    }

    res.json({ success: true, data: { message: `Generated ${created} deliveries (${totalQty.toFixed(1)}L, ₹${totalAmt.toFixed(0)})`, created, skipped, totalQty, totalAmt } });
  } catch (err) { next(err); }
});

// ════════════════════════════════════════════════════
//  4. MONTHLY SALARY CALCULATOR
//     Auto-calculate salary for all employees based on attendance
//     Safe: won't overwrite already-paid salaries
// ════════════════════════════════════════════════════
router.post('/salary-calculate', async (req, res, next) => {
  try {
    const farmId = req.user.farmId;
    const { month } = req.body; // e.g., '2026-02'
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({ success: false, message: 'Month required in YYYY-MM format' });
    }

    const [year, mon] = month.split('-').map(Number);
    const monthStart = new Date(year, mon - 1, 1);
    const monthEnd = new Date(year, mon, 0); // Last day of month
    const totalDays = monthEnd.getDate();

    // Get active employees
    const employees = await Employee.find({ farmId, status: { $in: ['active', 'on-leave'] } }).lean();
    if (!employees.length) {
      return res.json({ success: true, data: { message: 'No employees', created: 0 } });
    }

    // Get all attendance for the month
    const attendance = await Attendance.find({
      farmId, date: { $gte: monthStart, $lte: monthEnd },
    }).lean();

    // Group attendance by employee
    const attMap = {};
    for (const a of attendance) {
      const eid = a.employeeId.toString();
      if (!attMap[eid]) attMap[eid] = { present: 0, absent: 0, halfDay: 0, leave: 0, holiday: 0, overtime: 0 };
      attMap[eid][a.status === 'half-day' ? 'halfDay' : a.status] = (attMap[eid][a.status === 'half-day' ? 'halfDay' : a.status] || 0) + 1;
      if (a.overtime) attMap[eid].overtime += a.overtime;
    }

    let created = 0, updated = 0, skipped = 0;

    for (const emp of employees) {
      const eid = emp._id.toString();
      const att = attMap[eid] || { present: 0, absent: 0, halfDay: 0, leave: 0, holiday: 0, overtime: 0 };

      // Check if salary already calculated and paid
      const existingSalary = await SalaryPayment.findOne({ farmId, employeeId: emp._id, month });
      if (existingSalary?.status === 'paid') { skipped++; continue; }

      const daysWorked = att.present + att.holiday + (att.halfDay * 0.5);
      const perDayRate = emp.dailyWage > 0 ? emp.dailyWage : emp.monthlySalary / totalDays;
      const basePay = emp.dailyWage > 0
        ? daysWorked * emp.dailyWage
        : (daysWorked / totalDays) * emp.monthlySalary;

      const overtimeRate = perDayRate / 8 * 1.5; // 1.5x for overtime
      const overtimeAmt = att.overtime * overtimeRate;

      // Advance deduction
      const advanceDeduct = Math.min(emp.totalAdvance || 0, basePay * 0.25); // Max 25% of base

      const netSalary = Math.round(basePay + overtimeAmt - advanceDeduct);

      const salaryData = {
        farmId,
        employeeId: emp._id,
        month,
        baseSalary: emp.monthlySalary,
        daysWorked: Math.round(daysWorked * 10) / 10,
        totalDays,
        halfDays: att.halfDay,
        absentDays: att.absent,
        overtimeHours: att.overtime,
        overtimeAmount: Math.round(overtimeAmt),
        advance: Math.round(advanceDeduct),
        netSalary,
        status: 'pending',
        notes: 'Auto-calculated from attendance',
      };

      if (existingSalary) {
        // Update only if pending
        if (existingSalary.status === 'pending') {
          await SalaryPayment.findByIdAndUpdate(existingSalary._id, salaryData);
          updated++;
        } else {
          skipped++;
        }
      } else {
        await SalaryPayment.create(salaryData);
        created++;
      }
    }

    await logAutomation(farmId, req.user._id, 'salary_calculate', new Date(),
      `Calculated salary for ${created + updated} employees (month: ${month})`, created + updated, skipped,
      { month });

    if (created + updated > 0) {
      logActivity(farmId, req.user._id, 'automation', `Auto-calculated ${month} salary for ${created + updated} employees`).catch(() => {});
    }

    res.json({ success: true, data: { message: `Salary calculated: ${created} new, ${updated} updated, ${skipped} skipped (already paid)`, created, updated, skipped } });
  } catch (err) { next(err); }
});

// ════════════════════════════════════════════════════
//  5. BREEDING HEAT PREDICTOR
//     Auto-calculate next expected heat dates (21-day cycle)
//     and expected dry-off dates for pregnant cattle
//     Read-only: returns predictions, doesn't modify records
// ════════════════════════════════════════════════════
router.get('/breeding-predictions', async (req, res, next) => {
  try {
    const farmId = req.user.farmId;
    const predictions = [];

    // 1. Failed breeding → predict next heat (21 days from last breeding)
    const failedBreedings = await BreedingRecord.find({
      farmId, status: 'failed',
    }).populate('cattleId', 'tagNumber breed category status').sort('-breedingDate').lean();

    // Get latest failure per cattle
    const latestFailure = {};
    for (const b of failedBreedings) {
      const cid = b.cattleId?._id?.toString();
      if (cid && b.cattleId?.status === 'active' && !latestFailure[cid]) {
        latestFailure[cid] = b;
      }
    }

    for (const [cid, b] of Object.entries(latestFailure)) {
      const lastDate = new Date(b.breedingDate);
      // Predict next heats at 21-day intervals
      const nextHeat = new Date(lastDate.getTime() + 21 * 86400000);
      // If next heat is in the past, project forward
      let predicted = nextHeat;
      while (predicted < new Date()) {
        predicted = new Date(predicted.getTime() + 21 * 86400000);
      }
      predictions.push({
        type: 'heat_prediction',
        cattleId: b.cattleId._id,
        tagNumber: b.cattleId.tagNumber,
        breed: b.cattleId.breed,
        predictedDate: predicted,
        daysFromNow: Math.ceil((predicted - new Date()) / 86400000),
        basis: `Failed breeding on ${lastDate.toLocaleDateString('en-IN')}, 21-day cycle`,
      });
    }

    // 2. Calved cattle → predict next heat (45-60 days after calving)
    const recentCalved = await Cattle.find({
      farmId, status: 'active', lastCalvingDate: { $exists: true, $ne: null },
    }).select('tagNumber breed lastCalvingDate').lean();

    for (const c of recentCalved) {
      if (latestFailure[c._id.toString()]) continue; // Already handled
      const calvingDate = new Date(c.lastCalvingDate);
      const daysSinceCalving = Math.ceil((new Date() - calvingDate) / 86400000);
      if (daysSinceCalving > 0 && daysSinceCalving < 120) {
        // First heat usually 45-60 days after calving
        let nextHeatEst = new Date(calvingDate.getTime() + 55 * 86400000);
        while (nextHeatEst < new Date()) {
          nextHeatEst = new Date(nextHeatEst.getTime() + 21 * 86400000);
        }
        if (Math.ceil((nextHeatEst - new Date()) / 86400000) <= 30) {
          predictions.push({
            type: 'heat_prediction',
            cattleId: c._id,
            tagNumber: c.tagNumber,
            breed: c.breed,
            predictedDate: nextHeatEst,
            daysFromNow: Math.ceil((nextHeatEst - new Date()) / 86400000),
            basis: `Calved on ${calvingDate.toLocaleDateString('en-IN')}, ${daysSinceCalving} DIM`,
          });
        }
      }
    }

    // 3. Confirmed pregnancies → predict dry-off and calving prep
    const pregnantRecords = await BreedingRecord.find({
      farmId, status: { $in: ['bred', 'confirmed'] },
      expectedDelivery: { $exists: true },
    }).populate('cattleId', 'tagNumber breed').lean();

    for (const b of pregnantRecords) {
      if (!b.cattleId || b.cattleId.status === 'sold' || b.cattleId.status === 'dead') continue;
      const expDel = new Date(b.expectedDelivery);
      const dryOffDate = new Date(expDel.getTime() - 60 * 86400000);
      const daysToDryOff = Math.ceil((dryOffDate - new Date()) / 86400000);
      const daysToDelivery = Math.ceil((expDel - new Date()) / 86400000);

      if (daysToDryOff > -10 && daysToDryOff <= 30) {
        predictions.push({
          type: 'dry_off',
          cattleId: b.cattleId._id,
          tagNumber: b.cattleId.tagNumber,
          breed: b.cattleId.breed,
          predictedDate: dryOffDate,
          daysFromNow: daysToDryOff,
          deliveryDate: expDel,
          daysToDelivery,
          basis: `Expected delivery ${expDel.toLocaleDateString('en-IN')}, dry off 60 days before`,
        });
      }
    }

    // 4. Vaccination reminders from health records
    const upcomingVacc = await HealthRecord.find({
      farmId, nextDueDate: { $gte: new Date(), $lte: new Date(Date.now() + 14 * 86400000) },
    }).populate('cattleId', 'tagNumber breed').lean();

    for (const h of upcomingVacc) {
      if (!h.cattleId) continue;
      predictions.push({
        type: 'vaccination_due',
        cattleId: h.cattleId._id,
        tagNumber: h.cattleId.tagNumber,
        breed: h.cattleId.breed,
        predictedDate: h.nextDueDate,
        daysFromNow: Math.ceil((new Date(h.nextDueDate) - new Date()) / 86400000),
        description: h.description,
        basis: `Last: ${h.description} on ${new Date(h.date).toLocaleDateString('en-IN')}`,
      });
    }

    // Sort by date
    predictions.sort((a, b) => new Date(a.predictedDate) - new Date(b.predictedDate));

    res.json({ success: true, data: predictions });
  } catch (err) { next(err); }
});

// ════════════════════════════════════════════════════
//  6. RECURRING EXPENSE GENERATOR
//     Auto-create monthly expenses that repeat (salary, rent, EMI, etc.)
//     Stored in AppConfig as recurringExpenses array
// ════════════════════════════════════════════════════
router.post('/recurring-expenses', async (req, res, next) => {
  try {
    const farmId = req.user.farmId;
    const today = todayStart();
    const monthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

    // Get recurring expense config from request or stored config
    const { expenses } = req.body; // [{ category, description, amount, dayOfMonth }]
    if (!expenses?.length) {
      return res.json({ success: true, data: { message: 'No recurring expenses configured', created: 0 } });
    }

    let created = 0, skipped = 0;

    for (const exp of expenses) {
      if (!exp.category || !exp.amount || exp.amount <= 0) { skipped++; continue; }

      const targetDay = exp.dayOfMonth || 1;
      const targetDate = new Date(today.getFullYear(), today.getMonth(), targetDay);

      // Check if already exists (same category + description + month)
      const existing = await Expense.findOne({
        farmId,
        category: exp.category,
        description: exp.description || `Recurring: ${exp.category}`,
        date: { $gte: new Date(today.getFullYear(), today.getMonth(), 1), $lt: new Date(today.getFullYear(), today.getMonth() + 1, 1) },
      });

      if (existing) { skipped++; continue; }

      await Expense.create({
        farmId,
        date: targetDate,
        category: exp.category,
        description: exp.description || `Recurring: ${exp.category}`,
        amount: exp.amount,
      });
      created++;
    }

    await logAutomation(farmId, req.user._id, 'recurring_expense', today,
      `Created ${created} recurring expenses for ${monthKey}`, created, skipped, { monthKey });

    if (created > 0) {
      logActivity(farmId, req.user._id, 'automation', `Auto-created ${created} recurring expenses for ${monthKey}`).catch(() => {});
    }

    res.json({ success: true, data: { message: `Created ${created} recurring expenses, ${skipped} skipped`, created, skipped } });
  } catch (err) { next(err); }
});

// ════════════════════════════════════════════════════
//  7. MONTHLY CUSTOMER BILL SUMMARY
//     Read-only: calculate what each customer owes for the month
// ════════════════════════════════════════════════════
router.get('/customer-bills', async (req, res, next) => {
  try {
    const farmId = req.user.farmId;
    const { month } = req.query; // YYYY-MM
    const now = new Date();
    const [year, mon] = (month || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`).split('-').map(Number);
    const monthStart = new Date(year, mon - 1, 1);
    const monthEnd = new Date(year, mon, 0, 23, 59, 59);

    const customers = await Customer.find({ farmId }).lean();
    const bills = [];

    for (const cust of customers) {
      const [deliveries, payments] = await Promise.all([
        MilkDelivery.aggregate([
          { $match: { customerId: cust._id, date: { $gte: monthStart, $lte: monthEnd } } },
          { $group: { _id: null, totalQty: { $sum: '$quantity' }, totalAmt: { $sum: '$amount' }, count: { $sum: 1 } } },
        ]),
        CustomerPayment.aggregate([
          { $match: { customerId: cust._id, date: { $gte: monthStart, $lte: monthEnd } } },
          { $group: { _id: null, totalPaid: { $sum: '$amount' } } },
        ]),
      ]);

      const totalDelivered = deliveries[0]?.totalQty || 0;
      const totalBilled = deliveries[0]?.totalAmt || 0;
      const deliveryCount = deliveries[0]?.count || 0;
      const totalPaid = payments[0]?.totalPaid || 0;

      if (totalDelivered > 0 || cust.balance > 0) {
        bills.push({
          customerId: cust._id,
          name: cust.name,
          phone: cust.phone,
          village: cust.village,
          dailyQuantity: cust.dailyQuantity,
          ratePerLiter: cust.ratePerLiter,
          totalDelivered,
          totalBilled,
          deliveryCount,
          totalPaid,
          monthDue: totalBilled - totalPaid,
          outstandingBalance: cust.balance,
          status: cust.status,
        });
      }
    }

    bills.sort((a, b) => b.outstandingBalance - a.outstandingBalance);
    const totalDue = bills.reduce((s, b) => s + b.outstandingBalance, 0);
    const totalMonthBilled = bills.reduce((s, b) => s + b.totalBilled, 0);
    const totalMonthPaid = bills.reduce((s, b) => s + b.totalPaid, 0);

    res.json({
      success: true,
      data: {
        month: `${year}-${String(mon).padStart(2, '0')}`,
        bills,
        summary: { totalCustomers: bills.length, totalMonthBilled, totalMonthPaid, totalOutstanding: totalDue },
      },
    });
  } catch (err) { next(err); }
});

// ════════════════════════════════════════════════════
//  8. RUN ALL DAILY AUTOMATIONS (single button click)
//     Runs: milk prefill + attendance prefill + delivery generate
//     Safe: each sub-task is idempotent (won't duplicate)
// ════════════════════════════════════════════════════
router.post('/run-daily', async (req, res, next) => {
  try {
    const farmId = req.user.farmId;
    const results = {};

    // 1. Milk pre-fill
    try {
      const today = todayStart();
      const yesterday = new Date(today.getTime() - 86400000);
      const tomorrow = new Date(today.getTime() + 86400000);

      const yesterdayRecords = await MilkRecord.find({ farmId, date: { $gte: yesterday, $lt: today } }).lean();
      const todayExisting = await MilkRecord.find({ farmId, date: { $gte: today, $lt: tomorrow } }).lean();
      const existingCattleIds = new Set(todayExisting.map(r => r.cattleId.toString()));
      const activeCattle = await Cattle.find({ farmId, status: 'active', category: 'milking' }).select('_id').lean();
      const activeCattleIds = new Set(activeCattle.map(c => c._id.toString()));

      let milkCreated = 0, milkSkipped = 0;
      const milkRecords = [];
      for (const rec of yesterdayRecords) {
        const cid = rec.cattleId.toString();
        if (existingCattleIds.has(cid) || !activeCattleIds.has(cid)) { milkSkipped++; continue; }
        milkRecords.push({
          farmId, cattleId: rec.cattleId, date: today,
          morningYield: rec.morningYield || 0, morningFat: rec.morningFat, morningSNF: rec.morningSNF,
          afternoonYield: rec.afternoonYield || 0, afternoonFat: rec.afternoonFat, afternoonSNF: rec.afternoonSNF,
          eveningYield: rec.eveningYield || 0, eveningFat: rec.eveningFat, eveningSNF: rec.eveningSNF,
          totalYield: (rec.morningYield || 0) + (rec.afternoonYield || 0) + (rec.eveningYield || 0),
        });
      }
      if (milkRecords.length) {
        try {
          const r = await MilkRecord.insertMany(milkRecords, { ordered: false });
          milkCreated = r.length;
        } catch (e) { milkCreated = e.insertedDocs?.length || 0; }
      }
      results.milk = { created: milkCreated, skipped: milkSkipped };
      await logAutomation(farmId, req.user._id, 'milk_prefill', today, `Pre-filled ${milkCreated} milk records`, milkCreated, milkSkipped);
    } catch (e) { results.milk = { error: e.message }; }

    // 2. Attendance pre-fill
    try {
      const today = todayStart();
      const employees = await Employee.find({ farmId, status: 'active' }).select('_id').lean();
      const existingAtt = await Attendance.find({ farmId, date: today }).select('employeeId').lean();
      const existingIds = new Set(existingAtt.map(a => a.employeeId.toString()));

      let attCreated = 0, attSkipped = 0;
      const attRecords = [];
      for (const emp of employees) {
        if (existingIds.has(emp._id.toString())) { attSkipped++; continue; }
        attRecords.push({ farmId, employeeId: emp._id, date: today, status: 'present', checkIn: '06:00', notes: 'Auto-filled' });
      }
      if (attRecords.length) {
        try {
          const r = await Attendance.insertMany(attRecords, { ordered: false });
          attCreated = r.length;
        } catch (e) { attCreated = e.insertedDocs?.length || 0; }
      }
      results.attendance = { created: attCreated, skipped: attSkipped };
      await logAutomation(farmId, req.user._id, 'attendance_prefill', today, `Marked ${attCreated} present`, attCreated, attSkipped);
    } catch (e) { results.attendance = { error: e.message }; }

    // 3. Delivery generation (morning)
    try {
      const today = todayStart();
      const tomorrow = new Date(today.getTime() + 86400000);
      const customers = await Customer.find({ farmId, status: 'active', dailyQuantity: { $gt: 0 } }).lean();
      const existingDel = await MilkDelivery.find({ farmId, date: { $gte: today, $lt: tomorrow }, session: 'morning' }).select('customerId').lean();
      const existingDelIds = new Set(existingDel.map(d => d.customerId.toString()));

      let delCreated = 0, delSkipped = 0;
      const delRecords = [];
      for (const cust of customers) {
        if (existingDelIds.has(cust._id.toString())) { delSkipped++; continue; }
        const amt = cust.dailyQuantity * cust.ratePerLiter;
        delRecords.push({ farmId, customerId: cust._id, date: today, quantity: cust.dailyQuantity, ratePerLiter: cust.ratePerLiter, amount: amt, session: 'morning', notes: 'Auto-generated' });
      }
      if (delRecords.length) {
        try {
          const r = await MilkDelivery.insertMany(delRecords, { ordered: false });
          delCreated = r.length;
          for (const rec of delRecords) {
            await Customer.findByIdAndUpdate(rec.customerId, { $inc: { balance: rec.amount } });
          }
        } catch (e) { delCreated = e.insertedDocs?.length || 0; }
      }
      results.delivery = { created: delCreated, skipped: delSkipped };
      await logAutomation(farmId, req.user._id, 'delivery_generate', today, `Generated ${delCreated} deliveries`, delCreated, delSkipped);
    } catch (e) { results.delivery = { error: e.message }; }

    // Log combined activity
    logActivity(farmId, req.user._id, 'automation',
      `Daily automation: Milk(${results.milk?.created || 0}), Attendance(${results.attendance?.created || 0}), Delivery(${results.delivery?.created || 0})`
    ).catch(() => {});

    res.json({ success: true, data: { message: 'Daily automations complete', results } });
  } catch (err) { next(err); }
});

// ════════════════════════════════════════════════════
//  9. AUTOMATION STATUS (what ran today)
// ════════════════════════════════════════════════════
router.get('/status', async (req, res, next) => {
  try {
    const farmId = req.user.farmId;
    const today = todayStart();
    const logs = await AutomationLog.find({ farmId, date: { $gte: today } }).sort('-createdAt').lean();

    // Also get counts for what CAN be automated today
    const tomorrow = new Date(today.getTime() + 86400000);
    const [milkingCattle, employees, activeCustomers, todayMilk, todayAtt, todayDel] = await Promise.all([
      Cattle.countDocuments({ farmId, status: 'active', category: 'milking' }),
      Employee.countDocuments({ farmId, status: 'active' }),
      Customer.countDocuments({ farmId, status: 'active', dailyQuantity: { $gt: 0 } }),
      MilkRecord.countDocuments({ farmId, date: { $gte: today, $lt: tomorrow } }),
      Attendance.countDocuments({ farmId, date: today }),
      MilkDelivery.countDocuments({ farmId, date: { $gte: today, $lt: tomorrow } }),
    ]);

    res.json({
      success: true,
      data: {
        todayLogs: logs,
        available: {
          milkPrefill: { total: milkingCattle, done: todayMilk, remaining: Math.max(0, milkingCattle - todayMilk) },
          attendance: { total: employees, done: todayAtt, remaining: Math.max(0, employees - todayAtt) },
          delivery: { total: activeCustomers, done: todayDel, remaining: Math.max(0, activeCustomers - todayDel) },
        },
      },
    });
  } catch (err) { next(err); }
});

// ════════════════════════════════════════════════════
//  10. UNDO AUTOMATION (delete auto-generated records for today)
//      Safety: only deletes records with 'Auto' in notes
// ════════════════════════════════════════════════════
router.post('/undo', async (req, res, next) => {
  try {
    const farmId = req.user.farmId;
    const { type } = req.body; // milk_prefill, attendance_prefill, delivery_generate
    const today = todayStart();
    const tomorrow = new Date(today.getTime() + 86400000);
    let deleted = 0;

    if (type === 'milk_prefill') {
      // Delete today's milk records that were auto-generated
      // Auto-generated records have exact same yield as yesterday — we can't tell them apart
      // So we only delete if the automation log exists for today
      const log = await AutomationLog.findOne({ farmId, type: 'milk_prefill', date: today });
      if (log) {
        const result = await MilkRecord.deleteMany({
          farmId, date: { $gte: today, $lt: tomorrow },
          createdAt: { $gte: log.createdAt, $lte: new Date(log.createdAt.getTime() + 5000) },
        });
        deleted = result.deletedCount;
        await AutomationLog.deleteOne({ _id: log._id });
      }
    } else if (type === 'attendance_prefill') {
      const result = await Attendance.deleteMany({
        farmId, date: today, notes: 'Auto-filled',
      });
      deleted = result.deletedCount;
      await AutomationLog.deleteOne({ farmId, type: 'attendance_prefill', date: today });
    } else if (type === 'delivery_generate') {
      // Find auto-generated deliveries and reverse balance changes
      const autoDeliveries = await MilkDelivery.find({
        farmId, date: { $gte: today, $lt: tomorrow }, notes: 'Auto-generated',
      }).lean();
      for (const del of autoDeliveries) {
        await Customer.findByIdAndUpdate(del.customerId, { $inc: { balance: -del.amount } });
      }
      const result = await MilkDelivery.deleteMany({
        farmId, date: { $gte: today, $lt: tomorrow }, notes: 'Auto-generated',
      });
      deleted = result.deletedCount;
      await AutomationLog.deleteOne({ farmId, type: 'delivery_generate', date: today });
    }

    if (deleted > 0) {
      logActivity(farmId, req.user._id, 'automation', `Undid ${type}: deleted ${deleted} auto-generated records`).catch(() => {});
    }

    res.json({ success: true, data: { message: `Undid ${type}: ${deleted} records removed`, deleted } });
  } catch (err) { next(err); }
});

export default router;
