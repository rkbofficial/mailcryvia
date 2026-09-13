import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { createPortal } from 'react-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { PLAN_FEATURES } from '../planFeatures';

/* ─── Billing cycles ─────────────────────────────────────────────── */
const CYCLES = [
  { id: 'monthly',  label: 'Monthly',  months: 1,  discount: 0 },
  { id: 'biannual', label: '6 Months', months: 6,  discount: 10 },
  { id: 'yearly',   label: 'Yearly',   months: 12, discount: 20 },
];

function displayPrice(priceInr, cycleId) {
  if (priceInr === 0) return 0;
  const c = CYCLES.find(x => x.id === cycleId) || CYCLES[0];
  return Math.round(priceInr * (1 - c.discount / 100));
}

function totalAmount(priceInr, cycleId) {
  if (priceInr === 0) return 0;
  const c = CYCLES.find(x => x.id === cycleId) || CYCLES[0];
  return Math.round(priceInr * (1 - c.discount / 100)) * c.months;
}

function billedLabel(cycleId) {
  if (cycleId === 'biannual') return 'billed every 6 months';
  if (cycleId === 'yearly')   return 'billed annually';
  return 'billed monthly';
}

/* ─────────────── Per-plan theme ─────────────────────────────────── */
const THEME = {
  free: {
    accent: '#22c55e', name: 'text-emerald-600 dark:text-emerald-500',
    price: 'text-emerald-600 dark:text-emerald-500',
    icon_bg: 'bg-emerald-50 dark:bg-emerald-500/10',
    icon_color: 'text-emerald-600 dark:text-emerald-500',
    check: 'text-emerald-600 dark:text-emerald-500',
    recipient_bg: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/20',
    btn: 'border-2 border-emerald-500 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500 hover:text-white',
    card: 'bg-white dark:bg-[#150c34] border border-violet-100 dark:border-violet-900/40',
    popular: false, tagline: 'Perfect for getting started', editBtn: 'text-emerald-500 hover:text-emerald-400',
  },
  professional: {
    accent: '#8b5cf6', name: 'text-violet-700 dark:text-primary-400',
    price: 'text-violet-700 dark:text-primary-400',
    icon_bg: 'bg-primary-50 dark:bg-primary-500/10',
    icon_color: 'text-violet-700 dark:text-primary-400',
    check: 'text-violet-600 dark:text-primary-400',
    recipient_bg: 'bg-primary-50 dark:bg-primary-500/10 text-violet-700 dark:text-primary-300 border-primary-200 dark:border-primary-500/20',
    btn: 'bg-primary-500 hover:bg-primary-400 text-white shadow-lg shadow-primary-500/30',
    card: 'bg-white dark:bg-[#150c34] border-2 border-primary-400 dark:border-primary-500',
    popular: true, tagline: 'Best for growing businesses', editBtn: 'text-primary-500 hover:text-primary-400',
  },
  business: {
    accent: '#3b82f6', name: 'text-blue-700 dark:text-blue-400',
    price: 'text-blue-700 dark:text-blue-400',
    icon_bg: 'bg-blue-50 dark:bg-blue-500/10',
    icon_color: 'text-blue-700 dark:text-blue-400',
    check: 'text-blue-600 dark:text-blue-400',
    recipient_bg: 'bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-500/20',
    btn: 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/30',
    card: 'bg-white dark:bg-[#150c34] border border-violet-100 dark:border-violet-900/40',
    popular: false, tagline: 'For established businesses', editBtn: 'text-blue-500 hover:text-blue-400',
  },
  enterprise: {
    accent: '#f59e0b', name: 'text-amber-700 dark:text-amber-400',
    price: 'text-amber-700 dark:text-amber-400',
    icon_bg: 'bg-amber-50 dark:bg-amber-500/10',
    icon_color: 'text-amber-700 dark:text-amber-400',
    check: 'text-amber-600 dark:text-amber-400',
    recipient_bg: 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/20',
    btn: 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white shadow-lg shadow-amber-500/30',
    card: 'bg-white dark:bg-[#150c34] border border-violet-100 dark:border-violet-900/40',
    popular: false, tagline: 'For large organizations', editBtn: 'text-amber-500 hover:text-amber-400',
  },
};

const PlanIcon = ({ slug, className }) => {
  const icons = {
    free: <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}><path strokeLinecap="round" strokeLinejoin="round" d="M21 11.25v8.25a1.5 1.5 0 01-1.5 1.5H5.25a1.5 1.5 0 01-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 1014.25 7.5H12m0-2.625V7.5m0-2.625A2.625 2.625 0 109.75 7.5H12m0 0V21m-8.625-9.75h18c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125h-18c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z"/></svg>,
    professional: <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}><path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m-2.24 2.39a4.493 4.493 0 00-1.757 4.306 4.493 4.493 0 004.306-1.758M16.5 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z"/></svg>,
    business: <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21"/></svg>,
    enterprise: <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}><path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"/></svg>,
  };
  return icons[slug] || icons.professional;
};

const CMP_ROWS = [
  { label: 'Price / month',          fn: (p, cy) => p.price_inr === 0 ? 'Free' : `₹${displayPrice(p.price_inr, cy).toLocaleString('en-IN')}` },
  { label: 'Recipients / day',       fn: p => p.recipients_per_day === -1 ? 'Unlimited' : p.recipients_per_day.toLocaleString() },
  { label: 'Max contacts',           fn: p => p.max_contacts === -1 ? 'Unlimited' : p.max_contacts.toLocaleString() },
  { label: 'Campaigns / month',      fn: p => p.max_campaigns_per_month === -1 ? 'Unlimited' : String(p.max_campaigns_per_month) },
  { label: 'Email senders',          fn: p => p.max_email_integrations === -1 ? 'Unlimited' : String(p.max_email_integrations ?? 1) },
  { label: 'Campaign templates',     fn: () => '✓' },
  { label: 'Analytics',              fn: p => p.slug === 'free' ? 'Basic' : 'Advanced' },
  { label: 'Email automations',      fn: p => p.slug === 'free' ? '—' : '✓' },
];

/* ─────────────── Edit Plan Modal (admin only) ───────────────────── */
function EditPlanModal({ plan, onClose, onSave }) {
  const [form, setForm] = useState({
    name: plan.name, price_inr: plan.price_inr,
    recipients_per_day: plan.recipients_per_day, max_contacts: plan.max_contacts,
    max_campaigns_per_month: plan.max_campaigns_per_month,
    features: [...plan.features], is_active: plan.is_active !== 0,
  });
  const [newFeature, setNewFeature] = useState('');
  const [saving, setSaving]         = useState(false);
  const inputRef = useRef(null);
  const t = THEME[plan.slug] || THEME.professional;

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const addFeature = () => { const f = newFeature.trim(); if (!f) return; set('features', [...form.features, f]); setNewFeature(''); inputRef.current?.focus(); };
  const removeFeature = i => set('features', form.features.filter((_, j) => j !== i));
  const moveFeature = (i, dir) => { const arr = [...form.features]; const j = i + dir; if (j < 0 || j >= arr.length) return; [arr[i], arr[j]] = [arr[j], arr[i]]; set('features', arr); };
  const submit = async () => { if (!form.name.trim()) { toast.error('Plan name is required'); return; } setSaving(true); try { await onSave(plan.id, form); onClose(); } finally { setSaving(false); } };

  return createPortal(
    <div className="fixed inset-0 lg:left-72 z-[9999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[#0d0928]/85 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-xl flex flex-col card shadow-2xl overflow-hidden" style={{ maxHeight: '90vh' }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-black/5 dark:border-white/5 shrink-0" style={{ background: t.accent + '10' }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: t.accent + '20', border: `1.5px solid ${t.accent}40` }}>
              <svg className="w-4 h-4" style={{ color: t.accent }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
            </div>
            <div>
              <h3 className="text-sm font-black dark:text-white text-gray-900 uppercase tracking-widest">Edit Plan</h3>
              <p className="text-xs font-bold text-gray-500">slug: {plan.slug}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-black/10 dark:hover:bg-white/10 text-gray-500 transition-all">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-black text-gray-600 dark:text-gray-500 uppercase tracking-widest mb-1.5">Plan Name</label>
              <input value={form.name} onChange={e => set('name', e.target.value)} className="input-field py-2.5 text-sm font-bold" />
            </div>
            <div>
              <label className="block text-xs font-black text-gray-600 dark:text-gray-500 uppercase tracking-widest mb-1.5">Status</label>
              <button type="button" onClick={() => set('is_active', !form.is_active)} className={`w-full py-2.5 text-xs font-black uppercase tracking-widest rounded-xl border transition-all ${form.is_active ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30' : 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30'}`}>
                {form.is_active ? '● Active' : '○ Hidden'}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-xs font-black text-gray-600 dark:text-gray-500 uppercase tracking-widest mb-1.5">Price (INR / month — 0 for free)</label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-black text-gray-500">₹</span>
              <input type="number" min={0} value={form.price_inr} onChange={e => set('price_inr', parseInt(e.target.value) || 0)} className="input-field py-2.5 text-sm font-bold pl-8" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-black text-gray-600 dark:text-gray-500 uppercase tracking-widest mb-1.5">Limits (-1 = unlimited)</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[{ label: 'Recipients/day', key: 'recipients_per_day' }, { label: 'Max contacts', key: 'max_contacts' }, { label: 'Campaigns/mo', key: 'max_campaigns_per_month' }].map(({ label, key }) => (
                <div key={key}>
                  <p className="text-[9px] font-black text-gray-600 dark:text-gray-500 uppercase tracking-widest mb-1">{label}</p>
                  <input type="number" value={form[key]} onChange={e => set(key, parseInt(e.target.value))} className="input-field py-2 text-sm font-bold" />
                </div>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-black text-gray-600 dark:text-gray-500 uppercase tracking-widest mb-1.5">Features ({form.features.length})</label>
            <div className="space-y-1.5 mb-3 max-h-48 overflow-y-auto custom-scrollbar pr-1">
              {form.features.length === 0 && <p className="text-xs font-bold text-gray-500 text-center py-4 border border-dashed border-gray-600 rounded-xl">No features yet</p>}
              {form.features.map((f, i) => (
                <div key={i} className="flex items-center gap-2 p-2.5 rounded-xl bg-black/5 dark:bg-white/5 group">
                  <div className="flex flex-col gap-0.5 shrink-0">
                    <button onClick={() => moveFeature(i, -1)} disabled={i === 0} className="w-4 h-3 flex items-center justify-center text-gray-400 hover:text-white disabled:opacity-20"><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7"/></svg></button>
                    <button onClick={() => moveFeature(i, 1)} disabled={i === form.features.length - 1} className="w-4 h-3 flex items-center justify-center text-gray-400 hover:text-white disabled:opacity-20"><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/></svg></button>
                  </div>
                  <span className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex-1 min-w-0 truncate">{f}</span>
                  <button onClick={() => removeFeature(i)} className="w-5 h-5 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all shrink-0"><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg></button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input ref={inputRef} value={newFeature} onChange={e => setNewFeature(e.target.value)} onKeyDown={e => e.key === 'Enter' && addFeature()} placeholder="Type feature and press Enter…" className="input-field py-2 text-sm flex-1" />
              <button onClick={addFeature} disabled={!newFeature.trim()} className="px-4 py-2 text-xs font-black uppercase tracking-widest rounded-xl bg-primary-500/10 text-primary-600 dark:text-primary-400 border border-primary-500/20 hover:bg-primary-500/20 disabled:opacity-40 transition-all shrink-0">+ Add</button>
            </div>
          </div>
        </div>
        <div className="flex gap-3 px-6 py-4 border-t border-black/5 dark:border-white/5 shrink-0">
          <button onClick={onClose} className="flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-xl bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-gray-600 dark:text-gray-500 transition-all">Cancel</button>
          <button onClick={submit} disabled={saving} className="flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-xl text-white transition-all disabled:opacity-60" style={{ background: saving ? '#888' : t.accent }}>
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

/* ─────────────── Manual Payment Modal ───────────────────────────── */
function PaymentModal({ plan, billingCycle, paymentInfo, onClose, onSubmit, loading }) {
  const t = THEME[plan?.slug] || THEME.professional;
  const [txnId, setTxnId]         = useState('');
  const [method, setMethod]       = useState('upi');
  const [note, setNote]           = useState('');
  const total                     = totalAmount(plan.price_inr, billingCycle);
  const monthly                   = displayPrice(plan.price_inr, billingCycle);
  const cycle                     = CYCLES.find(c => c.id === billingCycle) || CYCLES[0];

  const hasUpi  = Boolean(paymentInfo?.upi_id);
  const hasBank = Boolean(paymentInfo?.bank_account);
  const hasInfo = hasUpi || hasBank || paymentInfo?.payment_instructions;

  const handleSubmit = () => {
    if (!txnId.trim()) { toast.error('Please enter your Transaction ID / UTR number'); return; }
    onSubmit({ transaction_id: txnId.trim(), payment_method: method, note, amount: total });
  };

  return createPortal(
    <div className="fixed inset-0 lg:left-72 z-[9999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[#0d0928]/85 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg flex flex-col card shadow-2xl overflow-hidden" style={{ maxHeight: '92vh' }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="px-6 py-5 border-b border-black/5 dark:border-white/5 shrink-0" style={{ background: t.accent + '10' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: t.accent + '20' }}>
                <PlanIcon slug={plan.slug} className="w-5 h-5" style={{ color: t.accent }} />
              </div>
              <div>
                <h3 className="text-sm font-black dark:text-white text-gray-900 uppercase tracking-widest">Upgrade to {plan.name}</h3>
                <p className="text-xs font-bold text-gray-500">Manual payment — admin will verify</p>
              </div>
            </div>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-black/10 dark:hover:bg-white/10 text-gray-500 transition-all">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-5">

          {/* Amount summary */}
          <div className="flex items-center justify-between p-4 rounded-2xl border" style={{ background: t.accent + '08', borderColor: t.accent + '25' }}>
            <div>
              <p className="text-xs font-black text-gray-500 uppercase tracking-widest mb-0.5">Amount to Pay</p>
              <p className="text-3xl font-black" style={{ color: t.accent }}>₹{total.toLocaleString('en-IN')}</p>
              {cycle.months > 1 && (
                <p className="text-xs font-semibold text-gray-500 mt-0.5">₹{monthly.toLocaleString('en-IN')}/mo × {cycle.months} months</p>
              )}
              <p className="text-[10px] font-bold text-gray-400 mt-0.5">Incl. 18% GST · {billedLabel(billingCycle)}</p>
            </div>
            {cycle.discount > 0 && (
              <span className="px-3 py-1.5 rounded-xl text-xs font-black text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20">
                Save {cycle.discount}%
              </span>
            )}
          </div>

          {/* Payment instructions from admin */}
          {hasInfo ? (
            <div className="space-y-3">
              <p className="text-xs font-black text-gray-600 dark:text-gray-500 uppercase tracking-widest">Payment Details</p>

              {hasUpi && (
                <div className="flex items-center gap-3 p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/20">
                  <div className="w-9 h-9 rounded-xl bg-blue-500/20 flex items-center justify-center shrink-0">
                    <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/></svg>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest">UPI ID</p>
                    <p className="text-sm font-black dark:text-white text-gray-900 mt-0.5 break-all">{paymentInfo.upi_id}</p>
                  </div>
                </div>
              )}

              {hasBank && (
                <div className="p-3.5 rounded-xl bg-purple-500/10 border border-purple-500/20 space-y-1.5">
                  <p className="text-[10px] font-black text-purple-500 uppercase tracking-widest">Bank Transfer</p>
                  {paymentInfo.bank_name    && <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">Bank: <span className="font-black dark:text-white text-gray-900">{paymentInfo.bank_name}</span></p>}
                  {paymentInfo.bank_account && <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">Account: <span className="font-black dark:text-white text-gray-900">{paymentInfo.bank_account}</span></p>}
                  {paymentInfo.bank_ifsc    && <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">IFSC: <span className="font-black dark:text-white text-gray-900">{paymentInfo.bank_ifsc}</span></p>}
                </div>
              )}

              {paymentInfo?.payment_instructions && (
                <div className="p-3.5 rounded-xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10">
                  <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5">Instructions</p>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-line">{paymentInfo.payment_instructions}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-start gap-3 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25">
              <svg className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>
              <div>
                <p className="text-xs font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest">Payment details not configured</p>
                <p className="text-xs font-semibold text-gray-600 dark:text-gray-500 mt-1 leading-relaxed">Contact the administrator for payment details before submitting.</p>
              </div>
            </div>
          )}

          {/* Transaction ID */}
          <div>
            <label className="block text-xs font-black text-gray-600 dark:text-gray-500 uppercase tracking-widest mb-2">
              Transaction ID / UTR Number <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={txnId}
              onChange={e => setTxnId(e.target.value)}
              placeholder="e.g. 408303XXXXXX or UTR1234567890"
              className="input-field"
            />
            <p className="text-[10px] font-semibold text-gray-500 mt-1.5">After paying, enter the transaction/reference/UTR number shown in your payment app.</p>
          </div>

          {/* Payment method */}
          <div>
            <label className="block text-xs font-black text-gray-600 dark:text-gray-500 uppercase tracking-widest mb-2">Payment Method</label>
            <div className="flex gap-2 flex-wrap">
              {[{ id: 'upi', label: 'UPI' }, { id: 'bank', label: 'Bank Transfer' }, { id: 'card', label: 'Debit/Credit Card' }, { id: 'other', label: 'Other' }].map(m => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMethod(m.id)}
                  className={`px-4 py-2 text-xs font-black uppercase tracking-widest rounded-xl border transition-all ${
                    method === m.id
                      ? 'bg-primary-500 text-white border-primary-500'
                      : 'bg-black/5 dark:bg-white/5 text-gray-600 dark:text-gray-400 border-black/10 dark:border-white/10 hover:border-primary-500/40'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Optional note */}
          <div>
            <label className="block text-xs font-black text-gray-600 dark:text-gray-500 uppercase tracking-widest mb-2">Note (optional)</label>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Any additional info for the admin…"
              rows={2}
              className="input-field resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4 border-t border-black/5 dark:border-white/5 shrink-0">
          <button onClick={onClose} className="flex-1 py-3.5 text-xs font-black uppercase tracking-widest rounded-xl bg-black/5 dark:bg-white/5 text-gray-700 dark:text-gray-400 hover:bg-black/10 transition-all">Cancel</button>
          <button
            onClick={handleSubmit}
            disabled={loading || !txnId.trim()}
            className="flex-1 py-3.5 text-xs font-black uppercase tracking-widest rounded-xl text-white transition-all disabled:opacity-60"
            style={{ background: loading ? '#888' : t.accent }}
          >
            {loading ? 'Submitting…' : 'Submit Payment Proof →'}
          </button>
        </div>
        <p className="text-center text-xs text-gray-500 pb-4">Your plan will activate after admin verification · usually within 24 hours</p>
      </div>
    </div>,
    document.body
  );
}

/* ═══════════════════════════════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════════════════════════════ */
export default function Plans() {
  const { user, updateUser } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const qc = useQueryClient();

  const validTabs = ['plans', 'compare'];
  const [tab, setTab]               = useState(validTabs.includes(searchParams.get('tab')) ? searchParams.get('tab') : 'plans');
  const [billingCycle, setBillingCycle] = useState('monthly');
  const [upgrading, setUpgrading]   = useState(null);
  const [paymentPlan, setPaymentPlan] = useState(null);
  const [editingPlan, setEditingPlan] = useState(null);

  const isAdmin = user?.role === 'admin';

  const switchTab = t => { setTab(t); setSearchParams(t === 'plans' ? {} : { tab: t }, { replace: true }); };

  const { data: plans = [], isLoading: plansLoading, isError: plansError, refetch: refetchPlans } = useQuery({
    queryKey: ['plans'],
    queryFn: () => api.get('/plans').then(r => r.data),
    retry: 2, retryDelay: 1000,
  });

  const { data: billing } = useQuery({
    queryKey: ['billing'],
    queryFn: () => api.get('/subscriptions/current').then(r => r.data),
    refetchInterval: 30000,
  });

  const { data: paymentInfo = {} } = useQuery({
    queryKey: ['payment-info'],
    queryFn: () => api.get('/settings/payment-info').then(r => r.data),
    staleTime: 30000,
    refetchInterval: 60000,
  });

  const { data: paymentStatus = {} } = useQuery({
    queryKey: ['payment-status'],
    queryFn: () => api.get('/settings/payment-status').then(r => r.data),
    staleTime: 15000,
    refetchInterval: 30000,
  });

  const razorpayActive = Boolean(paymentStatus?.configured && paymentStatus?.payments_enabled);

  const currentPlanId = billing?.user?.plan_id ?? user?.plan_id ?? 1;
  const currentPlan   = plans.find(p => p.id === currentPlanId) || plans[0];

  const savePlanMut = useMutation({
    mutationFn: ([id, data]) => api.put(`/admin/plans/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['plans'] });
      qc.invalidateQueries({ queryKey: ['admin-plans'] });
      qc.invalidateQueries({ queryKey: ['billing'] });
      toast.success('Plan updated');
    },
    onError: err => toast.error(err.response?.data?.error || 'Failed to save plan'),
  });

  /* ── Free plan switch ── */
  const handleSwitchFree = async () => {
    setUpgrading('free');
    try {
      await api.post('/subscriptions/activate-free');
      toast.success('Switched to Free plan');
      qc.invalidateQueries({ queryKey: ['billing'] });
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed');
    } finally {
      setUpgrading(null);
    }
  };

  /* ── Submit manual payment ── */
  const handlePaymentSubmit = async ({ transaction_id, payment_method, note }) => {
    if (!paymentPlan) return;
    setUpgrading(paymentPlan.id);
    try {
      await api.post('/subscriptions/request', {
        plan_id: paymentPlan.id,
        billing_cycle: billingCycle,
        transaction_id,
        payment_method,
        note,
      });
      toast.success('Payment submitted! Admin will verify and activate your plan shortly.');
      qc.invalidateQueries({ queryKey: ['my-requests'] });
      setPaymentPlan(null);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to submit payment');
    } finally {
      setUpgrading(null);
    }
  };

  const loadRazorpayScript = () => new Promise(resolve => {
    if (window.Razorpay) return resolve(true);
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });

  const handleRazorpayCheckout = async plan => {
    setUpgrading(plan.id);
    try {
      const { data: order } = await api.post('/subscriptions/create-order', {
        plan_id: plan.id,
        billing_cycle: billingCycle,
      });
      const loaded = await loadRazorpayScript();
      if (!loaded) { toast.error('Could not load payment gateway. Check your connection.'); return; }

      await new Promise((resolve, reject) => {
        const rzp = new window.Razorpay({
          key: order.key_id,
          amount: order.amount,
          currency: order.currency,
          name: 'MailcryVia',
          description: `${plan.name} Plan — ${billingCycle}`,
          order_id: order.order_id,
          prefill: { email: user?.email || '', name: user?.name || '' },
          theme: { color: '#8b5cf6' },
          modal: { ondismiss: () => resolve() },
          handler: async response => {
            try {
              const { data } = await api.post('/subscriptions/verify', {
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              });
              toast.success(`Upgraded to ${plan.name}! Your plan is now active.`);
              qc.invalidateQueries({ queryKey: ['billing'] });
              if (updateUser) updateUser(data.user);
              resolve();
            } catch (err) {
              toast.error(err.response?.data?.error || 'Payment verification failed');
              reject(err);
            }
          },
        });
        rzp.open();
      });
    } catch (err) {
      toast.error(err.response?.data?.error || err.message || 'Payment failed');
    } finally {
      setUpgrading(null);
    }
  };

  const handleUpgradeClick = plan => {
    if (plan.price_inr === 0) { handleSwitchFree(); return; }
    if (razorpayActive) { handleRazorpayCheckout(plan); return; }
    setPaymentPlan(plan);
  };

  const TABS = [
    { id: 'plans',   label: 'Choose Plan',   icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg> },
    { id: 'compare', label: 'Compare All',   icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"/></svg> },
  ];

  return (
    <div className="space-y-8 pb-20 animate-fade-in">

      {/* ── Tab Navigation ── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex gap-1 p-1.5 bg-black/5 dark:bg-black/40 rounded-2xl border border-black/10 dark:border-white/5">
          {TABS.map(t => (
            <button key={t.id} onClick={() => switchTab(t.id)} className={`flex items-center gap-2 px-5 py-2.5 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${tab === t.id ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/25' : 'text-gray-600 dark:text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5'}`}>
              {t.icon}{t.label}
            </button>
          ))}
        </div>
        <div />
      </div>

      {/* ══════════════ TAB: CHOOSE PLAN ══════════════ */}
      {tab === 'plans' && (
        <div className="space-y-10">
          <div className="text-center space-y-5 py-4">
            <h1 className="text-4xl sm:text-5xl font-black dark:text-white text-gray-900 tracking-tight leading-tight">
              Simple. Powerful.<br /><span className="text-primary-500">Affordable</span> Email Marketing.
            </h1>
            <p className="text-base text-gray-700 dark:text-gray-400 max-w-xl mx-auto leading-relaxed">
              {razorpayActive
                ? 'Choose the perfect plan. Pay securely online — instant activation after successful payment.'
                : 'Choose the perfect plan. Pay via UPI or bank transfer — admin verifies and activates your plan.'}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-6 pt-1">
              {[
                { icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>, label: 'No hidden fees' },
                { icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>, label: 'Cancel anytime' },
                { icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/></svg>, label: 'UPI & bank transfer' },
              ].map(b => (
                <div key={b.label} className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                  {b.icon}<span className="text-sm font-semibold">{b.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Billing Cycle Toggle */}
          <div className="flex justify-center">
            <div className="inline-flex items-center gap-1 p-1.5 bg-gray-100 dark:bg-black/40 rounded-2xl border border-gray-200 dark:border-white/5">
              {CYCLES.map(c => (
                <button key={c.id} onClick={() => setBillingCycle(c.id)} className={`relative flex items-center gap-2.5 px-6 py-3 rounded-xl text-sm font-black uppercase tracking-wider transition-all ${billingCycle === c.id ? 'bg-white dark:bg-[#2a1060] text-gray-900 dark:text-white shadow-md' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}>
                  {c.label}
                  {c.discount > 0 && (
                    <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-md ${billingCycle === c.id ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400' : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'}`}>
                      Save {c.discount}%
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {plansLoading && <div className="flex justify-center py-20"><div className="w-10 h-10 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" /></div>}

          {plansError && (
            <div className="card p-12 flex flex-col items-center gap-4 text-center">
              <p className="text-base font-black text-red-500 uppercase tracking-widest">Could not load plans</p>
              <button onClick={() => refetchPlans()} className="btn-primary px-8">Retry</button>
            </div>
          )}

          {!plansLoading && !plansError && plans.length === 0 && (
            <div className="card p-14 flex flex-col items-center gap-5 text-center">
              <p className="text-base font-black dark:text-white text-gray-900 uppercase tracking-widest">Setting up plans…</p>
              <button onClick={() => refetchPlans()} className="btn-primary px-8">↺ Refresh</button>
            </div>
          )}

          {!plansLoading && plans.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6 items-stretch">
              {plans.map(plan => {
                const t            = THEME[plan.slug] || THEME.professional;
                const isCurrent    = plan.id === currentPlanId;
                const isProcessing = upgrading === plan.id;
                const isDowngrade  = currentPlan && plan.price_inr < currentPlan.price_inr && !isCurrent;
                const shown        = displayPrice(plan.price_inr, billingCycle);
                const cycle        = CYCLES.find(c => c.id === billingCycle) || CYCLES[0];

                let ctaLabel = 'Get Started Free';
                if (isCurrent)              ctaLabel = '✓ Your Current Plan';
                else if (plan.price_inr === 0) ctaLabel = 'Switch to Free';
                else if (isDowngrade)       ctaLabel = 'Downgrade Plan';
                else if (razorpayActive)    ctaLabel = 'Upgrade — Pay Online';
                else                        ctaLabel = 'Upgrade — Pay Now';
                if (isProcessing)           ctaLabel = 'Processing…';

                return (
                  <div
                    key={plan.id}
                    className={`relative flex flex-col rounded-2xl shadow-sm transition-all duration-300 overflow-hidden ${t.card} ${!isCurrent ? 'hover:-translate-y-1 hover:shadow-xl cursor-pointer' : ''}`}
                    style={t.popular ? { boxShadow: '0 0 0 2px #8b5cf6, 0 20px 60px rgba(139,92,246,0.15)' } : {}}
                    onClick={() => !isCurrent && handleUpgradeClick(plan)}
                  >
                    {t.popular && !isCurrent && (
                      <div className="bg-gradient-to-r from-primary-500 to-violet-500 text-white text-xs font-black uppercase tracking-widest text-center py-2.5 flex items-center justify-center gap-1.5">
                        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
                        Most Popular
                      </div>
                    )}
                    {isCurrent && (
                      <div className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-xs font-black uppercase tracking-widest text-center py-2.5">
                        ✓ Your Current Plan
                      </div>
                    )}

                    <div className="flex flex-col flex-1 p-6">
                      <div className="flex items-start justify-between mb-5">
                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${t.icon_bg}`}>
                          <PlanIcon slug={plan.slug} className={`w-7 h-7 ${t.icon_color}`} />
                        </div>
                        {isAdmin && (
                          <button onClick={e => { e.stopPropagation(); setEditingPlan(plan); }} title="Edit plan" className={`w-8 h-8 flex items-center justify-center rounded-lg bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 transition-all hover:scale-110 ${t.editBtn}`}>
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                          </button>
                        )}
                      </div>

                      <h2 className={`text-2xl font-black leading-tight ${t.name}`}>{plan.name}</h2>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 mb-5 font-medium">{t.tagline}</p>

                      <div className="flex items-end gap-1 mb-1">
                        <span className="text-xl font-black text-gray-500 dark:text-gray-500 self-start mt-2">₹</span>
                        <span className={`text-5xl font-black leading-none ${t.price}`}>{plan.price_inr === 0 ? '0' : shown.toLocaleString('en-IN')}</span>
                        <span className="text-base text-gray-500 dark:text-gray-400 mb-1.5 ml-1">/mo</span>
                      </div>

                      <div className="flex items-center gap-2 mb-1">
                        {plan.price_inr > 0 && cycle.discount > 0 && <span className="text-sm text-gray-400 line-through">₹{plan.price_inr.toLocaleString('en-IN')}/mo</span>}
                        {plan.price_inr > 0 && <span className="text-xs font-semibold text-gray-500 dark:text-gray-500">{billedLabel(billingCycle)}</span>}
                      </div>

                      <div className="flex items-center gap-1.5 mb-5">
                        <svg className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                        <span className="text-xs font-semibold text-gray-600 dark:text-gray-500">Incl. 18% GST</span>
                        {plan.price_inr > 0 && cycle.discount > 0 && <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 ml-auto">Save {cycle.discount}%</span>}
                      </div>

                      <div className="mb-5">
                        <span className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-black border ${t.recipient_bg}`}>
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"/></svg>
                          {plan.recipients_per_day === -1 ? 'Unlimited recipients' : `${plan.recipients_per_day.toLocaleString()} recipients/day`}
                        </span>
                      </div>

                      <div className="h-px bg-gray-200 dark:bg-white/5 mb-5" />
                      <ul className="space-y-3 flex-1">
                        {(plan.features?.length ? plan.features : (PLAN_FEATURES[plan.slug] || [])).map((f, i) => (
                          <li key={i} className="flex items-start gap-2.5">
                            <svg className={`w-5 h-5 shrink-0 mt-0.5 ${t.check}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                            <span className="text-sm font-medium text-gray-800 dark:text-gray-300 leading-snug">{f}</span>
                          </li>
                        ))}
                      </ul>

                      <div className="mt-7 space-y-3" onClick={e => e.stopPropagation()}>
                        {isCurrent ? (
                          <div className="w-full py-4 rounded-xl text-sm font-black uppercase tracking-widest text-center bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-2 border-emerald-500/30">
                            ✓ Your Current Plan
                          </div>
                        ) : (
                          <button onClick={() => handleUpgradeClick(plan)} disabled={isProcessing} className={`w-full py-4 rounded-xl text-sm font-black uppercase tracking-widest transition-all disabled:opacity-60 disabled:cursor-wait ${t.btn}`}>
                            {ctaLabel}
                          </button>
                        )}
                        {plan.price_inr > 0 && !isCurrent && (
                          <p className="text-center text-xs text-gray-500 dark:text-gray-500 flex items-center justify-center gap-1">
                            <svg className="w-3.5 h-3.5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/></svg>
                            {razorpayActive ? 'Instant activation · Secure Razorpay checkout' : 'Pay via UPI or bank transfer'}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ══════════════ TAB: COMPARE ALL ══════════════ */}
      {tab === 'compare' && (
        <div className="space-y-6">
          <div className="flex justify-center">
            <div className="inline-flex items-center gap-1 p-1.5 bg-gray-100 dark:bg-black/40 rounded-2xl border border-gray-200 dark:border-white/5">
              {CYCLES.map(c => (
                <button key={c.id} onClick={() => setBillingCycle(c.id)} className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-black uppercase tracking-wider transition-all ${billingCycle === c.id ? 'bg-white dark:bg-[#2a1060] text-gray-900 dark:text-white shadow-md' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}>
                  {c.label}{c.discount > 0 && <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">-{c.discount}%</span>}
                </button>
              ))}
            </div>
          </div>

          <div className="card overflow-hidden">
            {plansLoading ? (
              <div className="flex justify-center py-20"><div className="w-10 h-10 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" /></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left" style={{ minWidth: `${200 + plans.length * 180}px` }}>
                  <thead>
                    <tr className="border-b border-black/5 dark:border-white/5">
                      <th className="py-6 px-6 text-xs font-black text-gray-600 dark:text-gray-500 uppercase tracking-widest w-48 sticky left-0 bg-white dark:bg-[#150c34] z-10">Feature</th>
                      {plans.map(p => {
                        const t = THEME[p.slug] || THEME.professional;
                        const isCurrent = p.id === currentPlanId;
                        const shown = displayPrice(p.price_inr, billingCycle);
                        const cycle = CYCLES.find(c => c.id === billingCycle) || CYCLES[0];
                        return (
                          <th key={p.id} className="py-6 px-5 text-center min-w-[180px]">
                            <div className="flex flex-col items-center gap-2">
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${t.icon_bg}`}>
                                <PlanIcon slug={p.slug} className={`w-5 h-5 ${t.icon_color}`} />
                              </div>
                              <p className={`text-base font-black ${t.name}`}>{p.name}</p>
                              <div className="text-center">
                                <p className="text-2xl font-black" style={{ color: t.accent }}>{p.price_inr === 0 ? 'Free' : `₹${shown.toLocaleString('en-IN')}`}</p>
                                {p.price_inr > 0 && <>
                                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-500">/mo · {billedLabel(billingCycle)}</p>
                                  {cycle.discount > 0 && <p className="text-xs font-black text-emerald-600 dark:text-emerald-400">Save {cycle.discount}%</p>}
                                  <p className="text-[10px] font-semibold text-gray-500 mt-0.5">Incl. 18% GST</p>
                                </>}
                              </div>
                              {isCurrent
                                ? <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">✓ Active Plan</span>
                                : <button onClick={() => { switchTab('plans'); setTimeout(() => handleUpgradeClick(p), 50); }} className={`mt-1 px-5 py-2 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${t.btn}`}>{p.price_inr === 0 ? 'Select' : 'Upgrade'}</button>
                              }
                              {isAdmin && <button onClick={() => setEditingPlan(p)} className={`text-xs font-black uppercase tracking-widest flex items-center gap-1 ${t.editBtn} transition-colors`}><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>Edit</button>}
                            </div>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/[0.04] dark:divide-white/[0.04]">
                    {CMP_ROWS.map(row => (
                      <tr key={row.label} className="hover:bg-black/[0.015] dark:hover:bg-white/[0.015]">
                        <td className="py-4 px-6 text-sm font-semibold text-gray-700 dark:text-gray-400 sticky left-0 bg-white dark:bg-[#150c34] z-10">{row.label}</td>
                        {plans.map(p => {
                          const v = row.fn(p, billingCycle);
                          const t = THEME[p.slug] || THEME.professional;
                          return (
                            <td key={p.id} className="py-4 px-5 text-center">
                              {v === '✓' ? <svg className="w-5 h-5 mx-auto" style={{ color: t.accent }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                              : v === '—' ? <span className="text-gray-300 dark:text-gray-700 text-xl font-black">—</span>
                              : <span className="text-sm font-black dark:text-white text-gray-800" style={p.id === currentPlanId ? { color: t.accent } : {}}>{v}</span>}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Modals ── */}
      {editingPlan && (
        <EditPlanModal plan={editingPlan} onClose={() => setEditingPlan(null)} onSave={(id, data) => savePlanMut.mutateAsync([id, data])} />
      )}
      {paymentPlan && (
        <PaymentModal
          plan={paymentPlan}
          billingCycle={billingCycle}
          paymentInfo={paymentInfo}
          onClose={() => setPaymentPlan(null)}
          onSubmit={handlePaymentSubmit}
          loading={upgrading === paymentPlan.id}
        />
      )}
    </div>
  );
}
