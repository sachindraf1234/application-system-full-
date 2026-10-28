import React, { useState, useEffect } from 'react';
import type { OCRSuggestion } from '../utils/ocrFields';

interface Props {
  onApply: (suggestions: OCRSuggestion[]) => void;
  className?: string;
  incomingFiles?: File[];
  incomingKey?: number;
  embedded?: boolean;
}

const readDataUrl = (file: File): Promise<string> => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result));
  reader.onerror = () => reject(new Error(`Could not read ${file.name}`));
  reader.readAsDataURL(file);
});

export function LocalOCRPanel({ onApply, className = '', incomingFiles, incomingKey, embedded = false }: Props) {
  const [files, setFiles] = useState<File[]>([]);
  const [languageMode, setLanguageMode] = useState('eng+sin+tam');
  const [customLanguages, setCustomLanguages] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [rawText, setRawText] = useState('');
  const [confidence, setConfidence] = useState<number | null>(null);
  const [engine, setEngine] = useState('');
  const [alternatePages, setAlternatePages] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<Array<OCRSuggestion & { selected: boolean }>>([]);

  const run = async (chosenFiles = files) => {
    if (!chosenFiles.length) { setError('Select at least one image or PDF.'); return; }
    setBusy(true); setError(''); setSuggestions([]); setRawText('');
    try {
      const images: string[] = [];
      for (const file of chosenFiles) {
        if (file.size > 12 * 1024 * 1024) throw new Error(`${file.name} exceeds the 12 MB file limit.`);
        if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
          const { convertPdfToImages } = await import('../utils/pdfUtils');
          const pages = await convertPdfToImages(file, 5 - images.length);
          images.push(...pages.map(page => page.dataUrl));
        } else if (file.type.startsWith('image/')) images.push(await readDataUrl(file));
        else throw new Error('Use a PDF, PNG, JPEG or WEBP image.');
        if (images.length >= 5) break;
      }
      if (!images.length) throw new Error('No readable pages found.');
      const languages = (languageMode === 'custom' ? customLanguages : languageMode).toLowerCase().split(/[+,\s]+/).filter(Boolean);
      if (!languages.length || languages.length > 3 || languages.some(lang => !/^[a-z]{3}(?:_[a-z]{2,4})?$/.test(lang))) throw new Error('Choose 1–3 three-letter language codes, e.g. eng+sin+tam.');
      const response = await fetch('/api/ocr/local', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({images, languages}) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Local OCR could not read this document.');
      setRawText(result.text || '');
      setConfidence(result.confidence);
      setEngine(result.engine || 'Self-hosted OCR');
      setAlternatePages((result.pages || []).flatMap((page: {alternatives?:Array<{text:string}>}) => (page.alternatives || []).map(other => other.text)));
      setSuggestions((result.suggestions || []).map((item: OCRSuggestion) => ({ ...item, selected: item.confidence >= 0.5 })));
      if (!result.text?.trim()) setError('No legible text was found. Try a clearer or higher-resolution scan.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Local OCR failed.'); }
    finally { setBusy(false); }
  };

  useEffect(() => {
    if (incomingKey && incomingFiles?.length) { setFiles(incomingFiles); void run(incomingFiles); }
    // Trigger only for a newly failed AI extraction, not on each form render.
  }, [incomingKey]);

  return <div className={`rounded-xl border border-sky-700/60 bg-slate-900 p-3 text-slate-100 ${className}`} data-testid="local-ocr-panel">
    <div className="mb-2 flex flex-wrap items-center justify-between gap-2"><div><h3 className="text-sm font-bold text-sky-300">{embedded ? "Local OCR · review before applying" : "Local OCR review"}</h3><p className="text-[11px] text-slate-400">English, Sinhala & Tamil · private on-server OCR</p></div><span className="rounded bg-sky-900/50 px-2 py-1 text-[10px] text-sky-200">Review before applying</span></div>
    <div className="flex flex-wrap items-center gap-2">
      <input type="file" aria-label="OCR document files" accept=".pdf,application/pdf,image/png,image/jpeg,image/webp" multiple onChange={event => {setFiles(Array.from(event.target.files || []));setError('');}} className="max-w-[210px] text-[11px] text-slate-300 file:mr-2 file:rounded file:border-0 file:bg-sky-800 file:px-2 file:py-1 file:text-white" />
      <select aria-label="OCR languages" value={languageMode} onChange={event => setLanguageMode(event.target.value)} className="rounded border border-slate-600 bg-slate-800 px-2 py-1.5 text-[11px] text-white">
        <option value="eng+sin+tam">English + Sinhala + Tamil</option><option value="eng">English</option><option value="sin+eng">Sinhala + English</option><option value="tam+eng">Tamil + English</option><option value="custom">Other installed language codes</option>
      </select>
      {languageMode === 'custom' && <input aria-label="Language codes" value={customLanguages} onChange={event => setCustomLanguages(event.target.value)} placeholder="e.g. ara+eng" className="w-32 rounded border border-slate-600 bg-slate-800 px-2 py-1.5 text-[11px] text-white" />}
      <button type="button" onClick={() => void run(files)} disabled={busy || !files.length} className="rounded bg-sky-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-sky-500 disabled:opacity-50">{busy ? 'Reading pages…' : 'Extract with local OCR'}</button>
    </div>
    {files.length > 0 && <p className="mt-2 text-[10px] text-slate-400">{files.map(file => file.name).join(', ')} · up to 5 pages per run</p>}
    {error && <p role="alert" className="mt-2 text-xs text-rose-300">{error}</p>}
    {confidence !== null && <p className="mt-2 text-[11px] text-slate-400">{engine} · Recognition confidence: {confidence}% (not a guarantee of field accuracy). {suggestions.length} possible field(s) found.</p>}
    {suggestions.length > 0 && <div className="mt-3 max-h-52 space-y-2 overflow-auto"><p className="text-xs font-bold text-sky-200">Review suggested fields · low-confidence fields start unchecked; correct any wrong value</p>{suggestions.map((item,index) => <label key={`${item.field}-${index}`} className="flex items-center gap-2 rounded bg-slate-800 p-2 text-[11px]"><input type="checkbox" checked={item.selected} onChange={event => setSuggestions(prev => prev.map((entry,i) => i === index ? {...entry, selected:event.target.checked} : entry))} /><span className="w-28 shrink-0 font-bold text-sky-200">{item.field}{item.confidence < 0.5 && <span className="block text-[9px] text-amber-300">Verify carefully</span>}</span><input aria-label={`OCR ${item.field}`} value={item.value} onChange={event => setSuggestions(prev => prev.map((entry,i) => i === index ? {...entry, value:event.target.value} : entry))} className="min-w-0 flex-1 rounded border border-slate-600 bg-slate-900 px-2 py-1 text-white" title={item.evidence} /></label>)}<button type="button" onClick={() => onApply(suggestions.filter(item => item.selected && item.value.trim()))} className="rounded bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-500">Apply reviewed fields</button></div>}
    {alternatePages.length > 0 && <details className="mt-3 text-xs"><summary className="cursor-pointer text-sky-300">Compare alternate recognition pass</summary><textarea readOnly value={alternatePages.join('\n--- Alternate page ---\n')} className="mt-2 h-28 w-full rounded border border-slate-600 bg-slate-950 p-2 text-white" /></details>}
    {rawText && <details className="mt-3"><summary className="cursor-pointer text-xs font-semibold text-sky-300">View / copy full OCR text</summary><textarea readOnly value={rawText} aria-label="OCR raw text" className="mt-2 h-32 w-full rounded border border-slate-600 bg-slate-950 p-2 font-mono text-xs text-white" /></details>}
    <p className="mt-2 text-[10px] text-slate-500">Unlabeled text stays in the raw-text review. OCR cannot guarantee correct extraction from every language, document or handwriting.</p>
  </div>;
}
