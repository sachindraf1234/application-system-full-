import fs from 'fs';
import path from 'path';
import type { CVData, AppFormat } from '../src/types.js';

// Core entity interfaces
export interface Applicant {
  applicant_id: string; // Master unique ID (e.g. "TA-00001")
  registration_number: string;
  gender: 'Male' | 'Female';
  full_name: string;
  surname: string;
  other_name: string;
  nic_number?: string;
  date_of_birth: string;
  age: number;
  religion: string;
  nationality: string;
  civil_status: string;
  height?: string;
  weight?: string;
  address: string;
  living_place: string;
  mobile_number: string;
  telephone_home: string;
  alternate_phone: string;
  email: string;
  preferred_job_category: string;
  english_status: 'Excellent' | 'Good' | 'Average' | 'Basic' | 'Poor' | 'Not Checked' | 'Passed' | 'Failed';
  english_level?: 'A' | 'B' | 'C' | string;
  english_percentage?: number | string;
  spoken_english_level?: 'A' | 'B' | 'C' | string;
  spoken_english_percentage?: number | string;
  registration_date: string;
  registration_source: string;
  current_status: 'GREEN_REGISTERED' | 'FOLLOW_UP' | 'RED_CLOSED' | 'ACTIVE_PIPELINE' | 'DEPARTED';
  closed_reason?: string;
  closed_remarks?: string;
  applicant_photo?: string; // Base64 or local path
  responsible_staff_id?: string;
  register_card_no?: string;
  register_by?: string;
  applied_as_couple?: 'Yes' | 'No';
  partner_name?: string;
  whatsapp_number?: string;
  complexion?: string;
  children_count?: number;
  children_ages?: string;
  father_name?: string;
  mother_name?: string;
  spouse_name?: string;
  last_work_place_abroad?: string;
  returned_on?: string;
  post?: string;
  ref_no?: string;
  english_attempt_1?: number | null;
  english_attempt_2?: number | null;
  english_attempt_3?: number | null;
  english_rating?: string;
  english_evaluator?: string;
  english_evaluator_notes?: string;
  created_at: string;
  updated_at: string;
}

export interface Passport {
  passport_id: string;
  applicant_id: string;
  passport_number: string;
  place_of_birth: string;
  date_of_issue: string;
  date_of_expiry: string;
  passport_copy?: string; // Base64 or local path
  passport_status: 'With Applicant' | 'With Agency' | 'Submitted to Embassy' | 'Collected from Embassy';
  passport_collected_date?: string;
  remarks: string;
}

export interface Education {
  education_id: string;
  applicant_id: string;
  education_qualification: string;
  professional_qualification: string;
  languages: string[];
  english_status: string;
  arabic_status: string;
  other_language?: string;
  driving_license_number?: string;
  driving_license_issue_date?: string;
  driving_license_type?: string;
}

export interface WorkExperience {
  experience_id: string;
  applicant_id: string;
  sequence: number;
  from_date: string;
  to_date: string;
  company_place: string;
  position: string;
  duration: string;
  country: string;
  remarks: string;
}

export interface FollowUp {
  followup_id: string;
  applicant_id: string;
  followup_number: 1 | 2 | 3 | number; // Follow-up 01, 02, 03
  followup_date: string;
  followup_type: string;
  contacted_by: string; // Staff ID or Name
  method: 'Call' | 'WhatsApp' | 'In-Person' | 'Email' | 'Other';
  result: 'No Answer' | 'Busy' | 'Interested' | 'Not Interested' | 'Will Come to Office' | 'Asked for Callback' | 'Wrong Number';
  description: string;
  next_action: string;
  next_followup_date?: string;
  status: string;
  created_at: string;
}

export interface EmbassyInterview {
  interview_id: string;
  applicant_id: string;
  se_number: string;
  e_number: string;
  company_name: string;
  embassy_applied_date?: string;
  appointment_date?: string;
  appointment_time?: string;
  insurance_status: 'Pending' | 'Paid' | 'Not Required' | 'OK';
  passport_collected_date?: string;
  visa_status: 'Pending' | 'OK' | 'Rejected' | 'APPLIED' | 'DID NOT FACE INTERVIEW' | 'Other';
  departure_date?: string;
  remarks: string;
}

export interface DocumentChecklist {
  checklist_id: string;
  applicant_id: string;
  passport_ready: boolean;
  passport_remarks: string;
  agreement_ready: boolean;
  agreement_remarks: string;
  guarantee_letter_ready: boolean;
  guarantee_letter_remarks: string;
  police_report_ready: boolean;
  police_report_remarks: string;
  police_certified_ready: boolean;
  police_certified_remarks: string;
  visa_d_ready: boolean;
  visa_d_remarks: string;
  insurance_ready: boolean;
  insurance_remarks: string;
  passport_copy_ready: boolean;
  passport_copy_remarks: string;
  usd_ready: boolean; // USD payment/fee paid
  usd_remarks: string;
  embassy_interview_ready: boolean;
  embassy_interview_remarks: string;
  updated_at: string;
  updated_by: string;
}

export interface Departure {
  departure_id: string;
  applicant_id: string;
  company: string;
  sub_company: string;
  visa_start_date?: string;
  visa_end_date?: string;
  remarks: string;
}

export interface Ticket {
  ticket_id: string;
  applicant_id: string;
  departure_date?: string;
  departure_time?: string;
  flight_number: string;
  airport: string;
  ticket_number: string;
  booking_status: 'Booked' | 'Confirmed' | 'Pending' | 'Cancelled';
  remarks: string;
}

export interface ActivityLog {
  log_id: string;
  timestamp: string;
  user: string;
  applicant_id?: string;
  applicant_name?: string;
  module: 'Registration' | 'Application' | 'FollowUp' | 'Embassy' | 'Documents' | 'Departure' | 'Ticketing' | 'System' | 'Sync';
  action: string;
  previous_value?: string;
  new_value?: string;
}

export interface Staff {
  staff_id: string;
  name: string;
  telephone: string;
  role: 'Administrator' | 'Registration Staff' | 'Embassy Staff' | 'Departure/Ticket Staff' | 'Viewer';
  active: boolean;
}

export interface SyncLog {
  sync_id: string;
  timestamp: string;
  status: 'SUCCESS' | 'FAILED';
  records_fetched: number;
  records_inserted: number;
  records_updated: number;
  records_skipped: number;
  records_duplicate: number;
  errors?: string;
}

export interface SystemSettings {
  google_sheet_url: string;
  google_apps_script_endpoint: string;
  companies: string[];
  sub_companies: string[];
  job_categories: string[];
}

export interface FollowUpContact {
  id: string;
  follow_up_no: string;
  applicant_id?: string | null;
  contact_date: string;
  contact_time: string;
  person_name: string;
  phone: string;
  alternative_phone?: string;
  gender?: 'Male' | 'Female' | 'Other';
  living_place?: string;
  contact_type: 'CALL' | 'WALK-IN / VISIT' | 'WHATSAPP' | 'MESSAGE' | 'REFERRAL' | 'OTHER';
  inquiry_type: 'VACANCY INQUIRY' | 'JOB INQUIRY' | 'COMPANY INQUIRY' | 'REGISTRATION INQUIRY' | 'VISA / PROCESS INQUIRY' | 'GENERAL INQUIRY' | 'OTHER';
  preferred_job_category?: string;
  vacancy_id?: string;
  company_name?: string;
  description: string;
  outcome: 'INTERESTED' | 'CALL BACK LATER' | 'WILL VISIT OFFICE' | 'VISITED BUT DID NOT REGISTER' | 'NO VACANCY AVAILABLE' | 'NOT INTERESTED' | 'REGISTERED' | 'UNREACHABLE' | 'OTHER';
  staff_id?: string;
  staff_name?: string;
  next_follow_up_date?: string;
  next_follow_up_time?: string;
  remarks?: string;
  conversion_status: 'NOT_REGISTERED' | 'PLANNING_TO_REGISTER' | 'REGISTERED' | 'NOT_INTERESTED';
  converted_to_applicant: boolean;
  converted_at?: string;
  created_at: string;
  updated_at: string;
}

export interface BusinessContact {
  id: string;
  company_name: string;
  category?: string;
  contact_person: string;
  phone: string;
  email_or_website: string;
  remarks?: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TimelineRule {
  id: string;
  rule_code: string;
  rule_name: string;
  module: 'FOLLOW_UP' | 'REGISTRATION' | 'ENGLISH' | 'EMBASSY' | 'DEPARTURE' | 'TICKET';
  event_type: string;
  interval_value: number;
  interval_unit: 'MINUTES' | 'HOURS' | 'DAYS' | 'WEEKS' | 'MONTHS';
  enabled: boolean;
  company_name?: string;
  job_category?: string;
  created_at: string;
  updated_at: string;
}

export interface TimelineEvent {
  id: string;
  applicant_id?: string;
  applicant_name?: string;
  event_type: 'FOLLOW_UP' | 'VISIT' | 'ENGLISH_TEST' | 'DOCUMENT_DEADLINE' | 'EMBASSY_APPOINTMENT' | 'PASSPORT_COLLECTION' | 'VISA_EXPIRY' | 'DEPARTURE' | 'TICKET' | 'CUSTOM';
  title: string;
  scheduled_date: string;
  scheduled_time?: string;
  status: 'PENDING' | 'COMPLETED' | 'OVERDUE' | 'CANCELLED';
  suggested_date?: string;
  override_reason?: string;
  changed_by?: string;
  remarks?: string;
}

export interface Vacancy {
  id: string;
  vacancy_code: string;
  company_name: string;
  sub_company?: string;
  job_category: string;
  number_required: number;
  number_filled: number;
  salary?: string;
  location?: string;
  requirements?: string;
  status: 'OPEN' | 'CLOSED' | 'ON_HOLD';
  opening_date: string;
}

export interface CVApplication {
  application_id: string;
  applicant_id: string | null;
  format: AppFormat;
  data: CVData;
  created_at: string;
  updated_at: string;
}

export interface DBState {
  applicants: Applicant[];
  cv_applications: CVApplication[];
  evisa_applications: Array<{ applicant_id: string; data: Record<string, unknown>; updated_at: string }>;
  passports: Passport[];
  education: Education[];
  work_experiences: WorkExperience[];
  followups: FollowUp[];
  follow_up_contacts: FollowUpContact[];
  business_contacts: BusinessContact[];
  timeline_rules: TimelineRule[];
  timeline_events: TimelineEvent[];
  vacancies: Vacancy[];
  embassy_interviews: EmbassyInterview[];
  document_checklists: DocumentChecklist[];
  departures: Departure[];
  tickets: Ticket[];
  activity_history: ActivityLog[];
  staff: Staff[];
  sync_logs: SyncLog[];
  settings: SystemSettings;
}

const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(process.cwd(), 'data'));
const DATA_FILE = path.join(DATA_DIR, 'database.json');

// Initial seed data representing realistic records from the imported historical spreadsheets
const INITIAL_STAFF: Staff[] = [
  { staff_id: 'S-01', name: 'Althaf Hussain', telephone: '+94771234567', role: 'Administrator', active: true },
  { staff_id: 'S-02', name: 'Fathima Nazia', telephone: '+94777654321', role: 'Registration Staff', active: true },
  { staff_id: 'S-03', name: 'Rizwan Ahmed', telephone: '+94779988776', role: 'Embassy Staff', active: true },
  { staff_id: 'S-04', name: 'Mohamed Shiyam', telephone: '+94772233445', role: 'Departure/Ticket Staff', active: true }
];

const INITIAL_COMPANIES = [
  'DUNNAREA HOTEL',
  'CREDIT MADAMAT CON SRL',
  'ASIA RECRUITMENT (CUSCO WELDERS)',
  'AL FUTTAIM GROUP',
  'EMIRATES CATERING',
  'QATAR AIRWAYS SERVICES'
];

const INITIAL_SUB_COMPANIES = [
  'CUSCO WELDERS DEPT',
  'DUNNAREA RESTAURANTS',
  'AL REYAMI CONTRACTING',
  'None'
];

const INITIAL_JOB_CATEGORIES = [
  'Kitchen Helper',
  'Chef',
  'Factory Helper',
  'Welder',
  'Housekeeping',
  'Security Guard',
  'Driver',
  'Sales Associate'
];

const INITIAL_SEED_APPLICANTS: DBState = {
  cv_applications: [],
  evisa_applications: [],
  applicants: [
    {
      applicant_id: 'TA-00001',
      registration_number: 'REG-26001',
      gender: 'Male',
      full_name: 'MOHAMED ASLAM MARZOOQ',
      surname: 'MOHAMED',
      other_name: 'ASLAM MARZOOQ',
      date_of_birth: '1995-04-12',
      age: 31,
      religion: 'Islam',
      nationality: 'Sri Lankan',
      civil_status: 'Married',
      address: '124/B Galle Road, Colombo 03',
      living_place: 'Colombo',
      mobile_number: '+94771223344',
      telephone_home: '+94112233445',
      alternate_phone: '+94779900112',
      email: 'aslam.marzooq@example.com',
      preferred_job_category: 'Kitchen Helper',
      english_status: 'Excellent',
      registration_date: '2026-01-15',
      registration_source: 'Office Walk-in',
      current_status: 'GREEN_REGISTERED',
      responsible_staff_id: 'S-02',
      created_at: '2026-01-15T10:00:00Z',
      updated_at: '2026-09-24T04:00:00Z'
    },
    {
      applicant_id: 'TA-00002',
      registration_number: 'REG-26002',
      gender: 'Male',
      full_name: 'DINESH PRIYANTHA SILVA',
      surname: 'SILVA',
      other_name: 'DINESH PRIYANTHA',
      date_of_birth: '1992-08-23',
      age: 34,
      religion: 'Buddhist',
      nationality: 'Sri Lankan',
      civil_status: 'Single',
      address: '45 Temple Road, Negombo',
      living_place: 'Negombo',
      mobile_number: '+94714455667',
      telephone_home: '+94314455667',
      alternate_phone: '',
      email: 'dinesh.silva@example.com',
      preferred_job_category: 'Welder',
      english_status: 'Average',
      registration_date: '2026-01-20',
      registration_source: 'Agent Link',
      current_status: 'ACTIVE_PIPELINE',
      responsible_staff_id: 'S-02',
      created_at: '2026-01-20T11:30:00Z',
      updated_at: '2026-09-24T04:00:00Z'
    },
    {
      applicant_id: 'TA-00003',
      registration_number: 'REG-26003',
      gender: 'Female',
      full_name: 'PRIYANKA HARSHANI PERERA',
      surname: 'PERERA',
      other_name: 'PRIYANKA HARSHANI',
      date_of_birth: '1998-11-02',
      age: 27,
      religion: 'Christian',
      nationality: 'Sri Lankan',
      civil_status: 'Single',
      address: '72/1 St. Jude Road, Kurunegala',
      living_place: 'Kurunegala',
      mobile_number: '+94769988776',
      telephone_home: '',
      alternate_phone: '+94761122334',
      email: 'priyanka.p@example.com',
      preferred_job_category: 'Housekeeping',
      english_status: 'Good',
      registration_date: '2026-02-01',
      registration_source: 'Facebook Ad',
      current_status: 'ACTIVE_PIPELINE',
      responsible_staff_id: 'S-02',
      created_at: '2026-02-01T09:15:00Z',
      updated_at: '2026-09-24T04:00:00Z'
    },
    {
      applicant_id: 'TA-00004',
      registration_number: 'REG-26004',
      gender: 'Male',
      full_name: 'ABDUL RAHMAN SAJID',
      surname: 'ABDUL RAHMAN',
      other_name: 'SAJID',
      date_of_birth: '1989-05-18',
      age: 37,
      religion: 'Islam',
      nationality: 'Sri Lankan',
      civil_status: 'Married',
      address: '99 Mosque Lane, Kalutara',
      living_place: 'Kalutara',
      mobile_number: '+94775556677',
      telephone_home: '',
      alternate_phone: '',
      email: 'sajid.rahman@example.com',
      preferred_job_category: 'Chef',
      english_status: 'Good',
      registration_date: '2026-02-10',
      registration_source: 'Office Walk-in',
      current_status: 'RED_CLOSED',
      closed_reason: 'Accepted another job',
      closed_remarks: 'Joined a local hotel instead. Decided not to proceed with travel.',
      responsible_staff_id: 'S-02',
      created_at: '2026-02-10T14:20:00Z',
      updated_at: '2026-03-05T16:00:00Z'
    },
    {
      applicant_id: 'TA-00005',
      registration_number: 'REG-26005',
      gender: 'Female',
      full_name: 'KAVINDA GAYATHRI FERNANDO',
      surname: 'FERNANDO',
      other_name: 'KAVINDA GAYATHRI',
      date_of_birth: '1996-03-30',
      age: 30,
      religion: 'Buddhist',
      nationality: 'Sri Lankan',
      civil_status: 'Married',
      address: '12 Beach Road, Chilaw',
      living_place: 'Chilaw',
      mobile_number: '+94723344556',
      telephone_home: '',
      alternate_phone: '',
      email: 'gayathri.f@example.com',
      preferred_job_category: 'Factory Helper',
      english_status: 'Basic',
      registration_date: '2026-02-15',
      registration_source: 'Newspaper Ad',
      current_status: 'FOLLOW_UP',
      responsible_staff_id: 'S-02',
      created_at: '2026-02-15T08:00:00Z',
      updated_at: '2026-09-24T04:00:00Z'
    }
  ],
  passports: [
    {
      passport_id: 'PP-00001',
      applicant_id: 'TA-00001',
      passport_number: 'N11301688',
      place_of_birth: 'Colombo',
      date_of_issue: '2021-06-15',
      date_of_expiry: '2031-06-15',
      passport_status: 'With Agency',
      remarks: 'Original passport deposited in office'
    },
    {
      passport_id: 'PP-00002',
      applicant_id: 'TA-00002',
      passport_number: 'N22876543',
      place_of_birth: 'Negombo',
      date_of_issue: '2023-01-10',
      date_of_expiry: '2033-01-10',
      passport_status: 'Submitted to Embassy',
      remarks: 'Submitted for Romania visa application'
    },
    {
      passport_id: 'PP-00003',
      applicant_id: 'TA-00003',
      passport_number: 'N33456789',
      place_of_birth: 'Kurunegala',
      date_of_issue: '2022-09-12',
      date_of_expiry: '2032-09-12',
      passport_status: 'With Agency',
      remarks: 'Passport copy uploaded, original with agency'
    },
    {
      passport_id: 'PP-00004',
      applicant_id: 'TA-00004',
      passport_number: 'N44567891',
      place_of_birth: 'Kalutara',
      date_of_issue: '2020-02-18',
      date_of_expiry: '2030-02-18',
      passport_status: 'With Applicant',
      remarks: 'Returned to applicant on closure'
    },
    {
      passport_id: 'PP-00005',
      applicant_id: 'TA-00005',
      passport_number: 'N55678912',
      place_of_birth: 'Chilaw',
      date_of_issue: '2024-03-01',
      date_of_expiry: '2034-03-01',
      passport_status: 'With Applicant',
      remarks: 'Pending collection'
    }
  ],
  education: [
    {
      education_id: 'ED-00001',
      applicant_id: 'TA-00001',
      education_qualification: 'G.C.E. O/L Passed',
      professional_qualification: 'NVQ Level 3 in Hospitality Support',
      languages: ['English', 'Sinhala'],
      english_status: 'Excellent',
      arabic_status: 'Basic'
    },
    {
      education_id: 'ED-00002',
      applicant_id: 'TA-00002',
      education_qualification: 'G.C.E. A/L Technical',
      professional_qualification: 'Structural Welding Certificate 3G',
      languages: ['English', 'Sinhala'],
      english_status: 'Average',
      arabic_status: 'None'
    }
  ],
  work_experiences: [
    {
      experience_id: 'WE-00001',
      applicant_id: 'TA-00001',
      sequence: 1,
      from_date: '2022-01-01',
      to_date: '2024-12-31',
      company_place: 'Galle Face Hotel, Colombo',
      position: 'Assistant Commis',
      duration: '3 Years',
      country: 'Sri Lanka',
      remarks: 'Has experience in hot kitchen and food preparation'
    },
    {
      experience_id: 'WE-00002',
      applicant_id: 'TA-00002',
      sequence: 1,
      from_date: '2019-03-01',
      to_date: '2022-05-30',
      company_place: 'Doha Steel Works',
      position: 'Welder',
      duration: '3 Years, 2 Months',
      country: 'Qatar',
      remarks: 'Returned in June 2022'
    }
  ],
  followups: [
    {
      followup_id: 'FU-00001',
      applicant_id: 'TA-00005',
      followup_number: 1,
      followup_date: '2026-02-18',
      followup_type: 'Follow-up 01',
      contacted_by: 'Althaf Hussain',
      method: 'Call',
      result: 'Interested',
      description: 'Called Gayle. She is highly interested, but needs to arrange police report certified copy.',
      next_action: 'Call again next week to check status of police report',
      next_followup_date: '2026-02-25',
      status: 'Pending Document',
      created_at: '2026-02-18T10:00:00Z'
    },
    {
      followup_id: 'FU-00002',
      applicant_id: 'TA-00004',
      followup_number: 1,
      followup_date: '2026-02-15',
      followup_type: 'Follow-up 01',
      contacted_by: 'Fathima Nazia',
      method: 'Call',
      result: 'No Answer',
      description: 'First attempt, no answer. Left a WhatsApp message.',
      next_action: 'Try again tomorrow',
      next_followup_date: '2026-02-16',
      status: 'No Response',
      created_at: '2026-02-15T11:00:00Z'
    },
    {
      followup_id: 'FU-00003',
      applicant_id: 'TA-00004',
      followup_number: 2,
      followup_date: '2026-02-16',
      followup_type: 'Follow-up 02',
      contacted_by: 'Fathima Nazia',
      method: 'Call',
      result: 'Asked for Callback',
      description: 'Second attempt. Candidate requested call after 5 PM.',
      next_action: 'Call evening',
      next_followup_date: '2026-02-16',
      status: 'In Progress',
      created_at: '2026-02-16T09:30:00Z'
    },
    {
      followup_id: 'FU-00004',
      applicant_id: 'TA-00004',
      followup_number: 3,
      followup_date: '2026-03-05',
      followup_type: 'Follow-up 03',
      contacted_by: 'Fathima Nazia',
      method: 'Call',
      result: 'Not Interested',
      description: 'Third attempt. Candidate states he accepted another job in local hotel and will not proceed.',
      next_action: 'Mark applicant RED status / Close file',
      status: 'Closed',
      created_at: '2026-03-05T15:45:00Z'
    }
  ],
  embassy_interviews: [
    {
      interview_id: 'EI-00001',
      applicant_id: 'TA-00001',
      se_number: 'SE-987654',
      e_number: 'E-554433',
      company_name: 'DUNNAREA HOTEL',
      embassy_applied_date: '2026-04-10',
      appointment_date: '2026-05-15',
      appointment_time: '09:30 AM',
      insurance_status: 'OK',
      passport_collected_date: '2026-06-01',
      visa_status: 'OK',
      departure_date: '2026-07-20',
      remarks: 'Interview successful, visa issued'
    },
    {
      interview_id: 'EI-00002',
      applicant_id: 'TA-00002',
      se_number: 'SE-987655',
      e_number: 'E-554434',
      company_name: 'ASIA RECRUITMENT (CUSCO WELDERS)',
      embassy_applied_date: '2026-08-01',
      appointment_date: '2026-09-28',
      appointment_time: '11:00 AM',
      insurance_status: 'Pending',
      visa_status: 'Pending',
      remarks: 'Awaiting embassy interview appointment next week'
    },
    {
      interview_id: 'EI-00003',
      applicant_id: 'TA-00003',
      se_number: 'SE240',
      e_number: 'E40210',
      company_name: 'DUNNAREA HOTEL',
      embassy_applied_date: '2026-09-15',
      appointment_date: '',
      appointment_time: '',
      insurance_status: 'Pending',
      visa_status: 'Pending',
      remarks: 'SE240 number allocated. Awaiting appointment schedule email.'
    },
    {
      interview_id: 'EI-00004',
      applicant_id: 'TA-00004',
      se_number: 'SE240',
      e_number: 'E40211',
      company_name: 'DUNNAREA HOTEL',
      embassy_applied_date: '2026-09-15',
      appointment_date: '',
      appointment_time: '',
      insurance_status: 'Pending',
      visa_status: 'Pending',
      remarks: 'SE240 number allocated. Embassy submission file completed.'
    },
    {
      interview_id: 'EI-00005',
      applicant_id: 'TA-00005',
      se_number: 'SE241',
      e_number: 'E40212',
      company_name: 'AL-MARAI / ARABIAN GROUP',
      embassy_applied_date: '2026-09-18',
      appointment_date: '',
      appointment_time: '',
      insurance_status: 'Pending',
      visa_status: 'Pending',
      remarks: 'SE241 batch received. Waiting for embassy biometric call.'
    },
    {
      interview_id: 'EI-00006',
      applicant_id: 'TA-00006',
      se_number: 'SE241',
      e_number: 'E40213',
      company_name: 'AL-MARAI / ARABIAN GROUP',
      embassy_applied_date: '2026-09-18',
      appointment_date: '',
      appointment_time: '',
      insurance_status: 'Pending',
      visa_status: 'Pending',
      remarks: 'SE241 batch received. Passport submitted with agency.'
    }
  ],
  document_checklists: [
    {
      checklist_id: 'DC-00001',
      applicant_id: 'TA-00001',
      passport_ready: true,
      passport_remarks: 'With Agency. In safe.',
      agreement_ready: true,
      agreement_remarks: 'Signed and uploaded',
      guarantee_letter_ready: true,
      guarantee_letter_remarks: 'Verified by Sponsor',
      police_report_ready: true,
      police_report_remarks: 'Clear of records',
      police_certified_ready: true,
      police_certified_remarks: 'Certified by Ministry',
      visa_d_ready: true,
      visa_d_remarks: 'D-form filled',
      insurance_ready: true,
      insurance_remarks: 'Allianz Romania covered',
      passport_copy_ready: true,
      passport_copy_remarks: 'Uploaded',
      usd_ready: true,
      usd_remarks: 'Sponsor fee cleared',
      embassy_interview_ready: true,
      embassy_interview_remarks: 'Passed on 2026-05-15',
      updated_at: '2026-09-24T04:00:00Z',
      updated_by: 'Althaf Hussain'
    },
    {
      checklist_id: 'DC-00002',
      applicant_id: 'TA-00002',
      passport_ready: true,
      passport_remarks: 'Deposited for embassy submission',
      agreement_ready: true,
      agreement_remarks: 'Verified',
      guarantee_letter_ready: true,
      guarantee_letter_remarks: 'Received',
      police_report_ready: true,
      police_report_remarks: 'Clear',
      police_certified_ready: false,
      police_certified_remarks: 'Awaiting certification',
      visa_d_ready: true,
      visa_d_remarks: 'Done',
      insurance_ready: false,
      insurance_remarks: 'Pending purchase',
      passport_copy_ready: true,
      passport_copy_remarks: 'Checked',
      usd_ready: true,
      usd_remarks: 'Cleared',
      embassy_interview_ready: false,
      embassy_interview_remarks: 'Scheduled for 2026-09-28',
      updated_at: '2026-09-24T04:00:00Z',
      updated_by: 'Rizwan Ahmed'
    }
  ],
  departures: [
    {
      departure_id: 'DEP-00001',
      applicant_id: 'TA-00001',
      company: 'DUNNAREA HOTEL',
      sub_company: 'DUNNAREA RESTAURANTS',
      visa_start_date: '2026-06-01',
      visa_end_date: '2028-06-01',
      remarks: 'Departure completed. Staff deployed.'
    },
    {
      departure_id: 'DEP-00002',
      applicant_id: 'TA-00002',
      company: 'ASIA RECRUITMENT (CUSCO WELDERS)',
      sub_company: 'CUSCO WELDERS DEPT',
      visa_start_date: '2026-09-15',
      visa_end_date: '2028-09-15',
      remarks: 'Awaiting final visa stamping before departure scheduling'
    }
  ],
  tickets: [
    {
      ticket_id: 'TKT-00001',
      applicant_id: 'TA-00001',
      departure_date: '2026-07-20',
      departure_time: '14:30',
      flight_number: 'Gulf Air GF 145',
      airport: 'Colombo BIA (CMB)',
      ticket_number: 'GF-982348512',
      booking_status: 'Confirmed',
      remarks: 'Travelled. Checked in.'
    }
  ],
  follow_up_contacts: [
    {
      id: 'FUC-001',
      follow_up_no: 'FU-1001',
      applicant_id: null,
      contact_date: '2026-09-20',
      contact_time: '10:30',
      person_name: 'KAVINDA PERERA',
      phone: '+94778123456',
      alternative_phone: '+94112345678',
      gender: 'Male',
      living_place: 'Gampaha',
      contact_type: 'CALL',
      inquiry_type: 'VACANCY INQUIRY',
      preferred_job_category: 'Kitchen Helper',
      company_name: 'DUNNAREA HOTEL',
      description: 'Inquired about kitchen helper vacancies in DUNNAREA HOTEL. Discussed salary and contract terms. Invited to visit office for registration.',
      outcome: 'WILL VISIT OFFICE',
      staff_id: 'S-02',
      staff_name: 'Fathima Nazia',
      next_follow_up_date: '2026-09-26',
      next_follow_up_time: '11:00',
      remarks: 'Promised to bring original passport on Saturday',
      conversion_status: 'NOT_REGISTERED',
      converted_to_applicant: false,
      created_at: '2026-09-20T10:30:00Z',
      updated_at: '2026-09-20T10:30:00Z'
    },
    {
      id: 'FUC-002',
      follow_up_no: 'FU-1002',
      applicant_id: null,
      contact_date: '2026-09-22',
      contact_time: '14:15',
      person_name: 'SANDUNI JAYASINGHE',
      phone: '+94719876543',
      gender: 'Female',
      living_place: 'Kandy',
      contact_type: 'WALK-IN / VISIT',
      inquiry_type: 'JOB INQUIRY',
      preferred_job_category: 'Housekeeping',
      company_name: 'EMIRATES CATERING',
      description: 'Visited office asking for Dubai Housekeeping opportunities. Has 2 years experience in local hotel.',
      outcome: 'INTERESTED',
      staff_id: 'S-02',
      staff_name: 'Fathima Nazia',
      next_follow_up_date: '2026-09-27',
      next_follow_up_time: '10:00',
      remarks: 'Awaiting police clearance report before submitting formal application',
      conversion_status: 'PLANNING_TO_REGISTER',
      converted_to_applicant: false,
      created_at: '2026-09-22T14:15:00Z',
      updated_at: '2026-09-22T14:15:00Z'
    }
  ],
  business_contacts: [
    {
      id: 'BC-001',
      company_name: 'COCO CHIPS BUYERS - GLOBAL AGRO',
      category: 'COCO CHIPS BUYERS',
      contact_person: 'Mr. David Harrison',
      phone: '+442079460912',
      email_or_website: 'david@globalagro.co.uk',
      remarks: 'Bulk exporter contact for coconut substrate products',
      active: true,
      created_at: '2026-01-10T09:00:00Z',
      updated_at: '2026-01-10T09:00:00Z'
    },
    {
      id: 'BC-002',
      company_name: 'CUSCO INDUSTRIAL FABRICATIONS',
      category: 'EMPLOYER PARTNER',
      contact_person: 'Eng. Carlos Rodriguez',
      phone: '+390266981234',
      email_or_website: 'c.rodriguez@cusco-welding.it',
      remarks: 'Welder quota coordinator for European contracts',
      active: true,
      created_at: '2026-02-01T11:30:00Z',
      updated_at: '2026-02-01T11:30:00Z'
    }
  ],
  timeline_rules: [
    {
      id: 'TR-001',
      rule_code: 'FU_INIT_01',
      rule_name: 'Initial Call Follow-up Reminder',
      module: 'FOLLOW_UP',
      event_type: 'FOLLOW_UP',
      interval_value: 3,
      interval_unit: 'DAYS',
      enabled: true,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z'
    },
    {
      id: 'TR-002',
      rule_code: 'EMB_APP_01',
      rule_name: 'Embassy Appointment Reminder',
      module: 'EMBASSY',
      event_type: 'EMBASSY_APPOINTMENT',
      interval_value: 7,
      interval_unit: 'DAYS',
      enabled: true,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z'
    },
    {
      id: 'TR-003',
      rule_code: 'TKT_DEP_01',
      rule_name: 'Departure Flight Ticket Warning',
      module: 'TICKET',
      event_type: 'DEPARTURE',
      interval_value: 5,
      interval_unit: 'DAYS',
      enabled: true,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z'
    }
  ],
  timeline_events: [
    {
      id: 'TLE-001',
      applicant_id: 'TA-00002',
      applicant_name: 'DINESH PRIYANTHA SILVA',
      event_type: 'EMBASSY_APPOINTMENT',
      title: 'Biometric & Visa Interview Appointment',
      scheduled_date: '2026-09-28',
      scheduled_time: '09:30',
      status: 'PENDING',
      remarks: 'Scheduled at Italian Embassy Colombo'
    },
    {
      id: 'TLE-002',
      applicant_id: 'TA-00003',
      applicant_name: 'FATIMA NUSRA SHARIFA',
      event_type: 'ENGLISH_TEST',
      title: 'English Spoken Verification Level 2',
      scheduled_date: '2026-09-25',
      scheduled_time: '11:00',
      status: 'PENDING',
      remarks: 'Oral conversation check before company submission'
    }
  ],
  vacancies: [
    {
      id: 'VAC-001',
      vacancy_code: 'VAC-2026-DUN',
      company_name: 'DUNNAREA HOTEL',
      sub_company: 'DUNNAREA RESTAURANTS',
      job_category: 'Kitchen Helper',
      number_required: 25,
      number_filled: 18,
      salary: '1800 AED + Accommodation',
      location: 'Dubai, UAE',
      requirements: 'Basic English, Age 21-35, Clean Police Record',
      status: 'OPEN',
      opening_date: '2026-01-01'
    },
    {
      id: 'VAC-002',
      vacancy_code: 'VAC-2026-CUS',
      company_name: 'ASIA RECRUITMENT (CUSCO WELDERS)',
      sub_company: 'CUSCO WELDERS DEPT',
      job_category: 'Welder',
      number_required: 15,
      number_filled: 12,
      salary: '2400 EUR + Food Allowance',
      location: 'Milan, Italy',
      requirements: 'TIG/MIG Trade Certificate, 2+ Yrs Overseas Experience',
      status: 'OPEN',
      opening_date: '2026-02-10'
    }
  ],
  activity_history: [
    {
      log_id: 'LOG-00001',
      timestamp: '2026-01-15T10:05:00Z',
      user: 'Fathima Nazia',
      applicant_id: 'TA-00001',
      applicant_name: 'MOHAMED ASLAM MARZOOQ',
      module: 'Registration',
      action: 'Applicant registered in green status came physically to office'
    },
    {
      log_id: 'LOG-00002',
      timestamp: '2026-03-05T16:05:00Z',
      user: 'Fathima Nazia',
      applicant_id: 'TA-00004',
      applicant_name: 'ABDUL RAHMAN SAJID',
      module: 'FollowUp',
      action: 'Closed file and marked status RED after third follow-up failure'
    }
  ],
  staff: INITIAL_STAFF,
  sync_logs: [
    {
      sync_id: 'SYN-00001',
      timestamp: '2026-09-24T03:00:00Z',
      status: 'SUCCESS',
      records_fetched: 15,
      records_inserted: 0,
      records_updated: 0,
      records_skipped: 15,
      records_duplicate: 0
    }
  ],
  settings: {
    google_sheet_url: 'https://docs.google.com/spreadsheets/d/1vCUGvbA66VCVZyUIK-4MYkRTt9tLsNRjmTY1mFrwSfyIC9yz1I/edit',
    google_apps_script_endpoint: 'https://script.google.com/macros/s/AKfycby9YMtFFzPVdcUGvbA66VCVZyUIK-4MYkRTt9tLsNRjmTY1mFrwSfyIC9yz1I1GYMGmVQ/exec',
    companies: INITIAL_COMPANIES,
    sub_companies: INITIAL_SUB_COMPANIES,
    job_categories: INITIAL_JOB_CATEGORIES
  }
};

export class DBStore {
  private static instance: DBStore;
  private state: DBState;

  private constructor() {
    this.state = this.load();
  }

  public static getInstance(): DBStore {
    if (!DBStore.instance) {
      DBStore.instance = new DBStore();
    }
    return DBStore.instance;
  }

  private load(): DBState {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      if (!fs.existsSync(DATA_FILE)) {
        this.saveState(INITIAL_SEED_APPLICANTS);
        return INITIAL_SEED_APPLICANTS;
      }
      const data = fs.readFileSync(DATA_FILE, 'utf8');
      const parsed = JSON.parse(data) as DBState;
      // Guarantee nested arrays exist
      return {
        applicants: parsed.applicants || [],
        cv_applications: parsed.cv_applications || [],
        evisa_applications: parsed.evisa_applications || [],
        passports: parsed.passports || [],
        education: parsed.education || [],
        work_experiences: parsed.work_experiences || [],
        followups: parsed.followups || [],
        follow_up_contacts: parsed.follow_up_contacts || INITIAL_SEED_APPLICANTS.follow_up_contacts || [],
        business_contacts: parsed.business_contacts || INITIAL_SEED_APPLICANTS.business_contacts || [],
        timeline_rules: parsed.timeline_rules || INITIAL_SEED_APPLICANTS.timeline_rules || [],
        timeline_events: parsed.timeline_events || INITIAL_SEED_APPLICANTS.timeline_events || [],
        vacancies: parsed.vacancies || INITIAL_SEED_APPLICANTS.vacancies || [],
        embassy_interviews: parsed.embassy_interviews || [],
        document_checklists: parsed.document_checklists || [],
        departures: parsed.departures || [],
        tickets: parsed.tickets || [],
        activity_history: parsed.activity_history || [],
        staff: parsed.staff || INITIAL_STAFF,
        sync_logs: parsed.sync_logs || [],
        settings: parsed.settings || INITIAL_SEED_APPLICANTS.settings
      };
    } catch (err) {
      console.error('Error loading DB State. Falling back to initial seed.', err);
      return INITIAL_SEED_APPLICANTS;
    }
  }

  private saveState(state: DBState): void {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      const tempPath = DATA_FILE + '.tmp';
      fs.writeFileSync(tempPath, JSON.stringify(state, null, 2), 'utf8');
      fs.renameSync(tempPath, DATA_FILE);
    } catch (err) {
      console.error('Failed to save database state atomically:', err);
    }
  }

  public get(): DBState {
    return this.state;
  }

  public save(): void {
    this.saveState(this.state);
  }

  public logActivity(
    user: string,
    applicantId: string | undefined,
    applicantName: string | undefined,
    module: ActivityLog['module'],
    action: string,
    prev?: string,
    next?: string
  ): void {
    const log: ActivityLog = {
      log_id: 'LOG-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      timestamp: new Date().toISOString(),
      user,
      applicant_id: applicantId,
      applicant_name: applicantName,
      module,
      action,
      previous_value: prev,
      new_value: next
    };
    this.state.activity_history.unshift(log);
    // cap logs at 2000
    if (this.state.activity_history.length > 2000) {
      this.state.activity_history = this.state.activity_history.slice(0, 2000);
    }
    this.save();
  }

  public generateId(prefix: string): string {
    return prefix + '-' + Math.floor(100000 + Math.random() * 900000);
  }
}
