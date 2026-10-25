import React, { useState, useRef, useEffect } from 'react';
import { LocalOCRPanel } from './LocalOCRPanel';
import type { OCRSuggestion } from '../utils/ocrFields';
import {
  UploadCloud,
  FileText,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Calendar,
  Clock,
  User,
  Plane
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  sectionTitle: string;
  sectionContext?: 'embassy_pending' | 'embassy' | 'embassy_refusal' | 'departure_pending' | 'departure' | 'applicants' | 'checklist' | 'english' | 'all_master' | 'followup' | 'registration';
  onSuccess: (extractedData?: any) => void;
  showNotification: (type: 'success' | 'error' | 'info', text: string) => void;
}

export const SectionDocumentUploadModal: React.FC<Props> = ({
  isOpen,
  onClose,
  sectionTitle,
  sectionContext = 'applicants',
  onSuccess,
  showNotification
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractedData, setExtractedData] = useState<any>(null);
  const [matchingMessage, setMatchingMessage] = useState<string | null>(null);
  const [localSuggestions, setLocalSuggestions] = useState<OCRSuggestion[]>([]);
  const [candidateRecords, setCandidateRecords] = useState<Array<{applicant_id:string;full_name:string}>>([]);
  const [targetCandidate, setTargetCandidate] = useState('');
  const [fallbackKey, setFallbackKey] = useState(0);
  useEffect(() => { if (isOpen) fetch('/api/applicants').then(r => r.json()).then(list => setCandidateRecords(Array.isArray(list) ? list : [])).catch(() => {}); }, [isOpen]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const applyReviewedOcr = async () => {
    if (!targetCandidate) { showNotification('error', 'Select the exact candidate first. OCR will not create or guess a candidate.'); return; }
    if (!window.confirm('Apply these reviewed OCR values to the selected candidate? Verify the name and passport before proceeding.')) return;
    setIsProcessing(true);
    try {
      const fields = Object.fromEntries(localSuggestions.map(item => [item.field, item.value]));
      const response = await fetch(`/api/applicants/${encodeURIComponent(targetCandidate)}/ocr-fields`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({fields}) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not apply reviewed fields.');
      showNotification('success', `Applied ${result.fieldsApplied.length} reviewed field(s) to the selected candidate.`);
      onSuccess(result);
      onClose();
    } catch (error) { showNotification('error', error instanceof Error ? error.message : 'Could not apply reviewed fields.'); }
    finally { setIsProcessing(false); }
  };

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    const isJpeg = file.type.startsWith('image/') || /\.(jpe?g|png|webp)$/i.test(file.name);

    if (!isPdf && !isJpeg) {
      showNotification('error', 'Please upload a PDF document or a JPEG/PNG image.');
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      showNotification('error', 'File size exceeds 15MB limit.');
      return;
    }

    setSelectedFile(file);
    setExtractedData(null);
    setMatchingMessage(null);

    const reader = new FileReader();
    reader.onloadend = () => {
      setFilePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleProcessExtraction = async () => {
    if (!selectedFile || !filePreview) {
      showNotification('error', 'Please select a document first.');
      return;
    }

    setIsProcessing(true);
    try {
      const res = await fetch('/api/documents/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileData: filePreview,
          mimeType: selectedFile.type,
          fileName: selectedFile.name,
          sectionContext,
          autoSave: false
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setExtractedData(data.extracted);
        if (data.message) {
          setMatchingMessage(data.message);
        }
        showNotification('success', data.message || `Successfully extracted fields from ${selectedFile.name}`);
      } else {
        showNotification('error', (data.error || 'AI extraction failed.') + ' Running local OCR for review.');
        setFallbackKey(key => key + 1);
      }
    } catch (err: any) {
      showNotification('error', err.message + ' Running local OCR for review.');
      setFallbackKey(key => key + 1);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleApplyAndFinish = async () => {
    if (!extractedData) return;
    if (!targetCandidate) { showNotification('error', 'Select the exact existing candidate before applying reviewed fields.'); return; }
    const map: Record<string,string> = { surname:'surname', nic_number:'nic_number', passport_number:'passportNo', passport_expiry:'passportValidTo', date_of_birth:'dateOfBirth', address:'residence', mobile_number:'phone', email:'email', nationality:'nationality', civil_status:'maritalStatus', preferred_job_category:'professionalSkill', company_name:'company_name', se_number:'se_number', e_number:'e_number', appointment_date:'appointment_date', appointment_time:'appointment_time', police_certified_date:'police_certified_date', police_certify_expire_date:'police_certify_expire_date' };
    const fields: Record<string,string> = {};
    for (const [source, target] of Object.entries(map)) if (typeof extractedData[source] === 'string' && extractedData[source].trim()) fields[target] = extractedData[source].trim();
    if (typeof extractedData.full_name === 'string' && extractedData.full_name.trim()) {
      const words = extractedData.full_name.trim().split(/\s+/);
      if (fields.surname) fields.name = extractedData.full_name.trim().replace(new RegExp(`\\s+${fields.surname.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'), '').trim();
      else if (words.length > 1) { fields.surname = words.pop()!; fields.name = words.join(' '); }
    }
    if (Object.keys(fields).length === 0) { showNotification('error', 'No supported reviewed fields are available.'); return; }
    if (!window.confirm('Apply the reviewed AI fields to this exact candidate? Double-check name, passport, dates and section values.')) return;
    setIsProcessing(true);
    try {
      const res = await fetch(`/api/applicants/${encodeURIComponent(targetCandidate)}/ocr-fields`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({fields}) });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Could not apply reviewed fields.');
      showNotification('success', `Applied ${result.fieldsApplied.length} reviewed field(s) to the selected candidate.`);
      onSuccess(result);
      onClose();
    } catch (err: any) { showNotification('error', err.message || 'Could not apply reviewed fields.'); }
    finally { setIsProcessing(false); }
  };

  const isEmbassyEmailContext = sectionContext === 'embassy_pending' || sectionContext === 'embassy';
  const isChecklistContext = sectionContext === 'checklist';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col my-auto max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white flex items-center justify-center shadow-xs">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Document Upload & Reviewed Extraction
              </h3>
              <p className="text-[11px] text-slate-500">
                Active in: <strong className="text-slate-800">{sectionTitle}</strong> (Accepts PDF & JPEG)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto space-y-5">
          <LocalOCRPanel className="border-sky-600" incomingFiles={selectedFile ? [selectedFile] : []} incomingKey={fallbackKey} onApply={items => { setLocalSuggestions(items); setMatchingMessage('Review the selected candidate and confirm before updating registry fields.'); }} />
          {localSuggestions.length > 0 && <div className="rounded-xl border border-sky-200 bg-sky-50 p-3 text-xs text-slate-700 space-y-2">
            <strong>Apply local OCR to an existing candidate only</strong>
            <select aria-label="Select exact OCR candidate" value={targetCandidate} onChange={event => setTargetCandidate(event.target.value)} className="w-full rounded border border-sky-300 bg-white p-2"><option value="">Select exact candidate…</option>{candidateRecords.map(item => <option key={item.applicant_id} value={item.applicant_id}>{item.full_name} · {item.applicant_id}</option>)}</select>
            <button type="button" onClick={() => void applyReviewedOcr()} disabled={isProcessing || !targetCandidate} className="rounded bg-sky-700 px-3 py-2 font-bold text-white disabled:opacity-50">Apply reviewed OCR fields</button>
          </div>}

          {/* Context Notice */}
          {isEmbassyEmailContext ? (
            <div className="p-3.5 bg-amber-50/80 border border-amber-200/80 rounded-xl text-xs text-amber-900 flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <strong className="block font-bold">Embassy Appointment Auto-Trigger:</strong>
                When you upload the Embassy Appointment Email (PDF or JPEG) with the candidate's <strong>E-Number</strong>, Gemini AI can suggest the E-Number, extracts the <strong>Appointment Date</strong> and <strong>Appointment Time</strong>, but you must review the values and select the exact candidate before saving. Check section status manually.
              </div>
            </div>
          ) : isChecklistContext ? (
            <div className="p-3.5 bg-amber-50/80 border border-amber-300 rounded-xl text-xs text-amber-950 flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <strong className="block font-bold">Police Clearance & Certified Copy Auto-Detector:</strong>
                Upload candidate <strong>Police Clearance Certificate / Report with Certified Copy (PDF or JPEG)</strong>. The system can suggest the <strong>yellow-highlighted Certify Date</strong>, candidate name, and passport number, calculates the <strong>Police Certify Expire Date</strong>, and requires your review before applying it to the selected candidate.
              </div>
            </div>
          ) : (
            <div className="p-3.5 bg-emerald-50/80 border border-emerald-200/80 rounded-xl text-xs text-emerald-900 flex items-start gap-2.5">
              <Sparkles className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <strong className="block font-bold">Multimodal AI OCR Auto-Fill:</strong>
                Upload candidate bio-data, passport, clearance certificates, or flight tickets in PDF or JPEG. Review all extracted data, select the exact candidate, then apply supported fields. Local OCR is available above when AI fails.
              </div>
            </div>
          )}

          {/* Upload Area */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-6 text-center transition cursor-pointer flex flex-col items-center justify-center gap-2 ${
              selectedFile
                ? 'border-emerald-500 bg-emerald-50/30'
                : 'border-slate-200 hover:border-slate-400 bg-slate-50/50 hover:bg-slate-50'
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".pdf,application/pdf,image/jpeg,image/png,image/jpg"
              className="hidden"
            />
            {selectedFile ? (
              <div className="flex flex-col items-center gap-1.5">
                {selectedFile.type === 'application/pdf' ? (
                  <FileText className="w-10 h-10 text-rose-500" />
                ) : (
                  <ImageIcon className="w-10 h-10 text-emerald-500" />
                )}
                <span className="font-bold text-xs text-slate-800">{selectedFile.name}</span>
                <span className="text-[10px] text-slate-400 font-mono">
                  {(selectedFile.size / 1024).toFixed(1)} KB · Click to change file
                </span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-1.5">
                <UploadCloud className="w-10 h-10 text-slate-400" />
                <span className="font-bold text-xs text-slate-700">
                  Click or drag & drop document here
                </span>
                <span className="text-[11px] text-slate-400">
                  Supports PDF document files or JPEG / PNG images (up to 15MB)
                </span>
              </div>
            )}
          </div>

          {/* Action Trigger */}
          {selectedFile && !extractedData && (
            <div className="flex justify-end">
              <button
                onClick={handleProcessExtraction}
                disabled={isProcessing}
                className="flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-xs transition cursor-pointer disabled:opacity-50"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Extracting with Gemini AI...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Run AI extraction (review required)</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Recognition Banner if matched */}
          {matchingMessage && (
            <div className="p-3.5 bg-emerald-100/80 border border-emerald-300 rounded-xl text-xs text-emerald-900 font-medium flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>{matchingMessage}</span>
            </div>
          )}

          {extractedData && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-slate-700 space-y-2">
            <strong>Select the exact existing candidate for the reviewed AI fields</strong>
            <select aria-label="Select exact AI candidate" value={targetCandidate} onChange={event => setTargetCandidate(event.target.value)} className="w-full rounded border border-emerald-300 bg-white p-2"><option value="">Select exact candidate…</option>{candidateRecords.map(item => <option key={item.applicant_id} value={item.applicant_id}>{item.full_name} · {item.applicant_id}</option>)}</select>
          </div>}

          {/* Extracted Fields Preview & Confirmation */}
          {extractedData && (
            <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  Extracted Structured Fields
                </span>
                <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-bold">
                  REVIEW BEFORE APPLYING
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase block">Candidate Name</label>
                  <input
                    type="text"
                    value={extractedData.full_name || ''}
                    onChange={(e) => setExtractedData({ ...extractedData, full_name: e.target.value })}
                    className="w-full bg-white border border-slate-200 rounded-lg p-1.5 font-bold text-slate-800 text-xs"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase block">Passport No</label>
                  <input
                    type="text"
                    value={extractedData.passport_number || ''}
                    onChange={(e) => setExtractedData({ ...extractedData, passport_number: e.target.value })}
                    className="w-full bg-white border border-slate-200 rounded-lg p-1.5 font-mono font-bold text-slate-800 text-xs"
                  />
                </div>

                {/* Police Clearance & Certify Date Fields */}
                {(extractedData.police_certified_date || extractedData.police_certify_expire_date || isChecklistContext) && (
                  <>
                    <div className="bg-amber-50/70 p-2 rounded-lg border border-amber-200">
                      <label className="text-[10px] font-bold text-amber-800 uppercase block">Police Report Certify Date</label>
                      <input
                        type="text"
                        value={extractedData.police_certified_date || ''}
                        onChange={(e) => setExtractedData({ ...extractedData, police_certified_date: e.target.value })}
                        placeholder="YYYY-MM-DD or DD/MM/YYYY"
                        className="w-full bg-white border border-amber-300 rounded-md p-1.5 font-mono font-bold text-amber-950 text-xs"
                      />
                      <span className="text-[9px] text-amber-700">Yellow-highlighted certify / attestation stamp</span>
                    </div>
                    <div className="bg-amber-50/70 p-2 rounded-lg border border-amber-200">
                      <label className="text-[10px] font-bold text-amber-800 uppercase block">Police Certify Expire Date</label>
                      <input
                        type="text"
                        value={extractedData.police_certify_expire_date || ''}
                        onChange={(e) => setExtractedData({ ...extractedData, police_certify_expire_date: e.target.value })}
                        placeholder="YYYY-MM-DD"
                        className="w-full bg-white border border-amber-300 rounded-md p-1.5 font-mono font-bold text-amber-950 text-xs"
                      />
                      <span className="text-[9px] text-amber-700">Applied only after review and candidate selection</span>
                    </div>
                  </>
                )}

                {/* Embassy Fields */}
                {(extractedData.e_number || isEmbassyEmailContext) && (
                  <>
                    <div>
                      <label className="text-[10px] font-bold text-blue-600 uppercase block">E-Number</label>
                      <input
                        type="text"
                        value={extractedData.e_number || ''}
                        onChange={(e) => setExtractedData({ ...extractedData, e_number: e.target.value })}
                        className="w-full bg-blue-50/50 border border-blue-200 rounded-lg p-1.5 font-mono font-bold text-blue-900 text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-emerald-600 uppercase block">SE-Number</label>
                      <input
                        type="text"
                        value={extractedData.se_number || ''}
                        onChange={(e) => setExtractedData({ ...extractedData, se_number: e.target.value })}
                        className="w-full bg-emerald-50/50 border border-emerald-200 rounded-lg p-1.5 font-mono font-bold text-emerald-900 text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-purple-600 uppercase block">Appointment Date</label>
                      <input
                        type="text"
                        value={extractedData.appointment_date || ''}
                        onChange={(e) => setExtractedData({ ...extractedData, appointment_date: e.target.value })}
                        placeholder="YYYY-MM-DD or DD.MM.YYYY"
                        className="w-full bg-purple-50/50 border border-purple-200 rounded-lg p-1.5 font-mono font-bold text-purple-900 text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-purple-600 uppercase block">Appointment Time</label>
                      <input
                        type="text"
                        value={extractedData.appointment_time || ''}
                        onChange={(e) => setExtractedData({ ...extractedData, appointment_time: e.target.value })}
                        placeholder="e.g. 10.30AM"
                        className="w-full bg-purple-50/50 border border-purple-200 rounded-lg p-1.5 font-mono font-bold text-purple-900 text-xs"
                      />
                    </div>
                  </>
                )}

                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase block">Job Category</label>
                  <input
                    type="text"
                    value={extractedData.preferred_job_category || ''}
                    onChange={(e) => setExtractedData({ ...extractedData, preferred_job_category: e.target.value })}
                    className="w-full bg-white border border-slate-200 rounded-lg p-1.5 font-semibold text-slate-800 text-xs"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase block">Company Name</label>
                  <input
                    type="text"
                    value={extractedData.company_name || ''}
                    onChange={(e) => setExtractedData({ ...extractedData, company_name: e.target.value })}
                    className="w-full bg-white border border-slate-200 rounded-lg p-1.5 font-semibold text-slate-800 text-xs"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase block">Living Place</label>
                  <input
                    type="text"
                    value={extractedData.living_place || ''}
                    onChange={(e) => setExtractedData({ ...extractedData, living_place: e.target.value })}
                    className="w-full bg-white border border-slate-200 rounded-lg p-1.5 text-slate-800 text-xs"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase block">Contact / Mobile</label>
                  <input
                    type="text"
                    value={extractedData.mobile_number || ''}
                    onChange={(e) => setExtractedData({ ...extractedData, mobile_number: e.target.value })}
                    className="w-full bg-white border border-slate-200 rounded-lg p-1.5 text-slate-800 text-xs"
                  />
                </div>
                {extractedData.status && (
                  <div className="col-span-2">
                    <label className="text-[10px] font-bold text-rose-600 uppercase block">Status / Cancellation Reason</label>
                    <input
                      type="text"
                      value={extractedData.status || ''}
                      onChange={(e) => setExtractedData({ ...extractedData, status: e.target.value })}
                      className="w-full bg-rose-50 border border-rose-200 rounded-lg p-1.5 font-bold text-rose-900 text-xs"
                    />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50/60">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 transition cursor-pointer"
          >
            Cancel
          </button>
          {extractedData && (
            <button
              onClick={handleApplyAndFinish}
              disabled={isProcessing || !targetCandidate}
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-xs transition cursor-pointer active:scale-98"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Apply reviewed fields to selected candidate</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
