import React from 'react';
import {Cpu, Code, Settings, ShieldCheck, Sparkles, ScanText, Layers} from 'lucide-react';
import type {TargetStageMode} from '../types';
import {PIPELINE_STAGES} from '../stages';

export type StudioTab='schematics'|'ai'|'ocr'|'code'|'xpaths';
interface Props {activeTab:StudioTab; onTab:(tab:StudioTab)=>void; targetMode:TargetStageMode;onTargetMode:(mode:TargetStageMode)=>void;fileNumber:string}
const tabs:[StudioTab,string,React.ComponentType<{className?:string}>][]=[
  ['schematics','Master Schematics Data',Settings],
  ['ai','AI Extractor',Sparkles],
  ['ocr','Document OCR',ScanText],
  ['code','Python Selenium Code',Code],
  ['xpaths','DOM / XPath Inspector',ShieldCheck],
];

// The upstream e-v studio header restored within the registry-backed workspace.
// Excluded live/CDP/agent/document controls and status are intentionally absent.
export const EvisaStudioHeader:React.FC<Props>=({activeTab,onTab,targetMode,onTargetMode,fileNumber})=><header className="rounded-2xl bg-slate-900 border border-slate-800 text-slate-100 shadow-xl overflow-hidden">
  <div className="px-4 sm:px-6 lg:px-8">
    <div className="flex flex-wrap items-center justify-between gap-4 min-h-16 py-3">
      <div className="flex items-center space-x-3">
        <div className="bg-gradient-to-tr from-blue-600 to-cyan-500 p-2.5 rounded-xl shadow-lg shadow-blue-500/20"><Cpu className="w-6 h-6 text-white"/></div>
        <div><div className="flex flex-wrap items-center gap-2"><h2 className="text-lg font-bold bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">E-VISA Automation Studio</h2><span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/20">Draft preparation · No live portal session</span></div><p className="text-xs text-slate-400">Romanian E-Visa Application Workspace | File: <span className="font-mono text-cyan-400 font-semibold">{fileNumber||'Not assigned'}</span></p></div>
      </div>
      <label className="flex items-center gap-2 bg-slate-800/80 p-1.5 rounded-xl border border-slate-700/60 text-xs"><Layers className="w-4 h-4 text-cyan-400 ml-2"/><span className="font-medium text-slate-300">Stage Entry:</span><select aria-label="E-Visa stage entry" value={targetMode} onChange={e=>onTargetMode(e.target.value as TargetStageMode)} className="bg-slate-900 font-semibold text-cyan-300 border border-slate-700 rounded-lg px-2.5 py-1 focus:outline-none focus:ring-2 focus:ring-cyan-500"><option value="FULL_PIPELINE">FULL PIPELINE (All applicable stages)</option>{PIPELINE_STAGES.filter(stage=>stage.id!=='PHOTO_UPLOAD'&&stage.id!=='SUMMARY_FILE').map(stage=><option key={stage.id} value={stage.id}>{stage.name}</option>)}</select></label>
    </div>
    <nav aria-label="E-Visa studio sections" className="flex flex-wrap gap-1 pb-2 pt-1 border-t border-slate-800/80">
      {tabs.map(([id,label,Icon])=><button type="button" key={id} onClick={()=>onTab(id)} aria-current={activeTab===id?'page':undefined} className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${activeTab===id?'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30':'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'}`}><Icon className="w-3.5 h-3.5"/><span>{label}</span></button>)}
    </nav>
  </div>
</header>;
