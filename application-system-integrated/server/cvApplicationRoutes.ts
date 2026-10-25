import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { DBStore } from './dbStore.js';
import type { CVApplication } from './dbStore.js';
import type { CVData, AppFormat } from '../src/types.js';

const router = Router();
const store = DBStore.getInstance();
const formats: AppFormat[] = ['format1', 'format2', 'format3'];

const summary = (record: CVApplication) => ({
  application_id: record.application_id,
  applicant_id: record.applicant_id,
  format: record.format,
  name: [record.data.name, record.data.surname].filter(Boolean).join(' ').trim(),
  passportNo: record.data.passportNo || '',
  created_at: record.created_at,
  updated_at: record.updated_at
});

function validate(body: unknown): { applicant_id: string | null; format: AppFormat; data: CVData } | string {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return 'Application body is required.';
  const input = body as Record<string, unknown>;
  const data = input.data;
  if (!data || typeof data !== 'object' || Array.isArray(data)) return 'CV data must be an object.';
  const cv = data as CVData;
  if (typeof cv.name !== 'string' || typeof cv.surname !== 'string' || !(cv.name.trim() || cv.surname.trim())) {
    return 'Enter a candidate name before saving.';
  }
  if (typeof cv.passportNo !== 'string' || !Array.isArray(cv.careers) || !Array.isArray(cv.trainings)) {
    return 'CV data is incomplete. Please reload the form and try again.';
  }
  if (!formats.includes(input.format as AppFormat)) return 'Select a valid application format.';
  if (input.applicant_id != null && (typeof input.applicant_id !== 'string' || !store.get().applicants.some(a => a.applicant_id === input.applicant_id))) {
    return 'The linked Master Registry candidate does not exist.';
  }
  // Base64 supporting documents are permitted, but one CV should not grow the entire JSON database indefinitely.
  if (Buffer.byteLength(JSON.stringify(cv), 'utf8') > 25 * 1024 * 1024) {
    return 'Application exceeds the 25 MB storage limit. Remove large attachments before saving.';
  }
  return { applicant_id: (input.applicant_id as string) || null, format: input.format as AppFormat, data: cv };
}

router.get('/api/cv-applications', (_req, res) => {
  res.json(store.get().cv_applications.map(summary).sort((a, b) => b.updated_at.localeCompare(a.updated_at)));
});

router.get('/api/cv-applications/:id', (req, res) => {
  const record = store.get().cv_applications.find(a => a.application_id === req.params.id);
  if (!record) { res.status(404).json({ error: 'Application not found.' }); return; }
  res.json(record);
});

router.post('/api/cv-applications', (req, res) => {
  const input = validate(req.body);
  if (typeof input === 'string') { res.status(400).json({ error: input }); return; }
  const now = new Date().toISOString();
  const record = {
    application_id: `CV-${randomUUID()}`,
    applicant_id: input.applicant_id,
    format: input.format,
    data: input.data,
    created_at: now,
    updated_at: now
  };
  store.get().cv_applications.unshift(record);
  store.save();
  store.logActivity('System', record.applicant_id || undefined, summary(record).name, 'Application', `Created application ${record.application_id}`);
  res.status(201).json(record);
});

router.put('/api/cv-applications/:id', (req, res) => {
  const record = store.get().cv_applications.find(a => a.application_id === req.params.id);
  if (!record) { res.status(404).json({ error: 'Application not found.' }); return; }
  const input = validate(req.body);
  if (typeof input === 'string') { res.status(400).json({ error: input }); return; }
  record.applicant_id = input.applicant_id;
  record.format = input.format;
  record.data = input.data;
  record.updated_at = new Date().toISOString();
  store.save();
  store.logActivity('System', record.applicant_id || undefined, summary(record).name, 'Application', `Updated application ${record.application_id}`);
  res.json(record);
});

router.delete('/api/cv-applications/:id', (req, res) => {
  const db = store.get();
  const index = db.cv_applications.findIndex(a => a.application_id === req.params.id);
  if (index === -1) { res.status(404).json({ error: 'Application not found.' }); return; }
  const [removed] = db.cv_applications.splice(index, 1);
  store.save();
  store.logActivity('System', removed.applicant_id || undefined, summary(removed).name, 'Application', `Deleted application ${removed.application_id}`);
  res.json({ success: true });
});

export default router;
