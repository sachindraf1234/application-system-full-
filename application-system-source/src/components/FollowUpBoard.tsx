import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import {
  PhoneCall,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Search,
  Filter,
  User,
  Calendar,
  MessageSquare,
  Printer,
  Download,
  ChevronRight,
  ShieldAlert,
  ArrowUpRight,
  Check,
  ArrowRight,
  Layers,
  Archive,
  Award,
  BarChart3,
  MapPin,
  TrendingUp,
  UserCheck,
  Sparkles,
  CalendarDays,
  FileText,
  Maximize2,
  Edit3,
  Phone
} from 'lucide-react';
import { ApplicantOverview, Staff, FollowUpContact } from '../types';

// Helper to format date string or Date to DD/MM/YYYY
export const formatToDDMMYYYY = (dateInput?: string | Date): string => {
  if (!dateInput) return '';
  const str = String(dateInput).trim();
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(str)) {
    return str;
  }
  if (str.includes('-')) {
    const parts = str.split('T')[0].split('-');
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        // YYYY-MM-DD -> DD/MM/YYYY
        return `${parts[2].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[0]}`;
      } else if (parts[2].length === 4) {
        // DD-MM-YYYY -> DD/MM/YYYY
        return `${parts[0].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[2]}`;
      }
    }
  }
  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  }
  return str;
};

// Helper to get today's date formatted as DD/MM/YYYY
export const getTodayDDMMYYYY = (): string => {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
};

export interface FollowUpRow {
  id: string; // applicant_id
  temp_reg_no: string;
  name: string;
  age: number | string;
  place: string;
  phone: string;
  alt_phone?: string;
  gender: string;
  preferred_job_category: string;
  registration_date: string;

  // Follow Up 01
  fu1_status: 'Pending' | 'Done' | 'Process OK' | 'Cancelled';
  fu1_date: string; // In DD/MM/YYYY format
  fu1_remarks: string;
  fu1_staff: string;

  // Follow Up 02
  fu2_status: 'Pending' | 'Done' | 'Process OK' | 'Cancelled';
  fu2_date: string; // In DD/MM/YYYY format
  fu2_remarks: string;
  fu2_staff: string;

  // Follow Up 03
  fu3_status: 'Pending' | 'Done' | 'Process OK' | 'Cancelled';
  fu3_date: string; // In DD/MM/YYYY format
  fu3_remarks: string;
  fu3_staff: string;

  // Pipeline Stage: ACTIVE_FOLLOWUP, SUCCEEDED, CLOSED
  pipeline_stage: 'ACTIVE_FOLLOWUP' | 'SUCCEEDED' | 'CLOSED';
  last_followup_date?: string; // In DD/MM/YYYY format
  cancelled_reason?: string;
  audit_info?: string;
}

interface Props {
  applicants: ApplicantOverview[];
  contacts?: FollowUpContact[];
  staffList?: Staff[];
  onLogFollowup?: (app: ApplicantOverview) => void;
  onViewProfile: (id: string) => void;
  onPrintApplicant?: (id: string) => void;
  onReopenApplicant?: (id: string, name: string) => void;
  showNotification: (type: 'success' | 'error' | 'info', text: string) => void;
  onRefreshData?: () => void;
}

export const FollowUpBoard: React.FC<Props> = ({
  applicants,
  contacts = [],
  staffList = [],
  onLogFollowup,
  onViewProfile,
  onPrintApplicant,
  onReopenApplicant,
  showNotification,
  onRefreshData
}) => {
  // Sub-navigation view inside Follow-Up Board:
  // 'active_table': Active Follow-Ups Table (Attempt 1, 2, 3 Table)
  // 'succeed_table': Follow Up Succeed Table
  // 'closed_table': Closed File Table
  // 'summary_table': Pipeline Master Summary Table (filterable by month, range, yearly)
  const [pipelineView, setPipelineView] = useState<'active_table' | 'succeed_table' | 'closed_table' | 'summary_table'>('active_table');

  const [searchTerm, setSearchTerm] = useState('');
  // Attempt filter - default to ATTEMPT_1 (Pending attempts removed completely)
  const [filterAttempt, setFilterAttempt] = useState<'ATTEMPT_1' | 'ATTEMPT_2' | 'ATTEMPT_3' | 'ALL'>('ATTEMPT_1');

  // Default Agency Staff
  const defaultStaff: Staff[] = [
    { staff_id: 'S-01', name: 'Althaf Hussain', telephone: '+94 77 123 4567', role: 'Administrator', active: true },
    { staff_id: 'S-02', name: 'Fathima Nazia', telephone: '+94 77 234 5678', role: 'Registration Staff', active: true },
    { staff_id: 'S-03', name: 'Mohamed Rizwan', telephone: '+94 77 345 6789', role: 'Embassy Staff', active: true },
    { staff_id: 'S-04', name: 'Nusra Fathima', telephone: '+94 77 456 7890', role: 'Departure/Ticket Staff', active: true },
    { staff_id: 'S-05', name: 'Kavinda Perera', telephone: '+94 77 567 8901', role: 'Registration Staff', active: true }
  ];
  const availableStaff = staffList && staffList.length > 0 ? staffList : defaultStaff;

  // Pipeline Rows State (saved locally and synced with applicants)
  const [rows, setRows] = useState<FollowUpRow[]>([]);
  const [selectedContactForm, setSelectedContactForm] = useState<FollowUpRow | null>(null);

  // Remarks Popout modal state to extend remarks on click across all attempts, succeed, and closed tables
  const [remarksPopout, setRemarksPopout] = useState<{
    applicantName: string;
    tempRegNo: string;
    title: string;
    remarks: string;
    isEditable?: boolean;
    rowId?: string;
    fuField?: 'fu1_remarks' | 'fu2_remarks' | 'fu3_remarks' | 'cancelled_reason';
  } | null>(null);

  // Summary Table Filter State
  const [summaryFilterMode, setSummaryFilterMode] = useState<'single_month' | 'month_range' | 'yearly'>('single_month');
  const [summarySelectedMonth, setSummarySelectedMonth] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [summaryStartMonth, setSummaryStartMonth] = useState<string>('2026-01');
  const [summaryEndMonth, setSummaryEndMonth] = useState<string>('2026-12');
  const [summarySelectedYear, setSummarySelectedYear] = useState<string>('2026');
  const [summaryStaffSearch, setSummaryStaffSearch] = useState<string>('');

  // Initialize or re-sync pipeline rows
  useEffect(() => {
    const saved = localStorage.getItem('trans_arabian_followup_pipeline_v4');
    let existingMap: { [id: string]: FollowUpRow } = {};
    if (saved) {
      try {
        const parsed: FollowUpRow[] = JSON.parse(saved);
        parsed.forEach((r) => {
          existingMap[r.id] = r;
        });
      } catch (e) {
        console.error('Failed to parse cached pipeline', e);
      }
    }

    const defaultStaffName = availableStaff[0]?.name || 'Fathima Nazia';
    const todayDDMMYYYY = getTodayDDMMYYYY();

    const newRows: FollowUpRow[] = [];
    const seenIds = new Set<string>();

    // 1. ALL persons pending registration (from Initial Inquiries & Contacts) move into the 3-Strike Retention Protocol
    contacts.forEach((c) => {
      if (c.converted_to_applicant && c.applicant_id) {
        return;
      }
      const rowId = c.id;
      seenIds.add(rowId);

      if (existingMap[rowId]) {
        const r = existingMap[rowId];
        newRows.push(r);
        return;
      }

      const stage = (c as any).conversion_status === 'OK_FOR_REG' ? 'SUCCEEDED' : 'ACTIVE_FOLLOWUP';
      const regDateDDMMYYYY = formatToDDMMYYYY(c.contact_date) || todayDDMMYYYY;
      const assignedStaff = c.staff_name || defaultStaffName;

      newRows.push({
        id: c.id,
        temp_reg_no: c.follow_up_no,
        name: c.person_name,
        age: c.age || 26,
        place: c.living_place || 'Colombo',
        phone: c.phone,
        alt_phone: c.alternative_phone || '',
        gender: c.gender || 'Male',
        preferred_job_category: c.preferred_job_category || 'Kitchen Helper',
        registration_date: regDateDDMMYYYY,

        fu1_status: (stage === 'SUCCEEDED' ? 'Process OK' : 'Pending') as any,
        fu1_date: stage === 'SUCCEEDED' ? regDateDDMMYYYY : '',
        fu1_remarks: c.remarks || c.description || '',
        fu1_staff: assignedStaff,

        fu2_status: (stage === 'SUCCEEDED' ? 'Process OK' : 'Pending') as any,
        fu2_date: '',
        fu2_remarks: '',
        fu2_staff: assignedStaff,

        fu3_status: (stage === 'SUCCEEDED' ? 'Process OK' : 'Pending') as any,
        fu3_date: '',
        fu3_remarks: '',
        fu3_staff: assignedStaff,

        pipeline_stage: stage,
        last_followup_date: regDateDDMMYYYY,
        cancelled_reason: '',
        audit_info: ''
      });
    });

    // 2. Also populate existing registered/follow-up applicants
    applicants.forEach((app) => {
      if (seenIds.has(app.applicant_id)) return;
      seenIds.add(app.applicant_id);

      if (existingMap[app.applicant_id]) {
        const r = existingMap[app.applicant_id];
        // If external status changed to RED_CLOSED, align
        if (app.current_status === 'RED_CLOSED' && r.pipeline_stage !== 'CLOSED') {
          newRows.push({
            ...r,
            pipeline_stage: 'CLOSED',
            cancelled_reason: app.closed_reason || r.cancelled_reason || 'Marked Red Closed'
          });
        } else {
          newRows.push(r);
        }
        return;
      }

      let stage: 'ACTIVE_FOLLOWUP' | 'SUCCEEDED' | 'CLOSED' = 'ACTIVE_FOLLOWUP';
      if (app.current_status === 'RED_CLOSED') stage = 'CLOSED';
      else if (app.current_status === 'GREEN_REGISTERED' && (app as any).registration_source?.includes('FOLLOW_UP')) {
        stage = 'SUCCEEDED';
      }

      const assignedStaff = app.staff_name && app.staff_name !== 'Unassigned' ? app.staff_name : defaultStaffName;
      const regDateDDMMYYYY = formatToDDMMYYYY(app.registration_date) || todayDDMMYYYY;

      // Default follow-up status is strictly 'Pending' for new active outreach
      newRows.push({
        id: app.applicant_id,
        temp_reg_no: app.registration_number || app.applicant_id,
        name: app.full_name,
        age: app.age || 26,
        place: app.living_place || 'Colombo',
        phone: app.mobile_number,
        alt_phone: app.alternate_phone || app.telephone_home || '',
        gender: app.gender || 'Male',
        preferred_job_category: app.preferred_job_category || 'Kitchen Helper',
        registration_date: regDateDDMMYYYY,

        fu1_status: (stage === 'CLOSED' ? 'Cancelled' : stage === 'SUCCEEDED' ? 'Process OK' : 'Pending') as 'Pending' | 'Done' | 'Process OK' | 'Cancelled',
        fu1_date: stage === 'CLOSED' || stage === 'SUCCEEDED' ? regDateDDMMYYYY : '',
        fu1_remarks: '',
        fu1_staff: assignedStaff,

        fu2_status: (stage === 'CLOSED' ? 'Cancelled' : stage === 'SUCCEEDED' ? 'Process OK' : 'Pending') as 'Pending' | 'Done' | 'Process OK' | 'Cancelled',
        fu2_date: '',
        fu2_remarks: '',
        fu2_staff: assignedStaff,

        fu3_status: (stage === 'CLOSED' ? 'Cancelled' : stage === 'SUCCEEDED' ? 'Process OK' : 'Pending') as 'Pending' | 'Done' | 'Process OK' | 'Cancelled',
        fu3_date: '',
        fu3_remarks: '',
        fu3_staff: assignedStaff,

        pipeline_stage: stage,
        last_followup_date: todayDDMMYYYY,
        cancelled_reason: app.closed_reason || (stage === 'CLOSED' ? 'Candidate did not face follow-up' : ''),
        audit_info: stage === 'CLOSED' ? `Closed by Staff on ${todayDDMMYYYY}` : ''
      });
    });

    setRows(newRows);
  }, [applicants, contacts]);

  // Persist row updates to localStorage
  const saveRows = (updated: FollowUpRow[]) => {
    setRows(updated);
    try {
      localStorage.setItem('trans_arabian_followup_pipeline_v4', JSON.stringify(updated));
    } catch (e) {
      console.error(e);
    }
  };

  // Update a field in a specific row
  const handleUpdateRow = (id: string, updates: Partial<FollowUpRow>) => {
    const updated = rows.map((r) => {
      if (r.id === id) {
        return { ...r, ...updates };
      }
      return r;
    });
    saveRows(updated);
  };

  // Automatically set date in DD/MM/YYYY format when choosing a status for follow-up 01, 02, or 03
  // Follows exact user rules:
  // - Done in Attempt 01 moves to Attempt 02
  // - Done in Attempt 02 moves to Attempt 03
  // - Process OK automatically moves to Follow Up Succeed Table & Master Registry's Registration Pending Table
  // - Cancelled automatically moves to Closed File Table only
  const handleStatusChange = async (
    id: string,
    fuKey: 'fu1' | 'fu2' | 'fu3',
    newStatus: 'Pending' | 'Done' | 'Process OK' | 'Cancelled'
  ) => {
    const todayDDMMYYYY = getTodayDDMMYYYY();
    const target = rows.find((r) => r.id === id);
    if (!target) return;

    const dateKey = `${fuKey}_date` as keyof FollowUpRow;
    const existingDate = target[dateKey] as string;
    const assignedDate = existingDate && existingDate.trim() !== '' ? formatToDDMMYYYY(existingDate) : todayDDMMYYYY;

    // 1. Process OK: Automatically move to Follow Up Succeed Table AND Master Registry's Registration Pending Table!
    if (newStatus === 'Process OK') {
      const updatedRow: FollowUpRow = {
        ...target,
        [`${fuKey}_status`]: 'Process OK',
        [dateKey]: assignedDate,
        last_followup_date: assignedDate,
        pipeline_stage: 'SUCCEEDED'
      };
      await handleSendToSucceedTable(updatedRow);
      return;
    }

    // 2. Cancelled: Automatically move ONLY to Closed File Table!
    if (newStatus === 'Cancelled') {
      const updatedRow: FollowUpRow = {
        ...target,
        [`${fuKey}_status`]: 'Cancelled',
        [dateKey]: assignedDate,
        last_followup_date: assignedDate,
        pipeline_stage: 'CLOSED',
        cancelled_reason: target.fu3_remarks || target.fu2_remarks || target.fu1_remarks || 'Candidate Cancelled'
      };
      await handleSendToClosedFile(updatedRow);
      return;
    }

    // 3. In Attempt 01, when choosing "Done" -> automatically move to Attempt 02
    if (fuKey === 'fu1' && newStatus === 'Done') {
      const updates: Partial<FollowUpRow> = {
        fu1_status: 'Done',
        fu1_date: assignedDate,
        fu2_status: target.fu2_status === 'Process OK' || target.fu2_status === 'Cancelled' ? target.fu2_status : 'Pending',
        last_followup_date: assignedDate
      };
      handleUpdateRow(id, updates);
      showNotification('info', `Attempt 01 marked Done. Candidate ${target.name} moved to Attempt 02!`);
      return;
    }

    // 4. In Attempt 02, when choosing "Done" -> automatically move to Attempt 03
    if (fuKey === 'fu2' && newStatus === 'Done') {
      const updates: Partial<FollowUpRow> = {
        fu2_status: 'Done',
        fu2_date: assignedDate,
        fu3_status: target.fu3_status === 'Process OK' || target.fu3_status === 'Cancelled' ? target.fu3_status : 'Pending',
        last_followup_date: assignedDate
      };
      handleUpdateRow(id, updates);
      showNotification('info', `Attempt 02 marked Done. Candidate ${target.name} moved to Attempt 03!`);
      return;
    }

    const updates: Partial<FollowUpRow> = {
      [`${fuKey}_status`]: newStatus,
      [dateKey]: assignedDate,
      last_followup_date: assignedDate
    };

    handleUpdateRow(id, updates);
    showNotification('info', `Updated ${fuKey.toUpperCase()} status to "${newStatus}". Follow-up date set to ${assignedDate}.`);
  };

  // Move candidate to Closed File Table
  const handleSendToClosedFile = async (row: FollowUpRow) => {
    const todayDDMMYYYY = getTodayDDMMYYYY();
    const reason =
      row.fu3_remarks ||
      row.fu2_remarks ||
      row.fu1_remarks ||
      row.cancelled_reason ||
      'Candidate Cancelled / Refused to Proceed with Employment';
    const auditText = `Closed by ${row.fu3_staff || row.fu2_staff || row.fu1_staff || 'Staff'} on ${todayDDMMYYYY} at ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

    try {
      // Notify backend
      await fetch(`/api/applicants/${row.id}/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason,
          remarks: reason,
          staff_name: row.fu3_staff || row.fu1_staff
        })
      });
    } catch (e) {
      console.warn('Backend close warning', e);
    }

    const updated = rows.map((r) => {
      if (r.id === row.id) {
        return {
          ...r,
          pipeline_stage: 'CLOSED' as const,
          fu1_status: r.fu1_status === 'Pending' ? 'Cancelled' : r.fu1_status,
          fu2_status: r.fu2_status === 'Pending' ? 'Cancelled' : r.fu2_status,
          fu3_status: r.fu3_status === 'Pending' ? 'Cancelled' : r.fu3_status,
          last_followup_date: todayDDMMYYYY,
          cancelled_reason: reason,
          audit_info: auditText
        };
      }
      return r;
    });

    saveRows(updated);
    showNotification('error', `Applicant ${row.name} (${row.temp_reg_no}) moved to Closed File Table.`);
    if (onRefreshData) onRefreshData();
  };

  // Move candidate to Follow Up Succeed Table & Master Registry Registration Pending Table
  const handleSendToSucceedTable = async (row: FollowUpRow) => {
    const todayDDMMYYYY = getTodayDDMMYYYY();

    try {
      await fetch(`/api/applicants/${row.id}/succeed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staff_name: row.fu3_staff || row.fu1_staff
        })
      });
    } catch (e) {
      console.warn('Backend succeed warning', e);
    }

    try {
      // Update follow-up contact status to OK_FOR_REG
      await fetch(`/api/v1/follow-up-contacts/${row.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversion_status: 'OK_FOR_REG',
          outcome: 'REGISTERED'
        })
      });
    } catch (e) {
      console.warn('Backend contact patch warning', e);
    }

    try {
      // Also automatically move to Master Registry's Registration Pending Table
      await fetch(`/api/v1/follow-up-contacts/${row.id}/convert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (e) {
      console.warn('Backend contact auto-registration warning', e);
    }

    const updated = rows.map((r) => {
      if (r.id === row.id) {
        return {
          ...r,
          pipeline_stage: 'SUCCEEDED' as const,
          fu1_status: r.fu1_status === 'Pending' ? 'Process OK' : r.fu1_status,
          fu2_status: r.fu2_status === 'Pending' ? 'Process OK' : r.fu2_status,
          fu3_status: r.fu3_status === 'Pending' ? 'Process OK' : r.fu3_status,
          last_followup_date: todayDDMMYYYY
        };
      }
      return r;
    });

    saveRows(updated);
    showNotification(
      'success',
      `Applicant ${row.name} (${row.temp_reg_no}) confirmed Process OK! Automatically moved to Follow Up Succeed Table and Master Registry's Registration Pending Table.`
    );
    if (onRefreshData) onRefreshData();
  };

  // Convert / Register candidate directly from Follow Up Succeed Table
  const handleOkForRegistration = async (row: FollowUpRow) => {
    try {
      const res = await fetch(`/api/v1/follow-up-contacts/${row.id}/convert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const json = await res.json();
      if (json.success) {
        showNotification(
          'success',
          `Successfully registered ${row.name}! Converted to formal registration profile (ID: ${json.applicantId || json.data?.applicant_id})`
        );
        if (onRefreshData) onRefreshData();
        return;
      }
    } catch (e) {
      console.warn('Direct contact conversion warning', e);
    }

    showNotification('success', `Candidate ${row.name} (${row.temp_reg_no}) confirmed OK for Registration.`);
    if (onRefreshData) onRefreshData();
  };

  // Reopen applicant from Closed File back to Active Follow-Ups Table
  const handleReopenFile = async (row: FollowUpRow) => {
    try {
      await fetch(`/api/applicants/${row.id}/reopen`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (e) {
      console.warn('Backend reopen warning', e);
    }

    const updated = rows.map((r) => {
      if (r.id === row.id) {
        return {
          ...r,
          pipeline_stage: 'ACTIVE_FOLLOWUP' as const,
          fu1_status: 'Pending' as const,
          fu2_status: 'Pending' as const,
          fu3_status: 'Pending' as const,
          cancelled_reason: ''
        };
      }
      return r;
    });

    saveRows(updated);
    showNotification('info', `File ${row.name} (${row.temp_reg_no}) reopened back to Active Follow-Ups Table.`);
    if (onRefreshData) onRefreshData();
  };

  // Filter candidates by search
  const matchesSearch = (r: FollowUpRow) => {
    if (!searchTerm) return true;
    const q = searchTerm.toLowerCase();
    return (
      r.name.toLowerCase().includes(q) ||
      r.temp_reg_no.toLowerCase().includes(q) ||
      r.phone.includes(q) ||
      (r.alt_phone && r.alt_phone.includes(q)) ||
      r.place.toLowerCase().includes(q) ||
      r.preferred_job_category.toLowerCase().includes(q) ||
      r.fu1_staff.toLowerCase().includes(q) ||
      r.fu2_staff.toLowerCase().includes(q) ||
      r.fu3_staff.toLowerCase().includes(q)
    );
  };

  // Active Follow-Ups
  const activeFollowUps = rows.filter((r) => r.pipeline_stage === 'ACTIVE_FOLLOWUP' && matchesSearch(r));

  // Partition active followups by attempts for metrics and filtering
  const attempt1List = rows.filter(
    (r) =>
      r.pipeline_stage === 'ACTIVE_FOLLOWUP' &&
      r.fu1_status === 'Pending'
  );
  const attempt2List = rows.filter(
    (r) =>
      r.pipeline_stage === 'ACTIVE_FOLLOWUP' &&
      r.fu1_status !== 'Pending' &&
      r.fu2_status === 'Pending'
  );
  const attempt3List = rows.filter(
    (r) =>
      r.pipeline_stage === 'ACTIVE_FOLLOWUP' &&
      r.fu2_status !== 'Pending' &&
      r.fu3_status === 'Pending'
  );

  // Succeeded Table
  const succeedList = rows.filter((r) => r.pipeline_stage === 'SUCCEEDED' && matchesSearch(r));

  // Closed File Table
  const closedList = rows.filter((r) => r.pipeline_stage === 'CLOSED' && matchesSearch(r));

  // Filter active table according to selected filter button (Attempt 1, 2, 3 or All)
  const displayActiveFollowUps = activeFollowUps.filter((r) => {
    if (filterAttempt === 'ATTEMPT_1') {
      return r.fu1_status === 'Pending';
    }
    if (filterAttempt === 'ATTEMPT_2') {
      return r.fu1_status !== 'Pending' && r.fu2_status === 'Pending';
    }
    if (filterAttempt === 'ATTEMPT_3') {
      return r.fu2_status !== 'Pending' && r.fu3_status === 'Pending';
    }
    return true;
  });

  // Calculate Cross-Pipeline Summary Table Data
  const calculateMasterSummary = () => {
    const inRange = rows.filter((r) => {
      const dt = r.last_followup_date || r.registration_date || getTodayDDMMYYYY();
      // Handle both DD/MM/YYYY and YYYY-MM-DD for summary grouping
      let ym = '2026-01';
      let yr = '2026';
      if (dt.includes('/')) {
        const parts = dt.split('/');
        if (parts.length === 3) {
          ym = `${parts[2]}-${parts[1]}`;
          yr = parts[2];
        }
      } else if (dt.includes('-')) {
        ym = dt.slice(0, 7);
        yr = dt.slice(0, 4);
      }

      if (summaryFilterMode === 'single_month') {
        return ym === summarySelectedMonth;
      }
      if (summaryFilterMode === 'month_range') {
        return ym >= summaryStartMonth && ym <= summaryEndMonth;
      }
      if (summaryFilterMode === 'yearly') {
        return yr === summarySelectedYear;
      }
      return true;
    });

    const totalActive = inRange.filter((r) => r.pipeline_stage === 'ACTIVE_FOLLOWUP').length;
    const totalSucceeded = inRange.filter((r) => r.pipeline_stage === 'SUCCEEDED').length;
    const totalClosed = inRange.filter((r) => r.pipeline_stage === 'CLOSED').length;
    const grandTotal = inRange.length;

    // By Staff
    const staffMap: {
      [staff: string]: {
        active: number;
        succeeded: number;
        closed: number;
        total: number;
      };
    } = {};

    inRange.forEach((r) => {
      const st = r.fu3_staff || r.fu2_staff || r.fu1_staff || 'Fathima Nazia';
      if (!staffMap[st]) {
        staffMap[st] = { active: 0, succeeded: 0, closed: 0, total: 0 };
      }
      staffMap[st].total += 1;
      if (r.pipeline_stage === 'ACTIVE_FOLLOWUP') staffMap[st].active += 1;
      else if (r.pipeline_stage === 'SUCCEEDED') staffMap[st].succeeded += 1;
      else if (r.pipeline_stage === 'CLOSED') staffMap[st].closed += 1;
    });

    const attempt1Count = inRange.filter((r) => r.pipeline_stage === 'ACTIVE_FOLLOWUP' && r.fu1_status === 'Pending').length;
    const attempt2Count = inRange.filter((r) => r.pipeline_stage === 'ACTIVE_FOLLOWUP' && r.fu1_status === 'Done' && r.fu2_status === 'Pending').length;
    const attempt3Count = inRange.filter((r) => r.pipeline_stage === 'ACTIVE_FOLLOWUP' && r.fu2_status === 'Done' && r.fu3_status === 'Pending').length;

    return {
      inRange,
      totalActive,
      totalSucceeded,
      totalClosed,
      grandTotal,
      staffMap,
      attempt1Count,
      attempt2Count,
      attempt3Count
    };
  };

  const masterSummary = calculateMasterSummary();

  return (
    <div className="space-y-6">
      {/* 1. TOP HEADER & TOTAL NUMBERS VIEW */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-6 border border-slate-700/80 shadow-md">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div className="space-y-1.5 max-w-2xl">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-400 bg-emerald-950/80 border border-emerald-800/80 px-2 py-0.5 rounded">
                OFFICIAL RETENTION PIPELINE
              </span>
              <span className="text-xs text-slate-300">Strict 3-Attempt Candidate Outreach Protocol</span>
            </div>
            <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              <Layers className="w-5 h-5 text-indigo-400" />
              <span>Candidate Follow-ups & Retention Pipeline</span>
            </h2>
            <p className="text-xs text-slate-300 leading-relaxed">
              Track pending outreach attempts systematically. Selecting <strong>Done</strong> logs the attempt without closing. Selecting <strong>Process OK</strong> confirms candidate interest and triggers <em>"Send to Follow Up Succeed Table"</em>. Selecting <strong>Cancelled</strong> triggers <em>"Send to Closed File Table"</em>. All dates auto-populate in <code>DD/MM/YYYY</code> format.
            </p>
          </div>

          {/* TOTAL NUMBERS VIEW METRIC BADGES - Hidden in Retention Pipeline Master Summary view (Item 08) */}
          {pipelineView !== 'summary_table' && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 w-full lg:w-auto">
              {/* Attempt 01 */}
              <div className="bg-slate-800/90 border border-blue-500/40 rounded-xl px-3.5 py-2 text-center shadow-xs">
                <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider block">Attempt 01</span>
                <span className="text-xl font-mono font-black text-blue-300 tabular-nums">{attempt1List.length}</span>
              </div>

              {/* Attempt 02 */}
              <div className="bg-slate-800/90 border border-amber-500/40 rounded-xl px-3.5 py-2 text-center shadow-xs">
                <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider block">Attempt 02</span>
                <span className="text-xl font-mono font-black text-amber-300 tabular-nums">{attempt2List.length}</span>
              </div>

              {/* Attempt 03 */}
              <div className="bg-slate-800/90 border border-purple-500/40 rounded-xl px-3.5 py-2 text-center shadow-xs">
                <span className="text-[10px] font-bold text-purple-400 uppercase tracking-wider block">Attempt 03</span>
                <span className="text-xl font-mono font-black text-purple-300 tabular-nums">{attempt3List.length}</span>
              </div>

              {/* Red Closed */}
              <div className="bg-slate-800/90 border border-rose-500/50 rounded-xl px-3.5 py-2 text-center shadow-xs">
                <span className="text-[10px] font-bold text-rose-400 uppercase tracking-wider block">Red Closed</span>
                <span className="text-xl font-mono font-black text-rose-300 tabular-nums">{closedList.length}</span>
              </div>
            </div>
          )}
        </div>

        {/* Global Search inside Banner */}
        <div className="mt-4 pt-4 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search Reg No, Name, Age, Phone, Staff..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-800/90 border border-slate-700 text-slate-200 placeholder-slate-400 pl-8 pr-3 py-1.5 text-xs rounded-xl focus:outline-none focus:border-indigo-400 transition"
            />
          </div>
          <div className="text-xs text-slate-400 flex items-center gap-3">
            <span>Succeeded Candidates: <strong className="text-emerald-400 font-mono">{succeedList.length}</strong></span>
            <span>Closed Files: <strong className="text-rose-400 font-mono">{closedList.length}</strong></span>
          </div>
        </div>
      </div>

      {/* 2. SUB-VIEW TABS (ACTIVE TABLE, SUCCEED TABLE, CLOSED FILE TABLE, SUMMARY TABLE) */}
      <div className="flex items-center gap-2 p-1.5 bg-slate-100 rounded-xl w-full sm:w-fit border border-slate-200 flex-wrap">
        {/* Active Follow-Ups Table Tab */}
        <button
          onClick={() => setPipelineView('active_table')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            pipelineView === 'active_table'
              ? 'bg-white text-indigo-950 shadow-xs ring-1 ring-slate-200'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Clock className="w-4 h-4 text-indigo-600" />
          <span>Active Follow-Ups Table</span>
          <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-800 font-bold border border-indigo-200">
            {activeFollowUps.length}
          </span>
        </button>

        {/* Follow Up Succeed Table Tab */}
        <button
          onClick={() => setPipelineView('succeed_table')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            pipelineView === 'succeed_table'
              ? 'bg-white text-emerald-950 shadow-xs ring-1 ring-slate-200'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Award className="w-4 h-4 text-emerald-600" />
          <span>Follow Up Succeed Table</span>
          <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 font-bold border border-emerald-200">
            {succeedList.length}
          </span>
        </button>

        {/* Closed File Table Tab */}
        <button
          onClick={() => setPipelineView('closed_table')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            pipelineView === 'closed_table'
              ? 'bg-white text-rose-950 shadow-xs ring-1 ring-slate-200'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Archive className="w-4 h-4 text-rose-600" />
          <span>Closed File Table</span>
          <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-rose-50 text-rose-800 font-bold border border-rose-200">
            {closedList.length}
          </span>
        </button>

        {/* Master Summary Table Tab */}
        <button
          onClick={() => setPipelineView('summary_table')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            pipelineView === 'summary_table'
              ? 'bg-white text-purple-950 shadow-xs ring-1 ring-slate-200'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <BarChart3 className="w-4 h-4 text-purple-600" />
          <span>Pipeline Master Summary Table</span>
        </button>
      </div>

      {/* ======================================================== */}
      {/* 3. VIEW 1: ACTIVE FOLLOW-UPS TABLE (ATTEMPT 1, 2, 3) */}
      {/* ======================================================== */}
      {pipelineView === 'active_table' && (
        <div className="space-y-4">
          {/* Attempt Filter Bar - Attempt 01, 02, 03 and All Active */}
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl flex-wrap">
              <button
                onClick={() => setFilterAttempt('ATTEMPT_1')}
                className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                  filterAttempt === 'ATTEMPT_1' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-700 hover:text-slate-900'
                }`}
              >
                <span>Attempt 01 ({attempt1List.length})</span>
              </button>
              <button
                onClick={() => setFilterAttempt('ATTEMPT_2')}
                className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                  filterAttempt === 'ATTEMPT_2' ? 'bg-amber-600 text-white shadow-xs' : 'text-slate-700 hover:text-slate-900'
                }`}
              >
                <span>Attempt 02 ({attempt2List.length})</span>
              </button>
              <button
                onClick={() => setFilterAttempt('ATTEMPT_3')}
                className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                  filterAttempt === 'ATTEMPT_3' ? 'bg-purple-600 text-white shadow-xs' : 'text-slate-700 hover:text-slate-900'
                }`}
              >
                <span>Attempt 03 ({attempt3List.length})</span>
              </button>
              <button
                onClick={() => setFilterAttempt('ALL')}
                className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                  filterAttempt === 'ALL' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-700 hover:text-slate-900'
                }`}
              >
                <span>All Active ({activeFollowUps.length})</span>
              </button>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => window.print()}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer active:scale-95"
                title="Print or Download all attempts as PDF"
              >
                <Printer className="w-3.5 h-3.5 text-slate-300" />
                <span>Print / Download PDF</span>
              </button>

              <div className="text-xs text-slate-500 font-medium hidden lg:block">
                Selecting <strong className="text-emerald-700">"Process OK"</strong> moves to Succeed & Master Registry. Selecting <strong className="text-slate-700">"Done"</strong> advances attempt.
              </div>
            </div>
          </div>

          {/* ACTIVE FOLLOW-UPS UNIFIED TABLE */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse min-w-[1550px]">
                <thead className="bg-slate-50 font-bold uppercase tracking-wider text-[10px] text-slate-600 border-b border-slate-200">
                  <tr>
                    {/* Candidate Info */}
                    <th className="p-3 pl-4 bg-slate-100 border-r border-slate-200 min-w-[170px]">
                      Applicant Temporary Reg No
                    </th>
                    <th className="p-3 bg-slate-100 border-r border-slate-200 min-w-[180px]">
                      Applicant Name
                    </th>
                    <th className="p-3 text-center bg-slate-100 border-r border-slate-200 min-w-[75px]">
                      Age
                    </th>
                    <th className="p-3 text-left bg-slate-100 border-r border-slate-200 min-w-[130px]">
                      Place
                    </th>

                    {/* FOLLOW UP 01 COLUMNS */}
                    <th className="p-3 text-center bg-blue-50/70 text-blue-900 border-r border-slate-200">
                      Follow Up 01
                    </th>
                    <th className="p-3 bg-blue-50/70 text-blue-900 border-r border-slate-200 min-w-[140px]">
                      Followed Up Date (DD/MM/YYYY)
                    </th>
                    <th className="p-3 bg-blue-50/70 text-blue-900 border-r border-slate-200 min-w-[160px]">
                      Remarks (FU 01)
                    </th>
                    <th className="p-3 bg-blue-50/70 text-blue-900 border-r border-blue-200 min-w-[170px]">
                      Employee Who Follow Up
                    </th>

                    {/* FOLLOW UP 02 COLUMNS */}
                    <th className="p-3 text-center bg-amber-50/70 text-amber-900 border-r border-slate-200">
                      Follow Up 02
                    </th>
                    <th className="p-3 bg-amber-50/70 text-amber-900 border-r border-slate-200 min-w-[140px]">
                      Followed Up Date (DD/MM/YYYY)
                    </th>
                    <th className="p-3 bg-amber-50/70 text-amber-900 border-r border-slate-200 min-w-[160px]">
                      Remarks (FU 02)
                    </th>
                    <th className="p-3 bg-amber-50/70 text-amber-900 border-r border-amber-200 min-w-[170px]">
                      Employee Who Follow Up
                    </th>

                    {/* FOLLOW UP 03 COLUMNS */}
                    <th className="p-3 text-center bg-purple-50/70 text-purple-900 border-r border-slate-200">
                      Follow Up 03
                    </th>
                    <th className="p-3 bg-purple-50/70 text-purple-900 border-r border-slate-200 min-w-[140px]">
                      Followed Up Date (DD/MM/YYYY)
                    </th>
                    <th className="p-3 bg-purple-50/70 text-purple-900 border-r border-slate-200 min-w-[160px]">
                      Remarks (FU 03)
                    </th>
                    <th className="p-3 bg-purple-50/70 text-purple-900 border-r border-purple-200 min-w-[170px]">
                      Employee Who Follow Up
                    </th>

                    {/* ACTION COLUMN */}
                    <th className="p-3 pr-4 text-center bg-slate-100 min-w-[170px]">
                      Action
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100 font-sans">
                  {displayActiveFollowUps.length === 0 ? (
                    <tr>
                      <td colSpan={17} className="p-12 text-center text-slate-400">
                        No candidate outreach records found for this attempt.
                      </td>
                    </tr>
                  ) : (
                    displayActiveFollowUps.map((r) => {
                      const hasCancelled =
                        r.fu1_status === 'Cancelled' ||
                        r.fu2_status === 'Cancelled' ||
                        r.fu3_status === 'Cancelled';

                      // STRICT RULE: Selecting "Done" does NOT trigger succeed button.
                      // ONLY selecting "Process OK" triggers "Send to Follow Up Succeed Table"!
                      const hasProcessOk =
                        r.fu1_status === 'Process OK' ||
                        r.fu2_status === 'Process OK' ||
                        r.fu3_status === 'Process OK';

                      return (
                        <tr key={r.id} className="hover:bg-slate-50/90 transition group">
                          {/* Temporary Reg number */}
                          <td className="p-3 pl-4 bg-white group-hover:bg-slate-50 font-mono font-bold text-slate-900 whitespace-nowrap border-r border-slate-200">
                            <span>{r.temp_reg_no}</span>
                            <span className="block text-[10px] text-slate-400 font-normal">{formatToDDMMYYYY(r.registration_date)}</span>
                          </td>

                          {/* Applicant Name */}
                          <td className="p-3 bg-white group-hover:bg-slate-50 whitespace-nowrap border-r border-slate-200">
                            <span className="font-bold text-slate-900 block text-xs">{r.name}</span>
                            <span className="text-[11px] text-slate-500 font-mono flex items-center gap-1 mt-0.5">
                              <Phone className="w-3 h-3 text-slate-400" />
                              {r.phone}
                            </span>
                          </td>

                          {/* Applicant Age - clearly visible in all attempts */}
                          <td className="p-3 text-center border-r border-slate-200 whitespace-nowrap">
                            <span className="font-bold text-indigo-800 bg-indigo-50 border border-indigo-200 px-2.5 py-1 rounded-md text-xs inline-block shadow-xs">
                              {r.age || 26} Yrs
                            </span>
                          </td>

                          {/* Place - Separate column right next to age */}
                          <td className="p-3 text-left border-r border-slate-200 whitespace-nowrap">
                            <span className="text-slate-800 font-bold flex items-center gap-1.5 text-xs">
                              <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              {r.place || 'Not specified'}
                            </span>
                          </td>

                          {/* ================= FU 01 ================= */}
                          {/* Status */}
                          <td className="p-3 text-center border-r border-slate-200 bg-blue-50/30 whitespace-nowrap">
                            <select
                              value={r.fu1_status || 'Pending'}
                              onChange={(e) => handleStatusChange(r.id, 'fu1', e.target.value as any)}
                              className={`px-2.5 py-1 text-xs font-bold rounded-lg border cursor-pointer focus:outline-none ${
                                r.fu1_status === 'Process OK'
                                  ? 'bg-emerald-100 text-emerald-900 border-emerald-400 ring-1 ring-emerald-300'
                                  : r.fu1_status === 'Done'
                                  ? 'bg-blue-100 text-blue-800 border-blue-300'
                                  : r.fu1_status === 'Cancelled'
                                  ? 'bg-rose-100 text-rose-800 border-rose-300'
                                  : 'bg-white text-slate-700 border-slate-300'
                              }`}
                            >
                              <option value="Pending">Pending</option>
                              <option value="Done">Done</option>
                              <option value="Process OK">Process OK</option>
                              <option value="Cancelled">Cancelled</option>
                            </select>
                          </td>

                          {/* Followed up date (DD/MM/YYYY) */}
                          <td className="p-3 border-r border-slate-200 bg-blue-50/30 whitespace-nowrap">
                            <div className="flex items-center gap-1">
                              <input
                                type="text"
                                placeholder="DD/MM/YYYY"
                                value={formatToDDMMYYYY(r.fu1_date)}
                                onChange={(e) => handleUpdateRow(r.id, { fu1_date: e.target.value, last_followup_date: e.target.value })}
                                className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-mono font-bold text-slate-800 w-28 focus:outline-none focus:border-blue-500 text-center"
                              />
                              <button
                                type="button"
                                onClick={() => handleUpdateRow(r.id, { fu1_date: getTodayDDMMYYYY(), last_followup_date: getTodayDDMMYYYY() })}
                                className="text-[10px] text-blue-600 hover:text-blue-800 px-1.5 py-0.5 rounded bg-blue-50 border border-blue-200 cursor-pointer"
                                title="Set date to Today (DD/MM/YYYY)"
                              >
                                Today
                              </button>
                            </div>
                          </td>

                          {/* Remarks */}
                          <td className="p-3 border-r border-slate-200 bg-blue-50/30">
                            <div className="flex items-center gap-1">
                              <input
                                type="text"
                                placeholder="Remarks (e.g. Call connected, discussed salary)..."
                                value={r.fu1_remarks}
                                onChange={(e) => handleUpdateRow(r.id, { fu1_remarks: e.target.value })}
                                className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-800 w-full focus:outline-none focus:border-blue-500"
                              />
                              <button
                                type="button"
                                onClick={() => setRemarksPopout({
                                  applicantName: r.name,
                                  tempRegNo: r.temp_reg_no,
                                  title: 'Follow Up 01 Remarks',
                                  remarks: r.fu1_remarks || '',
                                  isEditable: true,
                                  rowId: r.id,
                                  fuField: 'fu1_remarks'
                                })}
                                className="p-1 rounded-md bg-blue-100 hover:bg-blue-200 text-blue-800 cursor-pointer shrink-0 transition"
                                title="Click to extend / pop out full remarks"
                              >
                                <Maximize2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>

                          {/* Employee Dropdown */}
                          <td className="p-3 border-r border-blue-200 bg-blue-50/30 whitespace-nowrap">
                            <select
                              value={r.fu1_staff || availableStaff[0]?.name}
                              onChange={(e) => handleUpdateRow(r.id, { fu1_staff: e.target.value })}
                              className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-800 cursor-pointer focus:outline-none focus:border-blue-500"
                            >
                              {availableStaff.map((s) => (
                                <option key={s.staff_id} value={s.name}>
                                  {s.name}
                                </option>
                              ))}
                            </select>
                          </td>

                          {/* ================= FU 02 ================= */}
                          {/* Status */}
                          <td className="p-3 text-center border-r border-slate-200 bg-amber-50/30 whitespace-nowrap">
                            <select
                              value={r.fu2_status || 'Pending'}
                              onChange={(e) => handleStatusChange(r.id, 'fu2', e.target.value as any)}
                              className={`px-2.5 py-1 text-xs font-bold rounded-lg border cursor-pointer focus:outline-none ${
                                r.fu2_status === 'Process OK'
                                  ? 'bg-emerald-100 text-emerald-900 border-emerald-400 ring-1 ring-emerald-300'
                                  : r.fu2_status === 'Done'
                                  ? 'bg-blue-100 text-blue-800 border-blue-300'
                                  : r.fu2_status === 'Cancelled'
                                  ? 'bg-rose-100 text-rose-800 border-rose-300'
                                  : 'bg-white text-slate-700 border-slate-300'
                              }`}
                            >
                              <option value="Pending">Pending</option>
                              <option value="Done">Done</option>
                              <option value="Process OK">Process OK</option>
                              <option value="Cancelled">Cancelled</option>
                            </select>
                          </td>

                          {/* Followed up date (DD/MM/YYYY) */}
                          <td className="p-3 border-r border-slate-200 bg-amber-50/30 whitespace-nowrap">
                            <div className="flex items-center gap-1">
                              <input
                                type="text"
                                placeholder="DD/MM/YYYY"
                                value={formatToDDMMYYYY(r.fu2_date)}
                                onChange={(e) => handleUpdateRow(r.id, { fu2_date: e.target.value, last_followup_date: e.target.value })}
                                className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-mono font-bold text-slate-800 w-28 focus:outline-none focus:border-amber-500 text-center"
                              />
                              <button
                                type="button"
                                onClick={() => handleUpdateRow(r.id, { fu2_date: getTodayDDMMYYYY(), last_followup_date: getTodayDDMMYYYY() })}
                                className="text-[10px] text-amber-700 hover:text-amber-900 px-1.5 py-0.5 rounded bg-amber-50 border border-amber-200 cursor-pointer"
                                title="Set date to Today (DD/MM/YYYY)"
                              >
                                Today
                              </button>
                            </div>
                          </td>

                          {/* Remarks */}
                          <td className="p-3 border-r border-slate-200 bg-amber-50/30">
                            <div className="flex items-center gap-1">
                              <input
                                type="text"
                                placeholder="Remarks (e.g. Passport submission requested)..."
                                value={r.fu2_remarks}
                                onChange={(e) => handleUpdateRow(r.id, { fu2_remarks: e.target.value })}
                                className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-800 w-full focus:outline-none focus:border-amber-500"
                              />
                              <button
                                type="button"
                                onClick={() => setRemarksPopout({
                                  applicantName: r.name,
                                  tempRegNo: r.temp_reg_no,
                                  title: 'Follow Up 02 Remarks',
                                  remarks: r.fu2_remarks || '',
                                  isEditable: true,
                                  rowId: r.id,
                                  fuField: 'fu2_remarks'
                                })}
                                className="p-1 rounded-md bg-amber-100 hover:bg-amber-200 text-amber-800 cursor-pointer shrink-0 transition"
                                title="Click to extend / pop out full remarks"
                              >
                                <Maximize2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>

                          {/* Employee Dropdown */}
                          <td className="p-3 border-r border-amber-200 bg-amber-50/30 whitespace-nowrap">
                            <select
                              value={r.fu2_staff || availableStaff[0]?.name}
                              onChange={(e) => handleUpdateRow(r.id, { fu2_staff: e.target.value })}
                              className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-800 cursor-pointer focus:outline-none focus:border-amber-500"
                            >
                              {availableStaff.map((s) => (
                                <option key={s.staff_id} value={s.name}>
                                  {s.name}
                                </option>
                              ))}
                            </select>
                          </td>

                          {/* ================= FU 03 ================= */}
                          {/* Status */}
                          <td className="p-3 text-center border-r border-slate-200 bg-purple-50/30 whitespace-nowrap">
                            <select
                              value={r.fu3_status || 'Pending'}
                              onChange={(e) => handleStatusChange(r.id, 'fu3', e.target.value as any)}
                              className={`px-2.5 py-1 text-xs font-bold rounded-lg border cursor-pointer focus:outline-none ${
                                r.fu3_status === 'Process OK'
                                  ? 'bg-emerald-100 text-emerald-900 border-emerald-400 ring-1 ring-emerald-300'
                                  : r.fu3_status === 'Done'
                                  ? 'bg-blue-100 text-blue-800 border-blue-300'
                                  : r.fu3_status === 'Cancelled'
                                  ? 'bg-rose-100 text-rose-800 border-rose-300'
                                  : 'bg-white text-slate-700 border-slate-300'
                              }`}
                            >
                              <option value="Pending">Pending</option>
                              <option value="Done">Done</option>
                              <option value="Process OK">Process OK</option>
                              <option value="Cancelled">Cancelled</option>
                            </select>
                          </td>

                          {/* Followed up date (DD/MM/YYYY) */}
                          <td className="p-3 border-r border-slate-200 bg-purple-50/30 whitespace-nowrap">
                            <div className="flex items-center gap-1">
                              <input
                                type="text"
                                placeholder="DD/MM/YYYY"
                                value={formatToDDMMYYYY(r.fu3_date)}
                                onChange={(e) => handleUpdateRow(r.id, { fu3_date: e.target.value, last_followup_date: e.target.value })}
                                className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-mono font-bold text-slate-800 w-28 focus:outline-none focus:border-purple-500 text-center"
                              />
                              <button
                                type="button"
                                onClick={() => handleUpdateRow(r.id, { fu3_date: getTodayDDMMYYYY(), last_followup_date: getTodayDDMMYYYY() })}
                                className="text-[10px] text-purple-700 hover:text-purple-900 px-1.5 py-0.5 rounded bg-purple-50 border border-purple-200 cursor-pointer"
                                title="Set date to Today (DD/MM/YYYY)"
                              >
                                Today
                              </button>
                            </div>
                          </td>

                          {/* Remarks */}
                          <td className="p-3 border-r border-slate-200 bg-purple-50/30">
                            <div className="flex items-center gap-1">
                              <input
                                type="text"
                                placeholder="Remarks (e.g. Final contract agreement)..."
                                value={r.fu3_remarks}
                                onChange={(e) => handleUpdateRow(r.id, { fu3_remarks: e.target.value })}
                                className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-800 w-full focus:outline-none focus:border-purple-500"
                              />
                              <button
                                type="button"
                                onClick={() => setRemarksPopout({
                                  applicantName: r.name,
                                  tempRegNo: r.temp_reg_no,
                                  title: 'Follow Up 03 Remarks',
                                  remarks: r.fu3_remarks || '',
                                  isEditable: true,
                                  rowId: r.id,
                                  fuField: 'fu3_remarks'
                                })}
                                className="p-1 rounded-md bg-purple-100 hover:bg-purple-200 text-purple-800 cursor-pointer shrink-0 transition"
                                title="Click to extend / pop out full remarks"
                              >
                                <Maximize2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>

                          {/* Employee Dropdown */}
                          <td className="p-3 border-r border-purple-200 bg-purple-50/30 whitespace-nowrap">
                            <select
                              value={r.fu3_staff || availableStaff[0]?.name}
                              onChange={(e) => handleUpdateRow(r.id, { fu3_staff: e.target.value })}
                              className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-800 cursor-pointer focus:outline-none focus:border-purple-500"
                            >
                              {availableStaff.map((s) => (
                                <option key={s.staff_id} value={s.name}>
                                  {s.name}
                                </option>
                              ))}
                            </select>
                          </td>

                          {/* ================= ACTION (View Log Initial Form) ================= */}
                          <td className="p-3 pr-4 text-center whitespace-nowrap bg-slate-50/60">
                            <button
                              type="button"
                              onClick={() => setSelectedContactForm(r)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200/80 text-xs font-bold rounded-xl transition cursor-pointer shadow-xs active:scale-95"
                              title="View log initial contact form"
                            >
                              <FileText className="w-3.5 h-3.5 text-indigo-600" />
                              <span>View Initial Form</span>
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
        </div>
      )}

      {/* ======================================================== */}
      {/* 4. VIEW 2: FOLLOW UP SUCCEED TABLE (SEPARATE TABLE) */}
      {/* ======================================================== */}
      {pipelineView === 'succeed_table' && (
        <div className="space-y-4">
          <div className="bg-emerald-50 border border-emerald-200/80 p-4 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-700 block">
                SUCCESSFUL OUTREACH OUTCOMES
              </span>
              <h3 className="font-bold text-sm text-emerald-950 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Follow Up Succeed Table ({succeedList.length} Candidates)</span>
              </h3>
              <p className="text-xs text-emerald-800/80 mt-0.5">
                Candidates who were marked <strong>"Process OK"</strong> during follow-up attempts and confirmed interest. Their records are preserved here with date format <code>DD/MM/YYYY</code>.
              </p>
            </div>
            <div className="px-3.5 py-1.5 rounded-xl bg-emerald-600 text-white font-bold text-xs shadow-xs">
              {succeedList.length} Succeeded Files
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead className="bg-slate-50 font-bold uppercase tracking-wider text-[10px] text-slate-600 border-b border-slate-200">
                  <tr>
                    <th className="p-3.5 pl-4 font-mono">Applicant Temporary Reg no</th>
                    <th className="p-3.5">Name</th>
                    <th className="p-3.5 text-center min-w-[75px]">Age</th>
                    <th className="p-3.5 min-w-[130px]">Place</th>
                    <th className="p-3.5">Contact Number</th>
                    <th className="p-3.5">Followed Up Date</th>
                    <th className="p-3.5 min-w-[220px]">Remarks / Outreach Notes</th>
                    <th className="p-3.5 pr-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-sans">
                  {succeedList.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-12 text-center text-slate-400">
                        No succeeded candidates yet. Change a candidate's follow-up status to "Process OK" and click "Send to Follow Up Succeed Table".
                      </td>
                    </tr>
                  ) : (
                    succeedList.map((r) => (
                      <tr key={r.id} className="hover:bg-emerald-50/40 transition">
                        <td className="p-3.5 pl-4 font-mono font-bold text-emerald-950 whitespace-nowrap">
                          {r.temp_reg_no}
                        </td>
                        <td className="p-3.5 font-bold text-slate-900 whitespace-nowrap">
                          {r.name}
                          <span className="block text-[10px] text-slate-500 font-normal">{r.preferred_job_category}</span>
                        </td>
                        <td className="p-3.5 text-center whitespace-nowrap">
                          <span className="font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-md text-xs inline-block shadow-xs">
                            {r.age || 26} Yrs
                          </span>
                        </td>
                        <td className="p-3.5 whitespace-nowrap text-slate-800 font-medium">
                          <span className="flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            {r.place || 'Not specified'}
                          </span>
                        </td>
                        <td className="p-3.5 font-mono text-slate-800 whitespace-nowrap">
                          {r.phone}
                          {r.alt_phone && <span className="block text-[10px] text-slate-400">Alt: {r.alt_phone}</span>}
                        </td>
                        <td className="p-3.5 font-mono font-bold text-emerald-800 whitespace-nowrap">
                          {formatToDDMMYYYY(r.last_followup_date || r.fu3_date || r.fu2_date || r.fu1_date || r.registration_date)}
                        </td>
                        <td className="p-3.5 text-slate-800">
                          <div className="flex items-center justify-between gap-2 max-w-[260px]">
                            <span className="truncate text-xs font-medium text-slate-700">
                              {r.fu3_remarks || r.fu2_remarks || r.fu1_remarks || 'Process OK - Interested candidate confirmed'}
                            </span>
                            <button
                              type="button"
                              onClick={() => setRemarksPopout({
                                applicantName: r.name,
                                tempRegNo: r.temp_reg_no,
                                title: 'Follow Up Succeeded Remarks',
                                remarks: r.fu3_remarks || r.fu2_remarks || r.fu1_remarks || 'Process OK - Interested candidate confirmed',
                                isEditable: true,
                                rowId: r.id,
                                fuField: 'fu1_remarks'
                              })}
                              className="px-2 py-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded-md text-[11px] font-bold flex items-center gap-1 shrink-0 cursor-pointer shadow-xs transition"
                              title="Extend / Pop out complete remarks"
                            >
                              <Maximize2 className="w-3 h-3" />
                              <span>Extend</span>
                            </button>
                          </div>
                        </td>
                        <td className="p-3.5 pr-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => handleOkForRegistration(r)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer active:scale-95"
                              title="Convert / Complete registration for candidate"
                            >
                              <UserCheck className="w-3.5 h-3.5" />
                              <span>OK for Reg</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => onViewProfile(r.id)}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-xl shadow-xs transition cursor-pointer"
                            >
                              <User className="w-3.5 h-3.5 text-slate-300" />
                              <span>Profile</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 5. VIEW 3: CLOSED FILE TABLE (SEPARATE TABLE) */}
      {/* ======================================================== */}
      {pipelineView === 'closed_table' && (
        <div className="space-y-4">
          <div className="bg-rose-50 border border-rose-200/80 p-4 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-rose-700 block">
                CLOSED ARCHIVES & CANCELLED FILES
              </span>
              <h3 className="font-bold text-sm text-rose-950 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-rose-600" />
                <span>Closed File Table ({closedList.length} Cancelled Files)</span>
              </h3>
              <p className="text-xs text-rose-800/80 mt-0.5">
                Applicants whose follow-up outreach was cancelled or refused to proceed. Each file can be restored via the Reopen File button. Dates formatted in <code>DD/MM/YYYY</code>.
              </p>
            </div>
            <div className="px-3.5 py-1.5 rounded-xl bg-rose-600 text-white font-bold text-xs shadow-xs">
              {closedList.length} Closed Files
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead className="bg-slate-50 font-bold uppercase tracking-wider text-[10px] text-slate-600 border-b border-slate-200">
                  <tr>
                    <th className="p-3.5 pl-4 font-mono">Applicant Temporary Reg no</th>
                    <th className="p-3.5">Name</th>
                    <th className="p-3.5 text-center min-w-[75px]">Age</th>
                    <th className="p-3.5 min-w-[130px]">Place</th>
                    <th className="p-3.5">Contact Numbers</th>
                    <th className="p-3.5">Last Follow Up Date</th>
                    <th className="p-3.5 min-w-[220px]">Cancelled Reason & Remarks</th>
                    <th className="p-3.5 min-w-[180px]">Audit</th>
                    <th className="p-3.5 pr-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-sans">
                  {closedList.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-12 text-center text-slate-400">
                        No closed or cancelled files. To close a candidate, set their follow-up status to "Cancelled" in the active table and click "Send to Closed File Table".
                      </td>
                    </tr>
                  ) : (
                    closedList.map((r) => (
                      <tr key={r.id} className="hover:bg-rose-50/40 transition">
                        <td className="p-3.5 pl-4 font-mono font-bold text-rose-950 whitespace-nowrap">
                          {r.temp_reg_no}
                        </td>
                        <td className="p-3.5 font-bold text-slate-900 whitespace-nowrap">
                          {r.name}
                          <span className="block text-[10px] text-slate-500 font-normal">{r.preferred_job_category}</span>
                        </td>
                        <td className="p-3.5 text-center whitespace-nowrap">
                          <span className="font-bold text-rose-800 bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-md text-xs inline-block shadow-xs">
                            {r.age || 26} Yrs
                          </span>
                        </td>
                        <td className="p-3.5 whitespace-nowrap text-slate-800 font-medium">
                          <span className="flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            {r.place || 'Not specified'}
                          </span>
                        </td>
                        <td className="p-3.5 font-mono text-slate-800 whitespace-nowrap">
                          {r.phone}
                          {r.alt_phone && <span className="block text-[10px] text-slate-400">Alt: {r.alt_phone}</span>}
                        </td>
                        <td className="p-3.5 font-mono text-slate-700 font-bold whitespace-nowrap">
                          {formatToDDMMYYYY(r.last_followup_date || r.fu3_date || r.fu2_date || r.fu1_date || r.registration_date)}
                        </td>
                        <td className="p-3.5 text-rose-900 font-medium">
                          <div className="flex items-center justify-between gap-2 max-w-[260px]">
                            <span className="truncate" title={r.cancelled_reason || 'Candidate Cancelled'}>
                              {r.cancelled_reason || 'Candidate Cancelled / Refused to Proceed'}
                            </span>
                            <button
                              type="button"
                              onClick={() => setRemarksPopout({
                                applicantName: r.name,
                                tempRegNo: r.temp_reg_no,
                                title: 'Closed File Reason & Remarks',
                                remarks: r.cancelled_reason || 'Candidate Cancelled / Refused to Proceed',
                                isEditable: true,
                                rowId: r.id,
                                fuField: 'cancelled_reason'
                              })}
                              className="px-2 py-1 bg-rose-100 hover:bg-rose-200 text-rose-800 rounded-md text-[11px] font-bold flex items-center gap-1 shrink-0 cursor-pointer shadow-xs transition"
                              title="Extend / Pop out complete cancelled reason"
                            >
                              <Maximize2 className="w-3 h-3" />
                              <span>Extend</span>
                            </button>
                          </div>
                        </td>
                        <td className="p-3.5 text-[11px] text-slate-500 font-mono">
                          {r.audit_info || `Recorded by ${r.fu3_staff || r.fu1_staff || 'Staff'}`}
                        </td>
                        <td className="p-3.5 pr-4 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => handleReopenFile(r)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer active:scale-95"
                            title="Restore candidate file to Active Follow-Ups Table"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>Reopen File</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 6. VIEW 4: PIPELINE MASTER SUMMARY TABLE */}
      {/* ======================================================== */}
      {pipelineView === 'summary_table' && (
        <div className="space-y-6">
          {/* Controls Bar for Summary Filter */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-purple-600" />
                <span>Retention Pipeline Master Summary Filter</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Depicts all summaries across Active Follow-Ups, Succeeded Candidates, and Closed Files filterable by month, month range, and yearly.
              </p>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              {/* Filter Mode */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                <button
                  onClick={() => setSummaryFilterMode('single_month')}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition cursor-pointer ${
                    summaryFilterMode === 'single_month' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  Specific Month
                </button>
                <button
                  onClick={() => setSummaryFilterMode('month_range')}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition cursor-pointer ${
                    summaryFilterMode === 'month_range' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  Month Range
                </button>
                <button
                  onClick={() => setSummaryFilterMode('yearly')}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition cursor-pointer ${
                    summaryFilterMode === 'yearly' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  Yearly
                </button>
              </div>

              {/* Date Pickers */}
              {summaryFilterMode === 'single_month' && (
                <div className="flex items-center gap-1">
                  <label className="text-xs font-bold text-slate-600">Month:</label>
                  <input
                    type="month"
                    value={summarySelectedMonth}
                    onChange={(e) => setSummarySelectedMonth(e.target.value)}
                    className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-800"
                  />
                </div>
              )}

              {summaryFilterMode === 'month_range' && (
                <div className="flex items-center gap-1.5">
                  <label className="text-xs font-bold text-slate-600">From:</label>
                  <input
                    type="month"
                    value={summaryStartMonth}
                    onChange={(e) => setSummaryStartMonth(e.target.value)}
                    className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-800"
                  />
                  <label className="text-xs font-bold text-slate-600">To:</label>
                  <input
                    type="month"
                    value={summaryEndMonth}
                    onChange={(e) => setSummaryEndMonth(e.target.value)}
                    className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-800"
                  />
                </div>
              )}

              {summaryFilterMode === 'yearly' && (
                <div className="flex items-center gap-1">
                  <label className="text-xs font-bold text-slate-600">Year:</label>
                  <select
                    value={summarySelectedYear}
                    onChange={(e) => setSummarySelectedYear(e.target.value)}
                    className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-800 cursor-pointer"
                  >
                    <option value="2026">2026</option>
                    <option value="2025">2025</option>
                    <option value="2024">2024</option>
                  </select>
                </div>
              )}

              {/* Export & Print Buttons */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    try {
                      const exportRows: any[] = [];
                      exportRows.push({ 'SECTION': 'EXECUTIVE OVERVIEW', 'METRIC': 'Active In Pipeline', 'VALUE': masterSummary.totalActive, 'RATE': 'In 3-Strike Outreach' });
                      exportRows.push({ 'SECTION': 'EXECUTIVE OVERVIEW', 'METRIC': 'Succeeded (Process OK)', 'VALUE': masterSummary.totalSucceeded, 'RATE': `${masterSummary.grandTotal ? Math.round((masterSummary.totalSucceeded / masterSummary.grandTotal) * 100) : 0}% Conversion` });
                      exportRows.push({ 'SECTION': 'EXECUTIVE OVERVIEW', 'METRIC': 'Closed / Cancelled', 'VALUE': masterSummary.totalClosed, 'RATE': `${masterSummary.grandTotal ? Math.round((masterSummary.totalClosed / masterSummary.grandTotal) * 100) : 0}% Drop Rate` });
                      exportRows.push({ 'SECTION': 'EXECUTIVE OVERVIEW', 'METRIC': 'Total Processed', 'VALUE': masterSummary.grandTotal, 'RATE': '100%' });
                      exportRows.push({});
                      exportRows.push({ 'SECTION': 'OUTREACH FUNNEL', 'METRIC': 'Attempt 01 (Initial)', 'VALUE': masterSummary.attempt1Count, 'RATE': 'First Contact' });
                      exportRows.push({ 'SECTION': 'OUTREACH FUNNEL', 'METRIC': 'Attempt 02 (Second Call)', 'VALUE': masterSummary.attempt2Count, 'RATE': 'Re-engagement' });
                      exportRows.push({ 'SECTION': 'OUTREACH FUNNEL', 'METRIC': 'Attempt 03 (Final Notice)', 'VALUE': masterSummary.attempt3Count, 'RATE': 'Final Opportunity' });
                      exportRows.push({});
                      exportRows.push({ 'SECTION': 'STAFF PERFORMANCE', 'METRIC': 'Staff Name', 'VALUE': 'Active', 'RATE': 'Succeeded (Process OK)', 'CLOSED': 'Closed', 'TOTAL': 'Total Handled', 'SUCCESS_RATE': 'Success Rate %' });
                      Object.keys(masterSummary.staffMap).forEach((stf) => {
                        const item = masterSummary.staffMap[stf];
                        const rate = item.total > 0 ? `${Math.round((item.succeeded / item.total) * 100)}%` : '0%';
                        exportRows.push({ 'SECTION': 'STAFF PERFORMANCE', 'METRIC': stf, 'VALUE': item.active, 'RATE': item.succeeded, 'CLOSED': item.closed, 'TOTAL': item.total, 'SUCCESS_RATE': rate });
                      });
                      const ws = XLSX.utils.json_to_sheet(exportRows, { skipHeader: true });
                      const wb = XLSX.utils.book_new();
                      XLSX.utils.book_append_sheet(wb, ws, 'Pipeline_Summary');
                      XLSX.writeFile(wb, `TransArabian_Pipeline_Master_Summary_${new Date().toISOString().split('T')[0]}.xlsx`);
                      showNotification('success', 'Pipeline master summary successfully exported to Excel (.xlsx).');
                    } catch (err: any) {
                      showNotification('error', `Export failed: ${err.message}`);
                    }
                  }}
                  className="flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs px-3.5 py-2 rounded-xl transition cursor-pointer shadow-xs active:scale-98"
                  title="Export Pipeline Summary to Excel (.xlsx)"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export Excel</span>
                </button>
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs px-3.5 py-2 rounded-xl transition cursor-pointer shadow-xs active:scale-98"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print / PDF</span>
                </button>
              </div>
            </div>
          </div>

          {/* Master Summary Report Tables & Funnel */}
          <div className="space-y-6">
            {/* CARD 1: EXECUTIVE KPI SUMMARY */}
            <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-xs space-y-5">
              {/* Header info */}
              <div className="border-b border-slate-100 pb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                <div>
                  <span className="text-[10px] font-mono font-bold text-indigo-700 uppercase tracking-wider block">
                    TRANS ARABIAN FOREIGN EMPLOYMENT AGENCY · SLBFE #2601
                  </span>
                  <h3 className="text-base font-black text-slate-900 tracking-wide uppercase mt-0.5 flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-indigo-600" />
                    <span>Cross-Pipeline Retention & Outreach Master Summary</span>
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    {summaryFilterMode === 'single_month' && `Selected Month: ${summarySelectedMonth}`}
                    {summaryFilterMode === 'month_range' && `Period: ${summaryStartMonth} to ${summaryEndMonth}`}
                    {summaryFilterMode === 'yearly' && `Selected Calendar Year: ${summarySelectedYear}`}
                  </p>
                </div>
                <div className="text-left sm:text-right text-xs font-mono text-slate-500 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
                  <div>Date: <strong className="text-slate-800">{getTodayDDMMYYYY()}</strong></div>
                  <div>SLBFE Lic: <strong className="text-indigo-700">1422</strong></div>
                </div>
              </div>

              {/* Metric Overview Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl bg-indigo-50/70 border border-indigo-200/70 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wide text-indigo-900">Active In Pipeline</span>
                    <Layers className="w-4 h-4 text-indigo-600" />
                  </div>
                  <div className="text-2xl font-black text-indigo-950 mt-1">{masterSummary.totalActive}</div>
                  <div className="text-[11px] text-indigo-800 font-semibold mt-1 flex items-center gap-1">
                    <span>In 3-Strike Outreach Pool</span>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200/70 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wide text-emerald-900">Succeeded (Process OK)</span>
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div className="text-2xl font-black text-emerald-950 mt-1">{masterSummary.totalSucceeded}</div>
                  <div className="text-[11px] text-emerald-800 font-semibold mt-1">
                    Conversion Rate: <span className="font-mono font-bold">{masterSummary.grandTotal ? Math.round((masterSummary.totalSucceeded / masterSummary.grandTotal) * 100) : 0}%</span>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-rose-50/70 border border-rose-200/70 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wide text-rose-900">Closed / Dropped</span>
                    <XCircle className="w-4 h-4 text-rose-600" />
                  </div>
                  <div className="text-2xl font-black text-rose-950 mt-1">{masterSummary.totalClosed}</div>
                  <div className="text-[11px] text-rose-800 font-semibold mt-1">
                    Drop Rate: <span className="font-mono font-bold">{masterSummary.grandTotal ? Math.round((masterSummary.totalClosed / masterSummary.grandTotal) * 100) : 0}%</span>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-900 text-white shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wide text-slate-300">Total Inquiries Processed</span>
                    <TrendingUp className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="text-2xl font-black text-white mt-1">{masterSummary.grandTotal}</div>
                  <div className="text-[11px] text-slate-400 mt-1">
                    Agency Intake Volume
                  </div>
                </div>
              </div>
            </div>

            {/* CARD 2: PIPELINE PROGRESS & OUTREACH ATTEMPT FUNNEL */}
            <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  <Layers className="w-4 h-4 text-indigo-600" />
                  <span>3-Strike Candidate Outreach Protocol Funnel</span>
                </h4>
                <span className="text-[11px] font-mono text-slate-500 font-semibold">
                  {masterSummary.inRange.length} Total Pipeline Records
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3.5 bg-blue-50/60 rounded-xl border border-blue-200/60 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-blue-800 uppercase block">Attempt 01 (Initial Intake)</span>
                    <span className="text-xl font-mono font-black text-blue-900 mt-0.5 block">{masterSummary.attempt1Count}</span>
                    <span className="text-[10px] text-blue-700 font-medium">Awaiting first follow-up call</span>
                  </div>
                  <span className="px-2 py-1 rounded-md bg-blue-100 text-blue-900 font-mono text-xs font-bold">Tier 1</span>
                </div>

                <div className="p-3.5 bg-amber-50/60 rounded-xl border border-amber-200/60 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-amber-800 uppercase block">Attempt 02 (Follow-Up Call)</span>
                    <span className="text-xl font-mono font-black text-amber-900 mt-0.5 block">{masterSummary.attempt2Count}</span>
                    <span className="text-[10px] text-amber-700 font-medium">Under active re-engagement</span>
                  </div>
                  <span className="px-2 py-1 rounded-md bg-amber-100 text-amber-900 font-mono text-xs font-bold">Tier 2</span>
                </div>

                <div className="p-3.5 bg-purple-50/60 rounded-xl border border-purple-200/60 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-purple-800 uppercase block">Attempt 03 (Final Notice)</span>
                    <span className="text-xl font-mono font-black text-purple-900 mt-0.5 block">{masterSummary.attempt3Count}</span>
                    <span className="text-[10px] text-purple-700 font-medium">Last opportunity before closing</span>
                  </div>
                  <span className="px-2 py-1 rounded-md bg-purple-100 text-purple-900 font-mono text-xs font-bold">Tier 3</span>
                </div>
              </div>
            </div>

            {/* CARD 3: EMPLOYEE OUTREACH PERFORMANCE TABLE */}
            <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <UserCheck className="w-4 h-4 text-indigo-600" />
                    <span>Employee Outreach & Conversion Performance</span>
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Individual counselor performance, outreach activity, and Process OK conversion rates.
                  </p>
                </div>

                {/* Search input for quick staff lookup */}
                <div className="relative w-full sm:w-64">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search employee..."
                    value={summaryStaffSearch}
                    onChange={(e) => setSummaryStaffSearch(e.target.value)}
                    className="w-full bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                <table className="w-full text-xs text-left border-collapse">
                  <thead className="bg-slate-100 font-bold uppercase tracking-wider text-[10px] text-slate-700 border-b border-slate-200">
                    <tr>
                      <th className="p-3 w-10 text-center font-mono">#</th>
                      <th className="p-3">Employee Name</th>
                      <th className="p-3 text-center bg-indigo-50/80 text-indigo-900">Active Follow-up</th>
                      <th className="p-3 text-center bg-emerald-50/80 text-emerald-900">Succeeded (Process OK)</th>
                      <th className="p-3 text-center bg-rose-50/80 text-rose-900">Closed / Dropped</th>
                      <th className="p-3 text-center font-black bg-slate-200/80 text-slate-900">Total Handled</th>
                      <th className="p-3 min-w-[140px] text-center">Success Rate (%)</th>
                      <th className="p-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(() => {
                      const allStaffKeys = Object.keys(masterSummary.staffMap);
                      const filteredStaff = allStaffKeys.filter((stf) =>
                        stf.toLowerCase().includes(summaryStaffSearch.toLowerCase())
                      );

                      if (filteredStaff.length === 0) {
                        return (
                          <tr>
                            <td colSpan={8} className="p-8 text-center text-slate-400">
                              {summaryStaffSearch
                                ? `No staff member found matching "${summaryStaffSearch}".`
                                : 'No pipeline activity records recorded in this timeframe.'}
                            </td>
                          </tr>
                        );
                      }

                      return filteredStaff.map((stf, idx) => {
                        const item = masterSummary.staffMap[stf];
                        const rate = item.total > 0 ? Math.round((item.succeeded / item.total) * 100) : 0;
                        const isTopPerformer = rate >= 50 && item.succeeded >= 2;

                        return (
                          <tr key={idx} className="hover:bg-slate-50 transition">
                            <td className="p-3 text-center font-mono font-bold text-slate-400">{idx + 1}</td>
                            <td className="p-3 font-bold text-slate-900">
                              <div className="flex items-center gap-2.5">
                                <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-800 flex items-center justify-center font-bold text-xs shrink-0">
                                  {stf.charAt(0)}
                                </div>
                                <span>{stf}</span>
                              </div>
                            </td>
                            <td className="p-3 text-center font-mono font-semibold text-indigo-800">
                              <span className="px-2 py-0.5 rounded-md bg-indigo-50 border border-indigo-200">
                                {item.active}
                              </span>
                            </td>
                            <td className="p-3 text-center font-mono font-bold text-emerald-800">
                              <span className="px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200">
                                {item.succeeded}
                              </span>
                            </td>
                            <td className="p-3 text-center font-mono font-semibold text-rose-800">
                              <span className="px-2 py-0.5 rounded-md bg-rose-50 border border-rose-200">
                                {item.closed}
                              </span>
                            </td>
                            <td className="p-3 text-center font-mono font-black text-slate-900 bg-slate-50">
                              {item.total}
                            </td>
                            <td className="p-3 text-center">
                              <div className="flex items-center justify-center gap-2">
                                <div className="w-16 bg-slate-200 rounded-full h-1.5 overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${
                                      rate >= 50 ? 'bg-emerald-600' : rate >= 25 ? 'bg-indigo-600' : 'bg-slate-400'
                                    }`}
                                    style={{ width: `${Math.min(100, rate)}%` }}
                                  />
                                </div>
                                <span className="font-mono font-bold text-slate-800 text-xs w-8 text-right">{rate}%</span>
                              </div>
                            </td>
                            <td className="p-3 text-center">
                              {isTopPerformer ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                                  <Award className="w-3 h-3 text-amber-600" />
                                  <span>Top Converted</span>
                                </span>
                              ) : item.active > 0 ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-100 text-indigo-800">
                                  Active
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full text-[10px] text-slate-500 bg-slate-100">
                                  Standby
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: VIEW LOG INITIAL CONTACT FORM (Item 07) */}
      {selectedContactForm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-100 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <div>
                <span className="text-[10px] font-mono font-bold text-indigo-600 uppercase tracking-wider block">
                  CANDIDATE INITIAL FORM RECORD
                </span>
                <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-indigo-600" />
                  <span>Applicant Initial Contact & Follow-Up Form</span>
                </h3>
              </div>
              <button
                onClick={() => setSelectedContactForm(null)}
                className="text-slate-400 hover:text-slate-600 font-bold text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[10px] text-slate-400 font-mono uppercase font-bold">Temporary Reg No</span>
                    <h4 className="text-base font-black text-slate-900">{selectedContactForm.temp_reg_no}</h4>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
                    Registration Date: {selectedContactForm.registration_date}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-200/80">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Candidate Name</span>
                    <span className="font-bold text-slate-900">{selectedContactForm.name}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Age</span>
                    <span className="font-bold text-slate-900">{selectedContactForm.age} Years</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Gender</span>
                    <span className="font-bold text-slate-900">{selectedContactForm.gender || 'Male'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Location</span>
                    <span className="font-bold text-slate-900">{selectedContactForm.place}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Primary Phone</span>
                    <span className="font-mono font-bold text-emerald-800">{selectedContactForm.phone}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Alt Phone</span>
                    <span className="font-mono text-slate-700">{selectedContactForm.alt_phone || 'None'}</span>
                  </div>
                  <div className="col-span-2 sm:col-span-3">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Preferred Vacancy</span>
                    <span className="font-bold text-indigo-950 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200 inline-block mt-0.5">
                      {selectedContactForm.preferred_job_category}
                    </span>
                  </div>
                </div>
              </div>

              {/* Follow-up attempt timeline */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <h5 className="font-bold text-slate-800 text-[11px] uppercase tracking-wider">Outreach & Follow-Up Protocol Progress</h5>
                <div className="space-y-1.5 font-sans">
                  <div className="flex justify-between items-center p-2.5 rounded-lg bg-white border border-slate-200">
                    <div>
                      <span className="font-bold text-slate-900">Attempt 01: </span>
                      <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                        selectedContactForm.fu1_status === 'Process OK' ? 'bg-emerald-100 text-emerald-800' :
                        selectedContactForm.fu1_status === 'Done' ? 'bg-blue-100 text-blue-800' :
                        selectedContactForm.fu1_status === 'Cancelled' ? 'bg-rose-100 text-rose-800' :
                        'bg-slate-100 text-slate-700'
                      }`}>
                        {selectedContactForm.fu1_status}
                      </span>
                      {selectedContactForm.fu1_date && <span className="text-slate-500 font-mono text-[11px] ml-2">({selectedContactForm.fu1_date})</span>}
                      {selectedContactForm.fu1_remarks && <div className="text-slate-600 text-[11px] mt-1 italic">{selectedContactForm.fu1_remarks}</div>}
                    </div>
                    <span className="text-slate-500 font-medium text-[11px]">Staff: {selectedContactForm.fu1_staff}</span>
                  </div>

                  <div className="flex justify-between items-center p-2.5 rounded-lg bg-white border border-slate-200">
                    <div>
                      <span className="font-bold text-slate-900">Attempt 02: </span>
                      <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                        selectedContactForm.fu2_status === 'Process OK' ? 'bg-emerald-100 text-emerald-800' :
                        selectedContactForm.fu2_status === 'Done' ? 'bg-blue-100 text-blue-800' :
                        selectedContactForm.fu2_status === 'Cancelled' ? 'bg-rose-100 text-rose-800' :
                        'bg-slate-100 text-slate-700'
                      }`}>
                        {selectedContactForm.fu2_status}
                      </span>
                      {selectedContactForm.fu2_date && <span className="text-slate-500 font-mono text-[11px] ml-2">({selectedContactForm.fu2_date})</span>}
                      {selectedContactForm.fu2_remarks && <div className="text-slate-600 text-[11px] mt-1 italic">{selectedContactForm.fu2_remarks}</div>}
                    </div>
                    <span className="text-slate-500 font-medium text-[11px]">Staff: {selectedContactForm.fu2_staff}</span>
                  </div>

                  <div className="flex justify-between items-center p-2.5 rounded-lg bg-white border border-slate-200">
                    <div>
                      <span className="font-bold text-slate-900">Attempt 03: </span>
                      <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                        selectedContactForm.fu3_status === 'Process OK' ? 'bg-emerald-100 text-emerald-800' :
                        selectedContactForm.fu3_status === 'Done' ? 'bg-blue-100 text-blue-800' :
                        selectedContactForm.fu3_status === 'Cancelled' ? 'bg-rose-100 text-rose-800' :
                        'bg-slate-100 text-slate-700'
                      }`}>
                        {selectedContactForm.fu3_status}
                      </span>
                      {selectedContactForm.fu3_date && <span className="text-slate-500 font-mono text-[11px] ml-2">({selectedContactForm.fu3_date})</span>}
                      {selectedContactForm.fu3_remarks && <div className="text-slate-600 text-[11px] mt-1 italic">{selectedContactForm.fu3_remarks}</div>}
                    </div>
                    <span className="text-slate-500 font-medium text-[11px]">Staff: {selectedContactForm.fu3_staff}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 rounded-xl font-bold text-slate-700 hover:bg-slate-50 cursor-pointer text-xs"
              >
                <Printer className="w-3.5 h-3.5 text-slate-500" />
                <span>Print Dossier</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedContactForm(null)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs shadow transition cursor-pointer"
              >
                Close Form
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 8. REMARKS EXTENDED POP-OUT MODAL */}
      {/* ======================================================== */}
      {remarksPopout && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex justify-between items-start pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center">
                  <Maximize2 className="w-4 h-4 text-indigo-600" />
                </div>
                <div>
                  <h4 className="font-bold text-base text-slate-900">
                    {remarksPopout.title}
                  </h4>
                  <p className="text-xs text-slate-500 font-mono">
                    Candidate: <strong className="text-slate-800">{remarksPopout.applicantName}</strong> ({remarksPopout.tempRegNo})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRemarksPopout(null)}
                className="text-slate-400 hover:text-slate-600 font-bold text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 block">
                Complete Remarks & Discussion Details:
              </label>
              {remarksPopout.isEditable ? (
                <textarea
                  rows={6}
                  value={remarksPopout.remarks}
                  onChange={(e) =>
                    setRemarksPopout({ ...remarksPopout, remarks: e.target.value })
                  }
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs text-slate-900 font-sans leading-relaxed focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-400"
                  placeholder="Enter detailed notes and remarks..."
                />
              ) : (
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 leading-relaxed font-sans min-h-[100px] whitespace-pre-wrap">
                  {remarksPopout.remarks || 'No remarks recorded.'}
                </div>
              )}
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-slate-100">
              <span className="text-[11px] text-slate-400 font-mono">
                Click anywhere outside or press Close to dismiss
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setRemarksPopout(null)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl font-bold text-xs cursor-pointer"
                >
                  Close
                </button>
                {remarksPopout.isEditable && remarksPopout.rowId && remarksPopout.fuField && (
                  <button
                    type="button"
                    onClick={() => {
                      if (remarksPopout.rowId && remarksPopout.fuField) {
                        handleUpdateRow(remarksPopout.rowId, {
                          [remarksPopout.fuField]: remarksPopout.remarks
                        });
                        showNotification(
                          'success',
                          `Updated ${remarksPopout.title} for ${remarksPopout.applicantName}`
                        );
                      }
                      setRemarksPopout(null);
                    }}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-xs shadow-xs cursor-pointer transition active:scale-95"
                  >
                    Save Remarks
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
