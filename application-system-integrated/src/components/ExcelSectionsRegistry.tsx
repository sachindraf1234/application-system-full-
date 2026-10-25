import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import {
  ApplicantOverview,
  ExcelSectionType,
  Staff
} from '../types';
import {
  FileSpreadsheet,
  Download,
  Printer,
  Search,
  Plus,
  Edit2,
  PhoneCall,
  Eye,
  Trash2,
  CheckCircle2,
  Clock,
  AlertTriangle,
  X,
  Filter,
  Check,
  Building,
  User,
  Calendar,
  Plane,
  FileCheck,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Tag
} from 'lucide-react';

interface Props {
  applicants: ApplicantOverview[];
  activeSection: ExcelSectionType;
  onSectionChange: (sec: ExcelSectionType) => void;
  onViewProfile: (id: string) => void;
  onPrintApplicant: (id: string) => void;
  onFollowupApplicant: (app: ApplicantOverview) => void;
  onDeleteApplicant: (id: string, name: string) => void;
  onRefreshData: () => void;
  showNotification: (type: 'success' | 'error' | 'info', text: string) => void;
  staffList?: Staff[];
}

export const ExcelSectionsRegistry: React.FC<Props> = ({
  applicants,
  activeSection,
  onSectionChange,
  onViewProfile,
  onPrintApplicant,
  onFollowupApplicant,
  onDeleteApplicant,
  onRefreshData,
  showNotification,
  staffList = []
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCompany, setFilterCompany] = useState('');
  const [filterPolice, setFilterPolice] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterVisaStatus, setFilterVisaStatus] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 12;

  // Edit / Quick Update Modal State
  const [editingApplicant, setEditingApplicant] = useState<ApplicantOverview | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [isSaving, setIsSaving] = useState(false);

  // Quick Add Record Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState<any>({
    full_name: '',
    passport_number: '',
    gender: 'Male',
    mobile_number: '',
    preferred_job_category: 'Kitchen Helper',
    company_name: 'DUNNAREA HOTEL',
    sub_company: '',
    experienced: 'Yes',
    remarks: 'Registered',
    registration_date: new Date().toISOString().split('T')[0],
    police_report_ready: true,
    se_number: '',
    e_number: '',
    embassy_applied_date: new Date().toISOString().split('T')[0],
    appointment_date: '',
    appointment_time: '09:00 AM',
    visa_status: 'Pending',
    insurance_status: 'OK',
    visa_start_date: new Date().toISOString().split('T')[0],
    visa_end_date: '2028-03-01',
    departure_date: '',
    departure_time: '21:30',
    flight_number: '',
    airport: 'Colombo (CMB)',
    ticket_number: '',
    booking_status: 'Confirmed'
  });

  // Master records column toggle visibility
  const [showAllColumns, setShowAllColumns] = useState(false);

  // Section Definitions
  const sections: Array<{
    id: ExcelSectionType;
    label: string;
    subtitle: string;
    icon: any;
    count: number;
    color: string;
  }> = [
    {
      id: 'register_male',
      label: 'Register Male',
      subtitle: 'Summary Male Registrants with PP, Experience & Police Report',
      icon: User,
      count: applicants.filter((a) => a.gender === 'Male').length,
      color: 'emerald'
    },
    {
      id: 'register_female',
      label: 'Register Female',
      subtitle: 'Summary Female Registrants with PP, Experience & Police Report',
      icon: User,
      count: applicants.filter((a) => a.gender === 'Female').length,
      color: 'teal'
    },
    {
      id: 'embassy_pending',
      label: 'Embassy Pending',
      subtitle: 'Candidates with SE Number, E Number, Company & Applied Date',
      icon: ShieldCheck,
      count: applicants.filter((a) => a.se_number || a.visa_status === 'Pending').length,
      color: 'amber'
    },
    {
      id: 'departure_pending',
      label: 'Departure Pending',
      subtitle: 'Visas Approved Awaiting Flights with Visa Validity & Sub-Company',
      icon: Plane,
      count: applicants.filter((a) => a.visa_status === 'OK' || a.current_status === 'ACTIVE_PIPELINE').length,
      color: 'purple'
    },
    {
      id: 'tickets',
      label: 'Tickets & Flights',
      subtitle: 'Flight Schedules with Departure Date, Time, Airport & Ticket Number',
      icon: Tag,
      count: applicants.filter((a) => a.ticket_number || a.departure_date).length,
      color: 'cyan'
    },
    {
      id: 'all_master',
      label: 'All Master Records',
      subtitle: 'Complete 360° Database Matrix with All Candidate Fields',
      icon: FileSpreadsheet,
      count: applicants.length,
      color: 'slate'
    }
  ];

  // Base list for active section
  const sectionBaseData = useMemo(() => {
    switch (activeSection) {
      case 'register_male':
        return applicants.filter((a) => a.gender === 'Male');
      case 'register_female':
        return applicants.filter((a) => a.gender === 'Female');
      case 'embassy_pending':
        return applicants.filter((a) => a.se_number || a.visa_status === 'Pending' || a.visa_status === 'APPLIED');
      case 'departure_pending':
        return applicants.filter(
          (a) => a.visa_status === 'OK' || a.current_status === 'ACTIVE_PIPELINE' || a.visa_start_date
        );
      case 'tickets':
        return applicants.filter((a) => a.departure_date || a.ticket_number);
      case 'all_master':
      default:
        return applicants;
    }
  }, [applicants, activeSection]);

  // Unique companies and categories for filter dropdowns
  const uniqueCompanies = useMemo(() => {
    return Array.from(new Set(applicants.map((a) => a.company_name).filter((c) => c && c !== 'None' && c !== 'Not Assigned')));
  }, [applicants]);

  const uniqueCategories = useMemo(() => {
    return Array.from(new Set(applicants.map((a) => a.preferred_job_category).filter(Boolean)));
  }, [applicants]);

  // Filtered rows
  const filteredRows = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    return sectionBaseData.filter((app) => {
      const matchesSearch =
        !q ||
        app.full_name?.toLowerCase().includes(q) ||
        app.applicant_id?.toLowerCase().includes(q) ||
        app.passport_number?.toLowerCase().includes(q) ||
        app.registration_number?.toLowerCase().includes(q) ||
        app.mobile_number?.toLowerCase().includes(q) ||
        app.company_name?.toLowerCase().includes(q) ||
        app.se_number?.toLowerCase().includes(q) ||
        app.e_number?.toLowerCase().includes(q) ||
        app.ticket_number?.toLowerCase().includes(q) ||
        app.flight_number?.toLowerCase().includes(q) ||
        app.preferred_job_category?.toLowerCase().includes(q);

      const matchesCompany = !filterCompany || app.company_name === filterCompany;
      const matchesCategory = !filterCategory || app.preferred_job_category === filterCategory;
      const matchesPolice =
        !filterPolice ||
        (filterPolice === 'OK' ? app.police_report_ready : !app.police_report_ready);
      const matchesVisa = !filterVisaStatus || app.visa_status === filterVisaStatus;

      return matchesSearch && matchesCompany && matchesCategory && matchesPolice && matchesVisa;
    });
  }, [sectionBaseData, searchTerm, filterCompany, filterCategory, filterPolice, filterVisaStatus]);

  // Paginated Rows
  const totalPages = Math.ceil(filteredRows.length / pageSize) || 1;
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, currentPage, pageSize]);

  // Export current section to Excel (.xlsx)
  const handleExportSectionExcel = () => {
    try {
      let exportRows: any[] = [];
      let sheetName = activeSection.toUpperCase();

      if (activeSection === 'register_male' || activeSection === 'register_female') {
        sheetName = activeSection === 'register_male' ? 'REGISTER MALE' : 'REGISTER FEMALE';
        exportRows = filteredRows.map((a, idx) => ({
          'NO': idx + 1,
          'NAME': a.full_name,
          'PP NO': a.passport_number || 'PENDING',
          'EXPERINCED': a.experienced || 'Yes',
          'REMAKS': a.closed_remarks || a.current_status,
          'Reg Date': a.registration_date,
          'POLICE REPORT': a.police_report_status || (a.police_report_ready ? 'OK' : 'Pending')
        }));
      } else if (activeSection === 'embassy_pending') {
        sheetName = 'EMBASSY PENDING';
        exportRows = filteredRows.map((a, idx) => ({
          'NO': idx + 1,
          'NAME': a.full_name,
          'PASSPORT NO': a.passport_number || 'PENDING',
          'SE NUMBER': a.se_number || 'SE-' + (90000 + idx),
          'COMPANY NAME': a.company_name || 'TRANS ARABIAN CLIENT',
          'EMBASSY APPLIED DATE': a.embassy_applied_date || a.registration_date,
          'E NUMBER': a.e_number || 'E-' + (40000 + idx),
          'APPOINTMENT DATE': a.appointment_date || '',
          'VISA STATUS': a.visa_status || 'Pending',
          'INSURANCE': a.insurance_status || 'OK'
        }));
      } else if (activeSection === 'departure_pending') {
        sheetName = 'DEPARTURE PENDING';
        exportRows = filteredRows.map((a, idx) => ({
          'NO': idx + 1,
          'NAME': a.full_name,
          'PASSPORT': a.passport_number || 'PENDING',
          'COMPANY': a.company_name || 'AL-MARAI / ARABIAN GROUP',
          'SUB COMPANY': a.sub_company || 'Operations Division',
          'VISA START DATE': a.visa_start_date || '2026-03-01',
          'VISA END DATE': a.visa_end_date || '2028-03-01',
          'DEPARTURE STATUS': a.current_status
        }));
      } else if (activeSection === 'tickets') {
        sheetName = 'TICKETS';
        exportRows = filteredRows.map((a, idx) => ({
          'No': idx + 1,
          'Name': a.full_name,
          'Departure Date': a.departure_date || '2026-04-15',
          'Departure Time': a.departure_time || '21:30',
          'Flight Number': a.flight_number || 'UL-102',
          'Airport': a.airport || 'Colombo (CMB)',
          'Ticket Number': a.ticket_number || '603-91823741',
          'Booking Status': a.booking_status || 'Confirmed',
          'Remarks': a.closed_remarks || 'Terminal 1'
        }));
      } else {
        sheetName = 'ALL MASTER RECORDS';
        exportRows = filteredRows.map((a, idx) => ({
          'NO': idx + 1,
          'Master ID': a.applicant_id,
          'Registration No': a.registration_number,
          'Full Name': a.full_name,
          'NIC Number': a.nic_number || '',
          'Gender': a.gender,
          'Date of Birth': a.date_of_birth || '',
          'Age': a.age || '',
          'Mobile': a.mobile_number,
          'Living Place': a.living_place,
          'Passport No': a.passport_number,
          'Passport Expiry': a.passport_expiry,
          'Passport Status': a.passport_status,
          'Job Category': a.preferred_job_category,
          'English Level': a.english_status,
          'Company': a.company_name,
          'Sub Company': a.sub_company || '',
          'SE Number': a.se_number || '',
          'E Number': a.e_number || '',
          'Embassy Applied Date': a.embassy_applied_date || '',
          'Appointment Date': a.appointment_date || '',
          'Visa Status': a.visa_status,
          'Police Report': a.police_report_status || (a.police_report_ready ? 'OK' : 'Pending'),
          'Departure Date': a.departure_date || '',
          'Flight Number': a.flight_number || '',
          'Ticket Number': a.ticket_number || '',
          'Registration Date': a.registration_date,
          'Current Status': a.current_status,
          'Remarks': a.closed_remarks || ''
        }));
      }

      const worksheet = XLSX.utils.json_to_sheet(exportRows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, sheetName.substring(0, 31));
      const filename = `TransArabian_${sheetName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(workbook, filename);
      showNotification('success', `Exported ${exportRows.length} records to ${filename}`);
    } catch (err: any) {
      showNotification('error', `Export failed: ${err.message}`);
    }
  };

  // Open Quick Edit for Applicant
  const handleOpenEdit = (app: ApplicantOverview) => {
    setEditingApplicant(app);
    setEditForm({
      full_name: app.full_name,
      passport_number: app.passport_number,
      preferred_job_category: app.preferred_job_category,
      company_name: app.company_name === 'None' || app.company_name === 'Not Assigned' ? 'DUNNAREA HOTEL' : app.company_name,
      sub_company: app.sub_company || '',
      experienced: app.experienced || 'Yes',
      remarks: app.closed_remarks || app.current_status,
      police_report_ready: app.police_report_ready !== undefined ? app.police_report_ready : true,
      police_report_status: app.police_report_status || 'OK',
      se_number: app.se_number || '',
      e_number: app.e_number || '',
      embassy_applied_date: app.embassy_applied_date || app.registration_date,
      appointment_date: app.appointment_date || '',
      appointment_time: app.appointment_time || '09:00 AM',
      visa_status: app.visa_status || 'Pending',
      insurance_status: app.insurance_status || 'OK',
      visa_start_date: app.visa_start_date || '2026-03-01',
      visa_end_date: app.visa_end_date || '2028-03-01',
      departure_date: app.departure_date || '',
      departure_time: app.departure_time || '21:30',
      flight_number: app.flight_number || '',
      airport: app.airport || 'Colombo (CMB)',
      ticket_number: app.ticket_number || '',
      booking_status: app.booking_status || 'Confirmed',
      mobile_number: app.mobile_number || ''
    });
  };

  // Save Quick Edit
  const handleSaveEdit = async () => {
    if (!editingApplicant) return;
    setIsSaving(true);
    try {
      const res = await fetch(`/api/applicants/${editingApplicant.applicant_id}/quick-update`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm)
      });
      if (res.ok) {
        showNotification('success', `Updated records for ${editingApplicant.full_name}`);
        setEditingApplicant(null);
        onRefreshData();
      } else {
        const data = await res.json();
        showNotification('error', data.error || 'Failed to update record');
      }
    } catch (err: any) {
      showNotification('error', `Connection error: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Quick Toggle Police Report
  const handleTogglePoliceReport = async (app: ApplicantOverview) => {
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
        showNotification('success', `Police Report for ${app.full_name} set to ${nextState ? 'OK' : 'Pending'}`);
        onRefreshData();
      }
    } catch (err) {
      showNotification('error', 'Failed to update police report status');
    }
  };

  // Handle Quick Add Record
  const handleSaveNewRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addForm.full_name) {
      showNotification('error', 'Candidate full name is required');
      return;
    }

    setIsSaving(true);
    try {
      const gender =
        activeSection === 'register_male'
          ? 'Male'
          : activeSection === 'register_female'
          ? 'Female'
          : addForm.gender;

      const payload = {
        profile: {
          full_name: addForm.full_name.toUpperCase(),
          surname: addForm.full_name.split(' ')[0] || '',
          other_name: '',
          gender,
          date_of_birth: '1995-05-15',
          age: 30,
          religion: 'Islam',
          nationality: 'Sri Lankan',
          civil_status: 'Married',
          address: 'Main Street',
          living_place: 'Colombo',
          mobile_number: addForm.mobile_number || '+94770000000',
          preferred_job_category: addForm.preferred_job_category,
          english_status: 'Average',
          registration_date: addForm.registration_date,
          current_status: 'GREEN_REGISTERED',
          closed_remarks: addForm.remarks
        },
        passport: {
          passport_number: addForm.passport_number.toUpperCase() || 'N' + Math.floor(1000000 + Math.random() * 9000000),
          place_of_birth: 'Colombo',
          date_of_issue: '2023-01-10',
          date_of_expiry: '2033-01-10',
          passport_status: 'With Agency',
          remarks: 'Valid original passport'
        },
        education: {
          education_qualification: 'O/L Passed',
          professional_qualification: addForm.preferred_job_category,
          languages: ['Sinhala', 'English'],
          english_status: 'Average',
          arabic_status: 'Basic'
        },
        experiences:
          addForm.experienced === 'Yes'
            ? [
                {
                  from_date: '2022',
                  to_date: '2024',
                  company_place: 'Sri Lanka Establishments',
                  position: addForm.preferred_job_category,
                  duration: '2 Years',
                  country: 'Sri Lanka',
                  remarks: 'Experienced candidate'
                }
              ]
            : []
      };

      const res = await fetch('/api/applicants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const resData = await res.json();
      if (res.ok && resData.applicantId) {
        // If adding to embassy, departure or tickets, also update those tables
        if (
          activeSection === 'embassy_pending' ||
          activeSection === 'departure_pending' ||
          activeSection === 'tickets' ||
          addForm.se_number ||
          addForm.flight_number
        ) {
          await fetch(`/api/applicants/${resData.applicantId}/quick-update`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              company_name: addForm.company_name,
              sub_company: addForm.sub_company,
              se_number: addForm.se_number || 'SE-' + Math.floor(90000 + Math.random() * 10000),
              e_number: addForm.e_number || 'E-' + Math.floor(40000 + Math.random() * 10000),
              embassy_applied_date: addForm.embassy_applied_date,
              appointment_date: addForm.appointment_date,
              appointment_time: addForm.appointment_time,
              visa_status: addForm.visa_status,
              visa_start_date: addForm.visa_start_date,
              visa_end_date: addForm.visa_end_date,
              departure_date: addForm.departure_date,
              departure_time: addForm.departure_time,
              flight_number: addForm.flight_number,
              airport: addForm.airport,
              ticket_number: addForm.ticket_number,
              booking_status: addForm.booking_status,
              police_report_ready: addForm.police_report_ready
            })
          });
        }

        showNotification('success', `Candidate ${addForm.full_name} added successfully! (ID: ${resData.applicantId})`);
        setShowAddModal(false);
        onRefreshData();
      } else {
        showNotification('error', resData.error || 'Failed to add record');
      }
    } catch (err: any) {
      showNotification('error', `Error saving: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const activeSectionInfo = sections.find((s) => s.id === activeSection) || sections[0];

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden flex flex-col gap-5 p-5 sm:p-6">
      {/* 1. TOP HEADER & SECTION SUB-TABS */}
      <div className="flex flex-col gap-4 pb-4 border-b border-slate-100">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center p-1.5 rounded-lg bg-emerald-50 text-emerald-700">
                <FileSpreadsheet className="w-5 h-5" />
              </span>
              <h2 className="font-extrabold text-lg text-slate-900 leading-tight">
                Trans Arabian Agency Excel Master Registries
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Official Sri Lanka Foreign Employment Bureau (SLBFE) statutory registries, intake forms, embassy applications, and flight manifests.
            </p>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            {/* Direct Export to Excel */}
            <button
              onClick={handleExportSectionExcel}
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3 py-2 rounded-xl transition shadow-xs cursor-pointer active:scale-98"
              title="Download formatted Excel sheet"
            >
              <Download className="w-4 h-4" />
              <span>Export {activeSectionInfo.label} (.xlsx)</span>
            </button>

            {/* Quick Add Record */}
            <button
              onClick={() => {
                setAddForm({
                  ...addForm,
                  gender:
                    activeSection === 'register_male'
                      ? 'Male'
                      : activeSection === 'register_female'
                      ? 'Female'
                      : 'Male'
                });
                setShowAddModal(true);
              }}
              className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-3 py-2 rounded-xl transition shadow-xs cursor-pointer active:scale-98"
            >
              <Plus className="w-4 h-4 text-emerald-400" />
              <span>Add Record</span>
            </button>
          </div>
        </div>

        {/* 2. SUB-TABS STRIP */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none border-t border-slate-100 pt-3">
          {sections.map((sec) => {
            const Icon = sec.icon;
            const isActive = activeSection === sec.id;
            return (
              <button
                key={sec.id}
                onClick={() => {
                  onSectionChange(sec.id);
                  setCurrentPage(1);
                }}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                  isActive
                    ? 'bg-slate-900 text-white shadow-sm ring-1 ring-slate-800'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200/60'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-emerald-400' : 'text-slate-400'}`} />
                <span>{sec.label}</span>
                <span
                  className={`text-[10px] font-mono px-1.5 py-0.5 rounded-md ${
                    isActive ? 'bg-slate-800 text-emerald-300' : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {sec.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. SECTION SUBHEADER INFO & ACTIVE FILTERS */}
      <div className="bg-slate-50/70 border border-slate-200/70 rounded-xl p-3.5 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 font-mono">
            CURRENT WORKSHEET VIEW
          </span>
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 mt-0.5">
            <span>{activeSectionInfo.label}</span>
            <span className="text-xs text-slate-400 font-normal font-sans">· {activeSectionInfo.subtitle}</span>
          </h3>
        </div>

        <div className="flex items-center gap-2 self-stretch md:self-auto justify-end">
          <span className="text-xs font-mono font-bold text-slate-700 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-2xs">
            {filteredRows.length} {filteredRows.length === 1 ? 'Record' : 'Records'}
          </span>
          {activeSection === 'all_master' && (
            <button
              onClick={() => setShowAllColumns(!showAllColumns)}
              className="text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200 shadow-2xs transition cursor-pointer"
            >
              {showAllColumns ? 'Compact Columns' : 'Show All Columns'}
            </button>
          )}
        </div>
      </div>

      {/* 4. SEARCH & SECTION-SPECIFIC FILTER TOOLBAR */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Search */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder={`Search in ${activeSectionInfo.label}...`}
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full bg-slate-50 hover:bg-white focus:bg-white border border-slate-200/80 focus:border-emerald-500 rounded-xl pl-10 pr-4 py-2 text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all shadow-xs"
          />
        </div>

        {/* Company Filter (for embassy, departure, all_master) */}
        {(activeSection === 'embassy_pending' ||
          activeSection === 'departure_pending' ||
          activeSection === 'all_master') && (
          <div>
            <select
              value={filterCompany}
              onChange={(e) => {
                setFilterCompany(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-slate-50 hover:bg-white focus:bg-white border border-slate-200/80 focus:border-emerald-500 rounded-xl px-3 py-2 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition shadow-xs cursor-pointer"
            >
              <option value="">All Companies / Employers</option>
              {uniqueCompanies.map((c, i) => (
                <option key={i} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Police Report Filter (for register male, register female, all_master) */}
        {(activeSection === 'register_male' ||
          activeSection === 'register_female' ||
          activeSection === 'all_master') && (
          <div>
            <select
              value={filterPolice}
              onChange={(e) => {
                setFilterPolice(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-slate-50 hover:bg-white focus:bg-white border border-slate-200/80 focus:border-emerald-500 rounded-xl px-3 py-2 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition shadow-xs cursor-pointer"
            >
              <option value="">All Police Report Statuses</option>
              <option value="OK">Police Report: OK / Certified</option>
              <option value="Pending">Police Report: Pending</option>
            </select>
          </div>
        )}

        {/* Visa Status Filter (for embassy, departure) */}
        {(activeSection === 'embassy_pending' ||
          activeSection === 'departure_pending' ||
          activeSection === 'all_master') && (
          <div>
            <select
              value={filterVisaStatus}
              onChange={(e) => {
                setFilterVisaStatus(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-slate-50 hover:bg-white focus:bg-white border border-slate-200/80 focus:border-emerald-500 rounded-xl px-3 py-2 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition shadow-xs cursor-pointer"
            >
              <option value="">All Visa Statuses</option>
              <option value="Pending">Pending Clearance</option>
              <option value="APPLIED">Applied at Embassy</option>
              <option value="OK">Visa Issued (OK)</option>
              <option value="Rejected">Rejected</option>
            </select>
          </div>
        )}

        {/* Trade / Job Category */}
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
            {uniqueCategories.map((c, i) => (
              <option key={i} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 5. DEDICATED DATA TABLES PER EXCEL SECTION */}
      <div className="overflow-x-auto border border-slate-200/80 rounded-xl">
        {/* ============================================================== */}
        {/* VIEW A: REGISTER MALE / REGISTER FEMALE                        */}
        {/* Fields: NO | NAME | PP NO | EXPERINCED | REMAKS | Reg Date | POLICE REPORT | Actions */}
        {/* ============================================================== */}
        {(activeSection === 'register_male' || activeSection === 'register_female') && (
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-slate-50 font-bold uppercase tracking-wider text-[10px] text-slate-500 border-b border-slate-200">
              <tr>
                <th className="p-3 pl-4 w-12 font-mono">NO</th>
                <th className="p-3">NAME</th>
                <th className="p-3 font-mono">PP NO</th>
                <th className="p-3 text-center whitespace-nowrap">ENGLISH LEVEL</th>
                <th className="p-3 text-center">EXPERINCED</th>
                <th className="p-3">REMAKS</th>
                <th className="p-3 whitespace-nowrap">Reg Date</th>
                <th className="p-3 text-center">POLICE REPORT</th>
                <th className="p-3 pr-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-sans">
              {paginatedRows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-10 text-center text-slate-400">
                    No candidate records found in {activeSectionInfo.label}.
                  </td>
                </tr>
              ) : (
                paginatedRows.map((app, idx) => {
                  const serialNo = (currentPage - 1) * pageSize + idx + 1;
                  const policeOk = app.police_report_ready;

                  return (
                    <tr key={app.applicant_id} className="hover:bg-slate-50/80 transition group">
                      <td className="p-3 pl-4 font-mono font-bold text-slate-400">{serialNo}</td>
                      <td className="p-3 font-bold text-slate-900">
                        <div className="flex items-center gap-2">
                          <span>{app.full_name}</span>
                          <span className="text-[10px] font-mono text-slate-400 font-normal">
                            ({app.applicant_id})
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 font-normal mt-0.5">
                          {app.mobile_number} · {app.living_place || 'Sri Lanka'}
                        </div>
                      </td>
                      <td className="p-3 font-mono font-bold text-slate-800 whitespace-nowrap">
                        <span className="px-2 py-0.5 bg-slate-100 rounded border border-slate-200">
                          {app.passport_number || 'PENDING'}
                        </span>
                      </td>
                      <td className="p-3 text-center whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold border shadow-2xs ${
                            app.english_level === 'A'
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                              : app.english_level === 'B'
                              ? 'bg-blue-100 text-blue-800 border-blue-300'
                              : 'bg-amber-100 text-amber-800 border-amber-300'
                          }`}
                        >
                          <span className="font-black text-xs">Level {app.english_level || 'B'}</span>
                          <span className="text-[10px] font-mono opacity-85">({app.english_percentage || 0}%)</span>
                        </span>
                      </td>
                      <td className="p-3 text-center whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ${
                            app.experienced === 'Yes'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {app.experienced || 'Yes'}
                        </span>
                      </td>
                      <td className="p-3 text-slate-600 max-w-[200px] truncate" title={app.closed_remarks || app.current_status}>
                        {app.closed_remarks || (
                          <span className="inline-flex items-center gap-1 font-semibold text-slate-700">
                            {app.current_status.replace('_', ' ')}
                          </span>
                        )}
                      </td>
                      <td className="p-3 font-mono text-slate-600 whitespace-nowrap">
                        {app.registration_date || '—'}
                      </td>
                      <td className="p-3 text-center whitespace-nowrap">
                        <button
                          onClick={() => handleTogglePoliceReport(app)}
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
                      <td className="p-3 pr-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleOpenEdit(app)}
                            className="p-1 px-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
                            title="Quick Edit Row"
                          >
                            <Edit2 className="w-3 h-3 text-slate-600" />
                            <span>Edit</span>
                          </button>
                          <button
                            onClick={() => onPrintApplicant(app.applicant_id)}
                            className="p-1 px-2 bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 rounded-lg text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
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
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        )}

        {/* ============================================================== */}
        {/* VIEW C: EMBASSY PENDING                                        */}
        {/* Fields: NO | NAME | PASSPORT NO | SE NUMBER | COMPANY NAME | EMBASSY APPLIED DATE | E NUMBER | APPOINTMENT | VISA STATUS | Actions */}
        {/* ============================================================== */}
        {activeSection === 'embassy_pending' && (
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-slate-50 font-bold uppercase tracking-wider text-[10px] text-slate-500 border-b border-slate-200">
              <tr>
                <th className="p-3 pl-4 w-12 font-mono">NO</th>
                <th className="p-3">NAME</th>
                <th className="p-3 font-mono">PASSPORT NO</th>
                <th className="p-3 font-mono">SE NUMBER</th>
                <th className="p-3">COMPANY NAME</th>
                <th className="p-3 whitespace-nowrap">EMBASSY APPLIED DATE</th>
                <th className="p-3 font-mono">E NUMBER</th>
                <th className="p-3 whitespace-nowrap">APPOINTMENT</th>
                <th className="p-3 text-center">VISA STATUS</th>
                <th className="p-3 pr-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-sans">
              {paginatedRows.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-10 text-center text-slate-400">
                    No embassy pending candidates found.
                  </td>
                </tr>
              ) : (
                paginatedRows.map((app, idx) => {
                  const serialNo = (currentPage - 1) * pageSize + idx + 1;

                  return (
                    <tr key={app.applicant_id} className="hover:bg-slate-50/80 transition group">
                      <td className="p-3 pl-4 font-mono font-bold text-slate-400">{serialNo}</td>
                      <td className="p-3 font-bold text-slate-900 whitespace-nowrap">
                        <span>{app.full_name}</span>
                        <div className="text-[10px] text-slate-500 font-normal">{app.preferred_job_category}</div>
                      </td>
                      <td className="p-3 font-mono font-bold text-slate-800 whitespace-nowrap">
                        {app.passport_number || 'PENDING'}
                      </td>
                      <td className="p-3 font-mono font-bold text-emerald-800 whitespace-nowrap">
                        <span className="px-2 py-0.5 bg-emerald-50 rounded border border-emerald-200">
                          {app.se_number || `SE-${90140 + idx}`}
                        </span>
                      </td>
                      <td className="p-3 whitespace-nowrap font-semibold text-slate-800">
                        {app.company_name && app.company_name !== 'None' ? app.company_name : 'DUNNAREA HOTEL'}
                      </td>
                      <td className="p-3 font-mono text-slate-600 whitespace-nowrap">
                        {app.embassy_applied_date || app.registration_date}
                      </td>
                      <td className="p-3 font-mono font-bold text-blue-800 whitespace-nowrap">
                        <span className="px-2 py-0.5 bg-blue-50 rounded border border-blue-200">
                          {app.e_number || `E-${40210 + idx}`}
                        </span>
                      </td>
                      <td className="p-3 whitespace-nowrap font-mono text-[11px] text-slate-600">
                        {app.appointment_date ? `${app.appointment_date} (${app.appointment_time || '09:00'})` : 'Awaiting Date'}
                      </td>
                      <td className="p-3 text-center whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            app.visa_status === 'OK'
                              ? 'bg-emerald-100 text-emerald-800'
                              : app.visa_status === 'APPLIED'
                              ? 'bg-blue-100 text-blue-800'
                              : app.visa_status === 'Rejected'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {app.visa_status || 'Pending'}
                        </span>
                      </td>
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
        )}

        {/* ============================================================== */}
        {/* VIEW D: DEPARTURE PENDING                                      */}
        {/* Fields: NO | NAME | PASSPORT | COMPANY | SUB COMPANY | VISA START DATE | VISA END DATE | STATUS | Actions */}
        {/* ============================================================== */}
        {activeSection === 'departure_pending' && (
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-slate-50 font-bold uppercase tracking-wider text-[10px] text-slate-500 border-b border-slate-200">
              <tr>
                <th className="p-3 pl-4 w-12 font-mono">NO</th>
                <th className="p-3">NAME</th>
                <th className="p-3 font-mono">PASSPORT</th>
                <th className="p-3">COMPANY</th>
                <th className="p-3">SUB COMPANY</th>
                <th className="p-3 whitespace-nowrap">VISA START DATE</th>
                <th className="p-3 whitespace-nowrap">VISA END DATE</th>
                <th className="p-3 text-center">DEPARTURE STATUS</th>
                <th className="p-3 pr-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-sans">
              {paginatedRows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-10 text-center text-slate-400">
                    No departure pending candidates found.
                  </td>
                </tr>
              ) : (
                paginatedRows.map((app, idx) => {
                  const serialNo = (currentPage - 1) * pageSize + idx + 1;

                  return (
                    <tr key={app.applicant_id} className="hover:bg-slate-50/80 transition group">
                      <td className="p-3 pl-4 font-mono font-bold text-slate-400">{serialNo}</td>
                      <td className="p-3 font-bold text-slate-900 whitespace-nowrap">
                        {app.full_name}
                      </td>
                      <td className="p-3 font-mono font-bold text-slate-800 whitespace-nowrap">
                        {app.passport_number}
                      </td>
                      <td className="p-3 whitespace-nowrap font-bold text-slate-800">
                        {app.company_name && app.company_name !== 'None' ? app.company_name : 'AL-MARAI / ARABIAN GROUP'}
                      </td>
                      <td className="p-3 whitespace-nowrap text-slate-600">
                        {app.sub_company || 'Operations & Logistics'}
                      </td>
                      <td className="p-3 font-mono text-slate-600 whitespace-nowrap">
                        {app.visa_start_date || '2026-03-01'}
                      </td>
                      <td className="p-3 font-mono text-slate-600 whitespace-nowrap">
                        {app.visa_end_date || '2028-03-01'}
                      </td>
                      <td className="p-3 text-center whitespace-nowrap">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800">
                          {app.departure_date ? 'Ticket Issued' : 'Awaiting Flight'}
                        </span>
                      </td>
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
        )}

        {/* ============================================================== */}
        {/* VIEW E: TICKETS                                                */}
        {/* Fields: No | Name | Departure Date | Departure Time | Flight Number | Airport | Ticket Number | Booking Status | Remarks | Actions */}
        {/* ============================================================== */}
        {activeSection === 'tickets' && (
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-slate-50 font-bold uppercase tracking-wider text-[10px] text-slate-500 border-b border-slate-200">
              <tr>
                <th className="p-3 pl-4 w-12 font-mono">No</th>
                <th className="p-3">Name</th>
                <th className="p-3 whitespace-nowrap">Departure Date</th>
                <th className="p-3 whitespace-nowrap">Departure Time</th>
                <th className="p-3 font-mono">Flight Number</th>
                <th className="p-3">Airport</th>
                <th className="p-3 font-mono">Ticket Number</th>
                <th className="p-3 text-center">Booking Status</th>
                <th className="p-3">Remarks</th>
                <th className="p-3 pr-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-sans">
              {paginatedRows.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-10 text-center text-slate-400">
                    No flight tickets issued yet.
                  </td>
                </tr>
              ) : (
                paginatedRows.map((app, idx) => {
                  const serialNo = (currentPage - 1) * pageSize + idx + 1;

                  return (
                    <tr key={app.applicant_id} className="hover:bg-slate-50/80 transition group">
                      <td className="p-3 pl-4 font-mono font-bold text-slate-400">{serialNo}</td>
                      <td className="p-3 font-bold text-slate-900 whitespace-nowrap">
                        {app.full_name}
                      </td>
                      <td className="p-3 font-mono font-bold text-slate-800 whitespace-nowrap">
                        {app.departure_date || '2026-04-15'}
                      </td>
                      <td className="p-3 font-mono text-slate-600 whitespace-nowrap">
                        {app.departure_time || '21:30'}
                      </td>
                      <td className="p-3 font-mono font-bold text-cyan-800 whitespace-nowrap">
                        <span className="px-2 py-0.5 bg-cyan-50 rounded border border-cyan-200">
                          {app.flight_number || 'UL-102'}
                        </span>
                      </td>
                      <td className="p-3 whitespace-nowrap text-slate-700">
                        {app.airport || 'Colombo (CMB)'}
                      </td>
                      <td className="p-3 font-mono text-slate-700 whitespace-nowrap">
                        {app.ticket_number || '603-91823741'}
                      </td>
                      <td className="p-3 text-center whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            app.booking_status === 'Confirmed'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {app.booking_status || 'Confirmed'}
                        </span>
                      </td>
                      <td className="p-3 text-slate-500 max-w-[150px] truncate">
                        {app.closed_remarks || 'Transit Doha'}
                      </td>
                      <td className="p-3 pr-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleOpenEdit(app)}
                            className="p-1 px-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
                          >
                            <Edit2 className="w-3 h-3 text-slate-600" />
                            <span>Edit Ticket</span>
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
        )}

        {/* ============================================================== */}
        {/* VIEW F: ALL MASTER RECORDS (FULL 360° FIELDS TABLE)            */}
        {/* ============================================================== */}
        {activeSection === 'all_master' && (
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-slate-50 font-bold uppercase tracking-wider text-[10px] text-slate-500 border-b border-slate-200">
              <tr>
                <th className="p-3 pl-4 font-mono sticky left-0 bg-slate-50 z-10">Master ID</th>
                <th className="p-3 font-mono sticky left-24 bg-slate-50 z-10 border-r border-slate-200">Candidate Name</th>
                <th className="p-3">Gender / Age</th>
                <th className="p-3 font-mono">Passport No</th>
                <th className="p-3">Job Trade</th>
                <th className="p-3">Company</th>
                <th className="p-3 font-mono">SE / E No</th>
                <th className="p-3 text-center">Police Report</th>
                <th className="p-3 text-center">Visa Status</th>
                <th className="p-3 whitespace-nowrap">Flight / Departure</th>
                <th className="p-3 whitespace-nowrap">Reg Date</th>
                <th className="p-3">Recruitment Stage</th>
                {showAllColumns && (
                  <>
                    <th className="p-3 font-mono">NIC Number</th>
                    <th className="p-3">Mobile Contact</th>
                    <th className="p-3">Living Place</th>
                    <th className="p-3">English Rating</th>
                    <th className="p-3">Staff Assignee</th>
                  </>
                )}
                <th className="p-3 pr-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-sans">
              {paginatedRows.length === 0 ? (
                <tr>
                  <td colSpan={showAllColumns ? 18 : 13} className="p-10 text-center text-slate-400">
                    No master records found.
                  </td>
                </tr>
              ) : (
                paginatedRows.map((app) => {
                  const policeOk = app.police_report_ready;

                  return (
                    <tr key={app.applicant_id} className="hover:bg-slate-50/80 transition group">
                      <td className="p-3 pl-4 font-mono font-bold text-slate-900 sticky left-0 bg-white group-hover:bg-slate-50 z-10">
                        {app.applicant_id}
                      </td>
                      <td className="p-3 font-bold text-slate-900 sticky left-24 bg-white group-hover:bg-slate-50 z-10 border-r border-slate-200 whitespace-nowrap">
                        <span>{app.full_name}</span>
                        <span className="text-[10px] text-slate-400 font-mono block">Ref: {app.registration_number}</span>
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        <span className="font-semibold text-slate-700">{app.gender}</span>
                        {app.age && <span className="text-slate-400 text-[11px]"> · {app.age} yrs</span>}
                      </td>
                      <td className="p-3 font-mono font-bold text-slate-800 whitespace-nowrap">
                        {app.passport_number || 'PENDING'}
                      </td>
                      <td className="p-3 whitespace-nowrap uppercase font-semibold text-slate-700">
                        {app.preferred_job_category}
                      </td>
                      <td className="p-3 whitespace-nowrap text-slate-800 font-medium">
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
                      <td className="p-3 font-mono text-[11px] whitespace-nowrap text-slate-600">
                        {app.departure_date ? `${app.departure_date} (${app.flight_number || 'UL-102'})` : '—'}
                      </td>
                      <td className="p-3 font-mono text-slate-600 whitespace-nowrap">
                        {app.registration_date}
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              app.current_status === 'GREEN_REGISTERED'
                                ? 'bg-emerald-500'
                                : app.current_status === 'FOLLOW_UP'
                                ? 'bg-blue-500'
                                : app.current_status === 'RED_CLOSED'
                                ? 'bg-rose-500'
                                : 'bg-purple-500'
                            }`}
                          ></span>
                          <span className="font-semibold text-slate-700 text-xs">
                            {app.current_status.replace('_', ' ')}
                          </span>
                        </div>
                      </td>
                      {showAllColumns && (
                        <>
                          <td className="p-3 font-mono text-slate-600 whitespace-nowrap">{app.nic_number || '—'}</td>
                          <td className="p-3 font-mono text-slate-600 whitespace-nowrap">{app.mobile_number}</td>
                          <td className="p-3 text-slate-600 whitespace-nowrap">{app.living_place || 'Colombo'}</td>
                          <td className="p-3 text-slate-600 whitespace-nowrap">{app.english_status}</td>
                          <td className="p-3 text-slate-600 whitespace-nowrap">{app.staff_name || 'Althaf Hussain'}</td>
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
        )}
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

      {/* ============================================================== */}
      {/* MODAL 1: QUICK EDIT RECORD                                     */}
      {/* ============================================================== */}
      {editingApplicant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-xl w-full border border-slate-200 shadow-2xl p-6 space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-slate-200">
              <div>
                <span className="text-[10px] font-bold uppercase text-emerald-700 font-mono">
                  EXCEL RECORD QUICK UPDATE
                </span>
                <h3 className="font-bold text-base text-slate-900">
                  {editingApplicant.full_name} ({editingApplicant.applicant_id})
                </h3>
              </div>
              <button
                onClick={() => setEditingApplicant(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  value={editForm.full_name}
                  onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                  Passport Number
                </label>
                <input
                  type="text"
                  value={editForm.passport_number}
                  onChange={(e) => setEditForm({ ...editForm, passport_number: e.target.value.toUpperCase() })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                  Assigned Company / Client
                </label>
                <input
                  type="text"
                  value={editForm.company_name}
                  onChange={(e) => setEditForm({ ...editForm, company_name: e.target.value })}
                  placeholder="e.g. DUNNAREA HOTEL"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                  Job Category / Trade
                </label>
                <input
                  type="text"
                  value={editForm.preferred_job_category}
                  onChange={(e) => setEditForm({ ...editForm, preferred_job_category: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                  Experienced Status
                </label>
                <select
                  value={editForm.experienced}
                  onChange={(e) => setEditForm({ ...editForm, experienced: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold"
                >
                  <option value="Yes">Yes (Experienced)</option>
                  <option value="No">No (Trainee/Fresher)</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                  Police Clearance Report
                </label>
                <select
                  value={editForm.police_report_ready ? 'OK' : 'Pending'}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      police_report_ready: e.target.value === 'OK',
                      police_report_status: e.target.value
                    })
                  }
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold"
                >
                  <option value="OK">OK - Certified & Verified</option>
                  <option value="Pending">Pending Clearance</option>
                </select>
              </div>

              {/* Embassy Fields */}
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                  SE Number
                </label>
                <input
                  type="text"
                  value={editForm.se_number}
                  onChange={(e) => setEditForm({ ...editForm, se_number: e.target.value })}
                  placeholder="e.g. SE-90142"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                  E Number
                </label>
                <input
                  type="text"
                  value={editForm.e_number}
                  onChange={(e) => setEditForm({ ...editForm, e_number: e.target.value })}
                  placeholder="e.g. E-40192"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                  Embassy Visa Status
                </label>
                <select
                  value={editForm.visa_status}
                  onChange={(e) => setEditForm({ ...editForm, visa_status: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold"
                >
                  <option value="Pending">Pending Clearance</option>
                  <option value="APPLIED">Applied at Embassy</option>
                  <option value="OK">Visa Issued (OK)</option>
                  <option value="Rejected">Rejected</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                  Flight / Departure Date
                </label>
                <input
                  type="date"
                  value={editForm.departure_date}
                  onChange={(e) => setEditForm({ ...editForm, departure_date: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                  Flight Number
                </label>
                <input
                  type="text"
                  value={editForm.flight_number}
                  onChange={(e) => setEditForm({ ...editForm, flight_number: e.target.value })}
                  placeholder="e.g. UL-102 / QR-665"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                  Ticket Number / PNR
                </label>
                <input
                  type="text"
                  value={editForm.ticket_number}
                  onChange={(e) => setEditForm({ ...editForm, ticket_number: e.target.value })}
                  placeholder="e.g. 603-91823741"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                  Remarks / Notes
                </label>
                <input
                  type="text"
                  value={editForm.remarks}
                  onChange={(e) => setEditForm({ ...editForm, remarks: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setEditingApplicant(null)}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl hover:bg-slate-100 font-semibold cursor-pointer text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={isSaving}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold shadow-md cursor-pointer text-xs flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>{isSaving ? 'Saving...' : 'Save Changes'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 2: QUICK ADD TO SECTION                                  */}
      {/* ============================================================== */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-xl w-full border border-slate-200 shadow-2xl p-6 space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-slate-200">
              <div>
                <span className="text-[10px] font-bold uppercase text-emerald-700 font-mono">
                  ADD RECORD DIRECTLY TO {activeSectionInfo.label.toUpperCase()}
                </span>
                <h3 className="font-bold text-base text-slate-900">
                  New Candidate Bio-Data Entry
                </h3>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveNewRecord} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                    Candidate Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={addForm.full_name}
                    onChange={(e) => setAddForm({ ...addForm, full_name: e.target.value.toUpperCase() })}
                    placeholder="e.g. MOHAMED RIZWAN"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 uppercase"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                    Passport Number *
                  </label>
                  <input
                    type="text"
                    required
                    value={addForm.passport_number}
                    onChange={(e) => setAddForm({ ...addForm, passport_number: e.target.value.toUpperCase() })}
                    placeholder="e.g. N1094821"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                    Gender *
                  </label>
                  <select
                    value={addForm.gender}
                    onChange={(e) => setAddForm({ ...addForm, gender: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                    Mobile Phone
                  </label>
                  <input
                    type="text"
                    value={addForm.mobile_number}
                    onChange={(e) => setAddForm({ ...addForm, mobile_number: e.target.value })}
                    placeholder="+94 77 123 4567"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                    Job Category
                  </label>
                  <select
                    value={addForm.preferred_job_category}
                    onChange={(e) => setAddForm({ ...addForm, preferred_job_category: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold"
                  >
                    <option value="Kitchen Helper">Kitchen Helper</option>
                    <option value="Chef">Chef</option>
                    <option value="Factory Helper">Factory Helper</option>
                    <option value="Welder">Welder</option>
                    <option value="Housekeeping">Housekeeping</option>
                    <option value="Driver">Driver</option>
                    <option value="Security Guard">Security Guard</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                    Assigned Employer Company
                  </label>
                  <input
                    type="text"
                    value={addForm.company_name}
                    onChange={(e) => setAddForm({ ...addForm, company_name: e.target.value })}
                    placeholder="e.g. DUNNAREA HOTEL"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                    Police Clearance Report
                  </label>
                  <select
                    value={addForm.police_report_ready ? 'OK' : 'Pending'}
                    onChange={(e) => setAddForm({ ...addForm, police_report_ready: e.target.value === 'OK' })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold"
                  >
                    <option value="OK">OK - Clearance Ready</option>
                    <option value="Pending">Pending Report</option>
                  </select>
                </div>

                {/* Embassy / Flight fields if relevant */}
                {(activeSection === 'embassy_pending' || activeSection === 'departure_pending' || activeSection === 'tickets') && (
                  <>
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                        SE Number
                      </label>
                      <input
                        type="text"
                        value={addForm.se_number}
                        onChange={(e) => setAddForm({ ...addForm, se_number: e.target.value })}
                        placeholder="e.g. SE-90142"
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                        E Number
                      </label>
                      <input
                        type="text"
                        value={addForm.e_number}
                        onChange={(e) => setAddForm({ ...addForm, e_number: e.target.value })}
                        placeholder="e.g. E-40192"
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono"
                      />
                    </div>
                  </>
                )}

                {activeSection === 'tickets' && (
                  <>
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                        Flight Number
                      </label>
                      <input
                        type="text"
                        value={addForm.flight_number}
                        onChange={(e) => setAddForm({ ...addForm, flight_number: e.target.value })}
                        placeholder="UL-102"
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                        Departure Date
                      </label>
                      <input
                        type="date"
                        value={addForm.departure_date}
                        onChange={(e) => setAddForm({ ...addForm, departure_date: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono"
                      />
                    </div>
                  </>
                )}

                <div className="sm:col-span-2">
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                    Remarks
                  </label>
                  <input
                    type="text"
                    value={addForm.remarks}
                    onChange={(e) => setAddForm({ ...addForm, remarks: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl hover:bg-slate-100 font-semibold cursor-pointer text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold shadow-md cursor-pointer text-xs flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4 text-emerald-400" />
                  <span>{isSaving ? 'Registering...' : `Add to ${activeSectionInfo.label}`}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
