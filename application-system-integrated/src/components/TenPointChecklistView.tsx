import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { ApplicantOverview } from '../types';
import {
  CheckSquare,
  Search,
  Download,
  UploadCloud,
  CheckCircle2,
  XCircle,
  ChevronLeft,
  ChevronRight,
  Printer,
  ShieldCheck,
  Sparkles,
  Edit2,
  X,
  Check,
  Filter,
  AlertTriangle,
  Calendar,
  Clock
} from 'lucide-react';
import { SectionDocumentUploadModal } from './SectionDocumentUploadModal';

interface Props {
  applicants: ApplicantOverview[];
  onViewApplicant: (id: string) => void;
  onRefreshData: () => void;
  showNotification: (type: 'success' | 'error' | 'info', text: string) => void;
}

export const CHECKLIST_POINTS = [
  {
    id: 1,
    key: 'visa_d_form_ready',
    short: '01. VISA D FORM',
    sentence: '01. VISA D FORM (Consular stamp-ready electronic VISA D application form)'
  },
  {
    id: 2,
    key: 'passport_ready',
    short: '02. PASSPORT',
    sentence: '02. PASSPORT (Original valid international passport held in agency custody with at least 06 months and 2 weeks of post-interview validity)'
  },
  {
    id: 3,
    key: 'police_report_ready',
    short: '03. POLICE REPORT',
    sentence: '03. POLICE REPORT (Official clean character certificate from CID Headquarters)'
  },
  {
    id: 4,
    key: 'police_certified_ready',
    short: '04. CERTIFY COPY',
    sentence: '04. CERTIFY COPY OF POLICE REPORT ( consular attested copy of police character clearance)'
  },
  {
    id: 5,
    key: 'agreement_ready',
    short: '05. AGREEMENT',
    sentence: '05. AGREEMENT (Bilateral SLBFE standard employment contract signed by employer and candidate)'
  },
  {
    id: 6,
    key: 'usd_ready',
    short: '06. IMAGE',
    sentence: '06. IMAGE (Official high-resolution bio-photograph/scanned photograph matching criteria)'
  },
  {
    id: 7,
    key: 'guarantee_letter_ready',
    short: '07. GUARANTEE LETTER',
    sentence: '07. GUARANTEE LETTER (Statutory family/spouse guarantee and indemnity bond)'
  },
  {
    id: 8,
    key: 'embassy_interview_ready',
    short: '08. ACCOMODATION',
    sentence: '08. ACCOMODATION GUARANTEE LETTER (Employer verified accommodation undertaking & approval certificate)'
  },
  {
    id: 9,
    key: 'insurance_ready',
    short: '09. INSURANCE',
    sentence: '09. INSURANCE (Foreign employment life & medical insurance policy commencing exactly two weeks after embassy interview date)'
  },
  {
    id: 10,
    key: 'passport_copy_ready',
    short: '10. PASSPORT COPY',
    sentence: '10. PASSPORT COPY (Four clear certified color copies of the bio-data page)'
  }
];

export const TenPointChecklistView: React.FC<Props> = ({
  applicants,
  onViewApplicant,
  onRefreshData,
  showNotification
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterScore, setFilterScore] = useState<'ALL' | 'COMPLETE' | 'PENDING' | 'WARNINGS'>('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 12;

  // Modals
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [verifyingApp, setVerifyingApp] = useState<ApplicantOverview | null>(null);
  const [editingForm, setEditingForm] = useState<Record<string, boolean>>({});
  const [passportExpiryInput, setPassportExpiryInput] = useState('');
  const [insuranceStartDateInput, setInsuranceStartDateInput] = useState('');
  const [policeCertifyExpireInput, setPoliceCertifyExpireInput] = useState('');
  const [policeCertifyDateInput, setPoliceCertifyDateInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [activeWarningApp, setActiveWarningApp] = useState<{
    name: string;
    passport: string;
    passportWarning: string;
    insuranceWarning: string;
  } | null>(null);

  // Helper to extract item values for an applicant
  const getApplicantItems = (app: ApplicantOverview) => {
    const cl = app.checklist;
    return {
      visa_d_form_ready: Boolean((cl as any)?.visa_d_form_ready ?? cl?.visa_d_ready ?? false),
      passport_ready: Boolean(cl?.passport_ready ?? (app.passport_number && app.passport_number !== 'PENDING')),
      police_report_ready: Boolean(cl?.police_report_ready ?? (app.police_report_ready || app.police_report_status === 'OK')),
      police_certified_ready: Boolean(cl?.police_certified_ready ?? false),
      agreement_ready: Boolean(cl?.agreement_ready ?? false),
      usd_ready: Boolean(cl?.usd_ready ?? false),
      guarantee_letter_ready: Boolean(cl?.guarantee_letter_ready ?? false),
      embassy_interview_ready: Boolean(cl?.embassy_interview_ready ?? false),
      insurance_ready: Boolean(cl?.insurance_ready ?? false),
      passport_copy_ready: Boolean(cl?.passport_copy_ready ?? true)
    };
  };

  // Passport Expiry date validation: expiry date must have its expiry date start two weeks after embassy interview and another 06 months
  const checkPassportExpiryValid = (app: ApplicantOverview) => {
    if (!app.appointment_date || !app.passport_expiry) {
      return { isValid: true, message: 'Interview date or passport expiry not set yet.' };
    }
    const interviewDate = new Date(app.appointment_date);
    const expiryDate = new Date(app.passport_expiry);
    
    const minExpiry = new Date(interviewDate);
    minExpiry.setDate(minExpiry.getDate() + 14); // 2 weeks
    minExpiry.setMonth(minExpiry.getMonth() + 6); // 6 months
    
    if (expiryDate < minExpiry) {
      const formattedMin = minExpiry.toISOString().split('T')[0].replace(/-/g, '.');
      return { 
        isValid: false, 
        message: `Passport must expire after ${formattedMin} (2 weeks post-interview + 6 months). Current expiry: ${app.passport_expiry}` 
      };
    }
    return { isValid: true, message: 'Valid' };
  };

  // Insurance Covering Period's start date check: start date must begin with two weeks after interview date
  const checkInsuranceStartDateValid = (app: ApplicantOverview) => {
    const insStart = (app.checklist as any)?.insurance_start_date || (app as any).insurance_start_date || '';
    if (!app.appointment_date || !insStart) {
      return { isValid: true, message: 'Interview date or Insurance start date not set yet.' };
    }
    const interviewDate = new Date(app.appointment_date);
    const insDate = new Date(insStart);
    
    const targetStartDate = new Date(interviewDate);
    targetStartDate.setDate(targetStartDate.getDate() + 14); // Exactly 14 days after
    
    // Convert to timestamps
    const diffTime = insDate.getTime() - interviewDate.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 14) {
      const formattedTarget = targetStartDate.toISOString().split('T')[0].replace(/-/g, '.');
      return {
        isValid: false,
        message: `Insurance covering period must begin at least 2 weeks after the interview. Target start: ${formattedTarget}. Current: ${insStart}`
      };
    }
    return { isValid: true, message: 'Valid' };
  };

  const filteredRows = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    return applicants.filter((app) => {
      const items = getApplicantItems(app);
      const score = Object.values(items).filter(Boolean).length;
      const isComplete = score === 10;
      
      const ppExp = checkPassportExpiryValid(app);
      const insValid = checkInsuranceStartDateValid(app);
      const hasWarnings = !ppExp.isValid || !insValid.isValid;

      const matchesFilter =
        filterScore === 'ALL' ||
        (filterScore === 'COMPLETE' && isComplete) ||
        (filterScore === 'PENDING' && !isComplete) ||
        (filterScore === 'WARNINGS' && hasWarnings);

      const matchesSearch =
        !q ||
        app.full_name?.toLowerCase().includes(q) ||
        app.passport_number?.toLowerCase().includes(q) ||
        app.preferred_job_category?.toLowerCase().includes(q) ||
        app.company_name?.toLowerCase().includes(q);

      return matchesFilter && matchesSearch;
    });
  }, [applicants, searchTerm, filterScore]);

  const totalPages = Math.ceil(filteredRows.length / pageSize) || 1;
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, currentPage, pageSize]);

  // Toggle single point between CORRECT MARK and WRONG MARK immediately
  const handleTogglePoint = async (app: ApplicantOverview, key: string, currentVal: boolean) => {
    const nextVal = !currentVal;
    try {
      const res = await fetch(`/api/applicants/${app.applicant_id}/quick-update`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: nextVal })
      });
      if (res.ok) {
        showNotification(
          nextVal ? 'success' : 'info',
          `${app.full_name}: Set ${key.replace('_ready','').toUpperCase()} to ${nextVal ? 'CORRECT (✓)' : 'WRONG (✗)'}`
        );
        onRefreshData();
      } else {
        showNotification('error', 'Failed to update checklist item');
      }
    } catch (err: any) {
      showNotification('error', err.message);
    }
  };

  // Fast inline update for police certify date or expire date directly in the table
  const handleInlineDateUpdate = async (app: ApplicantOverview, field: 'police_certify_expire_date' | 'police_certified_date', dateVal: string) => {
    try {
      const res = await fetch(`/api/applicants/${app.applicant_id}/quick-update`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: dateVal })
      });
      if (res.ok) {
        showNotification(
          'success',
          `${app.full_name}: Updated ${field === 'police_certify_expire_date' ? 'Certify Expire Date' : 'Certify Date'} to ${dateVal || 'cleared'}`
        );
        onRefreshData();
      } else {
        showNotification('error', 'Failed to update date');
      }
    } catch (err: any) {
      showNotification('error', err.message);
    }
  };

  // Open modal for full sentence verification
  const handleOpenVerifyModal = (app: ApplicantOverview) => {
    setVerifyingApp(app);
    setEditingForm(getApplicantItems(app));
    setPassportExpiryInput(app.passport_expiry || '');
    setInsuranceStartDateInput((app.checklist as any)?.insurance_start_date || (app as any).insurance_start_date || '');
    setPoliceCertifyExpireInput((app.checklist as any)?.police_certify_expire_date || (app as any).police_certify_expire_date || '');
    setPoliceCertifyDateInput((app.checklist as any)?.police_certified_date || (app as any).police_certified_date || '');
  };

  const handleSaveModalVerify = async () => {
    if (!verifyingApp) return;
    setIsSaving(true);
    try {
      const res = await fetch(`/api/applicants/${verifyingApp.applicant_id}/quick-update`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...editingForm,
          passport_expiry: passportExpiryInput,
          insurance_start_date: insuranceStartDateInput,
          police_certify_expire_date: policeCertifyExpireInput,
          police_certified_date: policeCertifyDateInput
        })
      });
      if (res.ok) {
        showNotification('success', `Embassy document checklist updated for ${verifyingApp.full_name}`);
        setVerifyingApp(null);
        onRefreshData();
      } else {
        showNotification('error', 'Failed to update checklist');
      }
    } catch (err: any) {
      showNotification('error', err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportExcel = () => {
    try {
      const rows = filteredRows.map((app, idx) => {
        const items = getApplicantItems(app);
        const score = Object.values(items).filter(Boolean).length;
        const ppCheck = checkPassportExpiryValid(app);
        const insCheck = checkInsuranceStartDateValid(app);
        return {
          'NO': idx + 1,
          'NAME': app.full_name,
          'PASSPORT NO': app.passport_number || 'PENDING',
          'TRADE': app.preferred_job_category,
          '1. VISA D FORM': items.visa_d_form_ready ? 'CORRECT (✓)' : 'WRONG (✗)',
          '2. PASSPORT': items.passport_ready ? 'CORRECT (✓)' : 'WRONG (✗)',
          '3. POLICE REPORT': items.police_report_ready ? 'CORRECT (✓)' : 'WRONG (✗)',
          '4. CERTIFY COPY': items.police_certified_ready ? 'CORRECT (✓)' : 'WRONG (✗)',
          'POLICE CERTIFY DATE': (app.checklist as any)?.police_certified_date || (app as any).police_certified_date || '-',
          'POLICE CERTIFY EXPIRE DATE': (app.checklist as any)?.police_certify_expire_date || (app as any).police_certify_expire_date || '-',
          '5. AGREEMENT': items.agreement_ready ? 'CORRECT (✓)' : 'WRONG (✗)',
          '6. IMAGE': items.usd_ready ? 'CORRECT (✓)' : 'WRONG (✗)',
          '7. GUARANTEE': items.guarantee_letter_ready ? 'CORRECT (✓)' : 'WRONG (✗)',
          '8. ACCOMODATION': items.embassy_interview_ready ? 'CORRECT (✓)' : 'WRONG (✗)',
          '9. INSURANCE': items.insurance_ready ? 'CORRECT (✓)' : 'WRONG (✗)',
          '10. PASSPORT COPY': items.passport_copy_ready ? 'CORRECT (✓)' : 'WRONG (✗)',
          'SCORE': `${score}/10`,
          'PASSPORT EXPIRY WARNING': ppCheck.isValid ? 'OK' : ppCheck.message,
          'INSURANCE START WARNING': insCheck.isValid ? 'OK' : insCheck.message
        };
      });

      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'EMBASSY_CHECKLIST');
      const filename = `TransArabian_Embassy_Documents_Checklist_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(wb, filename);
      showNotification('success', `Exported ${rows.length} checklist records to ${filename}`);
    } catch (err: any) {
      showNotification('error', err.message);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 sm:p-6 space-y-6">
      {/* 1. Header Toolbar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-slate-900 text-amber-400">
              <CheckSquare className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">Embassy documents checklist</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                SLBFE and Embassy mandatory 10 clearance requirements. Click any point to toggle Correct (✓) or Wrong (✗).
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end flex-wrap">
          <button
            onClick={() => setIsUploadModalOpen(true)}
            className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-3.5 py-2.5 rounded-xl shadow-xs transition cursor-pointer active:scale-98"
          >
            <UploadCloud className="w-4 h-4 text-emerald-400" />
            <span>AI Document Upload & Auto-Verify</span>
          </button>

          <button
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3.5 py-2.5 rounded-xl shadow-xs transition cursor-pointer active:scale-98"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Checklist (.xlsx)</span>
          </button>
        </div>
      </div>

      {/* 2. Full Sentence Reference Card (Clean and Clear Full Sentences) */}
      <div className="bg-slate-900 text-white rounded-2xl p-5 border border-slate-800 shadow-md space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Embassy Document Requirements (Full Sequence & Descriptions)
            </span>
          </div>
          <span className="text-[10px] font-mono text-amber-400 bg-amber-950 px-2.5 py-0.5 rounded border border-amber-800 font-bold">
            EMBASSY VERIFIED
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2.5 text-xs font-medium text-slate-300">
          {CHECKLIST_POINTS.map((pt) => (
            <div key={pt.id} className="flex items-start gap-2 py-1.5 border-b border-slate-800/60 last:border-0">
              <span className="w-5 h-5 rounded-full bg-slate-800 text-amber-400 text-[10px] font-mono font-bold flex items-center justify-center shrink-0 mt-0.5">
                {pt.id}
              </span>
              <p className="leading-relaxed">{pt.sentence}</p>
            </div>
          ))}
        </div>
      </div>

      {/* 3. Filter Bar & Search */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="flex items-center gap-1 p-1 bg-slate-100/80 rounded-xl border border-slate-200/60 overflow-x-auto max-w-full">
          <button
            onClick={() => {
              setFilterScore('ALL');
              setCurrentPage(1);
            }}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
              filterScore === 'ALL'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All Candidates ({applicants.length})
          </button>

          <button
            onClick={() => {
              setFilterScore('COMPLETE');
              setCurrentPage(1);
            }}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
              filterScore === 'COMPLETE'
                ? 'bg-white text-emerald-800 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Fully Cleared (10/10) ({applicants.filter((a) => Object.values(getApplicantItems(a)).filter(Boolean).length === 10).length})
          </button>

          <button
            onClick={() => {
              setFilterScore('PENDING');
              setCurrentPage(1);
            }}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
              filterScore === 'PENDING'
                ? 'bg-white text-amber-800 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Pending Clearance (&lt;10) ({applicants.filter((a) => Object.values(getApplicantItems(a)).filter(Boolean).length < 10).length})
          </button>

          <button
            onClick={() => {
              setFilterScore('WARNINGS');
              setCurrentPage(1);
            }}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
              filterScore === 'WARNINGS'
                ? 'bg-rose-50 text-rose-800 border border-rose-200 shadow-2xs font-black'
                : 'text-rose-600 hover:text-rose-900 hover:bg-rose-50/50'
            }`}
          >
            ⚠️ Warnings / Invalid Dates ({applicants.filter((a) => !checkPassportExpiryValid(a).isValid || !checkInsuranceStartDateValid(a).isValid).length})
          </button>
        </div>

        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search candidate, passport, job..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full bg-slate-50 hover:bg-white focus:bg-white border border-slate-200/80 focus:border-amber-500 rounded-xl pl-10 pr-4 py-2 text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 transition shadow-xs"
          />
        </div>
      </div>

      {/* 4. Interactive Matrix Table with Correct (✓) & Wrong (✗) Marks */}
      <div className="overflow-x-auto border border-slate-200/80 rounded-xl shadow-2xs">
        <table className="w-full text-xs text-left border-collapse font-sans">
          <thead className="bg-slate-50 font-bold uppercase tracking-wider text-[10px] text-slate-500 border-b border-slate-200">
            <tr>
              <th className="p-3 pl-4 w-10 font-mono">NO</th>
              <th className="p-3 min-w-[200px]">CANDIDATE PARTICULARS</th>
              {CHECKLIST_POINTS.map((pt) => (
                <th
                  key={pt.id}
                  className="p-2 text-center whitespace-nowrap min-w-[65px]"
                  title={pt.sentence}
                >
                  <div className="flex flex-col items-center">
                    <span className="font-mono text-amber-700">0{pt.id}</span>
                    <span className="text-[9px] text-slate-500 capitalize">{pt.short.split(' ').slice(1).join(' ')}</span>
                  </div>
                </th>
              ))}
              <th className="p-3 text-center whitespace-nowrap font-mono">SCORE</th>
              <th className="p-3 pr-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-sans">
            {paginatedRows.length === 0 ? (
              <tr>
                <td colSpan={13} className="p-12 text-center text-slate-400">
                  No applicants matching checklist criteria.
                </td>
              </tr>
            ) : (
              paginatedRows.map((app, idx) => {
                const serialNo = (currentPage - 1) * pageSize + idx + 1;
                const items = getApplicantItems(app);
                const score = Object.values(items).filter(Boolean).length;
                const isAllPass = score === 10;

                const ppExpiryValidResult = checkPassportExpiryValid(app);
                const insStartDateValidResult = checkInsuranceStartDateValid(app);
                const hasWarnings = !ppExpiryValidResult.isValid || !insStartDateValidResult.isValid;

                return (
                  <tr key={app.applicant_id} className={`hover:bg-slate-50/80 transition group ${hasWarnings ? 'bg-rose-50/20' : ''}`}>
                    <td className="p-3 pl-4 font-mono font-bold text-slate-400">{serialNo}</td>

                    {/* Candidate Particulars & Clickable Warning Indicator */}
                    <td
                      className="p-3 font-bold text-slate-900"
                    >
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span 
                          onClick={() => handleOpenVerifyModal(app)} 
                          className="hover:underline cursor-pointer"
                        >
                          {app.full_name}
                        </span>
                        {hasWarnings && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveWarningApp({
                                name: app.full_name,
                                passport: app.passport_number || 'PENDING',
                                passportWarning: ppExpiryValidResult.isValid ? '' : ppExpiryValidResult.message,
                                insuranceWarning: insStartDateValidResult.isValid ? '' : insStartDateValidResult.message
                              });
                            }}
                            className="inline-flex items-center gap-1 text-[10px] font-bold bg-rose-100 hover:bg-rose-200 text-rose-800 border border-rose-300 px-1.5 py-0.5 rounded-md animate-pulse cursor-pointer shadow-2xs"
                            title="Click to view warning reasons"
                          >
                            <AlertTriangle className="w-3 h-3 text-rose-600 shrink-0" />
                            <span>⚠️ Click to View Warning</span>
                          </button>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono font-normal mt-0.5">
                        <p>{app.passport_number || 'PENDING'} · {app.preferred_job_category}</p>
                      </div>
                    </td>

                    {/* 10 Interactive Correct Mark / Wrong Mark Points with FIXED toggle states */}
                    {CHECKLIST_POINTS.map((pt) => {
                      const isReady = (items as any)[pt.key];
                      return (
                        <td key={pt.id} className="p-2 text-center">
                          <button
                            onClick={() => handleTogglePoint(app, pt.key, isReady)}
                            title={`${pt.sentence}\nClick to toggle: currently ${isReady ? 'CORRECT (✓)' : 'WRONG (✗)'}`}
                            className={`w-7 h-7 rounded-lg inline-flex items-center justify-center font-bold text-xs transition cursor-pointer shadow-2xs active:scale-90 ${
                              isReady
                                ? 'bg-emerald-100 hover:bg-emerald-200 text-emerald-800 border border-emerald-300 ring-1 ring-emerald-400/30'
                                : 'bg-rose-100 hover:bg-rose-200 text-rose-800 border border-rose-300 ring-1 ring-rose-400/30'
                            }`}
                          >
                            {isReady ? '✓' : '✗'}
                          </button>
                        </td>
                      );
                    })}

                    {/* Score */}
                    <td className="p-3 text-center whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-mono font-bold ${
                          isAllPass
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : score >= 6
                            ? 'bg-blue-100 text-blue-800 border border-blue-200'
                            : 'bg-amber-100 text-amber-800 border border-amber-200'
                        }`}
                      >
                        {score}/10 {isAllPass && '★'}
                      </span>
                    </td>

                    {/* Actions (Profile button is REMOVED as requested) */}
                    <td className="p-3 pr-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenVerifyModal(app)}
                          className="p-1.5 px-3 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold transition cursor-pointer shadow-xs active:scale-98"
                        >
                          Verify (Full)
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

      {/* 5. Pagination */}
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

      {/* AI Document Upload Modal */}
      <SectionDocumentUploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        sectionTitle="Embassy Documents Checklist (AI OCR Verification)"
        sectionContext="checklist"
        onSuccess={() => {
          onRefreshData();
          showNotification('success', 'Documents verified and checklist marks updated.');
        }}
        showNotification={showNotification}
      />

      {/* Full Sentence Verification Modal with Date Check Warnings */}
      {verifyingApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full border border-slate-200 shadow-2xl p-6 space-y-5">
            <div className="flex justify-between items-center pb-3 border-b border-slate-200">
              <div>
                <h3 className="font-bold text-base text-slate-900">
                  Embassy Documents Checklist: {verifyingApp.full_name}
                </h3>
                <p className="text-xs text-slate-500 font-mono mt-0.5">
                  Interview Date: {verifyingApp.appointment_date || 'NOT SET YET'} · Passport No: {verifyingApp.passport_number || 'PENDING'}
                </p>
              </div>
              <button
                onClick={() => setVerifyingApp(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Verification & Expiry Dates Input Area */}
            <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                  Passport Expiry Date
                </label>
                <input
                  type="date"
                  value={passportExpiryInput}
                  onChange={(e) => setPassportExpiryInput(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg p-2 font-mono text-slate-900 font-bold"
                />
                {!checkPassportExpiryValid(verifyingApp).isValid && (
                  <p className="text-[10px] text-rose-600 font-semibold mt-1">
                    ⚠️ Failing expiry criteria!
                  </p>
                )}
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                  Insurance covering period's start date
                </label>
                <input
                  type="date"
                  value={insuranceStartDateInput}
                  onChange={(e) => setInsuranceStartDateInput(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg p-2 font-mono text-slate-900 font-bold"
                />
                {!checkInsuranceStartDateValid(verifyingApp).isValid && (
                  <p className="text-[10px] text-rose-600 font-semibold mt-1">
                    ⚠️ Failing start date criteria!
                  </p>
                )}
              </div>

              <div>
                <label className="text-[10px] font-bold text-amber-700 uppercase block mb-1">
                  Police Certify Date (Yellow highlighted)
                </label>
                <input
                  type="date"
                  value={policeCertifyDateInput}
                  onChange={(e) => setPoliceCertifyDateInput(e.target.value)}
                  className="w-full bg-white border border-amber-300 rounded-lg p-2 font-mono text-slate-900 font-bold"
                />
                <span className="text-[9px] text-amber-800">Date on yellow-highlighted certify stamp</span>
              </div>

              <div>
                <label className="text-[10px] font-bold text-amber-700 uppercase block mb-1">
                  Police Certify Expire Date
                </label>
                <input
                  type="date"
                  value={policeCertifyExpireInput}
                  onChange={(e) => setPoliceCertifyExpireInput(e.target.value)}
                  className="w-full bg-white border border-amber-300 rounded-lg p-2 font-mono text-slate-900 font-bold"
                />
                <span className="text-[9px] text-amber-800">Certified copy validity / expiry date (Date only)</span>
              </div>

              {/* Warning box */}
              {(!checkPassportExpiryValid(verifyingApp).isValid || !checkInsuranceStartDateValid(verifyingApp).isValid) && (
                <div className="col-span-2 p-3 bg-rose-50 border border-rose-200 rounded-lg space-y-1 text-rose-900">
                  <div className="flex items-center gap-1.5 font-bold">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>Statutory Date Discrepancies Detected</span>
                  </div>
                  <ul className="list-disc pl-5 font-medium space-y-1 text-[11px]">
                    {!checkPassportExpiryValid(verifyingApp).isValid && (
                      <li>{checkPassportExpiryValid(verifyingApp).message}</li>
                    )}
                    {!checkInsuranceStartDateValid(verifyingApp).isValid && (
                      <li>{checkInsuranceStartDateValid(verifyingApp).message}</li>
                    )}
                  </ul>
                </div>
              )}
            </div>

            {/* List of 10 items */}
            <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-1">
              {CHECKLIST_POINTS.map((pt) => {
                const isChecked = Boolean(editingForm[pt.key]);
                return (
                  <div
                    key={pt.id}
                    onClick={() => setEditingForm({ ...editingForm, [pt.key]: !isChecked })}
                    className={`flex items-start justify-between gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                      isChecked
                        ? 'bg-emerald-50/70 border-emerald-300 ring-1 ring-emerald-400/20'
                        : 'bg-slate-50 border-slate-200 hover:bg-slate-100/80'
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <div
                        className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 ${
                          isChecked
                            ? 'bg-emerald-600 text-white'
                            : 'bg-rose-100 text-rose-700 border border-rose-300'
                        }`}
                      >
                        {isChecked ? '✓' : '✗'}
                      </div>
                      <div>
                        <p className={`text-xs font-semibold ${isChecked ? 'text-slate-900 font-bold' : 'text-slate-700'}`}>
                          {pt.sentence}
                        </p>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {isChecked ? 'Marked Correct (Verified & Valid)' : 'Marked Wrong (Deficiency / Pending)'}
                        </span>
                      </div>
                    </div>

                    <span
                      className={`text-[11px] font-bold px-2 py-0.5 rounded uppercase tracking-wider shrink-0 ${
                        isChecked ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {isChecked ? 'CORRECT' : 'WRONG'}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-slate-200">
              <span className="text-xs font-mono font-bold text-slate-700">
                Total Score:{' '}
                <strong className="text-emerald-700 text-sm">
                  {Object.values(editingForm).filter(Boolean).length}/10
                </strong>
              </span>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setVerifyingApp(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveModalVerify}
                  disabled={isSaving}
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
                >
                  {isSaving ? 'Saving...' : 'Save All Marks'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Pop-out Warning Modal for Date Discrepancies */}
      {activeWarningApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full border border-rose-200 shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="bg-rose-600 text-white px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-300 animate-bounce" />
                <h3 className="font-bold text-sm uppercase tracking-wider">Statutory Clearance Warning</h3>
              </div>
              <button
                onClick={() => setActiveWarningApp(null)}
                className="p-1 rounded-lg text-rose-100 hover:text-white hover:bg-rose-700 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4 text-xs font-sans text-slate-800">
              <div className="bg-rose-50/50 p-3 rounded-xl border border-rose-100 space-y-1.5">
                <div className="grid grid-cols-3 gap-2 border-b border-rose-100/50 pb-2">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Applicant Name:</span>
                  <span className="col-span-2 font-bold text-slate-900 text-sm uppercase">{activeWarningApp.name}</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Passport No:</span>
                  <span className="col-span-2 font-mono font-bold text-slate-800">{activeWarningApp.passport}</span>
                </div>
              </div>

              <div className="space-y-3">
                <p className="font-bold text-slate-900 text-[11px] uppercase tracking-wider text-rose-700">
                  Detected Discrepancies:
                </p>

                {activeWarningApp.passportWarning && (
                  <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl space-y-1">
                    <span className="text-[10px] font-black uppercase text-amber-800 bg-amber-100 px-2 py-0.5 rounded font-mono">
                      PASSPORT ISSUE
                    </span>
                    <p className="text-slate-800 font-semibold leading-relaxed pt-1">
                      {activeWarningApp.passportWarning}
                    </p>
                  </div>
                )}

                {activeWarningApp.insuranceWarning && (
                  <div className="p-3 bg-rose-50 border border-rose-300 rounded-xl space-y-1">
                    <span className="text-[10px] font-black uppercase text-rose-800 bg-rose-100 px-2 py-0.5 rounded font-mono">
                      INSURANCE ISSUE
                    </span>
                    <p className="text-slate-800 font-semibold leading-relaxed pt-1">
                      {activeWarningApp.insuranceWarning}
                    </p>
                  </div>
                )}
              </div>

              <div className="text-[10px] text-slate-400 bg-slate-50 p-2.5 rounded-lg leading-relaxed">
                * Note: These are embassy rules enforced by the SLBFE. You can update the dates by clicking <strong>Verify (Full)</strong> on this candidate.
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-slate-50 px-5 py-3 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setActiveWarningApp(null)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition cursor-pointer active:scale-95"
              >
                Acknowledge & Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
