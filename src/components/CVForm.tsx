import React, { useState, useRef, useEffect, ChangeEvent } from "react";
import { CVData, CareerRow, AppFormat, AttachedDoc, AttachmentType } from "../types";
import { User, Clipboard, Home, Briefcase, FileText, Globe, Camera, Trash2, FileCheck, Layers, Paperclip, ShieldCheck, ArrowUp, ArrowDown, Sparkles, RefreshCw, Upload, Loader2, ChevronDown } from "lucide-react";
import { convertPdfToImages, readImageFileAsDataUrl } from "../utils/pdfUtils";
import { 
  JOB_CATEGORIES, 
  getCompaniesForPosition, 
  getRandomCompanyForPosition, 
  getRandomPeriod, 
  getAllCompanies 
} from "../data/jobCategories";
import {
  SRI_LANKA_SCHOOLS,
  findDistrictFromAddress,
  getSchoolsForDistrict,
  autoSelectSchoolForAddress
} from "../data/schools";

interface CVFormProps {
  data: CVData;
  onChange: (newData: CVData) => void;
  flashedFields?: Set<string>;
  appFormat?: AppFormat;
  onFormatChange?: (format: AppFormat) => void;
  onExtractFromAttachment?: (attachmentUrl: string, title?: string) => void;
  isExtractingAttachment?: boolean;
  processAttachmentFiles?: (files: FileList | File[], forcedType?: AttachmentType, forcedTitle?: string) => Promise<void>;
  isProcessingAttachments?: boolean;
  processingAttMsg?: string;
}

type TabType = "personal" | "passport" | "address" | "career" | "extra" | "declarations";

export default function CVForm({ 
  data, 
  onChange, 
  flashedFields = new Set(),
  appFormat = "format1",
  onFormatChange,
  onExtractFromAttachment,
  isExtractingAttachment = false,
  processAttachmentFiles,
  isProcessingAttachments = false,
  processingAttMsg = ""
}: CVFormProps) {
  const [activeTab, setActiveTab] = useState<TabType>("personal");

  const detectedDistrict = findDistrictFromAddress(data.residence || "");
  const schoolsForDetectedDistrict = detectedDistrict ? getSchoolsForDistrict(detectedDistrict) : [];

  // Keep fresh refs to data & onChange for async handlers and event listeners
  const dataRef = useRef(data);
  dataRef.current = data;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const updateField = (field: keyof CVData, value: any) => {
    const updated = {
      ...data,
      [field]: value,
    };
    if (field === "residence" && appFormat === "format2") {
      const autoSchool = autoSelectSchoolForAddress(value);
      if (autoSchool) {
        updated.college = autoSchool;
      }
    }
    onChange(updated);
  };

  const updateCareer = (index: number, key: keyof CareerRow, value: any) => {
    const updatedCareers = [...data.careers];
    updatedCareers[index] = {
      ...updatedCareers[index],
      [key]: value,
    };
    onChange({
      ...data,
      careers: updatedCareers,
    });
  };

  // Requirement 02, 03 & 04: Handle selecting job position from top level dropdowns
  const handleJobPositionSelect = (selectedPos: string) => {
    if (!selectedPos) return;
    const currentData = dataRef.current;
    const upperPos = selectedPos.toUpperCase();

    // Randomly select company and period for Row 01
    const randomCompany = getRandomCompanyForPosition(upperPos);
    const randomPeriod = getRandomPeriod();

    const updatedCareers = [...(currentData.careers || [])];

    // Rule 01 & 03: Auto fill ONLY row 01 (index 0) with position, random company, and random period
    if (updatedCareers.length === 0) {
      updatedCareers.push({
        id: 1,
        employerDetails: randomCompany,
        period: randomPeriod,
        position: upperPos,
      });
    } else {
      updatedCareers[0] = {
        ...updatedCareers[0],
        position: upperPos,
        employerDetails: randomCompany,
        period: randomPeriod,
      };
    }

    onChange({
      ...currentData,
      professionalSkill: upperPos,
      appliedPosition: upperPos,
      careers: updatedCareers,
    });
  };

  // Requirement 05: Handle position selection directly in career table row
  const handleCareerPositionSelect = (idx: number, selectedPos: string) => {
    if (!selectedPos) return;
    const currentData = dataRef.current;
    const upperPos = selectedPos.toUpperCase();
    const randomCompany = getRandomCompanyForPosition(upperPos);
    const randomPeriod = getRandomPeriod();

    const updatedCareers = [...(currentData.careers || [])];
    updatedCareers[idx] = {
      ...updatedCareers[idx],
      position: upperPos,
      employerDetails: randomCompany,
      period: randomPeriod,
    };

    onChange({
      ...currentData,
      careers: updatedCareers,
    });
  };

  // Requirement 05: Handle company selection directly in career table row
  const handleCareerCompanySelect = (idx: number, selectedCompany: string) => {
    if (!selectedCompany) return;
    const currentData = dataRef.current;
    const updatedCareers = [...(currentData.careers || [])];
    updatedCareers[idx] = {
      ...updatedCareers[idx],
      employerDetails: selectedCompany.toUpperCase(),
    };

    onChange({
      ...currentData,
      careers: updatedCareers,
    });
  };

  // Check if a field was recently updated by OCR to apply a highlighted styling
  const getInputClass = (fieldName: string) => {
    const isFlashed = flashedFields.has(fieldName);
    return `w-full px-3 py-2 border rounded-lg text-slate-800 bg-white shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none transition-all text-sm ${
      isFlashed ? "border-amber-400 bg-amber-50/50 ocr-flash" : "border-slate-300"
    }`;
  };

  const tabs: { id: TabType; label: string; icon: any; badge?: number }[] = [
    { id: "personal", label: "Personal", icon: User },
    { id: "passport", label: "Passport", icon: Globe },
    { id: "address", label: "Address", icon: Home },
    { id: "career", label: "Experience", icon: Briefcase },
    { id: "extra", label: "Education & Skills", icon: Clipboard },
    { id: "declarations", label: "Declarations", icon: FileText },
  ];

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full">
      {/* Target Application Format Selector Banner */}
      <div className="bg-slate-900 px-4 py-2.5 border-b border-slate-800 flex items-center justify-between gap-3 text-white">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">Application Format:</span>
        </div>
        <div className="flex items-center gap-1.5 bg-slate-800 p-1 rounded-lg border border-slate-700">
          <button
            type="button"
            onClick={() => onFormatChange?.("format1")}
            className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-all flex items-center gap-1 cursor-pointer ${
              appFormat === "format1"
                ? "bg-emerald-600 text-white shadow"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <FileText className="w-3 h-3" />
            Format 01
          </button>
          <button
            type="button"
            onClick={() => onFormatChange?.("format2")}
            className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-all flex items-center gap-1 cursor-pointer ${
              appFormat === "format2"
                ? "bg-blue-600 text-white shadow"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <FileCheck className="w-3 h-3" />
            Format 02
          </button>
          <button
            type="button"
            onClick={() => onFormatChange?.("format3")}
            className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-all flex items-center gap-1 cursor-pointer ${
              appFormat === "format3"
                ? "bg-purple-600 text-white shadow"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <FileText className="w-3 h-3" />
            Format 03
          </button>
        </div>
      </div>

      {/* ATTACHMENTS & THREAD (Sidebar Structured Edition) */}
      <div className="bg-slate-50 border-b border-slate-200 p-4 space-y-3">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
              <Paperclip className="w-3.5 h-3.5 text-blue-500" />
              Attachments & Thread ({data.attachments?.length || 0})
            </h3>
            <p className="text-[10px] text-slate-500 mt-0.5">
              Police Reports, Passport Copies, and Applicant Photos.
            </p>
          </div>
          {data.attachments && data.attachments.length > 1 && (
            <button
              type="button"
              onClick={() => {
                const typePriority: Record<AttachmentType, number> = {
                  police_report: 1,
                  passport: 2,
                  applicant_photo: 3,
                  other: 4,
                };
                const sorted = [...(data.attachments || [])].sort((a, b) => {
                  return (typePriority[a.type] || 4) - (typePriority[b.type] || 4);
                });
                onChange({ ...data, attachments: sorted });
              }}
              className="text-[10px] text-blue-600 hover:text-blue-700 font-bold flex items-center gap-1 bg-blue-50 px-2 py-1 rounded border border-blue-200 transition-all cursor-pointer"
            >
              <RefreshCw className="w-3 h-3 text-blue-500" />
              Sort Order
            </button>
          )}
        </div>

        {/* Manual Upload Buttons (Attaching Order) */}
        <div className="space-y-1.5">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Manual Upload (Attaching Order)</p>
          <div className="grid grid-cols-2 gap-1.5">
            <label className="p-2 bg-white hover:bg-slate-50 border border-slate-200 hover:border-blue-500 text-slate-700 rounded-lg text-[10px] font-bold flex items-center justify-between gap-1 cursor-pointer transition-all">
              <div className="flex items-center gap-1.5 truncate">
                <span className="w-4 h-4 rounded-full bg-blue-100 text-blue-600 font-extrabold flex items-center justify-center text-[9px] shrink-0">1</span>
                <span className="truncate">Police Report</span>
              </div>
              <Upload className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <input
                type="file"
                multiple
                accept="image/*,.pdf,application/pdf"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0 && processAttachmentFiles) {
                    processAttachmentFiles(e.target.files, "police_report", "Police Clearance Report");
                    e.target.value = "";
                  }
                }}
              />
            </label>

            <label className="p-2 bg-white hover:bg-slate-50 border border-slate-200 hover:border-emerald-500 text-slate-700 rounded-lg text-[10px] font-bold flex items-center justify-between gap-1 cursor-pointer transition-all">
              <div className="flex items-center gap-1.5 truncate">
                <span className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-600 font-extrabold flex items-center justify-center text-[9px] shrink-0">2</span>
                <span className="truncate">Passport Copy</span>
              </div>
              <Upload className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <input
                type="file"
                multiple
                accept="image/*,.pdf,application/pdf"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0 && processAttachmentFiles) {
                    processAttachmentFiles(e.target.files, "passport", "Passport Scan");
                    e.target.value = "";
                  }
                }}
              />
            </label>

            <label className="p-2 bg-white hover:bg-slate-50 border border-slate-200 hover:border-purple-500 text-slate-700 rounded-lg text-[10px] font-bold flex items-center justify-between gap-1 cursor-pointer transition-all">
              <div className="flex items-center gap-1.5 truncate">
                <span className="w-4 h-4 rounded-full bg-purple-100 text-purple-600 font-extrabold flex items-center justify-center text-[9px] shrink-0">3</span>
                <span className="truncate">Applicant Photo</span>
              </div>
              <Upload className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <input
                type="file"
                accept="image/*,.pdf,application/pdf"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0 && processAttachmentFiles) {
                    processAttachmentFiles(e.target.files, "applicant_photo", "Applicant Photo");
                    e.target.value = "";
                  }
                }}
              />
            </label>

            <label className="p-2 bg-white hover:bg-slate-50 border border-slate-200 hover:border-amber-500 text-slate-700 rounded-lg text-[10px] font-bold flex items-center justify-between gap-1 cursor-pointer transition-all">
              <div className="flex items-center gap-1.5 truncate">
                <span className="w-4 h-4 rounded-full bg-amber-100 text-amber-600 font-extrabold flex items-center justify-center text-[9px] shrink-0">4</span>
                <span className="truncate">Other Doc</span>
              </div>
              <Upload className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <input
                type="file"
                multiple
                accept="image/*,.pdf,application/pdf"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0 && processAttachmentFiles) {
                    processAttachmentFiles(e.target.files, "other", "Supporting Document");
                    e.target.value = "";
                  }
                }}
              />
            </label>
          </div>
        </div>

        {/* Attached Items List */}
        {data.attachments && data.attachments.length > 0 && (
          <div className="max-h-[180px] overflow-y-auto space-y-2 pr-1 pt-1">
            {data.attachments.map((att, idx) => (
              <div
                key={att.id || idx}
                className="p-2 bg-white border border-slate-200 rounded-xl flex items-center gap-2 text-xs"
              >
                <div className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 font-bold text-[10px] flex items-center justify-center shrink-0 border border-slate-200">
                  {idx + 1}
                </div>
                <div className="w-9 h-11 bg-slate-50 border border-slate-200 rounded overflow-hidden shrink-0 flex items-center justify-center">
                  {att.url ? (
                    <img src={att.url} alt={att.title} className="w-full h-full object-cover" />
                  ) : (
                    <FileText className="w-4 h-4 text-slate-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0 space-y-1">
                  <input
                    type="text"
                    value={att.title}
                    onChange={(e) => {
                      const updated = [...(data.attachments || [])];
                      updated[idx] = { ...updated[idx], title: e.target.value };
                      onChange({ ...data, attachments: updated });
                    }}
                    className="w-full px-2 py-0.5 text-xs font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded focus:bg-white focus:ring-1 focus:ring-blue-500"
                    placeholder="Title"
                  />
                  <select
                    value={att.type}
                    onChange={(e) => {
                      const updated = [...(data.attachments || [])];
                      updated[idx] = { ...updated[idx], type: e.target.value as any };
                      onChange({ ...data, attachments: updated });
                    }}
                    className="text-[10px] bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5 text-slate-600 focus:bg-white"
                  >
                    <option value="police_report">Police Report</option>
                    <option value="passport">Passport Copy</option>
                    <option value="applicant_photo">Applicant Photo</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div className="flex flex-col gap-0.5 shrink-0">
                  <button
                    type="button"
                    disabled={idx === 0}
                    onClick={() => {
                      if (idx === 0) return;
                      const updated = [...(data.attachments || [])];
                      const temp = updated[idx];
                      updated[idx] = updated[idx - 1];
                      updated[idx - 1] = temp;
                      onChange({ ...data, attachments: updated });
                    }}
                    className="p-1 bg-slate-50 border border-slate-200 rounded hover:bg-slate-100 disabled:opacity-30 cursor-pointer text-slate-500"
                    title="Move Up"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={idx === (data.attachments?.length || 0) - 1}
                    onClick={() => {
                      if (idx === (data.attachments?.length || 0) - 1) return;
                      const updated = [...(data.attachments || [])];
                      const temp = updated[idx];
                      updated[idx] = updated[idx + 1];
                      updated[idx + 1] = temp;
                      onChange({ ...data, attachments: updated });
                    }}
                    className="p-1 bg-slate-50 border border-slate-200 rounded hover:bg-slate-100 disabled:opacity-30 cursor-pointer text-slate-500"
                    title="Move Down"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const updated = (data.attachments || []).filter((_, i) => i !== idx);
                      onChange({ ...data, attachments: updated });
                    }}
                    className="p-1 bg-red-50 hover:bg-red-100 border border-red-200 text-red-500 rounded cursor-pointer"
                    title="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Loading overlay for attachments inside CVForm */}
        {isProcessingAttachments && (
          <div className="p-2 bg-blue-50 border border-blue-100 rounded-lg text-xs flex items-center gap-2.5 text-blue-700 font-medium animate-pulse">
            <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
            <span>{processingAttMsg || "Processing file..."}</span>
          </div>
        )}
      </div>

      {/* Tabs list */}
      <div className="flex border-b border-slate-200 bg-slate-50 overflow-x-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3.5 py-3 text-xs font-semibold whitespace-nowrap transition-all border-b-2 shrink-0 ${
                activeTab === tab.id
                  ? "border-blue-600 text-blue-600 bg-white"
                  : "border-transparent text-slate-600 hover:text-slate-800 hover:bg-slate-100"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
              {typeof tab.badge === "number" && tab.badge > 0 && (
                <span className="ml-0.5 bg-blue-600 text-white font-bold text-[10px] px-1.5 py-0.2 rounded-full">
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab Contents */}
      <div className="p-5 flex-1 overflow-y-auto space-y-4">
        
        {/* PERSONAL DETAILS TAB */}
        {activeTab === "personal" && (
          <div className="space-y-4 animate-fadeIn">
            <h3 className="text-sm font-bold text-slate-900 border-b pb-2 mb-3">1. Personal Identity / Detalii Personale</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Name / Nume (First & Middle)</label>
                <input
                  type="text"
                  value={data.name}
                  onChange={(e) => updateField("name", e.target.value.toUpperCase())}
                  className={getInputClass("name")}
                  placeholder="KALUWA DEWAGE DHANUSHKA"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Surname / Prenumele</label>
                <input
                  type="text"
                  value={data.surname}
                  onChange={(e) => updateField("surname", e.target.value.toUpperCase())}
                  className={getInputClass("surname")}
                  placeholder="NISHSHANKA"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Applied Position / Functia Solicitata (Form 02 / 01 / 03)
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={data.appliedPosition || data.professionalSkill}
                  onChange={(e) => {
                    updateField("appliedPosition", e.target.value.toUpperCase());
                    updateField("professionalSkill", e.target.value.toUpperCase());
                  }}
                  className={getInputClass("appliedPosition") + " flex-1 font-semibold uppercase"}
                  placeholder="e.g. KITCHEN HELPER / FACTORY HELPER"
                />
                <select
                  value=""
                  onChange={(e) => {
                    if (e.target.value) {
                      handleJobPositionSelect(e.target.value);
                    }
                  }}
                  className="px-2 py-1.5 border border-slate-300 rounded-lg text-xs bg-white text-slate-700 font-medium hover:bg-slate-50 cursor-pointer max-w-[220px]"
                >
                  <option value="">-- Select Job Category --</option>
                  {JOB_CATEGORIES.map((cat) => (
                    <optgroup key={cat.name} label={`-- ${cat.name} --`}>
                      {cat.positions.map((pos) => (
                        <option key={`${cat.name}-${pos}`} value={pos}>
                          {pos}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Previous Name / Nume anterioare</label>
                <input
                  type="text"
                  value={data.previousName}
                  onChange={(e) => updateField("previousName", e.target.value)}
                  className={getInputClass("previousName")}
                  placeholder="Leave blank or -"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Phone / WhatsApp / Telefon</label>
                <input
                  type="text"
                  value={data.phone}
                  onChange={(e) => updateField("phone", e.target.value)}
                  className={getInputClass("phone")}
                  placeholder="+94775960561"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Height / Inaltime</label>
                <input
                  type="text"
                  value={data.height}
                  onChange={(e) => updateField("height", e.target.value)}
                  className={getInputClass("height")}
                  placeholder="e.g. 175 CM"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Weight / Greutate</label>
                <input
                  type="text"
                  value={data.weight}
                  onChange={(e) => updateField("weight", e.target.value)}
                  className={getInputClass("weight")}
                  placeholder="e.g. 70 KG"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Religion / Religia</label>
                <input
                  type="text"
                  value={data.religion}
                  onChange={(e) => updateField("religion", e.target.value.toUpperCase())}
                  className={getInputClass("religion")}
                  placeholder="BUDDHIST"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Place of Birth / Locul Nasterii</label>
                <input
                  type="text"
                  value={data.placeOfBirth}
                  onChange={(e) => updateField("placeOfBirth", e.target.value)}
                  className={getInputClass("placeOfBirth")}
                  placeholder="RAGAMA"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Date of Birth / Data nasterii</label>
                <input
                  type="text"
                  value={data.dateOfBirth}
                  onChange={(e) => updateField("dateOfBirth", e.target.value)}
                  className={getInputClass("dateOfBirth")}
                  placeholder="22.03.2000"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Father's Name / Parinti: tata</label>
                <input
                  type="text"
                  value={data.fatherName}
                  onChange={(e) => updateField("fatherName", e.target.value.toUpperCase())}
                  className={getInputClass("fatherName")}
                  placeholder="Father's full name"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Mother's Name / mama</label>
                <input
                  type="text"
                  value={data.motherName}
                  onChange={(e) => updateField("motherName", e.target.value.toUpperCase())}
                  className={getInputClass("motherName")}
                  placeholder="Mother's full name"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Citizenship / Cetatenie</label>
                <input
                  type="text"
                  value={data.citizenship}
                  onChange={(e) => updateField("citizenship", e.target.value)}
                  className={getInputClass("citizenship")}
                  placeholder="SRI LANKAN"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Nationality / Nationalitate</label>
                <input
                  type="text"
                  value={data.nationality}
                  onChange={(e) => updateField("nationality", e.target.value)}
                  className={getInputClass("nationality")}
                  placeholder="SRI LANKA"
                />
              </div>
            </div>

            <div className="border-t border-slate-150 pt-4 mt-4 space-y-3">
              <h4 className="text-xs font-bold text-slate-700">Photos & Attachments / Fotografii și Anexe</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Applicant Photo / Poză Candidat (Top Right)
                  </label>
                  <div className="flex items-center gap-3 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                    {data.photoUrl ? (
                      <div className="relative w-12 h-16 border rounded bg-white overflow-hidden shrink-0 shadow-sm">
                        <img src={data.photoUrl} alt="Applicant" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => {
                            const currentData = dataRef.current;
                            const filteredAtts = (currentData.attachments || []).filter(
                              (a) => a.type !== "applicant_photo"
                            );
                            onChange({
                              ...currentData,
                              photoUrl: null,
                              attachments: filteredAtts,
                            });
                          }}
                          className="absolute top-0.5 right-0.5 bg-red-600 hover:bg-red-700 text-white p-0.5 rounded-full"
                          title="Remove Photo"
                        >
                          <Trash2 className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="w-12 h-16 border border-dashed border-slate-300 rounded bg-white flex items-center justify-center shrink-0">
                        <Camera className="w-4 h-4 text-slate-400" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <input
                        type="file"
                        accept="image/png, image/jpeg, image/jpg"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = (event) => {
                              if (event.target?.result) {
                                const url = event.target.result as string;
                                const currentData = dataRef.current;
                                const existingAtts = currentData.attachments || [];

                                const photoIdx = existingAtts.findIndex(
                                  (a) => a.type === "applicant_photo"
                                );
                                let updatedAtts = [...existingAtts];

                                const photoDoc: AttachedDoc = {
                                  id: photoIdx >= 0 ? existingAtts[photoIdx].id : "att_photo_" + Date.now(),
                                  type: "applicant_photo",
                                  title: "Applicant Photo",
                                  url: url,
                                  fileName: file.name,
                                };

                                if (photoIdx >= 0) {
                                  updatedAtts[photoIdx] = photoDoc;
                                } else {
                                  updatedAtts.push(photoDoc);
                                }

                                onChange({
                                  ...currentData,
                                  photoUrl: url,
                                  attachments: updatedAtts,
                                });
                              }
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                        className="w-full text-xs text-slate-600 file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-[10px] file:font-bold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer overflow-hidden text-ellipsis"
                      />
                      <p className="text-[9px] text-slate-400 mt-1">PNG, JPEG or JPG (3 x 4 cm)</p>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Top Left Photo / Poză Stânga Sus
                  </label>
                  <div className="flex items-center gap-3 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                    {data.topLeftPhotoUrl ? (
                      <div className="relative w-12 h-16 border rounded bg-white overflow-hidden shrink-0 shadow-sm">
                        <img src={data.topLeftPhotoUrl} alt="Top Left" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => updateField("topLeftPhotoUrl", null)}
                          className="absolute top-0.5 right-0.5 bg-red-600 hover:bg-red-700 text-white p-0.5 rounded-full"
                          title="Remove Photo"
                        >
                          <Trash2 className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="w-12 h-16 border border-dashed border-slate-300 rounded bg-white flex items-center justify-center shrink-0">
                        <Camera className="w-4 h-4 text-slate-400" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <input
                        type="file"
                        accept="image/png, image/jpeg, image/jpg"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = (event) => {
                              if (event.target?.result) {
                                updateField("topLeftPhotoUrl", event.target.result as string);
                              }
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                        className="w-full text-xs text-slate-600 file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-[10px] file:font-bold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer overflow-hidden text-ellipsis"
                      />
                      <p className="text-[9px] text-slate-400 mt-1">PNG, JPEG or JPG (Slightly larger)</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* PASSPORT TAB */}
        {activeTab === "passport" && (
          <div className="space-y-4 animate-fadeIn">
            <h3 className="text-sm font-bold text-slate-900 border-b pb-2 mb-3">10. Passport Credentials / Date Pașaport</h3>
            
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Passport Number / Nr. Pașaport</label>
              <input
                type="text"
                value={data.passportNo}
                onChange={(e) => updateField("passportNo", e.target.value)}
                className={getInputClass("passportNo")}
                placeholder="N9767501"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Issued By / Eliberat de</label>
              <input
                type="text"
                value={data.passportIssuedBy}
                onChange={(e) => updateField("passportIssuedBy", e.target.value)}
                className={getInputClass("passportIssuedBy")}
                placeholder="COLOMBO"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Issue Date / La data</label>
              <input
                type="text"
                value={data.passportIssuedDate}
                onChange={(e) => updateField("passportIssuedDate", e.target.value)}
                className={getInputClass("passportIssuedDate")}
                placeholder="04/08/2022"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Valid From / Valabil de la</label>
                <input
                  type="text"
                  value={data.passportValidFrom}
                  onChange={(e) => updateField("passportValidFrom", e.target.value)}
                  className={getInputClass("passportValidFrom")}
                  placeholder="04/08/2022"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Expiry Date / Pana la (to)</label>
                <input
                  type="text"
                  value={data.passportValidTo}
                  onChange={(e) => updateField("passportValidTo", e.target.value)}
                  className={getInputClass("passportValidTo")}
                  placeholder="04/08/2032"
                />
              </div>
            </div>
          </div>
        )}

        {/* ADDRESSES TAB */}
        {activeTab === "address" && (
          <div className="space-y-4 animate-fadeIn">
            <h3 className="text-sm font-bold text-slate-900 border-b pb-2 mb-3">Residence Addresses / Domiciliu și Reședință</h3>
            
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Current Residence / Domiciliu (Full Address)</label>
              <textarea
                value={data.residence}
                onChange={(e) => updateField("residence", e.target.value)}
                rows={2}
                className={getInputClass("residence")}
                placeholder="NO.60/3/1, MUGUNUWATAWANA , MADAMPE , SRI LANKA"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Residence Country / Tara</label>
                <input
                  type="text"
                  value={data.country}
                  onChange={(e) => updateField("country", e.target.value)}
                  className={getInputClass("country")}
                  placeholder="SRI LANKA"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Residence City / Localitatea</label>
                <input
                  type="text"
                  value={data.city}
                  onChange={(e) => updateField("city", e.target.value)}
                  className={getInputClass("city")}
                  placeholder="MADAMPE"
                />
              </div>
            </div>

            <div className="border-t border-slate-150 pt-3 mt-3">
              <label className="block text-xs font-semibold text-slate-600 mb-1">Last Residence / Ultima Resedinta</label>
              <textarea
                value={data.lastResidence}
                onChange={(e) => updateField("lastResidence", e.target.value)}
                rows={2}
                className={getInputClass("lastResidence")}
                placeholder="Copy residence if same"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Last Residence Country / Tara</label>
                <input
                  type="text"
                  value={data.lastResidenceCountry}
                  onChange={(e) => updateField("lastResidenceCountry", e.target.value)}
                  className={getInputClass("lastResidenceCountry")}
                  placeholder="SRI LANKA"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Last Residence City / Localitatea</label>
                <input
                  type="text"
                  value={data.lastResidenceCity}
                  onChange={(e) => updateField("lastResidenceCity", e.target.value)}
                  className={getInputClass("lastResidenceCity")}
                  placeholder="MADAMPE"
                />
              </div>
            </div>

            <div className="border-t border-slate-150 pt-3 mt-3 grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Marital Status / Starea civila</label>
                <input
                  type="text"
                  value={data.maritalStatus}
                  onChange={(e) => updateField("maritalStatus", e.target.value)}
                  className={getInputClass("maritalStatus")}
                  placeholder="SINGLE / MARRIED"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Children to Support / Copii in intretinere</label>
                <input
                  type="text"
                  value={data.childrenToSupport}
                  onChange={(e) => updateField("childrenToSupport", e.target.value)}
                  className={getInputClass("childrenToSupport")}
                  placeholder="NONE / NUMBER"
                />
              </div>
            </div>
          </div>
        )}

        {/* CAREER EXPERIENCE TAB */}
        {activeTab === "career" && (
          <div className="space-y-4 animate-fadeIn">
            <h3 className="text-sm font-bold text-slate-900 border-b pb-2 mb-3">19. Employment History / Traseul Profesional</h3>
            
            <p className="text-[11px] text-slate-500 mb-4 bg-slate-50 p-2.5 rounded-lg border border-slate-150 leading-relaxed">
              Standard format allows up to 3 previous careers. If the applicant only has one, leave rows 2 & 3 empty.
            </p>

            {data.careers.map((row, idx) => (
              <div key={row.id} className="p-4 bg-slate-50 rounded-lg border border-slate-200 relative">
                <span className="absolute top-2 left-2 bg-slate-200 text-slate-700 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold">
                  {row.id}
                </span>
                
                <div className="pl-6 space-y-3">
                  {/* Position / Functia Dropdown & Field (Dropdown only on Row 1) */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Position / Functia (Row {row.id})
                    </label>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="text"
                        value={row.position}
                        onChange={(e) => updateCareer(idx, "position", e.target.value.toUpperCase())}
                        className="flex-1 px-3 py-1.5 border border-slate-300 rounded-lg bg-white text-xs text-slate-800 uppercase font-semibold"
                        placeholder="e.g. KITCHEN HELPER / FACTORY WORKER"
                      />
                      {idx === 0 && (
                        <select
                          value=""
                          onChange={(e) => {
                            if (e.target.value) {
                              handleCareerPositionSelect(idx, e.target.value);
                            }
                          }}
                          className="px-2 py-1.5 border border-slate-300 rounded-lg text-xs bg-white text-slate-700 font-medium hover:bg-slate-50 cursor-pointer max-w-[200px]"
                        >
                          <option value="">-- Choose Position --</option>
                          {JOB_CATEGORIES.map((cat) => (
                            <optgroup key={cat.name} label={`-- ${cat.name} --`}>
                              {cat.positions.map((pos) => (
                                <option key={`${cat.name}-${pos}`} value={pos}>
                                  {pos}
                                </option>
                              ))}
                            </optgroup>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>

                  {/* Employer / Angajator Dropdown & Field (Dropdown only on Row 1) */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Employer & Address / Angajator și Detalii
                    </label>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="text"
                        value={row.employerDetails}
                        onChange={(e) => updateCareer(idx, "employerDetails", e.target.value.toUpperCase())}
                        className="flex-1 px-3 py-1.5 border border-slate-300 rounded-lg bg-white text-xs text-slate-800 uppercase"
                        placeholder="e.g. GARMENT FACTORY, COLOMBO"
                      />
                      {idx === 0 && (
                        <select
                          value=""
                          onChange={(e) => {
                            if (e.target.value) {
                              handleCareerCompanySelect(idx, e.target.value);
                            }
                          }}
                          className="px-2 py-1.5 border border-slate-300 rounded-lg text-xs bg-white text-slate-700 font-medium hover:bg-slate-50 cursor-pointer max-w-[200px]"
                        >
                          <option value="">-- Choose Company --</option>
                          {JOB_CATEGORIES.map((cat) => (
                            <optgroup key={`comp-${cat.name}`} label={`-- ${cat.name} Companies --`}>
                              {cat.companies.map((comp) => (
                                <option key={comp} value={comp}>
                                  {comp}
                                </option>
                              ))}
                            </optgroup>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>
                  
                  {/* Period / Perioada Field & Quick Pick */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Period / Perioada</label>
                    <div className="flex flex-col sm:flex-row gap-2 items-center">
                      <input
                        type="text"
                        value={row.period}
                        onChange={(e) => updateCareer(idx, "period", e.target.value.toUpperCase())}
                        className="flex-1 w-full px-3 py-1.5 border border-slate-300 rounded-lg bg-white text-xs text-slate-800 uppercase"
                        placeholder="e.g. 02 YEARS"
                      />
                      {idx === 0 && (
                        <div className="flex gap-1 shrink-0">
                          {["02 YEARS", "03 YEARS", "04 YEARS", "05 YEARS"].map((yr) => (
                            <button
                              key={yr}
                              type="button"
                              onClick={() => updateCareer(idx, "period", yr)}
                              className={`px-2 py-1 rounded text-[10px] font-bold border ${
                                row.period === yr
                                  ? "bg-blue-600 text-white border-blue-600"
                                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                              }`}
                            >
                              {yr.replace(" YEARS", "Y")}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* EDUCATION & SKILLS TAB */}
        {activeTab === "extra" && (
          <div className="space-y-4 animate-fadeIn">
            <h3 className="text-sm font-bold text-slate-900 border-b pb-2 mb-3">Skills, Education & Trainings</h3>
            
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Professional Skill / Calificari profesionale
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={data.professionalSkill}
                  onChange={(e) => updateField("professionalSkill", e.target.value)}
                  className={getInputClass("professionalSkill") + " flex-1"}
                  placeholder="e.g. KITCHEN HELPER / FACTORY WORKER"
                />
                <select
                  value=""
                  onChange={(e) => {
                    if (e.target.value) {
                      handleJobPositionSelect(e.target.value);
                    }
                  }}
                  className="px-2 py-1.5 border border-slate-300 rounded-lg text-xs bg-white text-slate-700 font-medium hover:bg-slate-50 cursor-pointer max-w-[220px]"
                >
                  <option value="">-- Choose Category --</option>
                  {JOB_CATEGORIES.map((cat) => (
                    <optgroup key={cat.name} label={`-- ${cat.name} --`}>
                      {cat.positions.map((pos) => (
                        <option key={`${cat.name}-${pos}`} value={pos}>
                          {pos}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                {appFormat === "format2" ? (
                  <>
                    <label className="block text-xs font-semibold text-slate-600 mb-1 flex justify-between items-center">
                      <span>College / Colegiu</span>
                      {detectedDistrict && (
                        <span className="text-[10px] text-blue-500 font-semibold">
                          Detected Region: {detectedDistrict}
                        </span>
                      )}
                    </label>
                    <select
                      value={data.college}
                      onChange={(e) => updateField("college", e.target.value)}
                      className={getInputClass("college")}
                    >
                      <option value="">-- Choose Sri Lankan School --</option>
                      {detectedDistrict && schoolsForDetectedDistrict.length > 0 && (
                        <optgroup label={`Detected Region Schools (${detectedDistrict})`}>
                          {schoolsForDetectedDistrict.map((sch) => (
                            <option key={sch} value={sch}>
                              {sch}
                            </option>
                          ))}
                        </optgroup>
                      )}
                      {SRI_LANKA_SCHOOLS.map((prov) => (
                        <optgroup key={prov.district} label={`${prov.province} - ${prov.district}`}>
                          {prov.schools.map((sch) => (
                            <option key={sch} value={sch}>
                              {sch}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </>
                ) : (
                  <>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">College / Colegiu</label>
                    <input
                      type="text"
                      value={data.college}
                      onChange={(e) => updateField("college", e.target.value)}
                      className={getInputClass("college")}
                      placeholder="e.g. University / College name"
                    />
                  </>
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Course / Cursuri</label>
                <input
                  type="text"
                  value={data.classesGraduate}
                  onChange={(e) => updateField("classesGraduate", e.target.value)}
                  className={getInputClass("classesGraduate")}
                  placeholder="e.g. O/L – 1999"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Secondary School / Secundar</label>
                <input
                  type="text"
                  value={data.secondarySchool}
                  onChange={(e) => updateField("secondarySchool", e.target.value)}
                  className={getInputClass("secondarySchool")}
                  placeholder="YES / NO"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Primary School / Primar</label>
                <input
                  type="text"
                  value={data.primarySchool}
                  onChange={(e) => updateField("primarySchool", e.target.value)}
                  className={getInputClass("primarySchool")}
                  placeholder="YES / NO"
                />
              </div>
            </div>

            {/* Trainings / Courses Table Editor */}
            <div className="border-t border-slate-150 pt-3">
              <h4 className="text-xs font-bold text-slate-800 mb-2">Formări / Cursuri (Trainings & Courses)</h4>
              <div className="space-y-3">
                {(data.trainings || [
                  { id: 1, courseName: "-", duration: "-", diploma: "-" },
                  { id: 2, courseName: "", duration: "", diploma: "" },
                  { id: 3, courseName: "", duration: "", diploma: "" }
                ]).map((tr, idx) => (
                  <div key={tr.id || idx} className="p-3 bg-slate-50 rounded-lg border border-slate-200 grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Course / Institution</label>
                      <input
                        type="text"
                        value={tr.courseName}
                        onChange={(e) => {
                          const updated = [...(data.trainings || [])];
                          if (!updated[idx]) updated[idx] = { id: idx + 1, courseName: "", duration: "", diploma: "" };
                          updated[idx] = { ...updated[idx], courseName: e.target.value };
                          updateField("trainings", updated);
                        }}
                        className="w-full px-2 py-1 border border-slate-300 rounded bg-white text-xs"
                        placeholder="-"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Duration</label>
                      <input
                        type="text"
                        value={tr.duration}
                        onChange={(e) => {
                          const updated = [...(data.trainings || [])];
                          if (!updated[idx]) updated[idx] = { id: idx + 1, courseName: "", duration: "", diploma: "" };
                          updated[idx] = { ...updated[idx], duration: e.target.value };
                          updateField("trainings", updated);
                        }}
                        className="w-full px-2 py-1 border border-slate-300 rounded bg-white text-xs"
                        placeholder="-"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Diploma</label>
                      <input
                        type="text"
                        value={tr.diploma}
                        onChange={(e) => {
                          const updated = [...(data.trainings || [])];
                          if (!updated[idx]) updated[idx] = { id: idx + 1, courseName: "", duration: "", diploma: "" };
                          updated[idx] = { ...updated[idx], diploma: e.target.value };
                          updateField("trainings", updated);
                        }}
                        className="w-full px-2 py-1 border border-slate-300 rounded bg-white text-xs"
                        placeholder="-"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-slate-150 pt-3">
              <label className="block text-xs font-semibold text-slate-600 mb-1">Email Address / Adresa de email</label>
              <input
                type="email"
                value={data.email}
                onChange={(e) => updateField("email", e.target.value)}
                className={getInputClass("email")}
                placeholder="TRANSARABIAN@YAHOO.COM"
              />
            </div>
          </div>
        )}

        {/* DECLARATIONS TAB */}
        {activeTab === "declarations" && (
          <div className="space-y-4 animate-fadeIn">
            <h3 className="text-sm font-bold text-slate-900 border-b pb-2 mb-3">Declarations, Mentions & Date</h3>
            
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">22. Other Mentions / Alte mentiuni</label>
              <textarea
                value={data.otherMentions}
                onChange={(e) => updateField("otherMentions", e.target.value)}
                rows={2}
                className={getInputClass("otherMentions")}
                placeholder=""
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Declaration Romanian / Declaratie Limba Română</label>
              <textarea
                value={data.declarationRomanian}
                onChange={(e) => updateField("declarationRomanian", e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-800 bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Declaration English / Declaratie Limba Engleză</label>
              <textarea
                value={data.declarationEnglish}
                onChange={(e) => updateField("declarationEnglish", e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-800 bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Health & Understanding Declaration / Detalii Sănătate</label>
              <textarea
                value={data.declarationHealth}
                onChange={(e) => updateField("declarationHealth", e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-800 bg-white"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-600">Submission Date / Data înregistrării</label>
                <button
                  type="button"
                  onClick={() => updateField("date", new Date().toLocaleDateString("en-GB"))}
                  className="text-[10px] text-blue-600 hover:text-blue-800 font-medium underline cursor-pointer"
                >
                  Set Today
                </button>
              </div>
              <input
                type="text"
                value={data.date}
                onChange={(e) => updateField("date", e.target.value)}
                className={getInputClass("date")}
                placeholder="DD/MM/YYYY"
              />
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
