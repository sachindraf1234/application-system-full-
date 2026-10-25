import React from 'react';
import { ApplicantOverview } from '../types';
import { Printer, X, ShieldCheck } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  applicants: ApplicantOverview[];
}

const formatAppointmentTime = (timeStr?: string) => {
  if (!timeStr) return '09:00 AM';
  const trimmed = timeStr.trim().toUpperCase();
  if (trimmed === 'PENDING' || trimmed === 'PENDING_TIME') return 'PENDING';
  if (trimmed.includes('AM') || trimmed.includes('PM')) {
    return trimmed;
  }
  return `${trimmed} AM`;
};

export const EmbassyInterviewsPdfModal: React.FC<Props> = ({
  isOpen,
  onClose,
  applicants
}) => {
  if (!isOpen) return null;

  // Filter candidates relevant to embassy interviews
  const interviewCandidates = applicants.filter(
    (a) =>
      Boolean(a.appointment_date) ||
      Boolean(a.interview_status) ||
      a.visa_status === 'OK' ||
      (a.current_status as any) === 'EMBASSY_INTERVIEW' ||
      Boolean(a.se_number)
  );

  // Helper to format date as DD.MM.YYYY
  const formatDateWithDots = (dateStr: string) => {
    if (!dateStr || dateStr === 'PENDING_DATE') return 'Pending Date';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}.${month}.${year}`;
  };

  // Group by appointment date
  const groups: Record<string, ApplicantOverview[]> = {};
  interviewCandidates.forEach((app) => {
    const rawDate = app.appointment_date || 'PENDING_DATE';
    if (!groups[rawDate]) groups[rawDate] = [];
    groups[rawDate].push(app);
  });

  // Sort dates chronological
  const sortedDates = Object.keys(groups).sort((a, b) => {
    if (a === 'PENDING_DATE') return 1;
    if (b === 'PENDING_DATE') return -1;
    return new Date(a).getTime() - new Date(b).getTime();
  });

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-5xl w-full overflow-hidden flex flex-col my-auto max-h-[92vh]">
        {/* Modal Toolbar */}
        <div className="flex items-center justify-between px-6 py-3.5 border-b border-slate-200 bg-slate-900 text-white print:hidden">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-5 h-5 text-amber-400" />
            <div>
              <h3 className="text-sm font-bold tracking-tight">
                EMBASSY INTERVIEW CANDIDATES (EMBASSY INTERVIEW.pdf Format)
              </h3>
              <p className="text-[11px] text-slate-400">
                Official date-grouped layout matching uploaded format exactly.
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

        {/* Printable Paper Canvas */}
        <div className="p-8 overflow-y-auto bg-slate-100/60 print:bg-white print:p-0">
          <div className="max-w-[210mm] mx-auto bg-white p-8 rounded-lg shadow-sm border border-slate-200 print:border-none print:shadow-none print:p-0 space-y-8">
            
            {/* Grouped blocks in exact uploaded PDF style */}
            {sortedDates.map((rawDate) => {
              const dateCandidates = groups[rawDate];
              const formattedDate = formatDateWithDots(rawDate);

              return (
                <div key={rawDate} className="space-y-0.5 page-break-inside-avoid">
                  
                  {/* Appointment Date Banner Header */}
                  <div className="bg-slate-50 border border-black border-b-0 px-4 py-1.5 text-center font-bold text-xs text-black tracking-wide font-sans">
                    Appointment Date: {formattedDate}
                  </div>

                  {/* Main Table matching screenshot */}
                  <table className="w-full text-[10px] text-left border-collapse border border-black font-sans">
                    <thead className="bg-slate-100 font-bold uppercase text-[9px] text-slate-800">
                      <tr className="border-b border-black">
                        <th className="border-r border-black p-2 text-center w-24">SE NUMBER</th>
                        <th className="border-r border-black p-2">Name</th>
                        <th className="border-r border-black p-2 text-center w-28">Appointment Time</th>
                        <th className="border-r border-black p-2 text-center w-36">Passport Collected Date</th>
                        <th className="border-r border-black p-2">STATUS</th>
                        <th className="p-2 text-center w-24">Visa Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black">
                      {dateCandidates.map((app) => {
                        const isAppRejected = (app.visa_status || '').toLowerCase().includes('reject');
                        const statusDisplay = isAppRejected
                          ? ((app as any).refusal_reason || app.interview_status || app.closed_remarks || 'REJECTED')
                          : '';
                        const collectedDateDisplay = (app as any).passport_collected_date || '';
                        const visaDisplay = app.visa_status || '';

                        return (
                          <tr key={app.applicant_id} className="border-b border-black text-black">
                            <td className="border-r border-black p-2 text-center font-mono font-bold">
                              {app.se_number || 'PENDING'}
                            </td>
                            <td className="border-r border-black p-2 font-bold uppercase">
                              {app.full_name}
                            </td>
                            <td className="border-r border-black p-2 text-center font-mono font-semibold">
                              {formatAppointmentTime(app.appointment_time)}
                            </td>
                            <td className="border-r border-black p-2 text-center font-mono">
                              {collectedDateDisplay ? collectedDateDisplay.replace(/-/g, '.') : ''}
                            </td>
                            <td className="border-r border-black p-2 font-bold uppercase">
                              <span className={statusDisplay.includes('CANCEL') || statusDisplay.includes('DID NOT') ? 'text-rose-700' : ''}>
                                {statusDisplay}
                              </span>
                            </td>
                            <td className="p-2 text-center font-bold font-mono">
                              {visaDisplay}
                            </td>
                          </tr>
                        );
                      })}

                      {/* Total Count Footer Row formatted exactly as the PDF */}
                      <tr className="bg-slate-50 font-bold text-black border-t border-black">
                        <td colSpan={5} className="border-r border-black p-1.5 text-center uppercase tracking-wider text-[10px]">
                          Total
                        </td>
                        <td className="p-1.5 text-center font-mono text-[11px]">
                          {dateCandidates.length}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              );
            })}

            {/* Document Footer */}
            <div className="pt-4 border-t border-black text-[9px] text-black flex justify-between font-mono">
              <span>Trans Arabian Foreign Employment Agency</span>
              <span>Generated: {new Date().toLocaleDateString()}</span>
              <span>Total Groups Count: {sortedDates.length}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
