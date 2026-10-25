import React from 'react';
import * as XLSX from 'xlsx';
import { ApplicantOverview } from '../types';
import { Printer, Download, X, Plane } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  applicants: ApplicantOverview[];
  selectedCompanies: string[];
  selectedSubCompanies: string[];
  selectedVisaEndMonths: string[];
}

export const DeparturePendingPdfModal: React.FC<Props> = ({
  isOpen,
  onClose,
  applicants,
  selectedCompanies,
  selectedSubCompanies,
  selectedVisaEndMonths
}) => {
  if (!isOpen) return null;

  // Group applicants by Company & Sub-Company
  const groupsMap: Record<string, { companyName: string; subCompanyName: string; candidates: ApplicantOverview[] }> = {};

  applicants.forEach((app) => {
    const comp = app.company_name && app.company_name !== 'None' ? app.company_name : 'ASIA RECRUITMENT';
    const subComp = app.sub_company || 'SKYLINE ENGINEERING SRL';
    const groupKey = `${comp}___${subComp}`;

    if (!groupsMap[groupKey]) {
      groupsMap[groupKey] = {
        companyName: comp,
        subCompanyName: subComp,
        candidates: []
      };
    }
    groupsMap[groupKey].candidates.push(app);
  });

  const groupList = Object.values(groupsMap);

  const handlePrint = () => {
    window.print();
  };

  // Export exact PDF-matching Excel sheet
  const handleExportExcel = () => {
    try {
      const excelRows: any[] = [];

      excelRows.push({
        'NO': 'TRANS ARABIAN RECRUITMENT AGENCY — DEPARTURE PENDING PERSONS'
      });
      excelRows.push({});

      groupList.forEach((grp) => {
        // Table Header Row
        excelRows.push({
          'NO': 'NO',
          'NAME': 'NAME',
          'PASSPORT': 'PASSPORT',
          'COMPANY': 'COMPANY',
          'SUB COMPANY': 'SUB COMPANY',
          'VISA START DATE': 'VISA START DATE',
          'VISA END DATE': 'VISA END DATE'
        });

        // Data Rows
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

        // Group Sub-total summary row matching uploaded PDF format
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

        excelRows.push({}); // Space between sub-company groups
      });

      const ws = XLSX.utils.json_to_sheet(excelRows, { skipHeader: true });
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'DEPARTURE_PENDING');
      const filename = `Departure_Pending_Categorized_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(wb, filename);
    } catch (err) {
      console.error('Excel Export error:', err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-6xl w-full overflow-hidden flex flex-col my-auto max-h-[94vh]">
        {/* Modal Toolbar */}
        <div className="flex items-center justify-between px-6 py-3.5 border-b border-slate-200 bg-slate-900 text-white print:hidden">
          <div className="flex items-center gap-2.5">
            <Plane className="w-5 h-5 text-purple-400" />
            <div>
              <h3 className="text-sm font-bold tracking-tight">
                DEPARTURE PENDING PERSONS (Official Categorized Format)
              </h3>
              <p className="text-[11px] text-slate-400">
                Company & Sub-Company Categorized · Total {applicants.length} candidates across {groupList.length} sub-company groups
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportExcel}
              className="flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs px-3.5 py-2 rounded-xl transition cursor-pointer shadow-xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Excel (.xlsx)</span>
            </button>

            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 bg-purple-700 hover:bg-purple-600 text-white font-bold text-xs px-4 py-2 rounded-xl transition cursor-pointer shadow-xs"
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
            {/* Header */}
            <div className="text-center pb-3 border-b-2 border-black">
              <h1 className="text-base font-black tracking-wider uppercase text-black font-sans">
                TRANS ARABIAN RECRUITMENT AGENCY — DEPARTURE PENDING PERSONS
              </h1>
              <p className="text-[10px] text-black tracking-wide font-mono mt-0.5">
                SLBFE REGISTERED LICENSE NO: 2601 · COMPANY & SUB-COMPANY CATEGORIZED DEPARTURE ROSTER
              </p>
            </div>

            {/* Categorized Groups Matching Uploaded PDF Format */}
            {groupList.length === 0 ? (
              <div className="p-8 text-center text-slate-500 font-mono text-xs">
                No departure pending records match the selected company, sub-company, and visa end month filters.
              </div>
            ) : (
              groupList.map((grp) => {
                const summaryLabel = grp.subCompanyName.toUpperCase().includes('COMPANY')
                  ? grp.subCompanyName.toUpperCase()
                  : `${grp.subCompanyName.toUpperCase()} COMPANY`;

                return (
                  <div key={`${grp.companyName}-${grp.subCompanyName}`} className="space-y-1 page-break-inside-avoid">
                    {/* Sub-Company Group Table */}
                    <table className="w-full text-[10px] text-left border-collapse border border-black font-sans">
                      <thead className="bg-slate-50 font-bold uppercase text-[9px] border-b border-black">
                        <tr className="border-b border-black">
                          <th className="border border-black p-1.5 text-center w-8">NO</th>
                          <th className="border border-black p-1.5">NAME</th>
                          <th className="border border-black p-1.5 font-mono text-center">PASSPORT</th>
                          <th className="border border-black p-1.5">COMPANY</th>
                          <th className="border border-black p-1.5">SUB COMPANY</th>
                          <th className="border border-black p-1.5 text-center whitespace-nowrap">VISA START DATE</th>
                          <th className="border border-black p-1.5 text-center whitespace-nowrap">VISA END DATE</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-black">
                        {grp.candidates.map((app, idx) => (
                          <tr key={app.applicant_id} className="border-b border-black">
                            <td className="border border-black p-1 text-center font-mono font-bold">
                              {idx + 1}
                            </td>
                            <td className="border border-black p-1 font-bold text-black uppercase">
                              {app.full_name}
                            </td>
                            <td className="border border-black p-1 font-mono font-semibold text-center">
                              {app.passport_number || 'PENDING'}
                            </td>
                            <td className="border border-black p-1 text-black uppercase">
                              {grp.companyName}
                            </td>
                            <td className="border border-black p-1 text-black uppercase">
                              {grp.subCompanyName}
                            </td>
                            <td className="border border-black p-1 font-mono text-center whitespace-nowrap">
                              {app.visa_start_date ? app.visa_start_date.replace(/-/g, '/') : '5/4/2026'}
                            </td>
                            <td className="border border-black p-1 font-mono text-center whitespace-nowrap">
                              {app.visa_end_date ? app.visa_end_date.replace(/-/g, '/') : '1/10/2026'}
                            </td>
                          </tr>
                        ))}

                        {/* Sub-Company Summary Total Row matching exact uploaded PDF format */}
                        <tr className="border-t-2 border-black bg-slate-100/90 font-black font-sans">
                          <td colSpan={4} className="border border-black p-1.5 text-center uppercase tracking-wider text-[11px]">
                            {summaryLabel}
                          </td>
                          <td className="border border-black p-1.5 text-center font-mono text-sm font-extrabold text-black">
                            {grp.candidates.length}
                          </td>
                          <td colSpan={2} className="border border-black p-1.5"></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                );
              })
            )}

            {/* Document Footer */}
            <div className="pt-4 border-t border-black text-[9px] text-black flex justify-between font-mono">
              <span>Trans Arabian Foreign Employment Agency</span>
              <span>Generated on: {new Date().toLocaleDateString()}</span>
              <span>Total Roster Count: {applicants.length} Candidates</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
