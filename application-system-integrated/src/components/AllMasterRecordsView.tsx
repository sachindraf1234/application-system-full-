import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { ApplicantOverview, Staff } from '../types';
import {
  FileSpreadsheet,
  Download,
  Upload,
  RefreshCw,
  Search,
  Filter,
  Eye,
  Edit2,
  Printer,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  Clock,
  Layers,
  Sparkles,
  ExternalLink,
  ShieldCheck,
  Building,
  Plane,
  X
} from 'lucide-react';

interface Props {
  applicants: ApplicantOverview[];
  staffList?: Staff[];
  onViewProfile: (id: string) => void;
  onPrintApplicant: (id: string) => void;
  onRefreshData: () => void;
  showNotification: (type: 'success' | 'error' | 'info', text: string) => void;
}

export const AllMasterRecordsView: React.FC<Props> = ({
  applicants,
  staffList = [],
  onViewProfile,
  onPrintApplicant,
  onRefreshData,
  showNotification
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCompany, setFilterCompany] = useState('');
  const [filterGender, setFilterGender] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterVisaStatus, setFilterVisaStatus] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 12;

  // View density toggle
  const [showFullColumns, setShowFullColumns] = useState(false);

  // Syncing & Import State
  const [isSyncing, setIsSyncing] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [pasteData, setPasteData] = useState('');
  const [isImporting, setIsImporting] = useState(false);

  // Quick edit modal
  const [editingApp, setEditingApp] = useState<ApplicantOverview | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Unique lists for dropdowns
  const uniqueCompanies = useMemo(() => {
    return Array.from(new Set(applicants.map((a) => a.company_name).filter((c) => c && c !== 'None' && c !== 'Not Assigned')));
  }, [applicants]);

  const uniqueCategories = useMemo(() => {
    return Array.from(new Set(applicants.map((a) => a.preferred_job_category).filter(Boolean)));
  }, [applicants]);

  // Filtered rows
  const filteredRows = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    return applicants.filter((app) => {
      const matchesSearch =
        !q ||
        app.full_name?.toLowerCase().includes(q) ||
        app.applicant_id?.toLowerCase().includes(q) ||
        app.passport_number?.toLowerCase().includes(q) ||
        app.registration_number?.toLowerCase().includes(q) ||
        app.register_card_no?.toLowerCase().includes(q) ||
        app.mobile_number?.toLowerCase().includes(q) ||
        app.company_name?.toLowerCase().includes(q) ||
        app.se_number?.toLowerCase().includes(q) ||
        app.e_number?.toLowerCase().includes(q) ||
        app.ticket_number?.toLowerCase().includes(q) ||
        app.flight_number?.toLowerCase().includes(q) ||
        app.preferred_job_category?.toLowerCase().includes(q) ||
        app.register_by?.toLowerCase().includes(q);

      const matchesCompany = !filterCompany || app.company_name === filterCompany;
      const matchesGender = !filterGender || app.gender === filterGender;
      const matchesCategory = !filterCategory || app.preferred_job_category === filterCategory;
      const matchesVisa = !filterVisaStatus || app.visa_status === filterVisaStatus;

      return matchesSearch && matchesCompany && matchesGender && matchesCategory && matchesVisa;
    });
  }, [applicants, searchTerm, filterCompany, filterGender, filterCategory, filterVisaStatus]);

  // Pagination
  const totalPages = Math.ceil(filteredRows.length / pageSize) || 1;
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, currentPage, pageSize]);

  // Trigger Google Apps Script Live Sync
  const handleTriggerGoogleSync = async () => {
    setIsSyncing(true);
    showNotification('info', 'Connecting to Google Apps Script endpoint...');
    try {
      const res = await fetch('/api/sync', { method: 'POST' });
      const data = await res.json();
      if (data.success && data.results?.fetched > 0) {
        showNotification(
          'success',
          `Synced with Google: ${data.results.fetched} records processed (Inserted: ${data.results.inserted}, Updated: ${data.results.updated})`
        );
      } else {
        showNotification(
          'info',
          'Google Apps Script response processed. Existing local candidate records preserved.'
        );
      }
      onRefreshData();
    } catch (err: any) {
      showNotification('error', `Sync error: ${err.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  // Import Excel File or Pasted Data
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsName = wb.SheetNames[0];
        const ws = wb.Sheets[wsName];
        const rows: any[] = XLSX.utils.sheet_to_json(ws);

        if (rows.length === 0) {
          showNotification('error', 'Selected file contains no tabular records');
          return;
        }

        const res = await fetch('/api/sync/import-rows', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rows })
        });
        const data = await res.json();
        if (data.success) {
          showNotification('success', `Imported ${data.count} records into Master Records!`);
          setShowImportModal(false);
          onRefreshData();
        } else {
          showNotification('error', data.error || 'Import failed');
        }
      } catch (err: any) {
        showNotification('error', `File parse error: ${err.message}`);
      }
    };
    reader.readAsBinaryString(file);
  };

  // Handle Pasted TSV / CSV Data
  const handleImportPastedData = async () => {
    if (!pasteData.trim()) {
      showNotification('error', 'Please paste data from Excel or Google Sheets');
      return;
    }

    setIsImporting(true);
    try {
      const lines = pasteData.trim().split('\n');
      if (lines.length < 2) {
        showNotification('error', 'Pasted data must include header row and at least 1 record');
        return;
      }

      const headers = lines[0].split('\t').map((h) => h.trim());
      const rows = lines.slice(1).map((line) => {
        const cols = line.split('\t');
        const obj: any = {};
        headers.forEach((h, idx) => {
          obj[h] = cols[idx]?.trim() || '';
        });
        return obj;
      });

      const res = await fetch('/api/sync/import-rows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows })
      });
      const data = await res.json();
      if (data.success) {
        showNotification('success', `Imported ${data.count} records into All Master Records!`);
        setShowImportModal(false);
        setPasteData('');
        onRefreshData();
      } else {
        showNotification('error', data.error || 'Failed to import data');
      }
    } catch (err: any) {
      showNotification('error', `Import failed: ${err.message}`);
    } finally {
      setIsImporting(false);
    }
  };

  // Export to Excel (.xlsx) with all 360° columns
  const handleExportFullExcel = () => {
    try {
      const exportRows = filteredRows.map((a, idx) => ({
        'NO': idx + 1,
        'Master ID': a.applicant_id,
        'Registration No': a.registration_number,
        'Register Card No': a.register_card_no || '',
        'Register By': a.register_by || a.staff_name || '',
        'Full Name': a.full_name,
        'Gender': a.gender,
        'Age': a.age || '',
        'Date of Birth': a.date_of_birth || '',
        'NIC Number': a.nic_number || '',
        'Mobile Number': a.mobile_number,
        'Living Place': a.living_place || '',
        'Passport No': a.passport_number || 'PENDING',
        'Passport Expiry': a.passport_expiry || '',
        'Job Category': a.preferred_job_category,
        'Experience': a.experienced || 'Yes',
        'Applied As Couple': a.applied_as_couple || 'No',
        'Partner Name': a.partner_name || '',
        'Company Name': a.company_name || 'None',
        'Sub Company': a.sub_company || '',
        'SE Number': a.se_number || '',
        'E Number': a.e_number || '',
        'Embassy Applied Date': a.embassy_applied_date || '',
        'Appointment Date': a.appointment_date || '',
        'Visa Status': a.visa_status || 'Pending',
        'Police Report': a.police_report_ready ? 'OK' : 'Pending',
        'English Attempt 1 (%)': a.english_attempt_1 ?? '',
        'English Attempt 2 (%)': a.english_attempt_2 ?? '',
        'English Attempt 3 (%)': a.english_attempt_3 ?? '',
        'English Rating': a.english_rating || a.english_status || 'Good',
        'English Evaluator': a.english_evaluator || '',
        'Departure Date': a.departure_date || '',
        'Departure Time': a.departure_time || '',
        'Flight Number': a.flight_number || '',
        'Airport': a.airport || 'Colombo (CMB)',
        'Ticket Number': a.ticket_number || '',
        'Booking Status': a.booking_status || '',
        'Registration Date': a.registration_date,
        'Current Stage': a.current_status,
        'Remarks': a.closed_remarks || ''
      }));

      const ws = XLSX.utils.json_to_sheet(exportRows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'ALL_MASTER_RECORDS');
      const filename = `TransArabian_AllMasterRecords_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(wb, filename);
      showNotification('success', `Exported ${exportRows.length} master records to ${filename}`);
    } catch (err: any) {
      showNotification('error', `Export error: ${err.message}`);
    }
  };

  // Open Edit Modal
  const handleOpenEdit = (app: ApplicantOverview) => {
    setEditingApp(app);
    setEditForm({
      full_name: app.full_name,
      passport_number: app.passport_number,
      preferred_job_category: app.preferred_job_category,
      gender: app.gender,
      register_card_no: app.register_card_no || '',
      register_by: app.register_by || app.staff_name || 'Althaf Hussain',
      applied_as_couple: app.applied_as_couple || 'No',
      partner_name: app.partner_name || '',
      company_name: app.company_name === 'None' ? 'DUNNAREA HOTEL' : app.company_name,
      sub_company: app.sub_company || '',
      se_number: app.se_number || '',
      e_number: app.e_number || '',
      visa_status: app.visa_status || 'Pending',
      police_report_ready: app.police_report_ready !== undefined ? app.police_report_ready : true,
      departure_date: app.departure_date || '',
      flight_number: app.flight_number || '',
      ticket_number: app.ticket_number || '',
      mobile_number: app.mobile_number || '',
      remarks: app.closed_remarks || ''
    });
  };

  // Save Edit
  const handleSaveEdit = async () => {
    if (!editingApp) return;
    setIsSavingEdit(true);
    try {
      const res = await fetch(`/api/applicants/${editingApp.applicant_id}/quick-update`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm)
      });
      if (res.ok) {
        showNotification('success', `Saved changes for ${editingApp.full_name}`);
        setEditingApp(null);
        onRefreshData();
      } else {
        const d = await res.json();
        showNotification('error', d.error || 'Failed to update record');
      }
    } catch (err: any) {
      showNotification('error', err.message);
    } finally {
      setIsSavingEdit(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 sm:p-6 space-y-6">
      {/* 1. TOP HEADER & WORKSPACE TOOLBAR */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-slate-900 text-emerald-400">
              <FileSpreadsheet className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">All Master Records</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Complete 360° database matrix with all statutory recruitment columns, embassy links, and flight schedules.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-stretch lg:self-auto justify-end">
          {/* Live Google Sync Button */}
          <button
            onClick={handleTriggerGoogleSync}
            disabled={isSyncing}
            className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-3.5 py-2.5 rounded-xl shadow-xs transition cursor-pointer active:scale-98 disabled:opacity-50"
            title="Pull and synchronize with Google Apps Script endpoint"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-emerald-400 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Syncing...' : 'Sync Google Script'}</span>
          </button>

          {/* Import Excel / CSV Button */}
          <button
            onClick={() => setShowImportModal(true)}
            className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold px-3.5 py-2.5 rounded-xl border border-slate-300/80 shadow-2xs transition cursor-pointer active:scale-98"
          >
            <Upload className="w-3.5 h-3.5 text-slate-600" />
            <span>Import Excel / Table</span>
          </button>

          {/* Export Full Master Excel */}
          <button
            onClick={handleExportFullExcel}
            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3.5 py-2.5 rounded-xl shadow-xs transition cursor-pointer active:scale-98"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Master (.xlsx)</span>
          </button>

          {/* Column Density Toggle */}
          <button
            onClick={() => setShowFullColumns(!showFullColumns)}
            className="text-xs font-semibold px-3 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 shadow-2xs transition cursor-pointer"
          >
            {showFullColumns ? 'Compact Columns' : 'Show All 360° Columns'}
          </button>
        </div>
      </div>

      {/* 2. SEARCH & ADVANCED FILTERS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="relative lg:col-span-2">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search candidate name, passport, card no, SE/E no, company..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full bg-slate-50 hover:bg-white focus:bg-white border border-slate-200/80 focus:border-emerald-500 rounded-xl pl-10 pr-4 py-2 text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all shadow-xs"
          />
        </div>

        <div>
          <select
            value={filterCategory}
            onChange={(e) => {
              setFilterCategory(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full bg-slate-50 hover:bg-white focus:bg-white border border-slate-200/80 focus:border-emerald-500 rounded-xl px-3 py-2 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition shadow-xs cursor-pointer"
          >
            <option value="">All Job Categories</option>
            {uniqueCategories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div>
          <select
            value={filterCompany}
            onChange={(e) => {
              setFilterCompany(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full bg-slate-50 hover:bg-white focus:bg-white border border-slate-200/80 focus:border-emerald-500 rounded-xl px-3 py-2 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition shadow-xs cursor-pointer"
          >
            <option value="">All Employers / Companies</option>
            {uniqueCompanies.map((comp) => (
              <option key={comp} value={comp}>
                {comp}
              </option>
            ))}
          </select>
        </div>

        <div>
          <select
            value={filterGender}
            onChange={(e) => {
              setFilterGender(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full bg-slate-50 hover:bg-white focus:bg-white border border-slate-200/80 focus:border-emerald-500 rounded-xl px-3 py-2 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition shadow-xs cursor-pointer"
          >
            <option value="">All Genders (Male & Female)</option>
            <option value="Male">Male Candidates Only</option>
            <option value="Female">Female Candidates Only</option>
          </select>
        </div>
      </div>

      {/* 3. MASTER RECORDS TABLE */}
      <div className="overflow-x-auto border border-slate-200/80 rounded-xl">
        <table className="w-full text-xs text-left border-collapse">
          <thead className="bg-slate-50 font-bold uppercase tracking-wider text-[10px] text-slate-500 border-b border-slate-200">
            <tr>
              <th className="p-3 pl-4 w-12 font-mono sticky left-0 bg-slate-50 z-10">NO</th>
              <th className="p-3 font-mono sticky left-14 bg-slate-50 z-10">Master ID</th>
              <th className="p-3 font-mono sticky left-36 bg-slate-50 z-10 border-r border-slate-200">Candidate Name</th>
              <th className="p-3">Gender / Age</th>
              <th className="p-3 font-mono">Passport No</th>
              <th className="p-3">Job Trade</th>
              <th className="p-3 text-center">Couple?</th>
              <th className="p-3">Company / Client</th>
              <th className="p-3 font-mono">SE / E No</th>
              <th className="p-3 text-center">Police Report</th>
              <th className="p-3 text-center">Visa Status</th>
              <th className="p-3">English Rating</th>
              <th className="p-3 whitespace-nowrap">Flight / Departure</th>
              <th className="p-3 whitespace-nowrap">Reg Date</th>
              <th className="p-3 font-mono">Card No</th>
              {showFullColumns && (
                <>
                  <th className="p-3 font-mono">NIC Number</th>
                  <th className="p-3">Mobile Contact</th>
                  <th className="p-3">Living Place</th>
                  <th className="p-3">Registered By</th>
                </>
              )}
              <th className="p-3 pr-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-sans">
            {paginatedRows.length === 0 ? (
              <tr>
                <td colSpan={showFullColumns ? 20 : 16} className="p-10 text-center text-slate-400">
                  No master records found matching your filters.
                </td>
              </tr>
            ) : (
              paginatedRows.map((app, idx) => {
                const serialNo = (currentPage - 1) * pageSize + idx + 1;
                const policeOk = app.police_report_ready || app.police_report_status === 'OK';
                const cardNo =
                  app.register_card_no ||
                  (app.registration_number ? app.registration_number.replace('REG-', 'RC-') : 'RC-2601');

                return (
                  <tr key={app.applicant_id} className="hover:bg-slate-50/80 transition group">
                    <td className="p-3 pl-4 font-mono font-bold text-slate-400 sticky left-0 bg-white group-hover:bg-slate-50 z-10">
                      {serialNo}
                    </td>

                    <td className="p-3 font-mono font-bold text-slate-900 sticky left-14 bg-white group-hover:bg-slate-50 z-10 whitespace-nowrap">
                      {app.applicant_id}
                    </td>

                    <td className="p-3 font-bold text-slate-900 sticky left-36 bg-white group-hover:bg-slate-50 z-10 border-r border-slate-200 whitespace-nowrap">
                      <span>{app.full_name}</span>
                      <span className="text-[10px] text-slate-400 font-mono block">Ref: {app.registration_number}</span>
                    </td>

                    <td className="p-3 whitespace-nowrap">
                      <span
                        className={`text-[11px] font-bold px-1.5 py-0.5 rounded font-mono ${
                          app.gender === 'Female' ? 'bg-teal-50 text-teal-700' : 'bg-blue-50 text-blue-700'
                        }`}
                      >
                        {app.gender}
                      </span>
                      {app.age && <span className="text-slate-400 text-[11px] ml-1">· {app.age} yrs</span>}
                    </td>

                    <td className="p-3 font-mono font-bold text-slate-800 whitespace-nowrap">
                      <span className="px-2 py-0.5 bg-slate-100 rounded border border-slate-200">
                        {app.passport_number || 'PENDING'}
                      </span>
                    </td>

                    <td className="p-3 uppercase font-semibold text-slate-800 whitespace-nowrap">
                      {app.preferred_job_category}
                    </td>

                    <td className="p-3 text-center whitespace-nowrap">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          app.applied_as_couple === 'Yes'
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {app.applied_as_couple || 'No'}
                      </span>
                    </td>

                    <td className="p-3 whitespace-nowrap font-medium text-slate-800">
                      {app.company_name && app.company_name !== 'None' ? app.company_name : 'DUNNAREA HOTEL'}
                    </td>

                    <td className="p-3 font-mono text-[11px] whitespace-nowrap">
                      {app.se_number ? (
                        <span className="text-emerald-700 font-semibold">{app.se_number}</span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                      {app.e_number && <span className="text-blue-700 block font-semibold">{app.e_number}</span>}
                    </td>

                    <td className="p-3 text-center whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                          policeOk ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {policeOk ? 'OK' : 'Pending'}
                      </span>
                    </td>

                    <td className="p-3 text-center whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          app.visa_status === 'OK'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {app.visa_status || 'Pending'}
                      </span>
                    </td>

                    <td className="p-3 whitespace-nowrap">
                      <span className="text-xs font-semibold text-slate-800">
                        {app.english_rating || app.english_status || 'Good'}
                      </span>
                      {app.english_attempt_1 && (
                        <span className="text-[10px] text-slate-400 font-mono ml-1">
                          ({app.english_attempt_1}%)
                        </span>
                      )}
                    </td>

                    <td className="p-3 font-mono text-[11px] whitespace-nowrap text-slate-700">
                      {app.departure_date ? `${app.departure_date} (${app.flight_number || 'UL-102'})` : '—'}
                    </td>

                    <td className="p-3 font-mono text-slate-600 whitespace-nowrap">
                      {app.registration_date}
                    </td>

                    <td className="p-3 font-mono font-bold text-emerald-800 whitespace-nowrap">
                      <span className="px-2 py-0.5 bg-emerald-50 rounded border border-emerald-200">
                        {cardNo}
                      </span>
                    </td>

                    {showFullColumns && (
                      <>
                        <td className="p-3 font-mono text-slate-600 whitespace-nowrap">{app.nic_number || '—'}</td>
                        <td className="p-3 font-mono text-slate-600 whitespace-nowrap">{app.mobile_number}</td>
                        <td className="p-3 text-slate-600 whitespace-nowrap">{app.living_place || 'Colombo'}</td>
                        <td className="p-3 text-slate-600 whitespace-nowrap">{app.register_by || app.staff_name || 'Althaf Hussain'}</td>
                      </>
                    )}

                    <td className="p-3 pr-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleOpenEdit(app)}
                          className="p-1 px-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
                        >
                          <Edit2 className="w-3 h-3 text-slate-600" />
                          <span>Edit</span>
                        </button>
                        <button
                          onClick={() => onPrintApplicant(app.applicant_id)}
                          className="p-1 px-2 bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 rounded-lg text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
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
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* 4. PAGINATION FOOTER */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 pt-2 border-t border-slate-100">
        <span>
          Showing {Math.min((currentPage - 1) * pageSize + 1, filteredRows.length)} to{' '}
          {Math.min(currentPage * pageSize, filteredRows.length)} of {filteredRows.length} total master records
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

      {/* ============================================================== */}
      {/* MODAL 1: IMPORT TABLE & EXCEL DATA                            */}
      {/* ============================================================== */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-xl w-full border border-slate-200 shadow-2xl p-6 space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700">
                  <Upload className="w-4 h-4" />
                </span>
                <h3 className="font-bold text-base text-slate-900">Import Master Records Table</h3>
              </div>
              <button
                onClick={() => setShowImportModal(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              Upload an Excel (.xlsx, .csv) spreadsheet, or copy and paste tabular rows directly from Google Sheets or Excel with all column headers.
            </p>

            {/* File Upload Option */}
            <div className="p-4 rounded-xl border border-dashed border-slate-300 bg-slate-50/50 flex flex-col items-center justify-center gap-2">
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileUpload}
                id="file-upload-input"
                className="hidden"
              />
              <label
                htmlFor="file-upload-input"
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer flex items-center gap-2"
              >
                <Upload className="w-3.5 h-3.5 text-emerald-400" />
                <span>Select Excel File (.xlsx / .csv)</span>
              </label>
              <span className="text-[11px] text-slate-400">All column headers will be mapped directly to candidate fields.</span>
            </div>

            {/* Paste Data Option */}
            <div className="space-y-2">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Or Paste Tab-Separated Data from Google Sheets
              </label>
              <textarea
                rows={5}
                placeholder="Paste rows including header: NO, NAME, PP NO, PREFERRED JOB CATEGORY, REGISTER DATE..."
                value={pasteData}
                onChange={(e) => setPasteData(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setShowImportModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleImportPastedData}
                disabled={isImporting || !pasteData.trim()}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer disabled:opacity-50"
              >
                {isImporting ? 'Importing...' : 'Import Pasted Table'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 2: QUICK EDIT RECORD                                     */}
      {/* ============================================================== */}
      {editingApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-xl w-full border border-slate-200 shadow-2xl p-6 space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-slate-200">
              <div>
                <span className="text-[10px] font-bold uppercase text-emerald-700 font-mono">
                  EDIT ALL MASTER RECORD
                </span>
                <h3 className="font-bold text-base text-slate-900">
                  {editingApp.full_name} ({editingApp.applicant_id})
                </h3>
              </div>
              <button
                onClick={() => setEditingApp(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Full Name</label>
                <input
                  type="text"
                  value={editForm.full_name}
                  onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Passport Number</label>
                <input
                  type="text"
                  value={editForm.passport_number}
                  onChange={(e) => setEditForm({ ...editForm, passport_number: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Job Category</label>
                <input
                  type="text"
                  value={editForm.preferred_job_category}
                  onChange={(e) => setEditForm({ ...editForm, preferred_job_category: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Register Card No</label>
                <input
                  type="text"
                  value={editForm.register_card_no}
                  onChange={(e) => setEditForm({ ...editForm, register_card_no: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-bold text-emerald-800"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Apply as Couple?</label>
                <select
                  value={editForm.applied_as_couple}
                  onChange={(e) => setEditForm({ ...editForm, applied_as_couple: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold"
                >
                  <option value="No">No (Individual)</option>
                  <option value="Yes">Yes (Couple)</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Registered By</label>
                <input
                  type="text"
                  value={editForm.register_by}
                  onChange={(e) => setEditForm({ ...editForm, register_by: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Company</label>
                <input
                  type="text"
                  value={editForm.company_name}
                  onChange={(e) => setEditForm({ ...editForm, company_name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Visa Status</label>
                <select
                  value={editForm.visa_status}
                  onChange={(e) => setEditForm({ ...editForm, visa_status: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs"
                >
                  <option value="Pending">Pending</option>
                  <option value="APPLIED">Applied at Embassy</option>
                  <option value="OK">Visa Issued (OK)</option>
                  <option value="Rejected">Rejected</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
              <button
                onClick={() => setEditingApp(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={isSavingEdit}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer"
              >
                {isSavingEdit ? 'Saving...' : 'Save Updates'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
