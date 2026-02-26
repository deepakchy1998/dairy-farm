import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../utils/api';
import { formatCurrency, formatLiters, formatDate } from '../../utils/helpers';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell, AreaChart, Area, LineChart, Line, RadialBarChart, RadialBar,
} from 'recharts';
import {
  FiTrendingUp, FiTrendingDown, FiDownload, FiDroplet,
  FiPieChart, FiBarChart2, FiCalendar, FiFilter, FiRefreshCw,
  FiHeart, FiPackage, FiUsers,
} from 'react-icons/fi';
import { FiBriefcase } from 'react-icons/fi';
import { FaIndianRupeeSign } from 'react-icons/fa6';
import { GiCow, GiMilkCarton } from 'react-icons/gi';
import toast from 'react-hot-toast';

const COLORS = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#ec4899', '#6366f1', '#14b8a6'];
const SOFT_COLORS = ['#d1fae5', '#dbeafe', '#ede9fe', '#fef3c7', '#fee2e2', '#fce7f3'];

const CustomTooltip = ({ active, payload, label, formatter }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 px-4 py-3 text-sm">
      <p className="text-gray-500 dark:text-gray-400 text-xs mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="font-semibold" style={{ color: p.color }}>
          {p.name}: {formatter ? formatter(p.value, p.name) : p.value}
        </p>
      ))}
    </div>
  );
};

// Stat card with icon and optional trend
const StatCard = ({ icon: Icon, label, value, subtext, color = 'emerald', trend }) => (
  <div className="card !p-5 hover:shadow-md transition-all duration-300 hover:-translate-y-0.5 group">
    <div className="flex items-start justify-between">
      <div>
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{label}</p>
        <p className={`text-2xl font-extrabold mt-2 text-${color}-600 dark:text-${color}-400`}>{value}</p>
        {subtext && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{subtext}</p>}
      </div>
      <div className={`p-3 bg-${color}-50 dark:bg-${color}-900/30 rounded-xl group-hover:scale-110 transition-transform`}>
        <Icon className={`text-${color}-600 dark:text-${color}-400`} size={22} />
      </div>
    </div>
    {trend !== undefined && (
      <div className={`flex items-center gap-1 mt-3 text-xs font-medium ${trend >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
        {trend >= 0 ? <FiTrendingUp size={12} /> : <FiTrendingDown size={12} />}
        <span>{Math.abs(trend).toFixed(1)}% vs previous</span>
      </div>
    )}
  </div>
);

export default function Reports() {
  const { user } = useAuth();
  const [tab, setTab] = useState('profit');
  const [profitData, setProfitData] = useState(null);
  const [milkData, setMilkData] = useState(null);
  const [cattleData, setCattleData] = useState(null);
  const [expenseData, setExpenseData] = useState(null);
  const [milkQuality, setMilkQuality] = useState(null);
  const [healthData, setHealthData] = useState(null);
  const [employeeData, setEmployeeData] = useState(null);
  const [feedData, setFeedData] = useState(null);
  const [customerData, setCustomerData] = useState(null);
  const [revenueData, setRevenueData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [months, setMonths] = useState(6);
  const [exporting, setExporting] = useState(false);

  const fetchAll = () => {
    setLoading(true);
    Promise.all([
      api.get('/reports/profit-loss', { params: { months } }),
      api.get('/reports/milk-analytics', { params: { months } }),
      api.get('/reports/cattle-analytics'),
      api.get('/reports/expense-breakdown', { params: { months } }),
      api.get('/reports/milk-quality', { params: { months } }).catch(() => ({ data: { data: null } })),
      api.get('/reports/health-analytics', { params: { months } }).catch(() => ({ data: { data: null } })),
      api.get('/reports/employee-analytics', { params: { months } }).catch(() => ({ data: { data: null } })),
      api.get('/reports/feed-analytics', { params: { months } }).catch(() => ({ data: { data: null } })),
      api.get('/reports/customer-analytics', { params: { months } }).catch(() => ({ data: { data: null } })),
      api.get('/reports/revenue-breakdown', { params: { months } }).catch(() => ({ data: { data: null } })),
    ]).then(([p, m, c, e, mq, h, emp, f, cust, rev]) => {
      setProfitData(p.data.data);
      setMilkData(m.data.data);
      setCattleData(c.data.data);
      setExpenseData(e.data.data);
      setMilkQuality(mq.data.data);
      setHealthData(h.data.data);
      setEmployeeData(emp.data.data);
      setFeedData(f.data.data);
      setCustomerData(cust.data.data);
      setRevenueData(rev.data.data);
    }).catch(() => toast.error('Failed to load reports')).finally(() => setLoading(false));
  };

  useEffect(() => { fetchAll(); }, [months]);

  // PDF Export for current tab
  const exportPDF = () => {
    setExporting(true);
    try {
      const tabLabels = { profit: 'Profit & Loss', milk: 'Milk Analytics', cattle: 'Cattle Analytics', expense: 'Expense Breakdown' };
      let tables = '';

      if (tab === 'profit' && profitData) {
        const rows = plChart.map(r => `<tr><td>${r.month}</td><td style="color:#059669">₹${r.revenue.toLocaleString('en-IN')}</td><td style="color:#dc2626">₹${r.expense.toLocaleString('en-IN')}</td><td style="color:${r.revenue - r.expense >= 0 ? '#059669' : '#dc2626'}">₹${(r.revenue - r.expense).toLocaleString('en-IN')}</td></tr>`).join('');
        tables = `
          <div class="stats">
            <div class="stat"><div class="num" style="color:#059669">₹${profitData.totalRevenue?.toLocaleString('en-IN')}</div><div class="label">Total Revenue</div></div>
            <div class="stat"><div class="num" style="color:#dc2626">₹${profitData.totalExpense?.toLocaleString('en-IN')}</div><div class="label">Total Expense</div></div>
            <div class="stat"><div class="num" style="color:${profitData.netProfit >= 0 ? '#059669' : '#dc2626'}">₹${profitData.netProfit?.toLocaleString('en-IN')}</div><div class="label">Net Profit</div></div>
          </div>
          <table><tr><th>Month</th><th>Revenue</th><th>Expense</th><th>Net</th></tr>${rows}</table>`;
      } else if (tab === 'milk' && milkData) {
        const rows = (milkData.topCattle || []).map((c, i) => `<tr><td>${i + 1}</td><td>${c.cattle?.tagNumber || '-'}</td><td>${c.cattle?.breed || '-'}</td><td>${c.total?.toFixed(1)} L</td><td>${c.avg?.toFixed(1)} L</td></tr>`).join('');
        tables = `<h2>🏆 Top Milking Cattle</h2><table><tr><th>#</th><th>Tag</th><th>Breed</th><th>Total</th><th>Avg/Day</th></tr>${rows}</table>`;
      } else if (tab === 'cattle' && cattleData) {
        ['byCategory', 'byBreed', 'byGender', 'byStatus'].forEach(key => {
          const label = key.replace('by', 'By ');
          const rows = (cattleData[key] || []).map(d => `<tr><td>${d._id}</td><td>${d.count}</td></tr>`).join('');
          tables += `<h2>${label}</h2><table><tr><th>Type</th><th>Count</th></tr>${rows}</table>`;
        });
      } else if (tab === 'expense' && expenseData) {
        const rows = (expenseData.byCategory || []).map(d => `<tr><td>${d._id}</td><td>₹${d.total?.toLocaleString('en-IN')}</td><td>${d.count}</td></tr>`).join('');
        tables = `<table><tr><th>Category</th><th>Amount</th><th>Entries</th></tr>${rows}</table>`;
      }

      const html = `<!DOCTYPE html><html><head><title>DairyPro ${tabLabels[tab]} Report</title><style>
        body{font-family:'Segoe UI',Arial,sans-serif;padding:30px;color:#333;font-size:13px}
        h1{color:#059669;margin-bottom:5px} h2{color:#065f46;margin-top:25px;border-bottom:2px solid #d1fae5;padding-bottom:5px}
        .header{display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #059669;padding-bottom:15px;margin-bottom:20px}
        .stats{display:grid;grid-template-columns:repeat(3,1fr);gap:15px;margin:20px 0}
        .stat{background:linear-gradient(135deg,#ecfdf5,#d1fae5);border-radius:12px;padding:18px;text-align:center}
        .stat .num{font-size:24px;font-weight:700} .stat .label{font-size:11px;color:#666;margin-top:4px}
        table{width:100%;border-collapse:collapse;margin:10px 0} th{background:#ecfdf5;color:#065f46;padding:10px;text-align:left;font-size:12px;font-weight:600}
        td{padding:10px;border-bottom:1px solid #e5e7eb;font-size:12px} tr:nth-child(even){background:#fafafa}
        .footer{text-align:center;color:#999;font-size:11px;margin-top:30px;border-top:1px solid #e5e7eb;padding-top:10px}
        @media print{body{padding:15px}}
      </style></head><body>
        <div class="header">
          <div><h1>📊 DairyPro — ${tabLabels[tab]} Report</h1><p style="color:#666">Last ${months} Months</p></div>
          <div style="text-align:right"><p><strong>${user?.name}</strong></p><p style="color:#666;font-size:11px">${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}</p></div>
        </div>
        ${tables}
        <div class="footer">DairyPro — Smart Dairy Farm Management</div>
      </body></html>`;
      const w = window.open('', '_blank');
      w.document.write(html);
      w.document.close();
      setTimeout(() => w.print(), 500);
      toast.success('Report ready!');
    } catch { toast.error('Export failed'); }
    finally { setExporting(false); }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-80 gap-4">
      <div className="relative">
        <div className="animate-spin rounded-full h-16 w-16 border-4 border-emerald-200 dark:border-emerald-900 border-t-emerald-600"></div>
        <FiBarChart2 className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-emerald-600" size={20} />
      </div>
      <p className="text-gray-500 dark:text-gray-400 animate-pulse">Crunching the numbers...</p>
    </div>
  );

  // Merge revenue & expense by month for P&L chart
  const plMonths = new Set([...(profitData?.revenue || []).map(r => r._id), ...(profitData?.expense || []).map(r => r._id)]);
  const plChart = [...plMonths].sort().map(m => ({
    month: m,
    revenue: profitData?.revenue?.find(r => r._id === m)?.total || 0,
    expense: profitData?.expense?.find(r => r._id === m)?.total || 0,
  }));

  const tabs = [
    { id: 'profit', label: 'P&L', icon: FiTrendingUp, color: 'emerald' },
    { id: 'milk', label: 'Milk', icon: FiDroplet, color: 'blue' },
    { id: 'milkQuality', label: 'Quality', icon: GiMilkCarton, color: 'cyan' },
    { id: 'cattle', label: 'Cattle', icon: GiCow, color: 'violet' },
    { id: 'health', label: 'Health', icon: FiHeart, color: 'pink' },
    { id: 'expense', label: 'Expenses', icon: FaIndianRupeeSign, color: 'red' },
    { id: 'revenue', label: 'Revenue', icon: FiTrendingUp, color: 'green' },
    { id: 'feed', label: 'Feed', icon: FiPackage, color: 'amber' },
    { id: 'employee', label: 'Team', icon: FiBriefcase, color: 'indigo' },
    { id: 'customer', label: 'Customers', icon: FiUsers, color: 'orange' },
  ];

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Reports & Analytics 📊</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Deep insights into your farm performance</p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap sm:flex-nowrap">
          <div className="flex items-center gap-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2">
            <FiCalendar className="text-gray-400 hidden sm:block" size={15} />
            <select className="bg-transparent text-xs sm:text-sm font-medium dark:text-white outline-none cursor-pointer" value={months} onChange={e => setMonths(+e.target.value)}>
              <option value={3}>3 Months</option>
              <option value={6}>6 Months</option>
              <option value={12}>12 Months</option>
            </select>
          </div>
          <button onClick={fetchAll} className="btn-secondary !p-2 sm:!p-2.5 !rounded-xl" title="Refresh">
            <FiRefreshCw size={16} />
          </button>
          <button onClick={exportPDF} disabled={exporting} className="btn-primary flex items-center gap-1.5 text-xs sm:text-sm">
            <FiDownload size={15} /> {exporting ? '...' : 'PDF'}
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-3 sm:px-5 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 whitespace-nowrap flex-shrink-0 ${
              tab === t.id
                ? `bg-${t.color}-100 dark:bg-${t.color}-900/30 text-${t.color}-700 dark:text-${t.color}-400 shadow-sm ring-1 ring-${t.color}-200 dark:ring-${t.color}-800`
                : 'bg-white dark:bg-gray-900 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-700'
            }`}
          >
            <t.icon size={16} />
            {t.label}
          </button>
        ))}
      </div>

      {/* ══════════════════ PROFIT & LOSS ══════════════════ */}
      {tab === 'profit' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard icon={FiTrendingUp} label="Total Revenue" value={formatCurrency(profitData?.totalRevenue)} color="green" />
            <StatCard icon={FiTrendingDown} label="Total Expense" value={formatCurrency(profitData?.totalExpense)} color="red" />
            <StatCard
              icon={profitData?.netProfit >= 0 ? FiTrendingUp : FiTrendingDown}
              label="Net Profit"
              value={formatCurrency(profitData?.netProfit)}
              color={profitData?.netProfit >= 0 ? 'emerald' : 'red'}
              subtext={profitData?.totalRevenue > 0 ? `${((profitData.netProfit / profitData.totalRevenue) * 100).toFixed(1)}% margin` : ''}
            />
          </div>

          {/* Revenue vs Expense Chart */}
          <div className="card hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-bold dark:text-white">Revenue vs Expense</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Monthly comparison over last {months} months</p>
              </div>
              <div className="p-2 bg-emerald-50 dark:bg-emerald-900/30 rounded-xl">
                <FiBarChart2 className="text-emerald-600 dark:text-emerald-400" size={18} />
              </div>
            </div>
            {plChart.length > 0 ? (
              <ResponsiveContainer width="100%" height={380}>
                <BarChart data={plChart} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" className="dark:opacity-20" />
                  <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: '#9ca3af' }} tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip formatter={(v) => formatCurrency(v)} />} />
                  <Legend iconType="circle" />
                  <Bar dataKey="revenue" name="Revenue" fill="#10b981" radius={[6, 6, 0, 0]} maxBarSize={40} />
                  <Bar dataKey="expense" name="Expense" fill="#ef4444" radius={[6, 6, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState icon={FiBarChart2} message="No financial data for this period" />
            )}
          </div>

          {/* Profit Trend — Area */}
          {plChart.length > 0 && (
            <div className="card hover:shadow-md transition-shadow">
              <h3 className="text-lg font-bold dark:text-white mb-1">Profit Trend</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-6">Monthly net profit over time</p>
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={plChart.map(r => ({ ...r, profit: r.revenue - r.expense }))}>
                  <defs>
                    <linearGradient id="profitGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" className="dark:opacity-20" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip formatter={(v) => formatCurrency(v)} />} />
                  <Area type="monotone" dataKey="profit" name="Net Profit" stroke="#10b981" strokeWidth={2.5} fill="url(#profitGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════ MILK ANALYTICS ══════════════════ */}
      {tab === 'milk' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Summary */}
          {milkData?.monthly?.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <StatCard
                icon={FiDroplet}
                label="Total Production"
                value={formatLiters(milkData.monthly.reduce((s, m) => s + m.total, 0))}
                color="blue"
              />
              <StatCard
                icon={GiMilkCarton}
                label="Monthly Average"
                value={formatLiters(milkData.monthly.reduce((s, m) => s + m.total, 0) / milkData.monthly.length)}
                color="cyan"
              />
              <StatCard
                icon={FiTrendingUp}
                label="Best Month"
                value={formatLiters(Math.max(...milkData.monthly.map(m => m.total)))}
                subtext={milkData.monthly.reduce((a, b) => a.total > b.total ? a : b)?._id}
                color="violet"
              />
            </div>
          )}

          {/* Milk Production Chart */}
          <div className="card hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-bold dark:text-white">Monthly Milk Production</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Total yield per month</p>
              </div>
              <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-xl">
                <FiDroplet className="text-blue-600 dark:text-blue-400" size={18} />
              </div>
            </div>
            {milkData?.monthly?.length > 0 ? (
              <ResponsiveContainer width="100%" height={350}>
                <AreaChart data={milkData.monthly}>
                  <defs>
                    <linearGradient id="milkAreaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" className="dark:opacity-20" />
                  <XAxis dataKey="_id" tick={{ fontSize: 12, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip formatter={(v) => `${v.toFixed(1)} L`} />} />
                  <Area type="monotone" dataKey="total" name="Milk (L)" stroke="#3b82f6" strokeWidth={2.5} fill="url(#milkAreaGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState icon={FiDroplet} message="No milk data for this period" />
            )}
          </div>

          {/* Top Milking Cattle — Leaderboard */}
          <div className="card hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-lg font-bold dark:text-white">🏆 Top Milking Cattle</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Ranked by total yield</p>
              </div>
            </div>
            {milkData?.topCattle?.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {milkData.topCattle.map((c, i) => {
                  const maxVal = milkData.topCattle[0]?.total || 1;
                  const pct = ((c.total / maxVal) * 100).toFixed(0);
                  return (
                    <div key={i} className="flex items-center gap-4 p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                      <span className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold shrink-0 ${
                        i === 0 ? 'bg-gradient-to-br from-yellow-400 to-amber-500 text-white shadow-md' :
                        i === 1 ? 'bg-gradient-to-br from-gray-300 to-gray-400 text-white' :
                        i === 2 ? 'bg-gradient-to-br from-amber-600 to-amber-700 text-white' :
                        'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                      }`}>
                        #{i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <div>
                            <p className="font-bold text-sm dark:text-white">{c.cattle?.tagNumber}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{c.cattle?.breed}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-blue-600 dark:text-blue-400">{c.total.toFixed(1)} L</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Avg: {c.avg.toFixed(1)} L/day</p>
                          </div>
                        </div>
                        <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full transition-all duration-700" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyState icon={GiMilkCarton} message="No milk records found" />
            )}
          </div>
        </div>
      )}

      {/* ══════════════════ CATTLE ANALYTICS ══════════════════ */}
      {tab === 'cattle' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Total count card */}
          {cattleData && (
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              {['byCategory', 'byBreed', 'byGender', 'byStatus'].map((key, idx) => {
                const total = (cattleData[key] || []).reduce((s, d) => s + d.count, 0);
                const labels = ['Categories', 'Breeds', 'Genders', 'Statuses'];
                const icons = [GiCow, GiCow, GiCow, FiPieChart];
                const colors = ['emerald', 'blue', 'violet', 'amber'];
                return (
                  <StatCard key={key} icon={icons[idx]} label={`By ${labels[idx]}`} value={total + ' cattle'} subtext={`${(cattleData[key] || []).length} ${labels[idx].toLowerCase()}`} color={colors[idx]} />
                );
              })}
            </div>
          )}

          {/* Pie Charts Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {['byCategory', 'byBreed', 'byGender', 'byStatus'].map((key, idx) => {
              const labels = ['Category', 'Breed', 'Gender', 'Status'];
              const data = (cattleData?.[key] || []).map(d => ({ name: d._id, value: d.count }));
              return (
                <div key={key} className="card hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold dark:text-white">By {labels[idx]}</h3>
                    <span className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 px-2 py-1 rounded-full">
                      {data.length} types
                    </span>
                  </div>
                  {data.length > 0 ? (
                    <div className="flex items-center gap-4">
                      <ResponsiveContainer width="50%" height={200}>
                        <PieChart>
                          <Pie data={data} cx="50%" cy="50%" innerRadius={40} outerRadius={75} dataKey="value" paddingAngle={3} stroke="none">
                            {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="flex-1 space-y-2">
                        {data.map((d, i) => (
                          <div key={i} className="flex items-center gap-2 text-sm">
                            <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                            <span className="text-gray-600 dark:text-gray-400 truncate capitalize">{d.name}</span>
                            <span className="ml-auto font-bold dark:text-white">{d.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <EmptyState icon={GiCow} message="No data" small />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ══════════════════ EXPENSE BREAKDOWN ══════════════════ */}
      {tab === 'expense' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Total */}
          {expenseData?.byCategory?.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <StatCard
                icon={FaIndianRupeeSign}
                label="Total Expenses"
                value={formatCurrency(expenseData.byCategory.reduce((s, d) => s + d.total, 0))}
                color="red"
              />
              <StatCard
                icon={FiPieChart}
                label="Categories"
                value={expenseData.byCategory.length}
                subtext="expense types tracked"
                color="violet"
              />
              <StatCard
                icon={FiBarChart2}
                label="Highest Category"
                value={formatCurrency(expenseData.byCategory[0]?.total)}
                subtext={expenseData.byCategory[0]?._id}
                color="amber"
              />
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Horizontal Bar */}
            <div className="card hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-bold dark:text-white">Expense by Category</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Total spending per category</p>
                </div>
              </div>
              {expenseData?.byCategory?.length > 0 ? (
                <ResponsiveContainer width="100%" height={Math.max(250, expenseData.byCategory.length * 50)}>
                  <BarChart data={expenseData.byCategory.map(d => ({ name: d._id, amount: d.total, count: d.count }))} layout="vertical" barSize={20}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" className="dark:opacity-20" horizontal={false} />
                    <XAxis type="number" tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 12, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip formatter={(v) => formatCurrency(v)} />} />
                    <Bar dataKey="amount" name="Amount" radius={[0, 8, 8, 0]}>
                      {expenseData.byCategory.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState icon={FaIndianRupeeSign} message="No expense data" />
              )}
            </div>

            {/* Pie */}
            <div className="card hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-bold dark:text-white">Expense Distribution</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Percentage breakdown</p>
                </div>
              </div>
              {expenseData?.byCategory?.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie
                        data={expenseData.byCategory.map(d => ({ name: d._id, value: d.total }))}
                        cx="50%" cy="50%" innerRadius={55} outerRadius={90} dataKey="value" paddingAngle={3} stroke="none"
                      >
                        {expenseData.byCategory.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={v => formatCurrency(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-2 mt-4">
                    {expenseData.byCategory.map((d, i) => {
                      const total = expenseData.byCategory.reduce((s, x) => s + x.total, 0);
                      const pct = ((d.total / total) * 100).toFixed(1);
                      return (
                        <div key={i} className="flex items-center gap-2 text-sm">
                          <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                          <span className="text-gray-600 dark:text-gray-400 capitalize">{d._id}</span>
                          <span className="ml-auto font-semibold dark:text-white">{pct}%</span>
                          <span className="text-gray-500 dark:text-gray-400 text-xs w-20 text-right">{formatCurrency(d.total)}</span>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <EmptyState icon={FiPieChart} message="No data to show" />
              )}
            </div>
          </div>
        </div>
      )}
      {/* ══════════════════ MILK QUALITY ══════════════════ */}
      {tab === 'milkQuality' && milkQuality && (
        <div className="space-y-6 animate-fadeIn">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard icon={FiDroplet} label="Avg Fat %" value={milkQuality.avgFatSNF?.length > 0 ? (milkQuality.avgFatSNF.reduce((s, m) => s + (m.avgFat || 0), 0) / milkQuality.avgFatSNF.length).toFixed(2) + '%' : 'N/A'} color="amber" />
            <StatCard icon={FiDroplet} label="Avg SNF %" value={milkQuality.avgFatSNF?.length > 0 ? (milkQuality.avgFatSNF.reduce((s, m) => s + (m.avgSNF || 0), 0) / milkQuality.avgFatSNF.length).toFixed(2) + '%' : 'N/A'} color="blue" />
            <StatCard icon={GiMilkCarton} label="Daily Avg (30d)" value={milkQuality.dailyTrend?.length > 0 ? (milkQuality.dailyTrend.reduce((s, d) => s + d.total, 0) / milkQuality.dailyTrend.length).toFixed(1) + ' L' : 'N/A'} color="cyan" />
          </div>
          {/* Fat & SNF Trend */}
          <div className="card">
            <h3 className="text-lg font-bold dark:text-white mb-1">Fat & SNF Monthly Trend</h3>
            <p className="text-xs text-gray-500 mb-4">Quality parameters over time</p>
            {milkQuality.avgFatSNF?.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={milkQuality.avgFatSNF}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="_id" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip content={<CustomTooltip formatter={(v) => v?.toFixed(2)} />} />
                  <Legend />
                  <Line type="monotone" dataKey="avgFat" name="Fat %" stroke="#f59e0b" strokeWidth={2.5} dot={{ r: 4 }} />
                  <Line type="monotone" dataKey="avgSNF" name="SNF %" stroke="#3b82f6" strokeWidth={2.5} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : <EmptyState icon={FiDroplet} message="No quality data" />}
          </div>
          {/* Session-wise Production */}
          {milkQuality.sessionWise && (milkQuality.sessionWise.morning > 0 || milkQuality.sessionWise.evening > 0) && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="card">
                <h3 className="text-lg font-bold dark:text-white mb-4">Session-wise Production</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={[
                      { name: 'Morning', value: milkQuality.sessionWise.morning || 0 },
                      { name: 'Afternoon', value: milkQuality.sessionWise.afternoon || 0 },
                      { name: 'Evening', value: milkQuality.sessionWise.evening || 0 },
                    ].filter(d => d.value > 0)} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" paddingAngle={3} label={({ name, value }) => `${name}: ${value.toFixed(0)}L`}>
                      {[COLORS[0], COLORS[3], COLORS[1]].map((c, i) => <Cell key={i} fill={c} />)}
                    </Pie>
                    <Tooltip formatter={v => `${v.toFixed(1)} L`} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="card">
                <h3 className="text-lg font-bold dark:text-white mb-1">Daily Production (30d)</h3>
                <p className="text-xs text-gray-500 mb-4">Day-by-day milk output</p>
                {milkQuality.dailyTrend?.length > 0 ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={milkQuality.dailyTrend}>
                      <defs><linearGradient id="dailyMilkGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} /><stop offset="95%" stopColor="#06b6d4" stopOpacity={0} /></linearGradient></defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="_id" tick={{ fontSize: 9 }} tickFormatter={v => v?.slice(5)} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip content={<CustomTooltip formatter={(v) => `${v.toFixed(1)} L`} />} />
                      <Area type="monotone" dataKey="total" stroke="#06b6d4" fill="url(#dailyMilkGrad)" strokeWidth={2} name="Production" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : <EmptyState icon={FiDroplet} message="No data" small />}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════ HEALTH ANALYTICS ══════════════════ */}
      {tab === 'health' && healthData && (
        <div className="space-y-6 animate-fadeIn">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <StatCard icon={FiHeart} label="Total Records" value={healthData.byType?.reduce((s, d) => s + d.count, 0) || 0} color="pink" />
            <StatCard icon={FaIndianRupeeSign} label="Health Cost" value={formatCurrency(healthData.totalCost)} color="red" />
            <StatCard icon={FiPieChart} label="Record Types" value={healthData.byType?.length || 0} color="violet" />
            <StatCard icon={FiCalendar} label="Due (30 days)" value={healthData.upcomingDue || 0} color="amber" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="card">
              <h3 className="text-lg font-bold dark:text-white mb-4">Records by Type</h3>
              {healthData.byType?.length > 0 ? (
                <div className="space-y-3">
                  {healthData.byType.map((d, i) => {
                    const max = healthData.byType[0]?.count || 1;
                    return (
                      <div key={i}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-600 dark:text-gray-400 capitalize">{d._id}</span>
                          <span className="font-semibold dark:text-white">{d.count} records • {formatCurrency(d.totalCost)}</span>
                        </div>
                        <div className="w-full h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${(d.count / max * 100)}%`, backgroundColor: COLORS[i % COLORS.length] }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : <EmptyState icon={FiHeart} message="No health records" small />}
            </div>
            <div className="card">
              <h3 className="text-lg font-bold dark:text-white mb-1">Monthly Health Activity</h3>
              <p className="text-xs text-gray-500 mb-4">Records & costs over time</p>
              {healthData.monthlyHealth?.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={healthData.monthlyHealth}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="_id" tick={{ fontSize: 11 }} />
                    <YAxis yAxisId="left" tick={{ fontSize: 10 }} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
                    <Tooltip content={<CustomTooltip formatter={(v, name) => name === 'Cost' ? formatCurrency(v) : v} />} />
                    <Legend />
                    <Bar yAxisId="left" dataKey="count" name="Records" fill="#ec4899" radius={[4, 4, 0, 0]} />
                    <Line yAxisId="right" type="monotone" dataKey="cost" name="Cost" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <EmptyState icon={FiHeart} message="No data" small />}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════ REVENUE BREAKDOWN ══════════════════ */}
      {tab === 'revenue' && revenueData && (
        <div className="space-y-6 animate-fadeIn">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard icon={FiTrendingUp} label="Total Revenue" value={formatCurrency(revenueData.byCategory?.reduce((s, d) => s + d.total, 0))} color="green" />
            <StatCard icon={FiPieChart} label="Sources" value={revenueData.byCategory?.length || 0} color="emerald" />
            <StatCard icon={FiBarChart2} label="Top Source" value={formatCurrency(revenueData.byCategory?.[0]?.total)} subtext={revenueData.byCategory?.[0]?._id?.replace(/_/g, ' ')} color="blue" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="card">
              <h3 className="text-lg font-bold dark:text-white mb-4">Revenue by Source</h3>
              {revenueData.byCategory?.length > 0 ? (
                <ResponsiveContainer width="100%" height={Math.max(200, revenueData.byCategory.length * 50)}>
                  <BarChart data={revenueData.byCategory.map(d => ({ name: d._id?.replace(/_/g, ' '), amount: d.total }))} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
                    <XAxis type="number" tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} tick={{ fontSize: 10 }} />
                    <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 12 }} />
                    <Tooltip content={<CustomTooltip formatter={v => formatCurrency(v)} />} />
                    <Bar dataKey="amount" name="Revenue" radius={[0, 8, 8, 0]}>
                      {revenueData.byCategory.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : <EmptyState icon={FiTrendingUp} message="No revenue data" />}
            </div>
            <div className="card">
              <h3 className="text-lg font-bold dark:text-white mb-4">Revenue Distribution</h3>
              {revenueData.byCategory?.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart><Pie data={revenueData.byCategory.map(d => ({ name: d._id?.replace(/_/g, ' '), value: d.total }))} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" paddingAngle={3}>{revenueData.byCategory.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip formatter={v => formatCurrency(v)} /></PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-2 mt-3">
                    {revenueData.byCategory.map((d, i) => {
                      const total = revenueData.byCategory.reduce((s, x) => s + x.total, 0);
                      return (
                        <div key={i} className="flex items-center gap-2 text-sm">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                          <span className="text-gray-600 dark:text-gray-400 capitalize">{d._id?.replace(/_/g, ' ')}</span>
                          <span className="ml-auto font-semibold dark:text-white">{((d.total / total) * 100).toFixed(1)}%</span>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : <EmptyState icon={FiPieChart} message="No data" />}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════ FEED ANALYTICS ══════════════════ */}
      {tab === 'feed' && feedData && (
        <div className="space-y-6 animate-fadeIn">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard icon={FiPackage} label="Total Feed Cost" value={formatCurrency(feedData.byType?.reduce((s, d) => s + d.totalCost, 0))} color="amber" />
            <StatCard icon={FiBarChart2} label="Feed Types" value={feedData.byType?.length || 0} color="violet" />
            <StatCard icon={FiTrendingUp} label="Costliest Feed" value={feedData.byType?.[0]?._id || 'N/A'} subtext={formatCurrency(feedData.byType?.[0]?.totalCost)} color="red" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="card">
              <h3 className="text-lg font-bold dark:text-white mb-4">Feed Cost by Type</h3>
              {feedData.byType?.length > 0 ? (
                <div className="space-y-3 max-h-[300px] overflow-y-auto">
                  {feedData.byType.map((d, i) => {
                    const max = feedData.byType[0]?.totalCost || 1;
                    return (
                      <div key={i}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-600 dark:text-gray-400">{d._id}</span>
                          <span className="font-semibold dark:text-white">{formatCurrency(d.totalCost)} • {d.totalQty.toFixed(0)} qty</span>
                        </div>
                        <div className="w-full h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${(d.totalCost / max * 100)}%`, backgroundColor: COLORS[i % COLORS.length] }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : <EmptyState icon={FiPackage} message="No feed data" small />}
            </div>
            <div className="card">
              <h3 className="text-lg font-bold dark:text-white mb-1">Monthly Feed Cost</h3>
              <p className="text-xs text-gray-500 mb-4">Spending trend</p>
              {feedData.monthlyFeed?.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <AreaChart data={feedData.monthlyFeed}>
                    <defs><linearGradient id="feedGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} /><stop offset="95%" stopColor="#f59e0b" stopOpacity={0} /></linearGradient></defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="_id" tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} tick={{ fontSize: 10 }} />
                    <Tooltip content={<CustomTooltip formatter={v => formatCurrency(v)} />} />
                    <Area type="monotone" dataKey="totalCost" stroke="#f59e0b" fill="url(#feedGrad)" strokeWidth={2} name="Feed Cost" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : <EmptyState icon={FiPackage} message="No data" small />}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════ EMPLOYEE ANALYTICS ══════════════════ */}
      {tab === 'employee' && employeeData && (
        <div className="space-y-6 animate-fadeIn">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <StatCard icon={FiBriefcase} label="Active Employees" value={employeeData.totalEmployees || 0} color="indigo" />
            <StatCard icon={FaIndianRupeeSign} label="Total Salary Paid" value={formatCurrency(employeeData.totalSalaryPaid)} color="green" />
            <StatCard icon={FiPieChart} label="Roles" value={employeeData.byRole?.length || 0} color="violet" />
            <StatCard icon={FiBarChart2} label="Attendance Rate" value={(() => { const present = employeeData.attendanceSummary?.find(a => a._id === 'present')?.count || 0; const total = employeeData.attendanceSummary?.reduce((s, a) => s + a.count, 0) || 0; return total > 0 ? ((present / total) * 100).toFixed(0) + '%' : 'N/A'; })()} color="emerald" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="card">
              <h3 className="text-lg font-bold dark:text-white mb-4">Team by Role</h3>
              {employeeData.byRole?.length > 0 ? (
                <div className="flex items-center gap-4">
                  <ResponsiveContainer width="50%" height={200}>
                    <PieChart><Pie data={employeeData.byRole.map(d => ({ name: d._id, value: d.count }))} cx="50%" cy="50%" innerRadius={40} outerRadius={75} dataKey="value" paddingAngle={3}>{employeeData.byRole.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip /></PieChart>
                  </ResponsiveContainer>
                  <div className="flex-1 space-y-2">
                    {employeeData.byRole.map((d, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                        <span className="text-gray-600 dark:text-gray-400">{d._id}</span>
                        <span className="ml-auto font-bold dark:text-white">{d.count}</span>
                        <span className="text-xs text-gray-400">{formatCurrency(d.totalSalary)}/mo</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : <EmptyState icon={FiBriefcase} message="No employee data" small />}
            </div>
            <div className="card">
              <h3 className="text-lg font-bold dark:text-white mb-1">Monthly Salary Payout</h3>
              <p className="text-xs text-gray-500 mb-4">Total paid per month</p>
              {employeeData.monthlySalary?.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={employeeData.monthlySalary}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="_id" tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} tick={{ fontSize: 10 }} />
                    <Tooltip content={<CustomTooltip formatter={v => formatCurrency(v)} />} />
                    <Bar dataKey="total" name="Salary Paid" fill="#6366f1" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <EmptyState icon={FaIndianRupeeSign} message="No salary data" small />}
            </div>
          </div>
          {/* Attendance Breakdown */}
          {employeeData.attendanceSummary?.length > 0 && (
            <div className="card">
              <h3 className="text-lg font-bold dark:text-white mb-4">Attendance Overview</h3>
              <div className="flex flex-wrap gap-4">
                {employeeData.attendanceSummary.map((a, i) => {
                  const total = employeeData.attendanceSummary.reduce((s, x) => s + x.count, 0);
                  const pct = ((a.count / total) * 100).toFixed(1);
                  const colors = { present: '#10b981', absent: '#ef4444', 'half-day': '#f59e0b', leave: '#3b82f6', holiday: '#8b5cf6' };
                  return (
                    <div key={i} className="flex-1 min-w-[120px] text-center p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50">
                      <p className="text-2xl font-bold" style={{ color: colors[a._id] || '#6b7280' }}>{a.count}</p>
                      <p className="text-xs text-gray-500 capitalize mt-1">{a._id}</p>
                      <p className="text-[10px] text-gray-400">{pct}%</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════ CUSTOMER ANALYTICS ══════════════════ */}
      {tab === 'customer' && customerData && (
        <div className="space-y-6 animate-fadeIn">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <StatCard icon={FiUsers} label="Active Customers" value={customerData.totalCustomers || 0} color="blue" />
            <StatCard icon={FaIndianRupeeSign} label="Total Delivered" value={formatCurrency(customerData.totalDelivered)} color="emerald" />
            <StatCard icon={FiTrendingUp} label="Total Paid" value={formatCurrency(customerData.totalPaid)} color="green" />
            <StatCard icon={FiTrendingDown} label="Outstanding Due" value={formatCurrency(customerData.totalDue)} color={customerData.totalDue > 0 ? 'red' : 'emerald'} />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="card">
              <h3 className="text-lg font-bold dark:text-white mb-1">Monthly Delivery & Revenue</h3>
              <p className="text-xs text-gray-500 mb-4">Customer milk deliveries</p>
              {customerData.monthlyDelivery?.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={customerData.monthlyDelivery}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="_id" tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} tick={{ fontSize: 10 }} />
                    <Tooltip content={<CustomTooltip formatter={v => formatCurrency(v)} />} />
                    <Legend />
                    <Bar dataKey="totalAmt" name="Revenue" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <EmptyState icon={FiUsers} message="No delivery data" />}
            </div>
            <div className="card">
              <h3 className="text-lg font-bold dark:text-white mb-4">🏆 Top 10 Customers</h3>
              {customerData.topCustomers?.length > 0 ? (
                <div className="space-y-3 max-h-[280px] overflow-y-auto">
                  {customerData.topCustomers.map((c, i) => {
                    const max = customerData.topCustomers[0]?.totalAmt || 1;
                    return (
                      <div key={i} className="flex items-center gap-3">
                        <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${i < 3 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'}`}>#{i+1}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between text-sm mb-1">
                            <span className="font-medium dark:text-white truncate">{c.customer?.name}</span>
                            <span className="font-semibold text-emerald-600">{formatCurrency(c.totalAmt)}</span>
                          </div>
                          <div className="w-full h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${(c.totalAmt / max * 100)}%` }} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : <EmptyState icon={FiUsers} message="No customer data" small />}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Reusable empty state
function EmptyState({ icon: Icon, message, small = false }) {
  return (
    <div className={`flex flex-col items-center justify-center ${small ? 'py-8' : 'py-16'} text-gray-400 dark:text-gray-600`}>
      <Icon size={small ? 32 : 44} className="mb-3 opacity-30" />
      <p className="text-sm">{message}</p>
    </div>
  );
}
