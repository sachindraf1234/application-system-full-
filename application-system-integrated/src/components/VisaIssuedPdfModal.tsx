import React from 'react';
import { ApplicantOverview } from '../types';
import { Printer, X, CheckCircle2, Building, ShieldCheck } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  applicants: ApplicantOverview[];
}

export const VisaIssuedPdfModal: React.FC<Props> = ({
  isOpen,
  onClose,
  applicants
}) => {
  if (!isOpen) return null;

  // Filter ONLY applicants with Visa Issued (OK)
  const visaIssuedCandidates = applicants.filter(
    (a) => a.visa_status === 'OK' || a.visa_status === 'Visa Issued (OK)'
  );

  const handlePrint = () => {
    window.print();
  };

  const currentDate = new Date().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-5xl w-full overflow-hidden flex flex-col my-auto max-h-[94vh]">
        {/* Modal Toolbar - Hidden during Print */}
        <div className="flex items-center justify-between px-6 py-3.5 border-b border-slate-200 bg-slate-900 text-white print:hidden">
          <div className="flex items-center gap-2.5">
            <span className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <CheckCircle2 className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-sm font-bold tracking-tight">
                VISA ISSUED CANDIDATES ROSTER (PRINT / PDF TABLE)
              </h3>
              <p className="text-[11px] text-slate-400">
                Official table with Applicant Name, Passport No, SE Number, Company Name, and Sub Company Name only.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-4 py-2 rounded-xl transition cursor-pointer shadow-xs active:scale-98"
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
          <div className="max-w-[210mm] mx-auto bg-white p-8 rounded-lg shadow-sm border border-slate-200 print:border-none print:shadow-none print:p-0 space-y-6">
            
            {/* Header section matching official Agency letterhead */}
            <div className="border-b-2 border-slate-900 pb-4 flex justify-between items-start">
              <div>
                <h1 className="text-lg font-black tracking-tight text-slate-900 uppercase">
                  TRANS ARABIAN FOREIGN EMPLOYMENT AGENCY
                </h1>
                <p className="text-xs font-semibold text-slate-700">
                  SLBFE License No: 1515 · Embassy & Consular Processing Division
                </p>
                <div className="inline-block mt-2 px-3 py-1 bg-emerald-100 border border-emerald-300 rounded text-emerald-900 font-bold text-xs uppercase tracking-wide">
                  Official Visa Issued (OK) Candidates Roster
                </div>
              </div>
              <div className="text-right text-xs space-y-0.5 text-slate-600 font-mono">
                <div>Date: <strong>{currentDate}</strong></div>
                <div>Total Issued: <strong className="text-emerald-800 font-bold">{visaIssuedCandidates.length}</strong></div>
                <div className="text-[10px] text-slate-400">Status: VISA GRANTED</div>
              </div>
            </div>

            {/* Empty state notice if no candidates */}
            {visaIssuedCandidates.length === 0 ? (
              <div className="p-12 text-center text-slate-400 font-mono text-xs border border-dashed border-slate-300 rounded-xl">
                No candidates currently have visa status marked as "VISA ISSUED (OK)".
              </div>
            ) : (
              /* The Table: STRICTLY ONLY Applicant Name, Passport No, SE Number, Company Name, Sub Company Name */
              <div className="overflow-hidden border border-black rounded-xs">
                <table className="w-full text-xs text-left border-collapse border border-black font-sans">
                  <thead className="bg-slate-100 font-bold uppercase text-[10px] text-slate-900 border-b border-black">
                    <tr>
                      <th className="p-2.5 pl-3 border-r border-black w-10 text-center font-mono">NO</th>
                      <th className="p-2.5 border-r border-black">APPLICANT NAME</th>
                      <th className="p-2.5 border-r border-black font-mono text-center w-28">PASSPORT NO</th>
                      <th className="p-2.5 border-r border-black font-mono text-center w-28">SE NUMBER</th>
                      <th className="p-2.5 border-r border-black">COMPANY NAME</th>
                      <th className="p-2.5 pr-3">SUB COMPANY NAME</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black font-sans text-black">
                    {visaIssuedCandidates.map((app, idx) => {
                      const companyDisplay =
                        app.company_name && app.company_name !== 'None'
                          ? app.company_name
                          : 'ASIA RECRUITMENT';
                      const subCompanyDisplay =
                        app.sub_company ||
                        (app as any).departure?.sub_company ||
                        'SKYLINE ENGINEERING SRL';

                      return (
                        <tr key={app.applicant_id} className="border-b border-black">
                          <td className="p-2.5 pl-3 border-r border-black font-mono text-center font-bold text-slate-600">
                            {idx + 1}
                          </td>
                          <td className="p-2.5 border-r border-black font-bold uppercase">
                            {app.full_name}
                          </td>
                          <td className="p-2.5 border-r border-black font-mono font-bold text-center">
                            {app.passport_number || 'PENDING'}
                          </td>
                          <td className="p-2.5 border-r border-black font-mono font-bold text-center">
                            {app.se_number || '—'}
                          </td>
                          <td className="p-2.5 border-r border-black font-semibold uppercase">
                            {companyDisplay}
                          </td>
                          <td className="p-2.5 pr-3 font-semibold uppercase text-slate-800">
                            {subCompanyDisplay}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Total Summary Footer */}
            {visaIssuedCandidates.length > 0 && (
              <div className="flex justify-between items-center text-xs font-mono text-slate-600 pt-2 border-t border-slate-200">
                <span>Certified Official Record · Trans Arabian Agency</span>
                <span className="font-bold text-slate-900">
                  Total Visa Issued Applicants: {visaIssuedCandidates.length}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
