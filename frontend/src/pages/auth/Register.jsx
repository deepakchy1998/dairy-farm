import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';
import { FiEye, FiEyeOff, FiUser, FiMail, FiLock, FiPhone, FiMapPin, FiHome, FiCheck } from 'react-icons/fi';

const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat',
  'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh',
  'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab',
  'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
];

const PASSWORD_RULES = [
  { test: (p) => p.length >= 6, label: 'At least 6 characters' },
  { test: (p) => /[A-Z]/.test(p), label: 'One uppercase letter' },
  { test: (p) => /[0-9]/.test(p), label: 'One number' },
];

export default function Register() {
  const [form, setForm] = useState({
    name: '', email: '', password: '', phone: '', farmName: '', address: '', city: '', state: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const { register } = useAuth();
  const navigate = useNavigate();

  // Auto-generate farm name from user name
  useEffect(() => {
    if (form.name && !form.farmName) {
      setForm(f => ({ ...f, farmName: `${form.name.split(' ')[0]}'s Dairy Farm` }));
    }
  }, [form.name]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await register(form);
      toast.success(res.message || 'Account created! Welcome to DairyPro 🐄');
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });
  const canProceed = form.name && form.email && form.password && form.password.length >= 6;

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-green-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <span className="text-5xl">🐄</span>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mt-2">DairyPro</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Start your <span className="text-emerald-600 font-semibold">5-day free trial</span></p>
        </div>

        <div className="card">
          {/* Step indicator */}
          <div className="flex items-center gap-3 mb-6">
            <div className={`flex items-center gap-2 text-sm font-medium ${step >= 1 ? 'text-emerald-600' : 'text-gray-400'}`}>
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${step >= 1 ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-400'}`}>
                {step > 1 ? <FiCheck size={14} /> : '1'}
              </div>
              Account
            </div>
            <div className={`flex-1 h-0.5 rounded ${step >= 2 ? 'bg-emerald-400' : 'bg-gray-200'}`} />
            <div className={`flex items-center gap-2 text-sm font-medium ${step >= 2 ? 'text-emerald-600' : 'text-gray-400'}`}>
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${step >= 2 ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-400'}`}>2</div>
              Farm Details
            </div>
          </div>

          <form onSubmit={handleSubmit} autoComplete="on">
            {/* Step 1: Account details */}
            {step === 1 && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label" htmlFor="name">Full Name *</label>
                    <div className="relative">
                      <FiUser className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                      <input id="name" name="name" autoComplete="name" className="input pl-10" required
                        value={form.name} onChange={set('name')} placeholder="Your name" />
                    </div>
                  </div>
                  <div>
                    <label className="label" htmlFor="phone">Phone</label>
                    <div className="relative">
                      <FiPhone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                      <input id="phone" name="phone" type="tel" autoComplete="tel" className="input pl-10"
                        value={form.phone} onChange={set('phone')} placeholder="+91 98765 43210" />
                    </div>
                  </div>
                </div>
                <div>
                  <label className="label" htmlFor="reg-email">Email *</label>
                  <div className="relative">
                    <FiMail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input id="reg-email" name="email" type="email" autoComplete="email" className="input pl-10" required
                      value={form.email} onChange={set('email')} placeholder="your@email.com" />
                  </div>
                </div>
                <div>
                  <label className="label" htmlFor="reg-password">Password *</label>
                  <div className="relative">
                    <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input id="reg-password" name="password" type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password" className="input pl-10 pr-10" required minLength={6}
                      value={form.password} onChange={set('password')} placeholder="Min 6 characters" />
                    <button type="button" onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      {showPassword ? <FiEyeOff size={16} /> : <FiEye size={16} />}
                    </button>
                  </div>
                  {form.password && (
                    <div className="mt-2 space-y-1">
                      {PASSWORD_RULES.map((rule, i) => (
                        <div key={i} className={`flex items-center gap-2 text-xs ${rule.test(form.password) ? 'text-green-600' : 'text-gray-400'}`}>
                          <FiCheck size={12} /> {rule.label}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <button type="button" onClick={() => setStep(2)} disabled={!canProceed}
                  className="btn-primary w-full disabled:opacity-50">
                  Continue →
                </button>
              </div>
            )}

            {/* Step 2: Farm details */}
            {step === 2 && (
              <div className="space-y-4">
                <div>
                  <label className="label" htmlFor="farmName">Farm Name *</label>
                  <div className="relative">
                    <FiHome className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input id="farmName" name="organization" autoComplete="organization" className="input pl-10" required
                      value={form.farmName} onChange={set('farmName')} placeholder="My Dairy Farm" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label" htmlFor="city">City</label>
                    <input id="city" name="address-level2" autoComplete="address-level2" className="input"
                      value={form.city} onChange={set('city')} placeholder="e.g. Ludhiana" />
                  </div>
                  <div>
                    <label className="label" htmlFor="state">State</label>
                    <select id="state" name="address-level1" autoComplete="address-level1" className="input"
                      value={form.state} onChange={set('state')}>
                      <option value="">Select State</option>
                      {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="label" htmlFor="address">Address</label>
                  <div className="relative">
                    <FiMapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input id="address" name="street-address" autoComplete="street-address" className="input pl-10"
                      value={form.address} onChange={set('address')} placeholder="Village/Town address" />
                  </div>
                </div>
                <div className="flex gap-3">
                  <button type="button" onClick={() => setStep(1)} className="btn-secondary flex-1">← Back</button>
                  <button type="submit" disabled={loading} className="btn-primary flex-1">
                    {loading ? 'Creating...' : '🚀 Start Free Trial'}
                  </button>
                </div>
              </div>
            )}
          </form>

          <p className="text-center text-sm text-gray-500 mt-4">
            Already have an account? <Link to="/login" className="text-emerald-600 font-medium hover:underline">Sign In</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
