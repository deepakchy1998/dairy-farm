import { useState, useEffect } from 'react';
import api from '../../utils/api';
import { formatDate, formatLiters } from '../../utils/helpers';
import Modal from '../../components/Modal';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { FiPlus, FiArrowLeft, FiDownload, FiFilter } from 'react-icons/fi';
import ConfirmDialog from '../../components/ConfirmDialog';
import toast from 'react-hot-toast';
import { exportCsv } from '../../utils/exportCsv';
import { exportPdf } from '../../utils/exportPdf';

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

  const [calcModal, setCalcModal] = useState(false);
  const [calcForm, setCalcForm] = useState({ quantity: '', fat: '', snf: '', ratePerFat: '7.5' });
  const [calcResult, setCalcResult] = useState(null);
  const [calculating, setCalculating] = useState(false);

  const [confirmDialog, setConfirmDialog] = useState({ open: false, title: '', message: '', onConfirm: null, variant: 'danger', confirmText: 'Confirm' });

  // Bulk entry state
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkDate, setBulkDate] = useState(todayStr());
  const [bulkEntries, setBulkEntries] = useState([]);
  const [savingBulk, setSavingBulk] = useState(false);

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
    setConfirmDialog({ open: true, title: 'Remove Cattle?', message: 'Remove this cattle from milk section?', variant: 'warning', confirmText: 'Remove', onConfirm: () => {
      const stored = JSON.parse(localStorage.getItem('milkCattleIds') || '[]');
      localStorage.setItem('milkCattleIds', JSON.stringify(stored.filter(id => id !== cattleId)));
      setMilkCattle(prev => prev.filter(c => c._id !== cattleId));
    }});
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
    setConfirmDialog({ open: true, title: 'Delete Record?', message: 'This will permanently delete this milk record.', variant: 'danger', confirmText: 'Delete', onConfirm: async () => {
      try { await api.delete(`/milk/${id}`); toast.success('Deleted'); if (viewCattle) fetchHistory(viewCattle._id, historyFilter); refreshSummary(); if (showRecords) fetchFilteredRecords(filterPeriod, filterCattle, recordsPage); } catch { toast.error('Failed'); }
    }});
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

  const openBulkEntry = () => {
    setBulkEntries(milkCattle.map(c => ({
      cattleId: c._id, tagNumber: c.tagNumber, breed: c.breed,
      morningYield: '', morningFat: '', eveningYield: '', eveningFat: '',
    })));
    setBulkDate(todayStr());
    setBulkMode(true);
  };

  const updateBulkEntry = (idx, field, value) => {
    setBulkEntries(prev => prev.map((e, i) => i === idx ? { ...e, [field]: value } : e));
  };

  const saveBulkEntries = async () => {
    const toSave = bulkEntries.filter(e => e.morningYield || e.eveningYield);
    if (!toSave.length) { toast.error('Enter at least one record'); return; }
    setSavingBulk(true);
    let saved = 0, failed = 0;
    for (const e of toSave) {
      try {
        await api.post('/milk', {
          cattleId: e.cattleId, date: bulkDate,
          morningYield: e.morningYield || '', morningFat: e.morningFat || '',
          eveningYield: e.eveningYield || '', eveningFat: e.eveningFat || '',
        });
        saved++;
      } catch { failed++; }
    }
    setSavingBulk(false);
    if (saved) toast.success(`Saved ${saved} records`);
    if (failed) toast.error(`${failed} failed`);
    refreshSummary();
    setBulkMode(false);
  };

  const formTotal = (parseFloat(form.morningYield) || 0) + (parseFloat(form.afternoonYield) || 0) + (parseFloat(form.eveningYield) || 0);
  const availableCattle = allCattle.filter(c => !milkCattle.find(m => m._id === c._id));

  // Filtered records summary
  const filteredTotal = filteredRecords.reduce((s, r) => s + r.totalYield, 0);
  const filteredMorning = filteredRecords.reduce((s, r) => s + r.morningYield, 0);
  const filteredEvening = filteredRecords.reduce((s, r) => s + r.eveningYield, 0);

  // ─── BULK ENTRY VIEW ───
  if (bulkMode) {
    const bulkTotal = bulkEntries.reduce((s, e) => s + (parseFloat(e.morningYield) || 0) + (parseFloat(e.eveningYield) || 0), 0);
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={() => setBulkMode(false)} className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 dark:text-white"><FiArrowLeft size={20} /></button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">📝 Bulk Milk Entry</h1>
            <p className="text-gray-500 text-sm">Enter milk records for all cattle at once</p>
          </div>
          <input type="date" className="input w-auto text-sm" value={bulkDate} onChange={e => setBulkDate(e.target.value)} />
        </div>

        {bulkTotal > 0 && (
          <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-3 text-center">
            <span className="text-sm text-emerald-600 font-medium">Grand Total: </span>
            <span className="text-xl font-bold text-emerald-700 dark:text-emerald-400">{bulkTotal.toFixed(1)} L</span>
          </div>
        )}

        {/* Desktop Table */}
        <div className="card p-0 hidden md:block overflow-x-auto max-h-[65vh] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="bg-gray-50 dark:bg-gray-800/50 border-b text-xs text-gray-500 uppercase">
                <th className="px-3 py-2 text-left">Tag No</th>
                <th className="px-3 py-2 text-left">Breed</th>
                <th className="px-2 py-2 text-center bg-blue-50 dark:bg-blue-900/20 text-blue-600">Morning (L)</th>
                <th className="px-2 py-2 text-center bg-blue-50 dark:bg-blue-900/20 text-blue-600">Morning Fat%</th>
                <th className="px-2 py-2 text-center bg-orange-50 dark:bg-orange-900/20 text-orange-600">Evening (L)</th>
                <th className="px-2 py-2 text-center bg-orange-50 dark:bg-orange-900/20 text-orange-600">Evening Fat%</th>
                <th className="px-3 py-2 text-center text-emerald-600">Total</th>
              </tr>
            </thead>
            <tbody>
              {bulkEntries.map((e, i) => {
                const total = (parseFloat(e.morningYield) || 0) + (parseFloat(e.eveningYield) || 0);
                return (
                  <tr key={e.cattleId} className={`border-b ${i % 2 ? 'bg-gray-50/50 dark:bg-gray-800/20' : ''}`}>
                    <td className="px-3 py-2 font-mono font-medium whitespace-nowrap">Tag No {e.tagNumber}</td>
                    <td className="px-3 py-2 text-gray-500 text-xs">{e.breed}</td>
                    <td className="px-2 py-1"><input type="number" step="0.1" className="input text-center text-sm !py-1" placeholder="0" value={e.morningYield} onChange={ev => updateBulkEntry(i, 'morningYield', ev.target.value)} /></td>
                    <td className="px-2 py-1"><input type="number" step="0.1" className="input text-center text-sm !py-1" placeholder="3.5" value={e.morningFat} onChange={ev => updateBulkEntry(i, 'morningFat', ev.target.value)} /></td>
                    <td className="px-2 py-1"><input type="number" step="0.1" className="input text-center text-sm !py-1" placeholder="0" value={e.eveningYield} onChange={ev => updateBulkEntry(i, 'eveningYield', ev.target.value)} /></td>
                    <td className="px-2 py-1"><input type="number" step="0.1" className="input text-center text-sm !py-1" placeholder="3.5" value={e.eveningFat} onChange={ev => updateBulkEntry(i, 'eveningFat', ev.target.value)} /></td>
                    <td className="px-3 py-2 text-center font-bold text-emerald-600">{total > 0 ? total.toFixed(1) + 'L' : '-'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards */}
        <div className="md:hidden space-y-3">
          {bulkEntries.map((e, i) => {
            const total = (parseFloat(e.morningYield) || 0) + (parseFloat(e.eveningYield) || 0);
            return (
              <div key={e.cattleId} className="card !p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-mono font-semibold text-sm">Tag No {e.tagNumber}</p>
                    <p className="text-xs text-gray-400">{e.breed}</p>
                  </div>
                  {total > 0 && <span className="text-lg font-bold text-emerald-600">{total.toFixed(1)}L</span>}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-blue-50 dark:bg-blue-900/10 rounded-lg p-2">
                    <p className="text-[10px] text-blue-500 font-medium mb-1">☀️ Morning</p>
                    <div className="grid grid-cols-2 gap-1">
                      <div><label className="text-[10px] text-gray-400">Liters</label><input type="number" step="0.1" className="input text-center text-sm !py-1" placeholder="0" value={e.morningYield} onChange={ev => updateBulkEntry(i, 'morningYield', ev.target.value)} /></div>
                      <div><label className="text-[10px] text-gray-400">Fat%</label><input type="number" step="0.1" className="input text-center text-sm !py-1" placeholder="3.5" value={e.morningFat} onChange={ev => updateBulkEntry(i, 'morningFat', ev.target.value)} /></div>
                    </div>
                  </div>
                  <div className="bg-orange-50 dark:bg-orange-900/10 rounded-lg p-2">
                    <p className="text-[10px] text-orange-500 font-medium mb-1">🌙 Evening</p>
                    <div className="grid grid-cols-2 gap-1">
                      <div><label className="text-[10px] text-gray-400">Liters</label><input type="number" step="0.1" className="input text-center text-sm !py-1" placeholder="0" value={e.eveningYield} onChange={ev => updateBulkEntry(i, 'eveningYield', ev.target.value)} /></div>
                      <div><label className="text-[10px] text-gray-400">Fat%</label><input type="number" step="0.1" className="input text-center text-sm !py-1" placeholder="3.5" value={e.eveningFat} onChange={ev => updateBulkEntry(i, 'eveningFat', ev.target.value)} /></div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button onClick={() => setBulkMode(false)} className="btn-secondary">Cancel</button>
          <button onClick={saveBulkEntries} disabled={savingBulk} className="btn-primary">{savingBulk ? 'Saving...' : `Save All (${bulkEntries.filter(e => e.morningYield || e.eveningYield).length} records)`}</button>
        </div>
      </div>
    );
  }

  // ─── PER-CATTLE HISTORY VIEW ───
  if (viewCattle) {
    const totalYield = history.reduce((s, r) => s + r.totalYield, 0);
    const avgYield = history.length ? totalYield / history.length : 0;
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={() => setViewCattle(null)} className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 dark:text-white"><FiArrowLeft size={20} /></button>
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

        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex gap-2 flex-wrap">
            {[{ k: 'week', l: 'This Week' }, { k: 'month', l: 'This Month' }, { k: 'year', l: 'This Year' }].map(f => (
              <button key={f.k} onClick={() => fetchHistory(viewCattle._id, f.k)} className={`px-3 py-1.5 rounded-lg text-sm font-medium ${historyFilter === f.k ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{f.l}</button>
            ))}
          </div>
          <div className="flex gap-2 sm:ml-auto">
            <button onClick={() => { setRecordCattle(viewCattle); setForm({ date: todayStr(), morningYield: '', morningFat: '', morningSNF: '', afternoonYield: '', afternoonFat: '', afternoonSNF: '', eveningYield: '', eveningFat: '', eveningSNF: '' }); setEditId(null); setRecordModal(true); }} className="btn-primary flex items-center gap-1 text-xs sm:text-sm"><FiPlus size={14} /> Add Record</button>
            <button onClick={() => handleSharePdf(viewCattle)} className="btn-secondary text-xs sm:text-sm">📄 PDF</button>
          </div>
        </div>

        <div className="card p-0">
          {loadingHistory ? (
            <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div></div>
          ) : history.length === 0 ? (
            <div className="text-center py-8 text-gray-400">No records found</div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block overflow-auto max-h-[60vh]">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-gray-50 dark:bg-gray-800/50 border-b text-xs text-gray-500 uppercase">
                      <th className="px-3 py-2 text-left">Date</th>
                      <th className="px-2 py-2 text-center text-blue-600">Morning</th>
                      <th className="px-2 py-2 text-center text-amber-600">Afternoon</th>
                      <th className="px-2 py-2 text-center text-orange-600">Evening</th>
                      <th className="px-3 py-2 text-center text-emerald-600">Total</th>
                      <th className="px-2 py-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((r, i) => (
                      <tr key={r._id} className={`border-b hover:bg-gray-50 dark:hover:bg-gray-800/30 ${i % 2 === 0 ? '' : 'bg-gray-50/50 dark:bg-gray-800/20'}`}>
                        <td className="px-3 py-2 text-gray-600 dark:text-gray-400 whitespace-nowrap">{formatDate(r.date)}</td>
                        <td className="px-2 py-2 text-center">{r.morningYield > 0 ? <span>{r.morningYield.toFixed(1)}L {r.morningFat ? <span className="text-xs text-gray-400">({r.morningFat}%)</span> : ''}</span> : <span className="text-gray-300">-</span>}</td>
                        <td className="px-2 py-2 text-center">{r.afternoonYield > 0 ? <span>{r.afternoonYield.toFixed(1)}L</span> : <span className="text-gray-300">-</span>}</td>
                        <td className="px-2 py-2 text-center">{r.eveningYield > 0 ? <span>{r.eveningYield.toFixed(1)}L {r.eveningFat ? <span className="text-xs text-gray-400">({r.eveningFat}%)</span> : ''}</span> : <span className="text-gray-300">-</span>}</td>
                        <td className="px-3 py-2 text-center font-bold text-emerald-600">{r.totalYield.toFixed(1)}L</td>
                        <td className="px-2 py-2 whitespace-nowrap">
                          <button onClick={() => { setRecordCattle(viewCattle); setForm({ date: r.date?.slice(0,10) || todayStr(), morningYield: r.morningYield || '', morningFat: r.morningFat || '', morningSNF: r.morningSNF || '', afternoonYield: r.afternoonYield || '', afternoonFat: r.afternoonFat || '', afternoonSNF: r.afternoonSNF || '', eveningYield: r.eveningYield || '', eveningFat: r.eveningFat || '', eveningSNF: r.eveningSNF || '' }); setEditId(r._id); setRecordModal(true); }} className="text-blue-500 hover:text-blue-700 text-xs mr-2">Edit</button>
                          <button onClick={() => handleDeleteRecord(r._id)} className="text-red-400 hover:text-red-600 text-xs">Delete</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden divide-y divide-gray-100 dark:divide-gray-800">
                {history.map(r => (
                  <div key={r._id} className="p-3 hover:bg-gray-50 dark:hover:bg-gray-800/30">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{formatDate(r.date)}</span>
                      <span className="text-lg font-bold text-emerald-600">{r.totalYield.toFixed(1)}L</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg py-1.5 px-1">
                        <p className="text-[10px] text-blue-500 font-medium">Morning</p>
                        <p className="text-sm font-semibold text-blue-700 dark:text-blue-300">{r.morningYield > 0 ? r.morningYield.toFixed(1) + 'L' : '-'}</p>
                        {r.morningFat > 0 && <p className="text-[10px] text-gray-400">Fat {r.morningFat}%</p>}
                      </div>
                      <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg py-1.5 px-1">
                        <p className="text-[10px] text-amber-500 font-medium">Afternoon</p>
                        <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">{r.afternoonYield > 0 ? r.afternoonYield.toFixed(1) + 'L' : '-'}</p>
                      </div>
                      <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg py-1.5 px-1">
                        <p className="text-[10px] text-orange-500 font-medium">Evening</p>
                        <p className="text-sm font-semibold text-orange-700 dark:text-orange-300">{r.eveningYield > 0 ? r.eveningYield.toFixed(1) + 'L' : '-'}</p>
                        {r.eveningFat > 0 && <p className="text-[10px] text-gray-400">Fat {r.eveningFat}%</p>}
                      </div>
                    </div>
                    <div className="flex justify-end gap-3 mt-2">
                      <button onClick={() => { setRecordCattle(viewCattle); setForm({ date: r.date?.slice(0,10) || todayStr(), morningYield: r.morningYield || '', morningFat: r.morningFat || '', morningSNF: r.morningSNF || '', afternoonYield: r.afternoonYield || '', afternoonFat: r.afternoonFat || '', afternoonSNF: r.afternoonSNF || '', eveningYield: r.eveningYield || '', eveningFat: r.eveningFat || '', eveningSNF: r.eveningSNF || '' }); setEditId(r._id); setRecordModal(true); }} className="text-blue-500 text-xs font-medium">✏️ Edit</button>
                      <button onClick={() => handleDeleteRecord(r._id)} className="text-red-400 text-xs font-medium">🗑️ Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Add/Edit Record Modal */}
        <Modal isOpen={recordModal} onClose={() => setRecordModal(false)} title={`${editId ? 'Edit' : 'Add'} Record — Tag No ${recordCattle?.tagNumber || ''}`} size="xl">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div><label className="label">Date *</label><input type="date" className="input w-auto" required value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></div>
            <div className="space-y-4">
              {/* Desktop table */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-sm border rounded-lg overflow-hidden">
                  <thead><tr className="bg-gray-50 dark:bg-gray-800"><th className="px-3 py-2 text-left text-xs text-gray-500 uppercase">Session</th><th className="px-3 py-2 text-center text-xs text-gray-500 uppercase">Yield (L) *</th><th className="px-3 py-2 text-center text-xs text-gray-500 uppercase">Fat %</th><th className="px-3 py-2 text-center text-xs text-gray-500 uppercase">SNF %</th></tr></thead>
                  <tbody>
                    <tr className="bg-blue-50/50 dark:bg-blue-900/10 border-b"><td className="px-3 py-2 font-medium text-blue-700 dark:text-blue-400">☀️ Morning</td><td className="px-2 py-1"><input type="number" step="0.1" className="input text-center" value={form.morningYield} onChange={e => setForm({ ...form, morningYield: e.target.value })} placeholder="0" /></td><td className="px-2 py-1"><input type="number" step="0.1" className="input text-center" value={form.morningFat} onChange={e => setForm({ ...form, morningFat: e.target.value })} placeholder="3.5" /></td><td className="px-2 py-1"><input type="number" step="0.1" className="input text-center" value={form.morningSNF} onChange={e => setForm({ ...form, morningSNF: e.target.value })} placeholder="8.5" /></td></tr>
                    <tr className="bg-amber-50/50 dark:bg-amber-900/10 border-b"><td className="px-3 py-2 font-medium text-amber-700 dark:text-amber-400">🕐 Afternoon</td><td className="px-2 py-1"><input type="number" step="0.1" className="input text-center" value={form.afternoonYield} onChange={e => setForm({ ...form, afternoonYield: e.target.value })} placeholder="0" /></td><td className="px-2 py-1"><input type="number" step="0.1" className="input text-center" value={form.afternoonFat} onChange={e => setForm({ ...form, afternoonFat: e.target.value })} placeholder="3.5" /></td><td className="px-2 py-1"><input type="number" step="0.1" className="input text-center" value={form.afternoonSNF} onChange={e => setForm({ ...form, afternoonSNF: e.target.value })} placeholder="8.5" /></td></tr>
                    <tr className="bg-orange-50/50 dark:bg-orange-900/10 border-b"><td className="px-3 py-2 font-medium text-orange-700 dark:text-orange-400">🌙 Evening</td><td className="px-2 py-1"><input type="number" step="0.1" className="input text-center" value={form.eveningYield} onChange={e => setForm({ ...form, eveningYield: e.target.value })} placeholder="0" /></td><td className="px-2 py-1"><input type="number" step="0.1" className="input text-center" value={form.eveningFat} onChange={e => setForm({ ...form, eveningFat: e.target.value })} placeholder="3.5" /></td><td className="px-2 py-1"><input type="number" step="0.1" className="input text-center" value={form.eveningSNF} onChange={e => setForm({ ...form, eveningSNF: e.target.value })} placeholder="8.5" /></td></tr>
                  </tbody>
                </table>
              </div>

              {/* Mobile stacked layout */}
              <div className="sm:hidden space-y-3">
                <div className="bg-blue-50 dark:bg-blue-900/10 rounded-xl p-3">
                  <p className="font-medium text-blue-700 dark:text-blue-400 text-sm mb-2">☀️ Morning</p>
                  <div className="grid grid-cols-3 gap-2">
                    <div><label className="text-[10px] text-gray-500">Yield (L)</label><input type="number" step="0.1" className="input text-center text-sm" value={form.morningYield} onChange={e => setForm({ ...form, morningYield: e.target.value })} placeholder="0" /></div>
                    <div><label className="text-[10px] text-gray-500">Fat %</label><input type="number" step="0.1" className="input text-center text-sm" value={form.morningFat} onChange={e => setForm({ ...form, morningFat: e.target.value })} placeholder="3.5" /></div>
                    <div><label className="text-[10px] text-gray-500">SNF %</label><input type="number" step="0.1" className="input text-center text-sm" value={form.morningSNF} onChange={e => setForm({ ...form, morningSNF: e.target.value })} placeholder="8.5" /></div>
                  </div>
                </div>
                <div className="bg-amber-50 dark:bg-amber-900/10 rounded-xl p-3">
                  <p className="font-medium text-amber-700 dark:text-amber-400 text-sm mb-2">🕐 Afternoon</p>
                  <div className="grid grid-cols-3 gap-2">
                    <div><label className="text-[10px] text-gray-500">Yield (L)</label><input type="number" step="0.1" className="input text-center text-sm" value={form.afternoonYield} onChange={e => setForm({ ...form, afternoonYield: e.target.value })} placeholder="0" /></div>
                    <div><label className="text-[10px] text-gray-500">Fat %</label><input type="number" step="0.1" className="input text-center text-sm" value={form.afternoonFat} onChange={e => setForm({ ...form, afternoonFat: e.target.value })} placeholder="3.5" /></div>
                    <div><label className="text-[10px] text-gray-500">SNF %</label><input type="number" step="0.1" className="input text-center text-sm" value={form.afternoonSNF} onChange={e => setForm({ ...form, afternoonSNF: e.target.value })} placeholder="8.5" /></div>
                  </div>
                </div>
                <div className="bg-orange-50 dark:bg-orange-900/10 rounded-xl p-3">
                  <p className="font-medium text-orange-700 dark:text-orange-400 text-sm mb-2">🌙 Evening</p>
                  <div className="grid grid-cols-3 gap-2">
                    <div><label className="text-[10px] text-gray-500">Yield (L)</label><input type="number" step="0.1" className="input text-center text-sm" value={form.eveningYield} onChange={e => setForm({ ...form, eveningYield: e.target.value })} placeholder="0" /></div>
                    <div><label className="text-[10px] text-gray-500">Fat %</label><input type="number" step="0.1" className="input text-center text-sm" value={form.eveningFat} onChange={e => setForm({ ...form, eveningFat: e.target.value })} placeholder="3.5" /></div>
                    <div><label className="text-[10px] text-gray-500">SNF %</label><input type="number" step="0.1" className="input text-center text-sm" value={form.eveningSNF} onChange={e => setForm({ ...form, eveningSNF: e.target.value })} placeholder="8.5" /></div>
                  </div>
                </div>
              </div>

              {formTotal > 0 && <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-3 text-center"><span className="text-sm text-emerald-600 font-medium">Total: </span><span className="text-xl font-bold text-emerald-700 dark:text-emerald-400">{formTotal.toFixed(1)} L</span></div>}
            </div>
            <div className="flex justify-end gap-3 pt-2 border-t">
              <button type="button" onClick={() => setRecordModal(false)} className="btn-secondary">Cancel</button>
              <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving...' : editId ? 'Update' : 'Add Record'}</button>
            </div>
          </form>
        </Modal>
        <ConfirmDialog isOpen={confirmDialog.open} onClose={() => setConfirmDialog({ ...confirmDialog, open: false })} title={confirmDialog.title} message={confirmDialog.message} variant={confirmDialog.variant} confirmText={confirmDialog.confirmText || 'Confirm'} onConfirm={confirmDialog.onConfirm} />
      </div>
    );
  }

  // ─── ALL RECORDS VIEW (with filters) ───
  if (showRecords) {
    const totalPages = Math.ceil(recordsTotal / 50);
    return (
      <div className="space-y-4">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <button onClick={() => setShowRecords(false)} className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 dark:text-white"><FiArrowLeft size={20} /></button>
            <div>
              <h1 className="text-2xl font-bold">📋 All Milk Records</h1>
              <p className="text-gray-500 text-sm">Filter and view entire milk production data</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => {
              if (!filteredRecords.length) { toast.error('No records to export'); return; }
              exportCsv({
                filename: 'milk-records-filtered',
                headers: ['Date', 'Tag No', 'Breed', 'Morning (L)', 'Morning Fat%', 'Afternoon (L)', 'Evening (L)', 'Evening Fat%', 'Total (L)'],
                rows: filteredRecords.map(r => [
                  formatDate(r.date), r.cattleId?.tagNumber || '-', r.cattleId?.breed || '-',
                  r.morningYield || 0, r.morningFat || '', r.afternoonYield || 0,
                  r.eveningYield || 0, r.eveningFat || '', r.totalYield || 0,
                ]),
              });
              toast.success('CSV downloaded');
            }} className="btn-secondary flex items-center gap-1 text-xs sm:text-sm"><FiDownload size={14} /> <span className="hidden sm:inline">Export</span> CSV</button>
            <button onClick={handleDownloadReport} className="btn-primary flex items-center gap-1 text-xs sm:text-sm"><FiDownload size={14} /> <span className="hidden sm:inline">Export</span> PDF</button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="card space-y-4">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-400"><FiFilter size={14} /> Filters</div>

          {/* Period + Cattle in a row */}
          <div className="flex flex-col sm:flex-row sm:items-end gap-4">
            {/* Period Buttons */}
            <div className="flex-1">
              <label className="text-xs text-gray-500 dark:text-gray-400 mb-1.5 block">Period</label>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {PERIODS.map(p => (
                  <button key={p.k} onClick={() => handleFilterChange(p.k)} className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition whitespace-nowrap flex-shrink-0 ${filterPeriod === p.k ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700'}`}>{p.l}</button>
                ))}
              </div>
            </div>

            {/* Cattle Filter */}
            <div className="sm:w-64 flex-shrink-0">
              <label className="text-xs text-gray-500 dark:text-gray-400 mb-1.5 block">Cattle</label>
              <select className="input text-sm w-full" value={filterCattle} onChange={e => handleCattleFilter(e.target.value)}>
                <option value="">All Cattle</option>
                {allCattle.map(c => <option key={c._id} value={c._id}>Tag No {c.tagNumber} — {c.breed}</option>)}
              </select>
            </div>
          </div>

          {/* Custom Date Range */}
          {filterPeriod === 'custom' && (
            <div className="flex items-end gap-3 flex-wrap">
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">From</label>
                <input type="date" className="input text-sm" value={customStart} onChange={e => setCustomStart(e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">To</label>
                <input type="date" className="input text-sm" value={customEnd} onChange={e => setCustomEnd(e.target.value)} />
              </div>
              <button onClick={handleCustomApply} className="btn-primary text-sm">Apply</button>
            </div>
          )}
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-blue-50 rounded-lg p-3 text-center"><p className="text-xs text-blue-500">Morning</p><p className="text-xl font-bold text-blue-700">{filteredMorning.toFixed(1)} L</p></div>
          <div className="bg-orange-50 rounded-lg p-3 text-center"><p className="text-xs text-orange-500">Evening</p><p className="text-xl font-bold text-orange-700">{filteredEvening.toFixed(1)} L</p></div>
          <div className="bg-emerald-50 rounded-lg p-3 text-center"><p className="text-xs text-emerald-500">Total</p><p className="text-xl font-bold text-emerald-700">{filteredTotal.toFixed(1)} L</p></div>
          <div className="bg-gray-50 rounded-lg p-3 text-center"><p className="text-xs text-gray-500">Records</p><p className="text-xl font-bold">{recordsTotal}</p></div>
        </div>

        {/* Records Table */}
        <div className="card p-0">
          {loadingRecords ? (
            <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div></div>
          ) : filteredRecords.length === 0 ? (
            <div className="text-center py-8 text-gray-400">No records found for selected filters</div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block overflow-auto max-h-[60vh]">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-gray-50 dark:bg-gray-800/50 border-b text-xs text-gray-500 uppercase">
                      <th className="px-3 py-2 text-left">Date</th>
                      <th className="px-2 py-2 text-left">Tag No</th>
                      <th className="px-2 py-2 text-center text-blue-600">Morning</th>
                      <th className="px-2 py-2 text-center text-orange-600">Evening</th>
                      <th className="px-3 py-2 text-center text-emerald-600">Total</th>
                      <th className="px-2 py-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRecords.map((r, i) => (
                      <tr key={r._id} className={`border-b hover:bg-gray-50 dark:hover:bg-gray-800/30 ${i % 2 === 0 ? '' : 'bg-gray-50/50 dark:bg-gray-800/20'}`}>
                        <td className="px-3 py-2 text-gray-600 dark:text-gray-400 whitespace-nowrap">{formatDate(r.date)}</td>
                        <td className="px-2 py-2 font-mono font-medium">{'Tag No ' + (r.cattleId?.tagNumber || '-')} <span className="text-xs text-gray-400 font-normal">{r.cattleId?.breed || ''}</span></td>
                        <td className="px-2 py-2 text-center">{r.morningYield > 0 ? <span>{r.morningYield.toFixed(1)}L {r.morningFat ? <span className="text-xs text-gray-400">({r.morningFat}%)</span> : ''}</span> : <span className="text-gray-300">-</span>}</td>
                        <td className="px-2 py-2 text-center">{r.eveningYield > 0 ? <span>{r.eveningYield.toFixed(1)}L {r.eveningFat ? <span className="text-xs text-gray-400">({r.eveningFat}%)</span> : ''}</span> : <span className="text-gray-300">-</span>}</td>
                        <td className="px-3 py-2 text-center font-bold text-emerald-600">{r.totalYield.toFixed(1)}L</td>
                        <td className="px-2 py-2 whitespace-nowrap">
                          <button onClick={() => handleDeleteRecord(r._id)} className="text-red-400 hover:text-red-600 text-xs">Delete</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden divide-y divide-gray-100 dark:divide-gray-800">
                {filteredRecords.map(r => (
                  <div key={r._id} className="p-3 hover:bg-gray-50 dark:hover:bg-gray-800/30">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{formatDate(r.date)}</span>
                      <span className="text-lg font-bold text-emerald-600">{r.totalYield.toFixed(1)}L</span>
                    </div>
                    <p className="text-xs text-gray-500 mb-2">Tag No {r.cattleId?.tagNumber || '-'} • {r.cattleId?.breed || '-'}</p>
                    <div className="grid grid-cols-2 gap-2 text-center">
                      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg py-1.5 px-1">
                        <p className="text-[10px] text-blue-500 font-medium">Morning</p>
                        <p className="text-sm font-semibold text-blue-700 dark:text-blue-300">{r.morningYield > 0 ? r.morningYield.toFixed(1) + 'L' : '-'}</p>
                        {r.morningFat > 0 && <p className="text-[10px] text-gray-400">Fat {r.morningFat}%</p>}
                      </div>
                      <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg py-1.5 px-1">
                        <p className="text-[10px] text-orange-500 font-medium">Evening</p>
                        <p className="text-sm font-semibold text-orange-700 dark:text-orange-300">{r.eveningYield > 0 ? r.eveningYield.toFixed(1) + 'L' : '-'}</p>
                        {r.eveningFat > 0 && <p className="text-[10px] text-gray-400">Fat {r.eveningFat}%</p>}
                      </div>
                    </div>
                    <div className="flex justify-end mt-2">
                      <button onClick={() => handleDeleteRecord(r._id)} className="text-red-400 text-xs font-medium">🗑️ Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            </>
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
        <ConfirmDialog isOpen={confirmDialog.open} onClose={() => setConfirmDialog({ ...confirmDialog, open: false })} title={confirmDialog.title} message={confirmDialog.message} variant={confirmDialog.variant} confirmText={confirmDialog.confirmText || 'Confirm'} onConfirm={confirmDialog.onConfirm} />
      </div>
    );
  }

  // ─── MAIN VIEW ───
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold">🥛 Milk Records</h1>
            <p className="text-gray-500 text-xs sm:text-sm">Manage daily milk production</p>
          </div>
          <button onClick={() => setAddCattleModal(true)} className="btn-primary flex items-center gap-1.5 flex-shrink-0 text-sm"><FiPlus size={16} /> <span className="hidden sm:inline">Add Cattle</span><span className="sm:hidden">Add</span></button>
        </div>
        <div className="grid grid-cols-3 sm:flex gap-2">
          <button onClick={() => {
            if (!milkCattle?.length) { toast.error('No cattle to export'); return; }
            exportCsv({
              filename: 'milk-records-today',
              headers: ['Tag No', 'Breed', 'Morning (L)', 'Morning Fat%', 'Morning SNF%', 'Evening (L)', 'Evening Fat%', 'Evening SNF%', 'Total (L)'],
              rows: milkCattle.map(c => {
                const rec = lastRecords[c._id];
                return [
                  c.tagNumber, c.breed,
                  rec?.morningYield || 0, rec?.morningFat || '', rec?.morningSNF || '',
                  rec?.eveningYield || 0, rec?.eveningFat || '', rec?.eveningSNF || '',
                  rec?.totalYield || 0,
                ];
              }),
            });
            toast.success('CSV downloaded');
          }} className="btn-secondary flex items-center justify-center gap-1 text-xs">📊 CSV</button>
          <button onClick={() => {
            if (!milkCattle?.length) { toast.error('No cattle to export'); return; }
            const totalMilk = milkCattle.reduce((s, c) => s + (lastRecords[c._id]?.totalYield || 0), 0);
            const recorded = milkCattle.filter(c => lastRecords[c._id]).length;
            exportPdf({
              title: "Today's Milk Records",
              period: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }),
              summaryCards: [
                { label: 'Total Yield', value: totalMilk.toFixed(1) + ' L' },
                { label: 'Cattle Recorded', value: `${recorded}/${milkCattle.length}` },
                { label: 'Avg per Cattle', value: (recorded > 0 ? (totalMilk / recorded).toFixed(1) : '0') + ' L' },
              ],
              tableHeaders: ['Tag No', 'Breed', 'Morning (L)', 'Fat%', 'Evening (L)', 'Fat%', 'Total (L)', 'Status'],
              tableRows: milkCattle.map(c => {
                const rec = lastRecords[c._id];
                return [
                  c.tagNumber, c.breed,
                  rec?.morningYield?.toFixed(1) || '-', rec?.morningFat || '-',
                  rec?.eveningYield?.toFixed(1) || '-', rec?.eveningFat || '-',
                  rec?.totalYield?.toFixed(1) || '-',
                  rec ? '✓ Done' : 'Pending',
                ];
              }),
            });
          }} className="btn-secondary flex items-center justify-center gap-1 text-xs">📄 PDF</button>
          <button onClick={() => setCalcModal(true)} className="btn-secondary flex items-center justify-center gap-1 text-xs sm:text-sm">💰 Calculator</button>
          <button onClick={openBulkEntry} disabled={!milkCattle.length} className="btn-secondary flex items-center justify-center gap-1 text-xs sm:text-sm">📝 Bulk Entry</button>
          <button onClick={openRecordsView} className="btn-secondary flex items-center justify-center gap-1 text-xs sm:text-sm"><FiFilter size={14} /> All Records</button>
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
        <div className="card p-0 overflow-hidden">
          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto overflow-y-auto max-h-[60vh]">
            <table className="w-full text-sm min-w-[700px]">
              <thead className="sticky top-0 z-10">
                <tr className="bg-gray-50 dark:bg-gray-800/50 border-b text-xs text-gray-500 uppercase">
                  <th className="px-3 py-2 text-left">Tag No</th>
                  <th className="px-2 py-2 text-left">Breed</th>
                  <th className="px-2 py-2 text-center bg-blue-50 dark:bg-blue-900/20 text-blue-600">Morning</th>
                  <th className="px-2 py-2 text-center bg-orange-50 dark:bg-orange-900/20 text-orange-600">Evening</th>
                  <th className="px-3 py-2 text-center text-emerald-600">Total</th>
                  <th className="px-2 py-2 text-center">Status</th>
                  <th className="px-2 py-2 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {milkCattle.map((c, i) => {
                  const rec = lastRecords[c._id];
                  const hasToday = !!rec;
                  return (
                    <tr key={c._id} className={`border-b ${i % 2 === 0 ? 'bg-white dark:bg-transparent' : 'bg-gray-50/50 dark:bg-gray-800/20'}`}>
                      <td className="px-3 py-2 font-mono font-medium dark:text-white whitespace-nowrap">Tag No {c.tagNumber}</td>
                      <td className="px-2 py-2 text-gray-500 text-xs">{c.breed}</td>
                      <td className="px-2 py-2 text-center">{hasToday && rec.morningYield > 0 ? <span>{rec.morningYield.toFixed(1)}L {rec.morningFat ? <span className="text-[10px] text-gray-400">({rec.morningFat}%)</span> : ''}</span> : <span className="text-gray-300">-</span>}</td>
                      <td className="px-2 py-2 text-center">{hasToday && rec.eveningYield > 0 ? <span>{rec.eveningYield.toFixed(1)}L {rec.eveningFat ? <span className="text-[10px] text-gray-400">({rec.eveningFat}%)</span> : ''}</span> : <span className="text-gray-300">-</span>}</td>
                      <td className="px-3 py-2 text-center font-bold text-emerald-600">{hasToday ? rec.totalYield?.toFixed(1) + 'L' : '-'}</td>
                      <td className="px-2 py-2 text-center">
                        {hasToday ? (
                          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-xs font-medium">✓ Done</span>
                        ) : (
                          <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium">Pending</span>
                        )}
                      </td>
                      <td className="px-2 py-2">
                        <div className="flex gap-1.5 justify-center">
                          {!hasToday && <button onClick={() => openAddRecord(c)} className="text-emerald-600 hover:text-emerald-800 text-xs font-medium">Add</button>}
                          <button onClick={() => openHistory(c)} className="text-blue-600 hover:text-blue-800 text-xs">View</button>
                          <button onClick={() => handleSharePdf(c)} className="text-purple-600 hover:text-purple-800 text-xs">PDF</button>
                          <button onClick={() => handleRemoveCattle(c._id)} className="text-red-500 hover:text-red-700 text-xs">Del</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden divide-y divide-gray-100 dark:divide-gray-800">
            {milkCattle.map(c => {
              const rec = lastRecords[c._id];
              const hasToday = !!rec;
              return (
                <div key={c._id} className="p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="font-mono font-semibold text-sm dark:text-white">Tag No {c.tagNumber}</p>
                      <p className="text-xs text-gray-400">{c.breed}</p>
                    </div>
                    <div className="text-right">
                      {hasToday ? (
                        <span className="text-lg font-bold text-emerald-600">{rec.totalYield?.toFixed(1)}L</span>
                      ) : (
                        <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium">Pending</span>
                      )}
                    </div>
                  </div>
                  {hasToday && (
                    <div className="grid grid-cols-2 gap-2 mb-2">
                      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg py-1.5 px-2 text-center">
                        <p className="text-[10px] text-blue-500 font-medium">Morning</p>
                        <p className="text-sm font-semibold text-blue-700 dark:text-blue-300">{rec.morningYield > 0 ? rec.morningYield.toFixed(1) + 'L' : '-'}</p>
                        {rec.morningFat > 0 && <p className="text-[10px] text-gray-400">Fat {rec.morningFat}%</p>}
                      </div>
                      <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg py-1.5 px-2 text-center">
                        <p className="text-[10px] text-orange-500 font-medium">Evening</p>
                        <p className="text-sm font-semibold text-orange-700 dark:text-orange-300">{rec.eveningYield > 0 ? rec.eveningYield.toFixed(1) + 'L' : '-'}</p>
                        {rec.eveningFat > 0 && <p className="text-[10px] text-gray-400">Fat {rec.eveningFat}%</p>}
                      </div>
                    </div>
                  )}
                  <div className="flex gap-2 flex-wrap">
                    {!hasToday && <button onClick={() => openAddRecord(c)} className="text-emerald-600 text-xs font-medium">➕ Add</button>}
                    <button onClick={() => openHistory(c)} className="text-blue-600 text-xs font-medium">📋 View</button>
                    <button onClick={() => handleSharePdf(c)} className="text-purple-600 text-xs font-medium">📄 PDF</button>
                    <button onClick={() => handleRemoveCattle(c._id)} className="text-red-500 text-xs font-medium ml-auto">🗑️ Remove</button>
                  </div>
                </div>
              );
            })}
          </div>
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
          <div className="space-y-4">
              {/* Desktop table */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-sm border rounded-lg overflow-hidden">
                  <thead><tr className="bg-gray-50 dark:bg-gray-800"><th className="px-3 py-2 text-left text-xs text-gray-500 uppercase">Session</th><th className="px-3 py-2 text-center text-xs text-gray-500 uppercase">Yield (L) *</th><th className="px-3 py-2 text-center text-xs text-gray-500 uppercase">Fat %</th><th className="px-3 py-2 text-center text-xs text-gray-500 uppercase">SNF %</th></tr></thead>
                  <tbody>
                    <tr className="bg-blue-50/50 dark:bg-blue-900/10 border-b"><td className="px-3 py-2 font-medium text-blue-700 dark:text-blue-400">☀️ Morning</td><td className="px-2 py-1"><input type="number" step="0.1" className="input text-center" value={form.morningYield} onChange={e => setForm({ ...form, morningYield: e.target.value })} placeholder="0" /></td><td className="px-2 py-1"><input type="number" step="0.1" className="input text-center" value={form.morningFat} onChange={e => setForm({ ...form, morningFat: e.target.value })} placeholder="3.5" /></td><td className="px-2 py-1"><input type="number" step="0.1" className="input text-center" value={form.morningSNF} onChange={e => setForm({ ...form, morningSNF: e.target.value })} placeholder="8.5" /></td></tr>
                    <tr className="bg-amber-50/50 dark:bg-amber-900/10 border-b"><td className="px-3 py-2 font-medium text-amber-700 dark:text-amber-400">🕐 Afternoon</td><td className="px-2 py-1"><input type="number" step="0.1" className="input text-center" value={form.afternoonYield} onChange={e => setForm({ ...form, afternoonYield: e.target.value })} placeholder="0" /></td><td className="px-2 py-1"><input type="number" step="0.1" className="input text-center" value={form.afternoonFat} onChange={e => setForm({ ...form, afternoonFat: e.target.value })} placeholder="3.5" /></td><td className="px-2 py-1"><input type="number" step="0.1" className="input text-center" value={form.afternoonSNF} onChange={e => setForm({ ...form, afternoonSNF: e.target.value })} placeholder="8.5" /></td></tr>
                    <tr className="bg-orange-50/50 dark:bg-orange-900/10 border-b"><td className="px-3 py-2 font-medium text-orange-700 dark:text-orange-400">🌙 Evening</td><td className="px-2 py-1"><input type="number" step="0.1" className="input text-center" value={form.eveningYield} onChange={e => setForm({ ...form, eveningYield: e.target.value })} placeholder="0" /></td><td className="px-2 py-1"><input type="number" step="0.1" className="input text-center" value={form.eveningFat} onChange={e => setForm({ ...form, eveningFat: e.target.value })} placeholder="3.5" /></td><td className="px-2 py-1"><input type="number" step="0.1" className="input text-center" value={form.eveningSNF} onChange={e => setForm({ ...form, eveningSNF: e.target.value })} placeholder="8.5" /></td></tr>
                  </tbody>
                </table>
              </div>

              {/* Mobile stacked layout */}
              <div className="sm:hidden space-y-3">
                <div className="bg-blue-50 dark:bg-blue-900/10 rounded-xl p-3">
                  <p className="font-medium text-blue-700 dark:text-blue-400 text-sm mb-2">☀️ Morning</p>
                  <div className="grid grid-cols-3 gap-2">
                    <div><label className="text-[10px] text-gray-500">Yield (L)</label><input type="number" step="0.1" className="input text-center text-sm" value={form.morningYield} onChange={e => setForm({ ...form, morningYield: e.target.value })} placeholder="0" /></div>
                    <div><label className="text-[10px] text-gray-500">Fat %</label><input type="number" step="0.1" className="input text-center text-sm" value={form.morningFat} onChange={e => setForm({ ...form, morningFat: e.target.value })} placeholder="3.5" /></div>
                    <div><label className="text-[10px] text-gray-500">SNF %</label><input type="number" step="0.1" className="input text-center text-sm" value={form.morningSNF} onChange={e => setForm({ ...form, morningSNF: e.target.value })} placeholder="8.5" /></div>
                  </div>
                </div>
                <div className="bg-amber-50 dark:bg-amber-900/10 rounded-xl p-3">
                  <p className="font-medium text-amber-700 dark:text-amber-400 text-sm mb-2">🕐 Afternoon</p>
                  <div className="grid grid-cols-3 gap-2">
                    <div><label className="text-[10px] text-gray-500">Yield (L)</label><input type="number" step="0.1" className="input text-center text-sm" value={form.afternoonYield} onChange={e => setForm({ ...form, afternoonYield: e.target.value })} placeholder="0" /></div>
                    <div><label className="text-[10px] text-gray-500">Fat %</label><input type="number" step="0.1" className="input text-center text-sm" value={form.afternoonFat} onChange={e => setForm({ ...form, afternoonFat: e.target.value })} placeholder="3.5" /></div>
                    <div><label className="text-[10px] text-gray-500">SNF %</label><input type="number" step="0.1" className="input text-center text-sm" value={form.afternoonSNF} onChange={e => setForm({ ...form, afternoonSNF: e.target.value })} placeholder="8.5" /></div>
                  </div>
                </div>
                <div className="bg-orange-50 dark:bg-orange-900/10 rounded-xl p-3">
                  <p className="font-medium text-orange-700 dark:text-orange-400 text-sm mb-2">🌙 Evening</p>
                  <div className="grid grid-cols-3 gap-2">
                    <div><label className="text-[10px] text-gray-500">Yield (L)</label><input type="number" step="0.1" className="input text-center text-sm" value={form.eveningYield} onChange={e => setForm({ ...form, eveningYield: e.target.value })} placeholder="0" /></div>
                    <div><label className="text-[10px] text-gray-500">Fat %</label><input type="number" step="0.1" className="input text-center text-sm" value={form.eveningFat} onChange={e => setForm({ ...form, eveningFat: e.target.value })} placeholder="3.5" /></div>
                    <div><label className="text-[10px] text-gray-500">SNF %</label><input type="number" step="0.1" className="input text-center text-sm" value={form.eveningSNF} onChange={e => setForm({ ...form, eveningSNF: e.target.value })} placeholder="8.5" /></div>
                  </div>
                </div>
              </div>

              {formTotal > 0 && <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-3 text-center"><span className="text-sm text-emerald-600 font-medium">Total: </span><span className="text-xl font-bold text-emerald-700 dark:text-emerald-400">{formTotal.toFixed(1)} L</span></div>}
            </div>
          <div className="flex justify-end gap-3 pt-2 border-t">
            <button type="button" onClick={() => setRecordModal(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving...' : editId ? 'Update' : 'Add Record'}</button>
          </div>
        </form>
      </Modal>

      {/* Milk Rate Calculator Modal */}
      <Modal isOpen={calcModal} onClose={() => { setCalcModal(false); setCalcResult(null); }} title="💰 Milk Rate Calculator" size="lg">
        <div className="space-y-4">
          <p className="text-sm text-gray-500">Calculate milk payment based on fat% and SNF% (Indian dairy cooperative formula)</p>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Quantity (Liters) *</label><input type="number" step="0.1" className="input" value={calcForm.quantity} onChange={e => setCalcForm({ ...calcForm, quantity: e.target.value })} placeholder="e.g., 10" /></div>
            <div><label className="label">Fat % *</label><input type="number" step="0.1" className="input" value={calcForm.fat} onChange={e => setCalcForm({ ...calcForm, fat: e.target.value })} placeholder="e.g., 4.5" /></div>
            <div><label className="label">SNF %</label><input type="number" step="0.1" className="input" value={calcForm.snf} onChange={e => setCalcForm({ ...calcForm, snf: e.target.value })} placeholder="e.g., 8.5" /></div>
            <div><label className="label">Rate per Fat (₹)</label><input type="number" step="0.1" className="input" value={calcForm.ratePerFat} onChange={e => setCalcForm({ ...calcForm, ratePerFat: e.target.value })} placeholder="7.5" /></div>
          </div>
          <button onClick={async () => {
            if (!calcForm.quantity || !calcForm.fat) { toast.error('Enter quantity and fat%'); return; }
            setCalculating(true);
            try {
              const res = await api.post('/milk/calculate-rate', {
                quantity: parseFloat(calcForm.quantity),
                fat: parseFloat(calcForm.fat),
                snf: calcForm.snf ? parseFloat(calcForm.snf) : undefined,
                ratePerFat: parseFloat(calcForm.ratePerFat) || 7.5,
              });
              setCalcResult(res.data.data);
            } catch { toast.error('Calculation failed'); }
            finally { setCalculating(false); }
          }} disabled={calculating} className="btn-primary w-full">{calculating ? 'Calculating...' : 'Calculate Payment'}</button>

          {calcResult && (
            <div className="space-y-3 pt-3 border-t">
              <h4 className="font-semibold text-gray-700 dark:text-gray-300">Payment Estimates:</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-4">
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Fat-Based Method</p>
                  <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">₹{calcResult.fatBased.amount.toLocaleString('en-IN')}</p>
                  <p className="text-xs text-gray-500 mt-1">{calcResult.quantity}L × {calcResult.fat}% × ₹{calcResult.fatBased.ratePerFat}/fat</p>
                </div>
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4">
                  <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">TS-Based Method</p>
                  <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">₹{calcResult.tsBased.amount.toLocaleString('en-IN')}</p>
                  <p className="text-xs text-gray-500 mt-1">TS: {calcResult.tsBased.ts}% → ₹{calcResult.tsBased.ratePerLiter}/L</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </Modal>
      <ConfirmDialog isOpen={confirmDialog.open} onClose={() => setConfirmDialog({ ...confirmDialog, open: false })} title={confirmDialog.title} message={confirmDialog.message} variant={confirmDialog.variant} confirmText={confirmDialog.confirmText || 'Confirm'} onConfirm={confirmDialog.onConfirm} />
    </div>
  );
}
