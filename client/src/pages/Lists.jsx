import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import toast from 'react-hot-toast';
import LoadingSpinner from '../components/LoadingSpinner';
import EmptyState from '../components/EmptyState';
import ConfirmModal from '../components/ConfirmModal';
import { format } from 'date-fns';

export default function Lists() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [showCreate, setShowCreate] = useState(false);
  const [editList, setEditList] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');

  const { data: lists, isLoading } = useQuery({
    queryKey: ['lists'],
    queryFn: () => api.get('/lists').then(r => r.data),
    refetchInterval: 60000,
  });

  const saveMut = useMutation({
    mutationFn: (d) => editList ? api.put(`/lists/${editList.id}`, d) : api.post('/lists', d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['lists'] }); toast.success(editList ? 'List Updated' : 'List Created'); close(); },
  });

  const delMut = useMutation({
    mutationFn: (id) => api.delete(`/lists/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['lists'] }); toast.success('List Deleted'); setDeleteTarget(null); },
  });

  const openEdit = (l) => { setEditList(l); setName(l.name); setDesc(l.description || ''); setShowCreate(true); };
  const close = () => { setShowCreate(false); setEditList(null); setName(''); setDesc(''); };

  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="space-y-10 pb-24 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black dark:text-white text-gray-900 tracking-tight uppercase">Contact Lists</h1>
          <p className="text-[10px] font-bold text-primary-500 uppercase tracking-[0.3em] mt-1">Organize your audience into segments</p>
        </div>
        <button className="btn-primary" onClick={() => { setEditList(null); setName(''); setDesc(''); setShowCreate(true); }}>Create New List</button>
      </div>

      {(!lists || lists.length === 0) ? (
        <EmptyState title="No Lists Found" description="You haven't created any contact lists yet." action={() => setShowCreate(true)} actionLabel="Create New List" />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {lists.map(l => (
            <div key={l.id} className="card p-8 hover:border-primary-500/50 transition-all cursor-pointer group relative overflow-hidden" onClick={() => navigate(`/lists/${l.id}`)}>
              <div className="absolute inset-0 tech-grid opacity-5 pointer-events-none" />
              <div className="flex items-start justify-between mb-6 relative z-10">
                <div className="w-12 h-12 bg-primary-500/10 text-primary-500 border border-primary-500/20 rounded-2xl flex items-center justify-center shadow-lg shadow-primary-500/5">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12" /></svg>
                </div>
                <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                  <button className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/5 border border-white/10 text-gray-500 hover:text-primary-500 hover:border-primary-500/50 transition-all" onClick={() => openEdit(l)}>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                  </button>
                  <button className="w-8 h-8 flex items-center justify-center rounded-xl bg-red-500/5 border border-red-500/10 text-red-500/50 hover:text-red-500 hover:border-red-500/50 transition-all" onClick={() => setDeleteTarget(l)}>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </div>
              </div>
              <div className="relative z-10">
                <h3 className="text-sm font-black dark:text-white text-gray-900 uppercase tracking-widest group-hover:text-primary-500 transition-colors">{l.name}</h3>
                <p className="text-[10px] font-bold text-gray-500 mt-2 line-clamp-2 uppercase tracking-tighter leading-relaxed">{l.description || 'No description provided.'}</p>
              </div>
              <div className="flex justify-between mt-8 pt-6 border-t border-black/5 dark:border-white/[0.02] relative z-10">
                <div className="flex flex-col">
                  <span className="text-[10px] font-black dark:text-white text-gray-900 text-mono">{l.contact_count || 0} CONTACTS</span>
                  <span className="text-[8px] font-bold text-gray-500 uppercase tracking-widest mt-0.5">Active Audience</span>
                </div>
                <div className="text-right">
                  <span className="text-[9px] font-black text-primary-400 uppercase tracking-widest">{format(new Date(l.created_at), 'MMM dd, yyyy')}</span>
                  <p className="text-[8px] font-bold text-gray-600 uppercase tracking-tighter mt-0.5">Created Date</p>
                </div>
              </div>
              {/* Dynamic Glow */}
              <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-primary-500/5 rounded-full blur-3xl group-hover:bg-primary-500/10 transition-all duration-700" />
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 lg:left-72 bg-[#0d0928]/85 z-50 flex items-center justify-center p-4 backdrop-blur-xl animate-fade-in" onClick={close}>
          <div className="bg-main border border-white/10 rounded-3xl sm:rounded-[3rem] p-6 sm:p-10 max-w-md w-full shadow-2xl animate-scale-in relative overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="absolute inset-0 tech-grid opacity-20 pointer-events-none" />
            <div className="relative z-10">
              <h3 className="text-xl font-black dark:text-white text-gray-900 uppercase tracking-tighter mb-8">{editList ? 'Edit List' : 'Create New List'}</h3>
              <form onSubmit={e => { e.preventDefault(); saveMut.mutate({ name, description: desc }); }} className="space-y-6">
                <div><label className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 block">List Name *</label><input value={name} onChange={e => setName(e.target.value)} className="input-field" required autoFocus placeholder="e.g. VIP Customers" /></div>
                <div><label className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 block">Description</label><textarea value={desc} onChange={e => setDesc(e.target.value)} className="input-field min-h-[100px] resize-none" placeholder="Enter a brief description for this list..." /></div>
                <div className="flex gap-4 pt-4">
                  <button type="button" className="btn-secondary flex-1" onClick={close}>CANCEL</button>
                  <button type="submit" className="btn-primary flex-1 justify-center">{editList ? 'UPDATE' : 'CREATE'}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={() => delMut.mutate(deleteTarget?.id)} title="Delete List?" message={`Confirm permanent removal of "${deleteTarget?.name}". Contacts in this list will not be deleted.`} confirmText="DELETE LIST" variant="danger" />
    </div>
  );
}
