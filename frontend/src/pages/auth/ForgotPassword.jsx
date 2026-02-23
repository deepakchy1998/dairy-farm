import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../utils/api';
import { FiMail, FiArrowLeft } from 'react-icons/fi';
import toast from 'react-hot-toast';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [resetUrl, setResetUrl] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.post('/auth/forgot-password', { email });
      setSent(true);
      toast.success('Reset link sent!');
      // If SMTP not configured, show the reset URL directly
      if (res.data.resetUrl) {
        setResetUrl(res.data.resetUrl);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Something went wrong');
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
          {!sent ? (
            <>
              <h2 className="text-xl font-semibold mb-2">Forgot Password?</h2>
              <p className="text-gray-500 text-sm mb-6">Enter your email and we'll send you a reset link.</p>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="label">Email Address</label>
                  <div className="relative">
                    <FiMail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="email"
                      className="input pl-10"
                      required
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="your@email.com"
                    />
                  </div>
                </div>
                <button type="submit" disabled={loading} className="btn-primary w-full">
                  {loading ? 'Sending...' : 'Send Reset Link'}
                </button>
              </form>
            </>
          ) : (
            <div className="text-center py-4">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <FiMail className="text-emerald-600" size={28} />
              </div>
              <h2 className="text-xl font-semibold mb-2">Check Your Email</h2>
              <p className="text-gray-500 text-sm mb-4">
                If an account with <strong>{email}</strong> exists, we've sent a password reset link.
              </p>
              <p className="text-gray-400 text-xs mb-4">The link will expire in 1 hour.</p>

              {resetUrl && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4 text-left">
                  <p className="text-xs font-semibold text-amber-700 mb-2">⚠️ Email service not configured. Use this link directly:</p>
                  <a href={resetUrl} className="text-xs text-emerald-600 break-all hover:underline">
                    {resetUrl}
                  </a>
                </div>
              )}

              <button onClick={() => { setSent(false); setResetUrl(''); }} className="btn-secondary text-sm">
                Try different email
              </button>
            </div>
          )}

          <div className="mt-4 text-center">
            <Link to="/login" className="text-sm text-emerald-600 font-medium hover:underline flex items-center justify-center gap-1">
              <FiArrowLeft size={14} /> Back to Login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
