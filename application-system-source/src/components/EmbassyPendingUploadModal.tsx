import React, { useState, useRef } from 'react';
import { LocalOCRPanel } from './LocalOCRPanel';
import type { OCRSuggestion } from '../utils/ocrFields';
import {
  UploadCloud,
  FileText,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Building,
  Calendar,
  Layers,
  Plus,
  Trash2,
  Download
} from 'lucide-react';
import { EMBASSY_PENDING_PDF_DATA, EmbassyPendingCandidate } from '../data/embassyPendingSeedData';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  showNotification: (type: 'success' | 'error' | 'info', text: string) => void;
}

export const EmbassyPendingUploadModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onSuccess,
  showNotification
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [extractedRows, setExtractedRows] = useState<EmbassyPendingCandidate[] | null>(null);
  const [fallbackKey, setFallbackKey] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    const isImage = file.type.startsWith('image/') || /\.(jpe?g|png|webp)$/i.test(file.name);

    if (!isPdf && !isImage) {
      showNotification('error', 'Please upload a PDF document or a JPEG/PNG image.');
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      showNotification('error', 'File size exceeds 20MB limit.');
      return;
    }

    setSelectedFile(file);
    setExtractedRows(null);

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
      // Call backend AI extractor
      const res = await fetch('/api/documents/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileData: filePreview,
          mimeType: selectedFile.type,
          fileName: selectedFile.name,
          sectionContext: 'embassy_pending'
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'AI extraction was unavailable. Use local OCR below and review the result.');

      // If multi-row data returned or if PDF matches Embassy Pending roster, populate parsed rows
      if (data && Array.isArray(data.extracted_list) && data.extracted_list.length > 0) {
        setExtractedRows(data.extracted_list);
        showNotification('success', `AI successfully extracted ${data.extracted_list.length} candidate rows from ${selectedFile.name}`);
      } else if (data && data.extracted && data.extracted.full_name) {
        // Single candidate extraction
        const ext = data.extracted;
        const seNum = ext.se_number || '';
        const seGrp = seNum.slice(0, 5).toUpperCase();
        const singleRow: EmbassyPendingCandidate = {
          no: 1,
          full_name: ext.full_name.toUpperCase(),
          passport_number: ext.passport_number || '',
          se_number: seNum,
          company_name: ext.company_name || '',
          embassy_applied_date: ext.appointment_date || '',
          e_number: ext.e_number || '',
          se_group: seGrp
        };
        setExtractedRows([singleRow]);
        showNotification('success', `Extracted Embassy details for ${singleRow.full_name}`);
      } else {
        throw new Error('No candidate rows found in the document. Try local OCR, then review and complete the fields.');
      }
    } catch (err: any) {
      showNotification('error', (err.message || 'AI extraction failed.') + ' Running local OCR for review.');
      setFallbackKey(key => key + 1);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUpdateRow = (index: number, field: keyof EmbassyPendingCandidate, value: string) => {
    if (!extractedRows) return;
    const updated = [...extractedRows];
    (updated[index] as any)[field] = value;
    if (field === 'se_number') {
      updated[index].se_group = value.slice(0, 5).toUpperCase();
    }
    setExtractedRows(updated);
  };

  const handleRemoveRow = (index: number) => {
    if (!extractedRows) return;
    const updated = extractedRows.filter((_, idx) => idx !== index);
    setExtractedRows(updated);
  };

  const handleSaveToEmbassyPending = async () => {
    if (!extractedRows || extractedRows.length === 0) {
      showNotification('error', 'No candidate records to import.');
      return;
    }

    const missing = extractedRows.findIndex(row => !row.full_name?.trim() || !row.passport_number?.trim() || !row.se_number?.trim() || !row.company_name?.trim() || !row.embassy_applied_date?.trim());
    if (missing >= 0) { showNotification('error', `Row ${missing + 1} is incomplete. Check name, passport, SE number, company, and applied date before importing.`); return; }
    if (!window.confirm(`Import ${extractedRows.length} reviewed row(s) into Embassy Pending? Verify each candidate and identifier first.`)) return;
    setIsSaving(true);
    try {
      const res = await fetch('/api/v1/embassy/batch-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ records: extractedRows })
      });

      const json = await res.json();
      if (res.ok && json.success) {
        showNotification('success', `Successfully imported and updated ${json.total || extractedRows.length} records into Embassy Pending!`);
        onSuccess();
        onClose();
      } else {
        showNotification('error', json.message || 'Failed to import embassy pending records.');
      }
    } catch (err: any) {
      showNotification('error', `Import error: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Group summary for extracted rows
  const groupStats = extractedRows ? Object.entries(
    extractedRows.reduce((acc, row) => {
      acc[row.se_group] = (acc[row.se_group] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  ).sort(([a], [b]) => a.localeCompare(b)) : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-900 text-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-400/20 text-amber-300 border border-amber-400/30">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base tracking-tight">
                Embassy Pending: AI Document Upload & Extraction
              </h3>
              <p className="text-xs text-slate-300">
                Upload Embassy PDF rosters, SE lists or appointment emails to automatically extract candidate records
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-800">
          {!extractedRows ? (
            <div className="space-y-6">
              <LocalOCRPanel incomingFiles={selectedFile ? [selectedFile] : []} incomingKey={fallbackKey} onApply={(items: OCRSuggestion[]) => {
                const values = Object.fromEntries(items.map(item => [item.field, item.value]));
                const fullName = [values.name, values.surname].filter(Boolean).join(' ');
                setExtractedRows([{ no: 1, full_name: fullName, passport_number: values.passportNo || '', se_number: values.se_number || '', company_name: values.company_name || '', embassy_applied_date: values.embassy_applied_date || '', e_number: values.e_number || '', se_group: (values.se_number || '').slice(0,5).toUpperCase() }]);
                showNotification('info', 'Review the OCR values below. Complete missing required fields before importing; nothing was saved yet.');
              }} />
              {/* Dropzone */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-3xl p-8 sm:p-12 text-center transition cursor-pointer flex flex-col items-center justify-center gap-3 ${
                  selectedFile
                    ? 'border-emerald-400 bg-emerald-50/40'
                    : 'border-slate-300 hover:border-amber-400 bg-slate-50/70 hover:bg-amber-50/30'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf,image/jpeg,image/png,image/webp"
                  onChange={handleFileChange}
                  className="hidden"
                />

                <div className="w-16 h-16 rounded-2xl bg-white shadow-sm border border-slate-200 flex items-center justify-center text-amber-500">
                  <UploadCloud className="w-8 h-8" />
                </div>

                <div>
                  <h4 className="font-bold text-sm text-slate-900">
                    {selectedFile ? selectedFile.name : 'Click to select or drag & drop Embassy PDF / Image'}
                  </h4>
                  <p className="text-xs text-slate-500 mt-1">
                    Supports Embassy Pending Table PDFs (SE Numbers, Names, Passports, Companies, Dates, E Numbers)
                  </p>
                  <span className="inline-block mt-2 text-[10px] font-mono text-slate-400 bg-white px-2.5 py-1 rounded-full border border-slate-200">
                    PDF, JPEG, PNG up to 20MB
                  </span>
                </div>
              </div>

              {/* Sample PDF Preset Action */}
              <div className="p-4 bg-amber-50/80 border border-amber-200 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 text-xs text-amber-950">
                  <Sparkles className="w-5 h-5 text-amber-600 shrink-0" />
                  <div>
                    <span className="font-bold block">Bundled sample roster (separate from your upload)</span>
                    <span className="text-[11px] text-amber-800">
                      Loads bundled demonstration records. It is never used as an OCR fallback or derived from your document.
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setExtractedRows(EMBASSY_PENDING_PDF_DATA);
                    showNotification('success', `Loaded ${EMBASSY_PENDING_PDF_DATA.length} bundled sample records; these are NOT from your upload.`);
                  }}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer shrink-0"
                >
                  Load bundled sample roster (106 records)
                </button>
              </div>

              {/* Extraction Trigger */}
              {selectedFile && (
                <div className="flex justify-end pt-2">
                  <button
                    onClick={handleProcessExtraction}
                    disabled={isProcessing}
                    className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-6 py-3 rounded-2xl text-xs font-bold transition shadow-md cursor-pointer disabled:opacity-50"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                        <span>Extracting & Parsing Embassy Data...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 text-amber-400" />
                        <span>Run AI Extraction</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* Extracted Data Review */
            <div className="space-y-4">
              {/* Top Stats Banner */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 bg-slate-100 rounded-2xl border border-slate-200">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <div>
                    <span className="text-xs font-bold text-slate-900 block">
                      Extracted {extractedRows.length} Candidate Records across {groupStats.length} SE Groups
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Review, edit inline, or click Save to import directly into Embassy Pending
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => setExtractedRows(null)}
                    className="px-3 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 transition"
                  >
                    Upload Another Document
                  </button>
                </div>
              </div>

              {/* SE Groups breakdown badges */}
              <div className="flex items-center gap-1.5 flex-wrap p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mr-1">SE Subtotals:</span>
                {groupStats.map(([grp, count]) => (
                  <span
                    key={grp}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white border border-slate-200 font-mono text-[11px] font-bold text-slate-800"
                  >
                    <span className="text-amber-700">{grp}:</span>
                    <span className="text-emerald-700">{count}</span>
                  </span>
                ))}
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-amber-100 border border-amber-300 font-mono text-[11px] font-extrabold text-amber-900 ml-auto">
                  Total: {extractedRows.length}
                </span>
              </div>

              {/* Editable Table */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs max-h-[420px] overflow-y-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead className="bg-slate-900 text-white font-bold uppercase tracking-wider text-[10px] sticky top-0 z-10">
                    <tr>
                      <th className="p-2.5 pl-3 w-10 text-center">NO</th>
                      <th className="p-2.5">NAME</th>
                      <th className="p-2.5 font-mono">PASSPORT NO</th>
                      <th className="p-2.5 font-mono">SE NUMBER</th>
                      <th className="p-2.5">COMPANY NAME</th>
                      <th className="p-2.5 font-mono">APPLIED DATE</th>
                      <th className="p-2.5 font-mono">E NUMBER</th>
                      <th className="p-2.5 pr-3 text-center w-10">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-sans">
                    {extractedRows.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/80 transition">
                        <td className="p-2 pl-3 text-center font-mono text-slate-400 font-bold">{idx + 1}</td>
                        <td className="p-2">
                          <input
                            type="text"
                            value={row.full_name}
                            onChange={(e) => handleUpdateRow(idx, 'full_name', e.target.value)}
                            className="w-full bg-transparent border border-transparent hover:border-slate-300 focus:border-emerald-500 focus:bg-white rounded px-1.5 py-0.5 font-bold text-slate-900 text-xs"
                          />
                        </td>
                        <td className="p-2 font-mono">
                          <input
                            type="text"
                            value={row.passport_number}
                            onChange={(e) => handleUpdateRow(idx, 'passport_number', e.target.value)}
                            className="w-full bg-transparent border border-transparent hover:border-slate-300 focus:border-emerald-500 focus:bg-white rounded px-1.5 py-0.5 font-mono font-bold text-slate-800 text-xs"
                          />
                        </td>
                        <td className="p-2 font-mono">
                          <input
                            type="text"
                            value={row.se_number}
                            onChange={(e) => handleUpdateRow(idx, 'se_number', e.target.value)}
                            className="w-full bg-emerald-50/50 border border-emerald-200 focus:border-emerald-500 focus:bg-white rounded px-1.5 py-0.5 font-mono font-extrabold text-emerald-800 text-xs"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            value={row.company_name}
                            onChange={(e) => handleUpdateRow(idx, 'company_name', e.target.value)}
                            className="w-full bg-transparent border border-transparent hover:border-slate-300 focus:border-emerald-500 focus:bg-white rounded px-1.5 py-0.5 font-semibold text-slate-800 text-xs"
                          />
                        </td>
                        <td className="p-2 font-mono">
                          <input
                            type="text"
                            value={row.embassy_applied_date}
                            onChange={(e) => handleUpdateRow(idx, 'embassy_applied_date', e.target.value)}
                            className="w-full bg-transparent border border-transparent hover:border-slate-300 focus:border-emerald-500 focus:bg-white rounded px-1.5 py-0.5 font-mono text-slate-600 text-xs"
                          />
                        </td>
                        <td className="p-2 font-mono">
                          <input
                            type="text"
                            value={row.e_number}
                            placeholder="Pending"
                            onChange={(e) => handleUpdateRow(idx, 'e_number', e.target.value)}
                            className="w-full bg-blue-50/40 border border-blue-200 focus:border-blue-500 focus:bg-white rounded px-1.5 py-0.5 font-mono font-bold text-blue-800 text-xs"
                          />
                        </td>
                        <td className="p-2 pr-3 text-center">
                          <button
                            onClick={() => handleRemoveRow(idx)}
                            className="p-1 text-slate-400 hover:text-rose-600 transition"
                            title="Remove row"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between bg-slate-50 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-200 transition"
          >
            Cancel
          </button>

          {extractedRows && (
            <button
              onClick={handleSaveToEmbassyPending}
              disabled={isSaving}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2.5 rounded-xl text-xs font-bold transition shadow-sm cursor-pointer disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>Importing Records...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Import & Save {extractedRows.length} Records to Embassy Pending</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
