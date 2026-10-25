import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import {
  PhoneCall,
  UserPlus,
  Search,
  Plus,
  Calendar,
  Clock,
  MapPin,
  CheckCircle2,
  FileText,
  Building2,
  ArrowRight,
  Filter,
  UserCheck,
  Share2,
  Layers,
  Sparkles,
  Printer,
  Download,
  User,
  Users,
  PhoneIncoming,
  Footprints,
  TrendingUp,
  BarChart3,
  Check,
  MessageSquare,
  HelpCircle,
  Phone,
  Briefcase,
  Target,
  Award
} from 'lucide-react';
import { FollowUpContact, ApplicantOverview, Staff } from '../types';
import { FollowUpBoard, formatToDDMMYYYY } from './FollowUpBoard';

interface Props {
  applicants: ApplicantOverview[];
  staffList?: Staff[];
  onRefreshData: () => void;
  onViewApplicant: (id: string) => void;
  onLogFollowup?: (app: ApplicantOverview) => void;
  onPrintApplicant?: (id: string) => void;
  onReopenApplicant?: (id: string, name: string) => void;
  showNotification: (type: 'success' | 'error' | 'info', msg: string) => void;
}

export const FollowUpContactBoard: React.FC<Props> = ({
  applicants,
  staffList = [],
  onRefreshData,
  onViewApplicant,
  onLogFollowup,
  onPrintApplicant,
  onReopenApplicant,
  showNotification
}) => {
  // Sub-tab switcher:
  // 'initial_contacts': Front Door Inquiries Table
  // 'pipeline': 3-Strike Follow-ups Retention Pipeline
  // 'analytics': Monthly/Yearly Inquiry Analytics & Printable Reports
  const [activeSubTab, setActiveSubTab] = useState<'initial_contacts' | 'pipeline' | 'analytics'>('initial_contacts');

  const [contacts, setContacts] = useState<FollowUpContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterSource, setFilterSource] = useState<string>('ALL');
  const [filterGender, setFilterGender] = useState<string>('ALL');

  // Track which phone number is selected to display for each contact ID (when they have two numbers)
  const [selectedPhoneMap, setSelectedPhoneMap] = useState<{ [contactId: string]: string }>({});

  const [showAddModal, setShowAddModal] = useState(false);
  const [showConvertModal, setShowConvertModal] = useState<FollowUpContact | null>(null);
  const [selectedInquiryDetail, setSelectedInquiryDetail] = useState<FollowUpContact | null>(null);
  const [selectedApplicantForm, setSelectedApplicantForm] = useState<FollowUpContact | null>(null);

  // Fallback default staff list if not provided via props
  const defaultStaff: Staff[] = [
    { staff_id: 'S-01', name: 'Althaf Hussain', telephone: '+94 77 123 4567', role: 'Administrator', active: true },
    { staff_id: 'S-02', name: 'Fathima Nazia', telephone: '+94 77 234 5678', role: 'Registration Staff', active: true },
    { staff_id: 'S-03', name: 'Mohamed Rizwan', telephone: '+94 77 345 6789', role: 'Embassy Staff', active: true },
    { staff_id: 'S-04', name: 'Nusra Fathima', telephone: '+94 77 456 7890', role: 'Departure/Ticket Staff', active: true },
    { staff_id: 'S-05', name: 'Kavinda Perera', telephone: '+94 77 567 8901', role: 'Registration Staff', active: true }
  ];
  const availableStaff = staffList && staffList.length > 0 ? staffList : defaultStaff;

  // New Contact Form with support for Applicant Age, 02 Contact Numbers, Lead Source, Assigned Staff & Conversion
  const [form, setForm] = useState({
    person_name: '',
    age: '26',
    phone: '',
    alternative_phone: '',
    gender: 'Male' as 'Male' | 'Female',
    living_place: '',
    contact_type: 'CALL' as 'CALL' | 'WALK-IN / VISIT' | 'WHATSAPP' | 'MESSAGE' | 'REFERRAL' | 'OTHER',
    inquiry_type: 'VACANCY INQUIRY' as 'VACANCY INQUIRY' | 'JOB INQUIRY' | 'COMPANY INQUIRY' | 'REGISTRATION INQUIRY' | 'VISA / PROCESS INQUIRY' | 'GENERAL INQUIRY' | 'OTHER',
    preferred_job_category: 'Kitchen Helper',
    company_name: 'DUNNAREA HOTEL',
    how_visitor_know: 'By Calling',
    how_did_you_know_vacancy: 'Facebook Advertisement',
    description: '',
    conversion: 'Registration Pending' as 'Registration Pending' | 'Registration Ok',
    outcome: 'INTERESTED' as any,
    staff_id: availableStaff[0]?.staff_id || 'S-02',
    staff_name: availableStaff[0]?.name || 'Fathima Nazia',
    next_follow_up_date: '',
    remarks: ''
  });

  // Analytics & Report Filters state
  const [reportFilterMode, setReportFilterMode] = useState<'single_month' | 'month_range' | 'yearly'>('single_month');
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [startMonth, setStartMonth] = useState<string>('2026-01');
  const [endMonth, setEndMonth] = useState<string>('2026-12');
  const [selectedYear, setSelectedYear] = useState<string>('2026');

  const fetchContacts = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/follow-up-contacts');
      const json = await res.json();
      if (json.success) {
        setContacts(json.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch follow-up contacts', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContacts();
  }, []);

  // Handle Initial Inquiry Creation
  const handleCreateContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.person_name || !form.phone) {
      showNotification('error', 'Person name and primary phone number are required.');
      return;
    }

    try {
      const res = await fetch('/api/v1/follow-up-contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          conversion_status: form.conversion === 'Registration Ok' ? 'OK_FOR_REG' : 'NOT_REGISTERED'
        })
      });
      const json = await res.json();
      if (json.success) {
        // If Registration Ok was chosen, also convert/register into Master Registry automatically
        if (form.conversion === 'Registration Ok') {
          try {
            await fetch(`/api/v1/follow-up-contacts/${json.data.id}/convert`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' }
            });
            showNotification(
              'success',
              `Initial contact ${json.data.follow_up_no} logged with "Registration Ok"! Successfully moved to Master Registry Registration Pending table.`
            );
          } catch (e) {
            console.warn('Auto convert error', e);
          }
        } else {
          showNotification(
            'success',
            `Initial contact ${json.data.follow_up_no} logged with "Registration Pending"! Moved to 3-Strike Retention Protocol Attempt 01.`
          );
        }

        setShowAddModal(false);
        setForm({
          person_name: '',
          age: '26',
          phone: '',
          alternative_phone: '',
          gender: 'Male',
          living_place: '',
          contact_type: 'CALL',
          inquiry_type: 'VACANCY INQUIRY',
          preferred_job_category: 'Kitchen Helper',
          company_name: 'DUNNAREA HOTEL',
          how_visitor_know: 'By Calling',
          how_did_you_know_vacancy: 'Facebook Advertisement',
          description: '',
          conversion: 'Registration Pending',
          outcome: 'INTERESTED',
          staff_id: availableStaff[0]?.staff_id || 'S-02',
          staff_name: availableStaff[0]?.name || 'Fathima Nazia',
          next_follow_up_date: '',
          remarks: ''
        });
        fetchContacts();
        onRefreshData();
      } else {
        showNotification('error', json.error || 'Failed to create contact');
      }
    } catch (err: any) {
      showNotification('error', 'Network error: ' + err.message);
    }
  };

  // Quick update How visitor know directly in row
  const handleUpdateSource = async (contactId: string, source: string) => {
    try {
      const res = await fetch(`/api/v1/follow-up-contacts/${contactId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ how_visitor_know: source })
      });
      if (res.ok) {
        showNotification('success', `Updated inquiry lead source to: ${source}`);
        fetchContacts();
      }
    } catch (err: any) {
      showNotification('error', err.message);
    }
  };

  // Quick update Who took details (Staff / Employee) in row
  const handleUpdateStaff = async (contactId: string, staffObj: Staff) => {
    try {
      const res = await fetch(`/api/v1/follow-up-contacts/${contactId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staff_id: staffObj.staff_id, staff_name: staffObj.name })
      });
      if (res.ok) {
        showNotification('success', `Assigned details logger: ${staffObj.name}`);
        fetchContacts();
      }
    } catch (err: any) {
      showNotification('error', err.message);
    }
  };

  const handleConvert = async (contact: FollowUpContact) => {
    try {
      const res = await fetch(`/api/v1/follow-up-contacts/${contact.id}/convert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const json = await res.json();
      if (json.success) {
        showNotification('success', `Successfully converted ${contact.person_name} to formal applicant (ID: ${json.applicantId})`);
        setShowConvertModal(null);
        fetchContacts();
        onRefreshData();
      } else {
        showNotification('error', json.error || 'Conversion failed');
      }
    } catch (err: any) {
      showNotification('error', 'Error converting: ' + err.message);
    }
  };

  // Filter contacts for main table
  const filteredContacts = contacts.filter((c) => {
    const matchesSearch =
      c.person_name.toLowerCase().includes(search.toLowerCase()) ||
      c.phone.includes(search) ||
      (c.alternative_phone && c.alternative_phone.includes(search)) ||
      c.follow_up_no.toLowerCase().includes(search.toLowerCase()) ||
      (c.preferred_job_category && c.preferred_job_category.toLowerCase().includes(search.toLowerCase())) ||
      (c.how_visitor_know && c.how_visitor_know.toLowerCase().includes(search.toLowerCase())) ||
      (c.staff_name && c.staff_name.toLowerCase().includes(search.toLowerCase()));

    const matchesSource = filterSource === 'ALL' || c.how_visitor_know === filterSource;
    const matchesGender = filterGender === 'ALL' || c.gender === filterGender;

    return matchesSearch && matchesSource && matchesGender;
  });

  // Print analytics report function
  const handlePrintReport = () => {
    window.print();
  };

  // Export analytics report to Excel (.xlsx)
  const handleExportAnalyticsExcel = () => {
    try {
      const exportRows: any[] = [];
      
      // Summary Header Row
      exportRows.push({
        'SECTION': 'EXECUTIVE SUMMARY',
        'METRIC': 'Total Inquiries',
        'VALUE': analytics.totalInquiries,
        'DETAILS': '100% Demand Inflow'
      });
      exportRows.push({
        'SECTION': 'EXECUTIVE SUMMARY',
        'METRIC': 'Ready for Registration',
        'VALUE': analytics.convertedTotal,
        'DETAILS': `${analytics.conversionRate}% Conversion Success`
      });
      exportRows.push({
        'SECTION': 'EXECUTIVE SUMMARY',
        'METRIC': 'Active Retention Pipeline',
        'VALUE': analytics.pipelineTotal,
        'DETAILS': `${analytics.pipelineRate}% 3-Strike Pool`
      });
      exportRows.push({
        'SECTION': 'EXECUTIVE SUMMARY',
        'METRIC': 'Top Vacancy Demand',
        'VALUE': analytics.topCategory.category,
        'DETAILS': `${analytics.topCategory.count} Inquiries (${analytics.topCategory.percentage}%)`
      });

      // Blank spacing
      exportRows.push({});

      // Monthly Summary Matrix
      exportRows.push({ 'SECTION': 'MONTHLY INTAKE & CONVERSION MATRIX', 'METRIC': '', 'VALUE': '', 'DETAILS': '' });
      exportRows.push({ 'SECTION': 'Month / Period', 'METRIC': 'Total Inquiries', 'VALUE': 'Ready for Reg', 'DETAILS': 'Conversion Rate' });
      analytics.monthlySummaryList.forEach((m) => {
        const rate = m.total > 0 ? Math.round((m.converted / m.total) * 100) : 0;
        exportRows.push({
          'SECTION': m.monthName,
          'METRIC': m.total,
          'VALUE': m.converted,
          'DETAILS': `${rate}% (${m.topCategory})`
        });
      });

      // Blank spacing
      exportRows.push({});

      // Vacancy Demand Breakdown
      exportRows.push({ 'SECTION': 'VACANCY & JOB DEMAND DISTRIBUTION', 'METRIC': '', 'VALUE': '', 'DETAILS': '' });
      exportRows.push({ 'SECTION': 'Job Category', 'METRIC': 'Inquiries', 'VALUE': 'Demand Share', 'DETAILS': 'Success Rate' });
      analytics.categoryList.forEach((c) => {
        exportRows.push({
          'SECTION': c.category,
          'METRIC': c.count,
          'VALUE': `${c.percentage}%`,
          'DETAILS': `${c.conversionRate}% Success`
        });
      });

      // Blank spacing
      exportRows.push({});

      // Lead Acquisition Sources Breakdown
      exportRows.push({ 'SECTION': 'LEAD ACQUISITION CHANNELS EFFICACY', 'METRIC': '', 'VALUE': '', 'DETAILS': '' });
      exportRows.push({ 'SECTION': 'Acquisition Channel', 'METRIC': 'Inquiries', 'VALUE': 'Inflow Share', 'DETAILS': 'Success Rate' });
      analytics.sourceList.forEach((s) => {
        exportRows.push({
          'SECTION': s.source,
          'METRIC': s.count,
          'VALUE': `${s.percentage}%`,
          'DETAILS': `${s.conversionRate}% Success`
        });
      });

      const ws = XLSX.utils.json_to_sheet(exportRows, { skipHeader: true });
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Inquiry_Analytics_Report');
      const filename = `TransArabian_Inquiry_Analytics_Report_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(wb, filename);
      showNotification('success', `Analytics report successfully exported to ${filename}`);
    } catch (err: any) {
      showNotification('error', `Export failed: ${err.message}`);
    }
  };

  // Helper calculation for Analytics & Monthly / Yearly Reports
  const calculateAnalytics = () => {
    // Filter contacts based on date selection
    const inRangeContacts = contacts.filter((c) => {
      if (!c.contact_date) return true;
      const dateStr = c.contact_date; // YYYY-MM-DD
      const ym = dateStr.slice(0, 7); // YYYY-MM
      const year = dateStr.slice(0, 4); // YYYY

      if (reportFilterMode === 'single_month') {
        return ym === selectedMonth;
      } else if (reportFilterMode === 'month_range') {
        return ym >= startMonth && ym <= endMonth;
      } else if (reportFilterMode === 'yearly') {
        return year === selectedYear;
      }
      return true;
    });

    // Whole-picture metrics
    const totalInquiries = inRangeContacts.length;

    // Registered / Converted
    const convertedTotal = inRangeContacts.filter(
      (c) =>
        c.converted_to_applicant ||
        (c as any).conversion_status === 'OK_FOR_REG' ||
        (c as any).conversion === 'Registration Ok' ||
        c.outcome === 'REGISTERED'
    ).length;

    const pipelineTotal = Math.max(0, totalInquiries - convertedTotal);
    const conversionRate = totalInquiries > 0 ? Math.round((convertedTotal / totalInquiries) * 100) : 0;
    const pipelineRate = totalInquiries > 0 ? Math.round((pipelineTotal / totalInquiries) * 100) : 0;

    // 1. Vacancy & Job Category Demand (Whole Data)
    const categoryMap: { [cat: string]: { count: number; converted: number } } = {};
    inRangeContacts.forEach((c) => {
      const cat = c.preferred_job_category?.trim() || 'General Vacancy / Helper';
      if (!categoryMap[cat]) categoryMap[cat] = { count: 0, converted: 0 };
      categoryMap[cat].count += 1;
      const isConverted =
        c.converted_to_applicant ||
        (c as any).conversion_status === 'OK_FOR_REG' ||
        (c as any).conversion === 'Registration Ok' ||
        c.outcome === 'REGISTERED';
      if (isConverted) categoryMap[cat].converted += 1;
    });

    const categoryList = Object.keys(categoryMap)
      .map((cat) => ({
        category: cat,
        count: categoryMap[cat].count,
        converted: categoryMap[cat].converted,
        percentage: totalInquiries > 0 ? Math.round((categoryMap[cat].count / totalInquiries) * 100) : 0,
        conversionRate: categoryMap[cat].count > 0 ? Math.round((categoryMap[cat].converted / categoryMap[cat].count) * 100) : 0
      }))
      .sort((a, b) => b.count - a.count);

    const topCategory = categoryList[0] || { category: 'General Vacancies', count: 0, percentage: 0, converted: 0, conversionRate: 0 };

    // 2. Lead Acquisition Channels Performance (Whole Data)
    const sourceMap: { [src: string]: { count: number; converted: number } } = {};
    inRangeContacts.forEach((c) => {
      const src = (c.how_visitor_know || (c as any).how_did_you_know_vacancy || 'Direct Inquiries').trim();
      if (!sourceMap[src]) sourceMap[src] = { count: 0, converted: 0 };
      sourceMap[src].count += 1;
      const isConverted =
        c.converted_to_applicant ||
        (c as any).conversion_status === 'OK_FOR_REG' ||
        (c as any).conversion === 'Registration Ok' ||
        c.outcome === 'REGISTERED';
      if (isConverted) sourceMap[src].converted += 1;
    });

    const sourceList = Object.keys(sourceMap)
      .map((src) => ({
        source: src,
        count: sourceMap[src].count,
        converted: sourceMap[src].converted,
        percentage: totalInquiries > 0 ? Math.round((sourceMap[src].count / totalInquiries) * 100) : 0,
        conversionRate: sourceMap[src].count > 0 ? Math.round((sourceMap[src].converted / sourceMap[src].count) * 100) : 0
      }))
      .sort((a, b) => b.count - a.count);

    const topSource = sourceList[0] || { source: 'Direct Inquiries', count: 0, percentage: 0, converted: 0, conversionRate: 0 };

    // 3. Staff Intake & Outreach Performance (Whole Data)
    const staffMap: { [stf: string]: { count: number; converted: number } } = {};
    inRangeContacts.forEach((c) => {
      const stf = c.staff_name?.trim() || 'Assigned Staff';
      if (!staffMap[stf]) staffMap[stf] = { count: 0, converted: 0 };
      staffMap[stf].count += 1;
      const isConverted =
        c.converted_to_applicant ||
        (c as any).conversion_status === 'OK_FOR_REG' ||
        (c as any).conversion === 'Registration Ok' ||
        c.outcome === 'REGISTERED';
      if (isConverted) staffMap[stf].converted += 1;
    });

    const staffList = Object.keys(staffMap)
      .map((stf) => ({
        staffName: stf,
        count: staffMap[stf].count,
        converted: staffMap[stf].converted,
        percentage: totalInquiries > 0 ? Math.round((staffMap[stf].count / totalInquiries) * 100) : 0,
        conversionRate: staffMap[stf].count > 0 ? Math.round((staffMap[stf].converted / staffMap[stf].count) * 100) : 0
      }))
      .sort((a, b) => b.count - a.count);

    // 4. Monthly Executive Intake & Conversion Matrix (Whole Data per Month)
    const monthlySummaryMap: {
      [monthKey: string]: {
        monthName: string;
        total: number;
        converted: number;
        pipeline: number;
        topCategory: string;
        topSource: string;
        categoryCounts: { [cat: string]: number };
        sourceCounts: { [src: string]: number };
      };
    } = {};

    inRangeContacts.forEach((c) => {
      const monthKey = c.contact_date ? c.contact_date.slice(0, 7) : '2026-01';
      if (!monthlySummaryMap[monthKey]) {
        const [y, m] = monthKey.split('-');
        const dateObj = new Date(parseInt(y, 10), parseInt(m, 10) - 1, 1);
        const monthName = dateObj.toLocaleString('default', { month: 'long', year: 'numeric' });

        monthlySummaryMap[monthKey] = {
          monthName,
          total: 0,
          converted: 0,
          pipeline: 0,
          topCategory: '',
          topSource: '',
          categoryCounts: {},
          sourceCounts: {}
        };
      }

      const item = monthlySummaryMap[monthKey];
      item.total += 1;
      const isConverted =
        c.converted_to_applicant ||
        (c as any).conversion_status === 'OK_FOR_REG' ||
        (c as any).conversion === 'Registration Ok' ||
        c.outcome === 'REGISTERED';

      if (isConverted) {
        item.converted += 1;
      } else {
        item.pipeline += 1;
      }

      const cat = c.preferred_job_category?.trim() || 'General';
      item.categoryCounts[cat] = (item.categoryCounts[cat] || 0) + 1;

      const src = (c.how_visitor_know || (c as any).how_did_you_know_vacancy || 'Direct Inquiries').trim();
      item.sourceCounts[src] = (item.sourceCounts[src] || 0) + 1;
    });

    const monthlySummaryList = Object.keys(monthlySummaryMap)
      .sort()
      .map((k) => {
        const item = monthlySummaryMap[k];
        const sortedCats = Object.entries(item.categoryCounts).sort((a, b) => b[1] - a[1]);
        item.topCategory = sortedCats[0] ? sortedCats[0][0] : 'General';
        const sortedSrcs = Object.entries(item.sourceCounts).sort((a, b) => b[1] - a[1]);
        item.topSource = sortedSrcs[0] ? sortedSrcs[0][0] : 'Direct Inquiries';
        return item;
      });

    return {
      inRangeContacts,
      totalInquiries,
      convertedTotal,
      pipelineTotal,
      conversionRate,
      pipelineRate,
      categoryList,
      topCategory,
      sourceList,
      topSource,
      staffList,
      monthlySummaryList
    };
  };

  const analytics = calculateAnalytics();

  return (
    <div className="space-y-6">
      {/* 1. TOP WORKSPACE HEADER */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white shadow-md flex flex-col md:flex-row justify-between items-start md:items-center gap-4 print:hidden">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold font-mono bg-emerald-500 text-slate-950">
              MODULE 01 · FRONT DOOR & RETENTION
            </span>
            <span className="text-xs text-slate-300">Initial Inquiries & Follow-up Pipeline</span>
          </div>
          <h2 className="text-xl font-bold tracking-tight mt-1.5">
            Follow-Up / Initial Contact & Retention Pipeline
          </h2>
          <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
            Record initial visitor inquiries, capture dual contact numbers, view candidate age and location, assign employee detail loggers, and manage the 3-attempt outreach pipeline.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition shadow cursor-pointer active:scale-98"
          >
            <Plus className="w-4 h-4 text-emerald-300" />
            <span>+ Log Initial Contact Form</span>
          </button>
        </div>
      </div>

      {/* 2. SUB-TAB SWITCHER (INQUIRIES TABLE, 3-STRIKE RETENTION, & ANALYTICS REPORTS) */}
      <div className="flex items-center gap-2 p-1.5 bg-slate-100 rounded-xl w-full sm:w-fit border border-slate-200 print:hidden">
        <button
          onClick={() => setActiveSubTab('initial_contacts')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            activeSubTab === 'initial_contacts'
              ? 'bg-white text-slate-900 shadow-xs ring-1 ring-slate-200'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <PhoneCall className="w-4 h-4 text-emerald-600" />
          <span>Initial Inquiries & Contacts</span>
          <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-bold">
            {contacts.length}
          </span>
        </button>

        <button
          onClick={() => setActiveSubTab('pipeline')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            activeSubTab === 'pipeline'
              ? 'bg-white text-indigo-950 shadow-xs ring-1 ring-slate-200'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Layers className="w-4 h-4 text-indigo-600" />
          <span>3-Strike Retention Protocol</span>
          <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-800 font-bold border border-indigo-200">
            {applicants.filter((a) => a.current_status === 'FOLLOW_UP').length || applicants.length}
          </span>
        </button>

        <button
          onClick={() => setActiveSubTab('analytics')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            activeSubTab === 'analytics'
              ? 'bg-white text-purple-950 shadow-xs ring-1 ring-slate-200'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <BarChart3 className="w-4 h-4 text-purple-600" />
          <span>Inquiry Analytics & Monthly Reports</span>
        </button>
      </div>

      {/* VIEW A: INITIAL INQUIRIES & VISITOR CONTACTS TABLE */}
      {activeSubTab === 'initial_contacts' && (
        <div className="space-y-4">
          {/* Filter Bar: calling/walkin/pending/registered tabs removed; All Inquiry Sources dropdown connected to all lead source */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
            {/* Inquiry Count Indicator */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-900 bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-xl font-mono">
                All Contacts ({filteredContacts.length}{filteredContacts.length !== contacts.length ? ` of ${contacts.length}` : ''})
              </span>
              <span className="text-xs text-slate-500 hidden md:inline">
                Initial inquiries & lead intake records
              </span>
            </div>

            {/* Dropdown Filters */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Gender Filter */}
              <select
                value={filterGender}
                onChange={(e) => setFilterGender(e.target.value)}
                className="bg-slate-50 border border-slate-200 px-3 py-1.5 text-xs rounded-xl font-bold text-slate-700 focus:outline-none cursor-pointer"
              >
                <option value="ALL">Gender</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>

              {/* Lead Source Filter - Connected to all lead sources */}
              <select
                value={filterSource}
                onChange={(e) => setFilterSource(e.target.value)}
                className="bg-slate-50 border border-slate-200 px-3 py-1.5 text-xs rounded-xl font-bold text-slate-800 focus:outline-none cursor-pointer"
              >
                <option value="ALL">All Inquiry Sources</option>
                <option value="By Calling">By Calling</option>
                <option value="By Facebook">By Facebook</option>
                <option value="By WhatsApp">By WhatsApp</option>
                <option value="Heard from Someone">Heard from Someone</option>
                <option value="From Some Person">From Some Person</option>
                <option value="From who already went to work from our agency">Alumni Referral</option>
                <option value="Inquiries Finished / Registered">Inquiries Finished / Registered</option>
                <option value="Office Walk-in">Office Walk-in</option>
              </select>

              <div className="relative w-48">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search name, phone, city..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 pl-8 pr-3 py-1.5 text-xs rounded-xl focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* Main Table: Ref No changed to Applicant Temporary Register No, Location column added, Inquiry Details popout, Watch Applicant Form action */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead className="bg-slate-50 font-bold uppercase tracking-wider text-[10px] text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="p-3.5 pl-4 font-mono">Applicant Temporary Register No</th>
                    <th className="p-3.5 min-w-[200px]">Applicant Name & Age</th>
                    <th className="p-3.5 min-w-[140px]">Location</th>
                    <th className="p-3.5 min-w-[200px]">Phone Contact(s)</th>
                    <th className="p-3.5">Interested Vacancy</th>
                    <th className="p-3.5 min-w-[180px]">Lead Source</th>
                    <th className="p-3.5 min-w-[170px]">Who Took Details (Staff)</th>
                    <th className="p-3.5 min-w-[180px]">Inquiry Details</th>
                    <th className="p-3.5 text-center">Conversion</th>
                    <th className="p-3.5 pr-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-sans">
                  {loading ? (
                    <tr>
                      <td colSpan={10} className="p-8 text-center text-slate-400">
                        Loading initial inquiries...
                      </td>
                    </tr>
                  ) : filteredContacts.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="p-8 text-center text-slate-400">
                        No initial inquiries found matching the filters. Click "+ Log Initial Contact Form" to create a new record.
                      </td>
                    </tr>
                  ) : (
                      filteredContacts.map((contact) => {
                        const hasTwoNumbers = Boolean(contact.alternative_phone && contact.alternative_phone.trim() !== '');
                        const activeNumber = selectedPhoneMap[contact.id] || contact.phone;
                        
                        // Check if candidate is in Follow Up Succeed Table or marked OK for registration
                        const isSucceed =
                          (contact as any).conversion_status === 'OK_FOR_REG' ||
                          (() => {
                            try {
                              const saved = localStorage.getItem('trans_arabian_followup_pipeline_v4');
                              if (saved) {
                                const parsed = JSON.parse(saved);
                                const match = parsed.find((r: any) => r.id === contact.id || r.temp_reg_no === contact.follow_up_no);
                                return match?.pipeline_stage === 'SUCCEEDED';
                              }
                            } catch (e) {}
                            return false;
                          })();

                        return (
                          <tr key={contact.id} className="hover:bg-slate-50/80 transition group">
                            {/* Applicant Temporary Register No */}
                            <td className="p-3.5 pl-4 font-mono font-bold text-slate-900 whitespace-nowrap">
                              <span>{contact.follow_up_no}</span>
                              <span className="block text-[10px] text-slate-400 font-normal">{formatToDDMMYYYY(contact.contact_date)}</span>
                            </td>

                            {/* Applicant Name & Age */}
                            <td className="p-3.5 whitespace-nowrap">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-bold text-slate-900">{contact.person_name}</span>
                                <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200/80 px-1.5 py-0.5 rounded-md">
                                  Age: {contact.age || 26}
                                </span>
                              </div>
                            </td>

                            {/* Location Column */}
                            <td className="p-3.5 whitespace-nowrap">
                              <span className="text-xs text-slate-700 font-semibold flex items-center gap-1">
                                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                                <span>{contact.living_place || 'Colombo'}</span>
                              </span>
                            </td>

                            {/* Phone Contact(s) with Dropdown selector if two numbers exist; primary shown by default with WhatsApp indicator */}
                            <td className="p-3.5 font-mono text-slate-800 whitespace-nowrap">
                              {hasTwoNumbers ? (
                                <div className="flex flex-col gap-1">
                                  <div className="flex items-center gap-1.5">
                                    <select
                                      value={activeNumber}
                                      onChange={(e) =>
                                        setSelectedPhoneMap((prev) => ({
                                          ...prev,
                                          [contact.id]: e.target.value
                                        }))
                                      }
                                      className="bg-emerald-50 border border-emerald-300 text-emerald-950 font-bold px-2 py-1 rounded-lg text-xs cursor-pointer focus:outline-none"
                                    >
                                      <option value={contact.phone}>
                                        Primary: {contact.phone} (WhatsApp)
                                      </option>
                                      <option value={contact.alternative_phone}>
                                        Alt: {contact.alternative_phone}
                                      </option>
                                    </select>
                                  </div>
                                  <span className="text-[10px] text-emerald-700 flex items-center gap-1 font-sans font-semibold">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                    <span>2 Numbers on file · WhatsApp on Primary</span>
                                  </span>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1.5 font-semibold text-slate-900">
                                  <PhoneCall className="w-3.5 h-3.5 text-emerald-600" />
                                  <span>{contact.phone}</span>
                                  <span className="bg-emerald-100 text-emerald-800 text-[9px] font-sans font-bold px-1.5 py-0.2 rounded">
                                    WhatsApp
                                  </span>
                                </div>
                              )}
                            </td>

                            {/* Interested Vacancy (Company name completely removed) */}
                            <td className="p-3.5 whitespace-nowrap">
                              <span className="font-bold text-slate-800">
                                {contact.preferred_job_category || 'General'}
                              </span>
                            </td>

                            {/* Lead Source */}
                            <td className="p-3.5">
                              <select
                                value={contact.how_visitor_know || 'By Calling'}
                                onChange={(e) => handleUpdateSource(contact.id, e.target.value)}
                                className="w-full bg-white hover:bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer shadow-2xs"
                              >
                                <option value="By Calling">By Calling</option>
                                <option value="By Facebook">By Facebook</option>
                                <option value="By WhatsApp">By WhatsApp</option>
                                <option value="Heard from Someone">Heard from Someone</option>
                                <option value="From Some Person">From Some Person</option>
                                <option value="From who already went to work from our agency">Alumni Referral</option>
                                <option value="Inquiries Finished / Registered">Inquiries Finished / Registered</option>
                                <option value="Office Walk-in">Office Walk-in</option>
                              </select>
                            </td>

                            {/* WHO TOOK DETAILS (Employee Dropdown Column) */}
                            <td className="p-3.5">
                              <select
                                value={contact.staff_name || availableStaff[0]?.name}
                                onChange={(e) => {
                                  const selectedStf = availableStaff.find((s) => s.name === e.target.value);
                                  if (selectedStf) {
                                    handleUpdateStaff(contact.id, selectedStf);
                                  }
                                }}
                                className="w-full bg-slate-50 hover:bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                              >
                                {availableStaff.map((st) => (
                                  <option key={st.staff_id} value={st.name}>
                                    {st.name} ({st.role.split(' ')[0]})
                                  </option>
                                ))}
                              </select>
                            </td>

                            {/* Inquiry Details: Pop out full details on click */}
                            <td className="p-3.5">
                              <button
                                type="button"
                                onClick={() => setSelectedInquiryDetail(contact)}
                                className="text-left group flex items-start gap-1.5 p-1 rounded-lg hover:bg-indigo-50 border border-transparent hover:border-indigo-200 transition max-w-[200px] cursor-pointer"
                                title="Click to pop out full inquiry details"
                              >
                                <FileText className="w-3.5 h-3.5 text-indigo-600 mt-0.5 shrink-0 group-hover:scale-110 transition" />
                                <span className="truncate text-slate-700 group-hover:text-indigo-900 underline decoration-indigo-300 underline-offset-2 font-medium">
                                  {contact.description || 'General Inquiry'}
                                </span>
                              </button>
                            </td>

                            {/* Conversion Status */}
                            <td className="p-3.5 text-center whitespace-nowrap">
                              {contact.converted_to_applicant ? (
                                <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 font-bold px-2.5 py-0.5 rounded-full text-[10px]">
                                  <CheckCircle2 className="w-3 h-3" />
                                  <span>Registered</span>
                                </span>
                              ) : isSucceed ? (
                                <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-900 border border-emerald-400 font-bold px-2.5 py-0.5 rounded-full text-[10px] shadow-xs">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                  <span>Applicant Ok for Registration</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-800 font-bold px-2.5 py-0.5 rounded-full text-[10px]">
                                  <span>Registration Pending</span>
                                </span>
                              )}
                            </td>

                            {/* Action: Watch each contact applicant form */}
                            <td className="p-3.5 pr-4 text-right whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => setSelectedApplicantForm(contact)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200/80 text-xs font-bold rounded-xl transition cursor-pointer shadow-xs active:scale-95"
                                title="Watch each contact applicant form"
                              >
                                <FileText className="w-3.5 h-3.5 text-indigo-600" />
                                <span>Watch Applicant Form</span>
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

      {/* VIEW B: 3-STRIKE CANDIDATE RETENTION PIPELINE (NOW UNIFIED WITH TABLES, MOVEMENT BUTTONS & CLOSED/SUCCEED TABLES) */}
      {activeSubTab === 'pipeline' && (
        <FollowUpBoard
          applicants={applicants}
          contacts={contacts}
          staffList={availableStaff}
          onLogFollowup={onLogFollowup || (() => {})}
          onViewProfile={onViewApplicant}
          onPrintApplicant={onPrintApplicant || (() => {})}
          onReopenApplicant={onReopenApplicant || (() => {})}
          showNotification={showNotification}
          onRefreshData={fetchContacts}
        />
      )}

      {/* VIEW C: INQUIRY ANALYTICS & MONTHLY / YEARLY REPORTS */}
      {activeSubTab === 'analytics' && (
        <div className="space-y-6">
          {/* Controls Bar for Report Filtering & Printing */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4 print:hidden">
            <div>
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-purple-600" />
                <span>Vacancy Inquiries & Lead Analytics Dashboard</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Filter calling vs walk-in inquiries by specific month, month ranges, or yearly metrics.
              </p>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              {/* Report Mode Selector */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                <button
                  onClick={() => setReportFilterMode('single_month')}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition cursor-pointer ${
                    reportFilterMode === 'single_month' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  Specific Month
                </button>
                <button
                  onClick={() => setReportFilterMode('month_range')}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition cursor-pointer ${
                    reportFilterMode === 'month_range' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  Month Range
                </button>
                <button
                  onClick={() => setReportFilterMode('yearly')}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition cursor-pointer ${
                    reportFilterMode === 'yearly' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  Yearly
                </button>
              </div>

              {/* Date Input Controls */}
              {reportFilterMode === 'single_month' && (
                <div className="flex items-center gap-1">
                  <label className="text-xs font-bold text-slate-600">Month:</label>
                  <input
                    type="month"
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-800"
                  />
                </div>
              )}

              {reportFilterMode === 'month_range' && (
                <div className="flex items-center gap-1.5">
                  <label className="text-xs font-bold text-slate-600">From:</label>
                  <input
                    type="month"
                    value={startMonth}
                    onChange={(e) => setStartMonth(e.target.value)}
                    className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-800"
                  />
                  <label className="text-xs font-bold text-slate-600">To:</label>
                  <input
                    type="month"
                    value={endMonth}
                    onChange={(e) => setEndMonth(e.target.value)}
                    className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-800"
                  />
                </div>
              )}

              {reportFilterMode === 'yearly' && (
                <div className="flex items-center gap-1">
                  <label className="text-xs font-bold text-slate-600">Year:</label>
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(e.target.value)}
                    className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-800 cursor-pointer"
                  >
                    <option value="2026">2026</option>
                    <option value="2025">2025</option>
                    <option value="2024">2024</option>
                  </select>
                </div>
              )}

              {/* Download / Print Button */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleExportAnalyticsExcel}
                  className="flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs px-3.5 py-2 rounded-xl transition cursor-pointer shadow-xs active:scale-98"
                  title="Export Summary & Breakdown to Excel (.xlsx)"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export Excel</span>
                </button>
                <button
                  onClick={handlePrintReport}
                  className="flex items-center gap-1.5 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs px-3.5 py-2 rounded-xl transition cursor-pointer shadow-xs active:scale-98"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print / Save PDF</span>
                </button>
              </div>
            </div>
          </div>

          {/* PRINTABLE REPORT CONTAINER */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-6 shadow-xs">
            {/* Report Official Agency Header */}
            <div className="border-b border-slate-200 pb-4 flex justify-between items-center">
              <div>
                <span className="text-[10px] font-mono font-bold text-purple-700 tracking-wider block">
                  TRANS ARABIAN FOREIGN EMPLOYMENT AGENCY · SLBFE #2601
                </span>
                <h2 className="text-lg font-black text-slate-900 tracking-wide uppercase mt-0.5">
                  INITIAL INQUIRIES & VACANCY LEAD SUMMARY REPORT
                </h2>
                <p className="text-xs text-slate-500 font-medium">
                  {reportFilterMode === 'single_month' && `Reporting Period: Month of ${selectedMonth}`}
                  {reportFilterMode === 'month_range' && `Reporting Period: Month Range (${startMonth} to ${endMonth})`}
                  {reportFilterMode === 'yearly' && `Reporting Period: Calendar Year ${selectedYear}`}
                </p>
              </div>
              <div className="text-right text-xs font-mono text-slate-500">
                <div>Generated: {new Date().toLocaleDateString()}</div>
                <div>Agency License: 1422</div>
              </div>
            </div>

            {/* Executive Key Performance Indicators (As a Whole) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Total Inquiries Received */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-900 to-indigo-950 text-white shadow-xs border border-slate-800">
                <div className="flex items-center justify-between text-slate-300">
                  <span className="text-xs font-bold uppercase tracking-wider">Total Leads & Inquiries</span>
                  <div className="w-7 h-7 rounded-lg bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center">
                    <Users className="w-3.5 h-3.5 text-indigo-300" />
                  </div>
                </div>
                <div className="text-3xl font-black font-mono tracking-tight text-white mt-2">
                  {analytics.totalInquiries}
                </div>
                <div className="flex justify-between items-center text-[11px] font-medium text-slate-300 mt-2.5 pt-2.5 border-t border-slate-800">
                  <span className="text-indigo-300 font-semibold">100% Demand Inflow</span>
                  <span className="text-slate-400">All intake sources</span>
                </div>
              </div>

              {/* Ready for Registration (Conversion Success) */}
              <div className="p-4 rounded-2xl bg-emerald-50/90 border border-emerald-200/80 shadow-xs">
                <div className="flex items-center justify-between text-emerald-900">
                  <span className="text-xs font-bold uppercase tracking-wider">Ready for Registration</span>
                  <div className="w-7 h-7 rounded-lg bg-emerald-100 border border-emerald-300 flex items-center justify-center">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                  </div>
                </div>
                <div className="text-3xl font-black font-mono tracking-tight text-emerald-950 mt-2">
                  {analytics.convertedTotal}
                </div>
                <div className="flex justify-between items-center text-[11px] font-medium text-emerald-800 mt-2.5 pt-2.5 border-t border-emerald-200/80">
                  <span className="font-bold text-emerald-700">{analytics.conversionRate}% Conversion Rate</span>
                  <span className="text-emerald-700">Master Registry</span>
                </div>
              </div>

              {/* Active Follow-Up Pipeline */}
              <div className="p-4 rounded-2xl bg-purple-50/90 border border-purple-200/80 shadow-xs">
                <div className="flex items-center justify-between text-purple-900">
                  <span className="text-xs font-bold uppercase tracking-wider">Active Retention Pipeline</span>
                  <div className="w-7 h-7 rounded-lg bg-purple-100 border border-purple-300 flex items-center justify-center">
                    <Layers className="w-3.5 h-3.5 text-purple-700" />
                  </div>
                </div>
                <div className="text-3xl font-black font-mono tracking-tight text-purple-950 mt-2">
                  {analytics.pipelineTotal}
                </div>
                <div className="flex justify-between items-center text-[11px] font-medium text-purple-800 mt-2.5 pt-2.5 border-t border-purple-200/80">
                  <span className="font-bold text-purple-700">{analytics.pipelineRate}% Follow-Up Pool</span>
                  <span className="text-purple-700">3-Strike Protocol</span>
                </div>
              </div>

              {/* Leading Vacancy Demand */}
              <div className="p-4 rounded-2xl bg-amber-50/90 border border-amber-200/80 shadow-xs">
                <div className="flex items-center justify-between text-amber-900">
                  <span className="text-xs font-bold uppercase tracking-wider">Top Vacancy Demand</span>
                  <div className="w-7 h-7 rounded-lg bg-amber-100 border border-amber-300 flex items-center justify-center">
                    <TrendingUp className="w-3.5 h-3.5 text-amber-700" />
                  </div>
                </div>
                <div className="text-lg font-black text-amber-950 mt-2 truncate" title={analytics.topCategory.category}>
                  {analytics.topCategory.category}
                </div>
                <div className="flex justify-between items-center text-[11px] font-medium text-amber-800 mt-2.5 pt-2.5 border-t border-amber-200/80">
                  <span className="font-bold text-amber-900">{analytics.topCategory.count} Inquiries</span>
                  <span className="text-amber-800">{analytics.topCategory.percentage}% Demand Share</span>
                </div>
              </div>
            </div>

            {/* MONTHLY SUMMARY MATRIX TABLE */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-3 border-b border-slate-100 gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-purple-100 border border-purple-200 flex items-center justify-center text-purple-700">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      Monthly Intake & Conversion Executive Matrix
                    </h4>
                    <p className="text-[11px] text-slate-500 font-medium">
                      Aggregated inquiry volume, leading demand trends, and registration outcomes by month
                    </p>
                  </div>
                </div>
                <span className="text-[10px] font-mono px-2.5 py-1 rounded-lg bg-slate-100 font-bold text-slate-700">
                  {analytics.monthlySummaryList.length} Period(s) Recorded
                </span>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                <table className="w-full text-xs text-left border-collapse">
                  <thead className="bg-slate-100 font-bold uppercase tracking-wider text-[10px] text-slate-700 border-b border-slate-200">
                    <tr>
                      <th className="p-3">Month / Reporting Period</th>
                      <th className="p-3 text-center bg-slate-200/60 font-black text-slate-900 border-l border-slate-200">Total Inquiries</th>
                      <th className="p-3">Leading Vacancy Demand</th>
                      <th className="p-3">Primary Lead Channel</th>
                      <th className="p-3 text-center bg-emerald-50 text-emerald-900 font-bold border-l border-slate-200">Ready for Registration</th>
                      <th className="p-3 text-center bg-purple-50 text-purple-900 font-bold">In Follow-Up Pipeline</th>
                      <th className="p-3 text-right bg-slate-100 text-slate-800 font-bold border-l border-slate-200">Conversion Rate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-sans">
                    {analytics.monthlySummaryList.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-slate-400">
                          No inquiry records found in the selected reporting period.
                        </td>
                      </tr>
                    ) : (
                      analytics.monthlySummaryList.map((m, idx) => {
                        const rate = m.total > 0 ? Math.round((m.converted / m.total) * 100) : 0;
                        return (
                          <tr key={idx} className="hover:bg-slate-50/80 transition">
                            <td className="p-3 font-bold text-slate-900">{m.monthName}</td>
                            <td className="p-3 text-center font-black font-mono text-slate-900 bg-slate-50/50 border-l border-slate-200 text-sm">
                              {m.total}
                            </td>
                            <td className="p-3 text-slate-800">
                              <span className="font-semibold text-indigo-900 bg-indigo-50 border border-indigo-200/60 px-2 py-0.5 rounded text-[11px] inline-block">
                                {m.topCategory}
                              </span>
                            </td>
                            <td className="p-3 text-slate-700">
                              <span className="font-medium text-slate-800">
                                {m.topSource}
                              </span>
                            </td>
                            <td className="p-3 text-center font-bold text-emerald-800 bg-emerald-50/30 border-l border-slate-200">
                              <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 font-mono text-xs">
                                {m.converted}
                              </span>
                            </td>
                            <td className="p-3 text-center font-bold text-purple-800 bg-purple-50/30">
                              <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-900 font-mono text-xs">
                                {m.pipeline}
                              </span>
                            </td>
                            <td className="p-3 text-right border-l border-slate-200">
                              <div className="flex items-center justify-end gap-2">
                                <div className="w-16 bg-slate-100 rounded-full h-2 overflow-hidden hidden sm:block">
                                  <div
                                    className="bg-emerald-600 h-2 rounded-full"
                                    style={{ width: `${Math.min(rate, 100)}%` }}
                                  />
                                </div>
                                <span className="font-mono font-bold text-slate-900 text-xs">{rate}%</span>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                  {/* Total Footer Row */}
                  <tfoot className="bg-slate-900 text-white font-bold text-xs border-t-2 border-slate-900">
                    <tr>
                      <td className="p-3 uppercase tracking-wider">Total Summary</td>
                      <td className="p-3 text-center font-mono font-black text-amber-300 text-sm border-l border-slate-700">
                        {analytics.totalInquiries}
                      </td>
                      <td className="p-3 text-indigo-200 font-medium">
                        {analytics.topCategory.category} ({analytics.topCategory.count})
                      </td>
                      <td className="p-3 text-slate-300 font-medium">
                        {analytics.topSource.source} ({analytics.topSource.count})
                      </td>
                      <td className="p-3 text-center bg-emerald-900 text-emerald-100 font-black border-l border-slate-700">
                        {analytics.convertedTotal}
                      </td>
                      <td className="p-3 text-center bg-purple-900 text-purple-100 font-black">
                        {analytics.pipelineTotal}
                      </td>
                      <td className="p-3 text-right text-emerald-400 font-mono font-black text-sm border-l border-slate-700">
                        {analytics.conversionRate}%
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* STRATEGIC DEEP-DIVE SECTIONS (Side by Side in separate styled cards) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
              {/* Panel 1: Vacancy & Job Demand Analysis */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs space-y-4">
                <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-indigo-100 border border-indigo-200 flex items-center justify-center text-indigo-700">
                      <Briefcase className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                        Vacancy & Employment Demand Distribution
                      </h4>
                      <p className="text-[11px] text-slate-500 font-medium">Breakdown by preferred job category</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-50 text-indigo-800 font-bold">
                    {analytics.categoryList.length} Trade(s)
                  </span>
                </div>
                <div className="border border-slate-200 rounded-xl overflow-hidden text-xs shadow-2xs">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50 font-bold uppercase text-[10px] text-slate-600 border-b border-slate-200">
                      <tr>
                        <th className="p-2.5">Job Category</th>
                        <th className="p-2.5 text-center">Inquiries</th>
                        <th className="p-2.5">Demand Share</th>
                        <th className="p-2.5 text-center">Ready for Reg</th>
                        <th className="p-2.5 text-right">Success Rate</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-sans">
                      {analytics.categoryList.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="p-4 text-center text-slate-400">
                            No vacancy demand data recorded in this period.
                          </td>
                        </tr>
                      ) : (
                        analytics.categoryList.map((cat, i) => (
                          <tr key={i} className="hover:bg-slate-50/80 transition">
                            <td className="p-2.5 font-bold text-slate-900 flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                              <span>{cat.category}</span>
                            </td>
                            <td className="p-2.5 text-center font-mono font-bold text-slate-800">
                              {cat.count}
                            </td>
                            <td className="p-2.5">
                              <div className="flex items-center gap-2">
                                <div className="w-14 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                  <div
                                    className="bg-indigo-600 h-1.5 rounded-full"
                                    style={{ width: `${Math.min(cat.percentage, 100)}%` }}
                                  />
                                </div>
                                <span className="font-mono text-[11px] text-slate-500">{cat.percentage}%</span>
                              </div>
                            </td>
                            <td className="p-2.5 text-center font-bold text-emerald-800">
                              {cat.converted}
                            </td>
                            <td className="p-2.5 text-right font-mono font-bold text-slate-900">
                              {cat.conversionRate}%
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Panel 2: Lead Acquisition Sources & Channel Efficacy */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs space-y-4">
                <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-purple-100 border border-purple-200 flex items-center justify-center text-purple-700">
                      <Target className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                        Lead Acquisition Channels Efficacy
                      </h4>
                      <p className="text-[11px] text-slate-500 font-medium">Breakdown by visitor source channel</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-50 text-purple-800 font-bold">
                    {analytics.sourceList.length} Channel(s)
                  </span>
                </div>
                <div className="border border-slate-200 rounded-xl overflow-hidden text-xs shadow-2xs">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50 font-bold uppercase text-[10px] text-slate-600 border-b border-slate-200">
                      <tr>
                        <th className="p-2.5">Acquisition Channel</th>
                        <th className="p-2.5 text-center">Inquiries</th>
                        <th className="p-2.5">Inflow Share</th>
                        <th className="p-2.5 text-center">Ready for Reg</th>
                        <th className="p-2.5 text-right">Conversion Rate</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-sans">
                      {analytics.sourceList.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="p-4 text-center text-slate-400">
                            No lead source data recorded in this period.
                          </td>
                        </tr>
                      ) : (
                        analytics.sourceList.map((src, i) => (
                          <tr key={i} className="hover:bg-slate-50/80 transition">
                            <td className="p-2.5 font-bold text-slate-900 flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
                              <span>{src.source}</span>
                            </td>
                            <td className="p-2.5 text-center font-mono font-bold text-slate-800">
                              {src.count}
                            </td>
                            <td className="p-2.5">
                              <div className="flex items-center gap-2">
                                <div className="w-14 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                  <div
                                    className="bg-purple-600 h-1.5 rounded-full"
                                    style={{ width: `${Math.min(src.percentage, 100)}%` }}
                                  />
                                </div>
                                <span className="font-mono text-[11px] text-slate-500">{src.percentage}%</span>
                              </div>
                            </td>
                            <td className="p-2.5 text-center font-bold text-emerald-800">
                              {src.converted}
                            </td>
                            <td className="p-2.5 text-right font-mono font-bold text-slate-900">
                              {src.conversionRate}%
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Panel 3: Intake Officer & Staff Lead Performance (Separate distinct full-width card) */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs space-y-4 pt-2">
              <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-amber-100 border border-amber-200 flex items-center justify-center text-amber-700">
                    <Award className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      Intake Officer & Staff Lead Performance
                    </h4>
                    <p className="text-[11px] text-slate-500 font-medium">Assigned personnel workload and conversion accountability</p>
                  </div>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-50 text-amber-800 font-bold">
                  {analytics.staffList.length} Officer(s)
                </span>
              </div>
              <div className="border border-slate-200 rounded-xl overflow-hidden text-xs shadow-2xs">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50 font-bold uppercase text-[10px] text-slate-600 border-b border-slate-200">
                    <tr>
                      <th className="p-2.5">Staff Officer Name</th>
                      <th className="p-2.5 text-center">Inquiries Handled</th>
                      <th className="p-2.5">Intake Workload Share</th>
                      <th className="p-2.5 text-center">Conversions to Registration</th>
                      <th className="p-2.5 text-center">Conversion Success</th>
                      <th className="p-2.5 text-right">Performance Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-sans">
                    {analytics.staffList.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-4 text-center text-slate-400">
                          No staff logging records found for this period.
                        </td>
                      </tr>
                    ) : (
                      analytics.staffList.map((stf, i) => (
                        <tr key={i} className="hover:bg-slate-50/80 transition">
                          <td className="p-2.5 font-bold text-slate-900">
                            {stf.staffName}
                          </td>
                          <td className="p-2.5 text-center font-mono font-bold text-slate-800">
                            {stf.count}
                          </td>
                          <td className="p-2.5">
                            <div className="flex items-center gap-2">
                              <div className="w-16 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                <div
                                  className="bg-slate-700 h-1.5 rounded-full"
                                  style={{ width: `${Math.min(stf.percentage, 100)}%` }}
                                />
                              </div>
                              <span className="font-mono text-[11px] text-slate-500">{stf.percentage}%</span>
                            </div>
                          </td>
                          <td className="p-2.5 text-center font-mono font-bold text-emerald-700">
                            {stf.converted}
                          </td>
                          <td className="p-2.5 text-center">
                            <span className="font-mono font-bold text-xs bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded">
                              {stf.conversionRate}%
                            </span>
                          </td>
                          <td className="p-2.5 text-right font-bold text-slate-700">
                            <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 font-mono text-[11px]">
                              {stf.count > 10 ? 'Top Performer' : stf.count > 5 ? 'Active' : 'Standard'}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: LOG INITIAL PRE-REGISTRATION CONTACT FORM */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-100 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <div>
                <span className="text-[10px] font-mono font-bold text-emerald-600 uppercase tracking-wider block">
                  MODULE 01 · INITIAL INQUIRY FORM
                </span>
                <h3 className="font-bold text-base text-slate-900">
                  Log New Initial Inquiry & Contact Details
                </h3>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateContact} className="space-y-3.5 text-xs">
              {/* Person Name & Applicant Age */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="font-bold text-slate-700 block mb-1">Applicant / Inquirer Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. KAVINDA PERERA"
                    value={form.person_name}
                    onChange={(e) => setForm({ ...form, person_name: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-bold text-slate-900"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Applicant Age (Years) *</label>
                  <input
                    type="number"
                    min={18}
                    max={65}
                    required
                    placeholder="e.g. 26"
                    value={form.age}
                    onChange={(e) => setForm({ ...form, age: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-bold text-indigo-950 font-mono"
                  />
                </div>
              </div>

              {/* Dual Contact Numbers */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Phone Number 1 (Primary - WhatsApp) *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. +94771234567"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Phone Number 2 (Alternative Number)</label>
                  <input
                    type="text"
                    placeholder="e.g. +94719876543"
                    value={form.alternative_phone}
                    onChange={(e) => setForm({ ...form, alternative_phone: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-mono"
                  />
                </div>
              </div>

              {/* Gender & Living Place */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Gender *</label>
                  <select
                    value={form.gender}
                    onChange={(e) => setForm({ ...form, gender: e.target.value as any })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-bold text-slate-800 cursor-pointer"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Living Place / City</label>
                  <input
                    type="text"
                    placeholder="e.g. Colombo, Gampaha"
                    value={form.living_place}
                    onChange={(e) => setForm({ ...form, living_place: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-semibold"
                  />
                </div>
              </div>

              {/* Lead Source & Conversion (Updated to exact user specs) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Lead Source *</label>
                  <select
                    value={form.how_visitor_know}
                    onChange={(e) => {
                      const val = e.target.value;
                      let channel: any = 'CALL';
                      if (val.includes('WhatsApp')) channel = 'WHATSAPP';
                      else if (val.includes('Walk-in')) channel = 'WALK-IN / VISIT';
                      else if (val.includes('Facebook')) channel = 'MESSAGE';
                      else if (val.includes('Someone') || val.includes('agency')) channel = 'REFERRAL';
                      setForm({
                        ...form,
                        how_visitor_know: val,
                        contact_type: channel
                      });
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-bold text-slate-800 cursor-pointer"
                  >
                    <option value="By Calling">By Calling</option>
                    <option value="By Facebook">By Facebook</option>
                    <option value="By WhatsApp">By WhatsApp</option>
                    <option value="Heard from Someone">Heard from Someone</option>
                    <option value="From Some Person">From Some Person</option>
                    <option value="From who already went to work from our agency">Alumni Referral</option>
                    <option value="Inquiries Finished / Registered">Inquiries Finished / Registered</option>
                    <option value="Office Walk-in">Office Walk-in</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Conversion *</label>
                  <select
                    value={form.conversion}
                    onChange={(e) => setForm({ ...form, conversion: e.target.value as any })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-bold text-slate-800 cursor-pointer"
                  >
                    <option value="Registration Pending">Registration Pending (Move to 3-Strike Attempt 01)</option>
                    <option value="Registration Ok">Registration Ok (Move to Master Registry Pending)</option>
                  </select>
                </div>
              </div>

              {/* Interested Vacancy & How did you know about this vacancy */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Interested Vacancy / Job Category *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Kitchen Helper, Driver, Waiter"
                    value={form.preferred_job_category}
                    onChange={(e) => setForm({ ...form, preferred_job_category: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-semibold"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    How did you know about this vacancy? *
                  </label>
                  <select
                    value={form.how_did_you_know_vacancy}
                    onChange={(e) => setForm({ ...form, how_did_you_know_vacancy: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-bold text-slate-800 cursor-pointer"
                  >
                    <option value="Facebook Advertisement">Facebook Advertisement</option>
                    <option value="WhatsApp Group / Status">WhatsApp Group / Status</option>
                    <option value="Friend or Relative Recommendation">Friend or Relative Recommendation</option>
                    <option value="Alumni Referral (Candidate already went abroad)">Alumni Referral (Already went abroad)</option>
                    <option value="Direct Call to Agency">Direct Call to Agency</option>
                    <option value="Office Walk-in / Banner Notice">Office Walk-in / Banner Notice</option>
                    <option value="TikTok / Social Media Post">TikTok / Social Media Post</option>
                    <option value="Newspaper / Paper Classified Ad">Newspaper / Paper Classified Ad</option>
                    <option value="Job Portal / Agency Website">Job Portal / Agency Website</option>
                    <option value="Sub-Agent / Local Field Coordinator">Sub-Agent / Field Coordinator</option>
                    <option value="Other Media">Other Media</option>
                  </select>
                </div>
              </div>

              {/* WHO TOOK DETAILS (Staff Dropdown) */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Who Took Person's Details (Assigned Employee) *
                </label>
                <select
                  value={form.staff_name}
                  onChange={(e) => {
                    const selectedName = e.target.value;
                    const stf = availableStaff.find((s) => s.name === selectedName);
                    setForm({
                      ...form,
                      staff_name: selectedName,
                      staff_id: stf ? stf.staff_id : 'S-02'
                    });
                  }}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-bold text-slate-800 cursor-pointer"
                >
                  {availableStaff.map((st) => (
                    <option key={st.staff_id} value={st.name}>
                      {st.name} ({st.role})
                    </option>
                  ))}
                </select>
              </div>

              {/* Inquiry Notes */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">Inquiry / Discussion Notes *</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Inquired about GCC medical rules, salary packages, flight schedule..."
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold shadow transition cursor-pointer"
                >
                  Submit & Add to Initial Inquiries
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: INQUIRY DETAILS FULL EXTENDED POPOUT (Item 04) */}
      {selectedInquiryDetail && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center">
                  <FileText className="w-4 h-4 text-indigo-600" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900">
                    Inquiry Details & Extended Notes
                  </h3>
                  <span className="text-[11px] font-mono text-slate-400">
                    Ref No: {selectedInquiryDetail.follow_up_no} · {formatToDDMMYYYY(selectedInquiryDetail.contact_date)}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setSelectedInquiryDetail(null)}
                className="text-slate-400 hover:text-slate-600 font-bold text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Applicant Name</span>
                  <span className="font-bold text-slate-900 text-sm">{selectedInquiryDetail.person_name}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Age & Location</span>
                  <span className="font-semibold text-slate-800">
                    {selectedInquiryDetail.age || 26} Yrs · {selectedInquiryDetail.living_place || 'Colombo'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Lead Source</span>
                  <span className="font-semibold text-slate-800">{selectedInquiryDetail.how_visitor_know || 'By Calling'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Assigned Staff</span>
                  <span className="font-semibold text-slate-800">{selectedInquiryDetail.staff_name || 'Staff'}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">How Did You Know About This Vacancy?</span>
                  <span className="font-semibold text-slate-800">
                    {selectedInquiryDetail.how_did_you_know_vacancy || selectedInquiryDetail.how_visitor_know || 'Facebook Advertisement'}
                  </span>
                </div>
                <div className="col-span-2">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Interested Vacancy</span>
                  <span className="font-bold text-indigo-900 bg-indigo-50/80 px-2 py-0.5 rounded border border-indigo-200/60 inline-block mt-0.5">
                    {selectedInquiryDetail.preferred_job_category || 'General'}
                  </span>
                </div>
              </div>

              {/* Full Discussion Notes */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">Full Inquiry Discussion & Log Notes:</label>
                <div className="p-3.5 bg-indigo-50/40 border border-indigo-100 rounded-xl text-slate-800 leading-relaxed font-sans whitespace-pre-wrap">
                  {selectedInquiryDetail.description || 'No detailed discussion notes logged.'}
                </div>
              </div>

              {selectedInquiryDetail.remarks && (
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Additional Staff Remarks:</label>
                  <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-sans">
                    {selectedInquiryDetail.remarks}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSelectedInquiryDetail(null)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs shadow transition cursor-pointer"
              >
                Close Popout
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: WATCH CONTACT APPLICANT FORM (Item 06) */}
      {selectedApplicantForm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-100 space-y-4 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <div>
                <span className="text-[10px] font-mono font-bold text-indigo-600 uppercase tracking-wider block">
                  OFFICIAL INITIAL INQUIRY DOSSIER
                </span>
                <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-indigo-600" />
                  <span>Applicant Initial Contact Form Record</span>
                </h3>
              </div>
              <button
                onClick={() => setSelectedApplicantForm(null)}
                className="text-slate-400 hover:text-slate-600 font-bold text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Applicant Profile Information Card */}
            <div className="space-y-4 text-xs">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[10px] text-slate-400 font-mono uppercase font-bold">Temporary Reg No</span>
                    <h4 className="text-base font-black text-slate-900">{selectedApplicantForm.follow_up_no}</h4>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
                    Logged: {formatToDDMMYYYY(selectedApplicantForm.contact_date)}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-200/80">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Applicant Name</span>
                    <span className="font-bold text-slate-900">{selectedApplicantForm.person_name}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Age</span>
                    <span className="font-bold text-slate-900">{selectedApplicantForm.age || 26} Years</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Gender</span>
                    <span className="font-bold text-slate-900">{selectedApplicantForm.gender || 'Male'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Location / Place</span>
                    <span className="font-bold text-slate-900">{selectedApplicantForm.living_place || 'Colombo'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Primary Phone</span>
                    <span className="font-mono font-bold text-emerald-800">{selectedApplicantForm.phone}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Alternative Phone</span>
                    <span className="font-mono text-slate-700">{selectedApplicantForm.alternative_phone || 'None'}</span>
                  </div>
                </div>
              </div>

              {/* Inquiry & Intake Details */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Lead Source</span>
                    <span className="font-semibold text-slate-800">{selectedApplicantForm.how_visitor_know || 'By Calling'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Who Took Details (Staff)</span>
                    <span className="font-semibold text-slate-800">{selectedApplicantForm.staff_name || 'Staff'}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">How Did You Know About This Vacancy?</span>
                    <span className="font-semibold text-slate-800">
                      {selectedApplicantForm.how_did_you_know_vacancy || selectedApplicantForm.how_visitor_know || 'Facebook Advertisement'}
                    </span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Interested Vacancy</span>
                    <span className="font-bold text-indigo-900">{selectedApplicantForm.preferred_job_category || 'General'}</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200/80">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Inquiry / Discussion Notes</span>
                  <p className="text-slate-800 leading-relaxed font-sans bg-white p-3 rounded-lg border border-slate-200">
                    {selectedApplicantForm.description || 'General Inquiry'}
                  </p>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex justify-between items-center pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 rounded-xl font-bold text-slate-700 hover:bg-slate-50 cursor-pointer text-xs"
              >
                <Printer className="w-3.5 h-3.5 text-slate-500" />
                <span>Print Form</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedApplicantForm(null)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs shadow transition cursor-pointer"
              >
                Close Form
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: CONVERT TO FORMAL REGISTERED APPLICANT */}
      {showConvertModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <h3 className="font-bold text-base text-slate-900">
              Convert Contact to Registered Candidate
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Promote initial contact <strong className="text-slate-900">{showConvertModal.person_name}</strong> to an active candidate record in Master Registry?
            </p>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
              <div><strong>Age:</strong> {showConvertModal.age || 26} Yrs</div>
              <div><strong>Phone 1:</strong> {showConvertModal.phone}</div>
              {showConvertModal.alternative_phone && (
                <div><strong>Phone 2:</strong> {showConvertModal.alternative_phone}</div>
              )}
              <div><strong>Category:</strong> {showConvertModal.preferred_job_category || 'General'}</div>
              <div><strong>Logger Staff:</strong> {showConvertModal.staff_name || 'Fathima Nazia'}</div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setShowConvertModal(null)}
                className="px-4 py-2 border border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => handleConvert(showConvertModal)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold shadow transition cursor-pointer"
              >
                Confirm Conversion
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
