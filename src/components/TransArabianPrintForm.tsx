import React, { useRef } from 'react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { ApplicantFullDetails } from '../types';
import { Printer, X, Image as ImageIcon, Download } from 'lucide-react';
import companyLogo from '../assets/images/trans_arabian_logo_1790581026074.jpg';

// Pure HTML/SVG permanent version of the Trans Arabian official logo (Globe with Airplane and "L. No: 1422")
export const PermanentLogo: React.FC<{ className?: string }> = ({ className = "w-[125px] h-[125px]" }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    viewBox="0 0 400 520" 
    width="125"
    height="125"
    className={className}
    style={{ display: 'block', margin: 'auto' }}
  >
    {/* Stand & Base */}
    <g fill="none" stroke="#800020" strokeWidth="11" strokeLinecap="round" strokeLinejoin="round">
      {/* Meridian arc behind globe */}
      <path d="M 200 40 C 315 40 375 140 375 220 C 375 320 280 400 170 400 C 130 400 95 385 85 365 C 70 335 90 410 110 440" />
      <path d="M 105 435 C 100 448 115 465 140 468" />
    </g>
    {/* Oval base */}
    <path d="M 65 470 C 65 445 335 445 335 470 C 335 485 65 485 65 470 Z" fill="#800020" />
    
    {/* Outer Globe Ring */}
    <circle cx="200" cy="220" r="165" fill="none" stroke="#800020" strokeWidth="12" />
    <circle cx="200" cy="220" r="150" fill="#ffffff" stroke="#800020" strokeWidth="4" />

    {/* Latitude / Longitude grid lines */}
    {/* Horizontal parallels */}
    <ellipse cx="200" cy="150" rx="130" ry="35" fill="none" stroke="#800020" strokeWidth="3.5" />
    <ellipse cx="200" cy="220" rx="150" ry="40" fill="none" stroke="#800020" strokeWidth="4" />
    <ellipse cx="200" cy="290" rx="130" ry="35" fill="none" stroke="#800020" strokeWidth="3.5" />
    
    {/* Vertical meridians */}
    <ellipse cx="200" cy="220" rx="55" ry="150" fill="none" stroke="#800020" strokeWidth="4" />
    <ellipse cx="200" cy="220" rx="105" ry="150" fill="none" stroke="#800020" strokeWidth="3.5" />
    <line x1="200" y1="70" x2="200" y2="370" stroke="#800020" strokeWidth="3.5" />

    {/* Airplane Silhouette tilted at ~42 deg */}
    <g transform="translate(200, 215) rotate(-42)" fill="#800020" stroke="#800020" strokeWidth="1">
      {/* Fuselage */}
      <path d="M 0 -115 C 10 -100 13 -70 13 40 C 13 85 9 110 0 118 C -9 110 -13 85 -13 40 C -13 -70 -10 -100 0 -115 Z" />
      {/* Nose cone */}
      <path d="M 0 -125 C 8 -118 8 -110 0 -105 C -8 -110 -8 -118 0 -125 Z" />
      {/* Main Wings */}
      <path d="M 10 -25 L 115 35 C 120 38 118 48 108 48 L 12 25 L 12 60 L 45 85 C 48 88 45 94 38 94 L 0 88 L -38 94 C -45 94 -48 88 -45 85 L -12 60 L -12 25 L -108 48 C -118 48 -120 38 -115 35 L -10 -25 Z" />
      {/* Jet Engines */}
      <rect x="35" y="10" width="8" height="22" rx="4" />
      <rect x="-43" y="10" width="8" height="22" rx="4" />
    </g>

    {/* L. No: 1422 Text at bottom */}
    <text x="200" y="515" textAnchor="middle" fontFamily="'Times New Roman', Times, serif" fontSize="34" fontWeight="bold" fill="#800020" letterSpacing="1">L. No: 1422</text>
  </svg>
);

interface Props {
  data: ApplicantFullDetails;
  onClose: () => void;
}

export const TransArabianPrintForm: React.FC<Props> = ({ data, onClose }) => {
  const { profile, passport, education, experiences } = data;
  const printAreaRef = useRef<HTMLDivElement>(null);
  const logoPreview = localStorage.getItem('trans_arabian_agency_logo') || '';

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = async () => {
    const el = printAreaRef.current;
    if (!el) return;

    try {
      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false
      });
      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');
      const safeName = (profile.surname || profile.full_name || 'Candidate').replace(/[^a-zA-Z0-9]/g, '_');
      const safeId = (profile.applicant_id || 'ID').replace(/[^a-zA-Z0-9]/g, '_');
      pdf.save(`TransArabian_Form_${safeName}_${safeId}.pdf`);
    } catch (err) {
      console.error('PDF download error:', err);
    }
  };

  const handleDownloadJpeg = async () => {
    const el = printAreaRef.current;
    if (!el) return;

    try {
      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false
      });
      const link = document.createElement('a');
      const safeName = (profile.surname || profile.full_name || 'Candidate').replace(/[^a-zA-Z0-9]/g, '_');
      const safeId = (profile.applicant_id || 'ID').replace(/[^a-zA-Z0-9]/g, '_');
      link.download = `TransArabian_Form_${safeName}_${safeId}.jpg`;
      link.href = canvas.toDataURL('image/jpeg', 0.95);
      link.click();
    } catch (err) {
      console.error('JPEG download error:', err);
    }
  };

  // Format date helper
  const formatDateDisplay = (dStr?: string) => {
    if (!dStr) return '—';
    if (dStr.includes('/')) return dStr;
    if (dStr.includes('-')) {
      const parts = dStr.split('-');
      if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
    }
    return dStr;
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-2 sm:p-4 overflow-y-auto print:p-0 print:bg-white print:static print:inset-auto">
      {/* Control Bar (hidden on print) */}
      <div className="fixed top-3 right-4 z-50 flex items-center gap-2 no-print bg-slate-900/90 text-white px-4 py-2 rounded-xl shadow-2xl backdrop-blur-md border border-slate-700">
        <button
          onClick={handleDownloadJpeg}
          className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition shadow cursor-pointer"
        >
          <ImageIcon className="w-4 h-4" /> Download JPEG
        </button>
        <button
          onClick={handleDownloadPdf}
          className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition shadow cursor-pointer"
        >
          <Download className="w-4 h-4" /> Download PDF
        </button>
        <button
          onClick={handlePrint}
          className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition shadow cursor-pointer"
        >
          <Printer className="w-4 h-4" /> Print Form
        </button>
        <button
          onClick={onClose}
          className="flex items-center gap-1 bg-slate-700 hover:bg-slate-600 text-white text-xs px-2.5 py-1.5 rounded-lg transition cursor-pointer"
        >
          <X className="w-4 h-4" /> Close
        </button>
      </div>

      {/* Printable Document A4 Area */}
      <div
        ref={printAreaRef}
        id="formArea"
        className="bg-white text-[#800020] w-[210mm] min-h-[297mm] p-[10mm] shadow-2xl rounded-sm print:shadow-none print:p-0 print:w-[210mm] print:h-[297mm] flex flex-col font-serif my-auto"
        style={{
          fontFamily: '"Times New Roman", Times, serif'
        }}
      >
        {/* Double Maroon Border Frame */}
        <div className="h-full border-[8px] border-double border-[#800020] p-3 flex flex-col flex-1">
          {/* Header */}
          <div className="flex justify-between items-center border-b-2 border-[#800020] pb-2 mb-1.5">
            <div className="w-[140px] h-[140px] flex items-center justify-center shrink-0">
              {logoPreview ? (
                <img
                  id="logoImg"
                  src={logoPreview}
                  alt="TRANS ARABIAN LOGO"
                  className="max-w-full max-h-full w-auto h-auto object-contain block m-auto"
                  crossOrigin="anonymous"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = '/company_logo.png';
                  }}
                />
              ) : (
                <PermanentLogo className="w-[125px] h-[125px]" />
              )}
            </div>

            <div className="text-center flex-1 px-3">
              <h1 className="text-[28px] font-black text-[#800020] uppercase tracking-wide m-0 leading-tight">
                TRANS ARABIAN (PVT) LTD
              </h1>
              <p className="text-[12px] font-bold text-[#800020] m-0 mt-1">
                No. 69/2, Chilaw Road, Wennappuwa, Sri Lanka
              </p>
              <p className="text-[11px] font-bold text-[#800020] m-0">
                Tel: +94312255833 | +94777906905 | +94768584292
              </p>
              <p className="text-[11px] font-bold text-[#800020] m-0">
                E-mail: transarabian@yahoo.com
              </p>
            </div>

            <div className="w-[35mm] h-[45mm] border-2 border-[#800020] bg-slate-50 flex flex-col items-center justify-center relative overflow-hidden shrink-0">
              {profile.applicant_photo ? (
                <img
                  src={profile.applicant_photo}
                  alt={profile.full_name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="flex flex-col items-center justify-center text-center p-1 text-[#800020]">
                  <span className="text-[10px] font-bold uppercase leading-tight">PHOTO</span>
                  <span className="text-[8px] opacity-70">35mm x 45mm</span>
                </div>
              )}
            </div>
          </div>

          <div className="text-center text-[#800020] text-[16px] font-bold underline my-1 tracking-wider uppercase">
            APPLICATION FROM
          </div>

          {/* Top Meta Table */}
          <table className="w-full border-collapse mb-1 table-fixed border-2 border-[#800020] text-[11px]">
            <tbody>
              <tr>
                <td className="border-2 border-[#800020] px-1.5 py-0.5 font-bold w-[12%] text-[#800020]">
                  Ref no
                </td>
                <td className="border-2 border-[#800020] px-1.5 py-0.5 w-[38%] font-semibold">
                  {profile.ref_no || profile.registration_number || profile.applicant_id}
                </td>
                <td className="border-2 border-[#800020] px-1.5 py-0.5 font-bold w-[10%] text-[#800020]">
                  post
                </td>
                <td className="border-2 border-[#800020] px-1.5 py-0.5 w-[20%] font-bold uppercase">
                  {profile.post || profile.preferred_job_category}
                </td>
                <td className="border-2 border-[#800020] px-1.5 py-0.5 w-[10%] text-center font-bold text-[#800020]">
                  male {profile.gender === 'Male' ? '☑' : '☐'}
                </td>
                <td className="border-2 border-[#800020] px-1.5 py-0.5 w-[10%] text-center font-bold text-[#800020]">
                  female {profile.gender === 'Female' ? '☑' : '☐'}
                </td>
              </tr>
            </tbody>
          </table>

          {/* PERSONAL DETAILS */}
          <table className="w-full border-collapse mb-1 table-fixed border-2 border-[#800020] text-[11px]">
            <tbody>
              <tr>
                <td
                  colSpan={6}
                  className="border-2 border-[#800020] px-1 py-0.5 text-center font-black uppercase text-[11.5px] bg-[#faf5f6] text-[#800020]"
                >
                  PERSONAL DETAILS
                </td>
              </tr>
              <tr>
                <td className="border-2 border-[#800020] px-1.5 py-0.5 font-bold w-[22%] text-[#800020]">
                  Surname
                </td>
                <td colSpan={5} className="border-2 border-[#800020] px-1.5 py-0.5 font-bold uppercase">
                  {profile.surname || profile.full_name}
                </td>
              </tr>
              <tr>
                <td className="border-2 border-[#800020] px-1.5 py-0.5 font-bold text-[#800020]">
                  Other Name
                </td>
                <td colSpan={5} className="border-2 border-[#800020] px-1.5 py-0.5 uppercase">
                  {profile.other_name || '—'}
                </td>
              </tr>
              <tr>
                <td className="border-2 border-[#800020] px-1.5 py-0.5 font-bold text-[#800020]">
                  Date Of Birth
                </td>
                <td colSpan={2} className="border-2 border-[#800020] px-1.5 py-0.5 font-medium">
                  {formatDateDisplay(profile.date_of_birth)}
                </td>
                <td className="border-2 border-[#800020] px-1.5 py-0.5 font-bold text-[#800020]">
                  Age
                </td>
                <td colSpan={2} className="border-2 border-[#800020] px-1.5 py-0.5 font-bold">
                  {profile.age || '—'}
                </td>
              </tr>
              <tr>
                <td className="border-2 border-[#800020] px-1.5 py-0.5 font-bold text-[#800020]">
                  Nationality
                </td>
                <td colSpan={2} className="border-2 border-[#800020] px-1.5 py-0.5">
                  {profile.nationality || 'Sri Lankan'}
                </td>
                <td className="border-2 border-[#800020] px-1.5 py-0.5 font-bold text-[#800020]">
                  Civil Status
                </td>
                <td colSpan={2} className="border-2 border-[#800020] px-1.5 py-0.5">
                  {profile.civil_status || 'Single'}
                </td>
              </tr>
              <tr>
                <td className="border-2 border-[#800020] px-1.5 py-0.5 font-bold text-[#800020]">
                  Religion
                </td>
                <td colSpan={2} className="border-2 border-[#800020] px-1.5 py-0.5">
                  {profile.religion || '—'}
                </td>
                <td className="border-2 border-[#800020] px-1.5 py-0.5 font-bold text-[#800020]">
                  NIC No
                </td>
                <td colSpan={2} className="border-2 border-[#800020] px-1.5 py-0.5 uppercase tracking-wider">
                  {profile.nic_number || '—'}
                </td>
              </tr>
              <tr>
                <td className="border-2 border-[#800020] px-1.5 py-0.5 font-bold text-[#800020]">
                  Address
                </td>
                <td colSpan={5} className="border-2 border-[#800020] px-1.5 py-0.5 h-[28px]">
                  {profile.address || '—'}
                </td>
              </tr>
              <tr>
                <td className="border-2 border-[#800020] px-1.5 py-0.5 font-bold text-[#800020]">
                  Mobile
                </td>
                <td colSpan={2} className="border-2 border-[#800020] px-1.5 py-0.5 font-bold">
                  {profile.mobile_number || '—'}
                </td>
                <td className="border-2 border-[#800020] px-1.5 py-0.5 font-bold text-[#800020]" rowSpan={2}>
                  Tel (Home)
                </td>
                <td colSpan={2} rowSpan={2} className="border-2 border-[#800020] px-1.5 py-0.5">
                  {profile.telephone_home || '—'}
                </td>
              </tr>
              <tr>
                <td className="border-2 border-[#800020] px-1.5 py-0.5 font-bold text-[#800020] text-[10px] whitespace-nowrap">
                  Mobile (WhatsApp)
                </td>
                <td colSpan={2} className="border-2 border-[#800020] px-1.5 py-0.5 font-bold">
                  {profile.whatsapp_number || profile.alternate_phone || profile.mobile_number || '—'}
                </td>
              </tr>
            </tbody>
          </table>

          {/* DETAILS OF PASSPORT */}
          <table className="w-full border-collapse mb-1 table-fixed border-2 border-[#800020] text-[11px]">
            <tbody>
              <tr>
                <td
                  colSpan={4}
                  className="border-2 border-[#800020] px-1 py-0.5 text-center font-black uppercase text-[11.5px] bg-[#faf5f6] text-[#800020]"
                >
                  DETAILS OF PASSPORT
                </td>
              </tr>
              <tr>
                <td className="border-2 border-[#800020] px-1.5 py-0.5 font-bold w-[22%] text-[#800020]">
                  Passport No
                </td>
                <td className="border-2 border-[#800020] px-1.5 py-0.5 w-[28%] font-black uppercase">
                  {passport?.passport_number || 'PENDING'}
                </td>
                <td className="border-2 border-[#800020] px-1.5 py-0.5 font-bold w-[22%] text-[#800020]">
                  Place Of Birth
                </td>
                <td className="border-2 border-[#800020] px-1.5 py-0.5 w-[28%]">
                  {passport?.place_of_birth || 'Colombo'}
                </td>
              </tr>
              <tr>
                <td className="border-2 border-[#800020] px-1.5 py-0.5 font-bold text-[#800020]">
                  Date Of Issue
                </td>
                <td className="border-2 border-[#800020] px-1.5 py-0.5 font-medium">
                  {formatDateDisplay(passport?.date_of_issue)}
                </td>
                <td className="border-2 border-[#800020] px-1.5 py-0.5 font-bold text-[#800020]">
                  Date Of Expiry
                </td>
                <td className="border-2 border-[#800020] px-1.5 py-0.5 font-black text-[#800020]">
                  {formatDateDisplay(passport?.date_of_expiry)}
                </td>
              </tr>
            </tbody>
          </table>

          {/* QUALIFICATIONS */}
          <table className="w-full border-collapse mb-1 table-fixed border-2 border-[#800020] text-[11px]">
            <tbody>
              <tr>
                <td
                  colSpan={6}
                  className="border-2 border-[#800020] px-1 py-0.5 text-center font-black uppercase text-[11.5px] bg-[#faf5f6] text-[#800020]"
                >
                  QUALIFICATIONS
                </td>
              </tr>
              <tr>
                <td className="border-2 border-[#800020] px-1.5 py-0.5 font-bold w-[25%] text-[#800020]">
                  Education Qualifications
                </td>
                <td colSpan={5} className="border-2 border-[#800020] px-1.5 py-0.5 font-semibold">
                  {education?.education_qualification || 'O/L Passed'}
                </td>
              </tr>
              <tr>
                <td className="border-2 border-[#800020] px-1.5 py-0.5 font-bold text-[#800020]">
                  Professional Qualifications
                </td>
                <td colSpan={5} className="border-2 border-[#800020] px-1.5 py-0.5">
                  {education?.professional_qualification || '—'}
                </td>
              </tr>
              <tr>
                <td className="border-2 border-[#800020] px-1.5 py-0.5 font-bold text-[#800020]">
                  Knowledge Of Languages
                </td>
                <td colSpan={5} className="border-2 border-[#800020] px-1.5 py-0.5">
                  <div className="flex items-center justify-between gap-4 text-[#800020]">
                    <span>English {profile.english_status !== 'Not Checked' ? '☑' : '☐'}</span>
                    <span>Arabic {education?.arabic_status && education.arabic_status !== 'None' ? '☑' : '☐'}</span>
                    <span>Other: {education?.languages?.filter((l) => l !== 'English' && l !== 'Arabic').join(', ') || 'Sinhala'}</span>
                  </div>
                </td>
              </tr>
              <tr>
                <td className="border-2 border-[#800020] px-1.5 py-0.5 font-bold text-[#800020]">
                  Driving License No
                </td>
                <td colSpan={5} className="border-2 border-[#800020] px-1.5 py-0.5">
                  <div className="flex items-center justify-between gap-2">
                    <span>{education?.driving_license_number || 'None'}</span>
                    <span>Date Of Issue: {formatDateDisplay(education?.driving_license_issue_date)}</span>
                    <span>Type: {education?.driving_license_type || '—'}</span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>

          {/* OTHER DETAILS */}
          <table className="w-full border-collapse mb-1 table-fixed border-2 border-[#800020] text-[11px]">
            <tbody>
              <tr>
                <td
                  colSpan={10}
                  className="border-2 border-[#800020] px-1 py-0.5 text-center font-black uppercase text-[11.5px] bg-[#faf5f6] text-[#800020]"
                >
                  OTHER DETAILS
                </td>
              </tr>
              <tr>
                <td className="border-2 border-[#800020] px-1 py-0.5 font-bold w-[14%] text-[#800020]">
                  Complexion
                </td>
                <td className="border-2 border-[#800020] px-1 py-0.5 w-[12%]">
                  {profile.complexion || '—'}
                </td>
                <td className="border-2 border-[#800020] px-1 py-0.5 font-bold w-[11%] text-[#800020]">
                  Weight (Kg)
                </td>
                <td className="border-2 border-[#800020] px-1 py-0.5 w-[11%] font-semibold">
                  {profile.weight || '—'}
                </td>
                <td className="border-2 border-[#800020] px-1 py-0.5 font-bold w-[10%] text-[#800020]">
                  Height (ft)
                </td>
                <td className="border-2 border-[#800020] px-1 py-0.5 w-[11%] font-semibold">
                  {profile.height || '—'}
                </td>
                <td className="border-2 border-[#800020] px-1 py-0.5 font-bold w-[14%] text-[#800020]">
                  No Children
                </td>
                <td className="border-2 border-[#800020] px-1 py-0.5 w-[7%]">
                  {profile.children_count || '0'}
                </td>
                <td className="border-2 border-[#800020] px-1 py-0.5 font-bold w-[5%] text-[#800020]">
                  Ages
                </td>
                <td className="border-2 border-[#800020] px-1 py-0.5 w-[15%]">
                  {profile.children_ages || '—'}
                </td>
              </tr>
              <tr>
                <td className="border-2 border-[#800020] px-1.5 py-0.5 font-bold text-[#800020]">
                  Father's Name
                </td>
                <td colSpan={9} className="border-2 border-[#800020] px-1.5 py-0.5 uppercase">
                  {profile.father_name || '—'}
                </td>
              </tr>
              <tr>
                <td className="border-2 border-[#800020] px-1.5 py-0.5 font-bold text-[#800020]">
                  Mother's Name
                </td>
                <td colSpan={9} className="border-2 border-[#800020] px-1.5 py-0.5 uppercase">
                  {profile.mother_name || '—'}
                </td>
              </tr>
              <tr>
                <td className="border-2 border-[#800020] px-1.5 py-0.5 font-bold text-[#800020]">
                  Name Of Spouse
                </td>
                <td colSpan={9} className="border-2 border-[#800020] px-1.5 py-0.5 uppercase">
                  {profile.spouse_name || profile.partner_name || '—'}
                </td>
              </tr>
            </tbody>
          </table>

          {/* WORK EXPERIENCE */}
          <table className="w-full border-collapse mb-1 table-fixed border-2 border-[#800020] text-[11px]">
            <colgroup>
              <col style={{ width: '6%' }} />
              <col style={{ width: '24%' }} />
              <col style={{ width: '35%' }} />
              <col style={{ width: '35%' }} />
            </colgroup>
            <thead>
              <tr>
                <td
                  colSpan={4}
                  className="border-2 border-[#800020] px-1 py-0.5 text-center font-black uppercase text-[11.5px] bg-[#faf5f6] text-[#800020]"
                >
                  WORK EXPERIENCE
                </td>
              </tr>
              <tr className="text-center font-bold text-[#800020]">
                <td className="border-2 border-[#800020] py-0.5">No</td>
                <td className="border-2 border-[#800020] py-0.5">Years</td>
                <td className="border-2 border-[#800020] py-0.5">Place</td>
                <td className="border-2 border-[#800020] py-0.5">Position</td>
              </tr>
            </thead>
            <tbody>
              {experiences && experiences.length > 0 ? (
                experiences.map((exp, idx) => (
                  <tr key={idx}>
                    <td className="border-2 border-[#800020] py-0.5 text-center font-bold text-[#800020]">
                      {idx + 1}
                    </td>
                    <td className="border-2 border-[#800020] px-1.5 py-0.5">
                      {exp.duration || `${exp.from_date} - ${exp.to_date}`}
                    </td>
                    <td className="border-2 border-[#800020] px-1.5 py-0.5 font-medium">
                      {exp.company_place || exp.country || '—'}
                    </td>
                    <td className="border-2 border-[#800020] px-1.5 py-0.5 font-bold uppercase">
                      {exp.position}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="border-2 border-[#800020] py-0.5 text-center font-bold text-[#800020]">1</td>
                  <td className="border-2 border-[#800020] px-1.5 py-0.5">02 Years</td>
                  <td className="border-2 border-[#800020] px-1.5 py-0.5">Sri Lanka / Overseas</td>
                  <td className="border-2 border-[#800020] px-1.5 py-0.5 font-bold uppercase">
                    {profile.preferred_job_category}
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {/* REMARKS */}
          <table className="w-full border-collapse mb-1 table-fixed border-2 border-[#800020] text-[11px]">
            <tbody>
              <tr>
                <td className="border-2 border-[#800020] px-1 py-0.5 text-center font-black uppercase text-[11px] bg-[#faf5f6] text-[#800020]">
                  REMARKS
                </td>
              </tr>
              <tr>
                <td className="border-2 border-[#800020] px-1.5 py-0.5 h-[28px]">
                  {profile.closed_remarks || 'Candidate documents verified and approved for registration.'}
                </td>
              </tr>
            </tbody>
          </table>

          {/* CLOSE CAGE SECTION */}
          <table className="w-full border-collapse mb-1 table-fixed border-2 border-[#800020] text-[11px]">
            <tbody>
              <tr>
                <td className="border-2 border-[#800020] px-1.5 py-0.5 font-bold w-[30%] text-[#800020]">
                  Last Work Place (Abroad)
                </td>
                <td className="border-2 border-[#800020] px-1.5 py-0.5 w-[35%] font-medium">
                  {profile.last_work_place_abroad || '—'}
                </td>
                <td className="border-2 border-[#800020] px-1.5 py-0.5 font-bold w-[15%] text-[#800020]">
                  Returned On
                </td>
                <td className="border-2 border-[#800020] px-1.5 py-0.5 w-[20%] font-medium">
                  {formatDateDisplay(profile.returned_on)}
                </td>
              </tr>
            </tbody>
          </table>

          {/* FOOTER */}
          <div className="mt-auto pt-1">
            <div className="flex justify-between items-end">
              <div className="text-[#800020] font-black text-[11.5px] flex items-center gap-1">
                <span>Register Date:</span>
                <span className="border-b-2 border-[#800020] w-[110px] inline-block font-black text-center">
                  {formatDateDisplay(profile.registration_date)}
                </span>
              </div>

              <div className="border-t-2 border-[#800020] w-[240px] text-center pt-1 text-[#800020] text-[10.5px] font-black">
                <span className="font-bold block">{profile.register_by || 'Althaf Hussain'}</span>
                <span className="block mt-0.5">Employee Signature / Name</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
