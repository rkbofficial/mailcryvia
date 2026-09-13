import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import toast from 'react-hot-toast';
import LoadingSpinner from '../components/LoadingSpinner';
import EmptyState from '../components/EmptyState';
import ConfirmModal from '../components/ConfirmModal';
import { format } from 'date-fns';
import { downloadCsv } from '../utils/exportCsv';

export default function Campaigns() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [exporting, setExporting] = useState(false);

  const { data: campaigns, isLoading } = useQuery({
    queryKey: ['campaigns'],
    queryFn: () => api.get('/campaigns').then(r => r.data),
    // Poll faster when a campaign is actively sending
    refetchInterval: (query) => {
      const data = query.state.data;
      return Array.isArray(data) && data.some(c => c.status === 'sending') ? 5000 : 30000;
    },
  });

  const delMut = useMutation({
    mutationFn: (id) => api.delete(`/campaigns/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['campaigns'] }); toast.success('Campaign deleted'); setDeleteTarget(null); },
  });

  const dupMut = useMutation({
    mutationFn: (id) => api.post(`/campaigns/${id}/duplicate`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['campaigns'] }); toast.success('Campaign duplicated'); },
  });

  const handleExport = async () => {
    setExporting(true);
    try {
      await downloadCsv('/campaigns/export', 'campaigns-export.csv');
      toast.success('Campaign export downloaded');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="space-y-10 pb-20 animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black dark:text-white text-gray-900 tracking-tight uppercase">Campaigns</h1>
          <p className="text-[10px] font-bold text-primary-500 uppercase tracking-[0.3em] mt-1">Manage and monitor your sent messages</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button className="btn-secondary" onClick={handleExport} disabled={exporting}>
            {exporting ? 'EXPORTING...' : 'EXPORT CSV'}
          </button>
          <button className="btn-primary" onClick={() => navigate('/campaigns/new')}>CREATE NEW CAMPAIGN</button>
        </div>
      </div>

      {(!campaigns || campaigns.length === 0) ? (
        <EmptyState title="No Campaigns" description="You haven't created any campaigns yet." action={() => navigate('/campaigns/new')} actionLabel="Create Campaign" />
      ) : (
        <div className="card border-none shadow-2xl relative overflow-hidden">
          <div className="absolute inset-0 tech-grid opacity-10 pointer-events-none" />
          <div className="overflow-x-auto relative z-10">
            <table className="w-full">
              <thead>
                <tr className="bg-black/5 dark:bg-black/40 text-left text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] whitespace-nowrap">
                  <th className="px-10 py-6">Campaign Name</th>
                  <th className="px-10 py-6">Recipient List</th>
                  <th className="px-10 py-6">Status</th>
                  <th className="px-10 py-6">Date</th>
                  <th className="px-10 py-6 text-right">Engagement</th>
                  <th className="px-10 py-6"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5 dark:divide-white/[0.02]">
                {campaigns.map((c) => {
                  const or = c.delivered > 0 ? ((c.opened / c.delivered) * 100).toFixed(1) : '—';
                  return (
                    <tr key={c.id} className="hover:bg-primary-500/5 cursor-pointer transition-all group whitespace-nowrap" onClick={() => navigate(`/campaigns/${c.id}`)}>
                      <td className="px-10 py-6">
                        <div className="flex items-center gap-4">
                          <div className={`w-2 h-2 rounded-full transition-all duration-700 ${c.status === 'sent' ? 'bg-emerald-500' : 'bg-primary-500'}`} />
                          <div>
                            <p className="text-xs font-black dark:text-white text-gray-900 uppercase tracking-widest group-hover:text-primary-500 transition-colors">{c.name}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-10 py-6">
                        <span className="text-[10px] font-black text-primary-400 uppercase tracking-widest">{c.list_name || 'N/A'}</span>
                      </td>
                      <td className="px-10 py-6"><StatusBadge status={c.status} /></td>
                      <td className="px-10 py-6 text-[10px] font-black text-gray-500 text-mono uppercase tracking-tighter">
                        {c.sent_at ? format(new Date(c.sent_at), 'yyyy.MM.dd') : c.scheduled_at ? format(new Date(c.scheduled_at), 'yyyy.MM.dd') : 'DRAFT'}
                      </td>
                      <td className="px-10 py-6 text-right">
                        <div className="flex flex-col items-end">
                          <span className="text-xs font-black dark:text-white text-gray-900 text-mono uppercase">{or === '—' ? or : or + '%'}</span>
                        </div>
                      </td>
                      <td className="px-10 py-6 text-right" onClick={e => e.stopPropagation()}>
                        <div className="flex flex-wrap gap-2 justify-end">
                          <button className="btn-sm" onClick={() => dupMut.mutate(c.id)}>Dup</button>
                          <button className="btn-sm-primary" onClick={() => navigate(`/campaigns/edit/${c.id}`)}>Edit</button>
                          <button className="btn-sm-danger" onClick={() => setDeleteTarget(c)}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ConfirmModal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={() => delMut.mutate(deleteTarget?.id)} title="Delete Campaign?" message={`This permanently removes "${deleteTarget?.name}" and its analytics history.`} confirmText="DELETE CAMPAIGN" variant="danger" />
    </div>
  );
}

function StatusBadge({ status }) {
  const m = { draft: 'badge-gray', scheduled: 'badge-yellow', sending: 'badge-blue', sent: 'badge-green', failed: 'badge-red' };
  const labels = { draft: 'DRAFT', scheduled: 'SCHEDULED', sending: 'SENDING', sent: 'SENT', failed: 'FAILED' };
  return (
    <div className="flex items-center gap-2">
      <div className={`w-1 h-1 rounded-full ${status === 'sent' ? 'bg-emerald-500' : status === 'sending' ? 'bg-blue-500' : 'bg-gray-500'}`} />
      <span className={`badge ${m[status] || 'badge-gray'}`}>{labels[status] || status}</span>
    </div>
  );
}
