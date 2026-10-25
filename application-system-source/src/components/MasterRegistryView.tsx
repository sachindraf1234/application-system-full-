import React, { useState, useMemo, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { ApplicantOverview, Staff } from '../types';
import {
  Users,
  Search,
  Download,
  Plus,
  Edit2,
  Printer,
  Eye,
  CheckCircle2,
  Clock,
  HeartHandshake,
  Calendar,
  Briefcase,
  User,
  Filter,
  Layers,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  FileCheck,
  UploadCloud,
  FileText,
  Save,
  Check,
  X,
  MapPin,
  Phone,
  Maximize2,
  UserCheck,
  Sparkles,
  RotateCcw,
  FileSpreadsheet,
  AlertCircle,
  ArrowRight,
  GraduationCap,
  Award
} from 'lucide-react';
import { RegisterPdfModal } from './RegisterPdfModal';
import { SectionDocumentUploadModal } from './SectionDocumentUploadModal';
import { OfficialCandidateRegistrationForm } from './OfficialCandidateRegistrationForm';
import { RegistrationPendingTable } from './RegistrationPendingTable';
import { formatToDDMMYYYY } from './FollowUpBoard';

interface Props {
  applicants: ApplicantOverview[];
  staffList?: Staff[];
  onViewProfile: (id: string) => void;
  onPrintApplicant: (id: string) => void;
  onFollowupApplicant?: (app: ApplicantOverview) => void;
  onDeleteApplicant?: (id: string, name: string) => void;
  onRefreshData: () => Promise<void> | void;
  showNotification: (type: 'success' | 'error' | 'info', text: string) => void;
  initialSubSection?: 'register_candidate' | 'candidate_records' | 'registration_pending';
  onNavigateTab?: (tab: string) => void;
}

export const MasterRegistryView: React.FC<Props> = ({
  applicants,
  staffList = [],
  onViewProfile,
  onPrintApplicant,
  onRefreshData,
  showNotification,
  initialSubSection = 'candidate_records',
  onNavigateTab
}) => {
  // Master sub-sections: 'register_candidate' | 'candidate_records' | 'registration_pending'
  const [masterSection, setMasterSection] = useState<'register_candidate' | 'candidate_records' | 'registration_pending'>(initialSubSection || 'candidate_records');

  // Sync sub-section if parent navigation changes (e.g. from registration quick-action)
  useEffect(() => {
    if (initialSubSection) {
      setMasterSection(initialSubSection);
    }
  }, [initialSubSection]);

  // Sub-tabs inside Candidate Records: 'register_male' | 'register_female'
  const [activeSubTab, setActiveSubTab] = useState<'register_male' | 'register_female'>('register_male');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedYear, setSelectedYear] = useState<string>('all');
  const [selectedCoupleFilter, setSelectedCoupleFilter] = useState<string>('all');
  // Spoken English Level categorization filter: ALL | A (75-100%) | B (55-74%) | C (0-54%)
  const [filterEnglishLevel, setFilterEnglishLevel] = useState<'ALL' | 'A' | 'B' | 'C'>('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 12;

  // Modals state
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);

  // Quick Inline editing state
  const [editingCell, setEditingCell] = useState<{ id: string; field: string } | null>(null);
  const [cellValue, setCellValue] = useState<string>('');
  const [quickEditingId, setQuickEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [isSaving, setIsSaving] = useState(false);

  // Default employee list for "REGISTER BY" dropdown
  const defaultEmployeeNames = [
    'Althaf Hussain',
    'Fathima Rizna',
    'Kamal Perera',
    'Mohamed Rizwan',
    'Nimal Fernando',
    'Shiraz Ahamed',
    'Dilani Jayawardena'
  ];

  const employeeNames = useMemo(() => {
    const list = new Set(defaultEmployeeNames);
    staffList.forEach((s) => list.add(s.name));
    applicants.forEach((a) => {
      if (a.register_by) list.add(a.register_by);
      if (a.staff_name) list.add(a.staff_name);
    });
    return Array.from(list);
  }, [staffList, applicants]);

  // 1. Compute Yearly Registrations Summary (Separately MALE and FEMALE)
  const yearlyStats = useMemo(() => {
    const stats: Record<string, { year: string; total: number; male: number; female: number }> = {};
    applicants.forEach((app) => {
      const yr = app.registration_date ? app.registration_date.split('-')[0] : '2026';
      if (!stats[yr]) {
        stats[yr] = { year: yr, total: 0, male: 0, female: 0 };
      }
      stats[yr].total += 1;
      if (app.gender === 'Male') stats[yr].male += 1;
      else stats[yr].female += 1;
    });

    // Sort descending by year
    return Object.values(stats).sort((a, b) => b.year.localeCompare(a.year));
  }, [applicants]);

  // Available unique categories
  const uniqueCategories = useMemo(() => {
    return Array.from(new Set(applicants.map((a) => a.preferred_job_category).filter(Boolean)));
  }, [applicants]);

  // Filter base list by sub-tab
  const baseTabApplicants = useMemo(() => {
    if (activeSubTab === 'register_male') {
      return applicants.filter((a) => a.gender === 'Male');
    }
    if (activeSubTab === 'register_female') {
      return applicants.filter((a) => a.gender === 'Female');
    }
    return applicants;
  }, [applicants, activeSubTab]);

  // Headline counts for Register Male / Register Female (assigned to it, varies reactively)
  const headlineCounts = useMemo(() => {
    const list = baseTabApplicants;
    const total = list.length;
    const experiencedCount = list.filter((a) => a.experienced === 'Yes').length;
    const freshCount = total - experiencedCount;
    const coupleCount = list.filter((a) => a.applied_as_couple === 'Yes').length;
    const policeReadyCount = list.filter((a) => a.police_report_ready || a.police_report_status === 'OK').length;

    // Category distribution
    const catMap: Record<string, number> = {};
    list.forEach((a) => {
      catMap[a.preferred_job_category] = (catMap[a.preferred_job_category] || 0) + 1;
    });
    const topCategory = Object.entries(catMap).sort((a, b) => b[1] - a[1])[0] || ['General', 0];

    return {
      total,
      experiencedCount,
      freshCount,
      coupleCount,
      policeReadyCount,
      topCategoryName: topCategory[0],
      topCategoryCount: topCategory[1]
    };
  }, [baseTabApplicants]);

  // English level counts for current subtab (A: 75-100%, B: 55-74%, C: 00-54%)
  const englishLevelCounts = useMemo(() => {
    let countA = 0;
    let countB = 0;
    let countC = 0;
    baseTabApplicants.forEach((a) => {
      if (a.english_level === 'A') countA++;
      else if (a.english_level === 'B') countB++;
      else if (a.english_level === 'C') countC++;
      else {
        // Fallback to B
        countB++;
      }
    });
    return { countA, countB, countC };
  }, [baseTabApplicants]);

  // Filtered rows for current table (no preferred job category dropdown filter)
  const filteredRows = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    return baseTabApplicants.filter((app) => {
      const appYear = app.registration_date ? app.registration_date.split('-')[0] : '2026';
      const matchesYear = selectedYear === 'all' || appYear === selectedYear;
      const matchesCouple =
        selectedCoupleFilter === 'all' ||
        (selectedCoupleFilter === 'yes' ? app.applied_as_couple === 'Yes' : app.applied_as_couple !== 'Yes');
      const matchesEnglish =
        filterEnglishLevel === 'ALL' || (app.english_level || 'B') === filterEnglishLevel;

      const matchesSearch =
        !q ||
        app.full_name?.toLowerCase().includes(q) ||
        app.applicant_id?.toLowerCase().includes(q) ||
        app.passport_number?.toLowerCase().includes(q) ||
        app.register_card_no?.toLowerCase().includes(q) ||
        app.registration_number?.toLowerCase().includes(q) ||
        app.register_by?.toLowerCase().includes(q) ||
        app.preferred_job_category?.toLowerCase().includes(q) ||
        app.closed_remarks?.toLowerCase().includes(q);

      return matchesYear && matchesCouple && matchesEnglish && matchesSearch;
    });
  }, [baseTabApplicants, searchTerm, selectedYear, selectedCoupleFilter, filterEnglishLevel]);

  // Inline cell saver
  const handleSaveInlineCell = async (applicantId: string, field: string, val: string) => {
    try {
      const res = await fetch(`/api/applicants/${applicantId}/quick-update`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: val })
      });
      if (res.ok) {
        showNotification('success', `Updated field successfully.`);
        setEditingCell(null);
        onRefreshData();
      } else {
        showNotification('error', 'Failed to update field');
      }
    } catch (e: any) {
      showNotification('error', e.message);
    }
  };

  // Pagination
  const totalPages = Math.ceil(filteredRows.length / pageSize) || 1;
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, currentPage, pageSize]);

  // Quick update register_by employee name
  const handleUpdateRegisterBy = async (applicantId: string, newEmployeeName: string) => {
    try {
      const res = await fetch(`/api/applicants/${applicantId}/quick-update`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ register_by: newEmployeeName })
      });
      if (res.ok) {
        showNotification('success', `Register By updated to ${newEmployeeName}`);
        onRefreshData();
      }
    } catch (err: any) {
      showNotification('error', `Failed to update employee: ${err.message}`);
    }
  };

  // Quick update couple application dropdown
  const handleUpdateCouple = async (applicantId: string, isCouple: 'Yes' | 'No') => {
    try {
      const res = await fetch(`/api/applicants/${applicantId}/quick-update`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applied_as_couple: isCouple })
      });
      if (res.ok) {
        showNotification('success', `Couple application set to ${isCouple}`);
        onRefreshData();
      }
    } catch (err: any) {
      showNotification('error', `Failed to update couple status: ${err.message}`);
    }
  };

  // Quick toggle police report
  const handleTogglePolice = async (app: ApplicantOverview) => {
    const nextState = !app.police_report_ready;
    try {
      const res = await fetch(`/api/applicants/${app.applicant_id}/quick-update`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          police_report_ready: nextState,
          police_report_status: nextState ? 'OK' : 'Pending'
        })
      });
      if (res.ok) {
        showNotification('success', `Police Report for ${app.full_name}: ${nextState ? 'OK' : 'Pending'}`);
        onRefreshData();
      }
    } catch (err: any) {
      showNotification('error', err.message);
    }
  };

  const handleStartEdit = (app: ApplicantOverview) => {
    setQuickEditingId(app.applicant_id);
    setEditForm({
      full_name: app.full_name,
      passport_number: app.passport_number || '',
      registration_date: app.registration_date || '',
      register_card_no: app.register_card_no || (app.registration_number ? app.registration_number.replace('REG-', 'RC-') : 'RC-2601'),
      register_by: app.register_by || app.staff_name || 'Althaf Hussain',
      preferred_job_category: app.preferred_job_category || '',
      experienced: app.experienced || 'Yes',
      applied_as_couple: app.applied_as_couple || 'No',
      closed_remarks: app.closed_remarks || '',
      english_level: app.english_level || 'B',
      english_percentage: app.english_percentage !== undefined ? app.english_percentage : 65,
      gender: app.gender
    });
  };

  const handleSaveQuickEdit = async () => {
    if (!quickEditingId) return;
    setIsSaving(true);
    try {
      const res = await fetch(`/api/applicants/${quickEditingId}/quick-update`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm)
      });
      if (res.ok) {
        showNotification('success', 'Applicant updated successfully');
        setQuickEditingId(null);
        onRefreshData();
      } else {
        showNotification('error', 'Failed to update applicant');
      }
    } catch (err: any) {
      showNotification('error', err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // Helper to extract candidate experience rows
  const getExperiences = (app: ApplicantOverview) => {
    if (app.experiences && app.experiences.length > 0) {
      return app.experiences.map((exp) => ({
        company: exp.company_place || app.company_name || 'Not Specified',
        job_category: exp.position || app.preferred_job_category || 'General Helper',
        year: exp.duration || exp.from_date || app.year || '02 Years'
      }));
    }
    return [
      {
        company: app.company_name && app.company_name !== 'None' ? app.company_name : 'Not Specified',
        job_category: app.preferred_job_category || 'General Helper',
        year: app.experienced === 'Yes' ? '02 Years' : 'Fresh'
      }
    ];
  };

  // Export current tab to Excel (.xlsx)
  const handleExportExcel = () => {
    try {
      const isMale = activeSubTab === 'register_male';
      const sheetTitle = isMale ? 'REGISTER_MALE' : 'REGISTER_FEMALE';
      const exportRows: any[] = [];

      // Excel header row with sub-headers for experience
      exportRows.push({
        'NO': 'NO',
        'NAME': 'NAME',
        'PP NO': 'PP NO',
        'PREFERRED JOB CATEGORY': 'PREFERRED JOB CATEGORY',
        'ENGLISH LEVEL': 'ENGLISH LEVEL',
        'COMPANY': 'COMPANY (EXPERIENCE)',
        'JOB CATEGORY': 'JOB CATEGORY (EXPERIENCE)',
        'YEAR': 'YEAR',
        'APPLIED AS COUPLE': 'APPLIED AS COUPLE',
        'REMARKS': 'REMARKS',
        'Reg Date': 'Reg Date',
        'POLICE REPORT': 'POLICE REPORT'
      });

      filteredRows.forEach((a, idx) => {
        const exps = getExperiences(a);
        exps.forEach((exp, expIdx) => {
          if (expIdx === 0) {
            exportRows.push({
              'NO': idx + 1,
              'NAME': a.full_name,
              'PP NO': a.passport_number || 'PENDING',
              'PREFERRED JOB CATEGORY': a.preferred_job_category,
              'ENGLISH LEVEL': a.english_level ? `Level ${a.english_level} (${a.english_percentage || 0}%)` : 'Level B (65%)',
              'COMPANY': exp.company,
              'JOB CATEGORY': exp.job_category,
              'YEAR': exp.year,
              'APPLIED AS COUPLE': a.applied_as_couple || 'No',
              'REMARKS': a.closed_remarks || 'Registered',
              'Reg Date': a.registration_date,
              'POLICE REPORT': a.police_report_ready || a.police_report_status === 'OK' ? 'OK' : 'Pending'
            });
          } else {
            exportRows.push({
              'NO': '',
              'NAME': '',
              'PP NO': '',
              'PREFERRED JOB CATEGORY': '',
              'ENGLISH LEVEL': '',
              'COMPANY': exp.company,
              'JOB CATEGORY': exp.job_category,
              'YEAR': exp.year,
              'APPLIED AS COUPLE': '',
              'REMARKS': '',
              'Reg Date': '',
              'POLICE REPORT': ''
            });
          }
        });
      });

      const ws = XLSX.utils.json_to_sheet(exportRows, { skipHeader: true });
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, sheetTitle.substring(0, 31));
      const filename = `TransArabian_${sheetTitle}_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(wb, filename);
      showNotification('success', `Exported ${filteredRows.length} records to ${filename}`);
    } catch (err: any) {
      showNotification('error', `Export failed: ${err.message}`);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 sm:p-6 space-y-6">
      {/* 1. TOP HEADER & NAVIGATION */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-slate-900 text-emerald-400">
              <Users className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">Master Registry</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Official intake registry: Register Candidate Form, Statutory Gender Registers (Male / Female) & Registration Pending Table.
              </p>
            </div>
          </div>
        </div>

        {masterSection === 'candidate_records' && (
          <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end flex-wrap">
            <button
              onClick={() => setIsUploadModalOpen(true)}
              className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-3.5 py-2.5 rounded-xl shadow-xs transition cursor-pointer active:scale-98"
            >
              <UploadCloud className="w-4 h-4 text-emerald-400" />
              <span>AI Document Upload & Auto-Fill</span>
            </button>
            <button
              onClick={handleExportExcel}
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3.5 py-2.5 rounded-xl shadow-xs transition cursor-pointer active:scale-98"
            >
              <Download className="w-4 h-4" />
              <span>Export Excel (.xlsx)</span>
            </button>
          </div>
        )}
      </div>

      {/* 2. MASTER REGISTRY SUB-SECTIONS (Register Candidate | Candidate Records | Registration Pending) */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-1.5 bg-slate-100 rounded-2xl border border-slate-200">
        <div className="flex items-center gap-1.5 w-full sm:w-auto flex-wrap">
          {/* Sub-section 1: Register Candidate */}
          <button
            type="button"
            onClick={() => setMasterSection('register_candidate')}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              masterSection === 'register_candidate'
                ? 'bg-[#800020] text-white shadow-md'
                : 'text-slate-700 hover:text-slate-900 hover:bg-slate-200/70'
            }`}
          >
            <FileText className={`w-4 h-4 ${masterSection === 'register_candidate' ? 'text-amber-300' : 'text-[#800020]'}`} />
            <span>Register Candidate</span>
            <span className={`text-[10px] font-mono px-2 py-0.5 rounded-md font-bold ${
              masterSection === 'register_candidate' ? 'bg-black/30 text-amber-300' : 'bg-slate-200 text-slate-800'
            }`}>
              Form
            </span>
          </button>

          {/* Sub-section 2: Candidate Register (Male / Female) */}
          <button
            type="button"
            onClick={() => setMasterSection('candidate_records')}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              masterSection === 'candidate_records'
                ? 'bg-slate-900 text-white shadow-md'
                : 'text-slate-700 hover:text-slate-900 hover:bg-slate-200/70'
            }`}
          >
            <Users className={`w-4 h-4 ${masterSection === 'candidate_records' ? 'text-emerald-400' : 'text-slate-600'}`} />
            <span>Candidate Register (Male / Female)</span>
            <span className={`text-[10px] font-mono px-2 py-0.5 rounded-md font-bold ${
              masterSection === 'candidate_records' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-slate-200 text-slate-800'
            }`}>
              {applicants.length}
            </span>
          </button>

          {/* Sub-section 3: Registration Pending Table (Process OK & Follow Up Succeed) */}
          <button
            type="button"
            onClick={() => setMasterSection('registration_pending')}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              masterSection === 'registration_pending'
                ? 'bg-amber-500 text-white shadow-md'
                : 'text-slate-700 hover:text-slate-900 hover:bg-slate-200/70'
            }`}
          >
            <Clock className={`w-4 h-4 ${masterSection === 'registration_pending' ? 'text-amber-100' : 'text-amber-600'}`} />
            <span>Registration Pending</span>
            <span className={`text-[10px] font-mono px-2 py-0.5 rounded-md font-bold ${
              masterSection === 'registration_pending'
                ? 'bg-amber-900/40 text-amber-100 border border-amber-300/40'
                : 'bg-amber-100 text-amber-800 border border-amber-200'
            }`}>
              Table
            </span>
          </button>
        </div>

        <div className="text-[11px] text-slate-500 font-mono hidden sm:block pr-3">
          {masterSection === 'register_candidate'
            ? 'Official Candidate Registration Form · A4 Print & JPEG'
            : masterSection === 'registration_pending'
            ? 'Process OK & Succeeded Candidates · Registration Status Dropdown'
            : `Roster Matrix · ${applicants.length} Candidates Registered`}
        </div>
      </div>

      {/* SUB-SECTION 1: REGISTER CANDIDATE (OFFICIAL FORM) */}
      {masterSection === 'register_candidate' && (
        <OfficialCandidateRegistrationForm
          staffList={staffList}
          applicants={applicants}
          onSuccess={async (newId?: string, registeredGender?: 'Male' | 'Female') => {
            // 1. Asynchronously refresh data so new candidate is immediately loaded
            await onRefreshData();
            // 2. Switch sub-section to Candidate Records
            setMasterSection('candidate_records');
            // 3. Reset pagination & filters so candidate sits on row 1
            setCurrentPage(1);
            setSearchTerm('');
            setSelectedYear('all');
            setSelectedCoupleFilter('all');
            // 4. Align sub-tab with candidate's gender if on opposite tab
            if (registeredGender === 'Female' && activeSubTab === 'register_male') {
              setActiveSubTab('register_female');
            } else if (registeredGender === 'Male' && activeSubTab === 'register_female') {
              setActiveSubTab('register_male');
            }
            if (onNavigateTab) {
              onNavigateTab('applicants');
            }
          }}
          showNotification={showNotification}
        />
      )}

      {/* SUB-SECTION 2: REGISTER CANDIDATE RECORDS */}
      {masterSection === 'candidate_records' && (
        <div className="space-y-6">
          {/* Sub-Tabs: Register Male | Register Female */}
          <div className="flex items-center gap-2 p-1.5 bg-slate-100/80 rounded-xl w-full sm:w-fit border border-slate-200/60">
            <button
              onClick={() => {
                setActiveSubTab('register_male');
                setCurrentPage(1);
              }}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeSubTab === 'register_male'
                  ? 'bg-white text-emerald-950 shadow-xs ring-1 ring-slate-200'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              <User className="w-4 h-4 text-emerald-600" />
              <span>Register Male</span>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 font-bold border border-emerald-200">
                {applicants.filter((a) => a.gender === 'Male').length}
              </span>
            </button>

            <button
              onClick={() => {
                setActiveSubTab('register_female');
                setCurrentPage(1);
              }}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeSubTab === 'register_female'
                  ? 'bg-white text-teal-950 shadow-xs ring-1 ring-slate-200'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              <User className="w-4 h-4 text-teal-600" />
              <span>Register Female</span>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-teal-50 text-teal-800 font-bold border border-teal-200">
                {applicants.filter((a) => a.gender === 'Female').length}
              </span>
            </button>
          </div>

          {/* ============================================================== */}
          {/* 3. TOP HEADLINE COUNTERS FOR REGISTER MALE / FEMALE            */}
          {/* ============================================================== */}
          <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white rounded-2xl p-5 border border-slate-800 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <div>
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-400">
                Official PDF Headline Metrics (Reactive Live Counts)
              </span>
              <h3 className="text-base font-bold text-white mt-0.5">
                {activeSubTab === 'register_male' ? 'Register Male Statutory Registry' : 'Register Female Statutory Registry'}
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono bg-slate-800 px-3 py-1 rounded-lg border border-slate-700 text-slate-300">
                Active Category: <strong className="text-emerald-400">{headlineCounts.topCategoryName}</strong> ({headlineCounts.topCategoryCount})
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="bg-slate-800/80 p-3.5 rounded-xl border border-slate-700/80">
              <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold block">
                Total {activeSubTab === 'register_male' ? 'Male' : 'Female'}
              </span>
              <div className="text-2xl font-mono font-extrabold text-white mt-1">{headlineCounts.total}</div>
            </div>

            <div className="bg-slate-800/80 p-3.5 rounded-xl border border-slate-700/80">
              <span className="text-[10px] uppercase tracking-wider text-emerald-400 font-bold block">
                Experienced
              </span>
              <div className="text-2xl font-mono font-extrabold text-emerald-400 mt-1">
                {headlineCounts.experiencedCount}
              </div>
            </div>

            <div className="bg-slate-800/80 p-3.5 rounded-xl border border-slate-700/80">
              <span className="text-[10px] uppercase tracking-wider text-blue-400 font-bold block">
                Fresh Applicants
              </span>
              <div className="text-2xl font-mono font-extrabold text-blue-400 mt-1">
                {headlineCounts.freshCount}
              </div>
            </div>

            <div className="bg-slate-800/80 p-3.5 rounded-xl border border-slate-700/80">
              <span className="text-[10px] uppercase tracking-wider text-purple-400 font-bold block">
                Couple Applicants
              </span>
              <div className="text-2xl font-mono font-extrabold text-purple-400 mt-1">
                {headlineCounts.coupleCount}
              </div>
            </div>

            <div className="bg-slate-800/80 p-3.5 rounded-xl border border-slate-700/80">
              <span className="text-[10px] uppercase tracking-wider text-amber-400 font-bold block">
                Police Report OK
              </span>
              <div className="text-2xl font-mono font-extrabold text-amber-400 mt-1">
                {headlineCounts.policeReadyCount}
              </div>
            </div>
          </div>
        </div>

      {/* 4. SEARCH & FILTER TOOLBAR */}
      <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search name, passport, card no, staff..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-slate-50 hover:bg-white focus:bg-white border border-slate-200/80 focus:border-emerald-500 rounded-xl pl-10 pr-4 py-2 text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all shadow-xs"
            />
          </div>

          <div className="w-full sm:w-48">
            <select
              value={selectedYear}
              onChange={(e) => {
                setSelectedYear(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-slate-50 hover:bg-white focus:bg-white border border-slate-200/80 focus:border-emerald-500 rounded-xl px-3 py-2 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition shadow-xs cursor-pointer"
            >
              <option value="all">All Registration Years</option>
              {yearlyStats.map((st) => (
                <option key={st.year} value={st.year}>
                  Year {st.year} ({st.total} registered)
                </option>
              ))}
            </select>
          </div>

          <div className="w-full sm:w-56">
            <select
              value={selectedCoupleFilter}
              onChange={(e) => {
                setSelectedCoupleFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-slate-50 hover:bg-white focus:bg-white border border-slate-200/80 focus:border-emerald-500 rounded-xl px-3 py-2 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition shadow-xs cursor-pointer"
            >
              <option value="all">All Applications (Couple & Individual)</option>
              <option value="yes">Applied as Couple: Yes</option>
              <option value="no">Applied as Couple: No</option>
            </select>
          </div>
        </div>

        {/* Dedicated VIEW & DOWNLOAD PDF buttons for Register Male & Register Female */}
        {(activeSubTab === 'register_male' || activeSubTab === 'register_female') && (
          <div className="flex items-center gap-2 self-end md:self-auto shrink-0">
            <button
              onClick={() => setIsPdfModalOpen(true)}
              className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-3.5 py-2 rounded-xl transition cursor-pointer shadow-xs active:scale-98"
            >
              <Eye className="w-3.5 h-3.5 text-emerald-400" />
              <span>View PDF ({activeSubTab === 'register_male' ? 'MALE NEW' : 'FEMALE NEW'})</span>
            </button>
            <button
              onClick={() => setIsPdfModalOpen(true)}
              className="flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold px-3.5 py-2 rounded-xl transition cursor-pointer shadow-xs active:scale-98"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Download PDF</span>
            </button>
          </div>
        )}
      </div>

      {/* Spoken English Level Categorization Bar (Grade A: 75-100%, Grade B: 55-74%, Grade C: 00-54%) */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 bg-slate-50 border border-slate-200/90 rounded-2xl shadow-2xs">
        <div className="flex items-center gap-2">
          <GraduationCap className="w-4 h-4 text-emerald-700 shrink-0" />
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-800 block">
              Spoken English Skill Categorization:
            </span>
            <span className="text-[10px] text-slate-500 font-medium">
              Grade A (75-100% Highest) · Grade B (55-74% Medium) · Grade C (0-54% Low)
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => {
              setFilterEnglishLevel('ALL');
              setCurrentPage(1);
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
              filterEnglishLevel === 'ALL'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
            }`}
          >
            <span>All Levels</span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-slate-200/70 text-slate-800 font-bold">
              {baseTabApplicants.length}
            </span>
          </button>

          <button
            onClick={() => {
              setFilterEnglishLevel('A');
              setCurrentPage(1);
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
              filterEnglishLevel === 'A'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'bg-white text-emerald-900 border border-emerald-300 hover:bg-emerald-50'
            }`}
          >
            <span className="font-black text-sm">Grade A</span>
            <span className="text-[10px] font-normal opacity-90">(75-100% Highest)</span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-900 font-bold">
              {englishLevelCounts.countA}
            </span>
          </button>

          <button
            onClick={() => {
              setFilterEnglishLevel('B');
              setCurrentPage(1);
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
              filterEnglishLevel === 'B'
                ? 'bg-blue-700 text-white shadow-xs'
                : 'bg-white text-blue-900 border border-blue-300 hover:bg-blue-50'
            }`}
          >
            <span className="font-black text-sm">Grade B</span>
            <span className="text-[10px] font-normal opacity-90">(55-74% Medium)</span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-900 font-bold">
              {englishLevelCounts.countB}
            </span>
          </button>

          <button
            onClick={() => {
              setFilterEnglishLevel('C');
              setCurrentPage(1);
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
              filterEnglishLevel === 'C'
                ? 'bg-amber-700 text-white shadow-xs'
                : 'bg-white text-amber-900 border border-amber-300 hover:bg-amber-50'
            }`}
          >
            <span className="font-black text-sm">Grade C</span>
            <span className="text-[10px] font-normal opacity-90">(0-54% Low)</span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-900 font-bold">
              {englishLevelCounts.countC}
            </span>
          </button>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 5. TABLE VIEW: REGISTER MALE / REGISTER FEMALE                  */}
      {/* EXACTLY SAME AS ACCORDING TO THE PDF WITH PREFERRED JOB        */}
      {/* CATEGORY & APPLIED AS COUPLE DROPDOWN COLUMN                   */}
      {/* Fields: NO | NAME | PP NO | PREFERRED JOB CATEGORY |           */}
      {/* EXPERINCED | APPLIED AS COUPLE (DROPDOWN) | REMAKS | Reg Date  */}
      {/* | POLICE REPORT | Actions                                      */}
      {/* ============================================================== */}
      <div className="overflow-x-auto border border-slate-200/80 rounded-xl">
        <table className="w-full text-xs text-left border-collapse">
          <thead className="bg-slate-50 font-bold uppercase tracking-wider text-[10px] text-slate-500 border-b border-slate-200">
            <tr>
              <th rowSpan={2} className="p-3 pl-4 w-12 font-mono">NO</th>
              <th rowSpan={2} className="p-3">NAME</th>
              <th rowSpan={2} className="p-3 font-mono">PP NO</th>
              <th rowSpan={2} className="p-3">PREFERRED JOB CATEGORY</th>
              <th rowSpan={2} className="p-3 text-center whitespace-nowrap">ENGLISH LEVEL</th>
              <th colSpan={3} className="p-2 text-center bg-slate-100/80 border-x border-slate-200 text-slate-700">EXPERIENCE</th>
              <th rowSpan={2} className="p-3 min-w-[150px]">APPLY AS A COUPLE?</th>
              <th rowSpan={2} className="p-3">REMARKS</th>
              <th rowSpan={2} className="p-3 whitespace-nowrap">Reg Date</th>
              <th rowSpan={2} className="p-3 text-center">POLICE REPORT</th>
              <th rowSpan={2} className="p-3 pr-4 text-right">Actions</th>
            </tr>
            <tr className="bg-slate-100/60 text-[9px] text-slate-600 border-t border-slate-200">
              <th className="p-1.5 pl-2">COMPANY</th>
              <th className="p-1.5">JOB CATEGORY</th>
              <th className="p-1.5 text-center">YEAR</th>
            </tr>
          </thead>
            <tbody className="divide-y divide-slate-100 font-sans">
              {paginatedRows.length === 0 ? (
                <tr>
                  <td colSpan={13} className="p-10 text-center text-slate-400">
                    No {activeSubTab === 'register_male' ? 'male' : 'female'} applicants found in this view.
                  </td>
                </tr>
              ) : (
                paginatedRows.map((app, idx) => {
                  const serialNo = (currentPage - 1) * pageSize + idx + 1;
                  const policeOk = app.police_report_ready || app.police_report_status === 'OK';
                  const coupleStatus = app.applied_as_couple || 'No';
                  const exps = getExperiences(app);
                  const expCount = exps.length;

                  return exps.map((exp, expIdx) => {
                    const isFirst = expIdx === 0;

                    return (
                      <tr key={`${app.applicant_id}-${expIdx}`} className="hover:bg-slate-50/80 transition group">
                        {isFirst && (
                          <>
                            <td rowSpan={expCount} className="p-3 pl-4 font-mono font-bold text-slate-400 align-top">{serialNo}</td>

                            <td rowSpan={expCount} className="p-3 font-bold text-slate-900 align-top">
                              <div className="flex items-center gap-3">
                                {/* APPLICANT IMAGE BEFORE APPLICANT NAME */}
                                <div className="w-10 h-10 rounded-lg overflow-hidden border border-slate-200 bg-slate-100 shrink-0 flex items-center justify-center shadow-xs">
                                  <img
                                    src={
                                      app.applicant_photo ||
                                      `https://ui-avatars.com/api/?name=${encodeURIComponent(app.full_name)}&background=047857&color=fff&size=80`
                                    }
                                    alt={app.full_name}
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                      (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(app.full_name)}&background=047857&color=fff&size=80`;
                                    }}
                                  />
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span>{app.full_name}</span>
                                    <span className="text-[10px] font-mono text-slate-400">({app.applicant_id})</span>
                                  </div>
                                  {coupleStatus === 'Yes' && app.partner_name && (
                                    <div className="text-[10px] text-purple-600 font-semibold flex items-center gap-1 mt-0.5">
                                      <HeartHandshake className="w-3 h-3" />
                                      <span>Partner: {app.partner_name}</span>
                                    </div>
                                  )}
                                  <div className="text-[11px] text-slate-500 font-normal mt-0.5">
                                    {app.mobile_number}
                                  </div>
                                </div>
                              </div>
                            </td>

                            <td rowSpan={expCount} className="p-3 font-mono font-bold text-slate-800 whitespace-nowrap align-top">
                              <span className="px-2 py-0.5 bg-slate-100 rounded border border-slate-200">
                                {app.passport_number || 'PENDING'}
                              </span>
                            </td>

                            <td rowSpan={expCount} className="p-3 uppercase font-semibold text-slate-800 whitespace-nowrap align-top">
                              <span className="px-2 py-0.5 bg-emerald-50/80 text-emerald-900 rounded font-medium border border-emerald-100">
                                {app.preferred_job_category}
                              </span>
                            </td>

                            {/* ENGLISH LEVEL (A, B, C) */}
                            <td rowSpan={expCount} className="p-3 text-center whitespace-nowrap align-top">
                              <button
                                type="button"
                                onClick={() => handleStartEdit(app)}
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border shadow-2xs transition cursor-pointer hover:scale-105 active:scale-95 ${
                                  app.english_level === 'A'
                                    ? 'bg-emerald-100 text-emerald-800 border-emerald-300 hover:bg-emerald-200'
                                    : app.english_level === 'B'
                                    ? 'bg-blue-100 text-blue-800 border-blue-300 hover:bg-blue-200'
                                    : 'bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-200'
                                }`}
                                title={`Click to evaluate/update Spoken English: Grade ${app.english_level || 'B'} (${app.english_percentage || 0}%) - ${
                                  app.english_level === 'A'
                                    ? '75-100% Highest Marks'
                                    : app.english_level === 'B'
                                    ? '55-74% Medium Marks'
                                    : '0-54% Low Marks'
                                }`}
                              >
                                <span className="font-black text-xs">Level {app.english_level || 'B'}</span>
                                <span className="text-[10px] font-mono opacity-85">
                                  ({app.english_percentage || (app.english_level === 'A' ? 80 : app.english_level === 'B' ? 65 : 45)}%)
                                </span>
                              </button>
                            </td>
                          </>
                        )}

                        {/* Experience Sub-columns */}
                        <td className="p-2 text-slate-800 font-medium border-l border-slate-100">{exp.company}</td>
                        <td className="p-2 text-slate-800 font-medium">{exp.job_category}</td>
                        <td className="p-2 text-center font-mono text-slate-700 font-medium border-r border-slate-100 whitespace-nowrap">{exp.year}</td>

                        {isFirst && (
                          <>
                            <td rowSpan={expCount} className="p-3 align-top">
                              <select
                                value={coupleStatus}
                                onChange={(e) => handleUpdateCouple(app.applicant_id, e.target.value as any)}
                                className={`w-full border rounded-lg px-2.5 py-1 text-xs font-bold transition cursor-pointer shadow-2xs ${
                                  coupleStatus === 'Yes'
                                    ? 'bg-purple-50 text-purple-800 border-purple-300'
                                    : 'bg-white text-slate-700 border-slate-200'
                                }`}
                              >
                                <option value="No">No (Single)</option>
                                <option value="Yes">Yes (Couple)</option>
                              </select>
                            </td>

                            <td rowSpan={expCount} className="p-3 text-slate-600 max-w-[180px] truncate align-top" title={app.closed_remarks || app.current_status}>
                              {app.closed_remarks || app.current_status.replace('_', ' ')}
                            </td>

                            <td rowSpan={expCount} className="p-3 font-mono text-slate-600 whitespace-nowrap align-top">
                              {app.registration_date || '—'}
                            </td>

                            <td rowSpan={expCount} className="p-3 text-center whitespace-nowrap align-top">
                              <button
                                onClick={() => handleTogglePolice(app)}
                                title="Click to toggle Police Report status"
                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold transition cursor-pointer ${
                                  policeOk
                                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 hover:bg-emerald-200'
                                    : 'bg-amber-100 text-amber-800 border border-amber-300 hover:bg-amber-200'
                                }`}
                              >
                                {policeOk ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                                <span>{policeOk ? 'OK' : 'Pending'}</span>
                              </button>
                            </td>

                            <td rowSpan={expCount} className="p-3 pr-4 text-right whitespace-nowrap align-top">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => handleStartEdit(app)}
                                  className="p-1 px-2.5 bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 rounded-lg text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
                                  title="Edit candidate details"
                                >
                                  <Edit2 className="w-3 h-3 text-emerald-600" />
                                  <span>Edit</span>
                                </button>
                                <button
                                  onClick={() => onPrintApplicant(app.applicant_id)}
                                  className="p-1 px-2.5 bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 rounded-lg text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
                                  title="Print Bio-Data Form"
                                >
                                  <Printer className="w-3 h-3 text-emerald-600" />
                                  <span>Print</span>
                                </button>
                                <button
                                  onClick={() => onViewProfile(app.applicant_id)}
                                  className="p-1 px-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold transition cursor-pointer"
                                >
                                  Profile
                                </button>
                              </div>
                            </td>
                          </>
                        )}
                      </tr>
                    );
                  });
                })
              )}
            </tbody>
          </table>
        </div>

      {/* 6. PAGINATION FOOTER */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 pt-2 border-t border-slate-100">
        <span>
          Showing {Math.min((currentPage - 1) * pageSize + 1, filteredRows.length)} to{' '}
          {Math.min(currentPage * pageSize, filteredRows.length)} of {filteredRows.length} candidates
        </span>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="flex items-center gap-1 px-3 py-1.5 border border-slate-200 rounded-lg font-medium hover:bg-slate-50 disabled:opacity-40 transition cursor-pointer"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span>Prev</span>
          </button>

          <span className="px-3 font-semibold text-slate-800 font-mono">
            {currentPage} / {totalPages}
          </span>

          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="flex items-center gap-1 px-3 py-1.5 border border-slate-200 rounded-lg font-medium hover:bg-slate-50 disabled:opacity-40 transition cursor-pointer"
          >
            <span>Next</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Register PDF Official Categorized Modal (Male New / Female New) */}
      <RegisterPdfModal
        isOpen={isPdfModalOpen}
        onClose={() => setIsPdfModalOpen(false)}
        gender={activeSubTab === 'register_female' ? 'Female' : 'Male'}
        applicants={applicants}
      />

      {/* AI Document Upload & Auto-Fill Modal */}
      <SectionDocumentUploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        sectionTitle={
          activeSubTab === 'register_male'
            ? 'Register Male'
            : activeSubTab === 'register_female'
            ? 'Register Female'
            : 'Master Registry'
        }
        sectionContext="applicants"
        onSuccess={() => {
          onRefreshData();
          showNotification('success', 'Candidate details extracted and registered successfully.');
        }}
        showNotification={showNotification}
      />

      {/* Quick Edit Candidate Modal */}
      {quickEditingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-2xl p-6 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-200">
              <h3 className="font-bold text-sm text-slate-900">
                Edit Candidate: {editForm.full_name}
              </h3>
              <button
                onClick={() => setQuickEditingId(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="col-span-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Full Name</label>
                <input
                  type="text"
                  value={editForm.full_name}
                  onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2 font-bold text-slate-900"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Passport Number</label>
                <input
                  type="text"
                  value={editForm.passport_number}
                  onChange={(e) => setEditForm({ ...editForm, passport_number: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2 font-mono font-bold text-slate-900"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Registration Date</label>
                <input
                  type="date"
                  value={editForm.registration_date}
                  onChange={(e) => setEditForm({ ...editForm, registration_date: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2 font-mono text-slate-900"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Register Card No</label>
                <input
                  type="text"
                  value={editForm.register_card_no}
                  onChange={(e) => setEditForm({ ...editForm, register_card_no: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2 font-mono text-slate-900"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Registered By</label>
                <select
                  value={editForm.register_by}
                  onChange={(e) => setEditForm({ ...editForm, register_by: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2 text-slate-900 font-semibold"
                >
                  {employeeNames.map((emp) => (
                    <option key={emp} value={emp}>
                      {emp}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Job Category / Trade</label>
                <input
                  type="text"
                  value={editForm.preferred_job_category}
                  onChange={(e) => setEditForm({ ...editForm, preferred_job_category: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2 text-slate-900 font-semibold"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Experienced</label>
                <select
                  value={editForm.experienced}
                  onChange={(e) => setEditForm({ ...editForm, experienced: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2 text-slate-900 font-semibold"
                >
                  <option value="Yes">Yes (Experienced)</option>
                  <option value="No">No (Fresh)</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Applied as Couple</label>
                <select
                  value={editForm.applied_as_couple}
                  onChange={(e) => setEditForm({ ...editForm, applied_as_couple: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2 text-slate-900 font-semibold"
                >
                  <option value="No">No (Single)</option>
                  <option value="Yes">Yes (Couple)</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                  Spoken English Grade (A, B, C)
                </label>
                <select
                  value={editForm.english_level || 'B'}
                  onChange={(e) => {
                    const lvl = e.target.value as 'A' | 'B' | 'C';
                    const defaultP = lvl === 'A' ? 85 : lvl === 'B' ? 65 : 45;
                    setEditForm({ ...editForm, english_level: lvl, english_percentage: defaultP });
                  }}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2 text-slate-900 font-semibold cursor-pointer"
                >
                  <option value="A">Grade A (75-100% Highest Marks)</option>
                  <option value="B">Grade B (55-74% Medium Marks)</option>
                  <option value="C">Grade C (00-54% Low Marks)</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                  English Skill Marks (%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={editForm.english_percentage ?? 65}
                  onChange={(e) => {
                    const pVal = Math.max(0, Math.min(100, parseInt(e.target.value, 10) || 0));
                    const lvl = pVal >= 75 ? 'A' : pVal >= 55 ? 'B' : 'C';
                    setEditForm({ ...editForm, english_percentage: pVal, english_level: lvl });
                  }}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2 font-mono font-bold text-slate-900"
                />
              </div>

              <div className="col-span-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Remarks</label>
                <input
                  type="text"
                  value={editForm.closed_remarks}
                  onChange={(e) => setEditForm({ ...editForm, closed_remarks: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2 text-slate-900"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
              <button
                onClick={() => setQuickEditingId(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveQuickEdit}
                disabled={isSaving}
                className="px-4 py-2 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
              >
                {isSaving ? 'Saving...' : 'Save Updates'}
              </button>
            </div>
          </div>
        </div>
      )}
        </div>
      )}

      {/* SUB-SECTION 3: REGISTRATION PENDING TABLE (PROCESS OK & SUCCEED CANDIDATES) */}
      {masterSection === 'registration_pending' && (
        <RegistrationPendingTable
          applicants={applicants}
          staffList={staffList}
          onRefreshData={onRefreshData}
          showNotification={showNotification}
          onViewApplicantProfile={onViewProfile}
          onOpenRegisterForm={() => {
            setMasterSection('register_candidate');
          }}
        />
      )}
    </div>
  );
};
