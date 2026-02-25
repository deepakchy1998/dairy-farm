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
} from 'react-icons/fi';
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
    ]).then(([p, m, c, e]) => {
      setProfitData(p.data.data);
      setMilkData(m.data.data);
      setCattleData(c.data.data);
      setExpenseData(e.data.data);
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
    { id: 'profit', label: 'Profit & Loss', icon: FiTrendingUp, color: 'emerald' },
    { id: 'milk', label: 'Milk Analytics', icon: FiDroplet, color: 'blue' },
    { id: 'cattle', label: 'Cattle Analytics', icon: GiCow, color: 'violet' },
    { id: 'expense', label: 'Expenses', icon: FaIndianRupeeSign, color: 'red' },
  ];

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Reports & Analytics 📊</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Deep insights into your farm performance</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2">
            <FiCalendar className="text-gray-400" size={15} />
            <select className="bg-transparent text-sm font-medium dark:text-white outline-none cursor-pointer" value={months} onChange={e => setMonths(+e.target.value)}>
              <option value={3}>Last 3 Months</option>
              <option value={6}>Last 6 Months</option>
              <option value={12}>Last 12 Months</option>
            </select>
          </div>
          <button onClick={fetchAll} className="btn-secondary !p-2.5 !rounded-xl" title="Refresh">
            <FiRefreshCw size={16} />
          </button>
          <button onClick={exportPDF} disabled={exporting} className="btn-primary flex items-center gap-2 text-sm">
            <FiDownload size={15} /> {exporting ? 'Exporting...' : 'Export PDF'}
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 flex-wrap">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
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
