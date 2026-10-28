import React, {useEffect,useState} from "react";
import { Code, Copy, Download, Check, RefreshCw, Settings, FileCode } from "lucide-react";
import type { ApplicantRecord, AutomationConfig, TargetStageMode } from "../types";
import { PIPELINE_STAGES } from "../stages";

interface PythonCodeGeneratorProps {
  applicant:ApplicantRecord;
  config:AutomationConfig;
  onUpdateConfig:(updated:AutomationConfig)=>void;
}
type ScriptTab="selenium"|"playwright_js"|"playwright"|"video_form"|"playwright_full"|"personal_data_txt"|"playwright_txt"|"automation_steps_txt";

// Original e-v tabbed studio layout, retaining its script/preflight panels.
// Only the explicitly excluded browser-launch, CDP and document-upload controls
// were removed. Content is generated from this candidate, not upstream samples.
export const PythonCodeGenerator:React.FC<PythonCodeGeneratorProps>=({applicant,config,onUpdateConfig})=>{
  const [activeTab,setActiveTab]=useState<ScriptTab>("selenium");
  const [scripts,setScripts]=useState<Record<string,string>>({});
  const [links,setLinks]=useState<Record<string,{filename:string;href:string}>>({});
  const [isGenerating,setIsGenerating]=useState(false);
  const [copied,setCopied]=useState(false);
  const [error,setError]=useState("");
  const [stageCount,setStageCount]=useState(0);
  const [fieldCount,setFieldCount]=useState(0);
  useEffect(()=>{
    const controller=new AbortController();setIsGenerating(true);setError("");setScripts({});setLinks({});
    let customXpaths={};try{customXpaths=JSON.parse(localStorage.getItem('evisa-reference-xpaths')||'{}');}catch{}
    fetch('/api/evisa-script-downloads',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({applicant:{...applicant,photoDataUrl:undefined},config,customXpaths}),signal:controller.signal})
      .then(async response=>{const data=await response.json();if(!response.ok||!data.success)throw Error(data.error||'Script generation failed');return data;})
      .then(data=>{if(controller.signal.aborted)return;setScripts({selenium:data.script,playwright:data.playwright,playwright_js:data.playwrightJs,video_form:data.videoForm,playwright_full:data.playwrightFull||data.playwright,personal_data_txt:data.personalDataTxt,playwright_txt:data.playwrightTxt,automation_steps_txt:data.automationStepsTxt});setLinks({...data.files,selenium:data.files.selenium});setStageCount(data.stageCount||0);setFieldCount(data.fieldCount||0);})
      .catch(reason=>{if(!controller.signal.aborted)setError(reason instanceof Error?reason.message:'Script generation failed');})
      .finally(()=>{if(!controller.signal.aborted)setIsGenerating(false);});
    return ()=>controller.abort();
  },[applicant,config]);
  const getActiveCode=()=>scripts[activeTab]||'# Generating candidate-specific reference...';
  const getActiveFilename=()=>({selenium:'evisa_selenium_reference.py',playwright:'playwright_visa_workflow.py',playwright_js:'playwright_visa_workflow.cjs',video_form:'video_form_workflow.py',playwright_full:`evisa_full_playwright_${String(applicant.fileNumber||'draft').replace(/[^a-zA-Z0-9_-]/g,'').slice(0,35)}.py`,personal_data_txt:'personal_data_applicant_workflow.txt',playwright_txt:'playwright_visa_workflow.txt',automation_steps_txt:'automation_steps.txt'})[activeTab];
  const handleCopyCode=async()=>{if(!scripts[activeTab])return;try{await navigator.clipboard.writeText(getActiveCode());setCopied(true);setTimeout(()=>setCopied(false),2000);}catch{setError('Clipboard unavailable. Download instead.');}};
  // Use a same-origin HTTP attachment, not a blob: URL; the link also supports
  // opening directly when a hosted browser blocks programmatic downloads.
  const downloadHref=links[activeTab]?.href;
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-800">
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
            <Code className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-100 flex items-center space-x-2">
              <span>e-VISA Complete Workflow Reference Scripts</span>
              <span className="bg-emerald-500/20 text-emerald-300 text-xs px-2 py-0.5 rounded-full font-mono font-semibold">
                Particulars → Host Details → Manual Review
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Candidate-specific Selenium and Playwright references for the original e-v form stages; no supporting-document upload, live agent or portal submission.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleCopyCode}
            disabled={isGenerating || !scripts[activeTab]}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition-colors disabled:opacity-50"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? "Copied!" : "Copy Active Script"}</span>
          </button>

          {downloadHref && scripts[activeTab] && !isGenerating ? <a
            href={downloadHref}
            download={getActiveFilename()}
            aria-label={`Download ${getActiveFilename()}`}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl border border-emerald-500 transition-all active:scale-95"
          ><Download className="w-4 h-4"/><span>Download {getActiveFilename()}</span></a> : <button type="button" disabled className="inline-flex items-center gap-1.5 rounded-xl bg-slate-700 px-3.5 py-2 text-xs font-bold text-slate-300 opacity-60"><Download className="h-4 w-4"/>{error?'Download unavailable':'Preparing script…'}</button>}


        </div>
      </div>

      {/* Script Framework Selector Tabs */}
      <div className="flex flex-wrap gap-2 mb-6 p-1.5 bg-slate-950 rounded-xl border border-slate-800">
        <button type="button" role="tab" aria-selected={activeTab === "selenium"} onClick={() => setActiveTab("selenium")} className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === "selenium" ? "bg-emerald-500 text-slate-950 shadow-md" : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"}`}><Code className="w-4 h-4"/><span>Python Selenium (evisa_selenium_reference.py)</span></button>
        <button
          onClick={() => setActiveTab("playwright")}
          className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
            activeTab === "playwright"
              ? "bg-emerald-500 text-slate-950 shadow-md"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
          }`}
        >
          <Code className="w-4 h-4" />
          <span>Playwright Python (playwright_visa_workflow.py)</span>
        </button>

        <button
          onClick={() => setActiveTab("playwright_js")}
          className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
            activeTab === "playwright_js"
              ? "bg-emerald-500 text-slate-950 shadow-md"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
          }`}
        >
          <FileCode className="w-4 h-4" />
          <span>Playwright Node.js (playwright_visa_workflow.cjs)</span>
        </button>

        <button
          onClick={() => setActiveTab("personal_data_txt")}
          className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
            activeTab === "personal_data_txt"
              ? "bg-cyan-500 text-slate-950 shadow-md"
              : "text-cyan-400 hover:text-cyan-200 hover:bg-slate-900"
          }`}
        >
          <FileCode className="w-4 h-4" />
          <span>📄 Personal Data Text Steps (.txt)</span>
        </button>

        <button
          onClick={() => setActiveTab("playwright_txt")}
          className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
            activeTab === "playwright_txt"
              ? "bg-cyan-500 text-slate-950 shadow-md"
              : "text-cyan-400 hover:text-cyan-200 hover:bg-slate-900"
          }`}
        >
          <FileCode className="w-4 h-4" />
          <span>📄 Pipeline Text Steps (.txt)</span>
        </button>

        <button
          onClick={() => setActiveTab("automation_steps_txt")}
          className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
            activeTab === "automation_steps_txt"
              ? "bg-cyan-500 text-slate-950 shadow-md"
              : "text-cyan-400 hover:text-cyan-200 hover:bg-slate-900"
          }`}
        >
          <FileCode className="w-4 h-4" />
          <span>📄 Automation Specs (.txt)</span>
        </button>

        <button
          onClick={() => setActiveTab("video_form")}
          className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
            activeTab === "video_form"
              ? "bg-emerald-500 text-slate-950 shadow-md"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
          }`}
        >
          <Code className="w-4 h-4" />
          <span>Reusable Module (video_form_workflow.py)</span>
        </button>

        <button
          onClick={() => setActiveTab("playwright_full")}
          className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
            activeTab === "playwright_full"
              ? "bg-emerald-500 text-slate-950 shadow-md"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
          }`}
        >
          <Settings className="w-4 h-4" />
          <span>Full Pipeline Playwright Script</span>
        </button>
      </div>

      <div className="bg-slate-950/80 border border-cyan-500/30 rounded-xl p-4 mb-6 text-xs text-slate-300 space-y-2">
        <h3 className="font-bold text-cyan-400">Upstream workflow reference · manual review required</h3>
        <p>Select a green script tab, then click the green Download button above. The downloaded Selenium and Playwright scripts include the current applicant values and run as dry-run plans by default. Their optional local --fill mode requires your explicit action and manual navigation through each stage. No scripts run in this web app; login, CAPTCHA, supporting documents and final submission are not automated.</p>
        <p>Python Selenium local fill: install selenium. Playwright Python local fill: install playwright and its Chromium browser. Node.js Playwright downloads as .cjs for compatibility with both CommonJS and ESM projects. All selectors must be checked against the current portal before use.</p>
        <p>Inspect the official portal DOM, then save selectors in DOM / XPath Inspector. Browser-local selector changes are used when this panel generates new code.</p>
        <p className="text-amber-300">{stageCount} stage references · {fieldCount} provided fields. Empty values are never invented.</p>
      </div>

      {/* Direct Application Link & Verification Link Configuration Box */}
      <div className="bg-slate-950 border border-emerald-500/30 rounded-xl p-4 mb-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <div className="flex items-center space-x-2">
            <span className="p-1.5 bg-emerald-500/20 text-emerald-400 rounded-lg">
              <Settings className="w-4 h-4" />
            </span>
            <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400">
              🔗 Reference Link Configuration
            </h3>
          </div>
          <span className="text-[10px] bg-emerald-500/10 text-emerald-300 px-2 py-0.5 rounded border border-emerald-500/20 font-mono">
            Manual navigation only
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-200 mb-1 flex items-center justify-between">
              <span>🎯 Summary of Visa Application File Link (Target URL)</span>
              <span className="text-[10px] text-emerald-400 font-normal">Review before using locally</span>
            </label>
            <input
              type="text"
              placeholder="e.g. https://evisa.mae.ro/eVisa/Summary/... or https://evisa.mae.ro/eVisa/Draft"
              value={config.targetApplicationUrl || ""}
              onChange={(e) => onUpdateConfig({ ...config, targetApplicationUrl: e.target.value })}
              className="w-full bg-slate-900 border border-slate-700 focus:border-emerald-500 rounded-xl px-3 py-2 text-xs font-mono text-emerald-300 placeholder-slate-600 focus:outline-none transition-all"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Paste the official application URL for your own reference. This web app never opens it or executes a browser agent.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-200 mb-1">
              <span>📧 Email Verification Link (Optional)</span>
            </label>
            <input
              type="text"
              placeholder="e.g. https://evisa.mae.ro/eVisa/Activate/... or verification link"
              value={config.verificationLink || ""}
              onChange={(e) => onUpdateConfig({ ...config, verificationLink: e.target.value })}
              className="w-full bg-slate-900 border border-slate-700 focus:border-cyan-500 rounded-xl px-3 py-2 text-xs font-mono text-cyan-300 placeholder-slate-600 focus:outline-none transition-all"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Optional reference only. Enter the password and CAPTCHA yourself in the official portal.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 mb-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div><label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Stage Entry Override</label>
          <select value={config.targetMode} onChange={e => onUpdateConfig({...config,targetMode:e.target.value as TargetStageMode})} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-cyan-300 font-semibold">
            <option value="FULL_PIPELINE">FULL PIPELINE REFERENCE</option>
            {PIPELINE_STAGES.filter(stage=>stage.id!=="PHOTO_UPLOAD"&&stage.id!=="SUMMARY_FILE").map(stage=><option key={stage.id} value={stage.id}>{stage.name}</option>)}
          </select>
        </div>
        <div><label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Element timeout (seconds in generated reference)</label><input type="number" min={1} max={30} value={config.elementWaitTimeoutSec} onChange={e=>onUpdateConfig({...config,elementWaitTimeoutSec:Number(e.target.value)||5})} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200" /></div>
      </div>

      {/* Code Display Area */}
      <div className="relative bg-slate-950 rounded-xl border border-slate-800 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900 border-b border-slate-800 text-xs font-mono text-slate-400">
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80"></span>
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80"></span>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80"></span>
            <span className="ml-2 text-slate-300 font-bold">
              {getActiveFilename()}
            </span>
          </div>
          {isGenerating && (
            <span className="text-cyan-400 flex items-center space-x-1">
              <RefreshCw className="w-3 h-3 animate-spin" />
              <span>Generating...</span>
            </span>
          )}
        </div>

        {error && <p role="alert" className="px-4 pt-3 text-xs text-rose-300">{error}</p>}
        <pre data-testid="evisa-generated-code" className="p-4 text-xs font-mono text-emerald-400 overflow-x-auto max-h-[500px] leading-relaxed">
          {getActiveCode()}
        </pre>
      </div>
    </div>
  );
};
