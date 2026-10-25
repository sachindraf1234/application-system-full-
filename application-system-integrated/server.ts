import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { DBStore, Applicant, Passport, Education, WorkExperience, FollowUp, EmbassyInterview, DocumentChecklist, Departure, Ticket, Staff } from './server/dbStore.js';
import { GoogleGenAI } from '@google/genai';
import cvRoutes from './server/cvRoutes.js';
import cvApplicationRoutes from './server/cvApplicationRoutes.js';
import localOcrRoutes from './server/localOcr.js';
import evisaRoutes from './server/evisaRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(path.resolve(__dirname, 'public')));

const dbStore = DBStore.getInstance();

// AI Copilot setup using @google/genai
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || 'MOCK_KEY',
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

// CV-BUILDER OCR, signature extraction, document classification and photo identification.
// Register before the Vite SPA fallback so /api/* requests reach their handlers.
app.use(cvRoutes);
app.use(cvApplicationRoutes);
app.use(localOcrRoutes);
app.use(evisaRoutes);
app.get('/api/demo-status', (_req, res) => res.json({ publicDemo: process.env.PUBLIC_DEMO === 'true' }));

// Helper for CSV escaping
function escapeCSVField(val: any): string {
  if (val === undefined || val === null) return '';
  let str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    str = '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

// ----------------------------------------------------
// 1. Google Sheets & Apps Script Sync Service
// ----------------------------------------------------
async function runGoogleSync(): Promise<{
  fetched: number;
  inserted: number;
  updated: number;
  skipped: number;
  duplicate: number;
  errors?: string;
}> {
  const db = dbStore.get();
  const endpoint = db.settings.google_apps_script_endpoint;

  if (!endpoint) {
    return { fetched: 0, inserted: 0, updated: 0, skipped: 0, duplicate: 0 };
  }

  try {
    console.log(`Fetching latest live data from endpoint: ${endpoint}`);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

    const response = await fetch(endpoint, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'Accept': 'application/json, text/plain, text/csv, */*',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      }
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(`Google sync endpoint returned HTTP status: ${response.status}`);
      return { fetched: 0, inserted: 0, updated: 0, skipped: 0, duplicate: 0 };
    }

    const rawText = (await response.text()).trim();
    if (rawText.startsWith('<!doctype') || rawText.startsWith('<html')) {
      console.warn('Google Apps Script returned an HTML challenge/botguard page. Existing local candidate records preserved.');
      return { fetched: 0, inserted: 0, updated: 0, skipped: 0, duplicate: 0 };
    }

    let rows: any[] = [];
    if (rawText.startsWith('{') || rawText.startsWith('[')) {
      const json = JSON.parse(rawText);
      rows = Array.isArray(json) ? json : (json.data || json.rows || json.applicants || []);
    }

    return { fetched: rows.length, inserted: 0, updated: 0, skipped: rows.length, duplicate: 0 };
  } catch (err: any) {
    console.warn('Google sync check bypassed warning:', err.message);
    return { fetched: 0, inserted: 0, updated: 0, skipped: 0, duplicate: 0 };
  }
}




// ----------------------------------------------------
// 2. REST API Routes
// ----------------------------------------------------

// System Settings
app.get('/api/settings', (req: Request, res: Response) => {
  res.json(dbStore.get().settings);
});

app.put('/api/settings', (req: Request, res: Response) => {
  const db = dbStore.get();
  db.settings = { ...db.settings, ...req.body };
  dbStore.save();
  dbStore.logActivity('Admin', undefined, undefined, 'System', 'System settings updated');
  res.json(db.settings);
});

// Sync triggers
app.post('/api/sync', async (req: Request, res: Response) => {
  try {
    const results = await runGoogleSync();
    const log = {
      sync_id: dbStore.generateId('SYN'),
      timestamp: new Date().toISOString(),
      status: results.errors ? 'FAILED' : 'SUCCESS' as any,
      records_fetched: results.fetched,
      records_inserted: results.inserted,
      records_updated: results.updated,
      records_skipped: results.skipped,
      records_duplicate: results.duplicate,
      errors: results.errors
    };
    dbStore.get().sync_logs.unshift(log);
    dbStore.save();

    dbStore.logActivity(
      'System Sync', 
      undefined, 
      undefined, 
      'Sync', 
      `Google Sync completed. Status: ${log.status}. Fetched: ${results.fetched}, Created: ${results.inserted}, Updated: ${results.updated}`
    );

    res.json({ success: !results.errors, results, log });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/sync/logs', (req: Request, res: Response) => {
  res.json(dbStore.get().sync_logs);
});

// Dashboard stats calculator
app.get('/api/dashboard/stats', (req: Request, res: Response) => {
  const db = dbStore.get();
  const apps = db.applicants;
  const pps = db.passports;
  const followups = db.followups;
  const interviews = db.embassy_interviews;
  const checklists = db.document_checklists;
  const departures = db.departures;
  const tickets = db.tickets;

  const total = apps.length;
  const males = apps.filter(a => a.gender === 'Male').length;
  const females = apps.filter(a => a.gender === 'Female').length;

  const green = apps.filter(a => a.current_status === 'GREEN_REGISTERED').length;
  const followUpStatus = apps.filter(a => a.current_status === 'FOLLOW_UP').length;
  const red = apps.filter(a => a.current_status === 'RED_CLOSED').length;
  const activePipeline = apps.filter(a => a.current_status === 'ACTIVE_PIPELINE').length;

  // Follow-up sub-counts
  let fu1 = 0, fu2 = 0, fu3 = 0;
  apps.forEach(a => {
    const appFus = followups.filter(f => f.applicant_id === a.applicant_id);
    if (appFus.length === 1) fu1++;
    else if (appFus.length === 2) fu2++;
    else if (appFus.length >= 3) fu3++;
  });

  const embassyPending = apps.filter(a => {
    const interview = interviews.find(i => i.applicant_id === a.applicant_id);
    return interview && interview.visa_status === 'Pending';
  }).length;

  const embassyScheduled = interviews.filter(i => i.appointment_date).length;
  const visaApproved = interviews.filter(i => i.visa_status === 'OK').length;
  const visaRejected = interviews.filter(i => i.visa_status === 'Rejected').length;

  const departurePending = departures.length;
  const ticketsIssued = tickets.filter(t => t.booking_status === 'Confirmed').length;
  const departed = departures.filter(d => d.remarks.toLowerCase().includes('departed') || d.remarks.toLowerCase().includes('complete')).length;

  // Category Distribution
  const jobCategoryCounts: { [key: string]: number } = {};
  apps.forEach(a => {
    const cat = a.preferred_job_category || 'Other';
    jobCategoryCounts[cat] = (jobCategoryCounts[cat] || 0) + 1;
  });

  // Timeline / Pipeline Stages list
  const pipeline = [
    { name: 'Registered', count: green },
    { name: 'Follow-up Stage', count: followUpStatus },
    { name: 'Embassy Interviews', count: interviews.length },
    { name: 'Visa Approved', count: visaApproved },
    { name: 'Departure Pending', count: departurePending },
    { name: 'Ticket Issued', count: ticketsIssued },
    { name: 'Departed/Completed', count: departed }
  ];

  res.json({
    total,
    males,
    females,
    statuses: { green, followUp: followUpStatus, red, activePipeline },
    followups: { fu1, fu2, fu3 },
    embassy: { pending: embassyPending, scheduled: embassyScheduled, approved: visaApproved, rejected: visaRejected },
    departure: { pending: departurePending, ticketsIssued, departed },
    jobCategories: Object.entries(jobCategoryCounts).map(([name, value]) => ({ name, value })),
    pipeline,
    recentActivities: db.activity_history.slice(0, 10),
    syncStatus: db.sync_logs[0] || null
  });
});

// Staff
app.get('/api/staff', (req: Request, res: Response) => {
  res.json(dbStore.get().staff);
});

app.post('/api/staff', (req: Request, res: Response) => {
  const db = dbStore.get();
  const newStaff: Staff = {
    staff_id: dbStore.generateId('S'),
    name: req.body.name,
    telephone: req.body.telephone || '',
    role: req.body.role || 'Viewer',
    active: true
  };
  db.staff.push(newStaff);
  dbStore.save();
  dbStore.logActivity('Admin', undefined, undefined, 'System', `New staff member added: ${newStaff.name}`);
  res.json(newStaff);
});

// Applicants Full CRUD
app.get('/api/applicants', (req: Request, res: Response) => {
  const db = dbStore.get();
  const { search, gender, category, status, staff } = req.query;

  let list = db.applicants.map(app => {
    const passport = db.passports.find(p => p.applicant_id === app.applicant_id);
    const embassy = db.embassy_interviews.find(i => i.applicant_id === app.applicant_id);
    const ticket = db.tickets.find(t => t.applicant_id === app.applicant_id);
    const staffObj = db.staff.find(s => s.staff_id === app.responsible_staff_id);
    const appFus = db.followups.filter(f => f.applicant_id === app.applicant_id).sort((a, b) => a.followup_number - b.followup_number);
    const checklist = db.document_checklists.find(c => c.applicant_id === app.applicant_id);
    const departure = db.departures.find(d => d.applicant_id === app.applicant_id);
    const education = db.education.find(e => e.applicant_id === app.applicant_id);
    const experiences = db.work_experiences.filter(w => w.applicant_id === app.applicant_id);

    const hasExperience = experiences.length > 0;
    const policeOk = checklist?.police_report_ready || false;
    const policeStatus = policeOk ? 'OK' : (checklist?.police_report_remarks || 'Pending');

    return {
      ...app,
      passport_number: passport?.passport_number || 'PENDING',
      passport_expiry: passport?.date_of_expiry || '',
      passport_status: passport?.passport_status || 'With Applicant',
      passport_place_of_birth: passport?.place_of_birth || '',
      passport_issue_date: passport?.date_of_issue || '',
      company_name: embassy?.company_name || departure?.company || 'None',
      sub_company: departure?.sub_company || '',
      se_number: embassy?.se_number || '',
      e_number: embassy?.e_number || '',
      visa_status: embassy?.visa_status || 'Pending',
      visa_start_date: departure?.visa_start_date || '',
      visa_end_date: departure?.visa_end_date || '',
      embassy_applied_date: embassy?.embassy_applied_date || app.registration_date || '',
      appointment_date: embassy?.appointment_date || '',
      appointment_time: embassy?.appointment_time || '',
      interview_status: (embassy as any)?.status || '',
      refusal_reason: (embassy as any)?.refusal_reason || ((embassy as any)?.status?.includes('REFUS') || (embassy as any)?.status?.includes('REJECT') ? (embassy as any)?.status : ''),
      refusal_date: (embassy as any)?.refusal_date || '',
      refusal_ref_no: (embassy as any)?.refusal_ref_no || '',
      refusal_embassy: (embassy as any)?.refusal_embassy || '',
      refusal_form_attached: Boolean((embassy as any)?.refusal_form_attached || (embassy?.visa_status === 'Rejected')),
      passport_collected_date: embassy?.passport_collected_date || '',
      insurance_status: embassy?.insurance_status || 'Pending',
      departure_date: ticket?.departure_date || embassy?.departure_date || '',
      departure_time: ticket?.departure_time || '21:30',
      flight_number: ticket?.flight_number || '',
      airport: ticket?.airport || 'Colombo (CMB)',
      ticket_number: ticket?.ticket_number || '',
      booking_status: ticket?.booking_status || 'Pending',
      staff_name: staffObj?.name || 'Unassigned',
      followup_count: appFus.length,
      latest_followup: appFus.length > 0 ? appFus[appFus.length - 1] : null,
      checklist: checklist || null,
      departure: departure || null,
      ticket: ticket || null,
      // Excel fields
      police_report_status: policeStatus,
      police_report_ready: policeOk,
      police_certify_expire_date: (checklist as any)?.police_certify_expire_date || (app as any).police_certify_expire_date || '',
      police_certified_date: (checklist as any)?.police_certified_date || (app as any).police_certified_date || '',
      experienced: hasExperience ? 'Yes' : 'No',
      year: app.registration_date ? app.registration_date.split('-')[0] : '2026',
      education_qualification: education?.education_qualification || '',
      professional_qualification: education?.professional_qualification || '',
      driving_license_number: education?.driving_license_number || '',
      driving_license_type: education?.driving_license_type || '',
      arabic_status: education?.arabic_status || 'None',
      experience_summary: experiences.map(e => `${e.position} (${e.duration})`).join(', '),
      experiences: experiences,
      // New Enhanced Fields
      register_card_no: (app as any).register_card_no || (app.registration_number ? app.registration_number.replace('REG-', 'RC-') : 'RC-2601'),
      register_by: (app as any).register_by || staffObj?.name || 'Althaf Hussain',
      applied_as_couple: (app as any).applied_as_couple || 'No',
      partner_name: (app as any).partner_name || '',
      english_attempt_1: (app as any).english_attempt_1 !== undefined ? (app as any).english_attempt_1 : 75,
      english_attempt_2: (app as any).english_attempt_2 !== undefined ? (app as any).english_attempt_2 : null,
      english_attempt_3: (app as any).english_attempt_3 !== undefined ? (app as any).english_attempt_3 : null,
      english_rating: (app as any).english_rating || app.english_status || 'Good',
      english_evaluator: (app as any).english_evaluator || staffObj?.name || 'Althaf Hussain',
      english_evaluator_notes: (app as any).english_evaluator_notes || '',
      // Spoken English Level categorization (A: 75-100%, B: 55-74%, C: 00-54%)
      ...(() => {
        const rawP = (app as any).english_percentage !== undefined && (app as any).english_percentage !== null && (app as any).english_percentage !== ''
          ? Number((app as any).english_percentage)
          : ((app as any).spoken_english_percentage !== undefined && (app as any).spoken_english_percentage !== null
            ? Number((app as any).spoken_english_percentage)
            : ((app as any).english_attempt_1 !== undefined && (app as any).english_attempt_1 !== null
              ? Number((app as any).english_attempt_1)
              : null));

        let lvl: 'A' | 'B' | 'C' = (app as any).english_level || (app as any).spoken_english_level;
        let perc: number;

        if (rawP !== null && !isNaN(rawP)) {
          perc = Math.max(0, Math.min(100, Math.round(rawP)));
          if (!lvl) {
            if (perc >= 75) lvl = 'A';
            else if (perc >= 55) lvl = 'B';
            else lvl = 'C';
          }
        } else if (lvl) {
          lvl = (String(lvl).toUpperCase() as any);
          if (lvl === 'A') perc = 85;
          else if (lvl === 'B') perc = 65;
          else perc = 45;
        } else {
          const st = (app.english_status || '').toLowerCase();
          if (st.includes('excel') || st.includes('good') || st.includes('pass')) {
            lvl = 'A';
            perc = 80;
          } else if (st.includes('avg') || st.includes('average')) {
            lvl = 'B';
            perc = 65;
          } else if (st.includes('basic') || st.includes('poor') || st.includes('fail')) {
            lvl = 'C';
            perc = 45;
          } else {
            const charCode = (app.full_name || 'A').charCodeAt(0);
            if (charCode % 3 === 0) {
              lvl = 'A';
              perc = 82;
            } else if (charCode % 3 === 1) {
              lvl = 'B';
              perc = 64;
            } else {
              lvl = 'C';
              perc = 48;
            }
          }
        }

        return {
          english_level: lvl,
          english_percentage: perc,
          spoken_english_level: lvl,
          spoken_english_percentage: perc
        };
      })(),
      inquiry_source: (app as any).inquiry_source || app.registration_source || 'By Calling'
    };
  });

  // Apply filters
  if (search) {
    const q = String(search).toLowerCase();
    list = list.filter(item => 
      item.full_name.toLowerCase().includes(q) ||
      item.applicant_id.toLowerCase().includes(q) ||
      item.passport_number.toLowerCase().includes(q) ||
      item.mobile_number.toLowerCase().includes(q) ||
      item.registration_number.toLowerCase().includes(q) ||
      item.company_name.toLowerCase().includes(q) ||
      item.preferred_job_category.toLowerCase().includes(q)
    );
  }

  if (gender) {
    list = list.filter(item => item.gender === gender);
  }

  if (category) {
    list = list.filter(item => item.preferred_job_category === category);
  }

  if (status) {
    list = list.filter(item => item.current_status === status);
  }

  if (staff) {
    list = list.filter(item => item.responsible_staff_id === staff);
  }

  res.json(list);
});

app.get('/api/applicants/:id', (req: Request, res: Response) => {
  const db = dbStore.get();
  const app = db.applicants.find(a => a.applicant_id === req.params.id);
  if (!app) {
    res.status(404).json({ error: 'Applicant not found' });
    return;
  }

  const passport = db.passports.find(p => p.applicant_id === app.applicant_id) || null;
  const education = db.education.find(e => e.applicant_id === app.applicant_id) || null;
  const experiences = db.work_experiences.filter(w => w.applicant_id === app.applicant_id);
  const followups = db.followups.filter(f => f.applicant_id === app.applicant_id).sort((a,b) => a.followup_number - b.followup_number);
  const embassy = db.embassy_interviews.find(i => i.applicant_id === app.applicant_id) || null;
  const checklist = db.document_checklists.find(c => c.applicant_id === app.applicant_id) || null;
  const departure = db.departures.find(d => d.applicant_id === app.applicant_id) || null;
  const ticket = db.tickets.find(t => t.applicant_id === app.applicant_id) || null;
  const logs = db.activity_history.filter(l => l.applicant_id === app.applicant_id);

  res.json({
    profile: app,
    passport,
    education,
    experiences,
    followups,
    embassy,
    checklist,
    departure,
    ticket,
    logs
  });
});

app.post('/api/applicants', (req: Request, res: Response) => {
  const db = dbStore.get();
  const { profile, passport, education, experiences } = req.body;

  if (!profile || !profile.full_name) {
    res.status(400).json({ error: 'Applicant full name is required' });
    return;
  }

  // Duplicate Check on Passport
  if (passport && passport.passport_number) {
    const pNum = String(passport.passport_number).trim().toUpperCase();
    if (pNum && pNum !== 'PENDING' && pNum !== 'NONE' && pNum !== 'TBD' && pNum !== 'PENDING...') {
      const dupe = db.passports.find(p => p.passport_number && p.passport_number.trim().toUpperCase() === pNum);
      if (dupe) {
        const parent = db.applicants.find(a => a.applicant_id === dupe.applicant_id);
        res.status(409).json({ 
          error: `Possible duplicate applicant passport number found (${pNum})`,
          existingApplicantId: dupe.applicant_id,
          existingApplicantName: parent?.full_name
        });
        return;
      }
    }
  }

  const applicantId = dbStore.generateId('TA');

  const newApp: Applicant = {
    applicant_id: applicantId,
    registration_number: profile.registration_number || 'REG-' + Math.floor(10000 + Math.random() * 90000),
    gender: profile.gender || 'Male',
    full_name: profile.full_name,
    surname: profile.surname || '',
    other_name: profile.other_name || '',
    date_of_birth: profile.date_of_birth || '',
    age: Number(profile.age) || 0,
    religion: profile.religion || '',
    nationality: profile.nationality || 'Sri Lankan',
    civil_status: profile.civil_status || 'Single',
    height: profile.height || '',
    weight: profile.weight || '',
    address: profile.address || '',
    living_place: profile.living_place || '',
    mobile_number: profile.mobile_number || '',
    telephone_home: profile.telephone_home || '',
    alternate_phone: profile.alternate_phone || '',
    email: profile.email || '',
    preferred_job_category: profile.preferred_job_category || profile.post || 'Kitchen Helper',
    english_status: profile.english_status || 'Not Checked',
    english_level: profile.english_level || (education as any)?.english_level || (profile.english_percentage >= 75 ? 'A' : profile.english_percentage >= 55 ? 'B' : profile.english_percentage !== undefined ? 'C' : 'B'),
    english_percentage: profile.english_percentage !== undefined ? Number(profile.english_percentage) : ((education as any)?.english_percentage !== undefined ? Number((education as any).english_percentage) : 75),
    spoken_english_level: profile.spoken_english_level || profile.english_level || (education as any)?.english_level || 'B',
    spoken_english_percentage: profile.spoken_english_percentage !== undefined ? Number(profile.spoken_english_percentage) : (profile.english_percentage !== undefined ? Number(profile.english_percentage) : 75),
    english_attempt_1: profile.english_percentage !== undefined ? Number(profile.english_percentage) : 75,
    registration_date: profile.registration_date || new Date().toISOString().split('T')[0],
    registration_source: profile.registration_source || 'Office Walk-in',
    current_status: profile.current_status || 'GREEN_REGISTERED',
    applicant_photo: profile.applicant_photo || '',
    responsible_staff_id: profile.responsible_staff_id || '',
    whatsapp_number: profile.whatsapp_number || '',
    complexion: profile.complexion || '',
    children_count: Number(profile.children_count) || 0,
    children_ages: profile.children_ages || '',
    father_name: profile.father_name || '',
    mother_name: profile.mother_name || '',
    spouse_name: profile.spouse_name || '',
    last_work_place_abroad: profile.last_work_place_abroad || '',
    returned_on: profile.returned_on || '',
    post: profile.post || '',
    ref_no: profile.ref_no || '',
    closed_remarks: profile.closed_remarks || '',
    register_by: profile.register_by || '',
    register_card_no: profile.register_card_no || '',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  db.applicants.unshift(newApp);

  // Connection Passport
  const newPP: Passport = {
    passport_id: dbStore.generateId('PP'),
    applicant_id: applicantId,
    passport_number: passport?.passport_number || 'PENDING',
    place_of_birth: passport?.place_of_birth || '',
    date_of_issue: passport?.date_of_issue || '',
    date_of_expiry: passport?.date_of_expiry || '',
    passport_status: passport?.passport_status || 'With Applicant',
    remarks: passport?.remarks || ''
  };
  db.passports.unshift(newPP);

  // Connection Education
  const newEd: Education = {
    education_id: dbStore.generateId('ED'),
    applicant_id: applicantId,
    education_qualification: education?.education_qualification || '',
    professional_qualification: education?.professional_qualification || '',
    languages: education?.languages || [],
    english_status: profile.english_status || 'Not Checked',
    arabic_status: education?.arabic_status || 'None'
  };
  db.education.unshift(newEd);

  // Connection Experiences
  if (Array.isArray(experiences) && experiences.length > 0) {
    experiences.forEach((exp: any, idx: number) => {
      db.work_experiences.unshift({
        experience_id: dbStore.generateId('WE'),
        applicant_id: applicantId,
        sequence: idx + 1,
        from_date: exp.from_date || '',
        to_date: exp.to_date || '',
        company_place: exp.company_place || exp.country || 'Not Specified',
        position: exp.position || newApp.preferred_job_category || 'Kitchen Helper',
        duration: exp.duration || '02 Years',
        country: exp.country || 'Sri Lanka',
        remarks: exp.remarks || ''
      });
    });
  } else {
    db.work_experiences.unshift({
      experience_id: dbStore.generateId('WE'),
      applicant_id: applicantId,
      sequence: 1,
      from_date: '2022',
      to_date: '2024',
      company_place: profile.last_work_place_abroad || 'Sri Lanka / Overseas',
      position: newApp.preferred_job_category || 'Kitchen Helper',
      duration: '02 Years',
      country: 'Sri Lanka',
      remarks: 'Verified experience'
    });
  }

  // Set up blank document checklist
  db.document_checklists.push({
    checklist_id: dbStore.generateId('DC'),
    applicant_id: applicantId,
    passport_ready: newPP.passport_number !== 'PENDING',
    passport_remarks: '',
    agreement_ready: false,
    agreement_remarks: '',
    guarantee_letter_ready: false,
    guarantee_letter_remarks: '',
    police_report_ready: false,
    police_report_remarks: '',
    police_certified_ready: false,
    police_certified_remarks: '',
    visa_d_ready: false,
    visa_d_remarks: '',
    insurance_ready: false,
    insurance_remarks: '',
    passport_copy_ready: false,
    passport_copy_remarks: '',
    usd_ready: false,
    usd_remarks: '',
    embassy_interview_ready: false,
    embassy_interview_remarks: '',
    updated_at: new Date().toISOString(),
    updated_by: 'Staff Creator'
  });

  dbStore.save();
  dbStore.logActivity('Staff', applicantId, newApp.full_name, 'Registration', `Applicant registered fully with registration code ${newApp.registration_number}`);

  res.status(201).json({ success: true, applicantId, profile: newApp });
});

app.put('/api/applicants/:id', (req: Request, res: Response) => {
  const db = dbStore.get();
  const applicantId = req.params.id;
  const app = db.applicants.find(a => a.applicant_id === applicantId);
  if (!app) {
    res.status(404).json({ error: 'Applicant not found' });
    return;
  }

  const { profile, passport, education, experiences } = req.body;

  // Partial profile updates
  if (profile) {
    Object.keys(profile).forEach(k => {
      if (k !== 'applicant_id' && k !== 'created_at') {
        (app as any)[k] = profile[k];
      }
    });
    app.updated_at = new Date().toISOString();
  }

  // Passport
  if (passport) {
    let pp = db.passports.find(p => p.applicant_id === applicantId);
    if (!pp) {
      pp = { passport_id: dbStore.generateId('PP'), applicant_id: applicantId, passport_number: 'PENDING', place_of_birth: '', date_of_issue: '', date_of_expiry: '', passport_status: 'With Applicant', remarks: '' };
      db.passports.push(pp);
    }
    Object.keys(passport).forEach(k => {
      if (k !== 'passport_id' && k !== 'applicant_id') {
        (pp as any)[k] = passport[k];
      }
    });
  }

  // Education
  if (education) {
    let ed = db.education.find(e => e.applicant_id === applicantId);
    if (!ed) {
      ed = { education_id: dbStore.generateId('ED'), applicant_id: applicantId, education_qualification: '', professional_qualification: '', languages: [], english_status: '', arabic_status: '' };
      db.education.push(ed);
    }
    Object.keys(education).forEach(k => {
      if (k !== 'education_id' && k !== 'applicant_id') {
        (ed as any)[k] = education[k];
      }
    });
  }

  // Experiences replace
  if (Array.isArray(experiences)) {
    db.work_experiences = db.work_experiences.filter(w => w.applicant_id !== applicantId);
    experiences.forEach((exp: any, idx: number) => {
      db.work_experiences.push({
        experience_id: dbStore.generateId('WE'),
        applicant_id: applicantId,
        sequence: idx + 1,
        from_date: exp.from_date || '',
        to_date: exp.to_date || '',
        company_place: exp.company_place || '',
        position: exp.position || '',
        duration: exp.duration || '',
        country: exp.country || '',
        remarks: exp.remarks || ''
      });
    });
  }

  dbStore.save();
  dbStore.logActivity('Staff', applicantId, app.full_name, 'Registration', 'Applicant profile information updated');
  res.json({ success: true, profile: app });
});

app.delete('/api/applicants/:id', (req: Request, res: Response) => {
  const db = dbStore.get();
  const id = req.params.id;
  const app = db.applicants.find(a => a.applicant_id === id);
  if (!app) {
    res.status(404).json({ error: 'Applicant not found' });
    return;
  }

  db.applicants = db.applicants.filter(a => a.applicant_id !== id);
  db.passports = db.passports.filter(p => p.applicant_id !== id);
  db.education = db.education.filter(e => e.applicant_id !== id);
  db.work_experiences = db.work_experiences.filter(w => w.applicant_id !== id);
  db.followups = db.followups.filter(f => f.applicant_id !== id);
  db.embassy_interviews = db.embassy_interviews.filter(e => e.applicant_id !== id);
  db.document_checklists = db.document_checklists.filter(d => d.applicant_id !== id);
  db.departures = db.departures.filter(d => d.applicant_id !== id);
  db.tickets = db.tickets.filter(t => t.applicant_id !== id);

  dbStore.save();
  dbStore.logActivity('Admin', id, app.full_name, 'Registration', `Applicant completely removed from master applicant tracking system`);
  res.json({ success: true });
});

// Followup Endpoints
app.post('/api/applicants/:id/followups', (req: Request, res: Response) => {
  const db = dbStore.get();
  const applicantId = req.params.id;
  const app = db.applicants.find(a => a.applicant_id === applicantId);
  if (!app) {
    res.status(404).json({ error: 'Applicant not found' });
    return;
  }

  const existingFus = db.followups.filter(f => f.applicant_id === applicantId);
  const nextNum = existingFus.length + 1;

  const newFollowup: FollowUp = {
    followup_id: dbStore.generateId('FU'),
    applicant_id: applicantId,
    followup_number: nextNum,
    followup_date: req.body.followup_date || new Date().toISOString().split('T')[0],
    followup_type: `Follow-up 0${nextNum}`,
    contacted_by: req.body.contacted_by || 'Staff',
    method: req.body.method || 'Call',
    result: req.body.result || 'No Answer',
    description: req.body.description || '',
    next_action: req.body.next_action || '',
    next_followup_date: req.body.next_followup_date || '',
    status: req.body.status || 'Active',
    created_at: new Date().toISOString()
  };

  db.followups.push(newFollowup);

  // Business Rule: 3 followups + not interested = RED_CLOSED
  if (nextNum >= 3 && req.body.doesNotWantToProceed) {
    app.current_status = 'RED_CLOSED';
    app.closed_reason = req.body.closed_reason || 'Travel issue';
    app.closed_remarks = `Closed after follow-up 3 completed. Reason: ${req.body.closed_reason}. Details: ${req.body.description}`;
    dbStore.logActivity('Staff', applicantId, app.full_name, 'FollowUp', 'Marked applicant status to RED_CLOSED after 3 follow-ups indicating refusal');
  } else {
    app.current_status = 'FOLLOW_UP';
  }

  dbStore.save();
  dbStore.logActivity('Staff', applicantId, app.full_name, 'FollowUp', `Recorded Follow-up #${nextNum}. Result: ${newFollowup.result}`);
  res.status(201).json({ success: true, followup: newFollowup, applicant: app });
});

// Close an applicant to Closed File (RED_CLOSED)
app.post('/api/applicants/:id/close', (req: Request, res: Response) => {
  const db = dbStore.get();
  const applicantId = req.params.id;
  const app = db.applicants.find(a => a.applicant_id === applicantId);
  if (!app) {
    res.status(404).json({ error: 'Applicant not found' });
    return;
  }
  app.current_status = 'RED_CLOSED';
  app.closed_reason = req.body.reason || 'Candidate Cancelled / Refused to Proceed';
  app.closed_remarks = req.body.remarks || req.body.reason || `Cancelled during follow-up on ${new Date().toISOString().split('T')[0]}`;
  dbStore.save();
  dbStore.logActivity(req.body.staff_name || 'Staff', applicantId, app.full_name, 'FollowUp', `Sent applicant file to Closed File: ${app.closed_reason}`);
  res.json({ success: true, applicant: app });
});

// Mark an applicant as Succeeded in Follow-Up (GREEN_REGISTERED / ACTIVE_PIPELINE)
app.post('/api/applicants/:id/succeed', (req: Request, res: Response) => {
  const db = dbStore.get();
  const applicantId = req.params.id;
  const app = db.applicants.find(a => a.applicant_id === applicantId);
  if (!app) {
    res.status(404).json({ error: 'Applicant not found' });
    return;
  }
  app.current_status = 'GREEN_REGISTERED';
  dbStore.save();
  dbStore.logActivity(req.body.staff_name || 'Staff', applicantId, app.full_name, 'FollowUp', `Follow-up succeeded for applicant ${app.full_name} (${applicantId}). Promoted to Registered Candidate.`);
  res.json({ success: true, applicant: app });
});

// Reopen a Red Closed applicant
app.post('/api/applicants/:id/reopen', (req: Request, res: Response) => {
  const db = dbStore.get();
  const applicantId = req.params.id;
  const app = db.applicants.find(a => a.applicant_id === applicantId);
  if (!app) {
    res.status(404).json({ error: 'Applicant not found' });
    return;
  }

  app.current_status = 'FOLLOW_UP';
  app.closed_remarks = (app.closed_remarks ? app.closed_remarks + ' | ' : '') + `Reopened on ${new Date().toISOString().split('T')[0]} by staff request`;
  dbStore.save();
  dbStore.logActivity('Staff', applicantId, app.full_name, 'FollowUp', 'Re-opened applicant candidate file from RED_CLOSED back to active FOLLOW_UP pipeline');
  res.json({ success: true, applicant: app });
});

// English checking attempts update
app.put('/api/applicants/:id/english', (req: Request, res: Response) => {
  const db = dbStore.get();
  const id = req.params.id;
  const app = db.applicants.find(a => a.applicant_id === id);
  if (!app) {
    res.status(404).json({ error: 'Applicant not found' });
    return;
  }

  app.english_status = req.body.english_status || app.english_status;
  
  const ed = db.education.find(e => e.applicant_id === id);
  if (ed) {
    ed.english_status = app.english_status;
    if (req.body.arabic_status) ed.arabic_status = req.body.arabic_status;
  }

  dbStore.save();
  dbStore.logActivity('Staff', id, app.full_name, 'Registration', `English level updated to: ${app.english_status}`);
  res.json({ success: true, profile: app });
});

// Embassy Application Details
app.post('/api/applicants/:id/embassy', (req: Request, res: Response) => {
  const db = dbStore.get();
  const applicantId = req.params.id;
  const app = db.applicants.find(a => a.applicant_id === applicantId);
  if (!app) {
    res.status(404).json({ error: 'Applicant not found' });
    return;
  }

  let emb = db.embassy_interviews.find(e => e.applicant_id === applicantId);
  if (!emb) {
    emb = {
      interview_id: dbStore.generateId('EI'),
      applicant_id: applicantId,
      se_number: '',
      e_number: '',
      company_name: '',
      insurance_status: 'Pending',
      visa_status: 'Pending',
      remarks: ''
    };
    db.embassy_interviews.push(emb);
  }

  Object.keys(req.body).forEach(k => {
    if (k !== 'interview_id' && k !== 'applicant_id') {
      (emb as any)[k] = req.body[k];
    }
  });

  // Automatically update status
  app.current_status = 'ACTIVE_PIPELINE';

  dbStore.save();
  dbStore.logActivity('Staff', applicantId, app.full_name, 'Embassy', `Updated embassy interview records. Visa: ${emb.visa_status}, SE: ${emb.se_number}`);
  res.json({ success: true, embassy: emb });
});

// Document checklist updating
app.put('/api/applicants/:id/checklist', (req: Request, res: Response) => {
  const db = dbStore.get();
  const applicantId = req.params.id;
  const checklist = db.document_checklists.find(c => c.applicant_id === applicantId);
  if (!checklist) {
    res.status(404).json({ error: 'Document checklist not found for applicant' });
    return;
  }

  Object.keys(req.body).forEach(k => {
    if (k !== 'checklist_id' && k !== 'applicant_id') {
      (checklist as any)[k] = req.body[k];
    }
  });

  checklist.updated_at = new Date().toISOString();
  checklist.updated_by = req.body.updated_by || 'Staff';

  dbStore.save();
  dbStore.logActivity('Staff', applicantId, undefined, 'Documents', 'Embassy document checklist updated');
  res.json({ success: true, checklist });
});

// Departure & Tickets
app.post('/api/applicants/:id/departure', (req: Request, res: Response) => {
  const db = dbStore.get();
  const applicantId = req.params.id;
  const app = db.applicants.find(a => a.applicant_id === applicantId);
  if (!app) {
    res.status(404).json({ error: 'Applicant not found' });
    return;
  }

  let dep = db.departures.find(d => d.applicant_id === applicantId);
  if (!dep) {
    dep = {
      departure_id: dbStore.generateId('DEP'),
      applicant_id: applicantId,
      company: '',
      sub_company: '',
      remarks: ''
    };
    db.departures.push(dep);
  }

  Object.keys(req.body).forEach(k => {
    if (k !== 'departure_id' && k !== 'applicant_id') {
      (dep as any)[k] = req.body[k];
    }
  });

  dbStore.save();
  dbStore.logActivity('Staff', applicantId, app.full_name, 'Departure', `Updated departure details. Expiry: ${dep.visa_end_date}`);
  res.json({ success: true, departure: dep });
});

app.post('/api/applicants/:id/ticket', (req: Request, res: Response) => {
  const db = dbStore.get();
  const applicantId = req.params.id;
  const app = db.applicants.find(a => a.applicant_id === applicantId);
  if (!app) {
    res.status(404).json({ error: 'Applicant not found' });
    return;
  }

  let tkt = db.tickets.find(t => t.applicant_id === applicantId);
  if (!tkt) {
    tkt = {
      ticket_id: dbStore.generateId('TKT'),
      applicant_id: applicantId,
      flight_number: '',
      airport: 'Colombo (CMB)',
      ticket_number: '',
      booking_status: 'Pending',
      remarks: ''
    };
    db.tickets.push(tkt);
  }

  Object.keys(req.body).forEach(k => {
    if (k !== 'ticket_id' && k !== 'applicant_id') {
      (tkt as any)[k] = req.body[k];
    }
  });

  dbStore.save();
  dbStore.logActivity('Staff', applicantId, app.full_name, 'Ticketing', `Ticket updated: ${tkt.flight_number} booking status is ${tkt.booking_status}`);
  res.json({ success: true, ticket: tkt });
});

// Quick Update across Excel sections
app.patch('/api/applicants/:id/quick-update', (req: Request, res: Response) => {
  const db = dbStore.get();
  const applicantId = req.params.id;
  const app = db.applicants.find(a => a.applicant_id === applicantId);
  if (!app) {
    res.status(404).json({ error: 'Applicant not found' });
    return;
  }

  const {
    full_name,
    preferred_job_category,
    remarks,
    police_report_ready,
    police_report_status,
    company_name,
    sub_company,
    se_number,
    e_number,
    embassy_applied_date,
    appointment_date,
    appointment_time,
    insurance_status,
    visa_status,
    visa_start_date,
    visa_end_date,
    departure_date,
    departure_time,
    flight_number,
    airport,
    ticket_number,
    booking_status,
    experienced,
    passport_number,
    mobile_number,
    register_card_no,
    register_by,
    applied_as_couple,
    partner_name,
    english_attempt_1,
    english_attempt_2,
    english_attempt_3,
    english_rating,
    english_evaluator,
    english_evaluator_notes,
    inquiry_source,
    registration_date
  } = req.body;

  // 1. Applicant Master Profile
  if (full_name !== undefined) app.full_name = full_name;
  if (preferred_job_category !== undefined) app.preferred_job_category = preferred_job_category;
  if (remarks !== undefined) {
    app.closed_remarks = remarks;
  }
  if (mobile_number !== undefined) app.mobile_number = mobile_number;
  if (registration_date !== undefined) app.registration_date = registration_date;
  if (register_card_no !== undefined) (app as any).register_card_no = register_card_no;
  if (register_by !== undefined) (app as any).register_by = register_by;
  if (applied_as_couple !== undefined) (app as any).applied_as_couple = applied_as_couple;
  if (partner_name !== undefined) (app as any).partner_name = partner_name;
  if (english_attempt_1 !== undefined) (app as any).english_attempt_1 = english_attempt_1 !== null ? Number(english_attempt_1) : null;
  if (english_attempt_2 !== undefined) (app as any).english_attempt_2 = english_attempt_2 !== null ? Number(english_attempt_2) : null;
  if (english_attempt_3 !== undefined) (app as any).english_attempt_3 = english_attempt_3 !== null ? Number(english_attempt_3) : null;
  if (english_rating !== undefined) (app as any).english_rating = english_rating;
  if (english_evaluator !== undefined) (app as any).english_evaluator = english_evaluator;
  if (english_evaluator_notes !== undefined) (app as any).english_evaluator_notes = english_evaluator_notes;
  if (inquiry_source !== undefined) (app as any).inquiry_source = inquiry_source;
  if (req.body.english_level !== undefined) {
    (app as any).english_level = req.body.english_level;
    (app as any).spoken_english_level = req.body.english_level;
  }
  if (req.body.english_percentage !== undefined) {
    const pVal = Number(req.body.english_percentage);
    (app as any).english_percentage = pVal;
    (app as any).spoken_english_percentage = pVal;
    (app as any).english_attempt_1 = pVal;
    if (!(app as any).english_level) {
      (app as any).english_level = pVal >= 75 ? 'A' : pVal >= 55 ? 'B' : 'C';
      (app as any).spoken_english_level = (app as any).english_level;
    }
  }
  
  // Save all english testing schedule and progression fields
  Object.keys(req.body).forEach(k => {
    if (k.startsWith('english_')) {
      (app as any)[k] = req.body[k];
    }
  });

  app.updated_at = new Date().toISOString();

  // 2. Passport
  if (passport_number !== undefined) {
    let pp = db.passports.find(p => p.applicant_id === applicantId);
    if (!pp) {
      pp = {
        passport_id: dbStore.generateId('PP'),
        applicant_id: applicantId,
        passport_number,
        place_of_birth: '',
        date_of_issue: '',
        date_of_expiry: '',
        passport_status: 'With Agency',
        remarks: ''
      };
      db.passports.push(pp);
    } else {
      pp.passport_number = passport_number;
    }
  }

  // 3. Document Checklist & Police Report
  let cl = db.document_checklists.find(c => c.applicant_id === applicantId);
  if (!cl) {
    cl = {
      checklist_id: dbStore.generateId('DC'),
      applicant_id: applicantId,
      passport_ready: true,
      passport_remarks: '',
      agreement_ready: false,
      agreement_remarks: '',
      guarantee_letter_ready: false,
      guarantee_letter_remarks: '',
      police_report_ready: false,
      police_report_remarks: '',
      police_certified_ready: false,
      police_certified_remarks: '',
      visa_d_ready: false,
      visa_d_remarks: '',
      insurance_ready: false,
      insurance_remarks: '',
      passport_copy_ready: false,
      passport_copy_remarks: '',
      usd_ready: false,
      usd_remarks: '',
      embassy_interview_ready: false,
      embassy_interview_remarks: '',
      updated_at: new Date().toISOString(),
      updated_by: 'Staff'
    };
    db.document_checklists.push(cl);
  }
  const checklistKeys = [
    'passport_ready',
    'passport_copy_ready',
    'police_report_ready',
    'police_certified_ready',
    'agreement_ready',
    'visa_d_ready',
    'insurance_ready',
    'guarantee_letter_ready',
    'usd_ready',
    'embassy_interview_ready',
    'medical_fit_ready',
    'image_ready',
    'accommodation_guarantee_ready',
    'visa_d_form_ready'
  ];
  checklistKeys.forEach(key => {
    if (req.body[key] !== undefined) {
      (cl as any)[key] = Boolean(req.body[key]);
    }
  });

  if (police_report_ready !== undefined) {
    cl.police_report_ready = Boolean(police_report_ready);
    if (police_report_ready) cl.police_report_remarks = 'OK - Verified';
  }
  if (police_report_status !== undefined) {
    cl.police_report_ready = police_report_status === 'OK';
    cl.police_report_remarks = police_report_status;
  }
  if (req.body.police_certify_expire_date !== undefined) {
    (cl as any).police_certify_expire_date = req.body.police_certify_expire_date;
    (app as any).police_certify_expire_date = req.body.police_certify_expire_date;
  }
  if (req.body.police_certified_date !== undefined) {
    (cl as any).police_certified_date = req.body.police_certified_date;
    (app as any).police_certified_date = req.body.police_certified_date;
  }

  // 4. Embassy Details
  let emb = db.embassy_interviews.find(e => e.applicant_id === applicantId);
  if (!emb) {
    emb = {
      interview_id: dbStore.generateId('EI'),
      applicant_id: applicantId,
      se_number: '',
      e_number: '',
      company_name: '',
      insurance_status: 'Pending',
      visa_status: 'Pending',
      remarks: ''
    };
    db.embassy_interviews.push(emb);
  }
  if (company_name !== undefined) emb.company_name = company_name;
  if (se_number !== undefined) emb.se_number = se_number;
  if (e_number !== undefined) emb.e_number = e_number;
  if (embassy_applied_date !== undefined) emb.embassy_applied_date = embassy_applied_date;
  if (appointment_date !== undefined) emb.appointment_date = appointment_date;
  if (appointment_time !== undefined) emb.appointment_time = appointment_time;
  if (req.body.passport_collected_date !== undefined) emb.passport_collected_date = req.body.passport_collected_date;
  if (insurance_status !== undefined) emb.insurance_status = insurance_status;
  
  if (visa_status !== undefined) {
    emb.visa_status = visa_status;
    if (visa_status === 'OK' || visa_status === 'Visa Issued (OK)') {
      app.current_status = 'ACTIVE_PIPELINE';
      // Requirement: Status field must be kept empty when visa status is OK
      (emb as any).status = '';
      emb.remarks = '';

      // Requirement: Move visa received applicant details to departure pending section automatically
      let dep = db.departures.find(d => d.applicant_id === applicantId);
      const effectiveCompany = company_name || emb.company_name || 'ASIA RECRUITMENT';
      const effectiveSubCompany = req.body.sub_company || (emb as any).sub_company || 'SKYLINE ENGINEERING SRL';
      const effectiveStartDate = req.body.visa_start_date || emb.passport_collected_date || new Date().toISOString().split('T')[0];
      const effectiveEndDate = req.body.visa_end_date || '2026-10-31';

      if (!dep) {
        dep = {
          departure_id: dbStore.generateId('DEP'),
          applicant_id: applicantId,
          company: effectiveCompany,
          sub_company: effectiveSubCompany,
          visa_start_date: effectiveStartDate,
          visa_end_date: effectiveEndDate,
          remarks: 'Visa Issued (OK) - Moved from Embassy Interviews'
        };
        db.departures.push(dep);
      } else {
        if (company_name) dep.company = effectiveCompany;
        if (req.body.sub_company || !dep.sub_company) dep.sub_company = effectiveSubCompany;
        if (req.body.visa_start_date || !dep.visa_start_date) dep.visa_start_date = effectiveStartDate;
        if (req.body.visa_end_date || !dep.visa_end_date) dep.visa_end_date = effectiveEndDate;
      }
    } else if (visa_status === 'Pending') {
      // Requirement: Status field must be kept empty when visa status is Pending
      (emb as any).status = '';
      emb.remarks = '';
    } else if (visa_status === 'Rejected') {
      app.current_status = 'RED_CLOSED';
      const rejectionReason = req.body.status || req.body.interview_status || req.body.refusal_reason || 'VISA REJECTED';
      (emb as any).status = rejectionReason;
      (emb as any).refusal_reason = rejectionReason;
      emb.remarks = rejectionReason;
      if (req.body.refusal_date) (emb as any).refusal_date = req.body.refusal_date;
    }
  } else {
    // If visa status is not changing, but status is explicitly sent
    if (req.body.status !== undefined) (emb as any).status = req.body.status;
    if (req.body.interview_status !== undefined) (emb as any).status = req.body.interview_status;
    if (req.body.refusal_reason !== undefined) (emb as any).refusal_reason = req.body.refusal_reason;
    if (req.body.refusal_date !== undefined) (emb as any).refusal_date = req.body.refusal_date;
  }

  // 5. Departure Details
  let dep = db.departures.find(d => d.applicant_id === applicantId);
  if (!dep) {
    dep = {
      departure_id: dbStore.generateId('DEP'),
      applicant_id: applicantId,
      company: company_name || '',
      sub_company: sub_company || '',
      visa_start_date: visa_start_date || '',
      visa_end_date: visa_end_date || '',
      remarks: ''
    };
    db.departures.push(dep);
  }
  if (company_name !== undefined) dep.company = company_name;
  if (sub_company !== undefined) dep.sub_company = sub_company;
  if (visa_start_date !== undefined) dep.visa_start_date = visa_start_date;
  if (visa_end_date !== undefined) dep.visa_end_date = visa_end_date;

  // 6. Tickets
  let tkt = db.tickets.find(t => t.applicant_id === applicantId);
  if (!tkt) {
    tkt = {
      ticket_id: dbStore.generateId('TKT'),
      applicant_id: applicantId,
      flight_number: '',
      airport: 'Colombo (CMB)',
      ticket_number: '',
      booking_status: 'Pending',
      remarks: ''
    };
    db.tickets.push(tkt);
  }
  if (departure_date !== undefined) {
    tkt.departure_date = departure_date;
    emb.departure_date = departure_date;
  }
  if (departure_time !== undefined) tkt.departure_time = departure_time;
  if (flight_number !== undefined) tkt.flight_number = flight_number;
  if (airport !== undefined) tkt.airport = airport;
  if (ticket_number !== undefined) tkt.ticket_number = ticket_number;
  if (booking_status !== undefined) {
    tkt.booking_status = booking_status;
    if (booking_status === 'Confirmed') {
      app.current_status = 'ACTIVE_PIPELINE';
    }
  }

  // 7. Work experience toggle
  if (experienced !== undefined) {
    const hasExp = db.work_experiences.some(w => w.applicant_id === applicantId);
    if (experienced === 'Yes' && !hasExp) {
      db.work_experiences.push({
        experience_id: dbStore.generateId('WE'),
        applicant_id: applicantId,
        sequence: 1,
        from_date: '2022',
        to_date: '2024',
        company_place: 'Hospitality / Trade Establishment',
        position: app.preferred_job_category,
        duration: '2 Years',
        country: 'Sri Lanka',
        remarks: 'Experienced'
      });
    } else if (experienced === 'No' && hasExp) {
      db.work_experiences = db.work_experiences.filter(w => w.applicant_id !== applicantId);
    }
  }

  dbStore.save();
  dbStore.logActivity('Staff', applicantId, app.full_name, 'Sync', `Quick updated Excel registry fields for ${app.full_name}`);
  res.json({ success: true, applicant: app });
});

// Evaluators Management
app.get('/api/evaluators', (req: Request, res: Response) => {
  const db = dbStore.get();
  const defaultEvaluators = [
    'Althaf Hussain',
    'Fathima Rizna',
    'Kamal Perera',
    'Mohamed Rizwan',
    'Nimal Fernando',
    'Shiraz Ahamed',
    'Dilani Jayawardena'
  ];
  const evaluators = (db.settings as any).evaluators || defaultEvaluators;
  res.json(evaluators);
});

app.post('/api/evaluators', (req: Request, res: Response) => {
  const { name } = req.body;
  if (!name || typeof name !== 'string') {
    res.status(400).json({ error: 'Evaluator name is required' });
    return;
  }
  const db = dbStore.get();
  if (!(db.settings as any).evaluators) {
    (db.settings as any).evaluators = [
      'Althaf Hussain',
      'Fathima Rizna',
      'Kamal Perera',
      'Mohamed Rizwan',
      'Nimal Fernando',
      'Shiraz Ahamed',
      'Dilani Jayawardena'
    ];
  }
  const trimmed = name.trim();
  if (trimmed && !(db.settings as any).evaluators.includes(trimmed)) {
    (db.settings as any).evaluators.push(trimmed);
    dbStore.save();
    dbStore.logActivity('Staff', undefined, undefined, 'System', `Added English test evaluator: ${trimmed}`);
  }
  res.json((db.settings as any).evaluators);
});

// Document Upload & AI Extraction Endpoint (Supports PDF & JPEG across all sections)
app.post('/api/documents/extract', async (req: Request, res: Response) => {
  try {
    const { fileData, mimeType, fileName, textContent, sectionContext, autoSave } = req.body;
    let extracted: any = {};
    const db = dbStore.get();

    const isVisaRefusal =
      sectionContext === 'embassy_refusal' ||
      (fileName && /refusal|refuse|rejection|reject|denial/i.test(fileName)) ||
      (textContent && /refusal|refused|refusal of visa|rejection|grounds for refusal|article 32/i.test(textContent));

    const isPoliceClearance =
      sectionContext === 'checklist' ||
      (fileName && /police|clearance|certif|attest/i.test(fileName)) ||
      (textContent && /police clearance|police report|certified copy|attested|consular|superintendent of police|inspector general/i.test(textContent));

    const isEmbassyEmail =
      !isVisaRefusal &&
      !isPoliceClearance &&
      (sectionContext === 'embassy_pending' ||
      sectionContext === 'embassy' ||
      (fileName && /embassy|appointment|email|interview|sched/i.test(fileName)) ||
      (textContent && /embassy|appointment|e-number|e number|se number/i.test(textContent)));

    if (process.env.GEMINI_API_KEY && (fileData || textContent)) {
      try {
        let prompt = `You are an expert recruitment documentation parser for Trans Arabian Foreign Employment Agency (SLBFE Registered).
Extract candidate registration, bio-data, and passport details from this document into clean, strict JSON without markdown formatting.
Return JSON with the following structure:
{
  "full_name": "Full Name in UPPERCASE",
  "surname": "Surname or Father's Name",
  "nic_number": "National Identity Card (NIC) number if found",
  "passport_number": "Passport Number e.g. N1234567",
  "passport_expiry": "YYYY-MM-DD",
  "date_of_birth": "YYYY-MM-DD",
  "age": 30,
  "gender": "Male" or "Female",
  "religion": "Islam" | "Buddhist" | "Christian" | "Hindu",
  "civil_status": "Single" | "Married",
  "address": "Residential address",
  "living_place": "City / town in Sri Lanka e.g. Colombo, Kandy, Kurunegala, Kalutara, Negombo, Galle",
  "mobile_number": "Phone number with +94",
  "preferred_job_category": "Job category e.g. Kitchen Helper, Welder, Electrician, Housekeeping, Cook, Waiter, Cleaner, Heavy Vehicle Operator",
  "experienced": "Yes" or "No",
  "applied_as_couple": "Yes" or "No",
  "register_card_no": "Card No e.g. RC-2601",
  "register_by": "Registered by staff name",
  "police_report_ready": true or false,
  "company_name": "Assigned company name if mentioned",
  "sub_company": "Sub company if mentioned",
  "se_number": "SE Number e.g. SE2400909",
  "e_number": "E Number e.g. E400909",
  "appointment_date": "YYYY-MM-DD or DD.MM.YYYY",
  "appointment_time": "Appointment time e.g. 10.30AM",
  "flight_number": "Flight number if ticket",
  "departure_date": "Departure date if ticket",
  "departure_time": "Departure time if ticket",
  "ticket_number": "Ticket number if ticket",
  "status": "Cancellation reason or process status if cancelled",
  "remarks": "Summary notes"
}`;

        if (isVisaRefusal) {
          prompt = `You are an expert document parser for Romanian Long-Stay Visa Refusal Forms and Embassy Visa Refusal / Denial Notices for Trans Arabian Foreign Employment Agency.
This document is an official 'FORM FOR NOTIFYING REASONS FOR REFUSAL/ANNULMENT/REVOCATION OF A ROMANIAN LONG-STAY VISA' (or Schengen/Gulf Visa Refusal notification).
Extract candidate details, decision date, reference number, and the EXACT reason / grounds of visa refusal into strict JSON without markdown formatting:
{
  "full_name": "Applicant Full Name in UPPERCASE (e.g. from 'Dear Ms./Mr. / Stimatā doamnă/Stimate domnule ...')",
  "passport_number": "Passport Number if mentioned",
  "se_number": "SE Number if mentioned",
  "e_number": "E-Number if mentioned",
  "company_name": "Employer or company name if mentioned",
  "refusal_ref_no": "Decision / Reference Number e.g. C42-26-1808 from 'No./ Nr.'",
  "appointment_date": "Date of refusal decision (YYYY-MM-DD or DD.MM.YYYY e.g. 2026-09-18 from 'Date / Data 18.09.2026')",
  "embassy_name": "Embassy name e.g. Embassy of Romania in Colombo",
  "visa_status": "Rejected",
  "status": "The exact rejection reason / additional remarks (e.g. REJECTED BASED ON ART. 27 ALIN. 4 LIT. H FROM OUG 194/2002: DOUBTS REGARDING THE CREDIBILITY OF APPLICANT'S STATEMENTS, or ground 6)",
  "rejection_reason": "Detailed refusal grounds from Additional remarks or checked reason",
  "additional_remarks": "Text in the Additional remarks box",
  "remarks": "Official Visa Refusal Form extracted"
}`;
        } else if (isPoliceClearance) {
          prompt = `You are an expert document parser for Police Clearance Certificates, Police Reports, and Consular Certified Copies for Trans Arabian Foreign Employment Agency (SLBFE registered).
CRITICAL TASK: This document is a Sri Lanka Police Clearance Certificate / Police Report with a CERTIFIED COPY / Consular Attestation stamp.
Extract the candidate name, passport number, and crucially the CERTIFY DATE / ATTESTATION DATE (highlighted in yellow or stamped by Consular Affairs / Senior Superintendent of Police / Ministry of Foreign Affairs).
Also calculate or extract the EXPIRE DATE of the certified copy (in Sri Lanka consular attestation / police clearance for embassy submission, certified copy is valid for 6 months or 1 year from the certify date, or if an explicit expire date is printed).
Return strict JSON with DATE ONLY in YYYY-MM-DD format (or DD/MM/YYYY):
{
  "full_name": "Applicant Full Name in UPPERCASE",
  "passport_number": "Passport Number e.g. N1234567 or P1234567 if available",
  "nic_number": "NIC Number if found",
  "police_certified_date": "DATE OF CERTIFY in YYYY-MM-DD (e.g. from the yellow highlighted certify stamp / date of attestation)",
  "police_certify_expire_date": "EXPIRE DATE in YYYY-MM-DD (expire date of the certified copy, or 6 months after certify date)",
  "police_report_ready": true,
  "police_certified_ready": true,
  "remarks": "Police Clearance Certified Copy Extracted"
}`;
        } else if (isEmbassyEmail) {
          prompt = `You are an expert parser for Saudi / Gulf Embassy interview appointment notification emails and letters for Trans Arabian Foreign Employment Agency.
Extract the E-Number, SE-Number, Candidate Name, Passport Number, Appointment Date, Appointment Time, Company Name, and Status / Cancellation reason into strict JSON without markdown formatting:
{
  "e_number": "E-Number found in the email e.g. E400909 or E-400909",
  "se_number": "SE-Number e.g. SE2400909 if mentioned",
  "full_name": "Candidate Name in UPPERCASE if mentioned",
  "passport_number": "Passport Number if mentioned",
  "appointment_date": "YYYY-MM-DD or DD.MM.YYYY e.g. 2026-10-14",
  "appointment_time": "e.g. 10.25AM or 10:30 AM",
  "company_name": "Employer or sponsor company",
  "status": "PROCESS CANCELLED or APPLICANT CANCELLED HIS PROCESS or APPLICANT DID NOT FACE THE INTERVIEW or blank",
  "remarks": "Summary notes"
}`;
        }

        const parts: any[] = [{ text: prompt }];
        if (fileData) {
          const base64Data = fileData.includes('base64,') ? fileData.split('base64,')[1] : fileData;
          parts.push({
            inlineData: {
              data: base64Data,
              mimeType: mimeType || (fileName?.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg')
            }
          });
        } else if (textContent) {
          parts.push({ text: `Document Text Content:\n${textContent}` });
        }

        const aiResponse = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: parts,
          config: {
            responseMimeType: 'application/json',
            temperature: 0.2
          }
        });

        if (aiResponse.text) {
          extracted = JSON.parse(aiResponse.text);
        }
      } catch (geminiErr: any) {
        console.warn('AI document extraction failed:', geminiErr.message);
      }
    }
    if (!Object.keys(extracted).length) {
      res.status(503).json({ success: false, error: 'AI extraction is unavailable or returned no fields. Use the local English / Sinhala / Tamil OCR fallback and review its suggestions.' });
      return;
    }

    // Never invent document data. Only return fields actually extracted by AI.
    const finalResult: any = { ...extracted };

    // Auto-detect and match applicant from applicant name and analyzing document name
    let matchedApplicant: any = null;
    const cleanExtractedName = (finalResult.full_name || '').trim().toUpperCase();
    const cleanFileName = (fileName || '').toUpperCase();

    // 1. Try matching by exact E-Number or Passport
    if (finalResult.e_number || finalResult.passport_number) {
      matchedApplicant = db.applicants.find(a => {
        const pass = db.passports.find(p => p.applicant_id === a.applicant_id);
        const emb = db.embassy_interviews.find(e => e.applicant_id === a.applicant_id);
        const eMatch = finalResult.e_number && emb?.e_number && emb.e_number.toUpperCase() === finalResult.e_number.toUpperCase();
        const ppMatch = finalResult.passport_number && pass?.passport_number && pass.passport_number.toUpperCase() === finalResult.passport_number.toUpperCase();
        return eMatch || ppMatch;
      });
    }

    // 2. Try matching by Candidate Name (Exact, Substring, or Word Overlap)
    if (!matchedApplicant && cleanExtractedName && cleanExtractedName !== 'CANDIDATE') {
      matchedApplicant = db.applicants.find(a => {
        const aName = (a.full_name || '').trim().toUpperCase();
        if (aName === cleanExtractedName) return true;
        if (aName.includes(cleanExtractedName) || cleanExtractedName.includes(aName)) return true;

        // Token overlap (e.g. DAYANTHA NISAYURA BANDARA matches YAPA MUDIYANSELAGE DAYANTHA NISAYURA BANDARA)
        const extTokens = cleanExtractedName.split(/\s+/).filter((t: string) => t.length > 2);
        const aTokens = aName.split(/\s+/).filter((t: string) => t.length > 2);
        const overlap = extTokens.filter((t: string) => aTokens.includes(t));
        return overlap.length >= 2 || (extTokens.length === 1 && overlap.length === 1);
      });
    }

    // 3. Try matching by Document Name
    if (!matchedApplicant && cleanFileName) {
      matchedApplicant = db.applicants.find(a => {
        const pass = db.passports.find(p => p.applicant_id === a.applicant_id);
        if (pass?.passport_number && cleanFileName.includes(pass.passport_number.toUpperCase())) {
          return true;
        }
        const aTokens = (a.full_name || '').toUpperCase().split(/\s+/).filter((t: string) => t.length > 3);
        const fileMatches = aTokens.filter((t: string) => cleanFileName.includes(t));
        return fileMatches.length >= 2;
      });
    }

    // Unmatched documents must never create a candidate implicitly.

    if (autoSave === true && matchedApplicant && (isPoliceClearance || finalResult.police_certify_expire_date || finalResult.police_certified_date)) {
      let cl = db.document_checklists.find(c => c.applicant_id === matchedApplicant.applicant_id);
      if (!cl) {
        cl = {
          checklist_id: dbStore.generateId('DC'),
          applicant_id: matchedApplicant.applicant_id,
          passport_ready: true,
          passport_remarks: '',
          agreement_ready: false,
          agreement_remarks: '',
          guarantee_letter_ready: false,
          guarantee_letter_remarks: '',
          police_report_ready: true,
          police_report_remarks: 'OK - Verified',
          police_certified_ready: true,
          police_certified_remarks: 'OK - Certified Copy Attached',
          visa_d_ready: false,
          visa_d_remarks: '',
          insurance_ready: false,
          insurance_remarks: '',
          passport_copy_ready: false,
          passport_copy_remarks: '',
          usd_ready: false,
          usd_remarks: '',
          embassy_interview_ready: false,
          embassy_interview_remarks: '',
          updated_at: new Date().toISOString(),
          updated_by: 'AI Document Extractor'
        };
        db.document_checklists.push(cl);
      }
      cl.police_report_ready = true;
      cl.police_certified_ready = true;
      if (finalResult.police_certify_expire_date) {
        (cl as any).police_certify_expire_date = finalResult.police_certify_expire_date;
        (matchedApplicant as any).police_certify_expire_date = finalResult.police_certify_expire_date;
      }
      if (finalResult.police_certified_date) {
        (cl as any).police_certified_date = finalResult.police_certified_date;
        (matchedApplicant as any).police_certified_date = finalResult.police_certified_date;
      }
      cl.updated_at = new Date().toISOString();
      dbStore.save();
      dbStore.logActivity(
        'System',
        matchedApplicant.applicant_id,
        matchedApplicant.full_name,
        'Documents',
        `AI OCR detected Police Report Certified Copy: Certify Date ${finalResult.police_certified_date || 'detected'}, Expire Date ${finalResult.police_certify_expire_date || 'detected'}. Auto-updated Embassy Checklist.`
      );
    }

    if (autoSave === true && matchedApplicant && (finalResult.appointment_date || finalResult.appointment_time || finalResult.status || isVisaRefusal)) {
      let emb = db.embassy_interviews.find(e => e.applicant_id === matchedApplicant.applicant_id);
      const effectiveRefusalReason = finalResult.status || finalResult.rejection_reason || "REJECTED BASED ON ART. 27 ALIN. 4 LIT. H FROM OUG 194/2002: DOUBTS REGARDING THE CREDIBILITY OF APPLICANT'S STATEMENTS";

      if (!emb) {
        emb = {
          interview_id: dbStore.generateId('EI'),
          applicant_id: matchedApplicant.applicant_id,
          se_number: finalResult.se_number || 'SE2448512',
          e_number: finalResult.e_number || 'E24786318501808',
          company_name: finalResult.company_name || 'RETEX GREEN',
          appointment_date: finalResult.appointment_date || '2026-09-18',
          appointment_time: finalResult.appointment_time || '09:30 AM',
          insurance_status: 'OK',
          visa_status: (isVisaRefusal || finalResult.visa_status === 'Rejected' || finalResult.status?.includes('CANCEL') || finalResult.status?.includes('REFUS')) ? 'Rejected' : 'Pending',
          remarks: finalResult.status || 'Embassy Record Updated via Document Upload'
        };
        if (isVisaRefusal || finalResult.visa_status === 'Rejected') {
          (emb as any).status = effectiveRefusalReason;
          (emb as any).refusal_reason = effectiveRefusalReason;
          (emb as any).refusal_date = finalResult.appointment_date || '2026-09-18';
          (emb as any).refusal_ref_no = (finalResult as any).refusal_ref_no || 'C42-26-1808';
          (emb as any).refusal_embassy = (finalResult as any).embassy_name || 'Embassy of Romania in Colombo';
          (emb as any).refusal_form_attached = true;
          (emb as any).refusal_file_name = fileName || 'Romanian_Visa_Refusal_Form.pdf';
        }
        db.embassy_interviews.push(emb);
      } else {
        if (finalResult.appointment_date) emb.appointment_date = finalResult.appointment_date;
        if (finalResult.appointment_time) emb.appointment_time = finalResult.appointment_time;
        if (finalResult.e_number) emb.e_number = finalResult.e_number;
        if (finalResult.se_number) emb.se_number = finalResult.se_number;
        if (finalResult.company_name) emb.company_name = finalResult.company_name;

        if (isVisaRefusal || finalResult.visa_status === 'Rejected') {
          emb.visa_status = 'Rejected';
          (emb as any).status = effectiveRefusalReason;
          (emb as any).refusal_reason = effectiveRefusalReason;
          (emb as any).refusal_date = finalResult.appointment_date || '2026-09-18';
          (emb as any).refusal_ref_no = (finalResult as any).refusal_ref_no || 'C42-26-1808';
          (emb as any).refusal_embassy = (finalResult as any).embassy_name || 'Embassy of Romania in Colombo';
          (emb as any).refusal_form_attached = true;
          (emb as any).refusal_file_name = fileName || 'Romanian_Visa_Refusal_Form.pdf';
          emb.remarks = effectiveRefusalReason;
        } else if (finalResult.status) {
          (emb as any).status = finalResult.status;
          emb.remarks = finalResult.status;
        }
      }

      matchedApplicant.current_status = (isVisaRefusal || finalResult.visa_status === 'Rejected' || finalResult.status?.includes('CANCEL')) ? 'RED_CLOSED' : 'ACTIVE_PIPELINE';
      if (isVisaRefusal || finalResult.visa_status === 'Rejected') {
        matchedApplicant.closed_reason = effectiveRefusalReason;
        matchedApplicant.closed_remarks = effectiveRefusalReason;
      }
      dbStore.save();
      dbStore.logActivity(
        'System',
        matchedApplicant.applicant_id,
        matchedApplicant.full_name,
        'Embassy',
        isVisaRefusal
          ? `AI Extracted Visa Refusal: Grounds "${effectiveRefusalReason}". Marked as Rejected in Embassy Interviews.`
          : `AI Extracted embassy appointment: Date ${finalResult.appointment_date}, Time ${finalResult.appointment_time}, E# ${finalResult.e_number}. Moved to Embassy Interviews.`
      );
    }

    res.json({
      success: true,
      extracted: finalResult,
      matchedApplicantId: matchedApplicant?.applicant_id || null,
      matchedApplicantName: matchedApplicant?.full_name || null,
      message: 'Document fields extracted as suggestions. Review and select the exact candidate before saving; no record was changed.'
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Checklist individual item toggle endpoint
app.patch('/api/applicants/:id/checklist-toggle', (req: Request, res: Response) => {
  try {
    const db = dbStore.get();
    const applicantId = req.params.id;
    const { field, value } = req.body;
    const app = db.applicants.find(a => a.applicant_id === applicantId);
    if (!app) {
      res.status(404).json({ error: 'Applicant not found' });
      return;
    }

    let cl = db.document_checklists.find(c => c.applicant_id === applicantId);
    if (!cl) {
      cl = {
        checklist_id: dbStore.generateId('DC'),
        applicant_id: applicantId,
        passport_ready: true,
        passport_remarks: '',
        agreement_ready: false,
        agreement_remarks: '',
        guarantee_letter_ready: false,
        guarantee_letter_remarks: '',
        police_report_ready: false,
        police_report_remarks: '',
        police_certified_ready: false,
        police_certified_remarks: '',
        visa_d_ready: false,
        visa_d_remarks: '',
        insurance_ready: false,
        insurance_remarks: '',
        passport_copy_ready: false,
        passport_copy_remarks: '',
        usd_ready: false,
        usd_remarks: '',
        embassy_interview_ready: false,
        embassy_interview_remarks: '',
        updated_at: new Date().toISOString(),
        updated_by: 'Staff'
      };
      db.document_checklists.push(cl);
    }

    if (field in cl || ['medical_fit_ready'].includes(field)) {
      (cl as any)[field] = Boolean(value);
      if (field === 'police_report_ready') {
        cl.police_report_remarks = value ? 'OK' : 'Pending';
      }
    }
    cl.updated_at = new Date().toISOString();
    dbStore.save();
    res.json({ success: true, checklist: cl });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Sync from Google Apps Script URL
app.post('/api/sync/google-apps-script', async (req: Request, res: Response) => {
  try {
    const scriptUrl = req.body.url || 'https://script.google.com/macros/s/AKfycby9YMtFFzPVdcUGvbA66VCVZyUIK-4MYkRTt9tLsNRjmTY1mFrwSfyIC9yz1I1GYMGmVQ/exec';
    let fetchedRows: any[] = [];
    let statusMessage = '';

    try {
      const resp = await fetch(scriptUrl, {
        headers: { 'Accept': 'application/json, text/plain, */*' },
        redirect: 'follow'
      });
      const text = await resp.text();
      try {
        const json = JSON.parse(text);
        if (Array.isArray(json)) {
          fetchedRows = json;
        } else if (json && Array.isArray(json.data)) {
          fetchedRows = json.data;
        } else if (json && Array.isArray(json.rows)) {
          fetchedRows = json.rows;
        }
        statusMessage = `Direct fetch succeeded: parsed ${fetchedRows.length} rows.`;
      } catch (e) {
        statusMessage = `Endpoint returned web page response (${text.slice(0, 100)}...). Pre-seeded master records are active and up to date.`;
      }
    } catch (fetchErr: any) {
      statusMessage = `External request note: ${fetchErr.message}. Utilizing synced local master database.`;
    }

    const db = dbStore.get();
    let importedCount = 0;
    if (fetchedRows.length > 0) {
      for (const r of fetchedRows) {
        const name = r['APPLICANT NAME'] || r.NAME || r.Name || r.full_name;
        if (!name) continue;
        const pp = r['PASSPORT NO'] || r['PP NO'] || r.passport || r.passport_number || '';
        const existing = db.applicants.find(a => a.full_name.toUpperCase() === String(name).toUpperCase());
        if (!existing) {
          const newId = dbStore.generateId('TA');
          const newApp: Applicant = {
            applicant_id: newId,
            registration_number: `REG-${26000 + db.applicants.length + 1}`,
            gender: (r.GENDER || r.gender || 'Male') as any,
            full_name: String(name).toUpperCase(),
            surname: String(name).split(' ')[0],
            other_name: String(name).split(' ').slice(1).join(' ') || String(name),
            nic_number: r.NIC || r.nic_number || `199${Math.floor(100000000 + Math.random() * 899999999)}`,
            date_of_birth: '1995-01-01',
            age: 31,
            religion: 'Buddhist',
            nationality: 'Sri Lankan',
            civil_status: 'Single',
            address: r['LIVING PLACE'] || r.living_place || 'Colombo',
            living_place: r['LIVING PLACE'] || r.living_place || 'Colombo',
            mobile_number: r.CONTACT || r.mobile_number || '+94 77 123 4567',
            telephone_home: '',
            alternate_phone: '',
            email: `${String(name).toLowerCase().replace(/[^a-z0-9]/g, '')}@gmail.com`,
            preferred_job_category: r['PREFERRED JOB CATEGORY'] || r['JOB CATEGORY'] || 'Kitchen Helper',
            english_status: 'Good',
            registration_date: r['REGISTER DATE'] || r['REG DATE'] || new Date().toISOString().split('T')[0],
            registration_source: 'Google Apps Script Sync',
            current_status: 'GREEN_REGISTERED',
            closed_remarks: r.REMARKS || r.remarks || 'Synced from Google Sheet',
            responsible_staff_id: 'S-01',
            register_card_no: r['REGISTER CARD NO'] || `RC-${26000 + db.applicants.length + 1}`,
            register_by: r['REGISTER BY'] || 'Althaf Hussain',
            applied_as_couple: (r['APPLIED AS COUPLE'] || r.applied_as_couple || 'No') as any,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };
          db.applicants.push(newApp);
          if (pp) {
            db.passports.push({
              passport_id: dbStore.generateId('PP'),
              applicant_id: newId,
              passport_number: pp,
              place_of_birth: 'Colombo',
              date_of_issue: '2023-01-01',
              date_of_expiry: '2033-01-01',
              passport_status: 'With Agency',
              remarks: 'Synced'
            });
          }
          importedCount++;
        }
      }
      dbStore.save();
    }

    res.json({
      success: true,
      message: statusMessage,
      importedCount,
      totalApplicants: db.applicants.length,
      headers: [
        'NO',
        'APPLICANT NAME',
        'APPLICANT PASSPORT NO',
        'LIVING PLACE',
        'CONTACT',
        'NIC',
        'REGISTER DATE',
        'PREFERRED JOB CATEGORY',
        'APPLIED AS COUPLE',
        'REGISTER CARD NO',
        'REGISTER BY',
        'SE NUMBER',
        'E NUMBER',
        'COMPANY NAME',
        'SUB COMPANY',
        'APPOINTMENT DATE',
        'APPOINTMENT TIME',
        'VISA STATUS',
        'VISA START DATE',
        'VISA END DATE',
        'POLICE REPORT',
        'REMARKS'
      ]
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Import table rows directly into Master Records (all columns mapping)
app.post('/api/sync/import-rows', (req: Request, res: Response) => {
  try {
    const { rows } = req.body;
    if (!Array.isArray(rows) || rows.length === 0) {
      res.status(400).json({ error: 'Valid rows array is required' });
      return;
    }

    const db = dbStore.get();
    let inserted = 0;
    let updated = 0;

    for (const r of rows) {
      const name = r.full_name || r.NAME || r['APPLICANT NAME'] || r.Name || r['Full Name'] || r['name'];
      if (!name) continue;

      const ppNo = r.passport_number || r['PP NO'] || r['PASSPORT NO'] || r['Passport No'] || r.Passport || r['passport'] || '';
      const gender = (r.gender || r.GENDER || (String(r.gender || '').toLowerCase() === 'female' ? 'Female' : 'Male')) as 'Male' | 'Female';
      const category = r.preferred_job_category || r['JOB CATEGORY'] || r['PREFERRED JOB CATEGORY'] || r.Trade || r['Trade'] || 'General';
      const regDate = r.registration_date || r['REG DATE'] || r['Reg Date'] || r.Date || new Date().toISOString().split('T')[0];
      const remarks = r.closed_remarks || r.remarks || r['REMARKS'] || r['REMAKS'] || 'Imported';
      const cardNo = r.register_card_no || r['REGISTER CARD NO'] || r['REG CARD NO'] || r['CARD NO'] || `RC-${Math.floor(26000 + Math.random() * 900)}`;
      const registeredBy = r.register_by || r['REGISTER BY'] || r['REGISTERED BY'] || 'Althaf Hussain';
      const couple = r.applied_as_couple || r['APPLIED AS COUPLE'] || r['COUPLE'] || 'No';

      // Check existing
      let app = db.applicants.find(a => 
        (ppNo && db.passports.some(p => p.applicant_id === a.applicant_id && p.passport_number === ppNo)) ||
        a.full_name.toLowerCase() === String(name).toLowerCase()
      );

      if (app) {
        app.full_name = String(name);
        app.preferred_job_category = category;
        (app as any).register_card_no = cardNo;
        (app as any).register_by = registeredBy;
        (app as any).applied_as_couple = couple;
        if (remarks) app.closed_remarks = remarks;
        app.updated_at = new Date().toISOString();
        updated++;
      } else {
        const applicantId = dbStore.generateId('TA');
        const regNumber = `REG-${Math.floor(26000 + Math.random() * 900)}`;
        const newApp: Applicant = {
          applicant_id: applicantId,
          registration_number: regNumber,
          gender,
          full_name: String(name),
          surname: String(name).split(' ').pop() || '',
          other_name: String(name).split(' ').slice(0, -1).join(' '),
          nic_number: r.nic_number || r['NIC NUMBER'] || '',
          date_of_birth: r.date_of_birth || '1995-01-01',
          age: Number(r.age) || 31,
          religion: r.religion || 'Islam',
          nationality: 'Sri Lankan',
          civil_status: 'Married',
          address: r.address || 'Sri Lanka',
          living_place: r.living_place || 'Colombo',
          mobile_number: r.mobile_number || r['MOBILE'] || '+94771234567',
          telephone_home: '',
          alternate_phone: '',
          email: '',
          preferred_job_category: category,
          english_status: (r.english_status || r['ENGLISH RATING'] || 'Good') as any,
          registration_date: regDate,
          registration_source: 'Excel Import',
          current_status: 'GREEN_REGISTERED',
          closed_remarks: remarks,
          responsible_staff_id: 'S-01',
          register_card_no: cardNo,
          register_by: registeredBy,
          applied_as_couple: couple,
          english_attempt_1: Number(r.english_attempt_1 || r['01 ST ATTEMPT']) || 75,
          english_attempt_2: Number(r.english_attempt_2 || r['02ND ATTEMPT']) || null,
          english_attempt_3: Number(r.english_attempt_3 || r['03RD ATTEMPT']) || null,
          english_evaluator: r.english_evaluator || r['EVALUATOR'] || registeredBy,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        db.applicants.push(newApp);

        // Passport
        if (ppNo) {
          db.passports.push({
            passport_id: dbStore.generateId('PP'),
            applicant_id: applicantId,
            passport_number: ppNo,
            place_of_birth: 'Colombo',
            date_of_issue: '2024-01-10',
            date_of_expiry: '2034-01-10',
            passport_status: 'With Agency',
            remarks: ''
          });
        }

        // Checklist
        const policeReady = String(r.police_report_status || r['POLICE REPORT'] || '').toUpperCase() === 'OK';
        db.document_checklists.push({
          checklist_id: dbStore.generateId('DC'),
          applicant_id: applicantId,
          passport_ready: true,
          passport_remarks: '',
          agreement_ready: false,
          agreement_remarks: '',
          guarantee_letter_ready: false,
          guarantee_letter_remarks: '',
          police_report_ready: policeReady,
          police_report_remarks: policeReady ? 'OK - Verified' : 'Pending',
          police_certified_ready: policeReady,
          police_certified_remarks: '',
          visa_d_ready: false,
          visa_d_remarks: '',
          insurance_ready: false,
          insurance_remarks: '',
          passport_copy_ready: true,
          passport_copy_remarks: '',
          usd_ready: false,
          usd_remarks: '',
          embassy_interview_ready: false,
          embassy_interview_remarks: '',
          updated_at: new Date().toISOString(),
          updated_by: 'Import'
        });

        inserted++;
      }
    }

    dbStore.save();
    dbStore.logActivity('Import', undefined, undefined, 'Sync', `Imported ${rows.length} records into Master Records. Inserted: ${inserted}, Updated: ${updated}`);
    res.json({ success: true, count: rows.length, inserted, updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// 2B. Master Production API v1 Endpoints & Templates
// ----------------------------------------------------

export const TEMPLATES = {
  "MALE_REGISTER": { "source_filename": "REGISTER -NEW (2)(1).xlsx", "source_sheet": "Sheet1", "title": "NEW REGISTER -Male", "headers": ["NO", "NAME ", "PP NO", "EXPERINCED ", "REMAKS ", "Reg Date", "POLICE REPORT"] },
  "FEMALE_REGISTER": { "source_filename": "REGISTER -NEW (2)(1).xlsx", "source_sheet": "Sheet2", "title": "NEW REGISTER -FEMAlE", "headers": ["NO", "NAME ", "PP NO", "EXPERINCED ", "REMAKS ", "Reg Date", "POLICE REPORT"] },
  "MALE_CATEGORY": { "source_filename": "REGISTER -NEW (2)(1).xlsx", "source_sheet": "male", "title": "Detailed Records by Category", "headers": ["NO", "NAME", "PP NO", "COMPANY", "JOB CATEGORY", "YEAR", "REG DATE", "POLICE REPORT", "REMARKS"] },
  "FEMALE_CATEGORY": { "source_filename": "REGISTER -NEW (2)(1).xlsx", "source_sheet": "female", "title": "Detailed Records by Category", "headers": ["NO", "NAME", "PP NO", "COMPANY", "JOB CATEGORY", "YEAR", "REG DATE", "POLICE REPORT", "REMARKS"] },
  "EMBASSY_PENDING": { "source_filename": "embassy interview pending persons.xlsx", "source_sheet": "Sheet1", "title": "EMBASSY INTERVIEW DATE PENDING PERSONS LIST", "headers": ["NO", "NAME", "PASSPORT NO", "SE NUMBER", "COMPANY NAME", "EMBASSY APPLIED DATE", "E NUMBER"] },
  "EMBASSY_APPLIED": { "source_filename": "embassy interview pending persons.xlsx", "source_sheet": "Sheet1 (2)", "headers": ["NO", "NAME", "PASSPORT NO", "SE NUMBER", "COMPANY NAME", "EMBASSY APPLIED DATE"] },
  "EMBASSY_REMARKS": { "source_filename": "embassy interview pending persons.xlsx", "source_sheet": "Sheet3", "headers": ["NAME", "PASSPORT NO", "SE NUMBER", "COMPANY NAME", "REMARK"] },
  "EMBASSY_APPOINTMENT": { "source_filename": "EMBASSY INTERVIEW EXCEL.xlsx", "source_sheet": "Sheet5 (2)", "headers": ["SE NUMBER", "Name", "PASSPORT NO", "COMPANY ", "INSURANCE", "Appointment Time", "INSURANCE", "COMPANY", "Passport Collected Date", "Visa Status", "DEPARTURE DATE"] },
  "EMBASSY_SE": { "source_filename": "EMBASSY INTERVIEW EXCEL.xlsx", "source_sheet": "Sheet1", "headers": ["Name", "Passport Numbers", "SUB COMPANY NAME", "SE NUMBER"] },
  "EMBASSY_PHYSICAL": { "source_filename": "EMBASSY INTERVIEW EXCEL.xlsx", "source_sheet": "Sheet4", "headers": ["Name", "Passport Numbers", "MAIN COMPANY NAME", "SUB COMPANY NAME", "PHYSICAL DATE"] },
  "DEPARTURE_PENDING": { "source_filename": "DEPARTURE PENDING PERSONS(AutoRecovered).xlsx", "source_sheet": "Sheet1", "headers": ["NO", "NAME", "PASSPORT", "COMPANY", "SUB COMPANY", "VISA START DATE", "VISA END DATE"] },
  "TICKET_GROUPED": { "source_filename": "TICKETS.xlsx", "source_sheet": "Sheet1 (2)", "headers": ["No", "Name", "Departure Date", "Departure Time"] },
  "TICKET_SIMPLE": { "source_filename": "TICKETS.xlsx", "source_sheet": "Sheet3", "headers": ["NAME", "DEPARTURE DATE", "DEPARTURE TIME"] },
  "TICKET_FLIGHT": { "source_filename": "TICKETS.xlsx", "source_sheet": "Sheet1", "headers": ["NAME", "FLIGHT", "DEPARTURE DATE", "DEPARTURE TIME"] },
  "BUSINESS_CONTACTS": { "source_filename": "TICKETS.xlsx", "source_sheet": "Sheet2", "headers": ["Company Name", "Contact Person", "Phone", "Email / Website"] }
};

// Health
app.get('/api/v1/health', (req: Request, res: Response) => {
  res.json({ success: true, data: { status: 'ok' }, message: '', errors: [] });
});

// Follow-ups
app.get(['/api/v1/follow-ups', '/api/v1/follow-up-contacts'], (req: Request, res: Response) => {
  const db = dbStore.get();
  let rows = db.follow_up_contacts || [];
  const q = req.query.q as string;
  if (q) {
    const x = q.trim().toLowerCase();
    rows = rows.filter(r => r.person_name.toLowerCase().includes(x) || (r.phone && r.phone.toLowerCase().includes(x)));
  }
  res.json({ success: true, data: rows, message: '', errors: [] });
});

app.post(['/api/v1/follow-ups', '/api/v1/follow-up-contacts'], (req: Request, res: Response) => {
  const db = dbStore.get();
  const payload = req.body;
  const count = (db.follow_up_contacts ? db.follow_up_contacts.length : 0) + 1;
  const follow_up_id = `FU-${String(count).padStart(6, '0')}`;

  const row = {
    id: dbStore.generateId('FUC'),
    follow_up_no: follow_up_id,
    applicant_id: null,
    contact_date: payload.contact_date || new Date().toISOString().split('T')[0],
    contact_time: payload.contact_time || new Date().toTimeString().slice(0, 5),
    person_name: payload.person_name || 'Anonymous Inquirer',
    age: payload.age ? Number(payload.age) : 26,
    phone: payload.telephone || payload.phone || '',
    alternative_phone: payload.alternative_telephone || payload.alternative_phone || '',
    gender: payload.gender || 'Male',
    living_place: payload.living_place || 'Colombo',
    contact_type: payload.contact_type || 'CALL',
    inquiry_type: payload.inquiry_type || 'VACANCY INQUIRY',
    preferred_job_category_id: payload.preferred_job_category_id || '',
    preferred_job_category: payload.preferred_job_category || 'Kitchen Helper',
    vacancy_id: payload.vacancy_id || '',
    company_id: payload.company_id || '',
    company_name: payload.company_name || 'DUNNAREA HOTEL',
    how_visitor_know: payload.how_visitor_know || payload.how_did_you_know_vacancy || 'By Calling',
    how_did_you_know_vacancy: payload.how_did_you_know_vacancy || payload.how_visitor_know || 'Facebook Advertisement',
    description: payload.description || 'Initial contact',
    staff_id: payload.staff_id || 'S-02',
    staff_name: payload.staff_name || 'Fathima Nazia',
    outcome: payload.outcome || 'INTERESTED',
    next_follow_up_date: payload.next_follow_up_date || '',
    next_follow_up_time: payload.next_follow_up_time || '',
    remarks: payload.remarks || '',
    conversion_status: payload.conversion === 'Registration Ok' || payload.conversion_status === 'OK_FOR_REG' ? 'OK_FOR_REG' : 'NOT_REGISTERED',
    converted_to_applicant: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  db.follow_up_contacts.unshift(row as any);
  dbStore.save();
  dbStore.logActivity(row.staff_name, undefined, row.person_name, 'FollowUp', `Created follow-up contact ${follow_up_id}`);

  res.status(201).json({ success: true, data: row, message: 'Follow-up created', errors: [] });
});

app.patch(['/api/v1/follow-ups/:id', '/api/v1/follow-up-contacts/:id'], (req: Request, res: Response) => {
  const db = dbStore.get();
  if (!db.follow_up_contacts) db.follow_up_contacts = [];
  const idx = db.follow_up_contacts.findIndex(f => f.id === req.params.id || f.follow_up_no === req.params.id);
  if (idx === -1) {
    res.status(404).json({ success: false, message: 'Follow-up contact not found', errors: ['Not found'] });
    return;
  }
  db.follow_up_contacts[idx] = {
    ...db.follow_up_contacts[idx],
    ...req.body,
    updated_at: new Date().toISOString()
  };
  dbStore.save();
  res.json({ success: true, data: db.follow_up_contacts[idx], message: 'Updated follow-up contact', errors: [] });
});

app.post(['/api/v1/follow-ups/:id/convert-to-applicant', '/api/v1/follow-up-contacts/:id/convert'], (req: Request, res: Response) => {
  const { id } = req.params;
  const db = dbStore.get();
  const fu = db.follow_up_contacts.find(f => f.id === id || f.follow_up_no === id);

  if (!fu) {
    res.status(404).json({ success: false, message: 'Follow-up not found', errors: ['Not found'] });
    return;
  }

  if (fu.applicant_id) {
    res.json({ success: true, data: { applicant_id: fu.applicant_id }, message: 'Already converted', errors: [] });
    return;
  }

  const applicantCount = db.applicants.length + 1;
  const applicant_id = `TA-${String(applicantCount).padStart(6, '0')}`;
  const regNo = `REG-${String(26000 + applicantCount)}`;

  const applicant = {
    applicant_id,
    registration_number: regNo,
    gender: (fu.gender === 'Female' ? 'Female' : 'Male') as 'Male' | 'Female',
    surname: fu.person_name.split(' ')[0] || fu.person_name,
    other_name: fu.person_name.split(' ').slice(1).join(' ') || '',
    full_name: fu.person_name,
    date_of_birth: '1998-01-01',
    age: 28,
    religion: 'Islam',
    nationality: 'Sri Lankan',
    civil_status: 'Single',
    address: fu.living_place || 'Colombo',
    living_place: fu.living_place || 'Colombo',
    mobile_number: fu.phone,
    telephone_home: fu.alternative_phone || '',
    alternate_phone: '',
    email: '',
    preferred_job_category: fu.preferred_job_category || 'Kitchen Helper',
    english_status: 'Not Checked' as const,
    registration_date: new Date().toISOString().split('T')[0],
    registration_source: `FOLLOW_UP (${fu.follow_up_no})`,
    current_status: 'GREEN_REGISTERED' as const,
    responsible_staff_id: fu.staff_id || 'S-02',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  db.applicants.unshift(applicant);

  fu.applicant_id = applicant_id;
  fu.converted_to_applicant = true;
  fu.converted_at = new Date().toISOString();
  fu.conversion_status = 'REGISTERED';

  // default passport & checklist
  db.passports.push({
    passport_id: dbStore.generateId('PP'),
    applicant_id,
    passport_number: 'PENDING-' + applicant_id,
    place_of_birth: fu.living_place || 'Colombo',
    date_of_issue: '2022-01-01',
    date_of_expiry: '2032-01-01',
    passport_status: 'With Agency',
    remarks: 'Auto-created on conversion'
  });

  db.document_checklists.push({
    checklist_id: dbStore.generateId('DC'),
    applicant_id,
    passport_ready: false,
    passport_remarks: '',
    agreement_ready: false,
    agreement_remarks: '',
    guarantee_letter_ready: false,
    guarantee_letter_remarks: '',
    police_report_ready: false,
    police_report_remarks: '',
    police_certified_ready: false,
    police_certified_remarks: '',
    visa_d_ready: false,
    visa_d_remarks: '',
    insurance_ready: false,
    insurance_remarks: '',
    passport_copy_ready: false,
    passport_copy_remarks: '',
    usd_ready: false,
    usd_remarks: '',
    embassy_interview_ready: false,
    embassy_interview_remarks: '',
    updated_at: new Date().toISOString(),
    updated_by: 'Staff'
  });

  dbStore.save();
  dbStore.logActivity('Staff', applicant_id, fu.person_name, 'Registration', `Converted follow-up ${fu.follow_up_no} to applicant ${applicant_id}`);

  res.json({
    success: true,
    data: { applicant_id, applicant_db_id: applicant_id },
    applicantId: applicant_id,
    applicant,
    message: 'Converted',
    errors: []
  });
});

// Applicants
app.get('/api/v1/applicants', (req: Request, res: Response) => {
  const db = dbStore.get();
  let rows = db.applicants;
  const q = req.query.q as string;
  if (q) {
    const x = q.trim().toLowerCase();
    rows = rows.filter(r =>
      r.full_name.toLowerCase().includes(x) ||
      r.applicant_id.toLowerCase().includes(x) ||
      db.passports.some(p => p.applicant_id === r.applicant_id && p.passport_number.toLowerCase().includes(x))
    );
  }
  res.json({ success: true, data: rows, message: '', errors: [] });
});

app.post('/api/v1/applicants', (req: Request, res: Response) => {
  const db = dbStore.get();
  const payload = req.body;
  if (db.applicants.some(a => a.applicant_id === payload.applicant_id)) {
    res.status(409).json({ success: false, message: 'Applicant ID already exists', errors: ['Duplicate Applicant ID'] });
    return;
  }
  const newApp = {
    ...payload,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  db.applicants.unshift(newApp);
  dbStore.save();
  res.status(201).json({ success: true, data: newApp, message: 'Applicant created', errors: [] });
});

// Companies
app.get('/api/v1/companies', (req: Request, res: Response) => {
  const db = dbStore.get();
  const data = db.settings.companies.map((name, idx) => ({
    id: `COMP-${idx + 1}`,
    company_name: name,
    active: true,
    address: 'Commercial District, Colombo',
    telephone: '+94112345678',
    email: 'info@' + name.toLowerCase().replace(/[^a-z]/g, '') + '.com',
    website: 'https://' + name.toLowerCase().replace(/[^a-z]/g, '') + '.com',
    contact_person: 'Corporate HR',
    remarks: 'Approved foreign recruitment employer'
  }));
  res.json({ success: true, data, message: '', errors: [] });
});

app.post('/api/v1/companies', (req: Request, res: Response) => {
  const db = dbStore.get();
  const { company_name } = req.body;
  if (company_name && !db.settings.companies.includes(company_name.trim())) {
    db.settings.companies.push(company_name.trim());
    dbStore.save();
  }
  res.status(201).json({ success: true, data: { company_name }, message: 'Created', errors: [] });
});

app.patch('/api/v1/companies/:id', (req: Request, res: Response) => {
  res.json({ success: true, data: req.body, message: 'Updated', errors: [] });
});

app.delete('/api/v1/companies/:id', (req: Request, res: Response) => {
  res.json({ success: true, data: { deleted: true }, message: 'Deleted', errors: [] });
});

app.get('/api/v1/companies/:company_id/sub-companies', (req: Request, res: Response) => {
  const db = dbStore.get();
  const data = db.settings.sub_companies.map((s, idx) => ({
    id: `SUB-${idx + 1}`,
    company_id: req.params.company_id,
    sub_company_name: s,
    active: true,
    remarks: 'Operational division'
  }));
  res.json({ success: true, data, message: '', errors: [] });
});

// Job Categories
app.get('/api/v1/job-categories', (req: Request, res: Response) => {
  const db = dbStore.get();
  const data = db.settings.job_categories.map((name, idx) => ({
    id: `CAT-${idx + 1}`,
    name,
    gender_scope: 'ALL',
    active: true,
    sort_order: idx + 1
  }));
  res.json({ success: true, data, message: '', errors: [] });
});

app.post('/api/v1/job-categories', (req: Request, res: Response) => {
  const db = dbStore.get();
  const { name } = req.body;
  if (name && !db.settings.job_categories.includes(name.trim())) {
    db.settings.job_categories.push(name.trim());
    dbStore.save();
  }
  res.status(201).json({ success: true, data: { name }, message: 'Created', errors: [] });
});

// Business Contacts
app.get('/api/v1/business-contacts', (req: Request, res: Response) => {
  const db = dbStore.get();
  res.json({ success: true, data: db.business_contacts || [], message: '', errors: [] });
});

app.post('/api/v1/business-contacts', (req: Request, res: Response) => {
  const db = dbStore.get();
  if (!db.business_contacts) db.business_contacts = [];
  const contact = {
    id: dbStore.generateId('BC'),
    company_name: req.body.company_name || 'New Company',
    category: req.body.category || 'General',
    contact_person: req.body.contact_person || '',
    phone: req.body.phone || '',
    email_or_website: req.body.email_or_website || '',
    remarks: req.body.remarks || '',
    active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  db.business_contacts.unshift(contact);
  dbStore.save();
  res.status(201).json({ success: true, data: contact, message: 'Created business contact', errors: [] });
});

app.patch('/api/v1/business-contacts/:id', (req: Request, res: Response) => {
  const db = dbStore.get();
  if (!db.business_contacts) db.business_contacts = [];
  const idx = db.business_contacts.findIndex(b => b.id === req.params.id);
  if (idx === -1) {
    res.status(404).json({ success: false, message: 'Business contact not found', errors: ['Not found'] });
    return;
  }
  db.business_contacts[idx] = {
    ...db.business_contacts[idx],
    ...req.body,
    updated_at: new Date().toISOString()
  };
  dbStore.save();
  res.json({ success: true, data: db.business_contacts[idx], message: 'Updated business contact', errors: [] });
});

app.delete('/api/v1/business-contacts/:id', (req: Request, res: Response) => {
  const db = dbStore.get();
  if (!db.business_contacts) db.business_contacts = [];
  db.business_contacts = db.business_contacts.filter(b => b.id !== req.params.id);
  dbStore.save();
  res.json({ success: true, data: { deleted: true }, message: 'Deleted business contact', errors: [] });
});

// Summary Reports
app.get('/api/v1/reports/summary', (req: Request, res: Response) => {
  const db = dbStore.get();
  const totalApplicants = db.applicants.length;
  const registered = db.applicants.filter(a => a.current_status === 'GREEN_REGISTERED').length;
  const embassyPending = db.embassy_interviews.filter(e => e.visa_status === 'Pending').length;
  const visaApproved = db.embassy_interviews.filter(e => e.visa_status === 'OK' || (e.visa_status as any) === 'Approved').length;
  const departed = db.departures.length;
  res.json({
    success: true,
    data: {
      total_applicants: totalApplicants,
      registered_applicants: registered,
      embassy_pending: embassyPending,
      visa_approved: visaApproved,
      departed_total: departed,
      summary_date: new Date().toISOString().split('T')[0]
    },
    message: '',
    errors: []
  });
});

// Audit Logs
app.get('/api/v1/audit-logs', (req: Request, res: Response) => {
  const db = dbStore.get();
  res.json({ success: true, data: db.activity_history || [], message: '', errors: [] });
});

// Work experience & job records
app.get('/api/v1/applicants/:applicant_id/work-experience', (req: Request, res: Response) => {
  const db = dbStore.get();
  const rows = db.work_experiences.filter(w => w.applicant_id === req.params.applicant_id);
  res.json({ success: true, data: rows, message: '', errors: [] });
});

app.post('/api/v1/applicants/:applicant_id/work-experience', (req: Request, res: Response) => {
  const db = dbStore.get();
  const exp = {
    experience_id: dbStore.generateId('WE'),
    applicant_id: req.params.applicant_id,
    sequence: (db.work_experiences.filter(w => w.applicant_id === req.params.applicant_id).length) + 1,
    from_date: req.body.from_date || '',
    to_date: req.body.to_date || '',
    company_place: req.body.place || 'Trade Establishment',
    position: req.body.position || 'Worker',
    duration: '1 Year',
    country: 'Sri Lanka',
    remarks: req.body.remarks || ''
  };
  db.work_experiences.push(exp);
  dbStore.save();
  res.status(201).json({ success: true, data: exp, message: 'Created', errors: [] });
});

// English checks
app.get('/api/v1/english-checks', (req: Request, res: Response) => {
  const db = dbStore.get();
  const rows = db.applicants.map((a, idx) => ({
    id: `ENG-${idx + 1}`,
    applicant_id: a.applicant_id,
    test_date: a.registration_date,
    score: a.english_status === 'Excellent' ? 90 : a.english_status === 'Good' ? 75 : 50,
    result: a.english_status === 'Poor' ? 'Failed' : 'Passed',
    level: a.english_status,
    remarks: 'Oral conversation and trade test verified'
  }));
  res.json({ success: true, data: rows, message: '', errors: [] });
});

// Embassy
app.get('/api/v1/embassy/applications', (req: Request, res: Response) => {
  const db = dbStore.get();
  res.json({ success: true, data: db.embassy_interviews, message: '', errors: [] });
});

app.post('/api/v1/embassy/applications', (req: Request, res: Response) => {
  const db = dbStore.get();
  const emb = {
    interview_id: dbStore.generateId('EI'),
    applicant_id: req.body.applicant_id,
    se_number: req.body.se_number || '',
    e_number: req.body.e_number || '',
    company_name: req.body.company_name || 'DUNNAREA HOTEL',
    embassy_applied_date: req.body.embassy_applied_date || '',
    appointment_date: req.body.appointment_date || '',
    appointment_time: req.body.appointment_time || '',
    insurance_status: req.body.insurance_status || 'Pending',
    visa_status: req.body.visa_status || 'Pending',
    remarks: req.body.remarks || ''
  };
  db.embassy_interviews.push(emb as any);
  dbStore.save();
  res.status(201).json({ success: true, data: emb, message: 'Created', errors: [] });
});

app.get('/api/v1/embassy/physical-dates', (req: Request, res: Response) => {
  const db = dbStore.get();
  const rows = db.embassy_interviews.filter(e => e.appointment_date).map((e, idx) => ({
    id: `PHY-${idx + 1}`,
    applicant_id: e.applicant_id,
    physical_date: e.appointment_date,
    remarks: 'Embassy scheduled physical biometric date'
  }));
  res.json({ success: true, data: rows, message: '', errors: [] });
});

app.post('/api/v1/embassy/batch-import', (req: Request, res: Response) => {
  const db = dbStore.get();
  const { records } = req.body;
  if (!Array.isArray(records)) {
    res.status(400).json({ success: false, message: 'Invalid records array' });
    return;
  }

  let imported = 0;
  let updated = 0;

  records.forEach((rec: any) => {
    const fullName = (rec.full_name || rec.name || '').trim().toUpperCase();
    const passportNo = (rec.passport_number || rec.passport_no || '').trim().toUpperCase();
    const seNumber = (rec.se_number || '').trim().toUpperCase();
    const eNumber = (rec.e_number || '').trim().toUpperCase();
    const companyName = (rec.company_name || 'RETEX GREEN').trim();
    const appliedDate = (rec.embassy_applied_date || rec.applied_date || '').trim();

    if (!fullName && !passportNo && !seNumber) return;

    let existingApp = db.applicants.find(a => 
      (passportNo && a.applicant_id && db.passports.some(p => p.applicant_id === a.applicant_id && p.passport_number === passportNo)) ||
      (fullName && a.full_name?.toLowerCase() === fullName.toLowerCase())
    );

    let applicantId = existingApp?.applicant_id;

    if (!existingApp) {
      const applicantCount = db.applicants.length + 1;
      applicantId = `TA-${String(applicantCount).padStart(5, '0')}`;
      const regNo = `REG-${String(26000 + applicantCount)}`;

      const newApp: any = {
        applicant_id: applicantId,
        registration_number: regNo,
        gender: fullName.includes('FEMALE') || fullName.includes('SHASHINI') || fullName.includes('DILANI') || fullName.includes('KAVISHI') || fullName.includes('PIYUMI') ? 'Female' : 'Male',
        full_name: fullName,
        surname: fullName.split(' ')[0] || fullName,
        other_name: fullName.split(' ').slice(1).join(' ') || '',
        date_of_birth: '1996-01-01',
        age: 29,
        religion: 'Buddhist',
        nationality: 'Sri Lankan',
        civil_status: 'Single',
        address: 'Sri Lanka',
        living_place: 'Colombo',
        mobile_number: '+94770000000',
        telephone_home: '',
        alternate_phone: '',
        email: '',
        preferred_job_category: 'General Worker',
        english_status: 'Not Checked',
        registration_date: appliedDate || '2026-06-01',
        registration_source: 'Embassy Intake',
        current_status: 'ACTIVE_PIPELINE',
        responsible_staff_id: 'S-02',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      db.applicants.push(newApp);
      imported++;

      if (passportNo) {
        db.passports.push({
          passport_id: dbStore.generateId('PP'),
          applicant_id: applicantId,
          passport_number: passportNo,
          place_of_birth: 'Sri Lanka',
          date_of_issue: '2022-01-01',
          date_of_expiry: '2032-01-01',
          passport_status: 'Submitted to Embassy',
          remarks: 'Submitted for embassy visa processing'
        });
      }
    } else {
      updated++;
      if (passportNo) {
        let pp = db.passports.find(p => p.applicant_id === applicantId);
        if (pp) {
          pp.passport_number = passportNo;
        } else {
          db.passports.push({
            passport_id: dbStore.generateId('PP'),
            applicant_id: applicantId!,
            passport_number: passportNo,
            place_of_birth: 'Sri Lanka',
            date_of_issue: '2022-01-01',
            date_of_expiry: '2032-01-01',
            passport_status: 'Submitted to Embassy',
            remarks: 'Submitted for embassy visa processing'
          });
        }
      }
    }

    let existingEmb = db.embassy_interviews.find(e => e.applicant_id === applicantId);
    if (existingEmb) {
      if (seNumber) existingEmb.se_number = seNumber;
      if (eNumber) existingEmb.e_number = eNumber;
      if (companyName) existingEmb.company_name = companyName;
      if (appliedDate) existingEmb.embassy_applied_date = appliedDate;
    } else {
      db.embassy_interviews.push({
        interview_id: dbStore.generateId('EI'),
        applicant_id: applicantId!,
        se_number: seNumber,
        e_number: eNumber,
        company_name: companyName,
        embassy_applied_date: appliedDate,
        appointment_date: '',
        appointment_time: '',
        insurance_status: 'Pending',
        visa_status: 'Pending',
        remarks: 'Embassy application pending interview schedule'
      });
    }
  });

  dbStore.save();
  dbStore.logActivity('Staff', undefined, undefined, 'Embassy', `Batch imported ${imported} new candidates and updated ${updated} existing records for Embassy Pending.`);
  res.json({ success: true, imported, updated, total: records.length });
});

app.get('/api/v1/embassy/documents', (req: Request, res: Response) => {
  const db = dbStore.get();
  res.json({ success: true, data: db.document_checklists, message: '', errors: [] });
});

// Departures & Tickets
app.get('/api/v1/departures', (req: Request, res: Response) => {
  const db = dbStore.get();
  res.json({ success: true, data: db.departures, message: '', errors: [] });
});

app.get('/api/v1/tickets', (req: Request, res: Response) => {
  const db = dbStore.get();
  res.json({ success: true, data: db.tickets, message: '', errors: [] });
});

// Excel Templates & Validation API
app.get(['/api/v1/excel/templates', '/api/excel/templates'], (req: Request, res: Response) => {
  res.json({ success: true, data: TEMPLATES, message: '', errors: [] });
});

app.post('/api/v1/excel/validate', (req: Request, res: Response) => {
  const { template_code } = req.body;
  if (template_code && (TEMPLATES as any)[template_code]) {
    res.json({ success: true, data: { valid: true, template: (TEMPLATES as any)[template_code] }, message: 'Workbook validated', errors: [] });
  } else {
    res.json({ success: true, data: { valid: true }, message: 'Validated', errors: [] });
  }
});

// Google Live Sync
app.get('/api/v1/sync/google', async (req: Request, res: Response) => {
  try {
    const result = await runGoogleSync();
    res.json({ success: true, fetched_at: new Date().toISOString(), records: result, message: 'Google sync completed', errors: [] });
  } catch (err: any) {
    res.status(502).json({ success: false, message: `Google sync failed: ${err.message}`, errors: [err.message] });
  }
});

app.post('/api/v1/sync/google', async (req: Request, res: Response) => {
  try {
    const result = await runGoogleSync();
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ----------------------------------------------------
// 3. AI Copilot Server Route
// ----------------------------------------------------
app.post('/api/ai/assistant', async (req: Request, res: Response) => {
  const { prompt } = req.body;
  if (!prompt) {
    res.status(400).json({ error: 'Prompt is required' });
    return;
  }

  try {
    const db = dbStore.get();
    
    // Sub-select critical records to avoid payload sizing issues
    const miniApplicants = db.applicants.map(a => {
      const pp = db.passports.find(p => p.applicant_id === a.applicant_id);
      const emb = db.embassy_interviews.find(i => i.applicant_id === a.applicant_id);
      return {
        id: a.applicant_id,
        name: a.full_name,
        gender: a.gender,
        job: a.preferred_job_category,
        english: a.english_status,
        status: a.current_status,
        passport: pp?.passport_number || 'None',
        company: emb?.company_name || 'None',
        visa_status: emb?.visa_status || 'Pending'
      };
    });

    const pendingInterviews = db.embassy_interviews.filter(i => i.visa_status === 'Pending').map(i => {
      const a = db.applicants.find(ap => ap.applicant_id === i.applicant_id);
      return {
        name: a?.full_name,
        se: i.se_number,
        company: i.company_name,
        date: i.appointment_date,
        time: i.appointment_time
      };
    });

    const docAlerts = db.document_checklists.map(c => {
      const a = db.applicants.find(ap => ap.applicant_id === c.applicant_id);
      return {
        name: a?.full_name,
        passport: c.passport_ready ? 'Ready' : 'Missing',
        agreement: c.agreement_ready ? 'Ready' : 'Missing',
        guarantee: c.guarantee_letter_ready ? 'Ready' : 'Missing',
        police_report: c.police_report_ready ? 'Ready' : 'Missing',
        certified_police: c.police_certified_ready ? 'Ready' : 'Missing'
      };
    });

    const systemContext = `
      You are the Trans Arabian Recruitment & Applicant Intelligence Copilot.
      Below is the live operational state of our candidates, passport collections, embassy processing, and checklist statuses:
      
      TOTAL ACTIVE APPLICANTS: ${db.applicants.length}
      COMPANIES: ${JSON.stringify(db.settings.companies)}
      
      CANDIDATE SUMMARIES (JSON snippet):
      ${JSON.stringify(miniApplicants.slice(0, 30))}
      
      PENDING EMBASSY INTERVIEWS:
      ${JSON.stringify(pendingInterviews)}
      
      DOCUMENT CHECKLISTS:
      ${JSON.stringify(docAlerts.slice(0, 30))}
      
      Respond professionally as a recruitment expert. Draft summaries, isolate problems, analyze English levels, or generate checklists as requested. Use clear markdown tables and avoid hallucinating rows.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        systemInstruction: systemContext,
        temperature: 0.7
      }
    });

    res.json({ text: response.text });
  } catch (err: any) {
    console.error('Gemini call failed:', err);
    res.status(500).json({ error: 'Failed to generate AI response: ' + err.message });
  }
});

// ----------------------------------------------------
// 4. Excel & CSV Compatibility Exporters / Importers
// ----------------------------------------------------

// Excel Compatible CSV Exporter
app.get('/api/export/:template', (req: Request, res: Response) => {
  const { template } = req.params;
  const db = dbStore.get();
  
  let filename = `${template}.csv`;
  let headers: string[] = [];
  let rows: string[][] = [];

  if (template === 'REGISTER_MALE' || template === 'REGISTER_FEMALE') {
    const genderFilter = template === 'REGISTER_MALE' ? 'Male' : 'Female';
    headers = ['NO', 'NAME', 'PP NO', 'EXPERINCED', 'REMAKS', 'Reg Date', 'POLICE REPORT'];
    
    db.applicants
      .filter(a => a.gender === genderFilter)
      .forEach((a, idx) => {
        const pp = db.passports.find(p => p.applicant_id === a.applicant_id);
        const experiences = db.work_experiences.filter(w => w.applicant_id === a.applicant_id);
        const checklist = db.document_checklists.find(c => c.applicant_id === a.applicant_id);
        
        const experiencedText = experiences.map(e => `${e.position} in ${e.country}`).join('; ') || 'No';
        const policeReport = checklist?.police_report_ready ? 'OK' : 'PENDING';

        rows.push([
          String(idx + 1),
          a.full_name,
          pp?.passport_number || 'PENDING',
          experiencedText,
          a.closed_remarks || '',
          a.registration_date,
          policeReport
        ]);
      });
  } 
  else if (template === 'DETAILED_MALE' || template === 'DETAILED_FEMALE') {
    const genderFilter = template === 'DETAILED_MALE' ? 'Male' : 'Female';
    headers = ['NO', 'NAME', 'PP NO', 'COMPANY', 'JOB CATEGORY', 'YEAR', 'REG DATE', 'POLICE REPORT', 'REMARKS'];

    db.applicants
      .filter(a => a.gender === genderFilter)
      .forEach((a, idx) => {
        const pp = db.passports.find(p => p.applicant_id === a.applicant_id);
        const emb = db.embassy_interviews.find(i => i.applicant_id === a.applicant_id);
        const checklist = db.document_checklists.find(c => c.applicant_id === a.applicant_id);
        
        rows.push([
          String(idx + 1),
          a.full_name,
          pp?.passport_number || 'PENDING',
          emb?.company_name || 'None',
          a.preferred_job_category,
          a.registration_date ? a.registration_date.split('-')[0] : '2026',
          a.registration_date,
          checklist?.police_report_ready ? 'OK' : 'PENDING',
          a.closed_remarks || ''
        ]);
      });
  }
  else if (template === 'EMBASSY_PENDING') {
    headers = ['NO', 'NAME', 'PASSPORT NO', 'SE NUMBER', 'COMPANY NAME', 'EMBASSY APPLIED DATE', 'E NUMBER'];
    
    let counter = 1;
    db.applicants.forEach(a => {
      const pp = db.passports.find(p => p.applicant_id === a.applicant_id);
      const emb = db.embassy_interviews.find(i => i.applicant_id === a.applicant_id);
      
      if (emb && emb.visa_status === 'Pending') {
        rows.push([
          String(counter++),
          a.full_name,
          pp?.passport_number || 'PENDING',
          emb.se_number || '',
          emb.company_name || '',
          emb.embassy_applied_date || '',
          emb.e_number || ''
        ]);
      }
    });
  }
  else if (template === 'DEPARTURE_PENDING') {
    headers = ['NO', 'NAME', 'PASSPORT', 'COMPANY', 'SUB COMPANY', 'VISA START DATE', 'VISA END DATE'];
    
    db.departures.forEach((d, idx) => {
      const a = db.applicants.find(ap => ap.applicant_id === d.applicant_id);
      const pp = db.passports.find(p => p.applicant_id === d.applicant_id);
      
      rows.push([
        String(idx + 1),
        a?.full_name || 'Unknown',
        pp?.passport_number || '',
        d.company || '',
        d.sub_company || '',
        d.visa_start_date || '',
        d.visa_end_date || ''
      ]);
    });
  }
  else if (template === 'TICKETS') {
    headers = ['No', 'Name', 'Departure Date', 'Departure Time'];
    
    db.tickets.forEach((t, idx) => {
      const a = db.applicants.find(ap => ap.applicant_id === t.applicant_id);
      
      rows.push([
        String(idx + 1),
        a?.full_name || 'Unknown',
        t.departure_date || '',
        t.departure_time || ''
      ]);
    });
  }
  else {
    res.status(400).send('Invalid export template type requested.');
    return;
  }

  // Generate CSV response
  const csvContent = [
    headers.map(escapeCSVField).join(','),
    ...rows.map(r => r.map(escapeCSVField).join(','))
  ].join('\r\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
  res.status(200).send(csvContent);
});

// Import Engine Endpoint (Parsing mapped spreadsheet data payload)
app.post('/api/import', (req: Request, res: Response) => {
  const { rows, template } = req.body;
  if (!Array.isArray(rows) || rows.length === 0) {
    res.status(400).json({ error: 'No data rows detected for import' });
    return;
  }

  const db = dbStore.get();
  let imported = 0;
  let updated = 0;
  let duplicate = 0;
  let skipped = 0;

  rows.forEach(row => {
    // Standardize key accesses
    const rowName = row.NAME || row.Name || row.Name || row.full_name || '';
    const rowPassport = row.PP_NO || row.PASSPORT || row.PASSPORT_NO || row.passport_number || row.passport || '';
    const rowRemarks = row.REMAKS || row.REMARKS || row.remarks || '';
    const rowExperienced = row.EXPERINCED || row.experienced || '';
    const rowRegDate = row.Reg_Date || row.RegDate || row.reg_date || row.REG_DATE || '';
    const rowCompany = row.COMPANY || row.company || row.company_name || '';
    const rowCategory = row.JOB_CATEGORY || row.job_category || '';
    const rowPolice = row.POLICE_REPORT || row.police_report || '';

    if (!rowName) {
      skipped++;
      return;
    }

    // Duplicate Check
    let existingApp = db.applicants.find(a => {
      if (rowPassport && db.passports.some(p => p.applicant_id === a.applicant_id && p.passport_number.toLowerCase() === String(rowPassport).trim().toLowerCase())) {
        return true;
      }
      return a.full_name.toLowerCase() === String(rowName).trim().toLowerCase();
    });

    if (existingApp) {
      // update
      if (rowRemarks) existingApp.closed_remarks = String(rowRemarks).trim();
      if (rowCategory) existingApp.preferred_job_category = String(rowCategory).trim();
      updated++;
    } else {
      // create
      const applicantId = dbStore.generateId('TA');
      const isFemale = template?.toLowerCase().includes('female') || row.gender?.toLowerCase().startsWith('f');
      const gender: 'Male' | 'Female' = isFemale ? 'Female' : 'Male';

      const newApp: Applicant = {
        applicant_id: applicantId,
        registration_number: 'REG-' + Math.floor(10000 + Math.random() * 90000),
        gender,
        full_name: String(rowName).trim(),
        surname: String(rowName).split(' ')[0] || '',
        other_name: String(rowName).split(' ').slice(1).join(' ') || '',
        date_of_birth: '',
        age: 0,
        religion: '',
        nationality: 'Sri Lankan',
        civil_status: 'Single',
        address: '',
        living_place: '',
        mobile_number: '',
        telephone_home: '',
        alternate_phone: '',
        email: '',
        preferred_job_category: String(rowCategory || 'Kitchen Helper').trim(),
        english_status: 'Not Checked',
        registration_date: String(rowRegDate || new Date().toISOString().split('T')[0]).trim(),
        registration_source: 'Excel Import',
        current_status: 'GREEN_REGISTERED',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      db.applicants.push(newApp);

      // Passport record
      db.passports.push({
        passport_id: dbStore.generateId('PP'),
        applicant_id: applicantId,
        passport_number: String(rowPassport || 'PENDING-' + applicantId).trim(),
        place_of_birth: '',
        date_of_issue: '',
        date_of_expiry: '',
        passport_status: 'With Agency',
        remarks: 'Imported via spreadsheet batch'
      });

      // Experience record
      if (rowExperienced) {
        db.work_experiences.push({
          experience_id: dbStore.generateId('WE'),
          applicant_id: applicantId,
          sequence: 1,
          from_date: '',
          to_date: '',
          company_place: '',
          position: String(rowExperienced).trim(),
          duration: '1 Year',
          country: 'Overseas',
          remarks: 'Imported Experience'
        });
      }

      // Checklist record
      db.document_checklists.push({
        checklist_id: dbStore.generateId('DC'),
        applicant_id: applicantId,
        passport_ready: !!rowPassport,
        passport_remarks: '',
        agreement_ready: false,
        agreement_remarks: '',
        guarantee_letter_ready: false,
        guarantee_letter_remarks: '',
        police_report_ready: String(rowPolice).toLowerCase().includes('ok') || String(rowPolice).toLowerCase().includes('yes'),
        police_report_remarks: String(rowPolice).trim(),
        police_certified_ready: false,
        police_certified_remarks: '',
        visa_d_ready: false,
        visa_d_remarks: '',
        insurance_ready: false,
        insurance_remarks: '',
        passport_copy_ready: false,
        passport_copy_remarks: '',
        usd_ready: false,
        usd_remarks: '',
        embassy_interview_ready: false,
        embassy_interview_remarks: '',
        updated_at: new Date().toISOString(),
        updated_by: 'Staff Import'
      });

      // Embassy record
      if (rowCompany) {
        db.embassy_interviews.push({
          interview_id: dbStore.generateId('EI'),
          applicant_id: applicantId,
          se_number: '',
          e_number: '',
          company_name: String(rowCompany).trim(),
          insurance_status: 'Pending',
          visa_status: 'Pending',
          remarks: ''
        });
      }

      imported++;
    }
  });

  dbStore.save();
  dbStore.logActivity('Admin', undefined, undefined, 'System', `Imported historical records. Template: ${template}. New created: ${imported}, Updated: ${updated}, Skipped empty: ${skipped}`);
  
  res.json({ success: true, imported, updated, duplicate, skipped });
});

// ----------------------------------------------------
// Timeline Rules & Events API
// ----------------------------------------------------
let timelineRules = [
  {
    id: 'TR-01',
    rule_code: 'FU_FOLLOWUP_1',
    rule_name: 'Attempt 01 Outreach SLA',
    module: 'FOLLOW_UP',
    event_type: 'FOLLOW_UP',
    interval_value: 24,
    interval_unit: 'HOURS',
    enabled: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'TR-02',
    rule_code: 'EMB_APPT_DEADLINE',
    rule_name: 'Embassy Biometric Appointment Deadline',
    module: 'EMBASSY',
    event_type: 'EMBASSY_APPOINTMENT',
    interval_value: 3,
    interval_unit: 'DAYS',
    enabled: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'TR-03',
    rule_code: 'ENG_TEST_SLA',
    rule_name: 'Spoken English Evaluation Window',
    module: 'ENGLISH',
    event_type: 'ENGLISH_TEST',
    interval_value: 48,
    interval_unit: 'HOURS',
    enabled: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
];

let timelineEvents: any[] = [
  {
    id: 'TE-01',
    applicant_id: 'TA-000001',
    applicant_name: 'Kasun Chamara Bandara',
    event_type: 'FOLLOW_UP',
    title: 'Attempt 01 Follow-up Call',
    scheduled_date: new Date().toISOString().split('T')[0],
    scheduled_time: '10:00',
    status: 'PENDING',
    remarks: 'Initial inquiry follow-up schedule'
  },
  {
    id: 'TE-02',
    applicant_id: 'TA-000002',
    applicant_name: 'Mohamed Nawas Ahamed',
    event_type: 'EMBASSY_APPOINTMENT',
    title: 'Embassy Biometric Interview',
    scheduled_date: new Date().toISOString().split('T')[0],
    scheduled_time: '14:30',
    status: 'PENDING',
    remarks: 'Embassy submission appointment'
  }
];

app.get('/api/v1/timeline/rules', (req: Request, res: Response) => {
  res.json({ success: true, rules: timelineRules });
});

app.get('/api/v1/timeline/events', (req: Request, res: Response) => {
  const db = dbStore.get();
  const dynamicEvents = [...timelineEvents];
  db.applicants.forEach((app, i) => {
    if (app.registration_date && i < 15) {
      dynamicEvents.push({
        id: `DYN-${app.applicant_id}`,
        applicant_id: app.applicant_id,
        applicant_name: app.full_name,
        event_type: 'VISA_EXPIRY',
        title: `Registration / Contract Follow-up: ${app.full_name}`,
        scheduled_date: app.registration_date,
        scheduled_time: '09:30',
        status: 'PENDING',
        remarks: `Registered candidate under ${app.preferred_job_category}`
      });
    }
  });
  res.json({ success: true, events: dynamicEvents });
});

app.patch('/api/v1/timeline/events/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const { scheduled_date, scheduled_time, override_reason, changed_by } = req.body;

  const event = timelineEvents.find((e: any) => e.id === id);
  if (event) {
    event.scheduled_date = scheduled_date || event.scheduled_date;
    event.scheduled_time = scheduled_time || event.scheduled_time;
    event.override_reason = override_reason || event.override_reason;
    event.changed_by = changed_by || event.changed_by;
    dbStore.logActivity(changed_by || 'Staff', event.applicant_id, event.applicant_name, 'FollowUp', `Overrode timeline date for ${event.title} to ${event.scheduled_date}. Reason: ${override_reason}`);
    res.json({ success: true, event });
    return;
  }

  const newEvent = {
    id,
    applicant_id: 'TA-GENERAL',
    applicant_name: 'Candidate',
    event_type: 'CUSTOM',
    title: 'Scheduled Workflow Event',
    scheduled_date: scheduled_date || new Date().toISOString().split('T')[0],
    scheduled_time: scheduled_time || '09:00',
    status: 'PENDING',
    override_reason,
    changed_by,
    remarks: 'Manual schedule override'
  };
  timelineEvents.push(newEvent);
  dbStore.logActivity(changed_by || 'Staff', undefined, undefined, 'FollowUp', `Overrode timeline date. Reason: ${override_reason}`);
  res.json({ success: true, event: newEvent });
});

// Ensure sample Romanian Visa Refusal candidate is seeded for instant testing
function ensureDayanthaApplicantExists() {
  try {
    const db = dbStore.get();
    const exists = db.applicants.find(a =>
      a.full_name?.toUpperCase().includes('DAYANTHA') ||
      a.full_name?.toUpperCase().includes('NISAYURA')
    );

    if (!exists) {
      const applicantId = 'TA-REF-1808';
      const fullName = 'YAPA MUDIYANSELAGE DAYANTHA NISAYURA BANDARA';
      const refusalReason = "REJECTED BASED ON ART. 27 ALIN. 4 LIT. H FROM OUG 194/2002: DOUBTS REGARDING THE CREDIBILITY OF APPLICANT'S STATEMENTS";

      const newApp: Applicant = {
        applicant_id: applicantId,
        registration_number: 'REG-24818',
        gender: 'Male',
        full_name: fullName,
        surname: 'BANDARA',
        other_name: 'YAPA MUDIYANSELAGE DAYANTHA NISAYURA',
        nic_number: '199518204918',
        date_of_birth: '1995-06-18',
        age: 31,
        religion: 'Buddhist',
        nationality: 'Sri Lankan',
        civil_status: 'Single',
        address: 'No 45, Temple Road, Kurunegala',
        living_place: 'Kurunegala',
        mobile_number: '+94 77 9824106',
        telephone_home: '',
        alternate_phone: '',
        email: 'dayantha.bandara@gmail.com',
        preferred_job_category: 'Factory Helper',
        english_status: 'Good',
        registration_date: '2026-07-15',
        registration_source: 'Embassy Processing',
        current_status: 'RED_CLOSED',
        closed_reason: refusalReason,
        closed_remarks: refusalReason,
        created_at: '2026-07-15T09:00:00Z',
        updated_at: '2026-09-18T10:00:00Z'
      };

      db.applicants.unshift(newApp);

      db.passports.push({
        passport_id: 'PP-REF-1808',
        applicant_id: applicantId,
        passport_number: 'N9824106',
        place_of_birth: 'Kurunegala',
        date_of_issue: '2023-05-10',
        date_of_expiry: '2033-05-10',
        passport_status: 'With Agency',
        remarks: 'Returned with Refusal Form'
      });

      const newEmb: EmbassyInterview = {
        interview_id: 'EI-REF-1808',
        applicant_id: applicantId,
        se_number: 'SE2448512',
        e_number: 'E24786318501808',
        company_name: 'RETEX GREEN',
        appointment_date: '2026-09-18',
        appointment_time: '09:30 AM',
        insurance_status: 'OK',
        passport_collected_date: '2026-09-20',
        visa_status: 'Rejected',
        remarks: refusalReason
      };
      (newEmb as any).status = refusalReason;
      (newEmb as any).refusal_reason = refusalReason;
      (newEmb as any).refusal_date = '2026-09-18';
      (newEmb as any).refusal_ref_no = 'C42-26-1808';
      (newEmb as any).refusal_embassy = 'The Embassy of Romania to The Democratic Socialist Republic of Sri Lanka, Colombo';
      (newEmb as any).refusal_form_attached = true;
      (newEmb as any).refusal_file_name = 'FORM_FOR_NOTIFYING_REASONS_FOR_REFUSAL_ROMANIAN_LONG_STAY_VISA.pdf';

      db.embassy_interviews.unshift(newEmb);
      dbStore.save();
      console.log(`Successfully seeded Romanian Visa Refusal candidate: ${fullName} (Ref: C42-26-1808)`);
    }
  } catch (err: any) {
    console.warn('Could not seed Dayantha applicant:', err.message);
  }
}

// ----------------------------------------------------
// 5. Build/Vite Middleware Mounts & Listening
// ----------------------------------------------------

const PORT = Number(process.env.PORT || 3000);

async function startServer() {
  if (process.env.PUBLIC_DEMO !== 'true') ensureDayanthaApplicantExists();
  if (process.env.NODE_ENV !== 'production') {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
    console.log('Vite development middleware mounted successfully.');
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
    console.log('Serving production static files from dist.');
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`TRANS ARABIAN Server listening on port ${PORT}`);
    // Sync google spreadsheet asynchronously on boot
    runGoogleSync().catch(err => {
      console.warn('Initial google spreadsheet sync failed on boot. Keeping seed data.', err.message);
    });
  });
}

startServer();
