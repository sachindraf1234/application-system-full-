import { Router } from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createWorker, PSM } from 'tesseract.js';
import sharp from 'sharp';
import { suggestFields } from '../src/utils/ocrFields.js';
import { DBStore } from './dbStore.js';

const router = Router();
const modelDir = path.resolve(process.cwd(), 'ocr-models');
let jobQueue: Promise<unknown> = Promise.resolve();
const usage = new Map<string, { count: number; until: number }>();

async function ensureModel(lang: string) {
  const target = path.join(modelDir, `${lang}.traineddata`);
  try { await fs.access(target); return; } catch { /* optional language pack not yet installed */ }
  if (process.env.PUBLIC_DEMO === 'true' || process.env.OCR_ALLOW_MODEL_DOWNLOAD !== 'true') {
    throw new Error(`Language pack "${lang}" is not installed. Add ${lang}.traineddata from tesseract-ocr/tessdata_best to ocr-models, or enable OCR_ALLOW_MODEL_DOWNLOAD=true on a private server.`);
  }
  const response = await fetch(`https://raw.githubusercontent.com/tesseract-ocr/tessdata_best/main/${lang}.traineddata`, { signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`No official OCR model found for "${lang}".`);
  if (Number(response.headers.get('content-length')) > 30 * 1024 * 1024) throw new Error('OCR model exceeds the 30 MB download limit.');
  const chunks: Uint8Array[] = []; let bytes = 0;
  for await (const part of response.body as any) {
    bytes += part.length;
    if (bytes > 30 * 1024 * 1024) throw new Error('OCR model exceeds the 30 MB download limit.');
    chunks.push(part);
  }
  await fs.mkdir(modelDir, { recursive: true });
  await fs.writeFile(target + '.tmp', Buffer.concat(chunks));
  await fs.rename(target + '.tmp', target);
}

router.post('/api/ocr/local', async (req, res) => {
  const now = Date.now();
  const ip = req.ip || 'unknown';
  const previous = usage.get(ip);
  const rate = previous && previous.until > now ? previous : { count: 0, until: now + 60_000 };
  rate.count += 1; usage.set(ip, rate);
  if (rate.count > 12) { res.status(429).json({ error: 'Too many OCR requests. Retry in a minute.' }); return; }
  const images = req.body?.images;
  const languages = req.body?.languages;
  if (!Array.isArray(images) || images.length < 1 || images.length > 5 || !Array.isArray(languages) || languages.length < 1 || languages.length > 3 || !languages.every((l: unknown) => typeof l === 'string' && /^[a-z]{3}(?:_[a-z]{2,4})?$/.test(l))) {
    res.status(400).json({ error: 'Provide 1–5 PNG/JPEG/WEBP pages and 1–3 valid Tesseract language codes.' }); return;
  }
  const buffers: Buffer[] = [];
  for (const image of images) {
    if (typeof image !== 'string' || !/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(image)) {
      res.status(400).json({ error: 'Each OCR page must be a base64 PNG, JPEG or WEBP image.' }); return;
    }
    const buffer = Buffer.from(image.slice(image.indexOf(',') + 1), 'base64');
    if (!buffer.length || buffer.length > 6 * 1024 * 1024) { res.status(413).json({ error: 'OCR page must be smaller than 6 MB.' }); return; }
    buffers.push(buffer);
  }
  // Serialize CPU-intensive requests, including requests from different users.
  const job = jobQueue.catch(() => {}).then(async () => {
    // Private optional neural OCR, never a third-party upload. Tesseract stays available.
    const suryaUrl = process.env.SURYA_OCR_URL;
    if (suryaUrl) {
      try {
        const neural = await fetch(suryaUrl, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({images}), signal:AbortSignal.timeout(Math.min(300000, Math.max(10000, Number(process.env.SURYA_OCR_TIMEOUT_MS) || 180000))) });
        if (!neural.ok) throw new Error(`Surya service returned HTTP ${neural.status}`);
        const payload = await neural.json() as {engine?:string; pages?:Array<{text:string;confidence:number}>};
        if (!Array.isArray(payload.pages) || payload.pages.length !== images.length) throw new Error('Surya returned an invalid page count.');
        const pages = payload.pages.map(page => ({text:String(page.text || '').normalize('NFC'), confidence:Math.max(0,Math.min(100,Math.round(Number(page.confidence) || 0)))}));
        if (pages.some(page => page.text.trim())) {
          const text=pages.map((page,index)=>`--- Page ${index+1} ---\n${page.text}`).join('\n');
          const confidence=Math.round(pages.reduce((sum,page)=>sum+page.confidence,0)/pages.length);
          return {success:true,engine:'Surya v2 (private self-hosted)',languages,pages,text,confidence,suggestions:suggestFields(text,confidence)};
        }
        throw new Error('Surya did not return legible text.');
      } catch (error) { console.warn('Private Surya OCR unavailable; using bundled Tesseract:',error); }
    }
    for (const lang of languages) await ensureModel(lang);
    const worker = await createWorker(languages, 1, { langPath: modelDir, gzip: false, cacheMethod: 'none' });
    try {
      const pages = [];
      for (const buffer of buffers) {
        const original = await worker.recognize(buffer);
        const variants = [{text:(original.data.text || '').normalize('NFC'), confidence:Math.round(original.data.confidence || 0)}];
        try {
          const info = await sharp(buffer).metadata();
          const width=Math.min(2400,Math.max(info.width || 1000,Math.round((info.width || 1000)*1.7)));
          // CLAHE helps recover faded ink and unevenly lit old laminated cards.
          const base = sharp(buffer).rotate().resize({width,withoutEnlargement:false}).grayscale().clahe({width:3,height:3,maxSlope:3}).sharpen({sigma:1});
          const enhanced = await base.clone().png().toBuffer();
          await worker.setParameters({tessedit_pageseg_mode:PSM.AUTO});
          const pass = await worker.recognize(enhanced);
          variants.push({text:(pass.data.text || '').normalize('NFC'),confidence:Math.round(pass.data.confidence || 0)});
          if (Math.max(...variants.map(v => v.confidence)) < 77 || variants.every(v => suggestFields(v.text,v.confidence).length === 0)) {
            const thresholded = await sharp(enhanced).threshold(155).png().toBuffer();
            await worker.setParameters({tessedit_pageseg_mode:PSM.SPARSE_TEXT});
            const sparse = await worker.recognize(thresholded);
            variants.push({text:(sparse.data.text || '').normalize('NFC'),confidence:Math.round(sparse.data.confidence || 0)});
          }
        } catch (error) { console.warn('OCR enhancement unavailable; retaining original scan:',error); }
        finally { await worker.setParameters({tessedit_pageseg_mode:PSM.AUTO}); }
        // Accuracy is not inferred from OCR confidence alone: prefer passes
        // that recover legible *labeled* fields; still require operator review.
        const rank=(v:typeof variants[number])=>v.confidence + Math.min(4,suggestFields(v.text,v.confidence).length)*7;
        const chosen=[...variants].sort((a,b)=>rank(b)-rank(a))[0];
        const alternatives=variants.filter(v=>v !== chosen && v.text.trim() !== chosen.text.trim());
        pages.push({...chosen,alternatives});
      }
      const text = pages.map((page, index) => `--- Page ${index + 1} ---\n${page.text}`).join('\n');
      const confidence = Math.round(pages.reduce((sum, page) => sum + page.confidence, 0) / pages.length);
      return { success: true, engine: suryaUrl ? 'Multi-pass Tesseract.js (Surya unavailable)' : 'Multi-pass Tesseract.js (self-hosted)', languages, pages, text, confidence, suggestions: suggestFields(text, confidence) };
    } finally { await worker.terminate(); }
  });
  jobQueue = job;
  try { res.json(await job); }
  catch (error) { res.status(422).json({ error: error instanceof Error ? error.message : 'Local OCR failed.' }); }
});

// Shared review endpoint used by document-upload workspaces. Never creates a candidate
// and never applies unreviewed OCR suggestions to another person's record.
router.post('/api/applicants/:id/ocr-fields', (req, res) => {
  const dbStore = DBStore.getInstance();
  const db = dbStore.get();
  const person = db.applicants.find(candidate => candidate.applicant_id === req.params.id);
  if (!person) { res.status(404).json({ error: 'Select an existing candidate to apply reviewed OCR.' }); return; }
  const values = req.body?.fields;
  if (!values || typeof values !== 'object' || Array.isArray(values)) { res.status(400).json({ error: 'Reviewed fields are required.' }); return; }
  const accepted = new Set(['name','surname','passportNo','dateOfBirth','placeOfBirth','passportIssuedDate','passportValidTo','residence','phone','email','nationality','maritalStatus','professionalSkill','fatherName','motherName','nic_number','company_name','se_number','e_number','appointment_date','appointment_time','police_certified_date','police_certify_expire_date']);
  const keys = Object.keys(values);
  if (!keys.length || keys.length > 24 || keys.some(key => !accepted.has(key) || typeof values[key] !== 'string' || values[key].length > 180)) {
    res.status(400).json({ error: 'Only reviewed, supported text fields may be applied.' }); return;
  }
  const val = (key: string) => (values[key] || '').trim();
  const iso = (date: string) => { const match = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(date); return match ? `${match[3]}-${match[2].padStart(2,'0')}-${match[1].padStart(2,'0')}` : date; };
  const changed: string[] = [];
  if (val('name') && val('surname')) {
    person.other_name = val('name'); person.surname = val('surname'); person.full_name = `${val('name')} ${val('surname')}`; changed.push('name','surname');
  }
  const profileMap: Record<string, keyof typeof person> = { residence:'address', phone:'mobile_number', email:'email', nationality:'nationality', maritalStatus:'civil_status', professionalSkill:'preferred_job_category', fatherName:'father_name', motherName:'mother_name', nic_number:'nic_number' };
  for (const [source, target] of Object.entries(profileMap)) if (val(source)) { (person as any)[target] = val(source); changed.push(source); }
  if (val('dateOfBirth')) { person.date_of_birth = iso(val('dateOfBirth')); changed.push('dateOfBirth'); }
  const passportKeys = ['passportNo','placeOfBirth','passportIssuedDate','passportValidTo'];
  if (passportKeys.some(key => val(key))) {
    let passport = db.passports.find(item => item.applicant_id === person.applicant_id);
    if (!passport) { passport = { passport_id: dbStore.generateId('PP'), applicant_id: person.applicant_id, passport_number:'', place_of_birth:'', date_of_issue:'', date_of_expiry:'', passport_status:'With Applicant', remarks:'Reviewed OCR entry' }; db.passports.push(passport); }
    if (val('passportNo')) { passport.passport_number = val('passportNo'); changed.push('passportNo'); }
    if (val('placeOfBirth')) { passport.place_of_birth = val('placeOfBirth'); changed.push('placeOfBirth'); }
    if (val('passportIssuedDate')) { passport.date_of_issue = iso(val('passportIssuedDate')); changed.push('passportIssuedDate'); }
    if (val('passportValidTo')) { passport.date_of_expiry = iso(val('passportValidTo')); changed.push('passportValidTo'); }
  }
  const embassyKeys = ['company_name','se_number','e_number','appointment_date','appointment_time'];
  if (embassyKeys.some(key => val(key))) {
    let embassy = db.embassy_interviews.find(item => item.applicant_id === person.applicant_id);
    if (!embassy) {
      embassy = { interview_id: dbStore.generateId('EI'), applicant_id: person.applicant_id, se_number:'', e_number:'', company_name:'', appointment_date:'', appointment_time:'', insurance_status:'Pending', visa_status:'Pending', remarks:'Manually reviewed document fields' };
      db.embassy_interviews.push(embassy);
    }
    for (const key of embassyKeys) if (val(key)) { (embassy as any)[key] = key === 'appointment_date' ? iso(val(key)) : val(key); changed.push(key); }
  }
  const policeKeys = ['police_certified_date','police_certify_expire_date'];
  if (policeKeys.some(key => val(key))) {
    let checklist = db.document_checklists.find(item => item.applicant_id === person.applicant_id);
    if (!checklist) {
      checklist = { checklist_id: dbStore.generateId('DC'), applicant_id: person.applicant_id, passport_ready:false, agreement_ready:false, guarantee_letter_ready:false, police_report_ready:false, police_certified_ready:false, visa_d_ready:false, insurance_ready:false, passport_copy_ready:false, usd_ready:false, embassy_interview_ready:false, updated_at:new Date().toISOString(), updated_by:'Staff' } as any;
      db.document_checklists.push(checklist!);
    }
    for (const key of policeKeys) if (val(key)) { (checklist as any)[key] = iso(val(key)); changed.push(key); }
    checklist!.updated_at = new Date().toISOString();
  }
  if (!changed.length) { res.status(400).json({ error: 'No supported values were provided; a name needs both given name and surname.' }); return; }
  person.updated_at = new Date().toISOString();
  dbStore.save();
  dbStore.logActivity('System', person.applicant_id, person.full_name, 'Registration', `Applied manually reviewed local OCR fields: ${changed.join(', ')}`);
  res.json({ success: true, applicant_id: person.applicant_id, fieldsApplied: changed });
});

export default router;
