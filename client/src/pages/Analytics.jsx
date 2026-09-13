import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import LoadingSpinner from '../components/LoadingSpinner';
import StatCard from '../components/StatCard';
import EmptyState from '../components/EmptyState';
import { useTheme } from '../context/ThemeContext';
import { downloadCsv } from '../utils/exportCsv';
import toast from 'react-hot-toast';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, RadarChart, Radar, PolarGrid, PolarAngleAxis } from 'recharts';
import { format } from 'date-fns';

function AutomationDetailModal({ automationId, onClose }) {
  const { data, isLoading } = useQuery({
    queryKey: ['automation-detail', automationId],
    queryFn: () => api.get(`/analytics/automation/${automationId}`).then(r => r.data),
    enabled: !!automationId,
    refetchInterval: 15000,
  });

  if (!automationId) return null;

  return (
    <div className="fixed inset-0 lg:left-72 z-50 flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
      <div className="absolute inset-0 bg-[#0d0928]/85 backdrop-blur-sm" />
      <div
        className="relative z-10 w-full max-w-5xl max-h-[90vh] flex flex-col card shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-8 py-5 border-b border-black/5 dark:border-white/[0.05] shrink-0">
          <div>
            <h2 className="text-sm font-black dark:text-white text-gray-900 uppercase tracking-widest">
              {data?.automation?.name || 'Automation Detail'}
            </h2>
            <p className="text-[10px] font-bold text-primary-500 uppercase tracking-[0.3em] mt-0.5">
              {data?.automation?.list_name && `List: ${data.automation.list_name}`}
              {data?.automation?.template_name && ` · Template: ${data.automation.template_name}`}
            </p>
          </div>
          <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-xl bg-black/5 dark:bg-white/5 hover:bg-black/10 text-gray-500 transition-all">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center"><LoadingSpinner /></div>
        ) : (
          <div className="flex-1 min-h-0 overflow-auto p-8 space-y-8">
            {/* Stats */}
            <div className="grid grid-cols-2 min-[480px]:grid-cols-3 sm:grid-cols-6 gap-3">
              <StatCard compact label="Total Sent" value={data?.stats?.total_sent || 0} color="blue" />
              <StatCard compact label="Delivered" value={data?.stats?.delivered || 0} color="green" />
              <StatCard compact label="Opened" value={data?.stats?.opened || 0} color="purple"
                sub={data?.stats?.delivered > 0 ? `${((data.stats.opened / data.stats.delivered) * 100).toFixed(1)}%` : '0%'} />
              <StatCard compact label="Clicked" value={data?.stats?.clicked || 0} color="orange"
                sub={data?.stats?.delivered > 0 ? `${((data.stats.clicked / data.stats.delivered) * 100).toFixed(1)}%` : '0%'} />
              <StatCard compact label="Bounced" value={data?.stats?.bounced || 0} color="red" />
              <StatCard compact label="Unsubs" value={data?.stats?.unsubscribed || 0} color="red" />
            </div>

            {/* Per-contact send log */}
            {data?.sends?.length > 0 && (
              <div className="card border-none overflow-hidden">
                <div className="px-8 py-5 border-b border-black/5 dark:border-white/[0.02] bg-black/5 dark:bg-black/20">
                  <h3 className="text-xs font-black dark:text-white text-gray-900 uppercase tracking-widest">Recipient Activity</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="text-left text-[10px] font-black text-gray-500 uppercase tracking-widest bg-black/5 dark:bg-black/20">
                        <th className="px-8 py-4">Recipient</th>
                        <th className="px-8 py-4">Status</th>
                        <th className="px-8 py-4">Sent</th>
                        <th className="px-8 py-4">Opened</th>
                        <th className="px-8 py-4">Clicked</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black/5 dark:divide-white/[0.02]">
                      {data.sends.map(s => (
                        <tr key={s.id} className="hover:bg-primary-500/5 transition-all">
                          <td className="px-8 py-4">
                            <p className="text-[11px] font-black dark:text-white text-gray-900 uppercase tracking-wider">{s.first_name} {s.last_name}</p>
                            <p className="text-[9px] font-mono text-primary-400 mt-0.5">{s.contact_email}</p>
                          </td>
                          <td className="px-8 py-4">
                            <span className={`badge ${s.status === 'sent' ? 'badge-green' : s.status === 'failed' ? 'badge-red' : 'badge-gray'}`}>{s.status}</span>
                          </td>
                          <td className="px-8 py-4 text-[10px] font-black text-gray-500 text-mono">{s.sent_at ? format(new Date(s.sent_at), 'MMM d, HH:mm') : '—'}</td>
                          <td className="px-8 py-4 text-[10px] font-black text-gray-500 text-mono">{s.opened_at ? format(new Date(s.opened_at), 'HH:mm:ss') : '—'}</td>
                          <td className="px-8 py-4 text-[10px] font-black text-gray-500 text-mono">{s.clicked_at ? format(new Date(s.clicked_at), 'HH:mm:ss') : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function Analytics() {
  const { theme } = useTheme();
  const [exporting, setExporting] = useState('');
  const [selectedAutomation, setSelectedAutomation] = useState(null);

  const { data: overview, isLoading: l1 } = useQuery({
    queryKey: ['analytics-overview'], queryFn: () => api.get('/analytics/overview').then(r => r.data),
    refetchInterval: 30000,
  });
  const { data: campaigns, isLoading: l2 } = useQuery({
    queryKey: ['analytics-campaigns'], queryFn: () => api.get('/analytics/campaigns').then(r => r.data),
    refetchInterval: 30000,
  });
  const { data: automations, isLoading: l3 } = useQuery({
    queryKey: ['analytics-automations'], queryFn: () => api.get('/analytics/automations').then(r => r.data),
    refetchInterval: 30000,
  });
  const { data: billing } = useQuery({
    queryKey: ['billing'], queryFn: () => api.get('/subscriptions/current').then(r => r.data),
  });
  const navigate = useNavigate();

  if (l1 || l2 || l3) return <LoadingSpinner />;

  const planSlug = billing?.plan?.slug || 'free';
  const isPro = ['professional', 'business', 'enterprise'].includes(planSlug);
  const isBusiness = ['business', 'enterprise'].includes(planSlug);

  const chartData = (campaigns || []).map(c => ({
    name: c.name.length > 12 ? c.name.slice(0, 12) + '…' : c.name,
    openRate: c.delivered > 0 ? parseFloat(((c.opened / c.delivered) * 100).toFixed(1)) : 0,
    ctr: c.delivered > 0 ? parseFloat(((c.clicked / c.delivered) * 100).toFixed(1)) : 0,
    delivered: c.delivered || 0,
  }));

  const top5 = [...chartData].sort((a, b) => b.openRate - a.openRate).slice(0, 5);
  const totalSends = overview?.totalSends || 0;
  const totalBounced = overview?.totalBounced || 0;
  const totalAttempts = totalSends + totalBounced;
  const bounceRate = totalAttempts > 0 ? ((totalBounced / totalAttempts) * 100).toFixed(1) : '0.0';
  const chartGridStroke = theme === 'dark' ? 'rgba(148,163,184,0.16)' : 'rgba(71,85,105,0.14)';
  const chartTickColor = theme === 'dark' ? '#cbd5e1' : '#475569';

  const exportOptions = [
    { label: 'Analytics', path: '/analytics/export', filename: 'analytics-export.csv' },
    { label: 'Campaigns', path: '/campaigns/export', filename: 'campaigns-export.csv' },
    { label: 'Contacts', path: '/contacts/export', filename: 'contacts-export.csv' },
    { label: 'Lists', path: '/lists/export', filename: 'lists-export.csv' },
    { label: 'Templates', path: '/templates/export', filename: 'templates-export.csv' },
  ];

  const handleExport = async (option) => {
    setExporting(option.label);
    try {
      await downloadCsv(option.path, option.filename);
      toast.success(`${option.label} export downloaded`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Export failed');
    } finally {
      setExporting('');
    }
  };

  return (
    <div className="space-y-10 pb-24 animate-fade-in">
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-end gap-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black dark:text-white text-gray-900 tracking-tight uppercase">Analytics</h1>
          <p className="text-[10px] font-bold text-primary-500 uppercase tracking-[0.3em] mt-1">Campaign performance and engagement tracking</p>
        </div>
        <div className="card p-3 flex flex-wrap gap-2">
          {exportOptions.map((option) => (
            <button
              key={option.path}
              className="btn-secondary"
              onClick={() => handleExport(option)}
              disabled={Boolean(exporting)}
            >
              {exporting === option.label ? 'EXPORTING...' : `EXPORT ${option.label}`}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4 xl:gap-6">
        <StatCard label="Total Delivered" value={totalSends} color="blue" />
        <StatCard label="Total Opened" value={overview?.totalOpened || 0} color="green" />
        <StatCard label="Open Rate" value={`${overview?.avgOpenRate || 0}%`} color="purple" />
        <StatCard label="Click Rate" value={`${overview?.avgCTR || 0}%`} color="orange" />
        <StatCard label="Bounce Rate" value={`${bounceRate}%`} color="red" />
        <StatCard label="Campaigns Sent" value={overview?.campaignsSent || 0} color="blue" />
      </div>

      {chartData.length === 0 ? (
        <EmptyState title="No Data Available" description="Send a campaign to start tracking engagement analytics." />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="card p-5 sm:p-10 border-none shadow-2xl relative overflow-hidden">
            <div className="absolute inset-0 tech-grid opacity-10 pointer-events-none" />
            <h2 className="text-[11px] font-black dark:text-white text-gray-900 uppercase tracking-widest mb-10 relative z-10">Engagement Over Time</h2>
            <div className="h-80 relative z-10">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartGridStroke} vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: chartTickColor, fontWeight: 800 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: chartTickColor, fontWeight: 800 }} unit="%" axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: theme === 'dark' ? '#0a051d' : '#ffffff', borderRadius: '1.5rem', border: theme === 'dark' ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(109,40,217,0.15)', boxShadow: '0 20px 50px rgba(0,0,0,0.4)' }}
                    itemStyle={{ fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em' }}
                    labelStyle={{ display: 'none' }}
                  />
                  <Line type="monotone" dataKey="openRate" stroke="#8b5cf6" strokeWidth={4} dot={{ fill: '#8b5cf6', r: 6, strokeWidth: 2, stroke: '#fff' }} name="OPEN RATE" />
                  <Line type="monotone" dataKey="ctr" stroke="#f59e0b" strokeWidth={4} dot={{ fill: '#f59e0b', r: 6, strokeWidth: 2, stroke: '#fff' }} name="CLICK RATE" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card p-5 sm:p-10 border-none shadow-2xl relative overflow-hidden">
            <div className="absolute inset-0 tech-grid opacity-10 pointer-events-none" />
            <h2 className="text-[11px] font-black dark:text-white text-gray-900 uppercase tracking-widest mb-10 relative z-10">Top Performing Campaigns</h2>
            <div className="h-80 relative z-10">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={top5}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartGridStroke} vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: chartTickColor, fontWeight: 800 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: chartTickColor, fontWeight: 800 }} unit="%" axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: theme === 'dark' ? '#0a051d' : '#ffffff', borderRadius: '1.5rem', border: '1px solid rgba(255,255,255,0.1)' }}
                    itemStyle={{ fontSize: '10px', fontWeight: 900, textTransform: 'uppercase' }}
                    labelStyle={{ display: 'none' }}
                  />
                  <Bar dataKey="openRate" fill="url(#colorBar)" radius={[12, 12, 0, 0]} name="OPEN RATE">
                    <defs>
                      <linearGradient id="colorBar" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#8b5cf6" stopOpacity={1}/>
                        <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.4}/>
                      </linearGradient>
                    </defs>
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Campaign Performance Log */}
          <div className="lg:col-span-2 card border-none shadow-2xl relative overflow-hidden">
            <div className="absolute inset-0 tech-grid opacity-10 pointer-events-none" />
            <div className="px-4 sm:px-8 py-4 sm:py-6 border-b border-black/5 dark:border-white/[0.02] bg-black/5 dark:bg-black/20 relative z-10">
              <h2 className="text-xs font-black dark:text-white text-gray-900 uppercase tracking-widest">Campaign Performance Log</h2>
            </div>
            <div className="overflow-x-auto relative z-10">
              <table className="w-full">
                <thead>
                  <tr className="bg-black/5 dark:bg-black/40 text-left text-[10px] font-black text-gray-500 uppercase tracking-widest whitespace-nowrap">
                    <th className="px-10 py-5">Campaign Name</th>
                    <th className="px-10 py-5">Sent</th>
                    <th className="px-10 py-5">Delivered</th>
                    <th className="px-10 py-5">Opened</th>
                    <th className="px-10 py-5">Clicked</th>
                    <th className="px-10 py-5">Bounced</th>
                    <th className="px-10 py-5">Unsubs</th>
                    <th className="px-10 py-5 text-right">Open Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5 dark:divide-white/[0.02]">
                  {(campaigns || []).map(c => {
                    const openRate = c.delivered > 0 ? ((c.opened / c.delivered) * 100).toFixed(1) : '0.0';
                    return (
                      <tr key={c.id} className="hover:bg-primary-500/5 transition-all whitespace-nowrap">
                        <td className="px-10 py-6 text-xs font-black dark:text-white text-gray-900 uppercase tracking-widest">{c.name}</td>
                        <td className="px-10 py-6 text-[10px] font-black text-primary-400 text-mono">{c.total_sends}</td>
                        <td className="px-10 py-6 text-[10px] font-black text-emerald-400 text-mono">{c.delivered}</td>
                        <td className="px-10 py-6 text-[10px] font-black text-gray-900 dark:text-white text-mono">
                          <div className="flex items-center gap-2">
                            <span>{c.opened}</span>
                            <div className="w-12 h-1 bg-black/10 dark:bg-white/10 rounded-full overflow-hidden">
                              <div className="h-full bg-primary-500" style={{ width: `${(c.opened / (c.delivered || 1)) * 100}%` }} />
                            </div>
                          </div>
                        </td>
                        <td className="px-10 py-6 text-[10px] font-black text-amber-400 text-mono">{c.clicked}</td>
                        <td className="px-10 py-6 text-[10px] font-black text-red-500 text-mono">{c.bounced}</td>
                        <td className="px-10 py-6 text-[10px] font-black text-gray-600 dark:text-gray-400 text-mono">{c.unsubscribed}</td>
                        <td className="px-10 py-6 text-[10px] font-black text-primary-400 text-mono text-right">{openRate}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Sequence Performance (Professional+) ── */}
      {!isPro ? (
        <div className="card p-8 flex flex-col sm:flex-row items-center gap-6 border border-violet-500/20 bg-violet-500/5">
          <div className="w-14 h-14 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center shrink-0">
            <svg className="w-7 h-7 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9.348 14.651a3.75 3.75 0 010-5.303m5.304-.001a3.75 3.75 0 010 5.304m-7.425 2.122a6.75 6.75 0 010-9.546m9.546 0a6.75 6.75 0 010 9.546M12 12h.008v.008H12V12z"/></svg>
          </div>
          <div className="flex-1 text-center sm:text-left">
            <p className="text-xs font-black text-violet-400 uppercase tracking-widest mb-1">Professional Feature</p>
            <h3 className="text-base font-black dark:text-white text-gray-900 uppercase tracking-widest">Sequence Performance</h3>
            <p className="text-xs font-semibold text-gray-500 mt-1">Detailed open/click rates per automation workflow — upgrade to Professional to unlock.</p>
          </div>
          <button onClick={() => navigate('/plans')} className="shrink-0 px-6 py-3 text-xs font-black uppercase tracking-widest rounded-xl bg-violet-500 hover:bg-violet-400 text-white transition-all">
            Upgrade to Pro →
          </button>
        </div>
      ) : automations && automations.length > 0 && (
        <div className="card border-none shadow-2xl relative overflow-hidden">
          <div className="absolute inset-0 tech-grid opacity-10 pointer-events-none" />
          <div className="px-4 sm:px-8 py-4 sm:py-6 border-b border-black/5 dark:border-white/[0.02] bg-black/5 dark:bg-black/20 relative z-10 flex items-center justify-between">
            <div>
              <h2 className="text-xs font-black dark:text-white text-gray-900 uppercase tracking-widest">Sequence Performance</h2>
              <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mt-1">Open & click rate by automation workflow</p>
            </div>
          </div>
          <div className="p-5 sm:p-10 space-y-5 relative z-10">
            {automations.filter(a => (a.total_sent || 0) > 0).length === 0 ? (
              <p className="text-center text-[10px] font-black text-gray-600 uppercase tracking-widest py-4 opacity-50">No automation sends yet</p>
            ) : automations.filter(a => (a.total_sent || 0) > 0).map(a => {
              const openRate  = a.delivered > 0 ? parseFloat(((a.opened  / a.delivered) * 100).toFixed(1)) : 0;
              const clickRate = a.delivered > 0 ? parseFloat(((a.clicked / a.delivered) * 100).toFixed(1)) : 0;
              const bounceRate= a.delivered > 0 ? parseFloat(((a.bounced / (a.total_sent||1)) * 100).toFixed(1)) : 0;
              return (
                <div key={a.id} className="space-y-2.5">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2.5">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${a.active ? 'bg-emerald-500' : 'bg-gray-500'}`}/>
                      <span className="text-[11px] font-black dark:text-white text-gray-900 uppercase tracking-wider">{a.name}</span>
                      <span className={`text-[8px] font-black px-2 py-0.5 rounded-full border uppercase tracking-wider ${a.active ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-gray-500/10 text-gray-400 border-gray-500/20'}`}>{a.active ? 'Active' : 'Paused'}</span>
                    </div>
                    <div className="flex gap-4 text-[9px] font-black">
                      <span className="text-primary-400">{openRate}% open</span>
                      <span className="text-amber-400">{clickRate}% click</span>
                      <span className="text-red-400">{bounceRate}% bounce</span>
                      <span className="text-gray-500">{(a.total_sent||0).toLocaleString()} sent</span>
                    </div>
                  </div>
                  <div className="flex gap-1 h-2.5 rounded-full overflow-hidden bg-white/5">
                    <div className="h-full rounded-l-full transition-all duration-700"
                      style={{ width: `${openRate}%`, background: openRate > 40 ? '#10b981' : openRate > 20 ? '#f59e0b' : '#ef4444', maxWidth: '70%' }}/>
                    <div className="h-full transition-all duration-700 opacity-60"
                      style={{ width: `${clickRate}%`, background: '#3b82f6', maxWidth: '20%' }}/>
                    <div className="h-full rounded-r-full transition-all duration-700 opacity-50"
                      style={{ width: `${bounceRate}%`, background: '#ef4444', maxWidth: '10%' }}/>
                  </div>
                  <div className="flex gap-4">
                    <span className="flex items-center gap-1 text-[8px] font-bold text-gray-500"><span className="w-2 h-2 rounded-sm" style={{ background: openRate > 40 ? '#10b981' : openRate > 20 ? '#f59e0b' : '#ef4444' }}/>Open</span>
                    <span className="flex items-center gap-1 text-[8px] font-bold text-gray-500"><span className="w-2 h-2 rounded-sm bg-blue-500 opacity-60"/>Click</span>
                    <span className="flex items-center gap-1 text-[8px] font-bold text-gray-500"><span className="w-2 h-2 rounded-sm bg-red-500 opacity-50"/>Bounce</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Subscriber Lifecycle + Recent Activity (Professional+) ── */}
      {isPro && <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

        {/* Subscriber Lifecycle (real overview data) */}
        <div className="card border-none shadow-2xl relative overflow-hidden">
          <div className="absolute inset-0 tech-grid opacity-10 pointer-events-none" />
          <div className="px-4 sm:px-8 py-4 sm:py-6 border-b border-black/5 dark:border-white/[0.02] bg-black/5 dark:bg-black/20 relative z-10">
            <h2 className="text-[11px] font-black dark:text-white text-gray-900 uppercase tracking-widest">Subscriber Lifecycle</h2>
            <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mt-1">Contact & engagement distribution</p>
          </div>
          <div className="p-5 sm:p-10 space-y-5 relative z-10">
            {[
              { label: 'Total Contacts',  count: overview?.totalContacts || 0,    color: '#8b5cf6', base: overview?.totalContacts || 1, note: '100% base' },
              { label: 'Subscribed',      count: overview?.subscribedContacts || 0,color: '#14b8a6', base: overview?.totalContacts || 1, note: 'of total contacts' },
              { label: 'Total Emails Sent',count: overview?.totalSends || 0,      color: '#f59e0b', base: overview?.totalSends || 1,   note: 'all time' },
              { label: 'Total Opened',    count: overview?.totalOpened || 0,      color: '#10b981', base: overview?.totalSends || 1,   note: 'of emails sent' },
              { label: 'Total Clicked',   count: overview?.totalClicked || 0,     color: '#3b82f6', base: overview?.totalSends || 1,   note: 'of emails sent' },
              { label: 'Bounced',         count: overview?.totalBounced || 0,     color: '#ef4444', base: overview?.totalSends || 1,   note: 'of emails sent' },
            ].map(s => {
              const p = s.base > 0 ? Math.min(100, Math.round((s.count / s.base) * 100)) : 0;
              return (
                <div key={s.label} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">{s.label}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-[9px] font-black" style={{ color: s.color }}>{s.count.toLocaleString()}</span>
                      <span className="text-[8px] font-bold text-gray-600 w-10 text-right">{p}%</span>
                    </div>
                  </div>
                  <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-700" style={{ width: `${p}%`, background: s.color }}/>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent Activity (from real campaigns + automations) */}
        <div className="card border-none shadow-2xl relative overflow-hidden">
          <div className="absolute inset-0 tech-grid opacity-10 pointer-events-none" />
          <div className="px-4 sm:px-8 py-4 sm:py-6 border-b border-black/5 dark:border-white/[0.02] bg-black/5 dark:bg-black/20 relative z-10">
            <h2 className="text-[11px] font-black dark:text-white text-gray-900 uppercase tracking-widest">Recent Activity</h2>
            <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mt-1">Latest campaign & automation events</p>
          </div>
          <div className="p-5 sm:p-10 space-y-3 relative z-10">
            {(() => {
              const items = [
                ...(campaigns || []).filter(c => (c.total_sends || 0) > 0).slice(0, 4).map(c => ({
                  icon: '📧',
                  text: `Campaign "${c.name}" sent to ${(c.total_sends||0).toLocaleString()} recipients`,
                  detail: `${c.opened||0} opened · ${c.clicked||0} clicked · ${c.bounced||0} bounced`,
                  dot: 'bg-violet-500',
                })),
                ...(automations || []).filter(a => (a.total_sent || 0) > 0).slice(0, 3).map(a => ({
                  icon: '⚡',
                  text: `Automation "${a.name}" delivered ${(a.total_sent||0).toLocaleString()} emails`,
                  detail: `${a.opened||0} opened · ${a.clicked||0} clicked · ${a.active ? 'Running' : 'Paused'}`,
                  dot: a.active ? 'bg-emerald-500' : 'bg-gray-500',
                })),
              ].slice(0, 7);

              if (items.length === 0) return (
                <div className="py-8 text-center text-[10px] font-black text-gray-600 uppercase tracking-widest opacity-50">
                  No activity yet — send your first campaign
                </div>
              );

              return items.map((item, i) => (
                <div key={i} className="flex items-start gap-3 p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:border-primary-500/20 transition-colors">
                  <span className="text-base shrink-0 mt-0.5">{item.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-black dark:text-white text-gray-900 leading-snug">{item.text}</p>
                    <p className="text-[9px] font-bold text-gray-500 mt-0.5">{item.detail}</p>
                  </div>
                  <span className={`w-2 h-2 rounded-full shrink-0 mt-1 ${item.dot}`}/>
                </div>
              ));
            })()}
          </div>
        </div>
      </div>}

      {/* ── Advanced Analytics: Email Health Score (Business+) ── */}
      {isBusiness ? (() => {
        const deliveryRate  = overview?.totalSends > 0
          ? Math.max(0, Math.min(100, (overview.totalSends / (overview.totalSends + (overview.totalBounced || 0))) * 100))
          : 0;
        const openRatePct   = parseFloat(overview?.avgOpenRate || 0);
        const ctrPct        = parseFloat(overview?.avgCTR || 0);
        const bounceRatePct = overview?.totalSends > 0 ? ((overview.totalBounced || 0) / overview.totalSends) * 100 : 0;
        const unsubRatePct  = (() => {
          const totalUnsub = (campaigns || []).reduce((s, c) => s + (c.unsubscribed || 0), 0);
          const totalDel   = (campaigns || []).reduce((s, c) => s + (c.delivered || 0), 0);
          return totalDel > 0 ? (totalUnsub / totalDel) * 100 : 0;
        })();
        const listHealthPct = overview?.totalContacts > 0
          ? ((overview.subscribedContacts || 0) / overview.totalContacts) * 100 : 0;

        const scoreDelivery  = Math.round(deliveryRate > 97 ? 100 : deliveryRate > 90 ? 80 : deliveryRate > 80 ? 60 : 40);
        const scoreOpen      = Math.round(openRatePct > 25 ? 100 : openRatePct > 15 ? 75 : openRatePct > 10 ? 50 : 25);
        const scoreBounce    = Math.round(bounceRatePct < 1 ? 100 : bounceRatePct < 3 ? 75 : bounceRatePct < 5 ? 50 : 20);
        const scoreCTR       = Math.round(ctrPct > 5 ? 100 : ctrPct > 2 ? 75 : ctrPct > 1 ? 50 : 25);
        const scoreUnsub     = Math.round(unsubRatePct < 0.3 ? 100 : unsubRatePct < 0.5 ? 85 : unsubRatePct < 1 ? 60 : 30);
        const healthScore    = Math.round(scoreDelivery * 0.3 + scoreOpen * 0.25 + scoreBounce * 0.2 + scoreCTR * 0.15 + scoreUnsub * 0.1);
        const grade          = healthScore >= 90 ? 'A+' : healthScore >= 80 ? 'A' : healthScore >= 70 ? 'B' : healthScore >= 60 ? 'C' : 'D';
        const gradeColor     = healthScore >= 80 ? '#10b981' : healthScore >= 60 ? '#f59e0b' : '#ef4444';
        const radarData = [
          { metric: 'Delivery', score: scoreDelivery },
          { metric: 'Opens',    score: scoreOpen     },
          { metric: 'Bounce',   score: scoreBounce   },
          { metric: 'CTR',      score: scoreCTR      },
          { metric: 'Unsub',    score: scoreUnsub    },
        ];
        const kpis = [
          { label: 'Delivery Rate',   value: `${deliveryRate.toFixed(1)}%`,   color: scoreDelivery >= 80 ? '#10b981' : '#f59e0b' },
          { label: 'Avg Open Rate',   value: `${openRatePct.toFixed(1)}%`,    color: scoreOpen     >= 75 ? '#10b981' : '#f59e0b' },
          { label: 'Avg CTR',         value: `${ctrPct.toFixed(1)}%`,         color: scoreCTR      >= 75 ? '#10b981' : '#f59e0b' },
          { label: 'Bounce Rate',     value: `${bounceRatePct.toFixed(1)}%`,  color: scoreBounce   >= 75 ? '#10b981' : '#ef4444' },
          { label: 'Unsub Rate',      value: `${unsubRatePct.toFixed(2)}%`,   color: scoreUnsub    >= 75 ? '#10b981' : '#f59e0b' },
          { label: 'List Health',     value: `${listHealthPct.toFixed(0)}%`,  color: listHealthPct >= 70 ? '#10b981' : '#f59e0b' },
        ];
        return (
          <div className="card border-none shadow-2xl relative overflow-hidden">
            <div className="absolute inset-0 tech-grid opacity-10 pointer-events-none" />
            <div className="px-4 sm:px-8 py-4 sm:py-6 border-b border-black/5 dark:border-white/[0.02] bg-black/5 dark:bg-black/20 relative z-10 flex items-center justify-between">
              <div>
                <h2 className="text-xs font-black dark:text-white text-gray-900 uppercase tracking-widest">Email Health Score</h2>
                <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mt-1">Composite email program health based on key deliverability metrics</p>
              </div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest bg-amber-500/10 border border-amber-500/20 text-amber-400">Business+</span>
            </div>
            <div className="p-5 sm:p-10 relative z-10">
              <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-10 items-center">
                {/* Score + Radar */}
                <div className="flex flex-col items-center gap-6">
                  <div className="relative w-36 h-36 flex items-center justify-center">
                    <svg viewBox="0 0 120 120" className="absolute inset-0 w-full h-full -rotate-90">
                      <circle cx="60" cy="60" r="50" fill="none" stroke={theme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(109,40,217,0.15)'} strokeWidth="12"/>
                      <circle cx="60" cy="60" r="50" fill="none" stroke={gradeColor} strokeWidth="12"
                        strokeDasharray={`${(healthScore / 100) * 314} 314`}
                        strokeLinecap="round" style={{ transition: 'stroke-dasharray 1s ease' }}/>
                    </svg>
                    <div className="text-center">
                      <p className="text-4xl font-black" style={{ color: gradeColor }}>{grade}</p>
                      <p className="text-xs font-black text-gray-500">{healthScore}/100</p>
                    </div>
                  </div>
                  <p className="text-[10px] font-black text-center uppercase tracking-widest text-gray-500">
                    {healthScore >= 80 ? 'Excellent program health' : healthScore >= 60 ? 'Good — room to improve' : 'Needs attention'}
                  </p>
                  <div className="w-full h-36">
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart data={radarData} margin={{ top: 0, right: 20, bottom: 0, left: 20 }}>
                        <PolarGrid stroke={theme === 'dark' ? 'rgba(255,255,255,0.10)' : 'rgba(109,40,217,0.18)'} />
                        <PolarAngleAxis dataKey="metric" tick={{ fill: '#6b7280', fontSize: 9, fontWeight: 700 }} />
                        <Radar dataKey="score" stroke={gradeColor} fill={gradeColor} fillOpacity={0.2} strokeWidth={2} />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                {/* KPI breakdown */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {kpis.map(k => (
                    <div key={k.label} className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.04] space-y-1.5">
                      <p className="text-[8px] font-black text-gray-500 uppercase tracking-widest">{k.label}</p>
                      <p className="text-2xl font-black" style={{ color: k.color }}>{k.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );
      })() : (
        <div className="card p-8 flex flex-col sm:flex-row items-center gap-6 border border-amber-500/20 bg-amber-500/5">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
            <svg className="w-7 h-7 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          </div>
          <div className="flex-1 text-center sm:text-left">
            <p className="text-xs font-black text-amber-400 uppercase tracking-widest mb-1">Business Feature</p>
            <h3 className="text-base font-black dark:text-white text-gray-900 uppercase tracking-widest">Email Health Score</h3>
            <p className="text-xs font-semibold text-gray-500 mt-1">Composite 0–100 score based on delivery, open rate, bounce, CTR and unsubscribe data. Upgrade to Business to unlock.</p>
          </div>
          <button onClick={() => navigate('/plans')} className="shrink-0 px-6 py-3 text-xs font-black uppercase tracking-widest rounded-xl bg-amber-500 hover:bg-amber-400 text-white transition-all">
            Upgrade to Business →
          </button>
        </div>
      )}

      {/* ── Campaign Intelligence (Professional+) ── */}
      {isPro ? (() => {
        const sentCamps   = (campaigns || []).filter(c => (c.total_sends || 0) > 0);
        const avgSends    = sentCamps.length > 0 ? Math.round(sentCamps.reduce((s, c) => s + (c.total_sends || 0), 0) / sentCamps.length) : 0;
        const bestOpen    = sentCamps.length > 0 ? sentCamps.reduce((a, b) => (a.opened / (a.delivered || 1) > b.opened / (b.delivered || 1) ? a : b)) : null;
        const mostClicked = sentCamps.length > 0 ? sentCamps.reduce((a, b) => (a.clicked > b.clicked ? a : b)) : null;
        const totalUnsub  = sentCamps.reduce((s, c) => s + (c.unsubscribed || 0), 0);
        const compareData = sentCamps.slice(-8).map(c => ({
          name:      c.name?.length > 10 ? c.name.slice(0, 10) + '…' : c.name,
          'Open %':  c.delivered > 0 ? parseFloat(((c.opened  / c.delivered) * 100).toFixed(1)) : 0,
          'Click %': c.delivered > 0 ? parseFloat(((c.clicked / c.delivered) * 100).toFixed(1)) : 0,
          'Bounce %':c.total_sends > 0 ? parseFloat(((c.bounced/ c.total_sends) * 100).toFixed(1)) : 0,
        }));
        if (sentCamps.length === 0) return null;
        return (
          <div className="card border-none shadow-2xl relative overflow-hidden">
            <div className="absolute inset-0 tech-grid opacity-10 pointer-events-none" />
            <div className="px-4 sm:px-8 py-4 sm:py-6 border-b border-black/5 dark:border-white/[0.02] bg-black/5 dark:bg-black/20 relative z-10 flex items-center justify-between">
              <div>
                <h2 className="text-xs font-black dark:text-white text-gray-900 uppercase tracking-widest">Campaign Intelligence</h2>
                <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mt-1">Multi-metric campaign comparison & key insights</p>
              </div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest bg-violet-500/10 border border-violet-500/20 text-violet-400">Pro+</span>
            </div>
            <div className="p-10 space-y-8 relative z-10">
              {/* Intelligence KPIs */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { label: 'Campaigns sent',     value: sentCamps.length,                            color: '#8b5cf6' },
                  { label: 'Avg recipients',     value: avgSends.toLocaleString('en-IN'),            color: '#3b82f6' },
                  { label: 'Total unsubscribes', value: totalUnsub.toLocaleString('en-IN'),          color: '#ef4444' },
                  { label: 'Best open rate',     value: bestOpen ? `${((bestOpen.opened/(bestOpen.delivered||1))*100).toFixed(1)}%` : '—', color: '#10b981' },
                ].map(k => (
                  <div key={k.label} className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.04]">
                    <p className="text-[8px] font-black text-gray-500 uppercase tracking-widest mb-1">{k.label}</p>
                    <p className="text-2xl font-black" style={{ color: k.color }}>{k.value}</p>
                  </div>
                ))}
              </div>
              {/* Best / Most campaigns */}
              {(bestOpen || mostClicked) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {bestOpen && (
                    <div className="p-5 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 space-y-1">
                      <p className="text-[8px] font-black text-emerald-400 uppercase tracking-widest">Best open rate campaign</p>
                      <p className="text-sm font-black dark:text-white text-gray-900 truncate">{bestOpen.name}</p>
                      <p className="text-[9px] font-semibold text-gray-500">{bestOpen.total_sends?.toLocaleString()} sent · {bestOpen.opened} opened ({((bestOpen.opened/(bestOpen.delivered||1))*100).toFixed(1)}%)</p>
                    </div>
                  )}
                  {mostClicked && (
                    <div className="p-5 rounded-2xl bg-blue-500/5 border border-blue-500/20 space-y-1">
                      <p className="text-[8px] font-black text-blue-400 uppercase tracking-widest">Most clicks campaign</p>
                      <p className="text-sm font-black dark:text-white text-gray-900 truncate">{mostClicked.name}</p>
                      <p className="text-[9px] font-semibold text-gray-500">{mostClicked.total_sends?.toLocaleString()} sent · {mostClicked.clicked} clicked</p>
                    </div>
                  )}
                </div>
              )}
              {/* Comparison chart */}
              {compareData.length > 0 && (
                <div>
                  <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-4">Last {compareData.length} campaigns — open vs click vs bounce rate</p>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={compareData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={chartGridStroke} vertical={false} />
                      <XAxis dataKey="name" tick={{ fill: chartTickColor, fontSize: 9, fontWeight: 700 }} axisLine={false} tickLine={false}/>
                      <YAxis tick={{ fill: chartTickColor, fontSize: 9 }} axisLine={false} tickLine={false} unit="%"/>
                      <Tooltip contentStyle={{ backgroundColor: theme === 'dark' ? '#0a051d' : '#fff', borderRadius: '1rem', border: '1px solid rgba(255,255,255,0.1)' }}
                        itemStyle={{ fontSize: '10px', fontWeight: 900, textTransform: 'uppercase' }} labelStyle={{ display: 'none' }} />
                      <Bar dataKey="Open %"   fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Click %"  fill="#3b82f6" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Bounce %" fill="#ef4444" radius={[4, 4, 0, 0]} opacity={0.7} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>
        );
      })() : null}

      {/* Automation Analytics */}
      <div className="card border-none shadow-2xl relative overflow-hidden">
        <div className="absolute inset-0 tech-grid opacity-10 pointer-events-none" />
        <div className="px-4 sm:px-8 py-4 sm:py-6 border-b border-black/5 dark:border-white/[0.02] bg-black/5 dark:bg-black/20 relative z-10 flex items-center justify-between">
          <div>
            <h2 className="text-xs font-black dark:text-white text-gray-900 uppercase tracking-widest">Automation Performance</h2>
            <p className="text-[9px] font-bold text-gray-500 uppercase tracking-[0.2em] mt-1">Click a row to see per-contact details</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Live</span>
          </div>
        </div>

        {(!automations || automations.length === 0) ? (
          <div className="p-16 text-center text-[10px] font-black text-gray-500 uppercase tracking-[0.3em] opacity-40 relative z-10">
            No automation data yet
          </div>
        ) : (
          <div className="overflow-x-auto relative z-10">
            <table className="w-full">
              <thead>
                <tr className="bg-black/5 dark:bg-black/40 text-left text-[10px] font-black text-gray-500 uppercase tracking-widest whitespace-nowrap">
                  <th className="px-10 py-5">Automation</th>
                  <th className="px-10 py-5">Status</th>
                  <th className="px-10 py-5">Delay</th>
                  <th className="px-10 py-5">Total Sent</th>
                  <th className="px-10 py-5">Delivered</th>
                  <th className="px-10 py-5">Opened</th>
                  <th className="px-10 py-5">Clicked</th>
                  <th className="px-10 py-5">Bounced</th>
                  <th className="px-10 py-5">Unsubs</th>
                  <th className="px-10 py-5 text-right">Open Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5 dark:divide-white/[0.02]">
                {automations.map(a => {
                  const openRate = a.delivered > 0 ? ((a.opened / a.delivered) * 100).toFixed(1) : '0.0';
                  const ctr = a.delivered > 0 ? ((a.clicked / a.delivered) * 100).toFixed(1) : '0.0';
                  return (
                    <tr
                      key={a.id}
                      className="hover:bg-primary-500/5 transition-all cursor-pointer group whitespace-nowrap"
                      onClick={() => setSelectedAutomation(a.id)}
                    >
                      <td className="px-10 py-6">
                        <div className="flex items-center gap-3">
                          <div className={`w-1.5 h-1.5 rounded-full ${a.active ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                          <span className="text-[11px] font-black dark:text-white text-gray-900 group-hover:text-primary-500 uppercase tracking-wider transition-colors">{a.name}</span>
                        </div>
                        <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest ml-4 mt-0.5">{a.template_name || '—'}</p>
                      </td>
                      <td className="px-10 py-6">
                        <span className={`badge ${a.active ? 'badge-green' : 'badge-gray'}`}>{a.active ? 'ACTIVE' : 'PAUSED'}</span>
                      </td>
                      <td className="px-10 py-6 text-[10px] font-black text-primary-400 text-mono">{a.delay_days}D</td>
                      <td className="px-10 py-6 text-[10px] font-black text-primary-400 text-mono">{a.total_sent}</td>
                      <td className="px-10 py-6 text-[10px] font-black text-emerald-400 text-mono">{a.delivered}</td>
                      <td className="px-10 py-6 text-[10px] font-black dark:text-white text-gray-900 text-mono">
                        <div className="flex items-center gap-2">
                          <span>{a.opened}</span>
                          <div className="w-10 h-1 bg-black/10 dark:bg-white/10 rounded-full overflow-hidden">
                            <div className="h-full bg-primary-500" style={{ width: `${(a.opened / (a.delivered || 1)) * 100}%` }} />
                          </div>
                        </div>
                      </td>
                      <td className="px-10 py-6 text-[10px] font-black text-amber-400 text-mono">{a.clicked}</td>
                      <td className="px-10 py-6 text-[10px] font-black text-red-500 text-mono">{a.bounced}</td>
                      <td className="px-10 py-6 text-[10px] font-black text-gray-600 dark:text-gray-400 text-mono">{a.unsubscribed}</td>
                      <td className="px-10 py-6 text-right">
                        <div className="flex flex-col items-end">
                          <span className="text-[10px] font-black text-primary-400 text-mono">{openRate}%</span>
                          <span className="text-[9px] text-gray-500 font-black uppercase">CTR {ctr}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <AutomationDetailModal
        automationId={selectedAutomation}
        onClose={() => setSelectedAutomation(null)}
      />
    </div>
  );
}
