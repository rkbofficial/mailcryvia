import { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import toast from 'react-hot-toast';
import LoadingSpinner from '../components/LoadingSpinner';
import EmptyState from '../components/EmptyState';
import ConfirmModal from '../components/ConfirmModal';
import { format } from 'date-fns';
import { STARTER_TEMPLATES } from '../data/starterTemplates';

/* ─── Preview Modal ─────────────────────────────────────────────── */
function PreviewModal({ template, onClose, onEdit, onUse, isStarter }) {
  const [viewport, setViewport] = useState('desktop');
  const [iframeHeight, setIframeHeight] = useState(600);
  if (!template) return null;

  const switchViewport = (v) => { setViewport(v); setIframeHeight(600); };
  const handleLoad = (e) => {
    try {
      const doc = e.target.contentDocument || e.target.contentWindow?.document;
      if (doc) {
        if (doc.documentElement) doc.documentElement.style.overflowX = 'hidden';
        if (doc.body) doc.body.style.overflowX = 'hidden';
        setIframeHeight(Math.max(doc.documentElement?.scrollHeight || 0, doc.body?.scrollHeight || 0, 400));
      }
    } catch { setIframeHeight(2000); }
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999]">
      <div className="absolute inset-0 bg-[#0d0928]/88 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute inset-x-0 bottom-0 flex items-center justify-center p-2 sm:p-4" style={{ top: '80px' }} onClick={onClose}>
        <div className="relative w-full max-w-6xl flex flex-col card shadow-2xl animate-fade-in overflow-hidden"
          style={{ height: 'calc(100vh - 96px)', maxHeight: '90vh' }}
          onClick={e => e.stopPropagation()}>

          {/* Header */}
          <div className="flex items-center gap-3 px-4 sm:px-6 py-3 sm:py-4 border-b border-black/5 dark:border-white/[0.05] shrink-0">
            <div className="min-w-0 flex-1">
              <h2 className="text-xs sm:text-sm font-black dark:text-white text-gray-900 uppercase tracking-widest truncate">{template.name}</h2>
              {template.subject && (
                <p className="text-[10px] font-bold text-gray-500 mt-0.5 truncate hidden sm:block">Subject: {template.subject}</p>
              )}
            </div>
            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              <div className="flex bg-black/5 dark:bg-black/40 rounded-xl p-1 border border-black/10 dark:border-white/10">
                <button onClick={() => switchViewport('desktop')} title="Desktop"
                  className={`w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-lg transition-all ${viewport === 'desktop' ? 'bg-primary-500 text-white shadow' : 'text-gray-500 hover:text-primary-500'}`}>
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <rect x="2" y="4" width="20" height="14" rx="2" /><path d="M8 20h8m-4-2v2" strokeLinecap="round" />
                  </svg>
                </button>
                <button onClick={() => switchViewport('mobile')} title="Mobile"
                  className={`w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-lg transition-all ${viewport === 'mobile' ? 'bg-primary-500 text-white shadow' : 'text-gray-500 hover:text-primary-500'}`}>
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <rect x="7" y="2" width="10" height="20" rx="2" /><circle cx="12" cy="18" r="0.6" fill="currentColor" stroke="none" />
                  </svg>
                </button>
              </div>
              {isStarter ? (
                <button onClick={() => { onUse(template); onClose(); }} className="btn-primary py-1.5 sm:py-2 px-3 sm:px-4 text-[10px] sm:text-xs">
                  USE THIS
                </button>
              ) : (
                <button onClick={() => { onClose(); onEdit(template.id); }} className="btn-primary py-1.5 sm:py-2 px-3 sm:px-4 text-[10px] sm:text-xs">
                  EDIT
                </button>
              )}
              <button onClick={onClose} className="w-7 h-7 sm:w-9 sm:h-9 flex items-center justify-center rounded-xl bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-gray-500 transition-all shrink-0">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
          </div>

          {/* Preview */}
          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden bg-gray-100 dark:bg-black/50 custom-scrollbar">
            <div className={`flex justify-center min-h-full ${viewport === 'mobile' ? 'p-4 sm:p-6' : ''}`}>
              <div className="w-full transition-all duration-300" style={{ maxWidth: viewport === 'mobile' ? 'min(390px, 100%)' : '100%' }}>
                <iframe
                  key={viewport}
                  srcDoc={template.html_content || '<p style="text-align:center;padding:60px;color:#999;font-family:sans-serif;font-size:14px">No content</p>'}
                  title="template-preview"
                  onLoad={handleLoad}
                  className="w-full border-none bg-white block"
                  style={{ height: iframeHeight + 'px' }}
                  sandbox="allow-same-origin"
                />
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-4 sm:px-6 py-2.5 border-t border-black/5 dark:border-white/[0.05] shrink-0 flex items-center justify-between">
            <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">
              {isStarter ? 'Starter Template' : `Created ${format(new Date(template.created_at), 'MMM d, yyyy')}`}
            </span>
            <span className="text-[9px] font-bold text-gray-400 uppercase">
              {viewport === 'mobile' ? '390px — Mobile' : 'Full Width — Desktop'}
            </span>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

/* ─── Starter Template Card ─────────────────────────────────────── */
function StarterCard({ template, accent, onPreview, onUse, loading }) {
  return (
    <div className="card overflow-hidden hover:border-primary-500/50 transition-all group relative flex flex-col">
      <div className="absolute inset-0 tech-grid opacity-5 pointer-events-none" />

      {/* Thumbnail */}
      <div
        className="h-44 bg-white dark:bg-black/40 relative overflow-hidden border-b border-black/5 dark:border-white/[0.02] flex-shrink-0 cursor-pointer"
        onClick={() => onPreview(template)}
      >
        <iframe
          srcDoc={template.html_content}
          title={`starter-${template.name}`}
          className="w-[285%] h-[285%] border-none pointer-events-none opacity-85 group-hover:opacity-100 transition-opacity duration-500"
          style={{ transform: 'scale(0.35)', transformOrigin: 'top left', position: 'absolute', top: 0, left: 0 }}
          sandbox="allow-same-origin"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/5 pointer-events-none" />
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20">
          <div className="flex items-center gap-2 bg-black/70 backdrop-blur-sm text-white px-4 py-2 rounded-xl">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
            <span className="text-[10px] font-black uppercase tracking-widest">Preview</span>
          </div>
        </div>
      </div>

      <div className="p-4 relative z-10 flex flex-col flex-1 gap-1">
        <h3 className="text-[11px] font-black dark:text-white text-gray-900 uppercase tracking-wider group-hover:text-primary-500 transition-colors truncate">
          {template.name}
        </h3>
        <p className="text-[9px] font-bold text-gray-500 truncate" title={template.subject}>
          {template.subject}
        </p>
        <div className="mt-auto pt-3 border-t border-black/5 dark:border-white/[0.06]">
          <button
            className="w-full btn-primary py-2.5 text-[10px] disabled:opacity-50 shadow-primary-500/30"
            onClick={() => onUse(template)}
            disabled={loading}
          >
            {loading ? 'SAVING...' : 'USE THIS TEMPLATE'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Starter Templates Section ─────────────────────────────────── */
function StarterSection({ onTemplateUsed }) {
  const qc = useQueryClient();
  const [activeCategory, setActiveCategory] = useState('All');
  const [previewTarget, setPreviewTarget] = useState(null);
  const [loadingKey, setLoadingKey] = useState(null);
  const tabsRef = useRef(null);
  const dragState = useRef({ dragging: false, startX: 0, scrollLeft: 0, moved: false });

  const onTabsMouseDown = (e) => {
    const el = tabsRef.current;
    if (!el) return;
    dragState.current = { dragging: true, startX: e.pageX - el.offsetLeft, scrollLeft: el.scrollLeft, moved: false };
    el.style.cursor = 'grabbing';
  };
  const onTabsMouseMove = (e) => {
    const ds = dragState.current;
    if (!ds.dragging) return;
    const el = tabsRef.current;
    const dx = e.pageX - el.offsetLeft - ds.startX;
    if (Math.abs(dx) > 4) ds.moved = true;
    el.scrollLeft = ds.scrollLeft - dx;
  };
  const onTabsMouseUp = () => {
    dragState.current.dragging = false;
    if (tabsRef.current) tabsRef.current.style.cursor = 'grab';
  };

  const useMut = useMutation({
    mutationFn: (tpl) => api.post('/templates', { name: tpl.name, subject: tpl.subject, html_content: tpl.html_content }),
    onSuccess: (_, tpl) => {
      qc.invalidateQueries({ queryKey: ['templates'] });
      toast.success(`"${tpl.name}" added to your templates!`);
      setLoadingKey(null);
      if (onTemplateUsed) onTemplateUsed();
    },
    onError: (err) => {
      toast.error(err.response?.data?.error || 'Failed to add template');
      setLoadingKey(null);
    },
  });

  const handleUse = (tpl) => {
    const key = tpl.name;
    setLoadingKey(key);
    useMut.mutate(tpl);
  };

  const categories = ['All', ...STARTER_TEMPLATES.map(c => c.category)];
  const filtered = activeCategory === 'All'
    ? STARTER_TEMPLATES
    : STARTER_TEMPLATES.filter(c => c.category === activeCategory);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-black dark:text-white text-gray-900 uppercase tracking-[0.2em] border-l-4 border-primary-500 pl-4">
            Starter Templates
          </h2>
          <p className="text-[9px] font-bold text-gray-500 uppercase tracking-[0.2em] mt-1 pl-4">
            20 ready-to-use templates across 10 categories
          </p>
        </div>
      </div>

      {/* Category tabs — drag to scroll */}
      <div
        ref={tabsRef}
        className="flex gap-2 overflow-x-auto pb-1 flex-nowrap select-none"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', cursor: 'grab' }}
        onMouseDown={onTabsMouseDown}
        onMouseMove={onTabsMouseMove}
        onMouseUp={onTabsMouseUp}
        onMouseLeave={onTabsMouseUp}
      >
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => { if (!dragState.current.moved) setActiveCategory(cat); }}
            className={`px-3.5 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border whitespace-nowrap shrink-0 ${
              activeCategory === cat
                ? 'bg-primary-500 text-white border-primary-500 shadow-lg shadow-primary-500/25'
                : 'dark:bg-white/[0.05] bg-white/80 dark:text-gray-300 text-gray-600 dark:border-white/10 border-black/10 hover:border-primary-500/50 hover:text-primary-500 dark:hover:bg-primary-500/10 hover:bg-primary-50'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Templates grid */}
      {filtered.map(category => (
        <div key={category.category} className="space-y-4">
          {activeCategory === 'All' && (
            <div className="flex items-center gap-3">
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: `${category.accent}22`, color: category.accent }}
                dangerouslySetInnerHTML={{ __html: category.icon.replace('<svg ', '<svg width="16" height="16" ') }}
              />
              <span className="text-[10px] font-black uppercase tracking-[0.2em] dark:text-gray-300 text-gray-600">
                {category.category}
              </span>
              <div className="flex-1 h-px dark:bg-white/[0.05] bg-black/[0.05]" />
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {category.templates.map(tpl => (
              <StarterCard
                key={tpl.name}
                template={tpl}
                accent={category.accent}
                onPreview={setPreviewTarget}
                onUse={handleUse}
                loading={loadingKey === tpl.name}
              />
            ))}
          </div>
        </div>
      ))}

      <PreviewModal
        template={previewTarget}
        onClose={() => setPreviewTarget(null)}
        onUse={handleUse}
        isStarter
      />
    </div>
  );
}

/* ─── Main Page ─────────────────────────────────────────────────── */
export default function Templates() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [viewTarget, setViewTarget] = useState(null);
  const [showStarters, setShowStarters] = useState(true);

  const { data: templates, isLoading } = useQuery({
    queryKey: ['templates'],
    queryFn: () => api.get('/templates').then(r => r.data),
    refetchInterval: 60000,
  });

  const delMut = useMutation({
    mutationFn: (id) => api.delete(`/templates/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['templates'] });
      toast.success('Template deleted');
      setDeleteTarget(null);
    },
  });

  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="space-y-10 pb-24 animate-fade-in">

      {/* Page header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black dark:text-white text-gray-900 tracking-tight uppercase">Templates</h1>
          <p className="text-[10px] font-bold text-primary-500 uppercase tracking-[0.3em] mt-1">Reusable email templates</p>
        </div>
        <button className="btn-primary" onClick={() => navigate('/templates/new')}>CREATE TEMPLATE</button>
      </div>

      {/* ── Starter Templates ── */}
      <div className="card relative overflow-hidden dark:shadow-[0_8px_40px_rgba(109,40,217,0.18)]">
        <div className="absolute inset-0 tech-grid opacity-5 pointer-events-none" />
        <div className="relative z-10 p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-2 h-6 bg-primary-500 rounded-full" />
              <span className="text-[9px] font-black text-primary-500 uppercase tracking-[0.2em]">Ready to use</span>
            </div>
            <button
              onClick={() => setShowStarters(v => !v)}
              className="flex items-center gap-2 text-[9px] font-black text-gray-500 hover:text-primary-500 uppercase tracking-widest transition-colors"
            >
              {showStarters ? 'HIDE' : 'SHOW'}
              <svg className={`w-3 h-3 transition-transform ${showStarters ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
          {showStarters && (
            <StarterSection onTemplateUsed={() => {}} />
          )}
        </div>
      </div>

      {/* ── Your Templates ── */}
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-2 h-6 bg-violet-400 rounded-full" />
          <h2 className="text-sm font-black dark:text-white text-gray-900 uppercase tracking-[0.2em]">Your Templates</h2>
          {templates?.length > 0 && (
            <span className="px-2.5 py-0.5 rounded-lg bg-primary-500/10 text-primary-500 text-[9px] font-black uppercase tracking-widest">
              {templates.length}
            </span>
          )}
          <div className="flex-1 h-px dark:bg-white/[0.05] bg-black/[0.05]" />
        </div>

        {(!templates || templates.length === 0) ? (
          <EmptyState
            title="No Templates Yet"
            description="Create your own template or use a starter template above."
            action={() => navigate('/templates/new')}
            actionLabel="Create Template"
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {templates.map(t => (
              <div key={t.id} className="card overflow-hidden hover:border-primary-500/50 transition-all group relative flex flex-col">
                <div className="absolute inset-0 tech-grid opacity-5 pointer-events-none" />

                {/* Thumbnail */}
                <div
                  className="h-48 bg-white dark:bg-black/40 relative overflow-hidden border-b border-black/5 dark:border-white/[0.02] flex-shrink-0 cursor-pointer"
                  onClick={() => setViewTarget(t)}
                >
                  <iframe
                    srcDoc={t.html_content || '<p style="text-align:center;padding:40px;color:#999;font-size:24px;font-family:sans-serif;">No content</p>'}
                    title={`preview-${t.id}`}
                    className="w-[285%] h-[285%] border-none pointer-events-none opacity-80 group-hover:opacity-100 transition-opacity duration-500"
                    style={{ transform: 'scale(0.35)', transformOrigin: 'top left', position: 'absolute', top: 0, left: 0 }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/10 pointer-events-none" />
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20">
                    <div className="flex items-center gap-2 bg-black/70 backdrop-blur-sm text-white px-4 py-2 rounded-xl">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                      <span className="text-[10px] font-black uppercase tracking-widest">Preview</span>
                    </div>
                  </div>
                </div>

                <div className="p-6 relative z-10 flex flex-col flex-1">
                  <h3 className="text-sm font-black dark:text-white text-gray-900 uppercase tracking-widest group-hover:text-primary-500 transition-colors truncate">{t.name}</h3>
                  <p className="text-[10px] font-bold text-gray-500 mt-1 uppercase tracking-tighter truncate">Subject: {t.subject || 'No subject'}</p>

                  <div className="flex items-center justify-between mt-auto pt-5 border-t border-black/5 dark:border-white/[0.02]">
                    <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">{format(new Date(t.created_at), 'yyyy.MM.dd')}</span>
                    <div className="flex gap-4">
                      <button className="text-[10px] font-black text-gray-500 hover:text-primary-500 uppercase tracking-widest transition-colors" onClick={() => setViewTarget(t)}>View</button>
                      <button className="text-[10px] font-black text-primary-500 hover:text-primary-400 uppercase tracking-widest transition-colors" onClick={() => navigate(`/templates/${t.id}/edit`)}>Edit</button>
                      <button className="text-[10px] font-black text-red-500 hover:text-red-400 uppercase tracking-widest transition-colors" onClick={() => setDeleteTarget(t)}>Delete</button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <PreviewModal
        template={viewTarget}
        onClose={() => setViewTarget(null)}
        onEdit={(id) => navigate(`/templates/${id}/edit`)}
      />

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => delMut.mutate(deleteTarget?.id)}
        title="Delete Template?"
        message={`This permanently removes "${deleteTarget?.name}".`}
        confirmText="DELETE TEMPLATE"
        variant="danger"
      />
    </div>
  );
}
