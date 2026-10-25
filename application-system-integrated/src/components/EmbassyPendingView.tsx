import React, { useState, useMemo, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { ApplicantOverview } from '../types';
import {
  ShieldCheck,
  Search,
  Download,
  Printer,
  Edit2,
  CheckCircle2,
  Clock,
  ChevronLeft,
  ChevronRight,
  Building,
  Calendar,
  X,
  UploadCloud,
  Sparkles,
  Filter,
  FileSpreadsheet,
  RotateCcw,
  Layers,
  FileText,
  User,
  Plus
} from 'lucide-react';
import { EmbassyPendingUploadModal } from './EmbassyPendingUploadModal';
import { EmbassyPendingPdfModal } from './EmbassyPendingPdfModal';
import { EMBASSY_PENDING_PDF_DATA, EmbassyPendingCandidate } from '../data/embassyPendingSeedData';

interface Props {
  applicants: ApplicantOverview[];
  onViewApplicant: (id: string) => void;
  onPrintApplicant: (id: string) => void;
  onRefreshData: () => void;
  showNotification: (type: 'success' | 'error' | 'info', text: string) => void;
}

export interface UnifiedEmbassyPendingRow {
  id: string;
  serial_no: number;
  full_name: string;
  passport_number: string;
  se_number: string;
  company_name: string;
  embassy_applied_date: string;
  e_number: string;
  se_group: string;
  remarks?: string;
  is_database_applicant: boolean;
  applicant_id?: string;
}

export const EmbassyPendingView: React.FC<Props> = ({
  applicants,
  onViewApplicant,
  onPrintApplicant,
  onRefreshData,
  showNotification
}) => {
  // View mode: 'roster_list' (Candidate Matrix & Inline Edit - DEFAULT) | 'subtotal_report' (Grouped by SE with subtotals like PDF)
  const [viewMode, setViewMode] = useState<'subtotal_report' | 'roster_list'>('roster_list');

  // Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSeGroup, setSelectedSeGroup] = useState<string>('all');
  const [selectedCompany, setSelectedCompany] = useState<string>('all');

  // Pagination for roster_list view
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  // Modal states
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  const [editingApp, setEditingApp] = useState<UnifiedEmbassyPendingRow | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [isSaving, setIsSaving] = useState(false);

  // Quick inline edit cell
  const [editingCell, setEditingCell] = useState<{ id: string; field: string } | null>(null);
  const [cellVal, setCellVal] = useState('');

  // 1. Build unified list of Embassy Pending candidates
  // Merges live database applicants (who are pending embassy appointment) with the official 106 PDF dataset
  const unifiedList = useMemo(() => {
    const list: UnifiedEmbassyPendingRow[] = [];
    const seenPassports = new Set<string>();
    const seenNames = new Set<string>();

    // A. Filter DB applicants who are in Embassy Pending (not yet assigned appointment_date)
    const dbPending = applicants.filter(
      (a) =>
        (a.se_number || a.e_number || a.embassy_applied_date || a.visa_status === 'Pending' || a.visa_status === 'APPLIED') &&
        !a.appointment_date // Automatically removed once appointment_date is set
    );

    dbPending.forEach((app, idx) => {
      const pass = (app.passport_number || '').trim().toUpperCase();
      const name = (app.full_name || '').trim().toUpperCase();
      if (pass && pass !== 'PENDING') seenPassports.add(pass);
      if (name) seenNames.add(name);

      const seNum = app.se_number || `SE241000${idx + 1}`;
      const seGrp = seNum.length >= 5 ? seNum.slice(0, 5).toUpperCase() : 'SE241';

      list.push({
        id: app.applicant_id,
        serial_no: idx + 1,
        full_name: app.full_name,
        passport_number: app.passport_number || 'PENDING',
        se_number: seNum,
        company_name: app.company_name && app.company_name !== 'None' ? app.company_name : 'RETEX GREEN',
        embassy_applied_date: app.embassy_applied_date || app.registration_date || '01/07/2026',
        e_number: app.e_number || '',
        se_group: seGrp,
        remarks: app.closed_remarks || '',
        is_database_applicant: true,
        applicant_id: app.applicant_id
      });
    });

    // B. Merge remaining records from the official 106-record PDF dataset
    EMBASSY_PENDING_PDF_DATA.forEach((pdfRec) => {
      const pass = pdfRec.passport_number.trim().toUpperCase();
      const name = pdfRec.full_name.trim().toUpperCase();

      if ((pass && seenPassports.has(pass)) || (name && seenNames.has(name))) {
        return; // Already represented by live DB applicant
      }

      list.push({
        id: `PDF-${pdfRec.no}`,
        serial_no: list.length + 1,
        full_name: pdfRec.full_name,
        passport_number: pdfRec.passport_number,
        se_number: pdfRec.se_number,
        company_name: pdfRec.company_name,
        embassy_applied_date: pdfRec.embassy_applied_date,
        e_number: pdfRec.e_number,
        se_group: pdfRec.se_group,
        remarks: '',
        is_database_applicant: false
      });
    });

    // Sort by SE group then SE number
    return list.sort((a, b) => {
      if (a.se_group !== b.se_group) {
        return a.se_group.localeCompare(b.se_group);
      }
      return a.se_number.localeCompare(b.se_number);
    }).map((item, index) => ({
      ...item,
      serial_no: index + 1
    }));
  }, [applicants]);

  // Extract unique filter options
  const uniqueSeGroups = useMemo(() => {
    const set = new Set<string>();
    unifiedList.forEach((r) => {
      if (r.se_group) set.add(r.se_group);
    });
    return Array.from(set).sort();
  }, [unifiedList]);

  const uniqueCompanies = useMemo(() => {
    const set = new Set<string>();
    unifiedList.forEach((r) => {
      if (r.company_name && r.company_name !== 'None') set.add(r.company_name);
    });
    return Array.from(set).sort();
  }, [unifiedList]);

  // 2. Filter rows according to user filters
  const filteredRows = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();

    return unifiedList.filter((row) => {
      // Search term
      if (q) {
        const matches =
          row.full_name.toLowerCase().includes(q) ||
          row.passport_number.toLowerCase().includes(q) ||
          row.se_number.toLowerCase().includes(q) ||
          row.e_number.toLowerCase().includes(q) ||
          row.company_name.toLowerCase().includes(q) ||
          row.embassy_applied_date.toLowerCase().includes(q) ||
          row.se_group.toLowerCase().includes(q);
        if (!matches) return false;
      }

      // SE Number group filter
      if (selectedSeGroup !== 'all' && row.se_group !== selectedSeGroup) {
        return false;
      }

      // Company filter
      if (selectedCompany !== 'all' && row.company_name !== selectedCompany) {
        return false;
      }

      return true;
    });
  }, [unifiedList, searchTerm, selectedSeGroup, selectedCompany]);

  // 3. Group filtered rows by SE Number for Subtotal Report
  const groupedSeReport = useMemo(() => {
    const groups: { se_group: string; rows: UnifiedEmbassyPendingRow[]; total: number }[] = [];
    const map = new Map<string, UnifiedEmbassyPendingRow[]>();

    filteredRows.forEach((r) => {
      const grp = r.se_group || 'OTHER';
      if (!map.has(grp)) {
        map.set(grp, []);
      }
      map.get(grp)!.push(r);
    });

    // Sort group keys naturally e.g. SE240, SE241, SE243...
    const sortedKeys = Array.from(map.keys()).sort();

    sortedKeys.forEach((key) => {
      const rows = map.get(key)!;
      groups.push({
        se_group: key,
        rows,
        total: rows.length
      });
    });

    return groups;
  }, [filteredRows]);

  // Total matching records count
  const grandTotalPersons = filteredRows.length;

  // Pagination for Roster List
  const totalPages = Math.ceil(filteredRows.length / pageSize) || 1;
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, currentPage, pageSize]);

  // Reset page on filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedSeGroup, selectedCompany]);

  // Clear all filters helper
  const handleClearFilters = () => {
    setSearchTerm('');
    setSelectedSeGroup('all');
    setSelectedCompany('all');
  };

  const isFiltered =
    searchTerm !== '' ||
    selectedSeGroup !== 'all' ||
    selectedCompany !== 'all';

  // Export to Excel with complete SE Subtotal structure
  const handleExportExcel = () => {
    try {
      const exportRows: any[] = [];

      groupedSeReport.forEach((group) => {
        group.rows.forEach((r) => {
          exportRows.push({
            'NO': r.serial_no,
            'NAME': r.full_name,
            'PASSPORT NO': r.passport_number,
            'SE NUMBER': r.se_number,
            'COMPANY NAME': r.company_name,
            'EMBASSY APPLIED DATE': r.embassy_applied_date,
            'E NUMBER': r.e_number || ''
          });
        });

        // Insert Subtotal Row
        exportRows.push({
          'NO': '',
          'NAME': `${group.se_group} TOTAL PERSONS`,
          'PASSPORT NO': group.total,
          'SE NUMBER': '',
          'COMPANY NAME': '',
          'EMBASSY APPLIED DATE': '',
          'E NUMBER': ''
        });
      });

      // Insert Grand Total Row
      exportRows.push({
        'NO': '',
        'NAME': 'GRAND TOTAL PERSONS',
        'PASSPORT NO': grandTotalPersons,
        'SE NUMBER': '',
        'COMPANY NAME': '',
        'EMBASSY APPLIED DATE': '',
        'E NUMBER': ''
      });

      const ws = XLSX.utils.json_to_sheet(exportRows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'EMBASSY_SE_REPORT');
      const filename = `TransArabian_Embassy_Pending_SE_Report_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(wb, filename);
      showNotification('success', `Exported SE Subtotal Report (${grandTotalPersons} candidates) to ${filename}`);
    } catch (err: any) {
      showNotification('error', `Export failed: ${err.message}`);
    }
  };

  // Open Edit Modal
  const handleOpenEdit = (row: UnifiedEmbassyPendingRow) => {
    setEditingApp(row);
    setEditForm({
      full_name: row.full_name,
      passport_number: row.passport_number,
      se_number: row.se_number,
      e_number: row.e_number,
      company_name: row.company_name,
      embassy_applied_date: row.embassy_applied_date,
      appointment_date: '',
      appointment_time: '',
      remarks: row.remarks || ''
    });
  };

  // Save Edit
  const handleSaveEdit = async () => {
    if (!editingApp) return;
    setIsSaving(true);
    try {
      if (editingApp.is_database_applicant && editingApp.applicant_id) {
        const res = await fetch(`/api/applicants/${editingApp.applicant_id}/quick-update`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(editForm)
        });
        if (res.ok) {
          showNotification('success', `Updated Embassy records for ${editingApp.full_name}`);
          setEditingApp(null);
          onRefreshData();
        } else {
          const d = await res.json();
          showNotification('error', d.error || 'Failed to update record');
        }
      } else {
        // Save to backend batch-import
        await fetch('/api/v1/embassy/batch-import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            records: [
              {
                full_name: editForm.full_name,
                passport_number: editForm.passport_number,
                se_number: editForm.se_number,
                e_number: editForm.e_number,
                company_name: editForm.company_name,
                embassy_applied_date: editForm.embassy_applied_date
              }
            ]
          })
        });
        showNotification('success', `Updated & synced ${editForm.full_name} to Embassy database.`);
        setEditingApp(null);
        onRefreshData();
      }
    } catch (err: any) {
      showNotification('error', err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // Inline Cell Save
  const handleInlineSave = async (row: UnifiedEmbassyPendingRow, field: string, val: string) => {
    try {
      if (row.is_database_applicant && row.applicant_id) {
        const res = await fetch(`/api/applicants/${row.applicant_id}/quick-update`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ [field]: val })
        });
        if (res.ok) {
          showNotification('success', `Updated ${field.replace('_', ' ')}.`);
          setEditingCell(null);
          onRefreshData();
        }
      } else {
        // Sync record to DB
        await fetch('/api/v1/embassy/batch-import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            records: [
              {
                full_name: field === 'full_name' ? val : row.full_name,
                passport_number: field === 'passport_number' ? val : row.passport_number,
                se_number: field === 'se_number' ? val : row.se_number,
                e_number: field === 'e_number' ? val : row.e_number,
                company_name: field === 'company_name' ? val : row.company_name,
                embassy_applied_date: field === 'embassy_applied_date' ? val : row.embassy_applied_date
              }
            ]
          })
        });
        showNotification('success', `Saved ${field.replace('_', ' ')} to database.`);
        setEditingCell(null);
        onRefreshData();
      }
    } catch (e: any) {
      showNotification('error', e.message);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 sm:p-6 space-y-6">
      {/* 1. TOP HEADER & PRIMARY ACTIONS */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="p-2.5 rounded-2xl bg-slate-900 text-amber-400 shadow-xs">
              <ShieldCheck className="w-5 h-5" />
            </span>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-bold text-slate-900 tracking-tight">Embassy Pending</h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-extrabold bg-amber-100 text-amber-800 border border-amber-300">
                  {grandTotalPersons} PERSONS PENDING
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                SE Number allocations & Embassy applications awaiting interview appointments.
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end flex-wrap">
          {/* SE Subtotal PDF / Print Modal Button */}
          <button
            type="button"
            onClick={() => setIsPdfModalOpen(true)}
            className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold px-3.5 py-2.5 rounded-xl shadow-xs transition cursor-pointer active:scale-98"
            title="Open SE Subtotal Report PDF & Print Dialog"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>SE Subtotal PDF / Print</span>
          </button>

          {/* Document Upload & AI Extraction Button */}
          <button
            type="button"
            onClick={() => setIsUploadModalOpen(true)}
            className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-xs transition cursor-pointer active:scale-98"
            title="Upload Embassy PDF Roster, SE list, or appointment letter for AI extraction"
          >
            <UploadCloud className="w-4 h-4 text-amber-400" />
            <span>AI Document Upload</span>
          </button>

          {/* Export Excel Button */}
          <button
            type="button"
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3.5 py-2.5 rounded-xl shadow-xs transition cursor-pointer active:scale-98"
            title="Export SE Subtotal Report to Excel"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Report (.xlsx)</span>
          </button>
        </div>
      </div>

      {/* 2. VIEW TOGGLE BAR (SE Subtotal Report vs Roster List) */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-1.5 bg-slate-100 rounded-2xl border border-slate-200">
        <div className="flex items-center gap-1.5 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setViewMode('subtotal_report')}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              viewMode === 'subtotal_report'
                ? 'bg-slate-900 text-white shadow-md'
                : 'text-slate-700 hover:text-slate-900 hover:bg-slate-200/70'
            }`}
          >
            <FileSpreadsheet className={`w-4 h-4 ${viewMode === 'subtotal_report' ? 'text-amber-400' : 'text-slate-600'}`} />
            <span>SE Subtotal Report</span>
            <span className={`text-[10px] font-mono px-2 py-0.5 rounded-md font-bold ${
              viewMode === 'subtotal_report' ? 'bg-amber-400/20 text-amber-300 border border-amber-400/30' : 'bg-slate-200 text-slate-700'
            }`}>
              {groupedSeReport.length} SE Groups
            </span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('roster_list')}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              viewMode === 'roster_list'
                ? 'bg-slate-900 text-white shadow-md'
                : 'text-slate-700 hover:text-slate-900 hover:bg-slate-200/70'
            }`}
          >
            <Layers className={`w-4 h-4 ${viewMode === 'roster_list' ? 'text-emerald-400' : 'text-slate-600'}`} />
            <span>Candidate Matrix & Inline Edit</span>
            <span className={`text-[10px] font-mono px-2 py-0.5 rounded-md font-bold ${
              viewMode === 'roster_list' ? 'bg-emerald-400/20 text-emerald-300 border border-emerald-400/30' : 'bg-slate-200 text-slate-700'
            }`}>
              {grandTotalPersons}
            </span>
          </button>
        </div>

        <div className="text-[11px] text-slate-500 font-mono hidden sm:block pr-3">
          {viewMode === 'subtotal_report'
            ? `Official PDF Matrix · Subtotals under each SE group · Total: ${grandTotalPersons}`
            : `Roster view with inline cell editing & profile access`}
        </div>
      </div>

      {/* 3. MULTI-FILTER TOOLBAR (SE Numbers, Company, Embassy Applied Date, Search) */}
      <div className="bg-slate-50/90 rounded-2xl border border-slate-200 p-4 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap pb-2 border-b border-slate-200/60">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
            <Filter className="w-3.5 h-3.5 text-amber-600" />
            <span>Filter Embassy Pending Records:</span>
          </div>

          {isFiltered && (
            <button
              type="button"
              onClick={handleClearFilters}
              className="flex items-center gap-1 text-[11px] font-bold text-rose-600 hover:text-rose-700 transition cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset Filters</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Filter 1: Search keyword */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search name, passport, SE, E no..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition shadow-xs"
            />
          </div>

          {/* Filter 2: SE Number Group */}
          <div>
            <select
              value={selectedSeGroup}
              onChange={(e) => setSelectedSeGroup(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition shadow-xs cursor-pointer"
            >
              <option value="all">All SE Numbers ({uniqueSeGroups.length} Groups)</option>
              {uniqueSeGroups.map((grp) => {
                const countInGrp = unifiedList.filter((r) => r.se_group === grp).length;
                return (
                  <option key={grp} value={grp}>
                    {grp} ({countInGrp} persons)
                  </option>
                );
              })}
            </select>
          </div>

          {/* Filter 3: Company Name */}
          <div>
            <select
              value={selectedCompany}
              onChange={(e) => setSelectedCompany(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition shadow-xs cursor-pointer"
            >
              <option value="all">All Companies ({uniqueCompanies.length})</option>
              {uniqueCompanies.map((comp) => {
                const countInComp = unifiedList.filter((r) => r.company_name === comp).length;
                return (
                  <option key={comp} value={comp}>
                    {comp} ({countInComp})
                  </option>
                );
              })}
            </select>
          </div>
        </div>
      </div>

      {/* 4. VIEW 1: OFFICIAL SE SUBTOTAL REPORT (EXACT PDF REPLICATION & CLEAN LAYOUT) */}
      {viewMode === 'subtotal_report' && (
        <div className="space-y-4">
          {/* Subtotal Report Action Toolbar */}
          <div className="p-3 bg-slate-100 rounded-2xl border border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-amber-600" />
              <span className="text-xs font-bold text-slate-800">
                Official SE Subtotal Table ({groupedSeReport.length} SE Groups · {grandTotalPersons} Total Candidates)
              </span>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setIsPdfModalOpen(true)}
                className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs px-3.5 py-1.5 rounded-xl transition cursor-pointer shadow-xs"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>PDF Download & Print Dialog</span>
              </button>

              <button
                type="button"
                onClick={handleExportExcel}
                className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-3.5 py-1.5 rounded-xl transition cursor-pointer shadow-xs"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Excel</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-300 rounded-2xl shadow-xs bg-white">
            <table className="w-full text-xs text-left border-collapse font-sans">
              {/* Report Main Header */}
              <thead className="bg-[#1e293b] text-white font-extrabold uppercase tracking-wider text-[11px] border-b-2 border-slate-700">
                <tr>
                  <th className="p-3 pl-4 w-12 text-center font-mono border-r border-slate-700">NO</th>
                  <th className="p-3 border-r border-slate-700 min-w-[200px]">NAME</th>
                  <th className="p-3 font-mono border-r border-slate-700 min-w-[130px]">PASSPORT NO</th>
                  <th className="p-3 font-mono border-r border-slate-700 min-w-[130px]">SE NUMBER</th>
                  <th className="p-3 border-r border-slate-700 min-w-[170px]">COMPANY NAME</th>
                  <th className="p-3 font-mono text-center border-r border-slate-700 min-w-[140px]">EMBASSY APPLIED DATE</th>
                  <th className="p-3 pr-4 font-mono min-w-[160px]">E NUMBER</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {groupedSeReport.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-12 text-center text-slate-400">
                      <div className="max-w-xs mx-auto space-y-2">
                        <ShieldCheck className="w-8 h-8 mx-auto text-slate-300" />
                        <p className="font-bold text-slate-700">No matching Embassy Pending records</p>
                        <p className="text-xs text-slate-400">
                          Try adjusting your SE number, company, or date filters above.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  groupedSeReport.map((group) => (
                    <React.Fragment key={group.se_group}>
                      {/* Candidate rows within this SE Group */}
                      {group.rows.map((row) => (
                        <tr
                          key={row.id}
                          className="hover:bg-slate-50/90 transition text-slate-900 border-b border-slate-200"
                        >
                          <td className="p-2.5 pl-4 text-center font-mono font-bold text-slate-600 border-r border-slate-200">
                            {row.serial_no}
                          </td>
                          <td className="p-2.5 font-bold text-slate-900 border-r border-slate-200 uppercase whitespace-nowrap">
                            {row.full_name}
                          </td>
                          <td className="p-2.5 font-mono font-bold text-slate-800 border-r border-slate-200 whitespace-nowrap">
                            {row.passport_number}
                          </td>
                          <td className="p-2.5 font-mono font-extrabold text-slate-900 border-r border-slate-200 whitespace-nowrap">
                            {row.se_number}
                          </td>
                          <td className="p-2.5 font-semibold text-slate-800 border-r border-slate-200 whitespace-nowrap">
                            {row.company_name}
                          </td>
                          <td className="p-2.5 font-mono text-center text-slate-700 border-r border-slate-200 whitespace-nowrap">
                            {row.embassy_applied_date}
                          </td>
                          <td className="p-2.5 pr-4 font-mono font-bold text-slate-900 whitespace-nowrap">
                            {row.e_number ? (
                              <span className="text-slate-900">{row.e_number}</span>
                            ) : (
                              <span className="text-slate-400 italic font-normal text-[11px]">Pending</span>
                            )}
                          </td>
                        </tr>
                      ))}

                      {/* MERGED SUB-TOTAL ROW FOR THIS SPECIFIC SE NUMBER */}
                      <tr className="bg-[#e0e7ff] text-slate-950 font-black border-y-2 border-indigo-300">
                        {/* 1. NO, NAME, PASSPORT NO merged (colSpan 3) with text centered in the middle */}
                        <td
                          colSpan={3}
                          className="p-2.5 text-center font-black text-slate-950 tracking-wide text-xs border-r border-indigo-200 uppercase"
                        >
                          {group.se_group} TOTAL PERSONS
                        </td>
                        {/* 2. SE NUMBER, COMPANY NAME merged (colSpan 2) with total count centered in the middle */}
                        <td
                          colSpan={2}
                          className="p-2.5 text-center font-mono font-black text-indigo-950 text-xs border-r border-indigo-200"
                        >
                          {group.total}
                        </td>
                        {/* 3. EMBASSY APPLIED DATE, E NUMBER (colSpan 2) styled background */}
                        <td
                          colSpan={2}
                          className="p-2.5 bg-[#e0e7ff]"
                        ></td>
                      </tr>
                    </React.Fragment>
                  ))
                )}

                {/* GRAND TOTAL PERSONS ROW AT BOTTOM (MERGED FORMAT) */}
                {groupedSeReport.length > 0 && (
                  <tr className="bg-[#fef3c7] text-slate-950 font-black border-t-2 border-amber-400">
                    {/* 1. NO, NAME, PASSPORT NO merged (colSpan 3) with text centered in the middle */}
                    <td
                      colSpan={3}
                      className="p-3.5 text-center font-black text-amber-950 tracking-wider text-xs border-r border-amber-300 uppercase"
                    >
                      GRAND TOTAL PERSONS
                    </td>
                    {/* 2. SE NUMBER, COMPANY NAME merged (colSpan 2) with grand total count centered in the middle */}
                    <td
                      colSpan={2}
                      className="p-3.5 text-center font-mono font-black text-amber-950 text-sm border-r border-amber-300"
                    >
                      {grandTotalPersons}
                    </td>
                    {/* 3. EMBASSY APPLIED DATE, E NUMBER (colSpan 2) styled background */}
                    <td
                      colSpan={2}
                      className="p-3.5 bg-[#fef3c7]"
                    ></td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 5. VIEW 2: ROSTER LIST VIEW (PAGINATED WITH INLINE EDIT & QUICK PROFILE ACCESS) */}
      {viewMode === 'roster_list' && (
        <div className="space-y-4">
          <div className="overflow-x-auto border border-slate-200 rounded-2xl shadow-xs">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-slate-50 font-bold uppercase tracking-wider text-[10px] text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="p-3 pl-4 w-12 font-mono">NO</th>
                  <th className="p-3">APPLICANT NAME</th>
                  <th className="p-3 font-mono">PASSPORT NO</th>
                  <th className="p-3 font-mono">SE NUMBER</th>
                  <th className="p-3">COMPANY NAME</th>
                  <th className="p-3 font-mono text-center">EMBASSY APPLIED DATE</th>
                  <th className="p-3 font-mono">E NUMBER</th>
                  <th className="p-3 pr-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-sans">
                {paginatedRows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-10 text-center text-slate-400">
                      No embassy pending candidates found matching filters.
                    </td>
                  </tr>
                ) : (
                  paginatedRows.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-50/80 transition group">
                      <td className="p-3 pl-4 font-mono font-bold text-slate-400">{row.serial_no}</td>

                      {/* Name */}
                      <td className="p-3 font-bold text-slate-900 whitespace-nowrap">
                        {editingCell?.id === row.id && editingCell?.field === 'full_name' ? (
                          <input
                            autoFocus
                            type="text"
                            value={cellVal}
                            onChange={(e) => setCellVal(e.target.value)}
                            onBlur={() => handleInlineSave(row, 'full_name', cellVal)}
                            onKeyDown={(e) => e.key === 'Enter' && handleInlineSave(row, 'full_name', cellVal)}
                            className="border border-emerald-500 rounded px-1.5 py-0.5 text-xs font-bold"
                          />
                        ) : (
                          <span
                            onClick={() => {
                              setEditingCell({ id: row.id, field: 'full_name' });
                              setCellVal(row.full_name);
                            }}
                            className="hover:underline cursor-pointer"
                            title="Click to edit name"
                          >
                            {row.full_name}
                          </span>
                        )}
                      </td>

                      {/* Passport */}
                      <td className="p-3 font-mono font-bold text-slate-800 whitespace-nowrap">
                        {editingCell?.id === row.id && editingCell?.field === 'passport_number' ? (
                          <input
                            autoFocus
                            type="text"
                            value={cellVal}
                            onChange={(e) => setCellVal(e.target.value)}
                            onBlur={() => handleInlineSave(row, 'passport_number', cellVal)}
                            onKeyDown={(e) => e.key === 'Enter' && handleInlineSave(row, 'passport_number', cellVal)}
                            className="border border-emerald-500 rounded px-1.5 py-0.5 text-xs font-mono font-bold"
                          />
                        ) : (
                          <span
                            onClick={() => {
                              setEditingCell({ id: row.id, field: 'passport_number' });
                              setCellVal(row.passport_number);
                            }}
                            className="px-2 py-0.5 bg-slate-100 rounded border border-slate-200 hover:border-slate-400 cursor-pointer"
                            title="Click to edit passport"
                          >
                            {row.passport_number}
                          </span>
                        )}
                      </td>

                      {/* SE Number */}
                      <td className="p-3 font-mono font-bold text-emerald-800 whitespace-nowrap">
                        {editingCell?.id === row.id && editingCell?.field === 'se_number' ? (
                          <input
                            autoFocus
                            type="text"
                            value={cellVal}
                            onChange={(e) => setCellVal(e.target.value)}
                            onBlur={() => handleInlineSave(row, 'se_number', cellVal)}
                            onKeyDown={(e) => e.key === 'Enter' && handleInlineSave(row, 'se_number', cellVal)}
                            className="border border-emerald-500 rounded px-1.5 py-0.5 text-xs font-mono font-bold"
                          />
                        ) : (
                          <span
                            onClick={() => {
                              setEditingCell({ id: row.id, field: 'se_number' });
                              setCellVal(row.se_number);
                            }}
                            className="px-2 py-0.5 bg-emerald-50 rounded border border-emerald-200 hover:border-emerald-400 cursor-pointer"
                            title="Click to edit SE Number"
                          >
                            {row.se_number}
                          </span>
                        )}
                      </td>

                      {/* Company */}
                      <td className="p-3 whitespace-nowrap font-semibold text-slate-800">
                        {editingCell?.id === row.id && editingCell?.field === 'company_name' ? (
                          <input
                            autoFocus
                            type="text"
                            value={cellVal}
                            onChange={(e) => setCellVal(e.target.value)}
                            onBlur={() => handleInlineSave(row, 'company_name', cellVal)}
                            onKeyDown={(e) => e.key === 'Enter' && handleInlineSave(row, 'company_name', cellVal)}
                            className="border border-emerald-500 rounded px-1.5 py-0.5 text-xs font-semibold"
                          />
                        ) : (
                          <span
                            onClick={() => {
                              setEditingCell({ id: row.id, field: 'company_name' });
                              setCellVal(row.company_name);
                            }}
                            className="hover:underline cursor-pointer"
                            title="Click to edit company"
                          >
                            {row.company_name}
                          </span>
                        )}
                      </td>

                      {/* Applied Date */}
                      <td className="p-3 font-mono text-center text-slate-600 whitespace-nowrap">
                        {row.embassy_applied_date}
                      </td>

                      {/* E Number */}
                      <td className="p-3 font-mono font-bold text-blue-800 whitespace-nowrap">
                        {editingCell?.id === row.id && editingCell?.field === 'e_number' ? (
                          <input
                            autoFocus
                            type="text"
                            value={cellVal}
                            onChange={(e) => setCellVal(e.target.value)}
                            onBlur={() => handleInlineSave(row, 'e_number', cellVal)}
                            onKeyDown={(e) => e.key === 'Enter' && handleInlineSave(row, 'e_number', cellVal)}
                            className="border border-blue-500 rounded px-1.5 py-0.5 text-xs font-mono font-bold"
                          />
                        ) : (
                          <span
                            onClick={() => {
                              setEditingCell({ id: row.id, field: 'e_number' });
                              setCellVal(row.e_number);
                            }}
                            className="px-2 py-0.5 bg-blue-50 rounded border border-blue-200 hover:border-blue-400 cursor-pointer"
                            title="Click to edit E-Number"
                          >
                            {row.e_number || 'Pending'}
                          </span>
                        )}
                      </td>

                      {/* Action */}
                      <td className="p-3 pr-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleOpenEdit(row)}
                            className="p-1 px-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
                          >
                            <Edit2 className="w-3 h-3 text-slate-600" />
                            <span>Edit</span>
                          </button>
                          {row.is_database_applicant && row.applicant_id && (
                            <button
                              onClick={() => onViewApplicant(row.applicant_id!)}
                              className="p-1 px-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold transition cursor-pointer"
                            >
                              Profile
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
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

      {/* 6. AI DOCUMENT UPLOAD & EXTRACTION MODAL */}
      <EmbassyPendingUploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onSuccess={() => {
          onRefreshData();
          showNotification('success', 'Embassy Pending roster successfully updated from uploaded document.');
        }}
        showNotification={showNotification}
      />

      {/* 7. SE NUMBERS SUBTOTAL REPORT PDF & PRINT MODAL */}
      <EmbassyPendingPdfModal
        isOpen={isPdfModalOpen}
        onClose={() => setIsPdfModalOpen(false)}
        groupedSeReport={groupedSeReport}
        grandTotalPersons={grandTotalPersons}
      />

      {/* 8. QUICK EDIT MODAL */}
      {editingApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h3 className="font-bold text-sm text-slate-900">
                Update Embassy Record: {editingApp.full_name}
              </h3>
              <button
                onClick={() => setEditingApp(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="col-span-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Candidate Full Name</label>
                <input
                  type="text"
                  value={editForm.full_name || ''}
                  onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 font-bold text-slate-900 uppercase"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Passport Number</label>
                <input
                  type="text"
                  value={editForm.passport_number || ''}
                  onChange={(e) => setEditForm({ ...editForm, passport_number: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 font-mono font-bold text-slate-800"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">SE Number</label>
                <input
                  type="text"
                  value={editForm.se_number || ''}
                  onChange={(e) => setEditForm({ ...editForm, se_number: e.target.value })}
                  className="w-full bg-emerald-50 border border-emerald-200 rounded-xl p-2 font-mono font-extrabold text-emerald-800"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Company Name</label>
                <input
                  type="text"
                  value={editForm.company_name || ''}
                  onChange={(e) => setEditForm({ ...editForm, company_name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 font-semibold text-slate-800"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Embassy Applied Date</label>
                <input
                  type="text"
                  value={editForm.embassy_applied_date || ''}
                  placeholder="DD/MM/YYYY"
                  onChange={(e) => setEditForm({ ...editForm, embassy_applied_date: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 font-mono text-slate-800"
                />
              </div>

              <div className="col-span-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">E Number (If Available)</label>
                <input
                  type="text"
                  value={editForm.e_number || ''}
                  placeholder="e.g. E24404457566611"
                  onChange={(e) => setEditForm({ ...editForm, e_number: e.target.value })}
                  className="w-full bg-blue-50 border border-blue-200 rounded-xl p-2 font-mono font-bold text-blue-900"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Set Appointment Date</label>
                <input
                  type="date"
                  value={editForm.appointment_date || ''}
                  onChange={(e) => setEditForm({ ...editForm, appointment_date: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 font-mono text-slate-800"
                />
                <span className="text-[10px] text-amber-600 mt-0.5 block">
                  * Setting date moves candidate to Embassy Interviews
                </span>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Appointment Time</label>
                <input
                  type="text"
                  value={editForm.appointment_time || ''}
                  placeholder="e.g. 10.30AM"
                  onChange={(e) => setEditForm({ ...editForm, appointment_time: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 font-mono text-slate-800"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setEditingApp(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={isSaving}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition shadow-xs"
              >
                {isSaving ? 'Saving...' : 'Save & Update'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
