import React, { useState, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
import { ApplicantOverview } from '../types';
import {
  CalendarCheck,
  Search,
  Download,
  Printer,
  Edit2,
  ChevronLeft,
  ChevronRight,
  Eye,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Clock,
  Building,
  UploadCloud,
  FileText,
  X,
  Sparkles,
  ShieldCheck,
  Filter,
  FileX
} from 'lucide-react';
import { EmbassyInterviewsPdfModal } from './EmbassyInterviewsPdfModal';
import { SectionDocumentUploadModal } from './SectionDocumentUploadModal';
import { VisaIssuedPdfModal } from './VisaIssuedPdfModal';
import { VisaRefusalPdfModal } from './VisaRefusalPdfModal';

interface Props {
  applicants: ApplicantOverview[];
  onViewApplicant: (id: string) => void;
  onPrintApplicant?: (id: string) => void;
  onRefreshData: () => void;
  showNotification: (type: 'success' | 'error' | 'info', text: string) => void;
}

// Helper to ensure appointment time has AM
const formatAppointmentTime = (timeStr?: string) => {
  if (!timeStr) return '09:00 AM';
  const trimmed = timeStr.trim().toUpperCase();
  if (trimmed === 'PENDING' || trimmed === 'PENDING_TIME') return 'PENDING';
  if (trimmed.includes('AM') || trimmed.includes('PM')) {
    return trimmed;
  }
  return `${trimmed} AM`;
};

// Helper for parsing appointment dates for chronological comparison
const parseAppointmentDateForSorting = (dateStr?: string): number => {
  if (!dateStr) return 9999999999999;
  const s = dateStr.trim();
  if (s === 'PENDING' || s === 'PENDING_DATE' || s === '—') return 9999999999999;

  // Format: YYYY-MM-DD
  if (s.includes('-')) {
    const parts = s.split('-');
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        const time = new Date(s).getTime();
        if (!isNaN(time)) return time;
      } else {
        // DD-MM-YYYY
        const d = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10) - 1;
        const y = parseInt(parts[2], 10);
        const time = new Date(y, m, d).getTime();
        if (!isNaN(time)) return time;
      }
    }
  }

  // Format: DD/MM/YYYY or DD.MM.YYYY
  const delimiter = s.includes('/') ? '/' : s.includes('.') ? '.' : null;
  if (delimiter) {
    const parts = s.split(delimiter);
    if (parts.length === 3) {
      const d = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const y = parseInt(parts[2], 10);
      const time = new Date(y, m, d).getTime();
      if (!isNaN(time)) return time;
    }
  }

  const fallback = new Date(s).getTime();
  return isNaN(fallback) ? 9999999999999 : fallback;
};

const COMMON_REFUSAL_PRESETS = [
  'Justification for the purpose and conditions of the intended stay was not provided',
  'A false, counterfeit or forged travel document was presented',
  'Proof of sufficient means of subsistence for the duration of stay was not provided',
  'Reasonable doubts as to the applicant’s intention to leave the territory',
  'One or more Member States consider the applicant to be a threat to public policy or internal security',
  'Information submitted regarding the conditions of stay was not reliable',
  'Applicant did not face interview or failed biometric verification'
];

const PREDEFINED_SUB_COMPANIES = [
  'SKYLINE ENGINEERING SRL',
  'TINERVIS GROUP SRL',
  'RETEX GREEN',
  'DARIAN ERIC BUSINESS SRL',
  'ALEXIS PROD PAN SRL',
  'INSTAL IMPULS',
  'MADA MATCON SRL',
  'CLEVER'
];

export const EmbassyInterviewsView: React.FC<Props> = ({
  applicants,
  onViewApplicant,
  onPrintApplicant,
  onRefreshData,
  showNotification
}) => {
  const [activeTabFilter, setActiveTabFilter] = useState<'ALL' | 'OK' | 'SCHEDULED' | 'CANCELLED' | 'PENDING'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 12;

  // Range SE Number filter & Appointment Date filter
  const [filterSeRange, setFilterSeRange] = useState<string>('all');
  const [filterAppointmentDate, setFilterAppointmentDate] = useState<string>('all');

  // Modals
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isRefusalUploadModalOpen, setIsRefusalUploadModalOpen] = useState(false);
  const [isVisaIssuedPdfOpen, setIsVisaIssuedPdfOpen] = useState(false);
  const [isRefusalModalOpen, setIsRefusalModalOpen] = useState(false);
  const [selectedRefusalApp, setSelectedRefusalApp] = useState<ApplicantOverview | null>(null);

  // Edit State
  const [editingApp, setEditingApp] = useState<ApplicantOverview | null>(null);
  const [editForm, setEditForm] = useState<{
    appointment_date: string;
    appointment_time: string;
    visa_status: string;
    interview_status: string;
    se_number: string;
    e_number: string;
    passport_collected_date: string;
    company_name: string;
    sub_company: string;
    visa_start_date: string;
    visa_end_date: string;
    refusal_reason: string;
    remarks: string;
  }>({
    appointment_date: '',
    appointment_time: '',
    visa_status: 'Pending',
    interview_status: '',
    se_number: '',
    e_number: '',
    passport_collected_date: '',
    company_name: '',
    sub_company: '',
    visa_start_date: '',
    visa_end_date: '',
    refusal_reason: '',
    remarks: ''
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isExtractingRefusalDoc, setIsExtractingRefusalDoc] = useState(false);
  const editModalFileInputRef = useRef<HTMLInputElement>(null);

  // Candidates who have appointment date or interview status or are in embassy processing
  const interviewList = useMemo(() => {
    return applicants.filter((a) => {
      return (
        Boolean(a.appointment_date) ||
        Boolean(a.interview_status) ||
        (a.current_status as any) === 'EMBASSY_INTERVIEW' ||
        a.visa_status === 'OK' ||
        a.visa_status === 'Rejected' ||
        Boolean((a as any).refusal_reason) ||
        Boolean(a.se_number)
      );
    });
  }, [applicants]);

  // SE Number ranges derived from list (e.g. SE23 -> SE2300000 - SE2399999)
  const seRangesList = useMemo(() => {
    const prefixes = new Set<string>();
    interviewList.forEach((a) => {
      if (a.se_number && a.se_number.startsWith('SE')) {
        const prefix = a.se_number.substring(0, 4); // e.g. SE23, SE24
        prefixes.add(prefix);
      }
    });
    return Array.from(prefixes).sort().map((p) => {
      const yearCode = p.replace('SE', '');
      return {
        key: p,
        label: `SE${yearCode}00000 - SE${yearCode}99999`
      };
    });
  }, [interviewList]);

  const appointmentDatesList = useMemo(() => {
    const list = new Set<string>();
    interviewList.forEach((a) => {
      if (a.appointment_date) list.add(a.appointment_date);
    });
    return Array.from(list).sort();
  }, [interviewList]);

  // Filter & SORT according to requirements:
  // "AND THOSE VISA RECEIVED PERSONS GO TO THE BOTTOM OF EMBASSY INTERVIEWS AND ONLY PENDING INTERVIEWS AT TOPE ACCORDING TO THE THEIR INTERVIEW DATES. IT SHOULD BE CLOSEST INTERVIEW DATES ARE ON TOP AND NEXT CLOSESET ONE WOULD BE NEXT TOP."
  const filteredRows = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    const rows = interviewList.filter((app) => {
      const statusStr = (app.interview_status || app.closed_remarks || (app as any).refusal_reason || '').toLowerCase();
      const isRejected = (app.visa_status || '').toLowerCase().includes('reject') || statusStr.includes('refus');
      const isCancelled = statusStr.includes('cancel') || statusStr.includes('did not face');
      const isOk = app.visa_status === 'OK' || app.visa_status === 'Visa Issued (OK)';
      const isScheduled = Boolean(app.appointment_date) && !isCancelled && !isRejected;

      const matchesFilter =
        activeTabFilter === 'ALL' ||
        (activeTabFilter === 'OK' && isOk) ||
        (activeTabFilter === 'SCHEDULED' && isScheduled) ||
        (activeTabFilter === 'CANCELLED' && (isCancelled || isRejected)) ||
        (activeTabFilter === 'PENDING' && !isOk && !isCancelled && !isRejected);

      const matchesSearch =
        !q ||
        app.full_name?.toLowerCase().includes(q) ||
        app.passport_number?.toLowerCase().includes(q) ||
        app.se_number?.toLowerCase().includes(q) ||
        app.e_number?.toLowerCase().includes(q) ||
        statusStr.includes(q);

      const matchesSeRange =
        filterSeRange === 'all' ||
        (app.se_number && app.se_number.startsWith(filterSeRange));

      const matchesAppointmentDate = filterAppointmentDate === 'all' || app.appointment_date === filterAppointmentDate;

      return matchesFilter && matchesSearch && matchesSeRange && matchesAppointmentDate;
    });

    // Sort order:
    // 1. Pending interviews at top, ordered chronologically (closest interview dates on top, next closest next)
    // 2. Visa Issued (OK) candidates strictly at the bottom
    return rows.sort((a, b) => {
      const aIsVisaOk = a.visa_status === 'OK' || a.visa_status === 'Visa Issued (OK)';
      const bIsVisaOk = b.visa_status === 'OK' || b.visa_status === 'Visa Issued (OK)';

      // 1. Visa Issued (OK) persons go to the bottom of embassy interviews
      if (aIsVisaOk && !bIsVisaOk) return 1;
      if (!aIsVisaOk && bIsVisaOk) return -1;

      // 2. Only pending interviews at top according to interview dates (closest first)
      const aDateVal = parseAppointmentDateForSorting(a.appointment_date);
      const bDateVal = parseAppointmentDateForSorting(b.appointment_date);

      if (aDateVal !== bDateVal) {
        return aDateVal - bDateVal; // Ascending: nearest upcoming on top
      }

      // Secondary: appointment time
      return (a.appointment_time || '').localeCompare(b.appointment_time || '');
    });
  }, [interviewList, activeTabFilter, searchTerm, filterSeRange, filterAppointmentDate]);

  const totalPages = Math.ceil(filteredRows.length / pageSize) || 1;
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, currentPage, pageSize]);

  // Edit Initiator
  const handleStartEdit = (app: ApplicantOverview) => {
    setEditingApp(app);
    const existingRefusal = (app as any).refusal_reason || ((app.visa_status === 'Rejected') ? (app.interview_status || '') : '');
    setEditForm({
      appointment_date: app.appointment_date || '',
      appointment_time: app.appointment_time || '',
      visa_status: app.visa_status || 'Pending',
      interview_status: app.visa_status === 'Rejected' ? existingRefusal : '',
      se_number: app.se_number || '',
      e_number: app.e_number || '',
      passport_collected_date: (app as any).passport_collected_date || '',
      company_name: app.company_name && app.company_name !== 'None' ? app.company_name : 'ASIA RECRUITMENT',
      sub_company: app.sub_company || (app as any).departure?.sub_company || 'SKYLINE ENGINEERING SRL',
      visa_start_date: app.visa_start_date || (app as any).passport_collected_date || new Date().toISOString().split('T')[0],
      visa_end_date: app.visa_end_date || '2026-10-31',
      refusal_reason: existingRefusal || COMMON_REFUSAL_PRESETS[0],
      remarks: app.closed_remarks || ''
    });
  };

  const handleSaveEdit = async () => {
    if (!editingApp) return;
    setIsSaving(true);
    try {
      const isVisaOk = editForm.visa_status === 'OK' || editForm.visa_status === 'Visa Issued (OK)';
      const isVisaRejected = editForm.visa_status === 'Rejected';

      // Requirement: Keep status field EMPTY if Visa Status is OK or Pending!
      // Only add status field details if Visa Status is Rejected!
      const effectiveStatus = isVisaRejected ? (editForm.refusal_reason || editForm.interview_status || 'VISA REJECTED') : '';

      const res = await fetch(`/api/applicants/${editingApp.applicant_id}/quick-update`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appointment_date: editForm.appointment_date,
          appointment_time: editForm.appointment_time,
          visa_status: editForm.visa_status,
          status: effectiveStatus,
          interview_status: effectiveStatus,
          refusal_reason: isVisaRejected ? effectiveStatus : '',
          se_number: editForm.se_number,
          e_number: editForm.e_number,
          passport_collected_date: editForm.passport_collected_date,
          company_name: editForm.company_name,
          sub_company: editForm.sub_company,
          visa_start_date: editForm.visa_start_date,
          visa_end_date: editForm.visa_end_date,
          closed_remarks: effectiveStatus
        })
      });

      if (res.ok) {
        showNotification(
          'success',
          isVisaOk
            ? `Visa Issued (OK) saved for ${editingApp.full_name}. Candidate automatically moved to Departure Pending!`
            : `Updated Embassy Interview details for ${editingApp.full_name}`
        );
        setEditingApp(null);
        onRefreshData();
      } else {
        const d = await res.json();
        showNotification('error', d.error || 'Failed to update interview details');
      }
    } catch (err: any) {
      showNotification('error', err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // AI Extraction for Visa Refusal Form within Edit modal
  const handleExtractRefusalInEdit = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsExtractingRefusalDoc(true);
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        const res = await fetch('/api/documents/extract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileData: base64,
            mimeType: file.type,
            fileName: file.name,
            sectionContext: 'embassy_refusal'
          })
        });

        const data = await res.json();
        if (res.ok && data.success) {
          const ext = data.extracted;
          const extractedReason = ext.status || ext.rejection_reason || 'Justification for purpose and conditions of stay not provided';
          setEditForm((prev) => ({
            ...prev,
            visa_status: 'Rejected',
            interview_status: extractedReason,
            refusal_reason: extractedReason
          }));
          showNotification('success', `AI extracted refusal grounds: "${extractedReason}"`);
        } else {
          showNotification('error', data.error || 'Failed to parse Visa Refusal Form');
        }
        setIsExtractingRefusalDoc(false);
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      showNotification('error', err.message);
      setIsExtractingRefusalDoc(false);
    }
  };

  // Grouped and sorted Excel downloadable matching exact PDF format layout
  const handleExportExcel = () => {
    try {
      const formatDateWithDots = (dateStr: string) => {
        if (!dateStr || dateStr === 'PENDING_DATE') return 'Pending Date';
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        return `${day}.${month}.${year}`;
      };

      const groups: Record<string, ApplicantOverview[]> = {};
      filteredRows.forEach((app) => {
        const rawDate = app.appointment_date || 'PENDING_DATE';
        if (!groups[rawDate]) groups[rawDate] = [];
        groups[rawDate].push(app);
      });

      const sortedDates = Object.keys(groups).sort((a, b) => {
        if (a === 'PENDING_DATE') return 1;
        if (b === 'PENDING_DATE') return -1;
        return new Date(a).getTime() - new Date(b).getTime();
      });

      const excelRows: any[] = [];

      sortedDates.forEach((rawDate) => {
        const dateCandidates = groups[rawDate];
        const formattedDate = formatDateWithDots(rawDate);

        excelRows.push({
          'SE NUMBER': `Appointment Date: ${formattedDate}`,
          'Name': '',
          'Appointment Time': '',
          'Passport Collected Date': '',
          'STATUS': '',
          'Visa Status': ''
        });

        excelRows.push({
          'SE NUMBER': 'SE NUMBER',
          'Name': 'Name',
          'Appointment Time': 'Appointment Time',
          'Passport Collected Date': 'Passport Collected Date',
          'STATUS': 'STATUS',
          'Visa Status': 'Visa Status'
        });

        dateCandidates.forEach((app) => {
          const isAppRejected = (app.visa_status || '').toLowerCase().includes('reject');
          const rejectionText = (app as any).refusal_reason || app.interview_status || app.closed_remarks || 'VISA REJECTED';

          excelRows.push({
            'SE NUMBER': app.se_number || 'PENDING',
            'Name': app.full_name,
            'Appointment Time': formatAppointmentTime(app.appointment_time),
            'Passport Collected Date': (app as any).passport_collected_date ? (app as any).passport_collected_date.replace(/-/g, '.') : '',
            // Requirement: Empty if OK or Pending, only filled if Rejected!
            'STATUS': isAppRejected ? rejectionText : '',
            'Visa Status': app.visa_status === 'OK' ? 'Visa Issued (OK)' : (app.visa_status || 'Pending')
          });
        });

        excelRows.push({
          'SE NUMBER': 'Total',
          'Name': '',
          'Appointment Time': '',
          'Passport Collected Date': '',
          'STATUS': '',
          'Visa Status': dateCandidates.length
        });

        excelRows.push({
          'SE NUMBER': '',
          'Name': '',
          'Appointment Time': '',
          'Passport Collected Date': '',
          'STATUS': '',
          'Visa Status': ''
        });
      });

      const ws = XLSX.utils.json_to_sheet(excelRows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'EMBASSY_INTERVIEWS');
      const filename = `TransArabian_Embassy_Interviews_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(wb, filename);
      showNotification('success', `Exported grouped Excel records successfully: ${filename}`);
    } catch (err: any) {
      showNotification('error', err.message);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 sm:p-6 space-y-6 font-sans">
      {/* 1. Header Toolbar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-slate-900 text-amber-400">
              <CalendarCheck className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">Embassy Interviews</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Biometric scheduling, Embassy appointment dates, passport collection dates, and visa issue validation.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end flex-wrap font-sans">
          {/* Upload Visa Refusal Form (AI Auto-Match to Candidate Name & Document Name) */}
          <button
            onClick={() => setIsRefusalUploadModalOpen(true)}
            className="flex items-center gap-1.5 bg-rose-700 hover:bg-rose-600 text-white text-xs font-bold px-3.5 py-2.5 rounded-xl shadow-xs transition cursor-pointer active:scale-98"
            title="Upload Visa Refusal Form - AI automatically detects applicant from name and document name, marks rejection details & attaches refusal form"
          >
            <FileX className="w-4 h-4 text-rose-200" />
            <span>Upload Visa Refusal Form (Auto-Match)</span>
          </button>

          <button
            onClick={() => setIsUploadModalOpen(true)}
            className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-3.5 py-2.5 rounded-xl shadow-xs transition cursor-pointer active:scale-98"
          >
            <UploadCloud className="w-4 h-4 text-amber-400" />
            <span>AI Document Upload & Auto-Fill</span>
          </button>

          {/* Dedicated Download PDF for Visa Issued Persons Only */}
          <button
            onClick={() => setIsVisaIssuedPdfOpen(true)}
            className="flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold px-3.5 py-2.5 rounded-xl shadow-xs transition cursor-pointer active:scale-98"
            title="Download PDF table for Visa Issued persons only (Applicant Name, Passport, SE#, Company, Sub Company)"
          >
            <Printer className="w-3.5 h-3.5 text-emerald-200" />
            <span>Download Visa Issued PDF</span>
          </button>

          <button
            onClick={() => setIsPdfModalOpen(true)}
            className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold px-3.5 py-2.5 rounded-xl shadow-xs transition cursor-pointer active:scale-98"
          >
            <Eye className="w-3.5 h-3.5 text-amber-400" />
            <span>View PDF Preview</span>
          </button>

          <button
            onClick={() => setIsPdfModalOpen(true)}
            className="flex items-center gap-1.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold px-3.5 py-2.5 rounded-xl shadow-xs transition cursor-pointer active:scale-98"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Download Full PDF Format</span>
          </button>

          <button
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold px-3.5 py-2.5 rounded-xl shadow-xs transition cursor-pointer active:scale-98"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download Excel Format</span>
          </button>
        </div>
      </div>

      {/* 2. Dynamic Filters Bar with Range SE number filter */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3">
        <div className="flex items-center gap-1 p-1 bg-slate-100/80 rounded-xl border border-slate-200/60 overflow-x-auto max-w-full">
          <button
            onClick={() => {
              setActiveTabFilter('ALL');
              setCurrentPage(1);
            }}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
              activeTabFilter === 'ALL'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All ({interviewList.length})
          </button>

          <button
            onClick={() => {
              setActiveTabFilter('OK');
              setCurrentPage(1);
            }}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
              activeTabFilter === 'OK'
                ? 'bg-white text-emerald-800 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Visa Issued ({interviewList.filter((a) => a.visa_status === 'OK' || a.visa_status === 'Visa Issued (OK)').length})
          </button>

          <button
            onClick={() => {
              setActiveTabFilter('SCHEDULED');
              setCurrentPage(1);
            }}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
              activeTabFilter === 'SCHEDULED'
                ? 'bg-white text-blue-800 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Scheduled ({interviewList.filter((a) => a.appointment_date && a.visa_status !== 'Rejected' && !a.interview_status?.includes('CANCEL')).length})
          </button>

          <button
            onClick={() => {
              setActiveTabFilter('PENDING');
              setCurrentPage(1);
            }}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
              activeTabFilter === 'PENDING'
                ? 'bg-white text-amber-800 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Pending ({interviewList.filter((a) => a.visa_status !== 'OK' && a.visa_status !== 'Rejected' && !a.interview_status?.includes('CANCEL')).length})
          </button>

          <button
            onClick={() => {
              setActiveTabFilter('CANCELLED');
              setCurrentPage(1);
            }}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
              activeTabFilter === 'CANCELLED'
                ? 'bg-white text-rose-800 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Rejected / Cancelled ({interviewList.filter((a) => (a.visa_status || '').toLowerCase().includes('reject') || (a.interview_status || a.closed_remarks || '').includes('CANCEL') || (a.interview_status || a.closed_remarks || '').includes('DID NOT')).length})
          </button>
        </div>

        {/* Column Header Dropdown Filters & Search */}
        <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full lg:w-auto">
          {/* SE Number Range Dropdown filter */}
          <div className="w-full sm:w-56 flex items-center gap-1.5 bg-slate-50 border border-slate-200/80 rounded-xl px-2.5 py-1.5 text-xs">
            <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <select
              value={filterSeRange}
              onChange={(e) => {
                setFilterSeRange(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-transparent focus:outline-none font-semibold text-slate-700 cursor-pointer"
            >
              <option value="all">All SE Number Ranges</option>
              {seRangesList.map((rng) => (
                <option key={rng.key} value={rng.key}>{rng.label}</option>
              ))}
            </select>
          </div>

          {/* Appointment Date Dropdown filter */}
          <div className="w-full sm:w-44 flex items-center gap-1.5 bg-slate-50 border border-slate-200/80 rounded-xl px-2.5 py-1.5 text-xs">
            <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <select
              value={filterAppointmentDate}
              onChange={(e) => {
                setFilterAppointmentDate(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-transparent focus:outline-none font-semibold text-slate-700 cursor-pointer"
            >
              <option value="all">All Appointment Dates</option>
              {appointmentDatesList.map((date) => (
                <option key={date} value={date}>{date.replace(/-/g, '.')}</option>
              ))}
            </select>
          </div>

          {/* Text Search Input */}
          <div className="relative w-full sm:w-56">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search name, passport..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-slate-50 hover:bg-white focus:bg-white border border-slate-200/80 focus:border-amber-500 rounded-xl pl-10 pr-4 py-1.5 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 transition shadow-xs"
            />
          </div>
        </div>
      </div>

      {/* 3. Main Data Table */}
      <div className="overflow-x-auto border border-slate-200/80 rounded-xl shadow-2xs">
        <table className="w-full text-xs text-left border-collapse">
          <thead className="bg-slate-50 font-bold uppercase tracking-wider text-[10px] text-slate-500 border-b border-slate-200">
            <tr>
              <th className="p-3 pl-4 w-12 font-mono">NO</th>
              <th className="p-3">NAME</th>
              <th className="p-3 font-mono">PASSPORT NO</th>
              <th className="p-3 font-mono">SE NUMBER</th>
              <th className="p-3 font-mono">E NUMBER</th>
              <th className="p-3 whitespace-nowrap text-amber-700 bg-amber-50/30">APPOINTMENT DATE</th>
              <th className="p-3 whitespace-nowrap text-amber-700 bg-amber-50/30">APPOINTMENT TIME</th>
              <th className="p-3 whitespace-nowrap text-slate-700 bg-slate-100/50">PASSPORT COLLECTED DATE</th>
              <th className="p-3 text-center">VISA STATUS</th>
              <th className="p-3">STATUS</th>
              <th className="p-3 pr-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-sans">
            {paginatedRows.length === 0 ? (
              <tr>
                <td colSpan={11} className="p-12 text-center text-slate-400">
                  No matching embassy interview records found. Try adjusting filters or search.
                </td>
              </tr>
            ) : (
              paginatedRows.map((app, idx) => {
                const serialNo = (currentPage - 1) * pageSize + idx + 1;
                const statusStr = app.interview_status || app.closed_remarks || (app as any).refusal_reason || '';
                const isRejected = (app.visa_status || '').toLowerCase().includes('reject') || statusStr.toLowerCase().includes('refus');
                const isCancelled = statusStr.toUpperCase().includes('CANCEL') || statusStr.toUpperCase().includes('DID NOT');
                const isOk = app.visa_status === 'OK' || app.visa_status === 'Visa Issued (OK)';
                const passportCollectedDateVal = (app as any).passport_collected_date || '';

                return (
                  <tr
                    key={app.applicant_id}
                    className={`transition ${isOk ? 'bg-emerald-50/20 hover:bg-emerald-50/40' : 'hover:bg-slate-50/80'}`}
                  >
                    <td className="p-3 pl-4 font-mono font-bold text-slate-400">{serialNo}</td>

                    {/* NAME */}
                    <td className="p-3 font-bold text-slate-900 whitespace-nowrap">
                      <span>{app.full_name}</span>
                      <span className="text-[10px] text-slate-400 font-mono block">
                        {app.preferred_job_category}
                      </span>
                    </td>

                    {/* PASSPORT */}
                    <td className="p-3 font-mono font-bold text-slate-800 whitespace-nowrap">
                      {app.passport_number || 'PENDING'}
                    </td>

                    {/* SE NUMBER */}
                    <td className="p-3 font-mono font-semibold text-slate-700 whitespace-nowrap">
                      {app.se_number || '—'}
                    </td>

                    {/* E NUMBER */}
                    <td className="p-3 font-mono font-bold text-slate-900 whitespace-nowrap">
                      <span className="px-2 py-0.5 bg-slate-100 rounded font-bold">
                        {app.e_number || '—'}
                      </span>
                    </td>

                    {/* APPOINTMENT DATE */}
                    <td className="p-3 font-mono font-bold text-slate-900 whitespace-nowrap">
                      <span className="px-2 py-0.5 bg-amber-100/70 text-amber-900 rounded border border-amber-200">
                        {app.appointment_date || 'PENDING'}
                      </span>
                    </td>

                    {/* APPOINTMENT TIME */}
                    <td className="p-3 font-mono font-semibold text-slate-700 whitespace-nowrap">
                      <span className="px-2 py-0.5 bg-slate-100 rounded border border-slate-200">
                        {formatAppointmentTime(app.appointment_time)}
                      </span>
                    </td>

                    {/* PASSPORT COLLECTED DATE - NOT CLICKABLE (Add Manually via Edit) */}
                    <td className="p-3 font-mono text-slate-700 whitespace-nowrap cursor-default select-none">
                      {passportCollectedDateVal ? passportCollectedDateVal.replace(/-/g, '.') : '—'}
                    </td>

                    {/* VISA STATUS */}
                    <td className="p-3 text-center whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          isOk
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : isRejected
                            ? 'bg-rose-100 text-rose-800 border border-rose-300'
                            : isCancelled
                            ? 'bg-amber-100 text-amber-800 border border-amber-300'
                            : 'bg-slate-100 text-slate-700 border border-slate-200'
                        }`}
                      >
                        {isOk && <CheckCircle2 className="w-3 h-3" />}
                        {isRejected && <XCircle className="w-3 h-3" />}
                        {isCancelled && <AlertCircle className="w-3 h-3" />}
                        {!isOk && !isRejected && !isCancelled && <Clock className="w-3 h-3" />}
                        <span>
                          {isOk ? 'Visa Issued (OK)' : isRejected ? 'Rejected' : isCancelled ? 'Cancelled' : app.visa_status || 'Pending'}
                        </span>
                      </span>
                    </td>

                    {/* STATUS: EMPTY IF OK OR PENDING, ONLY REJECTION DETAILS IF REJECTED */}
                    <td className="p-3 whitespace-nowrap max-w-xs truncate font-sans">
                      {isRejected ? (
                        <span
                          className="font-bold text-xs px-2.5 py-1 rounded bg-rose-50 text-rose-700 border border-rose-200 inline-block truncate max-w-xs"
                          title={statusStr || (app as any).refusal_reason || 'VISA REJECTED'}
                        >
                          {statusStr || (app as any).refusal_reason || 'VISA REJECTED'}
                        </span>
                      ) : (
                        <span className="text-slate-300 font-mono text-xs select-none">—</span>
                      )}
                    </td>

                    {/* Actions: Edit, Visa Refusal Form PDF, Profile */}
                    <td className="p-3 pr-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleStartEdit(app)}
                          className="p-1 px-2 bg-slate-100 hover:bg-amber-100 text-slate-700 hover:text-amber-800 rounded-lg text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
                          title="Edit Embassy Details & Add Passport Collected Date manually"
                        >
                          <Edit2 className="w-3 h-3" />
                          <span>Edit</span>
                        </button>

                        {/* VISA REFUSAL FORM AS A PDF IN ACTIONS - ONLY FOR VISA REJECTED PERSONS */}
                        {isRejected && (
                          <button
                            onClick={() => {
                              setSelectedRefusalApp(app);
                              setIsRefusalModalOpen(true);
                            }}
                            className="p-1 px-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-semibold flex items-center gap-1 transition cursor-pointer shadow-2xs"
                            title="Official Visa Refusal Form (PDF) - View, Print, or Save"
                          >
                            <FileText className="w-3 h-3 text-rose-600" />
                            <span>Refusal Form (PDF)</span>
                          </button>
                        )}

                        <button
                          onClick={() => onViewApplicant(app.applicant_id)}
                          className="p-1 px-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold transition cursor-pointer"
                        >
                          Profile
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* 4. Pagination */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 pt-2 border-t border-slate-100">
        <span>
          Showing {Math.min((currentPage - 1) * pageSize + 1, filteredRows.length)} to{' '}
          {Math.min(currentPage * pageSize, filteredRows.length)} of {filteredRows.length} interview records
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

      {/* Modal 1: Official PDF Modal (EMBASSY INTERVIEW.pdf) */}
      <EmbassyInterviewsPdfModal
        isOpen={isPdfModalOpen}
        onClose={() => setIsPdfModalOpen(false)}
        applicants={applicants}
      />

      {/* Modal 2: Dedicated Visa Issued Candidates Only PDF Table Modal */}
      <VisaIssuedPdfModal
        isOpen={isVisaIssuedPdfOpen}
        onClose={() => setIsVisaIssuedPdfOpen(false)}
        applicants={interviewList}
      />

      {/* Modal 3: Visa Refusal Form PDF Modal in Actions */}
      <VisaRefusalPdfModal
        isOpen={isRefusalModalOpen}
        onClose={() => {
          setIsRefusalModalOpen(false);
          setSelectedRefusalApp(null);
        }}
        applicant={selectedRefusalApp}
        onRefreshData={onRefreshData}
        showNotification={showNotification}
      />

      {/* Modal 4: AI Document Upload Modal */}
      <SectionDocumentUploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        sectionTitle="Embassy Interviews (Appointment & Visa Extraction)"
        sectionContext="embassy"
        onSuccess={() => {
          onRefreshData();
          showNotification('success', 'Embassy interview document processed successfully.');
        }}
        showNotification={showNotification}
      />

      {/* Modal 5: AI Visa Refusal Form Upload & Auto-Match Modal */}
      <SectionDocumentUploadModal
        isOpen={isRefusalUploadModalOpen}
        onClose={() => setIsRefusalUploadModalOpen(false)}
        sectionTitle="Visa Refusal Form (Auto-Detect Applicant & Extract Grounds)"
        sectionContext="embassy_refusal"
        onSuccess={() => {
          onRefreshData();
          showNotification('success', 'Visa Refusal Form uploaded. Applicant auto-detected from name & document name, rejection details saved, and Refusal Form PDF attached to applicant row!');
        }}
        showNotification={showNotification}
      />

      {/* Quick Edit Modal */}
      {editingApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-xl w-full border border-slate-200 shadow-2xl p-6 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-200">
              <div>
                <h3 className="font-bold text-sm text-slate-900">
                  Edit Embassy Details: {editingApp.full_name}
                </h3>
                <p className="text-[11px] text-slate-500 font-mono">
                  Passport: {editingApp.passport_number || 'PENDING'} · SE#: {editForm.se_number || 'PENDING'}
                </p>
              </div>
              <button
                onClick={() => setEditingApp(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                  Appointment Date
                </label>
                <input
                  type="date"
                  value={editForm.appointment_date}
                  onChange={(e) => setEditForm({ ...editForm, appointment_date: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2 font-mono text-slate-900 font-bold"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                  Appointment Time
                </label>
                <input
                  type="text"
                  placeholder="e.g. 09:30 AM"
                  value={editForm.appointment_time}
                  onChange={(e) => setEditForm({ ...editForm, appointment_time: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2 font-mono text-slate-900 font-bold"
                />
              </div>

              {/* Requirement: Passport Collected Date Added Manually via Edit */}
              <div>
                <label className="text-[10px] font-bold text-slate-700 uppercase block mb-1">
                  Passport Collected Date (Manual Entry)
                </label>
                <input
                  type="date"
                  value={editForm.passport_collected_date}
                  onChange={(e) => setEditForm({ ...editForm, passport_collected_date: e.target.value })}
                  className="w-full bg-amber-50/50 border border-amber-300 rounded-xl p-2 font-mono text-slate-900 font-bold"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                  Visa Status
                </label>
                <select
                  value={editForm.visa_status}
                  onChange={(e) => {
                    const newStatus = e.target.value;
                    setEditForm({
                      ...editForm,
                      visa_status: newStatus,
                      // Clear status field if OK or Pending
                      interview_status: newStatus === 'Rejected' ? editForm.refusal_reason || COMMON_REFUSAL_PRESETS[0] : ''
                    });
                  }}
                  className={`w-full border rounded-xl p-2 font-bold cursor-pointer ${
                    editForm.visa_status === 'OK'
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                      : editForm.visa_status === 'Rejected'
                      ? 'bg-rose-50 border-rose-300 text-rose-900'
                      : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                >
                  <option value="Pending">Pending</option>
                  <option value="OK">Visa Issued (OK)</option>
                  <option value="Rejected">Rejected</option>
                  <option value="Cancelled">Cancelled</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">SE Number</label>
                <input
                  type="text"
                  value={editForm.se_number}
                  onChange={(e) => setEditForm({ ...editForm, se_number: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2 font-mono text-slate-900 font-semibold"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">E Number</label>
                <input
                  type="text"
                  value={editForm.e_number}
                  onChange={(e) => setEditForm({ ...editForm, e_number: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2 font-mono text-slate-900 font-bold"
                />
              </div>

              {/* Requirement: IF VISA STATUS IS REJECTED, ENTER REASON OF REJECTION (OR AI EXTRACT) */}
              {editForm.visa_status === 'Rejected' && (
                <div className="col-span-2 p-3 bg-rose-50 border border-rose-200 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-bold text-rose-900 uppercase flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                      <span>Reason of Rejection (Added into Status Field)</span>
                    </label>

                    <button
                      type="button"
                      onClick={() => editModalFileInputRef.current?.click()}
                      disabled={isExtractingRefusalDoc}
                      className="text-[10px] bg-white border border-rose-300 text-rose-700 hover:bg-rose-100 font-bold px-2 py-0.5 rounded cursor-pointer flex items-center gap-1"
                    >
                      <UploadCloud className="w-3 h-3" />
                      <span>{isExtractingRefusalDoc ? 'Scanning...' : 'AI Scan Visa Refusal Form'}</span>
                    </button>
                    <input
                      type="file"
                      ref={editModalFileInputRef}
                      onChange={handleExtractRefusalInEdit}
                      accept=".pdf,image/*"
                      className="hidden"
                    />
                  </div>

                  <div>
                    <label className="text-[9px] text-slate-500 block mb-0.5">Quick Select Predefined Grounds:</label>
                    <select
                      value={editForm.refusal_reason}
                      onChange={(e) => {
                        setEditForm({
                          ...editForm,
                          refusal_reason: e.target.value,
                          interview_status: e.target.value
                        });
                      }}
                      className="w-full bg-white border border-rose-200 rounded-lg p-1.5 text-xs text-slate-800 mb-1.5"
                    >
                      {COMMON_REFUSAL_PRESETS.map((p, i) => (
                        <option key={i} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[9px] text-slate-500 block mb-0.5">Specific Rejection Reason / Note:</label>
                    <input
                      type="text"
                      placeholder="e.g. Justification for purpose of stay not provided, or custom refusal reason"
                      value={editForm.interview_status}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          interview_status: e.target.value,
                          refusal_reason: e.target.value
                        })
                      }
                      className="w-full bg-white border border-rose-300 rounded-lg p-2 text-xs font-semibold text-rose-950"
                    />
                  </div>
                </div>
              )}

              {/* Requirement: IF VISA STATUS IS OK, ADJUST DETAILS ACCORDING TO DEPARTURE PENDING COLUMNS */}
              {(editForm.visa_status === 'OK' || editForm.visa_status === 'Visa Issued (OK)') && (
                <div className="col-span-2 p-3 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2">
                  <div className="flex items-center gap-1.5 text-emerald-900 font-bold text-xs">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Departure Pending Automatic Alignment</span>
                  </div>
                  <p className="text-[10px] text-emerald-800">
                    This candidate will automatically move to Departure Pending roster. The Status field will remain empty.
                  </p>

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div>
                      <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">
                        Company Name
                      </label>
                      <input
                        type="text"
                        value={editForm.company_name}
                        onChange={(e) => setEditForm({ ...editForm, company_name: e.target.value })}
                        className="w-full bg-white border border-emerald-300 rounded-lg p-1.5 text-xs uppercase font-semibold"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">
                        Sub Company Name
                      </label>
                      <input
                        type="text"
                        list="sub-companies-list"
                        value={editForm.sub_company}
                        onChange={(e) => setEditForm({ ...editForm, sub_company: e.target.value })}
                        placeholder="e.g. SKYLINE ENGINEERING SRL"
                        className="w-full bg-white border border-emerald-300 rounded-lg p-1.5 text-xs uppercase font-semibold"
                      />
                      <datalist id="sub-companies-list">
                        {PREDEFINED_SUB_COMPANIES.map((sc) => (
                          <option key={sc} value={sc} />
                        ))}
                      </datalist>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">
                        Visa Start Date
                      </label>
                      <input
                        type="date"
                        value={editForm.visa_start_date}
                        onChange={(e) => setEditForm({ ...editForm, visa_start_date: e.target.value })}
                        className="w-full bg-white border border-emerald-300 rounded-lg p-1.5 text-xs font-mono font-bold"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">
                        Visa End Date
                      </label>
                      <input
                        type="date"
                        value={editForm.visa_end_date}
                        onChange={(e) => setEditForm({ ...editForm, visa_end_date: e.target.value })}
                        className="w-full bg-white border border-emerald-300 rounded-lg p-1.5 text-xs font-mono font-bold"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Notice for Pending */}
              {editForm.visa_status === 'Pending' && (
                <div className="col-span-2 text-[11px] text-slate-500 italic bg-slate-50 p-2 rounded-lg border border-slate-200">
                  * Note: The STATUS field is kept empty for Pending and Visa Issued (OK) candidates according to official instructions.
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
              <button
                onClick={() => setEditingApp(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={isSaving}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer active:scale-98"
              >
                {isSaving ? 'Saving...' : 'Save Updates'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
