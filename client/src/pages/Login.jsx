import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import toast from 'react-hot-toast';

export default function Login() {
  const [mode, setMode] = useState('signin'); // 'signin' | 'signup' | 'admin-setup'
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '', setupToken: '' });
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated) { navigate('/dashboard', { replace: true }); return; }
    api.get('/auth/check').then(res => {
      if (res.data.needsRegistration) setMode('admin-setup');
      setChecking(false);
    }).catch(() => setChecking(false));
  }, [isAuthenticated, navigate]);

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }));

  const switchMode = (next) => {
    setMode(next);
    setForm({ name: '', email: form.email, password: '', confirmPassword: '', setupToken: '' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const { name, email, password, confirmPassword, setupToken } = form;
    if (!email || !password) { toast.error('Email and password required'); return; }

    if (mode === 'signup') {
      if (!name || name.trim().length < 2) { toast.error('Enter your full name (min 2 chars)'); return; }
      if (password.length < 8) { toast.error('Password must be at least 8 characters'); return; }
      if (password !== confirmPassword) { toast.error('Passwords do not match'); return; }
    }
    if (mode === 'admin-setup' && password.length < 8) {
      toast.error('Password must be at least 8 characters'); return;
    }

    setLoading(true);
    try {
      const endpoint = mode === 'admin-setup' ? '/auth/register' : mode === 'signup' ? '/auth/signup' : '/auth/login';
      const payload = mode === 'signup'
        ? { name: name.trim(), email, password }
        : mode === 'admin-setup'
          ? { email, password, setup_token: setupToken.trim() }
          : { email, password };

      const res = await api.post(endpoint, payload);
      login(res.data.user);
      toast.success(mode === 'signin' ? 'Welcome back!' : 'Account created!');
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  if (checking) return (
    <div className="min-h-screen flex items-center justify-center bg-main">
      <div className="w-12 h-12 animate-spin rounded-[1rem] border-4 border-primary-500/20 border-t-primary-500" />
    </div>
  );

  const isAdminSetup = mode === 'admin-setup';
  const isSignUp = mode === 'signup';

  return (
    <div className="min-h-screen flex items-center justify-center bg-main p-4 relative overflow-hidden">
      <div className="absolute inset-0 tech-grid opacity-20" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary-500/10 rounded-full blur-[120px]" />

      <div className="w-full max-w-md relative z-10 animate-fade-in">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-primary-500 rounded-[2rem] shadow-[0_0_50px_rgba(139,92,246,0.3)] mb-6 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent" />
            <svg className="w-10 h-10 text-white relative z-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h1 className="text-4xl font-black dark:text-white text-gray-900 tracking-tighter uppercase">MailcryVia</h1>
          <p className="mt-3 text-sm font-bold text-gray-600 dark:text-gray-400 tracking-wide">
            {isAdminSetup ? 'Setup Admin Account' : isSignUp ? 'Create your account' : 'Sign in to your account'}
          </p>
        </div>

        {/* Mode toggle — only for normal signin/signup */}
        {!isAdminSetup && (
          <div className="flex bg-black/20 dark:bg-white/5 rounded-2xl p-1 mb-6 border border-white/10">
            <button
              type="button"
              onClick={() => switchMode('signin')}
              className={`flex-1 py-3 text-[11px] font-black uppercase tracking-widest rounded-xl transition-all ${
                mode === 'signin'
                  ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/30'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => switchMode('signup')}
              className={`flex-1 py-3 text-[11px] font-black uppercase tracking-widest rounded-xl transition-all ${
                mode === 'signup'
                  ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/30'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
              }`}
            >
              Create Account
            </button>
          </div>
        )}

        {/* Card */}
        <div className="bg-white/80 dark:bg-white/5 backdrop-blur-xl rounded-[3rem] border border-black/10 dark:border-white/10 p-10 shadow-2xl relative overflow-hidden">
          <div className="absolute inset-0 tech-grid opacity-5 pointer-events-none" />
          <form onSubmit={handleSubmit} className="space-y-6 relative z-10">

            {/* Name — signup only */}
            {isSignUp && (
              <div>
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 block">Full Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={set('name')}
                  className="input-field border-black/10 dark:border-white/10 bg-white dark:bg-black/20 dark:focus:bg-black/30"
                  placeholder="John Smith"
                  autoFocus
                />
              </div>
            )}

            <div>
              <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 block">Email Address</label>
              <input
                type="email"
                value={form.email}
                onChange={set('email')}
                className="input-field border-black/10 dark:border-white/10 bg-white dark:bg-black/20 dark:focus:bg-black/30"
                placeholder={isAdminSetup ? 'admin@example.com' : 'you@example.com'}
                autoFocus={!isSignUp}
              />
            </div>

            <div>
              <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 block">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={set('password')}
                  className="input-field border-black/10 dark:border-white/10 bg-white dark:bg-black/20 dark:focus:bg-black/30 pr-11"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
              {(isSignUp || isAdminSetup) && (
                <p className="text-[8px] font-black text-primary-400 mt-2 uppercase tracking-widest">Minimum 8 characters</p>
              )}
            </div>

            
            {isAdminSetup && (
              <div>
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 block">Setup Token</label>
                <input
                  type="password"
                  value={form.setupToken}
                  onChange={set('setupToken')}
                  className="input-field border-black/10 dark:border-white/10 bg-white dark:bg-black/20 dark:focus:bg-black/30"
                  placeholder="Deployment setup token"
                  autoComplete="one-time-code"
                />
              </div>
            )}

            {/* Confirm Password — signup only */}
            {isSignUp && (
              <div>
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 block">Confirm Password</label>
                <div className="relative">
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    value={form.confirmPassword}
                    onChange={set('confirmPassword')}
                    className="input-field border-black/10 dark:border-white/10 bg-white dark:bg-black/20 dark:focus:bg-black/30 pr-11"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                    tabIndex={-1}
                  >
                    {showConfirm ? (
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full justify-center py-4 text-[11px]"
            >
              {loading ? (
                <div className="w-5 h-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              ) : isAdminSetup ? 'CREATE ADMIN ACCOUNT' : isSignUp ? 'CREATE ACCOUNT →' : 'SIGN IN →'}
            </button>
          </form>
        </div>

        {/* Footer */}
        <div className="text-center mt-10">
          <p className="text-[9px] font-black text-gray-600 dark:text-gray-500 uppercase tracking-[0.3em]">
            Professional Email Marketing Made Simple
          </p>
          <div className="flex justify-center gap-1 mt-4">
            <div className="w-1 h-1 rounded-full bg-primary-500/20" />
            <div className="w-1 h-1 rounded-full bg-primary-500/40" />
            <div className="w-1 h-1 rounded-full bg-primary-500/60" />
          </div>
        </div>
      </div>
    </div>
  );
}
