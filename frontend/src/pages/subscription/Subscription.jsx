import { useState, useEffect, useRef } from 'react';
import api from '../../utils/api';
import { formatDate, formatCurrency } from '../../utils/helpers';
import Modal from '../../components/Modal';
import { useAuth } from '../../context/AuthContext';
import { FiCheck, FiClock, FiCreditCard, FiUpload, FiX, FiAlertCircle, FiCheckCircle } from 'react-icons/fi';
import toast from 'react-hot-toast';

export default function Subscription() {
  const { subscription: subData, fetchSubscription } = useAuth();
  const [plans, setPlans] = useState(null);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [payModal, setPayModal] = useState(null);
  const [txnId, setTxnId] = useState('');
  const [screenshot, setScreenshot] = useState('');
  const [screenshotPreview, setScreenshotPreview] = useState('');
  const [saving, setSaving] = useState(false);
  const fileRef = useRef(null);

  // Razorpay state
  const [razorpayEnabled, setRazorpayEnabled] = useState(false);
  const [razorpayKeyId, setRazorpayKeyId] = useState('');
  const [razorpayLoading, setRazorpayLoading] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get('/subscription/plans'),
      api.get('/payment/my'),
      api.get('/razorpay/config').catch(() => ({ data: { data: { enabled: false } } })),
    ]).then(([p, pay, rz]) => {
      setPlans(p.data.data);
      setPayments(pay.data.data);
      setRazorpayEnabled(rz.data.data?.enabled || false);
      setRazorpayKeyId(rz.data.data?.keyId || '');
    }).catch(() => toast.error('Failed to load'))
    .finally(() => setLoading(false));
  }, []);

  // Load Razorpay script
  const loadRazorpayScript = () => {
    return new Promise((resolve) => {
      if (document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]')) {
        return resolve(true);
      }
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  // Handle Razorpay payment
  const handleRazorpayPayment = async (plan) => {
    setRazorpayLoading(true);
    try {
      const loaded = await loadRazorpayScript();
      if (!loaded) { toast.error('Failed to load payment gateway'); return; }

      const res = await api.post('/razorpay/create-order', { plan });
      const { orderId, amount, currency, keyId, name, description, prefill } = res.data.data;

      const options = {
        key: keyId,
        amount,
        currency,
        name,
        description,
        order_id: orderId,
        prefill,
        theme: { color: '#059669' },
        handler: async (response) => {
          try {
            toast.loading('Verifying payment...', { id: 'rzp-verify' });
            await api.post('/razorpay/verify-payment', {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
            toast.success('Payment successful! Subscription activated instantly! 🎉', { id: 'rzp-verify', duration: 5000 });
            fetchSubscription();
            const pay = await api.get('/payment/my');
            setPayments(pay.data.data);
          } catch (err) {
            toast.error(err.response?.data?.message || 'Payment verification failed', { id: 'rzp-verify' });
          }
        },
        modal: {
          ondismiss: () => toast('Payment cancelled', { icon: '⚠️' }),
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', (response) => {
        toast.error(`Payment failed: ${response.error.description}`);
      });
      rzp.open();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to initiate payment');
    } finally {
      setRazorpayLoading(false);
    }
  };

  const handleScreenshot = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return toast.error('Screenshot must be under 5MB');
    const reader = new FileReader();
    reader.onload = () => {
      setScreenshot(reader.result);
      setScreenshotPreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handlePayment = async (e) => {
    e.preventDefault();
    if (!txnId.trim()) return toast.error('Enter UPI Transaction ID');
    setSaving(true);
    try {
      await api.post('/payment', { plan: payModal, upiTransactionId: txnId.trim(), screenshot });
      toast.success('Payment submitted! Admin will verify within 24 hours.');
      setPayModal(null); setTxnId(''); setScreenshot(''); setScreenshotPreview('');
      const pay = await api.get('/payment/my');
      setPayments(pay.data.data);
      fetchSubscription(); // Refresh subscription status
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div></div>;

  const isActive = subData?.isActive;
  const sub = subData?.subscription;

  const planCards = (plans?.plans || []).map(p => ({
    id: p.name,
    label: p.label,
    price: p.price,
    period: p.period || '',
    days: p.days,
    popular: p.isPopular,
    features: p.features || ['All features included', 'Unlimited cattle & records', 'AI Farm Assistant', 'Reports & Analytics'],
  }));

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold dark:text-white">💳 Subscription</h1><p className="text-gray-500 dark:text-gray-400 text-sm">Manage your plan & payments</p></div>

      {/* Current Plan Status */}
      <div className={`card border-2 ${isActive ? 'border-emerald-200 bg-emerald-50 dark:bg-emerald-900/10 dark:border-emerald-800' : 'border-red-200 bg-red-50 dark:bg-red-900/10 dark:border-red-800'}`}>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Current Plan</p>
            <p className="text-xl font-bold capitalize dark:text-white">{sub?.plan?.replace('_', ' ') || 'No Active Plan'}</p>
            {sub && <p className="text-sm text-gray-500 dark:text-gray-400">Valid until: <strong>{formatDate(sub.endDate)}</strong> ({subData?.daysLeft} days left)</p>}
          </div>
          <span className={`px-4 py-1.5 rounded-full text-sm font-semibold ${isActive ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
            {isActive ? '✅ Active' : '❌ Expired'}
          </span>
        </div>
      </div>

      {/* Pending Payment Notice */}
      {subData?.hasPendingPayment && (
        <div className="card border-2 border-yellow-200 bg-yellow-50 dark:bg-yellow-900/10 dark:border-yellow-800">
          <div className="flex items-center gap-3">
            <FiClock className="text-yellow-600" size={20} />
            <div>
              <p className="font-semibold text-yellow-800 dark:text-yellow-400">Payment Pending Verification</p>
              <p className="text-sm text-yellow-700 dark:text-yellow-500">
                TXN ID: <strong>{subData.pendingPayment?.upiTransactionId}</strong> • ₹{subData.pendingPayment?.amount} • Submitted {formatDate(subData.pendingPayment?.createdAt)}
              </p>
              <p className="text-xs text-yellow-600 dark:text-yellow-600 mt-1">Admin will verify within 24 hours. You'll get access immediately after verification.</p>
            </div>
          </div>
        </div>
      )}

      {/* Plan Cards */}
      <div>
        <h2 className="text-lg font-semibold mb-4 dark:text-white">Choose a Plan</h2>
        <div className={`grid grid-cols-1 sm:grid-cols-2 ${planCards.length >= 4 ? 'lg:grid-cols-4' : planCards.length === 3 ? 'lg:grid-cols-3' : 'lg:grid-cols-2'} gap-4`}>
          {planCards.map(plan => (
            <div key={plan.id} className={`card relative ${plan.popular ? 'border-2 border-emerald-500 shadow-lg' : ''}`}>
              {plan.popular && <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-emerald-500 text-white text-xs font-bold px-3 py-1 rounded-full">BEST VALUE</span>}
              <h3 className="text-lg font-semibold mt-2 dark:text-white">{plan.label}</h3>
              <p className="text-3xl font-bold mt-2 dark:text-white">{formatCurrency(plan.price)}<span className="text-sm font-normal text-gray-500">{plan.period}</span></p>
              <p className="text-xs text-gray-400 mt-1">₹{(plan.price / plan.days).toFixed(1)}/day</p>
              <ul className="mt-4 space-y-2 text-sm text-gray-600 dark:text-gray-400">
                {plan.features.map((f, i) => (
                  <li key={i} className="flex items-center gap-2"><FiCheck className="text-emerald-500" /> {f}</li>
                ))}
                <li className="flex items-center gap-2"><FiCheck className="text-emerald-500" /> {plan.days} days access</li>
              </ul>
              <div className="mt-4 space-y-2">
                {razorpayEnabled && (
                  <button
                    onClick={() => handleRazorpayPayment(plan.id)}
                    disabled={razorpayLoading || subData?.hasPendingPayment}
                    className={`w-full ${plan.popular ? 'btn-primary' : 'btn-secondary'} disabled:opacity-50 flex items-center justify-center gap-2`}
                  >
                    {razorpayLoading ? 'Processing...' : '💳 Pay Online'}
                  </button>
                )}
                <button
                  onClick={() => setPayModal(plan.id)}
                  disabled={subData?.hasPendingPayment}
                  className={`w-full ${!razorpayEnabled && plan.popular ? 'btn-primary' : 'btn-secondary'} disabled:opacity-50`}
                >
                  {subData?.hasPendingPayment ? 'Payment Pending' : razorpayEnabled ? '📱 Pay via UPI (Manual)' : 'Subscribe Now'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Payment Instructions */}
      {(razorpayEnabled || plans?.upiId) && (
        <div className="card bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800">
          <h3 className="font-semibold text-blue-800 dark:text-blue-400 mb-2">💰 How to Pay</h3>
          {razorpayEnabled && (
            <div className="mb-3">
              <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400 mb-1">Option 1: Pay Online (Instant Activation) ⚡</p>
              <ol className="text-sm text-blue-700 dark:text-blue-400 space-y-1 list-decimal pl-4">
                <li>Click <strong>"💳 Pay Online"</strong> on your preferred plan</li>
                <li>Pay via <strong>UPI, QR Code, Debit/Credit Card, Wallets, or Net Banking</strong></li>
                <li>Subscription activates <strong>instantly</strong> after payment!</li>
              </ol>
            </div>
          )}
          {plans?.upiId && (
            <div>
              <p className="text-sm font-semibold text-blue-800 dark:text-blue-400 mb-1">{razorpayEnabled ? 'Option 2: Manual UPI Transfer' : 'How to Pay'}</p>
              <ol className="text-sm text-blue-700 dark:text-blue-400 space-y-1 list-decimal pl-4">
                <li>Open any UPI app (PhonePe, GPay, Paytm, etc.)</li>
                <li>Pay the exact plan amount to: <strong className="text-lg">{plans.upiId}</strong></li>
                <li>Note your <strong>UPI Transaction ID</strong> from the payment receipt</li>
                <li>Click "{razorpayEnabled ? '📱 Pay via UPI (Manual)' : 'Subscribe Now'}" and enter the Transaction ID</li>
                <li>Upload a <strong>screenshot</strong> of your payment for faster verification</li>
                <li>Admin will verify and activate within 24 hours</li>
              </ol>
            </div>
          )}
        </div>
      )}

      {/* Payment History */}
      {payments.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold dark:text-white">Payment History</h3>
            <span className="text-xs text-gray-400">{payments.length} payments</span>
          </div>
          <div className="space-y-3 max-h-[280px] overflow-y-auto pr-1 scrollbar-thin">
            {payments.map(p => (
              <div key={p._id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div>
                  <p className="font-medium capitalize dark:text-white">{p.plan} Plan</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{p.paymentMethod === 'razorpay' ? '💳 Razorpay' : '📱 UPI'} • TXN: {p.razorpayPaymentId || p.upiTransactionId} • {formatDate(p.createdAt)}</p>
                  {p.adminNote && <p className="text-xs text-gray-400 mt-0.5">Note: {p.adminNote}</p>}
                </div>
                <div className="text-right">
                  <p className="font-bold dark:text-white">{formatCurrency(p.amount)}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    p.status === 'verified' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                    p.status === 'rejected' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                    p.status === 'expired' ? 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400' :
                    'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                  }`}>
                    {p.status === 'verified' && <FiCheckCircle className="inline mr-1" size={10} />}
                    {p.status === 'rejected' && <FiAlertCircle className="inline mr-1" size={10} />}
                    {p.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Payment Modal */}
      <Modal isOpen={!!payModal} onClose={() => { setPayModal(null); setScreenshot(''); setScreenshotPreview(''); }} title={`Subscribe — ${payModal?.charAt(0).toUpperCase()}${payModal?.slice(1)} Plan`}>
        <form onSubmit={handlePayment} className="space-y-4">
          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg text-center">
            <p className="text-sm text-gray-600 dark:text-gray-400">Pay this exact amount via UPI:</p>
            <p className="text-3xl font-bold text-blue-700 dark:text-blue-400 mt-1">{formatCurrency(plans?.[payModal])}</p>
            <p className="text-lg font-semibold text-blue-600 dark:text-blue-500 mt-2">UPI: {plans?.upiId || 'Not configured'}</p>
          </div>

          <div>
            <label className="label">UPI Transaction ID *</label>
            <input className="input" required value={txnId} onChange={e => setTxnId(e.target.value.replace(/[^a-zA-Z0-9]/g, ''))}
              placeholder="Enter UPI transaction/reference ID from payment receipt" />
            <p className="text-xs text-gray-400 mt-1">Enter only the numeric/alphanumeric transaction ID (no spaces or special characters)</p>
          </div>

          <div>
            <label className="label">Payment Screenshot (recommended)</label>
            <div className="relative">
              {screenshotPreview ? (
                <div className="relative">
                  <img src={screenshotPreview} alt="Payment proof" className="w-full max-h-48 object-contain rounded-lg border" />
                  <button type="button" onClick={() => { setScreenshot(''); setScreenshotPreview(''); if(fileRef.current) fileRef.current.value=''; }}
                    className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center">
                    <FiX size={14} />
                  </button>
                </div>
              ) : (
                <button type="button" onClick={() => fileRef.current?.click()}
                  className="w-full py-6 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-400 hover:border-emerald-400 hover:text-emerald-500 transition flex flex-col items-center gap-2">
                  <FiUpload size={24} />
                  <span className="text-sm">Upload payment screenshot</span>
                  <span className="text-xs">JPG, PNG (max 5MB)</span>
                </button>
              )}
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleScreenshot} />
            </div>
          </div>

          <div className="bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg">
            <p className="text-xs text-amber-700 dark:text-amber-400">
              ⚠️ <strong>Important:</strong> Pay the exact amount shown above. Admin will verify your payment and activate the subscription within 24 hours. Do not use a previously used Transaction ID.
            </p>
          </div>

          <label className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400">
            <input type="checkbox" required className="mt-1 rounded border-gray-300" />
            <span>I confirm that I have paid <strong>₹{plans?.[payModal]}</strong> via UPI and the transaction ID entered above is correct.</span>
          </label>

          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setPayModal(null)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Submitting...' : 'Submit Payment'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
