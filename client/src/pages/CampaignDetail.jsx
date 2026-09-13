import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/axios';
import toast from 'react-hot-toast';
import LoadingSpinner from '../components/LoadingSpinner';
import StatCard from '../components/StatCard';
import ConfirmModal from '../components/ConfirmModal';
import { format } from 'date-fns';
import { useState } from 'react';

export default function CampaignDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [showDelete, setShowDelete] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['campaign-stats', id],
    queryFn: () => api.get(`/campaigns/${id}/stats`).then(r => r.data),
    // Poll every 3s while sending so stats update in real time; every 20s otherwise
    refetchInterval: (query) => {
      const status = query.state.data?.campaign?.status;
      return status === 'sending' ? 3000 : 20000;
    },
  });

  const dupMut = useMutation({
    mutationFn: () => api.post(`/campaigns/${id}/duplicate`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['campaigns'] }); toast.success('Campaign Cloned'); navigate('/campaigns'); },
  });

  const delMut = useMutation({
    mutationFn: () => api.delete(`/campaigns/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['campaigns'] }); toast.success('Campaign deleted'); navigate('/campaigns'); },
  });

  if (isLoading) return <LoadingSpinner />;
  if (!data) return <div className="text-center py-20 font-black uppercase tracking-widest text-gray-500">Campaign not found</div>;

  const { campaign, stats, sends } = data;
  const openRate = stats.delivered > 0 ? ((stats.opened / stats.delivered) * 100).toFixed(1) : '0.0';
  const ctr = stats.delivered > 0 ? ((stats.clicked / stats.delivered) * 100).toFixed(1) : '0.0';
  const bounceRate = stats.total_sends > 0 ? ((stats.bounced / stats.total_sends) * 100).toFixed(1) : '0.0';

  return (
    <div className="space-y-12 pb-24 animate-fade-in">
      {/* Header Section */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-8">
        <div className="flex items-start gap-6">
          <button onClick={() => navigate('/campaigns')} className="w-12 h-12 flex items-center justify-center rounded-2xl bg-white/5 border border-white/10 hover:border-primary-500/50 transition-all text-gray-500">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
          </button>
          <div>
            <div className="flex items-center gap-4 mb-2">
              <h1 className="text-3xl font-black dark:text-white text-gray-900 tracking-tight uppercase">{campaign.name}</h1>
              <StatusBadge status={campaign.status} />
            </div>
            <p className="text-[10px] font-bold text-primary-500 uppercase tracking-[0.3em]">Subject: {campaign.subject}</p>
          </div>
        </div>
        <div className="flex gap-4 w-full lg:w-auto">
          <button className="flex-1 lg:flex-none btn-secondary" onClick={() => dupMut.mutate()}>DUPLICATE</button>
          <button className="flex-1 lg:flex-none btn-secondary" onClick={() => navigate(`/campaigns/edit/${id}`)}>EDIT</button>
          <button className="flex-1 lg:flex-none bg-red-500/10 text-red-500 border border-red-500/20 px-6 py-2.5 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-red-500 hover:text-white transition-all" onClick={() => setShowDelete(true)}>DELETE</button>
        </div>
      </div>

      {/* Real-time Metrics Matrix */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 lg:gap-6">
        <StatCard label="Total Sends" value={stats.total_sends || 0} color="blue" />
        <StatCard label="Delivered" value={stats.delivered || 0} color="green" />
        <StatCard label="Opened" value={stats.opened || 0} color="purple" sub={`${openRate}%`} />
        <StatCard label="Clicked" value={stats.clicked || 0} color="orange" sub={`${ctr}%`} />
        <StatCard label="Bounced" value={stats.bounced || 0} color="red" sub={`${bounceRate}%`} />
        <StatCard label="Unsubs" value={stats.unsubscribed || 0} color="red" />
      </div>

      {/* Individual Node Analysis */}
      <div className="card border-none shadow-2xl relative overflow-hidden">
        <div className="absolute inset-0 tech-grid opacity-10 pointer-events-none" />
        <div className="px-10 py-8 border-b border-black/5 dark:border-white/[0.02] flex justify-between items-center bg-black/5 dark:bg-black/20">
          <h2 className="text-sm font-black dark:text-white text-gray-900 uppercase tracking-[0.2em]">Recipient Activity</h2>
          <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Delivery log</span>
        </div>
        
        {(!sends || sends.length === 0) ? (
          <div className="p-20 text-center text-[10px] font-black text-gray-500 uppercase tracking-[0.3em] opacity-40">No sends yet</div>
        ) : (
          <div className="overflow-x-auto relative z-10">
            <table className="w-full">
              <thead>
                <tr className="text-left text-[10px] font-black text-gray-500 uppercase tracking-widest">
                  <th className="px-10 py-6">Recipient</th>
                  <th className="px-10 py-6">Status</th>
                  <th className="px-10 py-6">Sent</th>
                  <th className="px-10 py-6">Opened</th>
                  <th className="px-10 py-6">Clicked</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5 dark:divide-white/[0.02]">
                {sends.map(s => (
                  <tr key={s.id} className="hover:bg-primary-500/5 transition-all">
                    <td className="px-10 py-6">
                      <p className="text-[11px] font-black dark:text-white text-gray-900 uppercase tracking-wider">{s.first_name} {s.last_name}</p>
                      <p className="text-[9px] font-mono text-primary-400 mt-1 uppercase">{s.contact_email}</p>
                    </td>
                    <td className="px-10 py-6"><SendStatusBadge status={s.status} /></td>
                    <td className="px-10 py-6 text-[10px] font-black text-gray-500 text-mono">{s.sent_at ? format(new Date(s.sent_at), 'HH:mm:ss') : '—'}</td>
                    <td className="px-10 py-6 text-[10px] font-black text-gray-500 text-mono">{s.opened_at ? format(new Date(s.opened_at), 'HH:mm:ss') : '—'}</td>
                    <td className="px-10 py-6 text-[10px] font-black text-gray-500 text-mono">{s.clicked_at ? format(new Date(s.clicked_at), 'HH:mm:ss') : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ConfirmModal isOpen={showDelete} onClose={() => setShowDelete(false)} onConfirm={() => delMut.mutate()} title="Delete Campaign?" message="This permanently removes the campaign and all associated analytics data." confirmText="DELETE CAMPAIGN" variant="danger" />
    </div>
  );
}

function StatusBadge({ status }) {
  const m = { draft: 'badge-gray', scheduled: 'badge-yellow', sending: 'badge-blue', sent: 'badge-green', failed: 'badge-red' };
  return <span className={`badge ${m[status] || 'badge-gray'}`}>{status}</span>;
}

function SendStatusBadge({ status }) {
  const m = { pending: 'badge-gray', sent: 'badge-green', failed: 'badge-red' };
  return (
    <div className="flex items-center gap-2">
      <div className={`w-1 h-1 rounded-full ${status === 'sent' ? 'bg-emerald-500' : 'bg-gray-500'}`} />
      <span className={`badge ${m[status] || 'badge-gray'}`}>{status}</span>
    </div>
  );
}
