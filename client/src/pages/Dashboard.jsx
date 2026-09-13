import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, AreaChart, Area, Legend,
} from 'recharts';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

/* ─── helpers ──────────────────────────────────────────────── */
const fmt   = n  => (n == null ? '—' : Number(n).toLocaleString('en-IN'));
const pct   = n  => (n == null ? '—' : `${Number(n).toFixed(1)}%`);
const clamp = (v, max) => max <= 0 ? 0 : Math.min(100, Math.round((v / max) * 100));

/* Purple-only brand palette for all plan tiers */
const PLAN_COLOR = {
  free:         { accent: '#a78bfa', bg: 'bg-violet-400/10',  text: 'text-violet-300',  border: 'border-violet-400/20' },
  professional: { accent: '#8b5cf6', bg: 'bg-violet-500/10',  text: 'text-violet-400',  border: 'border-violet-500/20' },
  business:     { accent: '#7c3aed', bg: 'bg-violet-600/10',  text: 'text-violet-400',  border: 'border-violet-600/20' },
  enterprise:   { accent: '#c4b5fd', bg: 'bg-purple-400/10',  text: 'text-purple-300',  border: 'border-purple-400/20' },
};

/* ─── Feature card display map ──────────────────────────────── */
const FEATURE_META = {
  /* recipients */
  '200 recipients/day':             { title: 'Email Campaigns',      desc: 'Send up to 200/day',           icon: 'mail' },
  '5,000 recipients/day':           { title: 'Email Campaigns',      desc: 'Send up to 5,000/day',         icon: 'mail' },
  '25,000 recipients/day':          { title: 'Email Campaigns',      desc: 'Send up to 25,000/day',        icon: 'mail' },
  'Unlimited recipients/day':       { title: 'Email Campaigns',      desc: 'Unlimited daily sends',        icon: 'mail' },
  /* contacts */
  '500 contacts':                   { title: 'Contact Management',   desc: 'Up to 500 subscribers',        icon: 'users' },
  '10,000 contacts':                { title: 'Contact Management',   desc: 'Up to 10,000 subscribers',     icon: 'users' },
  '100,000 contacts':               { title: 'Contact Management',   desc: 'Up to 100,000 subscribers',    icon: 'users' },
  'Unlimited contacts':             { title: 'Contact Management',   desc: 'Unlimited subscribers',        icon: 'users' },
  /* campaigns/month */
  '5 campaigns/month':              { title: 'Campaign Sends',       desc: '5 campaigns per month',        icon: 'send' },
  '50 campaigns/month':             { title: 'Campaign Sends',       desc: '50 campaigns per month',       icon: 'send' },
  '200 campaigns/month':            { title: 'Campaign Sends',       desc: '200 campaigns per month',      icon: 'send' },
  'Unlimited campaigns':            { title: 'Campaign Sends',       desc: 'Unlimited campaigns',          icon: 'send' },
  /* senders */
  '1 email sender (SMTP)':          { title: 'SMTP Integration',     desc: '1 sending account',            icon: 'server' },
  '5 email senders (SMTP)':         { title: 'SMTP Integration',     desc: '5 sending accounts',           icon: 'server' },
  '20 email senders (SMTP)':        { title: 'SMTP Integration',     desc: '20 sending accounts',          icon: 'server' },
  'Unlimited email senders (SMTP)': { title: 'SMTP Integration',     desc: 'Unlimited accounts',           icon: 'server' },
  /* analytics */
  'Basic analytics':                { title: 'Basic Analytics',      desc: 'Opens & click tracking',       icon: 'chart' },
  'Advanced analytics':             { title: 'Advanced Analytics',   desc: 'Detailed campaign insights',   icon: 'chart' },
  'Full analytics suite':           { title: 'Full Analytics Suite', desc: 'Complete performance data',    icon: 'chart' },
  /* templates */
  'Campaign templates':             { title: 'Email Templates',      desc: 'Ready-to-use designs',         icon: 'template' },
  /* automations */
  'Email automations':              { title: 'Email Automations',    desc: 'Automated workflows',          icon: 'bolt' },
  /* support */
  'Email support':                  { title: 'Email Support',        desc: 'Support via email',            icon: 'support' },
  'Priority email support':         { title: 'Priority Support',     desc: 'Fast-track responses',         icon: 'support' },
  'Phone support':                  { title: 'Phone Support',        desc: 'Direct phone access',          icon: 'phone' },
  '24/7 support':                   { title: '24/7 Support',         desc: 'Round-the-clock help',         icon: 'support' },
  /* enterprise */
  'Dedicated IP':                   { title: 'Dedicated IP',         desc: 'Your own sending IP',          icon: 'shield' },
  'White-label option':             { title: 'White-label',          desc: 'Remove branding',              icon: 'star' },
  'SLA guarantee':                  { title: 'SLA Guarantee',        desc: 'Uptime commitment',            icon: 'shield' },
  'Dedicated account manager':      { title: 'Account Manager',      desc: 'Personal point of contact',    icon: 'user' },
};

const FEATURE_ICONS = {
  mail:     <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>,
  users:    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg>,
  send:     <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/></svg>,
  server:   <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><rect x="2" y="3" width="20" height="4" rx="1" strokeLinecap="round" strokeLinejoin="round"/><rect x="2" y="10" width="20" height="4" rx="1" strokeLinecap="round" strokeLinejoin="round"/><rect x="2" y="17" width="20" height="4" rx="1" strokeLinecap="round" strokeLinejoin="round"/><circle cx="6" cy="5" r="0.8" fill="currentColor"/><circle cx="6" cy="12" r="0.8" fill="currentColor"/><circle cx="6" cy="19" r="0.8" fill="currentColor"/></svg>,
  chart:    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>,
  template: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"/></svg>,
  bolt:     <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>,
  support:  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z"/></svg>,
  phone:    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>,
  shield:   <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"/></svg>,
  star:     <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"/></svg>,
  user:     <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"/></svg>,
};

function FeatureAccessCard({ feature, accent }) {
  const { theme } = useTheme();
  const isDark    = theme === 'dark';
  const meta  = FEATURE_META[feature];
  const title = meta?.title  || feature;
  const desc  = meta?.desc   || '';
  const icon  = FEATURE_ICONS[meta?.icon || 'mail'];

  return (
    <div className="group relative rounded-2xl overflow-hidden transition-all duration-300 hover:-translate-y-0.5"
      style={{
        background: isDark
          ? 'linear-gradient(135deg, rgba(139,92,246,0.10) 0%, rgba(109,40,217,0.06) 50%, rgba(10,5,29,0.55) 100%)'
          : 'linear-gradient(135deg, rgba(139,92,246,0.07) 0%, rgba(109,40,217,0.04) 100%)',
        border: isDark ? '1px solid rgba(139,92,246,0.18)' : '1px solid rgba(109,40,217,0.18)',
        boxShadow: isDark ? '0 2px 12px rgba(139,92,246,0.06)' : '0 2px 12px rgba(109,40,217,0.08)',
      }}
    >
      {/* top accent line */}
      <div className="absolute top-0 left-0 right-0 h-[1.5px]"
        style={{ background: `linear-gradient(90deg, transparent, ${accent}55, transparent)` }} />

      <div className="flex items-start gap-3 p-4">
        {/* icon bubble */}
        <div className="shrink-0 w-9 h-9 rounded-xl flex items-center justify-center mt-0.5"
          style={{
            background: isDark
              ? 'linear-gradient(135deg, rgba(139,92,246,0.25), rgba(109,40,217,0.12))'
              : 'linear-gradient(135deg, rgba(139,92,246,0.15), rgba(109,40,217,0.08))',
            border: '1px solid rgba(139,92,246,0.3)',
            color: isDark ? '#a78bfa' : '#7c3aed',
          }}>
          {icon}
        </div>

        {/* text */}
        <div className="flex-1 min-w-0">
          <p className={`text-[11px] font-black uppercase tracking-wider leading-tight ${isDark ? 'text-white' : 'text-gray-900'}`}>{title}</p>
          <p className="text-[10px] font-medium mt-0.5 leading-snug"
            style={{ color: isDark ? 'rgba(196,181,253,0.65)' : 'rgba(109,40,217,0.65)' }}>{desc}</p>
        </div>

        {/* check */}
        <div className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center mt-0.5"
          style={{ background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.35)' }}>
          <svg className="w-2.5 h-2.5" style={{ color: isDark ? '#a78bfa' : '#7c3aed' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
          </svg>
        </div>
      </div>

      {/* hover glow */}
      <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
        style={{ background: 'radial-gradient(circle at 50% 0%, rgba(139,92,246,0.08), transparent 70%)' }} />
    </div>
  );
}

function UsageBar({ label, used, limit, accent }) {
  const unlimited = limit === -1;
  const pctVal    = unlimited ? 0 : clamp(used, limit);
  const barColor  = pctVal > 95 ? '#ef4444' : pctVal > 80 ? '#c4b5fd' : accent;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest">{label}</p>
        <p className="text-[9px] font-black" style={{ color: barColor }}>
          {fmt(used)} / {unlimited ? '∞' : fmt(limit)}
        </p>
      </div>
      <div className="h-1.5 dark:bg-white/5 bg-violet-200/50 rounded-full overflow-hidden">
        {unlimited
          ? <div className="h-full w-full rounded-full animate-pulse" style={{ background: accent + '40' }} />
          : <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pctVal}%`, background: barColor }} />
        }
      </div>
      <p className="text-[8px] font-semibold text-gray-600">{unlimited ? 'No limit' : `${pctVal}% used`}</p>
    </div>
  );
}

function ChartTip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="card p-3 text-[10px] shadow-xl dark:border-white/10 border-violet-200 min-w-[130px]">
      <p className="font-black text-gray-400 mb-2 truncate">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2 mb-0.5">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color }} />
          <span className="text-gray-500">{p.name}:</span>
          <span className="font-black dark:text-white text-gray-900 ml-auto">{p.value}%</span>
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   DASHBOARD
═══════════════════════════════════════════════════════════ */
export default function Dashboard() {
  const { user }  = useAuth();
  const navigate  = useNavigate();

  /* ── real-time queries ── */
  const { data: overview = {} } = useQuery({
    queryKey: ['overview'],
    queryFn: () => api.get('/analytics/overview').then(r => r.data),
    refetchInterval: 30000,
  });
  const { data: billing } = useQuery({
    queryKey: ['billing'],
    queryFn: () => api.get('/subscriptions/current').then(r => r.data),
    refetchInterval: 60000,
  });
  const { data: campaigns = [] } = useQuery({
    queryKey: ['campaigns'],
    queryFn: () => api.get('/campaigns').then(r => r.data),
    refetchInterval: 30000,
  });
  const { data: automations = [] } = useQuery({
    queryKey: ['automations'],
    queryFn: () => api.get('/automations').then(r => r.data),
    refetchInterval: 30000,
  });
  const { data: analyticsAutos = [] } = useQuery({
    queryKey: ['analytics-automations'],
    queryFn: () => api.get('/analytics/automations').then(r => r.data),
    refetchInterval: 30000,
  });

  /* ── derived values (all from real API) ── */
  const plan      = billing?.plan;
  const slug      = plan?.slug || 'free';
  const pc        = PLAN_COLOR[slug] || PLAN_COLOR.professional;
  const dailySent = billing?.dailySent || 0;
  const now       = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const thisMonth  = campaigns.filter(c => c.status === 'sent' && c.sent_at >= monthStart).length;
  const sentCampaigns = campaigns.filter(c => c.status === 'sent' && c.total_sends > 0);
  const activeAutos   = automations.filter(a => a.active).length;
  const hour      = now.getHours();
  const greeting  = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const hasAuto   = ['professional', 'business', 'enterprise'].includes(slug);

  /* ── Automated vs Campaign chart (real data only) ── */
  const avgCampaignOR = parseFloat(overview.avgOpenRate || 0);
  // Use automation open rates vs avg campaign open rate
  const autoChartData = analyticsAutos
    .filter(a => (a.total_sent || 0) > 0)
    .map(a => ({
      name:        a.name.length > 14 ? a.name.slice(0, 14) + '…' : a.name,
      'Auto Open': a.delivered > 0 ? parseFloat(((a.opened / a.delivered) * 100).toFixed(1)) : 0,
    }));

  // Campaign open rate trend (fallback or side-by-side)
  const campTrend = sentCampaigns.slice(-6).map(c => {
    const base = c.delivered || c.total_sends || 0;
    return {
      name:         c.name?.length > 12 ? c.name.slice(0, 12) + '…' : c.name,
      'Open Rate':  base > 0 ? parseFloat(((c.opened  / base) * 100).toFixed(1)) : 0,
      'Click Rate': base > 0 ? parseFloat(((c.clicked / base) * 100).toFixed(1)) : 0,
    };
  });

  const showAutoChart = autoChartData.length > 0;

  /* ── Recent campaigns ── */
  const recent = [...campaigns]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 5);

  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const STATUS_CLS = {
    draft:     'bg-violet-500/10 text-violet-400 border-violet-500/20',
    scheduled: 'bg-purple-500/10 text-purple-300 border-purple-500/20',
    sending:   'bg-violet-400/10 text-violet-300 border-violet-400/20',
    sent:      'bg-violet-600/10 text-violet-400 border-violet-600/20',
    failed:    'bg-red-500/10 text-red-400 border-red-500/20',
  };

  return (
    <div className="space-y-7 pb-20 animate-fade-in">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <p className="text-[9px] font-black text-gray-500 uppercase tracking-[0.35em] mb-1">
            {now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
          <h1 className="text-2xl sm:text-3xl font-black dark:text-white text-gray-900 tracking-tight">
            {greeting},{' '}
            <span style={{ color: pc.accent }}>{user?.name || user?.email?.split('@')[0] || 'there'}</span>
          </h1>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span className={`text-[8px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg border ${pc.bg} ${pc.text} ${pc.border}`}>
              {plan?.name || 'Free'} Plan
            </span>
            {activeAutos > 0 && (
              <span className="flex items-center gap-1.5 text-[8px] font-black text-violet-400 uppercase tracking-widest">
                <span className="flex h-1.5 w-1.5 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75"/>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-violet-500"/>
                </span>
                {activeAutos} {activeAutos === 1 ? 'automation' : 'automations'} live
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2.5 flex-wrap">
          <button onClick={() => navigate('/campaigns/new')} className="btn-primary flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15"/>
            </svg>
            New Campaign
          </button>
        </div>
      </div>

      {/* ── Plan Usage ── */}
      {plan && (
        <div className={`card p-5 border ${pc.border}`}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${pc.bg} border ${pc.border}`}>
                <svg className="w-3.5 h-3.5" style={{ color: pc.accent }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
              </div>
              <p className="text-xs font-black dark:text-white text-gray-900 uppercase tracking-widest">{plan.name} Plan Usage</p>
            </div>
            {slug === 'free' && (
              <button onClick={() => navigate('/plans')} className="text-[8px] font-black text-primary-400 hover:text-primary-300 uppercase tracking-widest transition-colors">
                Upgrade →
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <UsageBar label="Recipients today"     used={dailySent}                   limit={plan.recipients_per_day}      accent={pc.accent}/>
            <UsageBar label="Total contacts"       used={overview.totalContacts || 0} limit={plan.max_contacts}            accent={pc.accent}/>
            <UsageBar label="Campaigns this month" used={thisMonth}                   limit={plan.max_campaigns_per_month} accent={pc.accent}/>
          </div>
        </div>
      )}

      {/* ── 4 KPI Cards (real data) ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Contacts',  value: fmt(overview.totalContacts),   sub: `${fmt(overview.subscribedContacts)} subscribed`,
            accent: '#a78bfa', rgb: '167,139,250', path: '/contacts',
            icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"/></svg> },
          { label: 'Avg Open Rate',   value: pct(overview.avgOpenRate),     sub: `${fmt(overview.totalOpened)} total opens`,
            accent: '#8b5cf6', rgb: '139,92,246',  path: '/analytics',
            icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z"/></svg> },
          { label: 'Today\'s Sends',  value: fmt(dailySent),                sub: plan?.recipients_per_day === -1 ? 'Unlimited plan' : `of ${fmt(plan?.recipients_per_day)} limit`,
            accent: '#7c3aed', rgb: '124,58,237',  path: '/analytics',
            icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5"/></svg> },
          { label: 'Live Automations',value: String(activeAutos),           sub: `${automations.length} total workflows`,
            accent: '#c4b5fd', rgb: '196,181,253', path: '/automations',
            icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5.636 5.636a9 9 0 1012.728 0M12 3v9"/></svg> },
        ].map(k => (
          <div key={k.label}
            onClick={() => navigate(k.path)}
            className="card p-5 flex flex-col gap-3 cursor-pointer hover:-translate-y-0.5 transition-all group"
            style={{ boxShadow: `0 4px 20px rgba(${k.rgb},.07)` }}>
            <div className="flex items-center justify-between">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                style={{ background: `rgba(${k.rgb},.12)`, border: `1px solid rgba(${k.rgb},.25)`, color: k.accent }}>
                {k.icon}
              </div>
              <svg className="w-3 h-3 text-gray-600 group-hover:text-gray-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25"/>
              </svg>
            </div>
            <div>
              <p className="text-[8px] font-black text-gray-500 uppercase tracking-widest mb-0.5">{k.label}</p>
              <p className="text-2xl font-black dark:text-white text-gray-900 leading-none">{k.value}</p>
              <p className="text-[8px] font-semibold text-gray-600 mt-0.5 leading-snug">{k.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Automated vs Campaign + Active Sequences ── */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-6">

        {/* Automated vs Campaign Open Rate */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-sm font-black dark:text-white text-gray-900 uppercase tracking-widest">
                {showAutoChart ? 'Automated vs Campaign Open Rate' : 'Campaign Engagement Trend'}
              </h3>
              <p className="text-[9px] font-bold text-primary-400 mt-0.5 uppercase tracking-widest">
                {showAutoChart ? `Avg campaign baseline: ${avgCampaignOR.toFixed(1)}%` : `Last ${campTrend.length} sent campaigns`}
              </p>
            </div>
            <button onClick={() => navigate('/analytics')}
              className="text-[8px] font-black text-primary-400 hover:text-primary-300 uppercase tracking-widest">
              Analytics →
            </button>
          </div>

          {showAutoChart ? (
            /* Real automation open rates vs campaign baseline */
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={autoChartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="autoBar" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#8b5cf6" stopOpacity={1}/>
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.4}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)'} />
                <XAxis dataKey="name" tick={{ fill: '#6b7280', fontSize: 9, fontWeight: 700 }} axisLine={false} tickLine={false}/>
                <YAxis tick={{ fill: '#6b7280', fontSize: 9 }} axisLine={false} tickLine={false} unit="%"/>
                <Tooltip content={<ChartTip />}/>
                {avgCampaignOR > 0 && (
                  <ReferenceLine y={avgCampaignOR} stroke="#c4b5fd" strokeDasharray="5 4" strokeOpacity={0.7}
                    label={{ value: `Campaign avg ${avgCampaignOR.toFixed(1)}%`, fill: '#c4b5fd', fontSize: 9, fontWeight: 700 }}/>
                )}
                <Bar dataKey="Auto Open" fill="url(#autoBar)" radius={[6, 6, 0, 0]} name="Auto Open Rate"/>
              </BarChart>
            </ResponsiveContainer>
          ) : campTrend.length > 0 ? (
            /* Campaign engagement trend when no automation data */
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={campTrend} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="gOpen" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#8b5cf6" stopOpacity={0.35}/>
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="gClick" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#a78bfa" stopOpacity={0.25}/>
                    <stop offset="95%" stopColor="#a78bfa" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)'} />
                <XAxis dataKey="name" tick={{ fill: '#6b7280', fontSize: 9, fontWeight: 700 }} axisLine={false} tickLine={false}/>
                <YAxis tick={{ fill: '#6b7280', fontSize: 9 }} axisLine={false} tickLine={false} unit="%"/>
                <Tooltip content={<ChartTip />}/>
                <Legend wrapperStyle={{ fontSize: '9px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.1em' }}/>
                <Area type="monotone" dataKey="Open Rate"  stroke="#8b5cf6" strokeWidth={2} fill="url(#gOpen)"  dot={{ fill: '#8b5cf6', r: 3 }}/>
                <Area type="monotone" dataKey="Click Rate" stroke="#a78bfa" strokeWidth={2} fill="url(#gClick)" dot={{ fill: '#a78bfa', r: 3 }}/>
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[200px] flex flex-col items-center justify-center gap-3 text-center">
              <svg className="w-10 h-10 text-gray-600 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"/>
              </svg>
              <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">No sent campaign data yet</p>
              <button onClick={() => navigate('/campaigns/new')} className="btn-primary">Create Campaign</button>
            </div>
          )}
        </div>

        {/* Active Sequences (real automations) */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-black dark:text-white text-gray-900 uppercase tracking-widest border-l-4 border-primary-500 pl-3">Automation Sequences</h3>
            <button onClick={() => navigate('/automations')}
              className="text-[8px] font-black text-primary-400 hover:text-primary-300 uppercase tracking-widest">
              Manage →
            </button>
          </div>
          {analyticsAutos.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest mb-3">No automations yet</p>
              {hasAuto
                ? <button onClick={() => navigate('/automations')} className="btn-secondary text-xs">Build First Automation</button>
                : <button onClick={() => navigate('/plans')} className="text-[8px] font-black text-primary-400 uppercase tracking-widest">Upgrade for Automations →</button>
              }
            </div>
          ) : (
            <div className="space-y-2">
              {analyticsAutos.slice(0, 6).map(a => {
                const openRate = a.delivered > 0 ? ((a.opened / a.delivered) * 100).toFixed(1) : '0';
                const clickRate = a.delivered > 0 ? ((a.clicked / a.delivered) * 100).toFixed(1) : '0';
                return (
                  <div key={a.id}
                    onClick={() => navigate('/automations')}
                    className="flex items-center gap-3 p-3 rounded-xl dark:bg-white/[0.02] bg-violet-50/60 dark:border-white/[0.04] border border-violet-200/40 hover:border-primary-500/30 cursor-pointer transition-all">
                    <span className="relative flex h-2 w-2 shrink-0">
                      {a.active && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-60"/>}
                      <span className={`relative inline-flex rounded-full h-2 w-2 ${a.active ? 'bg-violet-500' : 'bg-gray-400'}`}/>
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-black dark:text-white/80 text-gray-800 truncate">{a.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <div className="flex-1 h-1 dark:bg-white/5 bg-violet-200/50 rounded-full overflow-hidden max-w-[60px]">
                          <div className="h-full rounded-full bg-primary-500" style={{ width: `${Math.min(100, parseFloat(openRate))}%` }}/>
                        </div>
                        <span className="text-[8px] font-black text-gray-500">{openRate}% open</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-0.5 shrink-0">
                      <span className="text-[10px] font-black dark:text-white/60 text-gray-700">{fmt(a.total_sent)}</span>
                      <span className="text-[8px] font-bold text-gray-500">{clickRate}% click</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Recent Campaigns + Quick Actions ── */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_280px] gap-6">

        {/* Recent Campaigns */}
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b dark:border-white/5 border-violet-100">
            <h3 className="text-sm font-black dark:text-white text-gray-900 uppercase tracking-widest">Recent Campaigns</h3>
            <button onClick={() => navigate('/campaigns')}
              className="text-[8px] font-black text-primary-400 hover:text-primary-300 uppercase tracking-widest">
              View All →
            </button>
          </div>
          {recent.length === 0 ? (
            <div className="p-5 sm:p-10 text-center">
              <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-3">No campaigns yet</p>
              <button onClick={() => navigate('/campaigns/new')} className="btn-primary">Create First Campaign</button>
            </div>
          ) : (
            <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b dark:border-white/[0.04] border-violet-100">
                  {['Campaign', 'Status', 'Sent', 'Open Rate'].map((h, i) => (
                    <th key={h} className={`text-[8px] font-black text-gray-500 uppercase tracking-widest py-3 px-5 text-left ${i === 3 ? 'text-right' : ''}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="dark:divide-y dark:divide-white/[0.03] divide-y divide-violet-50">
                {recent.map(c => {
                  const den = c.delivered || c.total_sends || 0;
                  const or  = den > 0 ? ((c.opened / den) * 100).toFixed(1) : '0.0';
                  return (
                    <tr key={c.id} onClick={() => navigate(`/campaigns/${c.id}`)}
                      className="dark:hover:bg-white/[0.015] hover:bg-violet-50/60 cursor-pointer transition-colors">
                      <td className="py-3 px-5">
                        <p className="text-[11px] font-black dark:text-white text-gray-900 truncate max-w-[200px]">{c.name}</p>
                        <p className="text-[9px] text-gray-500 truncate max-w-[200px]">{c.subject}</p>
                      </td>
                      <td className="py-3 px-5">
                        <span className={`text-[8px] font-black px-2 py-0.5 rounded-lg border uppercase tracking-wider ${STATUS_CLS[c.status] || STATUS_CLS.draft}`}>{c.status}</span>
                      </td>
                      <td className="py-3 px-5 text-[11px] font-bold text-gray-500">{fmt(c.total_sends)}</td>
                      <td className="py-3 px-5 text-right">
                        <span className={`text-[11px] font-black ${parseFloat(or) > 30 ? 'text-violet-300' : parseFloat(or) > 15 ? 'text-violet-400' : 'text-gray-500'}`}>{or}%</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="flex flex-col gap-2.5">
          <h3 className="text-sm font-black dark:text-white text-gray-900 uppercase tracking-widest px-1">Quick Actions</h3>
          {[
            { label: 'Build Automation',  desc: 'Create email workflow',  path: '/automations',  color: '#8b5cf6', rgb: '139,92,246',  locked: !hasAuto,
              icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg> },
            { label: 'Add Contacts',      desc: 'Import subscribers',     path: '/contacts',     color: '#a78bfa', rgb: '167,139,250', locked: false,
              icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg> },
            { label: 'New Template',      desc: 'Design email layout',    path: '/templates',    color: '#7c3aed', rgb: '124,58,237',  locked: false,
              icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"/></svg> },
            { label: 'Launch Campaign',   desc: 'Send a broadcast',       path: '/campaigns/new',color: '#6d28d9', rgb: '109,40,217',  locked: false,
              icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/></svg> },
            { label: 'View Analytics',    desc: 'Track performance',      path: '/analytics',    color: '#c4b5fd', rgb: '196,181,253', locked: false,
              icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg> },
          ].map(q => (
            <button key={q.path}
              onClick={() => navigate(q.locked ? '/plans' : q.path)}
              className="card p-3.5 flex items-center gap-3 text-left hover:-translate-y-0.5 transition-all group relative overflow-hidden">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-colors"
                style={{ background: `rgba(${q.rgb},.12)`, border: `1px solid rgba(${q.rgb},.25)`, color: q.color }}>
                {q.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-black dark:text-white text-gray-900 uppercase tracking-wider">{q.label}</p>
                <p className="text-[8px] font-semibold text-gray-500 leading-snug">{q.desc}</p>
              </div>
              {q.locked
                ? <span className="text-[7px] font-black text-primary-400 border border-primary-500/30 px-1.5 py-0.5 rounded-lg uppercase tracking-wider shrink-0">Pro+</span>
                : <svg className="w-3.5 h-3.5 text-gray-600 group-hover:text-gray-300 transition-colors shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5"/></svg>
              }
              <div className="absolute bottom-0 left-0 h-0.5 w-0 group-hover:w-full transition-all duration-300" style={{ background: q.color }}/>
            </button>
          ))}
        </div>
      </div>

      {/* ── Feature Access Cards ── */}
      {plan && plan.features?.length > 0 && (
        <div className="rounded-2xl overflow-hidden"
          style={{
            background: isDark
              ? 'linear-gradient(160deg, rgba(88,28,220,0.08) 0%, rgba(10,5,29,0.92) 60%)'
              : 'linear-gradient(160deg, rgba(109,40,217,0.06) 0%, rgba(139,92,246,0.03) 100%)',
            border: isDark ? '1px solid rgba(139,92,246,0.15)' : '1px solid rgba(109,40,217,0.15)',
          }}
        >
          {/* header */}
          <div className="flex items-center justify-between px-6 py-4"
            style={{
              borderBottom: isDark ? '1px solid rgba(139,92,246,0.1)' : '1px solid rgba(109,40,217,0.10)',
              background: isDark ? 'rgba(139,92,246,0.04)' : 'rgba(109,40,217,0.04)',
            }}>
            <div>
              <p className={`text-sm font-black uppercase tracking-widest ${isDark ? 'text-white' : 'text-gray-900'}`}>Feature Access</p>
              <p className="text-[10px] font-medium mt-0.5"
                style={{ color: isDark ? 'rgba(196,181,253,0.6)' : 'rgba(109,40,217,0.65)' }}>
                What's included in your {plan.name} plan
              </p>
            </div>
            <button onClick={() => navigate('/plans')}
              className="text-[9px] font-black uppercase tracking-widest transition-colors hover:opacity-80"
              style={{ color: '#a78bfa' }}>
              Manage Plan →
            </button>
          </div>

          {/* card grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 p-5">
            {plan.features.map((f, i) => (
              <FeatureAccessCard key={i} feature={f} accent={pc.accent} />
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
