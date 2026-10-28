import React, { useState } from 'react';
import { ApplicantOverview } from '../types';
import {
  Search,
  Printer,
  PhoneCall,
  Trash2,
  Eye,
  ChevronLeft,
  ChevronRight,
  Filter,
  X,
  FileSpreadsheet,
  Download,
  Building,
  User,
  MapPin,
  Calendar
} from 'lucide-react';

interface Props {
  applicants: ApplicantOverview[];
  searchTerm: string;
  onSearchChange: (val: string) => void;
  genderFilter: string;
  onGenderFilterChange: (val: string) => void;
  statusFilter: string;
  onStatusFilterChange: (val: string) => void;
  categoryFilter: string;
  onCategoryFilterChange: (val: string) => void;
  onViewProfile: (id: string) => void;
  onPrintApplicant: (id: string) => void;
  onFollowupApplicant: (app: ApplicantOverview) => void;
  onDeleteApplicant: (id: string, name: string) => void;
}

export const DataTables: React.FC<Props> = ({
  applicants,
  searchTerm,
  onSearchChange,
  genderFilter,
  onGenderFilterChange,
  statusFilter,
  onStatusFilterChange,
  categoryFilter,
  onCategoryFilterChange,
  onViewProfile,
  onPrintApplicant,
  onFollowupApplicant,
  onDeleteApplicant
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 12;

  // Extract unique categories for filter
  const categories = Array.from(new Set(applicants.map((a) => a.preferred_job_category).filter(Boolean)));

  // Filtered applicants
  const filtered = applicants.filter((app) => {
    const q = searchTerm.toLowerCase();
    const matchesSearch =
      !searchTerm ||
      app.full_name.toLowerCase().includes(q) ||
      app.applicant_id.toLowerCase().includes(q) ||
      app.passport_number.toLowerCase().includes(q) ||
      app.registration_number.toLowerCase().includes(q) ||
      app.mobile_number.toLowerCase().includes(q) ||
      app.preferred_job_category.toLowerCase().includes(q) ||
      app.company_name.toLowerCase().includes(q);

    const matchesGender = !genderFilter || app.gender === genderFilter;
    const matchesStatus = !statusFilter || app.current_status === statusFilter;
    const matchesCategory = !categoryFilter || app.preferred_job_category === categoryFilter;

    return matchesSearch && matchesGender && matchesStatus && matchesCategory;
  });

  const totalPages = Math.ceil(filtered.length / pageSize) || 1;
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const clearFilters = () => {
    onSearchChange('');
    onGenderFilterChange('');
    onStatusFilterChange('');
    onCategoryFilterChange('');
    setCurrentPage(1);
  };

  const hasActiveFilters = Boolean(searchTerm || genderFilter || statusFilter || categoryFilter);

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden flex flex-col gap-4 p-5 sm:p-6">
      {/* Table Header & Title */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-slate-100">
        <div>
          <h3 className="font-bold text-base text-slate-900 leading-tight">Master Applicant Registry</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Full lifecycle database across intake, embassy submissions, and flight departures.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono font-bold text-slate-700 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200/60">
            {filtered.length} {filtered.length === 1 ? 'Record' : 'Records'} Found
          </span>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 text-xs font-semibold text-rose-700 hover:text-rose-800 bg-rose-50 hover:bg-rose-100/80 px-2.5 py-1.5 rounded-xl transition cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              <span>Clear Filters</span>
            </button>
          )}
        </div>
      </div>

      {/* Modern Filter Controls Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Search */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search candidate, passport, mobile..."
            value={searchTerm}
            onChange={(e) => {
              onSearchChange(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full bg-slate-50 hover:bg-white focus:bg-white border border-slate-200/80 focus:border-emerald-500 rounded-xl pl-10 pr-4 py-2 text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all shadow-xs"
          />
        </div>

        {/* Gender Filter */}
        <div>
          <select
            value={genderFilter}
            onChange={(e) => {
              onGenderFilterChange(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full bg-slate-50 hover:bg-white focus:bg-white border border-slate-200/80 focus:border-emerald-500 rounded-xl px-3 py-2 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all shadow-xs cursor-pointer"
          >
            <option value="">All Genders</option>
            <option value="Male">Male Candidates</option>
            <option value="Female">Female Candidates</option>
          </select>
        </div>

        {/* Status Filter */}
        <div>
          <select
            value={statusFilter}
            onChange={(e) => {
              onStatusFilterChange(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full bg-slate-50 hover:bg-white focus:bg-white border border-slate-200/80 focus:border-emerald-500 rounded-xl px-3 py-2 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all shadow-xs cursor-pointer"
          >
            <option value="">All Recruitment Statuses</option>
            <option value="GREEN_REGISTERED">Green Registered</option>
            <option value="FOLLOW_UP">Follow-up Stage</option>
            <option value="ACTIVE_PIPELINE">Active Pipeline (Embassy/Visa)</option>
            <option value="RED_CLOSED">Red Closed</option>
          </select>
        </div>

        {/* Category Filter */}
        <div>
          <select
            value={categoryFilter}
            onChange={(e) => {
              onCategoryFilterChange(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full bg-slate-50 hover:bg-white focus:bg-white border border-slate-200/80 focus:border-emerald-500 rounded-xl px-3 py-2 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all shadow-xs cursor-pointer"
          >
            <option value="">All Job Categories</option>
            {categories.map((c, i) => (
              <option key={i} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Modern Data Table */}
      <div className="overflow-x-auto border border-slate-200/80 rounded-xl">
        <table className="w-full text-xs text-left border-collapse">
          <thead className="bg-slate-50/80 font-bold uppercase tracking-wider text-[10px] text-slate-500 border-b border-slate-200/80">
            <tr>
              <th className="p-3.5 pl-4">Master ID / Ref</th>
              <th className="p-3.5">Candidate Particulars</th>
              <th className="p-3.5">Passport Particulars</th>
              <th className="p-3.5">Job Trade & Company</th>
              <th className="p-3.5">English Rating</th>
              <th className="p-3.5">Current Stage</th>
              <th className="p-3.5 pr-4 text-right">Quick Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {paginated.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-12 text-center text-slate-400">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <User className="w-8 h-8 text-slate-300 stroke-1" />
                    <p className="font-semibold text-slate-700">No applicants found</p>
                    <p className="text-[11px] text-slate-400">Try adjusting your search criteria or clear active filters.</p>
                  </div>
                </td>
              </tr>
            ) : (
              paginated.map((app) => (
                <tr key={app.applicant_id} className="hover:bg-slate-50/70 transition-colors group">
                  {/* ID / Ref Column */}
                  <td className="p-3.5 pl-4 whitespace-nowrap">
                    <span className="font-mono font-bold text-slate-900 block group-hover:text-emerald-700 transition-colors">
                      {app.applicant_id}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      Ref: {app.registration_number}
                    </span>
                  </td>

                  {/* Candidate Name & Contact */}
                  <td className="p-3.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200/60 flex items-center justify-center font-bold text-slate-600 text-xs shrink-0">
                        {app.full_name.charAt(0)}
                      </div>
                      <div>
                        <div className="font-bold text-slate-900 group-hover:text-emerald-900 transition-colors">
                          {app.full_name}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1.5">
                          <span>{app.gender}</span>
                          <span className="text-slate-300">·</span>
                          <span>{app.living_place || 'Sri Lanka'}</span>
                          <span className="text-slate-300">·</span>
                          <span className="font-medium text-slate-700">{app.mobile_number || 'No phone'}</span>
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Passport Details */}
                  <td className="p-3.5 font-mono whitespace-nowrap">
                    <span className="font-bold text-slate-800 block">{app.passport_number}</span>
                    <span className="text-[10px] text-slate-400 font-sans block mt-0.5">
                      Exp: {app.passport_expiry || '—'}
                    </span>
                  </td>

                  {/* Job Trade & Employer */}
                  <td className="p-3.5">
                    <span className="font-bold text-slate-800 uppercase block">{app.preferred_job_category}</span>
                    <span className="text-[11px] text-slate-500 block truncate max-w-[180px] mt-0.5">
                      {app.company_name || 'AL-MARAI / Unallocated'}
                    </span>
                  </td>

                  {/* English Rating */}
                  <td className="p-3.5 whitespace-nowrap">
                    <span className="text-[11px] font-semibold text-slate-700">
                      {app.english_status || 'Not Checked'}
                    </span>
                  </td>

                  {/* Status Indicator (Clean dot design) */}
                  <td className="p-3.5 whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`w-2 h-2 rounded-full shrink-0 ${
                          app.current_status === 'GREEN_REGISTERED'
                            ? 'bg-emerald-500'
                            : app.current_status === 'FOLLOW_UP'
                            ? 'bg-blue-500'
                            : app.current_status === 'RED_CLOSED'
                            ? 'bg-rose-500'
                            : 'bg-purple-500'
                        }`}
                      ></span>
                      <span
                        className={`text-xs font-semibold ${
                          app.current_status === 'GREEN_REGISTERED'
                            ? 'text-emerald-800'
                            : app.current_status === 'FOLLOW_UP'
                            ? 'text-blue-800'
                            : app.current_status === 'RED_CLOSED'
                            ? 'text-rose-800'
                            : 'text-purple-800'
                        }`}
                      >
                        {app.current_status.replace('_', ' ')}
                      </span>
                    </div>
                  </td>

                  {/* Quick Action Buttons */}
                  <td className="p-3.5 pr-4 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => onPrintApplicant(app.applicant_id)}
                        title="Print Official Bio-Data Form"
                        className="p-1.5 px-2.5 bg-slate-50 hover:bg-emerald-50 text-slate-600 hover:text-emerald-700 border border-slate-200/80 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer active:scale-98"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>Print</span>
                      </button>

                      <button
                        onClick={() => onFollowupApplicant(app)}
                        title="Log Follow-up Call"
                        className="p-1.5 px-2.5 bg-slate-50 hover:bg-blue-50 text-slate-600 hover:text-blue-700 border border-slate-200/80 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer active:scale-98"
                      >
                        <PhoneCall className="w-3.5 h-3.5" />
                        <span>Call</span>
                      </button>

                      <button
                        onClick={() => onViewProfile(app.applicant_id)}
                        title="View Full Candidate Profile"
                        className="p-1.5 px-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold transition-all shadow-xs cursor-pointer active:scale-98"
                      >
                        Profile
                      </button>

                      <button
                        onClick={() => onDeleteApplicant(app.applicant_id, app.full_name)}
                        title="Delete record"
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 pt-2 border-t border-slate-100">
        <span>
          Showing {Math.min((currentPage - 1) * pageSize + 1, filtered.length)} to{' '}
          {Math.min(currentPage * pageSize, filtered.length)} of {filtered.length} applicants
        </span>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="flex items-center gap-1 px-3 py-1.5 border border-slate-200 rounded-lg font-medium hover:bg-slate-50 disabled:opacity-40 transition-colors cursor-pointer"
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
            className="flex items-center gap-1 px-3 py-1.5 border border-slate-200 rounded-lg font-medium hover:bg-slate-50 disabled:opacity-40 transition-colors cursor-pointer"
          >
            <span>Next</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
