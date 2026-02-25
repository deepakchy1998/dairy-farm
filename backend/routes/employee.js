import express from 'express';
import { auth } from '../middleware/auth.js';
import { checkSubscription } from '../middleware/subscription.js';
import Employee from '../models/Employee.js';
import Attendance from '../models/Attendance.js';
import SalaryPayment from '../models/SalaryPayment.js';
import { logActivity } from '../utils/helpers.js';

const router = express.Router();
router.use(auth, checkSubscription);

// ════════════════════════════════════════
//  EMPLOYEES CRUD
// ════════════════════════════════════════

router.get('/', async (req, res, next) => {
  try {
    const { search, status, role, sort = 'name' } = req.query;
    const filter = { farmId: req.user.farmId };
    if (status) filter.status = status;
    if (role) filter.role = { $regex: role, $options: 'i' };
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { role: { $regex: search, $options: 'i' } },
        { village: { $regex: search, $options: 'i' } },
      ];
    }
    const sortMap = { name: { name: 1 }, recent: { createdAt: -1 }, salary: { monthlySalary: -1 } };
    const employees = await Employee.find(filter).sort(sortMap[sort] || { name: 1 }).lean();
    res.json({ success: true, data: employees });
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const emp = await Employee.findOne({ _id: req.params.id, farmId: req.user.farmId }).lean();
    if (!emp) return res.status(404).json({ success: false, message: 'Employee not found' });
    res.json({ success: true, data: emp });
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const { name, phone, address, village, role, monthlySalary, dailyWage, joinDate, emergencyContact, aadhar, bankAccount, ifsc, notes } = req.body;
    if (!name || !role || monthlySalary == null) {
      return res.status(400).json({ success: false, message: 'Name, role, and monthly salary are required' });
    }
    const emp = await Employee.create({
      farmId: req.user.farmId, name, phone, address, village, role,
      monthlySalary: Number(monthlySalary), dailyWage: Number(dailyWage) || 0,
      joinDate: joinDate ? new Date(joinDate) : new Date(),
      emergencyContact, aadhar, bankAccount, ifsc, notes,
    });
    await logActivity(req.user.farmId, 'employee', '👷', `New employee added: ${name} (${role})`);
    res.status(201).json({ success: true, data: emp });
  } catch (err) { next(err); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const allowed = ['name', 'phone', 'address', 'village', 'role', 'monthlySalary', 'dailyWage', 'status', 'emergencyContact', 'aadhar', 'bankAccount', 'ifsc', 'notes', 'profilePhoto'];
    const updates = {};
    allowed.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });
    const emp = await Employee.findOneAndUpdate({ _id: req.params.id, farmId: req.user.farmId }, updates, { new: true });
    if (!emp) return res.status(404).json({ success: false, message: 'Employee not found' });
    res.json({ success: true, data: emp });
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const emp = await Employee.findOneAndDelete({ _id: req.params.id, farmId: req.user.farmId });
    if (!emp) return res.status(404).json({ success: false, message: 'Employee not found' });
    await Attendance.deleteMany({ employeeId: emp._id });
    await SalaryPayment.deleteMany({ employeeId: emp._id });
    await logActivity(req.user.farmId, 'employee', '🗑️', `Employee deleted: ${emp.name} (${emp.role})`);
    res.json({ success: true, message: 'Employee and all records deleted' });
  } catch (err) { next(err); }
});

// ════════════════════════════════════════
//  ATTENDANCE
// ════════════════════════════════════════

// Daily attendance sheet — all employees for a date
router.get('/attendance/daily', async (req, res, next) => {
  try {
    const date = req.query.date || new Date().toISOString().slice(0, 10);
    const employees = await Employee.find({ farmId: req.user.farmId, status: { $in: ['active', 'on-leave'] } }).sort({ name: 1 }).lean();
    const existing = await Attendance.find({ farmId: req.user.farmId, date: new Date(date) }).lean();
    const existMap = {};
    existing.forEach(a => { existMap[a.employeeId.toString()] = a; });

    const sheet = employees.map(e => ({
      employeeId: e._id,
      name: e.name,
      role: e.role,
      phone: e.phone,
      status: existMap[e._id.toString()]?.status || '',
      checkIn: existMap[e._id.toString()]?.checkIn || '',
      checkOut: existMap[e._id.toString()]?.checkOut || '',
      overtime: existMap[e._id.toString()]?.overtime || 0,
      notes: existMap[e._id.toString()]?.notes || '',
      recorded: !!existMap[e._id.toString()],
      attendanceId: existMap[e._id.toString()]?._id || null,
    }));

    res.json({ success: true, data: sheet, date });
  } catch (err) { next(err); }
});

// Bulk save attendance
router.post('/attendance/bulk', async (req, res, next) => {
  try {
    const { date, entries } = req.body;
    if (!date || !entries?.length) return res.status(400).json({ success: false, message: 'Date and entries required' });

    const results = [];
    for (const entry of entries) {
      if (!entry.employeeId || !entry.status) continue;
      try {
        const att = await Attendance.findOneAndUpdate(
          { farmId: req.user.farmId, employeeId: entry.employeeId, date: new Date(date) },
          { status: entry.status, checkIn: entry.checkIn || '', checkOut: entry.checkOut || '', overtime: Number(entry.overtime) || 0, notes: entry.notes || '', farmId: req.user.farmId },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
        results.push(att);
      } catch (e) { /* skip */ }
    }
    res.json({ success: true, data: results, count: results.length });
  } catch (err) { next(err); }
});

// Employee attendance history
router.get('/attendance/history/:employeeId', async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const filter = { farmId: req.user.farmId, employeeId: req.params.employeeId };
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) filter.date.$lte = new Date(endDate + 'T23:59:59');
    }
    const records = await Attendance.find(filter).sort({ date: -1 }).lean();

    const summary = {
      present: records.filter(r => r.status === 'present').length,
      absent: records.filter(r => r.status === 'absent').length,
      halfDay: records.filter(r => r.status === 'half-day').length,
      leave: records.filter(r => r.status === 'leave').length,
      holiday: records.filter(r => r.status === 'holiday').length,
      totalOvertime: records.reduce((s, r) => s + (r.overtime || 0), 0),
    };

    res.json({ success: true, data: { records, summary } });
  } catch (err) { next(err); }
});

// ════════════════════════════════════════
//  SALARY
// ════════════════════════════════════════

// Generate/get salary for a month
router.get('/salary/monthly', async (req, res, next) => {
  try {
    const month = req.query.month || (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; })();
    const [y, m] = month.split('-').map(Number);
    const startDate = new Date(y, m - 1, 1);
    const endDate = new Date(y, m, 0, 23, 59, 59);
    const totalDaysInMonth = new Date(y, m, 0).getDate();

    const employees = await Employee.find({ farmId: req.user.farmId, status: { $in: ['active', 'on-leave'] } }).lean();
    const existingSalaries = await SalaryPayment.find({ farmId: req.user.farmId, month }).lean();
    const existMap = {};
    existingSalaries.forEach(s => { existMap[s.employeeId.toString()] = s; });

    const salaries = [];
    for (const emp of employees) {
      // If salary already generated, return it
      if (existMap[emp._id.toString()]) {
        salaries.push({ ...existMap[emp._id.toString()], employee: emp });
        continue;
      }

      // Calculate from attendance
      const attendance = await Attendance.find({ employeeId: emp._id, date: { $gte: startDate, $lte: endDate } }).lean();
      const present = attendance.filter(a => a.status === 'present').length;
      const halfDays = attendance.filter(a => a.status === 'half-day').length;
      const absent = attendance.filter(a => a.status === 'absent').length;
      const overtimeHours = attendance.reduce((s, a) => s + (a.overtime || 0), 0);

      const effectiveDays = present + (halfDays * 0.5);
      const perDay = emp.dailyWage > 0 ? emp.dailyWage : emp.monthlySalary / totalDaysInMonth;
      const basePay = emp.dailyWage > 0 ? effectiveDays * emp.dailyWage : (effectiveDays / totalDaysInMonth) * emp.monthlySalary;
      const overtimeRate = perDay / 8; // Per hour
      const overtimeAmount = Math.round(overtimeHours * overtimeRate);
      const netSalary = Math.round(basePay + overtimeAmount);

      salaries.push({
        employeeId: emp._id,
        employee: emp,
        month,
        baseSalary: emp.monthlySalary,
        daysWorked: effectiveDays,
        totalDays: totalDaysInMonth,
        halfDays,
        absentDays: absent,
        overtimeHours,
        overtimeAmount,
        deductions: 0,
        advance: 0,
        bonus: 0,
        netSalary,
        paidAmount: 0,
        status: 'pending',
        _calculated: true, // Not yet saved
      });
    }

    // Totals
    const totals = {
      totalEmployees: salaries.length,
      totalSalary: salaries.reduce((s, r) => s + r.netSalary, 0),
      totalPaid: salaries.reduce((s, r) => s + (r.paidAmount || 0), 0),
      totalPending: salaries.reduce((s, r) => s + (r.status !== 'paid' ? r.netSalary - (r.paidAmount || 0) : 0), 0),
    };

    res.json({ success: true, data: { salaries, totals, month } });
  } catch (err) { next(err); }
});

// Save/pay salary
router.post('/salary/pay', async (req, res, next) => {
  try {
    const { employeeId, month, paidAmount, method, deductions, deductionNotes, advance, bonus, bonusNotes, notes } = req.body;
    if (!employeeId || !month) return res.status(400).json({ success: false, message: 'Employee and month required' });

    const emp = await Employee.findOne({ _id: employeeId, farmId: req.user.farmId });
    if (!emp) return res.status(404).json({ success: false, message: 'Employee not found' });

    // Calculate attendance
    const [y, m] = month.split('-').map(Number);
    const startDate = new Date(y, m - 1, 1);
    const endDate = new Date(y, m, 0, 23, 59, 59);
    const totalDaysInMonth = new Date(y, m, 0).getDate();

    const attendance = await Attendance.find({ employeeId: emp._id, date: { $gte: startDate, $lte: endDate } }).lean();
    const present = attendance.filter(a => a.status === 'present').length;
    const halfDays = attendance.filter(a => a.status === 'half-day').length;
    const absent = attendance.filter(a => a.status === 'absent').length;
    const overtimeHours = attendance.reduce((s, a) => s + (a.overtime || 0), 0);
    const effectiveDays = present + (halfDays * 0.5);

    const perDay = emp.dailyWage > 0 ? emp.dailyWage : emp.monthlySalary / totalDaysInMonth;
    const basePay = emp.dailyWage > 0 ? effectiveDays * emp.dailyWage : (effectiveDays / totalDaysInMonth) * emp.monthlySalary;
    const overtimeRate = perDay / 8;
    const overtimeAmount = Math.round(overtimeHours * overtimeRate);
    const ded = Number(deductions) || 0;
    const adv = Number(advance) || 0;
    const bon = Number(bonus) || 0;
    const netSalary = Math.round(basePay + overtimeAmount - ded - adv + bon);
    const paid = Number(paidAmount) || netSalary;

    const salary = await SalaryPayment.findOneAndUpdate(
      { farmId: req.user.farmId, employeeId: emp._id, month },
      {
        baseSalary: emp.monthlySalary, daysWorked: effectiveDays, totalDays: totalDaysInMonth,
        halfDays, absentDays: absent, overtimeHours, overtimeAmount,
        deductions: ded, deductionNotes: deductionNotes || '', advance: adv,
        bonus: bon, bonusNotes: bonusNotes || '',
        netSalary, paidAmount: paid, paidDate: new Date(),
        method: method || 'cash', status: paid >= netSalary ? 'paid' : 'partial',
        notes: notes || '', farmId: req.user.farmId,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // Update advance balance on employee
    if (adv > 0) {
      emp.totalAdvance = Math.max(0, (emp.totalAdvance || 0) - adv);
      await emp.save();
    }

    await logActivity(req.user.farmId, 'salary', '💰', `Salary paid to ${emp.name}: ₹${paid} for ${month}`);
    res.json({ success: true, data: salary });
  } catch (err) { next(err); }
});

// Record advance
router.post('/advance', async (req, res, next) => {
  try {
    const { employeeId, amount, notes } = req.body;
    if (!employeeId || !amount) return res.status(400).json({ success: false, message: 'Employee and amount required' });
    const emp = await Employee.findOne({ _id: employeeId, farmId: req.user.farmId });
    if (!emp) return res.status(404).json({ success: false, message: 'Employee not found' });
    emp.totalAdvance = (emp.totalAdvance || 0) + Number(amount);
    await emp.save();
    res.json({ success: true, data: emp, message: `Advance of ₹${amount} recorded` });
  } catch (err) { next(err); }
});

// Overview stats
router.get('/stats/overview', async (req, res, next) => {
  try {
    const employees = await Employee.find({ farmId: req.user.farmId }).lean();
    const active = employees.filter(e => e.status === 'active').length;
    const totalSalary = employees.filter(e => e.status === 'active').reduce((s, e) => s + e.monthlySalary, 0);
    const totalAdvance = employees.reduce((s, e) => s + (e.totalAdvance || 0), 0);

    // Today's attendance
    const today = new Date().toISOString().slice(0, 10);
    const todayAtt = await Attendance.find({ farmId: req.user.farmId, date: new Date(today) }).lean();
    const presentToday = todayAtt.filter(a => a.status === 'present').length;

    res.json({ success: true, data: { total: employees.length, active, onLeave: employees.filter(e => e.status === 'on-leave').length, totalMonthlySalary: totalSalary, totalAdvance, presentToday, roles: [...new Set(employees.map(e => e.role))] } });
  } catch (err) { next(err); }
});

export default router;
