export interface FollowUpContact {
  id: string;
  follow_up_no: string; // e.g., "FU-1001"
  applicant_id?: string | null; // Nullable before conversion
  contact_date: string;
  contact_time: string;
  person_name: string;
  age?: number | string;
  phone: string;
  alternative_phone?: string;
  gender?: 'Male' | 'Female' | 'Other';
  living_place?: string;
  contact_type: 'CALL' | 'WALK-IN / VISIT' | 'WHATSAPP' | 'MESSAGE' | 'REFERRAL' | 'OTHER';
  inquiry_type: 'VACANCY INQUIRY' | 'JOB INQUIRY' | 'COMPANY INQUIRY' | 'REGISTRATION INQUIRY' | 'VISA / PROCESS INQUIRY' | 'GENERAL INQUIRY' | 'OTHER';
  preferred_job_category?: string;
  how_visitor_know?: string; // "By Calling", "By Facebook", "By WhatsApp", "Heard from Someone", "From Some Person", "From who already went to work from our agency", "Inquiries Finished / Registered"
  how_did_you_know_vacancy?: string; // "Facebook Advertisement", "WhatsApp Group", "Friend Referral", "Alumni Referral", etc.
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
  category?: string; // e.g. "COCO CHIPS BUYERS", "DIPLOMATIC", "SUPPLIER"
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

export interface AuditLogEntry {
  id: string;
  user_name: string;
  module: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'IMPORT' | 'EXPORT' | 'CONVERSION' | 'STATUS_CHANGE' | 'TIMELINE_OVERRIDE' | 'SYNC';
  record_type: string;
  record_id: string;
  record_name?: string;
  old_value?: string;
  new_value?: string;
  timestamp: string;
  ip_address?: string;
}

export interface Company {
  id: string;
  company_name: string;
  contact_person?: string;
  phone?: string;
  email?: string;
  address?: string;
  active: boolean;
  sub_companies: string[];
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

export interface Applicant {
  applicant_id: string; // Master unique ID (e.g. "TA-00001")
  registration_number: string; // e.g. "REG-10492"
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
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  emergency_contact_relationship?: string;
  preferred_job_category: string;
  english_status: 'Excellent' | 'Good' | 'Average' | 'Basic' | 'Poor' | 'Not Checked' | 'Passed' | 'Failed';
  english_level?: 'A' | 'B' | 'C' | string;
  english_percentage?: number | string;
  spoken_english_level?: 'A' | 'B' | 'C' | string;
  spoken_english_percentage?: number | string;
  arabic_status?: 'Fluent' | 'Working' | 'Basic' | 'None';
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
  english_test_date_1?: string;
  english_test_time_1?: string;
  english_attendance_1?: 'Pending' | 'Came to the Test' | 'Not Came';
  english_remarks_1?: string;
  english_test_date_2?: string;
  english_test_time_2?: string;
  english_attendance_2?: 'Pending' | 'Came to the Test' | 'Not Came';
  english_remarks_2?: string;
  english_test_date_3?: string;
  english_test_time_3?: string;
  english_attendance_3?: 'Pending' | 'Came to the Test' | 'Not Came';
  english_remarks_3?: string;
  english_current_attempt?: number;
  inquiry_source?: string;
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
  passport_copy?: string;
  passport_status: 'With Applicant' | 'With Agency' | 'Submitted to Embassy' | 'Collected from Embassy' | 'Lost/Cancelled';
  passport_collected_date?: string;
  physical_rack_location?: string;
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
  followup_number: number;
  followup_date: string;
  followup_type: string;
  contacted_by: string;
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
  police_certify_expire_date?: string;
  police_certified_date?: string;
  visa_d_ready: boolean;
  visa_d_remarks: string;
  insurance_ready: boolean;
  insurance_remarks: string;
  passport_copy_ready: boolean;
  passport_copy_remarks: string;
  usd_ready: boolean;
  usd_remarks: string;
  embassy_interview_ready: boolean;
  embassy_interview_remarks: string;
  medical_fit_ready?: boolean;
  medical_fit_remarks?: string;
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
  agency_name: string;
  agency_email: string;
  agency_phone: string;
  agency_address: string;
  companies: string[];
  sub_companies: string[];
  job_categories: string[];
}

export type ExcelSectionType =
  | 'register_male'
  | 'register_female'
  | 'embassy_pending'
  | 'departure_pending'
  | 'tickets'
  | 'all_master';

export interface ApplicantOverview {
  applicant_id: string;
  registration_number: string;
  gender: 'Male' | 'Female';
  full_name: string;
  surname: string;
  other_name: string;
  nic_number?: string;
  date_of_birth?: string;
  age?: number;
  religion?: string;
  nationality?: string;
  civil_status?: string;
  height?: string;
  weight?: string;
  address?: string;
  living_place: string;
  mobile_number: string;
  telephone_home?: string;
  alternate_phone?: string;
  email?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  emergency_contact_relationship?: string;
  preferred_job_category: string;
  english_status: string;
  english_level?: 'A' | 'B' | 'C' | string;
  english_percentage?: number | string;
  spoken_english_level?: 'A' | 'B' | 'C' | string;
  spoken_english_percentage?: number | string;
  arabic_status?: string;
  registration_date: string;
  registration_source?: string;
  current_status: 'GREEN_REGISTERED' | 'FOLLOW_UP' | 'RED_CLOSED' | 'ACTIVE_PIPELINE' | 'DEPARTED';
  closed_reason?: string;
  closed_remarks?: string;
  passport_number: string;
  passport_expiry: string;
  passport_status: string;
  passport_place_of_birth?: string;
  passport_issue_date?: string;
  physical_rack_location?: string;
  company_name: string;
  sub_company?: string;
  se_number: string;
  e_number: string;
  visa_status: string;
  visa_start_date?: string;
  visa_end_date?: string;
  embassy_applied_date?: string;
  appointment_date?: string;
  appointment_time?: string;
  interview_status?: string;
  refusal_reason?: string;
  refusal_date?: string;
  refusal_ref_no?: string;
  refusal_embassy?: string;
  refusal_form_attached?: boolean;
  passport_collected_date?: string;
  insurance_status?: string;
  english_attempt_1?: number | null;
  english_attempt_2?: number | null;
  english_attempt_3?: number | null;
  english_rating?: string;
  english_evaluator?: string;
  english_evaluator_notes?: string;
  english_test_date_1?: string;
  english_test_time_1?: string;
  english_attendance_1?: 'Pending' | 'Came to the Test' | 'Not Came';
  english_remarks_1?: string;
  english_test_date_2?: string;
  english_test_time_2?: string;
  english_attendance_2?: 'Pending' | 'Came to the Test' | 'Not Came';
  english_remarks_2?: string;
  english_test_date_3?: string;
  english_test_time_3?: string;
  english_attendance_3?: 'Pending' | 'Came to the Test' | 'Not Came';
  english_remarks_3?: string;
  english_current_attempt?: number;
  departure_date: string;
  departure_time?: string;
  flight_number?: string;
  airport?: string;
  ticket_number?: string;
  booking_status?: string;
  staff_name: string;
  responsible_staff_id?: string;
  applicant_photo?: string;
  followup_count?: number;
  latest_followup?: FollowUp | null;
  checklist?: DocumentChecklist | null;
  departure?: Departure | null;
  ticket?: Ticket | null;
  // Excel Sheet Specific Computed & Formatted Fields
  police_report_status?: string;
  police_report_ready?: boolean;
  police_certify_expire_date?: string;
  police_certified_date?: string;
  experienced?: string;
  year?: string;
  education_qualification?: string;
  professional_qualification?: string;
  driving_license_number?: string;
  driving_license_type?: string;
  experience_summary?: string;
  experiences?: WorkExperience[];
  // New Enhanced Fields
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
  inquiry_source?: string;
}

export interface DashboardStats {
  total: number;
  males: number;
  females: number;
  statuses: { green: number; followUp: number; red: number; activePipeline: number };
  followups: { fu1: number; fu2: number; fu3: number };
  embassy: { pending: number; scheduled: number; approved: number; rejected: number };
  departure: { pending: number; ticketsIssued: number; departed: number };
  jobCategories: Array<{ name: string; value: number }>;
  pipeline: Array<{ name: string; count: number }>;
  recentActivities: Array<ActivityLog>;
  syncStatus: SyncLog | null;
}

export interface ApplicantFullDetails {
  profile: Applicant;
  passport: Passport | null;
  education: Education | null;
  experiences: WorkExperience[];
  followups: FollowUp[];
  embassy: EmbassyInterview | null;
  checklist: DocumentChecklist | null;
  departure: Departure | null;
  ticket: Ticket | null;
  logs: ActivityLog[];
}

// ==================== BILINGUAL CV & APPLICATION CREATION TYPES ====================
export type AppFormat = "format1" | "format2" | "format3";

export interface CareerRow {
  id: number;
  employerDetails: string;
  period: string;
  position: string;
}

export interface TrainingRow {
  id: number;
  courseName: string;
  duration: string;
  diploma: string;
}

export type AttachmentType = "police_report" | "passport" | "applicant_photo" | "other";

export interface AttachedDoc {
  id: string;
  type: AttachmentType;
  title: string;
  url: string;
  fileName?: string;
}

export interface CVData {
  // Common & Format 01 Fields
  name: string;
  surname: string;
  previousName: string;
  placeOfBirth: string;
  dateOfBirth: string;
  fatherName: string;
  motherName: string;
  citizenship: string;
  nationality: string;
  passportNo: string;
  passportIssuedBy: string;
  passportIssuedDate: string;
  passportValidFrom: string;
  passportValidTo: string;
  residence: string;
  country: string;
  city: string;
  lastResidence: string;
  lastResidenceCountry: string;
  lastResidenceCity: string;
  maritalStatus: string;
  childrenToSupport: string;
  professionalSkill: string;
  appliedPosition?: string;
  careers: CareerRow[];
  classesGraduate: string;
  foreignLanguage: string;
  email: string;

  // Format 02 Specific Fields
  phone: string;
  height: string;
  weight: string;
  religion: string;
  college: string;
  secondarySchool: string;
  primarySchool: string;
  trainings: TrainingRow[];
  langUnderstanding: "Excellent" | "Good" | "Fair" | "Poor" | "None";
  langSpeaking: "Excellent" | "Good" | "Fair" | "Poor" | "None";
  langWriting: "Excellent" | "Good" | "Fair" | "Poor" | "None";

  // Declarations
  otherMentions: string;
  declarationRomanian: string;
  declarationEnglish: string;
  declarationHealth: string;
  date: string;

  // Uploaded assets
  photoUrl: string | null;
  signatureUrl: string | null;
  topLeftPhotoUrl: string | null;

  // Supporting Document Attachments
  attachments?: AttachedDoc[];
}

export interface CVApplicationRecord {
  application_id: string;
  applicant_id: string | null;
  format: AppFormat;
  data: CVData;
  created_at: string;
  updated_at: string;
}

export type CVApplicationSummary = Omit<CVApplicationRecord, 'data'> & {
  name: string;
  passportNo: string;
};

export const INITIAL_CV_DATA: CVData = {
  name: "KALUWA DEWAGE DHANUSHKA",
  surname: "NISHSHANKA",
  previousName: "-",
  placeOfBirth: "RAGAMA",
  dateOfBirth: "22.03.2000",
  fatherName: "K.D. MOHAN LAL SIRISENA",
  motherName: "HETTINARAYAN MUDIYANSELAGE RENUKA NISHANTHI",
  citizenship: "SRI LANKAN",
  nationality: "SRI LANKA",
  passportNo: "N9516135",
  passportIssuedBy: "COLOMBO",
  passportIssuedDate: "04/08/2022",
  passportValidFrom: "04/08/2022",
  passportValidTo: "04/08/2032",
  residence: "WELANGASWEWA, BORALUWEWA, SRI LANKA",
  country: "SRI LANKA",
  city: "BORALUWEWA",
  lastResidence: "WELANGASWEWA, BORALUWEWA, SRI LANKA",
  lastResidenceCountry: "SRI LANKA",
  lastResidenceCity: "BORALUWEWA",
  maritalStatus: "SINGLE",
  childrenToSupport: "-",
  professionalSkill: "VEHICLE SALE OWNER",
  appliedPosition: "VEHICLE SALE OWNER",
  careers: [
    { id: 1, employerDetails: "VEHICLE SALE COMPNAY", period: "02 YEARS", position: "OWNER" },
    { id: 2, employerDetails: "", period: "", position: "" },
    { id: 3, employerDetails: "", period: "", position: "" }
  ],
  classesGraduate: "O/L – 1999",
  foreignLanguage: "NORMAL ENGLISH",
  email: "TRANSARABIAN@YAHOO.COM",

  // Format 02 Specific Initial Values
  phone: "+94775960561",
  height: "",
  weight: "",
  religion: "BUDDHIST",
  college: "",
  secondarySchool: "YES",
  primarySchool: "YES",
  trainings: [
    { id: 1, courseName: "-", duration: "-", diploma: "-" },
    { id: 2, courseName: "", duration: "", diploma: "" },
    { id: 3, courseName: "", duration: "", diploma: "" }
  ],
  langUnderstanding: "Good",
  langSpeaking: "Good",
  langWriting: "Good",

  otherMentions: "",
  declarationRomanian: "Declar pe proprie raspundere sunt apt din punct de vedere medical pentru a fi încadrat în muncă şi că am cunoştinţe minime de limba română si cunostiinte de limba engleza.",
  declarationEnglish: "I declare on my own responsibility that I am medically fit to work and that I have minimal knowledge of Romanian and English knowledge.",
  declarationHealth: "I am maintaining a good health & able to work . I can understand Little bite of the Romanian language.",
  date: new Date().toLocaleDateString("en-GB"),
  photoUrl: null,
  signatureUrl: null,
  topLeftPhotoUrl: null,
  attachments: [],
};

