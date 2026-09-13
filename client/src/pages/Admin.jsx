import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { format } from 'date-fns';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { PLAN_FEATURES } from '../planFeatures';
import ToggleSwitch from '../components/ToggleSwitch';

// ─── Color maps ───────────────────────────────────────────────────────────────
const ROLE_COLORS = {
  admin: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  user:  'bg-blue-500/10  text-blue-400  border-blue-500/30',
};
const PLAN_COLORS = {
  free:         'bg-gray-500/10    text-gray-400    border-gray-500/20',
  professional: 'bg-primary-500/10 text-primary-400 border-primary-500/20',
  business:     'bg-blue-500/10    text-blue-400    border-blue-500/20',
  enterprise:   'bg-amber-500/10   text-amber-400   border-amber-500/20',
};
const STATUS_COLORS = {
  active:  'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  expired: 'bg-red-500/10    text-red-400    border-red-500/20',
  pending: 'bg-amber-500/10  text-amber-400  border-amber-500/20',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const inr = n => (n == null ? '—' : `₹${Number(n).toLocaleString('en-IN')}`);
const num = n => (n == null ? '—' : Number(n).toLocaleString('en-IN'));
function fmtMonth(ym) {
  if (!ym) return '';
  const [y, m] = ym.split('-');
  const M = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${M[parseInt(m, 10) - 1]} '${y.slice(2)}`;
}

// ─── Activity Feed ────────────────────────────────────────────────────────────
const ACTIVITY_META = {
  user_registered:  { icon: '👤', label: 'New Registration',  color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
  user_created:     { icon: '➕', label: 'User Created',       color: 'text-blue-400',    bg: 'bg-blue-500/10 border-blue-500/20' },
  user_deleted:     { icon: '🗑', label: 'User Deleted',       color: 'text-red-400',     bg: 'bg-red-500/10 border-red-500/20' },
  user_updated:     { icon: '✏️', label: 'User Updated',       color: 'text-primary-400', bg: 'bg-primary-500/10 border-primary-500/20' },
  plan_changed:     { icon: '🔄', label: 'Plan Changed',       color: 'text-violet-400',  bg: 'bg-violet-500/10 border-violet-500/20' },
  payment_submitted:{ icon: '💳', label: 'Payment Submitted',  color: 'text-amber-400',   bg: 'bg-amber-500/10 border-amber-500/20' },
  payment_approved: { icon: '✅', label: 'Payment Approved',   color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
  payment_rejected: { icon: '❌', label: 'Payment Rejected',   color: 'text-red-400',     bg: 'bg-red-500/10 border-red-500/20' },
  payment_verified: { icon: '🔒', label: 'Payment Verified',   color: 'text-cyan-400',    bg: 'bg-cyan-500/10 border-cyan-500/20' },
};

function timeAgo(ts) {
  if (!ts) return '';
  const secs = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (secs < 60)   return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400)return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

function ActivityFeed({ entries, fetching }) {
  const [expanded, setExpanded] = useState(true);
  const [filter, setFilter] = useState('all');

  const types = ['all', 'user_registered', 'user_created', 'user_deleted', 'plan_changed', 'payment_submitted', 'payment_approved', 'payment_rejected'];
  const visible = filter === 'all' ? entries : entries.filter(e => e.type === filter);

  return (
    <div className="card overflow-hidden">
      <div className="px-6 py-4 border-b dark:border-white/5 border-black/5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <p className="text-xs font-black text-gray-500 uppercase tracking-widest">Live Activity Log</p>
          {fetching && <div className="w-3 h-3 border border-primary-500 border-t-transparent rounded-full animate-spin" />}
          {entries.length > 0 && (
            <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-primary-500/10 text-primary-400 border border-primary-500/20">
              {entries.length} events
            </span>
          )}
        </div>
        <button onClick={() => setExpanded(v => !v)} className="text-xs font-black text-gray-500 hover:text-gray-300 uppercase tracking-widest transition-colors">
          {expanded ? 'Hide ∧' : 'Show ∨'}
        </button>
      </div>

      {expanded && (
        <>
          {/* Type filter chips */}
          <div className="px-6 py-3 border-b dark:border-white/5 border-black/5 flex gap-1.5 flex-wrap">
            {types.map(t => (
              <button key={t} onClick={() => setFilter(t)}
                className={`px-2.5 py-1 text-[10px] font-black uppercase tracking-widest rounded-lg border transition-all ${filter === t ? 'bg-primary-500 text-white border-primary-500' : 'dark:bg-white/5 bg-black/5 text-gray-500 dark:border-white/10 border-black/10 hover:text-primary-500'}`}>
                {t === 'all' ? 'All' : (ACTIVITY_META[t]?.label || t)}
              </button>
            ))}
          </div>

          <div className="divide-y dark:divide-white/[0.03] divide-black/[0.03] max-h-[480px] overflow-y-auto">
            {visible.length === 0 ? (
              <p className="text-center text-xs font-black text-gray-500 uppercase tracking-widest py-10">No activity yet</p>
            ) : visible.map(entry => {
              const meta = ACTIVITY_META[entry.type] || { icon: '●', label: entry.type, color: 'text-gray-400', bg: 'bg-gray-500/10 border-gray-500/20' };
              return (
                <div key={entry.id} className="flex items-start gap-4 px-6 py-3.5 hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors">
                  <div className={`mt-0.5 shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-sm border ${meta.bg}`}>
                    {meta.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs font-black uppercase tracking-widest ${meta.color}`}>{meta.label}</span>
                      {entry.actor_email && (
                        <span className="text-[10px] font-semibold text-gray-500">by {entry.actor_email}</span>
                      )}
                    </div>
                    <p className="text-sm font-bold dark:text-white text-gray-900 mt-0.5 truncate">
                      {entry.target_email || '—'}
                    </p>
                    {entry.detail && Object.keys(entry.detail).length > 0 && (
                      <p className="text-[11px] font-semibold text-gray-500 mt-0.5">
                        {Object.entries(entry.detail)
                          .filter(([, v]) => v !== '' && v != null)
                          .map(([k, v]) => `${k}: ${v}`)
                          .join(' · ')}
                      </p>
                    )}
                  </div>
                  <span className="shrink-0 text-[10px] font-semibold text-gray-600 mt-1">{timeAgo(entry.created_at)}</span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Shared small components ──────────────────────────────────────────────────
function KPI({ label, value, sub, color = 'text-primary-400', fetching }) {
  return (
    <div className={`card p-5 transition-opacity duration-300 ${fetching ? 'opacity-70' : 'opacity-100'}`}>
      <p className="text-xs font-black text-gray-500 uppercase tracking-widest mb-2">{label}</p>
      <p className={`text-3xl font-black ${color}`}>{value}</p>
      {sub && <p className="text-xs font-semibold text-gray-500 mt-1">{sub}</p>}
    </div>
  );
}

function Badge({ label, colorClass }) {
  return (
    <span className={`inline-block text-xs font-black px-2.5 py-1 rounded-lg border uppercase tracking-wider ${colorClass}`}>
      {label}
    </span>
  );
}

function ChartTip({ active, payload, label, prefix = '' }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="card p-3 shadow-xl border border-black/10 dark:border-white/10 min-w-[130px]">
      <p className="text-xs font-black text-gray-500 uppercase tracking-widest mb-1.5">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="text-sm font-black" style={{ color: p.color }}>
          {p.name}: {prefix}{typeof p.value === 'number' ? p.value.toLocaleString('en-IN') : p.value}
        </p>
      ))}
    </div>
  );
}

function Spinner() {
  return (
    <div className="flex justify-center py-16">
      <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function EmptyRow({ cols, msg = 'No data found' }) {
  return (
    <tr>
      <td colSpan={cols} className="py-14 text-center text-xs font-black text-gray-500 uppercase tracking-widest">{msg}</td>
    </tr>
  );
}

// ─── Modal wrapper ────────────────────────────────────────────────────────────
function Modal({ onClose, children, maxW = 'max-w-md' }) {
  return (
    <div className="fixed inset-0 lg:left-72 z-[9999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[#0d0928]/88 backdrop-blur-sm" onClick={onClose} />
      <div
        className={`relative w-full ${maxW} card p-8 space-y-5 animate-fade-in max-h-[90vh] overflow-y-auto`}
        onClick={e => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

function ModalHeader({ title, sub, onClose }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <h3 className="text-base font-black dark:text-white text-gray-900 uppercase tracking-widest">{title}</h3>
        {sub && <p className="text-xs font-semibold text-gray-500 mt-0.5">{sub}</p>}
      </div>
      <button onClick={onClose}
        className="w-8 h-8 flex items-center justify-center rounded-xl bg-black/10 dark:bg-white/5 text-gray-500 hover:text-gray-900 dark:hover:text-white transition-all shrink-0">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
        </svg>
      </button>
    </div>
  );
}

const LBL = 'block text-xs font-black text-gray-500 uppercase tracking-widest mb-1.5';
const INP = 'input-field py-2.5 text-sm';

// ─── User modals ──────────────────────────────────────────────────────────────
function EditUserModal({ user: u, plans, onClose, onSave }) {
  const [form, setForm] = useState({ name: u.name || '', role: u.role || 'user', plan_id: u.plan_id || 1 });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const submit = async () => {
    setSaving(true);
    try { await onSave(u.id, form); onClose(); } finally { setSaving(false); }
  };
  return (
    <Modal onClose={onClose}>
      <ModalHeader title="Edit User" sub={u.email} onClose={onClose} />
      <div>
        <label className={LBL}>Display Name</label>
        <input value={form.name} onChange={e => set('name', e.target.value)} className={INP} placeholder="Full name" />
      </div>
      <div>
        <label className={LBL}>Role</label>
        <div className="flex gap-2">
          {['user', 'admin'].map(r => (
            <button key={r} type="button" onClick={() => set('role', r)}
              className={`flex-1 py-2.5 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${form.role === r ? 'bg-primary-500 text-white' : 'bg-black/5 dark:bg-white/5 text-gray-500 hover:text-gray-900 dark:hover:text-white'}`}>
              {r}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className={LBL}>Plan</label>
        <select value={form.plan_id} onChange={e => set('plan_id', parseInt(e.target.value))} className={`${INP} w-full`}>
          {plans.map(p => <option key={p.id} value={p.id}>{p.name} — {p.price_inr === 0 ? 'Free' : `₹${p.price_inr}/mo`}</option>)}
        </select>
      </div>
      <div className="flex gap-3 pt-2">
        <button onClick={onClose} className="flex-1 py-2.5 text-xs font-black uppercase tracking-widest rounded-xl bg-black/5 dark:bg-white/5 text-gray-500">Cancel</button>
        <button onClick={submit} disabled={saving} className="flex-1 btn-primary justify-center">{saving ? 'Saving…' : 'Save Changes'}</button>
      </div>
    </Modal>
  );
}

function ResetPasswordModal({ user: u, onClose, onReset }) {
  const [pw, setPw] = useState('');
  const [saving, setSaving] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const submit = async () => {
    if (pw.length < 6) { toast.error('Min 6 characters'); return; }
    setSaving(true);
    try { await onReset(u.id, pw); onClose(); } finally { setSaving(false); }
  };
  return (
    <Modal onClose={onClose} maxW="max-w-sm">
      <ModalHeader title="Reset Password" sub={u.email} onClose={onClose} />
      <div>
        <label className={LBL}>New Password</label>
        <div className="relative">
          <input type={showPw ? 'text' : 'password'} value={pw} onChange={e => setPw(e.target.value)} className={`${INP} pr-11`} placeholder="Min 6 characters" />
          <EyeToggle show={showPw} onToggle={() => setShowPw(v => !v)} />
        </div>
      </div>
      <div className="flex gap-3">
        <button onClick={onClose} className="flex-1 py-2.5 text-xs font-black uppercase tracking-widest rounded-xl bg-black/5 dark:bg-white/5 text-gray-500">Cancel</button>
        <button onClick={submit} disabled={saving}
          className="flex-1 py-2.5 text-xs font-black uppercase tracking-widest rounded-xl bg-amber-500 hover:bg-amber-400 text-black transition-all">
          {saving ? '…' : 'Reset'}
        </button>
      </div>
    </Modal>
  );
}

function EyeToggle({ show, onToggle }) {
  return (
    <button type="button" tabIndex={-1} onClick={onToggle}
      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200 transition-colors">
      {show ? (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
        </svg>
      ) : (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
      )}
    </button>
  );
}

function CreateUserModal({ plans, onClose, onCreate }) {
  const [form, setForm] = useState({ email: '', password: '', name: '', role: 'user', plan_id: 1 });
  const [saving, setSaving] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const submit = async () => {
    if (!form.email || !form.password) { toast.error('Email and password required'); return; }
    setSaving(true);
    try { await onCreate(form); onClose(); } finally { setSaving(false); }
  };
  return (
    <Modal onClose={onClose}>
      <ModalHeader title="Create User" onClose={onClose} />
      <div><label className={LBL}>Email</label><input value={form.email} onChange={e => set('email', e.target.value)} className={INP} type="email" /></div>
      <div><label className={LBL}>Password</label>
        <div className="relative">
          <input value={form.password} onChange={e => set('password', e.target.value)} className={`${INP} pr-11`} type={showPw ? 'text' : 'password'} placeholder="Min 6 characters" />
          <EyeToggle show={showPw} onToggle={() => setShowPw(v => !v)} />
        </div>
      </div>
      <div><label className={LBL}>Name</label><input value={form.name} onChange={e => set('name', e.target.value)} className={INP} placeholder="Optional" /></div>
      <div>
        <label className={LBL}>Role</label>
        <div className="flex gap-2">
          {['user', 'admin'].map(r => (
            <button key={r} type="button" onClick={() => set('role', r)}
              className={`flex-1 py-2.5 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${form.role === r ? 'bg-primary-500 text-white' : 'bg-black/5 dark:bg-white/5 text-gray-500 hover:text-gray-900 dark:hover:text-white'}`}>
              {r}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className={LBL}>Plan</label>
        <select value={form.plan_id} onChange={e => set('plan_id', parseInt(e.target.value))} className={`${INP} w-full`}>
          {plans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>
      <div className="flex gap-3 pt-2">
        <button onClick={onClose} className="flex-1 py-2.5 text-xs font-black uppercase tracking-widest rounded-xl bg-black/5 dark:bg-white/5 text-gray-500">Cancel</button>
        <button onClick={submit} disabled={saving} className="flex-1 btn-primary justify-center">{saving ? 'Creating…' : 'Create User'}</button>
      </div>
    </Modal>
  );
}

// ─── Edit Plan modal ──────────────────────────────────────────────────────────
function EditPlanModal({ plan, onClose, onSave }) {
  const [form, setForm] = useState({
    price_inr:                plan.price_inr,
    recipients_per_day:       plan.recipients_per_day,
    max_contacts:             plan.max_contacts,
    max_campaigns_per_month:  plan.max_campaigns_per_month,
    max_email_integrations:   plan.max_email_integrations ?? 1,
    features:                 (plan.features || []).join('\n'),
    is_active:                plan.is_active !== 0,
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const submit = async () => {
    setSaving(true);
    try {
      await onSave(plan.id, {
        price_inr:                parseInt(form.price_inr)                || 0,
        recipients_per_day:       parseInt(form.recipients_per_day)       || -1,
        max_contacts:             parseInt(form.max_contacts)             || -1,
        max_campaigns_per_month:  parseInt(form.max_campaigns_per_month)  || -1,
        max_email_integrations:   parseInt(form.max_email_integrations)   || -1,
        features:                 form.features.split('\n').map(s => s.trim()).filter(Boolean),
        is_active:                form.is_active,
      });
      onClose();
    } catch (_) {
      // toast shown by mutation onError
    } finally { setSaving(false); }
  };

  return (
    <Modal onClose={onClose}>
      <ModalHeader title={`Edit: ${plan.name}`} sub={`slug: ${plan.slug}`} onClose={onClose} />
      <div>
        <label className={LBL}>Price ₹/month <span className="normal-case font-normal">(0 = free)</span></label>
        <input type="number" value={form.price_inr} onChange={e => set('price_inr', e.target.value)} className={`${INP} w-full`} />
      </div>
      <div>
        <label className={LBL}>Recipients / Day <span className="normal-case font-normal">(-1 = unlimited)</span></label>
        <input type="number" value={form.recipients_per_day} onChange={e => set('recipients_per_day', e.target.value)} className={`${INP} w-full`} />
      </div>
      <div>
        <label className={LBL}>Max Contacts <span className="normal-case font-normal">(-1 = unlimited)</span></label>
        <input type="number" value={form.max_contacts} onChange={e => set('max_contacts', e.target.value)} className={`${INP} w-full`} />
      </div>
      <div>
        <label className={LBL}>Campaigns / Month <span className="normal-case font-normal">(-1 = unlimited)</span></label>
        <input type="number" value={form.max_campaigns_per_month} onChange={e => set('max_campaigns_per_month', e.target.value)} className={`${INP} w-full`} />
      </div>
      <div>
        <label className={LBL}>Email Senders <span className="normal-case font-normal">(-1 = unlimited)</span></label>
        <input type="number" value={form.max_email_integrations} onChange={e => set('max_email_integrations', e.target.value)} className={`${INP} w-full`} />
      </div>
      <div>
        <label className={LBL}>Features <span className="normal-case font-normal">(one per line)</span></label>
        <textarea value={form.features} onChange={e => set('features', e.target.value)} rows={5}
          className={`${INP} w-full resize-none`}
          placeholder={'500 contacts\nBasic templates\nEmail support'} />
      </div>
      <div className="flex items-center justify-between py-1">
        <span className={LBL} style={{ marginBottom: 0 }}>Plan Active</span>
        <ToggleSwitch checked={form.is_active} onChange={v => set('is_active', v)} />
      </div>
      <div className="flex gap-3 pt-2">
        <button onClick={onClose} className="flex-1 py-2.5 text-xs font-black uppercase tracking-widest rounded-xl bg-black/5 dark:bg-white/5 text-gray-500">Cancel</button>
        <button onClick={submit} disabled={saving} className="flex-1 btn-primary justify-center">{saving ? 'Saving…' : 'Save Plan'}</button>
      </div>
    </Modal>
  );
}

// ─── Change Plan Modal ────────────────────────────────────────────────────────
function ChangePlanModal({ user: u, plans, onClose, onSave, saving }) {
  const [planId, setPlanId]   = useState(u.plan_id || 1);
  const [cycle,  setCycle]    = useState('monthly');
  const selected = plans.find(p => p.id === planId);
  return (
    <Modal onClose={onClose}>
      <ModalHeader title="Change Plan" sub={u.email} onClose={onClose} />
      <div>
        <label className={LBL}>New Plan</label>
        <div className="space-y-2">
          {plans.map(p => (
            <button key={p.id} type="button" onClick={() => setPlanId(p.id)}
              className={`w-full flex items-center justify-between px-4 py-3 text-sm font-bold rounded-xl border transition-all ${planId === p.id ? 'border-primary-500 bg-primary-500/10 text-primary-400' : 'border-black/10 dark:border-white/10 text-gray-500 hover:border-primary-500/40'}`}>
              <span>{p.name}</span>
              <span className="font-black">{p.price_inr === 0 ? 'Free' : `₹${p.price_inr}/mo`}</span>
            </button>
          ))}
        </div>
      </div>
      {selected?.price_inr > 0 && (
        <div>
          <label className={LBL}>Billing Period</label>
          <div className="flex gap-2">
            {[['monthly','Monthly'],['biannual','6 Months'],['yearly','Yearly']].map(([v,l]) => (
              <button key={v} type="button" onClick={() => setCycle(v)}
                className={`flex-1 py-2.5 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${cycle === v ? 'bg-primary-500 text-white' : 'bg-black/5 dark:bg-white/5 text-gray-500 hover:text-gray-900 dark:hover:text-white'}`}>
                {l}
              </button>
            ))}
          </div>
          <p className="text-xs font-semibold text-gray-500 mt-1.5">Note: this is a free admin override — no payment required.</p>
        </div>
      )}
      <div className="flex gap-3 pt-2">
        <button onClick={onClose} className="flex-1 py-2.5 text-xs font-black uppercase tracking-widest rounded-xl bg-black/5 dark:bg-white/5 text-gray-500">Cancel</button>
        <button onClick={() => onSave(planId, cycle)} disabled={saving} className="flex-1 btn-primary justify-center">{saving ? 'Saving…' : 'Apply Plan Change'}</button>
      </div>
    </Modal>
  );
}

// ─── Tab icons ────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'overview',      label: 'Overview',
    icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg> },
  { id: 'users',         label: 'Users',
    icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path strokeLinecap="round" strokeLinejoin="round" d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg> },
  { id: 'subscriptions', label: 'Subscriptions',
    icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><rect x="1" y="4" width="22" height="16" rx="2"/><path strokeLinecap="round" d="M1 10h22"/></svg> },
  { id: 'revenue',       label: 'Revenue',
    icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg> },
  { id: 'plans',         label: 'Plans',
    icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"/></svg> },
  { id: 'settings',      label: 'Settings',
    icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><circle cx="12" cy="12" r="3"/></svg> },
  { id: 'payments',      label: 'Payments',
    icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/></svg> },
];

// ─── Main component ───────────────────────────────────────────────────────────
export default function Admin() {
  const { user: me } = useAuth();
  const qc = useQueryClient();

  const [tab,           setTab]           = useState('overview');
  const [search,        setSearch]        = useState('');
  const [subFilter,     setSubFilter]     = useState('');
  const [editUser,      setEditUser]      = useState(null);
  const [resetUser,     setResetUser]     = useState(null);
  const [createOpen,    setCreateOpen]    = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [editPlan,      setEditPlan]      = useState(null);
  const [viewUser,      setViewUser]      = useState(null);
  const [changePlanUser, setChangePlanUser] = useState(null);
  const [payReqFilter,  setPayReqFilter]  = useState('pending');
  const [rejectModal,   setRejectModal]   = useState(null);
  const [rejectNote,    setRejectNote]    = useState('');
  const [historyUser,   setHistoryUser]   = useState(null);
  const [showDeleted,   setShowDeleted]   = useState(false);

  // Payment info settings state
  const [pi, setPi] = useState({ upi_id: '', payment_instructions: '', bank_name: '', bank_account: '', bank_ifsc: '' });
  const [piSaving, setPiSaving] = useState(false);

  // Gateway settings state
  const MASK = '************';
  const [gw, setGw]             = useState({ razorpay_key_id: '', razorpay_key_secret: '', payments_enabled: 'true' });
  const [gwSecretSaved,  setGwSecretSaved]  = useState(false);
  const [gwSecretChanged,setGwSecretChanged] = useState(false);
  const [gwSaving,       setGwSaving]       = useState(false);
  const [gwTesting,      setGwTesting]      = useState(false);

  // ── Live indicator state ───────────────────────────────────────────────────
  const [lastUpdated,  setLastUpdated]  = useState(null);
  const [sinceLabel,   setSinceLabel]   = useState('');

  // ── Queries ────────────────────────────────────────────────────────────────
  const { data: stats, isFetching: statsFetching, dataUpdatedAt: statsUpdatedAt } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: () => api.get('/admin/stats').then(r => r.data),
    enabled: tab === 'overview' || tab === 'revenue',
    refetchInterval: tab === 'overview' ? 15000 : false,
  });

  const { data: revenue, isFetching: revenueFetching } = useQuery({
    queryKey: ['admin-revenue'],
    queryFn: () => api.get('/admin/revenue').then(r => r.data),
    enabled: tab === 'overview' || tab === 'revenue',
    refetchInterval: tab === 'overview' ? 60000 : false,
  });

  // Track last-updated timestamp
  useEffect(() => {
    if (statsUpdatedAt) setLastUpdated(new Date(statsUpdatedAt));
  }, [statsUpdatedAt]);

  // Tick "X seconds ago" label every second
  useEffect(() => {
    if (!lastUpdated) return;
    const tick = () => {
      const secs = Math.floor((Date.now() - lastUpdated.getTime()) / 1000);
      if (secs < 5)        setSinceLabel('just now');
      else if (secs < 60)  setSinceLabel(`${secs}s ago`);
      else                 setSinceLabel(`${Math.floor(secs / 60)}m ago`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [lastUpdated]);

  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ['admin-users', search, showDeleted],
    queryFn: () => api.get(`/admin/users?q=${encodeURIComponent(search)}&limit=50&show_deleted=${showDeleted}`).then(r => r.data),
    enabled: tab === 'users',
    refetchInterval: tab === 'users' ? 30000 : false,
  });

  const { data: subsData, isLoading: subsLoading } = useQuery({
    queryKey: ['admin-subs', subFilter],
    queryFn: () => api.get(`/admin/subscriptions?status=${subFilter}&limit=50`).then(r => r.data),
    enabled: tab === 'subscriptions',
    refetchInterval: tab === 'subscriptions' ? 30000 : false,
  });

  const { data: plans = [] } = useQuery({
    queryKey: ['admin-plans'],
    queryFn: () => api.get('/admin/plans').then(r => r.data),
  });

  // Gateway settings — refetchOnWindowFocus:false prevents wiping the form mid-edit
  const { data: gwData } = useQuery({
    queryKey: ['admin-gw-settings'],
    queryFn: () => api.get('/settings').then(r => r.data),
    enabled: tab === 'settings',
    staleTime: 60000,
    refetchOnWindowFocus: false,
    refetchInterval: tab === 'settings' ? 120000 : false,
  });
  useEffect(() => {
    if (!gwData) return;
    const saved = Boolean(gwData.razorpay_key_secret_saved);
    setGw({ razorpay_key_id: gwData.razorpay_key_id || '', razorpay_key_secret: saved ? MASK : '', payments_enabled: gwData.payments_enabled || 'true' });
    setGwSecretSaved(saved);
    setGwSecretChanged(false);
  }, [gwData]);

  // Payment requests
  const { data: payReqsData, isLoading: payReqsLoading } = useQuery({
    queryKey: ['admin-pay-reqs', payReqFilter],
    queryFn: () => api.get(`/admin/payment-requests?status=${payReqFilter}&limit=50`).then(r => r.data),
    enabled: tab === 'payments',
    refetchInterval: tab === 'payments' ? 15000 : false,
  });

  // Payment info settings
  const { data: piData } = useQuery({
    queryKey: ['admin-pay-info'],
    queryFn: () => api.get('/settings/payment-info').then(r => r.data),
    enabled: tab === 'settings',
    staleTime: 60000,
    refetchOnWindowFocus: false,
    refetchInterval: tab === 'settings' ? 120000 : false,
  });
  useEffect(() => {
    if (!piData) return;
    setPi({ upi_id: piData.upi_id || '', payment_instructions: piData.payment_instructions || '', bank_name: piData.bank_name || '', bank_account: piData.bank_account || '', bank_ifsc: piData.bank_ifsc || '' });
  }, [piData]);

  // Activity feed
  const { data: activityLog = [], isFetching: activityFetching } = useQuery({
    queryKey: ['admin-activity'],
    queryFn: () => api.get('/admin/activity?limit=60').then(r => r.data),
    enabled: tab === 'overview',
    refetchInterval: tab === 'overview' ? 15000 : false,
  });

  // User activity (subscription history)
  const { data: userDetail, isLoading: userDetailLoading } = useQuery({
    queryKey: ['admin-user-detail', viewUser?.id],
    queryFn: () => api.get(`/admin/users/${viewUser.id}`).then(r => r.data),
    enabled: Boolean(viewUser),
  });

  // Full account history for a user
  const { data: userHistory, isLoading: historyLoading } = useQuery({
    queryKey: ['admin-user-history', historyUser?.id],
    queryFn: () => api.get(`/admin/users/${historyUser.id}/history`).then(r => r.data),
    enabled: Boolean(historyUser),
  });

  // ── Mutations ──────────────────────────────────────────────────────────────
  const saveUserMut = useMutation({
    mutationFn: ([id, data]) => api.put(`/admin/users/${id}`, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-users'] }); toast.success('User updated'); },
    onError: e => toast.error(e.response?.data?.error || 'Failed'),
  });
  const resetPwMut = useMutation({
    mutationFn: ([id, password]) => api.put(`/admin/users/${id}/reset-password`, { password }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-users'] }); toast.success('Password reset'); },
    onError: e => toast.error(e.response?.data?.error || 'Failed'),
  });
  const createUserMut = useMutation({
    mutationFn: data => api.post('/admin/users', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      qc.invalidateQueries({ queryKey: ['admin-stats'] });
      qc.invalidateQueries({ queryKey: ['admin-activity'] });
      toast.success('User created');
    },
    onError: e => toast.error(e.response?.data?.error || 'Failed'),
  });
  const deleteUserMut = useMutation({
    mutationFn: id => api.delete(`/admin/users/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      qc.invalidateQueries({ queryKey: ['admin-stats'] });
      qc.invalidateQueries({ queryKey: ['admin-activity'] });
      toast.success('User deleted');
      setDeleteConfirm(null);
    },
    onError: e => toast.error(e.response?.data?.error || 'Failed'),
  });
  const updatePlanMut = useMutation({
    mutationFn: ([id, data]) => api.put(`/admin/plans/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-plans'] });
      qc.invalidateQueries({ queryKey: ['plans'] });
      toast.success('Plan updated');
    },
    onError: e => toast.error(e.response?.data?.error || 'Failed'),
  });
  const changePlanMut = useMutation({
    mutationFn: ([userId, planId, billingCycle]) => api.put(`/admin/users/${userId}/plan`, { plan_id: planId, billing_cycle: billingCycle }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      qc.invalidateQueries({ queryKey: ['admin-pay-reqs'] });
      qc.invalidateQueries({ queryKey: ['admin-subs'] });
      qc.invalidateQueries({ queryKey: ['admin-stats'] });
      qc.invalidateQueries({ queryKey: ['admin-activity'] });
      toast.success('Plan changed');
      setChangePlanUser(null);
    },
    onError: e => toast.error(e.response?.data?.error || 'Failed'),
  });
  const approvePayMut = useMutation({
    mutationFn: id => api.put(`/admin/payment-requests/${id}/approve`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-pay-reqs'] });
      qc.invalidateQueries({ queryKey: ['admin-stats'] });
      qc.invalidateQueries({ queryKey: ['admin-subs'] });
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      qc.invalidateQueries({ queryKey: ['admin-activity'] });
      toast.success('Payment approved — plan activated');
    },
    onError: e => toast.error(e.response?.data?.error || 'Failed'),
  });
  const rejectPayMut = useMutation({
    mutationFn: ([id, note]) => api.put(`/admin/payment-requests/${id}/reject`, { admin_note: note }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-pay-reqs'] });
      qc.invalidateQueries({ queryKey: ['admin-stats'] });
      qc.invalidateQueries({ queryKey: ['admin-activity'] });
      toast.success('Payment rejected');
      setRejectModal(null);
      setRejectNote('');
    },
    onError: e => toast.error(e.response?.data?.error || 'Failed'),
  });
  const remindPayMut = useMutation({
    mutationFn: id => api.post(`/admin/payment-requests/${id}/remind`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-pay-reqs'] }); toast.success('Reminder email sent'); },
    onError: e => toast.error(e.response?.data?.error || 'Failed to send reminder'),
  });

  const handlePiSave = async () => {
    setPiSaving(true);
    try { await api.put('/settings', pi); qc.invalidateQueries({ queryKey: ['admin-pay-info'] }); qc.invalidateQueries({ queryKey: ['payment-info'] }); toast.success('Payment info saved'); }
    catch (e) { toast.error(e.response?.data?.error || 'Save failed'); }
    finally { setPiSaving(false); }
  };

  // ── Gateway save/test ──────────────────────────────────────────────────────
  const handleGwSave = async () => {
    setGwSaving(true);
    try {
      const payload = { razorpay_key_id: gw.razorpay_key_id, payments_enabled: gw.payments_enabled };
      if (gwSecretChanged && gw.razorpay_key_secret && gw.razorpay_key_secret !== MASK) {
        payload.razorpay_key_secret = gw.razorpay_key_secret;
      }
      await api.put('/settings', payload);
      qc.invalidateQueries({ queryKey: ['admin-gw-settings'] });
      qc.invalidateQueries({ queryKey: ['payment-status'] });
      toast.success('Payment settings saved');
      setGwSecretChanged(false);
    } catch (e) { toast.error(e.response?.data?.error || 'Save failed'); }
    finally { setGwSaving(false); }
  };
  const handleGwTest = async () => {
    setGwTesting(true);
    try {
      const secret = gwSecretChanged ? gw.razorpay_key_secret : (gwSecretSaved ? '' : gw.razorpay_key_secret);
      const r = await api.post('/settings/test-payment', {
        key_id:     gw.razorpay_key_id,
        key_secret: secret !== MASK ? secret : '',
      });
      toast.success(r.data.message);
    }
    catch (e) { toast.error(e.response?.data?.error || 'Test failed'); }
    finally { setGwTesting(false); }
  };

  // ── Chart data ─────────────────────────────────────────────────────────────
  const revenueChartData = (revenue?.monthlyRevenue || []).map(r => ({
    month: fmtMonth(r.month), Revenue: r.revenue || 0, Transactions: r.transactions || 0,
  }));
  const userGrowthData = (revenue?.userGrowth || []).map(r => ({
    month: fmtMonth(r.month), 'New Users': r.count || 0,
  }));
  const planRevenueData = (revenue?.revenueByPlan || []).map(r => ({
    name: r.name, Revenue: r.total || 0,
  }));

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-8 pb-20 animate-fade-in">

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl sm:text-3xl font-black dark:text-white text-gray-900 tracking-tight uppercase">Admin</h1>
            <span className="text-xs font-black px-2.5 py-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/30 uppercase tracking-widest">
              Admin Panel
            </span>
          </div>
          <p className="text-xs font-bold text-primary-500 uppercase tracking-[0.3em]">System Management Dashboard</p>
        </div>
        {tab === 'users' && (
          <button className="btn-primary" onClick={() => setCreateOpen(true)}>+ Create User</button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 p-1.5 bg-black/5 dark:bg-black/40 rounded-2xl border border-black/10 dark:border-white/10 w-fit">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${
              tab === t.id
                ? 'bg-primary-500 text-white shadow'
                : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
            }`}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          OVERVIEW TAB
      ══════════════════════════════════════════════════════════════════════ */}
      {tab === 'overview' && (
        <div className="space-y-8 animate-slide-up">

          {/* Live indicator bar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
              </span>
              <span className="text-xs font-black text-emerald-400 uppercase tracking-widest">Live</span>
              <span className="text-xs font-semibold text-gray-500">· refreshes every 15s</span>
            </div>
            <div className="flex items-center gap-3">
              {sinceLabel && (
                <span className="text-xs font-semibold text-gray-500">
                  Updated {sinceLabel}
                </span>
              )}
              <button
                onClick={() => {
                  qc.invalidateQueries({ queryKey: ['admin-stats'] });
                  qc.invalidateQueries({ queryKey: ['admin-revenue'] });
                }}
                disabled={statsFetching || revenueFetching}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-black uppercase tracking-widest rounded-xl bg-primary-500/10 text-primary-400 hover:bg-primary-500/20 border border-primary-500/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <svg className={`w-3.5 h-3.5 ${statsFetching || revenueFetching ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                </svg>
                {statsFetching || revenueFetching ? 'Refreshing…' : 'Refresh'}
              </button>
            </div>
          </div>

          {/* KPI row 1 — revenue & billing */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            <KPI label="Total Users"    value={num(stats?.totalUsers)}      color="text-primary-400"  fetching={statsFetching} />
            <KPI label="MRR"            value={inr(stats?.mrr)}             color="text-violet-400"   sub="monthly recurring"  fetching={statsFetching} />
            <KPI label="ARR"            value={inr((stats?.mrr || 0) * 12)} color="text-purple-400"   sub="annual recurring"   fetching={statsFetching} />
            <KPI label="Total Revenue"  value={inr(stats?.totalRevenue)}    color="text-emerald-400"  sub="all-time collected" fetching={statsFetching} />
            <KPI label="Paid Users"     value={num(stats?.paidUsers)}       color="text-amber-400"    sub="ever paid"          fetching={statsFetching} />
            <KPI label="Active Paid"    value={num(stats?.activeSubs)}      color="text-blue-400"     sub="current subscribers" fetching={statsFetching} />
          </div>

          {/* KPI row 2 — email stats */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            <KPI label="Delivered"    value={num(stats?.emailsDelivered)} color="text-emerald-400" sub="successfully sent"  fetching={statsFetching} />
            <KPI label="Failed"       value={num(stats?.emailsFailed)}    color="text-red-400"     sub="delivery failed"    fetching={statsFetching} />
            <KPI label="Pending"      value={num(stats?.emailsPending)}
              color={(stats?.emailsPending || 0) > 0 ? 'text-amber-400' : 'text-gray-500'}
              sub={(stats?.emailsPending || 0) > 0 ? '⚠ stuck / check SMTP' : 'queued / in-flight'}
              fetching={statsFetching} />
            <KPI label="Delivery Rate"
              value={(() => {
                const total = (stats?.emailsDelivered || 0) + (stats?.emailsFailed || 0);
                return total > 0 ? `${((stats.emailsDelivered / total) * 100).toFixed(1)}%` : '—';
              })()}
              color="text-cyan-400" sub="sent ÷ (sent+failed)" fetching={statsFetching} />
          </div>

          {/* KPI row 3 — user growth */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            <KPI label="New Today"        value={num(stats?.newUsersToday)}    color="text-cyan-400"    fetching={statsFetching} />
            <KPI label="New This Week"    value={num(stats?.newUsersWeek)}     color="text-teal-400"    fetching={statsFetching} />
            <KPI label="New This Month"   value={num(stats?.newUsersMonth)}    color="text-emerald-400" fetching={statsFetching} />
            <KPI label="Total Contacts"   value={num(stats?.totalContacts)}    color="text-sky-400"     fetching={statsFetching} />
            <KPI label="Campaigns"        value={num(stats?.totalCampaigns)}   color="text-indigo-400"  fetching={statsFetching} />
          </div>

          {/* KPI row 4 — content */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <KPI label="Lists"            value={num(stats?.totalLists)}       color="text-fuchsia-400" fetching={statsFetching} />
            <KPI label="Templates"        value={num(stats?.totalTemplates)}   color="text-rose-400"    fetching={statsFetching} />
            <KPI label="Active Automations" value={num(stats?.activeAutomations)} color="text-orange-400" fetching={statsFetching} />
            <KPI label="All Campaigns"    value={num(stats?.totalCampaigns)}   color="text-violet-400"  fetching={statsFetching} />
          </div>

          {/* Plan distribution */}
          {stats?.planBreakdown && (
            <div className="card p-6">
              <p className="text-xs font-black text-gray-500 uppercase tracking-widest mb-5">Plan Distribution</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {stats.planBreakdown.map(pb => {
                  const pct = stats.totalUsers > 0 ? Math.round((pb.count / stats.totalUsers) * 100) : 0;
                  const clr = PLAN_COLORS[pb.slug] || PLAN_COLORS.free;
                  return (
                    <div key={pb.slug} className={`p-5 rounded-2xl border ${clr}`}>
                      <p className="text-xs font-black uppercase tracking-widest opacity-70 mb-2">{pb.name}</p>
                      <p className="text-4xl font-black">{pb.count}</p>
                      <p className="text-xs font-semibold mt-1 opacity-60">{pct}% of users</p>
                      <div className="mt-3 h-1 rounded-full bg-current opacity-10">
                        <div className="h-full rounded-full bg-current opacity-60" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Revenue chart */}
          <div className="card p-6">
            <p className="text-xs font-black text-gray-500 uppercase tracking-widest mb-6">Monthly Revenue (Last 12 Months)</p>
            {revenueChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={revenueChartData} margin={{ top: 5, right: 10, left: 5, bottom: 5 }}>
                  <defs>
                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.1)" />
                  <XAxis dataKey="month" tick={{ fill: '#6b7280', fontSize: 11, fontWeight: 700 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#6b7280', fontSize: 11, fontWeight: 700 }} axisLine={false} tickLine={false}
                    tickFormatter={v => `₹${v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v}`} />
                  <Tooltip content={<ChartTip prefix="₹" />} />
                  <Area type="monotone" dataKey="Revenue" stroke="#8b5cf6" strokeWidth={2.5} fill="url(#revGrad)" name="Revenue" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-xs font-black text-gray-500 uppercase tracking-widest py-12">No revenue data yet</p>
            )}
          </div>

          {/* Recent paid transactions */}
          <div className="card overflow-hidden">
            <div className="px-6 py-4 border-b dark:border-white/5 border-black/5 flex items-center justify-between">
              <p className="text-xs font-black text-gray-500 uppercase tracking-widest">Recent Paid Transactions</p>
              <button onClick={() => setTab('subscriptions')} className="text-xs font-black text-primary-500 hover:text-primary-400 uppercase tracking-widest transition-colors">
                View All →
              </button>
            </div>
            {(stats?.recentSubs?.length > 0) ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b dark:border-white/[0.04] border-black/5">
                      {['User', 'Plan', 'Amount', 'Status', 'Date'].map(h => (
                        <th key={h} className="py-3 px-6 text-xs font-black text-gray-500 uppercase tracking-widest text-left">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y dark:divide-white/[0.03] divide-black/[0.03]">
                    {stats.recentSubs.map(s => (
                      <tr key={s.id} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02]">
                        <td className="py-3.5 px-6 text-sm font-bold dark:text-white text-gray-900">{s.email}</td>
                        <td className="py-3.5 px-6"><Badge label={s.plan_name} colorClass={PLAN_COLORS[s.plan_slug] || PLAN_COLORS.free} /></td>
                        <td className="py-3.5 px-6 text-sm font-black text-emerald-400">{inr(s.amount_paid)}</td>
                        <td className="py-3.5 px-6"><Badge label={s.status || 'active'} colorClass={STATUS_COLORS[s.status] || STATUS_COLORS.active} /></td>
                        <td className="py-3.5 px-6 text-sm font-semibold text-gray-500">
                          {s.created_at ? format(new Date(s.created_at), 'MMM d, yyyy') : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-center text-xs font-black text-gray-500 uppercase tracking-widest py-10">No paid transactions yet</p>
            )}
          </div>

          {/* Activity Feed */}
          <ActivityFeed entries={activityLog} fetching={activityFetching} />
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          USERS TAB
      ══════════════════════════════════════════════════════════════════════ */}
      {tab === 'users' && (
        <div className="space-y-4 animate-slide-up">
          <div className="flex flex-wrap items-center gap-3">
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search by email or name…" className="input-field py-3 max-w-sm" />
            {usersData?.total != null && (
              <span className="text-xs font-semibold text-gray-500">{usersData.total} users</span>
            )}
            <button onClick={() => setShowDeleted(v => !v)}
              className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-black uppercase tracking-widest rounded-xl border transition-all ${
                showDeleted
                  ? 'bg-red-500/10 border-red-500/20 text-red-400'
                  : 'bg-black/5 dark:bg-white/5 border-black/10 dark:border-white/10 text-gray-500 hover:text-gray-900 dark:hover:text-white'
              }`}>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"/>
              </svg>
              {showDeleted ? 'Hide Deleted' : 'Show Deleted'}
            </button>
          </div>
          <div className="card overflow-hidden">
            {usersLoading ? <Spinner /> : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b dark:border-white/5 border-black/5">
                      {['User', 'Role', 'Plan', 'Paid Subs', 'Joined', 'Actions'].map((h, i) => (
                        <th key={h} className={`py-4 px-5 text-xs font-black text-gray-500 uppercase tracking-widest ${i === 5 ? 'text-right' : 'text-left'}`}>{h}</th>
                      ))}
                      <th className="py-4 px-5 text-xs font-black text-gray-500 uppercase tracking-widest text-right">History</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y dark:divide-white/[0.03] divide-black/[0.03]">
                    {(usersData?.users || []).length === 0 ? (
                      <EmptyRow cols={7} msg="No users found" />
                    ) : (usersData?.users || []).map(u => (
                      <tr key={u.id} className={`hover:bg-black/[0.02] dark:hover:bg-white/[0.02] cursor-pointer border-b border-black/[0.03] dark:border-white/[0.03] last:border-0 ${u.deleted_at ? 'opacity-60' : ''}`} onClick={() => setViewUser(u)}>
                        <td className="py-4 px-5">
                          <p className="text-sm font-black dark:text-white text-gray-900">{u.email}</p>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            {u.name && <p className="text-xs font-semibold text-gray-500">{u.name}</p>}
                            {u.deleted_at && (
                              <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20 uppercase tracking-wider">Deleted</span>
                            )}
                          </div>
                        </td>
                        <td className="py-4 px-5">
                          <Badge label={u.role} colorClass={ROLE_COLORS[u.role] || ROLE_COLORS.user} />
                        </td>
                        <td className="py-4 px-5">
                          <div className="flex flex-col gap-0.5">
                            <Badge label={u.plan_name || 'Free'} colorClass={PLAN_COLORS[u.plan_slug] || PLAN_COLORS.free} />
                            {u.plan_expires_at ? (
                              <span className={`text-[10px] font-black ${new Date(u.plan_expires_at) < new Date() ? 'text-red-400' : 'text-emerald-400'}`}>
                                {new Date(u.plan_expires_at) < new Date() ? '✗ expired ' : '✓ expires '}
                                {format(new Date(u.plan_expires_at), 'MMM d')}
                              </span>
                            ) : u.plan_slug !== 'free' ? (
                              <span className="text-[10px] font-black text-amber-400">⚠ no expiry set</span>
                            ) : null}
                          </div>
                        </td>
                        <td className="py-4 px-5 text-sm font-bold text-gray-500">{u.paid_subs || 0}</td>
                        <td className="py-4 px-5 text-sm font-semibold text-gray-500">
                          {u.created_at ? format(new Date(u.created_at), 'MMM d, yyyy') : '—'}
                        </td>
                        <td className="py-3 px-4 text-right" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center gap-1.5 justify-end flex-wrap">
                            <button onClick={() => setViewUser(u)} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest bg-gray-500/10 text-gray-500 dark:text-gray-400 hover:bg-gray-500/20 hover:text-gray-700 dark:hover:text-gray-300 border border-gray-500/20 transition-all">
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.964-7.178z"/><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                              View
                            </button>
                            <button onClick={() => setEditUser(u)} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest bg-primary-500/10 text-primary-600 dark:text-primary-400 hover:bg-primary-500/20 border border-primary-500/20 transition-all">
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125"/></svg>
                              Edit
                            </button>
                            <button onClick={() => setChangePlanUser(u)} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 transition-all">
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                              Plan
                            </button>
                            <button onClick={() => setResetUser(u)} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 border border-amber-500/20 transition-all">
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z"/></svg>
                              Reset PW
                            </button>
                            {u.id !== me?.id && !u.deleted_at && (
                              <button onClick={() => setDeleteConfirm(u)} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20 border border-red-500/20 transition-all">
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"/></svg>
                                Delete
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right" onClick={e => e.stopPropagation()}>
                          <button onClick={() => setHistoryUser(u)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest bg-violet-500/10 text-violet-600 dark:text-violet-400 hover:bg-violet-500/20 border border-violet-500/20 transition-all">
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                            History
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          SUBSCRIPTIONS TAB
      ══════════════════════════════════════════════════════════════════════ */}
      {tab === 'subscriptions' && (
        <div className="space-y-4 animate-slide-up">
          <div className="flex items-center gap-2 flex-wrap">
            {[['', 'All'], ['active', 'Active'], ['expired', 'Expired'], ['pending', 'Pending'], ['upcoming', 'Expiring Soon']].map(([val, lbl]) => (
              <button key={val} onClick={() => setSubFilter(val)}
                className={`px-4 py-2 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${
                  subFilter === val
                    ? 'bg-primary-500 text-white'
                    : 'bg-black/5 dark:bg-white/5 text-gray-500 hover:text-gray-900 dark:hover:text-white'
                }`}>{lbl}</button>
            ))}
            {subsData?.total != null && (
              <span className="text-xs font-semibold text-gray-500 ml-2">{subsData.total} total</span>
            )}
          </div>

          <div className="card overflow-hidden">
            {subsLoading ? <Spinner /> : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b dark:border-white/5 border-black/5">
                      {['User', 'Plan', 'Amount', 'Status', 'Payment ID', 'Started', 'Expires'].map(h => (
                        <th key={h} className="py-4 px-5 text-xs font-black text-gray-500 uppercase tracking-widest text-left">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y dark:divide-white/[0.03] divide-black/[0.03]">
                    {(subsData?.subscriptions || []).length === 0 ? (
                      <EmptyRow cols={7} msg="No subscriptions found" />
                    ) : (subsData?.subscriptions || []).map(s => {
                      const isActuallyExpired = s.expires_at && new Date(s.expires_at) < new Date();
                      const displayStatus = isActuallyExpired ? 'expired' : (s.status || 'active');
                      return (
                      <tr key={s.id} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02]">
                        <td className="py-3.5 px-5">
                          <p className="text-sm font-bold dark:text-white text-gray-900">{s.email}</p>
                          {s.name && <p className="text-xs text-gray-500">{s.name}</p>}
                        </td>
                        <td className="py-3.5 px-5"><Badge label={s.plan_name} colorClass={PLAN_COLORS[s.plan_slug] || PLAN_COLORS.free} /></td>
                        <td className="py-3.5 px-5 text-sm font-black text-primary-400">{s.amount_paid === 0 ? 'Free' : inr(s.amount_paid)}</td>
                        <td className="py-3.5 px-5"><Badge label={displayStatus} colorClass={STATUS_COLORS[displayStatus] || STATUS_COLORS.active} /></td>
                        <td className="py-3.5 px-5 text-xs font-mono text-gray-500">
                          {s.razorpay_payment_id ? `${s.razorpay_payment_id.slice(0, 14)}…` : '—'}
                        </td>
                        <td className="py-3.5 px-5 text-sm font-semibold text-gray-500">
                          {s.started_at ? format(new Date(s.started_at), 'MMM d, yyyy') : '—'}
                        </td>
                        <td className={`py-3.5 px-5 text-sm font-semibold ${isActuallyExpired ? 'text-red-400' : 'text-gray-500'}`}>
                          {s.expires_at ? format(new Date(s.expires_at), 'MMM d, yyyy') : '—'}
                        </td>
                      </tr>
                    );})}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          REVENUE TAB
      ══════════════════════════════════════════════════════════════════════ */}
      {tab === 'revenue' && (
        <div className="space-y-8 animate-slide-up">

          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KPI label="MRR"             value={inr(revenue?.mrr)}            color="text-violet-400"  sub="monthly recurring" />
            <KPI label="ARR"             value={inr(revenue?.arr)}            color="text-primary-400" sub="annual run rate" />
            <KPI label="Total Revenue"   value={inr(stats?.totalRevenue)}     color="text-emerald-400" />
            <KPI label="Avg Transaction" value={inr(revenue?.avgTransaction)} color="text-amber-400" />
          </div>

          {/* Charts row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="card p-6">
              <p className="text-xs font-black text-gray-500 uppercase tracking-widest mb-6">Revenue Over Time</p>
              {revenueChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={revenueChartData}>
                    <defs>
                      <linearGradient id="revGrad2" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.1)" />
                    <XAxis dataKey="month" tick={{ fill: '#6b7280', fontSize: 10, fontWeight: 700 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#6b7280', fontSize: 10, fontWeight: 700 }} axisLine={false} tickLine={false}
                      tickFormatter={v => `₹${v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v}`} />
                    <Tooltip content={<ChartTip prefix="₹" />} />
                    <Area type="monotone" dataKey="Revenue" stroke="#8b5cf6" strokeWidth={2.5} fill="url(#revGrad2)" name="Revenue" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-center text-xs font-black text-gray-500 uppercase tracking-widest py-16">No revenue data yet</p>
              )}
            </div>

            <div className="card p-6">
              <p className="text-xs font-black text-gray-500 uppercase tracking-widest mb-6">User Growth</p>
              {userGrowthData.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={userGrowthData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.1)" />
                    <XAxis dataKey="month" tick={{ fill: '#6b7280', fontSize: 10, fontWeight: 700 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#6b7280', fontSize: 10, fontWeight: 700 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<ChartTip />} />
                    <Bar dataKey="New Users" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-center text-xs font-black text-gray-500 uppercase tracking-widest py-16">No user data yet</p>
              )}
            </div>
          </div>

          {/* Revenue by plan */}
          {planRevenueData.length > 0 && (
            <div className="card p-6">
              <p className="text-xs font-black text-gray-500 uppercase tracking-widest mb-5">Revenue by Plan</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                {(revenue?.revenueByPlan || []).map(r => (
                  <div key={r.slug} className={`p-4 rounded-2xl border ${PLAN_COLORS[r.slug] || PLAN_COLORS.free}`}>
                    <p className="text-xs font-black uppercase tracking-wider opacity-70">{r.name}</p>
                    <p className="text-2xl font-black mt-1">{inr(r.total)}</p>
                    <p className="text-xs font-semibold mt-0.5 opacity-60">{r.count} transaction{r.count !== 1 ? 's' : ''}</p>
                  </div>
                ))}
              </div>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={planRevenueData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.1)" />
                  <XAxis dataKey="name" tick={{ fill: '#6b7280', fontSize: 11, fontWeight: 700 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#6b7280', fontSize: 11, fontWeight: 700 }} axisLine={false} tickLine={false}
                    tickFormatter={v => `₹${v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v}`} />
                  <Tooltip content={<ChartTip prefix="₹" />} />
                  <Bar dataKey="Revenue" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Recent paid transactions */}
          {(stats?.recentSubs?.filter(s => s.amount_paid > 0).length > 0) && (
            <div className="card overflow-hidden">
              <div className="px-6 py-4 border-b dark:border-white/5 border-black/5 flex items-center justify-between">
                <p className="text-xs font-black text-gray-500 uppercase tracking-widest">Recent Transactions</p>
                <button onClick={() => setTab('subscriptions')} className="text-xs font-black text-primary-500 hover:text-primary-400 uppercase tracking-widest transition-colors">
                  View All →
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b dark:border-white/[0.04] border-black/5">
                      {['User', 'Plan', 'Amount', 'Date'].map(h => (
                        <th key={h} className="py-3 px-6 text-xs font-black text-gray-500 uppercase tracking-widest text-left">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y dark:divide-white/[0.03] divide-black/5">
                    {stats.recentSubs.filter(s => s.amount_paid > 0).map(s => (
                      <tr key={s.id} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02]">
                        <td className="py-3.5 px-6 text-sm font-bold dark:text-white text-gray-900">{s.email}</td>
                        <td className="py-3.5 px-6"><Badge label={s.plan_name} colorClass={PLAN_COLORS[s.plan_slug] || PLAN_COLORS.free} /></td>
                        <td className="py-3.5 px-6 text-sm font-black text-emerald-400">{inr(s.amount_paid)}</td>
                        <td className="py-3.5 px-6 text-sm font-semibold text-gray-500">
                          {s.created_at ? format(new Date(s.created_at), 'MMM d, yyyy') : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          PLANS TAB
      ══════════════════════════════════════════════════════════════════════ */}
      {tab === 'plans' && (
        <div className="space-y-6 animate-slide-up">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">
              Manage plan pricing, limits &amp; features
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
            {plans.map(p => {
              const clr = PLAN_COLORS[p.slug] || PLAN_COLORS.free;
              return (
                <div key={p.id} className="card p-6 flex flex-col">
                  <div className="flex items-start justify-between gap-2 mb-4">
                    <Badge label={p.name} colorClass={clr} />
                    <span className={`text-xs font-black ${p.is_active ? 'text-emerald-400' : 'text-red-400'}`}>
                      {p.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>

                  <p className="text-4xl font-black dark:text-white text-gray-900">
                    {p.price_inr === 0 ? 'Free' : `₹${p.price_inr.toLocaleString('en-IN')}`}
                  </p>
                  <p className="text-xs font-semibold text-gray-500 mt-0.5 mb-4">
                    {p.price_inr > 0 ? '/month' : 'forever'}
                  </p>

                  <div className="space-y-2 mb-4">
                    {[
                      ['Recipients/day', p.recipients_per_day          === -1 ? '∞' : num(p.recipients_per_day)],
                      ['Max contacts',   p.max_contacts                === -1 ? '∞' : num(p.max_contacts)],
                      ['Campaigns/mo',   p.max_campaigns_per_month     === -1 ? '∞' : p.max_campaigns_per_month],
                      ['Email senders',  p.max_email_integrations      === -1 ? '∞' : (p.max_email_integrations ?? 1)],
                    ].map(([lbl, val]) => (
                      <div key={lbl} className="flex justify-between text-xs font-semibold">
                        <span className="text-gray-500">{lbl}</span>
                        <span className="font-black dark:text-white text-gray-900">{val}</span>
                      </div>
                    ))}
                  </div>

                  <ul className="space-y-1.5 flex-1">
                    {(p.features?.length ? p.features : (PLAN_FEATURES[p.slug] || [])).map((f, i) => (
                      <li key={i} className="text-xs font-semibold text-gray-500 flex gap-1.5 items-start">
                        <span className="text-emerald-500 shrink-0 mt-0.5">✓</span>{f}
                      </li>
                    ))}
                  </ul>

                  <button onClick={() => setEditPlan(p)}
                    className="mt-5 w-full py-2.5 text-xs font-black uppercase tracking-widest rounded-xl bg-black/5 dark:bg-white/5 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-all">
                    Edit Plan
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          SETTINGS TAB — Razorpay / Payment Gateway
      ══════════════════════════════════════════════════════════════════════ */}
      {tab === 'settings' && (
        <div className="space-y-6 animate-slide-up max-w-2xl">
          <div className="card p-8 space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-base font-black dark:text-white text-gray-900 uppercase tracking-widest border-l-4 border-violet-500 pl-3">
                  Payment Gateway — Razorpay
                </h2>
                <p className="text-xs font-semibold text-gray-500 mt-1.5 pl-3">Configure Razorpay to enable plan purchases for your users</p>
              </div>
              {/* Live/test status */}
              {gw.razorpay_key_id && gwSecretSaved ? (
                <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-widest border ${gw.razorpay_key_id.startsWith('rzp_live_') ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-amber-500/10 border-amber-500/20 text-amber-400'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${gw.razorpay_key_id.startsWith('rzp_live_') ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
                  {gw.razorpay_key_id.startsWith('rzp_live_') ? 'Live mode' : 'Test mode'}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-500/10 border border-gray-500/20 text-gray-400 text-xs font-black uppercase tracking-widest">
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-500" /> Not configured
                </span>
              )}
            </div>

            {/* How-to box */}
            <div className="p-4 rounded-xl bg-violet-500/5 border border-violet-500/20 flex gap-3">
              <svg className="w-5 h-5 text-violet-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
              <div>
                <p className="text-xs font-black text-violet-400 uppercase tracking-widest mb-1">How to get API keys</p>
                <p className="text-xs font-semibold text-gray-500 leading-relaxed">
                  1. Sign up at <span className="text-violet-400 font-bold">dashboard.razorpay.com</span><br/>
                  2. Go to Settings → API Keys → Generate<br/>
                  3. Use <span className="text-amber-400 font-bold">Test keys</span> for development, <span className="text-emerald-400 font-bold">Live keys</span> for production
                </p>
              </div>
            </div>

            {/* Key ID */}
            <div>
              <label className={LBL}>Razorpay Key ID <span className="normal-case font-normal text-violet-400">(public)</span></label>
              <input
                value={gw.razorpay_key_id}
                onChange={e => setGw(p => ({ ...p, razorpay_key_id: e.target.value }))}
                className={`${INP} w-full font-mono`}
                placeholder="rzp_test_xxxxxxxxxxxx or rzp_live_xxxxxxxxxxxx"
              />
            </div>

            {/* Key Secret */}
            <div>
              <label className={LBL}>Razorpay Key Secret <span className="normal-case font-normal text-red-400">(private — never share)</span></label>
              <input
                type="password"
                value={gw.razorpay_key_secret}
                onFocus={() => {
                  if (gwSecretSaved && !gwSecretChanged && gw.razorpay_key_secret === MASK) {
                    setGw(p => ({ ...p, razorpay_key_secret: '' }));
                  }
                }}
                onBlur={() => {
                  if (gwSecretSaved && !gwSecretChanged && gw.razorpay_key_secret.trim() === '') {
                    setGw(p => ({ ...p, razorpay_key_secret: MASK }));
                  }
                }}
                onChange={e => { setGwSecretChanged(true); setGw(p => ({ ...p, razorpay_key_secret: e.target.value })); }}
                className={`${INP} w-full font-mono`}
                placeholder="Enter Razorpay Key Secret"
                autoComplete="new-password"
              />
              {gwSecretSaved && !gwSecretChanged && (
                <p className="text-xs font-semibold text-gray-500 mt-1.5">Secret is saved securely. Click to replace.</p>
              )}
            </div>

            {/* Payments enabled toggle */}
            <div className="flex items-center justify-between p-4 rounded-xl bg-black/5 dark:bg-white/[0.03] border border-black/10 dark:border-white/5">
              <div>
                <p className="text-xs font-black dark:text-white text-gray-900 uppercase tracking-widest">Enable Payments on Plans Page</p>
                <p className="text-xs font-semibold text-gray-500 mt-0.5">Users can purchase plans when this is on</p>
              </div>
              <ToggleSwitch
                checked={gw.payments_enabled === 'true'}
                onChange={v => setGw(p => ({ ...p, payments_enabled: v ? 'true' : 'false' }))}
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={handleGwTest}
                disabled={gwTesting || !gw.razorpay_key_id || (!gwSecretSaved && !gwSecretChanged)}
                className="px-5 py-2.5 text-xs font-black uppercase tracking-widest rounded-xl bg-violet-500/10 text-violet-400 border border-violet-500/20 hover:bg-violet-500/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                {gwTesting ? 'Testing…' : 'Test Connection'}
              </button>
              <button onClick={handleGwSave} disabled={gwSaving} className="flex-1 btn-primary justify-center">
                {gwSaving ? 'Saving…' : 'Save Payment Settings'}
              </button>
            </div>
            <p className="text-xs font-semibold text-gray-500">Enter both keys to enable Test Connection. Save to persist them.</p>
          </div>

          {/* ── Payment Info for Users ── */}
          <div className="card p-8 space-y-6">
            <div>
              <h2 className="text-base font-black dark:text-white text-gray-900 uppercase tracking-widest border-l-4 border-blue-500 pl-3">
                Manual Payment Info
              </h2>
              <p className="text-xs font-semibold text-gray-500 mt-1.5 pl-3">UPI ID and bank details shown to users when they upgrade a plan</p>
            </div>

            <div>
              <label className={LBL}>UPI ID</label>
              <input value={pi.upi_id} onChange={e => setPi(p => ({ ...p, upi_id: e.target.value }))} className={`${INP} w-full font-mono`} placeholder="yourname@upi or merchant@paytm" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className={LBL}>Bank Name</label>
                <input value={pi.bank_name} onChange={e => setPi(p => ({ ...p, bank_name: e.target.value }))} className={`${INP} w-full`} placeholder="HDFC Bank" />
              </div>
              <div>
                <label className={LBL}>Account Number</label>
                <input value={pi.bank_account} onChange={e => setPi(p => ({ ...p, bank_account: e.target.value }))} className={`${INP} w-full font-mono`} placeholder="XXXXXXXXXXXX" />
              </div>
              <div>
                <label className={LBL}>IFSC Code</label>
                <input value={pi.bank_ifsc} onChange={e => setPi(p => ({ ...p, bank_ifsc: e.target.value }))} className={`${INP} w-full font-mono`} placeholder="HDFC0001234" />
              </div>
            </div>
            <div>
              <label className={LBL}>Payment Instructions</label>
              <textarea value={pi.payment_instructions} onChange={e => setPi(p => ({ ...p, payment_instructions: e.target.value }))} rows={3} className={`${INP} w-full resize-none`} placeholder="e.g. Pay via UPI using the ID above. Add your email as the payment note." />
            </div>
            <button onClick={handlePiSave} disabled={piSaving} className="btn-primary w-full justify-center">
              {piSaving ? 'Saving…' : 'Save Payment Info'}
            </button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          PAYMENTS TAB — User payment requests
      ══════════════════════════════════════════════════════════════════════ */}
      {tab === 'payments' && (
        <div className="space-y-5 animate-slide-up">
          <div className="flex flex-wrap items-center gap-3">
            {[['pending', 'Pending'], ['approved', 'Approved'], ['rejected', 'Rejected'], ['', 'All']].map(([val, lbl]) => (
              <button key={val} onClick={() => setPayReqFilter(val)}
                className={`px-4 py-2 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${
                  payReqFilter === val
                    ? 'bg-primary-500 text-white'
                    : 'bg-black/5 dark:bg-white/5 text-gray-500 hover:text-gray-900 dark:hover:text-white'
                }`}>{lbl}</button>
            ))}
            {payReqsData?.total != null && (
              <span className="text-xs font-semibold text-gray-500">{payReqsData.total} requests</span>
            )}
            {payReqsData?.pendingCount > 0 && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-black uppercase tracking-widest">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                {payReqsData.pendingCount} pending
              </span>
            )}
          </div>

          <div className="card overflow-hidden">
            {payReqsLoading ? <Spinner /> : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b dark:border-white/5 border-black/5">
                      {['User', 'Plan', 'Amount', 'Method', 'Transaction ID', 'Submitted', 'Status', 'Actions'].map((h, i) => (
                        <th key={h} className={`py-4 px-4 text-xs font-black text-gray-500 uppercase tracking-widest ${i === 7 ? 'text-right' : 'text-left'}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y dark:divide-white/[0.03] divide-black/[0.03]">
                    {(payReqsData?.requests || []).length === 0 ? (
                      <EmptyRow cols={8} msg="No payment requests found" />
                    ) : (payReqsData?.requests || []).map(req => (
                      <tr key={req.id} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02]">
                        <td className="py-3.5 px-4">
                          <p className="text-sm font-bold dark:text-white text-gray-900">{req.email}</p>
                          {req.user_name && <p className="text-xs text-gray-500">{req.user_name}</p>}
                        </td>
                        <td className="py-3.5 px-4">
                          <Badge label={req.plan_name} colorClass={PLAN_COLORS[req.plan_slug] || PLAN_COLORS.free} />
                        </td>
                        <td className="py-3.5 px-4 text-sm font-black text-primary-400">₹{(req.amount || 0).toLocaleString('en-IN')}</td>
                        <td className="py-3.5 px-4 text-xs font-bold text-gray-500 uppercase">{req.payment_method || 'upi'}</td>
                        <td className="py-3.5 px-4">
                          <p className="text-xs font-mono text-gray-700 dark:text-gray-300 max-w-[120px] truncate" title={req.transaction_id}>{req.transaction_id}</p>
                          {req.note && <p className="text-xs text-gray-500 mt-0.5 max-w-[120px] truncate" title={req.note}>{req.note}</p>}
                        </td>
                        <td className="py-3.5 px-4 text-xs font-semibold text-gray-500">
                          {req.created_at ? format(new Date(req.created_at), 'MMM d, yyyy') : '—'}
                        </td>
                        <td className="py-3.5 px-4">
                          <Badge label={req.status}
                            colorClass={req.status === 'approved' ? STATUS_COLORS.active : req.status === 'rejected' ? 'bg-red-500/10 text-red-400 border-red-500/20' : STATUS_COLORS.pending} />
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          {req.status === 'pending' && (
                            <div className="flex flex-col items-end gap-1.5">
                              <div className="flex items-center gap-2">
                                <button onClick={() => approvePayMut.mutate(req.id)} disabled={approvePayMut.isPending}
                                  className="px-3 py-1.5 text-xs font-black uppercase tracking-widest rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 transition-all">
                                  Approve
                                </button>
                                <button onClick={() => { setRejectModal(req); setRejectNote(''); }}
                                  className="px-3 py-1.5 text-xs font-black uppercase tracking-widest rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 transition-all">
                                  Reject
                                </button>
                              </div>
                              <button onClick={() => remindPayMut.mutate(req.id)} disabled={remindPayMut.isPending}
                                className="px-3 py-1.5 text-xs font-black uppercase tracking-widest rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 border border-blue-500/20 transition-all">
                                {remindPayMut.isPending ? '…' : '📧 Remind'}
                              </button>
                              {req.reminder_sent_at && (
                                <p className="text-[10px] font-semibold text-gray-500">
                                  Reminded {format(new Date(req.reminder_sent_at), 'MMM d')}
                                </p>
                              )}
                            </div>
                          )}
                          {req.status === 'rejected' && req.admin_note && (
                            <p className="text-xs text-gray-500 max-w-[150px] text-right" title={req.admin_note}>{req.admin_note}</p>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Modals ──────────────────────────────────────────────────────────── */}
      {editUser && (
        <EditUserModal user={editUser} plans={plans} onClose={() => setEditUser(null)}
          onSave={(id, d) => saveUserMut.mutateAsync([id, d])} />
      )}
      {resetUser && (
        <ResetPasswordModal user={resetUser} onClose={() => setResetUser(null)}
          onReset={(id, pw) => resetPwMut.mutateAsync([id, pw])} />
      )}
      {createOpen && (
        <CreateUserModal plans={plans} onClose={() => setCreateOpen(false)}
          onCreate={d => createUserMut.mutateAsync(d)} />
      )}
      {editPlan && (
        <EditPlanModal plan={editPlan} onClose={() => setEditPlan(null)}
          onSave={(id, d) => updatePlanMut.mutateAsync([id, d])} />
      )}
      {deleteConfirm && (
        <div className="fixed inset-0 lg:left-72 z-[9999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-[#0d0928]/85 backdrop-blur-sm" onClick={() => setDeleteConfirm(null)} />
          <div className="relative w-full max-w-sm card p-8 space-y-5 animate-fade-in text-center" onClick={e => e.stopPropagation()}>
            <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto">
              <svg className="w-7 h-7 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
              </svg>
            </div>
            <div>
              <h3 className="text-base font-black dark:text-white text-gray-900 uppercase tracking-widest">Delete User?</h3>
              <p className="text-sm font-semibold text-gray-500 mt-2">{deleteConfirm.email}</p>
              <p className="text-xs text-gray-500 mt-1">This cannot be undone.</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)}
                className="flex-1 py-2.5 text-xs font-black uppercase tracking-widest rounded-xl bg-black/5 dark:bg-white/5 text-gray-500">Cancel</button>
              <button onClick={() => deleteUserMut.mutate(deleteConfirm.id)}
                className="flex-1 py-2.5 text-xs font-black uppercase tracking-widest rounded-xl bg-red-500 hover:bg-red-600 text-white transition-all">Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Change Plan Modal ─────────────────────────────────────────────────── */}
      {changePlanUser && (
        <ChangePlanModal
          user={changePlanUser}
          plans={plans}
          onClose={() => setChangePlanUser(null)}
          onSave={(planId, cycle) => changePlanMut.mutateAsync([changePlanUser.id, planId, cycle])}
          saving={changePlanMut.isPending}
        />
      )}

      {/* ── Reject Payment Modal ───────────────────────────────────────────────── */}
      {rejectModal && (
        <Modal onClose={() => setRejectModal(null)} maxW="max-w-sm">
          <ModalHeader title="Reject Payment" sub={`${rejectModal.email} → ${rejectModal.plan_name}`} onClose={() => setRejectModal(null)} />
          <div>
            <label className={LBL}>Reason (shown to user)</label>
            <textarea value={rejectNote} onChange={e => setRejectNote(e.target.value)} rows={3} className={`${INP} w-full resize-none`} placeholder="e.g. Transaction ID not found, please resubmit" />
          </div>
          <div className="flex gap-3">
            <button onClick={() => setRejectModal(null)} className="flex-1 py-2.5 text-xs font-black uppercase tracking-widest rounded-xl bg-black/5 dark:bg-white/5 text-gray-500">Cancel</button>
            <button onClick={() => rejectPayMut.mutate([rejectModal.id, rejectNote])} disabled={rejectPayMut.isPending}
              className="flex-1 py-2.5 text-xs font-black uppercase tracking-widest rounded-xl bg-red-500 hover:bg-red-400 text-white transition-all">
              {rejectPayMut.isPending ? '…' : 'Reject'}
            </button>
          </div>
        </Modal>
      )}

      {/* ── User Account History Modal ───────────────────────────────────────── */}
      {historyUser && (
        <div className="fixed inset-0 lg:left-72 z-[9999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-[#0d0928]/85 backdrop-blur-sm" onClick={() => setHistoryUser(null)} />
          <div className="relative w-full max-w-2xl card p-8 space-y-6 animate-fade-in max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-black dark:text-white text-gray-900 uppercase tracking-widest">Account History</h3>
                <p className="text-xs font-semibold text-gray-500 mt-0.5">{historyUser.email}</p>
              </div>
              <button onClick={() => setHistoryUser(null)}
                className="w-8 h-8 flex items-center justify-center rounded-xl bg-black/10 dark:bg-white/5 text-gray-500 hover:text-gray-900 dark:hover:text-white transition-all shrink-0">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>

            {historyLoading ? (
              <div className="flex justify-center py-12"><div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" /></div>
            ) : (
              <>
                {/* User info strip */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    ['Role',    <Badge key="r" label={userHistory?.user?.role || 'user'} colorClass={ROLE_COLORS[userHistory?.user?.role] || ROLE_COLORS.user} />],
                    ['Plan',    <Badge key="p" label={userHistory?.user?.plan_name || 'Free'} colorClass={PLAN_COLORS[userHistory?.user?.plan_slug] || PLAN_COLORS.free} />],
                    ['Joined',  <span key="j" className="text-xs font-semibold text-gray-500">{userHistory?.user?.created_at ? format(new Date(userHistory.user.created_at), 'MMM d, yyyy') : '—'}</span>],
                    ['Status',  userHistory?.user?.deleted_at
                      ? <span key="s" className="text-xs font-black text-red-400">Deleted {format(new Date(userHistory.user.deleted_at), 'MMM d, yyyy')}</span>
                      : <span key="s" className="text-xs font-black text-emerald-400">Active</span>],
                  ].map(([label, val]) => (
                    <div key={label} className="p-3 rounded-xl bg-black/5 dark:bg-white/[0.03] border border-black/10 dark:border-white/5">
                      <p className="text-xs font-black text-gray-500 uppercase tracking-widest mb-1.5">{label}</p>
                      {val}
                    </div>
                  ))}
                </div>

                {/* Subscription timeline */}
                <div>
                  <p className="text-xs font-black text-gray-500 uppercase tracking-widest mb-3">Subscription History ({(userHistory?.subscriptions || []).length})</p>
                  {(userHistory?.subscriptions || []).length === 0 ? (
                    <div className="py-6 text-center text-xs font-black text-gray-500 uppercase tracking-widest">No subscriptions yet</div>
                  ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                      {(userHistory?.subscriptions || []).map((s, i) => (
                        <div key={s.id} className="flex items-center justify-between p-3 rounded-xl bg-black/5 dark:bg-white/[0.03] border border-black/10 dark:border-white/5">
                          <div className="flex items-center gap-3">
                            <div className={`w-2 h-2 rounded-full shrink-0 ${s.status === 'active' ? 'bg-emerald-400' : 'bg-gray-500'}`} />
                            <div>
                              <p className="text-sm font-black dark:text-white text-gray-900">{s.plan_name}</p>
                              <p className="text-xs font-semibold text-gray-500 mt-0.5">
                                {s.started_at ? format(new Date(s.started_at), 'MMM d, yyyy') : '—'}
                                {s.expires_at ? ` → ${format(new Date(s.expires_at), 'MMM d, yyyy')}` : ' (no expiry)'}
                              </p>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-sm font-black text-primary-400">{s.amount_paid === 0 ? 'Free' : inr(s.amount_paid)}</p>
                            <Badge label={s.status || 'active'} colorClass={STATUS_COLORS[s.status] || STATUS_COLORS.active} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Payment requests timeline */}
                <div>
                  <p className="text-xs font-black text-gray-500 uppercase tracking-widest mb-3">Payment Requests ({(userHistory?.paymentRequests || []).length})</p>
                  {(userHistory?.paymentRequests || []).length === 0 ? (
                    <div className="py-6 text-center text-xs font-black text-gray-500 uppercase tracking-widest">No payment requests</div>
                  ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                      {(userHistory?.paymentRequests || []).map(pr => (
                        <div key={pr.id} className="flex items-center justify-between p-3 rounded-xl bg-black/5 dark:bg-white/[0.03] border border-black/10 dark:border-white/5">
                          <div className="flex items-center gap-3">
                            <div className={`w-2 h-2 rounded-full shrink-0 ${pr.status === 'approved' ? 'bg-emerald-400' : pr.status === 'rejected' ? 'bg-red-400' : 'bg-amber-400'}`} />
                            <div>
                              <p className="text-sm font-black dark:text-white text-gray-900">{pr.plan_name} <span className="text-xs font-semibold text-gray-500">({pr.billing_cycle || 'monthly'})</span></p>
                              <p className="text-xs font-semibold text-gray-500 mt-0.5">
                                {pr.created_at ? format(new Date(pr.created_at), 'MMM d, yyyy') : '—'}
                                {pr.transaction_id && ` · ${pr.transaction_id}`}
                              </p>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-sm font-black text-primary-400">{inr(pr.amount)}</p>
                            <Badge label={pr.status}
                              colorClass={pr.status === 'approved' ? STATUS_COLORS.active : pr.status === 'rejected' ? 'bg-red-500/10 text-red-400 border-red-500/20' : STATUS_COLORS.pending} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── User Activity Modal ──────────────────────────────────────────────── */}
      {viewUser && (
        <div className="fixed inset-0 lg:left-72 z-[9999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-[#0d0928]/85 backdrop-blur-sm" onClick={() => setViewUser(null)} />
          <div className="relative w-full max-w-lg card p-8 space-y-5 animate-fade-in max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-black dark:text-white text-gray-900 uppercase tracking-widest">User Activity</h3>
                <p className="text-xs font-semibold text-gray-500 mt-0.5">{viewUser.email}</p>
              </div>
              <button onClick={() => setViewUser(null)}
                className="w-8 h-8 flex items-center justify-center rounded-xl bg-black/10 dark:bg-white/5 text-gray-500 hover:text-gray-900 dark:hover:text-white transition-all shrink-0">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>

            {/* User summary */}
            <div className="grid grid-cols-2 gap-3">
              {[
                ['Role',      <Badge key="r" label={viewUser.role || 'user'} colorClass={ROLE_COLORS[viewUser.role] || ROLE_COLORS.user} />],
                ['Plan',      <Badge key="p" label={viewUser.plan_name || 'Free'} colorClass={PLAN_COLORS[viewUser.plan_slug] || PLAN_COLORS.free} />],
                ['Paid Subs', <span key="ps" className="text-sm font-black text-primary-400">{viewUser.paid_subs || 0}</span>],
                ['Joined',    <span key="j" className="text-xs font-semibold text-gray-500">{viewUser.created_at ? format(new Date(viewUser.created_at), 'MMM d, yyyy') : '—'}</span>],
              ].map(([label, val]) => (
                <div key={label} className="p-3 rounded-xl bg-black/5 dark:bg-white/[0.03] border border-black/10 dark:border-white/5">
                  <p className="text-xs font-black text-gray-500 uppercase tracking-widest mb-1.5">{label}</p>
                  {val}
                </div>
              ))}
            </div>

            {/* Subscription history */}
            <div>
              <p className="text-xs font-black text-gray-500 uppercase tracking-widest mb-3">Subscription History</p>
              {userDetailLoading ? (
                <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" /></div>
              ) : (userDetail?.subscriptions || []).length === 0 ? (
                <div className="py-8 text-center text-xs font-black text-gray-500 uppercase tracking-widest">No subscriptions yet</div>
              ) : (
                <div className="space-y-2">
                  {(userDetail?.subscriptions || []).map(s => (
                    <div key={s.id} className="flex items-center justify-between p-3 rounded-xl bg-black/5 dark:bg-white/[0.03] border border-black/10 dark:border-white/5">
                      <div>
                        <p className="text-sm font-black dark:text-white text-gray-900">{s.plan_name}</p>
                        <p className="text-xs font-semibold text-gray-500 mt-0.5">
                          {s.created_at ? format(new Date(s.created_at), 'MMM d, yyyy') : '—'}
                          {s.expires_at ? ` → ${format(new Date(s.expires_at), 'MMM d, yyyy')}` : ''}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-black text-primary-400">{s.amount_paid === 0 ? 'Free' : inr(s.amount_paid)}</p>
                        <Badge label={s.status || 'active'} colorClass={STATUS_COLORS[s.status] || STATUS_COLORS.active} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Quick actions */}
            <div className="flex gap-3 pt-2 border-t dark:border-white/5 border-black/5">
              <button onClick={() => { setViewUser(null); setEditUser(viewUser); }}
                className="flex-1 py-2.5 text-xs font-black uppercase tracking-widest rounded-xl bg-primary-500/10 text-primary-400 hover:bg-primary-500/20 transition-all">
                Edit User
              </button>
              <button onClick={() => { setViewUser(null); setResetUser(viewUser); }}
                className="flex-1 py-2.5 text-xs font-black uppercase tracking-widest rounded-xl bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-all">
                Reset Password
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
