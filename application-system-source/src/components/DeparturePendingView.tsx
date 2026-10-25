import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { ApplicantOverview } from '../types';
import {
  Plane,
  Search,
  Download,
  Printer,
  Edit2,
  ChevronLeft,
  ChevronRight,
  Building,
  Calendar,
  X,
  Eye,
  UploadCloud,
  CheckCircle2,
  Clock,
  Filter,
  CheckSquare,
  Square,
  ChevronDown,
  RotateCcw
} from 'lucide-react';
import { DeparturePendingPdfModal } from './DeparturePendingPdfModal';
import { SectionDocumentUploadModal } from './SectionDocumentUploadModal';

interface Props {
  applicants: ApplicantOverview[];
  onViewApplicant: (id: string) => void;
  onRefreshData: () => void;
  showNotification: (type: 'success' | 'error' | 'info', text: string) => void;
}

// Sample initial data matching the uploaded PDF format
const SAMPLE_DEPARTURE_APPLICANTS: Partial<ApplicantOverview>[] = [
  {
    applicant_id: 'DEP-101',
    full_name: 'LAHIRU SANJEEWA',
    passport_number: 'P0209192',
    company_name: 'ASIA RECRUITMENT',
    sub_company: 'SKYLINE ENGINEERING SRL',
    visa_start_date: '5/4/2026',
    visa_end_date: '1/10/2026',
    gender: 'Male',
    preferred_job_category: 'Welder'
  },
  {
    applicant_id: 'DEP-102',
    full_name: 'RASHMINDA KAUSHAN PERERA',
    passport_number: 'P0432145',
    company_name: 'ASIA RECRUITMENT',
    sub_company: 'SKYLINE ENGINEERING SRL',
    visa_start_date: '5/4/2026',
    visa_end_date: '1/10/2026',
    gender: 'Male',
    preferred_job_category: 'Pipe Fitter'
  },
  {
    applicant_id: 'DEP-103',
    full_name: 'NIRANJAN NAYANAJITH',
    passport_number: 'N10680563',
    company_name: 'ASIA RECRUITMENT',
    sub_company: 'SKYLINE ENGINEERING SRL',
    visa_start_date: '6/4/2026',
    visa_end_date: '2/10/2026',
    gender: 'Male',
    preferred_job_category: 'Mason'
  },
  {
    applicant_id: 'DEP-104',
    full_name: 'RAVINDU LAKSHAN',
    passport_number: 'N11240589',
    company_name: 'ASIA RECRUITMENT',
    sub_company: 'SKYLINE ENGINEERING SRL',
    visa_start_date: '6/4/2026',
    visa_end_date: '2/10/2026',
    gender: 'Male',
    preferred_job_category: 'Electrician'
  },
  {
    applicant_id: 'DEP-105',
    full_name: 'ASHEN SAMEERA',
    passport_number: 'N6939183',
    company_name: 'ASIA RECRUITMENT',
    sub_company: 'SKYLINE ENGINEERING SRL',
    visa_start_date: '7/4/2026',
    visa_end_date: '3/10/2026',
    gender: 'Male',
    preferred_job_category: 'Scaffolder'
  },
  {
    applicant_id: 'DEP-201',
    full_name: 'RASHUN NADEESHA',
    passport_number: 'N10938063',
    company_name: 'CLEVER',
    sub_company: 'TINERVIS GROUP SRL',
    visa_start_date: '29/1/2026',
    visa_end_date: '22/7/2026',
    gender: 'Male',
    preferred_job_category: 'Factory Helper'
  },
  {
    applicant_id: 'DEP-202',
    full_name: 'A.SAMIDU THARANGA',
    passport_number: 'N10303853',
    company_name: 'CLEVER',
    sub_company: 'TINERVIS GROUP SRL',
    visa_start_date: '17/2/2026',
    visa_end_date: '17/8/2026',
    gender: 'Male',
    preferred_job_category: 'Kitchen Helper'
  },
  {
    applicant_id: 'DEP-203',
    full_name: 'K.DANINDU ROCHANA',
    passport_number: 'N10980637',
    company_name: 'CLEVER',
    sub_company: 'TINERVIS GROUP SRL',
    visa_start_date: '24/2/2026',
    visa_end_date: '22/8/2026',
    gender: 'Male',
    preferred_job_category: 'Cleaner'
  },
  {
    applicant_id: 'DEP-204',
    full_name: 'G.SAHEN HASITH',
    passport_number: 'N11393205',
    company_name: 'CLEVER',
    sub_company: 'TINERVIS GROUP SRL',
    visa_start_date: '24/2/2026',
    visa_end_date: '22/8/2026',
    gender: 'Male',
    preferred_job_category: 'Plumber'
  },
  {
    applicant_id: 'DEP-205',
    full_name: 'W.CHALUKA THUSHANGA CROOS',
    passport_number: 'N10084072',
    company_name: 'CLEVER',
    sub_company: 'TINERVIS GROUP SRL',
    visa_start_date: '26/2/2026',
    visa_end_date: '24/8/2026',
    gender: 'Male',
    preferred_job_category: 'Painter'
  },
  {
    applicant_id: 'DEP-206',
    full_name: 'S.A.SUSIL',
    passport_number: 'N8362742',
    company_name: 'CLEVER',
    sub_company: 'TINERVIS GROUP SRL',
    visa_start_date: '24/2/2026',
    visa_end_date: '22/8/2026',
    gender: 'Male',
    preferred_job_category: 'General Helper'
  },
  {
    applicant_id: 'DEP-207',
    full_name: 'R.R.A.INDIKA DINESH',
    passport_number: 'P0052888',
    company_name: 'CLEVER',
    sub_company: 'TINERVIS GROUP SRL',
    visa_start_date: '24/2/2026',
    visa_end_date: '22/8/2026',
    gender: 'Male',
    preferred_job_category: 'Driver'
  }
];

// Helper to format visa end date into month label (e.g. "October 2026")
export function parseVisaEndMonthLabel(dateStr?: string): string {
  if (!dateStr || dateStr === '—' || dateStr === 'PENDING') return 'October 2026';

  // Check DD/MM/YYYY or D/M/YYYY
  if (dateStr.includes('/')) {
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      let m = parseInt(parts[1], 10);
      let y = parseInt(parts[2], 10);
      if (parts[0].length === 4) {
        y = parseInt(parts[0], 10);
        m = parseInt(parts[1], 10);
      }
      if (!isNaN(m) && !isNaN(y)) {
        const monthNames = [
          'January', 'February', 'March', 'April', 'May', 'June',
          'July', 'August', 'September', 'October', 'November', 'December'
        ];
        return `${monthNames[m - 1] || 'Month ' + m} ${y}`;
      }
    }
  }

  // Check YYYY-MM-DD or DD-MM-YYYY
  if (dateStr.includes('-')) {
    const parts = dateStr.split('-');
    if (parts.length >= 2) {
      let y = parseInt(parts[0], 10);
      let m = parseInt(parts[1], 10);
      if (parts[0].length <= 2) {
        m = parseInt(parts[1], 10);
        y = parseInt(parts[2], 10);
      }
      if (!isNaN(m) && !isNaN(y)) {
        const monthNames = [
          'January', 'February', 'March', 'April', 'May', 'June',
          'July', 'August', 'September', 'October', 'November', 'December'
        ];
        return `${monthNames[m - 1] || 'Month ' + m} ${y}`;
      }
    }
  }

  return 'October 2026';
}

export const DeparturePendingView: React.FC<Props> = ({
  applicants,
  onViewApplicant,
  onRefreshData,
  showNotification
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  // Modals
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  // Edit modal
  const [editingApp, setEditingApp] = useState<ApplicantOverview | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [isSaving, setIsSaving] = useState(false);

  // Combine system applicants with sample format applicants
  const masterList = useMemo(() => {
    const list: ApplicantOverview[] = SAMPLE_DEPARTURE_APPLICANTS.map((sample) => ({
      applicant_id: sample.applicant_id!,
      registration_number: `REG-${sample.applicant_id}`,
      gender: (sample.gender as any) || 'Male',
      full_name: sample.full_name!,
      surname: '',
      other_name: '',
      mobile_number: '+94770000000',
      living_place: 'Colombo',
      preferred_job_category: sample.preferred_job_category || 'Welder',
      english_status: 'Good',
      registration_date: '2026-02-15',
      current_status: 'ACTIVE_PIPELINE',
      passport_number: sample.passport_number!,
      passport_expiry: '2031-10-01',
      passport_status: 'With Agency',
      company_name: sample.company_name!,
      sub_company: sample.sub_company!,
      se_number: 'SE2300001',
      e_number: 'E987654',
      visa_status: 'OK',
      visa_start_date: sample.visa_start_date!,
      visa_end_date: sample.visa_end_date!,
      departure_date: '',
      staff_name: 'Althaf Hussain'
    }));

    // Add applicants from backend props if they are in pipeline/departure pending
    applicants.forEach((app) => {
      if (
        app.visa_status === 'OK' ||
        app.visa_status === 'Visa Issued (OK)' ||
        app.current_status === 'ACTIVE_PIPELINE' ||
        app.visa_start_date ||
        app.departure_date
      ) {
        // Avoid duplicate ID if already in sample
        if (!list.some((item) => item.applicant_id === app.applicant_id)) {
          list.push({
            ...app,
            company_name: app.company_name && app.company_name !== 'None' ? app.company_name : 'ASIA RECRUITMENT',
            sub_company: app.sub_company || 'SKYLINE ENGINEERING SRL',
            visa_start_date: app.visa_start_date || '5/4/2026',
            visa_end_date: app.visa_end_date || '1/10/2026'
          });
        }
      }
    });

    return list;
  }, [applicants]);

  // Extract all unique values for filters
  const allCompanies = useMemo(() => {
    const set = new Set<string>();
    masterList.forEach((a) => {
      const comp = a.company_name && a.company_name !== 'None' ? a.company_name : 'ASIA RECRUITMENT';
      set.add(comp);
    });
    return Array.from(set).sort();
  }, [masterList]);

  const allSubCompanies = useMemo(() => {
    const set = new Set<string>();
    masterList.forEach((a) => {
      const subComp = a.sub_company || 'SKYLINE ENGINEERING SRL';
      set.add(subComp);
    });
    return Array.from(set).sort();
  }, [masterList]);

  const allVisaEndMonths = useMemo(() => {
    const set = new Set<string>();
    masterList.forEach((a) => {
      const monthLabel = parseVisaEndMonthLabel(a.visa_end_date);
      set.add(monthLabel);
    });
    return Array.from(set).sort();
  }, [masterList]);

  // Filter Checkbox States
  const [selectedCompanies, setSelectedCompanies] = useState<string[]>(allCompanies);
  const [selectedSubCompanies, setSelectedSubCompanies] = useState<string[]>(allSubCompanies);
  const [selectedVisaEndMonths, setSelectedVisaEndMonths] = useState<string[]>(allVisaEndMonths);

  // Dropdown open states
  const [openDropdown, setOpenDropdown] = useState<'company' | 'sub_company' | 'visa_month' | null>(null);

  // Keep filter selections synced if new unique values appear
  React.useEffect(() => {
    setSelectedCompanies((prev) => Array.from(new Set([...prev, ...allCompanies])));
  }, [allCompanies]);

  React.useEffect(() => {
    setSelectedSubCompanies((prev) => Array.from(new Set([...prev, ...allSubCompanies])));
  }, [allSubCompanies]);

  React.useEffect(() => {
    setSelectedVisaEndMonths((prev) => Array.from(new Set([...prev, ...allVisaEndMonths])));
  }, [allVisaEndMonths]);

  // Toggle handlers
  const toggleCompany = (comp: string) => {
    if (selectedCompanies.includes(comp)) {
      if (selectedCompanies.length === 1) return;
      setSelectedCompanies(selectedCompanies.filter((c) => c !== comp));
    } else {
      setSelectedCompanies([...selectedCompanies, comp]);
    }
  };

  const toggleSubCompany = (subComp: string) => {
    if (selectedSubCompanies.includes(subComp)) {
      if (selectedSubCompanies.length === 1) return;
      setSelectedSubCompanies(selectedSubCompanies.filter((s) => s !== subComp));
    } else {
      setSelectedSubCompanies([...selectedSubCompanies, subComp]);
    }
  };

  const toggleVisaEndMonth = (monthLabel: string) => {
    if (selectedVisaEndMonths.includes(monthLabel)) {
      if (selectedVisaEndMonths.length === 1) return;
      setSelectedVisaEndMonths(selectedVisaEndMonths.filter((m) => m !== monthLabel));
    } else {
      setSelectedVisaEndMonths([...selectedVisaEndMonths, monthLabel]);
    }
  };

  // Filtered List based on Checkbox selections & Search Term
  const filteredCandidates = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();

    return masterList.filter((app) => {
      const comp = app.company_name && app.company_name !== 'None' ? app.company_name : 'ASIA RECRUITMENT';
      const subComp = app.sub_company || 'SKYLINE ENGINEERING SRL';
      const visaMonth = parseVisaEndMonthLabel(app.visa_end_date);

      const matchesCompany = selectedCompanies.includes(comp);
      const matchesSubCompany = selectedSubCompanies.includes(subComp);
      const matchesVisaMonth = selectedVisaEndMonths.includes(visaMonth);

      const matchesSearch =
        !q ||
        app.full_name?.toLowerCase().includes(q) ||
        app.passport_number?.toLowerCase().includes(q) ||
        comp.toLowerCase().includes(q) ||
        subComp.toLowerCase().includes(q) ||
        app.preferred_job_category?.toLowerCase().includes(q);

      return matchesCompany && matchesSubCompany && matchesVisaMonth && matchesSearch;
    });
  }, [masterList, selectedCompanies, selectedSubCompanies, selectedVisaEndMonths, searchTerm]);

  // Group filtered candidates by Company & Sub Company
  const categorizedGroups = useMemo(() => {
    const groups: Record<string, { companyName: string; subCompanyName: string; candidates: ApplicantOverview[] }> = {};

    filteredCandidates.forEach((app) => {
      const comp = app.company_name && app.company_name !== 'None' ? app.company_name : 'ASIA RECRUITMENT';
      const subComp = app.sub_company || 'SKYLINE ENGINEERING SRL';
      const groupKey = `${comp}___${subComp}`;

      if (!groups[groupKey]) {
        groups[groupKey] = {
          companyName: comp,
          subCompanyName: subComp,
          candidates: []
        };
      }
      groups[groupKey].candidates.push(app);
    });

    return Object.values(groups);
  }, [filteredCandidates]);

  const handleExportExcel = () => {
    try {
      const excelRows: any[] = [];

      excelRows.push({
        'NO': 'TRANS ARABIAN RECRUITMENT AGENCY — DEPARTURE PENDING PERSONS'
      });
      excelRows.push({});

      categorizedGroups.forEach((grp) => {
        excelRows.push({
          'NO': 'NO',
          'NAME': 'NAME',
          'PASSPORT': 'PASSPORT',
          'COMPANY': 'COMPANY',
          'SUB COMPANY': 'SUB COMPANY',
          'VISA START DATE': 'VISA START DATE',
          'VISA END DATE': 'VISA END DATE'
        });

        grp.candidates.forEach((app, idx) => {
          excelRows.push({
            'NO': idx + 1,
            'NAME': app.full_name,
            'PASSPORT': app.passport_number || 'PENDING',
            'COMPANY': grp.companyName,
            'SUB COMPANY': grp.subCompanyName,
            'VISA START DATE': app.visa_start_date || '5/4/2026',
            'VISA END DATE': app.visa_end_date || '1/10/2026'
          });
        });

        const summaryLabel = grp.subCompanyName.toUpperCase().includes('COMPANY')
          ? grp.subCompanyName.toUpperCase()
          : `${grp.subCompanyName.toUpperCase()} COMPANY`;

        excelRows.push({
          'NO': summaryLabel,
          'NAME': '',
          'PASSPORT': '',
          'COMPANY': '',
          'SUB COMPANY': grp.candidates.length,
          'VISA START DATE': '',
          'VISA END DATE': ''
        });

        excelRows.push({});
      });

      const ws = XLSX.utils.json_to_sheet(excelRows, { skipHeader: true });
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'DEPARTURE_PENDING');
      const filename = `TransArabian_Departure_Pending_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(wb, filename);
      showNotification('success', `Exported ${filteredCandidates.length} departure records to ${filename}`);
    } catch (err: any) {
      showNotification('error', err.message);
    }
  };

  const handleOpenEdit = (app: ApplicantOverview) => {
    setEditingApp(app);
    setEditForm({
      company_name: app.company_name && app.company_name !== 'None' ? app.company_name : 'ASIA RECRUITMENT',
      sub_company: app.sub_company || 'SKYLINE ENGINEERING SRL',
      visa_start_date: app.visa_start_date || '5/4/2026',
      visa_end_date: app.visa_end_date || '1/10/2026',
      departure_date: app.departure_date || '',
      flight_number: app.flight_number || ''
    });
  };

  const handleSaveEdit = async () => {
    if (!editingApp) return;
    setIsSaving(true);
    try {
      const res = await fetch(`/api/applicants/${editingApp.applicant_id}/quick-update`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm)
      });
      if (res.ok) {
        showNotification('success', `Updated Departure records for ${editingApp.full_name}`);
        setEditingApp(null);
        onRefreshData();
      } else {
        showNotification('error', 'Failed to update record');
      }
    } catch (err: any) {
      showNotification('error', err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 sm:p-6 space-y-6">
      {/* 1. Header Toolbar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-slate-900 text-purple-400">
              <Plane className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">Departure Pending</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Official Company & Sub-Company Categorized Roster · Total {filteredCandidates.length} Candidates
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end flex-wrap">
          <button
            onClick={() => setIsUploadModalOpen(true)}
            className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-3.5 py-2.5 rounded-xl shadow-xs transition cursor-pointer active:scale-98"
          >
            <UploadCloud className="w-4 h-4 text-purple-400" />
            <span>AI Document Upload & Auto-Fill</span>
          </button>

          <button
            onClick={() => setIsPdfModalOpen(true)}
            className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold px-3.5 py-2.5 rounded-xl shadow-xs transition cursor-pointer active:scale-98"
          >
            <Eye className="w-3.5 h-3.5 text-purple-400" />
            <span>View PDF</span>
          </button>

          <button
            onClick={() => setIsPdfModalOpen(true)}
            className="flex items-center gap-1.5 bg-purple-700 hover:bg-purple-600 text-white text-xs font-bold px-3.5 py-2.5 rounded-xl shadow-xs transition cursor-pointer active:scale-98"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Download PDF</span>
          </button>

          <button
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3.5 py-2.5 rounded-xl shadow-xs transition cursor-pointer active:scale-98"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Excel (.xlsx)</span>
          </button>
        </div>
      </div>

      {/* 2. CATEGORIZATION DROPDOWN FILTERS WITH CHECKBOXES */}
      <div className="bg-slate-50/90 rounded-2xl p-4 border border-slate-200/80 space-y-3">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-purple-600" />
            <span className="text-xs font-bold uppercase text-slate-800 font-mono tracking-wider">
              Categorize & Filter Departure Roster (Checkboxes)
            </span>
          </div>
          <span className="text-[11px] text-slate-500 font-mono">
            * Selected checkboxes filter both screen table view and downloadable PDF/Excel files.
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Dropdown 1: COMPANY NAMES FILTER WITH CHECKBOXES */}
          <div className="relative">
            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
              Company Names ({selectedCompanies.length}/{allCompanies.length})
            </label>
            <button
              type="button"
              onClick={() => setOpenDropdown(openDropdown === 'company' ? null : 'company')}
              className="w-full bg-white hover:bg-slate-100 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 flex items-center justify-between shadow-2xs cursor-pointer transition"
            >
              <div className="flex items-center gap-2 truncate">
                <Building className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                <span className="truncate">
                  {selectedCompanies.length === allCompanies.length
                    ? 'All Companies Selected'
                    : `${selectedCompanies.length} Companies Selected`}
                </span>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            </button>

            {openDropdown === 'company' && (
              <div className="absolute left-0 mt-1 w-full bg-white rounded-xl shadow-2xl border border-slate-200 p-3 z-50 text-slate-900 max-h-64 overflow-y-auto">
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 text-xs font-bold">
                  <span className="text-slate-700">Filter Company</span>
                  <div className="flex items-center gap-2 text-[10px]">
                    <button
                      type="button"
                      onClick={() => setSelectedCompanies([...allCompanies])}
                      className="text-purple-700 hover:underline cursor-pointer"
                    >
                      Select All
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedCompanies([allCompanies[0]])}
                      className="text-slate-500 hover:underline cursor-pointer"
                    >
                      Reset
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  {allCompanies.map((comp) => {
                    const isChecked = selectedCompanies.includes(comp);
                    return (
                      <label
                        key={comp}
                        onClick={() => toggleCompany(comp)}
                        className={`flex items-center gap-2 p-1.5 rounded-lg text-xs cursor-pointer transition select-none ${
                          isChecked ? 'bg-purple-50 text-purple-950 font-bold' : 'hover:bg-slate-100 text-slate-700'
                        }`}
                      >
                        {isChecked ? (
                          <CheckSquare className="w-4 h-4 text-purple-600 shrink-0" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-300 shrink-0" />
                        )}
                        <span className="truncate">{comp}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Dropdown 2: SUB COMPANY NAMES FILTER WITH CHECKBOXES */}
          <div className="relative">
            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
              Sub Companies ({selectedSubCompanies.length}/{allSubCompanies.length})
            </label>
            <button
              type="button"
              onClick={() => setOpenDropdown(openDropdown === 'sub_company' ? null : 'sub_company')}
              className="w-full bg-white hover:bg-slate-100 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 flex items-center justify-between shadow-2xs cursor-pointer transition"
            >
              <div className="flex items-center gap-2 truncate">
                <Building className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                <span className="truncate">
                  {selectedSubCompanies.length === allSubCompanies.length
                    ? 'All Sub Companies Selected'
                    : `${selectedSubCompanies.length} Sub Companies Selected`}
                </span>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            </button>

            {openDropdown === 'sub_company' && (
              <div className="absolute left-0 mt-1 w-full bg-white rounded-xl shadow-2xl border border-slate-200 p-3 z-50 text-slate-900 max-h-64 overflow-y-auto">
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 text-xs font-bold">
                  <span className="text-slate-700">Filter Sub Company</span>
                  <div className="flex items-center gap-2 text-[10px]">
                    <button
                      type="button"
                      onClick={() => setSelectedSubCompanies([...allSubCompanies])}
                      className="text-purple-700 hover:underline cursor-pointer"
                    >
                      Select All
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedSubCompanies([allSubCompanies[0]])}
                      className="text-slate-500 hover:underline cursor-pointer"
                    >
                      Reset
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  {allSubCompanies.map((subComp) => {
                    const isChecked = selectedSubCompanies.includes(subComp);
                    return (
                      <label
                        key={subComp}
                        onClick={() => toggleSubCompany(subComp)}
                        className={`flex items-center gap-2 p-1.5 rounded-lg text-xs cursor-pointer transition select-none ${
                          isChecked ? 'bg-purple-50 text-purple-950 font-bold' : 'hover:bg-slate-100 text-slate-700'
                        }`}
                      >
                        {isChecked ? (
                          <CheckSquare className="w-4 h-4 text-purple-600 shrink-0" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-300 shrink-0" />
                        )}
                        <span className="truncate">{subComp}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Dropdown 3: VISA END MONTH FILTER WITH CHECKBOXES */}
          <div className="relative">
            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
              Visa End Month ({selectedVisaEndMonths.length}/{allVisaEndMonths.length})
            </label>
            <button
              type="button"
              onClick={() => setOpenDropdown(openDropdown === 'visa_month' ? null : 'visa_month')}
              className="w-full bg-white hover:bg-slate-100 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 flex items-center justify-between shadow-2xs cursor-pointer transition"
            >
              <div className="flex items-center gap-2 truncate">
                <Calendar className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                <span className="truncate">
                  {selectedVisaEndMonths.length === allVisaEndMonths.length
                    ? 'All Visa End Months Selected'
                    : `${selectedVisaEndMonths.length} Visa End Months Selected`}
                </span>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            </button>

            {openDropdown === 'visa_month' && (
              <div className="absolute left-0 mt-1 w-full bg-white rounded-xl shadow-2xl border border-slate-200 p-3 z-50 text-slate-900 max-h-64 overflow-y-auto">
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 text-xs font-bold">
                  <span className="text-slate-700">Filter Visa End Month</span>
                  <div className="flex items-center gap-2 text-[10px]">
                    <button
                      type="button"
                      onClick={() => setSelectedVisaEndMonths([...allVisaEndMonths])}
                      className="text-purple-700 hover:underline cursor-pointer"
                    >
                      Select All
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedVisaEndMonths([allVisaEndMonths[0]])}
                      className="text-slate-500 hover:underline cursor-pointer"
                    >
                      Reset
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  {allVisaEndMonths.map((mLabel) => {
                    const isChecked = selectedVisaEndMonths.includes(mLabel);
                    return (
                      <label
                        key={mLabel}
                        onClick={() => toggleVisaEndMonth(mLabel)}
                        className={`flex items-center gap-2 p-1.5 rounded-lg text-xs cursor-pointer transition select-none ${
                          isChecked ? 'bg-purple-50 text-purple-950 font-bold' : 'hover:bg-slate-100 text-slate-700'
                        }`}
                      >
                        {isChecked ? (
                          <CheckSquare className="w-4 h-4 text-purple-600 shrink-0" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-300 shrink-0" />
                        )}
                        <span className="truncate">{mLabel}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 3. Search Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search candidate, passport, company..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full bg-slate-50 hover:bg-white focus:bg-white border border-slate-200/80 focus:border-purple-500 rounded-xl pl-10 pr-4 py-2 text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/20 transition shadow-xs"
          />
        </div>

        <div className="text-xs text-slate-500 font-mono">
          Showing <strong className="text-purple-700">{filteredCandidates.length}</strong> Departure Pending Candidates across{' '}
          <strong className="text-slate-800">{categorizedGroups.length}</strong> Sub-Company Groups
        </div>
      </div>

      {/* 4. Categorized Table View matching Uploaded PDF Format */}
      <div className="space-y-6">
        {categorizedGroups.length === 0 ? (
          <div className="p-12 text-center text-slate-400 border border-slate-200 rounded-2xl bg-slate-50 font-mono text-xs">
            No departure pending records match the selected company, sub-company, or visa end month filters.
          </div>
        ) : (
          categorizedGroups.map((grp) => {
            const summaryLabel = grp.subCompanyName.toUpperCase().includes('COMPANY')
              ? grp.subCompanyName.toUpperCase()
              : `${grp.subCompanyName.toUpperCase()} COMPANY`;

            return (
              <div key={`${grp.companyName}-${grp.subCompanyName}`} className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                {/* Sub-Company Section Banner */}
                <div className="bg-slate-900 text-white px-4 py-2 flex items-center justify-between font-bold text-xs tracking-wide">
                  <div className="flex items-center gap-2">
                    <Building className="w-4 h-4 text-purple-400" />
                    <span>
                      {grp.companyName} — <strong className="text-purple-300">{grp.subCompanyName}</strong>
                    </span>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-purple-900/80 text-purple-300 font-mono text-[11px] border border-purple-700">
                    {grp.candidates.length} Candidates
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead className="bg-slate-100 font-bold uppercase tracking-wider text-[10px] text-slate-600 border-b border-slate-300">
                      <tr>
                        <th className="p-2.5 pl-4 w-10 font-mono text-center border-r border-slate-200">NO</th>
                        <th className="p-2.5 border-r border-slate-200">NAME</th>
                        <th className="p-2.5 font-mono text-center border-r border-slate-200">PASSPORT</th>
                        <th className="p-2.5 border-r border-slate-200">COMPANY</th>
                        <th className="p-2.5 border-r border-slate-200">SUB COMPANY</th>
                        <th className="p-2.5 text-center whitespace-nowrap border-r border-slate-200">VISA START DATE</th>
                        <th className="p-2.5 text-center whitespace-nowrap border-r border-slate-200">VISA END DATE</th>
                        <th className="p-2.5 pr-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 font-sans">
                      {grp.candidates.map((app, idx) => (
                        <tr
                          key={app.applicant_id}
                          className="hover:bg-purple-50/40 transition group cursor-pointer"
                          onClick={() => handleOpenEdit(app)}
                        >
                          <td className="p-2.5 pl-4 font-mono font-bold text-center text-slate-500 border-r border-slate-100">
                            {idx + 1}
                          </td>
                          <td className="p-2.5 font-bold text-slate-900 border-r border-slate-100">
                            {app.full_name}
                            <span className="text-[10px] text-slate-400 block font-mono font-normal">
                              {app.preferred_job_category}
                            </span>
                          </td>
                          <td className="p-2.5 font-mono font-bold text-center text-slate-800 whitespace-nowrap border-r border-slate-100">
                            <span className="px-2 py-0.5 bg-slate-100 rounded border border-slate-200">
                              {app.passport_number || 'PENDING'}
                            </span>
                          </td>
                          <td className="p-2.5 font-semibold text-slate-800 uppercase border-r border-slate-100">
                            {grp.companyName}
                          </td>
                          <td className="p-2.5 font-medium text-slate-700 uppercase border-r border-slate-100">
                            {grp.subCompanyName}
                          </td>
                          <td className="p-2.5 font-mono text-center text-slate-600 whitespace-nowrap border-r border-slate-100">
                            {app.visa_start_date ? app.visa_start_date.replace(/-/g, '/') : '5/4/2026'}
                          </td>
                          <td className="p-2.5 font-mono text-center text-slate-600 whitespace-nowrap border-r border-slate-100">
                            {app.visa_end_date ? app.visa_end_date.replace(/-/g, '/') : '1/10/2026'}
                          </td>
                          <td className="p-2.5 pr-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => handleOpenEdit(app)}
                                className="p-1 px-2.5 bg-slate-100 hover:bg-purple-100 text-slate-700 hover:text-purple-800 rounded-lg text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
                              >
                                <Edit2 className="w-3 h-3" />
                                <span>Edit</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}

                      {/* Sub-Company Total Banner Row matching PDF format */}
                      <tr className="bg-slate-100 font-extrabold text-slate-900 border-t-2 border-slate-300">
                        <td colSpan={4} className="p-2.5 text-center uppercase font-mono tracking-wider text-xs">
                          {summaryLabel}
                        </td>
                        <td className="p-2.5 text-center font-mono text-sm font-black text-purple-950">
                          {grp.candidates.length}
                        </td>
                        <td colSpan={3} className="p-2.5"></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Official PDF Modal (DEPARTURE PENDING PERSONS) */}
      <DeparturePendingPdfModal
        isOpen={isPdfModalOpen}
        onClose={() => setIsPdfModalOpen(false)}
        applicants={filteredCandidates}
        selectedCompanies={selectedCompanies}
        selectedSubCompanies={selectedSubCompanies}
        selectedVisaEndMonths={selectedVisaEndMonths}
      />

      {/* AI Document Upload Modal */}
      <SectionDocumentUploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        sectionTitle="Departure Pending (Visa & Ticket Extraction)"
        sectionContext="departure_pending"
        onSuccess={() => {
          onRefreshData();
          showNotification('success', 'Departure pending document processed successfully.');
        }}
        showNotification={showNotification}
      />

      {/* Quick Edit Modal */}
      {editingApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-2xl p-6 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-200">
              <h3 className="font-bold text-sm text-slate-900">
                Edit Departure Details: {editingApp.full_name}
              </h3>
              <button
                onClick={() => setEditingApp(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Company Name</label>
                <input
                  type="text"
                  value={editForm.company_name}
                  onChange={(e) => setEditForm({ ...editForm, company_name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2 font-semibold text-slate-900"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Sub Company</label>
                <input
                  type="text"
                  value={editForm.sub_company}
                  onChange={(e) => setEditForm({ ...editForm, sub_company: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2 font-semibold text-slate-900"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Visa Start Date</label>
                <input
                  type="text"
                  placeholder="e.g. 5/4/2026"
                  value={editForm.visa_start_date}
                  onChange={(e) => setEditForm({ ...editForm, visa_start_date: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2 font-mono text-slate-900"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Visa End Date</label>
                <input
                  type="text"
                  placeholder="e.g. 1/10/2026"
                  value={editForm.visa_end_date}
                  onChange={(e) => setEditForm({ ...editForm, visa_end_date: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2 font-mono text-slate-900"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Flight Number</label>
                <input
                  type="text"
                  placeholder="e.g. UL-225"
                  value={editForm.flight_number}
                  onChange={(e) => setEditForm({ ...editForm, flight_number: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2 font-mono text-slate-900 font-bold"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Departure Date</label>
                <input
                  type="date"
                  value={editForm.departure_date}
                  onChange={(e) => setEditForm({ ...editForm, departure_date: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2 font-mono text-slate-900"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
              <button
                onClick={() => setEditingApp(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={isSaving}
                className="px-4 py-2 bg-purple-700 hover:bg-purple-600 text-white rounded-xl text-xs font-bold transition shadow-xs"
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
