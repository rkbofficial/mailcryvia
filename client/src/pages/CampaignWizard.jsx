import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../api/axios';
import toast from 'react-hot-toast';
import ConfirmModal from '../components/ConfirmModal';
import LoadingSpinner from '../components/LoadingSpinner';
import EmailBuilder, { defaultBlock, toFullHtml } from '../components/EmailBuilder';

const STEPS = ['Details', 'Content', 'Review & Launch'];

export default function CampaignWizard() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const isEdit = !!id;

  const [step, setStep] = useState(0);
  const [showSendConfirm, setShowSendConfirm] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [scheduleDate, setScheduleDate] = useState('');
  const [loading, setLoading] = useState(false);

  /* ── Builder state (lifted here so saveCampaign can read it) ── */
  const [blocks,      setBlocks]      = useState([defaultBlock('text')]);
  const [globalStyle, setGlobalStyle] = useState({ emailBg: '#f4f4f8', containerBg: '#ffffff', fontFamily: 'Arial, Helvetica, sans-serif', maxWidth: '600', borderRadius: '16' });
  const [mode,        setMode]        = useState('visual');
  const [rawHtml,     setRawHtml]     = useState('');
  const [viewport,    setViewport]    = useState('desktop');
  const [selectedIdx, setSelectedIdx] = useState(0);

  const [form, setForm] = useState({
    name: '', subject: '', from_name: '', from_email: '', reply_to: '',
    list_id: '', html_content: '', template_id: '', email_integration_id: '',
  });

  const { data: lists } = useQuery({ queryKey: ['lists'], queryFn: () => api.get('/lists').then(r => r.data) });
  const { data: templates } = useQuery({ queryKey: ['templates'], queryFn: () => api.get('/templates').then(r => r.data) });
  const { data: integrationData } = useQuery({ queryKey: ['email-integrations'], queryFn: () => api.get('/email-integrations').then(r => r.data) });
  const { data: campaign, isLoading: isLoadingCampaign } = useQuery({
    queryKey: ['campaign', id],
    queryFn: () => api.get(`/campaigns/${id}/stats`).then(r => r.data.campaign),
    enabled: isEdit,
  });

  const integrations = integrationData?.integrations || [];
  const defaultIntegration = integrations.find(i => i.is_default) || integrations[0];

  useEffect(() => {
    if (campaign) {
      setForm({
        name: campaign.name, subject: campaign.subject,
        from_name: campaign.from_name || '', from_email: campaign.from_email || '',
        reply_to: campaign.reply_to || '', list_id: String(campaign.list_id || ''),
        html_content: campaign.html_content, template_id: '',
        email_integration_id: campaign.email_integration_id ? String(campaign.email_integration_id) : '',
      });
      setRawHtml(campaign.html_content);
      setMode('html');
    }
  }, [campaign]);

  useEffect(() => {
    if (!isEdit && !form.email_integration_id && defaultIntegration) {
      setForm(p => ({ ...p, email_integration_id: String(defaultIntegration.id) }));
    }
  }, [defaultIntegration?.id]);

  const selectedList = (lists || []).find(l => l.id === parseInt(form.list_id));

  const canNext = () => {
    if (step === 0) return form.name && form.subject && form.list_id;
    if (step === 1) return mode === 'visual' ? blocks.length > 0 : rawHtml.length > 0;
    return true;
  };

  const getHtml = () => mode === 'visual' ? toFullHtml(blocks, globalStyle) : rawHtml;

  const saveCampaign = async () => {
    const payload = {
      ...form,
      html_content: getHtml(),
      list_id: parseInt(form.list_id),
      email_integration_id: form.email_integration_id ? parseInt(form.email_integration_id) : null,
    };
    if (isEdit) { await api.put(`/campaigns/${id}`, payload); return { id }; }
    const res = await api.post('/campaigns', payload);
    return res.data;
  };

  const handleSend = async () => {
    setLoading(true);
    try {
      const c = await saveCampaign();
      await api.post(`/campaigns/${c.id}/send`);
      qc.invalidateQueries({ queryKey: ['campaigns'] });
      toast.success('Campaign Sent Successfully');
      navigate('/campaigns');
    } catch (err) { toast.error(err.response?.data?.error || 'Launch Failed'); }
    finally { setLoading(false); setShowSendConfirm(false); }
  };

  const handleSchedule = async () => {
    if (!scheduleDate) { toast.error('Please pick a date'); return; }
    setLoading(true);
    try {
      const c = await saveCampaign();
      await api.post(`/campaigns/${c.id}/schedule`, { scheduled_at: scheduleDate });
      qc.invalidateQueries({ queryKey: ['campaigns'] });
      toast.success('Campaign Scheduled');
      navigate('/campaigns');
    } catch (err) { toast.error(err.response?.data?.error || 'Scheduling Failed'); }
    finally { setLoading(false); setShowSchedule(false); }
  };

  const handleSaveDraft = async () => {
    setLoading(true);
    try {
      await saveCampaign();
      qc.invalidateQueries({ queryKey: ['campaigns'] });
      toast.success('Draft Saved');
      navigate('/campaigns');
    } catch (err) { toast.error(err.response?.data?.error || 'Save Failed'); }
    finally { setLoading(false); }
  };

  if (isLoadingCampaign) return <LoadingSpinner />;

  return (
    <div className="flex flex-col space-y-8 pb-32 animate-fade-in">

      {/* Header */}
      <div className="flex items-center justify-between gap-3 shrink-0 flex-wrap">
        <div className="flex items-center gap-6">
          <button onClick={() => navigate('/campaigns')} className="w-12 h-12 flex items-center justify-center rounded-2xl bg-white/5 border border-white/10 hover:border-primary-500/50 transition-all text-gray-500 hover:text-primary-500">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
          </button>
          <div>
            <h1 className="text-xl sm:text-3xl font-black dark:text-white text-gray-900 tracking-tight uppercase">{isEdit ? 'Edit Campaign' : 'Create Campaign'}</h1>
            <p className="text-[10px] font-bold text-primary-500 uppercase tracking-[0.3em] mt-1">Design and deploy your marketing message</p>
          </div>
        </div>
        <button onClick={handleSaveDraft} disabled={loading} className="btn-secondary">SAVE DRAFT</button>
      </div>

      {/* Steps */}
      <div className="flex items-center justify-between overflow-x-auto px-4 sm:px-6 gap-2 shrink-0">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-2 sm:gap-4 group flex-1 last:flex-none min-w-0">
            <div className={`w-9 h-9 sm:w-12 sm:h-12 shrink-0 rounded-xl sm:rounded-2xl flex items-center justify-center text-xs font-black transition-all duration-500 border ${
              i <= step ? 'bg-primary-500 text-white border-primary-400 shadow-xl shadow-primary-500/30' : 'bg-black/5 dark:bg-white/5 text-gray-600 dark:text-gray-400 border-black/10 dark:border-white/10'
            }`}>{i + 1}</div>
            <span className={`hidden sm:block text-[10px] font-black uppercase tracking-widest whitespace-nowrap ${i <= step ? 'text-primary-400' : 'text-gray-600'}`}>{s}</span>
            {i < STEPS.length - 1 && (
              <div className="flex-1 px-2 sm:px-4 min-w-[16px]">
                <div className={`h-[2px] rounded-full transition-all duration-1000 ${i < step ? 'bg-primary-500' : 'bg-gray-200 dark:bg-white/5'}`} />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Step 0: Details */}
      {step === 0 && (
        <div className="card p-5 sm:p-10 border-none shadow-2xl relative overflow-hidden shrink-0">
          <div className="absolute inset-0 tech-grid opacity-10 pointer-events-none" />
          <div className="space-y-8 animate-slide-up relative z-10">
            <h2 className="text-sm font-black dark:text-white text-gray-900 uppercase tracking-[0.2em] border-l-4 border-primary-500 pl-4">Campaign Details</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div><label className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 block">Campaign Name *</label><input value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="input-field" placeholder="Newsletter Q3" /></div>
              <div><label className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 block">Subject Line *</label><input value={form.subject} onChange={e => setForm({...form, subject: e.target.value})} className="input-field" placeholder="Exclusive updates inside" /></div>
            </div>
            <div>
              <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 block">
                Email Sender
                {integrations.length === 0 && <Link to="/email-integrations" className="ml-2 normal-case font-semibold text-primary-400 hover:underline">+ Add a sender</Link>}
              </label>
              {integrations.length > 0 ? (
                <select value={form.email_integration_id} onChange={e => {
                  const sel = integrations.find(i => String(i.id) === e.target.value);
                  setForm(p => ({ ...p, email_integration_id: e.target.value, from_name: sel ? sel.from_name : p.from_name, from_email: sel ? sel.from_email : p.from_email }));
                }} className="input-field">
                  <option value="">-- Use Global SMTP Settings --</option>
                  {integrations.map(i => <option key={i.id} value={String(i.id)}>{i.name} — {i.from_name} &lt;{i.from_email}&gt;{i.is_default ? ' (default)' : ''}</option>)}
                </select>
              ) : (
                <div className="input-field bg-amber-500/5 border-amber-500/20 text-amber-400 text-xs">No email senders configured. <Link to="/email-integrations" className="underline">Add one in Email Senders</Link> or the global SMTP will be used.</div>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div><label className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 block">From Name</label><input value={form.from_name} onChange={e => setForm({...form, from_name: e.target.value})} className="input-field" placeholder="My Brand" /></div>
              <div><label className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 block">From Email</label><input value={form.from_email} onChange={e => setForm({...form, from_email: e.target.value})} className="input-field" placeholder="hello@brand.com" /></div>
              <div><label className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 block">Reply To</label><input value={form.reply_to} onChange={e => setForm({...form, reply_to: e.target.value})} className="input-field" placeholder="support@brand.com" /></div>
            </div>
            <div>
              <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 block">Target List *</label>
              <select value={form.list_id} onChange={e => setForm({...form, list_id: e.target.value})} className="input-field">
                <option value="">-- SELECT A LIST --</option>
                {(lists || []).map(l => <option key={l.id} value={l.id}>{l.name} ({l.contact_count} contacts)</option>)}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Step 1: Content — advanced builder */}
      {step === 1 && (
        <div className="card border-none shadow-2xl relative overflow-hidden flex flex-col" style={{ height: 'calc(100vh - 12rem)' }}>
          <div className="absolute inset-0 tech-grid opacity-10 pointer-events-none" />
          <div className="relative z-10 flex flex-col h-full p-6">
            <div className="flex items-center justify-between mb-4 shrink-0">
              <h2 className="text-sm font-black dark:text-white text-gray-900 uppercase tracking-[0.2em] border-l-4 border-primary-500 pl-4">Content Design</h2>
              {/* Template quick-load */}
              {templates?.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-[8px] font-black text-gray-500 uppercase tracking-widest">Load Template:</span>
                  <select
                    className="input-field py-1.5 text-[9px] w-44"
                    defaultValue=""
                    onChange={e => {
                      const t = templates.find(t => String(t.id) === e.target.value);
                      if (t) { setRawHtml(t.html_content); setMode('html'); }
                    }}
                  >
                    <option value="">— select —</option>
                    {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
              )}
            </div>
            <div className="flex-1 min-h-0">
              <EmailBuilder
                blocks={blocks}       setBlocks={setBlocks}
                globalStyle={globalStyle} setGlobalStyle={setGlobalStyle}
                mode={mode}           setMode={setMode}
                rawHtml={rawHtml}     setRawHtml={setRawHtml}
                viewport={viewport}   setViewport={setViewport}
                selectedIdx={selectedIdx} setSelectedIdx={setSelectedIdx}
              />
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Review & Launch */}
      {step === 2 && (
        <div className="card p-5 sm:p-10 border-none shadow-2xl relative overflow-hidden shrink-0">
          <div className="absolute inset-0 tech-grid opacity-10 pointer-events-none" />
          <div className="space-y-10 animate-slide-up relative z-10">
            <h2 className="text-sm font-black dark:text-white text-gray-900 uppercase tracking-[0.2em] border-l-4 border-primary-500 pl-4">Review & Send</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <SummaryItem label="Campaign Name" value={form.name} />
              <SummaryItem label="Subject" value={form.subject} />
              <SummaryItem label="List" value={selectedList?.name || '—'} />
            </div>
            <div className="bg-slate-100 dark:bg-black/40 border border-black/5 dark:border-white/5 rounded-3xl sm:rounded-[2.5rem] p-4 sm:p-10 overflow-auto max-h-[400px] shadow-inner">
              <div className="max-w-[600px] mx-auto bg-white rounded-3xl shadow-2xl overflow-hidden">
                <div dangerouslySetInnerHTML={{ __html: getHtml() }} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Nav bar */}
      <div className="flex justify-between items-center glass p-6 rounded-[2.5rem] border-none shadow-2xl sticky bottom-8 z-30 shrink-0">
        <button className="btn-secondary" onClick={() => step > 0 ? setStep(s => s - 1) : navigate('/campaigns')}>BACK</button>
        <div className="flex gap-4">
          {step < 2 ? (
            <button className="btn-primary" disabled={!canNext()} onClick={() => setStep(s => s + 1)}>NEXT</button>
          ) : (
            <>
              <button className="btn-secondary" onClick={() => setShowSchedule(true)}>SCHEDULE</button>
              <button className="btn-primary" onClick={() => setShowSendConfirm(true)} disabled={loading}>{loading ? 'SENDING...' : 'SEND CAMPAIGN'}</button>
            </>
          )}
        </div>
      </div>

      <ConfirmModal isOpen={showSendConfirm} onClose={() => setShowSendConfirm(false)} onConfirm={handleSend} title="Send Campaign?" message="Confirm sending your campaign to the selected list." confirmText="SEND NOW" variant="primary" />

      {showSchedule && (
        <div className="fixed inset-0 lg:left-72 bg-[#0d0928]/85 z-50 flex items-center justify-center p-4 backdrop-blur-xl animate-fade-in" onClick={() => setShowSchedule(false)}>
          <div className="bg-main border border-black/10 dark:border-white/10 rounded-3xl sm:rounded-[3rem] p-6 sm:p-10 max-w-md w-full animate-scale-in shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-2xl font-black dark:text-white text-gray-900 uppercase tracking-tighter mb-4 text-center">Schedule Campaign</h3>
            <input type="datetime-local" value={scheduleDate} onChange={e => setScheduleDate(e.target.value)} className="input-field mb-10 h-14 w-full" />
            <div className="flex gap-4">
              <button className="btn-secondary flex-1" onClick={() => setShowSchedule(false)}>CANCEL</button>
              <button className="btn-primary flex-1" onClick={handleSchedule} disabled={loading}>{loading ? 'SCHEDULING...' : 'SCHEDULE'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryItem({ label, value }) {
  return (
    <div className="bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 rounded-3xl p-6 transition-all hover:border-primary-500/20">
      <p className="text-[9px] font-black text-gray-500 uppercase tracking-[0.2em] mb-2">{label}</p>
      <p className="text-xs font-black dark:text-white text-gray-900 uppercase tracking-wider line-clamp-1">{value}</p>
    </div>
  );
}
