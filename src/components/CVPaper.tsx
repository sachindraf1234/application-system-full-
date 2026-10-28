import React, { useRef } from "react";
import { CVData, CareerRow, TrainingRow, AppFormat, AttachedDoc } from "../types";
import { Camera, Trash2, ArrowUp, ArrowDown, Sparkles, RefreshCw, FileText, Plus, Upload } from "lucide-react";
import { JOB_CATEGORIES, getRandomCompanyForPosition, getRandomPeriod } from "../data/jobCategories";

interface CVPaperProps {
  data: CVData;
  onChange: (newData: CVData) => void;
  flashedFields?: Set<string>;
  isPrintMode?: boolean;
  appFormat?: AppFormat;
  onExtractFromAttachment?: (attachmentUrl: string, title?: string) => void;
}

export default function CVPaper({ 
  data, 
  onChange, 
  flashedFields = new Set(), 
  isPrintMode = false,
  appFormat = "format1",
  onExtractFromAttachment
}: CVPaperProps) {
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const topLeftPhotoInputRef = useRef<HTMLInputElement | null>(null);

  // Helper to handle field change
  const handleFieldChange = (field: keyof CVData, value: any) => {
    onChange({
      ...data,
      [field]: value,
    });
  };

  // Handle position selection from draft mode dropdowns
  const handleJobPositionSelect = (selectedPos: string) => {
    if (!selectedPos) return;
    const upperPos = selectedPos.toUpperCase();
    const randomCompany = getRandomCompanyForPosition(upperPos);
    const randomPeriod = getRandomPeriod();

    const updatedCareers = [...(data.careers || [])];
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
      ...data,
      professionalSkill: upperPos,
      appliedPosition: upperPos,
      careers: updatedCareers,
    });
  };

  // Helper to handle career row change
  const handleCareerChange = (index: number, key: keyof CareerRow, value: any) => {
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

  // Helper to handle training row change
  const handleTrainingChange = (index: number, key: keyof TrainingRow, value: any) => {
    const updatedTrainings = [...(data.trainings || [])];
    if (!updatedTrainings[index]) {
      updatedTrainings[index] = { id: index + 1, courseName: "", duration: "", diploma: "" };
    }
    updatedTrainings[index] = {
      ...updatedTrainings[index],
      [key]: value,
    };
    onChange({
      ...data,
      trainings: updatedTrainings,
    });
  };

  // Handle Photo Upload
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          handleFieldChange("photoUrl", event.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle Top Left Photo Upload
  const handleTopLeftPhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          handleFieldChange("topLeftPhotoUrl", event.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Class helper for highlighted fields that just got OCR filled
  const getFieldClass = (fieldName: string, extraClasses = "") => {
    const isFlashed = flashedFields.has(fieldName);
    const hasWidth = extraClasses.includes("w-") || extraClasses.includes("flex-1") || extraClasses.includes("min-w-");
    const widthClass = hasWidth ? "" : "w-full";
    return `${widthClass} bg-transparent hover:bg-slate-100 focus:bg-white focus:ring-1 focus:ring-blue-400 focus:outline-none rounded transition-all py-0.5 px-1 border-b border-dashed border-slate-300 hover:border-slate-500 focus:border-blue-500 min-h-[19px] leading-snug ${
      isFlashed ? "ocr-flash" : ""
    } ${extraClasses}`;
  };

  // Helper to render field value as static text when printing or in print mode
  const renderField = (field: keyof CVData, placeholder: string, extraClasses = "", type = "text") => {
    let value = (data[field] as string) || "";
    if (field === "date" && (!value || value.trim() === "")) {
      value = new Date().toLocaleDateString("en-GB");
    }

    if (isPrintMode) {
      return (
        <span 
          className={`inline-block px-1 py-0.5 min-h-[19px] leading-snug font-sans text-slate-900 ${
            extraClasses.includes("uppercase") ? "uppercase" : ""
          } ${extraClasses.includes("font-bold") ? "font-bold" : ""} ${extraClasses.includes("font-semibold") ? "font-semibold" : ""} ${extraClasses}`}
          style={{ minWidth: "30px" }}
        >
          {value || null}
        </span>
      );
    }

    return (
      <input
        type={type}
        value={value}
        onChange={(e) => handleFieldChange(field, type === "text" && (field === "name" || field === "surname" || field === "religion" || field === "fatherName" || field === "motherName") ? e.target.value.toUpperCase() : e.target.value)}
        className={getFieldClass(field, extraClasses)}
        placeholder={placeholder}
      />
    );
  };

  const renderTextarea = (field: keyof CVData, placeholder: string, heightClass = "h-[50px]", italic = false) => {
    const isFlashed = flashedFields.has(field);
    const value = (data[field] as string) || "";

    if (isPrintMode) {
      return (
        <div 
          className={`w-full text-slate-900 leading-normal text-justify px-1 py-1 min-h-[40px] whitespace-pre-wrap break-words font-sans text-xs ${
            italic ? "italic text-slate-800 font-medium" : "font-medium"
          }`}
        >
          {value || null}
        </div>
      );
    }

    return (
      <textarea
        value={value}
        onChange={(e) => handleFieldChange(field, e.target.value)}
        className={`w-full bg-transparent hover:bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 rounded transition-all text-xs resize-none ${heightClass} leading-normal ${
          isFlashed ? "ocr-flash" : ""
        } ${italic ? "italic text-slate-800" : "text-slate-900 font-medium"}`}
        placeholder={placeholder}
      />
    );
  };

  const renderCareerField = (index: number, key: keyof CareerRow, placeholder: string, extraClasses = "") => {
    const row = data.careers[index];
    const value = row ? (row[key] as string || "") : "";
    const isPositionHighlight = appFormat === "format3" && key === "position" && Boolean(value && value.trim().length > 0);

    if (isPrintMode) {
      return (
        <span className="inline-block px-1 py-0.5 min-h-[15px] text-slate-900 text-left w-full font-sans text-[10px]">
          {value ? (
            <span className={isPositionHighlight ? "bg-yellow-300 px-1.5 py-0.5 rounded-xs font-bold italic text-slate-950 inline-block" : extraClasses}>
              {value}
            </span>
          ) : null}
        </span>
      );
    }

    return (
      <div className="w-full flex items-center">
        <input
          type="text"
          value={value}
          onChange={(e) => handleCareerChange(index, key, e.target.value.toUpperCase())}
          className={`bg-transparent hover:bg-slate-100 focus:bg-white focus:outline-none px-1 py-0 rounded uppercase transition-all ${extraClasses} ${
            isPositionHighlight ? "w-auto bg-yellow-300 font-bold italic text-slate-950 px-1.5 rounded-xs inline-block" : "w-full"
          }`}
          style={isPositionHighlight ? { width: `${Math.max(value.length + 3, 6)}ch`, maxWidth: '100%' } : {}}
          placeholder={placeholder}
        />
      </div>
    );
  };

  const renderTrainingField = (index: number, key: keyof TrainingRow, placeholder: string, extraClasses = "") => {
    const row = (data.trainings || [])[index];
    const value = row ? (row[key] as string || "") : "";

    if (isPrintMode) {
      return (
        <span className="inline-block px-1 py-0.5 min-h-[15px] text-slate-900 text-left w-full font-sans text-[10px]">
          {value ? (
            <span className={extraClasses}>
              {value}
            </span>
          ) : null}
        </span>
      );
    }

    return (
      <input
        type="text"
        value={value}
        onChange={(e) => handleTrainingChange(index, key, e.target.value.toUpperCase())}
        className={`w-full bg-transparent hover:bg-slate-100 focus:bg-white focus:outline-none px-1 py-0 rounded uppercase ${extraClasses}`}
        placeholder={placeholder}
      />
    );
  };

  return (
    <div className="flex flex-col items-center gap-8 py-4 select-text print-container w-full">
      {/* Hidden file input for Photo */}
      <input
        type="file"
        ref={photoInputRef}
        onChange={handlePhotoUpload}
        accept="image/*"
        className="hidden"
      />

      {/* Hidden file input for Top Left Photo / Logo */}
      <input
        type="file"
        ref={topLeftPhotoInputRef}
        onChange={handleTopLeftPhotoUpload}
        accept="image/*"
        className="hidden"
      />

      {/* ========================================================================================= */}
      {/* FORMAT 03: Classic Curriculum Vitae Layout (No candidate or agency images) */}
      {/* ========================================================================================= */}
      {appFormat === "format3" ? (
        <div id="cv-page-1" className="paper-page text-[12.5px] leading-relaxed text-slate-900 font-sans">
          <div className="w-full h-full p-6 flex flex-col justify-between relative bg-white">
            <div>
              {/* Document Title Header */}
              <div className="text-center mb-6 pt-2">
                <h1 className="text-[20px] font-bold tracking-widest text-slate-950 uppercase font-sans">
                  CURRICULUM VITAE
                </h1>
              </div>

              {/* 19 Numbered Items List */}
              <div className="space-y-2 text-[12px] text-slate-900">
                
                {/* 1. Name */}
                <div className="flex items-baseline gap-1">
                  <span className="font-bold text-slate-950 whitespace-nowrap">1. Numele (name):</span>
                  <div className="flex-1 font-bold text-slate-950 uppercase">
                    {renderField("name", "SHANTHA KUMARA JAYASEKARA", "font-bold text-slate-950 uppercase")}
                  </div>
                </div>

                {/* 2. Given Name */}
                <div className="flex items-baseline gap-1">
                  <span className="font-bold text-slate-950 whitespace-nowrap">2. Prenumele (given name):</span>
                  <div className="flex-1 font-bold text-slate-950 uppercase">
                    {renderField("surname", "PALLE GEDARA", "font-bold text-slate-950 uppercase")}
                  </div>
                </div>

                {/* 3. Previous Names */}
                <div className="flex items-baseline gap-1">
                  <span className="font-bold text-slate-950 whitespace-nowrap">3. Numele purtate anterior (previous names):</span>
                  <div className="flex-1 font-semibold text-slate-900">
                    {renderField("previousName", "-", "font-semibold text-slate-900")}
                  </div>
                </div>

                {/* 4. Place of Birth */}
                <div className="flex items-baseline gap-1">
                  <span className="font-bold text-slate-950 whitespace-nowrap">4. Locul nașterii (place of birth):</span>
                  <div className="flex-1 font-semibold text-slate-900 uppercase">
                    {renderField("placeOfBirth", "MAMPITIYA", "font-semibold text-slate-900 uppercase")}
                  </div>
                </div>

                {/* 5. Country & City of Birth */}
                <div className="flex items-baseline flex-wrap gap-x-1">
                  <span className="font-bold text-slate-950">5. (country)</span>
                  <div className="inline-block min-w-[100px] font-semibold text-slate-900 uppercase">
                    {renderField("country", "SRI LANKA", "font-semibold text-slate-900 uppercase")}
                  </div>
                  <span className="font-bold text-slate-950">. , Localitatea (city):</span>
                  <div className="inline-block min-w-[100px] font-semibold text-slate-900 uppercase">
                    {renderField("city", "HANDESSA", "font-semibold text-slate-900 uppercase")}
                  </div>
                </div>

                {/* 6. Date of Birth */}
                <div className="flex items-baseline gap-1">
                  <span className="font-bold text-slate-950 whitespace-nowrap">6. Data nașterii (date of birth):</span>
                  <div className="flex-1 font-semibold text-slate-900">
                    {renderField("dateOfBirth", "30/09/1979", "font-semibold text-slate-900")}
                  </div>
                </div>

                {/* 7. Parents Name */}
                <div className="space-y-1">
                  <div className="flex items-baseline gap-1">
                    <span className="font-bold text-slate-950 whitespace-nowrap">7. Părinții (parents name): Tata (father):</span>
                    <div className="flex-1 font-semibold text-slate-900 uppercase">
                      {renderField("fatherName", "FATHER NAME", "font-semibold text-slate-900 uppercase")}
                    </div>
                  </div>
                  <div className="flex items-baseline gap-1 pl-6">
                    <span className="font-bold text-slate-950 whitespace-nowrap">Mama (mother):</span>
                    <div className="flex-1 font-semibold text-slate-900 uppercase">
                      {renderField("motherName", "MOTHER NAME", "font-semibold text-slate-900 uppercase")}
                    </div>
                  </div>
                </div>

                {/* 8. Citizenship */}
                <div className="flex items-baseline gap-1">
                  <span className="font-bold text-slate-950 whitespace-nowrap">8. Cetățenie (citizenship):</span>
                  <div className="flex-1 font-semibold text-slate-900 uppercase">
                    {renderField("citizenship", "SRI LANKAN", "font-semibold text-slate-900 uppercase")}
                  </div>
                </div>

                {/* 9. Nationality */}
                <div className="flex items-baseline gap-1">
                  <span className="font-bold text-slate-950 whitespace-nowrap">9. Naționalitate (nationality):</span>
                  <div className="flex-1 font-semibold text-slate-900 uppercase">
                    {renderField("nationality", "SRI LANKAN", "font-semibold text-slate-900 uppercase")}
                  </div>
                </div>

                {/* 10. Passport Details */}
                <div className="flex items-baseline flex-wrap gap-x-1">
                  <span className="font-bold text-slate-950">10. Documentul de trecere a frontierei (passport) nr :</span>
                  <div className="inline-block min-w-[90px] font-semibold text-slate-900 uppercase">
                    {renderField("passportNo", "PASSPORT NO", "font-semibold text-slate-900 uppercase")}
                  </div>
                  <span className="font-bold text-slate-950">eliberat de autoritățiile (issued by):</span>
                  <div className="inline-block min-w-[90px] font-semibold text-slate-900 uppercase">
                    {renderField("passportIssuedBy", "COLOMBO", "font-semibold text-slate-900 uppercase")}
                  </div>
                  <span className="font-bold text-slate-950">la data de (date):</span>
                  <div className="inline-block min-w-[80px] font-semibold text-slate-900">
                    {renderField("passportIssuedDate", "28/11/2017", "font-semibold text-slate-900")}
                  </div>
                  <span className="font-bold text-slate-950">valabil până la data de (valid):</span>
                  <div className="inline-block min-w-[80px] font-semibold text-slate-900">
                    {renderField("passportValidTo", "28/11/2027", "font-semibold text-slate-900")}
                  </div>
                </div>

                {/* 11. Home Address */}
                <div className="space-y-0.5">
                  <div className="flex items-baseline gap-1">
                    <span className="font-bold text-slate-950 whitespace-nowrap">11.Domiciliul (home:</span>
                    <div className="flex-1 font-semibold text-slate-900 uppercase">
                      {renderField("residence", "WELANGASWEWA, BORALUWEWA, SRI LANKA", "font-semibold text-slate-900 uppercase")}
                    </div>
                  </div>
                  <div className="flex items-baseline gap-x-8">
                    <div className="flex items-baseline gap-1">
                      <span className="font-bold text-slate-950 whitespace-nowrap">Localitatea (city):</span>
                      <div className="inline-block min-w-[90px] font-semibold text-slate-900 uppercase">
                        {renderField("city", "BORALUWEWA", "font-semibold text-slate-900 uppercase")}
                      </div>
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className="font-bold text-slate-950 whitespace-nowrap">Țara (country):</span>
                      <div className="inline-block min-w-[90px] font-semibold text-slate-900 uppercase">
                        {renderField("country", "SRI LANKA", "font-semibold text-slate-900 uppercase")}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 12. Last Residence */}
                <div className="flex items-baseline gap-1">
                  <span className="font-bold text-slate-950 whitespace-nowrap">12. Ultima reședință (last residence):</span>
                  <div className="flex-1 font-semibold text-slate-900 uppercase">
                    {renderField("lastResidence", "LAST RESIDENCE", "font-semibold text-slate-900 uppercase")}
                  </div>
                </div>

                {/* 13. Last Residence Country & City */}
                <div className="flex items-baseline flex-wrap gap-x-1">
                  <span className="font-bold text-slate-950">13. Țara (country):</span>
                  <div className="inline-block min-w-[100px] font-semibold text-slate-900 uppercase">
                    {renderField("lastResidenceCountry", "SRI LANKA", "font-semibold text-slate-900 uppercase")}
                  </div>
                  <span className="font-bold text-slate-950">Localitatea (city):</span>
                  <div className="inline-block min-w-[100px] font-semibold text-slate-900 uppercase">
                    {renderField("lastResidenceCity", "HANDESSA", "font-semibold text-slate-900 uppercase")}
                  </div>
                </div>

                {/* 14. Marital Status & Children */}
                <div className="flex items-baseline flex-wrap gap-x-1">
                  <span className="font-bold text-slate-950">14. Stare civilă (marital status):</span>
                  <div className="inline-block min-w-[90px] font-semibold text-slate-900 uppercase">
                    {renderField("maritalStatus", "MARRIED", "font-semibold text-slate-900 uppercase")}
                  </div>
                  <span className="font-bold text-slate-950">, (children):</span>
                  <div className="inline-block min-w-[60px] font-semibold text-slate-900">
                    {renderField("childrenToSupport", "- -", "font-semibold text-slate-900")}
                  </div>
                </div>

                {/* 15. Professional Qualifications */}
                <div className="flex items-baseline gap-1">
                  <span className="font-bold text-slate-950 whitespace-nowrap">15. Calificări profesionale (professional qualifications):</span>
                  <div className="flex-1 flex items-center gap-1 font-semibold text-slate-900 uppercase">
                    {renderField("professionalSkill", "- -", "font-semibold text-slate-900 uppercase flex-1")}
                    {!isPrintMode && (
                      <select
                        value=""
                        onChange={(e) => {
                          if (e.target.value) {
                            handleJobPositionSelect(e.target.value);
                          }
                        }}
                        className="no-print border border-slate-300 rounded text-[10px] px-1 py-0.5 bg-white text-slate-700 hover:bg-slate-50 cursor-pointer font-sans"
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

                {/* 16. Career History Table */}
                <div>
                  <div className="font-bold text-slate-950 leading-snug mb-1">
                    16. Traseul profesional (angajatorii anteriori cu datele de identificare ale acestora, precum și funcțiile deținute) (previous employers, previously held functions):
                  </div>
                  <table className="w-full border-collapse border border-slate-950 my-1 text-[12px]">
                    <thead>
                      <tr className="border-b border-slate-950 font-bold text-slate-950 bg-slate-50">
                        <th className="w-[6%] border-r border-slate-950 p-1 text-left">Nr.crt.</th>
                        <th className="w-[44%] border-r border-slate-950 p-1 text-left">Angajator (employer)</th>
                        <th className="w-[25%] border-r border-slate-950 p-1 text-left">Perioada (period)</th>
                        <th className="w-[25%] p-1 text-left">Funcția (function)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.careers.slice(0, 3).map((c, idx) => {
                        const hasPosition = Boolean(c.position && c.position.trim().length > 0);
                        return (
                          <tr key={c.id || idx} className="border-b border-slate-950 last:border-b-0 min-h-[26px]">
                            <td className="font-bold border-r border-slate-950 p-1 text-slate-950">{idx + 1}.</td>
                            <td className="border-r border-slate-950 p-1">
                              {renderCareerField(idx, "employerDetails", "EMPLOYER NAME", "w-full font-semibold text-slate-950 italic")}
                            </td>
                            <td className="border-r border-slate-950 p-1">
                              {renderCareerField(idx, "period", "PERIOD", "w-full font-semibold text-slate-950 italic")}
                            </td>
                            <td className="p-1">
                              {renderCareerField(idx, "position", "FUNCTION", "font-bold text-slate-950 italic")}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* 17. Main Profession */}
                <div className="flex items-baseline gap-1">
                  <span className="font-bold text-slate-950 whitespace-nowrap">17. Profesia de bază (profession):</span>
                  <div className="flex-1 flex items-center gap-1 font-bold text-slate-950 uppercase italic">
                    {renderField("appliedPosition", data.professionalSkill || "WELDER", "font-bold text-slate-950 uppercase italic flex-1")}
                    {!isPrintMode && (
                      <select
                        value=""
                        onChange={(e) => {
                          if (e.target.value) {
                            handleJobPositionSelect(e.target.value);
                          }
                        }}
                        className="no-print border border-slate-300 rounded text-[10px] px-1 py-0.5 bg-white text-slate-700 hover:bg-slate-50 cursor-pointer font-sans"
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

                {/* 18. Foreign Languages */}
                <div className="flex items-baseline gap-1">
                  <span className="font-bold text-slate-950 whitespace-nowrap">18. Limbi străine cunoscute (foreign languages):</span>
                  <div className="flex-1 font-semibold text-slate-900">
                    {renderField("foreignLanguage", "- -", "font-semibold text-slate-900")}
                  </div>
                </div>

                {/* 19. Declaration Paragraph */}
                <div className="font-bold text-slate-950 text-[11.5px] leading-snug pt-1">
                  19. Declar pe propria răspundere că sunt apt/ă din punct de vedere medical pentru a fi încadrat/ă în muncă, nu am antecedente penale și cunosc limba engleză la nivel conversational ( I declare on my own responsability that I am medically fit to be employed, have no criminal record and I speak English at conversational level).
                </div>

              </div>
            </div>

            {/* Signature Section at Bottom Right */}
            <div className="flex justify-end mt-6 pr-6">
              <div className="flex flex-col items-center text-center min-w-[220px]">
                <div className="relative w-full flex items-end justify-center min-h-[48px] pb-0 border-b border-dashed border-slate-900">
                  {data.signatureUrl ? (
                    <img src={data.signatureUrl} alt="Signature" className="object-contain mb-[-4px] relative z-10" style={{ maxHeight: "40px", width: "auto" }} />
                  ) : (
                    <span className="text-[12px] font-bold text-slate-900 uppercase leading-none px-2 py-1">
                      {data.surname} {data.name}
                    </span>
                  )}
                </div>
                <div className="font-bold text-[12.5px] text-slate-950 pt-1">
                  Semnatura (Signature),
                </div>
              </div>
            </div>

          </div>
        </div>
      ) : appFormat === "format2" ? (
        <>
          {/* FORMAT 02 PAGE 1 */}
          <div id="cv-page-1" className="paper-page text-[12px] leading-snug text-slate-900 font-sans">
            <div className="w-full h-full p-2.5 flex flex-col justify-between relative">
              
              {/* Header: Agency Logo (Left), Title (Center), Applicant Photo (Right) */}
              <div className="flex items-center justify-between mb-1">
                
                {/* Left Agency Logo (Square Shape, Increased Size, No Black Border) */}
                <div className="w-[125px] flex shrink-0">
                  <div className="relative group w-[125px] h-[125px] shrink-0 bg-white p-1 flex items-center justify-center">
                    {data.topLeftPhotoUrl ? (
                      <>
                        <img src={data.topLeftPhotoUrl} alt="Agency Logo" className="w-full h-full object-contain" />
                        {!isPrintMode && (
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 no-print">
                            <button
                              onClick={() => topLeftPhotoInputRef.current?.click()}
                              className="bg-white/90 hover:bg-white text-slate-900 text-[9px] font-bold px-2 py-1 rounded shadow"
                            >
                              Change
                            </button>
                            <button
                              onClick={() => handleFieldChange("topLeftPhotoUrl", null)}
                              className="bg-red-600 hover:bg-red-700 text-white p-1 rounded shadow"
                              title="Remove Logo"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </>
                    ) : (
                      !isPrintMode && (
                        <div 
                          onClick={() => topLeftPhotoInputRef.current?.click()}
                          className="w-full h-full rounded border border-dashed border-slate-300 bg-slate-50 hover:bg-slate-100 flex flex-col items-center justify-center p-1 text-center cursor-pointer no-print"
                        >
                          <Camera className="w-4 h-4 text-slate-400 mb-1" />
                          <span className="text-[8.5px] font-extrabold text-slate-500 uppercase tracking-tight">Upload Logo</span>
                        </div>
                      )
                    )}
                  </div>
                </div>

                {/* Center Title (CURRICULUM VITAE) - Increased font size & perfectly centered */}
                <div className="flex-1 text-center px-2">
                  <h1 className="text-[28px] font-black tracking-widest text-slate-900 uppercase font-serif leading-tight">
                    CURRICULUM VITAE
                  </h1>
                </div>

                {/* Right Candidate Photo Box (No Black Border) */}
                <div className="w-[125px] flex justify-end shrink-0">
                  <div className="relative group w-[100px] h-[125px] bg-slate-50 overflow-hidden">
                    {data.photoUrl ? (
                      <img src={data.photoUrl} alt="Applicant" className="w-full h-full object-contain bg-slate-50" />
                    ) : (
                      <div 
                        onClick={() => photoInputRef.current?.click()}
                        className="w-full h-full flex flex-col items-center justify-center text-center p-1 text-[9px] text-slate-400 cursor-pointer"
                      >
                        <Camera className="w-4 h-4 text-slate-400 mb-1" />
                        <span>Add Photo</span>
                        <span className="text-[8px] text-slate-400">3.5 x 4.5 cm</span>
                      </div>
                    )}
                    {!isPrintMode && data.photoUrl && (
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1 no-print">
                        <button
                          onClick={() => photoInputRef.current?.click()}
                          className="bg-white/90 p-1 rounded text-slate-800 text-[9px] font-bold"
                        >
                          Change
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Trans Arabian Contact Info - Directly below logo with tight bottom margin to summary table */}
              <div className="text-[11px] leading-tight text-slate-900 mb-1.5 font-medium">
                <div className="font-bold text-slate-900 text-[11.5px]">Trans Arabian (PVT)Ltd - LL1422</div>
                <div className="text-blue-700 font-semibold underline">{data.email || "transarabian@yahoo.com"}</div>
                <div className="text-slate-800 font-medium">{data.phone || "0777906905 / 0768584292 / 0312255833"}</div>
              </div>

              {/* Summary Table Top */}
              <table className="w-full border-collapse border border-slate-900 mb-1.5 text-[11px]">
                <tbody>
                  <tr className="border-b border-slate-900">
                    <td className="w-[35%] p-1 font-bold border-r border-slate-900 bg-slate-50/50">
                      <div>Nume si prenume:</div>
                      <div className="text-[10px] text-slate-700">Name and Surname:</div>
                    </td>
                    <td className="p-1 font-bold text-slate-900 uppercase">
                      {/* Surname comes FIRST, then Name in a SINGLE data filling cage */}
                      {isPrintMode ? (
                        <span className="font-bold text-slate-900 uppercase block w-full text-[11px]">
                          {[data.surname, data.name].filter(Boolean).join(" ") || "NISHSHANKA KALUWA DEWAGE DHANUSHKA"}
                        </span>
                      ) : (
                        <input
                          type="text"
                          value={[data.surname, data.name].filter(Boolean).join(" ")}
                          onChange={(e) => {
                            const val = e.target.value.toUpperCase();
                            const parts = val.trimStart().split(/\s+/);
                            const newSurname = parts[0] || "";
                            const newName = parts.slice(1).join(" ");
                            onChange({
                              ...data,
                              surname: newSurname,
                              name: newName,
                            });
                          }}
                          className={`w-full bg-transparent hover:bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 rounded transition-all font-bold text-slate-900 uppercase text-[11px] ${
                            flashedFields.has("surname") || flashedFields.has("name") ? "ocr-flash bg-amber-50" : ""
                          }`}
                          placeholder="NISHSHANKA KALUWA DEWAGE DHANUSHKA"
                        />
                      )}
                    </td>
                  </tr>
                  <tr className="border-b border-slate-900">
                    <td className="p-1 font-bold border-r border-slate-900 bg-slate-50/50">
                      <div>Nume anterioare:</div>
                      <div className="text-[10px] text-slate-700">Previous names:</div>
                    </td>
                    <td className="p-1">
                      {renderField("previousName", "-", "w-full")}
                    </td>
                  </tr>
                  <tr className="border-b border-slate-900">
                    <td className="p-1 font-bold border-r border-slate-900 bg-slate-50/50">
                      <div>Adresa:</div>
                      <div className="text-[10px] text-slate-700">Address:</div>
                    </td>
                    <td className="p-1">
                      {renderField("residence", "WELANGASWEWA, BORALUWEWA, SRI LANKA", "w-full")}
                    </td>
                  </tr>
                  <tr className="border-b border-slate-900">
                    <td className="p-1 font-bold border-r border-slate-900 bg-slate-50/50">
                      Telefon mobil / WhatsApp
                    </td>
                    <td className="p-1 font-semibold text-slate-900">
                      {renderField("phone", "+94775960561", "w-full font-semibold")}
                    </td>
                  </tr>
                  <tr>
                    <td className="p-1 font-bold border-r border-slate-900 bg-slate-50/50">
                      <div>Functia solicitata:</div>
                      <div className="text-[10px] text-slate-700">Applied position:</div>
                    </td>
                    <td className="p-1 font-bold text-slate-900 uppercase">
                      <div className="flex items-center gap-1">
                        <div className="flex-1">
                          {renderField("professionalSkill", "VEHICLE SALE OWNER", "w-full font-bold uppercase")}
                        </div>
                        {!isPrintMode && (
                          <select
                            value=""
                            onChange={(e) => {
                              if (e.target.value) {
                                handleJobPositionSelect(e.target.value);
                              }
                            }}
                            className="no-print border border-slate-300 rounded text-[10px] px-1 py-0.5 bg-white text-slate-700 hover:bg-slate-50 cursor-pointer font-sans font-normal"
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
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* Section I Title Header */}
              <div className="text-center py-1 mb-1.5 bg-slate-100 border-y border-slate-900 font-bold text-[12.5px] uppercase tracking-wide">
                I. INFORMATII PERSONALE / PERSONAL INFORMATION
              </div>

              {/* Table I: Personal Information (12 Rows) */}
              <table className="w-full border-collapse border border-slate-900 flex-1 text-[11px]">
                <tbody>
                  <tr className="border-b border-slate-900">
                    <td className="w-[6%] text-center font-bold border-r border-slate-900 p-1">1.</td>
                    <td className="w-[42%] border-r border-slate-900 p-1 font-bold">
                      <div>Data nasterii:</div>
                      <div className="text-[10px] text-slate-700">Date of Birth:</div>
                    </td>
                    <td className="p-1">{renderField("dateOfBirth", "22.03.2000", "w-full")}</td>
                  </tr>
                  <tr className="border-b border-slate-900">
                    <td className="text-center font-bold border-r border-slate-900 p-1">2.</td>
                    <td className="border-r border-slate-900 p-1 font-bold">
                      <div>Locul nasterii:</div>
                      <div className="text-[10px] text-slate-700">Place of Birth:</div>
                    </td>
                    <td className="p-1">{renderField("placeOfBirth", "RAGAMA", "w-full uppercase")}</td>
                  </tr>
                  <tr className="border-b border-slate-900">
                    <td className="text-center font-bold border-r border-slate-900 p-1">3.</td>
                    <td className="border-r border-slate-900 p-1 font-bold">
                      <div>Cetatenia :</div>
                      <div className="text-[10px] text-slate-700">Citizenship:</div>
                    </td>
                    <td className="p-1">{renderField("citizenship", "SRI LANKAN", "w-full uppercase")}</td>
                  </tr>
                  <tr className="border-b border-slate-900">
                    <td className="text-center font-bold border-r border-slate-900 p-1">4.</td>
                    <td className="border-r border-slate-900 p-1 font-bold">
                      <div>Stare civila:</div>
                      <div className="text-[10px] text-slate-700">Civil Status:</div>
                    </td>
                    <td className="p-1">{renderField("maritalStatus", "SINGLE", "w-full uppercase")}</td>
                  </tr>
                  <tr className="border-b border-slate-900">
                    <td className="text-center font-bold border-r border-slate-900 p-1">5.</td>
                    <td className="border-r border-slate-900 p-1 font-bold">
                      <div>Copii aflați în custodie. Dacă există, vârsta lor:</div>
                      <div className="text-[10px] text-slate-700">Children in custody. If any, their respective age:</div>
                    </td>
                    <td className="p-1">{renderField("childrenToSupport", "-", "w-full")}</td>
                  </tr>
                  <tr className="border-b border-slate-900">
                    <td className="text-center font-bold border-r border-slate-900 p-1">6.</td>
                    <td className="border-r border-slate-900 p-1 font-bold">
                      <div>Inaltime:</div>
                      <div className="text-[10px] text-slate-700">Height:</div>
                    </td>
                    <td className="p-1">{renderField("height", "", "w-full")}</td>
                  </tr>
                  <tr className="border-b border-slate-900">
                    <td className="text-center font-bold border-r border-slate-900 p-1">7.</td>
                    <td className="border-r border-slate-900 p-1 font-bold">
                      <div>Greutate:</div>
                      <div className="text-[10px] text-slate-700">Weight:</div>
                    </td>
                    <td className="p-1">{renderField("weight", "", "w-full")}</td>
                  </tr>
                  <tr className="border-b border-slate-900">
                    <td className="text-center font-bold border-r border-slate-900 p-1">8.</td>
                    <td className="border-r border-slate-900 p-1 font-bold">
                      <div>Religia:</div>
                      <div className="text-[10px] text-slate-700">Religion:</div>
                    </td>
                    <td className="p-1">{renderField("religion", "BUDDHIST", "w-full uppercase")}</td>
                  </tr>
                  <tr className="border-b border-slate-900">
                    <td className="text-center font-bold border-r border-slate-900 p-1">9.</td>
                    <td className="border-r border-slate-900 p-1 font-bold">
                      <div>Adresa e-mail:</div>
                      <div className="text-[10px] text-slate-700">E-mail address:</div>
                    </td>
                    <td className="p-1">{renderField("email", "TRANSARABIAN@YAHOO.COM", "w-full uppercase")}</td>
                  </tr>
                  <tr className="border-b border-slate-900">
                    <td className="text-center font-bold border-r border-slate-900 p-1">10.</td>
                    <td className="border-r border-slate-900 p-1 font-bold">
                      <div>Numar pasaport:</div>
                      <div className="text-[10px] text-slate-700">Passport number:</div>
                    </td>
                    <td className="p-1">{renderField("passportNo", "N9516135", "w-full uppercase font-bold")}</td>
                  </tr>
                  <tr className="border-b border-slate-900">
                    <td className="text-center font-bold border-r border-slate-900 p-1">11.</td>
                    <td className="border-r border-slate-900 p-1 font-bold">
                      <div>Nume tata:</div>
                      <div className="text-[10px] text-slate-700">Father name:</div>
                    </td>
                    <td className="p-1">{renderField("fatherName", "K.D. MOHAN LAL SIRISENA", "w-full uppercase")}</td>
                  </tr>
                  <tr>
                    <td className="text-center font-bold border-r border-slate-900 p-1">12.</td>
                    <td className="border-r border-slate-900 p-1 font-bold">
                      <div>Nume mama:</div>
                      <div className="text-[10px] text-slate-700">Mother name:</div>
                    </td>
                    <td className="p-1">{renderField("motherName", "HETTINARAYAN MUDIYANSELAGE RENUKA NISHANTHI", "w-full uppercase")}</td>
                  </tr>
                </tbody>
              </table>

            </div>
          </div>

          {/* FORMAT 02 PAGE 2 */}
          <div id="cv-page-2" className="paper-page text-[12px] leading-snug text-slate-900 font-sans">
            <div className="w-full h-full p-3.5 flex flex-col justify-between">
              
              <div className="space-y-4">
                {/* Section II Title Header */}
                <div className="text-center py-1 bg-slate-100 border border-slate-900 font-bold text-[13px] uppercase tracking-wide">
                  II. NIVELUL DE STUDII / EDUCATION ATTAINMENT
                </div>

                <table className="w-full border-collapse border border-slate-900 text-[11.5px] mb-2.5">
                  <tbody>
                    <tr className="border-b border-slate-900">
                      <td className="w-[6%] text-center font-bold border-r border-slate-900 p-1">1.</td>
                      <td className="w-[35%] border-r border-slate-900 p-1.5 font-bold">Colegiu /College:</td>
                      <td className="p-1.5">{renderField("college", "", "w-full")}</td>
                    </tr>
                    <tr className="border-b border-slate-900">
                      <td className="text-center font-bold border-r border-slate-900 p-1">2.</td>
                      <td className="border-r border-slate-900 p-1.5 font-bold">Cursuri/Course:</td>
                      <td className="p-1.5">{renderField("classesGraduate", "O/L – 1999", "w-full")}</td>
                    </tr>
                    <tr className="border-b border-slate-900">
                      <td className="text-center font-bold border-r border-slate-900 p-1">3.</td>
                      <td className="border-r border-slate-900 p-1.5 font-bold">Secundar/Secondary:</td>
                      <td className="p-1.5">{renderField("secondarySchool", "YES", "w-full")}</td>
                    </tr>
                    <tr className="border-b border-slate-900">
                      <td className="text-center font-bold border-r border-slate-900 p-1">4.</td>
                      <td className="border-r border-slate-900 p-1.5 font-bold">Primar/Primary:</td>
                      <td className="p-1.5">{renderField("primarySchool", "YES", "w-full")}</td>
                    </tr>
                    <tr>
                      <td className="text-center font-bold border-r border-slate-900 p-1">5.</td>
                      <td className="border-r border-slate-900 p-1.5 font-bold">
                        <div>Limba engleza/ limba romana /</div>
                        <div>English language/ Romanian language</div>
                      </td>
                      <td className="p-1.5 space-y-1 text-[11px]">
                        {(["Understanding", "Speaking", "Writing"] as const).map((skill) => {
                          const key = (`lang${skill}`) as "langUnderstanding" | "langSpeaking" | "langWriting";
                          const currentVal = data[key] || "Good";
                          const options: Array<"Excellent" | "Good" | "Fair" | "Poor" | "None"> = [
                            "Excellent", "Good", "Fair", "Poor", "None"
                          ];
                          return (
                            <div key={skill} className="flex items-center gap-1">
                              <strong className="mr-1">{skill}:</strong>
                              {options.map((opt, i) => {
                                const isSelected = currentVal === opt;
                                return (
                                  <React.Fragment key={opt}>
                                    {i > 0 && <span className="text-slate-400 mx-0.5">/</span>}
                                    <span
                                      onClick={() => handleFieldChange(key, opt)}
                                      className={`cursor-pointer transition-colors ${
                                        isSelected
                                          ? "font-bold underline text-slate-950"
                                          : "text-slate-600 hover:text-slate-900"
                                      }`}
                                    >
                                      {opt}
                                    </span>
                                  </React.Fragment>
                                );
                              })}
                            </div>
                          );
                        })}
                      </td>
                    </tr>
                  </tbody>
                </table>

                {/* Section III Title Header */}
                <div className="text-center py-1 bg-slate-100 border border-slate-900 font-bold text-[13px] uppercase tracking-wide mt-4">
                  III. EXPERIENȚE DE LUCRU / WORKING EXEPERIENCES
                </div>

                {/* Subsection A: Trainings / Courses */}
                <div className="text-[12px] font-bold text-slate-900 my-1.5">
                  A. Formări / cursuri Trainings / courses:
                </div>
                <table className="w-full border-collapse border border-slate-900 text-[11.5px] mb-2.5">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-900 font-bold text-slate-900">
                      <th className="w-[6%] border-r border-slate-900 p-1">#</th>
                      <th className="border-r border-slate-900 p-1 text-left">
                        <div>Numele cursului / instituției</div>
                        <div className="text-[10px] font-normal text-slate-700">Name of the course / institution</div>
                      </th>
                      <th className="w-[25%] border-r border-slate-900 p-1 text-left">Durata/Duration</th>
                      <th className="w-[20%] p-1 text-left">Diploma</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.trainings || [
                      { id: 1, courseName: "-", duration: "-", diploma: "-" },
                      { id: 2, courseName: "", duration: "", diploma: "" },
                      { id: 3, courseName: "", duration: "", diploma: "" }
                    ]).map((t, idx) => (
                      <tr key={t.id || idx} className="border-b border-slate-900 last:border-b-0">
                        <td className="text-center font-bold border-r border-slate-900 p-1">{idx + 1}.</td>
                        <td className="border-r border-slate-900 p-1">
                          {renderTrainingField(idx, "courseName", "-", "w-full")}
                        </td>
                        <td className="border-r border-slate-900 p-1">
                          {renderTrainingField(idx, "duration", "-", "w-full")}
                        </td>
                        <td className="p-1">
                          {renderTrainingField(idx, "diploma", "-", "w-full")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Subsection B: Past Professions */}
                <div className="text-[12px] font-bold text-slate-900 my-1.5">
                  B. Profesii anterioare (detalii de identificare a angajatorului) și poziții:
                  <div className="text-[11px] font-normal text-slate-700">Past professions (employer’s identification details) and positions:</div>
                </div>
                <table className="w-full border-collapse border border-slate-900 text-[11.5px]">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-900 font-bold text-slate-900">
                      <th className="w-[6%] border-r border-slate-900 p-1">#</th>
                      <th className="border-r border-slate-900 p-1 text-left">
                        <div>Angajator</div>
                        <div className="text-[10px] font-normal text-slate-700">Employer/identification details</div>
                      </th>
                      <th className="w-[25%] border-r border-slate-900 p-1 text-left">
                        <div>Durata</div>
                        <div className="text-[10px] font-normal text-slate-700">Duration</div>
                      </th>
                      <th className="w-[25%] p-1 text-left">
                        <div>Functa</div>
                        <div className="text-[10px] font-normal text-slate-700">Position</div>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.careers.map((c, idx) => (
                      <tr key={c.id || idx} className="border-b border-slate-900 last:border-b-0">
                        <td className="text-center font-bold border-r border-slate-900 p-1">{idx + 1}.</td>
                        <td className="border-r border-slate-900 p-1">
                          {renderCareerField(idx, "employerDetails", "VEHICLE SALE COMPNAY", "w-full")}
                        </td>
                        <td className="border-r border-slate-900 p-1">
                          {renderCareerField(idx, "period", "02 YEARS", "w-full")}
                        </td>
                        <td className="p-1">
                          {renderCareerField(idx, "position", "OWNER", "w-full")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Declaration Box - Increased Font Size, Close to Table B but NOT Attached */}
              <div className="border border-slate-900 p-2.5 mt-2.5 mb-1.5 text-center leading-relaxed bg-white">
                <div className="font-extrabold text-slate-950 text-[13.5px] mb-1 leading-snug">
                  Declar pe proprie raspundere sunt apt din punct de vedere medical pentru a fi încadrat în muncă şi că am cunoştinţe minime de limba română si cunostiinte de limba engleza.
                </div>
                <div className="text-slate-800 text-[12.5px] font-semibold leading-snug">
                  I declare on my own responsibility that I am medically fit to work and that I have minimal knowledge of Romanian and English knowledge.
                </div>
              </div>

              {/* Footer: Date & Signature (Values and Signature placed directly ON top of the dash lines) */}
              <div className="flex items-start justify-between mt-3 pt-1 text-[12px]">
                
                {/* Left: Date Column */}
                <div className="flex flex-col items-center min-w-[190px] text-center">
                  <div className="relative w-full h-12 flex items-end justify-center pb-1 border-b border-dashed border-slate-900">
                    {renderField("date", new Date().toLocaleDateString("en-GB"), "font-bold text-center text-[12.5px] border-none bg-transparent inline-block")}
                  </div>
                  {/* Label below dash line */}
                  <div className="font-bold text-[12px] text-slate-900 pt-1">Data / Date</div>
                </div>

                {/* Right: Signature Column */}
                <div className="flex flex-col items-center min-w-[220px] text-center">
                  <div className="relative w-full h-12 flex items-end justify-center pb-0 border-b border-dashed border-slate-900">
                    {data.signatureUrl ? (
                      <img src={data.signatureUrl} alt="Signature" className="mx-auto block object-contain mb-[-4px] relative z-10" style={{ maxHeight: "40px", width: "auto" }} />
                    ) : (
                      <span className="text-[12px] font-bold text-slate-900 uppercase leading-none bg-white/80 px-1 inline-block">
                        {data.surname} {data.name}
                      </span>
                    )}
                  </div>
                  {/* Labels below dash line */}
                  <div className="font-bold text-[12px] text-slate-900 pt-1">Nume si semnatura</div>
                  <div className="text-[11px] text-slate-700 font-semibold">Name and signature</div>
                </div>

              </div>

            </div>
          </div>
        </>
      ) : (
        /* ========================================================================================= */
        /* FORMAT 01: Standard Green Bilingual CV Layout */
        /* ========================================================================================= */
        <>
          {/* FORMAT 01 PAGE 1 */}
          <div id="cv-page-1" className="paper-page text-[11.5px] leading-snug text-slate-800 font-sans">
            <div className="w-full h-full cv-green-border p-3 flex flex-col justify-between relative">
              
              {/* Centered Document Title */}
              <div className="text-center mb-[34mm]">
                <h1 className="text-[28px] font-bold tracking-widest text-slate-900 uppercase">
                  Curriculum Vitae
                </h1>
              </div>

              {/* Top Left Photo Block */}
              {data.topLeftPhotoUrl ? (
                <div className={`absolute top-3 left-3 group w-[115px] h-[155px] flex flex-col items-center justify-center overflow-hidden z-10 ${
                  isPrintMode ? "" : "border border-slate-300 bg-white rounded shadow-sm"
                }`}>
                  <img src={data.topLeftPhotoUrl} alt="Top Left" className="w-full h-full object-cover" />
                  {!isPrintMode && (
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1 no-print">
                      <button
                        onClick={() => topLeftPhotoInputRef.current?.click()}
                        className="bg-white/90 hover:bg-white p-1 rounded-full text-slate-800 shadow"
                      >
                        <Camera className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleFieldChange("topLeftPhotoUrl", null)}
                        className="bg-red-600/90 hover:bg-red-600 p-1 rounded-full text-white shadow"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                !isPrintMode && (
                  <div 
                    onClick={() => topLeftPhotoInputRef.current?.click()}
                    className="absolute top-3 left-3 w-[115px] h-[155px] border border-dashed border-slate-300 bg-slate-50 hover:bg-slate-100 flex flex-col items-center justify-center p-2 text-center text-[9px] text-slate-500 hover:text-blue-600 gap-1 transition-colors rounded shadow-sm z-10 cursor-pointer no-print"
                  >
                    <Camera className="w-5 h-5 text-slate-400" />
                    <span className="font-semibold uppercase tracking-tight text-[8px]">Top Left Photo / Logo</span>
                    <span className="text-[7px] text-slate-400">JPEG / PNG</span>
                  </div>
                )
              )}

              {/* Profile Photo Block */}
              {!isPrintMode ? (
                <div className="absolute top-3 right-3 group w-[85px] h-[115px] border border-slate-300 bg-slate-50 flex flex-col items-center justify-center overflow-hidden rounded shadow-sm z-10">
                  {data.photoUrl ? (
                    <>
                      <img src={data.photoUrl} alt="Applicant" className="w-full h-full object-contain bg-slate-50" />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1 no-print">
                        <button
                          onClick={() => photoInputRef.current?.click()}
                          className="bg-white/90 hover:bg-white p-1 rounded-full text-slate-800 shadow"
                        >
                          <Camera className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleFieldChange("photoUrl", null)}
                          className="bg-red-600/90 hover:bg-red-600 p-1 rounded-full text-white shadow"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </>
                  ) : (
                    <button
                      onClick={() => photoInputRef.current?.click()}
                      className="w-full h-full flex flex-col items-center justify-center p-2 text-center text-[9px] text-slate-500 hover:text-blue-600 gap-1 transition-colors no-print"
                    >
                      <Camera className="w-5 h-5 text-slate-400" />
                      <span className="font-semibold uppercase tracking-tight">Add Photo</span>
                      <span className="text-[7.5px] text-slate-400">3 x 4 cm</span>
                    </button>
                  )}
                </div>
              ) : (
                <div className="absolute top-3 right-3 w-[85px] h-[115px] overflow-hidden flex items-center justify-center bg-slate-50">
                  {data.photoUrl ? (
                    <img src={data.photoUrl} alt="Applicant" className="w-full h-full object-contain bg-slate-50" />
                  ) : (
                    <div className="w-full h-full bg-slate-50 border border-dashed border-slate-300 rounded flex items-center justify-center text-[8px] text-slate-400 text-center">
                      Photo Placeholder<br/>3 x 4 cm
                    </div>
                  )}
                </div>
              )}

              {/* Numbered Form Fields 1 to 22 */}
              <div className="space-y-[7.5px] flex-1 pr-1">
                
                {/* 1. Name */}
                <div className="flex items-start">
                  <span className="font-bold mr-1 shrink-0 w-4">1.</span>
                  <div className="flex-1 flex flex-wrap items-baseline gap-x-1">
                    <span className="font-bold text-slate-900">Nume / Name :</span>
                    {renderField("name", "WARNAKULASOORIYA VIHANGA THIMALKA", "font-bold text-slate-900 uppercase flex-1")}
                  </div>
                </div>

                {/* 2. Surname */}
                <div className="flex items-start">
                  <span className="font-bold mr-1 shrink-0 w-4">2.</span>
                  <div className="flex-1 flex flex-wrap items-baseline gap-x-1">
                    <span className="font-bold text-slate-900">Prenumele/Surname :</span>
                    {renderField("surname", "THISERA", "font-bold text-slate-900 uppercase flex-1")}
                  </div>
                </div>

                {/* 3. Previous Name */}
                <div className="flex items-start">
                  <span className="font-bold mr-1 shrink-0 w-4">3.</span>
                  <div className="flex-1 flex flex-wrap items-baseline gap-x-1">
                    <span className="font-bold text-slate-900">Numele purtate anterior/Previous name :</span>
                    {renderField("previousName", "N/A", "flex-1")}
                  </div>
                </div>

                {/* 4. Place of birth */}
                <div className="flex items-start">
                  <span className="font-bold mr-1 shrink-0 w-4">4.</span>
                  <div className="flex-1 flex flex-wrap items-baseline gap-x-1">
                    <span className="font-bold text-slate-900">Locul Nasterii/Place of birth :</span>
                    {renderField("placeOfBirth", "CHILAW", "flex-1")}
                  </div>
                </div>

                {/* 5. Date of birth */}
                <div className="flex items-start">
                  <span className="font-bold mr-1 shrink-0 w-4">5.</span>
                  <div className="flex-1 flex flex-wrap items-baseline gap-x-1">
                    <span className="font-bold text-slate-900">Data nasterii/Date of birth :</span>
                    {renderField("dateOfBirth", "01/01/2003", "flex-1")}
                  </div>
                </div>

                {/* 6. Father name */}
                <div className="flex items-start">
                  <span className="font-bold mr-1 shrink-0 w-4">6.</span>
                  <div className="flex-1 flex flex-wrap items-baseline gap-x-1">
                    <span className="font-bold text-slate-900">Parinti/Parents: tata/Father :</span>
                    {renderField("fatherName", "WARNAKULASOORIYALAGE NALAKA PIYARAJ THISERA", "uppercase flex-1")}
                  </div>
                </div>

                {/* 7. Mother name */}
                <div className="flex items-start">
                  <span className="font-bold mr-1 shrink-0 w-4">7.</span>
                  <div className="flex-1 flex flex-wrap items-baseline gap-x-1">
                    <span className="font-bold text-slate-900">mama/mother :</span>
                    {renderField("motherName", "KARIYAPPERUMA ATHUKORALALAGE NADEESHA", "uppercase flex-1")}
                  </div>
                </div>

                {/* 8. Citizenship */}
                <div className="flex items-start">
                  <span className="font-bold mr-1 shrink-0 w-4">8.</span>
                  <div className="flex-1 flex flex-wrap items-baseline gap-x-1">
                    <span className="font-bold text-slate-900">Cetatenie/Citizenship :</span>
                    {renderField("citizenship", "SRI LANKAN", "flex-1")}
                  </div>
                </div>

                {/* 9. Nationality */}
                <div className="flex items-start">
                  <span className="font-bold mr-1 shrink-0 w-4">9.</span>
                  <div className="flex-1 flex flex-wrap items-baseline gap-x-1">
                    <span className="font-bold text-slate-900">Nationalitate/ Nationality :</span>
                    {renderField("nationality", "SRI LANKA", "flex-1")}
                  </div>
                </div>

                {/* 10. Passport Block */}
                <div className="flex items-start">
                  <span className="font-bold mr-1 shrink-0 w-4">10.</span>
                  <div className="flex-1 flex flex-wrap items-baseline gap-x-1 text-slate-900 leading-snug">
                    <span className="font-bold">Pasaport/Passport cod/code................Nr./NO.:</span>
                    {renderField("passportNo", "N9767501", "w-20 font-bold text-slate-900 text-center")}
                    <span className="font-bold">, eliberat de/Issued by</span>
                    {renderField("passportIssuedBy", "COLOMBO", "w-24 text-center")}
                    <span className="font-bold">, la data/date.</span>
                    {renderField("passportIssuedDate", "04/08/2022", "w-20 text-center")}
                    <span className="font-bold">, valabil de la /valability from.</span>
                    {renderField("passportValidFrom", "04/08/2022", "w-20 text-center")}
                    <span className="font-bold">pana/to.</span>
                    {renderField("passportValidTo", "04/08/2032", "w-20 font-bold text-slate-900 text-center")}
                  </div>
                </div>

                {/* 11. Residence */}
                <div className="flex items-start">
                  <span className="font-bold mr-1 shrink-0 w-4">11.</span>
                  <div className="flex-1 flex flex-wrap items-baseline gap-x-1">
                    <span className="font-bold text-slate-900">Domiciliu/Residence:</span>
                    {renderField("residence", "NO.60/3/1, MUGUNUWATAWANA , MADAMPE , SRI LANKA", "flex-1")}
                  </div>
                </div>

                {/* 12. Country */}
                <div className="flex items-start">
                  <span className="font-bold mr-1 shrink-0 w-4">12.</span>
                  <div className="flex-1 flex flex-wrap items-baseline gap-x-1">
                    <span className="font-bold text-slate-900">Tara/Country :</span>
                    {renderField("country", "SRI LANKA", "flex-1")}
                  </div>
                </div>

                {/* 13. City */}
                <div className="flex items-start">
                  <span className="font-bold mr-1 shrink-0 w-4">13.</span>
                  <div className="flex-1 flex flex-wrap items-baseline gap-x-1">
                    <span className="font-bold text-slate-900">Localitatea/City...</span>
                    {renderField("city", "MADAMPE", "flex-1")}
                  </div>
                </div>

                {/* 14. Last Residence */}
                <div className="flex items-start">
                  <span className="font-bold mr-1 shrink-0 w-4">14.</span>
                  <div className="flex-1 flex flex-wrap items-baseline gap-x-1">
                    <span className="font-bold text-slate-900">Ultima resedinta/Last residence :</span>
                    {renderField("lastResidence", "NO.60/3/1, MUGUNUWATAWANA , MADAMPE , SRI LANKA", "flex-1")}
                  </div>
                </div>

                {/* 15. Last Residence Country */}
                <div className="flex items-start">
                  <span className="font-bold mr-1 shrink-0 w-4">15.</span>
                  <div className="flex-1 flex flex-wrap items-baseline gap-x-1">
                    <span className="font-bold text-slate-900">Tara / country :</span>
                    {renderField("lastResidenceCountry", "SRI LANKA", "flex-1")}
                  </div>
                </div>

                {/* 16. Last Residence City (Localiatea/City...) */}
                <div className="flex items-start">
                  <span className="font-bold mr-1 shrink-0 w-4">16.</span>
                  <div className="flex-1 flex flex-wrap items-baseline gap-x-1">
                    <span className="font-bold text-slate-900">Localiatea/City... :</span>
                    {renderField("lastResidenceCity", "MADAMPE", "flex-1")}
                  </div>
                </div>

                {/* 17. Marital status & Children */}
                <div className="flex items-start">
                  <span className="font-bold mr-1 shrink-0 w-4">17.</span>
                  <div className="flex-1 flex flex-wrap items-center gap-y-1">
                    <span className="font-bold text-slate-900">Starea civila/Marital status:</span>
                    {renderField("maritalStatus", "SINGLE", "inline-block w-24 mx-1 font-semibold")}
                    <span className="font-bold text-slate-900">Copii in intretinere/Children to support financialy:</span>
                    {renderField("childrenToSupport", "NONE", "inline-block w-24 mx-1")}
                  </div>
                </div>

                {/* 18. Professional Skill */}
                <div className="flex items-start">
                  <span className="font-bold mr-1 shrink-0 w-4">18.</span>
                  <div className="flex-1 flex flex-wrap items-center gap-x-1">
                    <span className="font-bold text-slate-900">Calificari profesionale/Proffesional skill :</span>
                    <div className="flex-1 min-w-[150px]">
                      {renderField("professionalSkill", "FACTORY WORKER", "w-full")}
                    </div>
                    {!isPrintMode && (
                      <select
                        value=""
                        onChange={(e) => {
                          if (e.target.value) {
                            handleJobPositionSelect(e.target.value);
                          }
                        }}
                        className="no-print border border-slate-300 rounded text-[10px] px-1 py-0.5 bg-white text-slate-700 hover:bg-slate-50 cursor-pointer font-sans"
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

                {/* 19. Careers Table Header & Rows */}
                <div className="flex items-start">
                  <span className="font-bold mr-1 shrink-0 w-4">19.</span>
                  <div className="flex-1">
                    <div className="font-bold text-slate-900 mb-2 pb-0.5 leading-snug">
                      Traseul profesional (detalii angajator,perioada,functia)/Careers(employer details,period,position) :
                    </div>
                    
                    {/* Careers Table */}
                    <table className="w-full border-collapse border border-slate-900 text-[10.5px] mt-1">
                      <thead>
                        <tr className="bg-slate-100 border-b border-slate-900 font-bold text-slate-900 text-center">
                          <th className="border-r border-slate-900 p-1 w-[45%]">Angajator/Employer details</th>
                          <th className="border-r border-slate-900 p-1 w-[25%]">Perioada/Period</th>
                          <th className="p-1 w-[30%]">Functia/Position</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[0, 1, 2].map((idx) => (
                          <tr key={idx} className="border-b border-slate-900 last:border-b-0 h-6">
                            <td className="border-r border-slate-900 px-1 py-0.5">
                              {renderCareerField(idx, "employerDetails", "GARMENT FACTORY")}
                            </td>
                            <td className="border-r border-slate-900 px-1 py-0.5">
                              {renderCareerField(idx, "period", "02 YEARS")}
                            </td>
                            <td className="px-1 py-0.5">
                              {renderCareerField(idx, "position", "HELPER")}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 20. Classes Graduate */}
                <div className="flex items-start">
                  <span className="font-bold mr-1 shrink-0 w-4">20.</span>
                  <div className="flex-1 flex flex-wrap items-baseline gap-x-1">
                    <span className="font-bold text-slate-900">Numar clase absolvite/ No of classes graduate :</span>
                    {renderField("classesGraduate", "UPTO O/L", "flex-1")}
                  </div>
                </div>

                {/* 21. Foreign Languages */}
                <div className="flex items-start">
                  <span className="font-bold mr-1 shrink-0 w-4">21.</span>
                  <div className="flex-1 flex flex-wrap items-baseline gap-x-1">
                    <span className="font-bold text-slate-900">Limbi straine Engleza/ Foreign English Language :</span>
                    {isPrintMode ? (
                      <span className="font-bold text-slate-900 px-1">NORMAL ENGLISH</span>
                    ) : (
                      <input
                        type="text"
                        value="NORMAL ENGLISH"
                        disabled
                        className="flex-1 bg-transparent text-slate-900 font-bold py-0.5 px-1 border-b border-dotted border-slate-300 cursor-not-allowed select-none text-xs"
                        title="This field is permanently set to NORMAL ENGLISH"
                      />
                    )}
                  </div>
                </div>

                {/* 22. Email */}
                <div className="flex items-start">
                  <span className="font-bold mr-1 shrink-0 w-4">22.</span>
                  <div className="flex-1 flex flex-wrap items-baseline gap-x-1">
                    <span className="font-bold text-slate-900">Adresa de email / email address :</span>
                    {renderField("email", "", "flex-1", "email")}
                  </div>
                </div>

              </div>

              {/* Footer of Page 1 */}
              <div className="text-[9px] text-slate-400 text-right font-mono mt-2 pt-1 border-t border-slate-100">
                Page 1 / Pagina 1
              </div>

            </div>
          </div>

          {/* FORMAT 01 PAGE 2 */}
          <div id="cv-page-2" className="paper-page text-[12px] leading-relaxed text-slate-800 font-sans">
            {/* Beautiful 10mm-margin deep forest green double-line border container */}
            <div className="w-full h-full cv-green-border p-3 flex flex-col justify-start">
              
              <div className="space-y-4 pr-1">
                {/* 23. Other mentions */}
                <div className="flex items-start">
                  <span className="font-bold mr-1 shrink-0 w-5 text-slate-900">23.</span>
                  <div className="flex-1">
                    <span className="font-bold text-slate-900 block mb-1">Alte mentiuni/Other mentions</span>
                    {renderTextarea("otherMentions", "", "min-h-[60px]")}
                  </div>
                </div>

                {/* Romanian Declaration Text */}
                <div className="text-slate-900 font-medium pl-5 leading-normal text-justify">
                  {renderTextarea("declarationRomanian", "Romanian declaration text here...", "h-[50px]")}
                </div>

                {/* English Declaration Text */}
                <div className="text-slate-900 font-medium pl-5 leading-normal text-justify font-sans">
                  {renderTextarea("declarationEnglish", "English declaration text here...", "h-[50px]", false)}
                </div>

                {/* Additional health and Romanian understanding notes */}
                <div className="text-slate-800 pl-5 leading-normal text-justify">
                  {renderTextarea("declarationHealth", "Health declaration details here...", "h-[55px]")}
                </div>
              </div>

              {/* Date & Signature Bottom Section */}
              <div className="mt-8 pl-5 pr-5">
                <div className="flex items-start justify-between text-[12px]">
                  
                  {/* Left: Date Column */}
                  <div className="flex flex-col items-center min-w-[190px] text-center">
                    <div className="relative w-full h-12 flex items-end justify-center pb-1 border-b border-dashed border-slate-900">
                      {isPrintMode ? (
                        <span className="font-bold text-center text-[12.5px] text-slate-900 inline-block">
                          {data.date || new Date().toLocaleDateString("en-GB")}
                        </span>
                      ) : (
                        <input
                          type="text"
                          value={data.date || new Date().toLocaleDateString("en-GB")}
                          onChange={(e) => handleFieldChange("date", e.target.value)}
                          className="w-full text-center font-bold text-[12.5px] text-slate-900 bg-transparent focus:outline-none"
                          placeholder="DATE"
                        />
                      )}
                    </div>
                    {/* Label below dash line */}
                    <div className="text-xs font-bold tracking-wider text-slate-800 uppercase pt-1">DATE</div>
                  </div>

                  {/* Right: Signature Column */}
                  <div className="flex flex-col items-center min-w-[220px] text-center">
                    <div className="relative w-full h-12 flex items-end justify-center pb-0 border-b border-dashed border-slate-900">
                      {data.signatureUrl ? (
                        <img src={data.signatureUrl} alt="Signature" className="mx-auto block object-contain mb-[-4px] relative z-10" style={{ maxHeight: "40px", width: "auto" }} />
                      ) : (
                        <span className="text-[12px] font-bold text-slate-900 uppercase leading-none bg-white/80 px-1 inline-block">
                          {data.surname} {data.name}
                        </span>
                      )}
                    </div>
                    {/* Label below dash line */}
                    <div className="text-xs font-bold tracking-wider text-slate-800 uppercase pt-1">SIGNATURE</div>
                  </div>

                </div>
              </div>

              {/* Footer of Page 2 */}
              <div className="text-[9px] text-slate-400 text-right font-mono mt-auto pt-1 border-t border-slate-100">
                Page 2 / Pagina 2
              </div>

            </div>
          </div>
        </>
      )}

      {/* SUPPORTING ATTACHMENT PAGES (Police Report, Passport, Applicant Image, etc.) */}
      {data.attachments && data.attachments.length > 0 && data.attachments.map((att, idx) => {
        const isPassport = att.type === "passport";
        const isPhoto = att.type === "applicant_photo";

        return (
          <div key={att.id || idx} className="flex flex-col items-center mb-10 w-full max-w-[210mm] mx-auto">
            {/* Full-width interactive controls bar (hidden in print and PDF export) */}
            {!isPrintMode && (
              <div className="no-print w-full mb-2 p-2.5 bg-slate-900 text-white border border-slate-700 rounded-xl flex flex-wrap items-center justify-between gap-2 text-xs shadow-xl">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold bg-slate-800 text-slate-200 px-2.5 py-1 rounded-md text-xs border border-slate-700">
                    Document #{idx + 1}
                  </span>
                  <input
                    type="text"
                    value={att.title}
                    onChange={(e) => {
                      const updated = [...(data.attachments || [])];
                      updated[idx] = { ...updated[idx], title: e.target.value };
                      onChange({ ...data, attachments: updated });
                    }}
                    className="font-bold text-slate-900 bg-white border border-slate-300 rounded-md px-2.5 py-1 text-xs focus:ring-2 focus:ring-blue-500 w-48 sm:w-64"
                    placeholder="Attachment Title"
                  />
                  <select
                    value={att.type}
                    onChange={(e) => {
                      const updated = [...(data.attachments || [])];
                      updated[idx] = { ...updated[idx], type: e.target.value as any };
                      onChange({ ...data, attachments: updated });
                    }}
                    className="bg-white border border-slate-300 rounded-md px-2.5 py-1 text-xs text-slate-900 font-semibold cursor-pointer"
                  >
                    <option value="police_report">Police Report</option>
                    <option value="passport">Passport Copy (125 × 176 mm)</option>
                    <option value="applicant_photo">Applicant Photo (35 × 45 mm)</option>
                  </select>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                  {/* Move Up */}
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
                    className="p-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-white disabled:opacity-30 cursor-pointer border border-slate-700"
                    title="Move Up in Thread"
                  >
                    <ArrowUp className="w-4 h-4" />
                  </button>
                  {/* Move Down */}
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
                    className="p-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-white disabled:opacity-30 cursor-pointer border border-slate-700"
                    title="Move Down in Thread"
                  >
                    <ArrowDown className="w-4 h-4" />
                  </button>

                  {/* Extract Details & Signature */}
                  {onExtractFromAttachment && (
                    <button
                      type="button"
                      onClick={() => onExtractFromAttachment(att.url, att.title)}
                      className="px-3 py-1 rounded-md bg-amber-500 hover:bg-amber-600 text-white font-semibold text-xs flex items-center gap-1 shadow-sm cursor-pointer"
                      title="Run OCR to extract candidate details and signature from this document"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      Extract Details
                    </button>
                  )}

                  {/* Replace Image / PDF */}
                  <label className="px-3 py-1 rounded-md bg-blue-600 hover:bg-blue-700 text-white cursor-pointer flex items-center gap-1 text-xs font-semibold shadow-sm">
                    <RefreshCw className="w-3.5 h-3.5" />
                    Replace
                    <input
                      type="file"
                      accept="image/*,.pdf,application/pdf"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
                          if (isPdf) {
                            try {
                              const { convertPdfToImages } = await import("../utils/pdfUtils");
                              const pages = await convertPdfToImages(file);
                              if (pages.length > 0) {
                                const updated = [...(data.attachments || [])];
                                updated[idx] = { ...updated[idx], url: pages[0].dataUrl, fileName: file.name };
                                onChange({ ...data, attachments: updated });
                              }
                            } catch (err) {
                              console.error("PDF convert error on replace:", err);
                            }
                          } else {
                            const reader = new FileReader();
                            reader.onload = (evt) => {
                              if (evt.target?.result) {
                                const updated = [...(data.attachments || [])];
                                updated[idx] = { ...updated[idx], url: evt.target.result as string, fileName: file.name };
                                onChange({ ...data, attachments: updated });
                              }
                            };
                            reader.readAsDataURL(file);
                          }
                        }
                      }}
                    />
                  </label>

                  {/* Delete */}
                  <button
                    type="button"
                    onClick={() => {
                      const updated = (data.attachments || []).filter((_, i) => i !== idx);
                      onChange({ ...data, attachments: updated });
                    }}
                    className="p-1.5 rounded-md bg-red-500 hover:bg-red-600 text-white cursor-pointer border border-red-600 shadow-sm"
                    title="Remove Attachment"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Printable Document Paper Card */}
            <div
              id={`cv-attachment-${idx}`}
              data-attachment-id={att.id}
              style={
                isPassport
                  ? { width: "125mm", height: "176mm", maxWidth: "125mm", maxHeight: "176mm" }
                  : isPhoto
                  ? { width: "35mm", height: "45mm", maxWidth: "35mm", maxHeight: "45mm" }
                  : { width: "210mm", minHeight: "297mm" }
              }
              className={`cv-page shadow-xl bg-white p-0 relative page-break-after-always flex items-center justify-center border-0 rounded-none transition-all overflow-hidden m-0 ${
                isPassport
                  ? "w-[125mm] h-[176mm] max-w-[125mm] max-h-[176mm]"
                  : isPhoto
                  ? "w-[35mm] h-[45mm] max-w-[35mm] max-h-[45mm]"
                  : "w-[210mm] min-h-[297mm]"
              }`}
            >
              {/* Attached Document Content - FIT WHITE BACKGROUND TO ATTACHED DOCUMENT SIZES, NO OUTLINE, NO EXTRA DETAILS */}
              <div className="w-full h-full flex items-center justify-center bg-white p-0 relative overflow-hidden m-0 border-0">
                {att.url ? (
                  isPhoto ? (
                    <img
                      src={att.url}
                      alt={att.title || "Applicant Photo"}
                      style={{ width: "35mm", height: "45mm", objectFit: "contain" }}
                      className="w-[35mm] h-[45mm] block object-contain border-0 p-0 m-0 bg-white"
                    />
                  ) : isPassport ? (
                    <img
                      src={att.url}
                      alt={att.title || "Passport Copy"}
                      style={{ width: "125mm", height: "176mm", objectFit: "contain" }}
                      className="w-[125mm] h-[176mm] block object-contain border-0 p-0 m-0 bg-white"
                    />
                  ) : att.url.startsWith("data:application/pdf") || (att.url.toLowerCase().includes(".pdf") && !att.url.startsWith("data:image/")) ? (
                    <embed
                      src={att.url}
                      type="application/pdf"
                      className="w-full h-[280mm] block border-0 p-0 m-0"
                    />
                  ) : (
                    <img
                      src={att.url}
                      alt={att.title || "Police Clearance Report"}
                      className="w-full h-auto max-w-full block object-contain border-0 p-0 m-0 bg-white"
                    />
                  )
                ) : (
                  <div className="text-center text-slate-400 p-8">
                    <FileText className="w-10 h-10 mx-auto mb-2 opacity-40" />
                    <p className="text-xs font-medium">No Image Loaded</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
