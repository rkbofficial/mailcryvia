import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import toast from 'react-hot-toast';
import LoadingSpinner from '../components/LoadingSpinner';
import { format } from 'date-fns';

const INP = 'w-full px-3 py-2.5 rounded-xl bg-black/10 dark:bg-white/5 border border-black/10 dark:border-white/10 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500/40';
function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function ComposeModal({ integrations, defaultIntegrationId, onClose }) {
  const [form, setForm] = useState({
    integration_id: String(defaultIntegrationId || integrations[0]?.id || ''),
    to: '',
    subject: '',
    html_content: '',
  });
  const [sending, setSending] = useState(false);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSend = async () => {
    if (!form.to.trim()) return toast.error('Recipient is required');
    if (!form.subject.trim()) return toast.error('Subject is required');
    if (!form.html_content.trim()) return toast.error('Email content is required');
    setSending(true);
    try {
      await api.post('/inbox/compose', { ...form, integration_id: parseInt(form.integration_id) });
      toast.success('Email sent!');
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Send failed');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 lg:left-72 z-50 flex items-center justify-center p-4 bg-[#0d0928]/85 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-white dark:bg-[#150c34] rounded-2xl shadow-2xl border border-black/10 dark:border-white/10 overflow-hidden">
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-black/10 dark:border-white/10">
          <h2 className="text-sm font-black uppercase tracking-widest dark:text-white text-gray-900">New Email</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl bg-black/5 dark:bg-white/5 hover:bg-red-500/10 text-gray-400 hover:text-red-500 transition-all">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1.5">From</label>
            <select
              value={form.integration_id}
              onChange={e => set('integration_id', e.target.value)}
              className={INP}
            >
              {integrations.map(i => (
                <option key={i.id} value={i.id}>{i.name} ({i.from_email})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1.5">To</label>
            <input value={form.to} onChange={e => set('to', e.target.value)} className={INP} placeholder="recipient@example.com" type="email" />
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1.5">Subject</label>
            <input value={form.subject} onChange={e => set('subject', e.target.value)} className={INP} placeholder="Email subject..." />
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1.5">Message</label>
            <textarea
              value={form.html_content}
              onChange={e => set('html_content', e.target.value)}
              className={`${INP} resize-none`}
              placeholder="Type your message..."
              rows={6}
            />
          </div>
        </div>
        <div className="flex gap-3 px-6 pb-6">
          <button onClick={onClose} className="flex-1 btn-secondary justify-center">Cancel</button>
          <button onClick={handleSend} disabled={sending} className="flex-1 btn-primary justify-center">{sending ? 'Sending…' : 'Send Email'}</button>
        </div>
      </div>
    </div>
  );
}

export default function Inbox() {
  const qc = useQueryClient();
  const [selectedIntegrationId, setSelectedIntegrationId] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [showCompose, setShowCompose] = useState(false);

  const { data: intData, isLoading: intLoading } = useQuery({
    queryKey: ['email-integrations'],
    queryFn: () => api.get('/email-integrations').then(r => r.data),
  });

  const integrations = intData?.integrations || [];

  // Auto-select default integration once data loads
  useEffect(() => {
    if (!selectedIntegrationId && integrations.length > 0) {
      const def = integrations.find(i => i.is_default) || integrations[0];
      setSelectedIntegrationId(def.id);
    }
  }, [integrations, selectedIntegrationId]);

  const selectedIntegration = integrations.find(i => i.id === selectedIntegrationId) || null;

  const { data: messages, isLoading: msgsLoading } = useQuery({
    queryKey: ['inbox', selectedIntegrationId],
    queryFn: () => api.get('/inbox', { params: { integration_id: selectedIntegrationId } }).then(r => r.data),
    enabled: !!selectedIntegrationId,
    refetchInterval: 60000,
    refetchIntervalInBackground: false,
  });

  const { data: selectedMsg, isLoading: isLoadingMsg } = useQuery({
    queryKey: ['inbox-msg', selectedId],
    queryFn: () => api.get(`/inbox/${selectedId}`).then(r => r.data),
    enabled: !!selectedId
  });

  const syncMut = useMutation({
    mutationFn: () => api.post('/inbox/sync', null, { params: { integration_id: selectedIntegrationId } }).then(r => r.data),
    onMutate: () => setIsSyncing(true),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['inbox', selectedIntegrationId] });
      toast.success(data.newMessages > 0 ? `${data.newMessages} new message${data.newMessages === 1 ? '' : 's'}` : 'Inbox up to date');
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Sync failed'),
    onSettled: () => setIsSyncing(false)
  });

  const replyMut = useMutation({
    mutationFn: (content) => api.post(`/inbox/${selectedId}/reply`, { html_content: content, integration_id: selectedIntegrationId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inbox', selectedIntegrationId] });
      qc.invalidateQueries({ queryKey: ['inbox-msg', selectedId] });
      toast.success('Reply Sent');
      setReplyText('');
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Send failed')
  });

  const deleteMut = useMutation({
    mutationFn: (id) => api.delete(`/inbox/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inbox', selectedIntegrationId] });
      setSelectedId(null);
      toast.success('Message Deleted');
    }
  });

  if (intLoading) return <LoadingSpinner />;

  if (integrations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center animate-fade-in">
        <div className="w-20 h-20 bg-primary-500/10 border border-primary-500/20 rounded-3xl flex items-center justify-center mb-6">
          <svg className="w-9 h-9 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <h2 className="text-lg font-black dark:text-white text-gray-900 uppercase tracking-widest mb-2">No Email Accounts</h2>
        <p className="text-sm text-gray-500 mb-6 max-w-xs">Add an email sender in Email Senders to send, receive, and manage emails here.</p>
        <Link to="/email-integrations" className="btn-primary">Go to Email Senders</Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-auto lg:h-[calc(100vh-8rem)] animate-scale-in">
      {/* Top bar: account selector + actions */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <span className="text-[10px] font-black uppercase tracking-widest text-gray-500 whitespace-nowrap">Account:</span>
        <select
          value={selectedIntegrationId || ''}
          onChange={e => { setSelectedIntegrationId(parseInt(e.target.value)); setSelectedId(null); }}
          className="flex-1 min-w-0 px-3 py-2 rounded-xl bg-black/10 dark:bg-white/5 border border-black/10 dark:border-white/10 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500/40"
        >
          {integrations.map(i => (
            <option key={i.id} value={i.id}>{i.name} — {i.from_email}</option>
          ))}
        </select>
        <button onClick={() => setShowCompose(true)} className="btn-primary flex-shrink-0">
          + Compose
        </button>
        {selectedIntegration?.imap_host && (
          <button
            onClick={() => syncMut.mutate()}
            disabled={isSyncing}
            className={`p-2.5 rounded-xl bg-primary-500/10 text-primary-500 border border-primary-500/20 hover:bg-primary-500/20 transition-all flex-shrink-0 ${isSyncing ? 'animate-spin' : ''}`}
            title="Sync inbox"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        )}
      </div>

      {/* IMAP notice */}
      {selectedIntegration && !selectedIntegration.imap_host && (
        <div className="mb-3 px-4 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold flex items-center gap-2">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          <span>IMAP not configured — incoming mail won't sync. You can still compose and send.</span>
          <Link to="/email-integrations" className="underline ml-auto whitespace-nowrap">Configure IMAP</Link>
        </div>
      )}

      {/* Main layout */}
      <div className="flex flex-col lg:flex-row flex-1 card overflow-hidden border-none shadow-2xl min-h-0">
        {/* Message list */}
        <div className="w-full lg:w-[320px] flex-shrink-0 border-r border-black/5 dark:border-white/5 flex flex-col max-h-[340px] lg:max-h-none bg-black/5 dark:bg-black/20">
          <div className="p-4 border-b border-black/5 dark:border-white/5 bg-white/[0.02]">
            <h2 className="text-xs font-black dark:text-white text-gray-900 uppercase tracking-[0.2em]">Inbox</h2>
            <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mt-0.5 truncate">{selectedIntegration?.name}</p>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar divide-y divide-black/5 dark:divide-white/[0.02]">
            {msgsLoading ? (
              <div className="p-8 flex justify-center"><LoadingSpinner /></div>
            ) : !messages || messages.length === 0 ? (
              <div className="p-10 text-center">
                <div className="w-10 h-10 bg-white/5 rounded-2xl flex items-center justify-center mx-auto mb-3 border border-white/5 opacity-20">
                  <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" /></svg>
                </div>
                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">No messages</p>
                {selectedIntegration?.imap_host && (
                  <button onClick={() => syncMut.mutate()} className="text-[9px] font-black text-primary-400 mt-2 hover:underline uppercase tracking-widest">Sync now</button>
                )}
              </div>
            ) : messages.map(msg => (
              <div
                key={msg.id}
                onClick={() => setSelectedId(msg.id)}
                className={`p-5 cursor-pointer transition-all relative group ${
                  selectedId === msg.id ? 'bg-primary-500/10 dark:bg-primary-500/20' : 'hover:bg-white/[0.02]'
                } ${!msg.is_read ? 'border-l-4 border-primary-500' : ''}`}
              >
                <div className="flex justify-between items-start mb-1.5">
                  <span className={`text-[11px] uppercase tracking-wider truncate pr-2 ${!msg.is_read ? 'font-black dark:text-white text-gray-900' : 'font-bold text-gray-400'}`}>
                    {msg.from_name || msg.from_email}
                  </span>
                  <span className="text-[8px] font-black text-gray-600 whitespace-nowrap">
                    {msg.date ? format(new Date(msg.date), 'HH:mm') : ''}
                  </span>
                </div>
                <div className={`text-xs truncate mb-1 ${!msg.is_read ? 'font-black text-primary-400' : 'font-bold text-gray-500'}`}>
                  {msg.subject || '(No Subject)'}
                </div>
                <div className="text-[10px] text-gray-600 truncate font-medium">{msg.text_content}</div>
                {selectedId === msg.id && (
                  <div className="absolute right-0 top-0 bottom-0 w-1 bg-primary-500" />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Message view */}
        <div className="flex-1 flex flex-col bg-white/[0.01] backdrop-blur-3xl relative min-w-0">
          <div className="absolute inset-0 tech-grid opacity-10 pointer-events-none" />
          {selectedId ? (
            isLoadingMsg ? (
              <div className="flex-1 flex items-center justify-center"><LoadingSpinner /></div>
            ) : selectedMsg ? (
              <div className="flex flex-col h-full relative z-10">
                <div className="p-4 border-b border-black/5 dark:border-white/5 flex justify-between items-center bg-black/5 dark:bg-black/20">
                  <button
                    onClick={() => deleteMut.mutate(selectedMsg.id)}
                    className="w-9 h-9 flex items-center justify-center text-gray-500 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all border border-transparent hover:border-red-500/20"
                    title="Delete"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                  <div className="text-[10px] font-black text-gray-600 uppercase tracking-widest">
                    {selectedMsg.date ? format(new Date(selectedMsg.date), 'yyyy.MM.dd HH:mm') : ''}
                  </div>
                </div>
                <div className="p-8 border-b border-black/5 dark:border-white/5">
                  <h1 className="text-xl font-black dark:text-white text-gray-900 mb-4 tracking-tight uppercase">{selectedMsg.subject}</h1>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary-500 text-white rounded-xl flex items-center justify-center font-black shadow-lg shadow-primary-500/20 flex-shrink-0">
                      {(selectedMsg.from_name || selectedMsg.from_email || '?')[0].toUpperCase()}
                    </div>
                    <div>
                      <div className="text-xs font-black dark:text-white text-gray-900 uppercase tracking-widest">{selectedMsg.from_name}</div>
                      <div className="text-[10px] font-bold text-primary-400 mt-0.5">{selectedMsg.from_email}</div>
                    </div>
                  </div>
                </div>
                <div className="flex-1 p-8 overflow-y-auto custom-scrollbar">
                  <div
                    className="prose dark:prose-invert prose-sm max-w-none dark:text-gray-300 text-gray-700 font-medium leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: selectedMsg.html_content || `<pre class="text-xs bg-black/10 p-4 rounded-xl overflow-auto">${escapeHtml(selectedMsg.text_content)}</pre>` }}
                  />
                </div>
                <div className="p-6 border-t border-black/5 dark:border-white/5 bg-black/5 dark:bg-black/20">
                  <div className="relative group">
                    <div className="absolute -inset-0.5 bg-gradient-to-r from-primary-500/20 to-purple-500/20 rounded-2xl blur opacity-0 group-focus-within:opacity-100 transition duration-500" />
                    <div className="relative bg-white dark:bg-black/40 rounded-2xl border border-black/5 dark:border-white/10 overflow-hidden shadow-xl">
                      <textarea
                        value={replyText}
                        onChange={e => setReplyText(e.target.value)}
                        placeholder="Type your reply..."
                        className="w-full p-5 bg-transparent border-none focus:ring-0 text-sm min-h-[100px] resize-none dark:text-white placeholder:text-gray-600 font-medium"
                      />
                      <div className="flex justify-between items-center px-5 py-3 bg-black/5 dark:bg-black/40 border-t border-black/5 dark:border-white/5">
                        <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">via: {selectedIntegration?.from_email}</span>
                        <button
                          onClick={() => replyMut.mutate(replyText)}
                          disabled={!replyText.trim() || replyMut.isPending}
                          className="btn-primary"
                        >
                          {replyMut.isPending ? 'SENDING...' : 'SEND REPLY'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-gray-600 font-black uppercase tracking-widest text-xs">Error loading message</div>
            )
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-12 relative z-10">
              <div className="w-20 h-20 bg-white/5 border border-white/5 rounded-[2rem] flex items-center justify-center mb-5 shadow-2xl">
                <svg className="w-9 h-9 text-primary-500 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                </svg>
              </div>
              <h3 className="text-lg font-black dark:text-white text-gray-900 uppercase tracking-[0.3em]">No Message Selected</h3>
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-2">Select a message or compose a new one</p>
              <button onClick={() => setShowCompose(true)} className="btn-primary mt-5">+ Compose New Email</button>
            </div>
          )}
        </div>
      </div>

      {showCompose && (
        <ComposeModal
          integrations={integrations}
          defaultIntegrationId={selectedIntegrationId}
          onClose={() => setShowCompose(false)}
        />
      )}
    </div>
  );
}
