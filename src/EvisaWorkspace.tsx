import React, { useEffect, useMemo, useState } from 'react';
import type { ApplicantOverview } from './types';
import type { ApplicantRecord, TargetStageMode } from './evisa/types';
import type { OCRSuggestion } from './utils/ocrFields';
import { ApplicantSchematicsEditor } from './evisa/components/ApplicantSchematicsEditor';
import { EvisaStudioHeader } from './evisa/components/EvisaStudioHeader';
import type { StudioTab } from './evisa/components/EvisaStudioHeader';
import { XPathInspector } from './evisa/components/XPathInspector';
import { PythonCodeGenerator } from './evisa/components/PythonCodeGenerator';
import { AiDocumentExtractor } from './evisa/components/AiDocumentExtractor';
import type { AutomationConfig } from './evisa/types';
import { LocalOCRPanel } from './components/LocalOCRPanel';
import { newEvisaRecord, recordFromRegistry, defaultEvisaConfig } from './evisa/defaults';

type Tab = StudioTab;
interface Props { applicants:ApplicantOverview[]; onBack:()=>void }
interface Summary { applicant_id:string; name:string; fileNumber:string; updated_at:string }

function dateParts(date: string) {
  const ymd = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(date);
  const dmy = /^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})$/.exec(date);
  return ymd ? [ymd[3],ymd[2],ymd[1]] : dmy ? [dmy[1],dmy[2],dmy[3]] : [];
}

export default function EvisaWorkspace({applicants,onBack}:Props) {
  const [record,setRecord]=useState<ApplicantRecord>(newEvisaRecord);
  const [candidateId,setCandidateId]=useState('');
  const [query,setQuery]=useState('');
  const [saved,setSaved]=useState<Summary[]>([]);
  const [activeTab,setActiveTab]=useState<Tab>('schematics');
  const [targetStage,setTargetStage]=useState<TargetStageMode>('FULL_PIPELINE');
  const [codeConfig,setCodeConfig]=useState<AutomationConfig>(defaultEvisaConfig);
  const [message,setMessage]=useState('');
  const [busy,setBusy]=useState(false);
  const [dirty,setDirty]=useState(false);
  const matches=useMemo(()=>applicants.filter(p=>[p.full_name,p.registration_number,p.passport_number].some(v=>(v||'').toLowerCase().includes(query.toLowerCase()))).slice(0,8),[applicants,query]);
  const refresh=async()=>{try {const r=await fetch('/api/evisa-applications');if(r.ok)setSaved(await r.json());}catch {/* keep editor usable */}};
  useEffect(()=>{void refresh();},[]);
  const choose=async(id:string)=>{
    if (dirty && !window.confirm('Discard unsaved E-Visa changes and open another candidate?')) return;
    setBusy(true);setMessage('');
    try {
      const existing=await fetch(`/api/evisa-applications/${encodeURIComponent(id)}`);
      if(existing.ok){const item=await existing.json();setRecord(item.data);setMessage('Opened saved E-Visa draft. Verify all fields before use.');}
      else {
        const response=await fetch(`/api/applicants/${encodeURIComponent(id)}`);
        if(!response.ok)throw new Error('Candidate profile could not be loaded.');
        const profile=await response.json();
        setRecord(recordFromRegistry(profile.profile,profile.passport,profile.embassy));
        setMessage('Prefilled only known registry, passport and embassy fields. Other fields remain blank.');
      }
      setCandidateId(id);setDirty(false);setActiveTab('schematics');setQuery('');setTargetStage('FULL_PIPELINE');setCodeConfig(defaultEvisaConfig);
    }catch(error){setMessage(error instanceof Error?error.message:'Could not load candidate.');}
    finally{setBusy(false);}
  };
  const update=(value:ApplicantRecord)=>{setRecord(value);setDirty(true);};
  const applyOcr=(items:OCRSuggestion[])=>{
    const values=Object.fromEntries(items.map(item=>[item.field,item.value]));
    const parts=dateParts(values.dateOfBirth||'');
    // Registry values and manual entries win by default. Clear a field first to replace it.
    const fill=(old:string,newValue?:string)=>old || newValue || '';
    setRecord(prev=>({ ...prev,
      personalData:{...prev.personalData,
        surname:fill(prev.personalData.surname,values.surname), first_names:fill(prev.personalData.first_names,values.name),
        dob_day:fill(prev.personalData.dob_day,parts[0]), dob_month:fill(prev.personalData.dob_month,parts[1]), dob_year:fill(prev.personalData.dob_year,parts[2]),
        place_of_birth:fill(prev.personalData.place_of_birth,values.placeOfBirth), phone_number:fill(prev.personalData.phone_number,values.phone),
        current_nationality:fill(prev.personalData.current_nationality,values.nationality), marital_status:fill(prev.personalData.marital_status,values.maritalStatus)},
      travelDoc:{...prev.travelDoc,passport_number:fill(prev.travelDoc.passport_number,values.passportNo),date_of_issue:fill(prev.travelDoc.date_of_issue,values.passportIssuedDate),valid_until:fill(prev.travelDoc.valid_until,values.passportValidTo)},
      addressData:{...prev.addressData,address:fill(prev.addressData.address,values.residence)},
      familyData:{...prev.familyData,father_first_name:fill(prev.familyData.father_first_name,values.fatherName),mother_first_name:fill(prev.familyData.mother_first_name,values.motherName)},
      companyContactData:{...prev.companyContactData,name:fill(prev.companyContactData.name,values.company_name)},
      fileNumber:fill(prev.fileNumber,values.e_number)
    }));
    setDirty(true);setActiveTab('schematics');setMessage('Reviewed OCR suggestions filled only blank fields. Existing registry/manual values were kept. To replace one, clear it and apply again; verify spelling before saving.');
  };
  const save=async()=>{
    if(!candidateId){setMessage('Select an existing registry candidate before saving.');return;}
    setBusy(true);setMessage('');
    try {const response=await fetch(`/api/evisa-applications/${encodeURIComponent(candidateId)}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({data:record})});const result=await response.json();if(!response.ok)throw new Error(result.error||'Could not save.');setRecord(result.data);setDirty(false);setMessage('E-Visa draft saved to the app database. No portal submission was made.');await refresh();}
    catch(error){setMessage(error instanceof Error?error.message:'Could not save.');}
    finally{setBusy(false);}
  };
  const remove=async()=>{if(!candidateId || !window.confirm('Delete this saved E-Visa draft? The registry candidate will not be deleted.'))return;const response=await fetch(`/api/evisa-applications/${encodeURIComponent(candidateId)}`,{method:'DELETE'});if(!response.ok){setMessage('Could not delete saved draft.');return;}setRecord(newEvisaRecord());setCandidateId('');setDirty(false);setMessage('Saved draft deleted.');await refresh();};
  const chooseStage=(stage:TargetStageMode)=>{setTargetStage(stage);setCodeConfig(prev=>({...prev,targetMode:stage}));setActiveTab('schematics');};
  const updateCodeConfig=(next:AutomationConfig)=>{setCodeConfig(next);setTargetStage(next.targetMode);};
  const name=applicants.find(p=>p.applicant_id===candidateId)?.full_name;

  return <div className="min-h-[720px] bg-slate-950 text-slate-100 rounded-2xl overflow-hidden" data-testid="evisa-workspace">
    <div className="flex flex-wrap items-center gap-3 border-b border-slate-700 bg-slate-900 p-4">
      <button type="button" onClick={()=>{if(!dirty || window.confirm('Leave E-Visa with unsaved changes?'))onBack();}} className="rounded border border-slate-600 px-3 py-2 text-xs font-bold">← Back</button>
      <div className="mr-auto"><h1 className="text-xl font-bold">E-Visa Application</h1><p className="text-[11px] text-slate-400">Integrated from e-v · draft preparation only · no supporting documents, live browser agent or CDP console</p></div>
      {candidateId && <span className="text-xs text-cyan-300">{name} · {candidateId}{dirty?' · Unsaved':''}</span>}
      <button type="button" onClick={()=>void save()} disabled={busy || !candidateId} title={!candidateId?'Select a registry candidate to enable saving':undefined} className="rounded bg-emerald-700 px-4 py-2 text-xs font-bold disabled:opacity-50">Save E-Visa Draft</button>
      {candidateId && <button type="button" onClick={()=>void remove()} disabled={busy} className="rounded border border-rose-700 px-3 py-2 text-xs text-rose-200 disabled:opacity-50">Delete saved draft</button>}
    </div>
    <div className="mx-auto max-w-7xl space-y-4 px-4 py-5">
      <div className="rounded-xl border border-slate-700 bg-slate-900 p-4">
        <label className="block text-xs font-bold text-slate-300">Search candidate by name to open or save an E-Visa draft</label>
        <input aria-label="Search E-Visa candidate" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Name, registration or passport…" className="mt-2 w-full rounded border border-slate-600 bg-slate-950 p-2 text-sm text-white" />
        {query.trim() && <div className="mt-2 flex max-h-40 flex-col overflow-auto">{matches.map(person=><button key={person.applicant_id} type="button" onClick={()=>void choose(person.applicant_id)} className="border-b border-slate-700 p-2 text-left text-xs hover:bg-slate-800">{person.full_name} · {person.registration_number || person.applicant_id}{saved.some(s=>s.applicant_id===person.applicant_id)?' · saved draft':''}</button>)}{!matches.length && <p className="p-2 text-xs text-slate-400">No matching registry candidates.</p>}</div>}
        {!candidateId && saved.length>0 && <div className="mt-3"><p className="text-xs text-slate-400">Saved drafts</p>{saved.slice(0,8).map(item=><button key={item.applicant_id} onClick={()=>void choose(item.applicant_id)} className="mr-2 mt-2 rounded border border-slate-600 px-3 py-1.5 text-xs">{item.name || item.applicant_id}</button>)}</div>}
      </div>
      {message && <p role="status" className="rounded border border-cyan-800 bg-cyan-950 p-2 text-xs text-cyan-100">{message}</p>}
      {!candidateId && <p className="rounded border border-amber-700/60 bg-amber-950/30 p-3 text-xs text-amber-100">The complete E-Visa studio is open below with blank applicant fields. Browse all sections now. Select an existing registry candidate above before editing anything you want to save; opening a candidate replaces this unsaved blank workspace. No sample person's data is loaded.</p>}
      <>
        <EvisaStudioHeader activeTab={activeTab} onTab={setActiveTab} targetMode={targetStage} onTargetMode={chooseStage} fileNumber={record.fileNumber} />
        {activeTab==='schematics' && <ApplicantSchematicsEditor applicant={record} onUpdateApplicant={update} targetStage={targetStage} />}
        {activeTab==='ai' && <AiDocumentExtractor applicant={record} onUpdateApplicant={update} />}
        {activeTab==='ocr' && <section className="space-y-3"><h2 className="text-lg font-bold">Review document OCR{candidateId?` for ${name}`:''}</h2><p className="text-xs text-amber-200">Private Surya neural OCR is preferred if configured; otherwise two-pass enhanced local Tesseract is used. Check every Sinhala character, name, passport and date before saving.</p><LocalOCRPanel onApply={applyOcr}/></section>}
        {activeTab==='code' && <PythonCodeGenerator applicant={record} config={codeConfig} onUpdateConfig={updateCodeConfig} />}
        {activeTab==='xpaths' && <XPathInspector/>}
      </>
    </div>
  </div>;
}
