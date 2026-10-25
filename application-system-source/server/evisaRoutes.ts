import { Router } from 'express';
import { DBStore } from './dbStore.js';
import { newEvisaRecord } from '../src/evisa/defaults.js';
import { buildEvisaScripts } from './evisaScripts.js';
import { buildEvisaLocalPackage } from './evisaLocalPackage.js';
import { buildOriginalAutomationPackage } from './evisaOriginalPackage.js';
import { extractEvisaLabels } from './evisaLabelExtraction.js';
import { GoogleGenAI } from '@google/genai';
import { randomBytes } from 'node:crypto';
import JSZip from 'jszip';

const router = Router();
const groups = Object.keys(newEvisaRecord()).filter(key => typeof (newEvisaRecord() as any)[key] === 'object');
const scalarKeys = ['id','fileNumber','status','applicant_civil_status','notes','photoDataUrl','aiExtractedData','createdAt','updatedAt'];
const prohibited = /documents|supporting|cdp|agent|logs/i;

// Short-lived, unpredictable same-origin links let the browser download a real
// HTTP attachment rather than a blob: URL (often blocked in embedded/hosted views).
// Never persist generated applicant scripts to disk or expose predictable IDs.
const scriptDownloads=new Map<string,{expires:number;files:Record<string,{filename:string;body:string|Buffer;type:string}>}>();
router.post('/api/evisa-script-downloads', async (req,res) => {
  const applicant=req.body?.applicant;
  if (!applicant || typeof applicant !== 'object' || Array.isArray(applicant) || JSON.stringify(req.body).length>100000) {res.status(400).json({success:false,error:'Invalid draft data.'});return;}
  try {
    const generated=buildEvisaScripts(applicant,req.body?.config,req.body?.customXpaths);
    const safeName=String(applicant.fileNumber||'draft').replace(/[^A-Za-z0-9_-]/g,'').slice(0,35)||'draft';
    const files:Record<string,{filename:string;body:string|Buffer;type:string}>={
      selenium:{filename:'evisa_selenium_reference.py',body:generated.script,type:'text/x-python'},
      playwright:{filename:'playwright_visa_workflow.py',body:generated.playwright,type:'text/x-python'},
      playwright_full:{filename:`evisa_full_playwright_${safeName}.py`,body:generated.playwrightFull,type:'text/x-python'},
      playwright_js:{filename:'playwright_visa_workflow.cjs',body:generated.playwrightJs,type:'text/plain'},
      video_form:{filename:'video_form_workflow.py',body:generated.videoForm,type:'text/x-python'},
      personal_data_txt:{filename:'personal_data_applicant_workflow.txt',body:generated.personalDataTxt,type:'text/plain'},
      playwright_txt:{filename:'playwright_visa_workflow.txt',body:generated.playwrightTxt,type:'text/plain'},
      automation_steps_txt:{filename:'automation_steps.txt',body:generated.automationStepsTxt,type:'text/plain'}
    };
    const zip=new JSZip();
    for(const file of Object.values(files))zip.file(file.filename,file.body);
    zip.file('README.txt','Reviewed E-Visa local reference scripts. Dry-run by default. Install Python Selenium/Playwright separately if using --fill. Manual login, navigation, selector review, supporting documents and submission are NOT automated. No browser agent, CDP or batch launcher is included.\n');
    files.zip={filename:`evisa_reference_scripts_${safeName}.zip`,body:await zip.generateAsync({type:'nodebuffer',compression:'DEFLATE'}),type:'application/zip'};
    const local=buildEvisaLocalPackage(generated.plan,applicant.fileNumber,req.body?.localFolder,req.body?.config?.targetApplicationUrl||applicant.verificationUrl);
    files.local_py={filename:local.pythonFilename,body:local.script,type:'text/x-python'};
    files.local_bat={filename:local.batFilename,body:local.bat,type:'text/plain'};
    const localZip=new JSZip();
    localZip.file(local.pythonFilename,local.script);
    localZip.file(local.batFilename,local.bat);
    localZip.file('requirements.txt',local.requirements);
    localZip.file('README.txt',local.readme);
    files.local_zip={filename:`evisa_local_package_${safeName}.zip`,body:await localZip.generateAsync({type:'nodebuffer',compression:'DEFLATE'}),type:'application/zip'};
    let originalError='Enter a local folder and official e-Visa URL for the original automation package.';
    if(req.body?.localFolder && (req.body?.config?.targetApplicationUrl||applicant.verificationUrl)){
      try {
        const original=buildOriginalAutomationPackage(applicant,req.body.localFolder,req.body?.config?.targetApplicationUrl||applicant.verificationUrl);
        files.original_py={filename:original.pythonFilename,body:original.script,type:'text/x-python'};
        files.original_bat={filename:original.batFilename,body:original.bat,type:'text/plain'};
        files.original_cdp={filename:original.cdpFilename,body:original.cdp,type:'text/plain'};
        const originalZip=new JSZip();
        originalZip.file(original.pythonFilename,original.script);
        originalZip.file(original.batFilename,original.bat);
        originalZip.file(original.cdpFilename,original.cdp);
        originalZip.file('requirements.txt',original.requirements);
        originalZip.file('README.txt',original.readme);
        files.original_zip={filename:`evisa_original_automation_${safeName}.zip`,body:await originalZip.generateAsync({type:'nodebuffer',compression:'DEFLATE'}),type:'application/zip'};
        originalError='';
      }catch(error){originalError=error instanceof Error?error.message:'Could not prepare the original automation.';}
    }
    const now=Date.now();
    for(const [key,entry] of scriptDownloads)if(entry.expires<now || scriptDownloads.size>=100)scriptDownloads.delete(key);
    const token=randomBytes(24).toString('hex');
    scriptDownloads.set(token,{expires:now+5*60_000,files});
    res.setHeader('Cache-Control','no-store');
    res.json({success:true,...generated,localScript:local.script,originalError,files:Object.fromEntries(Object.entries(files).map(([kind,file])=>[kind,{filename:file.filename,href:`/api/evisa-script-downloads/${token}/${kind}`}]))});
  } catch {res.status(500).json({success:false,error:'Could not prepare script downloads.'});}
});
router.get('/api/evisa-script-downloads/:token/:kind',(req,res)=>{
  const entry=scriptDownloads.get(req.params.token);
  if(!entry || entry.expires<Date.now()){scriptDownloads.delete(req.params.token);res.status(404).json({error:'Download expired. Prepare the scripts again.'});return;}
  const file=entry.files[req.params.kind];
  if(!file){res.status(404).json({error:'Unknown script.'});return;}
  res.setHeader('Cache-Control','private, no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Content-Disposition',`attachment; filename="${file.filename}"`);
  res.type(file.type).send(file.body);
});

router.post('/api/generate-python-script', (req,res) => {
  const applicant=req.body?.applicant;
  if (!applicant || typeof applicant !== 'object' || JSON.stringify(req.body).length > 100000) {res.status(400).json({success:false,error:'Invalid draft data.'});return;}
  res.json({success:true,...buildEvisaScripts(applicant,req.body?.config,req.body?.customXpaths)});
});
router.get('/api/workflow-scripts', (_req,res) => { res.json({success:true,...buildEvisaScripts(newEvisaRecord(),{})}); });
router.post('/api/workflow-scripts', (req,res) => {
  const applicant=req.body?.applicant;
  if (!applicant || typeof applicant !== 'object' || JSON.stringify(req.body).length > 100000) {res.status(400).json({success:false,error:'Invalid draft data.'});return;}
  res.json({success:true,...buildEvisaScripts(applicant,req.body?.config,req.body?.customXpaths)});
});

// Optional e-v second-pass document audit. Never applies or certifies data.
router.post('/api/ai/audit-verification', async (req,res) => {
  const {extractedData,documentText,images,selectedModel}=req.body || {};
  if(!extractedData || typeof extractedData!=='object' || Array.isArray(extractedData) || JSON.stringify(extractedData).length>30000 || typeof documentText!=='string' || documentText.length>40000 || !Array.isArray(images) || images.length>5 || JSON.stringify(images).length>26000000) {res.status(400).json({success:false,error:'Provide a bounded structured extraction, source text and up to five source images.'});return;}
  if(!process.env.GEMINI_API_KEY) {res.status(503).json({success:false,error:'Private Gemini API key is not configured. Use the local Validation Audit for now.'});return;}
  if(images.some((img:any)=>typeof img?.base64!=='string'||!/^data:(?:image\/(?:png|jpeg|webp)|application\/pdf);base64,[A-Za-z0-9+/=]+$/.test(img.base64))) {res.status(400).json({success:false,error:'Use PNG/JPEG/WEBP or PDF source files only.'});return;}
  const model=selectedModel==='auto'?'gemini-2.5-flash':String(selectedModel||'gemini-2.5-flash');
  if(!['gemini-2.5-flash','gemini-2.5-flash-lite','gemini-flash-latest'].includes(model)){res.status(400).json({success:false,error:'Unsupported AI audit model.'});return;}
  try{
    const ai=new GoogleGenAI({apiKey:process.env.GEMINI_API_KEY});
    const parts:any[]=[{text:'Review this suggested e-visa extraction ONLY against the supplied source text and files. Return JSON with auditSummary (string) and fieldAudits array of {fieldId,label,extractedValue,docSource,status,notes}; status must be SUPPORTED, NEEDS_REVIEW, or NOT_FOUND. Missing source or uncertain reading must be NEEDS_REVIEW/NOT_FOUND. Never invent evidence and never claim legal or official verification. Suggested fields: '+JSON.stringify(extractedData)+'\nSource text: '+documentText}];
    for(const image of images)parts.push({inlineData:{mimeType:image.mimeType==='application/pdf'?'application/pdf':image.mimeType==='image/png'?'image/png':image.mimeType==='image/webp'?'image/webp':'image/jpeg',data:image.base64.split(',')[1]}});
    const response=await ai.models.generateContent({model,contents:[{role:'user',parts}],config:{responseMimeType:'application/json',temperature:0}});
    const parsed=JSON.parse(response.text||'{}');
    const auditReport={auditSummary:typeof parsed.auditSummary==='string'?parsed.auditSummary.slice(0,2000):'No summary provided.',fieldAudits:Array.isArray(parsed.fieldAudits)?parsed.fieldAudits.slice(0,120).map((item:any)=>({fieldId:String(item.fieldId||'').slice(0,100),label:String(item.label||'').slice(0,150),extractedValue:String(item.extractedValue||'').slice(0,500),docSource:String(item.docSource||'').slice(0,150),status:['SUPPORTED','NOT_FOUND'].includes(item.status)?item.status:'NEEDS_REVIEW',notes:String(item.notes||'').slice(0,500)})):[]};
    res.json({success:true,auditReport,modelUsed:model,warning:'This is an AI suggestion; verify against the original document manually.'});
  }catch(error){res.status(502).json({success:false,error:error instanceof Error?error.message:'AI audit failed.'});}
});

router.post('/api/ai/extract-data', async (req,res) => {
  const {documentText,images,selectedModel} = req.body || {};
  if (typeof documentText !== 'string' || documentText.length > 40000 || !Array.isArray(images) || images.length > 5 || JSON.stringify(images).length > 26000000) {res.status(400).json({success:false,error:'Provide text and up to five images (max 26 MB encoded).'});return;}
  const text=documentText.trim();
  if (!text.replace(/(?:Applicant|Spouse|Company|Other):/g,'').trim() && !images.length) {res.status(400).json({success:false,error:'Provide text or images to extract.'});return;}
  if (selectedModel === 'regex_offline') {
    if (images.length) {res.status(422).json({success:false,error:'Offline label matching accepts text only. Use local OCR on the Document OCR tab first, then paste the reviewed text here.'});return;}
    // Section-aware labelled fields; no guessed identity or travel details.
    const extractedData=extractEvisaLabels(text);
    if(!Object.keys(extractedData).length) {res.status(422).json({success:false,error:'No explicitly labelled fields found. Add lines such as Surname: ... and Passport Number: ...'});return;}
    res.json({success:true,extractedData,modelUsed:'Offline explicit-label matcher (text only)',usedFallback:false});return;
  }
  if (!process.env.GEMINI_API_KEY) {res.status(503).json({success:false,error:'Private Gemini API key is not configured. Select Offline Regex for labelled text, or use Document OCR for scanned images.'});return;}
  if (images.some((img:any)=>typeof img?.base64 !== 'string' || !/^data:(?:image\/(?:png|jpeg|webp)|application\/pdf);base64,[A-Za-z0-9+/=]+$/.test(img.base64))) {res.status(400).json({success:false,error:'AI extraction accepts PNG/JPEG/WEBP or PDF up to 6 MB per file.'});return;}
  try {
    const model = selectedModel === 'auto' ? 'gemini-2.5-flash' : String(selectedModel || 'gemini-2.5-flash');
    if (!['gemini-2.5-flash','gemini-2.5-flash-lite','gemini-flash-latest'].includes(model)) {res.status(400).json({success:false,error:'Unsupported Gemini model. Choose a listed model.'});return;}
    const ai=new GoogleGenAI({apiKey:process.env.GEMINI_API_KEY});
    const parts:any[]=[{text:'Extract ONLY explicit evidence in the text/images into JSON object sections PersonalData, TravelDocument, AddressData, SpouseData, FamilyData, CompanyContactData, HostData, CostAndMeansData, JourneyDetailsData, VisaRequestedDetails, VisaApplicationSelection. Field keys are snake_case matching the source. Never infer missing information, do not invent names, dates, nationality, occupation, or passport number. Exclude unsupported/sensitive fields. Return only valid JSON.\n'+text}];
    for (const image of images) parts.push({inlineData:{mimeType:image.mimeType === 'application/pdf' ? 'application/pdf' : image.mimeType === 'image/png' ? 'image/png' : image.mimeType === 'image/webp' ? 'image/webp' : 'image/jpeg',data:image.base64.split(',')[1]}});
    const response=await ai.models.generateContent({model,contents:[{role:'user',parts}],config:{responseMimeType:'application/json',temperature:0}});
    const parsed=JSON.parse(response.text || '{}');
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Gemini returned an invalid extraction.');
    const allowed=['PersonalData','TravelDocument','AddressData','SpouseData','FamilyData','CompanyContactData','HostData','CostAndMeansData','JourneyDetailsData','VisaRequestedDetails','VisaApplicationSelection'];
    const extractedData:Record<string,Record<string,string>>={};const defaults=newEvisaRecord() as any;
    const target:Record<string,string>={PersonalData:'personalData',TravelDocument:'travelDoc',AddressData:'addressData',SpouseData:'spouseData',FamilyData:'familyData',CompanyContactData:'companyContactData',HostData:'hostData',CostAndMeansData:'costAndMeansData',JourneyDetailsData:'journeyDetailsData',VisaRequestedDetails:'visaRequestedDetails',VisaApplicationSelection:'selection'};
    for (const section of allowed) if(parsed[section] && typeof parsed[section] === 'object') {
      const clean:Record<string,string>={};
      for(const [key,value] of Object.entries(parsed[section])) if(Object.prototype.hasOwnProperty.call(defaults[target[section]] || {},key) && typeof value === 'string' && value.trim()) clean[key]=value.trim().slice(0,500);
      if(Object.keys(clean).length) extractedData[section]=clean;
    }
    res.json({success:true,extractedData,modelUsed:model,usedFallback:false});
  } catch(error){res.status(502).json({success:false,error:error instanceof Error ? error.message : 'AI extraction failed.'});}
});

router.get('/api/evisa-applications', (_req,res) => {
  const db = DBStore.getInstance().get();
  res.json(db.evisa_applications.map(item => ({ applicant_id:item.applicant_id, name:db.applicants.find(p => p.applicant_id === item.applicant_id)?.full_name || '', fileNumber: String(item.data.fileNumber || ''), updated_at:item.updated_at })));
});
router.get('/api/evisa-applications/:id', (req,res) => {
  const item = DBStore.getInstance().get().evisa_applications.find(a => a.applicant_id === req.params.id);
  if (!item) { res.status(404).json({error:'No saved e-visa draft for this candidate.'}); return; }
  res.json(item);
});
router.put('/api/evisa-applications/:id', (req,res) => {
  const store = DBStore.getInstance(); const db=store.get();
  if (!db.applicants.some(p => p.applicant_id === req.params.id)) { res.status(404).json({error:'Select an existing registry candidate.'}); return; }
  const input=req.body?.data;
  if (!input || typeof input !== 'object' || Array.isArray(input) || JSON.stringify(input).length > 550000) { res.status(400).json({error:'Provide a valid e-visa draft smaller than 550 KB.'}); return; }
  const keys=Object.keys(input);
  if (keys.some(key => ![...groups,...scalarKeys].includes(key) || prohibited.test(key)) || groups.some(key => input[key] && (typeof input[key] !== 'object' || Array.isArray(input[key]) || Object.keys(input[key]).some(inner => prohibited.test(inner))))) {
    res.status(400).json({error:'Browser-agent, CDP logs and supporting-document fields are not accepted.'}); return;
  }
  const defaults=newEvisaRecord();
  if(input.photoDataUrl && (typeof input.photoDataUrl !== 'string' || input.photoDataUrl.length > 200000 || !/^data:image\/jpeg;base64,[a-zA-Z0-9+/=]+$/.test(input.photoDataUrl))) {res.status(400).json({error:'Biometric photo must be a processed JPEG under 200 KB (encoded).'});return;}
  const data: Record<string,unknown>={};
  for (const key of scalarKeys) if (typeof input[key] === 'string') data[key]=input[key].slice(0,key === 'photoDataUrl' ? 200000 : 2000);
  // Keep only structured field suggestions; never retain uploaded images, raw OCR
  // text, unsupported JSON keys or document metadata in the draft.
  if(input.aiExtractedData && typeof input.aiExtractedData==='object' && !Array.isArray(input.aiExtractedData)) {
    const map:Record<string,string>={PersonalData:'personalData',TravelDocument:'travelDoc',AddressData:'addressData',SpouseData:'spouseData',FamilyData:'familyData',CompanyContactData:'companyContactData',HostData:'hostData',CostAndMeansData:'costAndMeansData',JourneyDetailsData:'journeyDetailsData',VisaRequestedDetails:'visaRequestedDetails',VisaApplicationSelection:'selection'};
    const suggestions:Record<string,Record<string,string>>={};
    for(const [section,group] of Object.entries(map)){
      const proposed=input.aiExtractedData[section];
      if(!proposed || typeof proposed!=='object' || Array.isArray(proposed))continue;
      const fields:Record<string,string>={};
      for(const key of Object.keys((defaults as any)[group]||{}))if(typeof proposed[key]==='string' && proposed[key].trim())fields[key]=proposed[key].slice(0,500);
      if(Object.keys(fields).length)suggestions[section]=fields;
    }
    data.aiExtractedData=suggestions;
  }
  for (const group of groups) {
    const source=input[group] || {};
    const template=(defaults as any)[group] as Record<string,unknown>;
    const result: Record<string,unknown>={};
    for (const key of Object.keys(template)) {
      const value=source[key];
      if (typeof value === 'string') result[key]=value.slice(0,500);
      else if (typeof value === 'boolean') result[key]=value;
    }
    data[group]=result;
  }
  data.id=req.params.id; data.updatedAt=new Date().toISOString();
  const previous=db.evisa_applications.find(a => a.applicant_id === req.params.id);
  const item={ applicant_id:req.params.id, data, updated_at:String(data.updatedAt) };
  if (previous) Object.assign(previous,item); else db.evisa_applications.push(item);
  store.save();
  store.logActivity('Staff',req.params.id,db.applicants.find(p => p.applicant_id === req.params.id)?.full_name,'Embassy','Saved reviewed E-Visa draft (no browser-agent submission)');
  res.json({success:true,...item});
});
router.delete('/api/evisa-applications/:id', (req,res) => {
  const store=DBStore.getInstance(), db=store.get(); const index=db.evisa_applications.findIndex(a => a.applicant_id === req.params.id);
  if (index < 0) { res.status(404).json({error:'Draft not found.'}); return; }
  db.evisa_applications.splice(index,1); store.save(); res.json({success:true});
});
export default router;
