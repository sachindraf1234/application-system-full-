import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  Download,
  Filter,
  Users,
  CheckCircle2,
  Calendar,
  PlaneTakeoff,
  Building2,
  PhoneCall,
  FileSpreadsheet
} from 'lucide-react';
import { ApplicantOverview } from '../types';

interface Props {
  applicants: ApplicantOverview[];
  showNotification: (type: 'success' | 'error' | 'info', msg: string) => void;
}

export const ReportsView: React.FC<Props> = ({ applicants, showNotification }) => {
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/reports/summary');
      const json = await res.json();
      if (json.success) {
        setSummary(json.summary);
      }
    } catch (err) {
      console.error('Failed to load summary reports', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const handleExportCSV = (template: string) => {
    window.open(`/api/export/${template}`, '_blank');
    showNotification('success', `Exporting report CSV for ${template}...`);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white shadow-md flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold font-mono bg-emerald-400 text-slate-950">
              EXECUTIVE ANALYTICS & STATUTORY REPORTS
            </span>
            <span className="text-xs text-slate-300">Master Prompt V3 Module</span>
          </div>
          <h2 className="text-xl font-bold tracking-tight mt-1.5">
            TRANS ARABIAN Operations Reports Engine
          </h2>
          <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
            Real-time normalized reports for Sri Lanka Foreign Employment Bureau (SLBFE) registration, embassy conversion metrics, departure statistics, and business inquiries.
          </p>
        </div>
      </div>

      {/* Summary KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-1">
          <div className="flex justify-between items-center text-slate-500">
            <span className="text-[10px] font-bold uppercase tracking-wider">Registered Applicants</span>
            <Users className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-3xl font-mono font-bold text-slate-900">
            {summary?.totalApplicants || applicants.length}
          </div>
          <div className="text-[11px] text-slate-500 flex gap-2 pt-1 font-semibold">
            <span className="text-blue-700">{summary?.males || 0} Males</span>
            <span>·</span>
            <span className="text-purple-700">{summary?.females || 0} Females</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-1">
          <div className="flex justify-between items-center text-slate-500">
            <span className="text-[10px] font-bold uppercase tracking-wider">Initial Contacts Logged</span>
            <PhoneCall className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-3xl font-mono font-bold text-blue-800">
            {summary?.initialContactsCount || 0}
          </div>
          <div className="text-[11px] text-slate-500 pt-1 font-semibold">
            <span>{summary?.convertedContactsCount || 0} Converted to Applicants</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-1">
          <div className="flex justify-between items-center text-slate-500">
            <span className="text-[10px] font-bold uppercase tracking-wider">Embassy Visa Approved</span>
            <CheckCircle2 className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-3xl font-mono font-bold text-purple-800">
            {summary?.visaApproved || 0}
          </div>
          <div className="text-[11px] text-slate-500 pt-1 font-semibold">
            <span>{summary?.embassyPending || 0} Embassy Interviews Pending</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-1">
          <div className="flex justify-between items-center text-slate-500">
            <span className="text-[10px] font-bold uppercase tracking-wider">Flight Tickets Issued</span>
            <PlaneTakeoff className="w-4 h-4 text-cyan-600" />
          </div>
          <div className="text-3xl font-mono font-bold text-cyan-800">
            {summary?.ticketsCount || 0}
          </div>
          <div className="text-[11px] text-slate-500 pt-1 font-semibold">
            <span>{summary?.departuresCount || 0} Scheduled Departures</span>
          </div>
        </div>
      </div>

      {/* Available Exportable Reports Cards */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
        <h3 className="font-bold text-base text-slate-900 border-b border-slate-100 pb-3">
          Statutory Excel & CSV Exportable Reports
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                <h4 className="font-bold text-xs text-slate-900">Male Register Summary Report</h4>
              </div>
              <p className="text-[11px] text-slate-500">
                Official Male applicant registry maintaining exact legacy headers (EXPERINCED, REMAKS, Reg Date, POLICE REPORT).
              </p>
            </div>
            <button
              onClick={() => handleExportCSV('REGISTER_MALE')}
              className="w-full flex items-center justify-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs py-2 rounded-lg transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download (.csv / .xlsx)</span>
            </button>
          </div>

          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <FileSpreadsheet className="w-4 h-4 text-purple-600" />
                <h4 className="font-bold text-xs text-slate-900">Female Register Summary Report</h4>
              </div>
              <p className="text-[11px] text-slate-500">
                Official Female applicant registry maintaining exact legacy headers and SLBFE registration dates.
              </p>
            </div>
            <button
              onClick={() => handleExportCSV('REGISTER_FEMALE')}
              className="w-full flex items-center justify-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs py-2 rounded-lg transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download (.csv / .xlsx)</span>
            </button>
          </div>

          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <FileSpreadsheet className="w-4 h-4 text-blue-600" />
                <h4 className="font-bold text-xs text-slate-900">Embassy Interview Pending Report</h4>
              </div>
              <p className="text-[11px] text-slate-500">
                Full embassy list with SE Numbers, E Numbers, assigned foreign employers, and application dates.
              </p>
            </div>
            <button
              onClick={() => handleExportCSV('EMBASSY_PENDING')}
              className="w-full flex items-center justify-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs py-2 rounded-lg transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download (.csv / .xlsx)</span>
            </button>
          </div>

          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <FileSpreadsheet className="w-4 h-4 text-amber-600" />
                <h4 className="font-bold text-xs text-slate-900">Departure Pending Candidates</h4>
              </div>
              <p className="text-[11px] text-slate-500">
                Departure pending manifest with Visa Start Date, Visa End Date, Sub-Company, and Passport details.
              </p>
            </div>
            <button
              onClick={() => handleExportCSV('DEPARTURE_PENDING')}
              className="w-full flex items-center justify-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs py-2 rounded-lg transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download (.csv / .xlsx)</span>
            </button>
          </div>

          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <FileSpreadsheet className="w-4 h-4 text-cyan-600" />
                <h4 className="font-bold text-xs text-slate-900">Tickets & Flight Departure Manifest</h4>
              </div>
              <p className="text-[11px] text-slate-500">
                Flight numbers, departure dates, departure times, ticket reference numbers, and transit remarks.
              </p>
            </div>
            <button
              onClick={() => handleExportCSV('TICKETS')}
              className="w-full flex items-center justify-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs py-2 rounded-lg transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download (.csv / .xlsx)</span>
            </button>
          </div>

          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <FileSpreadsheet className="w-4 h-4 text-indigo-600" />
                <h4 className="font-bold text-xs text-slate-900">Detailed Male Candidate Records</h4>
              </div>
              <p className="text-[11px] text-slate-500">
                Job category breakdown with employer company, police clearance status, and registration years.
              </p>
            </div>
            <button
              onClick={() => handleExportCSV('DETAILED_MALE')}
              className="w-full flex items-center justify-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs py-2 rounded-lg transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download (.csv / .xlsx)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
