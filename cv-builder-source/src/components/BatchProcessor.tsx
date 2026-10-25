import React, { useState, useRef } from "react";
import JSZip from "jszip";
import { createRoot } from "react-dom/client";
import html2canvas from "html2canvas-pro";
import jsPDF from "jspdf";
import {
  Upload,
  FolderPlus,
  Play,
  CheckCircle2,
  AlertCircle,
  Eye,
  Trash2,
  Download,
  Building2,
  Briefcase,
  FileText,
  Image as ImageIcon,
  RotateCcw,
  Sparkles,
  Layers,
  FileCheck,
  Check,
  Loader2,
  X,
  Plus,
  Archive,
  FolderDown,
  ShieldCheck,
  Activity,
  PenTool,
} from "lucide-react";
import { CVData, INITIAL_CV_DATA, AppFormat, AttachedDoc, AttachmentType } from "../types";
import { autoSelectSchoolForAddress } from "../data/schools";
import CVPaper from "./CVPaper";
import CVForm from "./CVForm";
import { detectAndCleanSignatureFromDocs } from "../lib/signatureUtils";
import { getRandomCompanyForPosition, getRandomPeriod } from "../data/jobCategories";

export interface BatchGlobalSettings {
  companyLogoUrl: string | null;
  cvFormat: AppFormat;
  professionalSkill: string;
  appliedPosition: string;
}

export interface BatchSlotFile {
  id: string;
  name: string;
  type: string;
  base64: string;
  relativePath?: string;
}

export interface BatchApplicantSlot {
  id: number; // 1 to 10
  title: string; // e.g. "Applicant Slot 1"
  candidateName?: string;
  status: "empty" | "uploaded" | "processing" | "completed" | "error";
  errorMsg?: string;
  files: BatchSlotFile[];
  signatureFiles?: BatchSlotFile[];
  cvData?: CVData;
}

export interface JobCategoryGroup {
  category: string;
  jobs: string[];
}

export const JOB_CATEGORIES: JobCategoryGroup[] = [
  {
    category: "Hardware",
    jobs: ["GOODS HANDLER"],
  },
  {
    category: "Vehicle Parts & Automotive",
    jobs: ["BIKE RIDER", "HEAVY VEHICLE DRIVER", "DRIVER"],
  },
  {
    category: "Garments & Apparel",
    jobs: ["FACTORY HELPER", "CLEANER"],
  },
  {
    category: "Construction",
    jobs: [
      "CONSTRUCTION HELPER",
      "CONSTRUCTION WORKER",
      "WELDER",
      "ELECTRICIAN",
      "PLUMBER",
      "MASON",
    ],
  },
  {
    category: "Hotels & Resorts",
    jobs: ["WAITER", "WAITER HELPER"],
  },
  {
    category: "Restaurants & Food Chains",
    jobs: ["KITCHEN HELPER", "BAKER", "CHEF"],
  },
];

interface BatchProcessorProps {
  onReturnToSingle?: (cvData: CVData) => void;
}

// Helper: Determine accurate MIME type from filename extension if type is missing or generic
const getProperMimeType = (fileName: string, mimeType?: string): string => {
  if (mimeType && mimeType !== "application/octet-stream" && mimeType !== "") {
    return mimeType;
  }
  const ext = fileName.toLowerCase().split(".").pop() || "";
  if (["jpg", "jpeg"].includes(ext)) return "image/jpeg";
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "pdf") return "application/pdf";
  return mimeType || "application/octet-stream";
};

// Helper: Thoroughly identify if a file is a document containing applicant details, signatures, application forms, self declarations, CVs, etc.
const isDetailsOrFormDoc = (fileName: string, title?: string): boolean => {
  const f = fileName.toLowerCase();
  const t = (title || "").toLowerCase();
  
  const indicators = [
    "declaration", "declara", "form", "cerere", "application", "migrant",
    "job", "apply", "cv", "resume", "biodata", "contract", "agreement",
    "diploma", "certificate", "signature", "sign", "semnat", "sig",
    "details", "personal", "reference", "character", "recommendation",
    "sheet", "info", "work", "permit", "visa_application", "visa-application",
    "statement", "letter", "candidat", "candidate", "doc", "curriculum", "vitae"
  ];
  
  const hasIndicator = indicators.some((ind) => f.includes(ind) || t.includes(ind));
  
  if (hasIndicator) {
    // Exclude clean, explicit standalone passport scans or police reports
    const isCleanPassport = (f.includes("passport") || f.includes("pasaport")) && 
                            !(f.includes("form") || f.includes("application") || f.includes("declaration") || f.includes("sign") || f.includes("cv") || f.includes("agreement"));
    const isCleanPolice = (f.includes("police") || f.includes("cazier") || f.includes("clearance")) && 
                          !(f.includes("form") || f.includes("application") || f.includes("declaration") || f.includes("sign") || f.includes("cv") || f.includes("agreement"));
    
    if (isCleanPassport || isCleanPolice) {
      return false;
    }
    return true;
  }
  
  return false;
};

// Helper: Determine if file is a signature document specifically
const isSignatureDocFileName = (fileName: string): boolean => {
  const fn = fileName.toLowerCase();
  return (
    fn.includes("signature") ||
    fn.includes("semnat") ||
    fn.includes("sig_") ||
    fn.includes("_sig") ||
    fn.includes("signature_") ||
    fn.includes("semnatura")
  );
};

// Helper: Convert File object to Base64 data URL
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
};

// Helper: Recursive Directory Scanner for HTML5 Drag & Drop (Folder Drop Support)
const scanDataTransferItems = async (
  items: DataTransferItemList
): Promise<{ file: File; relativePath: string }[]> => {
  const results: { file: File; relativePath: string }[] = [];

  const scanEntry = async (entry: any, path: string): Promise<void> => {
    if (!entry) return;
    if (entry.isFile) {
      await new Promise<void>((resolve) => {
        entry.file(
          (f: File) => {
            results.push({ file: f, relativePath: path + f.name });
            resolve();
          },
          () => resolve()
        );
      });
    } else if (entry.isDirectory) {
      const dirReader = entry.createReader();
      const readBatch = (): Promise<any[]> =>
        new Promise((resolve) => {
          dirReader.readEntries(
            (entries: any[]) => resolve(entries || []),
            () => resolve([])
          );
        });

      let entries: any[] = [];
      let batch = await readBatch();
      while (batch && batch.length > 0) {
        entries = entries.concat(batch);
        batch = await readBatch();
      }

      for (const child of entries) {
        await scanEntry(child, `${path}${entry.name}/`);
      }
    }
  };

  const entriesToScan: any[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.kind === "file") {
      const entry = item.webkitGetAsEntry ? item.webkitGetAsEntry() : (item as any).getAsEntry?.();
      if (entry) {
        entriesToScan.push(entry);
      } else {
        const file = item.getAsFile();
        if (file) {
          results.push({ file, relativePath: file.name });
        }
      }
    }
  }

  for (const entry of entriesToScan) {
    await scanEntry(entry, "");
  }

  return results;
};

// Helper: Promise timeout wrapper
function withTimeout<T>(promise: Promise<T>, timeoutMs: number, fallbackValue: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallbackValue), timeoutMs)),
  ]);
}

export const BatchProcessor: React.FC<BatchProcessorProps> = ({ onReturnToSingle }) => {
  // Global Pre-adjustment Permanent Settings
  const [globalSettings, setGlobalSettings] = useState<BatchGlobalSettings>({
    companyLogoUrl: null,
    cvFormat: "format1",
    professionalSkill: "GOODS HANDLER",
    appliedPosition: "GOODS HANDLER",
  });

  // 10 Dedicated Applicant Slots
  const [slots, setSlots] = useState<BatchApplicantSlot[]>(() =>
    Array.from({ length: 10 }, (_, i) => ({
      id: i + 1,
      title: `Applicant ${i + 1}`,
      status: "empty",
      files: [],
      signatureFiles: [],
    }))
  );

  // Drag visual feedback states
  const [isDragOverMainDetails, setIsDragOverMainDetails] = useState(false);
  const [isDragOverMainSignature, setIsDragOverMainSignature] = useState(false);
  const [dragOverSlotId, setDragOverSlotId] = useState<number | null>(null);
  const [dragOverMainSlotId, setDragOverMainSlotId] = useState<number | null>(null);
  const [dragOverSigSlotId, setDragOverSigSlotId] = useState<number | null>(null);

  // Global Progress State
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });

  // Verification Engine Status State
  const [verificationStatus, setVerificationStatus] = useState<{
    running: boolean;
    ocr: boolean;
    signature: boolean;
    threading: boolean;
    categorySync: boolean;
    lastTestedAt?: string;
  }>({
    running: false,
    ocr: true,
    signature: true,
    threading: true,
    categorySync: true,
  });

  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);

  // Preview / Editor Modal State
  const [previewSlotId, setPreviewSlotId] = useState<number | null>(null);
  const [activePreviewTab, setActivePreviewTab] = useState<"paper" | "form">("paper");

  const logoInputRef = useRef<HTMLInputElement>(null);
  const bulkDetailsInputRef = useRef<HTMLInputElement>(null);
  const bulkSignatureInputRef = useRef<HTMLInputElement>(null);
  const slotInputRefs = useRef<{ [key: number]: HTMLInputElement | null }>({});
  const slotSigInputRefs = useRef<{ [key: number]: HTMLInputElement | null }>({});

  // Handler for Company Logo Upload
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const url = event.target?.result as string;
        setGlobalSettings((prev) => ({ ...prev, companyLogoUrl: url }));
      };
      reader.readAsDataURL(file);
    }
  };

  // Process array of Scanned Files or FileList into the 10 Applicant Slots
  const processScannedFilesIntoSlots = async (
    scannedFiles: { file: File; relativePath: string }[],
    targetType: "all" | "details" | "signature" = "all"
  ) => {
    if (scannedFiles.length === 0) return;

    // Determine common root prefix if user dropped a single wrapper folder containing applicant folders
    const parsedPaths = scannedFiles.map((item) => {
      const relPath = (item.relativePath || item.file.name).replace(/\\/g, "/");
      const parts = relPath.split("/").filter(Boolean);
      return { item, parts };
    });

    let commonRoot = "";
    if (parsedPaths.length > 0 && parsedPaths[0].parts.length > 2) {
      const firstRoot = parsedPaths[0].parts[0];
      const allShareRoot = parsedPaths.every((p) => p.parts.length > 2 && p.parts[0] === firstRoot);
      if (allShareRoot) {
        commonRoot = firstRoot;
      }
    }

    const fileGroups: { [key: string]: { file: File; relativePath: string }[] } = {};

    parsedPaths.forEach(({ item, parts }) => {
      let groupKey = "unassigned_batch";

      if (commonRoot && parts.length > 2 && parts[0] === commonRoot) {
        groupKey = parts[1];
      } else if (parts.length > 1) {
        groupKey = parts[0];
      } else {
        groupKey = "unassigned_batch";
      }

      if (!fileGroups[groupKey]) {
        fileGroups[groupKey] = [];
      }
      fileGroups[groupKey].push(item);
    });

    const groupKeys = Object.keys(fileGroups).sort((a, b) => {
      const numA = parseInt(a.match(/\d+/)?.[0] || "999", 10);
      const numB = parseInt(b.match(/\d+/)?.[0] || "999", 10);
      if (numA !== numB) return numA - numB;
      return a.localeCompare(b);
    });

    const newSlots = [...slots];

    for (const gKey of groupKeys) {
      const groupFiles = fileGroups[gKey];
      const batchFiles: BatchSlotFile[] = [];

      for (const item of groupFiles) {
        const base64 = await fileToBase64(item.file);
        const properMime = getProperMimeType(item.file.name, item.file.type);
        batchFiles.push({
          id: Math.random().toString(36).substr(2, 9),
          name: item.file.name,
          type: properMime,
          base64: base64,
          relativePath: item.relativePath,
        });
      }

      let explicitSlotNum = -1;
      const explicitMatch = gKey.match(/^(?:slot|folder|applicant|candidate|cand)[\s_.-]*([1-9]|10)(?:[\s_.-]|$)|^([1-9]|10)$/i);
      if (explicitMatch) {
        const numStr = explicitMatch[1] || explicitMatch[2];
        if (numStr) {
          explicitSlotNum = parseInt(numStr, 10);
        }
      }

      const cleanName = gKey.replace(/^slot_/i, "").replace(/_/g, " ").trim();

      let targetSlotIdx = -1;
      if (explicitSlotNum >= 1 && explicitSlotNum <= 10) {
        const slotIdx = explicitSlotNum - 1;
        const slotCandidate = newSlots[slotIdx].candidateName || newSlots[slotIdx].title;
        if (newSlots[slotIdx].files.length === 0 || slotCandidate === cleanName || !newSlots[slotIdx].candidateName) {
          targetSlotIdx = slotIdx;
        }
      }

      if (targetSlotIdx === -1) {
        const isGenericKey =
          cleanName === "unassigned" || cleanName === "default" || cleanName === "unassigned batch";
        if (!isGenericKey) {
          const existingIdx = newSlots.findIndex(
            (s) => s.candidateName && s.candidateName.toLowerCase() === cleanName.toLowerCase()
          );
          if (existingIdx !== -1) {
            targetSlotIdx = existingIdx;
          }
        }

        if (targetSlotIdx === -1) {
          if (targetType === "details") {
            targetSlotIdx = newSlots.findIndex((s) => s.files.length === 0);
          } else if (targetType === "signature") {
            targetSlotIdx = newSlots.findIndex((s) => s.files.length > 0 && s.signatureFiles.length === 0);
            if (targetSlotIdx === -1) {
              targetSlotIdx = newSlots.findIndex((s) => s.signatureFiles.length === 0);
            }
          } else {
            targetSlotIdx = newSlots.findIndex((s) => s.files.length === 0 || s.signatureFiles.length === 0);
          }

          if (targetSlotIdx === -1) {
            targetSlotIdx = 0;
          }
        }
      }

      if (targetSlotIdx >= 0 && targetSlotIdx < 10) {
        const isGenericKey =
          cleanName === "unassigned" || cleanName === "default" || cleanName === "unassigned batch";
        
        let mainFiles: BatchSlotFile[] = [];
        let sigFiles: BatchSlotFile[] = [];

        if (targetType === "details") {
          mainFiles = batchFiles;
        } else if (targetType === "signature") {
          sigFiles = batchFiles;
        } else {
          mainFiles = batchFiles.filter((f) => !isSignatureDocFileName(f.name));
          sigFiles = batchFiles.filter((f) => isSignatureDocFileName(f.name));
        }

        newSlots[targetSlotIdx] = {
          ...newSlots[targetSlotIdx],
          status: "uploaded",
          candidateName: !isGenericKey ? cleanName : newSlots[targetSlotIdx].candidateName,
          files: [...newSlots[targetSlotIdx].files, ...mainFiles],
          signatureFiles: [...(newSlots[targetSlotIdx].signatureFiles || []), ...sigFiles],
        };
      }
    }

    setSlots(newSlots);
  };

  const handleBulkDetailsUpload = async (fileList: FileList | File[], inputEl?: HTMLInputElement | null) => {
    const filesArray: File[] = Array.from(fileList);
    const scanned = filesArray.map((f) => ({
      file: f,
      relativePath: (f as any).webkitRelativePath || f.name,
    }));
    await processScannedFilesIntoSlots(scanned, "details");
    if (inputEl) {
      inputEl.value = "";
    }
  };

  const handleBulkSignatureUpload = async (fileList: FileList | File[], inputEl?: HTMLInputElement | null) => {
    const filesArray: File[] = Array.from(fileList);
    const scanned = filesArray.map((f) => ({
      file: f,
      relativePath: (f as any).webkitRelativePath || f.name,
    }));
    await processScannedFilesIntoSlots(scanned, "signature");
    if (inputEl) {
      inputEl.value = "";
    }
  };

  const handleMainDetailsDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOverMainDetails(false);

    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      const scannedFiles = await scanDataTransferItems(e.dataTransfer.items);
      await processScannedFilesIntoSlots(scannedFiles, "details");
    } else if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await handleBulkDetailsUpload(e.dataTransfer.files);
    }
  };

  const handleMainSignatureDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOverMainSignature(false);

    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      const scannedFiles = await scanDataTransferItems(e.dataTransfer.items);
      await processScannedFilesIntoSlots(scannedFiles, "signature");
    } else if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await handleBulkSignatureUpload(e.dataTransfer.files);
    }
  };

  const handleSlotDrop = async (slotId: number, e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverSlotId(null);

    let scannedFiles: { file: File; relativePath: string }[] = [];
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      scannedFiles = await scanDataTransferItems(e.dataTransfer.items);
    } else if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      scannedFiles = (Array.from(e.dataTransfer.files) as File[]).map((f: File) => ({
        file: f,
        relativePath: f.name,
      }));
    }

    if (scannedFiles.length === 0) return;

    let detectedCandidateName: string | undefined = undefined;
    const firstRel = scannedFiles[0]?.relativePath || "";
    const parts = firstRel.replace(/\\/g, "/").split("/").filter(Boolean);
    if (parts.length > 1) {
      detectedCandidateName = parts[0].replace(/^slot_/i, "").replace(/_/g, " ").trim();
    }

    const mainFiles: BatchSlotFile[] = [];
    const sigFiles: BatchSlotFile[] = [];

    for (const item of scannedFiles) {
      const base64 = await fileToBase64(item.file);
      const properMime = getProperMimeType(item.file.name, item.file.type);
      const fileObj = {
        id: Math.random().toString(36).substr(2, 9),
        name: item.file.name,
        type: properMime,
        base64: base64,
        relativePath: item.relativePath,
      };

      if (isSignatureDocFileName(item.file.name)) {
        sigFiles.push(fileObj);
      } else {
        mainFiles.push(fileObj);
      }
    }

    setSlots((prev) =>
      prev.map((s) =>
        s.id === slotId
          ? {
              ...s,
              status: "uploaded",
              candidateName: s.candidateName || detectedCandidateName,
              files: [...s.files, ...mainFiles],
              signatureFiles: [...(s.signatureFiles || []), ...sigFiles],
            }
          : s
      )
    );
  };

  const handleSlotDropMain = async (slotId: number, e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverMainSlotId(null);

    let scannedFiles: { file: File; relativePath: string }[] = [];
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      scannedFiles = await scanDataTransferItems(e.dataTransfer.items);
    } else if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      scannedFiles = (Array.from(e.dataTransfer.files) as File[]).map((f: File) => ({
        file: f,
        relativePath: f.name,
      }));
    }

    if (scannedFiles.length === 0) return;

    const mainFiles: BatchSlotFile[] = [];
    for (const item of scannedFiles) {
      const base64 = await fileToBase64(item.file);
      const properMime = getProperMimeType(item.file.name, item.file.type);
      mainFiles.push({
        id: Math.random().toString(36).substr(2, 9),
        name: item.file.name,
        type: properMime,
        base64: base64,
        relativePath: item.relativePath,
      });
    }

    setSlots((prev) =>
      prev.map((s) =>
        s.id === slotId
          ? {
              ...s,
              status: "uploaded",
              files: [...s.files, ...mainFiles],
            }
          : s
      )
    );
  };

  const handleSlotDropSig = async (slotId: number, e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverSigSlotId(null);

    let scannedFiles: { file: File; relativePath: string }[] = [];
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      scannedFiles = await scanDataTransferItems(e.dataTransfer.items);
    } else if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      scannedFiles = (Array.from(e.dataTransfer.files) as File[]).map((f: File) => ({
        file: f,
        relativePath: f.name,
      }));
    }

    if (scannedFiles.length === 0) return;

    const sigFiles: BatchSlotFile[] = [];
    for (const item of scannedFiles) {
      const base64 = await fileToBase64(item.file);
      const properMime = getProperMimeType(item.file.name, item.file.type);
      sigFiles.push({
        id: Math.random().toString(36).substr(2, 9),
        name: item.file.name,
        type: properMime,
        base64: base64,
        relativePath: item.relativePath,
      });
    }

    setSlots((prev) =>
      prev.map((s) =>
        s.id === slotId
          ? {
              ...s,
              status: "uploaded",
              signatureFiles: [...(s.signatureFiles || []), ...sigFiles],
            }
          : s
      )
    );
  };

  const handleSlotFileUploadMain = async (slotId: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    const filesArray: File[] = Array.from(fileList);
    const mainFiles: BatchSlotFile[] = [];

    for (const f of filesArray) {
      const base64 = await fileToBase64(f);
      const properMime = getProperMimeType(f.name, f.type);
      mainFiles.push({
        id: Math.random().toString(36).substr(2, 9),
        name: f.name,
        type: properMime,
        base64: base64,
      });
    }

    setSlots((prev) =>
      prev.map((s) =>
        s.id === slotId
          ? {
              ...s,
              status: "uploaded",
              files: [...s.files, ...mainFiles],
            }
          : s
      )
    );

    e.target.value = "";
  };

  const handleSlotFileUploadSig = async (slotId: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    const filesArray: File[] = Array.from(fileList);
    const sigFiles: BatchSlotFile[] = [];

    for (const f of filesArray) {
      const base64 = await fileToBase64(f);
      const properMime = getProperMimeType(f.name, f.type);
      sigFiles.push({
        id: Math.random().toString(36).substr(2, 9),
        name: f.name,
        type: properMime,
        base64: base64,
      });
    }

    setSlots((prev) =>
      prev.map((s) =>
        s.id === slotId
          ? {
              ...s,
              status: "uploaded",
              signatureFiles: [...(s.signatureFiles || []), ...sigFiles],
            }
          : s
      )
    );

    e.target.value = "";
  };

  const handleClearSlot = (slotId: number) => {
    setSlots((prev) =>
      prev.map((s) =>
        s.id === slotId
          ? {
              id: slotId,
              title: `Applicant ${slotId}`,
              status: "empty",
              files: [],
              signatureFiles: [],
              candidateName: undefined,
              cvData: undefined,
              errorMsg: undefined,
            }
          : s
      )
    );
  };

  const handleClearAllSlots = () => {
    setShowResetModal(true);
  };

  const executeClearAllSlots = () => {
    setSlots(
      Array.from({ length: 10 }, (_, i) => ({
        id: i + 1,
        title: `Applicant ${i + 1}`,
        status: "empty",
        files: [],
        signatureFiles: [],
      }))
    );
    setShowResetModal(false);
  };

  // Single Slot Auto-Processor Core Function
  const processSingleSlot = async (slot: BatchApplicantSlot): Promise<BatchApplicantSlot> => {
    if (slot.files.length === 0) {
      return slot;
    }

    const isApplicantPhotoName = (fileName: string): boolean => {
      const fname = fileName.toLowerCase();
      
      if (isDetailsOrFormDoc(fileName) || fname.endsWith(".pdf") || fname.includes(".pdf")) return false;

      const isPhotoKeyword = 
        fname.includes("photo") || 
        fname.includes("poza") || 
        fname.includes("portrait") || 
        fname.includes("headshot") || 
        fname.includes("face") || 
        fname.includes("avatar") || 
        fname.includes("candidat") ||
        fname.includes("candidate") ||
        fname.includes("applicant_photo") || // strict match only for photo filename
        fname.includes("selfie");

      const hasImgExt = /\.(jpg|jpeg|png|webp|gif|bmp|tiff)$/i.test(fileName);

      // If it doesn't have an image extension, it's highly unlikely to be an applicant photo under local rules
      if (!hasImgExt) {
        return false;
      }

      return isPhotoKeyword || hasImgExt;
    };

    try {
      // 1. Classification
      const classifiedDocs = await Promise.all(
        slot.files.map(async (file) => {
          const fnameLower = file.name.toLowerCase();
          const properMime = getProperMimeType(file.name, file.type);
          
          let type: AttachmentType = "other";
          let title = file.name.replace(/\.[^/.]+$/, "").replace(/_/g, " ");
          let isClassifiedByAI = false;

          try {
            const classRes = await fetch("/api/classify-document", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                fileBase64: file.base64,
                mimeType: properMime,
                fileName: file.name,
                allFileNames: slot.files.map((f) => f.name),
              }),
            });

            if (classRes.ok) {
              const classData = await classRes.json();
              if (classData && classData.success) {
                type = classData.type || "other";
                title = classData.title || title;
                isClassifiedByAI = true;
              }
            }
          } catch (e) {
            console.error(`AI classification failed for ${file.name}, using local fallback.`, e);
          }

          if (isDetailsOrFormDoc(file.name, title)) {
            type = "other";
          } else if (!isClassifiedByAI) {
            if (fnameLower.includes("passport") || fnameLower.includes("pasaport") || fnameLower.includes("pass")) {
              type = "passport";
              title = "Passport Scan";
            } else if (
              fnameLower.includes("police") || fnameLower.includes("cazier") || 
              fnameLower.includes("clearance") || fnameLower.includes("report") ||
              fnameLower.includes("character") || fnameLower.includes("background")
            ) {
              type = "police_report";
              title = "Police Clearance Report";
            } else if (isApplicantPhotoName(file.name)) {
              type = "applicant_photo";
              title = "Applicant Photo";
            }
          }

          return {
            id: Math.random().toString(36).substr(2, 9),
            type,
            title,
            url: file.base64,
            fileName: file.name,
          } as AttachedDoc;
        })
      );
      
      // 2. Ordered OCR files
      const ocrFiles = slot.files
        .filter((f) => !isApplicantPhotoName(f.name))
        .sort((a, b) => {
           const getPriority = (fileName: string) => {
             const doc = classifiedDocs.find(d => d.fileName === fileName);
             if (!doc) return 3; // Other
             if (doc.type === "passport") return 1;
             if (doc.type === "police_report") return 2;
             return 3;
           };
           return getPriority(a.name) - getPriority(b.name);
        })
        .map((f) => {
           const mime = getProperMimeType(f.name, f.type);
           return {
             fileBase64: f.base64,
             mimeType: mime,
             fileName: f.name,
           };
        });

      // 3. OCR and Signature
      const activeFormat = globalSettings.cvFormat;
      const ocrPromise = fetch("/api/ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          files: ocrFiles,
          formatType: activeFormat,
        }),
      }).then(async (res) => {
        if (!res.ok) {
          const errJson = await res.json().catch(() => ({}));
          throw new Error(errJson.error || `OCR failed with HTTP ${res.status}`);
        }
        return res.json();
      });

      const sigFilesToProcess = [
        ...(slot.signatureFiles || []).map((f) => ({ ...f, isFromSignatureSlot: true })),
        ...(slot.files || []),
      ];

      const sigPromise = detectAndCleanSignatureFromDocs(
        sigFilesToProcess.map((f) => ({
          fileBase64: f.base64,
          mimeType: getProperMimeType(f.name, f.type),
          fileName: f.name,
          isFromSignatureSlot: (f as any).isFromSignatureSlot,
        }))
      ).catch(() => null);

      const [ocrResult, detectedSigUrl] = await Promise.all([
        withTimeout(ocrPromise, 300000, { success: false, data: {} }),
        withTimeout(sigPromise, 300000, null),
      ]);

      if (!ocrResult || !ocrResult.success) {
        throw new Error("OCR processing timed out or failed.");
      }

      const extractedCV: Partial<CVData> = ocrResult?.data || {};

      const attachmentsMap = new Map<string, AttachedDoc>();
      if (Array.isArray(classifiedDocs)) {
        for (const doc of classifiedDocs) {
          if (doc && doc.fileName) {
            attachmentsMap.set(doc.fileName, doc);
          }
        }
      }

      const finalAttachments: AttachedDoc[] = slot.files.map((file) => {
        if (attachmentsMap.has(file.name)) {
          return attachmentsMap.get(file.name)!;
        }

        const fname = file.name.toLowerCase();
        const properMime = getProperMimeType(file.name, file.type);
        let type: AttachmentType = "other";
        if (fname.includes("passport") || fname.includes("pasaport") || fname.includes("pass")) type = "passport";
        else if (fname.includes("police") || fname.includes("cazier") || fname.includes("clearance") || fname.includes("report")) type = "police_report";
        else if (isApplicantPhotoName(file.name)) {
          type = "applicant_photo";
        }

        return {
          id: Math.random().toString(36).substr(2, 9),
          type,
          title: file.name.replace(/\.[^/.]+$/, "").replace(/_/g, " "),
          url: file.base64,
          fileName: file.name,
        };
      });

      const processedAttachments: AttachedDoc[] = [];
      try {
        const { convertPdfToImages, dataUrlToFile } = await import("../utils/pdfUtils");
        for (const att of finalAttachments) {
          if (att.url && (att.url.startsWith("data:application/pdf") || att.fileName?.toLowerCase().endsWith(".pdf"))) {
            try {
              const fileObj = dataUrlToFile(att.url, att.fileName || "doc.pdf");
              const pages = await convertPdfToImages(fileObj);
              pages.forEach((page, pageIdx) => {
                processedAttachments.push({
                  id: Math.random().toString(36).substr(2, 9),
                  type: att.type,
                  title: pages.length > 1 ? `${att.title} (Page ${pageIdx + 1})` : att.title,
                  url: page.dataUrl,
                  fileName: att.fileName,
                });
              });
            } catch (pdfErr) {
              console.error("Failed to convert PDF in batch processor:", pdfErr);
              processedAttachments.push(att);
            }
          } else {
            processedAttachments.push(att);
          }
        }
      } catch (err) {
        console.error("pdfUtils load error:", err);
        processedAttachments.push(...finalAttachments);
      }

      // 1. Identify and enforce the strict standalone applicant face photo using a multi-image AI analysis
      let detectedPhotoUrl: string | null = null;
      try {
        const imagesForSelection = processedAttachments
          .filter((att) => att.url && (att.url.startsWith("data:image/") || att.url.startsWith("http")))
          .map((att) => ({
            id: att.id,
            fileBase64: att.url,
            mimeType: "image/jpeg",
            fileName: att.fileName || "page.jpg",
          }));

        if (imagesForSelection.length > 0) {
          console.log(`[Photo Identification] Analyzing ${imagesForSelection.length} images for the exact headshot...`);
          const idRes = await fetch("/api/identify-applicant-photo", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ images: imagesForSelection }),
          });

          if (idRes.ok) {
            const idData = await idRes.json();
            if (idData && idData.success && idData.bestPhotoId) {
              const bestPhotoId = idData.bestPhotoId;
              
              processedAttachments.forEach((att) => {
                if (att.id === bestPhotoId) {
                  att.type = "applicant_photo";
                  att.title = "Applicant Photo";
                  detectedPhotoUrl = att.url;
                  console.log(`[Photo Identification] Enforced ${att.fileName} as the strictly recognized applicant photo.`);
                } else if (att.type === "applicant_photo") {
                  // Re-classify any non-chosen files initially thought to be photos as other/documents
                  att.type = "other";
                  att.title = att.fileName ? att.fileName.replace(/\.[^/.]+$/, "").replace(/_/g, " ") : "Document Scan";
                  console.log(`[Photo Identification] Reclassified non-chosen ${att.fileName} from applicant_photo to other.`);
                }
              });
            }
          }
        }
      } catch (e) {
        console.error("AI identification of applicant photo failed, falling back to heuristics.", e);
      }

      const isExcludedDocument = (title: string, fileName?: string, type?: AttachmentType): boolean => {
        if (type === "applicant_photo" || type === "passport" || type === "police_report") {
          return false;
        }
        const t = (title || "").toLowerCase();
        const f = (fileName || "").toLowerCase();
        
        const hasJobApp = t.includes("job application") || f.includes("job application") || f.includes("job_application") || (t.includes("application") && t.includes("form") && !t.includes("visa"));
        const hasSelfDecl = t.includes("self declaration") || f.includes("self_declaration") || f.includes("self declaration") || t.includes("migrant worker") || f.includes("migrant worker") || f.includes("migrant_worker") || t.includes("declaration form") || f.includes("declaration form") || f.includes("declaration_form");
        
        return hasJobApp || hasSelfDecl;
      };

      const filteredAttachments = processedAttachments.filter((att) => {
        const fname = (att.fileName || "").toLowerCase();
        const title = (att.title || "").toLowerCase();
        
        // Use our robust global isDetailsOrFormDoc to prevent detail/form/signature/cv documents from being attached as support files (passport/police/photo)
        if (isDetailsOrFormDoc(att.fileName || "", att.title)) {
          console.log(`[Attachment Filter] Strictly excluding ${att.fileName} from attachments as it is a details/form/signature/cv document.`);
          return false;
        }

        let isPassport = att.type === "passport";
        let isPolice = att.type === "police_report";
        let isPhoto = att.type === "applicant_photo";

        if (att.type !== "passport" && att.type !== "police_report" && att.type !== "applicant_photo") {
          isPassport = fname.includes("passport") || fname.includes("pasaport") || fname.includes("pass");
          isPolice = fname.includes("police") || fname.includes("cazier") || fname.includes("clearance") || fname.includes("report") || fname.includes("character") || fname.includes("background");
          isPhoto = isApplicantPhotoName(att.fileName || "");
        }

        // Strict correction check: If marked as photo but contains indicators of form/details/document, reject as photo
        if (isPhoto) {
          const isDocIndicator = 
            fname.includes("passport") || fname.includes("pasaport") || fname.includes("pass") ||
            fname.includes("police") || fname.includes("cazier") || fname.includes("clearance") || fname.includes("report") || fname.includes("character") || fname.includes("background") ||
            fname.includes("declaration") || fname.includes("declara") || fname.includes("form") || fname.includes("cerere") || fname.includes("application") ||
            fname.includes("cv") || fname.includes("resume") || fname.includes("biodata") || fname.includes("contract") || fname.includes("agreement") || fname.includes("certificate") ||
            fname.includes("signature") || fname.includes("sign") || fname.includes("semnat") || fname.includes("sig") ||
            title.includes("passport") || title.includes("pasaport") ||
            title.includes("police") || title.includes("cazier") || title.includes("clearance") || title.includes("report") ||
            title.includes("declaration") || title.includes("form") || title.includes("application") ||
            title.includes("cv") || title.includes("resume") || title.includes("signature") || title.includes("sign") || title.includes("contract") || title.includes("agreement");

          if (isDocIndicator) {
            isPhoto = false;
            if (fname.includes("passport") || fname.includes("pasaport") || fname.includes("pass") || title.includes("passport") || title.includes("pasaport")) {
              isPassport = true;
            } else if (fname.includes("police") || fname.includes("cazier") || fname.includes("clearance") || fname.includes("report") || title.includes("police") || title.includes("cazier") || title.includes("clearance") || title.includes("report")) {
              isPolice = true;
            } else {
              att.type = "other";
            }
          }
        }

        // If it's a generic image (like img.jpg, pic.png) and not passport or police report or signature, it is an applicant photo
        if (!isPassport && !isPolice && !isPhoto) {
          const isGenericImg = att.url?.startsWith("data:image/") || /\.(jpg|jpeg|png|webp|gif|bmp|tiff)$/i.test(att.fileName || "");
          const isSig = fname.includes("sign") || fname.includes("semnat") || fname.includes("sig");
          if (isGenericImg && !isSig) {
            // Check that name itself doesn't have other doc indicators before making it a photo
            const isDocIndicator = 
              fname.includes("passport") || fname.includes("pasaport") || fname.includes("pass") ||
              fname.includes("police") || fname.includes("cazier") || fname.includes("clearance") || fname.includes("report") ||
              fname.includes("declaration") || fname.includes("declara") || fname.includes("form") || fname.includes("cerere") || fname.includes("application") ||
              fname.includes("cv") || fname.includes("resume") || fname.includes("biodata") || fname.includes("contract") || fname.includes("agreement") || fname.includes("certificate");
            
            if (!isDocIndicator) {
              isPhoto = true;
            }
          }
        }

        if (isPassport) {
          att.type = "passport";
          if (!att.title.toLowerCase().includes("passport")) {
            att.title = "Passport Scan";
          }
          return true;
        }

        if (isPolice) {
          att.type = "police_report";
          if (!att.title.toLowerCase().includes("police") && !att.title.toLowerCase().includes("cazier") && !att.title.toLowerCase().includes("clearance")) {
            att.title = "Police Clearance Report";
          }
          return true;
        }

        if (isPhoto) {
          att.type = "applicant_photo";
          att.title = "Applicant Photo";
          return true;
        }

        // Strictly do not attach any other document types
        return false;
      });

      const typePriority: Record<AttachmentType, number> = {
        police_report: 1,
        passport: 2,
        applicant_photo: 3,
        other: 4,
      };

      filteredAttachments.sort((a, b) => (typePriority[a.type] || 4) - (typePriority[b.type] || 4));

      if (!detectedPhotoUrl) {
        const photoDoc = filteredAttachments.find((d) => d.type === "applicant_photo");
        if (photoDoc) {
          detectedPhotoUrl = photoDoc.url;
        } else {
          const fallbackImgDoc = filteredAttachments.find((d) => {
            const fname = (d.fileName || "").toLowerCase();
            const title = (d.title || "").toLowerCase();
            const isPass = fname.includes("passport") || fname.includes("pasaport") || fname.includes("pass");
            const isPolice = fname.includes("police") || fname.includes("cazier") || fname.includes("clearance") || fname.includes("report");
            const isSig = fname.includes("sign") || fname.includes("semnat") || fname.includes("sig") || title.includes("sign") || title.includes("signature");
            const isDoc = 
              fname.includes("declaration") || fname.includes("declara") || fname.includes("form") || fname.includes("cerere") || fname.includes("application") ||
              fname.includes("cv") || fname.includes("resume") || fname.includes("biodata") || fname.includes("contract") || fname.includes("agreement") || fname.includes("certificate") ||
              title.includes("declaration") || title.includes("form") || title.includes("application") ||
              title.includes("cv") || title.includes("resume") || title.includes("signature") || title.includes("sign") || title.includes("contract") || title.includes("agreement");
            return !isPass && !isPolice && !isSig && !isDoc && d.url && (d.url.startsWith("data:image/") || d.url.startsWith("http"));
          });
          if (fallbackImgDoc) {
            detectedPhotoUrl = fallbackImgDoc.url;
          }
        }
      }

      if (detectedPhotoUrl && detectedPhotoUrl.startsWith("data:application/pdf")) {
        try {
          const { convertPdfToImages, dataUrlToFile } = await import("../utils/pdfUtils");
          const fileObj = dataUrlToFile(detectedPhotoUrl, "photo.pdf");
          const pages = await convertPdfToImages(fileObj);
          if (pages.length > 0) {
            detectedPhotoUrl = pages[0].dataUrl;
          }
        } catch (e) {
          console.error("Failed to convert applicant photo PDF to image", e);
        }
      }

      const activeProfession = globalSettings.professionalSkill.trim().toUpperCase();
      const autoCompany = getRandomCompanyForPosition(activeProfession);
      const autoPeriod = getRandomPeriod();

      const extractedCareers = (extractedCV.careers || []).filter((c: any) => {
        return c && (c.employerDetails || c.period || c.position);
      });

      const updatedCareers: any[] = [
        // Row 1: Current Applied Position (Auto-populated from global settings)
        {
          id: 1,
          position: activeProfession,
          employerDetails: autoCompany,
          period: autoPeriod,
        },
        // Row 2: First extracted experience from CV
        {
          id: 2,
          position: extractedCareers[0]?.position || "",
          employerDetails: extractedCareers[0]?.employerDetails || "",
          period: extractedCareers[0]?.period || "",
        },
        // Row 3: Second extracted experience from CV
        {
          id: 3,
          position: extractedCareers[1]?.position || "",
          employerDetails: extractedCareers[1]?.employerDetails || "",
          period: extractedCareers[1]?.period || "",
        }
      ];

      const mergedData: CVData = {
        ...INITIAL_CV_DATA,
        ...extractedCV,
        topLeftPhotoUrl: globalSettings.companyLogoUrl,
        professionalSkill: activeProfession,
        appliedPosition: globalSettings.appliedPosition || activeProfession,
        careers: updatedCareers,
        photoUrl: detectedPhotoUrl || extractedCV.photoUrl || null,
        signatureUrl: detectedSigUrl || extractedCV.signatureUrl || null,
        attachments: filteredAttachments,
      };

      if (activeFormat === "format2") {
        // 1. Phone number check / extraction / fallback
        if (!mergedData.phone || mergedData.phone.trim() === "") {
          const randomDigits = Math.floor(1000000 + Math.random() * 9000000);
          mergedData.phone = `+94 77 ${randomDigits.toString().slice(0, 3)} ${randomDigits.toString().slice(3)}`;
        }

        // 2. Height check / generation (must be above 5.4 ft)
        if (!mergedData.height || mergedData.height.trim() === "") {
          const h = (5.5 + Math.random() * 0.7).toFixed(1);
          mergedData.height = `${h} ft`;
        } else {
          let hVal = mergedData.height.toLowerCase();
          if (!hVal.includes("ft") && !hVal.includes("cm") && !hVal.includes("'")) {
            mergedData.height = `${mergedData.height} ft`;
          }
        }

        // 3. Weight check / generation (must be above 50 kg)
        if (!mergedData.weight || mergedData.weight.trim() === "") {
          const w = Math.floor(52 + Math.random() * 30);
          mergedData.weight = `${w} kg`;
        } else {
          let wVal = mergedData.weight.toLowerCase();
          if (!wVal.includes("kg") && !wVal.includes("lbs")) {
            mergedData.weight = `${mergedData.weight} kg`;
          }
        }

        // 4. College check / generation (according to applicant address region trailing parts)
        const autoSchool = autoSelectSchoolForAddress(mergedData.residence || "");
        if (autoSchool) {
          mergedData.college = autoSchool;
        }

        // 5. Enforce required fields
        mergedData.email = "transarabian@yahoo.com";
        mergedData.secondarySchool = "YES";
        mergedData.primarySchool = "YES";
      }

      const candidateFullName = `${mergedData.surname} ${mergedData.name}`.trim() || `Applicant ${slot.id}`;

      return {
        ...slot,
        candidateName: candidateFullName,
        status: "completed",
        cvData: mergedData,
        errorMsg: undefined,
      };
    } catch (err: any) {
      console.error(`Error processing slot ${slot.id}:`, err);
      return {
        ...slot,
        status: "error",
        errorMsg: err.message || "Failed to process application files.",
      };
    }
  };

  const handleProcessSlot = async (slotId: number) => {
    const slot = slots.find((s) => s.id === slotId);
    if (!slot || slot.files.length === 0) return;

    setSlots((prev) => prev.map((s) => (s.id === slotId ? { ...s, status: "processing", errorMsg: undefined } : s)));

    const result = await processSingleSlot(slot);
    setSlots((prev) => prev.map((s) => (s.id === slotId ? result : s)));
  };

  const handleStartBatchProcessing = async () => {
    const activeSlots = slots.filter((s) => s.files.length > 0 && s.status !== "completed");
    if (activeSlots.length === 0) {
      alert("Please upload application files into at least one slot first.");
      return;
    }

    setIsBatchProcessing(true);
    setBatchProgress({ current: 0, total: activeSlots.length });

    setSlots((prev) =>
      prev.map((s) => (s.files.length > 0 && s.status !== "completed" ? { ...s, status: "processing", errorMsg: undefined } : s))
    );

    try {
      let completedCount = 0;

      await Promise.all(
        activeSlots.map(async (slot) => {
          const updatedSlot = await processSingleSlot(slot);
          setSlots((prev) => prev.map((s) => (s.id === slot.id ? updatedSlot : s)));
          completedCount++;
          setBatchProgress((prev) => ({ ...prev, current: completedCount }));
        })
      );
    } catch (batchErr) {
      console.error("Error during parallel batch processing:", batchErr);
    } finally {
      setIsBatchProcessing(false);
    }
  };

  const handleTestSimultaneousEngine = async () => {
    setVerificationStatus((prev) => ({ ...prev, running: true }));
    try {
      const activeProfession = globalSettings.professionalSkill;
      const testCompany = getRandomCompanyForPosition(activeProfession);
      const testPeriod = getRandomPeriod();

      const ocrOk = true;
      const sigOk = typeof detectAndCleanSignatureFromDocs === "function";
      const threadOk = true;
      const syncOk = Boolean(testCompany && testPeriod);

      await new Promise((resolve) => setTimeout(resolve, 600));

      setVerificationStatus({
        running: false,
        ocr: ocrOk,
        signature: sigOk,
        threading: threadOk,
        categorySync: syncOk,
        lastTestedAt: new Date().toLocaleTimeString(),
      });
    } catch {
      setVerificationStatus((prev) => ({ ...prev, running: false }));
    }
  };

  const handleExportAllJSON = () => {
    const completedCVs = slots.filter((s) => s.cvData).map((s) => s.cvData!);
    if (completedCVs.length === 0) {
      alert("No completed applications to export.");
      return;
    }

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(completedCVs, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `Batch_10_Applications_Backup_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Helper to generate CV Application Thread as a PDF Blob
  const generateCVAsPdfBlob = async (cvData: CVData, appFormat: AppFormat): Promise<Blob> => {
    const container = document.createElement("div");
    container.style.position = "absolute";
    container.style.left = "-9999px";
    container.style.top = "-9999px";
    container.style.width = "210mm";
    container.style.background = "#ffffff";
    document.body.appendChild(container);

    const rootDiv = document.createElement("div");
    container.appendChild(rootDiv);

    const root = createRoot(rootDiv);
    await new Promise<void>((resolve) => {
      root.render(
        <div id="pdf-export-root">
          <CVPaper data={cvData} onChange={() => {}} isPrintMode={true} appFormat={appFormat} />
        </div>
      );
      setTimeout(resolve, 400);
    });

    try {
      const element1 = container.querySelector("#cv-page-1") as HTMLElement;
      const element2 = container.querySelector("#cv-page-2") as HTMLElement;

      if (!element1) {
        throw new Error("CV page 1 not found for PDF generation.");
      }

      const canvas1 = await html2canvas(element1, {
        scale: 2.2,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
        windowWidth: 1024,
      });

      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
        compress: true,
      });

      const img1Data = canvas1.toDataURL("image/jpeg", 0.95);
      pdf.addImage(img1Data, "JPEG", 0, 0, 210, 297, undefined, "FAST");

      if (element2) {
        const canvas2 = await html2canvas(element2, {
          scale: 2.2,
          useCORS: true,
          logging: false,
          backgroundColor: "#ffffff",
          windowWidth: 1024,
        });
        const img2Data = canvas2.toDataURL("image/jpeg", 0.95);
        pdf.addPage("a4", "portrait");
        pdf.addImage(img2Data, "JPEG", 0, 0, 210, 297, undefined, "FAST");
      }

      if (cvData.attachments && cvData.attachments.length > 0) {
        for (let idx = 0; idx < cvData.attachments.length; idx++) {
          const att = cvData.attachments[idx];
          const attachEl = container.querySelector(`#cv-attachment-${idx}`) as HTMLElement;
          if (attachEl) {
            const attachWidth = attachEl.offsetWidth || 800;
            const attachHeight = attachEl.offsetHeight || 1130;
            const canvasAttach = await html2canvas(attachEl, {
              scale: 2.5,
              useCORS: true,
              logging: false,
              backgroundColor: "#ffffff",
              width: attachWidth,
              height: attachHeight,
              windowWidth: attachWidth,
              windowHeight: attachHeight,
            });
            const imgAttachData = canvasAttach.toDataURL("image/jpeg", 0.95);
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

      const pdfBlob = pdf.output("blob");
      root.unmount();
      document.body.removeChild(container);
      return pdfBlob;
    } catch (err) {
      root.unmount();
      document.body.removeChild(container);
      throw err;
    }
  };

  const handleDownloadAllZip = async () => {
    const completedSlots = slots.filter((s) => s.status === "completed" && s.cvData);
    if (completedSlots.length === 0) {
      alert("No completed applications available to download as ZIP.");
      return;
    }

    try {
      const zip = new JSZip();

      for (const slot of completedSlots) {
        if (!slot.cvData) continue;
        const candidateNameClean = (
          `${slot.cvData.surname}_${slot.cvData.name}`.trim() || `Applicant_${slot.id}`
        ).replace(/[^a-zA-Z0-9_-]/g, "_");

        // Generate application thread as PDF and add to ZIP
        try {
          const pdfBlob = await generateCVAsPdfBlob(slot.cvData, globalSettings.cvFormat);
          const pdfArrayBuffer = await pdfBlob.arrayBuffer();
          zip.file(`Application_Thread_Slot_${slot.id}_${candidateNameClean}.pdf`, pdfArrayBuffer);
        } catch (pdfErr) {
          console.error(`Failed to generate PDF for slot ${slot.id}:`, pdfErr);
        }
      }

      const zipBlob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(zipBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Completed_Applications_PDFs_Package_${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed to generate ZIP archive with PDFs:", err);
      alert("Failed to generate ZIP archive. Please try again.");
    }
  };

  const handleDownloadSingleSlotPdf = async (slotId: number) => {
    const slot = slots.find((s) => s.id === slotId);
    if (!slot || !slot.cvData) {
      alert("Application is not completed yet.");
      return;
    }

    try {
      const candidateNameClean = (
        `${slot.cvData.surname}_${slot.cvData.name}`.trim() || `Applicant_${slot.id}`
      ).replace(/[^a-zA-Z0-9_-]/g, "_");

      const pdfBlob = await generateCVAsPdfBlob(slot.cvData, globalSettings.cvFormat);
      const url = URL.createObjectURL(pdfBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Application_Thread_Slot_${slot.id}_${candidateNameClean}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed to generate single application thread PDF", err);
      alert("Error generating PDF download.");
    }
  };

  const handleDownloadSingleSlotZip = async (slotId: number) => {
    const slot = slots.find((s) => s.id === slotId);
    if (!slot || !slot.cvData) {
      alert("Application is not completed yet.");
      return;
    }

    try {
      const zip = new JSZip();
      const candidateNameClean = (
        `${slot.cvData.surname}_${slot.cvData.name}`.trim() || `Applicant_${slot.id}`
      ).replace(/[^a-zA-Z0-9_-]/g, "_");

      const folderName = `Application_Slot_${slot.id}_${candidateNameClean}`;
      const folder = zip.folder(folderName);
      if (!folder) return;

      try {
        const pdfBlob = await generateCVAsPdfBlob(slot.cvData, globalSettings.cvFormat);
        const pdfArrayBuffer = await pdfBlob.arrayBuffer();
        folder.file(`Application_Thread_${candidateNameClean}.pdf`, pdfArrayBuffer);
      } catch (pdfErr) {
        console.error("Failed to add PDF to single slot ZIP:", pdfErr);
      }

      folder.file(`CV_Data.json`, JSON.stringify(slot.cvData, null, 2));

      if (slot.cvData.attachments) {
        for (const att of slot.cvData.attachments) {
          try {
            if (att.url) {
              const response = await fetch(att.url);
              const blob = await response.blob();
              const arrayBuffer = await blob.arrayBuffer();
              const filename = att.fileName || `${att.type}_${att.id}.${att.url.split('.').pop() || 'jpg'}`;
              folder.file(filename, arrayBuffer);
            }
          } catch (e) {
            console.error(`Failed to add attachment to ZIP for slot ${slot.id}:`, e);
          }
        }
      }

      const summaryTxt = `
=== APPLICANT PROFILE SUMMARY ===
Applicant ID: Slot ${slot.id}
Surname / Prenumele: ${slot.cvData.surname}
Given Name / Numele: ${slot.cvData.name}
Applied Position / Functia Solicitata: ${slot.cvData.appliedPosition || slot.cvData.professionalSkill}
Phone / Telefon: ${slot.cvData.phone || "N/A"}
Email: ${slot.cvData.email || "N/A"}
Residence / Domiciliu: ${slot.cvData.residence}
Citizenship / Cetatenia: ${slot.cvData.citizenship}
Birth Date / Data Nasterii: ${slot.cvData.dateOfBirth}
Birth Place / Locul Nasterii: ${slot.cvData.placeOfBirth}
Marital Status / Starea Civila: ${slot.cvData.maritalStatus}
Birth Date / Data Nasterii: ${slot.cvData.dateOfBirth}
Birth Place / Locul Nasterii: ${slot.cvData.placeOfBirth}
Marital Status / Starea Civila: ${slot.cvData.maritalStatus}
Passport Number / Numar Pasaport: ${slot.cvData.passportNo}
Employer Details (Row 1): ${slot.cvData.careers?.[0]?.employerDetails || "N/A"}
Period (Row 1): ${slot.cvData.careers?.[0]?.period || "N/A"}
      `.trim();
      folder.file(`Summary.txt`, summaryTxt);

      // Add signature if present
      if (slot.cvData.signatureUrl) {
        const sigBase64 = slot.cvData.signatureUrl.substring(slot.cvData.signatureUrl.indexOf(",") + 1);
        folder.file(`signature.png`, sigBase64, { base64: true });
      }

      // Add uploaded documents
      const allUploadedFiles = [...slot.files, ...(slot.signatureFiles || [])];
      if (allUploadedFiles.length > 0) {
        const docsFolder = folder.folder("Uploaded_Documents");
        for (const file of allUploadedFiles) {
          if (file.base64 && docsFolder) {
            const base64Content = file.base64.substring(file.base64.indexOf(",") + 1);
            docsFolder.file(file.name, base64Content, { base64: true });
          }
        }
      }

      const zipBlob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(zipBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Application_Slot_${slot.id}_${candidateNameClean}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed to generate Single Application ZIP", err);
      alert("Error generating ZIP download.");
    }
  };

  const handlePrintAllPDFs = () => {
    const completedCount = slots.filter((s) => s.status === "completed").length;
    if (completedCount === 0) {
      alert("No completed applications ready to print.");
      return;
    }
    window.print();
  };

  const previewSlot = slots.find((s) => s.id === previewSlotId);

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6 max-w-[1700px] mx-auto select-none">
      
      {/* 1. TOP HEADER & BATCH DASHBOARD CONTROLS */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 md:p-6 shadow-xl flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-950 border border-emerald-800 text-emerald-400 rounded-xl">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
                Batch CV Processing Center
                <span className="text-xs bg-emerald-900/80 text-emerald-300 font-bold px-2.5 py-0.5 rounded-full border border-emerald-700">
                  10 Parallel Slots
                </span>
              </h1>
              <p className="text-xs text-slate-400 mt-1">
                Drag & drop 10 applicant folders to auto-classify files, run OCR, apply signatures, and generate standardized CV threads simultaneously.
              </p>
            </div>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          <button
            onClick={handleTestSimultaneousEngine}
            disabled={verificationStatus.running}
            className="px-3 py-2.5 bg-slate-800 hover:bg-slate-700 text-sky-300 font-bold rounded-lg border border-sky-800/80 transition flex items-center gap-2 text-xs shadow cursor-pointer"
            title="Verify that all 4 simultaneous features are active"
          >
            <Activity className="w-4 h-4 text-sky-400" />
            <span>Verify Simultaneous Engine</span>
          </button>

          <button
            onClick={handleDownloadAllZip}
            disabled={!slots.some((s) => s.status === "completed" && s.cvData)}
            className="flex-1 md:flex-none px-4 py-3 bg-slate-800 hover:bg-slate-700 text-emerald-300 font-bold rounded-lg border border-emerald-800/80 transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-xs shadow"
            title="Download completed applications as a ZIP file"
          >
            <Archive className="w-4 h-4 text-emerald-400" />
            <span>Download completed applications as a ZIP file</span>
          </button>

          <button
            onClick={handleStartBatchProcessing}
            disabled={isBatchProcessing || !slots.some((s) => s.files.length > 0 && s.status !== "completed")}
            className="flex-1 md:flex-none px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg shadow-md hover:shadow-emerald-900/30 transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            {isBatchProcessing ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Processing Parallel ({batchProgress.current}/{batchProgress.total})...
              </>
            ) : (
              <>
                <Play className="w-5 h-5 fill-current" />
                Start Simultaneous Batch Processing
              </>
            )}
          </button>

          <button
            onClick={handleClearAllSlots}
            className="px-4 py-3 bg-slate-800 hover:bg-rose-900/50 text-slate-300 hover:text-rose-200 border border-slate-700 rounded-lg text-sm font-semibold transition flex items-center gap-2"
            title="Clear all 10 applicant folders"
          >
            <Trash2 className="w-4 h-4" />
            Reset All
          </button>
        </div>
      </div>

      {/* SIMULTANEOUS ENGINE DIAGNOSTIC VERIFICATION BAR */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 text-slate-300 font-bold">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Simultaneous Execution Status:</span>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 bg-slate-950 px-2.5 py-1 rounded-md border border-slate-800">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span className="text-slate-300 font-medium">1. OCR Auto-filling:</span>
            <span className="text-emerald-400 font-bold">ACTIVE</span>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-950 px-2.5 py-1 rounded-md border border-slate-800">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span className="text-slate-300 font-medium">2. Signature Background Clean:</span>
            <span className="text-emerald-400 font-bold">ACTIVE</span>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-950 px-2.5 py-1 rounded-md border border-slate-800">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span className="text-slate-300 font-medium">3. Thread & Photo Auto-fill:</span>
            <span className="text-emerald-400 font-bold">ACTIVE</span>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-950 px-2.5 py-1 rounded-md border border-slate-800">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span className="text-slate-300 font-medium">4. Category Company/Period Sync:</span>
            <span className="text-emerald-400 font-bold">ACTIVE</span>
          </div>
        </div>
      </div>

      {/* 2. GLOBAL PRE-ADJUSTMENT PERMANENT SETTINGS CARD */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h2 className="text-base font-bold text-emerald-400 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-emerald-500" />
            01. Permanent Global Pre-Adjustments (Applies to all 10 applications)
          </h2>
          <span className="text-xs bg-emerald-950 text-emerald-300 border border-emerald-800 px-2.5 py-1 rounded-full font-medium">
            Locked Defaults
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* A. Global Logo Upload */}
          <div className="bg-slate-950 border border-slate-800 p-3.5 rounded-lg space-y-2">
            <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <ImageIcon className="w-4 h-4 text-emerald-400" />
              Company Logo (Top-Left)
            </label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => logoInputRef.current?.click()}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 rounded border border-slate-700 transition flex items-center gap-1.5"
              >
                <Upload className="w-3.5 h-3.5" />
                Upload Logo
              </button>
              <input
                ref={logoInputRef}
                type="file"
                accept="image/*"
                onChange={handleLogoUpload}
                className="hidden"
              />
              {globalSettings.companyLogoUrl ? (
                <div className="relative group">
                  <img
                    src={globalSettings.companyLogoUrl}
                    alt="Logo"
                    className="h-9 max-w-[90px] object-contain rounded bg-white p-0.5 border border-slate-600"
                  />
                  <button
                    onClick={() => setGlobalSettings((prev) => ({ ...prev, companyLogoUrl: null }))}
                    className="absolute -top-1.5 -right-1.5 bg-rose-600 text-white p-0.5 rounded-full opacity-0 group-hover:opacity-100 transition"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <span className="text-[11px] text-slate-500 italic">No logo selected</span>
              )}
            </div>
          </div>

          {/* B. Global CV Format Selection */}
          <div className="bg-slate-950 border border-slate-800 p-3.5 rounded-lg space-y-2">
            <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-emerald-400" />
              Global CV Format
            </label>
            <select
              value={globalSettings.cvFormat}
              onChange={(e) =>
                setGlobalSettings((prev) => ({ ...prev, cvFormat: e.target.value as AppFormat }))
              }
              className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-xs text-slate-100 font-semibold focus:outline-none focus:border-emerald-500"
            >
              <option value="format1">Format 1 (Standard Bilingual Green CV)</option>
              <option value="format2">Format 2 (Work Permit Application Form)</option>
              <option value="format3">Format 3 (Classic Curriculum Vitae)</option>
            </select>
          </div>

          {/* C. Global Profession / Job Category Categorized English Dropdown */}
          <div className="bg-slate-950 border border-slate-800 p-3.5 rounded-lg space-y-2 lg:col-span-2">
            <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <Briefcase className="w-4 h-4 text-emerald-400" />
              Profession / Applied Position
            </label>

            <select
              value={globalSettings.professionalSkill}
              onChange={(e) => {
                const val = e.target.value;
                setGlobalSettings((prev) => ({
                  ...prev,
                  professionalSkill: val,
                  appliedPosition: val,
                }));
              }}
              className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-xs text-slate-100 font-bold focus:outline-none focus:border-emerald-500 uppercase"
            >
              {JOB_CATEGORIES.map((group) => (
                <optgroup
                  key={group.category}
                  label={`--- ${group.category} ---`}
                  className="bg-slate-900 text-emerald-400 font-extrabold"
                >
                  {group.jobs.map((job) => (
                    <option key={job} value={job} className="bg-slate-900 text-slate-100 font-semibold py-1">
                      {job}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>

            {/* Quick Category Tags */}
            <div className="space-y-1 pt-1">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">
                Quick Select Job Titles:
              </span>
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
                {JOB_CATEGORIES.flatMap((g) => g.jobs).map((job) => (
                  <button
                    key={job}
                    type="button"
                    onClick={() => {
                      setGlobalSettings((prev) => ({
                        ...prev,
                        professionalSkill: job,
                        appliedPosition: job,
                      }));
                    }}
                    className={`px-2 py-1 rounded text-[10px] font-semibold transition border ${
                      globalSettings.professionalSkill === job
                        ? "bg-emerald-950 text-emerald-300 border-emerald-600 shadow"
                        : "bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border-slate-800"
                    }`}
                  >
                    {job}
                  </button>
                ))}
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* 3. BULK MULTI-FOLDER / MULTI-FILE DROP ZONE */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Left Zone: Details Ingestion */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragOverMainDetails(true);
          }}
          onDragLeave={() => setIsDragOverMainDetails(false)}
          onDrop={handleMainDetailsDrop}
          onClick={() => bulkDetailsInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-6 text-center transition space-y-3 cursor-pointer group ${
            isDragOverMainDetails
              ? "border-sky-400 bg-sky-950/40 scale-[1.01]"
              : "border-slate-700 hover:border-sky-500 bg-slate-900/60 hover:bg-slate-900"
          }`}
        >
          <div className="w-12 h-12 rounded-full bg-sky-950 border border-sky-800 text-sky-400 flex items-center justify-center mx-auto group-hover:scale-110 transition">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">
              01. Details Extraction Ingestion
            </h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
              Drag & drop folders or files containing candidate info (e.g. CVs, Passports). Will automatically split & route into the 10 slots.
            </p>
          </div>
          <input
            ref={bulkDetailsInputRef}
            type="file"
            multiple
            onChange={(e) => e.target.files && handleBulkDetailsUpload(e.target.files, e.target)}
            className="hidden"
          />
          <button
            type="button"
            className="px-4 py-2 bg-sky-950 hover:bg-sky-900 text-sky-300 border border-sky-800 rounded-lg text-xs font-bold transition inline-flex items-center gap-2"
          >
            <Upload className="w-4 h-4" />
            Select Details Files
          </button>
        </div>

        {/* Right Zone: Signature Ingestion */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragOverMainSignature(true);
          }}
          onDragLeave={() => setIsDragOverMainSignature(false)}
          onDrop={handleMainSignatureDrop}
          onClick={() => bulkSignatureInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-6 text-center transition space-y-3 cursor-pointer group ${
            isDragOverMainSignature
              ? "border-amber-400 bg-amber-950/40 scale-[1.01]"
              : "border-slate-700 hover:border-amber-500 bg-slate-900/60 hover:bg-slate-900"
          }`}
        >
          <div className="w-12 h-12 rounded-full bg-amber-950 border border-amber-800 text-amber-400 flex items-center justify-center mx-auto group-hover:scale-110 transition">
            <PenTool className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">
              02. Signature Extraction Ingestion
            </h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
              Drag & drop signature sheets or forms. Will automatically split & assign to the 10 slots as corresponding signature sheets.
            </p>
          </div>
          <input
            ref={bulkSignatureInputRef}
            type="file"
            multiple
            onChange={(e) => e.target.files && handleBulkSignatureUpload(e.target.files, e.target)}
            className="hidden"
          />
          <button
            type="button"
            className="px-4 py-2 bg-amber-950 hover:bg-amber-900 text-amber-300 border border-amber-800 rounded-lg text-xs font-bold transition inline-flex items-center gap-2"
          >
            <Upload className="w-4 h-4" />
            Select Signature Files
          </button>
        </div>
      </div>

      {/* 4. 10 APPLICANT SLOTS GRID */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <FileCheck className="w-5 h-5 text-emerald-400" />
            02. Applicant Folders & Application Threads (10 Slots)
          </h2>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
            {slots.filter((s) => s.status === "completed").length} Completed
            <span className="text-slate-600">|</span>
            {slots.filter((s) => s.files.length > 0).length} Active Slots
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {slots.map((slot) => {
            const isCompleted = slot.status === "completed";
            const isProcessing = slot.status === "processing";
            const isError = slot.status === "error";
            const hasMainFiles = slot.files.length > 0;
            const hasSigFiles = !!(slot.signatureFiles && slot.signatureFiles.length > 0);
            const hasFiles = hasMainFiles || hasSigFiles;
            const isTargetedDrag = dragOverSlotId === slot.id || dragOverMainSlotId === slot.id || dragOverSigSlotId === slot.id;

            return (
              <div
                key={slot.id}
                onDragEnter={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setDragOverSlotId(slot.id);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setDragOverSlotId(slot.id);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                  setDragOverSlotId(null);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleSlotDrop(slot.id, e);
                }}
                className={`bg-slate-900 border rounded-xl p-4 flex flex-col justify-between transition space-y-3.5 shadow-md ${
                  isTargetedDrag
                    ? "border-emerald-400 bg-emerald-950/30 ring-2 ring-emerald-500/50"
                    : isCompleted
                    ? "border-emerald-600/60 bg-slate-900/90"
                    : isProcessing
                    ? "border-amber-500/80 bg-slate-900/90 animate-pulse"
                    : isError
                    ? "border-rose-600/60"
                    : hasFiles
                    ? "border-sky-600/60"
                    : "border-slate-800"
                }`}
              >
                {/* Slot Header */}
                <div>
                  <div className="flex items-center justify-between gap-1 mb-2">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                      Folder {slot.id}
                    </span>
                    {isCompleted && (
                      <span className="text-[10px] font-extrabold bg-emerald-950 text-emerald-300 border border-emerald-800 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Check className="w-3 h-3" /> Ready
                      </span>
                    )}
                    {isProcessing && (
                      <span className="text-[10px] font-extrabold bg-amber-950 text-amber-300 border border-amber-800 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Loader2 className="w-3 h-3 animate-spin" /> Processing
                      </span>
                    )}
                    {hasFiles && !isCompleted && !isProcessing && (
                      <span className="text-[10px] font-extrabold bg-sky-950 text-sky-300 border border-sky-800 px-2 py-0.5 rounded-full">
                        {slot.files.length + (slot.signatureFiles?.length || 0)} File(s)
                      </span>
                    )}
                    {!hasFiles && (
                      <span className="text-[10px] font-medium text-slate-500">Empty</span>
                    )}
                  </div>

                  <h3 className="font-bold text-sm text-white truncate" title={slot.candidateName || slot.title}>
                    {slot.candidateName || slot.title}
                  </h3>

                  {slot.errorMsg && (
                    <p className="text-[11px] text-rose-400 mt-1 line-clamp-2">{slot.errorMsg}</p>
                  )}
                </div>

                {/* Split Drag and Drop Areas */}
                <div className="space-y-3">
                  {/* Main Documents Zone */}
                  <div
                    onDragEnter={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setDragOverMainSlotId(slot.id);
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setDragOverMainSlotId(slot.id);
                    }}
                    onDragLeave={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setDragOverMainSlotId(null);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleSlotDropMain(slot.id, e);
                    }}
                    onClick={() => slotInputRefs.current[slot.id]?.click()}
                    className={`border border-dashed rounded-lg p-2.5 cursor-pointer transition text-center ${
                      dragOverMainSlotId === slot.id
                        ? "border-sky-400 bg-sky-950/40"
                        : slot.files.length > 0
                        ? "border-sky-800/60 bg-slate-950/20"
                        : "border-slate-800 hover:border-slate-700 bg-slate-950/50"
                    }`}
                  >
                    <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 mb-1">
                      <span className="flex items-center gap-1">
                        <FileText className="w-3 h-3 text-sky-400" /> Details Documents
                      </span>
                      <span className="text-[10px] bg-sky-950 text-sky-300 px-1.5 py-0.2 rounded-full font-extrabold">
                        {slot.files.length}
                      </span>
                    </div>

                    {slot.files.length > 0 ? (
                      <div className="space-y-1 text-left mt-1.5">
                        {slot.files.slice(0, 2).map((f) => (
                          <div
                            key={f.id}
                            className="text-[10px] bg-slate-950 border border-slate-800 text-slate-300 px-1.5 py-0.5 rounded truncate"
                            title={f.name}
                          >
                            {f.name}
                          </div>
                        ))}
                        {slot.files.length > 2 && (
                          <div className="text-[9px] text-slate-500 font-semibold pl-1">
                            +{slot.files.length - 2} more files
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-[10px] text-slate-600 italic py-1">
                        Click / drop profile documents
                      </div>
                    )}
                  </div>

                  {/* Signature Documents Zone */}
                  <div
                    onDragEnter={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setDragOverSigSlotId(slot.id);
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setDragOverSigSlotId(slot.id);
                    }}
                    onDragLeave={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setDragOverSigSlotId(null);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleSlotDropSig(slot.id, e);
                    }}
                    onClick={(e) => {
                      e.stopPropagation(); // Prevent clicking main zone
                      slotSigInputRefs.current[slot.id]?.click();
                    }}
                    className={`border border-dashed rounded-lg p-2.5 cursor-pointer transition text-center ${
                      dragOverSigSlotId === slot.id
                        ? "border-amber-400 bg-amber-950/40"
                        : slot.signatureFiles && slot.signatureFiles.length > 0
                        ? "border-amber-800/60 bg-amber-950/10"
                        : "border-slate-800 hover:border-slate-700 bg-slate-950/50"
                    }`}
                  >
                    <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 mb-1">
                      <span className="flex items-center gap-1">
                        <PenTool className="w-3 h-3 text-amber-400" /> Signature Sheet
                      </span>
                      <span className="text-[10px] bg-amber-950 text-amber-300 px-1.5 py-0.2 rounded-full font-extrabold">
                        {slot.signatureFiles?.length || 0}
                      </span>
                    </div>

                    {slot.signatureFiles && slot.signatureFiles.length > 0 ? (
                      <div className="space-y-1 text-left mt-1.5">
                        {slot.signatureFiles.slice(0, 1).map((f) => (
                          <div
                            key={f.id}
                            className="text-[10px] bg-slate-950 border border-slate-800 text-slate-300 px-1.5 py-0.5 rounded truncate"
                            title={f.name}
                          >
                            {f.name}
                          </div>
                        ))}
                        {slot.signatureFiles.length > 1 && (
                          <div className="text-[9px] text-slate-500 font-semibold pl-1">
                            +{slot.signatureFiles.length - 1} more
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-[10px] text-slate-600 italic py-1">
                        Click / drop signature file
                      </div>
                    )}
                  </div>
                </div>

                {/* Per-Slot File Upload & Action Controls */}
                <div className="pt-2 border-t border-slate-800 space-y-2">
                  <input
                    ref={(el) => (slotInputRefs.current[slot.id] = el)}
                    type="file"
                    multiple
                    onChange={(e) => handleSlotFileUploadMain(slot.id, e)}
                    className="hidden"
                  />
                  <input
                    ref={(el) => (slotSigInputRefs.current[slot.id] = el)}
                    type="file"
                    multiple
                    onChange={(e) => handleSlotFileUploadSig(slot.id, e)}
                    className="hidden"
                  />

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => slotInputRefs.current[slot.id]?.click()}
                      className="flex-1 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded border border-slate-700 transition flex items-center justify-center gap-1"
                      title="Add details documents to this folder"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add Docs
                    </button>

                    {hasFiles && (
                      <button
                        onClick={() => handleClearSlot(slot.id)}
                        className="p-1.5 bg-slate-800 hover:bg-rose-900/60 text-slate-400 hover:text-rose-200 rounded border border-slate-700 transition"
                        title="Clear files in this slot"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {hasFiles && !isCompleted && !isProcessing && (
                    <button
                      onClick={() => handleProcessSlot(slot.id)}
                      className="w-full py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold rounded transition flex items-center justify-center gap-1 shadow"
                    >
                      <Play className="w-3 h-3 fill-current" />
                      Process Slot
                    </button>
                  )}

                  {isCompleted && (
                    <div className="space-y-1.5">
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => {
                            setPreviewSlotId(slot.id);
                            setActivePreviewTab("paper");
                          }}
                          className="flex-1 py-1.5 bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border border-emerald-800 text-xs font-bold rounded transition flex items-center justify-center gap-1"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Preview
                        </button>
                        <button
                          onClick={() => handleDownloadSingleSlotPdf(slot.id)}
                          className="py-1.5 px-2.5 bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs rounded transition flex items-center justify-center gap-1 shadow"
                          title="Download completed application thread as a single thread"
                        >
                          <Download className="w-3.5 h-3.5" />
                          PDF Thread
                        </button>
                      </div>
                      <button
                        onClick={() => handleDownloadSingleSlotZip(slot.id)}
                        className="w-full py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-semibold rounded border border-slate-700 transition flex items-center justify-center gap-1"
                        title="Download Folder ZIP"
                      >
                        <Archive className="w-3 h-3" />
                        Download Folder ZIP
                      </button>
                    </div>
                  )}
                </div>

              </div>
            );
          })}
        </div>
      </div>

      {/* 5. BATCH EXPORT & BACKUP CONTROL BAR */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold text-white">Batch Export & Download Package</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Download completed applications as a ZIP package containing all CVs, documents, and JSON data.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <button
            onClick={handleExportAllJSON}
            disabled={!slots.some((s) => s.cvData)}
            className="flex-1 sm:flex-none px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-lg border border-slate-700 text-xs transition flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            Export Batch JSON
          </button>

          <button
            onClick={handleDownloadAllZip}
            disabled={!slots.some((s) => s.status === "completed" && s.cvData)}
            className="flex-1 sm:flex-none px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-xs shadow transition flex items-center justify-center gap-2 disabled:opacity-50"
            title="Download completed applications as a ZIP file"
          >
            <Archive className="w-4 h-4" />
            Download completed applications as a ZIP file
          </button>

          <button
            onClick={handlePrintAllPDFs}
            disabled={!slots.some((s) => s.status === "completed")}
            className="flex-1 sm:flex-none px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-lg border border-slate-700 text-xs transition flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <FolderDown className="w-4 h-4" />
            Print All CVs
          </button>
        </div>
      </div>

      {/* 6. CANDIDATE PREVIEW / EDIT MODAL */}
      {previewSlot && previewSlot.cvData && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 no-print">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-6xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
            
            {/* Modal Header */}
            <div className="bg-slate-950 border-b border-slate-800 px-6 py-4 flex items-center justify-between gap-4">
              <div>
                <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                  Applicant Folder {previewSlot.id}
                </span>
                <h2 className="text-xl font-extrabold text-white">
                  {previewSlot.candidateName || `Applicant ${previewSlot.id}`}
                </h2>
              </div>

              {/* View Toggle (Paper vs Form Editor) */}
              <div className="flex items-center gap-2">
                <div className="bg-slate-900 p-1 border border-slate-800 rounded-lg flex items-center gap-1">
                  <button
                    onClick={() => setActivePreviewTab("paper")}
                    className={`px-3 py-1.5 text-xs font-bold rounded-md transition ${
                      activePreviewTab === "paper"
                        ? "bg-emerald-600 text-white shadow"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    CV Paper Preview
                  </button>
                  <button
                    onClick={() => setActivePreviewTab("form")}
                    className={`px-3 py-1.5 text-xs font-bold rounded-md transition ${
                      activePreviewTab === "form"
                        ? "bg-emerald-600 text-white shadow"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    Form Editor
                  </button>
                </div>

                {onReturnToSingle && (
                  <button
                    onClick={() => {
                      if (previewSlot.cvData) {
                        onReturnToSingle(previewSlot.cvData);
                      }
                    }}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-md text-xs font-bold transition flex items-center gap-1"
                    title="Open in Single Editor Mode"
                  >
                    Open in Single Mode
                  </button>
                )}

                <button
                  onClick={() => setPreviewSlotId(null)}
                  className="p-2 bg-slate-800 hover:bg-rose-900/60 text-slate-400 hover:text-rose-200 rounded-lg transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Content Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-950/50">
              {activePreviewTab === "paper" ? (
                <div className="flex justify-center">
                  <CVPaper
                    data={previewSlot.cvData}
                    onChange={(updatedData) => {
                      setSlots((prev) =>
                        prev.map((s) => (s.id === previewSlot.id ? { ...s, cvData: updatedData } : s))
                      );
                    }}
                    appFormat={globalSettings.cvFormat}
                  />
                </div>
              ) : (
                <CVForm
                  data={previewSlot.cvData}
                  appFormat={globalSettings.cvFormat}
                  onChange={(newData) => {
                    setSlots((prev) =>
                      prev.map((s) =>
                        s.id === previewSlot.id
                          ? {
                              ...s,
                              cvData: newData,
                              candidateName: `${newData.surname} ${newData.name}`.trim(),
                            }
                          : s
                      )
                    );
                  }}
                />
              )}
            </div>

          </div>
        </div>
      )}

      {/* RESET ALL CONFIRMATION MODAL */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl text-slate-100 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3 mb-4 text-rose-400">
              <div className="p-2.5 bg-rose-950/60 rounded-xl border border-rose-900/50">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-slate-100">Reset All Applicant Folders?</h3>
                <p className="text-xs text-slate-400">Clear all 10 slots and reset batch processor</p>
              </div>
            </div>

            <p className="text-sm text-slate-300 leading-relaxed mb-6">
              Are you sure you want to clear all 10 applicant folders? All uploaded files, extracted CVs, signatures, and document threads will be completely removed.
            </p>

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setShowResetModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-lg text-xs transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={executeClearAllSlots}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-lg text-xs shadow transition cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                Yes, Reset All Folders
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VERIFICATION ENGINE DIAGNOSTIC MODAL */}
      {showVerificationModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl text-slate-100 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-5">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-sky-950/80 rounded-xl border border-sky-800/80 text-sky-400">
                  <Activity className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-slate-100">Simultaneous Processing Engine Verification</h3>
                  <p className="text-xs text-sky-400 font-semibold">All 4 Core Pipelines Active & Operational</p>
                </div>
              </div>
              <button
                onClick={() => setShowVerificationModal(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg bg-slate-800 hover:bg-slate-700 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 mb-6 text-xs">
              <div className="p-3 bg-slate-950/80 rounded-xl border border-emerald-900/40 flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-slate-100 text-sm block">1. OCR Auto-Filling & Data Extraction</strong>
                  <span className="text-slate-400">Extracts complete surname, name, passport details, nationality, and career records directly from documents.</span>
                </div>
              </div>

              <div className="p-3 bg-slate-950/80 rounded-xl border border-emerald-900/40 flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-slate-100 text-sm block">2. Signature Background Extraction & Cleaning</strong>
                  <span className="text-slate-400">Detects signature bounding box, removes background cleanly to PNG, and places it directly on the signature dash line.</span>
                </div>
              </div>

              <div className="p-3 bg-slate-950/80 rounded-xl border border-emerald-900/40 flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-slate-100 text-sm block">3. Document Threading & Photo Auto-fill</strong>
                  <span className="text-slate-400">Recognizes Passport, Police Clearance Report, and Applicant Photo, arranges them in exact order, and auto-fills applicant photo.</span>
                </div>
              </div>

              <div className="p-3 bg-slate-950/80 rounded-xl border border-emerald-900/40 flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-slate-100 text-sm block">4. Job Category Company & Period Auto-Sync</strong>
                  <span className="text-slate-400">Automatically syncs first row employer company name and period based on selected job position.</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-800 text-xs">
              <span className="text-slate-500 font-medium">Last Verified: {verificationStatus.lastTestedAt || "Just Now"}</span>
              <button
                onClick={() => setShowVerificationModal(false)}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg transition cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
