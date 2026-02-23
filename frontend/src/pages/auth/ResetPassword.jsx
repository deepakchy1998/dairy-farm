import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import { FiLock, FiCheck } from 'react-icons/fi';
import toast from 'react-hot-toast';

export default function ResetPassword() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState({ password: '', confirmPassword: '' });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password !== form.confirmPassword) {
      return toast.error('Passwords do not match');
    }
    if (form.password.length < 6) {
      return toast.error('Password must be at least 6 characters');
    }
    setLoading(true);
    try {
      const res = await api.post(`/auth/reset-password/${token}`, { password: form.password });
      setSuccess(true);
      toast.success(res.data.message || 'Password reset successful!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to reset password. The link may be expired.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-green-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <span className="text-5xl">🐄</span>
          <h1 className="text-3xl font-bold text-gray-900 mt-2">DairyPro</h1>
        </div>

        <div className="card">
          {!success ? (
            <>
              <h2 className="text-xl font-semibold mb-2">Set New Password</h2>
              <p className="text-gray-500 text-sm mb-6">Enter your new password below.</p>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="label">New Password</label>
                  <div className="relative">
                    <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="password"
                      className="input pl-10"
                      required
                      minLength={6}
                      value={form.password}
                      onChange={e => setForm({ ...form, password: e.target.value })}
                      placeholder="Min 6 characters"
                    />
                  </div>
                </div>
                <div>
                  <label className="label">Confirm New Password</label>
                  <div className="relative">
                    <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="password"
                      className="input pl-10"
                      required
                      minLength={6}
                      value={form.confirmPassword}
                      onChange={e => setForm({ ...form, confirmPassword: e.target.value })}
                      placeholder="Re-enter password"
                    />
                  </div>
                </div>
                {form.password && form.confirmPassword && form.password !== form.confirmPassword && (
                  <p className="text-red-500 text-xs">Passwords do not match</p>
                )}
                <button type="submit" disabled={loading || (form.password !== form.confirmPassword)} className="btn-primary w-full">
                  {loading ? 'Resetting...' : 'Reset Password'}
                </button>
              </form>
            </>
          ) : (
            <div className="text-center py-4">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <FiCheck className="text-emerald-600" size={28} />
              </div>
              <h2 className="text-xl font-semibold mb-2">Password Reset!</h2>
              <p className="text-gray-500 text-sm mb-6">Your password has been changed successfully. You can now login.</p>
              <button onClick={() => navigate('/login')} className="btn-primary w-full">
                Go to Login
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
