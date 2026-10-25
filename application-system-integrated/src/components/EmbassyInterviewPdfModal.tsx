import React from 'react';
import { ApplicantOverview } from '../types';
import { Printer, Download, X, CalendarCheck } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  applicants: ApplicantOverview[];
}

export const EmbassyInterviewPdfModal: React.FC<Props> = ({
  isOpen,
  onClose,
  applicants
}) => {
  if (!isOpen) return null;

  // Filter applicants that have an interview schedule or SE number
  const interviewList = applicants.filter(
    (a) => a.appointment_date || a.se_number || a.interview_status
  );

  // Group by appointment_date
  const groups: Record<string, ApplicantOverview[]> = {};
  interviewList.forEach((app) => {
    let d = app.appointment_date || 'Awaiting Date';
    // Format to DD.MM.YYYY if YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) {
      const parts = d.split('-');
      d = `${parts[2]}.${parts[1]}.${parts[0]}`;
    }
    if (!groups[d]) groups[d] = [];
    groups[d].push(app);
  });

  const sortedDates = Object.keys(groups).sort((a, b) => a.localeCompare(b));

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-5xl w-full overflow-hidden flex flex-col my-auto max-h-[92vh]">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-6 py-3.5 border-b border-slate-200 bg-slate-900 text-white print:hidden">
          <div className="flex items-center gap-2.5">
            <CalendarCheck className="w-5 h-5 text-purple-400" />
            <div>
              <h3 className="text-sm font-bold tracking-tight">
                EMBASSY INTERVIEW SCHEDULE (EMBASSY INTERVIEW EXCEL.pdf)
              </h3>
              <p className="text-[11px] text-slate-400">
                Grouped by Appointment Date with Candidate Subtotals
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-4 py-2 rounded-xl transition cursor-pointer shadow-xs"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print / Download PDF</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Paper Canvas */}
        <div className="p-8 overflow-y-auto bg-slate-100/60 print:bg-white print:p-0">
          <div className="max-w-[210mm] mx-auto bg-white p-8 rounded-lg shadow-sm border border-slate-200 print:border-none print:shadow-none print:p-0 space-y-6">
            {/* Header */}
            <div className="text-center pb-4 border-b border-black">
              <h1 className="text-base font-black tracking-wider uppercase text-black font-sans">
                TRANS ARABIAN RECRUITMENT AGENCY — EMBASSY INTERVIEW SCHEDULE
              </h1>
              <p className="text-[10px] text-black tracking-wide font-mono mt-0.5">
                OFFICIAL SAUDI & GULF EMBASSY INTERVIEWS & BIOMETRICS MANIFEST
              </p>
            </div>

            {/* Date Groups */}
            {sortedDates.map((dateStr) => {
              const dateApplicants = groups[dateStr];
              const totalCount = dateApplicants.length;

              return (
                <div key={dateStr} className="space-y-1 page-break-inside-avoid">
                  {/* Appointment Date Banner matching PDF */}
                  <div className="bg-slate-100 border border-black px-4 py-1 text-center font-bold text-xs text-black">
                    Appointment Date: {dateStr}
                  </div>

                  {/* Table matching exact PDF format */}
                  <table className="w-full text-[10px] text-left border-collapse border border-black font-sans">
                    <thead className="bg-white font-bold text-[9px] border-b border-black">
                      <tr className="border-b border-black">
                        <th className="border border-black p-2 font-mono w-28">SE NUMBER</th>
                        <th className="border border-black p-2">Name</th>
                        <th className="border border-black p-2 whitespace-nowrap text-center w-28">
                          Appointment Time
                        </th>
                        <th className="border border-black p-2">STATUS</th>
                        <th className="border border-black p-2 text-center whitespace-nowrap w-32">
                          Passport Collected Date
                        </th>
                        <th className="border border-black p-2 text-center w-24">Visa Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black">
                      {dateApplicants.map((app) => {
                        const statusDisplay =
                          app.interview_status ||
                          (app.closed_remarks?.includes('CANCEL') || app.closed_remarks?.includes('INTERVIEW')
                            ? app.closed_remarks
                            : '');

                        return (
                          <tr key={app.applicant_id} className="border-b border-black">
                            <td className="border border-black p-1.5 font-mono font-bold text-black">
                              {app.se_number || 'SE2400909'}
                            </td>
                            <td className="border border-black p-1.5 font-bold text-black uppercase">
                              {app.full_name}
                            </td>
                            <td className="border border-black p-1.5 font-mono text-center font-semibold">
                              {app.appointment_time || '09.30AM'}
                            </td>
                            <td className="border border-black p-1.5 font-bold text-black">
                              {statusDisplay}
                            </td>
                            <td className="border border-black p-1.5 font-mono text-center">
                              {app.passport_collected_date || ''}
                            </td>
                            <td className="border border-black p-1.5 text-center font-semibold">
                              {app.visa_status === 'OK' ? 'OK' : app.visa_status || ''}
                            </td>
                          </tr>
                        );
                      })}
                      {/* Subtotal row matching PDF */}
                      <tr className="bg-slate-50 font-bold border-t border-black">
                        <td colSpan={5} className="border border-black p-1.5 text-right uppercase">
                          Total
                        </td>
                        <td className="border border-black p-1.5 text-center font-mono font-bold">
                          {totalCount}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              );
            })}

            {/* Footer */}
            <div className="pt-4 border-t border-black text-[9px] text-black flex justify-between font-mono">
              <span>Trans Arabian Foreign Employment Agency</span>
              <span>Printed: {new Date().toLocaleDateString()}</span>
              <span>Total Scheduled: {interviewList.length}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
