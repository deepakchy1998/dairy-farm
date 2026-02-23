import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';

export default function Register() {
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '', farmName: '', address: '', city: '', state: '' });
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await register(form);
      toast.success(res.message || 'Account created!');
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-green-50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <span className="text-5xl">🐄</span>
          <h1 className="text-3xl font-bold text-gray-900 mt-2">DairyPro</h1>
          <p className="text-gray-500 mt-1">Start your 30-day free trial</p>
        </div>

        <div className="card">
          <h2 className="text-xl font-semibold mb-6">Create Account</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Full Name *</label>
                <input className="input" required value={form.name} onChange={set('name')} placeholder="Your name" />
              </div>
              <div>
                <label className="label">Phone</label>
                <input className="input" value={form.phone} onChange={set('phone')} placeholder="+91 98765 43210" />
              </div>
            </div>
            <div>
              <label className="label">Email *</label>
              <input type="email" className="input" required value={form.email} onChange={set('email')} placeholder="your@email.com" />
            </div>
            <div>
              <label className="label">Password *</label>
              <input type="password" className="input" required minLength={6} value={form.password} onChange={set('password')} placeholder="Min 6 characters" />
            </div>
            <hr className="my-2" />
            <h3 className="text-sm font-semibold text-gray-600">Farm Details</h3>
            <div>
              <label className="label">Farm Name *</label>
              <input className="input" required value={form.farmName} onChange={set('farmName')} placeholder="My Dairy Farm" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">City</label>
                <input className="input" value={form.city} onChange={set('city')} />
              </div>
              <div>
                <label className="label">State</label>
                <input className="input" value={form.state} onChange={set('state')} />
              </div>
            </div>
            <div>
              <label className="label">Address</label>
              <input className="input" value={form.address} onChange={set('address')} />
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? 'Creating Account...' : 'Start Free Trial'}
            </button>
          </form>
          <p className="text-center text-sm text-gray-500 mt-4">
            Already have an account? <Link to="/login" className="text-emerald-600 font-medium hover:underline">Sign In</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
