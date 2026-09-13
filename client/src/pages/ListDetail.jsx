import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/axios';
import toast from 'react-hot-toast';
import LoadingSpinner from '../components/LoadingSpinner';
import EmptyState from '../components/EmptyState';

function initials(first, last, email) {
  if (first) return (first[0] + (last?.[0] || '')).toUpperCase();
  return (email?.[0] || '?').toUpperCase();
}

export default function ListDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [showAddContacts, setShowAddContacts] = useState(false);
  const [selectedContacts, setSelectedContacts] = useState([]);
  const [search, setSearch] = useState('');

  const { data: list } = useQuery({
    queryKey: ['lists'],
    queryFn: () => api.get('/lists').then(r => r.data),
    select: (d) => d.find(l => l.id === parseInt(id)),
    refetchInterval: 60000,
  });

  const { data: contacts, isLoading } = useQuery({
    queryKey: ['list-contacts', id],
    queryFn: () => api.get(`/lists/${id}/contacts`).then(r => r.data),
    refetchInterval: 60000,
  });

  const { data: allContacts } = useQuery({
    queryKey: ['contacts-all'],
    queryFn: () => api.get('/contacts', { params: { limit: 1000 } }).then(r => r.data.contacts),
    enabled: showAddContacts,
  });

  const removeMut = useMutation({
    mutationFn: (cid) => api.delete(`/lists/${id}/contacts/${cid}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['list-contacts', id] });
      qc.invalidateQueries({ queryKey: ['lists'] });
      toast.success('Contact removed');
    },
  });

  const addMut = useMutation({
    mutationFn: (cids) => api.post(`/lists/${id}/contacts`, { contact_ids: cids }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['list-contacts', id] });
      qc.invalidateQueries({ queryKey: ['lists'] });
      toast.success('Contacts added to list');
      setShowAddContacts(false);
      setSelectedContacts([]);
    },
  });

  const existingIds = useMemo(() => (contacts || []).map(c => c.id), [contacts]);
  const availableContacts = useMemo(() =>
    (allContacts || []).filter(c =>
      !existingIds.includes(c.id) &&
      (
        c.email.toLowerCase().includes(search.toLowerCase()) ||
        (c.first_name || '').toLowerCase().includes(search.toLowerCase()) ||
        (c.last_name || '').toLowerCase().includes(search.toLowerCase())
      )
    ), [allContacts, existingIds, search]);

  const allSelected = availableContacts.length > 0 && availableContacts.every(c => selectedContacts.includes(c.id));

  function toggleAll() {
    if (allSelected) {
      setSelectedContacts([]);
    } else {
      setSelectedContacts(availableContacts.map(c => c.id));
    }
  }

  function closeModal() {
    setShowAddContacts(false);
    setSelectedContacts([]);
    setSearch('');
  }

  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="space-y-8 pb-24 animate-fade-in">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/lists')}
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 hover:border-primary-500/50 transition-all text-gray-500 shrink-0"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="text-2xl font-black dark:text-white text-gray-900 tracking-tight uppercase leading-tight">
              {list?.name || 'Contact List'}
            </h1>
            <p className="text-xs font-bold text-primary-500 uppercase tracking-widest mt-0.5">
              {list?.description || 'Active audience segment'}
              {contacts && contacts.length > 0 && (
                <span className="ml-2 text-gray-400 normal-case tracking-normal font-medium">
                  · {contacts.length} contact{contacts.length !== 1 ? 's' : ''}
                </span>
              )}
            </p>
          </div>
        </div>
        <button className="btn-primary shrink-0" onClick={() => setShowAddContacts(true)}>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Add Contacts
        </button>
      </div>

      {/* ── Contacts Table ──────────────────────────────────────────────── */}
      {(!contacts || contacts.length === 0) ? (
        <EmptyState
          title="No Contacts Yet"
          description="Add existing contacts to this list to start targeting your audience."
          action={() => setShowAddContacts(true)}
          actionLabel="Add Contacts"
        />
      ) : (
        <div className="card overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-black/5 dark:border-white/5 bg-black/3 dark:bg-white/[0.02]">
                  <th className="px-5 py-4 text-left text-xs font-black text-gray-400 uppercase tracking-widest w-12">#</th>
                  <th className="px-4 py-4 text-left text-xs font-black text-gray-400 uppercase tracking-widest">Contact</th>
                  <th className="px-4 py-4 text-left text-xs font-black text-gray-400 uppercase tracking-widest hidden sm:table-cell">Email</th>
                  <th className="px-4 py-4 text-left text-xs font-black text-gray-400 uppercase tracking-widest hidden md:table-cell">Status</th>
                  <th className="px-4 py-4 text-right text-xs font-black text-gray-400 uppercase tracking-widest">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5 dark:divide-white/[0.03]">
                {contacts.map((c, idx) => (
                  <tr key={c.id} className="hover:bg-primary-500/[0.03] dark:hover:bg-primary-500/5 transition-colors group">
                    <td className="px-5 py-3.5 text-xs font-mono text-gray-400">{idx + 1}</td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-primary-500/10 border border-primary-500/20 flex items-center justify-center shrink-0">
                          <span className="text-xs font-black text-primary-500 uppercase">
                            {initials(c.first_name, c.last_name, c.email)}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold dark:text-white text-gray-900 truncate">
                            {c.first_name || c.last_name
                              ? `${c.first_name || ''} ${c.last_name || ''}`.trim()
                              : <span className="text-gray-400 italic">No name</span>}
                          </p>
                          <p className="text-xs text-primary-400 font-mono truncate sm:hidden">{c.email}</p>
                          <StatusBadge status={c.status} className="md:hidden mt-0.5" />
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 hidden sm:table-cell">
                      <span className="text-sm font-mono text-primary-400 truncate max-w-[220px] block">{c.email}</span>
                    </td>
                    <td className="px-4 py-3.5 hidden md:table-cell">
                      <StatusBadge status={c.status} />
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <button
                        onClick={() => removeMut.mutate(c.id)}
                        disabled={removeMut.isPending}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-500/8 text-red-500 border border-red-500/20 hover:bg-red-500 hover:text-white hover:border-red-500 transition-all disabled:opacity-40"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Add Contacts Modal ──────────────────────────────────────────── */}
      {showAddContacts && (
        <div
          className="fixed inset-0 lg:left-72 bg-[#0d0928]/85 z-50 flex items-start justify-center p-4 pt-8 backdrop-blur-xl animate-fade-in"
          onClick={closeModal}
        >
          <div
            className="bg-main border border-black/10 dark:border-white/10 rounded-3xl w-full max-w-xl shadow-2xl flex flex-col animate-scale-in relative overflow-hidden"
            style={{ maxHeight: 'calc(100vh - 4rem)' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="absolute inset-0 tech-grid opacity-10 pointer-events-none" />

            {/* Modal Header */}
            <div className="relative z-10 flex items-start justify-between p-6 pb-4 border-b border-black/5 dark:border-white/5 shrink-0">
              <div>
                <h3 className="text-lg font-black dark:text-white text-gray-900 uppercase tracking-tight">
                  Add Contacts to List
                </h3>
                <p className="text-xs text-gray-500 mt-0.5 font-medium">
                  {availableContacts.length} contact{availableContacts.length !== 1 ? 's' : ''} available
                </p>
              </div>
              <button
                onClick={closeModal}
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-black/5 dark:bg-white/5 text-gray-400 hover:text-gray-700 dark:hover:text-white transition-colors shrink-0 ml-4"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Search + Select All */}
            <div className="relative z-10 px-6 pt-4 pb-3 shrink-0 space-y-3">
              <div className="relative">
                <svg className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  placeholder="Search by name or email…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="input-field pl-10 py-2.5 text-sm"
                  autoFocus
                />
              </div>
              {availableContacts.length > 0 && (
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2.5 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleAll}
                      className="w-4 h-4 rounded text-primary-500 focus:ring-primary-500 border-gray-300 dark:border-white/20"
                    />
                    <span className="text-xs font-semibold text-gray-600 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">
                      {allSelected ? 'Deselect all' : 'Select all'} ({availableContacts.length})
                    </span>
                  </label>
                  {selectedContacts.length > 0 && (
                    <span className="text-xs font-semibold text-primary-500">
                      {selectedContacts.length} selected
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Contacts Scroll List */}
            <div className="relative z-10 flex-1 overflow-y-auto min-h-0 custom-scrollbar px-6 pb-2 space-y-1.5">
              {availableContacts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-black/5 dark:bg-white/5 flex items-center justify-center mb-3">
                    <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                    </svg>
                  </div>
                  <p className="text-sm font-semibold text-gray-500">
                    {search ? 'No contacts match your search' : 'All contacts are already in this list'}
                  </p>
                </div>
              ) : (
                availableContacts.slice(0, 200).map(c => {
                  const selected = selectedContacts.includes(c.id);
                  return (
                    <label
                      key={c.id}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-all ${
                        selected
                          ? 'bg-primary-500/10 border-primary-500/50 dark:border-primary-500/40'
                          : 'bg-black/3 dark:bg-white/[0.03] border-black/8 dark:border-white/[0.06] hover:border-primary-500/30 dark:hover:border-primary-500/25'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => setSelectedContacts(prev =>
                          prev.includes(c.id) ? prev.filter(x => x !== c.id) : [...prev, c.id]
                        )}
                        className="w-4 h-4 rounded text-primary-500 focus:ring-primary-500 border-gray-300 dark:border-white/20 shrink-0"
                      />
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                        selected ? 'bg-primary-500/20' : 'bg-black/5 dark:bg-white/5'
                      }`}>
                        <span className={`text-xs font-black uppercase transition-colors ${
                          selected ? 'text-primary-500' : 'text-gray-500 dark:text-gray-400'
                        }`}>
                          {initials(c.first_name, c.last_name, c.email)}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm font-semibold truncate transition-colors ${
                          selected ? 'text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-200'
                        }`}>
                          {c.first_name || c.last_name
                            ? `${c.first_name || ''} ${c.last_name || ''}`.trim()
                            : <span className="italic text-gray-400">No name</span>}
                        </p>
                        <p className="text-xs text-gray-500 font-mono truncate mt-0.5">{c.email}</p>
                      </div>
                      {selected && (
                        <svg className="w-4 h-4 text-primary-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                      )}
                    </label>
                  );
                })
              )}
            </div>

            {/* Modal Footer */}
            <div className="relative z-10 flex gap-3 p-6 pt-4 border-t border-black/5 dark:border-white/5 shrink-0">
              <button className="btn-secondary flex-1 justify-center" onClick={closeModal}>
                Cancel
              </button>
              <button
                className="btn-primary flex-1 justify-center"
                disabled={selectedContacts.length === 0 || addMut.isPending}
                onClick={() => addMut.mutate(selectedContacts)}
              >
                {addMut.isPending
                  ? 'Adding…'
                  : selectedContacts.length === 0
                    ? 'Select contacts'
                    : `Add ${selectedContacts.length} contact${selectedContacts.length !== 1 ? 's' : ''}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status, className = '' }) {
  const map = {
    subscribed:   'badge-green',
    unsubscribed: 'badge-red',
    bounced:      'badge-yellow',
  };
  return (
    <span className={`badge ${map[status] || 'badge-gray'} ${className}`}>
      {status}
    </span>
  );
}
