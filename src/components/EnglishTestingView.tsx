import React, { useState, useMemo, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { ApplicantOverview } from '../types';
import {
  BookOpen,
  Award,
  Search,
  Plus,
  Printer,
  Download,
  CheckCircle2,
  AlertCircle,
  Clock,
  UserCheck,
  FileText,
  X,
  Edit2,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Percent,
  Calendar,
  Layers,
  Maximize2,
  Trash2,
  ShieldAlert,
  ArrowRight,
  Filter
} from 'lucide-react';
import { EnglishSchedulePdfModal } from './EnglishSchedulePdfModal';

interface Props {
  applicants: ApplicantOverview[];
  onViewApplicant: (id: string) => void;
  onRefreshData: () => void;
  showNotification: (type: 'success' | 'error' | 'info', text: string) => void;
}

export const EnglishTestingView: React.FC<Props> = ({
  applicants,
  onViewApplicant,
  onRefreshData,
  showNotification
}) => {
  // Main Navigation Tabs: 'matrix' (Scoring Matrix) | 'schedule' (Interview Test Attempts Schedule & Attendance)
  const [activeTab, setActiveTab] = useState<'matrix' | 'schedule'>('matrix');

  // Active Attempt Tab in Schedule view: 1, 2, or 3
  const [activeAttemptTab, setActiveAttemptTab] = useState<number>(1);

  // Search & Pagination
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 12;

  // Evaluators list state
  const [evaluators, setEvaluators] = useState<string[]>([
    'Althaf Hussain',
    'Fathima Rizna',
    'Kamal Perera',
    'Mohamed Rizwan',
    'Nimal Fernando',
    'Shiraz Ahamed',
    'Dilani Jayawardena'
  ]);
  const [newEvaluatorName, setNewEvaluatorName] = useState('');
  const [showAddEvaluatorModal, setShowAddEvaluatorModal] = useState(false);

  // Score Entry Modal (Method to add percentages)
  const [scoringApp, setScoringApp] = useState<ApplicantOverview | null>(null);
  const [scoreForm, setScoreForm] = useState<{
    attempt1: number | string;
    attempt2: number | string;
    attempt3: number | string;
    evaluator: string;
    notes: string;
  }>({
    attempt1: 75,
    attempt2: '',
    attempt3: '',
    evaluator: 'Althaf Hussain',
    notes: ''
  });
  const [isSavingScore, setIsSavingScore] = useState(false);

  // Pop-out Remarks Modal
  const [popoutRemarks, setPopoutRemarks] = useState<{
    app: ApplicantOverview;
    attempt: number;
    remarks: string;
  } | null>(null);

  // PDF Preview Modal
  const [showSchedulePdfModal, setShowSchedulePdfModal] = useState(false);

  // Load evaluators from backend
  useEffect(() => {
    fetch('/api/evaluators')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setEvaluators(data);
        }
      })
      .catch(() => {});
  }, []);

  // Helper to calculate English Status from all available attempts
  const calculateEnglishStatus = (t1?: number | null, t2?: number | null, t3?: number | null) => {
    const validScores: number[] = [];
    if (typeof t1 === 'number' && !isNaN(t1)) validScores.push(t1);
    if (typeof t2 === 'number' && !isNaN(t2)) validScores.push(t2);
    if (typeof t3 === 'number' && !isNaN(t3)) validScores.push(t3);

    if (validScores.length === 0) return { rating: 'Not Tested', avg: 0, badgeColor: 'bg-slate-100 text-slate-600' };

    const avg = Math.round(validScores.reduce((a, b) => a + b, 0) / validScores.length);
    if (avg >= 80) return { rating: 'Excellent', avg, badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-300' };
    if (avg >= 65) return { rating: 'Good', avg, badgeColor: 'bg-blue-100 text-blue-800 border-blue-300' };
    if (avg >= 50) return { rating: 'Average', avg, badgeColor: 'bg-amber-100 text-amber-800 border-amber-300' };
    return { rating: 'Needs Improvement', avg, badgeColor: 'bg-rose-100 text-rose-800 border-rose-300' };
  };

  // Eligibility & 1-Week Retention Filter:
  // - If Visa Issued or OK -> Remove from English testing
  // - If Visa Rejected -> Keep for 1 week (7 days) then remove
  const eligibleApplicants = useMemo(() => {
    return applicants.filter((app) => {
      const vs = (app.visa_status || '').toLowerCase().trim();

      // Remove if Visa Issued / OK / Approved
      if (vs === 'ok' || vs.includes('visa issued') || vs.includes('approved') || vs.includes('issued')) {
        return false;
      }

      // If Visa Rejected -> 1 week retention
      if (vs.includes('rejected')) {
        const dateStr = (app as any).updated_at || app.passport_collected_date || app.registration_date;
        if (dateStr) {
          const statusDate = new Date(dateStr);
          const now = new Date();
          const diffDays = (now.getTime() - statusDate.getTime()) / (1000 * 3600 * 24);
          if (diffDays > 7) {
            return false; // More than 7 days old -> remove
          }
        }
      }

      return true;
    });
  }, [applicants]);

  // Filtered rows by search term
  const filteredRows = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    return eligibleApplicants.filter((app) => {
      return (
        !q ||
        app.full_name?.toLowerCase().includes(q) ||
        app.passport_number?.toLowerCase().includes(q) ||
        app.se_number?.toLowerCase().includes(q) ||
        app.preferred_job_category?.toLowerCase().includes(q) ||
        app.english_evaluator?.toLowerCase().includes(q) ||
        app.english_rating?.toLowerCase().includes(q)
      );
    });
  }, [eligibleApplicants, searchTerm]);

  // Pagination for main table
  const totalPages = Math.ceil(filteredRows.length / pageSize) || 1;
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, currentPage, pageSize]);

  // Applicants grouped by Attempt in Schedule Sub-section
  const attempt1Candidates = useMemo(() => {
    return filteredRows.filter((a) => (a.english_current_attempt || 1) === 1);
  }, [filteredRows]);

  const attempt2Candidates = useMemo(() => {
    return filteredRows.filter((a) => a.english_current_attempt === 2);
  }, [filteredRows]);

  const attempt3Candidates = useMemo(() => {
    return filteredRows.filter((a) => a.english_current_attempt === 3);
  }, [filteredRows]);

  const currentAttemptCandidates =
    activeAttemptTab === 1 ? attempt1Candidates : activeAttemptTab === 2 ? attempt2Candidates : attempt3Candidates;

  // Evaluator Add & Delete
  const handleAddNewEvaluator = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEvaluatorName.trim()) {
      showNotification('error', 'Evaluator name is required');
      return;
    }

    try {
      const res = await fetch('/api/evaluators', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newEvaluatorName.trim() })
      });
      if (res.ok) {
        const updated = await res.json();
        setEvaluators(updated);
        showNotification('success', `Evaluator "${newEvaluatorName}" added successfully!`);
        setNewEvaluatorName('');
      }
    } catch (err: any) {
      showNotification('error', err.message);
    }
  };

  const handleRemoveEvaluatorFromList = (evaluatorName: string) => {
    const updated = evaluators.filter((e) => e !== evaluatorName);
    setEvaluators(updated);
    showNotification('success', `Evaluator "${evaluatorName}" removed from system list.`);
  };

  const handleQuickClearEvaluator = async (applicantId: string) => {
    try {
      const res = await fetch(`/api/applicants/${applicantId}/quick-update`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ english_evaluator: '' })
      });
      if (res.ok) {
        showNotification('success', 'Evaluator cleared for applicant');
        onRefreshData();
      }
    } catch (err: any) {
      showNotification('error', err.message);
    }
  };

  const handleQuickEvaluatorChange = async (applicantId: string, evaluatorName: string) => {
    try {
      const res = await fetch(`/api/applicants/${applicantId}/quick-update`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ english_evaluator: evaluatorName })
      });
      if (res.ok) {
        showNotification('success', `Evaluator updated to ${evaluatorName || 'None'}`);
        onRefreshData();
      }
    } catch (err: any) {
      showNotification('error', err.message);
    }
  };

  // Open Score Entry Modal
  const handleOpenScoreEntry = (app: ApplicantOverview) => {
    setScoringApp(app);
    setScoreForm({
      attempt1: app.english_attempt_1 !== undefined && app.english_attempt_1 !== null ? app.english_attempt_1 : 75,
      attempt2: app.english_attempt_2 !== undefined && app.english_attempt_2 !== null ? app.english_attempt_2 : '',
      attempt3: app.english_attempt_3 !== undefined && app.english_attempt_3 !== null ? app.english_attempt_3 : '',
      evaluator: app.english_evaluator || evaluators[0] || 'Althaf Hussain',
      notes: app.english_evaluator_notes || ''
    });
  };

  const handleSaveScores = async () => {
    if (!scoringApp) return;
    setIsSavingScore(true);

    const a1 = scoreForm.attempt1 !== '' ? Number(scoreForm.attempt1) : null;
    const a2 = scoreForm.attempt2 !== '' ? Number(scoreForm.attempt2) : null;
    const a3 = scoreForm.attempt3 !== '' ? Number(scoreForm.attempt3) : null;

    const calc = calculateEnglishStatus(a1, a2, a3);
    const derivedLevel = calc.avg >= 75 ? 'A' : calc.avg >= 55 ? 'B' : 'C';

    try {
      const res = await fetch(`/api/applicants/${scoringApp.applicant_id}/quick-update`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          english_attempt_1: a1,
          english_attempt_2: a2,
          english_attempt_3: a3,
          english_rating: `${calc.rating} (${calc.avg}%)`,
          english_level: derivedLevel,
          english_percentage: calc.avg,
          spoken_english_level: derivedLevel,
          spoken_english_percentage: calc.avg,
          english_status: derivedLevel === 'A' ? 'Good' : derivedLevel === 'B' ? 'Average' : 'Basic',
          english_evaluator: scoreForm.evaluator,
          english_evaluator_notes: scoreForm.notes
        })
      });

      if (res.ok) {
        showNotification('success', `English scores updated for ${scoringApp.full_name}: ${calc.rating} (${calc.avg}%)`);
        setScoringApp(null);
        onRefreshData();
      } else {
        const d = await res.json();
        showNotification('error', d.error || 'Failed to save scores');
      }
    } catch (err: any) {
      showNotification('error', err.message);
    } finally {
      setIsSavingScore(false);
    }
  };

  // Update schedule field (date, time, attendance, remarks) & progression rule
  const handleUpdateScheduleField = async (
    applicantId: string,
    attempt: number,
    field: 'date' | 'time' | 'attendance' | 'remarks',
    value: string
  ) => {
    const updatePayload: Record<string, any> = {};

    if (field === 'date') {
      updatePayload[`english_test_date_${attempt}`] = value;
    } else if (field === 'time') {
      updatePayload[`english_test_time_${attempt}`] = value;
    } else if (field === 'remarks') {
      updatePayload[`english_remarks_${attempt}`] = value;
    } else if (field === 'attendance') {
      updatePayload[`english_attendance_${attempt}`] = value;

      // AUTOMATIC PROGRESSION:
      // If "Came to the Test" -> automatically move candidate to next attempt!
      if (value === 'Came to the Test') {
        if (attempt === 1) {
          updatePayload.english_current_attempt = 2;
          updatePayload.english_test_date_2 = new Date().toISOString().split('T')[0];
          updatePayload.english_attendance_2 = 'Pending';
        } else if (attempt === 2) {
          updatePayload.english_current_attempt = 3;
          updatePayload.english_test_date_3 = new Date().toISOString().split('T')[0];
          updatePayload.english_attendance_3 = 'Pending';
        }
      } else if (value === 'Not Came') {
        updatePayload.english_current_attempt = attempt;
      }
    }

    try {
      const res = await fetch(`/api/applicants/${applicantId}/quick-update`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatePayload)
      });

      if (res.ok) {
        if (field === 'attendance' && value === 'Came to the Test' && attempt < 3) {
          showNotification('success', `Attendance saved: "Came to the Test". Applicant automatically progressed to Attempt 0${attempt + 1}!`);
        } else {
          showNotification('success', `Schedule field updated.`);
        }
        onRefreshData();
      }
    } catch (err: any) {
      showNotification('error', err.message);
    }
  };

  // Export Batch Excel
  const handleExportBatchExcel = () => {
    try {
      const rows = eligibleApplicants.map((a, idx) => {
        const st = calculateEnglishStatus(a.english_attempt_1, a.english_attempt_2, a.english_attempt_3);
        return {
          'NO': idx + 1,
          'CANDIDATE NAME': a.full_name,
          'PASSPORT NO': a.passport_number || 'PENDING',
          'SE NUMBER': a.se_number || '—',
          'JOB CATEGORY': a.preferred_job_category,
          '01ST ATTEMPT (%)': a.english_attempt_1 ?? '—',
          '02ND ATTEMPT (%)': a.english_attempt_2 ?? '—',
          '03RD ATTEMPT (%)': a.english_attempt_3 ?? '—',
          'CALCULATED RATING': st.rating,
          'EVALUATOR': a.english_evaluator || 'Unassigned',
          'REG DATE': a.registration_date
        };
      });

      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'ENGLISH_TESTING_REPORT');
      const filename = `TransArabian_English_Testing_Batch_Report_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(wb, filename);
      showNotification('success', `Exported ${rows.length} candidate reports to ${filename}`);
    } catch (err: any) {
      showNotification('error', err.message);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 sm:p-6 space-y-6">
      {/* 1. TOP HEADER & NAVIGATION TABS */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="p-2.5 rounded-2xl bg-slate-900 text-emerald-400 shadow-xs">
              <BookOpen className="w-5 h-5" />
            </span>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-bold text-slate-900 tracking-tight">English Testing</h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">
                  {eligibleApplicants.length} CANDIDATES
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Oral test schedule, attempts progression (01, 02, 03), attendance tracking, scoring & PDF report generator.
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 self-stretch lg:self-auto justify-end">
          {/* Add Evaluator Button */}
          <button
            onClick={() => setShowAddEvaluatorModal(true)}
            className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold px-3.5 py-2.5 rounded-xl border border-slate-300/80 transition cursor-pointer active:scale-98"
          >
            <UserCheck className="w-3.5 h-3.5 text-slate-600" />
            <span>Evaluators List ({evaluators.length})</span>
          </button>

          {/* Export Excel */}
          <button
            onClick={handleExportBatchExcel}
            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3.5 py-2.5 rounded-xl shadow-xs transition cursor-pointer active:scale-98"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Excel</span>
          </button>
        </div>
      </div>

      {/* 2. SUB-SECTION VIEW TOGGLE BAR */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-1.5 bg-slate-100 rounded-2xl border border-slate-200">
        <div className="flex items-center gap-1.5 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setActiveTab('matrix')}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeTab === 'matrix'
                ? 'bg-slate-900 text-white shadow-md'
                : 'text-slate-700 hover:text-slate-900 hover:bg-slate-200/70'
            }`}
          >
            <BookOpen className={`w-4 h-4 ${activeTab === 'matrix' ? 'text-emerald-400' : 'text-slate-600'}`} />
            <span>Scoring & Proficiency Matrix</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('schedule')}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeTab === 'schedule'
                ? 'bg-slate-900 text-white shadow-md'
                : 'text-slate-700 hover:text-slate-900 hover:bg-slate-200/70'
            }`}
          >
            <Calendar className={`w-4 h-4 ${activeTab === 'schedule' ? 'text-amber-400' : 'text-slate-600'}`} />
            <span>Test Attempts Schedule & Attendance</span>
            <span className={`text-[10px] font-mono px-2 py-0.5 rounded-md font-bold ${
              activeTab === 'schedule' ? 'bg-amber-400/20 text-amber-300 border border-amber-400/30' : 'bg-slate-200 text-slate-700'
            }`}>
              Attempts 01, 02, 03
            </span>
          </button>
        </div>

        <div className="text-[11px] text-slate-500 font-mono hidden sm:block pr-3">
          {activeTab === 'matrix'
            ? 'Score grading (%) & oral proficiency rating'
            : 'Arrange dates, times, attendance & automatic progression'}
        </div>
      </div>

      {/* 3. TAB 1: SCORING & PROFICIENCY MATRIX */}
      {activeTab === 'matrix' && (
        <div className="space-y-4">
          {/* Search Toolbar */}
          <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search name, passport, SE, job category..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full bg-slate-50 hover:bg-white focus:bg-white border border-slate-200/80 focus:border-emerald-500 rounded-xl pl-10 pr-4 py-2 text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all shadow-xs"
              />
            </div>
            <div className="text-xs text-slate-500 font-mono">
              Showing {paginatedRows.length} of {filteredRows.length} Candidates
            </div>
          </div>

          {/* MAIN TABLE */}
          <div className="overflow-x-auto border border-slate-200/80 rounded-xl shadow-xs">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-slate-50 font-bold uppercase tracking-wider text-[10px] text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="p-3 pl-4 w-12 font-mono">NO</th>
                  <th className="p-3">CANDIDATE NAME</th>
                  <th className="p-3 font-mono">PASSPORT NO</th>
                  <th className="p-3 font-mono">SE NUMBER</th>
                  <th className="p-3">JOB CATEGORY</th>
                  <th className="p-3 text-center font-mono">01ST ATTEMPT</th>
                  <th className="p-3 text-center font-mono">02ND ATTEMPT</th>
                  <th className="p-3 text-center font-mono">03RD ATTEMPT</th>
                  <th className="p-3 text-center">ENGLISH RATING</th>
                  <th className="p-3 min-w-[180px]">EVALUATOR</th>
                  <th className="p-3 pr-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-sans">
                {paginatedRows.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="p-10 text-center text-slate-400">
                      No candidate records found for English Testing.
                    </td>
                  </tr>
                ) : (
                  paginatedRows.map((app, idx) => {
                    const serialNo = (currentPage - 1) * pageSize + idx + 1;
                    const calc = calculateEnglishStatus(app.english_attempt_1, app.english_attempt_2, app.english_attempt_3);
                    const currentEvaluator = app.english_evaluator || '';
                    const isRejected = (app.visa_status || '').toLowerCase().includes('rejected');

                    return (
                      <tr key={app.applicant_id} className="hover:bg-slate-50/80 transition group">
                        <td className="p-3 pl-4 font-mono font-bold text-slate-400">{serialNo}</td>

                        <td className="p-3 font-bold text-slate-900">
                          <div className="flex items-center gap-1.5">
                            <span>{app.full_name}</span>
                            {isRejected && (
                              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 font-bold border border-rose-300">
                                7-Day Retention
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono block">ID: {app.applicant_id}</span>
                        </td>

                        <td className="p-3 font-mono font-bold text-slate-800 whitespace-nowrap">
                          <span className="px-2 py-0.5 bg-slate-100 rounded border border-slate-200">
                            {app.passport_number || 'PENDING'}
                          </span>
                        </td>

                        {/* SE NUMBER COLUMN */}
                        <td className="p-3 font-mono font-extrabold text-emerald-800 whitespace-nowrap">
                          {app.se_number ? (
                            <span className="px-2 py-0.5 bg-emerald-50 rounded border border-emerald-200">
                              {app.se_number}
                            </span>
                          ) : (
                            <span className="text-slate-300 font-normal">—</span>
                          )}
                        </td>

                        {/* JOB CATEGORY COLUMN (Formerly Target Trade) */}
                        <td className="p-3 uppercase font-semibold text-slate-800 whitespace-nowrap">
                          {app.preferred_job_category}
                        </td>

                        <td className="p-3 text-center font-mono whitespace-nowrap">
                          {app.english_attempt_1 !== undefined && app.english_attempt_1 !== null ? (
                            <span className="px-2 py-0.5 rounded font-bold bg-slate-100 text-slate-800">
                              {app.english_attempt_1}%
                            </span>
                          ) : (
                            <span className="text-slate-300 font-bold">—</span>
                          )}
                        </td>

                        <td className="p-3 text-center font-mono whitespace-nowrap">
                          {app.english_attempt_2 !== undefined && app.english_attempt_2 !== null ? (
                            <span className="px-2 py-0.5 rounded font-bold bg-slate-100 text-slate-800">
                              {app.english_attempt_2}%
                            </span>
                          ) : (
                            <span className="text-slate-300 font-bold">—</span>
                          )}
                        </td>

                        <td className="p-3 text-center font-mono whitespace-nowrap">
                          {app.english_attempt_3 !== undefined && app.english_attempt_3 !== null ? (
                            <span className="px-2 py-0.5 rounded font-bold bg-slate-100 text-slate-800">
                              {app.english_attempt_3}%
                            </span>
                          ) : (
                            <span className="text-slate-300 font-bold">—</span>
                          )}
                        </td>

                        <td className="p-3 text-center whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold border ${calc.badgeColor}`}>
                            <span>{calc.rating}</span>
                            {calc.avg > 0 && <span className="font-mono">({calc.avg}%)</span>}
                          </span>
                        </td>

                        {/* EVALUATOR FIELD WITH QUICK CLEAR BUTTON */}
                        <td className="p-3">
                          <div className="flex items-center gap-1">
                            <select
                              value={currentEvaluator}
                              onChange={(e) => handleQuickEvaluatorChange(app.applicant_id, e.target.value)}
                              className="w-full bg-white hover:bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer shadow-2xs"
                            >
                              <option value="">Unassigned</option>
                              {evaluators.map((ev) => (
                                <option key={ev} value={ev}>
                                  {ev}
                                </option>
                              ))}
                            </select>
                            {currentEvaluator && (
                              <button
                                type="button"
                                onClick={() => handleQuickClearEvaluator(app.applicant_id)}
                                className="p-1 text-slate-400 hover:text-rose-600 transition"
                                title="Remove Evaluator"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>

                        <td className="p-3 pr-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleOpenScoreEntry(app)}
                              className="p-1 px-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition cursor-pointer shadow-2xs"
                              title="Add / Edit Percentage Scores"
                            >
                              <Percent className="w-3 h-3 text-emerald-400" />
                              <span>Grade Score</span>
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

          {/* Pagination */}
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
        </div>
      )}

      {/* 4. TAB 2: ENGLISH INTERVIEW TESTS SCHEDULE & ATTENDANCE (ATTEMPTS 01, 02, 03) */}
      {activeTab === 'schedule' && (
        <div className="space-y-4">
          {/* Attempt Selector & PDF Generator Toolbar */}
          <div className="p-3 bg-slate-100 rounded-2xl border border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-slate-700 mr-2">Select Attempt Stage:</span>
              {[1, 2, 3].map((attNum) => {
                const count =
                  attNum === 1
                    ? attempt1Candidates.length
                    : attNum === 2
                    ? attempt2Candidates.length
                    : attempt3Candidates.length;

                return (
                  <button
                    key={attNum}
                    type="button"
                    onClick={() => setActiveAttemptTab(attNum)}
                    className={`flex items-center gap-2 px-4 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                      activeAttemptTab === attNum
                        ? 'bg-slate-900 text-white shadow-sm'
                        : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-300/80'
                    }`}
                  >
                    <span>Attempt 0{attNum}</span>
                    <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded font-extrabold ${
                      activeAttemptTab === attNum ? 'bg-amber-400 text-slate-950' : 'bg-slate-200 text-slate-800'
                    }`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Print & PDF Preview Modal Trigger */}
            <button
              type="button"
              onClick={() => setShowSchedulePdfModal(true)}
              className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-4 py-2 rounded-xl transition shadow-xs cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Preview & Print Attempt 0{activeAttemptTab} Schedule PDF</span>
            </button>
          </div>

          {/* Schedule Table for Active Attempt */}
          <div className="overflow-x-auto border border-slate-200/80 rounded-xl shadow-xs">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-slate-900 text-white font-bold uppercase tracking-wider text-[10px] border-b border-slate-800">
                <tr>
                  <th className="p-3 pl-4 w-12 text-center font-mono">NO</th>
                  <th className="p-3">CANDIDATE NAME</th>
                  <th className="p-3 font-mono">PASSPORT NO</th>
                  <th className="p-3 font-mono">SE NUMBER</th>
                  <th className="p-3">EMBASSY DATE</th>
                  <th className="p-3 font-mono min-w-[130px]">ENGLISH TEST DATE</th>
                  <th className="p-3 font-mono min-w-[110px]">TEST TIME</th>
                  <th className="p-3 min-w-[160px]">ATTENDANCE</th>
                  <th className="p-3 min-w-[200px]">REMARKS</th>
                  <th className="p-3 pr-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-sans">
                {currentAttemptCandidates.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="p-12 text-center text-slate-400">
                      No candidates currently assigned to Attempt 0{activeAttemptTab}.
                    </td>
                  </tr>
                ) : (
                  currentAttemptCandidates.map((app, idx) => {
                    let testDate = '';
                    let testTime = '10:00 AM';
                    let attendance: 'Pending' | 'Came to the Test' | 'Not Came' = 'Pending';
                    let remarks = '';

                    if (activeAttemptTab === 1) {
                      testDate = app.english_test_date_1 || app.registration_date || '';
                      testTime = app.english_test_time_1 || '10:00 AM';
                      attendance = app.english_attendance_1 || 'Pending';
                      remarks = app.english_remarks_1 || '';
                    } else if (activeAttemptTab === 2) {
                      testDate = app.english_test_date_2 || app.english_test_date_1 || '';
                      testTime = app.english_test_time_2 || '10:00 AM';
                      attendance = app.english_attendance_2 || 'Pending';
                      remarks = app.english_remarks_2 || '';
                    } else if (activeAttemptTab === 3) {
                      testDate = app.english_test_date_3 || app.english_test_date_2 || '';
                      testTime = app.english_test_time_3 || '10:00 AM';
                      attendance = app.english_attendance_3 || 'Pending';
                      remarks = app.english_remarks_3 || '';
                    }

                    return (
                      <tr key={app.applicant_id} className="hover:bg-slate-50/90 transition text-slate-900">
                        <td className="p-3 pl-4 text-center font-mono font-bold text-slate-400">{idx + 1}</td>

                        <td className="p-3 font-bold uppercase text-slate-900">
                          {app.full_name}
                          <span className="text-[10px] text-slate-400 font-mono block">ID: {app.applicant_id}</span>
                        </td>

                        <td className="p-3 font-mono font-bold text-slate-800 whitespace-nowrap">
                          {app.passport_number || 'PENDING'}
                        </td>

                        <td className="p-3 font-mono font-extrabold text-emerald-800 whitespace-nowrap">
                          {app.se_number ? (
                            <span className="px-2 py-0.5 bg-emerald-50 rounded border border-emerald-200">
                              {app.se_number}
                            </span>
                          ) : (
                            <span className="text-slate-300 font-normal">—</span>
                          )}
                        </td>

                        <td className="p-3 font-mono text-slate-600 whitespace-nowrap">
                          {app.embassy_applied_date || app.appointment_date || '—'}
                        </td>

                        {/* Editable Test Date */}
                        <td className="p-3">
                          <input
                            type="date"
                            value={testDate}
                            onChange={(e) =>
                              handleUpdateScheduleField(app.applicant_id, activeAttemptTab, 'date', e.target.value)
                            }
                            className="w-full bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 focus:border-amber-500 rounded px-2 py-1 text-xs font-mono font-bold text-slate-800 cursor-pointer"
                          />
                        </td>

                        {/* Editable Test Time */}
                        <td className="p-3">
                          <input
                            type="text"
                            value={testTime}
                            onChange={(e) =>
                              handleUpdateScheduleField(app.applicant_id, activeAttemptTab, 'time', e.target.value)
                            }
                            className="w-24 bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 focus:border-amber-500 rounded px-2 py-1 text-xs font-mono font-bold text-slate-800"
                            placeholder="10:00 AM"
                          />
                        </td>

                        {/* Attendance Dropdown with Progression Trigger */}
                        <td className="p-3">
                          <select
                            value={attendance}
                            onChange={(e) =>
                              handleUpdateScheduleField(
                                app.applicant_id,
                                activeAttemptTab,
                                'attendance',
                                e.target.value
                              )
                            }
                            className={`w-full border rounded-lg px-2.5 py-1 text-xs font-bold cursor-pointer transition ${
                              attendance === 'Came to the Test'
                                ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                                : attendance === 'Not Came'
                                ? 'bg-rose-100 text-rose-900 border-rose-300'
                                : 'bg-slate-100 text-slate-800 border-slate-300'
                            }`}
                          >
                            <option value="Pending">Pending</option>
                            <option value="Came to the Test">Came to the Test</option>
                            <option value="Not Came">Not Came</option>
                          </select>
                        </td>

                        {/* Remarks Field & Pop-out trigger */}
                        <td className="p-3">
                          <div className="flex items-center gap-1.5">
                            <input
                              type="text"
                              value={remarks}
                              onChange={(e) =>
                                handleUpdateScheduleField(app.applicant_id, activeAttemptTab, 'remarks', e.target.value)
                              }
                              placeholder="Add notes..."
                              className="w-full bg-transparent hover:bg-slate-50 border border-slate-200 focus:border-emerald-500 rounded px-2 py-1 text-xs text-slate-800"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                setPopoutRemarks({
                                  app,
                                  attempt: activeAttemptTab,
                                  remarks
                                })
                              }
                              className="p-1 text-slate-400 hover:text-slate-900 transition"
                              title="Pop-out full remarks modal"
                            >
                              <Maximize2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>

                        <td className="p-3 pr-4 text-right">
                          <button
                            type="button"
                            onClick={() => onViewApplicant(app.applicant_id)}
                            className="p-1 px-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded text-[11px] font-semibold transition"
                          >
                            Profile
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 1: ADD / REMOVE EVALUATORS LIST                          */}
      {/* ============================================================== */}
      {showAddEvaluatorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl p-6 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-200">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-emerald-600" />
                <span>Evaluators List Management</span>
              </h3>
              <button
                onClick={() => setShowAddEvaluatorModal(false)}
                className="p-1 text-slate-400 hover:text-slate-700 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Add Evaluator Form */}
            <form onSubmit={handleAddNewEvaluator} className="flex gap-2">
              <input
                type="text"
                placeholder="Enter new evaluator name..."
                value={newEvaluatorName}
                onChange={(e) => setNewEvaluatorName(e.target.value)}
                className="flex-1 bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
              <button
                type="submit"
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-4 py-2 rounded-xl transition shadow-xs cursor-pointer shrink-0"
              >
                + Add
              </button>
            </form>

            {/* Existing Evaluators List */}
            <div className="space-y-1.5 pt-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Active System Evaluators:
              </span>
              <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
                {evaluators.map((ev) => (
                  <div
                    key={ev}
                    className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800"
                  >
                    <span>{ev}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveEvaluatorFromList(ev)}
                      className="text-slate-400 hover:text-rose-600 transition p-1"
                      title="Remove Evaluator from List"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                onClick={() => setShowAddEvaluatorModal(false)}
                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 2: GRADE PERCENTAGE SCORES                               */}
      {/* ============================================================== */}
      {scoringApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-2xl p-6 space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-slate-200">
              <div>
                <span className="text-[10px] font-bold uppercase text-emerald-700 font-mono">
                  ENGLISH PROFICIENCY ASSESSMENT
                </span>
                <h3 className="font-bold text-base text-slate-900">
                  {scoringApp.full_name} ({scoringApp.passport_number || 'No PP'})
                </h3>
              </div>
              <button
                onClick={() => setScoringApp(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Spoken English Grade Presets */}
            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-700">Quick Grade Preset:</span>
                {(() => {
                  const a1 = scoreForm.attempt1 !== '' ? Number(scoreForm.attempt1) : null;
                  const a2 = scoreForm.attempt2 !== '' ? Number(scoreForm.attempt2) : null;
                  const a3 = scoreForm.attempt3 !== '' ? Number(scoreForm.attempt3) : null;
                  const st = calculateEnglishStatus(a1, a2, a3);
                  const grade = st.avg >= 75 ? 'A' : st.avg >= 55 ? 'B' : 'C';
                  const badgeStyle =
                    grade === 'A'
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                      : grade === 'B'
                      ? 'bg-blue-100 text-blue-800 border-blue-300'
                      : 'bg-amber-100 text-amber-800 border-amber-300';
                  return (
                    <span className={`px-2.5 py-0.5 rounded-md text-xs font-bold border font-mono ${badgeStyle}`}>
                      Calculated Grade {grade} ({st.avg}%)
                    </span>
                  );
                })()}
              </div>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setScoreForm({ ...scoreForm, attempt1: 85 })}
                  className="px-2 py-1.5 rounded-lg border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold transition flex flex-col items-center cursor-pointer"
                >
                  <span className="font-black">Grade A</span>
                  <span className="text-[10px] opacity-80">75-100% (Highest)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setScoreForm({ ...scoreForm, attempt1: 65 })}
                  className="px-2 py-1.5 rounded-lg border border-blue-300 bg-blue-50 hover:bg-blue-100 text-blue-800 text-xs font-bold transition flex flex-col items-center cursor-pointer"
                >
                  <span className="font-black">Grade B</span>
                  <span className="text-[10px] opacity-80">55-74% (Medium)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setScoreForm({ ...scoreForm, attempt1: 45 })}
                  className="px-2 py-1.5 rounded-lg border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-bold transition flex flex-col items-center cursor-pointer"
                >
                  <span className="font-black">Grade C</span>
                  <span className="text-[10px] opacity-80">0-54% (Low)</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="block text-[10px] font-bold uppercase text-slate-500">01st Attempt (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={scoreForm.attempt1}
                  onChange={(e) => setScoreForm({ ...scoreForm, attempt1: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-bold uppercase text-slate-500">02nd Attempt (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={scoreForm.attempt2}
                  onChange={(e) => setScoreForm({ ...scoreForm, attempt2: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-bold uppercase text-slate-500">03rd Attempt (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={scoreForm.attempt3}
                  onChange={(e) => setScoreForm({ ...scoreForm, attempt3: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-[10px] font-bold uppercase text-slate-500">Evaluator Name</label>
              <select
                value={scoreForm.evaluator}
                onChange={(e) => setScoreForm({ ...scoreForm, evaluator: e.target.value })}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900"
              >
                <option value="">Unassigned</option>
                {evaluators.map((ev) => (
                  <option key={ev} value={ev}>
                    {ev}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setScoringApp(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveScores}
                disabled={isSavingScore}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
              >
                {isSavingScore ? 'Saving...' : 'Save Assessment Scores'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 3: POP-OUT REMARKS DIALOG                                */}
      {/* ============================================================== */}
      {popoutRemarks && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-2xl p-6 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-200">
              <div>
                <span className="text-[10px] font-bold uppercase text-amber-600 font-mono">
                  ENGLISH TEST REMARKS — ATTEMPT 0{popoutRemarks.attempt}
                </span>
                <h3 className="font-bold text-sm text-slate-900">
                  {popoutRemarks.app.full_name} ({popoutRemarks.app.passport_number || 'No PP'})
                </h3>
              </div>
              <button
                onClick={() => setPopoutRemarks(null)}
                className="p-1 text-slate-400 hover:text-slate-700 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase block">Full Remarks / Notes</label>
              <textarea
                rows={5}
                value={popoutRemarks.remarks}
                onChange={(e) => setPopoutRemarks({ ...popoutRemarks, remarks: e.target.value })}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs font-sans text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                placeholder="Type complete remarks regarding spoken test performance, behavior, or scheduling..."
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setPopoutRemarks(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  handleUpdateScheduleField(
                    popoutRemarks.app.applicant_id,
                    popoutRemarks.attempt,
                    'remarks',
                    popoutRemarks.remarks
                  );
                  setPopoutRemarks(null);
                }}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
              >
                Save Remarks
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 4: ATTEMPT SCHEDULE PRINT & PDF PREVIEW MODAL            */}
      {/* ============================================================== */}
      <EnglishSchedulePdfModal
        isOpen={showSchedulePdfModal}
        onClose={() => setShowSchedulePdfModal(false)}
        applicants={eligibleApplicants}
        targetAttempt={activeAttemptTab}
      />
    </div>
  );
};
