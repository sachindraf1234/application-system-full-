import React, {useEffect, useState} from 'react';
import {Terminal, Eye, Download, X, CheckCircle2, Globe, ShieldCheck} from 'lucide-react';
import type {ApplicantRecord} from '../types';

type FileLink={filename:string;href:string};
type Prepared={playwright:string;localScript:string;originalError?:string;files:Record<string,FileLink>};
interface Props {applicant:ApplicantRecord;onUpdateApplicant:(record:ApplicantRecord)=>void}

/** Candidate-specific, local-only downloads. The original option retains
 * automatic Save/Next and optional CDP; the conservative option is manual-gated.
 * Neither option runs a browser or reads applicant files on the web server. */
export const LocalAutomationSuite:React.FC<Props>=({applicant})=>{
  const [prepared,setPrepared]=useState<Prepared|null>(null);
  const [busy,setBusy]=useState(true);
  const [error,setError]=useState('');
  const [preview,setPreview]=useState(false);
  const [localFolder,setLocalFolder]=useState('');
  const [portalUrl,setPortalUrl]=useState(applicant.verificationUrl||'');
  useEffect(()=>{
    const controller=new AbortController();
    setPrepared(null);setBusy(true);setError('');setPreview(false);
    const timer=setTimeout(()=>{
      let customXpaths={};
      try{customXpaths=JSON.parse(localStorage.getItem('evisa-reference-xpaths')||'{}');}catch{}
      fetch('/api/evisa-script-downloads',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({applicant:{...applicant,photoDataUrl:undefined,aiExtractedData:undefined},config:{targetMode:'FULL_PIPELINE',targetApplicationUrl:portalUrl},customXpaths,localFolder}),signal:controller.signal})
        .then(async response=>{const data=await response.json();if(!response.ok||!data.success)throw Error(data.error||'Script preparation failed.');return data;})
        .then(data=>{if(!controller.signal.aborted)setPrepared({playwright:data.playwright,localScript:data.localScript,originalError:data.originalError,files:data.files});})
        .catch(reason=>{if(!controller.signal.aborted)setError(reason instanceof Error?reason.message:'Script preparation failed.');})
        .finally(()=>{if(!controller.signal.aborted)setBusy(false);});
    },350);
    return ()=>{clearTimeout(timer);controller.abort();};
  },[applicant,localFolder,portalUrl]);
  const link=(kind:string,label:string,style:string)=>{
    const file=prepared?.files?.[kind];
    return file?<a href={file.href} download={file.filename} className={style}><Download className="h-4 w-4"/>{label}</a>
      :<button type="button" disabled className={`${style} cursor-not-allowed opacity-50`}><Download className="h-4 w-4"/>{busy?'Preparing…':'Unavailable'}</button>;
  };
  const basic='inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold transition-colors';
  const details=[
    ['Applicant', [applicant.personalData.first_names,applicant.personalData.surname].filter(Boolean).join(' ')],
    ['Occupation',applicant.travelDoc.other_occupation||applicant.travelDoc.current_occupation],
    ['Company & permit', [applicant.companyContactData.name,applicant.companyContactData.work_permit_number].filter(Boolean).join(' · ')],
    ['Spouse', [applicant.spouseData.spouse_first_names,applicant.spouseData.spouse_surname].filter(Boolean).join(' ')],
    ['Passport',applicant.travelDoc.passport_number]
  ];
  return <section id="evisa-local-python-suite" aria-label="Local Python & Playwright Visa Automation Suite" className="scroll-mt-20 space-y-5 rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-5 shadow-2xl">
    <div className="flex flex-col justify-between gap-3 border-b border-slate-800 pb-4 lg:flex-row lg:items-center">
      <div className="flex items-center gap-3"><div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-2.5 text-emerald-400"><Terminal className="h-5 w-5"/></div><div><h3 className="flex flex-wrap items-center gap-2 text-sm font-bold text-slate-100">Local Python &amp; Playwright Visa Automation Suite <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 font-mono text-[10px] text-emerald-300">Original + conservative options</span></h3><p className="mt-0.5 text-xs text-slate-400">Original attached Python/Playwright automation adapted to the selected applicant: automatic Save/Next, local folder and e-Visa link. Final submission stays manual. No browser runs on this web server.</p></div></div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" disabled={!prepared} onClick={()=>setPreview(true)} className={`${basic} border-slate-700 bg-slate-800 text-slate-200 disabled:opacity-50`}><Eye className="h-4 w-4"/>Preview Conservative Script</button>
        {link('local_py','Standalone Local .py',`${basic} border-emerald-500 bg-emerald-600 text-white hover:bg-emerald-500`)}
        {link('local_bat','Windows Launcher .bat',`${basic} border-amber-500/40 bg-slate-800 text-amber-200`)}
        {link('local_zip','Download Local Package (.zip)',`${basic} border-emerald-500 bg-gradient-to-r from-emerald-600 to-teal-600 text-white`)}
        {link('playwright','Reference Playwright .py',`${basic} border-slate-700 bg-slate-800 text-slate-200`)}
      </div>
    </div>
    <div className="rounded-xl border border-emerald-600/40 bg-emerald-950/20 p-3.5"><p className="mb-2 text-xs font-bold text-emerald-300">Attached original automation • automatic Save / Next</p><div className="flex flex-wrap gap-2">{link('original_zip','Download Original Automation (.zip)',`${basic} border-emerald-400 bg-emerald-600 text-white`)}{link('original_py','Original Full Python .py',`${basic} border-emerald-700 bg-slate-800 text-emerald-100`)}{link('original_bat','Original Windows .bat',`${basic} border-amber-700 bg-slate-800 text-amber-200`)}{link('original_cdp','Optional Chrome CDP .bat',`${basic} border-amber-700 bg-slate-800 text-amber-200`)}</div>{prepared?.originalError&&<p className="mt-2 text-xs text-amber-300">{prepared.originalError}</p>}<p className="mt-2 text-[11px] text-slate-400">This adapts the attached Python's applicant data and folder/URL references, retaining its original automatic stage flow. The original still has legacy field defaults, filesystem discovery and optional CDP attachment. Final submission is manual; verify all candidate fields and the live portal first.</p></div>
    {error&&<p role="alert" className="text-xs text-rose-300">{error} Refresh this tab and try again.</p>}
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="space-y-2 rounded-xl border border-slate-800 bg-slate-950 p-3.5"><label htmlFor="extractor-local-folder" className="flex items-center gap-2 text-xs font-bold text-emerald-400"><ShieldCheck className="h-4 w-4"/>Local Documents Folder Path (operator PC)</label><input id="extractor-local-folder" aria-label="Local Documents Folder Path" value={localFolder} onChange={e=>setLocalFolder(e.target.value)} placeholder="C:\\VisaDocs\\ApplicantFolder" className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-xs text-emerald-200"/><label htmlFor="extractor-portal-url" className="block text-xs font-bold text-emerald-400">Applicant E-Visa Link (official HTTPS)</label><input id="extractor-portal-url" aria-label="Applicant E-Visa Link" value={portalUrl} onChange={e=>setPortalUrl(e.target.value)} placeholder="https://evisa.mae.ro/home" className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-xs text-emerald-200"/><p className="text-[11px] text-slate-400">These references go into the downloads. No document bytes are uploaded to the app or included in the ZIP. The original script may discover/upload matching files from this folder automatically; the conservative alternative requires an explicit map and per-file confirmation.</p></div>
      <div className="space-y-2 rounded-xl border border-slate-800 bg-slate-950 p-3.5"><p className="flex items-center gap-2 text-xs font-bold text-cyan-300"><Globe className="h-4 w-4"/>What the original package does</p><p className="text-[11px] text-slate-400">The attached Python script drives the form, Save/Next and (when locally available) supporting-document uploads. It may attach to Chrome on CDP port 9222 or start an isolated browser. The app only prepares a download; it never opens a live portal session.</p><p className="text-[11px] text-amber-200">The selected candidate’s draft must be complete and checked before use. The original script retains unverified portal selectors, legacy fallback values and broad local-file discovery. Do not run the optional CDP launcher on a shared machine.</p></div>
    </div>
    <p className="rounded-lg border border-amber-700/40 bg-amber-950/20 p-3 text-[11px] text-amber-100">Two local downloads: the attached original automatically runs Save/Next without per-click prompts and may use CDP; the separate conservative assistant pauses and requires confirmations. Neither automates final submission. Apply reviewed AI suggestions to blank draft fields above before downloading if you want them in the selected-candidate package.</p>
    <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3"><p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">Reviewed draft field mapping checklist</p><div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3 lg:grid-cols-5">{details.map(([label,value])=><div key={label} className="min-w-0 rounded-lg border border-slate-800 bg-slate-900 p-2"><span className="block text-[10px] text-slate-500">{label}</span><span className="block truncate font-semibold text-slate-200">{value||'Not provided'}</span></div>)}</div></div>
    {prepared&&<p className="flex items-center gap-2 text-[11px] text-emerald-200"><CheckCircle2 className="h-4 w-4"/>Direct same-origin download links are ready for five minutes. If an embedded preview blocks downloads, open this app in a normal browser tab; do not rely on a blob download.</p>}
    {preview&&prepared&&<div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-4" role="dialog" aria-label="Standalone local Python script preview"><div className="flex max-h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-900"><div className="flex items-center justify-between gap-2 border-b border-slate-700 p-4"><strong className="text-sm">{prepared.files.local_py?.filename}</strong><div className="flex items-center gap-2">{link('local_py','Download .py',`${basic} border-emerald-500 bg-emerald-600 text-white`)}<button type="button" aria-label="Close script preview" onClick={()=>setPreview(false)}><X className="h-5 w-5"/></button></div></div><pre className="overflow-auto bg-slate-950 p-4 font-mono text-xs text-emerald-300">{prepared.localScript}</pre></div></div>}
  </section>;
};
