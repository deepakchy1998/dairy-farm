import { useState, useEffect } from 'react';
import api from '../../utils/api';
import { formatDate, formatCurrency } from '../../utils/helpers';
import { useAuth } from '../../context/AuthContext';
import { FiCheck, FiClock, FiCheckCircle, FiAlertCircle, FiShield } from 'react-icons/fi';
import toast from 'react-hot-toast';

export default function Subscription() {
  const { subscription: subData, fetchSubscription } = useAuth();
  const [plans, setPlans] = useState(null);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [razorpayEnabled, setRazorpayEnabled] = useState(false);
  const [razorpayLoading, setRazorpayLoading] = useState(false);
  const [customModules, setCustomModules] = useState(new Set());
  const [customPeriod, setCustomPeriod] = useState('monthly');
  const [customConfig, setCustomConfig] = useState(null);

  useEffect(() => {
    Promise.all([
      api.get('/subscription/plans'),
      api.get('/payment/my'),
      api.get('/razorpay/config').catch(() => ({ data: { data: { enabled: false } } })),
      api.get('/app-config').then(r => r.data.data).catch(() => null),
    ]).then(([p, pay, rz, appCfg]) => {
      setPlans(p.data.data);
      setPayments(pay.data.data);
      setRazorpayEnabled(rz.data.data?.enabled || false);
      setCustomConfig({
        enabled: appCfg?.customPlanEnabled !== false,
        minPrice: appCfg?.customPlanMinPrice || 200,
        maxPrice: appCfg?.customPlanMaxPrice || 5000,
        modulePrices: appCfg?.customPlanModulePrices || {},
      });
    }).catch(() => toast.error('Failed to load'))
    .finally(() => setLoading(false));
  }, []);

  const loadRazorpayScript = () => new Promise((resolve) => {
    if (document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]')) return resolve(true);
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });

  const handlePayment = async (plan, customData = null) => {
    if (!razorpayEnabled) return toast.error('Payment gateway not configured. Contact admin.');
    setRazorpayLoading(true);
    try {
      const loaded = await loadRazorpayScript();
      if (!loaded) { toast.error('Failed to load payment gateway'); return; }

      const orderData = customData ? { plan, ...customData } : { plan };
      const res = await api.post('/razorpay/create-order', orderData);
      const { orderId, amount, currency, keyId, name, description, prefill } = res.data.data;

      const options = {
        key: keyId, amount, currency, name, description,
        order_id: orderId, prefill,
        theme: { color: '#059669', backdrop_color: 'rgba(0,0,0,0.6)' },
        config: {
          display: {
            blocks: {
              upi: { name: 'UPI / QR Code', instruments: [{ method: 'upi', flows: ['qr', 'collect', 'intent'] }] },
              wallets: { name: 'Wallets', instruments: [{ method: 'wallet', wallets: ['paytm', 'phonepe', 'freecharge', 'mobikwik', 'airtelmoney', 'jiomoney'] }] },
              cards: { name: 'Cards', instruments: [{ method: 'card' }] },
              netbanking: { name: 'Net Banking', instruments: [{ method: 'netbanking' }] },
              emi: { name: 'EMI', instruments: [{ method: 'emi' }, { method: 'cardless_emi' }] },
              paylater: { name: 'Pay Later', instruments: [{ method: 'paylater' }] },
            },
            sequence: ['block.upi', 'block.wallets', 'block.cards', 'block.netbanking', 'block.emi', 'block.paylater'],
            preferences: { show_default_blocks: true },
          },
        },
        method: {
          upi: true,
          card: true,
          netbanking: true,
          wallet: true,
          emi: true,
          paylater: true,
          qr: true,
        },
        handler: async (response) => {
          try {
            toast.loading('Verifying payment...', { id: 'rzp-verify' });
            await api.post('/razorpay/verify-payment', {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
            toast.success('Payment successful! Subscription activated! 🎉', { id: 'rzp-verify', duration: 5000 });
            fetchSubscription();
            api.get('/payment/my').then(r => setPayments(r.data.data));
          } catch (err) {
            toast.error(err.response?.data?.message || 'Payment verification failed', { id: 'rzp-verify' });
          }
        },
        modal: { ondismiss: () => toast('Payment cancelled', { icon: '⚠️' }) },
      };

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', (r) => toast.error(`Payment failed: ${r.error.description}`));
      rzp.open();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to initiate payment');
    } finally { setRazorpayLoading(false); }
  };

  if (loading) return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div></div>;

  const isActive = subData?.isActive;
  const sub = subData?.subscription;
  const planCards = (plans?.plans || []).map(p => ({
    id: p.name, label: p.label, price: p.price, period: p.period || '', days: p.days,
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

      {/* Plan Cards */}
      <div>
        <h2 className="text-lg font-semibold mb-4 dark:text-white">Choose a Plan</h2>
        
        {/* Custom Plan Builder */}
        {customConfig?.enabled !== false && (() => {
          const moduleList = [
            { id: 'cattle', icon: '🐄', name: 'Cattle', price: customConfig?.modulePrices?.cattle || 50 },
            { id: 'milk', icon: '🥛', name: 'Milk', price: customConfig?.modulePrices?.milk || 50 },
            { id: 'health', icon: '💉', name: 'Health', price: customConfig?.modulePrices?.health || 40 },
            { id: 'breeding', icon: '🐣', name: 'Breeding', price: customConfig?.modulePrices?.breeding || 40 },
            { id: 'feed', icon: '🌾', name: 'Feed', price: customConfig?.modulePrices?.feed || 30 },
            { id: 'finance', icon: '💰', name: 'Finance', price: customConfig?.modulePrices?.finance || 40 },
            { id: 'milkDelivery', icon: '🏘️', name: 'Dudh Khata', price: customConfig?.modulePrices?.milkDelivery || 50 },
            { id: 'employees', icon: '👷', name: 'Employees', price: customConfig?.modulePrices?.employees || 40 },
            { id: 'insurance', icon: '🛡️', name: 'Insurance', price: customConfig?.modulePrices?.insurance || 30 },
            { id: 'reports', icon: '📊', name: 'Reports', price: customConfig?.modulePrices?.reports || 40 },
            { id: 'chatbot', icon: '🤖', name: 'AI Assistant', price: (() => {
              const rawPrices = customConfig?.modulePrices || {};
              const otherPrices = Object.entries(rawPrices).filter(([k]) => k !== 'chatbot').map(([, v]) => v).sort((a, b) => a - b);
              const mid = Math.floor(otherPrices.length / 2);
              return otherPrices.length % 2 === 0 ? Math.round((otherPrices[mid - 1] + otherPrices[mid]) / 2) : otherPrices[mid];
            })() || 60 },
          ];

          let monthlyPrice = Array.from(customModules).reduce((t, m) => t + (moduleList.find(mod => mod.id === m)?.price || 0), 0);
          if (customModules.size > 0 && monthlyPrice < (customConfig?.minPrice || 200)) monthlyPrice = customConfig?.minPrice || 200;
          if (monthlyPrice > (customConfig?.maxPrice || 5000)) monthlyPrice = customConfig?.maxPrice || 5000;

          const multipliers = { monthly: 1, halfyearly: 6, yearly: 12 };
          const months = multipliers[customPeriod] || 1;
          const totalPrice = monthlyPrice * months;

          return (
            <div className="card mb-6 border-2 border-dashed border-emerald-300 dark:border-emerald-700">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold dark:text-white flex items-center gap-2">🛠️ Build Your Custom Plan</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Select only the modules you need</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setCustomModules(new Set(moduleList.map(m => m.id)))} className="text-xs text-emerald-600 hover:underline">All</button>
                  <button onClick={() => setCustomModules(new Set())} className="text-xs text-gray-400 hover:underline">Clear</button>
                </div>
              </div>
              
              {/* Module selection grid - 3 cols on mobile, 4 on desktop */}
              <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2 mb-4">
                {moduleList.map(module => (
                  <div
                    key={module.id}
                    onClick={() => {
                      const newModules = new Set(customModules);
                      if (newModules.has(module.id)) {
                        newModules.delete(module.id);
                      } else {
                        newModules.add(module.id);
                      }
                      setCustomModules(newModules);
                    }}
                    className={`cursor-pointer p-3 rounded-lg text-center text-xs transition-all ${
                      customModules.has(module.id)
                        ? 'bg-emerald-100 dark:bg-emerald-900/30 ring-1 ring-emerald-500 text-emerald-700 dark:text-emerald-400'
                        : 'bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400'
                    }`}
                  >
                    <div className="text-lg mb-1">{module.icon}</div>
                    <div className="font-medium">{module.name}</div>
                    <div className="text-xs opacity-75">₹{module.price}</div>
                  </div>
                ))}
              </div>
              
              {/* Period selector + price + pay button in one row */}
              <div className="flex items-center gap-4 flex-wrap bg-gray-50 dark:bg-gray-800 rounded-xl p-4">
                <div className="flex gap-1 bg-white dark:bg-gray-700 rounded-lg p-1">
                  {[
                    { key: 'monthly', label: 'Monthly' },
                    { key: 'halfyearly', label: '6 Months' },
                    { key: 'yearly', label: 'Yearly' }
                  ].map(period => (
                    <button
                      key={period.key}
                      onClick={() => setCustomPeriod(period.key)}
                      className={`px-3 py-2 rounded-md text-xs transition-all ${
                        customPeriod === period.key
                          ? 'bg-emerald-500 text-white shadow-sm'
                          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-600'
                      }`}
                    >
                      {period.label}
                    </button>
                  ))}
                </div>
                <div className="flex-1 text-right">
                  <p className="text-2xl font-bold dark:text-white">₹{totalPrice}</p>
                  <p className="text-xs text-gray-400">₹{monthlyPrice}/mo × {months} months</p>
                </div>
                <button
                  onClick={() => handlePayment('custom', { modules: [...customModules], period: customPeriod })}
                  disabled={customModules.size === 0 || razorpayLoading}
                  className="btn-primary px-6 disabled:opacity-50"
                >
                  💳 Pay Now
                </button>
              </div>
            </div>
          );
        })()}
        
        <div className={`grid grid-cols-1 sm:grid-cols-2 ${planCards.length >= 4 ? 'lg:grid-cols-4' : planCards.length === 3 ? 'lg:grid-cols-3' : 'lg:grid-cols-2'} gap-4`}>
          {planCards.map(plan => (
            <div key={plan.id} className={`card relative ${plan.popular ? 'border-2 border-emerald-500 shadow-lg' : ''}`}>
              {plan.popular && <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-emerald-500 text-white text-xs font-bold px-3 py-1 rounded-full">BEST VALUE</span>}
              <h3 className="text-lg font-semibold mt-2 dark:text-white">{plan.label}</h3>
              <p className="text-3xl font-bold mt-2 dark:text-white">{formatCurrency(plan.price)}<span className="text-sm font-normal text-gray-500">{plan.period}</span></p>
              <p className="text-xs text-gray-400 mt-1">₹{(plan.price / plan.days).toFixed(1)}/day</p>
              <ul className="mt-4 space-y-2 text-sm text-gray-600 dark:text-gray-400">
                {plan.features.map((f, i) => <li key={i} className="flex items-center gap-2"><FiCheck className="text-emerald-500" /> {f}</li>)}
                <li className="flex items-center gap-2"><FiCheck className="text-emerald-500" /> {plan.days} days access</li>
              </ul>
              <button
                onClick={() => handlePayment(plan.id)}
                disabled={razorpayLoading}
                className={`w-full mt-4 ${plan.popular ? 'btn-primary' : 'btn-secondary'} disabled:opacity-50 flex items-center justify-center gap-2`}
              >
                {razorpayLoading ? 'Processing...' : '💳 Subscribe Now'}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Payment Info */}
      <div className="card bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800">
        <h3 className="font-semibold text-emerald-800 dark:text-emerald-400 mb-3 flex items-center gap-2"><FiShield size={16} /> Secure Payment via Razorpay</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
          {[
            { icon: '📱', label: 'UPI (GPay, PhonePe, BHIM)' },
            { icon: '📷', label: 'QR Code Scan & Pay' },
            { icon: '💳', label: 'Debit / Credit Card' },
            { icon: '👛', label: 'Paytm, PhonePe Wallet' },
            { icon: '🏦', label: 'Net Banking' },
            { icon: '🔄', label: 'EMI & Pay Later' },
          ].map((m, i) => (
            <div key={i} className="flex items-center gap-2 bg-white/60 dark:bg-gray-800/40 rounded-lg px-3 py-2">
              <span className="text-lg">{m.icon}</span>
              <span className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">{m.label}</span>
            </div>
          ))}
        </div>
        <div className="text-xs text-emerald-600 dark:text-emerald-500 space-y-0.5">
          <p>✅ Subscription activates <strong>instantly</strong> after payment</p>
          <p>✅ 256-bit encrypted • PCI DSS compliant • RBI regulated</p>
        </div>
      </div>

      {/* Payment History */}
      {payments.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold dark:text-white">Payment History</h3>
            <span className="text-xs text-gray-400">{payments.length} payments</span>
          </div>
          <div className="space-y-3 max-h-[280px] overflow-y-auto pr-1">
            {payments.map(p => (
              <div key={p._id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div>
                  <p className="font-medium capitalize dark:text-white">{p.plan} Plan</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">💳 Razorpay • {p.razorpayPaymentId || p.upiTransactionId || '-'} • {formatDate(p.createdAt)}</p>
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
    </div>
  );
}
