import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/axios';
import toast from 'react-hot-toast';
import LoadingSpinner from '../components/LoadingSpinner';
import EmptyState from '../components/EmptyState';
import ConfirmModal from '../components/ConfirmModal';
import { useTheme } from '../context/ThemeContext';

const TRIGGER_LABELS = {
  contact_added_to_list: 'Contact Added to List',
  manual: 'Manual Trigger',
};

/* ─── CSS animations injected once into the modal ─── */
const FLOW_CSS = `
  @keyframes dashFlow    { to { stroke-dashoffset: -28; } }
  @keyframes dashFlowSlow{ to { stroke-dashoffset: -24; } }
  @keyframes glowPulse   { 0%,100%{opacity:.15} 50%{opacity:.55} }
  @keyframes nodeGlow    { 0%,100%{box-shadow:0 0 20px rgba(139,92,246,.15)} 50%{box-shadow:0 0 35px rgba(139,92,246,.35)} }
  @keyframes particleFade{ 0%{opacity:0} 10%{opacity:.9} 85%{opacity:.9} 100%{opacity:0} }
`;

/* ══════════════════════════════════════════════════════════════════
   BOARD COMPONENTS (used in the wide modal builder)
══════════════════════════════════════════════════════════════════ */

const CONN_RGB = {
  violet:  '139,92,246',
  amber:   '245,158,11',
  emerald: '16,185,129',
  blue:    '59,130,246',
};

/* 3-layer animated connector with glow + moving particle */
function BoardConnector({ fromKey = 'violet', toKey, active = true }) {
  const tk  = toKey || fromKey;
  const fRgb = CONN_RGB[fromKey];
  const tRgb = CONN_RGB[tk];
  const uid  = `${fromKey}_${tk}`;

  return (
    <div className="flex items-center shrink-0" style={{ width: 52 }}>
      <svg width="52" height="40" viewBox="0 0 52 40" overflow="visible" fill="none">
        <defs>
          <linearGradient id={`g_${uid}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%"   stopColor={`rgb(${fRgb})`} stopOpacity=".85" />
            <stop offset="100%" stopColor={`rgb(${tRgb})`} stopOpacity=".85" />
          </linearGradient>
          <filter id={`blur_${uid}`} x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="4" />
          </filter>
        </defs>

        {/* Layer 1 — wide glow trail */}
        <line x1="2" y1="20" x2="50" y2="20"
          stroke={`rgb(${fRgb})`} strokeWidth="10" strokeOpacity=".15"
          filter={`url(#blur_${uid})`}
          style={{ animation: active ? 'glowPulse 2.2s ease-in-out infinite' : 'none' }}
        />

        {/* Layer 2 — secondary glow */}
        <line x1="2" y1="20" x2="50" y2="20"
          stroke={`rgb(${tRgb})`} strokeWidth="4" strokeOpacity=".08"
          filter={`url(#blur_${uid})`}
        />

        {/* Layer 3 — static dim base */}
        <line x1="2" y1="20" x2="50" y2="20"
          stroke={`rgba(${fRgb},.2)`} strokeWidth="1" />

        {/* Layer 4 — animated dashes */}
        <line x1="2" y1="20" x2="50" y2="20"
          stroke={`url(#g_${uid})`} strokeWidth="2"
          strokeLinecap="round" strokeDasharray="6 4"
          style={{ animation: active ? 'dashFlow 1.3s linear infinite' : 'none' }}
        />

        {/* Arrowhead */}
        <path d="M 44 15 L 50 20 L 44 25"
          stroke={`rgb(${tRgb})`} strokeWidth="2.5"
          strokeLinecap="round" strokeLinejoin="round"
          opacity=".9"
        />

        {/* Moving particle dot */}
        {active && (
          <circle r="3" fill={`rgb(${tRgb})`}>
            <animateTransform attributeName="transform" type="translate"
              values="2,20; 50,20" dur="1.3s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0;1;1;0" dur="1.3s" repeatCount="indefinite" />
          </circle>
        )}
      </svg>
    </div>
  );
}

/* Terminal node (Start / End pills) */
function BoardTerminal({ type, isDark = true }) {
  if (type === 'start') return (
    <div className={`flex flex-col items-center gap-2 px-5 py-3.5 rounded-2xl border shrink-0 ${isDark ? 'bg-primary-500/15 border-primary-500/35' : 'bg-violet-100 border-violet-400/50'}`}
      style={{ boxShadow: isDark ? '0 0 28px rgba(139,92,246,.28)' : '0 0 18px rgba(139,92,246,.12)' }}>
      <span className={`w-3 h-3 rounded-full ${isDark ? 'bg-primary-400' : 'bg-primary-500'}`}
        style={{ boxShadow: isDark ? '0 0 10px rgba(139,92,246,1)' : '0 0 8px rgba(139,92,246,.6)', animation: 'glowPulse 2s ease-in-out infinite' }} />
      <span className={`text-[10px] font-black uppercase tracking-[0.32em] ${isDark ? 'text-primary-300' : 'text-primary-600'}`}>Start</span>
    </div>
  );
  return (
    <div className={`flex flex-col items-center gap-2 px-5 py-3.5 rounded-2xl border shrink-0 ${isDark ? 'bg-violet-500/15 border-violet-500/35' : 'bg-violet-100 border-violet-400/50'}`}
      style={{ boxShadow: isDark ? '0 0 22px rgba(139,92,246,.22)' : '0 0 16px rgba(139,92,246,.10)' }}>
      <svg className={`w-4 h-4 ${isDark ? 'text-violet-400' : 'text-violet-600'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
      <span className={`text-[10px] font-black uppercase tracking-[0.32em] ${isDark ? 'text-violet-300' : 'text-violet-600'}`}>End</span>
    </div>
  );
}

const getBoardNodeTheme = d => ({
  trigger: {
    border: d ? 'border-violet-500/45'  : 'border-violet-400/60',
    selBorder: d ? 'border-violet-400/80' : 'border-violet-500',
    bg: d ? 'bg-violet-950/70' : 'bg-violet-50',
    bar: 'bg-gradient-to-r from-violet-500 to-violet-600',
    iconBg: 'bg-gradient-to-br from-violet-500 to-violet-700',
    step: d ? 'text-violet-400' : 'text-violet-600',
    title: d ? 'text-white' : 'text-gray-900',
    detail: d ? 'text-white/45' : 'text-violet-600/70',
    edit: d ? 'text-white/20' : 'text-gray-400',
    ring: d ? 'ring-white/10' : 'ring-violet-300/40',
    glow: d ? '0 4px 22px rgba(139,92,246,.18)' : '0 4px 18px rgba(139,92,246,.10)',
    selGlow: d ? '0 0 36px rgba(139,92,246,.45),0 4px 22px rgba(139,92,246,.2)' : '0 0 22px rgba(139,92,246,.22),0 4px 16px rgba(139,92,246,.14)',
  },
  wait: {
    border: d ? 'border-amber-500/45'  : 'border-amber-400/60',
    selBorder: d ? 'border-amber-400/80' : 'border-amber-500',
    bg: d ? 'bg-amber-950/60' : 'bg-amber-50',
    bar: 'bg-gradient-to-r from-amber-500 to-amber-600',
    iconBg: 'bg-gradient-to-br from-amber-500 to-amber-700',
    step: d ? 'text-amber-400' : 'text-amber-600',
    title: d ? 'text-white' : 'text-gray-900',
    detail: d ? 'text-white/45' : 'text-amber-700/70',
    edit: d ? 'text-white/20' : 'text-gray-400',
    ring: d ? 'ring-white/10' : 'ring-amber-300/40',
    glow: d ? '0 4px 22px rgba(245,158,11,.12)' : '0 4px 18px rgba(245,158,11,.08)',
    selGlow: d ? '0 0 36px rgba(245,158,11,.4),0 4px 22px rgba(245,158,11,.18)' : '0 0 22px rgba(245,158,11,.22),0 4px 16px rgba(245,158,11,.12)',
  },
  send: {
    border: d ? 'border-emerald-500/45'  : 'border-emerald-400/60',
    selBorder: d ? 'border-emerald-400/80' : 'border-emerald-500',
    bg: d ? 'bg-emerald-950/60' : 'bg-emerald-50',
    bar: 'bg-gradient-to-r from-emerald-500 to-emerald-600',
    iconBg: 'bg-gradient-to-br from-emerald-600 to-emerald-800',
    step: d ? 'text-emerald-400' : 'text-emerald-600',
    title: d ? 'text-white' : 'text-gray-900',
    detail: d ? 'text-white/45' : 'text-emerald-700/70',
    edit: d ? 'text-white/20' : 'text-gray-400',
    ring: d ? 'ring-white/10' : 'ring-emerald-300/40',
    glow: d ? '0 4px 22px rgba(16,185,129,.12)' : '0 4px 18px rgba(16,185,129,.08)',
    selGlow: d ? '0 0 36px rgba(16,185,129,.4),0 4px 22px rgba(16,185,129,.18)' : '0 0 22px rgba(16,185,129,.22),0 4px 16px rgba(16,185,129,.12)',
  },
});

/* Clickable board node */
function BoardNode({ type, stepNum, title, subtitle, icon, selected, onClick, isDark = true }) {
  const t = getBoardNodeTheme(isDark)[type];
  return (
    <div
      onClick={onClick}
      className={`relative w-52 rounded-2xl border overflow-hidden cursor-pointer transition-all duration-300 shrink-0 select-none ${t.bg} ${selected ? t.selBorder : t.border}`}
      style={{ boxShadow: selected ? t.selGlow : t.glow }}
    >
      <div className={`h-[3px] w-full ${t.bar}`} />
      {selected && (
        <div className={`absolute inset-0 rounded-2xl ring-1 ring-inset pointer-events-none ${t.ring}`} />
      )}
      <div className="p-5">
        <div className="flex items-center gap-3 mb-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-white ${t.iconBg}`}>
            {icon}
          </div>
          <div>
            <div className={`text-[8px] font-black uppercase tracking-[0.22em] ${t.step}`}>Step {stepNum}</div>
            <div className={`text-[11px] font-black uppercase tracking-wide leading-tight ${t.title}`}>{title}</div>
          </div>
        </div>
        <div className={`text-[10px] font-medium leading-snug line-clamp-2 min-h-[2rem] ${t.detail}`}>
          {subtitle || <span className="italic opacity-50">Not configured</span>}
        </div>
        <div className={`mt-3 flex items-center gap-1.5 text-[8px] font-black uppercase tracking-widest transition-all ${selected ? t.step : t.edit}`}>
          {selected ? (
            <><span className="w-1 h-1 rounded-full bg-current animate-pulse" />Editing</>
          ) : (
            <><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>Click to edit</>
          )}
        </div>
      </div>
    </div>
  );
}

/* Slide-up config panel for whichever node is selected */
function NodeConfigPanel({ step, form, setForm, templates, lists, isDark = true }) {
  const theme = {
    trigger: { dot: 'bg-violet-400', label: isDark ? 'text-violet-400' : 'text-violet-600' },
    wait:    { dot: 'bg-amber-400',  label: isDark ? 'text-amber-400'  : 'text-amber-600'  },
    send:    { dot: 'bg-emerald-400',label: isDark ? 'text-emerald-400': 'text-emerald-600'},
  }[step];
  const stepNames = { trigger: 'Trigger — Entry Event', wait: 'Wait / Delay — Timer', send: 'Send Email — Action' };

  return (
    <div
      className={`border-t ${isDark ? 'border-white/[0.06]' : 'border-violet-200/60'}`}
      style={{ background: isDark ? 'rgba(6,3,20,.95)' : 'rgba(248,245,255,.97)' }}
    >
      <div className="flex items-center gap-2.5 px-8 pt-5 pb-4">
        <span className={`w-2 h-2 rounded-full ${theme.dot}`} />
        <span className={`text-[10px] font-black uppercase tracking-[0.28em] ${theme.label}`}>
          {stepNames[step]}
        </span>
        <span className={`ml-auto text-[9px] uppercase tracking-widest ${isDark ? 'text-gray-600' : 'text-gray-500'}`}>Configure this step</span>
      </div>

      <div className="px-8 pb-7">
        {step === 'trigger' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className={`text-[10px] font-black uppercase tracking-widest mb-2 block ${isDark ? 'text-gray-500' : 'text-gray-600'}`}>Trigger Event</label>
              <select value={form.trigger_type} onChange={e => setForm({ ...form, trigger_type: e.target.value })} className={`input-field ${isDark ? 'bg-black/50' : 'bg-white/80'}`}>
                <option value="contact_added_to_list">Contact is added to a list</option>
                <option value="manual">Manual trigger</option>
              </select>
              <p className={`text-[9px] mt-2 ${isDark ? 'text-gray-600' : 'text-gray-500'}`}>This event starts the workflow for each matching contact.</p>
            </div>
          </div>
        )}

        {step === 'wait' && (
          <div className="flex flex-wrap items-start gap-6">
            <div>
              <label className={`text-[10px] font-black uppercase tracking-widest mb-2 block ${isDark ? 'text-gray-500' : 'text-gray-600'}`}>Delay</label>
              <div className="flex items-center gap-3">
                <input
                  type="number" min="0"
                  value={form.delay_days}
                  onChange={e => setForm({ ...form, delay_days: parseInt(e.target.value) || 0 })}
                  className="input-field w-28 text-center text-2xl font-black"
                />
                <span className={`text-sm font-bold ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{form.delay_days === 1 ? 'day' : 'days'} after trigger</span>
              </div>
            </div>
            <div className={`flex items-center gap-2 px-4 py-3 rounded-xl border text-[10px] font-bold mt-8 ${form.delay_days === 0 ? 'bg-amber-500/10 border-amber-500/20 text-amber-500' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600'}`}>
              {form.delay_days === 0 ? '⚡ Sends immediately on trigger' : `⏱ Waits ${form.delay_days} ${form.delay_days === 1 ? 'day' : 'days'} before sending`}
            </div>
          </div>
        )}

        {step === 'send' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className={`text-[10px] font-black uppercase tracking-widest mb-2 block ${isDark ? 'text-gray-500' : 'text-gray-600'}`}>Email Template</label>
              <select value={form.template_id} onChange={e => setForm({ ...form, template_id: e.target.value })} className={`input-field ${isDark ? 'bg-black/50' : 'bg-white/80'}`}>
                <option value="">Select a template...</option>
                {(templates || []).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label className={`text-[10px] font-black uppercase tracking-widest mb-2 block ${isDark ? 'text-gray-500' : 'text-gray-600'}`}>Send To List</label>
              <select value={form.list_id} onChange={e => setForm({ ...form, list_id: e.target.value })} className={`input-field ${isDark ? 'bg-black/50' : 'bg-white/80'}`}>
                <option value="">Select a list...</option>
                {(lists || []).map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   CARD LIST COMPONENTS (unchanged from before)
══════════════════════════════════════════════════════════════════ */
const CANVAS_THEMES = {
  start:   { header: 'bg-gradient-to-br from-primary-600 to-primary-700', border: 'border-primary-500/40', body: 'bg-primary-950/60', badge: 'bg-primary-500/25 text-primary-200 border-primary-400/30', glow: 'shadow-[0_4px_24px_rgba(139,92,246,.2)]' },
  trigger: { header: 'bg-gradient-to-br from-violet-600 to-violet-800',   border: 'border-violet-500/40',  body: 'bg-violet-950/50',  badge: 'bg-violet-500/20  text-violet-200  border-violet-400/30',  glow: 'shadow-[0_4px_24px_rgba(139,92,246,.2)]' },
  wait:    { header: 'bg-gradient-to-br from-amber-600 to-amber-800',     border: 'border-amber-500/40',   body: 'bg-amber-950/40',   badge: 'bg-amber-500/20   text-amber-200   border-amber-400/30',   glow: 'shadow-[0_4px_24px_rgba(245,158,11,.15)]' },
  send:    { header: 'bg-gradient-to-br from-emerald-600 to-emerald-800', border: 'border-emerald-500/40', body: 'bg-emerald-950/40', badge: 'bg-emerald-500/20 text-emerald-200 border-emerald-400/30', glow: 'shadow-[0_4px_24px_rgba(16,185,129,.15)]' },
  end:     { header: 'bg-gradient-to-br from-slate-600 to-slate-800',     border: 'border-slate-500/40',   body: 'bg-slate-900/50',   badge: 'bg-slate-500/20   text-slate-300   border-slate-400/30',   glow: 'shadow-[0_4px_24px_rgba(100,116,139,.15)]' },
};
function CanvasNode({ type, icon, label, title, detail, badge }) {
  const t = CANVAS_THEMES[type];
  return (
    <div className={`w-44 rounded-2xl border overflow-hidden shrink-0 ${t.border} ${t.glow}`}>
      <div className={`flex items-center gap-2.5 px-3.5 py-3 ${t.header}`}>
        <div className="w-8 h-8 rounded-xl bg-white/15 flex items-center justify-center shrink-0 text-white">{icon}</div>
        <div className="min-w-0">
          <div className="text-[8px] font-black text-white/55 uppercase tracking-[0.22em] truncate">{label}</div>
          <div className="text-[11px] font-black text-white uppercase tracking-wide leading-tight truncate">{title}</div>
        </div>
      </div>
      <div className={`px-3.5 py-3 min-h-[3.5rem] ${t.body}`}>
        {detail && <div className="text-[10px] font-semibold text-white/65 leading-snug mb-2 line-clamp-2">{detail}</div>}
        {badge && <span className={`inline-flex items-center text-[8px] font-black uppercase tracking-wide px-2 py-0.5 rounded-full border ${t.badge}`}>{badge}</span>}
      </div>
    </div>
  );
}
function CanvasArrow({ fromType }) {
  const cs = { start: '139,92,246', trigger: '139,92,246', wait: '245,158,11', send: '16,185,129', end: '100,116,139' };
  const c = cs[fromType] || '255,255,255';
  return (
    <div className="flex items-center shrink-0 px-1.5">
      <div className="w-8 h-px" style={{ background: `rgb(${c},.35)` }} />
      <svg className="w-3 h-3 -ml-0.5" viewBox="0 0 12 12" fill="none">
        <path d="M10 6L4 2v8z" fill={`rgb(${c},.4)`} />
      </svg>
    </div>
  );
}
function AutomationCard({ automation: a, onEdit, onDelete, onToggle, isDark = true }) {
  return (
    <div className="card border-none shadow-2xl relative overflow-hidden">
      <div className={`absolute top-0 left-0 right-0 h-[2px] ${a.active ? 'bg-gradient-to-r from-emerald-500/0 via-emerald-500 to-emerald-500/0' : 'bg-gradient-to-r from-gray-600/0 via-gray-600 to-gray-600/0'}`} />
      <div className="absolute inset-0 tech-grid opacity-[0.07] pointer-events-none" />
      <div className="relative z-10 p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4 mb-5">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${a.active ? 'bg-emerald-500 shadow-[0_0_8px_rgba(52,211,153,.6)]' : 'bg-gray-600'}`} />
            <div className="min-w-0">
              <h3 className="text-sm font-black dark:text-white text-gray-900 uppercase tracking-wider truncate">{a.name}</h3>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={`text-[9px] font-black uppercase tracking-widest ${a.active ? 'text-emerald-500' : 'text-gray-500'}`}>{a.active ? '● Running' : '○ Paused'}</span>
                <span className="text-gray-700 text-[9px]">·</span>
                <span className="text-[9px] text-gray-500 uppercase tracking-widest">{TRIGGER_LABELS[a.trigger_type] || a.trigger_type}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={onToggle} className={`btn-sm ${a.active ? 'bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500 hover:text-white' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500 hover:text-white'}`}>{a.active ? 'Pause' : 'Resume'}</button>
            <button onClick={onEdit} className="btn-sm-primary">Edit</button>
            <button onClick={onDelete} className="btn-sm-danger">Delete</button>
          </div>
        </div>
        <div className={`rounded-2xl border overflow-hidden ${isDark ? 'border-white/[0.06]' : 'border-violet-200/60'}`}
          style={{ background: isDark ? 'radial-gradient(rgba(255,255,255,.04) 1px, transparent 1px)' : 'radial-gradient(rgba(109,40,217,.06) 1px, transparent 1px)', backgroundSize: '22px 22px', backgroundColor: isDark ? 'rgba(0,0,0,.25)' : 'rgba(248,245,255,.70)' }}>
          <div className="overflow-x-auto py-6 px-5">
            <div className="flex items-center gap-0 w-max mx-auto">
              <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-primary-500/15 border border-primary-500/30 mr-3 shrink-0"><span className="w-1.5 h-1.5 rounded-full bg-primary-400 shadow-[0_0_5px_rgba(139,92,246,.8)]" /><span className="text-[9px] font-black text-primary-300 uppercase tracking-[0.3em]">Start</span></div>
              <CanvasArrow fromType="start" />
              <CanvasNode type="trigger" label="Trigger" title="Entry Point" detail={TRIGGER_LABELS[a.trigger_type]} badge="Event" icon={<svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>} />
              <CanvasArrow fromType="trigger" />
              <CanvasNode type="wait" label="Wait" title="Delay Timer" detail={`Wait ${a.delay_days} ${a.delay_days===1?'day':'days'} after trigger`} badge={`${a.delay_days}d`} icon={<svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="10"/><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2"/></svg>} />
              <CanvasArrow fromType="wait" />
              <CanvasNode type="send" label="Send Email" title="Email Action" detail={a.template_name || 'No template'} badge={a.list_name ? `→ ${a.list_name}` : '—'} icon={<svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>} />
              <CanvasArrow fromType="send" />
              <CanvasNode type="end" label="End" title="Workflow" detail="Automation complete" badge="Done" icon={<svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>} />
            </div>
          </div>
          <div className={`flex items-center justify-between px-5 py-2.5 border-t ${isDark ? 'border-white/[0.05] bg-black/20' : 'border-violet-200/50 bg-violet-50/60'}`}>
            <span className={`text-[9px] font-black uppercase tracking-widest ${isDark ? 'text-gray-600' : 'text-gray-500'}`}>3 Steps · Linear Flow</span>
            <div className={`flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest ${a.active ? 'text-emerald-500' : isDark ? 'text-gray-500' : 'text-gray-400'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${a.active ? 'bg-emerald-500 animate-pulse' : 'bg-gray-400'}`} />
              {a.active ? 'Running' : 'Paused'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   MAIN
══════════════════════════════════════════════════════════════════ */
export default function Automations() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const qc = useQueryClient();
  const [showForm, setShowForm]         = useState(false);
  const [editItem, setEditItem]         = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [selectedStep, setSelectedStep] = useState(null); // 'trigger' | 'wait' | 'send'
  const [form, setForm] = useState({ name: '', trigger_type: 'contact_added_to_list', delay_days: 0, template_id: '', list_id: '', active: true });

  const { data: automations, isLoading } = useQuery({ queryKey: ['automations'], queryFn: () => api.get('/automations').then(r => r.data), refetchInterval: 30000 });
  const { data: templates } = useQuery({ queryKey: ['templates'], queryFn: () => api.get('/templates').then(r => r.data) });
  const { data: lists }     = useQuery({ queryKey: ['lists'],     queryFn: () => api.get('/lists').then(r => r.data) });

  const saveMut = useMutation({
    mutationFn: d => editItem ? api.put(`/automations/${editItem.id}`, d) : api.post('/automations', d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['automations'] }); toast.success('Workflow Saved'); closeForm(); },
    onError:   e  => toast.error(e.response?.data?.error || 'Save Failed'),
  });
  const toggleMut = useMutation({ mutationFn: id => api.post(`/automations/${id}/toggle`), onSuccess: () => qc.invalidateQueries({ queryKey: ['automations'] }), onError: (e) => toast.error(e.response?.data?.error || 'Failed to toggle workflow') });
  const delMut    = useMutation({
    mutationFn: id => api.delete(`/automations/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['automations'] }); toast.success('Workflow Deleted'); setDeleteTarget(null); },
  });

  const openEdit = a => {
    setEditItem(a);
    setForm({ name: a.name, trigger_type: a.trigger_type, delay_days: a.delay_days, template_id: String(a.template_id || ''), list_id: String(a.list_id || ''), active: !!a.active });
    setSelectedStep(null);
    setShowForm(true);
  };
  const closeForm = () => { setShowForm(false); setEditItem(null); setSelectedStep(null); setForm({ name: '', trigger_type: 'contact_added_to_list', delay_days: 0, template_id: '', list_id: '', active: true }); };
  const handleSave = () => {
    if (!form.name.trim()) return toast.error('Workflow name is required');
    saveMut.mutate({ ...form, template_id: form.template_id ? parseInt(form.template_id) : null, list_id: form.list_id ? parseInt(form.list_id) : null });
  };

  if (isLoading) return <LoadingSpinner />;

  const totalActive = automations?.filter(a => a.active).length ?? 0;
  const totalPaused = automations?.filter(a => !a.active).length ?? 0;

  /* ── node preview labels for the board ── */
  const triggerPreview = TRIGGER_LABELS[form.trigger_type] || form.trigger_type;
  const waitPreview    = form.delay_days === 0 ? 'Immediately on trigger' : `${form.delay_days} ${form.delay_days===1?'day':'days'} after trigger`;
  const tplName        = templates?.find(t => t.id === parseInt(form.template_id))?.name;
  const listName       = lists?.find(l => l.id === parseInt(form.list_id))?.name;
  const sendPreview    = tplName ? `${tplName}${listName ? ` → ${listName}` : ''}` : null;

  return (
    <div className="space-y-8 pb-24 animate-fade-in">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black dark:text-white text-gray-900 tracking-tight uppercase">Email Automation</h1>
          <p className="text-[10px] font-bold text-primary-500 uppercase tracking-[0.3em] mt-1">Workflow Builder</p>
        </div>
        <div className="flex items-center gap-3">
          {automations?.length > 0 && (
            <>
              <div className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /><span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">{totalActive} Active</span></div>
              <div className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-500/10 border border-gray-500/20"><span className="w-1.5 h-1.5 rounded-full bg-gray-500" /><span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{totalPaused} Paused</span></div>
            </>
          )}
          <button className="btn-primary" onClick={() => { setEditItem(null); setShowForm(true); }}>+ New Workflow</button>
        </div>
      </div>

      {/* Stats chips */}
      {automations?.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total Workflows', value: automations.length,      icon: '⚡', from: 'from-primary-600/20', border: 'border-primary-500/20', text: 'text-primary-400' },
            { label: 'Active',          value: totalActive,             icon: '●',  from: 'from-emerald-600/20',  border: 'border-emerald-500/20', text: 'text-emerald-400' },
            { label: 'Paused',          value: totalPaused,             icon: '○',  from: 'from-gray-600/20',     border: 'border-gray-500/20',    text: 'text-gray-400' },
            { label: 'Workflow Steps',  value: automations.length * 3,  icon: '→',  from: 'from-amber-600/20',    border: 'border-amber-500/20',   text: 'text-amber-400' },
          ].map(s => (
            <div key={s.label} className={`relative overflow-hidden rounded-2xl border bg-gradient-to-br ${s.from} to-transparent ${s.border} p-4`}>
              <div className="absolute top-3 right-3 text-base opacity-25">{s.icon}</div>
              <div className={`text-2xl font-black ${s.text}`}>{s.value}</div>
              <div className="text-[9px] font-black text-gray-500 uppercase tracking-widest mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* List */}
      {(!automations || automations.length === 0) ? (
        <EmptyState title="No Workflows Yet" description="Build powerful email automation flows with a visual board builder." action={() => setShowForm(true)} actionLabel="Create First Workflow" />
      ) : (
        <div className="space-y-5">
          {automations.map(a => <AutomationCard key={a.id} automation={a} onEdit={() => openEdit(a)} onDelete={() => setDeleteTarget(a)} onToggle={() => toggleMut.mutate(a.id)} isDark={isDark} />)}
        </div>
      )}

      {/* ══════════════ WIDE BOARD BUILDER MODAL ══════════════ */}
      {showForm && (
        <div className="fixed inset-0 z-[9999] flex flex-col animate-fade-in"
          style={{
            background: isDark ? '#06030f' : '#faf9ff',
            boxShadow: isDark
              ? 'inset 0 0 0 1px rgba(139,92,246,.12), inset 0 0 80px rgba(139,92,246,.04)'
              : 'inset 0 0 0 1px rgba(109,40,217,.14), inset 0 0 80px rgba(109,40,217,.05)',
          }}
        >
          <style dangerouslySetInnerHTML={{ __html: FLOW_CSS }} />

            {/* ── TOP BAR ── */}
            <div className="relative z-10 flex items-center gap-3 sm:gap-5 px-4 sm:px-7 py-4 sm:py-5 border-b shrink-0" style={{ borderColor: isDark ? 'rgba(255,255,255,.06)' : 'rgba(109,40,217,.12)' }}>
              <div className="shrink-0 hidden sm:block">
                <div className="text-[9px] font-black text-primary-500 uppercase tracking-[0.3em] mb-0.5">Workflow Builder</div>
                <div className={`text-base font-black uppercase tracking-tight ${isDark ? 'text-white' : 'text-gray-900'}`}>{editItem ? 'Edit Workflow' : 'New Workflow'}</div>
              </div>

              <div className="flex-1 min-w-0">
                <input
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="Enter workflow name..."
                  className="input-field w-full sm:max-w-xs text-sm"
                  autoFocus
                />
              </div>

              <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setForm({ ...form, active: !form.active })}
                  className={`flex items-center gap-2 px-2.5 sm:px-3 py-2 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all ${form.active ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500' : isDark ? 'bg-gray-700/20 border-gray-500/20 text-gray-500' : 'bg-gray-100 border-gray-300 text-gray-500'}`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${form.active ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,.8)]' : isDark ? 'bg-gray-600' : 'bg-gray-400'}`} />
                  <span className="hidden sm:inline">{form.active ? 'Active' : 'Paused'}</span>
                </button>
                <button onClick={closeForm} className={`hidden sm:block px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl border transition-all ${isDark ? 'text-gray-500 hover:text-white border-white/[0.08] hover:border-white/20' : 'text-gray-500 hover:text-gray-900 border-violet-200 hover:border-violet-400'}`}>
                  Cancel
                </button>
                <button onClick={handleSave} disabled={saveMut.isPending} className="btn-primary text-[10px] px-3 sm:px-4">
                  {saveMut.isPending ? 'Saving...' : <><span className="hidden sm:inline">Save Workflow</span><span className="sm:hidden">Save</span></>}
                </button>
                <button onClick={closeForm} className={`w-9 h-9 flex items-center justify-center rounded-xl border transition-all group ${isDark ? 'bg-white/5 border-white/[0.08] text-gray-500 hover:text-red-400 hover:border-red-400/40' : 'bg-violet-50 border-violet-200 text-gray-400 hover:text-red-500 hover:border-red-300'}`}>
                  <svg className="w-4 h-4 group-hover:rotate-90 transition-transform duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* ── CANVAS BOARD ── */}
            <div
              className="relative flex-1 overflow-hidden"
              style={{
                background: isDark
                  ? 'radial-gradient(rgba(139,92,246,.045) 1px, transparent 1px)'
                  : 'radial-gradient(rgba(109,40,217,.07) 1px, transparent 1px)',
                backgroundSize: '28px 28px',
                backgroundColor: isDark ? 'rgba(3,1,12,.97)' : '#f0ecff',
                minHeight: 240,
              }}
            >
              {/* hint text */}
              <div className="absolute top-3 inset-x-0 flex justify-center pointer-events-none select-none">
                <span className={`text-[9px] font-black uppercase tracking-[0.3em] ${isDark ? 'text-gray-700' : 'text-violet-400/60'}`}>
                  Click a node to configure it
                </span>
              </div>

              <div className="flex items-center justify-center min-h-full w-full">
              <div className="flex items-center gap-0 py-10 px-4 shrink-0">

                {/* START */}
                <BoardTerminal type="start" isDark={isDark} />

                <BoardConnector fromKey="violet" toKey="violet" active={form.active} />

                {/* TRIGGER NODE */}
                <BoardNode
                  type="trigger" stepNum="1" title="Trigger" subtitle={triggerPreview}
                  selected={selectedStep === 'trigger'}
                  onClick={() => setSelectedStep(s => s === 'trigger' ? null : 'trigger')}
                  isDark={isDark}
                  icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>}
                />

                <BoardConnector fromKey="violet" toKey="amber" active={form.active} />

                {/* WAIT NODE */}
                <BoardNode
                  type="wait" stepNum="2" title="Wait / Delay" subtitle={waitPreview}
                  selected={selectedStep === 'wait'}
                  onClick={() => setSelectedStep(s => s === 'wait' ? null : 'wait')}
                  isDark={isDark}
                  icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="10"/><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2"/></svg>}
                />

                <BoardConnector fromKey="amber" toKey="emerald" active={form.active} />

                {/* SEND EMAIL NODE */}
                <BoardNode
                  type="send" stepNum="3" title="Send Email" subtitle={sendPreview}
                  selected={selectedStep === 'send'}
                  onClick={() => setSelectedStep(s => s === 'send' ? null : 'send')}
                  isDark={isDark}
                  icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>}
                />

                <BoardConnector fromKey="emerald" toKey="violet" active={form.active} />

                {/* END */}
                <BoardTerminal type="end" isDark={isDark} />
              </div>
              </div>
            </div>

            {/* ── SLIDE-UP CONFIG PANEL ── */}
            <div style={{ maxHeight: selectedStep ? '240px' : '0', transition: 'max-height 0.35s cubic-bezier(0.4,0,0.2,1)', overflow: 'hidden' }}>
              {selectedStep && (
                <NodeConfigPanel step={selectedStep} form={form} setForm={setForm} templates={templates} lists={lists} isDark={isDark} />
              )}
            </div>

            {/* Bottom status bar */}
            <div className="relative z-10 flex items-center justify-between px-7 py-3 border-t text-[9px] font-black uppercase tracking-widest"
              style={{
                borderColor: isDark ? 'rgba(255,255,255,.05)' : 'rgba(109,40,217,.12)',
                background: isDark ? 'rgba(0,0,0,.4)' : 'rgba(248,245,255,.95)',
              }}
            >
              <div className={`flex items-center gap-4 ${isDark ? 'text-gray-700' : 'text-gray-500'}`}>
                <span>3 Nodes</span>
                <span>·</span>
                <span>Linear Flow</span>
                <span>·</span>
                <span>Trigger → Wait → Send</span>
              </div>
              <div className={isDark ? 'text-gray-600' : 'text-violet-500/60'}>{selectedStep ? `Editing: ${selectedStep}` : 'Select a node to configure'}</div>
            </div>
        </div>
      )}

      <ConfirmModal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={() => delMut.mutate(deleteTarget?.id)} title="Delete Workflow?" message={`Permanently remove "${deleteTarget?.name}"`} confirmText="DELETE" variant="danger" />
    </div>
  );
}
