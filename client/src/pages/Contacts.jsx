import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/axios';
import toast from 'react-hot-toast';
import SlideOver from '../components/SlideOver';
import ConfirmModal from '../components/ConfirmModal';
import LoadingSpinner from '../components/LoadingSpinner';
import EmptyState from '../components/EmptyState';
import { useDropzone } from 'react-dropzone';
import { format } from 'date-fns';
import { downloadCsv } from '../utils/exportCsv';

export default function Contacts() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selected, setSelected] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editContact, setEditContact] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [showBulkList, setShowBulkList] = useState(false);
  const [exporting, setExporting] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['contacts', page, search, statusFilter],
    queryFn: () => api.get('/contacts', { params: { page, limit: 50, search, status: statusFilter } }).then(r => r.data),
    refetchInterval: 60000,
  });

  const { data: lists } = useQuery({ queryKey: ['lists'], queryFn: () => api.get('/lists').then(r => r.data), refetchInterval: 60000 });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/contacts/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['contacts'] }); toast.success('Contact deleted'); setDeleteTarget(null); },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: (ids) => api.post('/contacts/bulk-delete', { ids }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['contacts'] }); toast.success('Contacts removed'); setSelected([]); },
  });

  const bulkAddToListMutation = useMutation({
    mutationFn: ({ contact_ids, list_id }) => api.post('/contacts/bulk-add-to-list', { contact_ids, list_id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lists'] });
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      toast.success('Contacts added to list');
      setShowBulkList(false);
      setSelected([]);
    },
  });

  const handleExport = async () => {
    setExporting(true);
    try {
      await downloadCsv('/contacts/export', 'contacts-export.csv');
      toast.success('Contacts export downloaded');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  const toggleSelect = (id) => {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };
  const toggleSelectAll = () => {
    if (!data?.contacts) return;
    if (selected.length === data.contacts.length) setSelected([]);
    else setSelected(data.contacts.map(c => c.id));
  };

  if (isLoading) return <LoadingSpinner />;

  const contacts = data?.contacts || [];
  const pagination = data?.pagination || {};

  return (
    <div className="space-y-10 pb-24 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black dark:text-white text-gray-900 tracking-tight uppercase">Contacts</h1>
          <p className="text-[10px] font-bold text-primary-500 uppercase tracking-[0.3em] mt-1">{pagination.total || 0} Total Active Contacts</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button className="btn-secondary" onClick={handleExport} disabled={exporting}>{exporting ? 'EXPORTING...' : 'EXPORT CSV'}</button>
          <button className="btn-secondary" onClick={() => setShowImport(true)}>IMPORT CSV</button>
          <button className="btn-primary" onClick={() => { setEditContact(null); setShowAdd(true); }}>ADD CONTACT</button>
        </div>
      </div>

      {/* Control Bar */}
      <div className="flex flex-col md:flex-row gap-4 items-center glass p-6 rounded-[2rem] border-none shadow-xl transition-all duration-500">
        <div className="relative flex-1 max-w-md group">
          <input 
            type="text" 
            placeholder="Search Contacts..." 
            value={search} 
            onChange={e => { setSearch(e.target.value); setPage(1); }} 
            className="input-field pl-12"
          />
          <svg className="w-4 h-4 text-gray-500 absolute left-4 top-1/2 -translate-y-1/2 group-focus-within:text-primary-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
        </div>
        <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }} className="input-field max-w-[200px] bg-white/[0.02]">
          <option value="">Status: ALL</option>
          <option value="subscribed">ACTIVE</option>
          <option value="unsubscribed">UNSUBSCRIBED</option>
          <option value="bounced">BOUNCED</option>
        </select>
        {selected.length > 0 && (
          <div className="flex flex-wrap gap-4 items-center justify-between w-full md:w-auto md:ml-auto animate-slide-up">
            <span className="text-[10px] font-black text-primary-500 uppercase tracking-widest">{selected.length} CONTACTS SELECTED</span>
            <div className="flex gap-2">
              <button className="btn-danger" onClick={() => bulkDeleteMutation.mutate(selected)}>DELETE</button>
              <button className="btn-primary" onClick={() => setShowBulkList(true)}>ADD TO LIST</button>
            </div>
          </div>
        )}
      </div>

      {/* Contacts Table */}
      {contacts.length === 0 ? (
        <EmptyState title="No Contacts" description="No contacts found in your database." action={() => setShowAdd(true)} actionLabel="Add Contact" />
      ) : (
        <div className="card border-none shadow-2xl relative overflow-hidden">
          <div className="absolute inset-0 tech-grid opacity-10 pointer-events-none" />
          <div className="overflow-x-auto relative z-10">
            <table className="w-full">
              <thead>
                <tr className="bg-black/5 dark:bg-black/40 text-left text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">
                  <th className="px-6 py-5"><input type="checkbox" checked={selected.length === contacts.length && contacts.length > 0} onChange={toggleSelectAll} className="w-4 h-4 rounded-lg bg-black/20 border-white/10 text-primary-500 focus:ring-primary-500" /></th>
                  <th className="px-6 py-5">Name</th>
                  <th className="px-6 py-5">Email Address</th>
                  <th className="px-6 py-5">Company</th>
                  <th className="px-6 py-5">Tags</th>
                  <th className="px-6 py-5">Status</th>
                  <th className="px-6 py-5">Date Added</th>
                  <th className="px-6 py-5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5 dark:divide-white/[0.02]">
                {contacts.map((c) => (
                  <tr key={c.id} className="hover:bg-primary-500/5 transition-all cursor-pointer group" onClick={() => { setEditContact(c); setShowAdd(true); }}>
                    <td className="px-6 py-6" onClick={e => e.stopPropagation()}>
                      <input type="checkbox" checked={selected.includes(c.id)} onChange={() => toggleSelect(c.id)} className="w-4 h-4 rounded-lg bg-black/20 border-white/10 text-primary-500 focus:ring-primary-500" />
                    </td>
                    <td className="px-6 py-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary-500/10 border border-primary-500/20 rounded-xl flex items-center justify-center text-primary-500 font-black text-sm">
                          {(c.first_name?.[0] || c.email[0]).toUpperCase()}
                        </div>
                        <span className="text-[11px] font-black dark:text-white text-gray-900 uppercase tracking-wider">{c.first_name || ''} {c.last_name || ''}</span>
                      </div>
                    </td>
                    <td className="px-6 py-6 text-[10px] font-mono text-primary-400 uppercase tracking-tighter">{c.email}</td>
                    <td className="px-6 py-6 text-[10px] font-black text-gray-500 uppercase tracking-widest">{c.company || '—'}</td>
                    <td className="px-6 py-6">
                      <div className="flex gap-1.5 flex-wrap">
                        {(() => { try { return JSON.parse(c.tags || '[]'); } catch { return []; } })().slice(0, 3).map((t, i) => (
                          <span key={i} className="badge badge-purple text-[8px]">{t}</span>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-6"><StatusBadge status={c.status} /></td>
                    <td className="px-6 py-6 text-[10px] font-black text-gray-500 text-mono">{format(new Date(c.created_at), 'yyyy.MM.dd')}</td>
                    <td className="px-6 py-6" onClick={e => e.stopPropagation()}>
                      <button className="btn-sm-danger" onClick={() => setDeleteTarget(c)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between px-10 py-6 bg-black/5 dark:bg-black/20 border-t border-black/5 dark:border-white/5">
              <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Page {pagination.page} // Total {pagination.totalPages}</span>
              <div className="flex gap-4">
                <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="btn-secondary disabled:opacity-20">PREVIOUS</button>
                <button disabled={page >= pagination.totalPages} onClick={() => setPage(p => p + 1)} className="btn-secondary disabled:opacity-20">NEXT</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Add/Edit Slide-Over */}
      <SlideOver isOpen={showAdd} onClose={() => setShowAdd(false)} title={editContact ? 'EDIT CONTACT' : 'ADD NEW CONTACT'}>
        <div className="p-8"><ContactForm contact={editContact} onClose={() => setShowAdd(false)} /></div>
      </SlideOver>

      {/* Import Modal */}
      {showImport && <ImportModal onClose={() => setShowImport(false)} />}

      {/* Bulk Add to List Modal */}
      {showBulkList && (
        <div className="fixed inset-0 lg:left-72 bg-[#0d0928]/85 z-50 flex items-center justify-center p-4 backdrop-blur-xl animate-fade-in" onClick={() => setShowBulkList(false)}>
          <div className="bg-main border border-white/10 rounded-3xl sm:rounded-[2.5rem] p-6 sm:p-10 max-w-sm w-full shadow-2xl animate-scale-in relative overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="absolute inset-0 tech-grid opacity-20 pointer-events-none" />
            <div className="relative z-10">
              <h3 className="text-xl font-black dark:text-white text-gray-900 uppercase tracking-tighter mb-6">Add Contacts to List</h3>
              <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
                {(lists || []).map(l => (
                  <button key={l.id} className="w-full text-left px-5 py-4 rounded-2xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/5 hover:border-primary-500 hover:bg-primary-500/10 text-xs font-black uppercase tracking-widest text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-all" onClick={() => bulkAddToListMutation.mutate({ contact_ids: selected, list_id: l.id })}>
                    {l.name}
                  </button>
                ))}
              </div>
              <button className="btn-secondary w-full mt-8" onClick={() => setShowBulkList(false)}>CANCEL</button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={() => deleteMutation.mutate(deleteTarget?.id)} title="Delete Contact?" message={`Confirm permanent removal of ${deleteTarget?.email} from your database.`} confirmText="DELETE CONTACT" variant="danger" />
    </div>
  );
}

function StatusBadge({ status }) {
  const m = { subscribed: 'badge-green', unsubscribed: 'badge-red', bounced: 'badge-yellow' };
  return (
    <div className="flex items-center gap-2">
      <div className={`w-1 h-1 rounded-full ${status === 'subscribed' ? 'bg-emerald-500' : 'bg-gray-500'}`} />
      <span className={`badge ${m[status] || 'badge-gray'}`}>{status}</span>
    </div>
  );
}

function ContactForm({ contact, onClose }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    email: contact?.email || '',
    first_name: contact?.first_name || '',
    last_name: contact?.last_name || '',
    company: contact?.company || '',
    phone: contact?.phone || '',
    tags: (() => { try { return JSON.parse(contact?.tags || '[]').join(', '); } catch { return ''; } })(),
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const payload = { ...form, tags: form.tags.split(',').map(t => t.trim()).filter(Boolean) };
    try {
      if (contact) {
        await api.put(`/contacts/${contact.id}`, payload);
        toast.success('Contact Updated');
      } else {
        await api.post('/contacts', payload);
        toast.success('Contact Added');
      }
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Update Failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <div><label className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 block">Email Address *</label><input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="input-field" required placeholder="contact@example.com" /></div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div><label className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 block">First Name</label><input value={form.first_name} onChange={e => setForm({ ...form, first_name: e.target.value })} className="input-field" /></div>
        <div><label className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 block">Last Name</label><input value={form.last_name} onChange={e => setForm({ ...form, last_name: e.target.value })} className="input-field" /></div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div><label className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 block">Company</label><input value={form.company} onChange={e => setForm({ ...form, company: e.target.value })} className="input-field" /></div>
        <div><label className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 block">Phone Number</label><input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="input-field" /></div>
      </div>
      <div><label className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 block">Tags</label><input value={form.tags} onChange={e => setForm({ ...form, tags: e.target.value })} placeholder="VIP, customer, newsletter" className="input-field" /></div>
      <div className="flex gap-4 pt-8">
        <button type="button" className="btn-secondary flex-1" onClick={onClose}>CANCEL</button>
        <button type="submit" disabled={loading} className="btn-primary flex-1 justify-center">{loading ? 'SAVING...' : 'SAVE CONTACT'}</button>
      </div>
    </form>
  );
}

function ImportModal({ onClose }) {
  const queryClient = useQueryClient();
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const onDrop = useCallback((acceptedFiles) => {
    if (acceptedFiles.length > 0) setFile(acceptedFiles[0]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, accept: { 'text/csv': ['.csv'] }, maxFiles: 1 });

  const handleImport = async () => {
    if (!file) return;
    setLoading(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await api.post('/contacts/import', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      setResult(res.data);
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      toast.success(`Import Successful: ${res.data.imported} contacts added`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Ingress Failure');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 lg:left-72 bg-[#0d0928]/85 z-50 flex items-center justify-center p-4 backdrop-blur-xl animate-fade-in" onClick={onClose}>
      <div className="bg-main border border-white/10 rounded-3xl sm:rounded-[3rem] p-6 sm:p-10 max-w-lg w-full shadow-[0_0_100px_rgba(139,92,246,0.2)] animate-scale-in relative overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="absolute inset-0 tech-grid opacity-20 pointer-events-none" />
        <div className="relative z-10">
          <h3 className="text-2xl font-black dark:text-white text-gray-900 uppercase tracking-tighter mb-4">Import Contacts (CSV)</h3>
          <p className="text-[10px] font-bold text-gray-600 dark:text-gray-400 uppercase tracking-widest mb-10 leading-relaxed">Required CSV headers: email, first_name, last_name, company, phone, tags</p>

          {!result ? (
            <>
              <div {...getRootProps()} className={`border-2 border-dashed rounded-3xl p-6 sm:p-12 text-center cursor-pointer transition-all ${isDragActive ? 'border-primary-500 bg-primary-500/10 shadow-[0_0_40px_rgba(139,92,246,0.1)]' : 'border-black/10 dark:border-white/10 bg-black/5 dark:bg-black/20 hover:border-black/20 dark:hover:border-white/30'}`}>
                <input {...getInputProps()} />
                {file ? (
                  <div>
                    <p className="text-sm font-black text-primary-400 uppercase tracking-wider">{file.name}</p>
                    <p className="text-[9px] font-mono text-gray-500 mt-2">FILE SIZE: {(file.size / 1024).toFixed(1)} KB</p>
                  </div>
                ) : (
                  <p className="text-xs font-black text-gray-500 uppercase tracking-widest">Drop CSV file here</p>
                )}
              </div>
              <div className="flex gap-4 mt-10">
                <button className="btn-secondary flex-1" onClick={onClose}>CANCEL</button>
                <button className="btn-primary flex-1 justify-center" disabled={!file || loading} onClick={handleImport}>{loading ? 'IMPORTING...' : 'START IMPORT'}</button>
              </div>
            </>
          ) : (
            <div className="space-y-8 animate-fade-in">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-emerald-500/10 border border-emerald-500/20 p-6 rounded-3xl text-center">
                  <p className="text-2xl font-black text-emerald-400 text-mono">{result.imported}</p>
                  <p className="text-[10px] font-black text-emerald-500/60 uppercase tracking-widest mt-1">Contacts Added</p>
                </div>
                <div className="bg-amber-500/10 border border-amber-500/20 p-6 rounded-3xl text-center">
                  <p className="text-2xl font-black text-amber-400 text-mono">{result.skipped}</p>
                  <p className="text-[10px] font-black text-amber-500/60 uppercase tracking-widest mt-1">Skipped</p>
                </div>
              </div>
              <button className="btn-primary w-full justify-center" onClick={onClose}>DONE</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
