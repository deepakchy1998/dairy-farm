import { useState, useEffect } from 'react';
import api from '../../utils/api';
import { formatDate, formatCurrency } from '../../utils/helpers';
import Modal from '../../components/Modal';
import { FiCheck, FiClock, FiCreditCard } from 'react-icons/fi';
import toast from 'react-hot-toast';

export default function Subscription() {
  const [plans, setPlans] = useState(null);
  const [current, setCurrent] = useState(null);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [payModal, setPayModal] = useState(null);
  const [txnId, setTxnId] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get('/subscription/plans'),
      api.get('/subscription/current'),
      api.get('/payment/my'),
    ]).then(([p, c, pay]) => {
      setPlans(p.data.data);
      setCurrent(c.data.data);
      setPayments(pay.data.data);
    }).catch(() => toast.error('Failed to load'))
    .finally(() => setLoading(false));
  }, []);

  const handlePayment = async (e) => {
    e.preventDefault();
    if (!txnId.trim()) return toast.error('Enter UPI Transaction ID');
    setSaving(true);
    try {
      await api.post('/payment', { plan: payModal, upiTransactionId: txnId });
      toast.success('Payment submitted! Admin will verify shortly.');
      setPayModal(null); setTxnId('');
      const pay = await api.get('/payment/my');
      setPayments(pay.data.data);
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div></div>;

  const isActive = current?.isActive;
  const sub = current?.subscription;

  const planCards = [
    { id: 'monthly', label: 'Monthly', price: plans?.monthly, period: '/month', popular: false },
    { id: 'quarterly', label: 'Quarterly', price: plans?.quarterly, period: '/3 months', popular: false },
    { id: 'halfyearly', label: 'Half Yearly', price: plans?.halfyearly, period: '/6 months', popular: true },
    { id: 'yearly', label: 'Yearly', price: plans?.yearly, period: '/year', popular: false },
  ];

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">💳 Subscription</h1><p className="text-gray-500 text-sm">Manage your plan & payments</p></div>

      {/* Current Plan */}
      <div className={`card border-2 ${isActive ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'}`}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">Current Plan</p>
            <p className="text-xl font-bold capitalize">{sub?.plan?.replace('_', ' ') || 'No Plan'}</p>
            {sub && <p className="text-sm text-gray-500">Valid until: {formatDate(sub.endDate)}</p>}
          </div>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
            {isActive ? '✅ Active' : '❌ Expired'}
          </span>
        </div>
      </div>

      {/* Plan Cards */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Choose a Plan</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {planCards.map(plan => (
            <div key={plan.id} className={`card relative ${plan.popular ? 'border-2 border-emerald-500 shadow-lg' : ''}`}>
              {plan.popular && <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-emerald-500 text-white text-xs font-bold px-3 py-1 rounded-full">POPULAR</span>}
              <h3 className="text-lg font-semibold mt-2">{plan.label}</h3>
              <p className="text-3xl font-bold mt-2">{formatCurrency(plan.price)}<span className="text-sm font-normal text-gray-500">{plan.period}</span></p>
              <ul className="mt-4 space-y-2 text-sm text-gray-600">
                <li className="flex items-center gap-2"><FiCheck className="text-emerald-500" /> Unlimited cattle management</li>
                <li className="flex items-center gap-2"><FiCheck className="text-emerald-500" /> Farm assistant chatbot</li>
                <li className="flex items-center gap-2"><FiCheck className="text-emerald-500" /> Advanced reports & analytics</li>
                <li className="flex items-center gap-2"><FiCheck className="text-emerald-500" /> All features included</li>
              </ul>
              <button onClick={() => setPayModal(plan.id)} className={`w-full mt-4 ${plan.popular ? 'btn-primary' : 'btn-secondary'}`}>
                Subscribe Now
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Payment Instructions */}
      {plans?.upiId && (
        <div className="card bg-blue-50 border-blue-200">
          <h3 className="font-semibold text-blue-800 mb-2">💰 Payment Instructions</h3>
          <p className="text-sm text-blue-700">Pay via UPI to: <strong className="text-lg">{plans.upiId}</strong> {plans.upiName && `(${plans.upiName})`}</p>
          <p className="text-xs text-blue-600 mt-1">After payment, enter your UPI Transaction ID below. Admin will verify and activate your subscription.</p>
        </div>
      )}

      {/* Payment History */}
      {payments.length > 0 && (
        <div className="card">
          <h3 className="text-lg font-semibold mb-4">Payment History</h3>
          <div className="space-y-3">
            {payments.map(p => (
              <div key={p._id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium capitalize">{p.plan} Plan</p>
                  <p className="text-xs text-gray-500">Txn: {p.upiTransactionId} • {formatDate(p.createdAt)}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold">{formatCurrency(p.amount)}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${p.status === 'verified' ? 'bg-green-100 text-green-700' : p.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>{p.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Payment Modal */}
      <Modal isOpen={!!payModal} onClose={() => setPayModal(null)} title={`Subscribe to ${payModal} plan`}>
        <form onSubmit={handlePayment} className="space-y-4">
          <div className="bg-blue-50 p-4 rounded-lg text-center">
            <p className="text-sm text-gray-600">Pay to UPI ID:</p>
            <p className="text-2xl font-bold text-blue-700 mt-1">{plans?.upiId || 'Not configured'}</p>
            <p className="text-lg font-semibold mt-2">{formatCurrency(plans?.[payModal])}</p>
          </div>
          <div>
            <label className="label">UPI Transaction ID *</label>
            <input className="input" required value={txnId} onChange={e => setTxnId(e.target.value)} placeholder="Enter UPI transaction/reference ID" />
          </div>
          <p className="text-xs text-gray-500">After submitting, admin will verify your payment and activate the subscription.</p>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setPayModal(null)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Submitting...' : 'Submit Payment'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
