import { useState, useEffect, useMemo } from 'react';
import api from '../../utils/api';
import { formatDate, formatCurrency } from '../../utils/helpers';
import { exportCsv } from '../../utils/exportCsv';
import { exportPdf } from '../../utils/exportPdf';
import Modal from '../../components/Modal';
import ConfirmDialog from '../../components/ConfirmDialog';
import toast from 'react-hot-toast';
import {
  FiPlus, FiSearch, FiEdit2, FiTrash2, FiUser, FiPhone, FiMapPin,
  FiCalendar, FiArrowLeft, FiCheck, FiX, FiDownload, FiDollarSign, FiClock,
} from 'react-icons/fi';
import { FaIndianRupeeSign } from 'react-icons/fa6';

const todayStr = () => new Date().toISOString().slice(0, 10);
const currentMonth = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };

const ROLES = ['Milker', 'Feeder', 'Cleaner', 'Manager', 'Helper', 'Driver', 'Veterinary', 'Other'];
const ATT_OPTIONS = [
  { value: 'present', label: '✅ Present', color: 'emerald' },
  { value: 'absent', label: '❌ Absent', color: 'red' },
  { value: 'half-day', label: '½ Half Day', color: 'amber' },
  { value: 'leave', label: '🏖️ Leave', color: 'blue' },
  { value: 'holiday', label: '🎉 Holiday', color: 'purple' },
];

export default function Employees() {
  const [tab, setTab] = useState('overview');
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);

  // Attendance
  const [attDate, setAttDate] = useState(todayStr());
  const [attSheet, setAttSheet] = useState([]);
  const [attLoading, setAttLoading] = useState(false);
  const [savingAtt, setSavingAtt] = useState(false);

  // Salary
  const [salaryMonth, setSalaryMonth] = useState(currentMonth());
  const [salaryData, setSalaryData] = useState(null);
  const [salaryLoading, setSalaryLoading] = useState(false);

  // Employee form
  const [empModal, setEmpModal] = useState(false);
  const [empForm, setEmpForm] = useState({ name: '', phone: '', address: '', village: '', role: 'Helper', monthlySalary: '', dailyWage: '', joinDate: todayStr(), emergencyContact: '', aadhar: '', bankAccount: '', ifsc: '', notes: '' });
  const [editEmpId, setEditEmpId] = useState(null);
  const [savingEmp, setSavingEmp] = useState(false);

  // Pay salary modal
  const [payModal, setPayModal] = useState(false);
  const [payEmp, setPayEmp] = useState(null);
  const [payForm, setPayForm] = useState({ paidAmount: '', method: 'cash', deductions: '0', advance: '0', bonus: '0', notes: '' });
  const [savingPay, setSavingPay] = useState(false);

  // Advance modal
  const [advModal, setAdvModal] = useState(false);
  const [advForm, setAdvForm] = useState({ employeeId: '', amount: '', notes: '' });

  // Employee detail
  const [viewEmp, setViewEmp] = useState(null);
  const [empHistory, setEmpHistory] = useState(null);
  const [histLoading, setHistLoading] = useState(false);

  // Search/filter
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');

  // Confirm
  const [confirm, setConfirm] = useState({ open: false, title: '', message: '', onConfirm: null, variant: 'danger' });

  // ─── LOAD ───
  const loadEmployees = async () => {
    try {
      const res = await api.get('/employees', { params: { status: statusFilter || undefined, search: searchQuery || undefined } });
      setEmployees(res.data.data);
    } catch { toast.error('Failed to load employees'); }
    finally { setLoading(false); }
  };
  const loadStats = async () => {
    try { const res = await api.get('/employees/stats/overview'); setStats(res.data.data); } catch {}
  };
  useEffect(() => { loadEmployees(); loadStats(); }, [statusFilter, searchQuery]);

  // ─── ATTENDANCE ───
  const loadAttendance = async () => {
    setAttLoading(true);
    try {
      const res = await api.get('/employees/attendance/daily', { params: { date: attDate } });
      setAttSheet(res.data.data.map(s => ({ ...s, _status: s.status || '' })));
    } catch { toast.error('Failed to load attendance'); }
    finally { setAttLoading(false); }
  };
  useEffect(() => { if (tab === 'attendance') loadAttendance(); }, [tab, attDate]);

  const updateAttStatus = (idx, status) => {
    setAttSheet(prev => prev.map((s, i) => i === idx ? { ...s, _status: status } : s));
  };

  const markAllPresent = () => {
    setAttSheet(prev => prev.map(s => ({ ...s, _status: s._status || 'present' })));
  };

  const saveAttendance = async () => {
    setSavingAtt(true);
    try {
      const entries = attSheet.filter(s => s._status).map(s => ({
        employeeId: s.employeeId, status: s._status, checkIn: s.checkIn, checkOut: s.checkOut, overtime: s.overtime, notes: s.notes,
      }));
      await api.post('/employees/attendance/bulk', { date: attDate, entries });
      toast.success(`Saved attendance for ${entries.length} employees`);
      loadAttendance();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    finally { setSavingAtt(false); }
  };

  // ─── SALARY ───
  const loadSalary = async () => {
    setSalaryLoading(true);
    try {
      const res = await api.get('/employees/salary/monthly', { params: { month: salaryMonth } });
      setSalaryData(res.data.data);
    } catch { toast.error('Failed to load salary data'); }
    finally { setSalaryLoading(false); }
  };
  useEffect(() => { if (tab === 'salary') loadSalary(); }, [tab, salaryMonth]);

  const openPaySalary = (sal) => {
    setPayEmp(sal);
    setPayForm({ paidAmount: String(sal.netSalary - (sal.paidAmount || 0)), method: 'cash', deductions: String(sal.deductions || 0), advance: String(sal.advance || 0), bonus: String(sal.bonus || 0), notes: '' });
    setPayModal(true);
  };

  const saveSalaryPayment = async (e) => {
    e.preventDefault();
    setSavingPay(true);
    try {
      await api.post('/employees/salary/pay', {
        employeeId: payEmp.employeeId || payEmp.employee?._id,
        month: salaryMonth,
        paidAmount: Number(payForm.paidAmount),
        method: payForm.method,
        deductions: Number(payForm.deductions),
        advance: Number(payForm.advance),
        bonus: Number(payForm.bonus),
        notes: payForm.notes,
      });
      toast.success('Salary paid');
      setPayModal(false);
      loadSalary();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    finally { setSavingPay(false); }
  };

  // ─── EMPLOYEE CRUD ───
  const openAddEmp = () => {
    setEmpForm({ name: '', phone: '', address: '', village: '', role: 'Helper', monthlySalary: '', dailyWage: '', joinDate: todayStr(), emergencyContact: '', aadhar: '', bankAccount: '', ifsc: '', notes: '' });
    setEditEmpId(null);
    setEmpModal(true);
  };
  const openEditEmp = (e) => {
    setEmpForm({ name: e.name, phone: e.phone, address: e.address, village: e.village, role: e.role, monthlySalary: e.monthlySalary, dailyWage: e.dailyWage || '', joinDate: e.joinDate?.slice(0, 10) || todayStr(), emergencyContact: e.emergencyContact, aadhar: e.aadhar, bankAccount: e.bankAccount, ifsc: e.ifsc, notes: e.notes });
    setEditEmpId(e._id);
    setEmpModal(true);
  };
  const saveEmployee = async (ev) => {
    ev.preventDefault();
    setSavingEmp(true);
    try {
      if (editEmpId) { await api.put(`/employees/${editEmpId}`, empForm); toast.success('Updated'); }
      else { await api.post('/employees', empForm); toast.success('Employee added'); }
      setEmpModal(false);
      loadEmployees(); loadStats();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    finally { setSavingEmp(false); }
  };
  const deleteEmployee = (e) => {
    setConfirm({ open: true, title: 'Delete Employee?', message: `Delete "${e.name}" and all attendance/salary records?`, variant: 'danger', onConfirm: async () => {
      try { await api.delete(`/employees/${e._id}`); toast.success('Deleted'); loadEmployees(); loadStats(); } catch { toast.error('Failed'); }
    }});
  };

  // ─── ADVANCE ───
  const openAdvance = (e) => { setAdvForm({ employeeId: e._id, amount: '', notes: '' }); setAdvModal(true); };
  const saveAdvance = async (ev) => {
    ev.preventDefault();
    try {
      await api.post('/employees/advance', advForm);
      toast.success('Advance recorded');
      setAdvModal(false);
      loadEmployees();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  // ─── EMPLOYEE DETAIL ───
  const openEmpDetail = async (e) => {
    setViewEmp(e);
    setHistLoading(true);
    try {
      const [y, m] = (salaryMonth || currentMonth()).split('-');
      const startDate = `${y}-${m}-01`;
      const endDate = new Date(Number(y), Number(m), 0).toISOString().slice(0, 10);
      const res = await api.get(`/employees/attendance/history/${e._id}`, { params: { startDate, endDate } });
      setEmpHistory(res.data.data);
    } catch { toast.error('Failed'); }
    finally { setHistLoading(false); }
  };

  // ─── EXPORTS ───
  const exportSalaryCsv = () => {
    if (!salaryData?.salaries?.length) { toast.error('No data'); return; }
    exportCsv({
      filename: `salary-${salaryMonth}`,
      headers: ['Name', 'Role', 'Base Salary', 'Days Worked', 'Total Days', 'Overtime (hrs)', 'Deductions', 'Advance', 'Bonus', 'Net Salary', 'Paid', 'Status'],
      rows: salaryData.salaries.map(s => [s.employee?.name, s.employee?.role, s.baseSalary, s.daysWorked, s.totalDays, s.overtimeHours, s.deductions, s.advance, s.bonus, s.netSalary, s.paidAmount || 0, s.status]),
    });
    toast.success('CSV downloaded');
  };

  const exportSalaryPdf = () => {
    if (!salaryData?.salaries?.length) { toast.error('No data'); return; }
    const [y, m] = salaryMonth.split('-');
    const monthName = new Date(y, m - 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
    exportPdf({
      title: `Salary Report — ${monthName}`,
      period: monthName,
      summaryCards: [
        { label: 'Employees', value: salaryData.totals.totalEmployees },
        { label: 'Total Salary', value: '₹' + salaryData.totals.totalSalary.toLocaleString('en-IN') },
        { label: 'Paid', value: '₹' + salaryData.totals.totalPaid.toLocaleString('en-IN') },
        { label: 'Pending', value: '₹' + salaryData.totals.totalPending.toLocaleString('en-IN') },
      ],
      tableHeaders: ['Name', 'Role', 'Days', 'OT', 'Ded.', 'Net Salary', 'Paid', 'Status'],
      tableRows: salaryData.salaries.map(s => [
        s.employee?.name, s.employee?.role, `${s.daysWorked}/${s.totalDays}`,
        s.overtimeHours + 'h', '₹' + (s.deductions || 0), '₹' + s.netSalary.toLocaleString('en-IN'),
        '₹' + (s.paidAmount || 0).toLocaleString('en-IN'), s.status,
      ]),
    });
  };

  // ═══════════════════════════════════════
  //  EMPLOYEE DETAIL VIEW
  // ═══════════════════════════════════════
  if (viewEmp) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={() => { setViewEmp(null); setEmpHistory(null); }} className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700"><FiArrowLeft size={20} /></button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">{viewEmp.name}</h1>
            <p className="text-gray-500 text-sm flex items-center gap-3">
              <span className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded-full text-xs font-medium">{viewEmp.role}</span>
              {viewEmp.phone && <span className="flex items-center gap-1"><FiPhone size={12} /> {viewEmp.phone}</span>}
              {viewEmp.village && <span className="flex items-center gap-1"><FiMapPin size={12} /> {viewEmp.village}</span>}
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => openEditEmp(viewEmp)} className="btn-secondary text-xs"><FiEdit2 size={14} /></button>
            <button onClick={() => openAdvance(viewEmp)} className="btn-secondary text-xs flex items-center gap-1"><FaIndianRupeeSign size={12} /> Advance</button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3 text-center">
            <p className="text-xs text-blue-500">Salary</p>
            <p className="text-xl font-bold text-blue-700 dark:text-blue-300">₹{viewEmp.monthlySalary?.toLocaleString('en-IN')}</p>
          </div>
          <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-3 text-center">
            <p className="text-xs text-emerald-500">Present</p>
            <p className="text-xl font-bold text-emerald-700 dark:text-emerald-300">{empHistory?.summary?.present || 0}</p>
          </div>
          <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-3 text-center">
            <p className="text-xs text-red-500">Absent</p>
            <p className="text-xl font-bold text-red-700 dark:text-red-300">{empHistory?.summary?.absent || 0}</p>
          </div>
          <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-3 text-center">
            <p className="text-xs text-amber-500">Half Days</p>
            <p className="text-xl font-bold text-amber-700 dark:text-amber-300">{empHistory?.summary?.halfDay || 0}</p>
          </div>
          <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-3 text-center">
            <p className="text-xs text-purple-500">Advance</p>
            <p className="text-xl font-bold text-purple-700 dark:text-purple-300">₹{(viewEmp.totalAdvance || 0).toLocaleString('en-IN')}</p>
          </div>
        </div>

        {/* Attendance Records */}
        <div className="card p-0 overflow-hidden">
          <div className="px-4 py-3 border-b dark:border-gray-800 flex items-center justify-between">
            <h3 className="font-semibold text-sm">Attendance This Month</h3>
            <span className="text-xs text-gray-400">{empHistory?.records?.length || 0} days</span>
          </div>
          {histLoading ? (
            <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div></div>
          ) : !empHistory?.records?.length ? (
            <div className="py-8 text-center text-gray-400 text-sm">No attendance records this month</div>
          ) : (
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-hidden">
              <table className="w-full text-sm">
                <thead><tr className="bg-gray-50 dark:bg-gray-800/50 border-b text-xs text-gray-500 uppercase">
                  <th className="px-4 py-2 text-left">Date</th>
                  <th className="px-3 py-2 text-center">Status</th>
                  <th className="px-3 py-2 text-center">Check In</th>
                  <th className="px-3 py-2 text-center">Check Out</th>
                  <th className="px-3 py-2 text-center">OT (hrs)</th>
                  <th className="px-3 py-2 text-left">Notes</th>
                </tr></thead>
                <tbody>
                  {empHistory.records.map((r, i) => {
                    const colors = { present: 'emerald', absent: 'red', 'half-day': 'amber', leave: 'blue', holiday: 'purple' };
                    const c = colors[r.status] || 'gray';
                    return (
                      <tr key={r._id} className={`border-b ${i % 2 ? 'bg-gray-50/50 dark:bg-gray-800/20' : ''}`}>
                        <td className="px-4 py-2">{formatDate(r.date)}</td>
                        <td className="px-3 py-2 text-center"><span className={`text-xs bg-${c}-100 dark:bg-${c}-900/30 text-${c}-700 dark:text-${c}-400 px-2 py-0.5 rounded-full font-medium capitalize`}>{r.status}</span></td>
                        <td className="px-3 py-2 text-center text-gray-500">{r.checkIn || '-'}</td>
                        <td className="px-3 py-2 text-center text-gray-500">{r.checkOut || '-'}</td>
                        <td className="px-3 py-2 text-center">{r.overtime > 0 ? <span className="text-amber-600 font-medium">{r.overtime}h</span> : '-'}</td>
                        <td className="px-3 py-2 text-gray-400 text-xs">{r.notes || '-'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {/* Mobile Cards */}
            <div className="md:hidden divide-y divide-gray-100 dark:divide-gray-800">
              {empHistory.records.map(r => {
                const colors = { present: 'emerald', absent: 'red', 'half-day': 'amber', leave: 'blue', holiday: 'purple' };
                const c = colors[r.status] || 'gray';
                return (
                  <div key={r._id} className="p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{formatDate(r.date)}</span>
                      <span className={`text-xs bg-${c}-100 dark:bg-${c}-900/30 text-${c}-700 dark:text-${c}-400 px-2 py-0.5 rounded-full font-medium capitalize`}>{r.status}</span>
                    </div>
                    <div className="flex gap-3 text-xs text-gray-500 mt-1">
                      {r.checkIn && <span>In: {r.checkIn}</span>}
                      {r.checkOut && <span>Out: {r.checkOut}</span>}
                      {r.overtime > 0 && <span className="text-amber-600 font-medium">OT: {r.overtime}h</span>}
                    </div>
                    {r.notes && <p className="text-xs text-gray-400 mt-1">{r.notes}</p>}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {viewEmp.bankAccount && (
          <div className="card">
            <h3 className="font-semibold text-sm mb-2">🏦 Bank Details</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">Account: <strong>{viewEmp.bankAccount}</strong></p>
            {viewEmp.ifsc && <p className="text-sm text-gray-600 dark:text-gray-400">IFSC: <strong>{viewEmp.ifsc}</strong></p>}
            {viewEmp.aadhar && <p className="text-sm text-gray-600 dark:text-gray-400">Aadhar: <strong>{viewEmp.aadhar}</strong></p>}
          </div>
        )}

        <ConfirmDialog isOpen={confirm.open} onClose={() => setConfirm({ ...confirm, open: false })} title={confirm.title} message={confirm.message} variant={confirm.variant} onConfirm={confirm.onConfirm} />
      </div>
    );
  }

  // ═══════════════════════════════════════
  //  MAIN PAGE
  // ═══════════════════════════════════════
  const tabs = [
    { id: 'overview', label: '👥 Employees' },
    { id: 'attendance', label: '📋 Attendance' },
    { id: 'salary', label: '💰 Salary' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">👷 Employee Management</h1>
          <p className="text-gray-500 text-sm">Manage staff, attendance & salary</p>
        </div>
        <button onClick={openAddEmp} className="btn-primary flex items-center gap-2"><FiPlus size={18} /> Add Employee</button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3 text-center">
            <p className="text-xs text-blue-500">Active Staff</p>
            <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">{stats.active}</p>
          </div>
          <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-3 text-center">
            <p className="text-xs text-emerald-500">Present Today</p>
            <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">{stats.presentToday}</p>
          </div>
          <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-3 text-center">
            <p className="text-xs text-purple-500">Monthly Salary</p>
            <p className="text-2xl font-bold text-purple-700 dark:text-purple-300">₹{(stats.totalMonthlySalary || 0).toLocaleString('en-IN')}</p>
          </div>
          <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-3 text-center">
            <p className="text-xs text-amber-500">Total Advance</p>
            <p className="text-2xl font-bold text-amber-700 dark:text-amber-300">₹{(stats.totalAdvance || 0).toLocaleString('en-IN')}</p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition ${tab === t.id ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 ring-1 ring-emerald-200 dark:ring-emerald-800' : 'bg-white dark:bg-gray-900 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ═══ EMPLOYEES TAB ═══ */}
      {tab === 'overview' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input className="input pl-10 text-sm" placeholder="Search by name, phone, role, or village..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
            </div>
            <div className="flex gap-2">
              {['active', 'on-leave', 'resigned', ''].map(s => (
                <button key={s} onClick={() => setStatusFilter(s)}
                  className={`px-3 py-2 rounded-lg text-xs font-medium transition ${statusFilter === s ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400'}`}>
                  {s || 'All'}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div></div>
          ) : employees.length === 0 ? (
            <div className="card text-center py-8 text-gray-400">
              <p className="mb-3">No employees found</p>
              <button onClick={openAddEmp} className="btn-primary text-sm"><FiPlus size={14} className="inline mr-1" /> Add Employee</button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {employees.map(e => (
                <div key={e._id} className="card !p-4 hover:shadow-md transition cursor-pointer group" onClick={() => openEmpDetail(e)}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                        <FiUser size={18} className="text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-white">{e.name}</h3>
                        <p className="text-xs text-gray-400">{e.role}</p>
                      </div>
                    </div>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${e.status === 'active' ? 'bg-emerald-100 text-emerald-700' : e.status === 'on-leave' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'}`}>
                      {e.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-400 mb-3">
                    {e.phone && <span className="flex items-center gap-1"><FiPhone size={10} /> {e.phone}</span>}
                    {e.village && <span className="flex items-center gap-1"><FiMapPin size={10} /> {e.village}</span>}
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center mb-3">
                    <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-2">
                      <p className="text-[10px] text-emerald-500">Salary</p>
                      <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300">₹{e.monthlySalary?.toLocaleString('en-IN')}</p>
                    </div>
                    <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-2">
                      <p className="text-[10px] text-blue-500">Since</p>
                      <p className="text-xs font-bold text-blue-700 dark:text-blue-300">{e.joinDate ? new Date(e.joinDate).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }) : '-'}</p>
                    </div>
                    <div className={`rounded-lg p-2 ${e.totalAdvance > 0 ? 'bg-amber-50 dark:bg-amber-900/20' : 'bg-gray-50 dark:bg-gray-800'}`}>
                      <p className="text-[10px] text-amber-500">Advance</p>
                      <p className={`text-sm font-bold ${e.totalAdvance > 0 ? 'text-amber-600' : 'text-gray-400'}`}>₹{(e.totalAdvance || 0).toLocaleString('en-IN')}</p>
                    </div>
                  </div>
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition">
                    <button onClick={ev => { ev.stopPropagation(); openEditEmp(e); }} className="flex-1 btn-secondary text-xs py-1.5 flex items-center justify-center gap-1"><FiEdit2 size={12} /> Edit</button>
                    <button onClick={ev => { ev.stopPropagation(); openAdvance(e); }} className="flex-1 btn-primary text-xs py-1.5 flex items-center justify-center gap-1"><FaIndianRupeeSign size={12} /> Advance</button>
                    <button onClick={ev => { ev.stopPropagation(); deleteEmployee(e); }} className="btn-danger text-xs py-1.5 px-2"><FiTrash2 size={14} /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══ ATTENDANCE TAB ═══ */}
      {tab === 'attendance' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <input type="date" className="input text-sm w-auto" value={attDate} onChange={e => setAttDate(e.target.value)} />
            <button onClick={markAllPresent} className="btn-secondary text-xs flex items-center gap-1"><FiCheck size={14} /> Mark All Present</button>
            <span className="text-sm text-gray-500">{attSheet.filter(s => s._status === 'present').length} present · {attSheet.filter(s => s._status === 'absent').length} absent</span>
          </div>

          <div className="card p-0 overflow-hidden">
            {attLoading ? (
              <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div></div>
            ) : attSheet.length === 0 ? (
              <div className="py-8 text-center text-gray-400">No active employees</div>
            ) : (
              <>
                {/* Desktop */}
                <div className="hidden md:block overflow-x-hidden">
                  <table className="w-full text-sm">
                    <thead><tr className="bg-gray-50 dark:bg-gray-800/50 border-b text-xs text-gray-500 uppercase">
                      <th className="px-4 py-2 text-left">Employee</th>
                      <th className="px-3 py-2 text-left">Role</th>
                      <th className="px-3 py-2 text-center">Status</th>
                      <th className="px-3 py-2 text-center">Saved?</th>
                    </tr></thead>
                    <tbody>
                      {attSheet.map((s, i) => (
                        <tr key={s.employeeId} className={`border-b ${i % 2 ? 'bg-gray-50/50 dark:bg-gray-800/20' : ''}`}>
                          <td className="px-4 py-2 font-medium">{s.name} {s.phone && <span className="text-xs text-gray-400 ml-1">{s.phone}</span>}</td>
                          <td className="px-3 py-2 text-gray-500 text-xs">{s.role}</td>
                          <td className="px-3 py-2">
                            <div className="flex gap-1 justify-center flex-wrap">
                              {ATT_OPTIONS.map(o => (
                                <button key={o.value} onClick={() => updateAttStatus(i, o.value)}
                                  className={`px-2 py-1 rounded-lg text-[11px] font-medium transition ${s._status === o.value ? `bg-${o.color}-100 text-${o.color}-700 dark:bg-${o.color}-900/30 dark:text-${o.color}-400 ring-1 ring-${o.color}-300` : 'bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400'}`}>
                                  {o.label}
                                </button>
                              ))}
                            </div>
                          </td>
                          <td className="px-3 py-2 text-center">
                            {s.recorded ? <span className="text-xs text-emerald-600">✓</span> : <span className="text-xs text-gray-300">—</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile */}
                <div className="md:hidden divide-y dark:divide-gray-800">
                  {attSheet.map((s, i) => (
                    <div key={s.employeeId} className="p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-sm">{s.name}</p>
                          <p className="text-xs text-gray-400">{s.role}</p>
                        </div>
                        {s.recorded && <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">✓</span>}
                      </div>
                      <div className="flex gap-1.5 flex-wrap">
                        {ATT_OPTIONS.map(o => (
                          <button key={o.value} onClick={() => updateAttStatus(i, o.value)}
                            className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition ${s._status === o.value ? `bg-${o.color}-100 text-${o.color}-700 ring-1 ring-${o.color}-300` : 'bg-gray-100 text-gray-500'}`}>
                            {o.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="p-4 border-t dark:border-gray-800 flex justify-between bg-gray-50 dark:bg-gray-800/30">
                  <span className="text-sm text-gray-500">{attSheet.filter(s => s._status).length}/{attSheet.length} marked</span>
                  <button onClick={saveAttendance} disabled={savingAtt} className="btn-primary flex items-center gap-2">
                    <FiCheck size={16} /> {savingAtt ? 'Saving...' : 'Save Attendance'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ═══ SALARY TAB ═══ */}
      {tab === 'salary' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <input type="month" className="input w-auto text-sm" value={salaryMonth} onChange={e => setSalaryMonth(e.target.value)} />
            <button onClick={exportSalaryCsv} className="btn-secondary text-xs flex items-center gap-1"><FiDownload size={14} /> CSV</button>
            <button onClick={exportSalaryPdf} className="btn-secondary text-xs flex items-center gap-1"><FiDownload size={14} /> PDF</button>
          </div>

          {salaryData?.totals && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3 text-center">
                <p className="text-xs text-blue-500">Employees</p>
                <p className="text-xl font-bold text-blue-700 dark:text-blue-300">{salaryData.totals.totalEmployees}</p>
              </div>
              <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-3 text-center">
                <p className="text-xs text-purple-500">Total Salary</p>
                <p className="text-xl font-bold text-purple-700 dark:text-purple-300">₹{salaryData.totals.totalSalary.toLocaleString('en-IN')}</p>
              </div>
              <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-3 text-center">
                <p className="text-xs text-green-500">Paid</p>
                <p className="text-xl font-bold text-green-700 dark:text-green-300">₹{salaryData.totals.totalPaid.toLocaleString('en-IN')}</p>
              </div>
              <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-3 text-center">
                <p className="text-xs text-red-500">Pending</p>
                <p className="text-xl font-bold text-red-700 dark:text-red-300">₹{salaryData.totals.totalPending.toLocaleString('en-IN')}</p>
              </div>
            </div>
          )}

          <div className="card p-0 overflow-hidden">
            {salaryLoading ? (
              <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div></div>
            ) : !salaryData?.salaries?.length ? (
              <div className="py-8 text-center text-gray-400">No salary data</div>
            ) : (
              <>
                <div className="hidden md:block overflow-x-hidden">
                  <table className="w-full text-sm">
                    <thead><tr className="bg-gray-50 dark:bg-gray-800/50 border-b text-xs text-gray-500 uppercase">
                      <th className="px-4 py-2 text-left">Employee</th>
                      <th className="px-3 py-2 text-center">Days</th>
                      <th className="px-3 py-2 text-center">OT</th>
                      <th className="px-3 py-2 text-center">Base</th>
                      <th className="px-3 py-2 text-center">Ded.</th>
                      <th className="px-3 py-2 text-center">Net Salary</th>
                      <th className="px-3 py-2 text-center">Paid</th>
                      <th className="px-3 py-2 text-center">Status</th>
                      <th className="px-3 py-2">Action</th>
                    </tr></thead>
                    <tbody>
                      {salaryData.salaries.map((s, i) => (
                        <tr key={s.employeeId || i} className={`border-b ${i % 2 ? 'bg-gray-50/50 dark:bg-gray-800/20' : ''}`}>
                          <td className="px-4 py-2">
                            <p className="font-medium">{s.employee?.name}</p>
                            <p className="text-xs text-gray-400">{s.employee?.role}</p>
                          </td>
                          <td className="px-3 py-2 text-center">{s.daysWorked}/{s.totalDays}</td>
                          <td className="px-3 py-2 text-center">{s.overtimeHours > 0 ? <span className="text-amber-600">{s.overtimeHours}h</span> : '-'}</td>
                          <td className="px-3 py-2 text-center text-gray-500">₹{s.baseSalary?.toLocaleString('en-IN')}</td>
                          <td className="px-3 py-2 text-center text-red-500">{s.deductions > 0 ? `-₹${s.deductions}` : '-'}</td>
                          <td className="px-3 py-2 text-center font-bold text-emerald-600">₹{s.netSalary?.toLocaleString('en-IN')}</td>
                          <td className="px-3 py-2 text-center">₹{(s.paidAmount || 0).toLocaleString('en-IN')}</td>
                          <td className="px-3 py-2 text-center">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.status === 'paid' ? 'bg-emerald-100 text-emerald-700' : s.status === 'partial' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>{s.status}</span>
                          </td>
                          <td className="px-3 py-2">
                            {s.status !== 'paid' && (
                              <button onClick={() => openPaySalary(s)} className="text-xs text-emerald-600 hover:underline font-medium">💰 Pay</button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile */}
                <div className="md:hidden divide-y dark:divide-gray-800">
                  {salaryData.salaries.map((s, i) => (
                    <div key={s.employeeId || i} className="p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <p className="font-semibold text-sm">{s.employee?.name}</p>
                          <p className="text-xs text-gray-400">{s.employee?.role} · {s.daysWorked}/{s.totalDays} days</p>
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.status === 'paid' ? 'bg-emerald-100 text-emerald-700' : s.status === 'partial' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>{s.status}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <p className="text-lg font-bold text-emerald-600">₹{s.netSalary?.toLocaleString('en-IN')}</p>
                        {s.status !== 'paid' && (
                          <button onClick={() => openPaySalary(s)} className="btn-primary text-xs py-1.5 px-3">💰 Pay</button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ═══ MODALS ═══ */}

      {/* Add/Edit Employee */}
      <Modal isOpen={empModal} onClose={() => setEmpModal(false)} title={editEmpId ? 'Edit Employee' : 'Add Employee'} size="xl">
        <form onSubmit={saveEmployee} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className="label">Name *</label><input className="input" required value={empForm.name} onChange={e => setEmpForm({ ...empForm, name: e.target.value })} /></div>
            <div><label className="label">Phone</label><input className="input" value={empForm.phone} onChange={e => setEmpForm({ ...empForm, phone: e.target.value })} placeholder="+91..." /></div>
            <div><label className="label">Role *</label>
              <select className="input" value={empForm.role} onChange={e => setEmpForm({ ...empForm, role: e.target.value })}>
                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div><label className="label">Village</label><input className="input" value={empForm.village} onChange={e => setEmpForm({ ...empForm, village: e.target.value })} /></div>
            <div><label className="label">Monthly Salary (₹) *</label><input type="number" min="0" className="input" required value={empForm.monthlySalary} onChange={e => setEmpForm({ ...empForm, monthlySalary: e.target.value })} placeholder="e.g., 10000" /></div>
            <div><label className="label">Daily Wage (₹) <span className="text-xs text-gray-400">(0 = monthly)</span></label><input type="number" min="0" className="input" value={empForm.dailyWage} onChange={e => setEmpForm({ ...empForm, dailyWage: e.target.value })} placeholder="0" /></div>
            <div><label className="label">Join Date</label><input type="date" className="input" value={empForm.joinDate} onChange={e => setEmpForm({ ...empForm, joinDate: e.target.value })} /></div>
            <div><label className="label">Emergency Contact</label><input className="input" value={empForm.emergencyContact} onChange={e => setEmpForm({ ...empForm, emergencyContact: e.target.value })} /></div>
            <div><label className="label">Aadhar Number</label><input className="input" value={empForm.aadhar} onChange={e => setEmpForm({ ...empForm, aadhar: e.target.value })} /></div>
            <div><label className="label">Bank Account</label><input className="input" value={empForm.bankAccount} onChange={e => setEmpForm({ ...empForm, bankAccount: e.target.value })} /></div>
            <div><label className="label">IFSC Code</label><input className="input" value={empForm.ifsc} onChange={e => setEmpForm({ ...empForm, ifsc: e.target.value })} /></div>
            <div><label className="label">Address</label><input className="input" value={empForm.address} onChange={e => setEmpForm({ ...empForm, address: e.target.value })} /></div>
          </div>
          <div><label className="label">Notes</label><textarea className="input" rows={2} value={empForm.notes} onChange={e => setEmpForm({ ...empForm, notes: e.target.value })} /></div>
          <div className="flex justify-end gap-3 pt-2 border-t">
            <button type="button" onClick={() => setEmpModal(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={savingEmp} className="btn-primary">{savingEmp ? 'Saving...' : editEmpId ? 'Update' : 'Add Employee'}</button>
          </div>
        </form>
      </Modal>

      {/* Pay Salary */}
      <Modal isOpen={payModal} onClose={() => setPayModal(false)} title={`💰 Pay Salary — ${payEmp?.employee?.name || ''}`} size="lg">
        <form onSubmit={saveSalaryPayment} className="space-y-4">
          {payEmp && (
            <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3 text-sm grid grid-cols-3 gap-3 text-center">
              <div><p className="text-xs text-gray-500">Days Worked</p><p className="font-bold">{payEmp.daysWorked}/{payEmp.totalDays}</p></div>
              <div><p className="text-xs text-gray-500">Base Salary</p><p className="font-bold">₹{payEmp.baseSalary?.toLocaleString('en-IN')}</p></div>
              <div><p className="text-xs text-gray-500">Net Salary</p><p className="font-bold text-emerald-600">₹{payEmp.netSalary?.toLocaleString('en-IN')}</p></div>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className="label">Amount to Pay (₹) *</label><input type="number" min="0" className="input" required value={payForm.paidAmount} onChange={e => setPayForm({ ...payForm, paidAmount: e.target.value })} /></div>
            <div><label className="label">Method</label>
              <select className="input" value={payForm.method} onChange={e => setPayForm({ ...payForm, method: e.target.value })}>
                <option value="cash">💵 Cash</option><option value="upi">📱 UPI</option><option value="bank">🏦 Bank</option><option value="other">Other</option>
              </select>
            </div>
            <div><label className="label">Deductions (₹)</label><input type="number" min="0" className="input" value={payForm.deductions} onChange={e => setPayForm({ ...payForm, deductions: e.target.value })} /></div>
            <div><label className="label">Advance Deduct (₹)</label><input type="number" min="0" className="input" value={payForm.advance} onChange={e => setPayForm({ ...payForm, advance: e.target.value })} /></div>
            <div><label className="label">Bonus (₹)</label><input type="number" min="0" className="input" value={payForm.bonus} onChange={e => setPayForm({ ...payForm, bonus: e.target.value })} /></div>
          </div>
          <div><label className="label">Notes</label><input className="input" value={payForm.notes} onChange={e => setPayForm({ ...payForm, notes: e.target.value })} /></div>
          <div className="flex justify-end gap-3 pt-2 border-t">
            <button type="button" onClick={() => setPayModal(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={savingPay} className="btn-primary">{savingPay ? 'Paying...' : 'Pay Salary'}</button>
          </div>
        </form>
      </Modal>

      {/* Advance Modal */}
      <Modal isOpen={advModal} onClose={() => setAdvModal(false)} title="💸 Record Advance" size="md">
        <form onSubmit={saveAdvance} className="space-y-4">
          <div><label className="label">Amount (₹) *</label><input type="number" min="1" className="input" required value={advForm.amount} onChange={e => setAdvForm({ ...advForm, amount: e.target.value })} /></div>
          <div><label className="label">Notes</label><input className="input" value={advForm.notes} onChange={e => setAdvForm({ ...advForm, notes: e.target.value })} placeholder="Reason for advance" /></div>
          <div className="flex justify-end gap-3 pt-2 border-t">
            <button type="button" onClick={() => setAdvModal(false)} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-primary">Record Advance</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog isOpen={confirm.open} onClose={() => setConfirm({ ...confirm, open: false })} title={confirm.title} message={confirm.message} variant={confirm.variant} onConfirm={confirm.onConfirm} />
    </div>
  );
}
