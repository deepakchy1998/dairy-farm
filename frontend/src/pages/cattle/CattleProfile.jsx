import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../../utils/api';
import { formatDate, formatCurrency, formatLiters } from '../../utils/helpers';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { FiArrowLeft, FiDroplet, FiHeart, FiActivity, FiCalendar, FiInfo, FiTrendingUp, FiDownload, FiFileText } from 'react-icons/fi';
import { FaIndianRupeeSign } from 'react-icons/fa6';
import { GiCow, GiMilkCarton } from 'react-icons/gi';
import toast from 'react-hot-toast';

const categoryBadge = {
  milking: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400',
  dry: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400',
  heifer: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-400',
  calf: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400',
  bull: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400',
  pregnant: 'bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-400',
};

function calcAge(dob) {
  if (!dob) return '-';
  const birth = new Date(dob);
  const now = new Date();
  let years = now.getFullYear() - birth.getFullYear();
  let months = now.getMonth() - birth.getMonth();
  if (months < 0) { years--; months += 12; }
  if (years === 0) return `${months} month${months !== 1 ? 's' : ''}`;
  return months > 0 ? `${years}y ${months}m` : `${years} year${years !== 1 ? 's' : ''}`;
}

export default function CattleProfile() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('overview');

  useEffect(() => {
    setLoading(true);
    api.get(`/cattle/${id}/profile`)
      .then(r => setData(r.data.data))
      .catch(() => toast.error('Failed to load cattle profile'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-80 gap-4">
      <div className="relative">
        <div className="animate-spin rounded-full h-16 w-16 border-4 border-emerald-200 dark:border-emerald-900 border-t-emerald-600"></div>
        <GiCow className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-emerald-600" size={20} />
      </div>
      <p className="text-gray-500 dark:text-gray-400 animate-pulse">Loading profile...</p>
    </div>
  );

  if (!data) return (
    <div className="text-center py-16">
      <p className="text-gray-500 dark:text-gray-400">Cattle not found</p>
      <Link to="/cattle" className="btn-primary mt-4 inline-block">Back to Cattle List</Link>
    </div>
  );

  const { cattle: c, milkRecords, healthRecords, breedingRecords, stats } = data;

  const milkChartData = [...milkRecords].reverse().map(r => ({
    date: new Date(r.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
    total: r.totalYield,
    morning: r.morningYield || 0,
    evening: r.eveningYield || 0,
  }));

  const statCards = [
    { label: 'Total Milk', value: formatLiters(stats.totalMilk), icon: FiDroplet, gradient: 'from-blue-500 to-cyan-600' },
    { label: 'Avg Daily', value: formatLiters(stats.avgDailyMilk), icon: FiTrendingUp, gradient: 'from-emerald-500 to-teal-600' },
    { label: 'Health Cost', value: formatCurrency(stats.totalHealthCost), icon: FaIndianRupeeSign, gradient: 'from-red-500 to-rose-600' },
    { label: 'Breeding', value: stats.activeBreeding ? `${stats.activeBreeding.status}` : `${stats.breedingCount} records`, icon: FiActivity, gradient: stats.activeBreeding ? 'from-pink-500 to-rose-600' : 'from-violet-500 to-purple-600' },
  ];

  const tabs = [
    { id: 'overview', label: 'Overview', icon: FiInfo },
    { id: 'milk', label: 'Milk History', icon: FiDroplet },
    { id: 'health', label: 'Health', icon: FiHeart },
    { id: 'breeding', label: 'Breeding', icon: FiActivity },
  ];

  const statusColor = { active: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400', sold: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400', dead: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400' };

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      {/* Back + Header */}
      <Link to="/cattle" className="inline-flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">
        <FiArrowLeft size={16} /> Back to Cattle List
      </Link>

      <div className="card">
        <div className="flex flex-col sm:flex-row sm:items-center gap-6">
          {/* Avatar */}
          <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center text-white text-4xl shadow-lg shrink-0">
            {c.photo ? <img src={c.photo} alt={c.tagNumber} loading="lazy" className="w-full h-full object-cover rounded-2xl" /> : '🐄'}
          </div>
          {/* QR Code — hidden on very small screens, shown sm+ */}
          <img 
            src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(window.location.origin + '/cattle/' + c._id)}`}
            alt="QR Code"
            className="hidden sm:block w-24 h-24 rounded-lg border border-gray-200 dark:border-gray-700 shrink-0"
            loading="lazy"
          />
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-3 mb-2">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{c.tagNumber}</h1>
              <span className={`px-3 py-1 rounded-full text-xs font-semibold capitalize ${statusColor[c.status] || ''}`}>{c.status}</span>
              <span className={`px-3 py-1 rounded-full text-xs font-semibold capitalize ${categoryBadge[c.category] || 'bg-gray-100 text-gray-700'}`}>{c.category}</span>
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">{c.gender === 'female' ? '♀ Female' : '♂ Male'}</span>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
              <span><strong>Breed:</strong> {c.breed}</span>
              <span><strong>Age:</strong> {calcAge(c.dateOfBirth)}</span>
              {c.weight && <span><strong>Weight:</strong> {c.weight} kg</span>}
              {c.lactationNumber > 0 && <span><strong>Lactation:</strong> L-{c.lactationNumber}</span>}
              {c.source && <span><strong>Source:</strong> {c.source === 'born_on_farm' ? '🏠 Born on Farm' : '🛒 Purchased'}</span>}
            </div>
            {/* Export buttons */}
            <div className="flex gap-2 mt-3">
              <button onClick={() => {
                const rows = [
                  ['Field', 'Value'],
                  ['Tag No', c.tagNumber], ['Breed', c.breed], ['Category', c.category], ['Gender', c.gender],
                  ['Status', c.status], ['Weight', c.weight ? c.weight + ' kg' : '-'], ['Age', calcAge(c.dateOfBirth)],
                  ['Source', c.source === 'purchased' ? 'Purchased' : 'Born on Farm'],
                  ...(c.lactationNumber > 0 ? [['Lactation', 'L-' + c.lactationNumber]] : []),
                  ...(c.generation ? [['Generation', c.generation]] : []),
                  ...(c.motherTag ? [['Mother Tag', c.motherTag]] : []),
                  [], ['--- Milk Records (Last 90 Days) ---', ''],
                  ['Date', 'Morning (L)', 'Evening (L)', 'Total (L)'],
                  ...milkRecords.map(r => [formatDate(r.date), r.morningYield?.toFixed(1) || '-', r.eveningYield?.toFixed(1) || '-', r.totalYield?.toFixed(1)]),
                  [], ['--- Health Records ---', ''],
                  ['Date', 'Type', 'Description', 'Medicine', 'Cost'],
                  ...healthRecords.map(r => [formatDate(r.date), r.type, r.description, r.medicine || '-', r.cost || 0]),
                  [], ['--- Breeding Records ---', ''],
                  ['Date', 'Method', 'Bull Details', 'Status', 'Expected Delivery'],
                  ...breedingRecords.map(r => [formatDate(r.breedingDate), r.method, r.bullDetails || '-', r.status, r.expectedDelivery ? formatDate(r.expectedDelivery) : '-']),
                ];
                const csv = '\ufeff' + rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n');
                const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
                const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `cattle-${c.tagNumber}-profile.csv`; a.click();
                toast.success('CSV downloaded!');
              }} className="btn-secondary text-xs flex items-center gap-1.5">
                <FiFileText size={14} /> CSV
              </button>
              <button onClick={async () => {
                try {
                  toast.loading('Generating PDF...', { id: 'cpdf' });
                  const res = await api.get(`/cattle/${c._id}/pdf`, { responseType: 'blob' });
                  const url = window.URL.createObjectURL(new Blob([res.data], { type: 'text/html' }));
                  const w = window.open(url, '_blank');
                  setTimeout(() => { if (w) w.print(); }, 800);
                  toast.success('PDF ready!', { id: 'cpdf' });
                } catch { toast.error('Failed to generate PDF', { id: 'cpdf' }); }
              }} className="btn-primary text-xs flex items-center gap-1.5">
                <FiDownload size={14} /> PDF
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((s, i) => (
          <div key={i} className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${s.gradient} p-5 text-white shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5`}>
            <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -translate-y-8 translate-x-8" />
            <div className="relative z-10">
              <s.icon size={20} className="mb-2 opacity-80" />
              <p className="text-2xl font-extrabold">{s.value}</p>
              <p className="text-white/80 text-xs mt-1">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-3 sm:px-5 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 whitespace-nowrap flex-shrink-0 ${
              tab === t.id
                ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 shadow-sm ring-1 ring-emerald-200 dark:ring-emerald-800'
                : 'bg-white dark:bg-gray-900 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-700'
            }`}>
            <t.icon size={16} /> {t.label}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {tab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fadeIn">
          <div className="card">
            <h3 className="text-lg font-bold dark:text-white mb-4">📋 Details</h3>
            <div className="space-y-3 text-sm">
              {[
                ['Date of Birth', c.dateOfBirth ? `${formatDate(c.dateOfBirth)} (${calcAge(c.dateOfBirth)})` : '-'],
                ['Source', c.source === 'born_on_farm' ? 'Born on Farm' : 'Purchased'],
                ...(c.motherTag ? [['Mother Tag', c.motherTag]] : []),
                ...(c.generation ? [['Generation', c.generation]] : []),
                ...(c.purchaseDate ? [['Purchase Date', formatDate(c.purchaseDate)]] : []),
                ...(c.purchasePrice ? [['Purchase Price', formatCurrency(c.purchasePrice)]] : []),
                ...(c.semenName ? [['Semen', `${c.semenName} (${c.semenCode || ''}) — ${c.semenCompany || ''}`]] : []),
                ...(c.lactationNumber > 0 ? [['Lactation Number', `L-${c.lactationNumber}`]] : []),
                ...(c.notes ? [['Notes', c.notes]] : []),
              ].map(([k, v], i) => (
                <div key={i} className="flex justify-between py-2 border-b border-gray-50 dark:border-gray-800 last:border-0">
                  <span className="text-gray-500 dark:text-gray-400">{k}</span>
                  <span className="font-medium text-gray-800 dark:text-gray-200 text-right">{v}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Milk mini chart */}
          <div className="card">
            <h3 className="text-lg font-bold dark:text-white mb-1">🥛 Recent Milk (90 days)</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">{stats.milkRecordCount} total records · Avg {formatLiters(stats.avgDailyMilk)}/day</p>
            {milkChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={milkChartData}>
                  <defs>
                    <linearGradient id="cattleMilkGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" className="dark:opacity-20" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                  <Tooltip />
                  <Area type="monotone" dataKey="total" name="Total (L)" stroke="#3b82f6" strokeWidth={2} fill="url(#cattleMilkGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : <p className="text-gray-400 text-center py-12">No milk data in last 90 days</p>}
          </div>
        </div>
      )}

      {/* Milk History Tab */}
      {tab === 'milk' && (
        <div className="space-y-6 animate-fadeIn">
          {milkChartData.length > 0 && (
            <div className="card">
              <h3 className="text-lg font-bold dark:text-white mb-4">Production Trend</h3>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={milkChartData}>
                  <defs>
                    <linearGradient id="milkFull" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" className="dark:opacity-20" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                  <Tooltip />
                  <Area type="monotone" dataKey="total" name="Total" stroke="#10b981" strokeWidth={2} fill="url(#milkFull)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
          <div className="card !p-0 overflow-hidden max-h-[350px] overflow-y-auto">
            {/* Desktop table */}
            <table className="w-full text-sm hidden md:table">
              <thead className="sticky top-0 z-10">
                <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Date</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Morning</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Evening</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {milkRecords.map((r, i) => (
                  <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="py-3 px-4 text-gray-600 dark:text-gray-400">{formatDate(r.date)}</td>
                    <td className="py-3 px-4 dark:text-gray-300">{r.morningYield?.toFixed(1) || '-'} L</td>
                    <td className="py-3 px-4 dark:text-gray-300">{r.eveningYield?.toFixed(1) || '-'} L</td>
                    <td className="py-3 px-4 font-bold text-emerald-600 dark:text-emerald-400">{r.totalYield?.toFixed(1)} L</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {/* Mobile cards */}
            <div className="md:hidden divide-y dark:divide-gray-800">
              {milkRecords.map((r, i) => (
                <div key={i} className="p-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{formatDate(r.date)}</p>
                    <p className="text-xs text-gray-400">M: {r.morningYield?.toFixed(1) || '-'}L · E: {r.eveningYield?.toFixed(1) || '-'}L</p>
                  </div>
                  <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{r.totalYield?.toFixed(1)}L</span>
                </div>
              ))}
            </div>
            {milkRecords.length === 0 && <p className="text-gray-400 text-center py-12">No milk records</p>}
          </div>
        </div>
      )}

      {/* Health Tab */}
      {tab === 'health' && (
        <div className="card !p-0 overflow-hidden animate-fadeIn max-h-[400px] overflow-y-auto">
          {/* Desktop table */}
          <table className="w-full text-sm hidden md:table">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Date</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Type</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Description</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Medicine</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Cost</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Next Due</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {healthRecords.map((r, i) => (
                <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="py-3 px-4 text-gray-600 dark:text-gray-400">{formatDate(r.date)}</td>
                  <td className="py-3 px-4"><span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400 capitalize">{r.type}</span></td>
                  <td className="py-3 px-4 dark:text-gray-300">{r.description}</td>
                  <td className="py-3 px-4 dark:text-gray-400">{r.medicine || '-'}</td>
                  <td className="py-3 px-4 font-bold text-red-600 dark:text-red-400">{r.cost ? formatCurrency(r.cost) : '-'}</td>
                  <td className="py-3 px-4 dark:text-gray-400">{r.nextDueDate ? formatDate(r.nextDueDate) : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {/* Mobile cards */}
          <div className="md:hidden divide-y dark:divide-gray-800">
            {healthRecords.map((r, i) => (
              <div key={i} className="p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{formatDate(r.date)}</span>
                  <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400 capitalize">{r.type}</span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">{r.description}</p>
                <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                  {r.medicine && <span>💊 {r.medicine}</span>}
                  {r.cost > 0 && <span className="text-red-500 font-semibold">{formatCurrency(r.cost)}</span>}
                  {r.nextDueDate && <span>📅 Due: {formatDate(r.nextDueDate)}</span>}
                </div>
              </div>
            ))}
          </div>
          {healthRecords.length === 0 && <p className="text-gray-400 text-center py-12">No health records</p>}
        </div>
      )}

      {/* Breeding Tab */}
      {tab === 'breeding' && (
        <div className="card !p-0 overflow-hidden animate-fadeIn max-h-[400px] overflow-y-auto">
          {/* Desktop table */}
          <table className="w-full text-sm hidden md:table">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Breeding Date</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Method</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Bull Details</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Expected Delivery</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {breedingRecords.map((r, i) => {
                const statusBadge = { pending: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400', confirmed: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400', delivered: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400', failed: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400' };
                return (
                  <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="py-3 px-4 text-gray-600 dark:text-gray-400">{formatDate(r.breedingDate)}</td>
                    <td className="py-3 px-4 dark:text-gray-300">{r.method === 'artificial' ? '🧪 AI' : '🐂 Natural'}</td>
                    <td className="py-3 px-4 dark:text-gray-400">{r.bullDetails || '-'}</td>
                    <td className="py-3 px-4 dark:text-gray-400">{r.expectedDelivery ? formatDate(r.expectedDelivery) : '-'}</td>
                    <td className="py-3 px-4"><span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${statusBadge[r.status] || ''}`}>{r.status}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {/* Mobile cards */}
          <div className="md:hidden divide-y dark:divide-gray-800">
            {breedingRecords.map((r, i) => {
              const statusBadge = { pending: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400', confirmed: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400', delivered: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400', failed: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400' };
              return (
                <div key={i} className="p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{formatDate(r.breedingDate)}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${statusBadge[r.status] || ''}`}>{r.status}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    <span>{r.method === 'artificial' ? '🧪 AI' : '🐂 Natural'}</span>
                    {r.bullDetails && <span>· {r.bullDetails}</span>}
                  </div>
                  {r.expectedDelivery && <p className="text-xs text-pink-500 mt-1">📅 Due: {formatDate(r.expectedDelivery)}</p>}
                </div>
              );
            })}
          </div>
          {breedingRecords.length === 0 && <p className="text-gray-400 text-center py-12">No breeding records</p>}
        </div>
      )}
    </div>
  );
}
