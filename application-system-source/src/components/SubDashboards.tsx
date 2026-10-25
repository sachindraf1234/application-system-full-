import React, { useState } from 'react';
import {
  ApplicantOverview,
  DashboardStats,
  SystemSettings,
  Staff
} from '../types';
import {
  AlertCircle,
  Calendar,
  CheckSquare,
  Plane,
  BookOpen,
  Settings,
  PhoneCall,
  Clock,
  Printer,
  FileSpreadsheet,
  Download,
  Users,
  Building,
  CheckCircle2,
  XCircle,
  ArrowRight,
  TrendingUp,
  ShieldCheck,
  ChevronRight,
  Sparkles,
  Search,
  Filter,
  ExternalLink
} from 'lucide-react';

interface DashboardProps {
  stats: DashboardStats;
  onNavigateTab: (tab: any) => void;
}

// ----------------------------------------------------------------------------------------
// EXECUTIVE COMMAND DASHBOARD VIEW
// ----------------------------------------------------------------------------------------
export const ExecutiveDashboardView: React.FC<DashboardProps> = ({ stats, onNavigateTab }) => {
  return (
    <div className="space-y-6">
      {/* Top Welcome & Summary Header */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white p-6 rounded-2xl border border-slate-800 shadow-md flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-400 bg-emerald-950/80 border border-emerald-800/80 px-2 py-0.5 rounded">
              Command Center
            </span>
            <span className="text-xs text-slate-400">SLBFE Registered Agency Operations</span>
          </div>
          <h2 className="text-xl font-bold tracking-tight text-white mt-1">
            Executive Recruitment Operations Dashboard
          </h2>
          <p className="text-xs text-slate-300 mt-1">
            Live pipeline tracking across registration, embassy biometrics, and Colombo flight departures.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onNavigateTab('registration')}
            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow transition cursor-pointer active:scale-98"
          >
            <span>+ Register Candidate</span>
          </button>
        </div>
      </div>

      {/* 4 Premium Stat Cards with High-Contrast Typography */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Total Registered */}
        <div
          onClick={() => onNavigateTab('applicants')}
          className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:border-slate-400/80 hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              Total Applicants
            </span>
            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600 group-hover:bg-slate-900 group-hover:text-white transition-colors">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-mono font-bold text-slate-900 mt-2 tabular-nums">
            {stats.total}
          </div>
          <div className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
            <span className="font-semibold text-slate-700">{stats.males}</span> Males
            <span className="text-slate-300">·</span>
            <span className="font-semibold text-slate-700">{stats.females}</span> Females
          </div>
        </div>

        {/* Follow-up Pending */}
        <div
          onClick={() => onNavigateTab('followups')}
          className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:border-blue-400/80 hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              Follow-ups Pipeline
            </span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
              <PhoneCall className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-mono font-bold text-blue-700 mt-2 tabular-nums">
            {stats.statuses.followUp}
          </div>
          <div className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
            <span>FU1: <strong>{stats.followups.fu1}</strong></span>
            <span className="text-slate-300">·</span>
            <span>FU2: <strong>{stats.followups.fu2}</strong></span>
            <span className="text-slate-300">·</span>
            <span>FU3: <strong className="text-rose-600">{stats.followups.fu3}</strong></span>
          </div>
        </div>

        {/* Embassy Interviews */}
        <div
          onClick={() => onNavigateTab('embassy')}
          className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:border-purple-400/80 hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              Embassy Applications
            </span>
            <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center text-purple-600 group-hover:bg-purple-600 group-hover:text-white transition-colors">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-mono font-bold text-purple-700 mt-2 tabular-nums">
            {stats.embassy.scheduled || stats.embassy.pending}
          </div>
          <div className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
            <span className="text-emerald-700 font-semibold">{stats.embassy.approved} Visa Stamped</span>
            <span className="text-slate-300">·</span>
            <span className="text-slate-500">{stats.embassy.pending} In Progress</span>
          </div>
        </div>

        {/* Departures */}
        <div
          onClick={() => onNavigateTab('departure')}
          className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:border-emerald-400/80 hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              Flight Departures
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
              <Plane className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-mono font-bold text-emerald-700 mt-2 tabular-nums">
            {stats.departure.pending}
          </div>
          <div className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
            <span>Issued Tickets: <strong className="text-emerald-700">{stats.departure.ticketsIssued}</strong></span>
          </div>
        </div>
      </div>

      {/* Recruitment Stage Pipeline Funnel */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex justify-between items-center pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Agency Recruitment Lifecycle Stages
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">Real-time candidate progression through the official 7-phase pipeline.</p>
          </div>
          <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg">
            Active Real-Time Pipeline
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          {stats.pipeline.map((step, idx) => (
            <div
              key={idx}
              className="bg-slate-50/80 hover:bg-emerald-50/40 p-3.5 rounded-xl border border-slate-200/60 hover:border-emerald-300 transition-all flex flex-col justify-between text-center group cursor-pointer"
              onClick={() => {
                if (idx === 0 || idx === 1) onNavigateTab('applicants');
                else if (idx === 2 || idx === 3) onNavigateTab('embassy');
                else onNavigateTab('departure');
              }}
            >
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Stage 0{idx + 1}
                </span>
                <span className="text-2xl font-mono font-bold text-slate-900 group-hover:text-emerald-800 transition-colors mt-1 block tabular-nums">
                  {step.count}
                </span>
              </div>
              <span className="text-[11px] font-bold text-slate-700 uppercase block mt-2 leading-tight">
                {step.name}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Grid: Job Categories & Recent Activity Log */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Trades Allocation */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col gap-4">
          <div className="flex justify-between items-center pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Job Categories & Trade Allocations
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">Registered candidates per trade quota</p>
            </div>
            <span className="text-xs font-mono font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg">
              {stats.jobCategories.length} Active Trades
            </span>
          </div>

          <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
            {stats.jobCategories.map((cat, idx) => (
              <div
                key={idx}
                className="flex justify-between items-center text-xs py-2 px-3 bg-slate-50/80 hover:bg-slate-100/80 rounded-xl transition-colors"
              >
                <span className="font-bold text-slate-800 uppercase">{cat.name}</span>
                <span className="font-mono font-semibold text-slate-700 bg-white border border-slate-200 px-2.5 py-0.5 rounded-lg shadow-2xs tabular-nums">
                  {cat.value} {cat.value === 1 ? 'Candidate' : 'Candidates'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Activity History Audit */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col gap-4">
          <div className="flex justify-between items-center pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Recent Activity Audit Timeline
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">Chronological system transaction records</p>
            </div>
            <span className="text-xs text-slate-400 font-mono">Real-time</span>
          </div>

          <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
            {stats.recentActivities && stats.recentActivities.length > 0 ? (
              stats.recentActivities.map((log, idx) => (
                <div key={idx} className="flex items-start gap-3 text-xs pb-3 border-b border-slate-100 last:border-0">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 mt-1.5 shrink-0"></div>
                  <div className="flex-1">
                    <p className="font-bold text-slate-900 leading-snug">{log.action}</p>
                    <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-1">
                      <span>Module: <strong className="text-slate-700">{log.module}</strong></span>
                      <span className="text-slate-300">·</span>
                      <span>By: <strong className="text-slate-700">{log.user}</strong></span>
                      <span className="text-slate-300">·</span>
                      <span className="font-mono text-slate-400 tabular-nums">
                        {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-400 text-center py-8">No activity history recorded yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ----------------------------------------------------------------------------------------
// EMBASSY WORKSPACE VIEW
// ----------------------------------------------------------------------------------------
export const EmbassyWorkspaceView: React.FC<{
  applicants: ApplicantOverview[];
  onViewApplicant: (id: string) => void;
}> = ({ applicants, onViewApplicant }) => {
  const [filter, setFilter] = useState<'ALL' | 'OK' | 'PENDING' | 'REJECTED'>('ALL');
  const [search, setSearch] = useState('');

  const filtered = applicants.filter((app) => {
    const matchesFilter =
      filter === 'ALL' ||
      (filter === 'OK' && app.visa_status === 'OK') ||
      (filter === 'PENDING' && (app.visa_status === 'Pending' || !app.visa_status)) ||
      (filter === 'REJECTED' && app.visa_status === 'Rejected');

    const matchesSearch =
      !search ||
      app.full_name.toLowerCase().includes(search.toLowerCase()) ||
      app.passport_number.toLowerCase().includes(search.toLowerCase()) ||
      app.se_number.toLowerCase().includes(search.toLowerCase()) ||
      app.e_number.toLowerCase().includes(search.toLowerCase()) ||
      app.company_name.toLowerCase().includes(search.toLowerCase());

    return matchesFilter && matchesSearch;
  });

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-4 border-b border-slate-100">
        <div>
          <h3 className="font-bold text-base text-slate-900 leading-tight">Embassy Submission & SE/E Number Tracking</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time monitoring of visa quotas, biometric appointments, and embassy submission dates.
          </p>
        </div>

        {/* Filter segment */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl">
          <button
            onClick={() => setFilter('ALL')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
              filter === 'ALL' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All ({applicants.length})
          </button>
          <button
            onClick={() => setFilter('OK')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
              filter === 'OK' ? 'bg-white text-emerald-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Visa OK ({applicants.filter((a) => a.visa_status === 'OK').length})
          </button>
          <button
            onClick={() => setFilter('PENDING')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
              filter === 'PENDING' ? 'bg-white text-amber-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Pending ({applicants.filter((a) => a.visa_status === 'Pending' || !a.visa_status).length})
          </button>
        </div>
      </div>

      {/* Search Filter */}
      <div className="relative max-w-sm">
        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          placeholder="Filter candidate, passport, SE/E number..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-slate-50 border border-slate-200 pl-8 pr-3 py-1.5 text-xs rounded-xl focus:outline-none focus:border-emerald-500"
        />
      </div>

      <div className="overflow-x-auto border border-slate-200/80 rounded-xl">
        <table className="w-full text-xs text-left border-collapse">
          <thead className="bg-slate-50/80 font-bold uppercase tracking-wider text-[10px] text-slate-500 border-b border-slate-200">
            <tr>
              <th className="p-3.5 pl-4">Candidate Particulars</th>
              <th className="p-3.5">Passport No</th>
              <th className="p-3.5">Assigned Employer</th>
              <th className="p-3.5">SE Number</th>
              <th className="p-3.5">E Number</th>
              <th className="p-3.5">Visa Status</th>
              <th className="p-3.5 pr-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((app) => (
              <tr key={app.applicant_id} className="hover:bg-slate-50/70 transition-colors">
                <td className="p-3.5 pl-4">
                  <span className="font-bold text-slate-900 block">{app.full_name}</span>
                  <span className="text-[10px] text-slate-400 font-mono">ID: {app.applicant_id}</span>
                </td>
                <td className="p-3.5 font-mono font-semibold text-slate-800">{app.passport_number}</td>
                <td className="p-3.5 font-bold uppercase text-slate-800">{app.company_name}</td>
                <td className="p-3.5 font-mono font-bold text-slate-900">
                  {app.se_number ? (
                    app.se_number
                  ) : (
                    <span className="text-slate-400 font-normal italic">Not Assigned</span>
                  )}
                </td>
                <td className="p-3.5 font-mono font-bold text-slate-900">
                  {app.e_number ? (
                    app.e_number
                  ) : (
                    <span className="text-slate-400 font-normal italic">Not Assigned</span>
                  )}
                </td>
                <td className="p-3.5 whitespace-nowrap">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 ${
                        app.visa_status === 'OK'
                          ? 'bg-emerald-500'
                          : app.visa_status === 'Rejected'
                          ? 'bg-rose-500'
                          : 'bg-amber-500'
                      }`}
                    ></span>
                    <span className="font-semibold text-slate-800">
                      {app.visa_status === 'OK' ? 'Visa Stamped (OK)' : app.visa_status || 'Pending'}
                    </span>
                  </div>
                </td>
                <td className="p-3.5 pr-4 text-right">
                  <button
                    onClick={() => onViewApplicant(app.applicant_id)}
                    className="p-1.5 px-3 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold transition-all shadow-xs cursor-pointer active:scale-98"
                  >
                    View Profile
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ----------------------------------------------------------------------------------------
// 10-POINT CHECKLIST WORKSPACE VIEW
// ----------------------------------------------------------------------------------------
export const ChecklistWorkspaceView: React.FC<{
  applicants: ApplicantOverview[];
  onViewApplicant: (id: string) => void;
}> = ({ applicants, onViewApplicant }) => {
  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-4 border-b border-slate-100">
        <div>
          <h3 className="font-bold text-base text-slate-900">10-Point Statutory Verification Matrix</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            1. Original Passport · 2. Copies · 3. Police HQ · 4. MoFA · 5. GAMCA Fit · 6. SLBFE Contract · 7. Guarantee · 8. Entry Visa D · 9. Insurance · 10. USD SLBFE Fee
          </p>
        </div>
      </div>

      <div className="overflow-x-auto border border-slate-200/80 rounded-xl">
        <table className="w-full text-xs text-left border-collapse">
          <thead className="bg-slate-50/80 font-bold uppercase tracking-wider text-[10px] text-slate-500 border-b border-slate-200">
            <tr>
              <th className="p-3.5 pl-4">Candidate Particulars</th>
              <th className="p-3 text-center" title="1. Original Passport Held">1. Passport</th>
              <th className="p-3 text-center" title="2. Passport Copies (4x)">2. Copies</th>
              <th className="p-3 text-center" title="3. Police Clearance Certificate (CID HQ)">3. Police HQ</th>
              <th className="p-3 text-center" title="4. Ministry of Foreign Affairs Attestation">4. MoFA</th>
              <th className="p-3 text-center" title="5. GAMCA Medical Fitness Test">5. GAMCA</th>
              <th className="p-3 text-center" title="6. Signed SLBFE Standard Agreement">6. Agreement</th>
              <th className="p-3 text-center" title="7. Parent/Spouse Guarantee Bond">7. Guarantee</th>
              <th className="p-3 text-center" title="8. Entry Visa D / Work Permit">8. Visa D</th>
              <th className="p-3 text-center" title="9. Foreign Employment Insurance Policy">9. Insurance</th>
              <th className="p-3 text-center" title="10. SLBFE Registration & USD Processing Fee">10. USD Fee</th>
              <th className="p-3 text-center">Score</th>
              <th className="p-3.5 pr-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {applicants.map((app) => {
              const cl = app.checklist;
              const items = [
                cl?.passport_ready ?? (app.passport_number && app.passport_number !== 'PENDING'),
                cl?.passport_copy_ready ?? true,
                cl?.police_report_ready ?? false,
                cl?.police_certified_ready ?? false,
                cl ? (cl as any).medical_fit_ready ?? true : true,
                cl?.agreement_ready ?? false,
                cl?.guarantee_letter_ready ?? false,
                cl?.visa_d_ready ?? (app.visa_status === 'OK'),
                cl?.insurance_ready ?? false,
                cl?.usd_ready ?? false
              ];
              const score = items.filter(Boolean).length;

              return (
                <tr key={app.applicant_id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="p-3.5 pl-4 whitespace-nowrap">
                    <span className="font-bold text-slate-900 block">{app.full_name}</span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {app.applicant_id} · {app.preferred_job_category}
                    </span>
                  </td>

                  {items.map((isReady, idx) => (
                    <td key={idx} className="p-3 text-center">
                      {isReady ? (
                        <span className="text-emerald-700 font-bold bg-emerald-50 w-6 h-6 inline-flex items-center justify-center rounded-md text-xs">
                          ✓
                        </span>
                      ) : (
                        <span className="text-slate-400 font-mono bg-slate-100 w-6 h-6 inline-flex items-center justify-center rounded-md text-[11px]">
                          —
                        </span>
                      )}
                    </td>
                  ))}

                  <td className="p-3 text-center whitespace-nowrap">
                    <span
                      className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded-md tabular-nums ${
                        score === 10
                          ? 'bg-emerald-100 text-emerald-800'
                          : score >= 6
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {score}/10
                    </span>
                  </td>

                  <td className="p-3.5 pr-4 text-right whitespace-nowrap">
                    <button
                      onClick={() => onViewApplicant(app.applicant_id)}
                      className="p-1.5 px-3 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold transition-all shadow-xs cursor-pointer active:scale-98"
                    >
                      Verify
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ----------------------------------------------------------------------------------------
// DEPARTURES WORKSPACE VIEW
// ----------------------------------------------------------------------------------------
export const DepartureWorkspaceView: React.FC<{
  applicants: ApplicantOverview[];
  onViewApplicant: (id: string) => void;
}> = ({ applicants, onViewApplicant }) => {
  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-4 border-b border-slate-100">
        <div>
          <h3 className="font-bold text-base text-slate-900">Flight Departures & Ticketing Master Schedule</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Colombo Bandaranaike (CMB) confirmed flight departure schedules, PNRs, and visa validity dates.
          </p>
        </div>
        <a
          href="/api/export/TICKETS"
          className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-3.5 py-2 rounded-xl shadow transition active:scale-98 cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export Tickets Schedule</span>
        </a>
      </div>

      <div className="overflow-x-auto border border-slate-200/80 rounded-xl">
        <table className="w-full text-xs text-left border-collapse">
          <thead className="bg-slate-50/80 font-bold uppercase tracking-wider text-[10px] text-slate-500 border-b border-slate-200">
            <tr>
              <th className="p-3.5 pl-4">Candidate</th>
              <th className="p-3.5">Passport No</th>
              <th className="p-3.5">Flight Number</th>
              <th className="p-3.5">Departure Date</th>
              <th className="p-3.5">Departure Time</th>
              <th className="p-3.5">Origin Airport</th>
              <th className="p-3.5">Booking Status</th>
              <th className="p-3.5 pr-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {applicants.map((app) => (
              <tr key={app.applicant_id} className="hover:bg-slate-50/70 transition-colors">
                <td className="p-3.5 pl-4 font-bold text-slate-900">{app.full_name}</td>
                <td className="p-3.5 font-mono text-slate-800">{app.passport_number}</td>
                <td className="p-3.5 font-mono font-bold text-slate-900">
                  {app.ticket?.flight_number || 'UL 281'}
                </td>
                <td className="p-3.5 font-bold text-emerald-800 font-mono tabular-nums">
                  {app.departure_date || app.ticket?.departure_date || '2026-04-18'}
                </td>
                <td className="p-3.5 font-mono text-slate-600">
                  {app.ticket?.departure_time || '21:30'}
                </td>
                <td className="p-3.5 text-slate-600">Colombo (CMB)</td>
                <td className="p-3.5 whitespace-nowrap">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    <span className="font-semibold text-emerald-800">
                      {app.ticket?.booking_status || 'Confirmed'}
                    </span>
                  </div>
                </td>
                <td className="p-3.5 pr-4 text-right">
                  <button
                    onClick={() => onViewApplicant(app.applicant_id)}
                    className="p-1.5 px-3 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold transition-all shadow-xs cursor-pointer active:scale-98"
                  >
                    Ticket Details
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ----------------------------------------------------------------------------------------
// ENGLISH TESTING WORKSPACE VIEW
// ----------------------------------------------------------------------------------------
export const EnglishWorkspaceView: React.FC<{
  applicants: ApplicantOverview[];
  onViewApplicant: (id: string) => void;
}> = ({ applicants, onViewApplicant }) => {
  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-4 border-b border-slate-100">
        <div>
          <h3 className="font-bold text-base text-slate-900">English Assessment & Trade Skills Center</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Oral interview grades, reading & comprehension scores, and Arabic language proficiency.
          </p>
        </div>
      </div>

      <div className="overflow-x-auto border border-slate-200/80 rounded-xl">
        <table className="w-full text-xs text-left border-collapse">
          <thead className="bg-slate-50/80 font-bold uppercase tracking-wider text-[10px] text-slate-500 border-b border-slate-200">
            <tr>
              <th className="p-3.5 pl-4">Candidate</th>
              <th className="p-3.5">Target Trade</th>
              <th className="p-3.5">English Rating</th>
              <th className="p-3.5">Arabic Spoken</th>
              <th className="p-3.5">Evaluation Status</th>
              <th className="p-3.5 pr-4 text-right">Grade Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {applicants.map((app) => (
              <tr key={app.applicant_id} className="hover:bg-slate-50/70 transition-colors">
                <td className="p-3.5 pl-4 font-bold text-slate-900">{app.full_name}</td>
                <td className="p-3.5 uppercase font-medium text-slate-800">{app.preferred_job_category}</td>
                <td className="p-3.5 font-bold text-slate-900">
                  <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                    app.english_status === 'Excellent' ? 'bg-emerald-100 text-emerald-800' :
                    app.english_status === 'Good' ? 'bg-blue-100 text-blue-800' :
                    app.english_status === 'Average' ? 'bg-amber-100 text-amber-800' :
                    'bg-slate-100 text-slate-700'
                  }`}>
                    {app.english_status || 'Not Checked'}
                  </span>
                </td>
                <td className="p-3.5 text-slate-600 font-medium">Working / Basic</td>
                <td className="p-3.5">
                  <span className="text-xs font-semibold text-emerald-800 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    <span>Desk Verified</span>
                  </span>
                </td>
                <td className="p-3.5 pr-4 text-right">
                  <button
                    onClick={() => onViewApplicant(app.applicant_id)}
                    className="p-1.5 px-3 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold transition-all shadow-xs cursor-pointer active:scale-98"
                  >
                    Grade Skills
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ----------------------------------------------------------------------------------------
// SETTINGS WORKSPACE VIEW
// ----------------------------------------------------------------------------------------
export const SettingsWorkspaceView: React.FC<{
  settings: SystemSettings | null;
  onSave: (settings: SystemSettings) => void;
}> = ({ settings, onSave }) => {
  const [form, setForm] = React.useState<SystemSettings>(
    settings || {
      google_sheet_url: '',
      google_apps_script_endpoint: 'https://script.google.com/macros/s/AKfycby9YMtFFzPVdcUGvbA66VCVZyUIK-4MYkRTt9tLsNRjmTY1mFrwSfyIC9yz1I1GYMGmVQ/exec',
      agency_name: 'TRANS ARABIAN FOREIGN EMPLOYMENT AGENCY',
      agency_email: 'transarabianexcel@gmail.com',
      agency_phone: '+94 11 257 8899',
      agency_address: '120, Galle Road, Colombo 03, Sri Lanka',
      companies: ['AL-MARAI GROUP', 'GULF CATERING CO', 'BIN LADIN GROUP', 'ARABIAN BEVERAGES'],
      sub_companies: ['Airport Logistics', 'Central Kitchen', 'Facilities Branch', 'Plant Operations Riyadh'],
      job_categories: ['Kitchen Helper', 'Cook / Chef', 'Housekeeping', 'Mason', 'Welder', 'Driver']
    }
  );

  return (
    <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200/80 shadow-xs space-y-6">
      <div className="pb-4 border-b border-slate-100">
        <h3 className="font-bold text-base text-slate-900">System Configuration & Data Sync API</h3>
        <p className="text-xs text-slate-500 mt-0.5">
          Manage live Google Apps Script synchronization endpoints, agency identity, and employer lists.
        </p>
      </div>

      <div className="space-y-4 text-xs">
        <div>
          <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1.5">
            Google Apps Script Live Sync JSON Endpoint
          </label>
          <input
            type="url"
            value={form.google_apps_script_endpoint}
            onChange={(e) => setForm({ ...form, google_apps_script_endpoint: e.target.value })}
            className="w-full bg-slate-50 hover:bg-white focus:bg-white border border-slate-200/80 focus:border-emerald-500 rounded-xl px-3.5 py-2.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all shadow-xs"
          />
          <p className="text-[11px] text-slate-400 mt-1">
            Whenever the system loads or refreshes, it fetches the latest live data from this JSON endpoint.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1.5">Agency Name</label>
            <input
              type="text"
              value={form.agency_name}
              onChange={(e) => setForm({ ...form, agency_name: e.target.value })}
              className="w-full bg-slate-50 hover:bg-white focus:bg-white border border-slate-200/80 focus:border-emerald-500 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all shadow-xs"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1.5">Agency Official Email</label>
            <input
              type="email"
              value={form.agency_email}
              onChange={(e) => setForm({ ...form, agency_email: e.target.value })}
              className="w-full bg-slate-50 hover:bg-white focus:bg-white border border-slate-200/80 focus:border-emerald-500 rounded-xl px-3.5 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all shadow-xs"
            />
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-bold uppercase text-slate-500 mb-2">Active Employer Companies</label>
          <div className="flex flex-wrap gap-2">
            {form.companies.map((c, i) => (
              <span key={i} className="bg-slate-100 text-slate-800 font-bold px-3 py-1.5 rounded-xl text-xs border border-slate-200/60">
                {c}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="flex justify-end pt-4 border-t border-slate-100">
        <button
          onClick={() => onSave(form)}
          className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-6 py-2.5 rounded-xl shadow transition active:scale-98 cursor-pointer"
        >
          Save System Configuration
        </button>
      </div>
    </div>
  );
};
