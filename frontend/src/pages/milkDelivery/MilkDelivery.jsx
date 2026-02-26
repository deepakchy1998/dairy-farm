import { useState, useEffect, useMemo } from 'react';
import api from '../../utils/api';
import { formatDate, formatCurrency } from '../../utils/helpers';
import { exportCsv } from '../../utils/exportCsv';
import { exportPdf } from '../../utils/exportPdf';
import Modal from '../../components/Modal';
import ConfirmDialog from '../../components/ConfirmDialog';
import toast from 'react-hot-toast';
import {
  FiPlus, FiSearch, FiFilter, FiDownload, FiEdit2, FiTrash2, FiUser,
  FiPhone, FiMapPin, FiCalendar, FiArrowLeft, FiCheck, FiClock, FiDollarSign,
} from 'react-icons/fi';
import { GiMilkCarton } from 'react-icons/gi';
import { FaIndianRupeeSign } from 'react-icons/fa6';
import { useAppConfig } from '../../context/AppConfigContext';

const todayStr = () => new Date().toISOString().slice(0, 10);
const currentMonth = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };

export default function MilkDelivery() {
  const { paymentMethods, milkDeliverySessions } = useAppConfig();
  const [tab, setTab] = useState('daily');
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Daily sheet
  const [dailyDate, setDailyDate] = useState(todayStr());
  const [dailySession, setDailySession] = useState('morning');
  const [sheet, setSheet] = useState([]);
  const [sheetLoading, setSheetLoading] = useState(false);
  const [savingBulk, setSavingBulk] = useState(false);

  // Monthly ledger
  const [ledgerMonth, setLedgerMonth] = useState(currentMonth());
  const [ledger, setLedger] = useState(null);
  const [ledgerLoading, setLedgerLoading] = useState(false);

  // Customer form
  const [custModal, setCustModal] = useState(false);
  const [custForm, setCustForm] = useState({ name: '', phone: '', address: '', village: '', dailyQuantity: '', ratePerLiter: '', deliveryTime: 'morning', notes: '' });
  const [editCustId, setEditCustId] = useState(null);
  const [savingCust, setSavingCust] = useState(false);

  // Payment modal
  const [payModal, setPayModal] = useState(false);
  const [payForm, setPayForm] = useState({ customerId: '', amount: '', method: 'cash', notes: '', date: todayStr() });
  const [savingPay, setSavingPay] = useState(false);

  // Customer detail view
  const [viewCustomer, setViewCustomer] = useState(null);
  const [custHistory, setCustHistory] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');

  // Confirm dialog
  const [confirm, setConfirm] = useState({ open: false, title: '', message: '', onConfirm: null, variant: 'danger' });

  // ─── LOAD CUSTOMERS ───
  const loadCustomers = async () => {
    try {
      const res = await api.get('/milk-delivery/customers', { params: { status: statusFilter || undefined, search: searchQuery || undefined } });
      setCustomers(res.data.data);
    } catch { toast.error('Failed to load customers'); }
    finally { setLoading(false); }
  };
  useEffect(() => { loadCustomers(); }, [statusFilter, searchQuery]);

  // ─── DAILY SHEET ───
  const loadSheet = async () => {
    setSheetLoading(true);
    try {
      const res = await api.get('/milk-delivery/deliveries/daily-sheet', { params: { date: dailyDate, session: dailySession } });
      setSheet(res.data.data.map(s => ({ ...s, _qty: String(s.quantity) })));
    } catch { toast.error('Failed to load daily sheet'); }
    finally { setSheetLoading(false); }
  };
  useEffect(() => { if (tab === 'daily') loadSheet(); }, [tab, dailyDate, dailySession]);

  const updateSheetQty = (idx, val) => {
    setSheet(prev => prev.map((s, i) => i === idx ? { ...s, _qty: val } : s));
  };

  const saveDailySheet = async () => {
    setSavingBulk(true);
    try {
      const entries = sheet.filter(s => s._qty !== '' && Number(s._qty) >= 0).map(s => ({
        customerId: s.customerId,
        quantity: Number(s._qty),
        ratePerLiter: s.ratePerLiter,
      }));
      await api.post('/milk-delivery/deliveries/bulk', { date: dailyDate, session: dailySession, entries });
      toast.success(`Saved ${entries.length} deliveries`);
      loadSheet();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to save'); }
    finally { setSavingBulk(false); }
  };

  // ─── MONTHLY LEDGER ───
  const loadLedger = async () => {
    setLedgerLoading(true);
    try {
      const [y, m] = ledgerMonth.split('-');
      const res = await api.get('/milk-delivery/monthly-ledger', { params: { year: y, month: m } });
      setLedger(res.data.data);
    } catch { toast.error('Failed to load ledger'); }
    finally { setLedgerLoading(false); }
  };
  useEffect(() => { if (tab === 'ledger') loadLedger(); }, [tab, ledgerMonth]);

  // ─── CUSTOMER CRUD ───
  const openAddCustomer = () => {
    setCustForm({ name: '', phone: '', address: '', village: '', dailyQuantity: '', ratePerLiter: '', deliveryTime: 'morning', notes: '' });
    setEditCustId(null);
    setCustModal(true);
  };
  const openEditCustomer = (c) => {
    setCustForm({ name: c.name, phone: c.phone, address: c.address, village: c.village, dailyQuantity: c.dailyQuantity, ratePerLiter: c.ratePerLiter, deliveryTime: c.deliveryTime, notes: c.notes });
    setEditCustId(c._id);
    setCustModal(true);
  };
  const saveCustomer = async (e) => {
    e.preventDefault();
    setSavingCust(true);
    try {
      if (editCustId) {
        await api.put(`/milk-delivery/customers/${editCustId}`, custForm);
        toast.success('Customer updated');
      } else {
        await api.post('/milk-delivery/customers', custForm);
        toast.success('Customer added');
      }
      setCustModal(false);
      loadCustomers();
      if (tab === 'daily') loadSheet();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    finally { setSavingCust(false); }
  };
  const deleteCustomer = (c) => {
    setConfirm({ open: true, title: 'Delete Customer?', message: `Delete "${c.name}" and all their delivery/payment records? This cannot be undone.`, variant: 'danger', onConfirm: async () => {
      try { await api.delete(`/milk-delivery/customers/${c._id}`); toast.success('Deleted'); loadCustomers(); } catch { toast.error('Failed'); }
    }});
  };

  // ─── PAYMENT ───
  const openPayment = (c) => {
    setPayForm({ customerId: c._id, amount: String(c.balance || ''), method: 'cash', notes: '', date: todayStr() });
    setPayModal(true);
  };
  const savePayment = async (e) => {
    e.preventDefault();
    setSavingPay(true);
    try {
      await api.post('/milk-delivery/payments', { ...payForm, month: ledgerMonth });
      toast.success('Payment recorded');
      setPayModal(false);
      loadCustomers();
      if (tab === 'ledger') loadLedger();
      if (viewCustomer) loadCustomerHistory(viewCustomer._id);
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    finally { setSavingPay(false); }
  };

  // ─── CUSTOMER DETAIL ───
  const loadCustomerHistory = async (id) => {
    setHistoryLoading(true);
    try {
      const [y, m] = (ledgerMonth || currentMonth()).split('-');
      const startDate = `${y}-${m}-01`;
      const endDate = new Date(Number(y), Number(m), 0).toISOString().slice(0, 10);
      const res = await api.get(`/milk-delivery/customer-history/${id}`, { params: { startDate, endDate } });
      setCustHistory(res.data.data);
    } catch { toast.error('Failed'); }
    finally { setHistoryLoading(false); }
  };
  const openCustomerDetail = (c) => {
    setViewCustomer(c);
    loadCustomerHistory(c._id);
  };

  // ─── EXPORTS ───
  const exportLedgerCsv = () => {
    if (!ledger?.ledger?.length) { toast.error('No data'); return; }
    exportCsv({
      filename: `milk-ledger-${ledgerMonth}`,
      headers: ['Name', 'Phone', 'Village', 'Daily Qty (L)', 'Rate (₹/L)', 'Total Qty (L)', 'Total Amount (₹)', 'Paid (₹)', 'Due (₹)'],
      rows: ledger.ledger.map(c => [c.name, c.phone, c.village, c.dailyQuantity, c.ratePerLiter, c.totalQuantity.toFixed(1), c.totalAmount.toFixed(0), c.totalPaid.toFixed(0), c.due.toFixed(0)]),
    });
    toast.success('CSV downloaded');
  };

  const exportLedgerPdf = () => {
    if (!ledger?.ledger?.length) { toast.error('No data'); return; }
    const [y, m] = ledgerMonth.split('-');
    const monthName = new Date(y, m - 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
    exportPdf({
      title: `Milk Delivery Ledger — ${monthName}`,
      period: monthName,
      summaryCards: [
        { label: 'Total Customers', value: ledger.totals.totalCustomers },
        { label: 'Total Milk', value: ledger.totals.totalQuantity.toFixed(1) + ' L' },
        { label: 'Total Amount', value: '₹' + ledger.totals.totalAmount.toLocaleString('en-IN') },
        { label: 'Total Paid', value: '₹' + ledger.totals.totalPaid.toLocaleString('en-IN') },
        { label: 'Total Due', value: '₹' + ledger.totals.totalDue.toLocaleString('en-IN') },
      ],
      tableHeaders: ['Name', 'Village', 'Daily Qty', 'Rate', 'Total Qty', 'Amount', 'Paid', 'Due'],
      tableRows: ledger.ledger.map(c => [
        c.name, c.village || '-', c.dailyQuantity + 'L', '₹' + c.ratePerLiter,
        c.totalQuantity.toFixed(1) + 'L', '₹' + c.totalAmount.toFixed(0),
        '₹' + c.totalPaid.toFixed(0), '₹' + c.due.toFixed(0),
      ]),
    });
  };

  const exportCustomerPdf = () => {
    if (!custHistory) return;
    const c = custHistory.customer;
    exportPdf({
      title: `Milk Delivery — ${c.name}`,
      period: ledgerMonth,
      summaryCards: [
        { label: 'Total Milk', value: custHistory.summary.totalQuantity.toFixed(1) + ' L' },
        { label: 'Total Amount', value: '₹' + custHistory.summary.totalAmount.toFixed(0) },
        { label: 'Paid', value: '₹' + custHistory.summary.totalPaid.toFixed(0) },
        { label: 'Due', value: '₹' + custHistory.summary.due.toFixed(0) },
      ],
      tableHeaders: ['Date', 'Session', 'Quantity (L)', 'Rate (₹)', 'Amount (₹)'],
      tableRows: custHistory.deliveries.map(d => [
        formatDate(d.date), d.session === 'morning' ? '☀️ Morning' : '🌙 Evening',
        d.quantity.toFixed(1), d.ratePerLiter.toFixed(1), '₹' + d.amount.toFixed(0),
      ]),
    });
  };

  const exportCustomerCsv = () => {
    if (!custHistory) return;
    exportCsv({
      filename: `milk-delivery-${custHistory.customer.name.replace(/\s+/g, '-')}`,
      headers: ['Date', 'Session', 'Quantity (L)', 'Rate (₹/L)', 'Amount (₹)'],
      rows: custHistory.deliveries.map(d => [
        formatDate(d.date), d.session, d.quantity.toFixed(1), d.ratePerLiter.toFixed(1), d.amount.toFixed(0),
      ]),
    });
    toast.success('CSV downloaded');
  };

  // Daily sheet totals
  const sheetTotal = useMemo(() => {
    const qty = sheet.reduce((s, r) => s + (Number(r._qty) || 0), 0);
    const amt = sheet.reduce((s, r) => s + ((Number(r._qty) || 0) * r.ratePerLiter), 0);
    return { qty, amt };
  }, [sheet]);

  // ═══════════════════════════════════════
  //  CUSTOMER DETAIL VIEW
  // ═══════════════════════════════════════
  if (viewCustomer) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={() => { setViewCustomer(null); setCustHistory(null); }} className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700"><FiArrowLeft size={20} /></button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">{viewCustomer.name}</h1>
            <p className="text-gray-500 text-sm flex items-center gap-3">
              {viewCustomer.phone && <span className="flex items-center gap-1"><FiPhone size={12} /> {viewCustomer.phone}</span>}
              {viewCustomer.village && <span className="flex items-center gap-1"><FiMapPin size={12} /> {viewCustomer.village}</span>}
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={exportCustomerCsv} className="btn-secondary text-xs flex items-center gap-1"><FiDownload size={14} /> CSV</button>
            <button onClick={exportCustomerPdf} className="btn-secondary text-xs flex items-center gap-1"><FiDownload size={14} /> PDF</button>
            <button onClick={() => openPayment(viewCustomer)} className="btn-primary text-sm flex items-center gap-1"><FaIndianRupeeSign size={14} /> Record Payment</button>
          </div>
        </div>

        {/* Customer Info Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3 text-center">
            <p className="text-xs text-blue-500">Daily Qty</p>
            <p className="text-xl font-bold text-blue-700 dark:text-blue-300">{viewCustomer.dailyQuantity} L</p>
          </div>
          <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-3 text-center">
            <p className="text-xs text-emerald-500">Rate</p>
            <p className="text-xl font-bold text-emerald-700 dark:text-emerald-300">₹{viewCustomer.ratePerLiter}/L</p>
          </div>
          <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-3 text-center">
            <p className="text-xs text-amber-500">This Month</p>
            <p className="text-xl font-bold text-amber-700 dark:text-amber-300">{custHistory?.summary?.totalQuantity?.toFixed(1) || '0'} L</p>
          </div>
          <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-3 text-center">
            <p className="text-xs text-red-500">Due</p>
            <p className="text-xl font-bold text-red-700 dark:text-red-300">₹{custHistory?.summary?.due?.toFixed(0) || '0'}</p>
          </div>
        </div>

        {/* Month selector */}
        <div className="flex items-center gap-3">
          <input type="month" className="input w-auto text-sm" value={ledgerMonth} onChange={e => setLedgerMonth(e.target.value)} />
          <button onClick={() => loadCustomerHistory(viewCustomer._id)} className="btn-secondary text-sm">Load</button>
        </div>

        {/* Deliveries Table */}
        <div className="card p-0 overflow-hidden">
          <div className="px-4 py-3 border-b dark:border-gray-800 flex items-center justify-between">
            <h3 className="font-semibold text-sm">Deliveries</h3>
            <span className="text-xs text-gray-400">{custHistory?.deliveries?.length || 0} records</span>
          </div>
          {historyLoading ? (
            <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div></div>
          ) : !custHistory?.deliveries?.length ? (
            <div className="py-8 text-center text-gray-400 text-sm">No deliveries this month</div>
          ) : (
            <>
              <div className="hidden md:block overflow-x-auto max-h-[60vh] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 z-10"><tr className="bg-gray-50 dark:bg-gray-800 border-b text-xs text-gray-500 uppercase">
                    <th className="px-4 py-2 text-left">Date</th>
                    <th className="px-3 py-2 text-center">Session</th>
                    <th className="px-3 py-2 text-center">Qty (L)</th>
                    <th className="px-3 py-2 text-center">Rate (₹)</th>
                    <th className="px-3 py-2 text-center">Amount (₹)</th>
                    <th className="px-3 py-2 text-center">Extra?</th>
                  </tr></thead>
                  <tbody>
                    {custHistory.deliveries.map((d, i) => (
                      <tr key={d._id} className={`border-b ${i % 2 ? 'bg-gray-50/50 dark:bg-gray-800/20' : ''}`}>
                        <td className="px-4 py-2">{formatDate(d.date)}</td>
                        <td className="px-3 py-2 text-center">{d.session === 'morning' ? '☀️' : '🌙'}</td>
                        <td className="px-3 py-2 text-center font-medium">{d.quantity.toFixed(1)}</td>
                        <td className="px-3 py-2 text-center text-gray-500">₹{d.ratePerLiter}</td>
                        <td className="px-3 py-2 text-center font-semibold text-emerald-600">₹{d.amount.toFixed(0)}</td>
                        <td className="px-3 py-2 text-center">{d.isExtra ? <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Extra</span> : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="md:hidden divide-y dark:divide-gray-800">
                {custHistory.deliveries.map(d => (
                  <div key={d._id} className="p-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{formatDate(d.date)} {d.session === 'morning' ? '☀️' : '🌙'}</p>
                      <p className="text-xs text-gray-400">{d.quantity.toFixed(1)}L × ₹{d.ratePerLiter} {d.isExtra ? '• Extra' : ''}</p>
                    </div>
                    <p className="text-lg font-bold text-emerald-600">₹{d.amount.toFixed(0)}</p>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Payments */}
        {custHistory?.payments?.length > 0 && (
          <div className="card p-0 overflow-hidden">
            <div className="px-4 py-3 border-b dark:border-gray-800">
              <h3 className="font-semibold text-sm">Payments Received</h3>
            </div>
            <div className="divide-y dark:divide-gray-800 max-h-[240px] overflow-y-auto">
              {custHistory.payments.map(p => (
                <div key={p._id} className="p-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{formatDate(p.date)}</p>
                    <p className="text-xs text-gray-400 capitalize">{p.method} {p.notes ? `• ${p.notes}` : ''}</p>
                  </div>
                  <p className="text-lg font-bold text-green-600">+ ₹{p.amount.toLocaleString('en-IN')}</p>
                </div>
              ))}
            </div>
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
    { id: 'daily', label: '📅 Daily Entry', icon: FiCalendar },
    { id: 'customers', label: '👥 Customers', icon: FiUser },
    { id: 'ledger', label: '📒 Monthly Ledger', icon: FiDollarSign },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">🏘️ Dudh Khata (Milk Delivery)</h1>
          <p className="text-gray-500 text-sm">Track daily milk delivery to customers & monthly payments</p>
        </div>
        <button onClick={openAddCustomer} className="btn-primary flex items-center gap-2"><FiPlus size={18} /> Add Customer</button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition ${tab === t.id ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 ring-1 ring-emerald-200 dark:ring-emerald-800' : 'bg-white dark:bg-gray-900 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ═══ DAILY ENTRY TAB ═══ */}
      {tab === 'daily' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="flex items-center gap-2">
              <input type="date" className="input text-sm w-auto" value={dailyDate} onChange={e => setDailyDate(e.target.value)} />
              <div className="flex rounded-lg overflow-hidden border border-gray-300 dark:border-gray-700">
                {milkDeliverySessions.map(s => (
                  <button key={s} onClick={() => setDailySession(s)}
                    className={`px-3 py-2 text-sm font-medium transition ${dailySession === s ? 'bg-emerald-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400'}`}>
                    {s === 'morning' ? '☀️ Morning' : '🌙 Evening'}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex-1" />
            <div className="flex items-center gap-3 text-sm">
              <span className="text-gray-500">Total: <strong className="text-emerald-600">{sheetTotal.qty.toFixed(1)} L</strong></span>
              <span className="text-gray-500">Amount: <strong className="text-emerald-600">₹{sheetTotal.amt.toFixed(0)}</strong></span>
            </div>
          </div>

          <div className="card p-0 overflow-hidden">
            {sheetLoading ? (
              <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div></div>
            ) : sheet.length === 0 ? (
              <div className="py-8 text-center text-gray-400">
                <p className="text-lg mb-2">No active customers</p>
                <button onClick={openAddCustomer} className="btn-primary text-sm"><FiPlus size={14} className="inline mr-1" /> Add Customer</button>
              </div>
            ) : (
              <>
                {/* Desktop Table */}
                <div className="hidden md:block overflow-x-auto max-h-[60vh] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 z-10"><tr className="bg-gray-50 dark:bg-gray-800 border-b text-xs text-gray-500 uppercase">
                      <th className="px-4 py-2 text-left">Customer</th>
                      <th className="px-3 py-2 text-left">Village</th>
                      <th className="px-3 py-2 text-center">Fixed (L)</th>
                      <th className="px-3 py-2 text-center">Rate (₹)</th>
                      <th className="px-3 py-2 text-center w-32">Qty (L)</th>
                      <th className="px-3 py-2 text-center">Amount</th>
                      <th className="px-3 py-2 text-center">Status</th>
                    </tr></thead>
                    <tbody>
                      {sheet.map((s, i) => {
                        const amt = (Number(s._qty) || 0) * s.ratePerLiter;
                        return (
                          <tr key={s.customerId} className={`border-b ${i % 2 ? 'bg-gray-50/50 dark:bg-gray-800/20' : ''}`}>
                            <td className="px-4 py-2 font-medium">{s.name} {s.phone && <span className="text-xs text-gray-400 ml-1">{s.phone}</span>}</td>
                            <td className="px-3 py-2 text-gray-500 text-xs">{s.village || '-'}</td>
                            <td className="px-3 py-2 text-center text-gray-400">{s.dailyQuantity}</td>
                            <td className="px-3 py-2 text-center text-gray-400">₹{s.ratePerLiter}</td>
                            <td className="px-3 py-2">
                              <input type="number" step="0.1" min="0" className="input text-center text-sm !py-1" value={s._qty}
                                onChange={e => updateSheetQty(i, e.target.value)} />
                            </td>
                            <td className="px-3 py-2 text-center font-semibold text-emerald-600">₹{amt.toFixed(0)}</td>
                            <td className="px-3 py-2 text-center">
                              {s.recorded ? <span className="text-xs bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 px-2 py-0.5 rounded-full">✓ Saved</span>
                                : <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">Pending</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Cards */}
                <div className="md:hidden divide-y dark:divide-gray-800">
                  {sheet.map((s, i) => {
                    const amt = (Number(s._qty) || 0) * s.ratePerLiter;
                    return (
                      <div key={s.customerId} className="p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-sm">{s.name}</p>
                            <p className="text-xs text-gray-400">{s.village || ''} {s.phone ? `• ${s.phone}` : ''}</p>
                          </div>
                          {s.recorded && <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">✓</span>}
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex-1">
                            <label className="text-[10px] text-gray-400">Qty (L) · Fixed: {s.dailyQuantity}L</label>
                            <input type="number" step="0.1" min="0" className="input text-sm !py-1.5" value={s._qty}
                              onChange={e => updateSheetQty(i, e.target.value)} />
                          </div>
                          <div className="text-right">
                            <label className="text-[10px] text-gray-400">Amount</label>
                            <p className="text-lg font-bold text-emerald-600">₹{amt.toFixed(0)}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Save Button */}
                <div className="p-4 border-t dark:border-gray-800 flex items-center justify-between bg-gray-50 dark:bg-gray-800/30">
                  <div className="text-sm text-gray-500">
                    <strong>{sheet.length}</strong> customers · <strong className="text-emerald-600">{sheetTotal.qty.toFixed(1)} L</strong> · <strong className="text-emerald-600">₹{sheetTotal.amt.toFixed(0)}</strong>
                  </div>
                  <button onClick={saveDailySheet} disabled={savingBulk} className="btn-primary flex items-center gap-2">
                    <FiCheck size={16} /> {savingBulk ? 'Saving...' : 'Save All'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ═══ CUSTOMERS TAB ═══ */}
      {tab === 'customers' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input className="input pl-10 text-sm" placeholder="Search by name, phone, or village..."
                value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
            </div>
            <div className="flex gap-2">
              {['active', 'paused', 'closed', ''].map(s => (
                <button key={s} onClick={() => setStatusFilter(s)}
                  className={`px-3 py-2 rounded-lg text-xs font-medium transition ${statusFilter === s ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400'}`}>
                  {s || 'All'}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div></div>
          ) : customers.length === 0 ? (
            <div className="card text-center py-8 text-gray-400">
              <p className="mb-3">No customers found</p>
              <button onClick={openAddCustomer} className="btn-primary text-sm"><FiPlus size={14} className="inline mr-1" /> Add Customer</button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {customers.map(c => (
                <div key={c._id} className="card !p-4 hover:shadow-md transition-shadow cursor-pointer group" onClick={() => openCustomerDetail(c)}>
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white">{c.name}</h3>
                      <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5">
                        {c.phone && <span className="flex items-center gap-1"><FiPhone size={10} /> {c.phone}</span>}
                        {c.village && <span className="flex items-center gap-1"><FiMapPin size={10} /> {c.village}</span>}
                      </div>
                    </div>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${c.status === 'active' ? 'bg-emerald-100 text-emerald-700' : c.status === 'paused' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-500'}`}>
                      {c.status}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center mb-3">
                    <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-2">
                      <p className="text-[10px] text-blue-500">Daily</p>
                      <p className="text-sm font-bold text-blue-700 dark:text-blue-300">{c.dailyQuantity}L</p>
                    </div>
                    <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-2">
                      <p className="text-[10px] text-emerald-500">Rate</p>
                      <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300">₹{c.ratePerLiter}</p>
                    </div>
                    <div className={`rounded-lg p-2 ${c.balance > 0 ? 'bg-red-50 dark:bg-red-900/20' : 'bg-gray-50 dark:bg-gray-800'}`}>
                      <p className="text-[10px] text-red-500">Due</p>
                      <p className={`text-sm font-bold ${c.balance > 0 ? 'text-red-600' : 'text-gray-400'}`}>₹{(c.balance || 0).toLocaleString('en-IN')}</p>
                    </div>
                  </div>
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition">
                    <button onClick={e => { e.stopPropagation(); openEditCustomer(c); }} className="flex-1 btn-secondary text-xs py-1.5 flex items-center justify-center gap-1"><FiEdit2 size={12} /> Edit</button>
                    <button onClick={e => { e.stopPropagation(); openPayment(c); }} className="flex-1 btn-primary text-xs py-1.5 flex items-center justify-center gap-1"><FaIndianRupeeSign size={12} /> Pay</button>
                    <button onClick={e => { e.stopPropagation(); deleteCustomer(c); }} className="btn-danger text-xs py-1.5 px-2"><FiTrash2 size={14} /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══ MONTHLY LEDGER TAB ═══ */}
      {tab === 'ledger' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <input type="month" className="input w-auto text-sm" value={ledgerMonth} onChange={e => setLedgerMonth(e.target.value)} />
            <button onClick={exportLedgerCsv} className="btn-secondary text-xs flex items-center gap-1"><FiDownload size={14} /> CSV</button>
            <button onClick={exportLedgerPdf} className="btn-secondary text-xs flex items-center gap-1"><FiDownload size={14} /> PDF</button>
          </div>

          {/* Summary Cards */}
          {ledger?.totals && (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3 text-center">
                <p className="text-xs text-blue-500">Customers</p>
                <p className="text-xl font-bold text-blue-700 dark:text-blue-300">{ledger.totals.totalCustomers}</p>
              </div>
              <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-3 text-center">
                <p className="text-xs text-emerald-500">Total Milk</p>
                <p className="text-xl font-bold text-emerald-700 dark:text-emerald-300">{ledger.totals.totalQuantity.toFixed(1)} L</p>
              </div>
              <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-3 text-center">
                <p className="text-xs text-purple-500">Total Amount</p>
                <p className="text-xl font-bold text-purple-700 dark:text-purple-300">₹{ledger.totals.totalAmount.toLocaleString('en-IN')}</p>
              </div>
              <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-3 text-center">
                <p className="text-xs text-green-500">Paid</p>
                <p className="text-xl font-bold text-green-700 dark:text-green-300">₹{ledger.totals.totalPaid.toLocaleString('en-IN')}</p>
              </div>
              <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-3 text-center">
                <p className="text-xs text-red-500">Due</p>
                <p className="text-xl font-bold text-red-700 dark:text-red-300">₹{ledger.totals.totalDue.toLocaleString('en-IN')}</p>
              </div>
            </div>
          )}

          {/* Ledger Table */}
          <div className="card p-0 overflow-hidden">
            {ledgerLoading ? (
              <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div></div>
            ) : !ledger?.ledger?.length ? (
              <div className="py-8 text-center text-gray-400">No data for this month</div>
            ) : (
              <>
                <div className="hidden md:block overflow-x-auto max-h-[60vh] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 z-10"><tr className="bg-gray-50 dark:bg-gray-800 border-b text-xs text-gray-500 uppercase">
                      <th className="px-4 py-2 text-left">Customer</th>
                      <th className="px-3 py-2 text-left">Village</th>
                      <th className="px-3 py-2 text-center">Daily</th>
                      <th className="px-3 py-2 text-center">Rate</th>
                      <th className="px-3 py-2 text-center">Total Qty</th>
                      <th className="px-3 py-2 text-center">Amount</th>
                      <th className="px-3 py-2 text-center">Paid</th>
                      <th className="px-3 py-2 text-center">Due</th>
                      <th className="px-3 py-2">Actions</th>
                    </tr></thead>
                    <tbody>
                      {ledger.ledger.map((c, i) => (
                        <tr key={c._id} className={`border-b hover:bg-gray-50 dark:hover:bg-gray-800/30 cursor-pointer ${i % 2 ? 'bg-gray-50/50 dark:bg-gray-800/20' : ''}`}
                          onClick={() => openCustomerDetail(c)}>
                          <td className="px-4 py-2 font-medium">{c.name} {c.phone && <span className="text-xs text-gray-400 ml-1">{c.phone}</span>}</td>
                          <td className="px-3 py-2 text-gray-500 text-xs">{c.village || '-'}</td>
                          <td className="px-3 py-2 text-center text-gray-400">{c.dailyQuantity}L</td>
                          <td className="px-3 py-2 text-center text-gray-400">₹{c.ratePerLiter}</td>
                          <td className="px-3 py-2 text-center font-medium">{c.totalQuantity.toFixed(1)}L</td>
                          <td className="px-3 py-2 text-center font-semibold">₹{c.totalAmount.toFixed(0)}</td>
                          <td className="px-3 py-2 text-center text-green-600">₹{c.totalPaid.toFixed(0)}</td>
                          <td className={`px-3 py-2 text-center font-bold ${c.due > 0 ? 'text-red-600' : 'text-green-600'}`}>₹{c.due.toFixed(0)}</td>
                          <td className="px-3 py-2" onClick={e => e.stopPropagation()}>
                            <button onClick={() => openPayment(c)} className="text-xs text-emerald-600 hover:underline font-medium">💰 Pay</button>
                          </td>
                        </tr>
                      ))}
                      {/* Totals row */}
                      <tr className="bg-emerald-50 dark:bg-emerald-900/20 font-bold text-sm">
                        <td className="px-4 py-3" colSpan={4}>TOTAL</td>
                        <td className="px-3 py-3 text-center">{ledger.totals.totalQuantity.toFixed(1)}L</td>
                        <td className="px-3 py-3 text-center">₹{ledger.totals.totalAmount.toFixed(0)}</td>
                        <td className="px-3 py-3 text-center text-green-600">₹{ledger.totals.totalPaid.toFixed(0)}</td>
                        <td className="px-3 py-3 text-center text-red-600">₹{ledger.totals.totalDue.toFixed(0)}</td>
                        <td></td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Mobile Cards */}
                <div className="md:hidden divide-y dark:divide-gray-800">
                  {ledger.ledger.map(c => (
                    <div key={c._id} className="p-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/30" onClick={() => openCustomerDetail(c)}>
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <p className="font-semibold text-sm">{c.name}</p>
                          <p className="text-xs text-gray-400">{c.village || ''} {c.phone ? `• ${c.phone}` : ''}</p>
                        </div>
                        <div className="text-right">
                          <p className={`text-lg font-bold ${c.due > 0 ? 'text-red-600' : 'text-green-600'}`}>₹{c.due.toFixed(0)}</p>
                          <p className="text-[10px] text-gray-400">due</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg py-1">
                          <p className="text-[10px] text-blue-500">Qty</p>
                          <p className="text-xs font-bold text-blue-700 dark:text-blue-300">{c.totalQuantity.toFixed(1)}L</p>
                        </div>
                        <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg py-1">
                          <p className="text-[10px] text-purple-500">Amount</p>
                          <p className="text-xs font-bold text-purple-700 dark:text-purple-300">₹{c.totalAmount.toFixed(0)}</p>
                        </div>
                        <div className="bg-green-50 dark:bg-green-900/20 rounded-lg py-1">
                          <p className="text-[10px] text-green-500">Paid</p>
                          <p className="text-xs font-bold text-green-700 dark:text-green-300">₹{c.totalPaid.toFixed(0)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                  {/* Mobile totals */}
                  <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20">
                    <p className="font-bold text-sm mb-2">TOTAL</p>
                    <div className="grid grid-cols-4 gap-2 text-center text-xs">
                      <div><p className="text-gray-500">Milk</p><p className="font-bold">{ledger.totals.totalQuantity.toFixed(1)}L</p></div>
                      <div><p className="text-gray-500">Amount</p><p className="font-bold">₹{ledger.totals.totalAmount.toFixed(0)}</p></div>
                      <div><p className="text-gray-500">Paid</p><p className="font-bold text-green-600">₹{ledger.totals.totalPaid.toFixed(0)}</p></div>
                      <div><p className="text-gray-500">Due</p><p className="font-bold text-red-600">₹{ledger.totals.totalDue.toFixed(0)}</p></div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ═══ MODALS ═══ */}

      {/* Add/Edit Customer Modal */}
      <Modal isOpen={custModal} onClose={() => setCustModal(false)} title={editCustId ? 'Edit Customer' : 'Add Customer'} size="lg">
        <form onSubmit={saveCustomer} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className="label">Name *</label><input className="input" required value={custForm.name} onChange={e => setCustForm({ ...custForm, name: e.target.value })} placeholder="Customer name" /></div>
            <div><label className="label">Phone</label><input className="input" value={custForm.phone} onChange={e => setCustForm({ ...custForm, phone: e.target.value })} placeholder="+91 98765 43210" /></div>
            <div><label className="label">Village</label><input className="input" value={custForm.village} onChange={e => setCustForm({ ...custForm, village: e.target.value })} placeholder="Village name" /></div>
            <div><label className="label">Address</label><input className="input" value={custForm.address} onChange={e => setCustForm({ ...custForm, address: e.target.value })} placeholder="Full address" /></div>
            <div><label className="label">Daily Quantity (L) *</label><input type="number" step="0.1" min="0" className="input" required value={custForm.dailyQuantity} onChange={e => setCustForm({ ...custForm, dailyQuantity: e.target.value })} placeholder="e.g., 2" /></div>
            <div><label className="label">Rate per Liter (₹) *</label><input type="number" step="0.5" min="0" className="input" required value={custForm.ratePerLiter} onChange={e => setCustForm({ ...custForm, ratePerLiter: e.target.value })} placeholder="e.g., 60" /></div>
            <div><label className="label">Delivery Time</label>
              <select className="input" value={custForm.deliveryTime} onChange={e => setCustForm({ ...custForm, deliveryTime: e.target.value })}>
                <option value="morning">☀️ Morning</option><option value="evening">🌙 Evening</option><option value="both">Both</option>
              </select>
            </div>
          </div>
          <div><label className="label">Notes</label><textarea className="input" rows={2} value={custForm.notes} onChange={e => setCustForm({ ...custForm, notes: e.target.value })} placeholder="Any notes..." /></div>
          <div className="flex justify-end gap-3 pt-2 border-t">
            <button type="button" onClick={() => setCustModal(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={savingCust} className="btn-primary">{savingCust ? 'Saving...' : editCustId ? 'Update' : 'Add Customer'}</button>
          </div>
        </form>
      </Modal>

      {/* Payment Modal */}
      <Modal isOpen={payModal} onClose={() => setPayModal(false)} title="💰 Record Payment" size="md">
        <form onSubmit={savePayment} className="space-y-4">
          <div><label className="label">Amount (₹) *</label><input type="number" min="1" className="input" required value={payForm.amount} onChange={e => setPayForm({ ...payForm, amount: e.target.value })} placeholder="Amount received" /></div>
          <div><label className="label">Date</label><input type="date" className="input" value={payForm.date} onChange={e => setPayForm({ ...payForm, date: e.target.value })} /></div>
          <div><label className="label">Payment Method</label>
            <select className="input" value={payForm.method} onChange={e => setPayForm({ ...payForm, method: e.target.value })}>
              {paymentMethods.map(m => <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>)}
            </select>
          </div>
          <div><label className="label">Notes</label><input className="input" value={payForm.notes} onChange={e => setPayForm({ ...payForm, notes: e.target.value })} placeholder="e.g., Partial payment" /></div>
          <div className="flex justify-end gap-3 pt-2 border-t">
            <button type="button" onClick={() => setPayModal(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={savingPay} className="btn-primary">{savingPay ? 'Saving...' : 'Record Payment'}</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog isOpen={confirm.open} onClose={() => setConfirm({ ...confirm, open: false })} title={confirm.title} message={confirm.message} variant={confirm.variant} onConfirm={confirm.onConfirm} />
    </div>
  );
}
