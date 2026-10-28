import React, { useMemo, useState } from 'react';
import jsPDF from 'jspdf';
import type { ApplicantOverview, CVApplicationSummary } from '../types';

interface Props {
  mode: 'created' | 'pending';
  applicants: ApplicantOverview[];
  applications: CVApplicationSummary[];
  onOpenApplication: (id: string) => void;
  onCreateForCandidate: (id: string) => void;
}

export function ApplicationStatusTables({ mode, applicants, applications, onOpenApplication, onCreateForCandidate }: Props) {
  const [query, setQuery] = useState('');
  const linkedIds = useMemo(() => new Set(applications.map(item => item.applicant_id).filter(Boolean)), [applications]);
  const created = applications.filter(item => [item.name, item.passportNo, item.application_id, applicants.find(a => a.applicant_id === item.applicant_id)?.registration_number].some(v => (v || '').toLowerCase().includes(query.toLowerCase())));
  const pending = applicants.filter(item => !linkedIds.has(item.applicant_id) && [item.full_name, item.registration_number, item.passport_number, item.mobile_number].some(v => (v || '').toLowerCase().includes(query.toLowerCase())));
  const rows = mode === 'created' ? created : pending;

  const downloadPdf = () => {
    const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
    const heading = mode === 'created' ? 'Application created applicants' : 'Application creation pending applicants';
    let y = 34;
    const header = () => {
      pdf.setFontSize(15); pdf.setFont('helvetica', 'bold'); pdf.text(heading, 14, 18);
      pdf.setFontSize(9); pdf.setFont('helvetica', 'normal'); pdf.text(`Generated ${new Date().toLocaleDateString()}  |  ${rows.length} record(s)`, 14, 25);
      pdf.setDrawColor(180); pdf.line(14, 29, 196, 29);
      pdf.setFont('helvetica', 'bold');
      pdf.text('No.', 14, 34); pdf.text('Name', 27, 34); pdf.text('Registry / Passport', 103, 34); pdf.text('Updated / Status', 161, 34);
      pdf.setFont('helvetica', 'normal'); y = 41;
    };
    header();
    rows.forEach((row, index) => {
      if (y > 276) { pdf.addPage(); header(); }
      const name = mode === 'created' ? (row as CVApplicationSummary).name : (row as ApplicantOverview).full_name;
      const ref = mode === 'created' ? ((row as CVApplicationSummary).passportNo || (row as CVApplicationSummary).applicant_id || 'Unlinked') : (row as ApplicantOverview).registration_number;
      const status = mode === 'created' ? new Date((row as CVApplicationSummary).updated_at).toLocaleDateString() : 'Pending';
      pdf.setFontSize(8);
      pdf.text(String(index + 1), 14, y);
      pdf.text(pdf.splitTextToSize(name || 'Unnamed', 70)[0] || '', 27, y);
      pdf.text(pdf.splitTextToSize(ref || '-', 55)[0] || '', 103, y);
      pdf.text(status, 161, y);
      pdf.setDrawColor(228); pdf.line(14, y + 2, 196, y + 2);
      y += 8;
    });
    if (!rows.length) pdf.text('No matching records.', 14, 45);
    pdf.save(mode === 'created' ? 'application-created-applicants.pdf' : 'application-creation-pending-applicants.pdf');
  };

  return <section className="min-h-0 flex-1 overflow-auto bg-slate-50 p-5 text-slate-900" aria-label={mode === 'created' ? 'Application created applicants' : 'Application creation pending applicants'}>
    <div className="mx-auto max-w-6xl rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="text-lg font-bold">{mode === 'created' ? 'Application created applicants' : 'Application creation pending applicants'}</h2><p className="text-xs text-slate-500">{rows.length} matching record(s) · Applications are saved in the system database.</p></div>
        <button type="button" onClick={downloadPdf} className="rounded-lg bg-emerald-700 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-600">Download table PDF</button>
      </div>
      <input aria-label="Search table" placeholder="Search name, registration or passport..." value={query} onChange={e => setQuery(e.target.value)} className="mb-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-600" />
      <div className="overflow-x-auto"><table className="w-full min-w-[650px] text-left text-xs"><thead className="bg-slate-100 text-slate-600"><tr><th className="p-3">#</th><th className="p-3">Candidate</th><th className="p-3">Registry / Passport</th><th className="p-3">{mode === 'created' ? 'Last updated' : 'Status'}</th><th className="p-3">Action</th></tr></thead><tbody>
        {mode === 'created' ? created.map((item, index) => <tr key={item.application_id} className="border-b border-slate-100"><td className="p-3">{index + 1}</td><td className="p-3 font-semibold">{item.name || 'Unnamed'}</td><td className="p-3">{item.passportNo || item.applicant_id || 'Unlinked'}</td><td className="p-3">{new Date(item.updated_at).toLocaleString()}</td><td className="p-3"><button type="button" onClick={() => onOpenApplication(item.application_id)} className="font-bold text-emerald-700 hover:underline">Open application</button></td></tr>) : pending.map((item, index) => <tr key={item.applicant_id} className="border-b border-slate-100"><td className="p-3">{index + 1}</td><td className="p-3 font-semibold">{item.full_name}</td><td className="p-3">{item.registration_number || item.applicant_id}</td><td className="p-3"><span className="rounded-full bg-amber-100 px-2 py-1 text-amber-800">Pending</span></td><td className="p-3"><button type="button" onClick={() => onCreateForCandidate(item.applicant_id)} className="font-bold text-emerald-700 hover:underline">Create application</button></td></tr>)}
        {rows.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-slate-500">No matching applicants.</td></tr>}
      </tbody></table></div>
    </div>
  </section>;
}
