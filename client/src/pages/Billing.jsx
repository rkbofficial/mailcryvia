import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';

const PLAN_ACCENT = {
  free: '#22c55e', professional: '#8b5cf6', business: '#3b82f6', enterprise: '#f59e0b',
};

const REQ_STATUS = {
  pending:  'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30',
  approved: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
  rejected: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30',
};

const SUB_STATUS = {
  active:    'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
  cancelled: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30',
  expired:   'bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/30',
};

export default function Billing() {
  const { user } = useAuth();

  const { data: billing, isLoading } = useQuery({
    queryKey: ['billing'],
    queryFn: () => api.get('/subscriptions/current').then(r => r.data),
    refetchInterval: 30000,
  });

  const { data: myRequests = [] } = useQuery({
    queryKey: ['my-requests'],
    queryFn: () => api.get('/subscriptions/my-requests').then(r => r.data),
    // Poll faster when a request is pending (waiting for admin approval)
    refetchInterval: (query) => {
      const data = query.state.data;
      return Array.isArray(data) && data.some(r => r.status === 'pending') ? 15000 : 60000;
    },
  });

  if (isLoading) return <LoadingSpinner />;

  const planSlug   = billing?.plan?.slug || 'free';
  const accent     = PLAN_ACCENT[planSlug] || PLAN_ACCENT.professional;
  const dailySent  = billing?.dailySent ?? 0;
  const dailyLimit = billing?.plan?.recipients_per_day ?? 200;
  const usagePct   = dailyLimit === -1 ? 0 : Math.min(100, Math.round((dailySent / (dailyLimit || 1)) * 100));
  const history    = billing?.history ?? [];
  const isExpired  = billing?.user?.plan_expires_at
    ? new Date(billing.user.plan_expires_at) < new Date()
    : false;

  return (
    <div className="space-y-8 pb-20 animate-fade-in">
      <div>
        <h1 className="text-2xl sm:text-3xl font-black dark:text-white text-gray-900 tracking-tight uppercase">Billing</h1>
        <p className="text-[10px] font-bold text-primary-500 uppercase tracking-[0.3em] mt-1">Your plan, usage and payment history</p>
      </div>

      {/* Current Plan + Usage */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="card p-6 lg:col-span-2">
          <p className="text-xs font-black text-gray-600 dark:text-gray-500 uppercase tracking-widest mb-5">Current Plan</p>
          <div className="flex items-center gap-5">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0" style={{ background: accent + '18' }}>
              <svg className="w-7 h-7" style={{ color: accent }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap mb-1">
                <h2 className="text-2xl font-black" style={{ color: accent }}>{billing?.plan?.name || 'Free'}</h2>
                <span className={`text-xs font-black uppercase tracking-widest px-2.5 py-1 rounded-lg border ${isExpired ? 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30' : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'}`}>
                  {isExpired ? 'Expired' : 'Active'}
                </span>
              </div>
              <p className="text-3xl font-black" style={{ color: accent }}>
                {billing?.plan?.price_inr === 0 ? 'Free' : `₹${billing?.plan?.price_inr?.toLocaleString('en-IN')}`}
                {billing?.plan?.price_inr > 0 && <span className="text-sm text-gray-500 font-bold ml-1">/month</span>}
              </p>
              {billing?.user?.plan_expires_at && (
                <p className="text-xs font-bold text-gray-600 dark:text-gray-500 uppercase tracking-widest mt-1.5">
                  Expires {new Date(billing.user.plan_expires_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
              )}
            </div>
          </div>
          <Link to="/plans" className="mt-5 btn-primary">View All Plans →</Link>
        </div>

        <div className="card p-6 flex flex-col justify-between">
          <div>
            <p className="text-xs font-black text-gray-600 dark:text-gray-500 uppercase tracking-widest mb-4">Today's Sends</p>
            <p className="text-5xl font-black" style={{ color: accent }}>{dailySent.toLocaleString()}</p>
            <p className="text-sm font-semibold text-gray-600 dark:text-gray-500 mt-1">
              of {dailyLimit === -1 ? '∞ unlimited' : dailyLimit.toLocaleString()} allowed
            </p>
            {dailyLimit !== -1 && (
              <div className="mt-4">
                <div className="h-3 bg-black/10 dark:bg-white/5 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${usagePct}%`, background: usagePct > 90 ? '#ef4444' : usagePct > 70 ? '#f59e0b' : accent }}
                  />
                </div>
                <p className={`text-xs font-black uppercase tracking-widest mt-1.5 ${usagePct > 90 ? 'text-red-500' : 'text-gray-600 dark:text-gray-500'}`}>
                  {usagePct}% used
                </p>
              </div>
            )}
          </div>
          {billing?.plan?.price_inr === 0 && (
            <Link to="/plans" className="btn-primary w-full mt-5 justify-center">Upgrade Now</Link>
          )}
        </div>
      </div>

      {/* Account Info */}
      <div className="card p-6">
        <p className="text-xs font-black text-gray-600 dark:text-gray-500 uppercase tracking-widest mb-5">Account</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <div>
            <p className="text-xs font-black text-gray-600 dark:text-gray-500 uppercase tracking-widest mb-1.5">Email</p>
            <p className="text-sm font-bold dark:text-white text-gray-900">{user?.email}</p>
          </div>
          <div>
            <p className="text-xs font-black text-gray-600 dark:text-gray-500 uppercase tracking-widest mb-1.5">Name</p>
            <p className="text-sm font-bold dark:text-white text-gray-900">{user?.name || '—'}</p>
          </div>
          <div>
            <p className="text-xs font-black text-gray-600 dark:text-gray-500 uppercase tracking-widest mb-1.5">Member since</p>
            <p className="text-sm font-bold dark:text-white text-gray-900">
              {billing?.user?.created_at
                ? new Date(billing.user.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
                : '—'}
            </p>
          </div>
        </div>
      </div>

      {/* Payment Requests */}
      {myRequests.length > 0 && (
        <div>
          <h2 className="text-base font-black dark:text-white text-gray-900 uppercase tracking-widest mb-4">Payment Requests</h2>
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-black/5 dark:border-white/5">
                    {['Date', 'Plan', 'Amount', 'Method', 'Txn ID', 'Status'].map(h => (
                      <th key={h} className="text-xs font-black text-gray-600 dark:text-gray-500 uppercase tracking-widest py-4 px-5 text-left">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/[0.04] dark:divide-white/[0.03]">
                  {myRequests.map(req => (
                    <tr key={req.id} className="hover:bg-black/[0.015] dark:hover:bg-white/[0.015]">
                      <td className="py-4 px-5 text-sm font-bold text-gray-700 dark:text-gray-400 whitespace-nowrap">
                        {new Date(req.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="py-4 px-5 text-sm font-black dark:text-white text-gray-900">{req.plan_name}</td>
                      <td className="py-4 px-5 text-sm font-black text-primary-500">₹{(req.amount || 0).toLocaleString('en-IN')}</td>
                      <td className="py-4 px-5 text-xs font-bold text-gray-500 uppercase">{req.payment_method || 'upi'}</td>
                      <td className="py-4 px-5 text-xs font-mono text-gray-600 dark:text-gray-400 max-w-[120px] truncate">{req.transaction_id}</td>
                      <td className="py-4 px-5">
                        <span className={`text-xs font-black px-2.5 py-1 rounded-lg border uppercase tracking-widest ${REQ_STATUS[req.status] || REQ_STATUS.pending}`}>
                          {req.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          {myRequests.some(r => r.status === 'pending') && (
            <p className="text-xs font-semibold text-gray-500 mt-2 pl-1">Pending requests are usually verified within 24 hours.</p>
          )}
        </div>
      )}

      {/* Payment History */}
      <div>
        <h2 className="text-base font-black dark:text-white text-gray-900 uppercase tracking-widest mb-4">Payment History</h2>
        {history.length === 0 ? (
          <div className="card p-6 sm:p-12 flex flex-col items-center gap-4 text-center">
            <svg className="w-12 h-12 text-gray-400 dark:text-gray-600 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z"/>
            </svg>
            <p className="text-sm font-black text-gray-600 dark:text-gray-500 uppercase tracking-widest">No payment history yet</p>
            <Link to="/plans" className="btn-primary mt-1">View Plans</Link>
          </div>
        ) : (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-black/5 dark:border-white/5">
                    {['Date', 'Plan', 'Status', 'Expires', 'Amount'].map((h, i) => (
                      <th key={h} className={`text-xs font-black text-gray-600 dark:text-gray-500 uppercase tracking-widest py-4 px-6 ${i === 4 ? 'text-right' : 'text-left'}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/[0.04] dark:divide-white/[0.03]">
                  {history.map(sub => (
                    <tr key={sub.id} className="hover:bg-black/[0.015] dark:hover:bg-white/[0.015]">
                      <td className="py-4 px-6 text-sm font-bold text-gray-700 dark:text-gray-400 whitespace-nowrap">
                        {new Date(sub.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="py-4 px-6 text-sm font-black dark:text-white text-gray-900">{sub.plan_name}</td>
                      <td className="py-4 px-6">
                        <span className={`text-xs font-black px-2.5 py-1 rounded-lg border uppercase tracking-widest ${SUB_STATUS[sub.status] || SUB_STATUS.active}`}>
                          {sub.status}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-sm font-bold text-gray-700 dark:text-gray-400">
                        {sub.expires_at ? new Date(sub.expires_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                      </td>
                      <td className="py-4 px-6 text-sm font-black text-right" style={{ color: accent }}>
                        {sub.amount_paid === 0 ? 'Free' : `₹${sub.amount_paid.toLocaleString('en-IN')}`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
