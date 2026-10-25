import React, { useRef, useState, useEffect } from 'react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { Printer, Download, X, BookOpen, Loader2, Calendar } from 'lucide-react';
import { ApplicantOverview } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  applicants: ApplicantOverview[];
  targetAttempt: number; // 1, 2, or 3
}

export const EnglishSchedulePdfModal: React.FC<Props> = ({
  isOpen,
  onClose,
  applicants,
  targetAttempt
}) => {
  const reportRef = useRef<HTMLDivElement>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [selectedAttempt, setSelectedAttempt] = useState<number>(targetAttempt);

  useEffect(() => {
    setSelectedAttempt(targetAttempt);
  }, [targetAttempt, isOpen]);

  if (!isOpen) return null;

  // Filter candidates relevant for selected attempt
  const attemptCandidates = applicants.filter((app) => {
    const att = app.english_current_attempt || 1;
    if (selectedAttempt === 1) {
      return att === 1 || !!app.english_attendance_1 || (!app.english_current_attempt && !app.english_attendance_2);
    } else if (selectedAttempt === 2) {
      return att === 2 || !!app.english_attendance_2;
    } else if (selectedAttempt === 3) {
      return att === 3 || !!app.english_attendance_3;
    }
    return att === selectedAttempt;
  });

  // Group candidates by test date for this attempt
  const dateGroupsMap = new Map<string, ApplicantOverview[]>();

  attemptCandidates.forEach((app) => {
    let testDate = 'UNSCHEDULED';
    if (selectedAttempt === 1) {
      testDate = app.english_test_date_1 || app.registration_date || app.embassy_applied_date || 'UNSCHEDULED';
    } else if (selectedAttempt === 2) {
      testDate = app.english_test_date_2 || app.english_test_date_1 || 'UNSCHEDULED';
    } else if (selectedAttempt === 3) {
      testDate = app.english_test_date_3 || app.english_test_date_2 || 'UNSCHEDULED';
    }

    if (!dateGroupsMap.has(testDate)) {
      dateGroupsMap.set(testDate, []);
    }
    dateGroupsMap.get(testDate)!.push(app);
  });

  // Convert map to sorted list of date groups
  const dateGroups = Array.from(dateGroupsMap.entries()).map(([date, list]) => ({
    date,
    list
  }));

  const totalCandidatesForAttempt = attemptCandidates.length;

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = async () => {
    if (!reportRef.current) return;
    setIsGeneratingPdf(true);

    try {
      const element = reportRef.current;
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });

      const imgData = canvas.toDataURL('image/jpeg', 1.0);
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pdfWidth - 10;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = 5;

      pdf.addImage(imgData, 'JPEG', 5, position, imgWidth, imgHeight);
      heightLeft -= pdfHeight;

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight + 5;
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 5, position, imgWidth, imgHeight);
        heightLeft -= pdfHeight;
      }

      pdf.save(`TransArabian_English_Test_Attempt_0${selectedAttempt}_Schedule_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (err) {
      console.error('PDF Generation Error:', err);
      window.print();
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-5xl w-full overflow-hidden flex flex-col my-auto max-h-[94vh]">
        {/* Toolbar Header */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between px-6 py-3.5 border-b border-slate-200 bg-slate-900 text-white gap-3 shrink-0 print:hidden">
          <div className="flex items-center gap-3">
            <div className="p-1.5 rounded-lg bg-emerald-400/20 text-emerald-400">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold tracking-tight">
                English Interview Tests Schedule PDF Preview
              </h3>
              <p className="text-[11px] text-slate-400">
                Preview & print candidate test groups for Attempt 01, 02, or 03.
              </p>
            </div>
          </div>

          {/* Attempt Selector Tabs in Modal */}
          <div className="flex items-center gap-1.5 bg-slate-800 p-1 rounded-xl border border-slate-700">
            {[1, 2, 3].map((attNum) => (
              <button
                key={attNum}
                type="button"
                onClick={() => setSelectedAttempt(attNum)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                  selectedAttempt === attNum
                    ? 'bg-amber-400 text-slate-950 shadow-xs'
                    : 'text-slate-300 hover:text-white hover:bg-slate-700'
                }`}
              >
                Attempt 0{attNum}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 justify-end">
            <button
              onClick={handleDownloadPdf}
              disabled={isGeneratingPdf}
              className="flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs px-3.5 py-2 rounded-xl transition cursor-pointer shadow-xs disabled:opacity-50"
            >
              {isGeneratingPdf ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Generating PDF...</span>
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5" />
                  <span>Download PDF (.pdf)</span>
                </>
              )}
            </button>

            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs px-3.5 py-2 rounded-xl transition cursor-pointer shadow-xs"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Document</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Report View */}
        <div className="p-6 overflow-y-auto bg-slate-100 flex-1">
          <div
            ref={reportRef}
            id="printable-english-schedule-report"
            className="bg-white p-6 rounded-xl border border-slate-300 shadow-sm space-y-6 text-slate-900 font-sans"
            style={{ minWidth: '800px' }}
          >
            {/* Header Title */}
            <div className="text-center pb-4 border-b border-slate-200 space-y-1">
              <h2 className="text-lg font-black text-slate-900 uppercase tracking-wide font-serif">
                TRANS ARABIAN RECRUITMENT AGENCY
              </h2>
              <p className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                ENGLISH INTERVIEW TEST SCHEDULE REPORT — ATTEMPT 0{selectedAttempt}
              </p>
              <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono pt-1">
                <span>Attempt Level: Attempt 0{selectedAttempt}</span>
                <span>Total Candidates: {totalCandidatesForAttempt}</span>
                <span>Generated Date: {new Date().toLocaleDateString('en-GB')}</span>
              </div>
            </div>

            {/* Categorized Tables by English Testing Date */}
            {dateGroups.length === 0 ? (
              <div className="p-10 text-center text-slate-400 italic">
                No scheduled candidates found for Attempt 0{selectedAttempt}.
              </div>
            ) : (
              dateGroups.map((group) => (
                <div key={group.date} className="space-y-2">
                  {/* Table Header displaying the English Testing Date */}
                  <div className="bg-slate-900 text-white px-4 py-2 rounded-t-lg flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider">
                      <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                      <span>ENGLISH TESTING DATE: {group.date}</span>
                    </div>
                    <span className="text-[10px] font-mono text-emerald-300 font-bold bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800">
                      {group.list.length} Candidate(s)
                    </span>
                  </div>

                  {/* Date Table */}
                  <table className="w-full text-xs text-left border-collapse border border-slate-300">
                    <thead>
                      <tr className="bg-slate-100 text-slate-800 font-extrabold uppercase text-[10px] border-b border-slate-300">
                        <th className="p-2 w-10 text-center font-mono border-r border-slate-300">NO</th>
                        <th className="p-2 border-r border-slate-300">APPLICANT NAME</th>
                        <th className="p-2 font-mono border-r border-slate-300">PASSPORT NUMBER</th>
                        <th className="p-2 font-mono border-r border-slate-300">SE NUMBER</th>
                        <th className="p-2 font-mono text-center">ENGLISH TESTING TIME</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.list.map((app, idx) => {
                        let time = '10:00 AM';
                        if (selectedAttempt === 1) time = app.english_test_time_1 || '10:00 AM';
                        else if (selectedAttempt === 2) time = app.english_test_time_2 || '10:00 AM';
                        else if (selectedAttempt === 3) time = app.english_test_time_3 || '10:00 AM';

                        return (
                          <tr key={app.applicant_id} className="border-b border-slate-200 text-slate-900">
                            <td className="p-2 text-center font-mono font-bold text-slate-500 border-r border-slate-200">
                              {idx + 1}
                            </td>
                            <td className="p-2 font-bold uppercase border-r border-slate-200">
                              {app.full_name}
                            </td>
                            <td className="p-2 font-mono font-bold text-slate-800 border-r border-slate-200">
                              {app.passport_number || 'PENDING'}
                            </td>
                            <td className="p-2 font-mono font-extrabold text-slate-900 border-r border-slate-200">
                              {app.se_number || '—'}
                            </td>
                            <td className="p-2 font-mono font-bold text-center text-emerald-800">
                              {time}
                            </td>
                          </tr>
                        );
                      })}

                      {/* Subtotal Footer Row */}
                      <tr className="bg-emerald-50 text-emerald-950 font-black border-t-2 border-emerald-300">
                        <td colSpan={3} className="p-2 pl-3 font-bold text-xs uppercase text-emerald-900">
                          TOTAL APPLICANTS FOR {group.date}
                        </td>
                        <td colSpan={2} className="p-2 pr-3 text-right font-mono font-extrabold text-xs text-emerald-900">
                          {group.list.length} Candidate(s)
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500 shrink-0 print:hidden">
          <span>
            Trans Arabian Agency · English Testing Attempt 0{selectedAttempt} Schedule Matrix
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 font-semibold text-slate-700 transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
