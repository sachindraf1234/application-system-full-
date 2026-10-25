import React, { useState, useEffect, useRef } from 'react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import {
  Camera,
  Printer,
  Image as ImageIcon,
  Save,
  RotateCcw,
  UploadCloud,
  CheckCircle,
  ArrowRight,
  UserCheck,
  Download,
  Plus,
  X,
  FileText,
  Search
} from 'lucide-react';
import { Staff, ApplicantOverview, ApplicantFullDetails } from '../types';
import { SectionDocumentUploadModal } from './SectionDocumentUploadModal';
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
  staffList?: Staff[];
  applicants?: ApplicantOverview[];
  initialData?: ApplicantFullDetails;
  isProfileMode?: boolean;
  onClose?: () => void;
  onSuccess?: (newApplicantId?: string, registeredGender?: 'Male' | 'Female') => void;
  showNotification: (type: 'success' | 'error' | 'info', text: string) => void;
}

export const OfficialCandidateRegistrationForm: React.FC<Props> = ({
  staffList = [],
  applicants = [],
  initialData,
  isProfileMode = false,
  onClose,
  onSuccess,
  showNotification
}) => {
  const formAreaRef = useRef<HTMLDivElement>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string>('');
  const [logoPreview, setLogoPreview] = useState<string>(() => {
    return localStorage.getItem('trans_arabian_agency_logo') || '';
  });

  // Dropdown pull data states
  const [selectedApplicantId, setSelectedApplicantId] = useState<string>('');
  const [editingApplicantId, setEditingApplicantId] = useState<string | null>(initialData?.profile?.applicant_id || null);
  const [isPulling, setIsPulling] = useState(false);
  const [applicantList, setApplicantList] = useState<ApplicantOverview[]>(applicants);

  const [searchText, setSearchText] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestionContainerRef = useRef<HTMLDivElement>(null);

  // Close suggestions dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionContainerRef.current &&
        !suggestionContainerRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Sync applicants list if prop updates or if empty, fetch from API
  useEffect(() => {
    if (applicants && applicants.length > 0) {
      setApplicantList(applicants);
    } else {
      fetch('/api/applicants')
        .then((res) => (res.ok ? res.json() : []))
        .then((data) => {
          if (Array.isArray(data)) setApplicantList(data);
        })
        .catch(() => {});
    }
  }, [applicants]);

  // Top header fields
  const [refNo, setRefNo] = useState('');
  const [post, setPost] = useState('');
  const [gender, setGender] = useState<'Male' | 'Female'>('Male');

  // Personal details
  const [surname, setSurname] = useState('');
  const [otherName, setOtherName] = useState('');
  const [dob, setDob] = useState('');
  const [age, setAge] = useState('');
  const [religion, setReligion] = useState('Islam');
  const [nationality, setNationality] = useState('Sri Lankan');
  const [civilStatus, setCivilStatus] = useState('Single');
  const [nicNo, setNicNo] = useState('');
  const [address, setAddress] = useState('');
  const [mobile, setMobile] = useState('');
  const [telHome, setTelHome] = useState('');
  const [whatsapp, setWhatsapp] = useState('');

  // Passport details
  const [passportNo, setPassportNo] = useState('');
  const [placeOfBirth, setPlaceOfBirth] = useState('Colombo');
  const [dateOfIssue, setDateOfIssue] = useState('');
  const [dateOfExpiry, setDateOfExpiry] = useState('');

  // Qualifications
  const [educationQual, setEducationQual] = useState('G.C.E. O/L Passed');
  const [profQual, setProfQual] = useState('');
  const [langEnglish, setLangEnglish] = useState(true);
  const [langArabic, setLangArabic] = useState(false);
  const [langOther, setLangOther] = useState('Sinhala');

  const [drivingLicenseNo, setDrivingLicenseNo] = useState('');
  const [drivingLicenseIssueDate, setDrivingLicenseIssueDate] = useState('');
  const [drivingLicenseType, setDrivingLicenseType] = useState('');

  // Other details
  const [complexion, setComplexion] = useState('Wheatish');
  const [weightKg, setWeightKg] = useState('65');
  const [heightFt, setHeightFt] = useState("5'7\"");
  const [noChildren, setNoChildren] = useState('0');
  const [agesChildren, setAgesChildren] = useState('');
  const [fatherName, setFatherName] = useState('');
  const [motherName, setMotherName] = useState('');
  const [spouseName, setSpouseName] = useState('');

  // Work Experience
  const [experiences, setExperiences] = useState([
    { no: 1, years: '2021-2023', place: 'Dubai, UAE', position: 'Assistant Cook' },
    { no: 2, years: '2019-2021', place: 'Colombo, Sri Lanka', position: 'Kitchen Steward' }
  ]);

  // Remarks
  const [remarks, setRemarks] = useState('Physically fit and qualified for employment');

  // Close cage
  const [lastWorkPlaceAbroad, setLastWorkPlaceAbroad] = useState('');
  const [returnedOn, setReturnedOn] = useState('');

  // Footer
  const [regDate, setRegDate] = useState('');
  const [empSignature, setEmpSignature] = useState('Althaf Hussain');

  // Set default registration date on mount
  useEffect(() => {
    const today = new Date();
    const d = String(today.getDate()).padStart(2, '0');
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const y = today.getFullYear();
    setRegDate(`${d}/${m}/${y}`);
  }, []);

  // Format date helper for populating fields
  const formatDateValue = (dStr?: string) => {
    if (!dStr) return '';
    if (dStr.includes('/')) return dStr;
    if (dStr.includes('-')) {
      const parts = dStr.split('-');
      if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dStr;
  };

  // Populate form with complete applicant data
  const populateFormFromDetails = (fullData: ApplicantFullDetails) => {
    const p = fullData.profile;
    const pp = fullData.passport;
    const ed = fullData.education;
    const ex = fullData.experiences;

    setEditingApplicantId(p.applicant_id);
    setSelectedApplicantId(p.applicant_id);
    
    const fullNameVal = p.full_name || `${p.surname || ''} ${p.other_name || ''}`.trim() || 'Candidate';
    setSearchText(`${fullNameVal} (${p.applicant_id})`);
    setRefNo(p.ref_no || p.registration_number || '');
    setPost(p.post || p.preferred_job_category || '');
    setGender((p.gender as 'Male' | 'Female') || 'Male');
    setSurname(p.surname || '');
    setOtherName(p.other_name || '');
    setDob(formatDateValue(p.date_of_birth));
    setAge(p.age ? String(p.age) : '');
    setReligion(p.religion || 'Islam');
    setNationality(p.nationality || 'Sri Lankan');
    setCivilStatus(p.civil_status || 'Single');
    setNicNo(p.nic_number || '');
    setAddress(p.address || '');
    setMobile(p.mobile_number || '');
    setTelHome(p.telephone_home || '');
    setWhatsapp(p.whatsapp_number || p.alternate_phone || '');

    // Passport
    setPassportNo(pp?.passport_number && pp.passport_number !== 'PENDING' ? pp.passport_number : '');
    setPlaceOfBirth(pp?.place_of_birth || p.living_place || 'Colombo');
    setDateOfIssue(formatDateValue(pp?.date_of_issue));
    setDateOfExpiry(formatDateValue(pp?.date_of_expiry));

    // Education
    setEducationQual(ed?.education_qualification || 'G.C.E. O/L Passed');
    setProfQual(ed?.professional_qualification || '');
    setLangEnglish(
      ed?.languages?.includes('English') ??
        (ed?.english_status === 'Good' || ed?.english_status === 'Excellent' || p.english_status === 'Good' || p.english_status === 'Excellent')
    );
    setLangArabic(ed?.languages?.includes('Arabic') ?? (ed?.arabic_status === 'Basic' || ed?.arabic_status === 'Fluent'));
    setLangOther(ed?.other_language || 'Sinhala');
    setDrivingLicenseNo(ed?.driving_license_number || '');
    setDateOfIssue(formatDateValue(ed?.driving_license_issue_date) || dateOfIssue);
    setDrivingLicenseType(ed?.driving_license_type || '');

    // Physical & Family
    setComplexion(p.complexion || 'Wheatish');
    setWeightKg(p.weight || '65');
    setHeightFt(p.height || "5'7\"");
    setNoChildren(p.children_count !== undefined ? String(p.children_count) : '0');
    setAgesChildren(p.children_ages || '');
    setFatherName(p.father_name || '');
    setMotherName(p.mother_name || '');
    setSpouseName(p.spouse_name || '');

    // Work Experience
    if (ex && ex.length > 0) {
      setExperiences(
        ex.map((item, idx) => ({
          no: idx + 1,
          years: item.duration || (item.from_date && item.to_date ? `${item.from_date}-${item.to_date}` : ''),
          place: item.company_place || item.country || '',
          position: item.position || ''
        }))
      );
    } else {
      setExperiences([{ no: 1, years: '', place: '', position: '' }]);
    }

    setRemarks(p.closed_remarks || '');
    setLastWorkPlaceAbroad(p.last_work_place_abroad || '');
    setReturnedOn(formatDateValue(p.returned_on));

    if (p.registration_date) {
      setRegDate(formatDateValue(p.registration_date));
    }
    setEmpSignature(p.register_by || 'Althaf Hussain');
    setPhotoPreview(p.applicant_photo || '');
  };

  // Pre-load data in profile mode
  useEffect(() => {
    if (initialData) {
      populateFormFromDetails(initialData);
    }
  }, [initialData]);

  // Pull candidate data from dropdown
  const handlePullData = async () => {
    if (!selectedApplicantId) {
      showNotification('error', 'Please select an applicant name from the dropdown first.');
      return;
    }
    setIsPulling(true);
    try {
      const res = await fetch(`/api/applicants/${selectedApplicantId}`);
      if (res.ok) {
        const fullData: ApplicantFullDetails = await res.json();
        populateFormFromDetails(fullData);
        showNotification('success', `Pulled data for applicant ${fullData.profile.full_name}! All fields are ready for review and editing.`);
      } else {
        showNotification('error', 'Failed to retrieve applicant data.');
      }
    } catch (err: any) {
      showNotification('error', `Error retrieving applicant data: ${err.message}`);
    } finally {
      setIsPulling(false);
    }
  };

  // Reset / Clear form for new candidate registration
  const handleClearToNew = () => {
    setEditingApplicantId(null);
    setSelectedApplicantId('');
    setSearchText('');
    setRefNo('');
    setPost('');
    setGender('Male');
    setSurname('');
    setOtherName('');
    setDob('');
    setAge('');
    setReligion('Islam');
    setNationality('Sri Lankan');
    setCivilStatus('Single');
    setNicNo('');
    setAddress('');
    setMobile('');
    setTelHome('');
    setWhatsapp('');
    setPassportNo('');
    setPlaceOfBirth('Colombo');
    setDateOfIssue('');
    setDateOfExpiry('');
    setEducationQual('G.C.E. O/L Passed');
    setProfQual('');
    setLangEnglish(true);
    setLangArabic(false);
    setLangOther('Sinhala');
    setDrivingLicenseNo('');
    setDrivingLicenseIssueDate('');
    setDrivingLicenseType('');
    setComplexion('Wheatish');
    setWeightKg('65');
    setHeightFt("5'7\"");
    setNoChildren('0');
    setAgesChildren('');
    setFatherName('');
    setMotherName('');
    setSpouseName('');
    setExperiences([{ no: 1, years: '', place: '', position: '' }]);
    setRemarks('Physically fit and qualified for employment');
    setLastWorkPlaceAbroad('');
    setReturnedOn('');
    const today = new Date();
    const d = String(today.getDate()).padStart(2, '0');
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const y = today.getFullYear();
    setRegDate(`${d}/${m}/${y}`);
    setEmpSignature('Althaf Hussain');
    setPhotoPreview('');
    showNotification('info', 'Form cleared for new candidate registration.');
  };

  // Calculate age when DOB changes
  const handleDobPickerChange = (val: string) => {
    if (!val) return;
    const [y, m, d] = val.split('-');
    setDob(`${d}/${m}/${y}`);
    const birthYear = parseInt(y, 10);
    const currYear = new Date().getFullYear();
    if (!isNaN(birthYear)) {
      setAge(String(Math.max(18, currYear - birthYear)));
    }
  };

  const handlePhotoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setPhotoPreview(ev.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const base64 = ev.target?.result as string;
        setLogoPreview(base64);
        localStorage.setItem('trans_arabian_agency_logo', base64);
        showNotification('success', 'Agency logo updated successfully.');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddExperienceRow = () => {
    setExperiences((prev) => [
      ...prev,
      { no: prev.length + 1, years: '', place: '', position: '' }
    ]);
  };

  const handleExperienceChange = (index: number, field: string, value: string) => {
    setExperiences((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const handlePrint = () => {
    const el = formAreaRef.current;
    if (!el) {
      window.print();
      return;
    }

    try {
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = 'none';
      document.body.appendChild(iframe);

      const doc = iframe.contentWindow?.document;
      if (doc) {
        doc.open();
        doc.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>Official Candidate Form - ${surname || 'Candidate'} ${passportNo || ''}</title>
              <style>
                @page {
                  size: A4 portrait;
                  margin: 6mm;
                }
                * {
                  box-sizing: border-box;
                  -webkit-print-color-adjust: exact !important;
                  print-color-adjust: exact !important;
                }
                body {
                  margin: 0;
                  padding: 0;
                  background: #ffffff;
                  font-family: "Times New Roman", Times, serif;
                  color: #800020;
                }
                .print-hidden, input[type="file"], .cursor-pointer, button, label {
                  display: none !important;
                }
                input, textarea, select {
                  font-family: inherit;
                  color: inherit;
                  border: none;
                  background: transparent;
                  outline: none;
                  width: 100%;
                }
                table {
                  width: 100%;
                  border-collapse: collapse;
                  table-layout: fixed;
                }
                td, th {
                  border: 2px solid #800020;
                  padding: 2px 4px;
                }
              </style>
            </head>
            <body>
              ${el.outerHTML}
            </body>
          </html>
        `);
        doc.close();

        setTimeout(() => {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
          setTimeout(() => {
            if (document.body.contains(iframe)) {
              document.body.removeChild(iframe);
            }
          }, 2000);
        }, 300);
        return;
      }
    } catch (e) {
      console.warn('Iframe print fallback to window.print', e);
    }
    window.print();
  };

  const handleDownloadPdf = async () => {
    const el = formAreaRef.current;
    if (!el) return;

    try {
      showNotification('info', 'Generating official candidate form PDF...');
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
      const safeName = (surname || otherName || 'Candidate').replace(/[^a-zA-Z0-9]/g, '_');
      const safePass = (passportNo || 'Reg').replace(/[^a-zA-Z0-9]/g, '_');
      pdf.save(`Official_Form_${safeName}_${safePass}.pdf`);
      showNotification('success', 'Official Candidate Registration Form PDF downloaded successfully!');
    } catch (err: any) {
      console.error('PDF generation error:', err);
      showNotification('error', `PDF download failed: ${err.message}`);
    }
  };

  const handleDownloadJpeg = async () => {
    const el = formAreaRef.current;
    if (!el) return;

    try {
      showNotification('info', 'Generating high-resolution JPEG...');
      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false
      });
      const link = document.createElement('a');
      const safeName = (surname || otherName || 'Candidate').replace(/[^a-zA-Z0-9]/g, '_');
      const safePass = (passportNo || 'Reg').replace(/[^a-zA-Z0-9]/g, '_');
      link.download = `Official_Form_${safeName}_${safePass}.jpg`;
      link.href = canvas.toDataURL('image/jpeg', 0.95);
      link.click();
      showNotification('success', 'Candidate form downloaded as JPEG successfully!');
    } catch (err: any) {
      console.error('JPEG generation error:', err);
      showNotification('error', `JPEG generation failed: ${err.message}`);
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const fullName = `${surname} ${otherName}`.trim() || surname || otherName || 'NEW CANDIDATE';

    setIsSubmitting(true);
    try {
      const payload = {
        profile: {
          full_name: fullName.toUpperCase(),
          surname: surname.toUpperCase(),
          other_name: otherName.toUpperCase(),
          gender,
          date_of_birth: dob.includes('/') ? dob.split('/').reverse().join('-') : dob,
          age: Number(age) || 25,
          religion,
          nationality,
          civil_status: civilStatus,
          nic_number: nicNo.toUpperCase(),
          address,
          living_place: placeOfBirth || 'Colombo',
          mobile_number: mobile || whatsapp || '+94770000000',
          telephone_home: telHome,
          whatsapp_number: whatsapp,
          alternate_phone: whatsapp,
          email: 'transarabian@yahoo.com',
          preferred_job_category: post || 'Kitchen Helper',
          post: post || 'Kitchen Helper',
          ref_no: refNo || `REF-${Math.floor(1000 + Math.random() * 9000)}`,
          complexion,
          height: heightFt,
          weight: weightKg,
          children_count: Number(noChildren) || 0,
          children_ages: agesChildren,
          father_name: fatherName,
          mother_name: motherName,
          spouse_name: spouseName,
          last_work_place_abroad: lastWorkPlaceAbroad,
          returned_on: returnedOn.includes('/') ? returnedOn.split('/').reverse().join('-') : returnedOn,
          english_status: langEnglish ? 'Good' : 'Not Checked',
          registration_date: regDate.includes('/') ? regDate.split('/').reverse().join('-') : regDate || new Date().toISOString().split('T')[0],
          registration_source: 'Official Form',
          current_status: 'GREEN_REGISTERED',
          applicant_photo: photoPreview,
          closed_remarks: remarks,
          register_by: empSignature || 'Althaf Hussain'
        },
        passport: {
          passport_number: passportNo.toUpperCase() || 'PENDING',
          place_of_birth: placeOfBirth,
          date_of_issue: dateOfIssue.includes('/') ? dateOfIssue.split('/').reverse().join('-') : dateOfIssue,
          date_of_expiry: dateOfExpiry.includes('/') ? dateOfExpiry.split('/').reverse().join('-') : dateOfExpiry,
          passport_status: 'With Agency',
          remarks: 'Original Passport submitted'
        },
        education: {
          education_qualification: educationQual,
          professional_qualification: profQual,
          languages: [
            ...(langEnglish ? ['English'] : []),
            ...(langArabic ? ['Arabic'] : []),
            ...(langOther ? [langOther] : [])
          ],
          english_status: langEnglish ? 'Good' : 'Basic',
          arabic_status: langArabic ? 'Basic' : 'None',
          driving_license_number: drivingLicenseNo,
          driving_license_issue_date: drivingLicenseIssueDate.includes('/') ? drivingLicenseIssueDate.split('/').reverse().join('-') : drivingLicenseIssueDate,
          driving_license_type: drivingLicenseType
        },
        experiences: experiences.map((exp) => ({
          sequence: exp.no,
          from_date: exp.years.includes('-') ? exp.years.split('-')[0] : exp.years,
          to_date: exp.years.includes('-') ? exp.years.split('-')[1] : '',
          company_place: exp.place,
          position: exp.position,
          duration: exp.years,
          country: exp.place,
          remarks: 'Work experience verified'
        }))
      };

      if (editingApplicantId) {
        // UPDATE EXISTING CANDIDATE IN DATABASE
        const res = await fetch(`/api/applicants/${editingApplicantId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (res.ok && data.success) {
          showNotification('success', `Candidate ${fullName} (${editingApplicantId}) updated successfully in database!`);
          if (onSuccess) onSuccess(editingApplicantId, gender);
        } else {
          showNotification('error', data.error || 'Failed to update candidate details.');
        }
      } else {
        // REGISTER NEW CANDIDATE IN DATABASE
        const res = await fetch('/api/applicants', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (res.ok && data.success) {
          showNotification('success', `Candidate ${fullName} registered successfully in database! Details transferred to Candidate Records.`);
          if (onSuccess) onSuccess(data.applicantId, gender);
        } else if (res.status === 409) {
          showNotification(
            'error',
            `Duplicate Passport Number! Candidate already registered: ${data.existingApplicantName || ''} (${data.existingApplicantId || ''})`
          );
        } else {
          showNotification('error', data.error || 'Failed to register candidate');
        }
      }
    } catch (err: any) {
      showNotification('error', `Submission error: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePreFillSample = () => {
    setRefNo('TA-2026/089');
    setPost('CHEF / COOK');
    setGender('Male');
    setSurname('PERERA');
    setOtherName('KAMAL BANDARA');
    setDob('14/05/1994');
    setAge('32');
    setReligion('Buddhist');
    setNationality('Sri Lankan');
    setCivilStatus('Married');
    setNicNo('199413401582');
    setAddress('No. 45/A, Kandy Road, Wennappuwa');
    setMobile('+94 77 123 4567');
    setTelHome('+94 31 223 3445');
    setWhatsapp('+94 77 123 4567');
    setPassportNo('N10984521');
    setPlaceOfBirth('Wennappuwa');
    setDateOfIssue('10/01/2022');
    setDateOfExpiry('10/01/2032');
    setEducationQual('G.C.E. O/L & A/L Passed');
    setProfQual('NVQ Level 4 Commercial Cookery Diploma');
    setLangEnglish(true);
    setLangArabic(true);
    setLangOther('Sinhala');
    setDrivingLicenseNo('B-9874521');
    setDrivingLicenseIssueDate('05/03/2018');
    setDrivingLicenseType('Light Vehicle');
    setComplexion('Fair');
    setWeightKg('72');
    setHeightFt("5'9\"");
    setNoChildren('1');
    setAgesChildren('4 Yrs');
    setFatherName('P. Bandara Perera');
    setMotherName('S. M. Kusuma');
    setSpouseName('Nirosha Jayawardena');
    setLastWorkPlaceAbroad('Al-Khaleej Hotel, Dubai');
    setReturnedOn('12/11/2024');
    setRemarks('Ready for immediate interview & departure');
    showNotification('info', 'Pre-filled sample candidate data into form');
  };

  const filteredApplicants = applicantList.filter((app) => {
    const term = searchText.toLowerCase();
    return (
      app.full_name?.toLowerCase().includes(term) ||
      app.applicant_id?.toLowerCase().includes(term) ||
      (app.passport_number && app.passport_number.toLowerCase().includes(term))
    );
  });

  return (
    <div className="space-y-4">
      {/* 1. CONTROL BAR (Hidden during browser print) */}
      <div className="bg-slate-900 text-white p-3.5 sm:p-4 rounded-2xl flex flex-col gap-3 shadow-md print:hidden">
        {/* Top Control Bar Row */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-widest text-emerald-400 font-bold block">
              FOREIGN EMPLOYMENT AGENCY · SLBFE #2601
            </span>
            <h3 className="text-sm font-bold text-white tracking-wide flex items-center gap-2">
              <FileText className="w-4 h-4 text-amber-400" />
              <span>
                {isProfileMode
                  ? 'Official Candidate Application Form (Profile)'
                  : 'Official Candidate Registration Form'}
              </span>
            </h3>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {!isProfileMode && (
              <>
                <button
                  type="button"
                  onClick={() => setIsUploadModalOpen(true)}
                  className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold px-3 py-2 rounded-xl border border-slate-700 transition cursor-pointer"
                >
                  <UploadCloud className="w-3.5 h-3.5 text-emerald-400" />
                  <span>AI Auto-Fill</span>
                </button>

                <button
                  type="button"
                  onClick={handlePreFillSample}
                  className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold px-3 py-2 rounded-xl border border-slate-700 transition cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                  <span>Sample Data</span>
                </button>
              </>
            )}

            <button
              type="button"
              onClick={handleDownloadJpeg}
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3 py-2 rounded-xl transition cursor-pointer shadow-xs active:scale-98"
              title="Download Form as High-Resolution JPEG Image"
            >
              <ImageIcon className="w-3.5 h-3.5" />
              <span>Download JPEG</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadPdf}
              className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-3 py-2 rounded-xl transition cursor-pointer shadow-xs active:scale-98"
              title="Download Form as Official A4 PDF Document"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download PDF</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-3 py-2 rounded-xl transition cursor-pointer shadow-xs active:scale-98"
              title="Print directly or save as PDF via system dialog"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Form</span>
            </button>

            <button
              type="button"
              onClick={() => handleSubmit()}
              disabled={isSubmitting}
              className="flex items-center gap-1.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-black px-4 py-2 rounded-xl transition cursor-pointer shadow-xs active:scale-98"
            >
              <Save className="w-3.5 h-3.5" />
              <span>
                {isSubmitting
                  ? 'Saving...'
                  : editingApplicantId
                  ? 'Update in Database'
                  : 'Register Candidate'}
              </span>
            </button>

            {isProfileMode && onClose && (
              <button
                type="button"
                onClick={onClose}
                className="flex items-center gap-1 bg-slate-700 hover:bg-slate-600 text-white text-xs font-semibold px-3 py-2 rounded-xl transition cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                <span>Close Profile</span>
              </button>
            )}
          </div>
        </div>

        {/* Pull Data / Select Applicant Bar (Available in standard registration or when choosing applicants) */}
        {!isProfileMode && (
          <div className="bg-slate-800/90 border border-slate-700/80 p-2.5 rounded-xl flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-1 min-w-[280px]">
              <UserCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <label className="text-xs font-bold text-slate-200 shrink-0">
                Applicant Name:
              </label>
              
              <div ref={suggestionContainerRef} className="relative flex-1">
                <div className="relative flex items-center">
                  <span className="absolute left-3 text-slate-400">
                    <Search className="w-3.5 h-3.5" />
                  </span>
                  <input
                    type="text"
                    placeholder="Type name, passport #, or candidate ID..."
                    value={searchText}
                    onFocus={() => setShowSuggestions(true)}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSearchText(val);
                      setShowSuggestions(true);
                      const match = applicantList.find(app => `${app.full_name} (${app.applicant_id})` === val);
                      if (match) {
                        setSelectedApplicantId(match.applicant_id);
                      } else {
                        setSelectedApplicantId('');
                      }
                    }}
                    className="w-full bg-slate-950 border border-slate-600 rounded-lg pl-9 pr-8 py-1.5 text-xs text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-text"
                  />
                  {searchText && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchText('');
                        setSelectedApplicantId('');
                        setShowSuggestions(false);
                      }}
                      className="absolute right-2.5 text-slate-400 hover:text-white transition cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {/* Autocomplete Suggestions Overlay */}
                {showSuggestions && (
                  <div className="absolute z-50 left-0 right-0 mt-1 bg-slate-950 border border-slate-700 rounded-lg shadow-xl max-h-60 overflow-y-auto divide-y divide-slate-800">
                    {filteredApplicants.length > 0 ? (
                      filteredApplicants.map((app) => {
                        const isSelected = selectedApplicantId === app.applicant_id;
                        return (
                          <div
                            key={app.applicant_id}
                            onClick={() => {
                              setSelectedApplicantId(app.applicant_id);
                              setSearchText(`${app.full_name} (${app.applicant_id})`);
                              setShowSuggestions(false);
                            }}
                            className={`px-3 py-2 text-xs cursor-pointer transition-colors flex flex-col gap-0.5 ${
                              isSelected
                                ? 'bg-emerald-900/40 text-emerald-300'
                                : 'hover:bg-slate-900 text-slate-200'
                            }`}
                          >
                            <span className="font-bold">{app.full_name}</span>
                            <div className="flex items-center gap-2 text-[10px] text-slate-400">
                              <span className="bg-slate-800 text-slate-300 px-1.5 py-0.2 rounded font-mono">
                                {app.applicant_id}
                              </span>
                              {app.passport_number && (
                                <span>PP: {app.passport_number}</span>
                              )}
                              {app.gender && (
                                <span className={`px-1 rounded-sm text-[9px] ${
                                  app.gender === 'Female' 
                                    ? 'bg-rose-950/40 text-rose-300 border border-rose-900/30' 
                                    : 'bg-blue-950/40 text-blue-300 border border-blue-900/30'
                                }`}>
                                  {app.gender}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="p-3 text-xs text-slate-500 text-center">
                        No matching applicants found.
                      </div>
                    )}
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={handlePullData}
                disabled={!selectedApplicantId || isPulling}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer shrink-0 shadow-xs ${
                  selectedApplicantId
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white active:scale-98'
                    : 'bg-slate-700 text-slate-400 cursor-not-allowed opacity-60'
                }`}
              >
                <Download className="w-3.5 h-3.5" />
                <span>{isPulling ? 'Pulling Data...' : 'Pull Data'}</span>
              </button>
            </div>

            {editingApplicantId ? (
              <div className="flex items-center gap-2">
                <span className="text-xs bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2.5 py-1 rounded-md font-medium">
                  Editing: {surname || otherName || 'Candidate'} ({editingApplicantId})
                </span>
                <button
                  type="button"
                  onClick={handleClearToNew}
                  className="flex items-center gap-1 text-xs bg-slate-700 hover:bg-slate-600 text-slate-200 px-2.5 py-1 rounded-md transition cursor-pointer"
                  title="Clear form and register a new candidate"
                >
                  <Plus className="w-3 h-3" />
                  <span>New Candidate</span>
                </button>
              </div>
            ) : (
              <span className="text-[11px] text-slate-400 font-medium">
                Tip: Choose candidate to pull data & edit, or fill below for new candidate.
              </span>
            )}
          </div>
        )}
      </div>

      {/* 2. A4 FORM CANVAS CONTAINER */}
      <div className="flex justify-center bg-slate-200/60 p-2 sm:p-4 rounded-2xl overflow-x-auto print:bg-white print:p-0">
        <div
          ref={formAreaRef}
          id="formArea"
          className="bg-white text-[#800020] w-[210mm] min-h-[297mm] p-[10mm] shadow-2xl rounded-sm print:shadow-none print:p-0 print:w-[210mm] print:h-[297mm] flex flex-col font-serif"
          style={{
            fontFamily: '"Times New Roman", Times, serif'
          }}
        >
          {/* Inner 8px Double Maroon Border Frame */}
          <div
            className="h-full border-[8px] border-double border-[#800020] p-3 flex flex-col flex-1"
            style={{ borderColor: '#800020' }}
          >
            {/* Header: Company Logo, Details & Photo Box */}
            <div className="flex justify-between items-center border-b-2 border-[#800020] pb-2 mb-1.5">
              {/* Logo Box */}
              <div className="w-[140px] h-[140px] flex items-center justify-center relative overflow-hidden shrink-0 group border border-dashed border-[#800020]/20 hover:border-[#800020]/50 rounded-lg p-1">
                {logoPreview ? (
                  <img
                    id="logoImg"
                    src={logoPreview}
                    alt="TRANS ARABIAN LOGO"
                    className="max-w-full max-h-full w-auto h-auto object-contain block m-auto"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = '/company_logo.png';
                    }}
                  />
                ) : (
                  <PermanentLogo className="w-[125px] h-[125px]" />
                )}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-white gap-1.5 transition print:hidden text-center p-1">
                  <label className="bg-emerald-600 hover:bg-emerald-500 text-[10px] font-bold px-2.5 py-1 rounded cursor-pointer w-11/12 text-center block">
                    <span>Upload Logo</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoFileChange}
                      className="hidden"
                    />
                  </label>
                  {logoPreview && (
                    <button
                      type="button"
                      onClick={() => {
                        setLogoPreview('');
                        localStorage.removeItem('trans_arabian_agency_logo');
                        showNotification('info', 'Reset to permanent vector logo');
                      }}
                      className="bg-rose-700 hover:bg-rose-600 text-[10px] font-bold px-2.5 py-1 rounded cursor-pointer w-11/12 text-center block"
                    >
                      Reset Default
                    </button>
                  )}
                </div>
              </div>

              {/* Company Header Details */}
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

              {/* Photo Box (35mm x 45mm) */}
              <div className="w-[35mm] h-[45mm] border-2 border-[#800020] bg-slate-50 flex flex-col items-center justify-center relative overflow-hidden shrink-0 group">
                {photoPreview ? (
                  <img
                    src={photoPreview}
                    alt="Applicant"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-center p-1 text-[#800020]">
                    <Camera className="w-5 h-5 mb-1 opacity-60" />
                    <span className="text-[9px] font-bold uppercase leading-tight">
                      Affix Photo
                    </span>
                    <span className="text-[8px] opacity-70">35mm x 45mm</span>
                  </div>
                )}
                <label className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-[10px] font-bold transition cursor-pointer print:hidden">
                  Upload
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoFileChange}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            {/* Document Title */}
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
                  <td className="border-2 border-[#800020] px-1 py-0.5 w-[38%]">
                    <input
                      type="text"
                      value={refNo}
                      onChange={(e) => setRefNo(e.target.value)}
                      placeholder="TA-2026/..."
                      className="w-full border-none outline-none text-[#800020] font-normal text-[11px] bg-transparent"
                    />
                  </td>
                  <td className="border-2 border-[#800020] px-1.5 py-0.5 font-bold w-[10%] text-[#800020]">
                    post
                  </td>
                  <td className="border-2 border-[#800020] px-1 py-0.5 w-[20%]">
                    <input
                      type="text"
                      value={post}
                      onChange={(e) => setPost(e.target.value)}
                      placeholder="Job Post"
                      className="w-full border-none outline-none text-[#800020] font-normal text-[11px] bg-transparent uppercase font-bold"
                    />
                  </td>
                  <td className="border-2 border-[#800020] px-1.5 py-0.5 w-[10%] text-center font-bold text-[#800020]">
                    <label className="flex items-center justify-center gap-1 cursor-pointer">
                      male
                      <input
                        type="checkbox"
                        checked={gender === 'Male'}
                        onChange={() => setGender('Male')}
                        className="accent-[#800020]"
                      />
                    </label>
                  </td>
                  <td className="border-2 border-[#800020] px-1.5 py-0.5 w-[10%] text-center font-bold text-[#800020]">
                    <label className="flex items-center justify-center gap-1 cursor-pointer">
                      female
                      <input
                        type="checkbox"
                        checked={gender === 'Female'}
                        onChange={() => setGender('Female')}
                        className="accent-[#800020]"
                      />
                    </label>
                  </td>
                </tr>
              </tbody>
            </table>

            {/* PERSONAL DETAILS SECTION */}
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
                  <td colSpan={5} className="border-2 border-[#800020] px-1 py-0.5">
                    <input
                      type="text"
                      value={surname}
                      onChange={(e) => setSurname(e.target.value.toUpperCase())}
                      className="w-full border-none outline-none text-[#800020] font-bold text-[11px] bg-transparent uppercase"
                    />
                  </td>
                </tr>
                <tr>
                  <td className="border-2 border-[#800020] px-1.5 py-0.5 font-bold text-[#800020]">
                    Other Name
                  </td>
                  <td colSpan={5} className="border-2 border-[#800020] px-1 py-0.5">
                    <input
                      type="text"
                      value={otherName}
                      onChange={(e) => setOtherName(e.target.value.toUpperCase())}
                      className="w-full border-none outline-none text-[#800020] font-normal text-[11px] bg-transparent uppercase"
                    />
                  </td>
                </tr>
                <tr>
                  <td className="border-2 border-[#800020] px-1.5 py-0.5 font-bold text-[#800020]">
                    Date Of Birth
                  </td>
                  <td colSpan={2} className="border-2 border-[#800020] px-1 py-0.5 relative">
                    <div className="flex items-center">
                      <input
                        type="text"
                        value={dob}
                        onChange={(e) => setDob(e.target.value)}
                        placeholder="dd/mm/yyyy"
                        className="w-full border-none outline-none text-[#800020] text-[11px] bg-transparent font-normal"
                      />
                      <input
                        type="date"
                        onChange={(e) => handleDobPickerChange(e.target.value)}
                        className="opacity-0 w-6 h-6 absolute right-1 cursor-pointer print:hidden"
                      />
                      <span className="text-[11px] pointer-events-none print:hidden">📅</span>
                    </div>
                  </td>
                  <td className="border-2 border-[#800020] px-1.5 py-0.5 font-bold text-[#800020]">
                    Age
                  </td>
                  <td colSpan={2} className="border-2 border-[#800020] px-1 py-0.5">
                    <input
                      type="number"
                      value={age}
                      onChange={(e) => setAge(e.target.value)}
                      className="w-full border-none outline-none text-[#800020] font-bold text-[11px] bg-transparent"
                    />
                  </td>
                </tr>
                <tr>
                  <td className="border-2 border-[#800020] px-1.5 py-0.5 font-bold text-[#800020]">
                    Nationality
                  </td>
                  <td colSpan={2} className="border-2 border-[#800020] px-1 py-0.5 relative">
                    <div className="relative flex items-center w-full">
                      <select
                        value={nationality}
                        onChange={(e) => setNationality(e.target.value)}
                        className="w-full border-none outline-none text-[#800020] text-[11px] bg-transparent cursor-pointer appearance-none pr-4 font-normal"
                        style={{ fontFamily: '"Times New Roman", Times, serif' }}
                      >
                        <option value="Sri Lankan">Sri Lankan</option>
                        <option value="Indian">Indian</option>
                        <option value="Nepalese">Nepalese</option>
                        <option value="Bangladeshi">Bangladeshi</option>
                        <option value="Maldivian">Maldivian</option>
                        <option value="Pakistani">Pakistani</option>
                        <option value="Other">Other</option>
                      </select>
                      <span className="absolute right-1 text-[8px] pointer-events-none print:hidden text-[#800020]/70">▼</span>
                    </div>
                  </td>
                  <td className="border-2 border-[#800020] px-1.5 py-0.5 font-bold text-[#800020]">
                    Civil Status
                  </td>
                  <td colSpan={2} className="border-2 border-[#800020] px-1 py-0.5 relative">
                    <div className="relative flex items-center w-full">
                      <select
                        value={civilStatus}
                        onChange={(e) => setCivilStatus(e.target.value)}
                        className="w-full border-none outline-none text-[#800020] text-[11px] bg-transparent cursor-pointer appearance-none pr-4 font-normal"
                        style={{ fontFamily: '"Times New Roman", Times, serif' }}
                      >
                        <option value="Single">Single</option>
                        <option value="Married">Married</option>
                        <option value="Divorced">Divorced</option>
                        <option value="Widowed">Widowed</option>
                      </select>
                      <span className="absolute right-1 text-[8px] pointer-events-none print:hidden text-[#800020]/70">▼</span>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td className="border-2 border-[#800020] px-1.5 py-0.5 font-bold text-[#800020]">
                    Religion
                  </td>
                  <td colSpan={2} className="border-2 border-[#800020] px-1 py-0.5 relative">
                    <div className="relative flex items-center w-full">
                      <select
                        value={religion}
                        onChange={(e) => setReligion(e.target.value)}
                        className="w-full border-none outline-none text-[#800020] text-[11px] bg-transparent cursor-pointer appearance-none pr-4 font-normal"
                        style={{ fontFamily: '"Times New Roman", Times, serif' }}
                      >
                        <option value="Islam">Islam</option>
                        <option value="Buddhist">Buddhist</option>
                        <option value="Hindu">Hindu</option>
                        <option value="Christian">Christian</option>
                        <option value="R/catholic">R/catholic</option>
                        <option value="Other">Other</option>
                      </select>
                      <span className="absolute right-1 text-[8px] pointer-events-none print:hidden text-[#800020]/70">▼</span>
                    </div>
                  </td>
                  <td className="border-2 border-[#800020] px-1.5 py-0.5 font-bold text-[#800020]">
                    NIC No
                  </td>
                  <td colSpan={2} className="border-2 border-[#800020] px-1 py-0.5">
                    <input
                      type="text"
                      value={nicNo}
                      onChange={(e) => setNicNo(e.target.value.toUpperCase())}
                      placeholder="NIC Number"
                      className="w-full border-none outline-none text-[#800020] text-[11px] bg-transparent uppercase font-normal tracking-wider"
                    />
                  </td>
                </tr>
                <tr>
                  <td className="border-2 border-[#800020] px-1.5 py-0.5 font-bold text-[#800020]">
                    Address
                  </td>
                  <td colSpan={5} className="border-2 border-[#800020] px-1 py-0.5">
                    <textarea
                      rows={1}
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      className="w-full border-none outline-none text-[#800020] text-[11px] bg-transparent resize-none h-[28px]"
                    />
                  </td>
                </tr>
                <tr>
                  <td className="border-2 border-[#800020] px-1.5 py-0.5 font-bold text-[#800020]">
                    Mobile
                  </td>
                  <td colSpan={2} className="border-2 border-[#800020] px-1 py-0.5">
                    <input
                      type="text"
                      value={mobile}
                      onChange={(e) => setMobile(e.target.value)}
                      className="w-full border-none outline-none text-[#800020] text-[11px] bg-transparent font-bold"
                    />
                  </td>
                  <td className="border-2 border-[#800020] px-1.5 py-0.5 font-bold text-[#800020]" rowSpan={2}>
                    Tel (Home)
                  </td>
                  <td colSpan={2} rowSpan={2} className="border-2 border-[#800020] px-1 py-0.5">
                    <input
                      type="text"
                      value={telHome}
                      onChange={(e) => setTelHome(e.target.value)}
                      className="w-full border-none outline-none text-[#800020] text-[11px] bg-transparent"
                    />
                  </td>
                </tr>
                <tr>
                  <td className="border-2 border-[#800020] px-1.5 py-0.5 font-bold text-[#800020] text-[10px] whitespace-nowrap">
                    Mobile (WhatsApp)
                  </td>
                  <td colSpan={2} className="border-2 border-[#800020] px-1 py-0.5">
                    <input
                      type="text"
                      value={whatsapp}
                      onChange={(e) => setWhatsapp(e.target.value)}
                      className="w-full border-none outline-none text-[#800020] text-[11px] bg-transparent font-bold"
                    />
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
                  <td className="border-2 border-[#800020] px-1 py-0.5 w-[28%]">
                    <input
                      type="text"
                      value={passportNo}
                      onChange={(e) => setPassportNo(e.target.value.toUpperCase())}
                      className="w-full border-none outline-none text-[#800020] font-black text-[11.5px] bg-transparent uppercase"
                    />
                  </td>
                  <td className="border-2 border-[#800020] px-1.5 py-0.5 font-bold w-[22%] text-[#800020]">
                    Place Of Birth
                  </td>
                  <td className="border-2 border-[#800020] px-1 py-0.5 w-[28%]">
                    <input
                      type="text"
                      value={placeOfBirth}
                      onChange={(e) => setPlaceOfBirth(e.target.value)}
                      className="w-full border-none outline-none text-[#800020] text-[11px] bg-transparent"
                    />
                  </td>
                </tr>
                <tr>
                  <td className="border-2 border-[#800020] px-1.5 py-0.5 font-bold text-[#800020]">
                    Date Of Issue
                  </td>
                  <td className="border-2 border-[#800020] px-1 py-0.5 relative">
                    <div className="flex items-center">
                      <input
                        type="text"
                        value={dateOfIssue}
                        onChange={(e) => setDateOfIssue(e.target.value)}
                        placeholder="dd/mm/yyyy"
                        className="w-full border-none outline-none text-[#800020] text-[11px] bg-transparent"
                      />
                      <input
                        type="date"
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val) {
                            const [y, m, d] = val.split('-');
                            setDateOfIssue(`${d}/${m}/${y}`);
                          }
                        }}
                        className="opacity-0 w-6 h-6 absolute right-1 cursor-pointer print:hidden"
                      />
                      <span className="text-[11px] pointer-events-none print:hidden">📅</span>
                    </div>
                  </td>
                  <td className="border-2 border-[#800020] px-1.5 py-0.5 font-bold text-[#800020]">
                    Date Of Expiry
                  </td>
                  <td className="border-2 border-[#800020] px-1 py-0.5 relative">
                    <div className="flex items-center">
                      <input
                        type="text"
                        value={dateOfExpiry}
                        onChange={(e) => setDateOfExpiry(e.target.value)}
                        placeholder="dd/mm/yyyy"
                        className="w-full border-none outline-none text-[#800020] text-[11px] bg-transparent font-bold"
                      />
                      <input
                        type="date"
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val) {
                            const [y, m, d] = val.split('-');
                            setDateOfExpiry(`${d}/${m}/${y}`);
                          }
                        }}
                        className="opacity-0 w-6 h-6 absolute right-1 cursor-pointer print:hidden"
                      />
                      <span className="text-[11px] pointer-events-none print:hidden">📅</span>
                    </div>
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
                  <td colSpan={5} className="border-2 border-[#800020] px-1 py-0.5">
                    <input
                      type="text"
                      value={educationQual}
                      onChange={(e) => setEducationQual(e.target.value)}
                      className="w-full border-none outline-none text-[#800020] text-[11px] bg-transparent"
                    />
                  </td>
                </tr>
                <tr>
                  <td className="border-2 border-[#800020] px-1.5 py-0.5 font-bold text-[#800020]">
                    Professional Qualifications
                  </td>
                  <td colSpan={5} className="border-2 border-[#800020] px-1 py-0.5">
                    <input
                      type="text"
                      value={profQual}
                      onChange={(e) => setProfQual(e.target.value)}
                      className="w-full border-none outline-none text-[#800020] text-[11px] bg-transparent"
                    />
                  </td>
                </tr>
                <tr>
                  <td className="border-2 border-[#800020] px-1.5 py-0.5 font-bold text-[#800020]">
                    Knowledge Of Languages
                  </td>
                  <td colSpan={5} className="border-2 border-[#800020] px-1.5 py-0.5">
                    <div className="flex items-center justify-between gap-4 text-[#800020]">
                      <label className="flex items-center gap-1 cursor-pointer">
                        English
                        <input
                          type="checkbox"
                          checked={langEnglish}
                          onChange={(e) => setLangEnglish(e.target.checked)}
                          className="accent-[#800020]"
                        />
                      </label>
                      <label className="flex items-center gap-1 cursor-pointer">
                        Arabic
                        <input
                          type="checkbox"
                          checked={langArabic}
                          onChange={(e) => setLangArabic(e.target.checked)}
                          className="accent-[#800020]"
                        />
                      </label>
                      <div className="flex items-center gap-1 flex-1">
                        <span>Other:</span>
                        <input
                          type="text"
                          value={langOther}
                          onChange={(e) => setLangOther(e.target.value)}
                          className="border-b border-[#800020] outline-none text-[#800020] text-[11px] flex-1 bg-transparent"
                        />
                      </div>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td className="border-2 border-[#800020] px-1.5 py-0.5 font-bold text-[#800020]">
                    Driving License No
                  </td>
                  <td colSpan={5} className="border-2 border-[#800020] px-1 py-0.5">
                    <div className="flex items-center justify-between gap-2">
                      <input
                        type="text"
                        value={drivingLicenseNo}
                        onChange={(e) => setDrivingLicenseNo(e.target.value)}
                        placeholder="License No"
                        className="w-[28%] border-none outline-none text-[#800020] text-[11px] bg-transparent"
                      />
                      <div className="flex items-center gap-1 text-[10.5px]">
                        <span>Date Of Issue:</span>
                        <div className="relative flex items-center w-[95px]">
                          <input
                            type="text"
                            value={drivingLicenseIssueDate}
                            onChange={(e) => setDrivingLicenseIssueDate(e.target.value)}
                            placeholder="dd/mm/yyyy"
                            className="w-full border-none outline-none text-[#800020] text-[10.5px] bg-transparent"
                          />
                          <input
                            type="date"
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val) {
                                const [y, m, d] = val.split('-');
                                setDrivingLicenseIssueDate(`${d}/${m}/${y}`);
                              }
                            }}
                            className="opacity-0 w-5 h-5 absolute right-0 cursor-pointer print:hidden"
                          />
                          <span className="text-[10px] pointer-events-none print:hidden">📅</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-1 text-[10.5px]">
                        <span>Type:</span>
                        <input
                          type="text"
                          value={drivingLicenseType}
                          onChange={(e) => setDrivingLicenseType(e.target.value)}
                          className="border-b border-[#800020] outline-none text-[#800020] text-[10.5px] flex-1 bg-transparent"
                        />
                      </div>
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
                    <input
                      type="text"
                      value={complexion}
                      onChange={(e) => setComplexion(e.target.value)}
                      className="w-full border-none outline-none text-[#800020] text-[11px] bg-transparent"
                    />
                  </td>
                  <td className="border-2 border-[#800020] px-1 py-0.5 font-bold w-[11%] text-[#800020]">
                    Weight (Kg)
                  </td>
                  <td className="border-2 border-[#800020] px-1 py-0.5 w-[11%]">
                    <input
                      type="text"
                      value={weightKg}
                      onChange={(e) => setWeightKg(e.target.value)}
                      className="w-full border-none outline-none text-[#800020] text-[11px] bg-transparent"
                    />
                  </td>
                  <td className="border-2 border-[#800020] px-1 py-0.5 font-bold w-[10%] text-[#800020]">
                    Height (ft)
                  </td>
                  <td className="border-2 border-[#800020] px-1 py-0.5 w-[11%]">
                    <input
                      type="text"
                      value={heightFt}
                      onChange={(e) => setHeightFt(e.target.value)}
                      className="w-full border-none outline-none text-[#800020] text-[11px] bg-transparent"
                    />
                  </td>
                  <td className="border-2 border-[#800020] px-1 py-0.5 font-bold w-[14%] text-[#800020]">
                    No Children
                  </td>
                  <td className="border-2 border-[#800020] px-1 py-0.5 w-[7%]">
                    <input
                      type="number"
                      value={noChildren}
                      onChange={(e) => setNoChildren(e.target.value)}
                      className="w-full border-none outline-none text-[#800020] text-[11px] bg-transparent"
                    />
                  </td>
                  <td className="border-2 border-[#800020] px-1 py-0.5 font-bold w-[5%] text-[#800020]">
                    Ages
                  </td>
                  <td className="border-2 border-[#800020] px-1 py-0.5 w-[15%]">
                    <input
                      type="text"
                      value={agesChildren}
                      onChange={(e) => setAgesChildren(e.target.value)}
                      className="w-full border-none outline-none text-[#800020] text-[11px] bg-transparent"
                    />
                  </td>
                </tr>
                <tr>
                  <td className="border-2 border-[#800020] px-1.5 py-0.5 font-bold text-[#800020]">
                    Father's Name
                  </td>
                  <td colSpan={9} className="border-2 border-[#800020] px-1 py-0.5">
                    <input
                      type="text"
                      value={fatherName}
                      onChange={(e) => setFatherName(e.target.value)}
                      className="w-full border-none outline-none text-[#800020] text-[11px] bg-transparent uppercase"
                    />
                  </td>
                </tr>
                <tr>
                  <td className="border-2 border-[#800020] px-1.5 py-0.5 font-bold text-[#800020]">
                    Mother's Name
                  </td>
                  <td colSpan={9} className="border-2 border-[#800020] px-1 py-0.5">
                    <input
                      type="text"
                      value={motherName}
                      onChange={(e) => setMotherName(e.target.value)}
                      className="w-full border-none outline-none text-[#800020] text-[11px] bg-transparent uppercase"
                    />
                  </td>
                </tr>
                <tr>
                  <td className="border-2 border-[#800020] px-1.5 py-0.5 font-bold text-[#800020]">
                    Name Of Spouse
                  </td>
                  <td colSpan={9} className="border-2 border-[#800020] px-1 py-0.5">
                    <input
                      type="text"
                      value={spouseName}
                      onChange={(e) => setSpouseName(e.target.value)}
                      className="w-full border-none outline-none text-[#800020] text-[11px] bg-transparent uppercase"
                    />
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
                {experiences.map((exp, idx) => (
                  <tr key={idx}>
                    <td className="border-2 border-[#800020] py-0.5 text-center font-bold text-[#800020]">
                      {exp.no}
                    </td>
                    <td className="border-2 border-[#800020] px-1 py-0.5">
                      <input
                        type="text"
                        value={exp.years}
                        onChange={(e) => handleExperienceChange(idx, 'years', e.target.value)}
                        className="w-full border-none outline-none text-[#800020] text-[11px] bg-transparent"
                      />
                    </td>
                    <td className="border-2 border-[#800020] px-1 py-0.5">
                      <input
                        type="text"
                        value={exp.place}
                        onChange={(e) => handleExperienceChange(idx, 'place', e.target.value)}
                        className="w-full border-none outline-none text-[#800020] text-[11px] bg-transparent"
                      />
                    </td>
                    <td className="border-2 border-[#800020] px-1 py-0.5">
                      <input
                        type="text"
                        value={exp.position}
                        onChange={(e) => handleExperienceChange(idx, 'position', e.target.value)}
                        className="w-full border-none outline-none text-[#800020] text-[11px] bg-transparent font-semibold"
                      />
                    </td>
                  </tr>
                ))}
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
                  <td className="border-2 border-[#800020] px-1 py-0.5">
                    <textarea
                      rows={1}
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                      className="w-full border-none outline-none text-[#800020] text-[11px] bg-transparent resize-none h-[28px]"
                    />
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
                  <td className="border-2 border-[#800020] px-1 py-0.5 w-[35%]">
                    <input
                      type="text"
                      value={lastWorkPlaceAbroad}
                      onChange={(e) => setLastWorkPlaceAbroad(e.target.value)}
                      className="w-full border-none outline-none text-[#800020] text-[11px] bg-transparent"
                    />
                  </td>
                  <td className="border-2 border-[#800020] px-1.5 py-0.5 font-bold w-[15%] text-[#800020]">
                    Returned On
                  </td>
                  <td className="border-2 border-[#800020] px-1 py-0.5 w-[20%] relative">
                    <div className="flex items-center">
                      <input
                        type="text"
                        value={returnedOn}
                        onChange={(e) => setReturnedOn(e.target.value)}
                        placeholder="dd/mm/yyyy"
                        className="w-full border-none outline-none text-[#800020] text-[11px] bg-transparent"
                      />
                      <input
                        type="date"
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val) {
                            const [y, m, d] = val.split('-');
                            setReturnedOn(`${d}/${m}/${y}`);
                          }
                        }}
                        className="opacity-0 w-5 h-5 absolute right-1 cursor-pointer print:hidden"
                      />
                      <span className="text-[10px] pointer-events-none print:hidden">📅</span>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>

            {/* FOOTER */}
            <div className="mt-auto pt-1">
              <div className="flex justify-between items-end">
                <div className="text-[#800020] font-black text-[11.5px] flex items-center gap-1">
                  <span>Register Date:</span>
                  <div className="border-b-2 border-[#800020] w-[110px] relative flex items-center">
                    <input
                      type="text"
                      value={regDate}
                      onChange={(e) => setRegDate(e.target.value)}
                      placeholder="dd/mm/yyyy"
                      className="w-full border-none outline-none text-[#800020] font-black text-[11.5px] bg-transparent"
                    />
                    <input
                      type="date"
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val) {
                          const [y, m, d] = val.split('-');
                          setRegDate(`${d}/${m}/${y}`);
                        }
                      }}
                      className="opacity-0 w-5 h-5 absolute right-0 cursor-pointer print:hidden"
                    />
                    <span className="text-[10px] pointer-events-none print:hidden">📅</span>
                  </div>
                </div>

                <div className="border-t-2 border-[#800020] w-[240px] text-center pt-1 text-[#800020] text-[10.5px] font-black">
                  <input
                    type="text"
                    value={empSignature}
                    onChange={(e) => setEmpSignature(e.target.value)}
                    placeholder="Type Name or Sign"
                    className="w-full text-center border-none outline-none text-[#800020] font-bold text-[11px] bg-transparent"
                  />
                  <span className="block mt-0.5">Employee Signature / Name</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Action Bar (hidden during print) */}
      <div className="bg-slate-900 text-white p-4 rounded-2xl flex flex-wrap items-center justify-between gap-3 shadow-lg print:hidden">
        <div className="text-xs text-slate-300">
          <span className="font-bold text-white block sm:inline">
            {editingApplicantId
              ? `Updating candidate (${editingApplicantId})?`
              : 'Completed candidate details?'}
          </span>{' '}
          Click{' '}
          <span className="text-amber-400 font-bold">
            {editingApplicantId ? 'Save Changes to Database' : 'Register Candidate'}
          </span>{' '}
          to save directly into Candidate Records database.
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleDownloadJpeg}
            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3 py-2.5 rounded-xl transition cursor-pointer shadow-xs active:scale-98"
          >
            <ImageIcon className="w-3.5 h-3.5" />
            <span>Download JPEG</span>
          </button>
          <button
            type="button"
            onClick={handleDownloadPdf}
            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-3 py-2.5 rounded-xl transition cursor-pointer shadow-xs active:scale-98"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download PDF</span>
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-3 py-2.5 rounded-xl transition cursor-pointer shadow-xs active:scale-98"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Form</span>
          </button>
          <button
            type="button"
            onClick={() => handleSubmit()}
            disabled={isSubmitting}
            className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-white text-xs font-black px-5 py-2.5 rounded-xl transition cursor-pointer shadow-md active:scale-98"
          >
            <Save className="w-4 h-4" />
            <span>
              {isSubmitting
                ? 'Saving...'
                : editingApplicantId
                ? 'Save Changes to Database'
                : 'Register Candidate (Submit)'}
            </span>
            <ArrowRight className="w-3.5 h-3.5 text-white/80" />
          </button>
        </div>
      </div>

      {/* AI Extraction Modal */}
      <SectionDocumentUploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        sectionTitle="Official Candidate Registration Form"
        sectionContext="registration"
        onSuccess={(data?: any) => {
          if (data) {
            if (data.full_name || data.surname) {
              setSurname(data.surname || data.full_name?.split(' ')[0] || '');
              setOtherName(data.other_name || data.full_name?.split(' ').slice(1).join(' ') || '');
            }
            if (data.gender) setGender(data.gender === 'Female' ? 'Female' : 'Male');
            if (data.passport_number) setPassportNo(data.passport_number);
            if (data.date_of_birth) setDob(formatDateValue(data.date_of_birth));
            if (data.age) setAge(String(data.age));
            if (data.mobile_number) setMobile(data.mobile_number);
            if (data.address) setAddress(data.address);
            if (data.living_place) setPlaceOfBirth(data.living_place);
            if (data.nationality) setNationality(data.nationality);
            if (data.religion) setReligion(data.religion);
            if (data.civil_status) setCivilStatus(data.civil_status);
            if (data.nic_number || data.nicNo) setNicNo(data.nic_number || data.nicNo);
            if (data.preferred_job_category || data.post) setPost(data.preferred_job_category || data.post);
            if (data.register_card_no || data.ref_no) setRefNo(data.register_card_no || data.ref_no);
            if (data.passport_expiry) setDateOfExpiry(formatDateValue(data.passport_expiry));
            if (data.date_of_issue) setDateOfIssue(formatDateValue(data.date_of_issue));
            if (data.remarks) setRemarks(data.remarks);
            if (data.register_by) setEmpSignature(data.register_by);
          }
          showNotification('success', 'Candidate registration form updated according to the uploaded document.');
        }}
        showNotification={showNotification}
      />
    </div>
  );
};
