import React, { useState } from 'react';
import {
  Upload,
  FileText,
  Image as ImageIcon,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Clock,
  User,
  HeartHandshake,
  Check,
  RefreshCw,
  FileCheck,
  ShieldCheck,
  Printer,
  Eye,
  Plus
} from 'lucide-react';

interface Props {
  onSuccess: () => void;
  showNotification: (type: 'success' | 'error' | 'info', text: string) => void;
}

export const DocumentUploadExtractor: React.FC<Props> = ({
  onSuccess,
  showNotification
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Extracted Form State
  const [formData, setFormData] = useState<any>({
    full_name: '',
    surname: '',
    nic_number: '',
    passport_number: '',
    passport_expiry: '2034-05-20',
    date_of_birth: '1995-06-15',
    age: 31,
    gender: 'Male',
    religion: 'Islam',
    civil_status: 'Married',
    address: '120 Galle Road, Colombo',
    living_place: 'Colombo',
    mobile_number: '+94 77 123 4567',
    preferred_job_category: 'Kitchen Helper',
    experienced: 'Yes',
    applied_as_couple: 'No',
    partner_name: '',
    register_card_no: 'RC-2610',
    register_by: 'Althaf Hussain',
    police_report_ready: true,
    remarks: 'Auto-extracted from document'
  });

  const [hasExtracted, setHasExtracted] = useState(false);

  // Handle File Input
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    setFile(selected);
    const reader = new FileReader();
    reader.onload = () => {
      setFilePreview(reader.result as string);
    };
    reader.readAsDataURL(selected);
  };

  // Run AI Extraction via /api/documents/extract
  const handleRunExtraction = async () => {
    if (!filePreview && !file) {
      showNotification('error', 'Please select a PDF or JPEG document first');
      return;
    }

    setIsExtracting(true);
    showNotification('info', 'Analyzing document with Gemini AI & extracting candidate fields...');

    try {
      const res = await fetch('/api/documents/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileData: filePreview,
          mimeType: file?.type || (file?.name.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg'),
          fileName: file?.name || 'document'
        })
      });

      const data = await res.json();
      if (data.success && data.extracted) {
        setFormData({
          ...formData,
          ...data.extracted
        });
        setHasExtracted(true);
        showNotification('success', `Successfully extracted details for ${data.extracted.full_name || 'Candidate'}!`);
      } else {
        showNotification('error', data.error || 'Failed to extract document information');
      }
    } catch (err: any) {
      showNotification('error', `Extraction error: ${err.message}`);
    } finally {
      setIsExtracting(false);
    }
  };

  // Save to Database
  const handleSaveToMasterRegistry = async () => {
    if (!formData.full_name) {
      showNotification('error', 'Full Name is required');
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        applicant: {
          gender: formData.gender,
          full_name: formData.full_name,
          surname: formData.surname || formData.full_name.split(' ').pop() || '',
          other_name: formData.full_name.split(' ').slice(0, -1).join(' '),
          nic_number: formData.nic_number,
          date_of_birth: formData.date_of_birth,
          age: Number(formData.age) || 30,
          religion: formData.religion || 'Islam',
          nationality: 'Sri Lankan',
          civil_status: formData.civil_status || 'Married',
          address: formData.address || 'Sri Lanka',
          living_place: formData.living_place || 'Colombo',
          mobile_number: formData.mobile_number || '+94771234567',
          telephone_home: '',
          alternate_phone: '',
          email: `${formData.full_name.toLowerCase().replace(/ /g, '.')}@example.com`,
          preferred_job_category: formData.preferred_job_category || 'General',
          english_status: 'Good',
          registration_date: new Date().toISOString().split('T')[0],
          registration_source: 'Document AI Extractor',
          closed_remarks: formData.remarks || 'Registered via Document Extraction',
          register_card_no: formData.register_card_no || `RC-${Math.floor(26000 + Math.random() * 900)}`,
          register_by: formData.register_by || 'Althaf Hussain',
          applied_as_couple: formData.applied_as_couple || 'No',
          partner_name: formData.partner_name || ''
        },
        passport: {
          passport_number: formData.passport_number || 'PENDING',
          place_of_birth: 'Colombo',
          date_of_issue: '2024-01-10',
          date_of_expiry: formData.passport_expiry || '2034-01-10',
          passport_status: 'With Agency',
          remarks: 'Extracted from document'
        },
        checklist: {
          police_report_ready: Boolean(formData.police_report_ready),
          police_report_remarks: formData.police_report_ready ? 'OK - Verified' : 'Pending'
        },
        experiences: formData.experienced === 'Yes' ? [
          {
            sequence: 1,
            from_date: '2022',
            to_date: '2024',
            company_place: 'Hospitality / Technical Establishment',
            position: formData.preferred_job_category,
            duration: '2 Years',
            country: 'Sri Lanka',
            remarks: 'Experienced'
          }
        ] : []
      };

      const res = await fetch('/api/applicants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (res.ok) {
        showNotification(
          'success',
          `Candidate ${formData.full_name} registered successfully into Master Registry! (ID: ${data.applicantId})`
        );
        onSuccess();
      } else {
        showNotification('error', data.error || 'Failed to save applicant');
      }
    } catch (err: any) {
      showNotification('error', err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 sm:p-6 space-y-6">
      {/* 1. TOP HEADER */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-purple-900 text-purple-300">
              <Sparkles className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                Document Upload & Smart Data Extractor
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Upload candidate PDF or JPEG documents to automatically extract bio-data, passport numbers, and populate relevant registration fields.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-mono font-bold px-3 py-1.5 rounded-lg bg-purple-50 text-purple-700 border border-purple-200">
            Powered by Gemini Multimodal OCR
          </span>
        </div>
      </div>

      {/* 2. DROP ZONE & ACTION */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Upload Column (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="border-2 border-dashed border-slate-300 hover:border-purple-400 bg-slate-50/50 hover:bg-purple-50/20 rounded-2xl p-6 transition-all flex flex-col items-center justify-center text-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white shadow-xs border border-slate-200 flex items-center justify-center text-slate-700">
              {file?.type?.includes('image') ? (
                <ImageIcon className="w-6 h-6 text-purple-600" />
              ) : (
                <FileText className="w-6 h-6 text-emerald-600" />
              )}
            </div>

            <div>
              <span className="text-xs font-bold text-slate-800 block">
                {file ? file.name : 'Upload PDF or JPEG Document'}
              </span>
              <span className="text-[11px] text-slate-400 block mt-0.5">
                Passport copies, SLBFE registration forms, bio-data sheets (PDF, JPG, PNG)
              </span>
            </div>

            <input
              type="file"
              id="file-doc-input"
              accept=".pdf,.jpeg,.jpg,.png"
              onChange={handleFileChange}
              className="hidden"
            />
            <label
              htmlFor="file-doc-input"
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer active:scale-98 flex items-center gap-2"
            >
              <Upload className="w-3.5 h-3.5 text-emerald-400" />
              <span>{file ? 'Change Document' : 'Browse Document'}</span>
            </label>
          </div>

          {/* Extract Button */}
          <button
            onClick={handleRunExtraction}
            disabled={!file || isExtracting}
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs py-3 px-4 rounded-xl shadow-md transition cursor-pointer active:scale-98 disabled:opacity-50"
          >
            {isExtracting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Extracting Fields with Gemini AI...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Extract Details & Auto-Fill Form</span>
              </>
            )}
          </button>

          {/* File info card */}
          {file && (
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">File Name:</span>
                <span className="font-bold text-slate-800 truncate max-w-[180px]">{file.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">File Size:</span>
                <span className="font-mono text-slate-700">{(file.size / 1024).toFixed(1)} KB</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Format:</span>
                <span className="font-mono uppercase text-slate-700">{file.type || 'Document'}</span>
              </div>
            </div>
          )}
        </div>

        {/* Form Column (7 cols) */}
        <div className="lg:col-span-7 bg-slate-50/70 p-5 rounded-2xl border border-slate-200 space-y-4">
          <div className="flex justify-between items-center pb-2 border-b border-slate-200">
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <FileCheck className="w-4 h-4 text-emerald-600" />
              <span>Extracted Candidate Fields (Review & Edit)</span>
            </h3>
            {hasExtracted && (
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                <span>Ready to Save</span>
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Full Name</label>
              <input
                type="text"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900"
                placeholder="Candidate Full Name"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Passport Number</label>
              <input
                type="text"
                value={formData.passport_number}
                onChange={(e) => setFormData({ ...formData, passport_number: e.target.value })}
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-800"
                placeholder="e.g. N1234567"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Gender</label>
              <select
                value={formData.gender}
                onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800"
              >
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Preferred Job Category</label>
              <input
                type="text"
                value={formData.preferred_job_category}
                onChange={(e) => setFormData({ ...formData, preferred_job_category: e.target.value })}
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold"
                placeholder="e.g. Kitchen Helper, Welder"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Date of Birth / Age</label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="date"
                  value={formData.date_of_birth}
                  onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
                  className="w-full bg-white border border-slate-300 rounded-xl px-2 py-2 text-xs font-mono"
                />
                <input
                  type="number"
                  placeholder="Age"
                  value={formData.age}
                  onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                  className="w-full bg-white border border-slate-300 rounded-xl px-2 py-2 text-xs font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">NIC Number</label>
              <input
                type="text"
                value={formData.nic_number}
                onChange={(e) => setFormData({ ...formData, nic_number: e.target.value })}
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono"
                placeholder="199510301923"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Mobile Contact</label>
              <input
                type="text"
                value={formData.mobile_number}
                onChange={(e) => setFormData({ ...formData, mobile_number: e.target.value })}
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs"
                placeholder="+94 77 123 4567"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Living Place / City</label>
              <input
                type="text"
                value={formData.living_place}
                onChange={(e) => setFormData({ ...formData, living_place: e.target.value })}
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs"
                placeholder="Colombo, Kurunegala, etc."
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Apply as Couple?</label>
              <select
                value={formData.applied_as_couple}
                onChange={(e) => setFormData({ ...formData, applied_as_couple: e.target.value })}
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold"
              >
                <option value="No">No (Single)</option>
                <option value="Yes">Yes (Couple)</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Register Card No</label>
              <input
                type="text"
                value={formData.register_card_no}
                onChange={(e) => setFormData({ ...formData, register_card_no: e.target.value })}
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-bold text-emerald-800"
                placeholder="RC-2610"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Register By (Employee)</label>
              <input
                type="text"
                value={formData.register_by}
                onChange={(e) => setFormData({ ...formData, register_by: e.target.value })}
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold"
                placeholder="Althaf Hussain"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Experienced?</label>
              <select
                value={formData.experienced}
                onChange={(e) => setFormData({ ...formData, experienced: e.target.value })}
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold"
              >
                <option value="Yes">Yes (Experienced)</option>
                <option value="No">No (Fresh)</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="police-chk"
              checked={formData.police_report_ready}
              onChange={(e) => setFormData({ ...formData, police_report_ready: e.target.checked })}
              className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
            />
            <label htmlFor="police-chk" className="text-xs font-semibold text-slate-700 cursor-pointer">
              Police Report Ready & Certified (OK)
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <button
              onClick={handleSaveToMasterRegistry}
              disabled={isSaving || !formData.full_name}
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs py-2.5 px-5 rounded-xl shadow-xs transition cursor-pointer active:scale-98 disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving to Database...</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Save & Register Into Master Registry</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
