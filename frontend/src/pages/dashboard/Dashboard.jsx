import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../utils/api';
import { formatCurrency, formatLiters, formatDate, getGreeting, categoryColors } from '../../utils/helpers';
import {
  AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar, Legend,
} from 'recharts';
import { GiCow, GiMilkCarton } from 'react-icons/gi';
import {
  FiTrendingUp, FiTrendingDown, FiAlertCircle, FiCalendar,
  FiDownload, FiActivity, FiDroplet, FiHeart, FiStar, FiClock, FiArrowRight, FiList,
} from 'react-icons/fi';
import { FaIndianRupeeSign } from 'react-icons/fa6';
import { formatDistanceToNow } from 'date-fns';
import DateRangeFilter, { getDateRange } from '../../components/DateRangeFilter';
import toast from 'react-hot-toast';

const COLORS = ['#10b981', '#f59e0b', '#8b5cf6', '#3b82f6', '#ef4444', '#ec4899', '#6366f1', '#14b8a6'];
const GRADIENT_CARDS = [
  { bg: 'from-emerald-500 to-teal-600', light: 'bg-white/20', icon: GiCow },
  { bg: 'from-blue-500 to-cyan-600', light: 'bg-white/20', icon: FiDroplet },
  { bg: 'from-violet-500 to-purple-600', light: 'bg-white/20', icon: FaIndianRupeeSign },
  { bg: 'from-amber-500 to-orange-600', light: 'bg-white/20', icon: FiTrendingUp },
];

// Custom tooltip for charts
const CustomTooltip = ({ active, payload, label, formatter }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 px-4 py-3 text-sm">
      <p className="text-gray-500 dark:text-gray-400 text-xs mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="font-semibold" style={{ color: p.color }}>
          {p.name}: {formatter ? formatter(p.value) : p.value}
        </p>
      ))}
    </div>
  );
};

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const initRange = getDateRange('monthly');
  const [period, setPeriod] = useState('monthly');
  const [dateRange, setDateRange] = useState({ startDate: initRange.startDate, endDate: initRange.endDate });
  const [exporting, setExporting] = useState(false);
  const [activities, setActivities] = useState([]);

  const fetchDashboard = () => {
    setLoading(true);
    const params = {};
    if (dateRange.startDate) params.startDate = dateRange.startDate;
    if (dateRange.endDate) params.endDate = dateRange.endDate;
    api.get('/farm/dashboard', { params })
      .then(res => setStats(res.data.data))
      .catch(err => toast.error(err.response?.data?.message || 'Failed to load dashboard'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchDashboard(); }, [dateRange]);

  // Fetch recent activity
  useEffect(() => {
    api.get('/activity/recent').then(r => setActivities(r.data.data || [])).catch(() => {});
  }, []);

  const handleFilterChange = ({ period: p, startDate, endDate }) => {
    setPeriod(p);
    setDateRange({ startDate: startDate || '', endDate: endDate || '' });
  };

  const periodLabel = {
    daily: 'Today', weekly: 'This Week', monthly: 'This Month',
    quarterly: 'This Quarter', 'half-yearly': 'Last 6 Months', yearly: 'This Year', custom: 'Custom Range',
  }[period] || 'This Month';

  // PDF Export
  const exportPDF = async () => {
    setExporting(true);
    try {
      const res = await api.get('/farm/dashboard', {
        params: { startDate: dateRange.startDate, endDate: dateRange.endDate },
      });
      const d = res.data.data;
      const cattleRows = Object.entries(d.cattleByCategory || {}).map(([cat, count]) => `<tr><td>${cat}</td><td>${count}</td></tr>`).join('');
      const topCattleRows = (d.topCattle || []).map((c, i) => `<tr><td>${i + 1}</td><td>${c.cattle?.tagNumber || '-'}</td><td>${c.cattle?.breed || '-'}</td><td>${c.totalYield?.toFixed(1)} L</td></tr>`).join('');
      const expenseRows = (d.expenseBreakdown || []).map(e => `<tr><td>${e._id}</td><td>₹${e.total?.toLocaleString('en-IN')}</td></tr>`).join('');
      const vaccRows = (d.upcomingVaccinations || []).map(v => `<tr><td>${v.cattleId?.tagNumber || '-'}</td><td>${v.description}</td><td>${new Date(v.nextDueDate).toLocaleDateString('en-IN')}</td></tr>`).join('');

      const html = `<!DOCTYPE html><html><head><title>DairyPro Farm Report</title><style>
        body{font-family:'Segoe UI',Arial,sans-serif;padding:30px;color:#333;font-size:13px}
        h1{color:#059669;margin-bottom:5px} h2{color:#065f46;margin-top:25px;border-bottom:2px solid #d1fae5;padding-bottom:5px}
        .header{display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #059669;padding-bottom:15px;margin-bottom:20px}
        .stats{display:grid;grid-template-columns:repeat(4,1fr);gap:15px;margin:20px 0}
        .stat{background:linear-gradient(135deg,#ecfdf5,#d1fae5);border-radius:12px;padding:18px;text-align:center}
        .stat .num{font-size:26px;font-weight:700;color:#059669} .stat .label{font-size:11px;color:#666;margin-top:4px}
        table{width:100%;border-collapse:collapse;margin:10px 0}
        th{background:#ecfdf5;color:#065f46;padding:10px;text-align:left;font-size:12px;font-weight:600}
        td{padding:10px;border-bottom:1px solid #e5e7eb;font-size:12px}
        tr:nth-child(even){background:#fafafa}
        .footer{text-align:center;color:#999;font-size:11px;margin-top:30px;border-top:1px solid #e5e7eb;padding-top:10px}
        @media print{body{padding:15px}}
      </style></head><body>
        <div class="header">
          <div><h1>🐄 DairyPro — Farm Report</h1><p style="color:#666">${periodLabel} (${dateRange.startDate || 'start'} to ${dateRange.endDate || 'now'})</p></div>
          <div style="text-align:right"><p><strong>${user?.name}</strong></p><p style="color:#666;font-size:11px">Generated: ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}</p></div>
        </div>
        <div class="stats">
          <div class="stat"><div class="num">${d.totalCattle || 0}</div><div class="label">Total Cattle</div></div>
          <div class="stat"><div class="num">${(d.todayMilk?.total || 0).toFixed(1)} L</div><div class="label">Today's Milk</div></div>
          <div class="stat"><div class="num">₹${(d.monthlyRevenue || 0).toLocaleString('en-IN')}</div><div class="label">Revenue</div></div>
          <div class="stat"><div class="num" style="color:${(d.profit || 0) >= 0 ? '#059669' : '#dc2626'}">₹${(d.profit || 0).toLocaleString('en-IN')}</div><div class="label">Profit/Loss</div></div>
        </div>
        <h2>🐄 Cattle Distribution</h2>
        <table><tr><th>Category</th><th>Count</th></tr>${cattleRows || '<tr><td colspan="2">No data</td></tr>'}</table>
        <h2>🏆 Top Milking Cattle</h2>
        <table><tr><th>#</th><th>Tag</th><th>Breed</th><th>Total Yield</th></tr>${topCattleRows || '<tr><td colspan="4">No data</td></tr>'}</table>
        <h2>💰 Expense Breakdown</h2>
        <table><tr><th>Category</th><th>Amount</th></tr>${expenseRows || '<tr><td colspan="2">No expenses</td></tr>'}</table>
        <h2>💉 Upcoming Vaccinations</h2>
        <table><tr><th>Cattle</th><th>Description</th><th>Due Date</th></tr>${vaccRows || '<tr><td colspan="3">None upcoming</td></tr>'}</table>
        <div class="footer">DairyPro — Smart Dairy Farm Management • Report generated automatically</div>
      </body></html>`;
      const w = window.open('', '_blank');
      w.document.write(html);
      w.document.close();
      setTimeout(() => { w.print(); }, 500);
      toast.success('Report ready to print/save as PDF');
    } catch (err) {
      toast.error('Failed to generate report');
    } finally {
      setExporting(false);
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-80 gap-4">
      <div className="relative">
        <div className="animate-spin rounded-full h-16 w-16 border-4 border-emerald-200 dark:border-emerald-900 border-t-emerald-600"></div>
        <GiCow className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-emerald-600" size={20} />
      </div>
      <p className="text-gray-500 dark:text-gray-400 animate-pulse">Loading your farm data...</p>
    </div>
  );

  if (!stats) return (
    <div className="text-center py-16">
      <FiAlertCircle className="mx-auto text-gray-300 dark:text-gray-600 mb-4" size={48} />
      <p className="text-gray-500 dark:text-gray-400">Unable to load dashboard data</p>
      <button onClick={fetchDashboard} className="btn-primary mt-4">Retry</button>
    </div>
  );

  const cattlePieData = Object.entries(stats.cattleByCategory || {}).map(([name, value]) => ({ name, value }));
  const expensePieData = (stats.expenseBreakdown || []).map(e => ({ name: e._id, value: e.total }));

  // Compute quick insights
  const profitMargin = stats.monthlyRevenue > 0 ? ((stats.profit / stats.monthlyRevenue) * 100).toFixed(0) : 0;
  const milkAvg = stats.milkTrend?.length > 0
    ? (stats.milkTrend.reduce((s, m) => s + m.total, 0) / stats.milkTrend.length).toFixed(1)
    : 0;

  const statCards = [
    { label: 'Total Cattle', value: stats.totalCattle, icon: GiCow, gradient: 'from-emerald-500 to-teal-600' },
    { label: "Today's Milk", value: formatLiters(stats.todayMilk?.total), icon: FiDroplet, gradient: 'from-blue-500 to-cyan-600' },
    { label: `${periodLabel} Revenue`, value: formatCurrency(stats.monthlyRevenue), icon: FaIndianRupeeSign, gradient: 'from-violet-500 to-purple-600' },
    {
      label: `${periodLabel} Profit`,
      value: formatCurrency(stats.profit),
      icon: stats.profit >= 0 ? FiTrendingUp : FiTrendingDown,
      gradient: stats.profit >= 0 ? 'from-green-500 to-emerald-600' : 'from-red-500 to-rose-600',
    },
  ];

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
            {getGreeting()}, {user?.name?.split(' ')[0]}! 👋
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Here's your farm overview — <span className="font-medium text-gray-700 dark:text-gray-300">{periodLabel}</span></p>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/reports" className="btn-secondary flex items-center gap-2 text-sm">
            <FiActivity size={15} /> Full Reports
          </Link>
          <button onClick={exportPDF} disabled={exporting} className="btn-primary flex items-center gap-2 text-sm">
            <FiDownload size={15} /> {exporting ? 'Generating...' : 'Export PDF'}
          </button>
        </div>
      </div>

      {/* Date Range Filter */}
      <div className="card !p-4">
        <DateRangeFilter value={period} onChange={handleFilterChange} />
      </div>

      {/* Stat Cards — Gradient Style */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((s, i) => (
          <div key={i} className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${s.gradient} p-5 text-white shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5`}>
            <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -translate-y-8 translate-x-8" />
            <div className="absolute bottom-0 left-0 w-16 h-16 bg-white/10 rounded-full translate-y-6 -translate-x-6" />
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                  <s.icon size={20} />
                </div>
              </div>
              <p className="text-3xl font-extrabold tracking-tight">{s.value}</p>
              <p className="text-white/80 text-sm mt-1">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Today's Pending Actions */}
      {(() => {
        const pendingItems = [];
        const vaccCount = stats.upcomingVaccinations?.length || 0;
        const deliveryCount = stats.expectedDeliveries?.length || 0;
        if (vaccCount > 0) pendingItems.push({ label: 'Upcoming Vaccinations', count: vaccCount, color: vaccCount > 3 ? 'red' : 'amber', icon: '💉', link: '/health' });
        if (deliveryCount > 0) pendingItems.push({ label: 'Expected Deliveries', count: deliveryCount, color: 'pink', icon: '🐣', link: '/breeding' });
        const milkingCattle = (stats.cattleByCategory?.milking || 0) + (stats.cattleByCategory?.['milking-pregnant'] || 0);
        const todayRecords = stats.todayMilk?.count || 0;
        const missingMilk = milkingCattle > 0 ? Math.max(0, milkingCattle - todayRecords) : 0;
        if (missingMilk > 0) pendingItems.push({ label: 'Cattle without milk entry today', count: missingMilk, color: 'red', icon: '🥛', link: '/milk' });
        if (stats.customerStats?.totalDue > 0) pendingItems.push({ label: 'Milk delivery dues pending', count: `₹${stats.customerStats.totalDue.toLocaleString('en-IN')}`, color: 'amber', icon: '💰', link: '/milk-delivery' });
        if (pendingItems.length === 0) return null;
        return (
          <div className="card !p-4 hover:shadow-md transition-shadow border-l-4 border-l-amber-400">
            <div className="flex items-center gap-2 mb-3">
              <FiAlertCircle className="text-amber-500" size={18} />
              <h3 className="text-lg font-bold dark:text-white">Today's Pending</h3>
              <span className="text-xs bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 px-2 py-0.5 rounded-full font-semibold">{pendingItems.length} items</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {pendingItems.map((item, i) => (
                <Link key={i} to={item.link} className={`flex items-center gap-3 p-3 rounded-xl bg-${item.color}-50 dark:bg-${item.color}-900/20 border border-${item.color}-100 dark:border-${item.color}-900/30 hover:shadow-sm transition group`}>
                  <span className="text-xl">{item.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-lg font-bold text-${item.color}-700 dark:text-${item.color}-300`}>{item.count}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{item.label}</p>
                  </div>
                  <FiArrowRight className="text-gray-300 group-hover:text-gray-500 transition" size={14} />
                </Link>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Per-Liter Analytics */}
      {stats.analytics && stats.analytics.totalMilkPeriod > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: 'Cost per Liter', value: `₹${stats.analytics.costPerLiter.toFixed(1)}`, color: 'red', icon: '💸' },
            { label: 'Revenue per Liter', value: `₹${stats.analytics.revenuePerLiter.toFixed(1)}`, color: 'blue', icon: '💰' },
            { label: 'Profit per Liter', value: `₹${stats.analytics.profitPerLiter.toFixed(1)}`, color: stats.analytics.profitPerLiter >= 0 ? 'emerald' : 'red', icon: stats.analytics.profitPerLiter >= 0 ? '📈' : '📉' },
          ].map((item, i) => (
            <div key={i} className={`card !p-4 flex items-center gap-3 border-l-4 border-l-${item.color}-500`}>
              <span className="text-2xl">{item.icon}</span>
              <div>
                <p className={`text-lg font-bold text-${item.color}-600 dark:text-${item.color}-400`}>{item.value}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{item.label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Quick Insights Bar */}
      <div className="card !p-4 grid grid-cols-2 sm:flex sm:flex-wrap sm:items-center gap-3 sm:gap-6 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-gray-500 dark:text-gray-400">Profit Margin:</span>
          <span className={`font-bold ${Number(profitMargin) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
            {profitMargin}%
          </span>
        </div>
        <div className="flex items-center gap-2">
          <FiDroplet className="text-blue-500" size={14} />
          <span className="text-gray-500 dark:text-gray-400">Avg Daily Milk:</span>
          <span className="font-bold text-blue-600 dark:text-blue-400">{milkAvg} L</span>
        </div>
        <div className="flex items-center gap-2">
          <FiHeart className="text-pink-500" size={14} />
          <span className="text-gray-500 dark:text-gray-400">Upcoming Vaccinations:</span>
          <span className="font-bold text-pink-600 dark:text-pink-400">{stats.upcomingVaccinations?.length || 0}</span>
        </div>
        {stats.expectedDeliveries?.length > 0 && (
          <div className="flex items-center gap-2">
            <FiCalendar className="text-purple-500" size={14} />
            <span className="text-gray-500 dark:text-gray-400">Expected Deliveries:</span>
            <span className="font-bold text-purple-600 dark:text-purple-400">{stats.expectedDeliveries.length}</span>
          </div>
        )}
      </div>

      {/* Quick Links — Employees & Dudh Khata */}
      {(stats.employeeStats?.active > 0 || stats.customerStats?.active > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {stats.employeeStats?.active > 0 && (
            <Link to="/employees" className="card !p-4 flex items-center gap-4 hover:shadow-md transition group">
              <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-xl"><span className="text-2xl">👷</span></div>
              <div className="flex-1">
                <p className="font-bold text-gray-900 dark:text-white">Employees</p>
                <p className="text-sm text-gray-500">{stats.employeeStats.active} active · {stats.employeeStats.presentToday} present today</p>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-blue-600">₹{(stats.employeeStats.totalSalary || 0).toLocaleString('en-IN')}</p>
                <p className="text-[10px] text-gray-400">monthly salary</p>
              </div>
              <FiArrowRight className="text-gray-300 group-hover:text-emerald-500 transition" />
            </Link>
          )}
          {stats.customerStats?.active > 0 && (
            <Link to="/milk-delivery" className="card !p-4 flex items-center gap-4 hover:shadow-md transition group">
              <div className="p-3 bg-amber-100 dark:bg-amber-900/30 rounded-xl"><span className="text-2xl">🏘️</span></div>
              <div className="flex-1">
                <p className="font-bold text-gray-900 dark:text-white">Dudh Khata</p>
                <p className="text-sm text-gray-500">{stats.customerStats.active} customers · {stats.customerStats.dailyDelivery?.toFixed(1) || 0}L/day</p>
              </div>
              <div className="text-right">
                <p className={`text-lg font-bold ${stats.customerStats.totalDue > 0 ? 'text-red-600' : 'text-green-600'}`}>₹{(stats.customerStats.totalDue || 0).toLocaleString('en-IN')}</p>
                <p className="text-[10px] text-gray-400">outstanding</p>
              </div>
              <FiArrowRight className="text-gray-300 group-hover:text-emerald-500 transition" />
            </Link>
          )}
        </div>
      )}

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Milk Trend — Area Chart */}
        <div className="card lg:col-span-2 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-bold dark:text-white">Milk Production Trend</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Daily yield over selected period</p>
            </div>
            <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
              <FiDroplet className="text-blue-600 dark:text-blue-400" size={18} />
            </div>
          </div>
          {stats.milkTrend?.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={stats.milkTrend}>
                <defs>
                  <linearGradient id="milkGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" className="dark:opacity-20" />
                <XAxis dataKey="_id" tick={{ fontSize: 11, fill: '#9ca3af' }} tickFormatter={v => v.slice(5)} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip formatter={v => `${v.toFixed(1)} L`} />} />
                <Area type="monotone" dataKey="total" name="Milk" stroke="#10b981" strokeWidth={2.5} fill="url(#milkGradient)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <FiDroplet size={40} className="mb-3 opacity-30" />
              <p>No milk data for this period</p>
            </div>
          )}
        </div>

        {/* Cattle Distribution — Donut */}
        <div className="card hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-bold dark:text-white">Cattle Distribution</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{stats.totalCattle} total active</p>
            </div>
            <div className="p-2 bg-emerald-50 dark:bg-emerald-900/30 rounded-lg">
              <GiCow className="text-emerald-600 dark:text-emerald-400" size={18} />
            </div>
          </div>
          {cattlePieData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={cattlePieData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} dataKey="value" paddingAngle={3} stroke="none">
                    {cattlePieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="grid grid-cols-2 gap-2 mt-3">
                {cattlePieData.map((d, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                    <span className="text-gray-600 dark:text-gray-400 truncate">{d.name}</span>
                    <span className="ml-auto font-semibold dark:text-white">{d.value}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <GiCow size={40} className="mb-3 opacity-30" />
              <p>No cattle data yet</p>
            </div>
          )}
        </div>
      </div>

      {/* Second Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top Milking Cattle — Leaderboard */}
        <div className="card hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-lg font-bold dark:text-white">Top Producers</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Highest milking cattle</p>
            </div>
            <div className="p-2 bg-yellow-50 dark:bg-yellow-900/30 rounded-lg">
              <FiStar className="text-yellow-600 dark:text-yellow-400" size={18} />
            </div>
          </div>
          {stats.topCattle?.length > 0 ? (
            <div className="space-y-2">
              {stats.topCattle.map((c, i) => {
                const maxYield = stats.topCattle[0]?.totalYield || 1;
                const pct = ((c.totalYield / maxYield) * 100).toFixed(0);
                return (
                  <div key={i} className="relative group">
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                      <span className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                        i === 0 ? 'bg-gradient-to-br from-yellow-400 to-amber-500 text-white shadow-sm' :
                        i === 1 ? 'bg-gradient-to-br from-gray-300 to-gray-400 text-white' :
                        i === 2 ? 'bg-gradient-to-br from-amber-600 to-amber-700 text-white' :
                        'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                      }`}>
                        {i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm dark:text-white truncate">{c.cattle?.tagNumber}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{c.cattle?.breed}</p>
                      </div>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">{formatLiters(c.totalYield)}</span>
                    </div>
                    {/* Progress bar */}
                    <div className="absolute bottom-0 left-14 right-3 h-0.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400">
              <GiMilkCarton size={36} className="mb-3 opacity-30" />
              <p className="text-sm">No data for this period</p>
            </div>
          )}
        </div>

        {/* Upcoming Vaccinations — Timeline style */}
        <div className="card hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-lg font-bold dark:text-white">Upcoming Vaccinations</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Next 7 days</p>
            </div>
            <div className="p-2 bg-red-50 dark:bg-red-900/30 rounded-lg">
              <FiHeart className="text-red-500 dark:text-red-400" size={18} />
            </div>
          </div>
          {stats.upcomingVaccinations?.length > 0 ? (
            <div className="space-y-1 max-h-[260px] overflow-y-auto pr-1">
              {stats.upcomingVaccinations.slice(0, 10).map((v, i) => {
                const dueDate = new Date(v.nextDueDate);
                const daysLeft = Math.ceil((dueDate - new Date()) / (1000 * 60 * 60 * 24));
                const urgencyClass = daysLeft <= 1 ? 'border-l-red-500 bg-red-50/50 dark:bg-red-900/10' :
                  daysLeft <= 3 ? 'border-l-orange-500 bg-orange-50/50 dark:bg-orange-900/10' :
                  'border-l-emerald-500 bg-gray-50/50 dark:bg-gray-800/30';
                return (
                  <div key={i} className={`flex items-center gap-3 p-3 rounded-lg border-l-4 ${urgencyClass} transition-colors`}>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm dark:text-white truncate">{v.cattleId?.tagNumber}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{v.description}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                        daysLeft <= 1 ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400' :
                        daysLeft <= 3 ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400' :
                        'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400'
                      }`}>
                        {daysLeft <= 0 ? 'Overdue!' : daysLeft === 1 ? 'Tomorrow' : `${daysLeft} days`}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400">
              <FiHeart size={36} className="mb-3 opacity-30" />
              <p className="text-sm">No upcoming vaccinations</p>
            </div>
          )}
        </div>

        {/* Expense Breakdown — Horizontal bar with labels */}
        <div className="card hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-lg font-bold dark:text-white">Expense Breakdown</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{periodLabel} spending</p>
            </div>
            <div className="p-2 bg-violet-50 dark:bg-violet-900/30 rounded-lg">
              <FaIndianRupeeSign className="text-violet-600 dark:text-violet-400" size={18} />
            </div>
          </div>
          {expensePieData.length > 0 ? (
            <div className="space-y-3 max-h-[260px] overflow-y-auto pr-1">
              {expensePieData.sort((a, b) => b.value - a.value).slice(0, 8).map((e, i) => {
                const maxVal = expensePieData[0]?.value || 1;
                const pct = ((e.value / maxVal) * 100).toFixed(0);
                return (
                  <div key={i}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-gray-600 dark:text-gray-400 capitalize">{e.name}</span>
                      <span className="font-semibold dark:text-white">{formatCurrency(e.value)}</span>
                    </div>
                    <div className="w-full h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${pct}%`, backgroundColor: COLORS[i % COLORS.length] }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400">
              <FaIndianRupeeSign size={36} className="mb-3 opacity-30" />
              <p className="text-sm">No expenses for this period</p>
            </div>
          )}
        </div>
      </div>

      {/* Expected Deliveries */}
      {stats.expectedDeliveries?.length > 0 && (
        <div className="card hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-lg font-bold dark:text-white">🐣 Expected Deliveries</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Next 30 days</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[300px] overflow-y-auto pr-1">
            {stats.expectedDeliveries.map((d, i) => {
              const dueDate = new Date(d.expectedDelivery);
              const daysLeft = Math.ceil((dueDate - new Date()) / (1000 * 60 * 60 * 24));
              return (
                <div key={i} className="flex items-center gap-3 p-4 bg-gradient-to-r from-pink-50 to-purple-50 dark:from-pink-900/10 dark:to-purple-900/10 rounded-xl border border-pink-100 dark:border-pink-900/30 hover:shadow-sm transition-shadow">
                  <div className="p-2 bg-pink-100 dark:bg-pink-900/40 rounded-lg">
                    <FiCalendar className="text-pink-600 dark:text-pink-400" size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm dark:text-white">{d.cattleId?.tagNumber}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Due: {formatDate(d.expectedDelivery)}</p>
                  </div>
                  <span className="text-xs font-semibold text-pink-600 dark:text-pink-400 bg-pink-100 dark:bg-pink-900/40 px-2 py-1 rounded-full">
                    {daysLeft}d
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent Activity */}
      {activities.length > 0 && (
        <div className="card hover:shadow-md transition-shadow">
          <div className="flex items-center gap-2 mb-4">
            <FiList className="text-gray-500" size={18} />
            <h3 className="text-lg font-bold dark:text-white">Recent Activity</h3>
            <span className="text-xs text-gray-400 dark:text-gray-500 ml-auto">Last 48 hours</span>
          </div>
          <div className="space-y-1 max-h-[300px] overflow-y-auto pr-1">
            {activities.map((a, i) => {
              const typeColor = { milk: 'bg-blue-500', health: 'bg-red-500', breeding: 'bg-pink-500', expense: 'bg-orange-500', revenue: 'bg-emerald-500' };
              return (
                <div key={i} className="flex items-start gap-3 py-2.5 border-b border-gray-50 dark:border-gray-800 last:border-0">
                  <div className={`w-2 h-2 rounded-full mt-2 shrink-0 ${typeColor[a.type] || 'bg-gray-400'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm dark:text-gray-300">{a.icon} {a.message}</p>
                    <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">
                      {formatDistanceToNow(new Date(a.timestamp), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="card !p-4 hover:shadow-md transition-shadow">
        <div className="flex items-center gap-2 mb-3">
          <FiActivity className="text-gray-500" size={16} />
          <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Quick Actions</h3>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Add Cattle', path: '/cattle', color: 'emerald' },
            { label: 'Record Milk', path: '/milk', color: 'blue' },
            { label: 'Add Expense', path: '/finance', color: 'red' },
            { label: 'View Reports', path: '/reports', color: 'violet' },
          ].map((a, i) => (
            <Link key={i} to={a.path} className={`flex items-center justify-between p-3 rounded-xl bg-${a.color}-50 dark:bg-${a.color}-900/20 hover:bg-${a.color}-100 dark:hover:bg-${a.color}-900/30 text-${a.color}-700 dark:text-${a.color}-400 text-sm font-medium transition-colors group`}>
              {a.label}
              <FiArrowRight className="opacity-0 group-hover:opacity-100 transition-opacity" size={14} />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
