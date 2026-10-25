import React, { useState, useRef, useEffect } from "react";
import { INITIAL_CV_DATA, CVData, AppFormat, AttachedDoc, AttachmentType, ApplicantOverview, ApplicantFullDetails, CVApplicationRecord, CVApplicationSummary } from "./types";
import CVPaper from "./components/CVPaper";
import { ApplicationStatusTables } from "./components/ApplicationStatusTables";
import { LocalOCRPanel } from "./components/LocalOCRPanel";
import type { OCRSuggestion } from "./utils/ocrFields";
import CVForm from "./components/CVForm";
import SignaturePad from "./components/SignaturePad";
import { detectAndCleanSignatureFromDocs } from "./lib/signatureUtils";
import { hasMeaningfulCvFields } from "./lib/cvExtractionPolicy";
import { BatchProcessor } from "./components/BatchProcessor";
import { motion, AnimatePresence } from "motion/react";
import {
  Upload,
  Printer,
  RotateCcw,
  FileJson,
  Check,
  AlertCircle,
  Sparkles,
  FileText,
  Layers,
  HelpCircle,
  Download,
  CheckCircle,
  Clock,
  Trash2,
  X,
  Save,
  Eye,
  EyeOff,
  Image as ImageIcon,
  User,
  Users,
  PenTool,
  Paperclip,
  ArrowUp,
  ArrowDown,
  RefreshCw
} from "lucide-react";
import html2canvas from "html2canvas-pro";
import JSZip from "jszip";
import jsPDF from "jspdf";


// Start new applications empty rather than displaying CV-BUILDER's sample person's details.
const newApplication = (): CVData => ({
  ...INITIAL_CV_DATA,
  ...Object.fromEntries(Object.entries(INITIAL_CV_DATA).filter(([, value]) => typeof value === 'string').map(([key]) => [key, ''])),
  declarationRomanian: INITIAL_CV_DATA.declarationRomanian,
  declarationEnglish: INITIAL_CV_DATA.declarationEnglish,
  declarationHealth: INITIAL_CV_DATA.declarationHealth,
  foreignLanguage: 'NORMAL ENGLISH',
  langUnderstanding: 'Good', langSpeaking: 'Good', langWriting: 'Good',
  date: new Date().toLocaleDateString('en-GB'),
  careers: INITIAL_CV_DATA.careers.map(row => ({ ...row, employerDetails: '', period: '', position: '' })),
  trainings: INITIAL_CV_DATA.trainings.map(row => ({ ...row, courseName: '', duration: '', diploma: '' })),
  photoUrl: null, signatureUrl: null, topLeftPhotoUrl: null, attachments: []
});

const cvDate = (value?: string) => {
  if (!value) return '';
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  return iso ? `${iso[3]}/${iso[2]}/${iso[1]}` : value;
};

interface CVBuilderProps {
  applicants: ApplicantOverview[];
  onBack: () => void;
}

export default function CVBuilder({ applicants, onBack }: CVBuilderProps) {
  const [selectedApplicantId, setSelectedApplicantId] = useState('');
  const [registryLoading, setRegistryLoading] = useState(false);
  const [registryError, setRegistryError] = useState('');
  const [applicationId, setApplicationId] = useState<string | null>(null);
  const [savedApplications, setSavedApplications] = useState<CVApplicationSummary[]>([]);
  const [applicationError, setApplicationError] = useState('');
  const [candidateQuery, setCandidateQuery] = useState('');
  const [applicationQuery, setApplicationQuery] = useState('');
  const [moduleTab, setModuleTab] = useState<'editor' | 'created' | 'pending'>('editor');
  const [cvData, setCvData] = useState<CVData>(() => {
    const todayStr = new Date().toLocaleDateString("en-GB");
    try {
      const saved = localStorage.getItem("bilingual_cv_data");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === "object" && "name" in parsed) {
          // Permanently set foreignLanguage to NORMAL ENGLISH
          parsed.foreignLanguage = "NORMAL ENGLISH";
          
          // Automatically set date to current date
          parsed.date = todayStr;
          
          // Clear otherMentions if it contains unwanted default text from previous sessions
          if (parsed.otherMentions && (
            parsed.otherMentions.includes("Dolphin") || 
            parsed.otherMentions.includes("50% Loan") || 
            parsed.otherMentions.includes("Kitchen Helper")
          )) {
            parsed.otherMentions = "";
          }
          return parsed;
        }
      }
    } catch (e) {
      console.warn("Failed to load saved CV data from localStorage", e);
    }
    return newApplication();
  });
  
  const [appFormat, setAppFormat] = useState<AppFormat>(() => {
    try {
      const saved = localStorage.getItem("bilingual_cv_app_format");
      if (saved === "format1" || saved === "format2" || saved === "format3") {
        return saved;
      }
    } catch (e) {
      console.warn("Failed to load appFormat from localStorage", e);
    }
    return "format2";
  });

  useEffect(() => {
    try {
      localStorage.setItem("bilingual_cv_app_format", appFormat);
    } catch (e) {
      console.warn("Failed to save appFormat to localStorage", e);
    }
  }, [appFormat]);

  const [stagedFiles, setStagedFiles] = useState<{ id: string; name: string; type: string; size: number; base64: string }[]>([]);
  const [ocrStatus, setOcrStatus] = useState<"idle" | "reading" | "processing" | "success" | "error">("idle");
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [fallbackFiles, setFallbackFiles] = useState<File[]>([]);
  const [fallbackKey, setFallbackKey] = useState(0);
  const [pdfGenerating, setPdfGenerating] = useState<boolean>(false);
  const [jpegGenerating, setJpegGenerating] = useState<boolean>(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [isPrintPreview, setIsPrintPreview] = useState<boolean>(false);
  const [flashedFields, setFlashedFields] = useState<Set<string>>(new Set());
  const [dragActive, setDragActive] = useState<boolean>(false);
  const [showClearConfirm, setShowClearConfirm] = useState<boolean>(false);
  const [showResetConfirm, setShowResetConfirm] = useState<boolean>(false);
  const [processingMode, setProcessingMode] = useState<"single" | "batch">("single");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const sigFileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDragOverDetails, setIsDragOverDetails] = useState<boolean>(false);
  const [isDragOverSig, setIsDragOverSig] = useState<boolean>(false);
  const [sigStatus, setSigStatus] = useState<"idle" | "reading" | "processing" | "success" | "error">("idle");
  const [sigError, setSigError] = useState<string | null>(null);

  const attFileInputRef = useRef<HTMLInputElement | null>(null);
  const [isProcessingAttachments, setIsProcessingAttachments] = useState<boolean>(false);
  const [processingAttMsg, setProcessingAttMsg] = useState<string>("");

  const refreshSavedApplications = async () => {
    try {
      const response = await fetch('/api/cv-applications');
      if (!response.ok) throw new Error('Could not load saved applications.');
      setSavedApplications(await response.json());
    } catch (error) {
      setApplicationError(error instanceof Error ? error.message : 'Could not load saved applications.');
    }
  };

  useEffect(() => { void refreshSavedApplications(); }, []);

  const loadSavedApplication = async (id: string) => {
    if (!id) return;
    if (!window.confirm('Open this saved application? Unsaved changes to the current form will be lost.')) return;
    setRegistryLoading(true);
    setApplicationError('');
    try {
      const response = await fetch(`/api/cv-applications/${encodeURIComponent(id)}`);
      const record: CVApplicationRecord & { error?: string } = await response.json();
      if (!response.ok) throw new Error(record.error || 'Could not open saved application.');
      setCvData({ ...newApplication(), ...record.data });
      setAppFormat(record.format);
      setSelectedApplicantId(record.applicant_id || '');
      setApplicationId(record.application_id);
      setProcessingMode('single');
      setSaveStatus('saved');
      setModuleTab('editor');
    } catch (error) {
      setApplicationError(error instanceof Error ? error.message : 'Could not open saved application.');
    } finally {
      setRegistryLoading(false);
    }
  };

  const deleteSavedApplication = async () => {
    if (!applicationId || !window.confirm('Permanently delete this saved application? The Master Registry candidate will not be deleted.')) return;
    setApplicationError('');
    try {
      const response = await fetch(`/api/cv-applications/${encodeURIComponent(applicationId)}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Could not delete saved application.');
      setApplicationId(null);
      setSelectedApplicantId('');
      setCvData(newApplication());
      setSaveStatus('idle');
      await refreshSavedApplications();
    } catch (error) {
      setApplicationError(error instanceof Error ? error.message : 'Could not delete saved application.');
    }
  };

  const loadFromRegistry = async (id: string) => {
    if (!id) { setSelectedApplicantId(''); return; }
    if (!window.confirm('Load this registry candidate into Application Creation? This will replace the current unsaved form.')) return;
    setRegistryLoading(true);
    setRegistryError('');
    try {
      const response = await fetch(`/api/applicants/${encodeURIComponent(id)}`);
      if (!response.ok) throw new Error('Could not load candidate profile.');
      const details: ApplicantFullDetails = await response.json();
      const person = details.profile;
      const address = person.address || person.living_place || '';
      setCvData({
        ...newApplication(),
        name: person.other_name || person.full_name || '',
        surname: person.surname || '',
        dateOfBirth: cvDate(person.date_of_birth),
        placeOfBirth: details.passport?.place_of_birth || '',
        fatherName: person.father_name || '',
        motherName: person.mother_name || '',
        nationality: person.nationality || '',
        citizenship: person.nationality || '',
        passportNo: details.passport?.passport_number || '',
        passportIssuedBy: '',
        passportIssuedDate: cvDate(details.passport?.date_of_issue),
        passportValidFrom: cvDate(details.passport?.date_of_issue),
        passportValidTo: cvDate(details.passport?.date_of_expiry),
        residence: address,
        lastResidence: address,
        country: 'SRI LANKA',
        lastResidenceCountry: 'SRI LANKA',
        city: person.living_place || '',
        lastResidenceCity: person.living_place || '',
        maritalStatus: person.civil_status || '',
        professionalSkill: person.preferred_job_category || '',
        appliedPosition: person.preferred_job_category || '',
        email: person.email || '',
        phone: person.mobile_number || '',
        religion: person.religion || '',
        height: person.height || '',
        weight: person.weight || '',
        classesGraduate: details.education?.education_qualification || '',
        careers: details.experiences.slice(0, 3).map((experience, index) => ({
          id: index + 1,
          employerDetails: [experience.company_place, experience.country].filter(Boolean).join(' — '),
          period: experience.duration || '',
          position: experience.position || person.preferred_job_category || ''
        })).concat(newApplication().careers.slice(details.experiences.length, 3)),
        photoUrl: person.applicant_photo || null
      });
      setSelectedApplicantId(id);
      setModuleTab('editor');
      setApplicationId(null);
      setSaveStatus('idle');
      setProcessingMode('single');
    } catch (error) {
      setRegistryError(error instanceof Error ? error.message : 'Could not load candidate profile.');
    } finally {
      setRegistryLoading(false);
    }
  };

  const detectTypeFromFilename = (fileName: string): { type: AttachmentType; title: string } | null => {
    const lname = (fileName || "").toLowerCase();
    if (lname.includes("passport") || lname.includes("pasaport") || lname.includes("pass")) {
      return { type: "passport", title: "Passport Scan" };
    }
    if (lname.includes("police") || lname.includes("cazier") || lname.includes("clearance") || lname.includes("report") || lname.includes("character") || lname.includes("background")) {
      return { type: "police_report", title: "Police Clearance Report" };
    }
    if (lname.includes("photo") || lname.includes("portrait") || lname.includes("avatar") || lname.includes("profile") || lname.includes("headshot") || lname.includes("face") || lname.includes("candidat") || lname.includes("poza") || lname.includes("personal")) {
      return { type: "applicant_photo", title: "Applicant Photo" };
    }
    return null;
  };

  const classifyDocumentWithAiAndManual = async (
    dataUrl: string,
    fileName: string,
    forcedType?: AttachmentType,
    forcedTitle?: string,
    allFileNames?: string[]
  ): Promise<{ type: AttachmentType; title: string }> => {
    let detectedMimeType = "image/jpeg";
    try {
      if (dataUrl.startsWith("data:")) {
        const parts = dataUrl.split(";");
        if (parts[0]) {
          detectedMimeType = parts[0].replace("data:", "");
        }
      }
    } catch (e) {
      console.warn("Failed to parse mimeType from data url:", e);
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);

      const response = await fetch("/api/classify-document", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          fileBase64: dataUrl,
          mimeType: detectedMimeType,
          fileName: fileName,
          forcedType: forcedType,
          allFileNames: allFileNames,
        }),
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.type) {
          const validTypes: AttachmentType[] = ["passport", "police_report", "applicant_photo", "other"];
          if (validTypes.includes(result.type)) {
            let type = result.type as AttachmentType;
            let title = result.title;
            if (!title || title === "Supporting Document") {
              if (type === "passport") title = "Passport Scan";
              else if (type === "police_report") title = "Police Clearance Report";
              else if (type === "applicant_photo") title = "Applicant Photo";
              else title = fileName ? fileName.replace(/\.[^/.]+$/, "").replace(/_/g, " ") : "Supporting Document";
            }

            if (type === "other") {
              const detected = detectTypeFromFilename(fileName);
              if (detected) {
                type = detected.type;
                title = title && title !== "Supporting Document" ? title : detected.title;
              }
            }

            if (forcedType && forcedType !== "other" && type === "other") {
              const lowerName = (fileName || "").toLowerCase();
              const isPassportKeyword = lowerName.includes("pass") || lowerName.includes("passport") || lowerName.includes("pasaport");
              const isPoliceKeyword = lowerName.includes("police") || lowerName.includes("cazier") || lowerName.includes("clearance") || lowerName.includes("report");
              const isGenericScanPage = lowerName.includes("page") || lowerName.includes("pg") || lowerName.includes("part") || lowerName.includes("scan") || lowerName.includes("img") || lowerName.includes("image") || /^\d+$/.test(lowerName.replace(/\.[^/.]+$/, ""));

              if (forcedType === "passport" && (isPassportKeyword || isGenericScanPage)) {
                return { type: "passport", title: title || "Passport Scan" };
              }
              if (forcedType === "police_report" && (isPoliceKeyword || isGenericScanPage)) {
                return { type: "police_report", title: title || "Police Clearance Report" };
              }
              return { type: "other", title: title || "Supporting Document" };
            }
            return { type, title };
          }
        }
      }
    } catch (err) {
      console.warn("AI Document Classification unavailable/timed out:", err);
    }

    const manualDetected = detectTypeFromFilename(fileName);
    if (manualDetected) return manualDetected;

    if (forcedType && forcedTitle) {
      return { type: forcedType, title: forcedTitle };
    }

    const cleanFallbackTitle = fileName ? fileName.replace(/\.[^/.]+$/, "").replace(/_/g, " ") : "Supporting Document";
    return { type: "other", title: cleanFallbackTitle };
  };

  const processAttachmentFiles = async (
    filesInput: FileList | File[],
    forcedType?: AttachmentType,
    forcedTitle?: string
  ) => {
    const files = Array.from(filesInput || []);
    if (files.length === 0) return;

    const allFileNames = files.map((f) => f.name);
    setIsProcessingAttachments(true);
    setProcessingAttMsg(forcedType ? `Processing ${files.length} document(s)...` : `AI Analyzing and auto-detecting ${files.length} document(s)...`);

    try {
      const { convertPdfToImages, readImageFileAsDataUrl } = await import("./utils/pdfUtils");
      const filePromises = files.map(async (file, fileIdx) => {
        const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
        const docAttachments: AttachedDoc[] = [];

        try {
          if (isPdf) {
            try {
              const pages = await convertPdfToImages(file);
              const pagePromises = pages.map(async (p) => {
                let classification: { type: AttachmentType; title: string };
                if (forcedType) {
                  classification = {
                    type: forcedType,
                    title: forcedTitle || file.name.replace(/\.[^/.]+$/, "").replace(/_/g, " ")
                  };
                } else {
                  classification = await classifyDocumentWithAiAndManual(
                    p.dataUrl,
                    file.name,
                    forcedType,
                    forcedTitle,
                    allFileNames
                  );
                }
                let finalTitle = classification.title;
                if (pages.length > 1) {
                  finalTitle = `${classification.title} (Page ${p.pageNumber} of ${p.totalPages})`;
                }
                return {
                  id: "att_" + Date.now() + "_" + fileIdx + "_" + p.pageNumber + "_" + Math.random().toString(36).substr(2, 4),
                  type: classification.type,
                  title: finalTitle,
                  url: p.dataUrl,
                  fileName: file.name,
                } as AttachedDoc;
              });
              const pageResults = await Promise.all(pagePromises);
              docAttachments.push(...pageResults);
            } catch (pdfErr) {
              const dataUrl = await readImageFileAsDataUrl(file);
              let classification: { type: AttachmentType; title: string };
              if (forcedType) {
                classification = {
                  type: forcedType,
                  title: forcedTitle || file.name.replace(/\.[^/.]+$/, "").replace(/_/g, " ")
                };
              } else {
                classification = await classifyDocumentWithAiAndManual(
                  dataUrl,
                  file.name,
                  forcedType,
                  forcedTitle,
                  allFileNames
                );
              }
              docAttachments.push({
                id: "att_" + Date.now() + "_" + fileIdx + "_" + Math.random().toString(36).substr(2, 4),
                type: classification.type,
                title: classification.title,
                url: dataUrl,
                fileName: file.name,
              });
            }
          } else {
            const dataUrl = await readImageFileAsDataUrl(file);
            let classification: { type: AttachmentType; title: string };
            if (forcedType) {
              classification = {
                type: forcedType,
                title: forcedTitle || file.name.replace(/\.[^/.]+$/, "").replace(/_/g, " ")
              };
            } else {
              classification = await classifyDocumentWithAiAndManual(
                dataUrl,
                file.name,
                forcedType,
                forcedTitle,
                allFileNames
              );
            }
            docAttachments.push({
              id: "att_" + Date.now() + "_" + fileIdx + "_" + Math.random().toString(36).substr(2, 4),
              type: classification.type,
              title: classification.title,
              url: dataUrl,
              fileName: file.name,
            });
          }
        } catch (singleFileErr) {
          console.error("Error processing attachment file:", file.name, singleFileErr);
        }
        return docAttachments;
      });

      const nestedResults = await Promise.all(filePromises);
      let allDetectedDocs = nestedResults.flat();

      const validAttachmentsToKeep: AttachedDoc[] = [];
      let rejectedCount = 0;
      allDetectedDocs.forEach((doc) => {
        if (doc.type === "passport" || doc.type === "police_report" || doc.type === "applicant_photo") {
          validAttachmentsToKeep.push(doc);
        } else {
          rejectedCount++;
        }
      });

      if (rejectedCount > 0) {
        alert(`${rejectedCount} file(s) were excluded. Only Passport copies, Police Clearance Reports, and Portrait Photos are accepted.`);
      }

      if (validAttachmentsToKeep.length > 0) {
        const typePriority: Record<AttachmentType, number> = {
          police_report: 1,
          passport: 2,
          applicant_photo: 3,
          other: 4,
        };

        setCvData((prev) => {
          const allAttachments = [...(prev.attachments || []), ...validAttachmentsToKeep];
          const sorted = allAttachments.sort((a, b) => (typePriority[a.type] || 4) - (typePriority[b.type] || 4));
          const appPhoto = validAttachmentsToKeep.find((d) => d.type === "applicant_photo");
          return {
            ...prev,
            attachments: sorted,
            ...(appPhoto ? { photoUrl: appPhoto.url } : {}),
          };
        });
      }
    } catch (err: any) {
      console.error("Failed to process attachment files:", err);
      alert("Failed to process attachments: " + err.message);
    } finally {
      setIsProcessingAttachments(false);
      setProcessingAttMsg("");
    }
  };

  // Custom state change handler that automatically propagates residence, country, city (11, 12, 13)
  // to lastResidence, lastResidenceCountry, lastResidenceCity (14, 15, 16) if they changed,
  // but still allows fields to be fully and independently editable.
  const handleCvDataChange = (newData: CVData | ((prev: CVData) => CVData)) => {
    setCvData((prev) => {
      const updated = typeof newData === "function" ? newData(prev) : newData;
      const result = { ...updated };

      if (updated.residence !== prev.residence) {
        result.lastResidence = updated.residence;
      }
      if (updated.country !== prev.country) {
        result.lastResidenceCountry = updated.country;
      }
      if (updated.city !== prev.city) {
        result.lastResidenceCity = updated.city;
      }

      return result;
    });
  };

  // Auto-save to localStorage on every change
  useEffect(() => {
    try {
      localStorage.setItem("bilingual_cv_data", JSON.stringify(cvData));
    } catch (e) {
      console.warn("Failed to auto-save CV data to localStorage", e);
    }
  }, [cvData]);

  // Persist the CV in the shared APPLICATION-SYSTEM database, not only localStorage.
  const handleManualSave = async () => {
    setSaveStatus('saving');
    setApplicationError('');
    try {
      const response = await fetch(applicationId ? `/api/cv-applications/${encodeURIComponent(applicationId)}` : '/api/cv-applications', {
        method: applicationId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applicant_id: selectedApplicantId || null, format: appFormat, data: cvData })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not save application.');
      setApplicationId(result.application_id);
      try { localStorage.setItem('bilingual_cv_data', JSON.stringify(cvData)); } catch { /* server copy remains saved */ }
      setSaveStatus('saved');
      await refreshSavedApplications();
      setTimeout(() => setSaveStatus('idle'), 2600);
    } catch (error) {
      setSaveStatus('idle');
      setApplicationError(error instanceof Error ? error.message : 'Could not save application.');
    }
  };

  // UTC Time & User Email Metadata Display
  const currentTimeStr = new Date().toLocaleString("en-GB", { timeZone: "UTC" });

  // Helper to convert OKLCH to standard RGB/RGBA mathematically for perfect html2canvas compatibility
  const oklchToRgb = (l: number, c: number, hDeg: number, alpha: number = 1): string => {
    const h = (hDeg * Math.PI) / 180;
    
    // OKLCH -> OKLAB
    const L = l;
    const a = c * Math.cos(h);
    const b = c * Math.sin(h);
    
    // OKLAB -> LMS
    const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
    const m_ = L - 0.1055613458 * a - 0.0638541167 * b;
    const s_ = L - 0.0894841775 * a - 1.2914855480 * b;
    
    // LMS -> LMS cubed
    const l_3 = l_ * l_ * l_;
    const m_3 = m_ * m_ * m_;
    const s_3 = s_ * s_ * s_;
    
    // LMS cubed -> linear RGB
    let r = +4.0767416621 * l_3 - 3.3077115913 * m_3 + 0.2309699292 * s_3;
    let g = -1.2684380046 * l_3 + 2.6097574011 * m_3 - 0.3413190470 * s_3;
    let b_ = -0.0041960863 * l_3 - 0.7034186147 * m_3 + 1.7076147010 * s_3;
    
    // Helper to gamma correct linear RGB
    const gamma = (v: number) => {
      return v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
    };
    
    r = Math.max(0, Math.min(1, gamma(r)));
    g = Math.max(0, Math.min(1, gamma(g)));
    b_ = Math.max(0, Math.min(1, gamma(b_)));
    
    const ri = Math.round(r * 255);
    const gi = Math.round(g * 255);
    const bi = Math.round(b_ * 255);
    
    if (alpha === 1) {
      return `rgb(${ri}, ${gi}, ${bi})`;
    } else {
      return `rgba(${ri}, ${gi}, ${bi}, ${alpha})`;
    }
  };

  // Helper to parse oklch(...) syntax and replace with standard RGB
  const resolveOklchToRgb = (cssStr: string): string => {
    if (!cssStr || typeof cssStr !== "string" || !cssStr.toLowerCase().includes("oklch")) {
      return cssStr;
    }
    return cssStr.replace(/oklch\(([^)]+)\)/gi, (match, p1) => {
      try {
        const cleanP1 = p1.trim().replace(/,/g, " ");
        const parts = cleanP1.split(/\s*[\s/]\s*/).filter(Boolean);
        if (parts.length >= 3) {
          let l = parseFloat(parts[0]);
          if (parts[0].includes("%")) {
            l = l / 100;
          }
          let c = parseFloat(parts[1]);
          if (parts[1].includes("%")) {
            c = c / 100;
          }
          const hVal = parts[2].replace(/deg/g, "");
          let h = parseFloat(hVal);
          if (hVal.includes("rad")) {
            h = h * (180 / Math.PI);
          } else if (hVal.includes("turn")) {
            h = h * 360;
          }
          
          let alpha = 1;
          if (parts[3]) {
            const alphaVal = parts[3];
            alpha = parseFloat(alphaVal);
            if (alphaVal.includes("%")) {
              alpha = alpha / 100;
            }
          }
          
          if (!isNaN(l) && !isNaN(c) && !isNaN(h)) {
            return oklchToRgb(l, c, h, alpha);
          }
        }
      } catch (e) {
        console.warn("Failed parsing oklch", match, e);
      }
      return match;
    });
  };

  // Helper to resolve oklab colors to rgb
  const resolveOklabToRgb = (cssStr: string): string => {
    return cssStr; // Fallback helper simple mock
  };

  // Helper to resolve oklch/oklab colors in stylesheets for html2canvas safety
  const prepareOklchStylesheets = async () => {
    const originalStyles: { element: HTMLStyleElement; content: string }[] = [];
    const sheetRestores: { sheet: CSSStyleSheet; tempStyle: HTMLStyleElement }[] = [];

    const sheets = Array.from(document.styleSheets) as CSSStyleSheet[];
    for (const sheet of sheets) {
      try {
        if (sheet.href && !sheet.href.startsWith(window.location.origin) && sheet.href.startsWith("http")) {
          continue;
        }

        let cssText = "";
        const rules = sheet.cssRules || sheet.rules;
        if (!rules) continue;

        for (let i = 0; i < rules.length; i++) {
          cssText += rules[i].cssText + "\n";
        }

        if (cssText.toLowerCase().includes("oklch") || cssText.toLowerCase().includes("oklab")) {
          const processedCss = resolveOklabToRgb(resolveOklchToRgb(cssText));
          
          const tempStyle = document.createElement("style");
          tempStyle.textContent = processedCss;
          tempStyle.setAttribute("data-html2pdf-temp", "true");
          document.head.appendChild(tempStyle);

          sheet.disabled = true;
          sheetRestores.push({ sheet, tempStyle });
        }
      } catch (err) {
        console.warn("Could not read stylesheet rules programmatically during PDF prepare:", err);
      }
    }

    const styleElements = Array.from(document.querySelectorAll("style:not([data-html2pdf-temp])"));
    for (const style of styleElements) {
      const originalText = style.textContent || "";
      if (originalText.includes("oklch") || originalText.includes("oklab")) {
        originalStyles.push({ element: style as HTMLStyleElement, content: originalText });
        const processedText = resolveOklabToRgb(resolveOklchToRgb(originalText));
        style.textContent = processedText;
      }
    }

    return () => {
      for (const restore of sheetRestores) {
        restore.sheet.disabled = false;
        if (restore.tempStyle.parentNode) {
          restore.tempStyle.parentNode.removeChild(restore.tempStyle);
        }
      }
      for (const item of originalStyles) {
        item.element.textContent = item.content;
      }
    };
  };

  // Helper to sanitize the cloned document right inside html2canvas to ensure no oklab/oklch colors break parsing
  const sanitizeClonedDocForHtml2Canvas = (clonedDoc: Document) => {
    try {
      const styleEls = clonedDoc.querySelectorAll("style");
      styleEls.forEach((styleEl) => {
        if (styleEl.textContent && (styleEl.textContent.toLowerCase().includes("oklab") || styleEl.textContent.toLowerCase().includes("oklch"))) {
          styleEl.textContent = resolveOklabToRgb(resolveOklchToRgb(styleEl.textContent));
        }
      });

      const defaultView = clonedDoc.defaultView || window;
      const colorProps = [
        "color",
        "background-color",
        "border-color",
        "border-top-color",
        "border-right-color",
        "border-bottom-color",
        "border-left-color",
        "outline-color",
        "fill",
        "stroke"
      ];

      const allNodes = clonedDoc.querySelectorAll("*");
      allNodes.forEach((node) => {
        const el = node as HTMLElement;
        if (!el || !el.style) return;

        if (el.style.cssText && (el.style.cssText.toLowerCase().includes("oklab") || el.style.cssText.toLowerCase().includes("oklch"))) {
          el.style.cssText = resolveOklabToRgb(resolveOklchToRgb(el.style.cssText));
        }

        try {
          const comp = defaultView.getComputedStyle(el);
          if (comp) {
            for (const prop of colorProps) {
              const val = comp.getPropertyValue(prop);
              if (val && (val.toLowerCase().includes("oklab") || val.toLowerCase().includes("oklch"))) {
                const fixedRgb = resolveOklabToRgb(resolveOklchToRgb(val));
                el.style.setProperty(prop, fixedRgb, "important");
              }
            }
          }
        } catch (e) {
          // ignore individual element errors
        }
      });

      const noPrintEls = clonedDoc.querySelectorAll(".no-print");
      noPrintEls.forEach((el) => el.remove());

      const inputs = clonedDoc.querySelectorAll("input, textarea");
      inputs.forEach((inputEl) => {
        const inp = inputEl as HTMLInputElement;
        inp.placeholder = "";
        inp.style.border = "none";
        inp.style.boxShadow = "none";
        inp.style.outline = "none";
      });
    } catch (err) {
      console.warn("Error sanitizing cloned doc for html2canvas:", err);
    }
  };

  // Save as PDF via native jsPDF + html2canvas generator
  const handleSavePDF = async () => {
    setPdfGenerating(true);
    try {
      const element1 = document.getElementById("cv-page-1");
      const element2 = document.getElementById("cv-page-2");

      if (!element1) {
        throw new Error("CV page element not found.");
      }

      const originalScrollY = window.scrollY;
      const originalScrollX = window.scrollX;
      window.scrollTo(0, 0);

      const wasPrintPreview = isPrintPreview;
      if (!wasPrintPreview) {
        setIsPrintPreview(true);
        await new Promise((resolve) => setTimeout(resolve, 200));
      }

      const restoreStylesheets = await prepareOklchStylesheets();

      await new Promise((resolve) => setTimeout(resolve, 200));

      try {
        const canvas1 = await html2canvas(element1, {
          scale: 2.5,
          useCORS: true,
          logging: false,
          backgroundColor: "#ffffff",
          scrollX: 0,
          scrollY: 0,
          windowWidth: 1024,
          onclone: (clonedDoc) => sanitizeClonedDocForHtml2Canvas(clonedDoc),
        });

        const pdf = new jsPDF({
          orientation: "portrait",
          unit: "mm",
          format: "a4",
          compress: true,
        });

        const img1Data = canvas1.toDataURL("image/jpeg", 0.98);
        pdf.addImage(img1Data, "JPEG", 0, 0, 210, 297, undefined, "FAST");

        if (element2) {
          const canvas2 = await html2canvas(element2, {
            scale: 2.5,
            useCORS: true,
            logging: false,
            backgroundColor: "#ffffff",
            scrollX: 0,
            scrollY: 0,
            windowWidth: 1024,
            onclone: (clonedDoc) => sanitizeClonedDocForHtml2Canvas(clonedDoc),
          });
          const img2Data = canvas2.toDataURL("image/jpeg", 0.98);
          pdf.addPage("a4", "portrait");
          pdf.addImage(img2Data, "JPEG", 0, 0, 210, 297, undefined, "FAST");
        }

        if (cvData.attachments && cvData.attachments.length > 0) {
          for (let idx = 0; idx < cvData.attachments.length; idx++) {
            const att = cvData.attachments[idx];
            const attachEl = document.getElementById(`cv-attachment-${idx}`);
            if (attachEl) {
              const attachWidth = attachEl.offsetWidth;
              const attachHeight = attachEl.offsetHeight;

              const canvasAttach = await html2canvas(attachEl, {
                scale: 3,
                useCORS: true,
                logging: false,
                scrollX: 0,
                scrollY: 0,
                width: attachWidth,
                height: attachHeight,
                windowWidth: attachWidth,
                windowHeight: attachHeight,
                onclone: (clonedDoc) => sanitizeClonedDocForHtml2Canvas(clonedDoc),
              });
              const imgAttachData = canvasAttach.toDataURL("image/jpeg", 0.98);
              
              if (att && att.type === "passport") {
                pdf.addPage([125, 176], "portrait");
                pdf.addImage(imgAttachData, "JPEG", 0, 0, 125, 176, undefined, "FAST");
              } else if (att && att.type === "applicant_photo") {
                pdf.addPage([35, 45], "portrait");
                pdf.addImage(imgAttachData, "JPEG", 0, 0, 35, 45, undefined, "FAST");
              } else {
                pdf.addPage("a4", "portrait");
                pdf.addImage(imgAttachData, "JPEG", 0, 0, 210, 297, undefined, "FAST");
              }
            }
          }
        }

        const cleanName = cvData.name ? cvData.name.trim().replace(/\s+/g, "_") : "Applicant";
        const formatLabel = appFormat === "format3" ? "Format03_Curriculum_Vitae" : appFormat === "format2" ? "Format02_Work_Permit_App" : "Format01_Bilingual_CV";
        const fileName = `${formatLabel}_${cleanName}.pdf`;

        pdf.save(fileName);
      } finally {
        restoreStylesheets();
        if (!wasPrintPreview) {
          setIsPrintPreview(false);
        }
        window.scrollTo(originalScrollX, originalScrollY);
      }

      setPdfGenerating(false);
    } catch (err: any) {
      console.error("PDF generation failed:", err);
      alert("PDF generation failed: " + err.message);
      setPdfGenerating(false);
    }
  };

  // Standalone JPEG ZIP downloader
  const handleDownloadJPEG = async () => {
    setJpegGenerating(true);
    try {
      const element1 = document.getElementById("cv-page-1");
      const element2 = document.getElementById("cv-page-2");

      if (!element1) {
        throw new Error("CV page element not found.");
      }

      const originalScrollY = window.scrollY;
      const originalScrollX = window.scrollX;
      window.scrollTo(0, 0);

      const wasPrintPreview = isPrintPreview;
      if (!wasPrintPreview) {
        setIsPrintPreview(true);
        await new Promise((resolve) => setTimeout(resolve, 200));
      }

      const restoreStylesheets = await prepareOklchStylesheets();

      await new Promise((resolve) => setTimeout(resolve, 200));

      const formatPrefix = appFormat === "format3" ? "Format03_Curriculum_Vitae" : appFormat === "format2" ? "Format02_Work_Permit_App" : "Format01_Bilingual_CV";
      const cleanName = cvData.name ? cvData.name.trim().replace(/\s+/g, "_") : "Applicant";
      const docTitle = `${formatPrefix}_${cleanName}`;

      try {
        const canvas1 = await html2canvas(element1, {
          scale: 2.5,
          useCORS: true,
          logging: false,
          scrollY: 0,
          scrollX: 0,
          windowWidth: 1024,
          backgroundColor: "#ffffff",
          onclone: (clonedDoc) => sanitizeClonedDocForHtml2Canvas(clonedDoc),
        });

        const jpegUrl1 = canvas1.toDataURL("image/jpeg", 0.95);
        const zip = new JSZip();
        const base64Data1 = jpegUrl1.substring(jpegUrl1.indexOf(",") + 1);
        zip.file(`${docTitle}_Page_1.jpg`, base64Data1, { base64: true });

        if (element2) {
          const canvas2 = await html2canvas(element2, {
            scale: 2.5,
            useCORS: true,
            logging: false,
            scrollY: 0,
            scrollX: 0,
            windowWidth: 1024,
            backgroundColor: "#ffffff",
            onclone: (clonedDoc) => sanitizeClonedDocForHtml2Canvas(clonedDoc),
          });

          const jpegUrl2 = canvas2.toDataURL("image/jpeg", 0.95);
          const base64Data2 = jpegUrl2.substring(jpegUrl2.indexOf(",") + 1);
          zip.file(`${docTitle}_Page_2.jpg`, base64Data2, { base64: true });
        }

        if (cvData.attachments && cvData.attachments.length > 0) {
          for (let idx = 0; idx < cvData.attachments.length; idx++) {
            const attachEl = document.getElementById(`cv-attachment-${idx}`);
            if (attachEl) {
              const attachWidth = attachEl.offsetWidth;
              const attachHeight = attachEl.offsetHeight;

              const canvasAttach = await html2canvas(attachEl, {
                scale: 3,
                useCORS: true,
                logging: false,
                scrollY: 0,
                scrollX: 0,
                width: attachWidth,
                height: attachHeight,
                windowWidth: attachWidth,
                windowHeight: attachHeight,
                backgroundColor: "#ffffff",
                onclone: (clonedDoc) => sanitizeClonedDocForHtml2Canvas(clonedDoc),
              });

              const jpegUrlAttach = canvasAttach.toDataURL("image/jpeg", 0.95);
              const base64DataAttach = jpegUrlAttach.substring(jpegUrlAttach.indexOf(",") + 1);
              const attTitleClean = (cvData.attachments[idx].title || "Attachment").replace(/[^a-zA-Z0-9]/g, "_");
              zip.file(`${docTitle}_Attachment_${idx + 1}_${attTitleClean}.jpg`, base64DataAttach, { base64: true });
            }
          }
        }

        const zipBlob = await zip.generateAsync({ type: "blob" });
        
        const link = document.createElement("a");
        const zipUrl = URL.createObjectURL(zipBlob);
        link.href = zipUrl;
        link.download = `${docTitle}_JPEGs.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(zipUrl);

      } finally {
        restoreStylesheets();
        if (!wasPrintPreview) {
          setIsPrintPreview(false);
        }
        window.scrollTo(originalScrollX, originalScrollY);
      }

      setJpegGenerating(false);
    } catch (err: any) {
      console.error("JPEG generation failed:", err);
      alert("JPEG generation failed: " + err.message);
      setJpegGenerating(false);
    }
  };

  // Snapshot the *selected* CV layout (including attachments) into an offline archive.
  const handleDownloadHTML = async () => {
    const wasPrintPreview = isPrintPreview;
    try {
      if (!wasPrintPreview) {
        setIsPrintPreview(true);
        await new Promise(resolve => setTimeout(resolve, 250));
      }
      const pages = document.querySelectorAll('#cv-page-1, #cv-page-2, [id^="cv-attachment-"]');
      if (!pages.length) throw new Error('No CV pages available for export.');
      const escapeHtml = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] || char));
      const embeddedCss = Array.from(document.styleSheets).map(sheet => {
        try { return Array.from(sheet.cssRules).map(rule => rule.cssText).join('\n'); }
        catch { return ''; }
      }).join('\n').replace(/@import\s+url\([^)]*\);?/g, '');
      const pageMarkup = Array.from(pages).map(page => {
        const clone = page.cloneNode(true) as HTMLElement;
        clone.querySelectorAll('input, textarea, select').forEach(control => {
          const el = control as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
          const span = document.createElement('span');
          span.className = el.className;
          span.textContent = el instanceof HTMLSelectElement
            ? el.selectedOptions[0]?.textContent || ''
            : el.value || '';
          control.replaceWith(span);
        });
        clone.querySelectorAll('button, .no-print').forEach(control => control.remove());
        clone.querySelectorAll('img, embed').forEach(media => {
          const url = media.getAttribute('src') || '';
          if (!/^data:(?:image\/(?:png|jpe?g|gif|webp)|application\/pdf);base64,[A-Za-z0-9+/=]+$/.test(url)) {
            media.removeAttribute('src'); // exclude external URLs from the offline document
          }
        });
        return clone.outerHTML;
      }).join('\n');
      const title = [cvData.name, cvData.surname].filter(Boolean).join(' ') || 'Application';
      const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)} - ${escapeHtml(appFormat)}</title><style>${embeddedCss}\n@page{size:A4;margin:0}body{margin:0;background:#f1f5f9}.paper-page{margin:14px auto;page-break-after:always}@media print{body{background:white}.paper-page{margin:0;box-shadow:none}}</style></head><body><div class="no-print" style="padding:12px;background:#0f172a;color:white;font:14px system-ui">${escapeHtml(title)} · ${escapeHtml(appFormat)} · Offline application archive <button onclick="window.print()" style="margin-left:20px;padding:7px 12px;cursor:pointer">Print / Save as PDF</button></div><div class="cv-workspace" style="display:flex;align-items:center;flex-direction:column;gap:16px">${pageMarkup}</div></body></html>`;
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${appFormat}_${title.replace(/[^a-zA-Z0-9_-]+/g, '_')}.html`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      alert('HTML export failed: ' + (error instanceof Error ? error.message : String(error)));
    } finally {
      if (!wasPrintPreview) setIsPrintPreview(false);
    }
  };

  const executeReset = () => {
    setCvData(newApplication());
    setSelectedApplicantId('');
    setApplicationId(null);
    setSaveStatus('idle');
    setOcrStatus("idle");
    setOcrError(null);
    setFlashedFields(new Set());
    setStagedFiles([]);
  };

  const handleReset = () => {
    setShowResetConfirm(true);
  };

  const executeClearAll = () => {
    setCvData(newApplication());
    setSelectedApplicantId('');
    setApplicationId(null);
    setSaveStatus('idle');
    setOcrStatus("idle");
    setOcrError(null);
    setFlashedFields(new Set());
    setStagedFiles([]);
  };

  const handleClearAll = () => {
    setShowClearConfirm(true);
  };

  const exportJSON = () => {
    try {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(cvData, null, 2));
      const downloadAnchor = document.createElement("a");
      downloadAnchor.setAttribute("href", dataStr);
      const cleanName = cvData.name ? cvData.name.trim().replace(/\s+/g, "_") : "Draft";
      downloadAnchor.setAttribute("download", `Bilingual_CV_Backup_${cleanName}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    } catch (e: any) {
      alert("Failed to export JSON: " + e.message);
    }
  };

  const importJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (parsed && typeof parsed === "object") {
          setCvData((prev) => ({
            ...prev,
            ...parsed,
          }));
          alert("CV Data imported successfully!");
        } else {
          alert("Invalid file format. Please upload a valid JSON backup file.");
        }
      } catch (err: any) {
        alert("Failed to parse JSON file: " + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = ""; // Reset
  };

  const readFileAsBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string || "");
      reader.onerror = () => reject(new Error("Failed to read file."));
      reader.readAsDataURL(file);
    });
  };

  const handleFilesAdded = async (files: FileList) => {
    setOcrStatus("reading");
    setOcrError(null);
    const newFiles: typeof stagedFiles = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const base64 = await readFileAsBase64(file);
        newFiles.push({
          id: Math.random().toString(36).substring(2, 9),
          name: file.name,
          type: file.type || "application/pdf",
          size: file.size,
          base64: base64
        });
      } catch (err) {
        console.error("Failed to read file", file.name, err);
      }
    }

    setStagedFiles((prev) => [...prev, ...newFiles]);
    setOcrStatus("idle");
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesAdded(e.dataTransfer.files);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFilesAdded(e.target.files);
    }
  };

  const handleRemoveStagedFile = (id: string) => {
    setStagedFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const handleSignatureFilesAdded = async (files: FileList) => {
    if (files.length === 0) return;
    setSigStatus("reading");
    setSigError(null);
    try {
      const fileList = Array.from(files);
      const fileObjects = await Promise.all(
        fileList.map(async (file) => {
          const base64 = await readFileAsBase64(file);
          return {
            fileBase64: base64,
            mimeType: file.type || "image/jpeg",
            fileName: file.name,
            isFromSignatureSlot: true,
          };
        })
      );

      setSigStatus("processing");
      const cleanedSigUrl = await detectAndCleanSignatureFromDocs(fileObjects);
      if (cleanedSigUrl) {
        setCvData((prev) => ({ ...prev, signatureUrl: cleanedSigUrl }));
        setSigStatus("success");
      } else {
        throw new Error("No clear signature could be extracted from the uploaded document(s). Please draw manually or upload a clear, isolated signature image.");
      }
    } catch (err: any) {
      console.error("Signature extraction failed:", err);
      setSigStatus("error");
      setSigError(err.message || "Failed to extract signature.");
    }
  };

  const handleSigFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleSignatureFilesAdded(e.target.files);
    }
  };

  const startLocalFallback = async (documents: Array<{base64:string;name:string}>) => {
    try {
      const { dataUrlToFile } = await import('./utils/pdfUtils');
      const files = documents.map(doc => dataUrlToFile(doc.base64, doc.name));
      if (files.length) { setFallbackFiles(files); setFallbackKey(key => key + 1); }
    } catch (cause) { console.warn('Could not prepare the local OCR fallback:', cause); }
  };

  const processUploadedFiles = async () => {
    if (stagedFiles.length === 0) {
      setOcrError("Please select or drop files first.");
      return;
    }

    setOcrStatus("processing");
    setOcrError(null);
    setFlashedFields(new Set());

    try {
        // 1. Process files (convert PDFs to individual page images and handle JPEGs/PNGs)
        const { convertPdfToImages, dataUrlToFile } = await import("./utils/pdfUtils");
        
        const pageItems: { dataUrl: string; fileName: string; type: string; fileIndex: number }[] = [];
        
        for (let i = 0; i < stagedFiles.length; i++) {
          const file = stagedFiles[i];
          const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
          if (isPdf) {
            try {
              const fileObj = dataUrlToFile(file.base64, file.name);
              const pages = await convertPdfToImages(fileObj);
              pages.forEach((p) => {
                pageItems.push({
                  dataUrl: p.dataUrl,
                  fileName: file.name,
                  type: "application/pdf",
                  fileIndex: i,
                });
              });
            } catch (pdfErr) {
              console.error("Failed to parse PDF in processUploadedFiles:", file.name, pdfErr);
              pageItems.push({
                dataUrl: file.base64,
                fileName: file.name,
                type: file.type,
                fileIndex: i,
              });
            }
          } else {
            pageItems.push({
              dataUrl: file.base64,
              fileName: file.name,
              type: file.type,
              fileIndex: i,
            });
          }
        }

        // 2. Classify each page image in parallel
        const classifiedPages = await Promise.all(
          pageItems.map(async (item) => {
            let classification: { type: AttachmentType; title: string };
            try {
              const response = await fetch("/api/classify-document", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  fileBase64: item.dataUrl,
                  mimeType: "image/jpeg",
                  fileName: item.fileName,
                  allFileNames: stagedFiles.map((sf) => sf.name),
                }),
              });
              const resJson = await response.json();
              if (resJson.success) {
                classification = {
                  type: resJson.type as AttachmentType,
                  title: resJson.title,
                };
              } else {
                throw new Error("unsuccessful classification");
              }
            } catch (err) {
              console.error("AI classification failed, using fallback:", err);
              const fname = item.fileName.toLowerCase();
              let type: AttachmentType = "other";
              if (fname.includes("passport") || fname.includes("pasaport") || fname.includes("pass")) type = "passport";
              else if (fname.includes("police") || fname.includes("cazier") || fname.includes("clearance") || fname.includes("report")) type = "police_report";
              else if (
                fname.includes("photo") || fname.includes("poza") || fname.includes("portrait") ||
                fname.includes("headshot") || fname.includes("face") || fname.includes("avatar") ||
                fname.includes("candidat") || fname.includes("candidate") || fname.includes("applicant")
              ) {
                type = "applicant_photo";
              }
              classification = {
                type,
                title: item.fileName.replace(/\.[^/.]+$/, "").replace(/_/g, " "),
              };
            }
            return { ...item, type: classification.type };
          })
        );
        
        // 3. Prioritize files for OCR
        const sortedFiles = [...stagedFiles].sort((a, b) => {
          const getTypePriority = (file: typeof stagedFiles[0]) => {
            const doc = classifiedPages.find(p => p.fileName === file.name);
            if (!doc || doc.type === "other") return 3;
            if (doc.type === "passport") return 1;
            if (doc.type === "police_report") return 2;
            return 3;
          };
          return getTypePriority(a) - getTypePriority(b);
        });

      const response = await fetch("/api/ocr", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          formatType: appFormat,
          files: sortedFiles.map(f => ({
            fileBase64: f.base64,
            mimeType: f.type,
            fileName: f.name
          }))
        }),
      });
      const result = await response.json();
      
      if (result.success && hasMeaningfulCvFields(result.data)) {
        if (result.data.name && result.data.surname) {
          const surnameUpper = result.data.surname.trim().toUpperCase();
          const nameUpper = result.data.name.trim().toUpperCase();
          if (surnameUpper && nameUpper.endsWith(surnameUpper) && nameUpper !== surnameUpper) {
            result.data.name = nameUpper.slice(0, nameUpper.length - surnameUpper.length).trim();
          }
        }

        const newFlashed = new Set<string>();
        Object.keys(result.data).forEach((key) => {
          const val = result.data[key as keyof CVData];
          if (val && val !== cvData[key as keyof CVData]) {
            newFlashed.add(key);
          }
        });

        setFlashedFields(newFlashed);

        // 1. Process files (convert PDFs to individual page images and handle JPEGs/PNGs)
        const { convertPdfToImages, dataUrlToFile } = await import("./utils/pdfUtils");
        
        const pageItems: { dataUrl: string; fileName: string; type: string; pageNumber?: number; totalPages?: number }[] = [];
        
        for (const file of stagedFiles) {
          const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
          if (isPdf) {
            try {
              const fileObj = dataUrlToFile(file.base64, file.name);
              const pages = await convertPdfToImages(fileObj);
              pages.forEach((p) => {
                pageItems.push({
                  dataUrl: p.dataUrl,
                  fileName: file.name,
                  type: "application/pdf",
                  pageNumber: p.pageNumber,
                  totalPages: p.totalPages,
                });
              });
            } catch (pdfErr) {
              console.error("Failed to parse PDF in processUploadedFiles:", file.name, pdfErr);
              pageItems.push({
                dataUrl: file.base64,
                fileName: file.name,
                type: file.type,
              });
            }
          } else {
            pageItems.push({
              dataUrl: file.base64,
              fileName: file.name,
              type: file.type,
            });
          }
        }

        // 2. Classify each page image in parallel
        const processedAttachments = await Promise.all(
          pageItems.map(async (item, idx) => {
            let classification: { type: AttachmentType; title: string };
            try {
              const response = await fetch("/api/classify-document", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  fileBase64: item.dataUrl,
                  mimeType: "image/jpeg",
                  fileName: item.fileName,
                  allFileNames: stagedFiles.map((sf) => sf.name),
                }),
              });
              const resJson = await response.json();
              if (resJson.success) {
                classification = {
                  type: resJson.type as AttachmentType,
                  title: resJson.title,
                };
              } else {
                throw new Error("unsuccessful classification");
              }
            } catch (err) {
              console.error("AI classification failed, using fallback:", err);
              const fname = item.fileName.toLowerCase();
              let type: AttachmentType = "other";
              if (fname.includes("passport") || fname.includes("pasaport") || fname.includes("pass")) type = "passport";
              else if (fname.includes("police") || fname.includes("cazier") || fname.includes("clearance") || fname.includes("report")) type = "police_report";
              else if (
                fname.includes("photo") || fname.includes("poza") || fname.includes("portrait") ||
                fname.includes("headshot") || fname.includes("face") || fname.includes("avatar") ||
                fname.includes("candidat") || fname.includes("candidate") || fname.includes("applicant")
              ) {
                type = "applicant_photo";
              }
              classification = {
                type,
                title: item.fileName.replace(/\.[^/.]+$/, "").replace(/_/g, " "),
              };
            }

            let finalTitle = classification.title;
            if (item.pageNumber && item.totalPages && item.totalPages > 1) {
              finalTitle = `${classification.title} (Page ${item.pageNumber} of ${item.totalPages})`;
            }

            return {
              id: "att_" + Date.now() + "_" + idx + "_" + Math.random().toString(36).substr(2, 4),
              type: classification.type,
              title: finalTitle,
              url: item.dataUrl,
              fileName: item.fileName,
            } as AttachedDoc;
          })
        );

        // 3. Extract and apply applicant photo properly from processed attachments
        const appPhoto = processedAttachments.find((att) => att.type === "applicant_photo");
        let finalPhotoUrl = appPhoto ? appPhoto.url : null;
        // Do not infer a person's photo from an unrelated image or its filename.

        const extractedCareers = (result.data.careers || []).filter((c: any) => {
          return c && (c.employerDetails || c.period || c.position);
        });

        const mergedCareers = [
          {
            id: 1,
            position: cvData.careers?.[0]?.position || cvData.professionalSkill || "",
            employerDetails: cvData.careers?.[0]?.employerDetails || "",
            period: cvData.careers?.[0]?.period || ""
          },
          {
            id: 2,
            position: extractedCareers[0]?.position || "",
            employerDetails: extractedCareers[0]?.employerDetails || "",
            period: extractedCareers[0]?.period || ""
          },
          {
            id: 3,
            position: extractedCareers[1]?.position || "",
            employerDetails: extractedCareers[1]?.employerDetails || "",
            period: extractedCareers[1]?.period || ""
          }
        ];

        // 4. Deduplicate, filter (Police Report, Passport, Applicant Photo only), and Sort (1. Police Report, 2. Passport, 3. Applicant Photo)
        const typePriority: Record<AttachmentType, number> = {
          police_report: 1,
          passport: 2,
          applicant_photo: 3,
          other: 4,
        };

        const allowedTypes = new Set<AttachmentType>(["police_report", "passport", "applicant_photo"]);

        const seenUrls = new Set<string>();
        
        // Collect new attachments that are of allowed types and not duplicate
        const uniqueNewAttachments: AttachedDoc[] = [];
        processedAttachments.forEach((att) => {
          if (allowedTypes.has(att.type)) {
            if (att.url && !seenUrls.has(att.url)) {
              seenUrls.add(att.url);
              uniqueNewAttachments.push(att);
            }
          }
        });

        // Use only new attachments, filtered by allowed types
        const allAttachments = uniqueNewAttachments
          .filter(att => allowedTypes.has(att.type));

        // Sort based on type priority
        const sortedAttachments = allAttachments.sort(
          (a, b) => (typePriority[a.type] || 4) - (typePriority[b.type] || 4)
        );

        const processedData = { ...result.data };

        // Missing biometric, contact and education fields remain blank until reviewed.

        setCvData((prev) => {
          const merged = {
            ...prev,
            ...processedData,
            careers: mergedCareers,
            attachments: sortedAttachments,
            photoUrl: finalPhotoUrl || prev.photoUrl,
            signatureUrl: prev.signatureUrl,
            otherMentions: prev.otherMentions || "",
            date: new Date().toLocaleDateString("en-GB"),
          };
          if (processedData.residence && !processedData.lastResidence) {
            merged.lastResidence = processedData.residence;
          }
          if (processedData.country && !processedData.lastResidenceCountry) {
            merged.lastResidenceCountry = processedData.country;
          }
          if (processedData.city && !processedData.lastResidenceCity) {
            merged.lastResidenceCity = processedData.city;
          }
          return merged;
        });

        setOcrStatus("success");
        
        setTimeout(() => {
          setFlashedFields(new Set());
        }, 3000);
      } else {
        setOcrStatus("error");
        setOcrError((result.error || "AI extraction failed.") + " Local OCR is running inside Details ingestion; review its suggestions or type manually.");
        void startLocalFallback(stagedFiles);
      }
    } catch (err: any) {
      console.error("OCR API error:", err);
      setOcrStatus("error");
      setOcrError((err.message || "AI extraction failed.") + " Local OCR is running inside Details ingestion; review its suggestions or type manually.");
      void startLocalFallback(stagedFiles);
    }
  };

  const handleExtractFromAttachment = async (attachmentUrl: string, title?: string) => {
    if (!attachmentUrl) return;
    setOcrStatus("processing");
    setOcrError(null);
    try {
      const response = await fetch("/api/ocr-scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          files: [{
            fileBase64: attachmentUrl,
            mimeType: "image/jpeg"
          }]
        })
      });

      const result = await response.json();
      if (result.success && result.data) {
        const extracted = result.data;
        const newCvData = { ...cvData };
        const newlyFlashed = new Set<string>();

        Object.keys(extracted).forEach((key) => {
          const val = extracted[key];
          if (val !== undefined && val !== null && val !== "" && key in newCvData) {
            (newCvData as any)[key] = val;
            newlyFlashed.add(key);
          }
        });

        if (extracted.photoUrl) {
          newCvData.photoUrl = extracted.photoUrl;
          newlyFlashed.add("photoUrl");
        }

        if (extracted.signatureUrl) {
          newCvData.signatureUrl = extracted.signatureUrl;
          newlyFlashed.add("signatureUrl");
        }

        // Never generate a phone number, height, weight or school for an unverified person.

        setCvData(newCvData);
        setFlashedFields(newlyFlashed);
        setOcrStatus("success");

        setTimeout(() => {
          setFlashedFields(new Set());
        }, 5000);
      } else {
        setOcrStatus("error");
        setOcrError(result.error || `Could not extract details from ${title || 'attachment'}.`);
      }
    } catch (err: any) {
      setOcrStatus("error");
      setOcrError(err.message || `Error extracting from ${title || 'attachment'}.`);
    }
  };

  return (
    <div className="cv-workspace h-[calc(100vh-180px)] min-h-[680px] flex flex-col bg-slate-900 text-slate-100 overflow-hidden rounded-2xl border border-slate-700 print:h-auto print:overflow-visible">
      
      <div className="no-print border-b border-slate-700 bg-slate-900 px-5 py-3 space-y-3">
        <div className="flex flex-wrap items-start gap-3">
          <button type="button" onClick={onBack} className="rounded-lg border border-slate-600 px-3 py-2 text-xs font-semibold text-slate-100 hover:bg-slate-800">← Back</button>
          <div className="relative min-w-[220px] flex-1 max-w-md">
            <input aria-label="Search candidate name" placeholder="Search candidate name..." value={candidateQuery} onChange={event => setCandidateQuery(event.target.value)} className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-xs text-white placeholder-slate-400 outline-none focus:border-emerald-500" />
            {candidateQuery.trim() && !registryLoading && <div className="absolute z-50 mt-1 max-h-52 w-full overflow-auto rounded-lg border border-slate-600 bg-slate-800 p-1 shadow-xl">
              {applicants.filter(person => [person.full_name, person.registration_number, person.applicant_id].some(text => (text || '').toLowerCase().includes(candidateQuery.toLowerCase()))).slice(0, 12).map(person => <button type="button" key={person.applicant_id} onClick={() => { void loadFromRegistry(person.applicant_id); setCandidateQuery(''); }} className="block w-full rounded px-3 py-2 text-left text-xs text-slate-100 hover:bg-slate-700">{person.full_name} <span className="text-slate-400">· {person.registration_number || person.applicant_id}</span></button>)}
            </div>}
          </div>
          <div className="relative min-w-[220px] flex-1 max-w-md">
            <input aria-label="Search application" placeholder="Search application by name, passport or ID..." value={applicationQuery} onChange={event => setApplicationQuery(event.target.value)} className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-xs text-white placeholder-slate-400 outline-none focus:border-emerald-500" />
            {applicationQuery.trim() && !registryLoading && <div className="absolute z-50 mt-1 max-h-52 w-full overflow-auto rounded-lg border border-slate-600 bg-slate-800 p-1 shadow-xl">
              {savedApplications.filter(record => [record.name, record.passportNo, record.application_id].some(text => (text || '').toLowerCase().includes(applicationQuery.toLowerCase()))).slice(0, 12).map(record => <button type="button" key={record.application_id} onClick={() => { void loadSavedApplication(record.application_id); setApplicationQuery(''); }} className="block w-full rounded px-3 py-2 text-left text-xs text-slate-100 hover:bg-slate-700">{record.name || 'Unnamed'} <span className="text-slate-400">· {record.format.replace('format','Form ')} · {record.passportNo || record.application_id}</span></button>)}
            </div>}
          </div>
          {applicationId && <button type="button" onClick={() => void deleteSavedApplication()} className="rounded-lg border border-red-900 px-3 py-2 text-xs font-semibold text-red-300 hover:bg-red-950">Delete saved</button>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {([['editor','Create / edit'], ['created','Application created applicants'], ['pending','Application creation pending applicants']] as const).map(([id,label]) => <button type="button" key={id} onClick={() => setModuleTab(id)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${moduleTab === id ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}>{label}{id === 'created' ? ` (${savedApplications.length})` : id === 'pending' ? ` (${applicants.filter(person => !savedApplications.some(app => app.applicant_id === person.applicant_id)).length})` : ''}</button>)}
          {registryLoading && <span className="text-xs text-emerald-300">Loading profile…</span>}
          {registryError && <span role="alert" className="text-xs text-red-300">{registryError}</span>}
          {applicationError && <span role="alert" className="text-xs text-red-300">{applicationError}</span>}
        </div>
      </div>

      {moduleTab !== 'editor' && <ApplicationStatusTables mode={moduleTab} applicants={applicants} applications={savedApplications} onOpenApplication={id => void loadSavedApplication(id)} onCreateForCandidate={id => void loadFromRegistry(id)} />}

      {/* HEADER TOP BAR (no-print) */}
      <header className={`${moduleTab === 'editor' ? 'flex' : 'hidden'} bg-slate-950 border-b border-slate-800 py-3 px-6 shadow-md flex-wrap items-center justify-between gap-4 no-print select-none`}>
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-lg text-white shadow-inner flex items-center justify-center">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-bold text-white flex items-center gap-2">
              Bilingual CV Auto-Filler & WYSIWYG Designer
              <span className="text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded">
                PRO EDITION
              </span>
            </h1>
            <p className="text-[11px] text-slate-400">
              Double-Page Romanian/English Recruitment Form Auto-Filler
            </p>
          </div>
        </div>

        {/* Real-time details & Mode Switcher */}
        <div className="flex items-center gap-4">
          <div className="bg-slate-900 border border-slate-800 p-1 rounded-xl flex items-center gap-1 shadow-inner">
            <button
              onClick={() => setProcessingMode("single")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                processingMode === "single"
                  ? "bg-blue-600 text-white shadow shadow-blue-600/30"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <User className="w-4 h-4" />
              <span>Single Processing</span>
            </button>

            <button
              onClick={() => setProcessingMode("batch")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                processingMode === "batch"
                  ? "bg-emerald-600 text-white shadow shadow-emerald-600/30"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Batch Processing (10 Slots)</span>
            </button>
          </div>

          <div className="hidden xl:flex items-center gap-4 text-[11px] text-slate-400 border-l border-slate-800 pl-4">
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-500" />
              <span>UTC: <strong className="font-mono text-slate-300">{currentTimeStr}</strong></span>
            </div>
          </div>
        </div>

        {/* Global Toolbar actions */}
        {processingMode === "single" && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleClearAll}
              title="Clear all fields to enter empty records"
              className="flex items-center gap-2 px-3 py-2 bg-red-950/20 hover:bg-red-900/30 text-red-400 border border-red-900/40 rounded-lg text-xs transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] hover:ring-2 hover:ring-red-400 hover:ring-offset-1 hover:ring-offset-slate-950 h-11 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4 text-red-400 shrink-0" />
              <div className="text-left leading-tight text-[10px] font-extrabold uppercase tracking-wide">
                <div>Clear</div>
                <div>Fields</div>
              </div>
            </button>

            <button
              onClick={exportJSON}
              title="Download CV schema as offline backup"
              className="flex items-center gap-2 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 rounded-lg text-xs transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] hover:ring-2 hover:ring-blue-400 hover:ring-offset-1 hover:ring-offset-slate-950 h-11 cursor-pointer"
            >
              <Download className="w-4 h-4 text-slate-400 shrink-0" />
              <div className="text-left leading-tight text-[10px] font-extrabold uppercase tracking-wide">
                <div>Export</div>
                <div>JSON</div>
              </div>
            </button>

            <label className="flex items-center gap-2 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 rounded-lg text-xs transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] hover:ring-2 hover:ring-blue-400 hover:ring-offset-1 hover:ring-offset-slate-950 h-11 cursor-pointer">
              <FileJson className="w-4 h-4 text-slate-400 shrink-0" />
              <div className="text-left leading-tight text-[10px] font-extrabold uppercase tracking-wide">
                <div>Import</div>
                <div>JSON</div>
              </div>
              <input type="file" accept=".json" onChange={importJSON} className="hidden" />
            </label>

            <button
              onClick={handleManualSave}
              title="Save current application to the shared system database"
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-all h-11 border ${
                saveStatus === "saved"
                  ? "bg-emerald-950/40 hover:bg-emerald-900/40 text-emerald-400 border-emerald-900/40"
                  : saveStatus === "saving"
                  ? "bg-slate-850 text-slate-400 border-slate-700 animate-pulse"
                  : "bg-orange-600 hover:bg-orange-500 text-white border-orange-600 shadow shadow-orange-500/10"
              }`}
            >
              {saveStatus === "saved" ? (
                <>
                  <Check className="w-4 h-4 shrink-0" />
                  <div className="text-left leading-tight text-[10px] font-extrabold uppercase tracking-wide">
                    <div>Draft</div>
                    <div>Saved!</div>
                  </div>
                </>
              ) : saveStatus === "saving" ? (
                <>
                  <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin shrink-0"></div>
                  <div className="text-left leading-tight text-[10px] font-extrabold uppercase tracking-wide">
                    <div>Saving</div>
                    <div>Draft...</div>
                  </div>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 shrink-0" />
                  <div className="text-left leading-tight text-[10px] font-extrabold uppercase tracking-wide">
                    <div>Save</div>
                    <div>Draft</div>
                  </div>
                </>
              )}
            </button>

            <button
              onClick={() => {
                setIsPrintPreview(!isPrintPreview);
              }}
              title={isPrintPreview ? "Switch back to WYSIWYG Editable Form" : "Switch to static Print Ready Mode"}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] hover:ring-2 hover:ring-purple-400 hover:ring-offset-1 hover:ring-offset-slate-950 h-11 border cursor-pointer ${
                isPrintPreview
                  ? "bg-purple-950/40 hover:bg-purple-900/40 text-purple-400 border-purple-900/30"
                  : "bg-slate-900 hover:bg-slate-800 text-slate-200 border-slate-800"
              }`}
            >
              {isPrintPreview ? <EyeOff className="w-4 h-4 shrink-0" /> : <Eye className="w-4 h-4 shrink-0" />}
              <div className="text-left leading-tight text-[10px] font-extrabold uppercase tracking-wide">
                <div>Preview</div>
                <div>PDF</div>
              </div>
            </button>

            <button
              onClick={handleSavePDF}
              disabled={pdfGenerating}
              title="Download completed CV directly as a PDF document file"
              className="flex items-center gap-2 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-all h-11 border border-emerald-600 shadow shadow-emerald-500/10 cursor-pointer"
            >
              {pdfGenerating ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin shrink-0"></div>
              ) : (
                <Download className="w-4 h-4 shrink-0" />
              )}
              <div className="text-left leading-tight text-[10px] font-extrabold uppercase tracking-wide">
                <div>Download</div>
                <div>PDF</div>
              </div>
            </button>

            <button
              onClick={handleDownloadHTML}
              title="Download self-contained offline HTML copy of this CV with all data embedded"
              className="flex items-center gap-2 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-slate-200 rounded-lg text-xs font-semibold border border-slate-800 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] hover:ring-2 hover:ring-emerald-400 hover:ring-offset-1 hover:ring-offset-slate-950 h-11 cursor-pointer"
            >
              <Download className="w-4 h-4 text-slate-400 shrink-0" />
              <div className="text-left leading-tight text-[10px] font-extrabold uppercase tracking-wide">
                <div>HTML</div>
                <div>Archive</div>
              </div>
            </button>

            <button
              onClick={handleDownloadJPEG}
              disabled={jpegGenerating}
              title="Download completed CV pages packaged together in a single ZIP archive"
              className="flex items-center gap-2 px-3 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-slate-200 rounded-lg text-xs font-semibold border border-slate-800 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] hover:ring-2 hover:ring-emerald-400 hover:ring-offset-1 hover:ring-offset-slate-950 h-11 cursor-pointer"
            >
              {jpegGenerating ? (
                <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin shrink-0"></div>
              ) : (
                <ImageIcon className="w-4 h-4 text-slate-400 shrink-0" />
              )}
              <div className="text-left leading-tight text-[10px] font-extrabold uppercase tracking-wide">
                <div>Download</div>
                <div>JPEG (ZIP)</div>
              </div>
            </button>
          </div>
        )}
      </header>

      {/* WORKSPACE CONTENT AREA */}
      <main className={`flex-1 overflow-y-auto no-print ${moduleTab === 'editor' && processingMode === "batch" ? "block" : "hidden"}`}>
        <BatchProcessor
          onReturnToSingle={(candidateCv) => {
            setCvData(candidateCv);
            setApplicationId(null);
            setSelectedApplicantId('');
            setProcessingMode("single");
          }}
        />
      </main>

      <div className={`flex-1 flex-col lg:flex-row overflow-hidden print:overflow-visible ${moduleTab === 'editor' && processingMode === "single" ? "flex" : "hidden"}`}>
          
          {/* LEFT PANEL: Uploader, Signature Drawing & Traditional Form (no-print) */}
          <aside className="w-full lg:w-[500px] border-r border-slate-800 bg-slate-950 flex flex-col h-[50vh] lg:h-full overflow-y-auto no-print select-none p-4 space-y-5">
          
          {/* TWO-COLUMN INGESTION DASHBOARD */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-900 rounded-xl border border-slate-800 p-3.5 shadow-inner">
            
            {/* Column 1 Container */}
            <div className="flex flex-col gap-2.5">
              {/* Column 1: Details Extraction Ingestion */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragOverDetails(true);
                }}
                onDragLeave={() => setIsDragOverDetails(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragOverDetails(false);
                  if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                    handleFilesAdded(e.dataTransfer.files);
                  }
                }}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-3 text-center cursor-pointer transition-all flex flex-col items-center justify-between min-h-[190px] group ${
                  isDragOverDetails
                    ? "border-sky-500 bg-sky-950/20 text-sky-400 scale-[1.01]"
                    : "border-slate-800 hover:border-sky-500 bg-slate-900/60 hover:bg-slate-900"
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={handleFileInput}
                  accept="application/pdf,image/*"
                  multiple
                  className="hidden"
                />
                
                {/* Circular blue ring and icon */}
                <div className="w-10 h-10 rounded-full bg-sky-950 border border-sky-500/30 flex items-center justify-center text-sky-400 shadow-md shadow-sky-500/10 group-hover:scale-105 transition-transform duration-300">
                  <FileText className="w-4 h-4" />
                </div>

                <div className="space-y-1">
                  <h3 className="text-[10px] font-extrabold text-white uppercase tracking-wider text-center leading-tight">
                    01. Details Extraction Ingestion
                  </h3>
                </div>

                <button
                  type="button"
                  className="w-full py-1.5 bg-sky-950/60 hover:bg-sky-900 text-sky-300 border border-sky-800 rounded-lg text-[9px] font-bold transition flex items-center justify-center gap-1 shadow-sm"
                >
                  <Upload className="w-3 h-3" />
                  Select Details Files
                </button>
              </div>

              <p className="text-[10px] text-slate-400">AI extraction runs first. If unavailable, local Sinhala/English OCR runs here. Review suggestions, or enter details manually in the editor.</p>
              {(fallbackKey > 0 || fallbackFiles.length > 0) && (
                <LocalOCRPanel embedded incomingFiles={fallbackFiles} incomingKey={fallbackKey} onApply={(items: OCRSuggestion[]) => {
            setCvData(prev => {
              const updates: Record<string, string> = {};
              for (const item of items) if (item.field in prev && typeof (prev as any)[item.field] === 'string') updates[item.field] = item.value;
              if (updates.residence && !prev.lastResidence) updates.lastResidence = updates.residence;
              return { ...prev, ...updates };
            });
            setSaveStatus('idle');
                }} />

              )}

              {/* Staged files list for Details OCR */}
              {stagedFiles.length > 0 && (
                <div className="space-y-2 bg-slate-950 p-2.5 border border-slate-800/80 rounded-xl">
                  <div className="flex items-center justify-between text-[10px] text-slate-400 px-1 font-bold">
                    <span>STAGED DOCUMENTS ({stagedFiles.length}) :</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setStagedFiles([]);
                      }}
                      className="text-red-400 hover:text-red-300 transition-colors font-medium text-[9px]"
                    >
                      Clear All
                    </button>
                  </div>
                  <div className="max-h-[110px] overflow-y-auto space-y-1.5 pr-1">
                    {stagedFiles.map((file) => (
                      <div
                        key={file.id}
                        className="flex items-center justify-between bg-slate-900 border border-slate-800 rounded-lg p-2 text-[11px] transition-colors hover:border-slate-700"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <FileText className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                          <div className="min-w-0">
                            <span className="text-slate-200 font-medium truncate block max-w-[120px]" title={file.name}>
                              {file.name}
                            </span>
                            <span className="text-[9px] text-slate-500">
                              {(file.size / 1024).toFixed(1)} KB
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveStagedFile(file.id);
                          }}
                          className="text-slate-500 hover:text-red-400 p-1 hover:bg-slate-800 rounded transition-colors"
                          title="Remove file"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      processUploadedFiles();
                    }}
                    disabled={ocrStatus === "processing" || ocrStatus === "reading"}
                    className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 text-white disabled:text-slate-500 rounded-lg text-xs font-bold transition-all shadow-md shadow-emerald-600/10 active:scale-[0.98]"
                  >
                    <Sparkles className="w-4 h-4 text-amber-300 shrink-0" />
                    <span>Extract & Auto-Fill ({stagedFiles.length})</span>
                  </button>
                </div>
              )}

              {/* Details Ingestion Status Alert System */}
              <div className="space-y-2">
                <AnimatePresence mode="wait">
                  {ocrStatus === "reading" && (
                    <motion.div
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -5 }}
                      className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-[11px] flex items-center gap-2.5"
                    >
                      <div className="w-3.5 h-3.5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                      <span className="text-slate-300 font-medium">Reading local file bytes...</span>
                    </motion.div>
                  )}

                  {ocrStatus === "processing" && (
                    <motion.div
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -5 }}
                      className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-[11px] flex flex-col gap-1"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-3.5 h-3.5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
                        <span className="text-slate-300 font-semibold">Running high-fidelity OCR...</span>
                      </div>
                      <span className="text-[10px] text-slate-500 pl-6 leading-relaxed">
                        Analyzing bilingual fields and organizing historical employment tables.
                      </span>
                    </motion.div>
                  )}

                  {ocrStatus === "success" && (
                    <motion.div
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -5 }}
                      className="bg-emerald-950/30 p-2.5 rounded-xl border border-emerald-900/30 text-[11px] flex items-center gap-2.5"
                    >
                      <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                      <div>
                        <span className="text-emerald-400 font-bold block">Extraction Complete!</span>
                        <span className="text-[10px] text-slate-400">Review extracted fields before saving; missing details remain blank.</span>
                      </div>
                    </motion.div>
                  )}

                  {ocrStatus === "error" && (
                    <motion.div
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -5 }}
                      className="bg-red-950/40 p-2.5 rounded-xl border border-red-900/30 text-[11px] flex flex-col gap-1"
                    >
                      <div className="flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                        <span className="text-red-400 font-bold">Extraction Failed</span>
                      </div>
                      <span className="text-[9px] text-red-300 leading-relaxed">{ocrError}</span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Column 2 Container */}
            <div className="flex flex-col gap-2.5">
              {/* Column 2: Signature Extraction Ingestion */}
              <div data-testid="signature-ingestion"
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragOverSig(true);
                }}
                onDragLeave={() => setIsDragOverSig(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragOverSig(false);
                  if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                    handleSignatureFilesAdded(e.dataTransfer.files);
                  }
                }}
                onClick={() => sigFileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-3 text-center cursor-pointer transition-all flex flex-col items-center justify-between min-h-[190px] group ${
                  isDragOverSig
                    ? "border-amber-500 bg-amber-950/20 text-amber-400 scale-[1.01]"
                    : "border-slate-800 hover:border-amber-500 bg-slate-900/60 hover:bg-slate-900"
                }`}
              >
                <input
                  ref={sigFileInputRef}
                  type="file"
                  onChange={handleSigFileInput}
                  accept="application/pdf,image/*"
                  multiple
                  className="hidden"
                />
                
                {/* Circular brown/orange ring and icon */}
                <div className="w-10 h-10 rounded-full bg-amber-950 border border-amber-800 text-amber-400 flex items-center justify-center text-amber-500 shadow-md shadow-amber-500/5 group-hover:scale-105 transition-transform duration-300">
                  <PenTool className="w-4 h-4" />
                </div>

                <div className="space-y-0.5">
                  <h3 className="text-[10px] font-extrabold text-white uppercase tracking-wider text-center leading-tight">
                    02. Signature Extraction Ingestion
                  </h3>
                  <p className="text-[8px] text-slate-400 text-center leading-normal">
                    AI locates and crops the applicant signature first. If unavailable, use an isolated signature image or draw/crop it manually; verify the preview.
                  </p>
                </div>

                <button
                  type="button"
                  className="w-full py-1.5 bg-amber-950/40 hover:bg-amber-900 text-amber-300 border border-amber-800 rounded-lg text-[9px] font-bold transition flex items-center justify-center gap-1 shadow-sm"
                >
                  <Upload className="w-3 h-3" />
                  Select Signature Files
                </button>
              </div>

              {/* Extracted Active Signature Display */}
              {cvData.signatureUrl && (
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex flex-col items-center justify-center gap-2 shadow">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Active Signature</span>
                  <div className="bg-white px-4 py-2 rounded-lg border border-slate-700 max-h-[70px] w-full flex items-center justify-center shadow-inner">
                    <img src={cvData.signatureUrl} alt="Active Signature" className="max-h-[50px] object-contain" referrerPolicy="no-referrer" />
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setCvData((prev) => ({ ...prev, signatureUrl: null }));
                      setSigStatus("idle");
                    }}
                    className="text-[10px] font-bold text-red-400 hover:text-red-300 transition-all hover:underline cursor-pointer"
                  >
                    Clear Signature
                  </button>
                </div>
              )}

              {/* Signature Ingestion Status Alert System */}
              <div className="space-y-2">
                <AnimatePresence mode="wait">
                  {sigStatus === "reading" && (
                    <motion.div
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -5 }}
                      className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-[11px] flex items-center gap-2.5"
                    >
                      <div className="w-3.5 h-3.5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
                      <span className="text-slate-300 font-medium">Reading signature file...</span>
                    </motion.div>
                  )}

                  {sigStatus === "processing" && (
                    <motion.div
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -5 }}
                      className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-[11px] flex items-center gap-2.5"
                    >
                      <div className="w-3.5 h-3.5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
                      <span className="text-slate-300 font-semibold">Extracting signature...</span>
                    </motion.div>
                  )}

                  {sigStatus === "success" && (
                    <motion.div
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -5 }}
                      className="bg-emerald-950/30 p-2.5 rounded-xl border border-emerald-900/30 text-[11px] flex items-center gap-2.5"
                    >
                      <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                      <div>
                        <span className="text-emerald-400 font-bold block">Signature Extracted!</span>
                        <span className="text-[10px] text-slate-400">Signature has been mapped to the CV.</span>
                      </div>
                    </motion.div>
                  )}

                  {sigStatus === "error" && (
                    <motion.div
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -5 }}
                      className="bg-red-950/40 p-2.5 rounded-xl border border-red-900/30 text-[11px] flex flex-col gap-1"
                    >
                      <div className="flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                        <span className="text-red-400 font-bold">Signature Extraction Failed</span>
                      </div>
                      <span className="text-[9px] text-red-300 leading-relaxed">{sigError}</span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

          </div>

          {/* TRADITIONAL TABBED SIDEBAR FORM */}
          <div className="flex-1 flex flex-col min-h-[300px]">
            <div className="flex items-center gap-2 mb-2 px-1">
              <Layers className="w-4 h-4 text-slate-400" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Sidebar Structured Editor
              </h2>
            </div>
            <div className="flex-1">
              <CVForm
                data={cvData}
                onChange={handleCvDataChange}
                flashedFields={flashedFields}
                appFormat={appFormat}
                onFormatChange={setAppFormat}
                onExtractFromAttachment={handleExtractFromAttachment}
                isExtractingAttachment={ocrStatus === "processing"}
                processAttachmentFiles={processAttachmentFiles}
                isProcessingAttachments={isProcessingAttachments}
                processingAttMsg={processingAttMsg}
              />
            </div>
          </div>

        </aside>

        {/* RIGHT PANEL: WYSIWYG Live A4 Paper Sheets (on-screen & printable) */}
        <main className="flex-1 overflow-y-auto bg-slate-950/40 flex flex-col items-center p-6 print:p-0 print:bg-white relative">
          
          {/* Floating Instructions Banner (no-print) */}
          <div className="max-w-[210mm] w-full bg-slate-900 border border-slate-800 rounded-xl p-4 mb-6 shadow-md no-print flex items-center justify-between gap-3 text-xs leading-relaxed text-slate-300">
            <div className="flex items-start gap-3">
              <HelpCircle className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-white block mb-0.5">Dual-Mode Professional Workspace</span>
                Active Format: <strong className={appFormat === "format3" ? "text-purple-400 font-bold" : appFormat === "format2" ? "text-blue-400 font-bold" : "text-emerald-400 font-bold"}>
                  {appFormat === "format3" ? "Format 03: Classic Curriculum Vitae Layout" : appFormat === "format2" ? "Format 02: Application Layout" : "Format 01: Bilingual CV Layout"}
                </strong>. Click any field on the paper below to edit directly.
              </div>
            </div>
            
            {/* Quick Format Switcher Badge */}
            <div className="flex items-center gap-1 bg-slate-800 p-1 rounded-lg border border-slate-700 shrink-0">
              <button
                onClick={() => setAppFormat("format1")}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
                  appFormat === "format1"
                    ? "bg-emerald-600 text-white shadow"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Format 01
              </button>
              <button
                onClick={() => setAppFormat("format2")}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
                  appFormat === "format2"
                    ? "bg-blue-600 text-white shadow"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Format 02
              </button>
              <button
                onClick={() => setAppFormat("format3")}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
                  appFormat === "format3"
                    ? "bg-purple-600 text-white shadow"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Format 03
              </button>
            </div>
          </div>

          {/* The high-fidelity papers */}
          <div className="w-full flex flex-col items-center gap-8 pb-12 print:p-0 print:gap-0 print:m-0 print:block">
            <CVPaper
              data={cvData}
              onChange={handleCvDataChange}
              flashedFields={flashedFields}
              isPrintMode={isPrintPreview}
              appFormat={appFormat}
              onExtractFromAttachment={handleExtractFromAttachment}
            />
          </div>
        </main>

      </div>

      {/* Full Screen PDF or JPEG Generation Loading Overlay */}
      <AnimatePresence>
        {(pdfGenerating || jpegGenerating) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-950/95 flex flex-col items-center justify-center z-[100000] no-print"
          >
            <div className="flex flex-col items-center gap-4 text-center p-6">
              <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              <div className="space-y-2">
                <h2 className="text-lg font-bold text-white tracking-wide">
                  {pdfGenerating ? "Generating PDF Document" : "Generating JPEG Images"}
                </h2>
                <p className="text-xs text-slate-400 max-w-sm leading-relaxed">
                  {pdfGenerating 
                    ? "Compiling, styling, and formatting bilingual curriculum layouts into exact A4 pages. This guarantees perfect fonts, colors, and structure."
                    : "Rendering high-fidelity pages into pixel-perfect JPEG images for instant download and digital sharing."}
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {showClearConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-[110000] no-print p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-md w-full shadow-2xl space-y-4"
            >
              <div className="flex items-center gap-3 text-red-400">
                <AlertCircle className="w-6 h-6 shrink-0" />
                <h3 className="text-base font-bold text-white">Clear All Details?</h3>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Are you sure you want to clear all details and start with a blank CV format? This action is irreversible.
              </p>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => setShowClearConfirm(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    executeClearAll();
                    setShowClearConfirm(false);
                  }}
                  className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-bold transition-all shadow-md shadow-red-600/10 hover:shadow-red-600/20"
                >
                  Clear Fields
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {showResetConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-[110000] no-print p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-md w-full shadow-2xl space-y-4"
            >
              <div className="flex items-center gap-3 text-amber-400">
                <RotateCcw className="w-6 h-6 shrink-0" />
                <h3 className="text-base font-bold text-white">Load Sri Lankan Sample?</h3>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Are you sure you want to reset all fields to the default Sri Lankan sample CV? Current changes will be overwritten.
              </p>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => setShowResetConfirm(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    executeReset();
                    setShowResetConfirm(false);
                  }}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold transition-all shadow-md shadow-amber-600/10"
                >
                  Load Sample
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
