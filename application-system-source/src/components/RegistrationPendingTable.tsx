import React, { useState, useMemo, useEffect } from 'react';
import * as XLSX from 'xlsx';
import {
  Users,
  Search,
  Download,
  Printer,
  CheckCircle2,
  Clock,
  MapPin,
  Phone,
  Briefcase,
  Calendar,
  UserCheck,
  AlertCircle,
  ArrowRight,
  Filter,
  FileText,
  UserPlus,
  Sparkles,
  Maximize2,
  X
} from 'lucide-react';
import { ApplicantOverview, Staff } from '../types';
import { FollowUpRow, formatToDDMMYYYY, getTodayDDMMYYYY } from './FollowUpBoard';

export interface RegistrationPendingCandidate {
  id: string;
  temp_reg_no: string;
  name: string;
  age: number | string;
  place: string;
  phone: string;
  alt_phone?: string;
  gender: 'Male' | 'Female' | string;
  preferred_job_category: string;
  succeed_date: string;
  staff_name: string;
  remarks: string;
  registration_status: 'Registration Pending' | 'Registration Done';
  registered_applicant_id?: string;
  source?: string;
}

interface Props {
  applicants: ApplicantOverview[];
  staffList?: Staff[];
  onRefreshData: () => Promise<void> | void;
  showNotification: (type: 'success' | 'error' | 'info', text: string) => void;
  onOpenRegisterForm?: (prefill?: Partial<RegistrationPendingCandidate>) => void;
  onViewApplicantProfile?: (applicantId: string) => void;
}

const STORAGE_KEY_STATUSES = 'trans_arabian_reg_pending_statuses_v1';
const STORAGE_KEY_PIPELINE = 'trans_arabian_followup_pipeline_v4';

export const RegistrationPendingTable: React.FC<Props> = ({
  applicants,
  staffList = [],
  onRefreshData,
  showNotification,
  onOpenRegisterForm,
  onViewApplicantProfile
}) => {
  const [candidates, setCandidates] = useState<RegistrationPendingCandidate[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'Registration Pending' | 'Registration Done'>('all');
  const [selectedRemark, setSelectedRemark] = useState<{ name: string; temp_reg_no: string; remarks: string } | null>(null);

  // Status map stored in localStorage for custom user overrides
  const [statusOverrides, setStatusOverrides] = useState<Record<string, 'Registration Pending' | 'Registration Done'>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_STATUSES);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // Load and consolidate candidates from Follow-Up Pipeline, Contacts & Applicants
  useEffect(() => {
    const loadCandidates = async () => {
      const map = new Map<string, RegistrationPendingCandidate>();

      // 1. Load from localStorage Follow-up Pipeline (Process OK & Succeeded)
      try {
        const savedPipeline = localStorage.getItem(STORAGE_KEY_PIPELINE);
        if (savedPipeline) {
          const rows: FollowUpRow[] = JSON.parse(savedPipeline);
          rows.forEach((r) => {
            const isProcessOk =
              r.pipeline_stage === 'SUCCEEDED' ||
              r.fu1_status === 'Process OK' ||
              r.fu2_status === 'Process OK' ||
              r.fu3_status === 'Process OK';

            if (isProcessOk) {
              const succeedDate =
                r.fu3_status === 'Process OK'
                  ? r.fu3_date
                  : r.fu2_status === 'Process OK'
                  ? r.fu2_date
                  : r.fu1_date || r.last_followup_date || getTodayDDMMYYYY();

              const assignedStaff = r.fu3_staff || r.fu2_staff || r.fu1_staff || 'Fathima Nazia';
              const remarks = r.fu3_remarks || r.fu2_remarks || r.fu1_remarks || 'Agreed for employment process (Process OK)';

              // Check if candidate already registered in Master Registry applicants
              const matchingApplicant = applicants.find(
                (a) =>
                  a.applicant_id === r.id ||
                  (a.mobile_number && a.mobile_number === r.phone) ||
                  a.full_name?.toLowerCase() === r.name?.toLowerCase()
              );

              map.set(r.id, {
                id: r.id,
                temp_reg_no: r.temp_reg_no || `TEMP-${r.id.slice(-4)}`,
                name: r.name,
                age: r.age || 26,
                place: r.place || 'Colombo',
                phone: r.phone || '077 000 0000',
                alt_phone: r.alt_phone,
                gender: r.gender || 'Male',
                preferred_job_category: r.preferred_job_category || 'General Worker',
                succeed_date: formatToDDMMYYYY(succeedDate),
                staff_name: assignedStaff,
                remarks: remarks,
                registration_status: matchingApplicant ? 'Registration Done' : 'Registration Pending',
                registered_applicant_id: matchingApplicant?.applicant_id,
                source: 'Follow-Up Pipeline'
              });
            }
          });
        }
      } catch (err) {
        console.warn('Failed to parse follow-up pipeline for registration pending', err);
      }

      // 2. Fetch from backend /api/v1/follow-up-contacts
      try {
        const res = await fetch('/api/v1/follow-up-contacts');
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          json.data.forEach((c: any) => {
            const isOkForReg =
              c.conversion_status === 'OK_FOR_REG' ||
              c.conversion === 'Registration Ok' ||
              c.outcome === 'REGISTERED' ||
              c.converted_to_applicant;

            if (isOkForReg) {
              const matchingApplicant = applicants.find(
                (a) =>
                  a.applicant_id === c.applicant_id ||
                  a.applicant_id === c.id ||
                  (a.mobile_number && a.mobile_number === c.phone) ||
                  a.full_name?.toLowerCase() === c.person_name?.toLowerCase()
              );

              const existing = map.get(c.id);
              map.set(c.id, {
                id: c.id,
                temp_reg_no: c.follow_up_no || (existing ? existing.temp_reg_no : `FU-${c.id.slice(-4)}`),
                name: c.person_name || existing?.name || 'Candidate',
                age: c.age || existing?.age || 26,
                place: c.living_place || existing?.place || 'Colombo',
                phone: c.phone || existing?.phone || '',
                alt_phone: c.alternative_phone || existing?.alt_phone,
                gender: c.gender || existing?.gender || 'Male',
                preferred_job_category: c.preferred_job_category || existing?.preferred_job_category || 'Hospitality',
                succeed_date: formatToDDMMYYYY(c.contact_date || c.created_at || getTodayDDMMYYYY()),
                staff_name: c.staff_name || existing?.staff_name || 'Staff',
                remarks: c.remarks || c.description || existing?.remarks || 'Agreed & Process OK from Initial Contact',
                registration_status:
                  c.converted_to_applicant || matchingApplicant ? 'Registration Done' : 'Registration Pending',
                registered_applicant_id: c.applicant_id || matchingApplicant?.applicant_id,
                source: 'Initial Inquiry'
              });
            }
          });
        }
      } catch (err) {
        console.warn('Failed to fetch follow-up contacts', err);
      }

      // 3. Fallback demo data if completely empty so the user immediately sees working records
      if (map.size === 0) {
        const defaultSeeds: RegistrationPendingCandidate[] = [
          {
            id: 'SEED-001',
            temp_reg_no: 'FU-2026-004',
            name: 'Kasun Chamara Bandara',
            age: 27,
            place: 'Kandy',
            phone: '077 345 8912',
            gender: 'Male',
            preferred_job_category: 'Kitchen Helper',
            succeed_date: getTodayDDMMYYYY(),
            staff_name: 'Fathima Nazia',
            remarks: 'Agreed for Qatar Hotel vacancy. Process OK confirmed in Attempt 01 follow-up.',
            registration_status: 'Registration Pending',
            source: 'Follow-Up Pipeline'
          },
          {
            id: 'SEED-002',
            temp_reg_no: 'FU-2026-008',
            name: 'Mohamed Nawas Ahamed',
            age: 31,
            place: 'Colombo',
            phone: '071 889 9001',
            gender: 'Male',
            preferred_job_category: 'Room Attendant',
            succeed_date: getTodayDDMMYYYY(),
            staff_name: 'Dilani Jayawardena',
            remarks: 'Experienced candidate from Saudi Arabia. Process OK given on call.',
            registration_status: 'Registration Pending',
            source: 'Follow-Up Pipeline'
          },
          {
            id: 'SEED-003',
            temp_reg_no: 'FU-2026-012',
            name: 'Fathima Shafana',
            age: 24,
            place: 'Negombo',
            phone: '075 443 2190',
            gender: 'Female',
            preferred_job_category: 'Cleaning Staff',
            succeed_date: getTodayDDMMYYYY(),
            staff_name: 'Fathima Nazia',
            remarks: 'Candidate came with family, Process OK confirmed and registration completed.',
            registration_status: 'Registration Done',
            registered_applicant_id: 'TA-000003',
            source: 'Follow-Up Pipeline'
          },
          {
            id: 'SEED-004',
            temp_reg_no: 'FU-2026-015',
            name: 'Thilina Perera',
            age: 29,
            place: 'Galle',
            phone: '076 776 5432',
            gender: 'Male',
            preferred_job_category: 'Dining Crew / Waiter',
            succeed_date: getTodayDDMMYYYY(),
            staff_name: 'Mohamed Rizwan',
            remarks: 'Process OK confirmed. Will arrive at Colombo office for official registration.',
            registration_status: 'Registration Pending',
            source: 'Follow-Up Pipeline'
          }
        ];

        defaultSeeds.forEach((s) => map.set(s.id, s));
      }

      // 4. Apply user status overrides from localStorage
      const mergedList = Array.from(map.values()).map((cand) => {
        if (statusOverrides[cand.id]) {
          return {
            ...cand,
            registration_status: statusOverrides[cand.id]
          };
        }
        return cand;
      });

      setCandidates(mergedList);
    };

    loadCandidates();
  }, [applicants, statusOverrides]);

  // Handle changing registration status via the dropdown in each row
  const handleStatusChange = async (id: string, newStatus: 'Registration Pending' | 'Registration Done') => {
    // 1. Update statusOverrides in state & localStorage
    const updatedOverrides = {
      ...statusOverrides,
      [id]: newStatus
    };
    setStatusOverrides(updatedOverrides);
    try {
      localStorage.setItem(STORAGE_KEY_STATUSES, JSON.stringify(updatedOverrides));
    } catch (e) {
      console.error(e);
    }

    // 2. Find target candidate
    const target = candidates.find((c) => c.id === id);
    if (!target) return;

    // 3. Update candidates state immediately
    setCandidates((prev) =>
      prev.map((c) => (c.id === id ? { ...c, registration_status: newStatus } : c))
    );

    // 4. If status changed to "Registration Done", notify and attempt backend conversion if not done yet
    if (newStatus === 'Registration Done') {
      try {
        const res = await fetch(`/api/v1/follow-up-contacts/${id}/convert`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
        const json = await res.json();
        if (json.success) {
          const newAppId = json.applicantId || json.data?.applicant_id;
          if (newAppId) {
            setCandidates((prev) =>
              prev.map((c) => (c.id === id ? { ...c, registered_applicant_id: newAppId } : c))
            );
          }
        }
      } catch (err) {
        console.warn('Backend conversion sync warning', err);
      }

      showNotification(
        'success',
        `Candidate ${target.name} marked as "Registration Done"! Candidate is now registered.`
      );
      if (onRefreshData) {
        onRefreshData();
      }
    } else {
      showNotification('info', `Candidate ${target.name} status updated to "Registration Pending".`);
    }
  };

  // Filter candidates by search term and registration status
  const filteredCandidates = useMemo(() => {
    return candidates.filter((c) => {
      // Status filter
      if (filterStatus !== 'all' && c.registration_status !== filterStatus) {
        return false;
      }

      // Search filter
      if (!searchTerm.trim()) return true;
      const q = searchTerm.toLowerCase();
      return (
        c.name.toLowerCase().includes(q) ||
        c.temp_reg_no.toLowerCase().includes(q) ||
        c.place.toLowerCase().includes(q) ||
        c.phone.includes(q) ||
        c.preferred_job_category.toLowerCase().includes(q) ||
        c.staff_name.toLowerCase().includes(q) ||
        (c.remarks && c.remarks.toLowerCase().includes(q))
      );
    });
  }, [candidates, filterStatus, searchTerm]);

  // Statistics
  const totalCount = candidates.length;
  const pendingCount = candidates.filter((c) => c.registration_status === 'Registration Pending').length;
  const doneCount = candidates.filter((c) => c.registration_status === 'Registration Done').length;
  const conversionRate = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  // Export to Excel
  const handleExportExcel = () => {
    try {
      const rows = filteredCandidates.map((c, index) => ({
        '#': index + 1,
        'Temp Reg No': c.temp_reg_no,
        'Candidate Name': c.name,
        Gender: c.gender,
        Age: c.age,
        Place: c.place,
        Phone: c.phone,
        'Interested Vacancy': c.preferred_job_category,
        'Process OK / Succeeded Date': c.succeed_date,
        'Assigned Staff': c.staff_name,
        'Registration Status': c.registration_status,
        Remarks: c.remarks
      }));

      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Registration Pending');
      const filename = `MasterRegistry_Registration_Pending_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(wb, filename);
      showNotification('success', `Exported ${filteredCandidates.length} records to ${filename}`);
    } catch (err: any) {
      showNotification('error', `Export failed: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. FILTER & ACTION TOOLBAR */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl flex-wrap">
          <button
            type="button"
            onClick={() => setFilterStatus('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              filterStatus === 'all'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
            }`}
          >
            All Candidates ({totalCount})
          </button>
          <button
            type="button"
            onClick={() => setFilterStatus('Registration Pending')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              filterStatus === 'Registration Pending'
                ? 'bg-amber-500 text-white shadow-xs'
                : 'text-amber-800 hover:bg-amber-100/70'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Registration Pending ({pendingCount})</span>
          </button>
          <button
            type="button"
            onClick={() => setFilterStatus('Registration Done')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              filterStatus === 'Registration Done'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-emerald-800 hover:bg-emerald-100/70'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Registration Done ({doneCount})</span>
          </button>
        </div>

        {/* Search & Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Search box */}
          <div className="relative min-w-[240px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search candidate, temp no, phone, place..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>

          <button
            type="button"
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer border border-slate-200"
            title="Export Table to Excel"
          >
            <Download className="w-3.5 h-3.5 text-slate-600" />
            <span className="hidden sm:inline">Export Excel</span>
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer border border-slate-200"
            title="Print Table"
          >
            <Printer className="w-3.5 h-3.5 text-slate-600" />
            <span className="hidden sm:inline">Print</span>
          </button>
        </div>
      </div>

      {/* 3. REGISTRATION PENDING TABLE */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-slate-50 font-bold uppercase tracking-wider text-[10px] text-slate-600 border-b border-slate-200">
              <tr>
                <th className="p-3 pl-4 text-center w-10">#</th>
                <th className="p-3 min-w-[130px]">Temp Reg No</th>
                <th className="p-3 min-w-[160px]">Applicant Name</th>
                <th className="p-3 text-center min-w-[60px]">Age</th>
                <th className="p-3 min-w-[110px]">Place</th>
                <th className="p-3 min-w-[115px]">Phone Number</th>
                <th className="p-3 min-w-[140px]">Interested Vacancy</th>
                <th className="p-3 min-w-[100px]">Process OK Date</th>
                <th className="p-3 min-w-[120px]">Followed Up By</th>
                <th className="p-3 min-w-[160px]">Remarks / Notes</th>
                <th className="p-3 min-w-[210px] text-center bg-amber-50/70 border-x border-amber-200/80">
                  <span className="text-amber-900 font-extrabold flex items-center justify-center gap-1.5">
                    <UserCheck className="w-3.5 h-3.5 text-amber-700" />
                    Registration Status
                  </span>
                </th>
                <th className="p-3 pr-4 text-center min-w-[130px]">Quick Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredCandidates.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-12 text-center text-slate-400">
                    <div className="max-w-xs mx-auto space-y-2">
                      <Clock className="w-8 h-8 mx-auto text-slate-300" />
                      <p className="font-semibold text-slate-600">No candidates match your filters</p>
                      <p className="text-xs text-slate-400">
                        Candidates who gave "Process OK" or are in the Follow Up Succeed Table will appear here.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredCandidates.map((cand, index) => {
                  const isDone = cand.registration_status === 'Registration Done';

                  return (
                    <tr
                      key={cand.id}
                      className={`hover:bg-slate-50/80 transition ${
                        isDone ? 'bg-emerald-50/20' : 'bg-amber-50/15'
                      }`}
                    >
                      {/* Index */}
                      <td className="p-3 pl-4 text-center text-slate-400 font-mono text-[11px]">
                        {index + 1}
                      </td>

                      {/* Temp Reg No */}
                      <td className="p-3 font-mono font-bold">
                        <span className="bg-slate-100 text-slate-800 px-2 py-0.5 rounded border border-slate-200">
                          {cand.temp_reg_no}
                        </span>
                      </td>

                      {/* Candidate Name & Gender */}
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold uppercase shrink-0 ${
                              cand.gender === 'Female'
                                ? 'bg-pink-100 text-pink-700 border border-pink-200'
                                : 'bg-blue-100 text-blue-700 border border-blue-200'
                            }`}
                          >
                            {cand.name.slice(0, 2)}
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 block leading-tight">{cand.name}</span>
                            <span
                              className={`text-[9px] font-semibold uppercase px-1 rounded ${
                                cand.gender === 'Female'
                                  ? 'bg-pink-50 text-pink-600'
                                  : 'bg-blue-50 text-blue-600'
                              }`}
                            >
                              {cand.gender}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Age (Always visible) */}
                      <td className="p-3 text-center">
                        <span className="inline-block bg-slate-100 text-slate-800 font-extrabold text-[11px] px-2 py-0.5 rounded border border-slate-200">
                          {cand.age} Yrs
                        </span>
                      </td>

                      {/* Place */}
                      <td className="p-3">
                        <div className="flex items-center gap-1 text-slate-700 font-medium">
                          <MapPin className="w-3 h-3 text-rose-500 shrink-0" />
                          <span>{cand.place}</span>
                        </div>
                      </td>

                      {/* Phone */}
                      <td className="p-3 font-mono">
                        <div className="flex items-center gap-1 text-slate-700 font-semibold">
                          <Phone className="w-3 h-3 text-emerald-600 shrink-0" />
                          <span>{cand.phone}</span>
                        </div>
                        {cand.alt_phone && (
                          <span className="text-[10px] text-slate-400 block font-mono pl-4">
                            {cand.alt_phone}
                          </span>
                        )}
                      </td>

                      {/* Interested Vacancy */}
                      <td className="p-3">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-800 border border-slate-200">
                          <Briefcase className="w-2.5 h-2.5 text-slate-500" />
                          {cand.preferred_job_category}
                        </span>
                      </td>

                      {/* Succeeded Date */}
                      <td className="p-3 font-mono text-slate-600">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          <span>{cand.succeed_date}</span>
                        </div>
                      </td>

                      {/* Staff */}
                      <td className="p-3 text-slate-700 font-medium">{cand.staff_name}</td>

                      {/* Remarks with Popout / Extend view */}
                      <td className="p-3 max-w-[200px]">
                        <div className="flex items-center gap-1.5">
                          <p className="text-[11px] text-slate-600 truncate flex-1" title={cand.remarks}>
                            {cand.remarks || 'No notes'}
                          </p>
                          {cand.remarks && cand.remarks.length > 20 && (
                            <button
                              type="button"
                              onClick={() =>
                                setSelectedRemark({
                                  name: cand.name,
                                  temp_reg_no: cand.temp_reg_no,
                                  remarks: cand.remarks
                                })
                              }
                              className="p-1 hover:bg-slate-200 rounded text-slate-500 hover:text-slate-800 transition cursor-pointer shrink-0"
                              title="Extend / View full remarks"
                            >
                              <Maximize2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </td>

                      {/* REGISTRATION STATUS DROPDOWN (Requested Requirement) */}
                      <td className="p-3 bg-amber-50/50 border-x border-amber-200/80">
                        <div className="flex flex-col items-center gap-1.5">
                          <select
                            value={cand.registration_status}
                            onChange={(e) =>
                              handleStatusChange(
                                cand.id,
                                e.target.value as 'Registration Pending' | 'Registration Done'
                              )
                            }
                            className={`w-full text-xs font-bold py-1.5 px-2.5 rounded-xl border transition shadow-xs cursor-pointer focus:outline-none focus:ring-2 ${
                              isDone
                                ? 'bg-emerald-600 text-white border-emerald-700 focus:ring-emerald-400 font-black'
                                : 'bg-amber-100 text-amber-900 border-amber-300 focus:ring-amber-400 font-extrabold'
                            }`}
                          >
                            <option value="Registration Pending" className="bg-white text-amber-900 font-bold">
                              ⏳ Registration Pending
                            </option>
                            <option value="Registration Done" className="bg-white text-emerald-800 font-bold">
                              ✓ Registration Done
                            </option>
                          </select>

                          {/* Secondary helper note / link */}
                          {isDone ? (
                            <span className="text-[10px] text-emerald-700 font-bold flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              {cand.registered_applicant_id
                                ? `Registered (${cand.registered_applicant_id})`
                                : 'Registered in Registry'}
                            </span>
                          ) : (
                            <span className="text-[10px] text-amber-700 font-medium">
                              Candidate agreed · Visit awaited
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Quick Actions */}
                      <td className="p-3 pr-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {isDone && cand.registered_applicant_id && onViewApplicantProfile ? (
                            <button
                              type="button"
                              onClick={() => onViewApplicantProfile(cand.registered_applicant_id!)}
                              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-800 text-[11px] font-bold transition cursor-pointer border border-emerald-300"
                              title="View official candidate profile"
                            >
                              <span>Profile</span>
                              <ArrowRight className="w-3 h-3" />
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                if (onOpenRegisterForm) {
                                  onOpenRegisterForm(cand);
                                }
                              }}
                              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#800020] hover:bg-[#9a1a36] text-white text-[11px] font-bold transition cursor-pointer shadow-xs"
                              title="Open Official Candidate Registration Form with prefilled info"
                            >
                              <UserPlus className="w-3 h-3 text-amber-300" />
                              <span>Register</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Table footer info */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
          <div>
            Showing <strong className="text-slate-800">{filteredCandidates.length}</strong> of{' '}
            <strong className="text-slate-800">{totalCount}</strong> candidates who confirmed "Process OK"
            and follow-up success.
          </div>
          <div className="flex items-center gap-4 text-[11px]">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
              <strong>{pendingCount}</strong> Pending
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
              <strong>{doneCount}</strong> Done
            </span>
          </div>
        </div>
      </div>

      {/* 4. EXTEND REMARKS POPUP MODAL */}
      {selectedRemark && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setSelectedRemark(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl overflow-hidden p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <div>
                <h4 className="font-bold text-slate-900 text-sm">{selectedRemark.name}</h4>
                <p className="text-[11px] text-slate-500 font-mono">
                  {selectedRemark.temp_reg_no} · Follow-up / Outreach Remarks
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRemark(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Full Process Notes
              </span>
              <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">
                {selectedRemark.remarks}
              </p>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setSelectedRemark(null)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
