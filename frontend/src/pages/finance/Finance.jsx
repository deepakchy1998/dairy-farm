import { useState, useEffect } from 'react';
import api from '../../utils/api';
import { formatDate, formatCurrency } from '../../utils/helpers';
import Modal from '../../components/Modal';
import Pagination from '../../components/Pagination';
import { FiPlus, FiEdit2, FiTrash2, FiTrendingUp, FiTrendingDown, FiDownload, FiFileText, FiLayers, FiPieChart } from 'react-icons/fi';
import ConfirmDialog from '../../components/ConfirmDialog';
import { FaIndianRupeeSign } from 'react-icons/fa6';
import DateRangeFilter, { getDateRange } from '../../components/DateRangeFilter';
import { exportPdf } from '../../utils/exportPdf';
import { exportCsv } from '../../utils/exportCsv';
import { useAppConfig } from '../../context/AppConfigContext';
import toast from 'react-hot-toast';

const milkSaleTypes = ['retail', 'dairy', 'other'];
const defaultForm = { date: new Date().toISOString().slice(0, 10), category: '', description: '', amount: '', milkSaleType: '', milkQuantity: '', milkRate: '' };

export default function Finance() {
  const { expenseCategories: expCategories, revenueCategories: revCategories } = useAppConfig();
  const [tab, setTab] = useState('expense');
  const [records, setRecords] = useState([]);
  const [pagination, setPagination] = useState({});
  const [loading, setLoading] = useState(true);
  const initRange = getDateRange('monthly');
  const [filters, setFilters] = useState({ category: '', startDate: initRange.startDate, endDate: initRange.endDate, page: 1 });
  const [period, setPeriod] = useState('monthly');
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ ...defaultForm });
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [summary, setSummary] = useState({ total: 0, count: 0, byCategory: {} });
  const [confirmDialog, setConfirmDialog] = useState({ open: false, title: '', message: '', onConfirm: null, variant: 'danger', confirmText: 'Confirm' });

  const endpoint = tab === 'expense' ? '/expense' : '/revenue';
  const cats = tab === 'expense' ? expCategories : revCategories;

  const fetchData = () => {
    setLoading(true);
    const params = { ...filters, limit: 500 };
    Object.keys(params).forEach(k => { if (!params[k]) delete params[k]; });
    api.get(endpoint, { params }).then(r => {
      const data = r.data.data;
      setRecords(data);
      setPagination(r.data.pagination);
      const total = data.reduce((s, r) => s + (r.amount || 0), 0);
      const byCategory = {};
      data.forEach(r => { byCategory[r.category] = (byCategory[r.category] || 0) + (r.amount || 0); });
      setSummary({ total, count: data.length, byCategory });
    }).catch(() => toast.error('Failed')).finally(() => setLoading(false));
  };
  useEffect(() => { fetchData(); }, [filters, tab]);

  const isMilkSale = tab === 'revenue' && form.category === 'milk_sale';

  useEffect(() => {
    if (isMilkSale && form.milkQuantity && form.milkRate) {
      setForm(prev => ({ ...prev, amount: (parseFloat(prev.milkQuantity) * parseFloat(prev.milkRate)).toFixed(2) }));
    }
  }, [form.milkQuantity, form.milkRate, form.category]);

  const handleSubmit = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      const payload = { ...form };
      if (!isMilkSale) { delete payload.milkSaleType; delete payload.milkQuantity; delete payload.milkRate; }
      if (editId) { await api.put(`${endpoint}/${editId}`, payload); toast.success('Updated'); }
      else { await api.post(endpoint, payload); toast.success('Record added'); }
      setModalOpen(false); setForm({ ...defaultForm }); setEditId(null); fetchData();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); } finally { setSaving(false); }
  };

  const handleEdit = (r) => {
    setForm({ date: r.date?.slice(0, 10), category: r.category, description: r.description || '', amount: r.amount, milkSaleType: r.milkSaleType || '', milkQuantity: r.milkQuantity || '', milkRate: r.milkRate || '' });
    setEditId(r._id); setModalOpen(true);
  };

  const handleDelete = async (id) => {
    setConfirmDialog({ open: true, title: 'Delete Record?', message: 'This will permanently delete this finance record.', variant: 'danger', confirmText: 'Delete', onConfirm: async () => {
      try { await api.delete(`${endpoint}/${id}`); toast.success('Deleted'); fetchData(); } catch { toast.error('Failed'); }
    }});
  };

  const catBadgeColor = (cat) => {
    const map = { feed: 'emerald', medicine: 'red', equipment: 'blue', salary: 'amber', transport: 'violet', milk_sale: 'green', cattle_sale: 'orange', manure_sale: 'lime' };
    const c = map[cat] || 'gray';
    return `bg-${c}-100 text-${c}-700 dark:bg-${c}-900/40 dark:text-${c}-400`;
  };

  const topCats = Object.entries(summary.byCategory).sort((a, b) => b[1] - a[1]).slice(0, 2);
  const summaryCardsData = [
    { label: `Total ${tab === 'revenue' ? 'Revenue' : 'Expenses'}`, value: formatCurrency(summary.total), color: tab === 'revenue' ? 'emerald' : 'red' },
    { label: 'Records', value: summary.count, color: 'blue' },
    ...topCats.map(([cat, amt], i) => ({
      label: cat.replace('_', ' '),
      value: formatCurrency(amt),
      color: i === 0 ? 'purple' : 'amber',
    })),
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Finance 💰</h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm">Track expenses & revenue</p>
          </div>
          <button onClick={() => { setForm({ ...defaultForm, category: cats[0] }); setEditId(null); setModalOpen(true); }} className="btn-primary flex items-center gap-2"><FiPlus size={16} /> Add {tab === 'expense' ? 'Expense' : 'Revenue'}</button>
        </div>
        <div className="flex gap-2">
          <button onClick={() => exportCsv({
            filename: tab === 'expense' ? 'expenses' : 'revenue',
            headers: ['Date', 'Category', 'Description', 'Amount'],
            rows: records.map(r => [formatDate(r.date), r.category?.replace('_', ' '), r.description || '', r.amount || 0]),
          })} className="btn-secondary flex items-center gap-1 text-xs sm:text-sm"><FiFileText size={14} /> <span className="hidden sm:inline">Export</span> CSV</button>
          <button onClick={() => exportPdf({
            title: tab === 'expense' ? 'Expense Report' : 'Revenue Report',
            period: `${filters.startDate || 'All'} to ${filters.endDate || 'Now'}`,
            summaryCards: summaryCardsData.map(s => ({ label: s.label, value: s.value })),
            tableHeaders: ['Date', 'Category', 'Description', 'Amount'],
            tableRows: records.map(r => [formatDate(r.date), r.category?.replace('_', ' '), r.description || (r.milkQuantity ? `${r.milkQuantity}L × ₹${r.milkRate}/L` : '-'), formatCurrency(r.amount)]),
          })} className="btn-secondary flex items-center gap-1 text-xs sm:text-sm"><FiDownload size={14} /> <span className="hidden sm:inline">Export</span> PDF</button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <button onClick={() => { setTab('expense'); setFilters({ ...filters, category: '', page: 1 }); }}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${
            tab === 'expense'
              ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 ring-1 ring-red-200 dark:ring-red-800'
              : 'bg-white dark:bg-gray-900 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-700'
          }`}>
          <FiTrendingDown size={16} className="inline mr-1" /> Expenses
        </button>
        <button onClick={() => { setTab('revenue'); setFilters({ ...filters, category: '', page: 1 }); }}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${
            tab === 'revenue'
              ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 ring-1 ring-emerald-200 dark:ring-emerald-800'
              : 'bg-white dark:bg-gray-900 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-700'
          }`}>
          <FiTrendingUp size={16} className="inline mr-1" /> Revenue
        </button>
      </div>

      {/* Filters */}
      <div className="card !p-4 space-y-3">
        <DateRangeFilter value={period} onChange={({ period: p, startDate, endDate }) => {
          setPeriod(p);
          setFilters({ ...filters, startDate: startDate || '', endDate: endDate || '', page: 1 });
        }} />
        <div>
          <select className="input w-auto" value={filters.category} onChange={e => setFilters({ ...filters, category: e.target.value, page: 1 })}>
            <option value="">All Categories</option>
            {cats.map(c => <option key={c} value={c}>{c.replace('_', ' ')}</option>)}
          </select>
        </div>
      </div>

      {/* Summary Cards */}
      {!loading && records.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {summaryCardsData.map((s, i) => (
            <div key={i} className={`bg-${s.color}-50 dark:bg-${s.color}-900/20 rounded-xl p-3 text-center`}>
              <p className={`text-xs text-${s.color}-500`}>{s.label}</p>
              <p className={`text-2xl font-bold text-${s.color}-700 dark:text-${s.color}-300`}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
          </div>
        ) : records.length === 0 ? (
          <div className="py-8 text-center text-gray-400 text-sm">
            No {tab} records found
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto max-h-[60vh] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-gray-50 dark:bg-gray-800 border-b text-xs text-gray-500 uppercase">
                    <th className="px-4 py-2 text-left">Date</th>
                    <th className="px-3 py-2 text-left">Category</th>
                    <th className="px-3 py-2 text-left">Description</th>
                    <th className="px-3 py-2 text-right">Amount</th>
                    <th className="px-3 py-2 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((r, i) => (
                    <tr key={r._id} className={`border-b ${i % 2 ? 'bg-gray-50/50 dark:bg-gray-800/20' : ''}`}>
                      <td className="px-4 py-2">
                        <span className="text-gray-600 dark:text-gray-400">{formatDate(r.date)}</span>
                      </td>
                      <td className="px-3 py-2">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${catBadgeColor(r.category)}`}>
                          {r.category?.replace('_', ' ')}{r.milkSaleType ? ` · ${r.milkSaleType}` : ''}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        {r.category === 'milk_sale' && r.milkQuantity ? (
                          <span className="text-sm text-gray-600 dark:text-gray-400">
                            {r.milkQuantity}L × ₹{r.milkRate}/L{r.description ? ` · ${r.description}` : ''}
                          </span>
                        ) : (
                          <span className="dark:text-gray-400">{r.description || '-'}</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <span className={`font-bold ${tab === 'revenue' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                          {tab === 'revenue' ? '+' : '-'}{formatCurrency(r.amount)}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex gap-1.5 justify-center">
                          <button onClick={() => handleEdit(r)} className="p-1.5 rounded-lg text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition-colors">
                            <FiEdit2 size={15} />
                          </button>
                          <button onClick={() => handleDelete(r._id)} className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors">
                            <FiTrash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden divide-y dark:divide-gray-800">
              {records.map((r, i) => (
                <div key={r._id} className="p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${catBadgeColor(r.category)}`}>
                        {r.category?.replace('_', ' ')}{r.milkSaleType ? ` · ${r.milkSaleType}` : ''}
                      </span>
                      <span className="text-xs text-gray-400">{formatDate(r.date)}</span>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => handleEdit(r)} className="p-1.5 rounded-lg text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition-colors">
                        <FiEdit2 size={14} />
                      </button>
                      <button onClick={() => handleDelete(r._id)} className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors">
                        <FiTrash2 size={14} />
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {r.category === 'milk_sale' && r.milkQuantity ? (
                        <span>{r.milkQuantity}L × ₹{r.milkRate}/L{r.description ? ` · ${r.description}` : ''}</span>
                      ) : (
                        <span>{r.description || 'No description'}</span>
                      )}
                    </div>
                    <span className={`text-lg font-bold ${tab === 'revenue' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                      {tab === 'revenue' ? '+' : '-'}{formatCurrency(r.amount)}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {pagination.pages > 1 && (
              <div className="p-4 border-t dark:border-gray-800">
                <Pagination 
                  page={pagination.page} 
                  pages={pagination.pages} 
                  total={pagination.total} 
                  onPageChange={p => setFilters({ ...filters, page: p })} 
                />
              </div>
            )}
          </>
        )}
      </div>

      <ConfirmDialog 
        isOpen={confirmDialog.open} 
        onClose={() => setConfirmDialog({ ...confirmDialog, open: false })} 
        title={confirmDialog.title} 
        message={confirmDialog.message} 
        variant={confirmDialog.variant} 
        confirmText={confirmDialog.confirmText || 'Confirm'} 
        onConfirm={confirmDialog.onConfirm} 
      />

      {/* Modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={`${editId ? 'Edit' : 'Add'} ${tab === 'expense' ? 'Expense' : 'Revenue'}`}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Date *</label>
              <input 
                type="date" 
                className="input" 
                required 
                value={form.date} 
                onChange={e => setForm({ ...form, date: e.target.value })} 
              />
            </div>
            <div>
              <label className="label">Category *</label>
              <select 
                className="input" 
                required 
                value={form.category} 
                onChange={e => setForm({ ...form, category: e.target.value, milkSaleType: '', milkQuantity: '', milkRate: '' })}
              >
                <option value="">Select</option>
                {cats.map(c => <option key={c} value={c}>{c.replace('_', ' ')}</option>)}
              </select>
            </div>
          </div>

          {isMilkSale && (
            <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-4 space-y-4">
              <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">🥛 Milk Sale Details</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="label">Sale Type *</label>
                  <select 
                    className="input" 
                    required 
                    value={form.milkSaleType} 
                    onChange={e => setForm({ ...form, milkSaleType: e.target.value })}
                  >
                    <option value="">Select</option>
                    {milkSaleTypes.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Quantity (L) *</label>
                  <input 
                    type="number" 
                    step="0.1" 
                    className="input" 
                    required 
                    placeholder="e.g. 50" 
                    value={form.milkQuantity} 
                    onChange={e => setForm({ ...form, milkQuantity: e.target.value })} 
                  />
                </div>
                <div>
                  <label className="label">Rate (₹/L) *</label>
                  <input 
                    type="number" 
                    step="0.1" 
                    className="input" 
                    required 
                    placeholder="e.g. 60" 
                    value={form.milkRate} 
                    onChange={e => setForm({ ...form, milkRate: e.target.value })} 
                  />
                </div>
              </div>
              {form.milkQuantity && form.milkRate && (
                <div className="text-right">
                  <span className="text-sm text-gray-500 dark:text-gray-400">Total: </span>
                  <span className="text-lg font-bold text-emerald-700 dark:text-emerald-400">
                    ₹{(parseFloat(form.milkQuantity || 0) * parseFloat(form.milkRate || 0)).toLocaleString('en-IN')}
                  </span>
                </div>
              )}
            </div>
          )}

          {!isMilkSale && (
            <div>
              <label className="label">Amount (₹) *</label>
              <input 
                type="number" 
                className="input" 
                required 
                value={form.amount} 
                onChange={e => setForm({ ...form, amount: e.target.value })} 
              />
            </div>
          )}

          <div>
            <label className="label">Description</label>
            <input 
              className="input" 
              placeholder="Optional" 
              value={form.description} 
              onChange={e => setForm({ ...form, description: e.target.value })} 
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Saving...' : editId ? 'Update' : 'Add'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}