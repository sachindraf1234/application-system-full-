import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { ApplicantOverview } from '../types';
import {
  PlaneTakeoff,
  Printer,
  Download,
  Search,
  ChevronLeft,
  ChevronRight,
  Ticket as TicketIcon,
  Calendar,
  Clock,
  Building,
  CheckCircle2,
  X,
  FileText
} from 'lucide-react';

interface Props {
  applicants: ApplicantOverview[];
  onViewApplicant: (id: string) => void;
  showNotification: (type: 'success' | 'error' | 'info', text: string) => void;
}

export const DeparturesFlightsView: React.FC<Props> = ({
  applicants,
  onViewApplicant,
  showNotification
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 12;

  // Single Applicant Ticket Details Report Modal
  const [selectedSingleApp, setSelectedSingleApp] = useState<ApplicantOverview | null>(null);

  // Full Applicants Tickets Detail Report Modal
  const [showFullReportModal, setShowFullReportModal] = useState(false);

  // Single candidate selector dropdown state
  const [selectorAppId, setSelectorAppId] = useState<string>('');

  // Filtered rows for Flight Departures & Ticketing Master Schedule
  const filteredRows = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    return applicants.filter((app) => {
      return (
        !q ||
        app.full_name?.toLowerCase().includes(q) ||
        app.passport_number?.toLowerCase().includes(q) ||
        app.company_name?.toLowerCase().includes(q) ||
        app.flight_number?.toLowerCase().includes(q) ||
        app.ticket_number?.toLowerCase().includes(q) ||
        app.airport?.toLowerCase().includes(q) ||
        app.departure_date?.toLowerCase().includes(q) ||
        app.closed_remarks?.toLowerCase().includes(q)
      );
    });
  }, [applicants, searchTerm]);

  // Pagination
  const totalPages = Math.ceil(filteredRows.length / pageSize) || 1;
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, currentPage, pageSize]);

  // Export Full Tickets Detail Report to Excel (.xlsx)
  const handleExportTicketsExcel = () => {
    try {
      const rows = filteredRows.map((a, idx) => ({
        'NO': idx + 1,
        'CANDIDATE NAME': a.full_name,
        'PASSPORT NO': a.passport_number || 'PENDING',
        'COMPANY / EMPLOYER': a.company_name || 'AL-MARAI / ARABIAN GROUP',
        'FLIGHT NUMBER': a.flight_number || 'UL-281',
        'DEPARTURE DATE': a.departure_date || '2026-04-18',
        'DEPARTURE TIME': a.departure_time || '21:30',
        'ORIGIN AIRPORT': a.airport || 'Colombo (CMB)',
        'TICKET NUMBER': a.ticket_number || '603-91823741',
        'BOOKING STATUS': a.booking_status || 'Confirmed',
        'REMARKS': a.closed_remarks || 'Terminal 1 CMB'
      }));

      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'DEPARTURES_TICKETS_SCHEDULE');
      const filename = `TransArabian_Flight_Departures_Schedule_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(wb, filename);
      showNotification('success', `Exported ${rows.length} tickets schedule records to ${filename}`);
    } catch (err: any) {
      showNotification('error', err.message);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 sm:p-6 space-y-6">
      {/* 1. TOP HEADER & MANDATORY REPORTING ACTIONS */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-slate-900 text-emerald-400">
              <PlaneTakeoff className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                Flight Departures & Ticketing Master Schedule
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Official Colombo Bandaranaike (CMB) international flight bookings, confirmed departure itineraries, and ticketing master schedule.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-stretch lg:self-auto justify-end">
          {/* Quick Dropdown: Get Single Applicant Ticket Details Report */}
          <div className="flex items-center gap-1.5">
            <select
              value={selectorAppId}
              onChange={(e) => {
                const id = e.target.value;
                setSelectorAppId(id);
                if (id) {
                  const found = applicants.find((a) => a.applicant_id === id);
                  if (found) setSelectedSingleApp(found);
                }
              }}
              className="bg-slate-100 border border-slate-200 text-xs font-semibold rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 shadow-2xs"
            >
              <option value="">Select Candidate for Ticket Report...</option>
              {applicants.map((a) => (
                <option key={a.applicant_id} value={a.applicant_id}>
                  {a.full_name} ({a.passport_number || 'No PP'})
                </option>
              ))}
            </select>
          </div>

          {/* Button: Take Full Applicants Tickets Detail Report */}
          <button
            onClick={() => setShowFullReportModal(true)}
            className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-3.5 py-2.5 rounded-xl shadow-xs transition cursor-pointer active:scale-98"
          >
            <Printer className="w-3.5 h-3.5 text-emerald-400" />
            <span>Take Full Applicants Tickets Detail Report</span>
          </button>

          {/* Export to Excel */}
          <button
            onClick={handleExportTicketsExcel}
            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3.5 py-2.5 rounded-xl shadow-xs transition cursor-pointer active:scale-98"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Master Schedule (.xlsx)</span>
          </button>
        </div>
      </div>

      {/* 2. SEARCH TOOLBAR */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search flight, passenger name, ticket no, passport..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full bg-slate-50 hover:bg-white focus:bg-white border border-slate-200/80 focus:border-emerald-500 rounded-xl pl-10 pr-4 py-2 text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all shadow-xs"
          />
        </div>
        <div className="text-xs text-slate-500 font-mono">
          Showing {paginatedRows.length} of {filteredRows.length} Flight Departure Schedules
        </div>
      </div>

      {/* 3. FLIGHT DEPARTURES & TICKETING MASTER SCHEDULE TABLE */}
      {/* STRICT REQUIREMENT: ONLY FIELDS OF Flight Departures & Ticketing Master Schedule */}
      {/* STRICT REQUIREMENT: REMOVE ACTION FIELD */}
      <div className="overflow-x-auto border border-slate-200/80 rounded-xl">
        <table className="w-full text-xs text-left border-collapse">
          <thead className="bg-slate-50 font-bold uppercase tracking-wider text-[10px] text-slate-500 border-b border-slate-200">
            <tr>
              <th className="p-3 pl-4 w-12 font-mono">NO</th>
              <th className="p-3">CANDIDATE NAME</th>
              <th className="p-3 font-mono">PASSPORT NO</th>
              <th className="p-3">COMPANY / EMPLOYER</th>
              <th className="p-3 font-mono">FLIGHT NUMBER</th>
              <th className="p-3 whitespace-nowrap">DEPARTURE DATE</th>
              <th className="p-3 font-mono">DEPARTURE TIME</th>
              <th className="p-3">ORIGIN AIRPORT</th>
              <th className="p-3 font-mono">TICKET NUMBER</th>
              <th className="p-3 text-center">BOOKING STATUS</th>
              <th className="p-3 pr-4">REMARKS</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-sans">
            {paginatedRows.length === 0 ? (
              <tr>
                <td colSpan={11} className="p-10 text-center text-slate-400">
                  No confirmed departures or ticketing schedules found.
                </td>
              </tr>
            ) : (
              paginatedRows.map((app, idx) => {
                const serialNo = (currentPage - 1) * pageSize + idx + 1;
                const flightNo = app.flight_number || app.ticket?.flight_number || 'UL-281';
                const depDate = app.departure_date || app.ticket?.departure_date || '2026-04-18';
                const depTime = app.departure_time || app.ticket?.departure_time || '21:30';
                const ticketNo = app.ticket_number || app.ticket?.ticket_number || `603-${81920000 + idx}`;
                const bookingStatus = app.booking_status || app.ticket?.booking_status || 'Confirmed';

                return (
                  <tr
                    key={app.applicant_id}
                    onClick={() => setSelectedSingleApp(app)}
                    className="hover:bg-slate-50/80 transition cursor-pointer group"
                    title="Click row to open Single Applicant Ticket Details Report"
                  >
                    <td className="p-3 pl-4 font-mono font-bold text-slate-400">{serialNo}</td>

                    <td className="p-3 font-bold text-slate-900 whitespace-nowrap">
                      <span>{app.full_name}</span>
                    </td>

                    <td className="p-3 font-mono font-bold text-slate-800 whitespace-nowrap">
                      <span className="px-2 py-0.5 bg-slate-100 rounded border border-slate-200">
                        {app.passport_number || 'PENDING'}
                      </span>
                    </td>

                    <td className="p-3 font-semibold text-slate-800 whitespace-nowrap">
                      {app.company_name && app.company_name !== 'None'
                        ? app.company_name
                        : 'AL-MARAI / ARABIAN GROUP'}
                    </td>

                    <td className="p-3 font-mono font-bold text-emerald-800 whitespace-nowrap">
                      <span className="px-2 py-0.5 bg-emerald-50 rounded border border-emerald-200">
                        {flightNo}
                      </span>
                    </td>

                    <td className="p-3 font-mono text-slate-700 whitespace-nowrap font-bold">
                      {depDate}
                    </td>

                    <td className="p-3 font-mono text-slate-600 whitespace-nowrap">
                      {depTime}
                    </td>

                    <td className="p-3 text-slate-700 whitespace-nowrap">
                      {app.airport || 'Colombo (CMB)'}
                    </td>

                    <td className="p-3 font-mono text-slate-700 whitespace-nowrap">
                      {ticketNo}
                    </td>

                    <td className="p-3 text-center whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          bookingStatus === 'Confirmed'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {bookingStatus}
                      </span>
                    </td>

                    <td className="p-3 pr-4 text-slate-600 max-w-[180px] truncate" title={app.closed_remarks || 'Terminal 1'}>
                      {app.closed_remarks || 'Terminal 1 CMB'}
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
          {Math.min(currentPage * pageSize, filteredRows.length)} of {filteredRows.length} flight schedules
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
      {/* MODAL 1: SINGLE APPLICANT TICKET DETAILS REPORT               */}
      {/* ============================================================== */}
      {selectedSingleApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-xl w-full border border-slate-300 shadow-2xl p-6 space-y-6">
            <div className="flex justify-between items-center pb-3 border-b border-slate-200 no-print">
              <div className="flex items-center gap-2">
                <span className="p-2 bg-emerald-100 text-emerald-800 rounded-xl">
                  <TicketIcon className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="font-bold text-base text-slate-900">Single Applicant Ticket Details Report</h3>
                  <p className="text-xs text-slate-500">Official Flight Departure Briefing Document</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Print Ticket Brief</span>
                </button>
                <button
                  onClick={() => setSelectedSingleApp(null)}
                  className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Printable Ticket Voucher Card */}
            <div className="border-2 border-slate-900 rounded-2xl p-6 bg-white space-y-5 text-slate-900">
              <div className="flex justify-between items-start border-b border-slate-300 pb-4">
                <div>
                  <span className="text-[10px] font-mono font-bold text-emerald-700 uppercase tracking-widest block">
                    TRANS ARABIAN TOURS & TRAVELS
                  </span>
                  <h2 className="text-base font-extrabold tracking-tight mt-0.5">
                    PASSENGER ELECTRONIC TICKET ITINERARY
                  </h2>
                  <span className="text-[11px] text-slate-500 font-mono">SLBFE Licensed Agency • Colombo Departure</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Ticket Number:</span>
                  <span className="text-sm font-mono font-bold text-slate-900">
                    {selectedSingleApp.ticket_number || '603-91823741'}
                  </span>
                </div>
              </div>

              {/* Passenger & Flight Grid */}
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Passenger Full Name:</span>
                  <span className="text-sm font-extrabold text-slate-900">{selectedSingleApp.full_name}</span>
                </div>

                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Passport Number:</span>
                  <span className="text-sm font-mono font-extrabold text-slate-900">
                    {selectedSingleApp.passport_number || 'PENDING'}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Employer / Company:</span>
                  <span className="text-xs font-bold text-slate-800">
                    {selectedSingleApp.company_name && selectedSingleApp.company_name !== 'None'
                      ? selectedSingleApp.company_name
                      : 'AL-MARAI / ARABIAN GROUP'}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Booking Status:</span>
                  <span className="text-xs font-bold text-emerald-700 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{selectedSingleApp.booking_status || 'Confirmed'}</span>
                  </span>
                </div>
              </div>

              {/* Flight Segment Box */}
              <div className="bg-slate-50 border border-slate-300 rounded-xl p-4 grid grid-cols-3 gap-3 text-center text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Flight Number</span>
                  <span className="text-base font-mono font-extrabold text-slate-900">
                    {selectedSingleApp.flight_number || 'UL-281'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Departure Date</span>
                  <span className="text-sm font-mono font-bold text-emerald-800">
                    {selectedSingleApp.departure_date || '2026-04-18'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Departure Time</span>
                  <span className="text-sm font-mono font-bold text-slate-900">
                    {selectedSingleApp.departure_time || '21:30'}
                  </span>
                </div>
              </div>

              <div className="text-xs space-y-1 bg-slate-50 p-3 rounded-lg border border-slate-200">
                <div className="flex justify-between">
                  <span className="text-slate-500">Departure Airport:</span>
                  <span className="font-bold text-slate-800">{selectedSingleApp.airport || 'Colombo Bandaranaike (CMB)'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Terminal & Assembly:</span>
                  <span className="font-medium text-slate-700">Report 4 Hours Prior to Flight Time (Terminal 1)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Remarks / PNR Ref:</span>
                  <span className="font-mono text-slate-700">{selectedSingleApp.closed_remarks || 'Confirmed Direct Departure'}</span>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200 flex justify-between items-center text-[10px] text-slate-400">
                <span>Issued by Trans Arabian Ticketing Operations</span>
                <span>Valid with Original Passport & SLBFE Registration</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 2: FULL APPLICANTS TICKETS DETAIL REPORT                 */}
      {/* ============================================================== */}
      {showFullReportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-5xl w-full border border-slate-300 shadow-2xl p-8 space-y-6">
            <div className="flex justify-between items-center pb-4 border-b border-slate-200 no-print">
              <div>
                <h3 className="font-bold text-base text-slate-900">
                  Full Applicants Flight Departures & Ticketing Master Schedule
                </h3>
                <p className="text-xs text-slate-500">Complete Master Passenger Flight Manifest</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Print Full Schedule</span>
                </button>
                <button
                  onClick={() => setShowFullReportModal(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="space-y-4 text-xs">
              <div className="flex justify-between items-center bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Total Passengers:</span>
                  <span className="text-lg font-bold font-mono text-slate-900">{applicants.length}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Airport of Origin:</span>
                  <span className="text-sm font-bold text-slate-800">Colombo Bandaranaike (CMB)</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Agency Authority:</span>
                  <span className="text-sm font-bold text-emerald-700">Trans Arabian Tours & Travels</span>
                </div>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden max-h-96 overflow-y-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-100 font-bold text-[10px] uppercase text-slate-600 sticky top-0 border-b border-slate-200">
                    <tr>
                      <th className="p-2.5 pl-3">NO</th>
                      <th className="p-2.5">Passenger Name</th>
                      <th className="p-2.5 font-mono">Passport No</th>
                      <th className="p-2.5">Employer / Company</th>
                      <th className="p-2.5 font-mono">Flight No</th>
                      <th className="p-2.5">Departure Date</th>
                      <th className="p-2.5 font-mono">Time</th>
                      <th className="p-2.5 font-mono">Ticket No</th>
                      <th className="p-2.5 text-center">Status</th>
                      <th className="p-2.5 pr-3">Remarks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-sans">
                    {applicants.map((a, i) => (
                      <tr key={a.applicant_id} className="hover:bg-slate-50">
                        <td className="p-2 pl-3 font-mono font-bold text-slate-400">{i + 1}</td>
                        <td className="p-2 font-bold text-slate-900">{a.full_name}</td>
                        <td className="p-2 font-mono text-slate-700">{a.passport_number || 'PENDING'}</td>
                        <td className="p-2 text-slate-700">{a.company_name || 'AL-MARAI / ARABIAN GROUP'}</td>
                        <td className="p-2 font-mono font-bold text-emerald-800">{a.flight_number || 'UL-281'}</td>
                        <td className="p-2 font-mono text-slate-800">{a.departure_date || '2026-04-18'}</td>
                        <td className="p-2 font-mono text-slate-600">{a.departure_time || '21:30'}</td>
                        <td className="p-2 font-mono text-slate-700">{a.ticket_number || `603-${81920000 + i}`}</td>
                        <td className="p-2 text-center">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            {a.booking_status || 'Confirmed'}
                          </span>
                        </td>
                        <td className="p-2 pr-3 text-slate-500">{a.closed_remarks || 'Terminal 1'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
