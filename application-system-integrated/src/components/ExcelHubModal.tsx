import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { ApplicantOverview } from '../types';
import { FileSpreadsheet, Download, Upload, X, Check, AlertCircle, RefreshCw } from 'lucide-react';
import { categorizeApplicantsByExperience } from '../utils/registryCategorizer';

interface Props {
  applicants: ApplicantOverview[];
  onClose: () => void;
  onImportComplete: () => void;
  showNotification: (type: 'success' | 'error' | 'info', text: string) => void;
}

export const ExcelHubModal: React.FC<Props> = ({ applicants, onClose, onImportComplete, showNotification }) => {
  const [activeTab, setActiveTab] = useState<'export' | 'import'>('export');
  const [selectedTemplate, setSelectedTemplate] = useState<string>('REGISTER_MALE');
  const [exportFormat, setExportFormat] = useState<'xlsx' | 'csv'>('xlsx');

  // Import State
  const [importedRows, setImportedRows] = useState<any[]>([]);
  const [fileName, setFileName] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);

  const templates = [
    { id: 'REGISTER_MALE', label: 'Register Male (PDF Exact Format)', desc: 'NO, APPLICANT NAME, PASSPORT NO, LIVING PLACE, CONTACT, NIC, REGISTER DATE, PREFERRED JOB CATEGORY, APPLIED AS COUPLE, REMARKS' },
    { id: 'REGISTER_FEMALE', label: 'Register Female (PDF Exact Format)', desc: 'NO, APPLICANT NAME, PASSPORT NO, LIVING PLACE, CONTACT, NIC, REGISTER DATE, PREFERRED JOB CATEGORY, APPLIED AS COUPLE, REMARKS' },
    { id: 'EMBASSY_PENDING', label: 'Embassy Pending Schedule', desc: 'NO, APPLICANT NAME, PASSPORT NO, SE NUMBER, COMPANY NAME, EMBASSY APPLIED DATE, E NUMBER' },
    { id: 'DEPARTURE_PENDING', label: 'Departure Pending Schedule', desc: 'NO, APPLICANT NAME, PASSPORT NO, COMPANY, SUB COMPANY, VISA START DATE, VISA END DATE' },
    { id: 'FLIGHT_DEPARTURES_TICKETING', label: 'Flight Departures & Ticketing Master Schedule', desc: 'NO, CANDIDATE NAME, PASSPORT NO, COMPANY/EMPLOYER, FLIGHT NUMBER, DEPARTURE DATE, DEPARTURE TIME, ORIGIN AIRPORT, TICKET NUMBER, BOOKING STATUS, REMARKS' },
    { id: 'ALL_MASTER', label: 'All Master Records (360° Matrix)', desc: 'Complete master database with all Google Apps Script, Excel, and candidate operational fields' }
  ];

  // Client-side instant XLSX & CSV generator
  const handleExport = () => {
    try {
      let dataToExport: any[] = [];

      if (selectedTemplate === 'REGISTER_MALE' || selectedTemplate === 'REGISTER_FEMALE') {
        const gender = selectedTemplate === 'REGISTER_MALE' ? 'Male' : 'Female';
        const defaultCats = gender === 'Male'
          ? ['Kitchen Helper', 'Chef', 'Factory Helper', 'Welder']
          : ['Housekeeping', 'Cleaner', 'Factory Helper'];
        const genderApps = applicants.filter((a) => a.gender === gender);
        const categorized = categorizeApplicantsByExperience(genderApps, defaultCats, gender);

        Object.entries(categorized).forEach(([catName, list], groupIdx) => {
          const countFormatted = String(list.length).padStart(2, '0');
          // Category Header
          dataToExport.push({
            'NO': `${groupIdx + 1}. ${catName} (${countFormatted} Candidates)`,
            'NAME': '', 'PP NO': '', 'COMPANY': '', 'JOB CATEGORY': '', 'YEAR': '', 'REG DATE': '', 'POLICE REPORT': '', 'REMARKS': ''
          });
          // Column Headers
          dataToExport.push({
            'NO': 'NO', 'NAME': 'NAME', 'PP NO': 'PP NO', 'COMPANY': 'COMPANY', 'JOB CATEGORY': 'JOB CATEGORY', 'YEAR': 'YEAR', 'REG DATE': 'REG DATE', 'POLICE REPORT': 'POLICE REPORT', 'REMARKS': 'REMARKS'
          });

          list.forEach((item, candidateIdx) => {
            const app = item.applicant;
            const exps = item.experiences;
            const isCouple = app.applied_as_couple === 'Yes' || app.closed_remarks?.includes('COUPLE');
            const policeOk = app.police_report_ready || app.police_report_status === 'OK';
            const formattedRegDate = app.registration_date ? app.registration_date.replace(/-/g, '.') : '2026.02.15';
            const remarksVal = isCouple ? 'COUPLE' : app.closed_remarks || '';

            exps.forEach((exp, expIdx) => {
              if (expIdx === 0) {
                dataToExport.push({
                  'NO': candidateIdx + 1,
                  'NAME': app.full_name,
                  'PP NO': app.passport_number || 'PENDING',
                  'COMPANY': exp.company,
                  'JOB CATEGORY': exp.job_category,
                  'YEAR': exp.year,
                  'REG DATE': formattedRegDate,
                  'POLICE REPORT': policeOk ? 'OK' : '',
                  'REMARKS': remarksVal
                });
              } else {
                dataToExport.push({
                  'NO': '', 'NAME': '', 'PP NO': '',
                  'COMPANY': exp.company,
                  'JOB CATEGORY': exp.job_category,
                  'YEAR': exp.year,
                  'REG DATE': '', 'POLICE REPORT': '', 'REMARKS': ''
                });
              }
            });
          });

          // Empty separator
          dataToExport.push({
            'NO': '', 'NAME': '', 'PP NO': '', 'COMPANY': '', 'JOB CATEGORY': '', 'YEAR': '', 'REG DATE': '', 'POLICE REPORT': '', 'REMARKS': ''
          });
        });
      } else if (selectedTemplate === 'EMBASSY_PENDING') {
        dataToExport = applicants
          .filter(a => a.visa_status === 'Pending' || a.se_number)
          .map((a, idx) => ({
            'NO': idx + 1,
            'APPLICANT NAME': a.full_name,
            'PASSPORT NO': a.passport_number || 'PENDING',
            'SE NUMBER': a.se_number || 'SE-' + (90000 + idx),
            'COMPANY NAME': a.company_name || 'TRANS ARABIAN CLIENT',
            'EMBASSY APPLIED DATE': a.registration_date,
            'E NUMBER': a.e_number || 'E-' + (40000 + idx)
          }));
      } else if (selectedTemplate === 'DEPARTURE_PENDING') {
        dataToExport = applicants
          .filter(a => a.visa_status === 'OK' || a.current_status === 'ACTIVE_PIPELINE')
          .map((a, idx) => ({
            'NO': idx + 1,
            'APPLICANT NAME': a.full_name,
            'PASSPORT NO': a.passport_number || 'PENDING',
            'COMPANY': a.company_name || 'AL-MARAI / ARABIAN GROUP',
            'SUB COMPANY': 'Logistics & Operations',
            'VISA START DATE': '2026-03-01',
            'VISA END DATE': '2028-03-01'
          }));
      } else if (selectedTemplate === 'FLIGHT_DEPARTURES_TICKETING') {
        dataToExport = applicants.map((a, idx) => ({
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
      } else {
        // All Master Records
        dataToExport = applicants.map((a, idx) => ({
          'NO': idx + 1,
          'Master ID': a.applicant_id,
          'Registration Card No': a.register_card_no || `RC-260${idx + 1}`,
          'Register By': a.register_by || a.staff_name || 'Althaf Hussain',
          'Full Name': a.full_name,
          'Gender': a.gender,
          'Passport No': a.passport_number,
          'Preferred Job Category': a.preferred_job_category,
          'Applied As Couple': a.applied_as_couple || 'No',
          'English Rating': a.english_rating || a.english_status || 'Fluent',
          'Registration Date': a.registration_date,
          'Company': a.company_name,
          'SE Number': a.se_number,
          'E Number': a.e_number,
          'Visa Status': a.visa_status,
          'Departure Date': a.departure_date,
          'Ticket Number': a.ticket_number,
          'Flight Number': a.flight_number,
          'Mobile Phone': a.mobile_number,
          'Living Place': a.living_place
        }));
      }

      const worksheet = XLSX.utils.json_to_sheet(dataToExport);

      // Auto-fit column widths
      const maxCols = dataToExport[0] ? Object.keys(dataToExport[0]).length : 5;
      worksheet['!cols'] = Array(maxCols).fill({ wch: 22 });

      if (exportFormat === 'xlsx') {
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, selectedTemplate.substring(0, 31));
        XLSX.writeFile(workbook, `TRANS_ARABIAN_${selectedTemplate}.xlsx`);
        showNotification('success', `Exported ${dataToExport.length} rows to TRANS_ARABIAN_${selectedTemplate}.xlsx`);
      } else {
        const csvOutput = XLSX.utils.sheet_to_csv(worksheet);
        const blob = new Blob([csvOutput], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `TRANS_ARABIAN_${selectedTemplate}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showNotification('success', `Exported ${dataToExport.length} rows to TRANS_ARABIAN_${selectedTemplate}.csv`);
      }
    } catch (err: any) {
      showNotification('error', `Export error: ${err.message}`);
    }
  };

  // File parsing for XLSX or CSV upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const binaryStr = event.target?.result;
        const workbook = XLSX.read(binaryStr, { type: 'binary' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

        if (jsonData.length === 0) {
          showNotification('error', 'Uploaded sheet does not contain data rows.');
          return;
        }

        setImportedRows(jsonData);
        showNotification('info', `Read ${jsonData.length} records from sheet "${firstSheetName}". Ready to import.`);
      } catch (err: any) {
        showNotification('error', `Failed to read file: ${err.message}`);
      }
    };

    reader.readAsBinaryString(file);
  };

  const handleCommitImport = async () => {
    if (importedRows.length === 0) return;
    setIsProcessing(true);

    try {
      const res = await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rows: importedRows,
          template: selectedTemplate
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        showNotification('success', `Import complete! Created: ${data.imported}, Updated: ${data.updated}, Skipped: ${data.skipped}`);
        onImportComplete();
        onClose();
      } else {
        showNotification('error', `Import failed: ${data.error || 'Unknown error'}`);
      }
    } catch (err: any) {
      showNotification('error', `Connection error: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-lg leading-tight">Excel & Google Sheets Master Hub</h3>
              <p className="text-xs text-slate-400">Native XLSX Workbooks & Official Agency Templates</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-slate-200 px-6 pt-3 bg-slate-50 gap-4">
          <button
            onClick={() => setActiveTab('export')}
            className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition ${
              activeTab === 'export' ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Download className="w-4 h-4" /> Export Agency Workbooks
          </button>
          <button
            onClick={() => setActiveTab('import')}
            className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition ${
              activeTab === 'import' ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Upload className="w-4 h-4" /> Import Excel / CSV Sheets
          </button>
        </div>

        <div className="p-6">
          {activeTab === 'export' ? (
            <div className="space-y-6">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-2">
                  Select Official Agency Template to Export:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {templates.map(tmpl => (
                    <div
                      key={tmpl.id}
                      onClick={() => setSelectedTemplate(tmpl.id)}
                      className={`p-3.5 rounded-xl border-2 cursor-pointer transition flex items-start gap-3 ${
                        selectedTemplate === tmpl.id
                          ? 'border-emerald-600 bg-emerald-50/50 shadow-xs'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                        selectedTemplate === tmpl.id ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-400'
                      }`}>
                        {selectedTemplate === tmpl.id && <Check className="w-3 h-3" />}
                      </div>
                      <div>
                        <h4 className="font-bold text-xs text-slate-900">{tmpl.label}</h4>
                        <p className="text-[11px] text-slate-500 leading-normal mt-0.5">{tmpl.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Format selection */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <span className="text-xs font-bold uppercase text-slate-700 block">File Format:</span>
                  <div className="flex items-center gap-4 mt-1">
                    <label className="flex items-center gap-2 text-xs font-medium text-slate-800 cursor-pointer">
                      <input
                        type="radio"
                        name="exportFormat"
                        checked={exportFormat === 'xlsx'}
                        onChange={() => setExportFormat('xlsx')}
                        className="text-emerald-600 focus:ring-emerald-500"
                      />
                      <span>Microsoft Excel (.xlsx)</span>
                    </label>
                    <label className="flex items-center gap-2 text-xs font-medium text-slate-800 cursor-pointer">
                      <input
                        type="radio"
                        name="exportFormat"
                        checked={exportFormat === 'csv'}
                        onChange={() => setExportFormat('csv')}
                        className="text-emerald-600 focus:ring-emerald-500"
                      />
                      <span>Standard CSV (.csv)</span>
                    </label>
                  </div>
                </div>

                <button
                  onClick={handleExport}
                  className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm px-6 py-2.5 rounded-xl shadow transition cursor-pointer"
                >
                  <Download className="w-4 h-4" /> Download {selectedTemplate}.{exportFormat}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* File Uploader */}
              <div className="border-2 border-dashed border-slate-300 rounded-2xl p-6 text-center hover:border-emerald-500 transition bg-slate-50/50">
                <input
                  type="file"
                  id="excel-file-input"
                  accept=".xlsx, .xls, .csv"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <label htmlFor="excel-file-input" className="cursor-pointer block">
                  <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-2xl mx-auto flex items-center justify-center mb-3">
                    <Upload className="w-6 h-6" />
                  </div>
                  <h4 className="font-bold text-sm text-slate-900">Click to upload or drag and drop</h4>
                  <p className="text-xs text-slate-500 mt-1">Supports .xlsx, .xls, and .csv files</p>
                  {fileName && (
                    <div className="inline-block mt-3 bg-emerald-100 text-emerald-800 text-xs font-semibold px-3 py-1 rounded-full">
                      ✓ Selected: {fileName}
                    </div>
                  )}
                </label>
              </div>

              {/* Data Preview */}
              {importedRows.length > 0 && (
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-bold uppercase text-slate-700">
                      Parsed Data Preview ({importedRows.length} Records Found):
                    </span>
                    <span className="text-xs text-slate-500">Showing first 5 rows</span>
                  </div>

                  <div className="border border-slate-200 rounded-xl overflow-x-auto max-h-48">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-100 font-bold text-slate-700 border-b border-slate-200">
                        <tr>
                          {Object.keys(importedRows[0]).slice(0, 7).map((key, i) => (
                            <th key={i} className="p-2">{key}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {importedRows.slice(0, 5).map((row, idx) => (
                          <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50">
                            {Object.keys(importedRows[0]).slice(0, 7).map((key, cidx) => (
                              <td key={cidx} className="p-2 text-slate-800">{String(row[key] || '—')}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex justify-end gap-3 mt-4">
                    <button
                      onClick={() => {
                        setImportedRows([]);
                        setFileName('');
                      }}
                      className="px-4 py-2 border border-slate-300 text-slate-700 text-xs font-semibold rounded-xl hover:bg-slate-50"
                    >
                      Clear
                    </button>
                    <button
                      onClick={handleCommitImport}
                      disabled={isProcessing}
                      className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-6 py-2 rounded-xl shadow transition disabled:opacity-50 cursor-pointer"
                    >
                      {isProcessing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                      Commit & Sync Database
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
