import { useState, useEffect } from 'react';
import api from '../../utils/api';
import { formatDate, formatLiters } from '../../utils/helpers';
import Modal from '../../components/Modal';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { FiPlus, FiArrowLeft, FiDownload, FiFilter } from 'react-icons/fi';
import toast from 'react-hot-toast';

const todayStr = () => new Date().toISOString().slice(0, 10);

const getDateRange = (period) => {
  const now = new Date();
  const end = todayStr();
  let start;
  switch (period) {
    case 'today': start = end; break;
    case 'week': { const s = new Date(); s.setDate(s.getDate() - 6); start = s.toISOString().slice(0, 10); break; }
    case 'month': start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10); break;
    case 'quarterly': { const s = new Date(); s.setMonth(s.getMonth() - 3); start = s.toISOString().slice(0, 10); break; }
    case 'half-yearly': { const s = new Date(); s.setMonth(s.getMonth() - 6); start = s.toISOString().slice(0, 10); break; }
    case 'yearly': start = new Date(now.getFullYear(), 0, 1).toISOString().slice(0, 10); break;
    default: return { start: '', end: '' };
  }
  return { start, end };
};

const PERIODS = [
  { k: 'today', l: 'Today' },
  { k: 'week', l: 'Weekly' },
  { k: 'month', l: 'Monthly' },
  { k: 'quarterly', l: 'Quarterly' },
  { k: 'half-yearly', l: 'Half Yearly' },
  { k: 'yearly', l: 'Yearly' },
  { k: 'custom', l: 'Custom' },
];

export default function MilkRecords() {
  const [allCattle, setAllCattle] = useState([]);
  const [milkCattle, setMilkCattle] = useState([]);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [trend, setTrend] = useState([]);
  const [lastRecords, setLastRecords] = useState({});

  const [addCattleModal, setAddCattleModal] = useState(false);
  const [selectedTag, setSelectedTag] = useState('');

  const [recordModal, setRecordModal] = useState(false);
  const [recordCattle, setRecordCattle] = useState(null);
  const [form, setForm] = useState({ date: todayStr(), morningYield: '', morningFat: '', morningSNF: '', afternoonYield: '', afternoonFat: '', afternoonSNF: '', eveningYield: '', eveningFat: '', eveningSNF: '' });
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);

  const [viewCattle, setViewCattle] = useState(null);
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyFilter, setHistoryFilter] = useState('month');

  // Filter state for main records view
  const [showRecords, setShowRecords] = useState(false);
  const [filterPeriod, setFilterPeriod] = useState('month');
  const [filterCattle, setFilterCattle] = useState('');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState(todayStr());
  const [filteredRecords, setFilteredRecords] = useState([]);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [recordsPage, setRecordsPage] = useState(1);
  const [recordsTotal, setRecordsTotal] = useState(0);

  // Load
  const loadData = async () => {
    setLoading(true);
    try {
      const [cattleRes, analyticsRes] = await Promise.all([
        api.get('/cattle', { params: { limit: 500, status: 'active' } }),
        api.get('/milk/analytics'),
      ]);
      const all = cattleRes.data.data;
      setAllCattle(all);
      const cattleIds = (analyticsRes.data.data || []).map(d => d._id);
      const stored = JSON.parse(localStorage.getItem('milkCattleIds') || '[]');
      const allIds = [...new Set([...cattleIds, ...stored])];
      const map = {};
      all.forEach(c => { map[c._id] = c; });
      setMilkCattle(allIds.map(id => map[id]).filter(Boolean));
    } catch { toast.error('Failed'); }
    finally { setLoading(false); }
  };
  useEffect(() => { loadData(); }, []);

  const refreshSummary = () => {
    api.get('/milk/daily-summary').then(res => {
      setSummary(res.data.data);
      const map = {};
      (res.data.data?.records || []).forEach(r => { map[r.cattleId?._id || r.cattleId] = r; });
      setLastRecords(map);
    }).catch(() => {});
    const now = new Date();
    api.get('/milk/monthly-summary', { params: { year: now.getFullYear(), month: now.getMonth() + 1 } })
      .then(res => setTrend(res.data.data?.days || [])).catch(() => {});
  };
  useEffect(refreshSummary, []);

  // Fetch filtered records
  const fetchFilteredRecords = async (period = filterPeriod, cattleId = filterCattle, page = 1) => {
    setLoadingRecords(true);
    let startDate, endDate;
    if (period === 'custom') {
      startDate = customStart;
      endDate = customEnd;
    } else {
      const range = getDateRange(period);
      startDate = range.start;
      endDate = range.end;
    }
    const params = { startDate, endDate, limit: 50, page };
    if (cattleId) params.cattleId = cattleId;
    try {
      const res = await api.get('/milk', { params });
      setFilteredRecords(res.data.data || []);
      setRecordsTotal(res.data.pagination?.total || 0);
      setRecordsPage(page);
    } catch { toast.error('Failed to load records'); }
    finally { setLoadingRecords(false); }
  };

  const handleFilterChange = (period) => {
    setFilterPeriod(period);
    if (period !== 'custom') fetchFilteredRecords(period, filterCattle, 1);
  };

  const handleCattleFilter = (cattleId) => {
    setFilterCattle(cattleId);
    fetchFilteredRecords(filterPeriod, cattleId, 1);
  };

  const handleCustomApply = () => {
    if (!customStart || !customEnd) { toast.error('Select both dates'); return; }
    fetchFilteredRecords('custom', filterCattle, 1);
  };

  const openRecordsView = () => {
    setShowRecords(true);
    fetchFilteredRecords('month', '', 1);
  };

  // Download PDF report
  const handleDownloadReport = async () => {
    let startDate, endDate;
    if (filterPeriod === 'custom') {
      startDate = customStart; endDate = customEnd;
    } else {
      const range = getDateRange(filterPeriod);
      startDate = range.start; endDate = range.end;
    }
    const params = { startDate, endDate };
    if (filterCattle) params.cattleId = filterCattle;
    try {
      toast.loading('Generating PDF...', { id: 'rpdf' });
      const res = await api.get('/milk/pdf-report', { params, responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a'); a.href = url; a.download = 'milk-report.pdf'; a.click();
      window.URL.revokeObjectURL(url);
      toast.success('PDF downloaded', { id: 'rpdf' });
    } catch { toast.error('Failed to generate PDF', { id: 'rpdf' }); }
  };

  const handleAddCattle = () => {
    if (!selectedTag) return;
    const cattle = allCattle.find(c => c._id === selectedTag);
    if (!cattle || milkCattle.find(c => c._id === cattle._id)) return;
    const stored = JSON.parse(localStorage.getItem('milkCattleIds') || '[]');
    stored.push(cattle._id);
    localStorage.setItem('milkCattleIds', JSON.stringify([...new Set(stored)]));
    setMilkCattle(prev => [...prev, cattle]);
    setAddCattleModal(false);
    setSelectedTag('');
    toast.success(`Tag No ${cattle.tagNumber} added`);
  };

  const handleRemoveCattle = (cattleId) => {
    if (!confirm('Remove this cattle from milk section?')) return;
    const stored = JSON.parse(localStorage.getItem('milkCattleIds') || '[]');
    localStorage.setItem('milkCattleIds', JSON.stringify(stored.filter(id => id !== cattleId)));
    setMilkCattle(prev => prev.filter(c => c._id !== cattleId));
  };

  const openAddRecord = (cattle) => {
    setRecordCattle(cattle);
    const ex = lastRecords[cattle._id];
    if (ex) {
      setForm({ date: ex.date?.slice(0, 10) || todayStr(), morningYield: ex.morningYield || '', morningFat: ex.morningFat || '', morningSNF: ex.morningSNF || '', afternoonYield: ex.afternoonYield || '', afternoonFat: ex.afternoonFat || '', afternoonSNF: ex.afternoonSNF || '', eveningYield: ex.eveningYield || '', eveningFat: ex.eveningFat || '', eveningSNF: ex.eveningSNF || '' });
      setEditId(ex._id);
    } else {
      setForm({ date: todayStr(), morningYield: '', morningFat: '', morningSNF: '', afternoonYield: '', afternoonFat: '', afternoonSNF: '', eveningYield: '', eveningFat: '', eveningSNF: '' });
      setEditId(null);
    }
    setRecordModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.morningYield && !form.eveningYield) { toast.error('Enter at least one yield'); return; }
    setSaving(true);
    try {
      const data = { ...form, cattleId: recordCattle._id };
      if (editId) { await api.put(`/milk/${editId}`, data); toast.success('Updated'); }
      else { await api.post('/milk', data); toast.success('Added'); }
      setRecordModal(false);
      refreshSummary();
      if (viewCattle) fetchHistory(viewCattle._id, historyFilter);
      if (showRecords) fetchFilteredRecords(filterPeriod, filterCattle, recordsPage);
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    finally { setSaving(false); }
  };

  const openHistory = (cattle) => { setViewCattle(cattle); fetchHistory(cattle._id, 'month'); };
  const fetchHistory = async (cattleId, filter) => {
    setLoadingHistory(true); setHistoryFilter(filter);
    const now = new Date();
    let startDate, endDate = todayStr();
    if (filter === 'week') { const s = new Date(); s.setDate(s.getDate() - 7); startDate = s.toISOString().slice(0, 10); }
    else if (filter === 'month') { startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10); }
    else { startDate = new Date(now.getFullYear(), 0, 1).toISOString().slice(0, 10); }
    try { const res = await api.get('/milk', { params: { cattleId, startDate, endDate, limit: 200 } }); setHistory(res.data.data || []); }
    catch { toast.error('Failed'); }
    finally { setLoadingHistory(false); }
  };

  const handleDeleteRecord = async (id) => {
    if (!confirm('Delete this record?')) return;
    try { await api.delete(`/milk/${id}`); toast.success('Deleted'); if (viewCattle) fetchHistory(viewCattle._id, historyFilter); refreshSummary(); if (showRecords) fetchFilteredRecords(filterPeriod, filterCattle, recordsPage); } catch { toast.error('Failed'); }
  };

  const handleSharePdf = async (cattle) => {
    try {
      toast.loading('Generating PDF...', { id: 'pdf' });
      const res = await api.get(`/milk/pdf/${cattle._id}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a'); a.href = url; a.download = `milk-tag-${cattle.tagNumber}.pdf`; a.click();
      window.URL.revokeObjectURL(url);
      toast.success('PDF downloaded', { id: 'pdf' });
    } catch { toast.error('Failed to generate PDF', { id: 'pdf' }); }
  };

  const formTotal = (parseFloat(form.morningYield) || 0) + (parseFloat(form.afternoonYield) || 0) + (parseFloat(form.eveningYield) || 0);
  const availableCattle = allCattle.filter(c => !milkCattle.find(m => m._id === c._id));

  // Filtered records summary
  const filteredTotal = filteredRecords.reduce((s, r) => s + r.totalYield, 0);
  const filteredMorning = filteredRecords.reduce((s, r) => s + r.morningYield, 0);
  const filteredEvening = filteredRecords.reduce((s, r) => s + r.eveningYield, 0);

  // ─── PER-CATTLE HISTORY VIEW ───
  if (viewCattle) {
    const totalYield = history.reduce((s, r) => s + r.totalYield, 0);
    const avgYield = history.length ? totalYield / history.length : 0;
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={() => setViewCattle(null)} className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200"><FiArrowLeft size={20} /></button>
          <div>
            <h1 className="text-2xl font-bold">Tag No {viewCattle.tagNumber} <span className="text-base font-normal text-gray-400">({viewCattle.breed})</span></h1>
            <p className="text-gray-500 text-sm">Milk History</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="bg-emerald-50 rounded-lg p-3 text-center"><p className="text-xs text-emerald-500">Total</p><p className="text-lg font-bold text-emerald-700">{totalYield.toFixed(1)} L</p></div>
          <div className="bg-blue-50 rounded-lg p-3 text-center"><p className="text-xs text-blue-500">Avg/Day</p><p className="text-lg font-bold text-blue-700">{avgYield.toFixed(1)} L</p></div>
          <div className="bg-gray-50 rounded-lg p-3 text-center"><p className="text-xs text-gray-500">Records</p><p className="text-lg font-bold">{history.length}</p></div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex gap-2 flex-1 flex-wrap">
            {[{ k: 'week', l: 'This Week' }, { k: 'month', l: 'This Month' }, { k: 'year', l: 'This Year' }].map(f => (
              <button key={f.k} onClick={() => fetchHistory(viewCattle._id, f.k)} className={`px-4 py-2 rounded-lg text-sm font-medium ${historyFilter === f.k ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{f.l}</button>
            ))}
          </div>
          <button onClick={() => { setRecordCattle(viewCattle); setForm({ date: todayStr(), morningYield: '', morningFat: '', morningSNF: '', afternoonYield: '', afternoonFat: '', afternoonSNF: '', eveningYield: '', eveningFat: '', eveningSNF: '' }); setEditId(null); setRecordModal(true); }} className="btn-primary flex items-center gap-1 text-sm"><FiPlus size={14} /> Add Today's Record</button>
          <button onClick={() => handleSharePdf(viewCattle)} className="text-purple-600 hover:text-purple-800 text-sm font-medium">📄 Share PDF</button>
        </div>

        <div className="card p-0 overflow-x-auto">
          {loadingHistory ? (
            <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div></div>
          ) : history.length === 0 ? (
            <div className="text-center py-8 text-gray-400">No records found</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b text-xs text-gray-500 uppercase">
                  <th className="px-3 py-2 text-left">Date</th>
                  <th className="px-2 py-2 text-center bg-blue-50 text-blue-600">Morn (L)</th>
                  <th className="px-2 py-2 text-center bg-blue-50 text-blue-600">Fat%</th>
                  <th className="px-2 py-2 text-center bg-blue-50 text-blue-600">SNF%</th>
                  <th className="px-2 py-2 text-center bg-amber-50 text-amber-600">Noon (L)</th>
                  <th className="px-2 py-2 text-center bg-amber-50 text-amber-600">Fat%</th>
                  <th className="px-2 py-2 text-center bg-amber-50 text-amber-600">SNF%</th>
                  <th className="px-2 py-2 text-center bg-orange-50 text-orange-600">Eve (L)</th>
                  <th className="px-2 py-2 text-center bg-orange-50 text-orange-600">Fat%</th>
                  <th className="px-2 py-2 text-center bg-orange-50 text-orange-600">SNF%</th>
                  <th className="px-3 py-2 text-center text-emerald-600">Total</th>
                  <th className="px-2 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {history.map((r, i) => (
                  <tr key={r._id} className={`border-b ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                    <td className="px-3 py-2 text-gray-600">{formatDate(r.date)}</td>
                    <td className="px-2 py-2 text-center">{r.morningYield > 0 ? r.morningYield.toFixed(1) : '-'}</td>
                    <td className="px-2 py-2 text-center text-xs text-gray-400">{r.morningFat ?? '-'}</td>
                    <td className="px-2 py-2 text-center text-xs text-gray-400">{r.morningSNF ?? '-'}</td>
                    <td className="px-2 py-2 text-center">{r.afternoonYield > 0 ? r.afternoonYield.toFixed(1) : '-'}</td>
                    <td className="px-2 py-2 text-center text-xs text-gray-400">{r.afternoonFat ?? '-'}</td>
                    <td className="px-2 py-2 text-center text-xs text-gray-400">{r.afternoonSNF ?? '-'}</td>
                    <td className="px-2 py-2 text-center">{r.eveningYield > 0 ? r.eveningYield.toFixed(1) : '-'}</td>
                    <td className="px-2 py-2 text-center text-xs text-gray-400">{r.eveningFat ?? '-'}</td>
                    <td className="px-2 py-2 text-center text-xs text-gray-400">{r.eveningSNF ?? '-'}</td>
                    <td className="px-3 py-2 text-center font-bold text-emerald-600">{r.totalYield.toFixed(1)}</td>
                    <td className="px-2 py-2 whitespace-nowrap">
                      <button onClick={() => { setRecordCattle(viewCattle); setForm({ date: r.date?.slice(0,10) || todayStr(), morningYield: r.morningYield || '', morningFat: r.morningFat || '', morningSNF: r.morningSNF || '', afternoonYield: r.afternoonYield || '', afternoonFat: r.afternoonFat || '', afternoonSNF: r.afternoonSNF || '', eveningYield: r.eveningYield || '', eveningFat: r.eveningFat || '', eveningSNF: r.eveningSNF || '' }); setEditId(r._id); setRecordModal(true); }} className="text-blue-500 hover:text-blue-700 text-xs mr-2">Edit</button>
                      <button onClick={() => handleDeleteRecord(r._id)} className="text-red-400 hover:text-red-600 text-xs">Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Add/Edit Record Modal */}
        <Modal isOpen={recordModal} onClose={() => setRecordModal(false)} title={`${editId ? 'Edit' : 'Add'} Record — Tag No ${recordCattle?.tagNumber || ''}`} size="xl">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div><label className="label">Date *</label><input type="date" className="input w-auto" required value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border rounded-lg overflow-hidden">
                <thead><tr className="bg-gray-50"><th className="px-3 py-2 text-left text-xs text-gray-500 uppercase">Session</th><th className="px-3 py-2 text-center text-xs text-gray-500 uppercase">Yield (L) *</th><th className="px-3 py-2 text-center text-xs text-gray-500 uppercase">Fat %</th><th className="px-3 py-2 text-center text-xs text-gray-500 uppercase">SNF %</th></tr></thead>
                <tbody>
                  <tr className="bg-blue-50/50 border-b"><td className="px-3 py-2 font-medium text-blue-700">☀️ Morning</td><td className="px-2 py-1"><input type="number" step="0.1" className="input text-center" value={form.morningYield} onChange={e => setForm({ ...form, morningYield: e.target.value })} placeholder="0" /></td><td className="px-2 py-1"><input type="number" step="0.1" className="input text-center" value={form.morningFat} onChange={e => setForm({ ...form, morningFat: e.target.value })} placeholder="3.5" /></td><td className="px-2 py-1"><input type="number" step="0.1" className="input text-center" value={form.morningSNF} onChange={e => setForm({ ...form, morningSNF: e.target.value })} placeholder="8.5" /></td></tr>
                  <tr className="bg-amber-50/50 border-b"><td className="px-3 py-2 font-medium text-amber-700">🕐 Afternoon <span className="text-xs font-normal text-gray-400">(optional)</span></td><td className="px-2 py-1"><input type="number" step="0.1" className="input text-center" value={form.afternoonYield} onChange={e => setForm({ ...form, afternoonYield: e.target.value })} placeholder="0" /></td><td className="px-2 py-1"><input type="number" step="0.1" className="input text-center" value={form.afternoonFat} onChange={e => setForm({ ...form, afternoonFat: e.target.value })} placeholder="3.5" /></td><td className="px-2 py-1"><input type="number" step="0.1" className="input text-center" value={form.afternoonSNF} onChange={e => setForm({ ...form, afternoonSNF: e.target.value })} placeholder="8.5" /></td></tr>
                  <tr className="bg-orange-50/50 border-b"><td className="px-3 py-2 font-medium text-orange-700">🌙 Evening</td><td className="px-2 py-1"><input type="number" step="0.1" className="input text-center" value={form.eveningYield} onChange={e => setForm({ ...form, eveningYield: e.target.value })} placeholder="0" /></td><td className="px-2 py-1"><input type="number" step="0.1" className="input text-center" value={form.eveningFat} onChange={e => setForm({ ...form, eveningFat: e.target.value })} placeholder="3.5" /></td><td className="px-2 py-1"><input type="number" step="0.1" className="input text-center" value={form.eveningSNF} onChange={e => setForm({ ...form, eveningSNF: e.target.value })} placeholder="8.5" /></td></tr>
                  {formTotal > 0 && <tr className="bg-emerald-50"><td className="px-3 py-2 font-bold text-emerald-700">Total</td><td className="px-3 py-2 text-center font-bold text-emerald-700 text-lg">{formTotal.toFixed(1)} L</td><td></td><td></td></tr>}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end gap-3 pt-2 border-t">
              <button type="button" onClick={() => setRecordModal(false)} className="btn-secondary">Cancel</button>
              <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving...' : editId ? 'Update' : 'Add Record'}</button>
            </div>
          </form>
        </Modal>
      </div>
    );
  }

  // ─── ALL RECORDS VIEW (with filters) ───
  if (showRecords) {
    const totalPages = Math.ceil(recordsTotal / 50);
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={() => setShowRecords(false)} className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200"><FiArrowLeft size={20} /></button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">📋 All Milk Records</h1>
            <p className="text-gray-500 text-sm">Filter and view entire milk production data</p>
          </div>
          <button onClick={handleDownloadReport} className="btn-primary flex items-center gap-2 text-sm"><FiDownload size={14} /> Share PDF</button>
        </div>

        {/* Filter Bar */}
        <div className="card space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-600"><FiFilter size={14} /> Filters</div>

          {/* Period Buttons */}
          <div className="flex gap-2 flex-wrap">
            {PERIODS.map(p => (
              <button key={p.k} onClick={() => handleFilterChange(p.k)} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${filterPeriod === p.k ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{p.l}</button>
            ))}
          </div>

          {/* Custom Date Range */}
          {filterPeriod === 'custom' && (
            <div className="flex items-center gap-3 flex-wrap">
              <div>
                <label className="text-xs text-gray-500">From</label>
                <input type="date" className="input text-sm" value={customStart} onChange={e => setCustomStart(e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-gray-500">To</label>
                <input type="date" className="input text-sm" value={customEnd} onChange={e => setCustomEnd(e.target.value)} />
              </div>
              <button onClick={handleCustomApply} className="btn-primary text-sm mt-4">Apply</button>
            </div>
          )}

          {/* Cattle Filter */}
          <div>
            <label className="text-xs text-gray-500">Filter by Cattle Tag</label>
            <select className="input text-sm w-auto" value={filterCattle} onChange={e => handleCattleFilter(e.target.value)}>
              <option value="">All Cattle</option>
              {allCattle.map(c => <option key={c._id} value={c._id}>Tag No {c.tagNumber} — {c.breed}</option>)}
            </select>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-blue-50 rounded-lg p-3 text-center"><p className="text-xs text-blue-500">Morning</p><p className="text-xl font-bold text-blue-700">{filteredMorning.toFixed(1)} L</p></div>
          <div className="bg-orange-50 rounded-lg p-3 text-center"><p className="text-xs text-orange-500">Evening</p><p className="text-xl font-bold text-orange-700">{filteredEvening.toFixed(1)} L</p></div>
          <div className="bg-emerald-50 rounded-lg p-3 text-center"><p className="text-xs text-emerald-500">Total</p><p className="text-xl font-bold text-emerald-700">{filteredTotal.toFixed(1)} L</p></div>
          <div className="bg-gray-50 rounded-lg p-3 text-center"><p className="text-xs text-gray-500">Records</p><p className="text-xl font-bold">{recordsTotal}</p></div>
        </div>

        {/* Records Table */}
        <div className="card p-0 overflow-x-auto">
          {loadingRecords ? (
            <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div></div>
          ) : filteredRecords.length === 0 ? (
            <div className="text-center py-8 text-gray-400">No records found for selected filters</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b text-xs text-gray-500 uppercase">
                  <th className="px-3 py-2 text-left">Date</th>
                  <th className="px-2 py-2 text-left">Tag No</th>
                  <th className="px-2 py-2 text-left">Breed</th>
                  <th className="px-2 py-2 text-center bg-blue-50 text-blue-600">Morn (L)</th>
                  <th className="px-2 py-2 text-center bg-blue-50 text-blue-600">Fat%</th>
                  <th className="px-2 py-2 text-center bg-blue-50 text-blue-600">SNF%</th>
                  <th className="px-2 py-2 text-center bg-orange-50 text-orange-600">Eve (L)</th>
                  <th className="px-2 py-2 text-center bg-orange-50 text-orange-600">Fat%</th>
                  <th className="px-2 py-2 text-center bg-orange-50 text-orange-600">SNF%</th>
                  <th className="px-3 py-2 text-center text-emerald-600">Total</th>
                  <th className="px-2 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.map((r, i) => (
                  <tr key={r._id} className={`border-b ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                    <td className="px-3 py-2 text-gray-600">{formatDate(r.date)}</td>
                    <td className="px-2 py-2 font-mono font-medium">{'Tag No ' + (r.cattleId?.tagNumber || '-')}</td>
                    <td className="px-2 py-2 text-gray-500 text-xs">{r.cattleId?.breed || '-'}</td>
                    <td className="px-2 py-2 text-center">{r.morningYield > 0 ? r.morningYield.toFixed(1) : '-'}</td>
                    <td className="px-2 py-2 text-center text-xs text-gray-400">{r.morningFat ?? '-'}</td>
                    <td className="px-2 py-2 text-center text-xs text-gray-400">{r.morningSNF ?? '-'}</td>
                    <td className="px-2 py-2 text-center">{r.eveningYield > 0 ? r.eveningYield.toFixed(1) : '-'}</td>
                    <td className="px-2 py-2 text-center text-xs text-gray-400">{r.eveningFat ?? '-'}</td>
                    <td className="px-2 py-2 text-center text-xs text-gray-400">{r.eveningSNF ?? '-'}</td>
                    <td className="px-3 py-2 text-center font-bold text-emerald-600">{r.totalYield.toFixed(1)}</td>
                    <td className="px-2 py-2 whitespace-nowrap">
                      <button onClick={() => handleDeleteRecord(r._id)} className="text-red-400 hover:text-red-600 text-xs">Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-center gap-2">
            <button onClick={() => fetchFilteredRecords(filterPeriod, filterCattle, recordsPage - 1)} disabled={recordsPage <= 1} className="px-3 py-1 rounded bg-gray-100 text-sm disabled:opacity-40">Prev</button>
            <span className="px-3 py-1 text-sm text-gray-600">Page {recordsPage} of {totalPages}</span>
            <button onClick={() => fetchFilteredRecords(filterPeriod, filterCattle, recordsPage + 1)} disabled={recordsPage >= totalPages} className="px-3 py-1 rounded bg-gray-100 text-sm disabled:opacity-40">Next</button>
          </div>
        )}
      </div>
    );
  }

  // ─── MAIN VIEW ───
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">🥛 Milk Records</h1>
          <p className="text-gray-500 text-sm">Manage daily milk production</p>
        </div>
        <div className="flex gap-2">
          <button onClick={openRecordsView} className="btn-secondary flex items-center gap-2 text-sm"><FiFilter size={16} /> All Records</button>
          <button onClick={() => setAddCattleModal(true)} className="btn-primary flex items-center gap-2"><FiPlus size={18} /> Add Cattle</button>
        </div>
      </div>

      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-blue-50 rounded-lg p-3 text-center"><p className="text-xs text-blue-500">Morning</p><p className="text-xl font-bold text-blue-700">{formatLiters(summary.totalMorning)}</p></div>
          <div className="bg-orange-50 rounded-lg p-3 text-center"><p className="text-xs text-orange-500">Evening</p><p className="text-xl font-bold text-orange-700">{formatLiters(summary.totalEvening)}</p></div>
          <div className="bg-emerald-50 rounded-lg p-3 text-center"><p className="text-xs text-emerald-500">Total</p><p className="text-xl font-bold text-emerald-700">{formatLiters(summary.totalYield)}</p></div>
          <div className="bg-gray-50 rounded-lg p-3 text-center"><p className="text-xs text-gray-500">Recorded</p><p className="text-xl font-bold">{summary.recordCount}/{milkCattle.length}</p></div>
        </div>
      )}

      {trend.length > 0 && (
        <div className="card">
          <h3 className="text-sm font-semibold text-gray-600 mb-3">📈 This Month</h3>
          <ResponsiveContainer width="100%" height={150}>
            <LineChart data={trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="_id" tick={{ fontSize: 10 }} tickFormatter={v => v.slice(8)} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip formatter={v => [`${v.toFixed(1)} L`, 'Total']} />
              <Line type="monotone" dataKey="total" stroke="#10b981" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Cattle Table */}
      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div></div>
      ) : milkCattle.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-gray-400 text-lg mb-2">No cattle added yet</p>
          <p className="text-gray-400 text-sm mb-4">Add cattle to start recording milk</p>
          <button onClick={() => setAddCattleModal(true)} className="btn-primary"><FiPlus size={16} className="inline mr-1" /> Add Cattle</button>
        </div>
      ) : (
        <div className="card p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b text-xs text-gray-500 uppercase">
                <th className="px-3 py-2 text-left">Date</th>
                <th className="px-2 py-2 text-left">Tag No</th>
                <th className="px-2 py-2 text-left">Breed</th>
                <th className="px-2 py-2 text-center bg-blue-50 text-blue-600">Morn (L)</th>
                <th className="px-2 py-2 text-center bg-blue-50 text-blue-600">Fat%</th>
                <th className="px-2 py-2 text-center bg-blue-50 text-blue-600">SNF%</th>
                <th className="px-2 py-2 text-center bg-orange-50 text-orange-600">Eve (L)</th>
                <th className="px-2 py-2 text-center bg-orange-50 text-orange-600">Fat%</th>
                <th className="px-2 py-2 text-center bg-orange-50 text-orange-600">SNF%</th>
                <th className="px-3 py-2 text-center text-emerald-600">Total</th>
                <th className="px-2 py-2 text-left">Status</th>
                <th className="px-2 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {milkCattle.map((c, i) => {
                const rec = lastRecords[c._id];
                const hasToday = !!rec;
                return (
                  <tr key={c._id} className={`border-b ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                    <td className="px-3 py-2 text-gray-600">{new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                    <td className="px-2 py-2 font-mono font-medium">Tag No {c.tagNumber}</td>
                    <td className="px-2 py-2 text-gray-500 text-xs">{c.breed}</td>
                    <td className="px-2 py-2 text-center">{hasToday ? (rec.morningYield > 0 ? rec.morningYield.toFixed(1) : '-') : '-'}</td>
                    <td className="px-2 py-2 text-center text-xs text-gray-400">{hasToday ? (rec.morningFat ?? '-') : '-'}</td>
                    <td className="px-2 py-2 text-center text-xs text-gray-400">{hasToday ? (rec.morningSNF ?? '-') : '-'}</td>
                    <td className="px-2 py-2 text-center">{hasToday ? (rec.eveningYield > 0 ? rec.eveningYield.toFixed(1) : '-') : '-'}</td>
                    <td className="px-2 py-2 text-center text-xs text-gray-400">{hasToday ? (rec.eveningFat ?? '-') : '-'}</td>
                    <td className="px-2 py-2 text-center text-xs text-gray-400">{hasToday ? (rec.eveningSNF ?? '-') : '-'}</td>
                    <td className="px-3 py-2 text-center font-bold text-emerald-600">{hasToday ? rec.totalYield?.toFixed(1) : '-'}</td>
                    <td className="px-2 py-2">
                      {hasToday ? (
                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-xs font-medium">✓ Done</span>
                      ) : (
                        <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium">Pending</span>
                      )}
                    </td>
                    <td className="px-2 py-2 whitespace-nowrap">
                      {!hasToday && <button onClick={() => openAddRecord(c)} className="text-emerald-600 hover:text-emerald-800 text-xs mr-2">Add</button>}
                      <button onClick={() => openHistory(c)} className="text-blue-600 hover:text-blue-800 text-xs mr-2">View</button>
                      <button onClick={() => handleSharePdf(c)} className="text-purple-600 hover:text-purple-800 text-xs mr-2">PDF</button>
                      <button onClick={() => handleRemoveCattle(c._id)} className="text-red-500 hover:text-red-700 text-xs">Delete</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Cattle Modal */}
      <Modal isOpen={addCattleModal} onClose={() => setAddCattleModal(false)} title="Add Cattle to Milk Records">
        <div className="space-y-4">
          <div>
            <label className="label">Tag No *</label>
            <select className="input" value={selectedTag} onChange={e => setSelectedTag(e.target.value)}>
              <option value="">Select cattle</option>
              {availableCattle.map(c => <option key={c._id} value={c._id}>Tag No {c.tagNumber} — {c.breed} ({c.category})</option>)}
            </select>
          </div>
          {availableCattle.length === 0 && <p className="text-sm text-gray-400">All cattle already added.</p>}
          <div className="flex justify-end gap-3">
            <button onClick={() => setAddCattleModal(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleAddCattle} disabled={!selectedTag} className="btn-primary">Add</button>
          </div>
        </div>
      </Modal>

      {/* Add/Update Record Modal */}
      <Modal isOpen={recordModal} onClose={() => setRecordModal(false)} title={`${editId ? 'Update' : 'Add'} Record — Tag No ${recordCattle?.tagNumber || ''}`} size="xl">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div><label className="label">Date *</label><input type="date" className="input w-auto" required value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border rounded-lg overflow-hidden">
              <thead><tr className="bg-gray-50"><th className="px-3 py-2 text-left text-xs text-gray-500 uppercase">Session</th><th className="px-3 py-2 text-center text-xs text-gray-500 uppercase">Yield (L)</th><th className="px-3 py-2 text-center text-xs text-gray-500 uppercase">Fat %</th><th className="px-3 py-2 text-center text-xs text-gray-500 uppercase">SNF %</th></tr></thead>
              <tbody>
                <tr className="bg-blue-50/50 border-b"><td className="px-3 py-2 font-medium text-blue-700">☀️ Morning</td><td className="px-2 py-1"><input type="number" step="0.1" className="input text-center" value={form.morningYield} onChange={e => setForm({ ...form, morningYield: e.target.value })} placeholder="0" /></td><td className="px-2 py-1"><input type="number" step="0.1" className="input text-center" value={form.morningFat} onChange={e => setForm({ ...form, morningFat: e.target.value })} placeholder="3.5" /></td><td className="px-2 py-1"><input type="number" step="0.1" className="input text-center" value={form.morningSNF} onChange={e => setForm({ ...form, morningSNF: e.target.value })} placeholder="8.5" /></td></tr>
                <tr className="bg-amber-50/50 border-b"><td className="px-3 py-2 font-medium text-amber-700">🕐 Afternoon <span className="text-xs font-normal text-gray-400">(optional)</span></td><td className="px-2 py-1"><input type="number" step="0.1" className="input text-center" value={form.afternoonYield} onChange={e => setForm({ ...form, afternoonYield: e.target.value })} placeholder="0" /></td><td className="px-2 py-1"><input type="number" step="0.1" className="input text-center" value={form.afternoonFat} onChange={e => setForm({ ...form, afternoonFat: e.target.value })} placeholder="3.5" /></td><td className="px-2 py-1"><input type="number" step="0.1" className="input text-center" value={form.afternoonSNF} onChange={e => setForm({ ...form, afternoonSNF: e.target.value })} placeholder="8.5" /></td></tr>
                <tr className="bg-orange-50/50 border-b"><td className="px-3 py-2 font-medium text-orange-700">🌙 Evening</td><td className="px-2 py-1"><input type="number" step="0.1" className="input text-center" value={form.eveningYield} onChange={e => setForm({ ...form, eveningYield: e.target.value })} placeholder="0" /></td><td className="px-2 py-1"><input type="number" step="0.1" className="input text-center" value={form.eveningFat} onChange={e => setForm({ ...form, eveningFat: e.target.value })} placeholder="3.5" /></td><td className="px-2 py-1"><input type="number" step="0.1" className="input text-center" value={form.eveningSNF} onChange={e => setForm({ ...form, eveningSNF: e.target.value })} placeholder="8.5" /></td></tr>
                {formTotal > 0 && <tr className="bg-emerald-50"><td className="px-3 py-2 font-bold text-emerald-700">Total</td><td className="px-3 py-2 text-center font-bold text-emerald-700 text-lg">{formTotal.toFixed(1)} L</td><td></td><td></td></tr>}
              </tbody>
            </table>
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t">
            <button type="button" onClick={() => setRecordModal(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving...' : editId ? 'Update' : 'Add Record'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
