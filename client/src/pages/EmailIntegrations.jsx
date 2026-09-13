import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/axios';
import toast from 'react-hot-toast';
import ToggleSwitch from '../components/ToggleSwitch';

const MASK = '••••••••••••';

const EMPTY_FORM = {
  name: '', from_name: '', from_email: '',
  smtp_host: '', smtp_port: '587', smtp_username: '', smtp_password: '', smtp_tls: 'false',
};

const LBL = 'block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1.5';
const INP = 'w-full px-3 py-2.5 rounded-xl bg-black/10 dark:bg-white/5 border border-black/10 dark:border-white/10 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500/40';

function IntegrationModal({ integration, onClose, onSaved }) {
  const isEdit = Boolean(integration?.id);
  const [form, setForm] = useState(isEdit ? {
    name: integration.name,
    from_name: integration.from_name,
    from_email: integration.from_email,
    smtp_host: integration.smtp_host,
    smtp_port: String(integration.smtp_port || 587),
    smtp_username: integration.smtp_username,
    smtp_password: '',
    smtp_tls: integration.smtp_tls || 'false',
  } : { ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSave = async () => {
    if (!form.name.trim()) return toast.error('Name is required');
    if (!form.from_name.trim()) return toast.error('From Name is required');
    if (!form.from_email.trim()) return toast.error('From Email is required');
    if (!form.smtp_host.trim()) return toast.error('SMTP Host is required');
    if (!form.smtp_username.trim()) return toast.error('SMTP Username is required');
    if (!isEdit && !form.smtp_password.trim()) return toast.error('SMTP Password is required');

    setSaving(true);
    try {
      const payload = { ...form };
      if (isEdit && !payload.smtp_password.trim()) delete payload.smtp_password;

      if (isEdit) {
        await api.put(`/email-integrations/${integration.id}`, payload);
        toast.success('Sender updated');
      } else {
        await api.post('/email-integrations', payload);
        toast.success('Sender added');
      }
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 lg:left-72 z-50 flex items-center justify-center p-4 bg-[#0d0928]/85 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-white dark:bg-[#150c34] rounded-2xl shadow-2xl border border-black/10 dark:border-white/10 overflow-hidden">
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-black/10 dark:border-white/10">
          <div>
            <h2 className="text-sm font-black uppercase tracking-widest dark:text-white text-gray-900">
              {isEdit ? 'Edit Sender' : 'Add Email Sender'}
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">Configure SMTP settings for sending campaigns</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl bg-black/5 dark:bg-white/5 hover:bg-red-500/10 text-gray-400 hover:text-red-500 transition-all">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>

        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={LBL}>Sender Label</label>
              <input value={form.name} onChange={e => set('name', e.target.value)} className={INP} placeholder="e.g. Work Gmail" />
            </div>
            <div>
              <label className={LBL}>From Name</label>
              <input value={form.from_name} onChange={e => set('from_name', e.target.value)} className={INP} placeholder="My Brand" />
            </div>
          </div>
          <div>
            <label className={LBL}>From Email</label>
            <input value={form.from_email} onChange={e => set('from_email', e.target.value)} className={INP} placeholder="hello@brand.com" type="email" />
          </div>

          <div className="border-t border-black/10 dark:border-white/10 pt-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-3">SMTP Settings</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className={LBL}>SMTP Host</label>
                <input value={form.smtp_host} onChange={e => set('smtp_host', e.target.value)} className={INP} placeholder="smtp.gmail.com" />
              </div>
              <div>
                <label className={LBL}>Port</label>
                <input value={form.smtp_port} onChange={e => set('smtp_port', e.target.value)} className={INP} placeholder="587" type="number" />
              </div>
            </div>
            <div className="mt-3">
              <label className={LBL}>SMTP Username</label>
              <input value={form.smtp_username} onChange={e => set('smtp_username', e.target.value)} className={INP} placeholder="you@gmail.com" />
            </div>
            <div className="mt-3">
              <label className={LBL}>SMTP Password {isEdit && <span className="normal-case font-normal text-gray-400">(leave blank to keep current)</span>}</label>
              <input value={form.smtp_password} onChange={e => set('smtp_password', e.target.value)} className={`${INP} font-mono`} type="password" placeholder={isEdit ? MASK : 'App password or SMTP password'} autoComplete="new-password" />
            </div>
            <div className="mt-3 flex items-center gap-3">
              <label className={LBL + ' mb-0'}>Use SSL/TLS</label>
              <ToggleSwitch
                checked={form.smtp_tls === 'true'}
                onChange={v => set('smtp_tls', v ? 'true' : 'false')}
              />
              <span className="text-xs text-gray-500">{form.smtp_tls === 'true' ? 'On (port 465)' : 'Off (STARTTLS, port 587)'}</span>
            </div>
          </div>

        </div>

        <div className="flex gap-3 px-6 pb-6">
          <button onClick={onClose} className="flex-1 btn-secondary justify-center">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="flex-1 btn-primary justify-center">{saving ? 'Saving…' : (isEdit ? 'Save Changes' : 'Add Sender')}</button>
        </div>
      </div>
    </div>
  );
}

export default function EmailIntegrations() {
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [testTarget, setTestTarget] = useState(null);
  const [testEmail, setTestEmail] = useState('');
  const [testing, setTesting] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['email-integrations'],
    queryFn: () => api.get('/email-integrations').then(r => r.data),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['email-integrations'] });

  const deleteMut = useMutation({
    mutationFn: id => api.delete(`/email-integrations/${id}`),
    onSuccess: () => { toast.success('Sender removed'); invalidate(); },
    onError: e => toast.error(e.response?.data?.error || 'Delete failed'),
  });

  const defaultMut = useMutation({
    mutationFn: id => api.put(`/email-integrations/${id}/default`),
    onSuccess: () => { toast.success('Default sender updated'); invalidate(); },
    onError: e => toast.error(e.response?.data?.error || 'Failed'),
  });

  const verifyMut = useMutation({
    mutationFn: id => api.post(`/email-integrations/${id}/verify`),
    onSuccess: (_, id) => { toast.success('SMTP connection verified!'); invalidate(); },
    onError: e => toast.error(e.response?.data?.error || 'Verification failed'),
  });

  const handleSendTest = async () => {
    if (!testEmail.trim()) return toast.error('Enter a recipient email');
    setTesting(true);
    try {
      const r = await api.post(`/email-integrations/${testTarget.id}/send-test`, { to: testEmail });
      toast.success(r.data.message || 'Test email sent!');
      invalidate();
      setTestTarget(null);
      setTestEmail('');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Send failed');
    } finally {
      setTesting(false);
    }
  };

  const integrations = data?.integrations || [];
  const limit = data?.limit ?? 1;
  const used = data?.used ?? 0;
  const atLimit = limit !== -1 && used >= limit;

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black dark:text-white text-gray-900 uppercase tracking-tight">Email Senders</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage the email accounts used to send campaigns.
            {limit === -1
              ? ' Unlimited senders on your plan.'
              : ` ${used} / ${limit} sender${limit === 1 ? '' : 's'} used on your plan.`}
          </p>
        </div>
        <button
          onClick={() => { setEditing(null); setModalOpen(true); }}
          disabled={atLimit}
          title={atLimit ? `Upgrade to add more than ${limit} sender${limit === 1 ? '' : 's'}` : ''}
          className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
        >
          + Add Sender
        </button>
      </div>

      {/* Plan limit bar */}
      {limit !== -1 && (
        <div className="card p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-black uppercase tracking-widest text-gray-500">Email Senders</span>
            <span className="text-xs font-semibold text-gray-500">{used} / {limit}</span>
          </div>
          <div className="w-full bg-black/10 dark:bg-white/10 rounded-full h-1.5">
            <div
              className={`h-1.5 rounded-full transition-all ${atLimit ? 'bg-red-500' : 'bg-primary-500'}`}
              style={{ width: `${Math.min((used / limit) * 100, 100)}%` }}
            />
          </div>
          {atLimit && (
            <p className="text-xs text-red-400 mt-2">You've reached your plan limit. <Link to="/plans" className="text-primary-400 hover:underline">Upgrade your plan</Link> to add more senders.</p>
          )}
        </div>
      )}

      {/* Integration cards */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20 text-gray-500 text-sm">Loading senders…</div>
      ) : integrations.length === 0 ? (
        <div className="card p-6 sm:p-12 text-center">
          <div className="text-4xl mb-4">📧</div>
          <h3 className="text-sm font-black uppercase tracking-widest dark:text-white text-gray-900 mb-2">No email senders yet</h3>
          <p className="text-xs text-gray-500 mb-5">Add your first SMTP email account to start sending campaigns.</p>
          <button onClick={() => { setEditing(null); setModalOpen(true); }} className="btn-primary mx-auto">
            + Add Your First Sender
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {integrations.map(integration => (
            <div key={integration.id} className="card p-5 flex items-center gap-4">
              {/* Avatar */}
              <div className="w-10 h-10 rounded-xl bg-primary-500/10 border border-primary-500/20 flex items-center justify-center text-primary-400 font-black text-sm flex-shrink-0">
                {integration.from_name?.[0]?.toUpperCase() || '?'}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-black dark:text-white text-gray-900">{integration.name}</span>
                  {integration.is_default ? (
                    <span className="px-2 py-0.5 text-[9px] font-black uppercase tracking-widest rounded-full bg-primary-500/10 text-primary-400 border border-primary-500/20">Default</span>
                  ) : null}
                  {integration.is_verified ? (
                    <span className="px-2 py-0.5 text-[9px] font-black uppercase tracking-widest rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">✓ Verified</span>
                  ) : (
                    <span className="px-2 py-0.5 text-[9px] font-black uppercase tracking-widest rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">Unverified</span>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  {integration.from_name} &lt;{integration.from_email}&gt; · SMTP: {integration.smtp_host}:{integration.smtp_port}
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
                {!integration.is_default && (
                  <button
                    onClick={() => defaultMut.mutate(integration.id)}
                    className="px-3 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg bg-black/5 dark:bg-white/5 text-gray-500 hover:text-gray-900 dark:hover:text-white transition-all"
                  >
                    Set Default
                  </button>
                )}
                <button
                  onClick={() => verifyMut.mutate(integration.id)}
                  disabled={verifyMut.isPending}
                  className="px-3 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg bg-black/5 dark:bg-white/5 text-gray-500 hover:text-emerald-400 transition-all"
                >
                  Test SMTP
                </button>
                <button
                  onClick={() => { setTestTarget(integration); setTestEmail(''); }}
                  className="px-3 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg bg-black/5 dark:bg-white/5 text-gray-500 hover:text-blue-400 transition-all"
                >
                  Send Test
                </button>
                <button
                  onClick={() => { setEditing(integration); setModalOpen(true); }}
                  className="px-3 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg bg-black/5 dark:bg-white/5 text-gray-500 hover:text-gray-900 dark:hover:text-white transition-all"
                >
                  Edit
                </button>
                <button
                  onClick={() => {
                    if (confirm(`Remove "${integration.name}"?`)) deleteMut.mutate(integration.id);
                  }}
                  className="px-3 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg bg-black/5 dark:bg-white/5 text-gray-500 hover:text-red-400 transition-all"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit modal */}
      {modalOpen && (
        <IntegrationModal
          integration={editing}
          onClose={() => { setModalOpen(false); setEditing(null); }}
          onSaved={invalidate}
        />
      )}

      {/* Send test email modal */}
      {testTarget && (
        <div className="fixed inset-0 lg:left-72 z-50 flex items-center justify-center p-4 bg-[#0d0928]/85 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-white dark:bg-[#150c34] rounded-2xl shadow-2xl border border-black/10 dark:border-white/10 p-6">
            <h3 className="text-sm font-black uppercase tracking-widest dark:text-white text-gray-900 mb-1">Send Test Email</h3>
            <p className="text-xs text-gray-500 mb-4">Send a test from <strong>{testTarget.name}</strong></p>
            <label className={LBL}>Recipient Email</label>
            <input
              value={testEmail}
              onChange={e => setTestEmail(e.target.value)}
              className={INP}
              placeholder="your@email.com"
              type="email"
            />
            <div className="flex gap-3 mt-4">
              <button onClick={() => { setTestTarget(null); setTestEmail(''); }} className="flex-1 btn-secondary justify-center">Cancel</button>
              <button onClick={handleSendTest} disabled={testing} className="flex-1 btn-primary justify-center">{testing ? 'Sending…' : 'Send Test'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
