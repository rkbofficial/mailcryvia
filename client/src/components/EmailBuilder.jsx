import { useState, useEffect, useRef, useCallback } from 'react';
import ToggleSwitch from './ToggleSwitch';

/* ─── Constants ──────────────────────────────────────────────────── */
export const MERGE_TAGS = [
  { tag: '{{first_name}}', label: 'First' },
  { tag: '{{last_name}}',  label: 'Last'  },
  { tag: '{{email}}',      label: 'Email' },
  { tag: '{{company}}',    label: 'Company' },
];

const FONT_FAMILIES = [
  { label: 'Arial',        value: 'Arial, Helvetica, sans-serif' },
  { label: 'Georgia',      value: 'Georgia, "Times New Roman", serif' },
  { label: 'Verdana',      value: 'Verdana, Geneva, sans-serif' },
  { label: 'Trebuchet MS', value: '"Trebuchet MS", sans-serif' },
  { label: 'Courier New',  value: '"Courier New", Courier, monospace' },
];

const SOCIAL_DEFAULTS = [
  { name: 'Twitter',   url: 'https://twitter.com',   color: '#1DA1F2', enabled: true  },
  { name: 'Facebook',  url: 'https://facebook.com',  color: '#1877F2', enabled: true  },
  { name: 'Instagram', url: 'https://instagram.com', color: '#E4405F', enabled: true  },
  { name: 'LinkedIn',  url: 'https://linkedin.com',  color: '#0A66C2', enabled: false },
  { name: 'YouTube',   url: 'https://youtube.com',   color: '#FF0000', enabled: false },
  { name: 'TikTok',    url: 'https://tiktok.com',    color: '#010101', enabled: false },
];

export const BLOCK_CATEGORIES = [
  {
    label: 'Layout', color: 'text-violet-400',
    blocks: [
      { type: 'hero',    label: 'Hero Banner', icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><rect x="2" y="4" width="20" height="16" rx="2"/><path strokeLinecap="round" d="M7 16l3-4 2 2 3-4 3 6"/><circle cx="8" cy="9" r="1" fill="currentColor" stroke="none"/></svg> },
      { type: 'columns', label: '2 Columns',   icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><rect x="2" y="4" width="9" height="16" rx="1.5"/><rect x="13" y="4" width="9" height="16" rx="1.5"/></svg> },
    ],
  },
  {
    label: 'Content', color: 'text-blue-400',
    blocks: [
      { type: 'text',   label: 'Text',   icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" d="M4 6h16M4 10h12M4 14h16M4 18h10"/></svg> },
      { type: 'image',  label: 'Image',  icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path strokeLinecap="round" d="M21 15l-5-5L5 21"/></svg> },
      { type: 'button', label: 'Button', icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><rect x="2" y="8" width="20" height="8" rx="3"/></svg> },
      { type: 'video',  label: 'Video',  icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.069A1 1 0 0121 8.87v6.26a1 1 0 01-1.447.899L15 14M4 8h9a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4a2 2 0 012-2z"/></svg> },
    ],
  },
  {
    label: 'Structure', color: 'text-emerald-400',
    blocks: [
      { type: 'social',   label: 'Social Icons', icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"/></svg> },
      { type: 'footer',   label: 'Footer',       icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" d="M4 18h16M4 14h10M4 10h16"/></svg> },
      { type: 'divider',  label: 'Divider',      icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" d="M3 12h18"/></svg> },
      { type: 'spacer',   label: 'Spacer',       icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" d="M12 4v4m0 8v4M4 12h4m8 0h4"/></svg> },
    ],
  },
];

/* ─── Default block data ─────────────────────────────────────────── */
export function defaultBlock(type) {
  switch (type) {
    case 'text':    return { type, content: '<p style="margin:0">Enter your text here...</p>', fontSize: '16', color: '#333333', bgColor: '', padding: '16', align: 'left', fontWeight: 'normal', fontFamily: '', lineHeight: '1.65' };
    case 'image':   return { type, src: 'https://placehold.co/600x200/8b5cf6/ffffff?text=Image', alt: '', width: '100', padding: '16', align: 'center', linkUrl: '', borderRadius: '4' };
    case 'button':  return { type, text: 'Click Here', url: 'https://', bgColor: '#8b5cf6', textColor: '#ffffff', fontSize: '14', borderRadius: '8', paddingV: '14', paddingH: '36', align: 'center', fullWidth: false, style: 'solid', uppercase: false };
    case 'hero':    return { type, title: 'Welcome to Our Newsletter', subtitle: 'The smarter way to reach your audience. Send beautiful emails that convert.', buttonText: 'Get Started', buttonUrl: 'https://', bgColor: '#8b5cf6', bgGradient: true, bgGradientEnd: '#6d28d9', bgImage: '', textColor: '#ffffff', buttonBgColor: '#ffffff', buttonTextColor: '#8b5cf6', paddingV: '60', align: 'center', fontSize: '32', subtitleSize: '16', showButton: true };
    case 'columns': return { type, col1: '<p style="margin:0;font-family:Arial,sans-serif">Left column content.</p>', col2: '<p style="margin:0;font-family:Arial,sans-serif">Right column content.</p>', col1BgColor: '', col2BgColor: '', bgColor: '', padding: '20', gap: '16', fontSize: '14', col1Color: '#333333', col2Color: '#333333', col1Ratio: '50' };
    case 'social':  return { type, platforms: JSON.parse(JSON.stringify(SOCIAL_DEFAULTS)), bgColor: '#f9fafb', padding: '24', iconSize: '40', style: 'circle', align: 'center', label: 'Follow us on social media', showLabel: true, labelColor: '#6b7280' };
    case 'footer':  return { type, company: 'Your Company Name', address: '123 Street, City, Country', unsubscribeText: 'Unsubscribe', unsubscribeUrl: '{{unsubscribe_url}}', bgColor: '#f3f4f6', textColor: '#9ca3af', fontSize: '12', padding: '32', year: new Date().getFullYear().toString(), showYear: true };
    case 'video':   return { type, thumbnailUrl: 'https://placehold.co/600x338/1a1a2e/8b5cf6?text=Play+Video', videoUrl: 'https://', alt: 'Watch Video', caption: '', padding: '16', align: 'center', borderRadius: '8', width: '100' };
    case 'divider': return { type, color: '#e5e7eb', thickness: '1', paddingV: '16', style: 'solid' };
    case 'spacer':   return { type, height: '24' };
    default: return { type };
  }
}

/* ─── Block → inline HTML ─────────────────────────────────────────── */
export function blockToHtml(b) {
  switch (b.type) {
    case 'text': {
      const ff = b.fontFamily || 'Arial,Helvetica,sans-serif';
      const bg = b.bgColor ? `background:${b.bgColor};` : '';
      return `<div style="${bg}padding:${b.padding||16}px;font-size:${b.fontSize||16}px;color:${b.color||'#333'};font-family:${ff};font-weight:${b.fontWeight||'normal'};text-align:${b.align||'left'};line-height:${b.lineHeight||1.65}">${b.content}</div>`;
    }
    case 'image': {
      const imgStyle = `max-width:${b.width||100}%;height:auto;display:inline-block;border-radius:${b.borderRadius||4}px`;
      const img = `<img src="${b.src}" alt="${b.alt||''}" style="${imgStyle}"/>`;
      const inner = b.linkUrl ? `<a href="${b.linkUrl}" style="display:inline-block">${img}</a>` : img;
      return `<div style="padding:${b.padding||16}px;text-align:${b.align||'center'}">${inner}</div>`;
    }
    case 'button': {
      const isSolid = (b.style || 'solid') === 'solid';
      const btnBg = isSolid ? `background:${b.bgColor||'#8b5cf6'};color:${b.textColor||'#fff'}` : `background:transparent;border:2px solid ${b.bgColor||'#8b5cf6'};color:${b.bgColor||'#8b5cf6'}`;
      const upper = b.uppercase ? 'text-transform:uppercase;' : '';
      const aStyle = `${b.fullWidth?'display:block;width:100%;box-sizing:border-box;text-align:center':'display:inline-block'};${btnBg};padding:${b.paddingV||14}px ${b.paddingH||36}px;border-radius:${b.borderRadius||8}px;text-decoration:none;font-weight:700;font-size:${b.fontSize||14}px;${upper}letter-spacing:0.06em;font-family:Arial,sans-serif`;
      const a = `<a href="${b.url||'#'}" style="${aStyle}">${b.text||'Click Here'}</a>`;
      return b.fullWidth
        ? `<div style="padding:8px 0">${a}</div>`
        : `<div style="padding:8px ${b.paddingH||36}px;text-align:${b.align||'center'}">${a}</div>`;
    }
    case 'hero': {
      const grad = b.bgGradient
        ? `background:linear-gradient(135deg,${b.bgColor||'#8b5cf6'},${b.bgGradientEnd||'#6d28d9'})`
        : `background:${b.bgColor||'#8b5cf6'}`;
      const bgImg = b.bgImage ? `;background-image:url(${b.bgImage});background-size:cover;background-position:center` : '';
      const btn = b.showButton && b.buttonText
        ? `<a href="${b.buttonUrl||'#'}" style="display:inline-block;background:${b.buttonBgColor||'#fff'};color:${b.buttonTextColor||'#8b5cf6'};padding:14px 36px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px;letter-spacing:0.04em;font-family:Arial,sans-serif">${b.buttonText}</a>`
        : '';
      const sub = b.subtitle
        ? `<p style="margin:0 0 ${btn?'28':'0'}px;color:${b.textColor||'#fff'};font-size:${b.subtitleSize||16}px;opacity:0.88;line-height:1.65;font-family:Arial,sans-serif">${b.subtitle}</p>`
        : '';
      return `<div style="${grad}${bgImg};padding:${b.paddingV||60}px 40px;text-align:${b.align||'center'}"><h1 style="margin:0 0 12px;color:${b.textColor||'#fff'};font-size:${b.fontSize||32}px;font-weight:800;line-height:1.2;font-family:Arial,sans-serif">${b.title||'Welcome'}</h1>${sub}${btn}</div>`;
    }
    case 'columns': {
      const r1 = parseInt(b.col1Ratio || 50);
      const r2 = 100 - r1;
      const bg = b.bgColor ? `background:${b.bgColor};` : '';
      const c1bg = b.col1BgColor ? `background:${b.col1BgColor};border-radius:4px;` : '';
      const c2bg = b.col2BgColor ? `background:${b.col2BgColor};border-radius:4px;` : '';
      const gap = Math.round((b.gap || 16) / 2);
      return `<div style="${bg}padding:${b.padding||20}px"><table class="two-col" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse"><tr><td width="${r1}%" style="${c1bg}vertical-align:top;padding-right:${gap}px;font-size:${b.fontSize||14}px;color:${b.col1Color||'#333'};font-family:Arial,sans-serif;line-height:1.65">${b.col1||'Column 1'}</td><td width="${r2}%" style="${c2bg}vertical-align:top;padding-left:${gap}px;font-size:${b.fontSize||14}px;color:${b.col2Color||'#333'};font-family:Arial,sans-serif;line-height:1.65">${b.col2||'Column 2'}</td></tr></table></div>`;
    }
    case 'social': {
      const enabled = (b.platforms || []).filter(p => p.enabled !== false);
      const size = parseInt(b.iconSize || 40);
      const btns = enabled.map(p => {
        const c = p.color || '#8b5cf6';
        if (b.style === 'pill') return `<a href="${p.url||'#'}" style="display:inline-block;background:${c};color:#fff;padding:8px 18px;border-radius:20px;text-decoration:none;font-size:12px;font-weight:700;font-family:Arial;margin:4px">${p.name}</a>`;
        if (b.style === 'square') return `<a href="${p.url||'#'}" style="display:inline-block;width:${size}px;height:${size}px;background:${c};color:#fff;border-radius:6px;text-decoration:none;font-size:13px;font-weight:900;font-family:Arial;margin:0 4px;text-align:center;line-height:${size}px">${p.name[0]}</a>`;
        return `<a href="${p.url||'#'}" style="display:inline-block;width:${size}px;height:${size}px;background:${c};color:#fff;border-radius:50%;text-decoration:none;font-size:13px;font-weight:900;font-family:Arial;margin:0 4px;text-align:center;line-height:${size}px">${p.name[0]}</a>`;
      }).join('');
      const lbl = b.showLabel && b.label ? `<p style="margin:0 0 14px;font-size:11px;color:${b.labelColor||'#6b7280'};font-family:Arial;font-weight:600;text-transform:uppercase;letter-spacing:0.12em">${b.label}</p>` : '';
      return `<div style="background:${b.bgColor||'#f9fafb'};padding:${b.padding||24}px;text-align:${b.align||'center'}">${lbl}${btns}</div>`;
    }
    case 'footer': {
      const yr = b.showYear ? ` © ${b.year || new Date().getFullYear()}` : '';
      const co = b.company ? `<p style="margin:0 0 4px;font-size:${b.fontSize||12}px;color:${b.textColor||'#9ca3af'};font-family:Arial;font-weight:700">${b.company}${yr}</p>` : '';
      const addr = b.address ? `<p style="margin:0 0 10px;font-size:${b.fontSize||12}px;color:${b.textColor||'#9ca3af'};font-family:Arial">${b.address}</p>` : '';
      return `<div style="background:${b.bgColor||'#f3f4f6'};padding:${b.padding||32}px;text-align:center">${co}${addr}<p style="margin:0;font-size:${b.fontSize||12}px;color:${b.textColor||'#9ca3af'};font-family:Arial">This email was sent to {{email}} &nbsp;&middot;&nbsp; <a href="${b.unsubscribeUrl||'{{unsubscribe_url}}'}" style="color:${b.textColor||'#9ca3af'};text-decoration:underline">${b.unsubscribeText||'Unsubscribe'}</a></p></div>`;
    }
    case 'video': {
      const cap = b.caption ? `<p style="margin:8px 0 0;font-size:12px;color:#9ca3af;font-family:Arial;text-align:center">${b.caption}</p>` : '';
      return `<div style="padding:${b.padding||16}px;text-align:${b.align||'center'}"><a href="${b.videoUrl||'#'}" style="display:inline-block;max-width:${b.width||100}%;border-radius:${b.borderRadius||8}px;overflow:hidden"><img src="${b.thumbnailUrl||''}" alt="${b.alt||'Watch Video'}" style="max-width:100%;height:auto;display:block;border-radius:${b.borderRadius||8}px"/></a>${cap}</div>`;
    }
    case 'divider':
      return `<div style="padding:${b.paddingV||16}px 0"><hr style="border:none;border-top:${b.thickness||1}px ${b.style||'solid'} ${b.color||'#e5e7eb'};margin:0"/></div>`;
    case 'spacer':
      return `<div style="height:${b.height||24}px"></div>`;
    default: return '';
  }
}

/* ─── Full email document ─────────────────────────────────────────── */
export function toFullHtml(blocks, gs = {}) {
  const emailBg     = gs.emailBg     || '#f4f4f8';
  const containerBg = gs.containerBg || '#ffffff';
  const fontFamily  = gs.fontFamily  || 'Arial, Helvetica, sans-serif';
  const maxW        = gs.maxWidth    || '600';
  const radius      = gs.borderRadius|| '16';
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;padding:16px;background:${emailBg};font-family:${fontFamily}}img{max-width:100%;height:auto}@media(max-width:600px){.two-col td{display:block!important;width:100%!important;padding:0 0 12px 0!important}}</style></head><body><div style="max-width:${maxW}px;margin:0 auto;background:${containerBg};border-radius:${radius}px;overflow:hidden;box-shadow:0 4px 32px rgba(0,0,0,0.1)">${blocks.map(blockToHtml).join('')}</div></body></html>`;
}

/* ─── HTML → Blocks parser ───────────────────────────────────────── */
function parseCss(styleStr) {
  const r = {};
  if (!styleStr) return r;
  styleStr.split(';').forEach(rule => {
    const colon = rule.indexOf(':');
    if (colon === -1) return;
    r[rule.slice(0, colon).trim()] = rule.slice(colon + 1).trim();
  });
  return r;
}

function extractPx(val, fallback = '0') {
  if (!val) return fallback;
  const m = String(val).match(/(\d+(?:\.\d+)?)/);
  return m ? m[1] : fallback;
}

function parseEl(el) {
  const style = el.getAttribute?.('style') || '';
  const css = parseCss(style);

  // ── Spacer: empty div with a height ───────────────────────────────
  if (el.children.length === 0 && !el.textContent.trim() && css['height']) {
    return { type: 'spacer', height: extractPx(css['height'], '24') };
  }

  // ── Divider: contains <hr> ─────────────────────────────────────────
  const hr = el.querySelector('hr');
  if (hr) {
    const hc = parseCss(hr.getAttribute('style') || '');
    const bt = hc['border-top'] || '1px solid #e5e7eb';
    const parts = bt.split(' ');
    return {
      type: 'divider',
      thickness: extractPx(parts[0], '1'),
      style: parts[1] || 'solid',
      color: parts[2] || '#e5e7eb',
      paddingV: extractPx(css['padding'], '16'),
    };
  }

  // ── Hero: contains <h1> ────────────────────────────────────────────
  const h1 = el.querySelector('h1');
  if (h1) {
    const p   = el.querySelector('p');
    const btn = el.querySelector('a');
    const h1c = parseCss(h1.getAttribute('style') || '');
    const pc  = parseCss(p?.getAttribute('style') || '');
    const bc  = parseCss(btn?.getAttribute('style') || '');
    const bg  = css['background'] || '';
    const isGrad = bg.includes('linear-gradient');
    let bgColor = '#8b5cf6', bgGradientEnd = '#6d28d9';
    if (isGrad) {
      const m = bg.match(/linear-gradient\([^,]*,\s*([^,]+),\s*([^)]+)\)/);
      if (m) { bgColor = m[1].trim(); bgGradientEnd = m[2].trim(); }
    } else {
      bgColor = bg || '#8b5cf6';
    }
    const padParts = (css['padding'] || '60px 40px').split(' ');
    return {
      type: 'hero',
      title: h1.textContent.trim(),
      subtitle: p?.textContent.trim() || '',
      buttonText: btn?.textContent.trim() || 'Get Started',
      buttonUrl: btn?.getAttribute('href') || 'https://',
      bgColor, bgGradient: isGrad, bgGradientEnd, bgImage: '',
      textColor: h1c['color'] || '#ffffff',
      buttonBgColor: bc['background'] || '#ffffff',
      buttonTextColor: bc['color'] || '#8b5cf6',
      paddingV: extractPx(padParts[0], '60'),
      align: css['text-align'] || 'center',
      fontSize: extractPx(h1c['font-size'], '32'),
      subtitleSize: extractPx(pc['font-size'], '16'),
      showButton: !!btn,
    };
  }

  // ── Footer: contains "unsubscribe" text ───────────────────────────
  if (el.innerHTML.toLowerCase().includes('unsubscribe')) {
    const ps = el.querySelectorAll('p');
    const tc = parseCss(ps[0]?.getAttribute('style') || '');
    return {
      type: 'footer',
      company: ps[0]?.firstChild?.textContent?.split('©')[0]?.trim() || 'Company',
      address: ps[1]?.textContent?.trim() || '',
      bgColor: css['background'] || '#f3f4f6',
      textColor: tc['color'] || '#9ca3af',
      fontSize: extractPx(tc['font-size'], '12'),
      padding: extractPx(css['padding'], '32'),
      unsubscribeText: 'Unsubscribe', unsubscribeUrl: '{{unsubscribe_url}}',
      showYear: true, year: new Date().getFullYear().toString(),
    };
  }

  // ── Button: single <a> element ────────────────────────────────────
  const links = el.querySelectorAll('a');
  if (links.length === 1 && el.children.length <= 2) {
    const a  = links[0];
    const ac = parseCss(a.getAttribute('style') || '');
    const bg = ac['background'] || '#8b5cf6';
    const isOutline = bg === 'transparent';
    return {
      type: 'button',
      text: a.textContent.trim() || 'Click Here',
      url: a.getAttribute('href') || 'https://',
      bgColor: isOutline ? (ac['border']?.split(' ').pop() || '#8b5cf6') : bg,
      textColor: ac['color'] || '#ffffff',
      fontSize: extractPx(ac['font-size'], '14'),
      borderRadius: extractPx(ac['border-radius'], '8'),
      paddingV: extractPx(ac['padding']?.split(' ')[0], '14'),
      paddingH: extractPx(ac['padding']?.split(' ')[1] || ac['padding'], '36'),
      align: css['text-align'] || 'center',
      style: isOutline ? 'outline' : 'solid',
      fullWidth: (ac['display'] || '').includes('block'),
      uppercase: (ac['text-transform'] || '') === 'uppercase',
    };
  }

  // ── Image: contains <img> ─────────────────────────────────────────
  const img = el.querySelector('img');
  if (img) {
    const lnk = el.querySelector('a');
    return {
      type: 'image',
      src: img.getAttribute('src') || '',
      alt: img.getAttribute('alt') || '',
      linkUrl: lnk?.getAttribute('href') || '',
      width: extractPx(parseCss(img.getAttribute('style') || '')['max-width'] || '100%', '100'),
      padding: extractPx(css['padding'], '16'),
      align: css['text-align'] || 'center',
      borderRadius: '4',
    };
  }

  // ── 2-column table ────────────────────────────────────────────────
  const tds = el.querySelectorAll('td');
  if (tds.length === 2) {
    const [td1, td2] = tds;
    const td1c = parseCss(td1.getAttribute('style') || '');
    return {
      type: 'columns',
      col1: td1.innerHTML,
      col2: td2.innerHTML,
      bgColor: css['background'] || '',
      col1BgColor: '', col2BgColor: '',
      padding: extractPx(css['padding'], '20'),
      gap: '16', fontSize: extractPx(td1c['font-size'], '14'),
      col1Color: td1c['color'] || '#333333',
      col2Color: parseCss(td2.getAttribute('style') || '')['color'] || '#333333',
      col1Ratio: '50',
    };
  }

  // ── Default: text block (preserve full HTML) ──────────────────────
  return {
    type: 'text',
    content: el.innerHTML,
    fontSize: extractPx(css['font-size'], '16'),
    color: css['color'] || '#333333',
    bgColor: css['background'] || '',
    padding: extractPx(css['padding'], '16'),
    align: css['text-align'] || 'left',
    fontWeight: css['font-weight'] || 'normal',
    fontFamily: '',
    lineHeight: css['line-height'] || '1.65',
  };
}

export function parseHtmlToBlocks(html) {
  if (!html || typeof document === 'undefined') return null;
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // Extract emailBg from <style> body rule
    const styleText = doc.querySelector('style')?.textContent || '';
    const bgM = styleText.match(/body\s*\{[^}]*background\s*:\s*([^;}\n]+)/);
    const emailBg = bgM ? bgM[1].trim() : '#f4f4f8';

    // Find the max-width wrapper container
    const body = doc.body;
    if (!body) return null;
    let container = [...body.children].find(el => {
      const s = el.getAttribute?.('style') || '';
      return s.includes('max-width') && el.tagName === 'DIV';
    });
    // If not found, treat the whole body as container
    if (!container) container = body;

    const cc = parseCss(container.getAttribute?.('style') || '');
    const containerBg = cc['background'] || '#ffffff';
    const maxWidth = extractPx(cc['max-width'], '600');
    const borderRadius = extractPx(cc['border-radius'], '16');
    const globalStyle = { emailBg, containerBg, fontFamily: 'Arial, Helvetica, sans-serif', maxWidth, borderRadius };

    const blocks = [...container.children].map(el => parseEl(el)).filter(Boolean);
    if (blocks.length === 0) return null;

    return { blocks, globalStyle };
  } catch (_) {
    return null;
  }
}

/* ─── Icons ───────────────────────────────────────────────────────── */
const IconDesktop = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><rect x="2" y="3" width="20" height="14" rx="2"/><path strokeLinecap="round" d="M8 21h8m-4-4v4"/></svg>;
const IconMobile  = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><rect x="7" y="2" width="10" height="20" rx="2"/><circle cx="12" cy="18" r="0.7" fill="currentColor" stroke="none"/></svg>;

/* ─── Small reusable UI helpers ───────────────────────────────────── */
const Toggle = ({ value, onChange, label }) => (
  <div className="flex items-center gap-2.5">
    <ToggleSwitch checked={value} onChange={onChange} size="sm" />
    {label && <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">{label}</span>}
  </div>
);

const ColorRow = ({ label, value, onChange, L }) => (
  <div>
    <label className={L}>{label}</label>
    <div className="flex items-center gap-2.5">
      <input type="color" value={value || '#ffffff'} onChange={e => onChange(e.target.value)} className="w-10 h-9 rounded-xl cursor-pointer border border-white/10 bg-transparent shrink-0" />
      <input value={value || ''} onChange={e => onChange(e.target.value)} className="input-field py-2 text-[10px] font-mono bg-black/20 flex-1 min-w-0" placeholder="#rrggbb" />
    </div>
  </div>
);

/* ═══════════════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════════════ */

/**
 * Props:
 *   blocks, setBlocks           — block array state (lifted to parent)
 *   globalStyle, setGlobalStyle — email wrapper style (lifted to parent)
 *   mode, setMode               — 'visual' | 'html'
 *   rawHtml, setRawHtml         — raw HTML string for code mode
 *   viewport, setViewport       — 'desktop' | 'mobile'
 *   selectedIdx, setSelectedIdx — which block is selected
 */
export default function EmailBuilder({
  blocks, setBlocks,
  globalStyle, setGlobalStyle,
  mode, setMode,
  rawHtml, setRawHtml,
  viewport, setViewport,
  selectedIdx, setSelectedIdx,
}) {
  const [mobileTab, setMobileTab]   = useState('edit');
  const [leftTab,   setLeftTab]     = useState('blocks');
  const [builderDirty, setBuilderDirty] = useState(false);
  const [iframeSrc, setIframeSrc]   = useState('');
  const debounce  = useRef(null);
  const canvasRef = useRef(null);
  const codeRef   = useRef(null);

  const scroll = (ref, dir) => ref.current?.scrollBy({ top: dir * 320, behavior: 'smooth' });

  const scheduleIframe = useCallback((html) => {
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => setIframeSrc(html), 250);
  }, []);

  useEffect(() => {
    if (mode === 'html') scheduleIframe(rawHtml);
    else scheduleIframe(toFullHtml(blocks, globalStyle));
  }, [mode, rawHtml, blocks, globalStyle, scheduleIframe]);

  const addBlock  = (type) => { setBlocks(p => { setSelectedIdx(p.length); return [...p, defaultBlock(type)]; }); setBuilderDirty(true); };
  const updBlock  = (i, u) => { setBlocks(p => p.map((b, j) => j === i ? { ...b, ...u } : b)); setBuilderDirty(true); };
  const delBlock  = (i) => { setBlocks(p => p.filter((_, j) => j !== i)); setSelectedIdx(s => Math.max(0, s >= i ? s - 1 : s)); setBuilderDirty(true); };
  const dupBlock  = (i) => { setBlocks(p => [...p.slice(0, i + 1), { ...p[i] }, ...p.slice(i + 1)]); setSelectedIdx(i + 1); setBuilderDirty(true); };
  const moveBlock = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= blocks.length) return;
    const b = [...blocks]; [b[i], b[j]] = [b[j], b[i]];
    setBlocks(b); setSelectedIdx(j); setBuilderDirty(true);
  };

  const switchToCode = () => {
    // Only overwrite rawHtml if the builder has been modified; otherwise preserve the original
    if (mode === 'visual' && builderDirty) setRawHtml(toFullHtml(blocks, globalStyle));
    setMode('html');
    setMobileTab('edit');
  };

  const switchToVisual = () => {
    // When switching from Code mode, try to parse the raw HTML into editable blocks
    if (mode === 'html' && rawHtml && !builderDirty) {
      const parsed = parseHtmlToBlocks(rawHtml);
      if (parsed && parsed.blocks.length > 0) {
        setBlocks(parsed.blocks);
        if (parsed.globalStyle) setGlobalStyle(g => ({ ...g, ...parsed.globalStyle }));
        setSelectedIdx(0);
        // Don't mark as dirty — builder content is from the HTML, not user edits
      }
    }
    setMode('visual');
    setMobileTab('edit');
  };

  const insertTag = (tag) => {
    if (mode === 'html') { setRawHtml(p => p + tag); }
    else if (blocks[selectedIdx]?.type === 'text') { updBlock(selectedIdx, { content: blocks[selectedIdx].content + ' ' + tag }); }
  };

  const canvasMaxW = viewport === 'mobile' ? '390px' : `${globalStyle.maxWidth || 600}px`;

  return (
    <div className="flex flex-col h-full min-h-0">

      {/* ── Builder toolbar ── */}
      <div className="shrink-0 flex items-center justify-between gap-3 mb-3 flex-wrap">
        <div className="hidden 2xl:flex gap-1 bg-black/5 dark:bg-black/30 p-1 rounded-xl border border-black/10 dark:border-white/5">
          {MERGE_TAGS.map(({ tag, label }) => (
            <button key={tag} onClick={() => insertTag(tag)} className="text-[8px] font-black px-2 py-1.5 bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded-lg hover:bg-amber-500/20 transition-all whitespace-nowrap">{label}</button>
          ))}
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <div className="flex bg-black/5 dark:bg-black/40 rounded-xl p-1 border border-black/10 dark:border-white/10">
            <button onClick={switchToVisual} className={`px-3 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all ${mode === 'visual' ? 'bg-primary-500 text-white shadow' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}>Builder</button>
            <button onClick={switchToCode}   className={`px-3 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all ${mode === 'html'   ? 'bg-primary-500 text-white shadow' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}>Code</button>
          </div>
          <div className="flex bg-black/5 dark:bg-black/40 rounded-xl p-1 border border-black/10 dark:border-white/10">
            <button onClick={() => setViewport('desktop')} title="Desktop" className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all ${viewport === 'desktop' ? 'bg-primary-500 text-white shadow' : 'text-gray-500 dark:text-gray-400 hover:text-primary-500'}`}><IconDesktop /></button>
            <button onClick={() => setViewport('mobile')}  title="Mobile"  className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all ${viewport === 'mobile'  ? 'bg-primary-500 text-white shadow' : 'text-gray-500 dark:text-gray-400 hover:text-primary-500'}`}><IconMobile /></button>
          </div>
        </div>
      </div>

      {/* ── Panels ── */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {mode === 'visual' ? (
          <div className="h-full flex gap-3 overflow-hidden">

            {/* Left: block picker + global */}
            <aside className={`${mobileTab === 'edit' ? 'flex' : 'hidden'} md:flex w-full md:w-48 shrink-0 flex-col gap-2 overflow-y-auto custom-scrollbar pb-4`}>
              <div className="flex gap-1 p-1 bg-black/5 dark:bg-black/40 rounded-xl border border-black/10 dark:border-white/10 shrink-0">
                <button onClick={() => setLeftTab('blocks')} className={`flex-1 py-1.5 text-[8px] font-black uppercase tracking-widest rounded-lg transition-all ${leftTab === 'blocks' ? 'bg-primary-500 text-white shadow' : 'text-gray-500'}`}>Blocks</button>
                <button onClick={() => setLeftTab('global')} className={`flex-1 py-1.5 text-[8px] font-black uppercase tracking-widest rounded-lg transition-all ${leftTab === 'global' ? 'bg-primary-500 text-white shadow' : 'text-gray-500'}`}>Global</button>
              </div>

              {leftTab === 'blocks' ? (
                <div className="space-y-4">
                  {BLOCK_CATEGORIES.map(cat => (
                    <div key={cat.label}>
                      <p className={`text-[7px] font-black uppercase tracking-[0.3em] px-1 mb-1.5 ${cat.color}`}>{cat.label}</p>
                      <div className="space-y-1">
                        {cat.blocks.map(bt => (
                          <button key={bt.type} onClick={() => addBlock(bt.type)} className="w-full text-left px-3 py-2 bg-white/5 dark:bg-white/[0.03] border border-black/10 dark:border-white/10 rounded-xl hover:border-primary-500/50 hover:bg-primary-500/5 transition-all flex items-center gap-2.5 group">
                            <span className="w-6 h-6 flex items-center justify-center rounded-lg bg-black/10 dark:bg-white/5 text-gray-500 group-hover:bg-primary-500/20 group-hover:text-primary-500 transition-all shrink-0">{bt.icon}</span>
                            <span className="text-[9px] font-black uppercase tracking-widest dark:text-gray-300 text-gray-700">{bt.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                  <div>
                    <p className="text-[7px] font-black text-amber-400 uppercase tracking-[0.3em] px-1 mb-1.5">Merge Tags</p>
                    <div className="grid grid-cols-2 gap-1">
                      {MERGE_TAGS.map(({ tag, label }) => (
                        <button key={tag} onClick={() => insertTag(tag)} className="text-[8px] font-black px-2 py-1.5 bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded-xl hover:bg-amber-500/20 transition-all text-center">{label}</button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <GlobalStylePanel gs={globalStyle} onChange={setGlobalStyle} />
              )}
            </aside>

            {/* Center: canvas */}
            <div className={`${mobileTab === 'preview' ? 'flex' : 'hidden'} md:flex flex-1 flex-col min-h-0 min-w-0`}>
              <div className="flex items-center justify-between mb-2 px-1">
                <p className="text-[8px] font-black text-gray-500 uppercase tracking-[0.25em]">Canvas</p>
                <div className="flex items-center gap-3">
                  <span className="text-[8px] font-bold text-gray-500 uppercase tracking-widest">{viewport === 'mobile' ? '390px · Mobile' : `${globalStyle.maxWidth||600}px · Desktop`}</span>
                  {blocks.length > 0 && <button onClick={() => { setBlocks([defaultBlock('text')]); setSelectedIdx(0); setBuilderDirty(true); }} className="text-[8px] font-black text-red-500 hover:text-red-400 uppercase tracking-widest transition-colors">Clear</button>}
                </div>
              </div>
              <div className="flex-1 bg-slate-100 dark:bg-black/50 rounded-2xl overflow-hidden border border-black/10 dark:border-white/5 relative">
                <div className="absolute inset-0 tech-grid opacity-5 pointer-events-none" />
                <ScrollArrows onUp={() => scroll(canvasRef, -1)} onDown={() => scroll(canvasRef, 1)} />
                <div ref={canvasRef} className="h-full overflow-y-auto custom-scrollbar p-4 flex justify-center">
                  <div className="w-full transition-all duration-300" style={{ maxWidth: canvasMaxW }}>
                    <div className="bg-white shadow-xl rounded-2xl overflow-hidden">
                      {blocks.map((block, idx) => (
                        <div
                          key={idx}
                          onClick={() => { setSelectedIdx(idx); setMobileTab('props'); }}
                          className={`relative group cursor-pointer transition-all duration-150 ${selectedIdx === idx ? 'ring-2 ring-inset ring-primary-500' : 'hover:ring-1 hover:ring-inset hover:ring-primary-500/40'}`}
                        >
                          <div dangerouslySetInnerHTML={{ __html: blockToHtml(block) }} />
                          <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 flex gap-1 transition-all z-10">
                            <button onClick={e => { e.stopPropagation(); moveBlock(idx, -1); }} disabled={idx === 0} className="w-6 h-6 bg-black/80 backdrop-blur border border-white/20 rounded-lg text-white text-[10px] hover:bg-primary-500 disabled:opacity-30 transition-all flex items-center justify-center">↑</button>
                            <button onClick={e => { e.stopPropagation(); moveBlock(idx, 1); }} disabled={idx === blocks.length - 1} className="w-6 h-6 bg-black/80 backdrop-blur border border-white/20 rounded-lg text-white text-[10px] hover:bg-primary-500 disabled:opacity-30 transition-all flex items-center justify-center">↓</button>
                            <button onClick={e => { e.stopPropagation(); dupBlock(idx); }} className="w-6 h-6 bg-black/80 backdrop-blur border border-white/20 rounded-lg text-white text-[10px] hover:bg-primary-500 transition-all flex items-center justify-center">⧉</button>
                            <button onClick={e => { e.stopPropagation(); delBlock(idx); }} className="w-6 h-6 bg-red-500/80 backdrop-blur border border-red-400/40 rounded-lg text-white text-[10px] hover:bg-red-600 transition-all flex items-center justify-center">✕</button>
                          </div>
                          {selectedIdx === idx && (
                            <div className="absolute top-1.5 left-1.5 bg-primary-500 text-white text-[7px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg">{block.type}</div>
                          )}
                        </div>
                      ))}
                      {blocks.length === 0 && (
                        <div className="p-16 flex flex-col items-center gap-3">
                          <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center border border-dashed border-gray-200">
                            <svg className="w-6 h-6 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4"/></svg>
                          </div>
                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Add a block from the left panel</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: block settings */}
            <aside className={`${mobileTab === 'props' ? 'flex' : 'hidden'} md:flex w-full md:w-56 shrink-0 flex-col overflow-y-auto custom-scrollbar pb-4`}>
              <p className="text-[8px] font-black text-gray-500 uppercase tracking-[0.25em] px-1 mb-3">Block Settings</p>
              {blocks[selectedIdx] ? (
                <BlockProps block={blocks[selectedIdx]} onChange={u => updBlock(selectedIdx, u)} />
              ) : (
                <div className="flex flex-col items-center justify-center flex-1 gap-2 opacity-50">
                  <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest text-center">Select a block</p>
                </div>
              )}
            </aside>
          </div>

        ) : (
          /* ── CODE MODE ── */
          <div className="h-full flex gap-3 overflow-hidden">
            <div className={`${mobileTab === 'edit' ? 'flex' : 'hidden'} md:flex flex-1 flex-col min-h-0 min-w-0`}>
              <div className="flex items-center justify-between mb-2 px-1">
                <p className="text-[8px] font-black text-gray-500 uppercase tracking-[0.25em]">HTML Editor</p>
                <div className="flex items-center gap-3">
                  <span className="text-[8px] font-bold text-gray-500">{rawHtml.length.toLocaleString()} chars</span>
                  <button onClick={() => { setRawHtml(toFullHtml(blocks, globalStyle)); }} className="text-[8px] font-black text-primary-500 hover:text-primary-400 uppercase tracking-widest transition-colors">Import from Builder</button>
                </div>
              </div>
              <div className="flex-1 relative rounded-2xl overflow-hidden border border-white/5">
                <textarea
                  value={rawHtml}
                  onChange={e => setRawHtml(e.target.value)}
                  spellCheck={false}
                  onKeyDown={e => {
                    if (e.key === 'Tab') {
                      e.preventDefault();
                      const s = e.target.selectionStart;
                      setRawHtml(v => v.slice(0, s) + '  ' + v.slice(e.target.selectionEnd));
                      requestAnimationFrame(() => { e.target.selectionStart = e.target.selectionEnd = s + 2; });
                    }
                  }}
                  className="absolute inset-0 w-full h-full p-5 font-mono text-xs resize-none focus:outline-none focus:ring-1 focus:ring-primary-500/50 custom-scrollbar leading-relaxed"
                  style={{ background: '#0d1117', color: '#c9d1d9', caretColor: '#8b5cf6' }}
                  placeholder={"<!DOCTYPE html>\n<html>\n  <head>...</head>\n  <body>...</body>\n</html>"}
                />
              </div>
            </div>
            <div className={`${mobileTab === 'preview' ? 'flex' : 'hidden'} md:flex flex-1 flex-col min-h-0`}>
              <div className="flex items-center justify-between mb-2 px-1">
                <p className="text-[8px] font-black text-gray-500 uppercase tracking-[0.25em]">Live Preview</p>
                <span className="text-[8px] font-bold text-gray-500 uppercase tracking-widest">{viewport === 'mobile' ? '390px · Mobile' : `${globalStyle.maxWidth||600}px · Desktop`}</span>
              </div>
              <div className="flex-1 bg-slate-100 dark:bg-black/50 rounded-2xl overflow-hidden border border-black/10 dark:border-white/5 relative">
                <div className="absolute inset-0 tech-grid opacity-5 pointer-events-none" />
                <ScrollArrows onUp={() => scroll(codeRef, -1)} onDown={() => scroll(codeRef, 1)} />
                <div ref={codeRef} className="h-full overflow-y-auto custom-scrollbar p-4 flex justify-center">
                  <div className="w-full transition-all duration-300" style={{ maxWidth: canvasMaxW, height: '100%' }}>
                    <iframe srcDoc={iframeSrc} title="live-preview" className="w-full h-full border-none rounded-2xl bg-white shadow-xl" sandbox="allow-same-origin" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Mobile tab bar ── */}
      <div className="md:hidden shrink-0 flex gap-1 mt-3 p-1 bg-black/10 dark:bg-black/40 rounded-2xl border border-black/10 dark:border-white/10">
        <button onClick={() => setMobileTab('edit')}    className={`flex-1 py-2.5 text-[9px] font-black uppercase tracking-widest rounded-xl transition-all ${mobileTab === 'edit'    ? 'bg-primary-500 text-white shadow' : 'text-gray-500 dark:text-gray-400'}`}>{mode === 'visual' ? 'Blocks' : 'Code'}</button>
        <button onClick={() => setMobileTab('preview')} className={`flex-1 py-2.5 text-[9px] font-black uppercase tracking-widest rounded-xl transition-all ${mobileTab === 'preview' ? 'bg-primary-500 text-white shadow' : 'text-gray-500 dark:text-gray-400'}`}>Preview</button>
        {mode === 'visual' && <button onClick={() => setMobileTab('props')} className={`flex-1 py-2.5 text-[9px] font-black uppercase tracking-widest rounded-xl transition-all ${mobileTab === 'props' ? 'bg-primary-500 text-white shadow' : 'text-gray-500 dark:text-gray-400'}`}>Settings</button>}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   SCROLL ARROWS
═══════════════════════════════════════════════════════════════════ */
function ScrollArrows({ onUp, onDown }) {
  return (
    <div className="absolute bottom-3 right-3 flex flex-col gap-1.5 z-30 pointer-events-none">
      <button
        onClick={onUp}
        title="Scroll up"
        className="pointer-events-auto w-8 h-8 flex items-center justify-center rounded-xl bg-black/50 dark:bg-black/75 backdrop-blur-sm border border-white/20 text-white hover:bg-primary-500 hover:border-primary-400/60 transition-all shadow-lg"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
        </svg>
      </button>
      <button
        onClick={onDown}
        title="Scroll down"
        className="pointer-events-auto w-8 h-8 flex items-center justify-center rounded-xl bg-black/50 dark:bg-black/75 backdrop-blur-sm border border-white/20 text-white hover:bg-primary-500 hover:border-primary-400/60 transition-all shadow-lg"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   GLOBAL STYLE PANEL
═══════════════════════════════════════════════════════════════════ */
function GlobalStylePanel({ gs, onChange }) {
  const L = 'block text-[8px] font-black text-gray-500 uppercase tracking-widest mb-1.5';
  const I = 'input-field py-2 text-[11px] font-bold bg-black/20';
  const set = (key, val) => onChange({ ...gs, [key]: val });
  return (
    <div className="space-y-4 animate-slide-up">
      <ColorRow label="Email Background"     value={gs.emailBg}     onChange={v => set('emailBg', v)}     L={L} />
      <ColorRow label="Container Background" value={gs.containerBg} onChange={v => set('containerBg', v)} L={L} />
      <div>
        <label className={L}>Font Family</label>
        <select value={gs.fontFamily} onChange={e => set('fontFamily', e.target.value)} className={`${I} w-full`}>
          {FONT_FAMILIES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className={L}>Max Width</label><input type="number" value={gs.maxWidth} onChange={e => set('maxWidth', e.target.value)} className={I} min="320" max="800" /></div>
        <div><label className={L}>Radius (px)</label><input type="number" value={gs.borderRadius} onChange={e => set('borderRadius', e.target.value)} className={I} min="0" max="32" /></div>
      </div>
      <p className="text-[8px] font-bold text-gray-500 uppercase tracking-widest leading-relaxed">These settings apply to the entire email wrapper.</p>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   BLOCK PROPERTIES PANEL
═══════════════════════════════════════════════════════════════════ */
function BlockProps({ block, onChange }) {
  const L = 'block text-[8px] font-black text-gray-500 uppercase tracking-widest mb-1.5';
  const I = 'input-field py-2 text-[11px] font-bold bg-black/20';
  const AlignBtn = ({ val, cur, onClick, children }) => (
    <button type="button" onClick={() => onClick(val)} className={`flex-1 py-1.5 text-[8px] font-black rounded-lg transition-all ${cur === val ? 'bg-primary-500 text-white' : 'bg-black/10 dark:bg-white/5 text-gray-500 hover:text-gray-900 dark:hover:text-white'}`}>{children}</button>
  );
  const Align3 = ({ cur, set }) => (
    <div className="flex gap-1">
      {['left','center','right'].map(a => <AlignBtn key={a} val={a} cur={cur} onClick={set}>{a[0].toUpperCase()}</AlignBtn>)}
    </div>
  );

  switch (block.type) {
    case 'text': return (
      <div className="space-y-4 animate-slide-up">
        <div><label className={L}>Content (HTML)</label><textarea value={block.content} onChange={e => onChange({ content: e.target.value })} className={`${I} min-h-[100px] resize-none font-mono text-[10px]`} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={L}>Font Size</label><input type="number" value={block.fontSize} onChange={e => onChange({ fontSize: e.target.value })} className={I} min="10" max="72" /></div>
          <div><label className={L}>Padding</label><input type="number" value={block.padding} onChange={e => onChange({ padding: e.target.value })} className={I} min="0" /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={L}>Line Height</label><input type="number" value={block.lineHeight} onChange={e => onChange({ lineHeight: e.target.value })} className={I} min="1" max="3" step="0.05" /></div>
          <div><label className={L}>Font Weight</label>
            <select value={block.fontWeight} onChange={e => onChange({ fontWeight: e.target.value })} className={`${I} w-full`}>
              <option value="normal">Normal</option><option value="bold">Bold</option><option value="800">Extra Bold</option>
            </select>
          </div>
        </div>
        <div><label className={L}>Font Family</label>
          <select value={block.fontFamily} onChange={e => onChange({ fontFamily: e.target.value })} className={`${I} w-full`}>
            <option value="">Global Default</option>
            {FONT_FAMILIES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
        </div>
        <ColorRow label="Text Color"       value={block.color}   onChange={v => onChange({ color: v })}   L={L} />
        <ColorRow label="Background Color" value={block.bgColor} onChange={v => onChange({ bgColor: v })} L={L} />
        <div><label className={L}>Alignment</label><Align3 cur={block.align} set={v => onChange({ align: v })} /></div>
      </div>
    );
    case 'image': return (
      <div className="space-y-4 animate-slide-up">
        <div><label className={L}>Image URL</label><input value={block.src} onChange={e => onChange({ src: e.target.value })} className={I} placeholder="https://..." /></div>
        <div><label className={L}>Alt Text</label><input value={block.alt} onChange={e => onChange({ alt: e.target.value })} className={I} /></div>
        <div><label className={L}>Link URL (optional)</label><input value={block.linkUrl} onChange={e => onChange({ linkUrl: e.target.value })} className={I} placeholder="Makes image clickable..." /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={L}>Width %</label><input type="number" value={block.width} onChange={e => onChange({ width: e.target.value })} className={I} min="10" max="100" /></div>
          <div><label className={L}>Radius (px)</label><input type="number" value={block.borderRadius} onChange={e => onChange({ borderRadius: e.target.value })} className={I} min="0" max="64" /></div>
        </div>
        <div><label className={L}>Padding</label><input type="number" value={block.padding} onChange={e => onChange({ padding: e.target.value })} className={I} min="0" /></div>
        <div><label className={L}>Alignment</label><Align3 cur={block.align} set={v => onChange({ align: v })} /></div>
        {block.src && <div className="rounded-xl overflow-hidden border border-white/10"><img src={block.src} alt={block.alt} className="w-full h-20 object-cover" onError={e => { e.target.style.display='none'; }} /></div>}
      </div>
    );
    case 'button': return (
      <div className="space-y-4 animate-slide-up">
        <div><label className={L}>Button Text</label><input value={block.text} onChange={e => onChange({ text: e.target.value })} className={I} /></div>
        <div><label className={L}>Link URL</label><input value={block.url} onChange={e => onChange({ url: e.target.value })} className={I} placeholder="https://..." /></div>
        <div><label className={L}>Style</label>
          <div className="flex gap-1">
            {['solid','outline'].map(s => (
              <button key={s} type="button" onClick={() => onChange({ style: s })} className={`flex-1 py-1.5 text-[8px] font-black rounded-lg capitalize transition-all ${block.style===s ? 'bg-primary-500 text-white' : 'bg-black/10 dark:bg-white/5 text-gray-500'}`}>{s}</button>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <Toggle value={block.fullWidth} onChange={v => onChange({ fullWidth: v })} label="Full Width" />
          <Toggle value={block.uppercase} onChange={v => onChange({ uppercase: v })} label="Uppercase Text" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <ColorRow label="Button Color" value={block.bgColor}   onChange={v => onChange({ bgColor: v })}   L={L} />
          <ColorRow label="Text Color"   value={block.textColor} onChange={v => onChange({ textColor: v })} L={L} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={L}>Font Size</label><input type="number" value={block.fontSize} onChange={e => onChange({ fontSize: e.target.value })} className={I} min="10" max="32" /></div>
          <div><label className={L}>Radius</label><input type="number" value={block.borderRadius} onChange={e => onChange({ borderRadius: e.target.value })} className={I} min="0" /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={L}>V Padding</label><input type="number" value={block.paddingV} onChange={e => onChange({ paddingV: e.target.value })} className={I} min="0" /></div>
          <div><label className={L}>H Padding</label><input type="number" value={block.paddingH} onChange={e => onChange({ paddingH: e.target.value })} className={I} min="0" /></div>
        </div>
        {!block.fullWidth && <div><label className={L}>Alignment</label><Align3 cur={block.align} set={v => onChange({ align: v })} /></div>}
      </div>
    );
    case 'hero': return (
      <div className="space-y-4 animate-slide-up">
        <div><label className={L}>Headline</label><input value={block.title} onChange={e => onChange({ title: e.target.value })} className={I} /></div>
        <div><label className={L}>Subtitle</label><textarea value={block.subtitle} onChange={e => onChange({ subtitle: e.target.value })} className={`${I} min-h-[70px] resize-none`} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={L}>Title Size</label><input type="number" value={block.fontSize} onChange={e => onChange({ fontSize: e.target.value })} className={I} min="18" max="64" /></div>
          <div><label className={L}>Sub Size</label><input type="number" value={block.subtitleSize} onChange={e => onChange({ subtitleSize: e.target.value })} className={I} min="12" max="32" /></div>
        </div>
        <div><label className={L}>Background</label>
          <div className="space-y-2">
            <Toggle value={block.bgGradient} onChange={v => onChange({ bgGradient: v })} label="Use Gradient" />
            <ColorRow label="Start Color" value={block.bgColor}       onChange={v => onChange({ bgColor: v })}       L={L} />
            {block.bgGradient && <ColorRow label="End Color" value={block.bgGradientEnd} onChange={v => onChange({ bgGradientEnd: v })} L={L} />}
            <div><label className={L}>BG Image URL (optional)</label><input value={block.bgImage} onChange={e => onChange({ bgImage: e.target.value })} className={I} placeholder="https://..." /></div>
          </div>
        </div>
        <ColorRow label="Text Color" value={block.textColor} onChange={v => onChange({ textColor: v })} L={L} />
        <div><label className={L}>V Padding</label><input type="number" value={block.paddingV} onChange={e => onChange({ paddingV: e.target.value })} className={I} min="20" max="160" /></div>
        <div><label className={L}>Alignment</label><Align3 cur={block.align} set={v => onChange({ align: v })} /></div>
        <div className="border-t border-white/10 pt-4 space-y-3">
          <Toggle value={block.showButton} onChange={v => onChange({ showButton: v })} label="Show CTA Button" />
          {block.showButton && <>
            <div><label className={L}>Button Text</label><input value={block.buttonText} onChange={e => onChange({ buttonText: e.target.value })} className={I} /></div>
            <div><label className={L}>Button URL</label><input value={block.buttonUrl} onChange={e => onChange({ buttonUrl: e.target.value })} className={I} /></div>
            <div className="grid grid-cols-2 gap-3">
              <ColorRow label="Btn Background" value={block.buttonBgColor}   onChange={v => onChange({ buttonBgColor: v })}   L={L} />
              <ColorRow label="Btn Text"       value={block.buttonTextColor} onChange={v => onChange({ buttonTextColor: v })} L={L} />
            </div>
          </>}
        </div>
      </div>
    );
    case 'columns': return (
      <div className="space-y-4 animate-slide-up">
        <div><label className={L}>Column Ratio</label>
          <div className="flex gap-1">
            {[['50','50/50'],['60','60/40'],['40','40/60'],['33','33/67']].map(([v,lbl]) => (
              <button key={v} type="button" onClick={() => onChange({ col1Ratio: v })} className={`flex-1 py-1.5 text-[7px] font-black rounded-lg transition-all ${block.col1Ratio===v ? 'bg-primary-500 text-white' : 'bg-black/10 dark:bg-white/5 text-gray-500'}`}>{lbl}</button>
            ))}
          </div>
        </div>
        <div><label className={L}>Left Column (HTML)</label><textarea value={block.col1} onChange={e => onChange({ col1: e.target.value })} className={`${I} min-h-[80px] resize-none font-mono text-[10px]`} /></div>
        <div><label className={L}>Right Column (HTML)</label><textarea value={block.col2} onChange={e => onChange({ col2: e.target.value })} className={`${I} min-h-[80px] resize-none font-mono text-[10px]`} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={L}>Font Size</label><input type="number" value={block.fontSize} onChange={e => onChange({ fontSize: e.target.value })} className={I} min="10" max="32" /></div>
          <div><label className={L}>Gap (px)</label><input type="number" value={block.gap} onChange={e => onChange({ gap: e.target.value })} className={I} min="0" max="60" /></div>
        </div>
        <div><label className={L}>Block Padding</label><input type="number" value={block.padding} onChange={e => onChange({ padding: e.target.value })} className={I} min="0" /></div>
        <div className="grid grid-cols-2 gap-3">
          <ColorRow label="Left Text"  value={block.col1Color}   onChange={v => onChange({ col1Color: v })}   L={L} />
          <ColorRow label="Right Text" value={block.col2Color}   onChange={v => onChange({ col2Color: v })}   L={L} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <ColorRow label="Left BG"  value={block.col1BgColor} onChange={v => onChange({ col1BgColor: v })} L={L} />
          <ColorRow label="Right BG" value={block.col2BgColor} onChange={v => onChange({ col2BgColor: v })} L={L} />
        </div>
        <ColorRow label="Row Background" value={block.bgColor} onChange={v => onChange({ bgColor: v })} L={L} />
      </div>
    );
    case 'social': return (
      <div className="space-y-4 animate-slide-up">
        <div><label className={L}>Platforms</label>
          <div className="space-y-1.5">
            {(block.platforms || []).map((p, i) => (
              <div key={p.name} className="flex items-center gap-1.5">
                <button type="button" onClick={() => { const pl=[...block.platforms]; pl[i]={...pl[i],enabled:!pl[i].enabled}; onChange({platforms:pl}); }} className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 text-[9px] font-black transition-all ${p.enabled ? 'bg-primary-500 text-white' : 'bg-black/10 dark:bg-white/5 text-gray-400'}`}>{p.enabled ? '✓' : '+'}</button>
                <span className="text-[8px] font-black uppercase tracking-wider w-14 shrink-0 text-gray-500">{p.name}</span>
                <input value={p.url} onChange={e => { const pl=[...block.platforms]; pl[i]={...pl[i],url:e.target.value}; onChange({platforms:pl}); }} className={`${I} flex-1 min-w-0 text-[9px] py-1`} placeholder="URL" />
                <input type="color" value={p.color} onChange={e => { const pl=[...block.platforms]; pl[i]={...pl[i],color:e.target.value}; onChange({platforms:pl}); }} className="w-6 h-6 rounded-lg cursor-pointer border border-white/10 bg-transparent shrink-0" />
              </div>
            ))}
          </div>
        </div>
        <div><label className={L}>Button Style</label>
          <div className="flex gap-1">
            {['circle','square','pill'].map(s => (
              <button key={s} type="button" onClick={() => onChange({ style: s })} className={`flex-1 py-1.5 text-[8px] font-black rounded-lg capitalize transition-all ${block.style===s ? 'bg-primary-500 text-white' : 'bg-black/10 dark:bg-white/5 text-gray-500'}`}>{s}</button>
            ))}
          </div>
        </div>
        {block.style !== 'pill' && <div><label className={L}>Icon Size (px)</label><input type="number" value={block.iconSize} onChange={e => onChange({ iconSize: e.target.value })} className={I} min="24" max="64" /></div>}
        <Toggle value={block.showLabel} onChange={v => onChange({ showLabel: v })} label="Show Label" />
        {block.showLabel && <>
          <div><label className={L}>Label Text</label><input value={block.label} onChange={e => onChange({ label: e.target.value })} className={I} /></div>
          <ColorRow label="Label Color" value={block.labelColor} onChange={v => onChange({ labelColor: v })} L={L} />
        </>}
        <ColorRow label="Background" value={block.bgColor} onChange={v => onChange({ bgColor: v })} L={L} />
        <div className="grid grid-cols-2 gap-3">
          <div><label className={L}>Padding</label><input type="number" value={block.padding} onChange={e => onChange({ padding: e.target.value })} className={I} min="0" /></div>
          <div><label className={L}>Alignment</label><Align3 cur={block.align} set={v => onChange({ align: v })} /></div>
        </div>
      </div>
    );
    case 'footer': return (
      <div className="space-y-4 animate-slide-up">
        <div><label className={L}>Company Name</label><input value={block.company} onChange={e => onChange({ company: e.target.value })} className={I} /></div>
        <div><label className={L}>Address</label><input value={block.address} onChange={e => onChange({ address: e.target.value })} className={I} /></div>
        <Toggle value={block.showYear} onChange={v => onChange({ showYear: v })} label="Show Year" />
        {block.showYear && <div><label className={L}>Year</label><input value={block.year} onChange={e => onChange({ year: e.target.value })} className={I} /></div>}
        <div className="border-t border-white/10 pt-3">
          <div><label className={L}>Unsubscribe Text</label><input value={block.unsubscribeText} onChange={e => onChange({ unsubscribeText: e.target.value })} className={I} /></div>
          <div className="mt-3"><label className={L}>Unsubscribe URL</label><input value={block.unsubscribeUrl} onChange={e => onChange({ unsubscribeUrl: e.target.value })} className={I} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={L}>Font Size</label><input type="number" value={block.fontSize} onChange={e => onChange({ fontSize: e.target.value })} className={I} min="10" max="16" /></div>
          <div><label className={L}>Padding</label><input type="number" value={block.padding} onChange={e => onChange({ padding: e.target.value })} className={I} min="8" /></div>
        </div>
        <ColorRow label="Background" value={block.bgColor}   onChange={v => onChange({ bgColor: v })}   L={L} />
        <ColorRow label="Text Color" value={block.textColor} onChange={v => onChange({ textColor: v })} L={L} />
      </div>
    );
    case 'video': return (
      <div className="space-y-4 animate-slide-up">
        <div><label className={L}>Thumbnail URL</label><input value={block.thumbnailUrl} onChange={e => onChange({ thumbnailUrl: e.target.value })} className={I} placeholder="https://..." /></div>
        <div><label className={L}>Video Link URL</label><input value={block.videoUrl} onChange={e => onChange({ videoUrl: e.target.value })} className={I} placeholder="https://..." /></div>
        <div><label className={L}>Alt Text</label><input value={block.alt} onChange={e => onChange({ alt: e.target.value })} className={I} /></div>
        <div><label className={L}>Caption (optional)</label><input value={block.caption} onChange={e => onChange({ caption: e.target.value })} className={I} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={L}>Width %</label><input type="number" value={block.width} onChange={e => onChange({ width: e.target.value })} className={I} min="20" max="100" /></div>
          <div><label className={L}>Radius (px)</label><input type="number" value={block.borderRadius} onChange={e => onChange({ borderRadius: e.target.value })} className={I} min="0" max="32" /></div>
        </div>
        <div><label className={L}>Padding</label><input type="number" value={block.padding} onChange={e => onChange({ padding: e.target.value })} className={I} min="0" /></div>
        <div><label className={L}>Alignment</label><Align3 cur={block.align} set={v => onChange({ align: v })} /></div>
        {block.thumbnailUrl && <div className="rounded-xl overflow-hidden border border-white/10"><img src={block.thumbnailUrl} alt={block.alt} className="w-full h-20 object-cover" onError={e => { e.target.style.display='none'; }} /></div>}
      </div>
    );
    case 'divider': return (
      <div className="space-y-4 animate-slide-up">
        <div><label className={L}>Line Style</label>
          <div className="flex gap-1">
            {['solid','dashed','dotted'].map(s => (
              <button key={s} type="button" onClick={() => onChange({ style: s })} className={`flex-1 py-1.5 text-[8px] font-black rounded-lg capitalize transition-all ${block.style===s ? 'bg-primary-500 text-white' : 'bg-black/10 dark:bg-white/5 text-gray-500'}`}>{s}</button>
            ))}
          </div>
        </div>
        <ColorRow label="Color" value={block.color} onChange={v => onChange({ color: v })} L={L} />
        <div className="grid grid-cols-2 gap-3">
          <div><label className={L}>Thickness</label><input type="number" value={block.thickness} onChange={e => onChange({ thickness: e.target.value })} className={I} min="1" max="16" /></div>
          <div><label className={L}>V Padding</label><input type="number" value={block.paddingV} onChange={e => onChange({ paddingV: e.target.value })} className={I} min="0" /></div>
        </div>
      </div>
    );
    case 'spacer': return (
      <div className="animate-slide-up">
        <label className={L}>Height (px)</label>
        <input type="number" value={block.height} onChange={e => onChange({ height: e.target.value })} className={I} min="4" max="200" />
        <p className="text-[8px] text-gray-500 mt-2 font-bold uppercase tracking-widest">Adds vertical space between blocks</p>
      </div>
    );
    default: return null;
  }
}
