import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../api/axios';
import toast from 'react-hot-toast';
import EmailBuilder, { defaultBlock, toFullHtml, parseHtmlToBlocks } from '../components/EmailBuilder';

export default function TemplateEditor() {
  const { id }   = useParams();
  const navigate = useNavigate();
  const qc       = useQueryClient();
  const isEdit   = !!id;

  const [name,        setName]        = useState('');
  const [subject,     setSubject]     = useState('');
  const [blocks,      setBlocks]      = useState([defaultBlock('text')]);
  const [globalStyle, setGlobalStyle] = useState({ emailBg: '#f4f4f8', containerBg: '#ffffff', fontFamily: 'Arial, Helvetica, sans-serif', maxWidth: '600', borderRadius: '16' });
  const [mode,        setMode]        = useState('visual');
  const [rawHtml,     setRawHtml]     = useState('');
  const [viewport,    setViewport]    = useState('desktop');
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [saving,      setSaving]      = useState(false);

  const { data: template, isLoading } = useQuery({
    queryKey: ['template', id],
    queryFn: () => api.get(`/templates/${id}`).then(r => r.data),
    enabled: isEdit,
  });

  useEffect(() => {
    if (!template) return;
    setName(template.name || '');
    setSubject(template.subject || '');
    const html = template.html_content || '';
    setRawHtml(html);

    // If template has saved blocks, restore them and open in Builder mode
    if (template.blocks_json) {
      try {
        const savedBlocks = JSON.parse(template.blocks_json);
        if (Array.isArray(savedBlocks) && savedBlocks.length > 0) {
          setBlocks(savedBlocks);
          setSelectedIdx(0);
          setMode('visual');
          return;
        }
      } catch (_) { /* malformed blocks_json, fall through */ }
    }

    // No blocks_json — try to parse HTML into blocks directly for Builder mode
    if (html) {
      const parsed = parseHtmlToBlocks(html);
      if (parsed && parsed.blocks.length > 0) {
        setBlocks(parsed.blocks);
        if (parsed.globalStyle) setGlobalStyle(g => ({ ...g, ...parsed.globalStyle }));
        setSelectedIdx(0);
        setMode('visual');
      } else {
        // Unrecognized HTML structure — fall back to Code mode
        setMode('html');
      }
    }
  }, [template]);

  const handleSave = async () => {
    if (!name.trim()) { toast.error('Template name is required'); return; }
    setSaving(true);

    let html_content;
    let blocks_json = null;

    if (mode === 'visual') {
      html_content = toFullHtml(blocks, globalStyle);
      blocks_json  = JSON.stringify(blocks);
    } else {
      html_content = rawHtml;
      // Keep existing blocks_json if switching back to code without touching builder
      if (template?.blocks_json) blocks_json = template.blocks_json;
    }

    try {
      if (isEdit) {
        await api.put(`/templates/${id}`, { name, subject, html_content, blocks_json });
        toast.success('Template updated');
      } else {
        await api.post('/templates', { name, subject, html_content, blocks_json });
        toast.success('Template created');
      }
      qc.invalidateQueries({ queryKey: ['templates'] });
      navigate('/templates');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="flex flex-col animate-fade-in" style={{ height: 'calc(100vh - 7rem)' }}>

      {/* ── Top Bar ── */}
      <div className="shrink-0 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 p-3 mb-4 glass rounded-2xl border-none shadow-lg">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <button onClick={() => navigate('/templates')} className="w-9 h-9 shrink-0 flex items-center justify-center rounded-xl bg-white/5 border border-white/10 text-gray-500 hover:text-primary-500 hover:border-primary-500/40 transition-all">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>
          </button>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Template name..." className="input-field w-36 sm:w-44 py-2 text-[11px] font-black tracking-widest uppercase shrink-0" />
          <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Subject line..." className="input-field flex-1 min-w-0 py-2 text-[11px]" />
        </div>
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap justify-end shrink-0">
          <button onClick={handleSave} disabled={saving} className="btn-primary py-2 px-5 shrink-0">
            {saving ? 'SAVING...' : isEdit ? 'UPDATE' : 'SAVE'}
          </button>
        </div>
      </div>

      {/* ── Builder ── */}
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
  );
}
