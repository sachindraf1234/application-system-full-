import React, { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { Printer, Download, X, ShieldCheck, FileSpreadsheet, Loader2, FileText } from 'lucide-react';
import { UnifiedEmbassyPendingRow } from './EmbassyPendingView';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  groupedSeReport: { se_group: string; rows: UnifiedEmbassyPendingRow[]; total: number }[];
  grandTotalPersons: number;
}

export const EmbassyPendingPdfModal: React.FC<Props> = ({
  isOpen,
  onClose,
  groupedSeReport,
  grandTotalPersons
}) => {
  const reportRef = useRef<HTMLDivElement>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  if (!isOpen) return null;

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
      const imgWidth = pdfWidth - 10; // 5mm margin on each side
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = 5; // Top margin

      // First Page
      pdf.addImage(imgData, 'JPEG', 5, position, imgWidth, imgHeight);
      heightLeft -= pdfHeight;

      // Add extra pages if report is long
      while (heightLeft >= 0) {
        position = heightLeft - imgHeight + 5;
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 5, position, imgWidth, imgHeight);
        heightLeft -= pdfHeight;
      }

      pdf.save(`TransArabian_Embassy_Pending_SE_Subtotal_Report_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (err) {
      console.error('PDF Generation Error:', err);
      // Fallback to print
      window.print();
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleExportExcel = () => {
    try {
      const exportRows: any[] = [];

      groupedSeReport.forEach((group) => {
        group.rows.forEach((r) => {
          exportRows.push({
            'NO': r.serial_no,
            'NAME': r.full_name,
            'PASSPORT NO': r.passport_number,
            'SE NUMBER': r.se_number,
            'COMPANY NAME': r.company_name,
            'EMBASSY APPLIED DATE': r.embassy_applied_date,
            'E NUMBER': r.e_number || ''
          });
        });

        // Insert Merged Subtotal Row
        exportRows.push({
          'NO': `${group.se_group} TOTAL PERSONS`,
          'NAME': '',
          'PASSPORT NO': '',
          'SE NUMBER': group.total,
          'COMPANY NAME': '',
          'EMBASSY APPLIED DATE': '',
          'E NUMBER': ''
        });
      });

      // Grand Total Row
      exportRows.push({
        'NO': 'GRAND TOTAL PERSONS',
        'NAME': '',
        'PASSPORT NO': '',
        'SE NUMBER': grandTotalPersons,
        'COMPANY NAME': '',
        'EMBASSY APPLIED DATE': '',
        'E NUMBER': ''
      });

      const ws = XLSX.utils.json_to_sheet(exportRows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'EMBASSY_SE_REPORT');
      const filename = `TransArabian_Embassy_Pending_SE_Report_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(wb, filename);
    } catch (err: any) {
      console.error('Excel export error', err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-6xl w-full overflow-hidden flex flex-col my-auto max-h-[94vh]">
        {/* Modal Toolbar */}
        <div className="flex items-center justify-between px-6 py-3.5 border-b border-slate-200 bg-slate-900 text-white shrink-0 print:hidden">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-amber-400/20 text-amber-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold tracking-tight">
                Embassy Pending: SE Numbers Subtotal Report PDF
              </h3>
              <p className="text-[11px] text-slate-400">
                Official PDF format with merged subtotals under each SE number group.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadPdf}
              disabled={isGeneratingPdf}
              className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs px-3.5 py-2 rounded-xl transition cursor-pointer shadow-xs disabled:opacity-50"
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
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-3.5 py-2 rounded-xl transition cursor-pointer shadow-xs"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print</span>
            </button>

            <button
              onClick={handleExportExcel}
              className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs px-3 py-2 rounded-xl transition cursor-pointer"
              title="Export to Excel"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">Excel</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Report Canvas */}
        <div className="p-6 overflow-y-auto bg-slate-100 flex-1">
          <div
            ref={reportRef}
            id="printable-embassy-pending-report"
            className="bg-white p-6 rounded-xl border border-slate-300 shadow-sm space-y-4 text-slate-900 font-sans"
            style={{ minWidth: '920px' }}
          >
            {/* Header Title */}
            <div className="text-center pb-3 border-b border-slate-200 space-y-1">
              <h2 className="text-lg font-black text-slate-900 uppercase tracking-wide font-serif">
                TRANS ARABIAN RECRUITMENT AGENCY
              </h2>
              <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                EMBASSY PENDING SE NUMBERS SUB-TOTAL REPORT
              </p>
              <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono pt-1">
                <span>Total Registered SE Groups: {groupedSeReport.length}</span>
                <span>Grand Total Persons: {grandTotalPersons}</span>
                <span>Generated Date: {new Date().toLocaleDateString('en-GB')}</span>
              </div>
            </div>

            {/* Official Report Table */}
            <table className="w-full text-xs text-left border-collapse border border-slate-700">
              <thead>
                <tr className="bg-[#1e293b] text-white font-extrabold uppercase text-[11px] border-b-2 border-slate-700">
                  <th className="p-2.5 w-12 text-center font-mono border-r border-slate-600">NO</th>
                  <th className="p-2.5 border-r border-slate-600 min-w-[200px]">NAME</th>
                  <th className="p-2.5 font-mono border-r border-slate-600 min-w-[130px]">PASSPORT NO</th>
                  <th className="p-2.5 font-mono border-r border-slate-600 min-w-[130px]">SE NUMBER</th>
                  <th className="p-2.5 border-r border-slate-600 min-w-[180px]">COMPANY NAME</th>
                  <th className="p-2.5 font-mono text-center border-r border-slate-600 min-w-[140px]">EMBASSY APPLIED DATE</th>
                  <th className="p-2.5 font-mono min-w-[160px]">E NUMBER</th>
                </tr>
              </thead>
              <tbody>
                {groupedSeReport.map((group) => (
                  <React.Fragment key={group.se_group}>
                    {/* Candidate Rows */}
                    {group.rows.map((row) => (
                      <tr key={row.id} className="border-b border-slate-300 text-slate-900 hover:bg-slate-50">
                        <td className="p-2 text-center font-mono font-bold text-slate-600 border-r border-slate-300">
                          {row.serial_no}
                        </td>
                        <td className="p-2 font-bold text-slate-900 border-r border-slate-300 uppercase whitespace-nowrap">
                          {row.full_name}
                        </td>
                        <td className="p-2 font-mono font-bold text-slate-800 border-r border-slate-300 whitespace-nowrap">
                          {row.passport_number}
                        </td>
                        <td className="p-2 font-mono font-extrabold text-slate-900 border-r border-slate-300 whitespace-nowrap">
                          {row.se_number}
                        </td>
                        <td className="p-2 font-semibold text-slate-800 border-r border-slate-300 whitespace-nowrap">
                          {row.company_name}
                        </td>
                        <td className="p-2 font-mono text-center text-slate-700 border-r border-slate-300 whitespace-nowrap">
                          {row.embassy_applied_date}
                        </td>
                        <td className="p-2 font-mono font-bold text-slate-900 whitespace-nowrap">
                          {row.e_number || ''}
                        </td>
                      </tr>
                    ))}

                    {/* MERGED SE SUBTOTAL ROW (Exact requirement: NO, NAME, PASSPORT NO merged + SE NUMBER, COMPANY NAME merged) */}
                    <tr className="bg-[#e0e7ff] text-slate-950 font-black border-y-2 border-indigo-400">
                      {/* Merged Column 1: NO, NAME, PASSPORT NO (colSpan 3) with text in the middle */}
                      <td
                        colSpan={3}
                        className="p-2.5 text-center font-black text-slate-950 tracking-wider text-xs border-r border-indigo-300 uppercase"
                      >
                        {group.se_group} TOTAL PERSONS
                      </td>
                      {/* Merged Column 2: SE NUMBER, COMPANY NAME (colSpan 2) with total count in the middle */}
                      <td
                        colSpan={2}
                        className="p-2.5 text-center font-mono font-black text-indigo-950 text-xs border-r border-indigo-300"
                      >
                        {group.total}
                      </td>
                      {/* Merged Column 3: EMBASSY APPLIED DATE, E NUMBER (colSpan 2) styled empty */}
                      <td
                        colSpan={2}
                        className="p-2.5 bg-[#e0e7ff]"
                      ></td>
                    </tr>
                  </React.Fragment>
                ))}

                {/* MERGED GRAND TOTAL PERSONS ROW */}
                <tr className="bg-[#fef3c7] text-slate-950 font-black border-t-2 border-amber-500">
                  {/* Merged Column 1: NO, NAME, PASSPORT NO (colSpan 3) with text in the middle */}
                  <td
                    colSpan={3}
                    className="p-3 text-center font-black text-amber-950 tracking-wider text-xs border-r border-amber-400 uppercase"
                  >
                    GRAND TOTAL PERSONS
                  </td>
                  {/* Merged Column 2: SE NUMBER, COMPANY NAME (colSpan 2) with grand total count in the middle */}
                  <td
                    colSpan={2}
                    className="p-3 text-center font-mono font-black text-amber-950 text-sm border-r border-amber-400"
                  >
                    {grandTotalPersons}
                  </td>
                  {/* Merged Column 3: EMBASSY APPLIED DATE, E NUMBER (colSpan 2) styled empty */}
                  <td
                    colSpan={2}
                    className="p-3 bg-[#fef3c7]"
                  ></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer info */}
        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500 shrink-0 print:hidden">
          <span>
            Trans Arabian Agency · Official Embassy Submission Roster Matrix ({grandTotalPersons} Candidates)
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
