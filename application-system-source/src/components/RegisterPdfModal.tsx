import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { ApplicantOverview, WorkExperience } from '../types';
import { Printer, Download, X, FileText, CheckSquare, Square, ChevronDown, Filter } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  gender: 'Male' | 'Female';
  applicants: ApplicantOverview[];
}

// Master Major Categories lists
const MALE_MAJOR_CATEGORIES = [
  'Kitchen Helper',
  'Chef',
  'Factory Helper',
  'Welder',
  'Mason',
  'Plumber',
  'Electrician',
  'Driver',
  'Heavy Vehicle Driver',
  'Painter',
  'Scaffolder',
  'Carpenter',
  'Auto Mechanic',
  'AC Technician',
  'Pipe Fitter',
  'Barman',
  'Waiter',
  'Security Guard',
  'Cleaner',
  'General Helper'
];

const FEMALE_MAJOR_CATEGORIES = [
  'Housekeeping',
  'Factory Helper',
  'Cleaner',
  'Nanny / Caregiver',
  'Cook / Chef',
  'Waitress',
  'Salon / Beautician',
  'Tailor / Sewing Machine Operator',
  'Laundry Attendant',
  'General Helper'
];

// Priority / Value Demand Ranking (highest demand first)
const MALE_PRIORITY = [
  'Chef',
  'Welder',
  'Kitchen Helper',
  'Mason',
  'Plumber',
  'Electrician',
  'Driver',
  'Heavy Vehicle Driver',
  'Painter',
  'Auto Mechanic',
  'AC Technician',
  'Pipe Fitter',
  'Barman',
  'Waiter',
  'Security Guard',
  'Cleaner',
  'Factory Helper',
  'General Helper'
];

const FEMALE_PRIORITY = [
  'Housekeeping',
  'Cook / Chef',
  'Nanny / Caregiver',
  'Waitress',
  'Salon / Beautician',
  'Tailor / Sewing Machine Operator',
  'Cleaner',
  'Laundry Attendant',
  'Factory Helper',
  'General Helper'
];

export const RegisterPdfModal: React.FC<Props> = ({
  isOpen,
  onClose,
  gender,
  applicants
}) => {
  if (!isOpen) return null;

  // Master categories for current gender
  const masterCategories = gender === 'Male' ? MALE_MAJOR_CATEGORIES : FEMALE_MAJOR_CATEGORIES;
  const defaultSelected = gender === 'Male'
    ? ['Kitchen Helper', 'Chef', 'Factory Helper', 'Welder']
    : ['Factory Helper', 'Housekeeping', 'Cleaner'];

  // State for user-selected major categories
  const [selectedCategories, setSelectedCategories] = useState<string[]>(defaultSelected);
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState<boolean>(false);

  // Toggle single category selection
  const handleToggleCategory = (cat: string) => {
    if (selectedCategories.includes(cat)) {
      if (selectedCategories.length === 1) return; // Keep at least one selected
      setSelectedCategories(selectedCategories.filter((c) => c !== cat));
    } else {
      setSelectedCategories([...selectedCategories, cat]);
    }
  };

  // Select All / Deselect All
  const handleSelectAllCategories = () => {
    setSelectedCategories([...masterCategories]);
  };

  const handleResetDefaultCategories = () => {
    setSelectedCategories(defaultSelected);
  };

  // Filter applicants by gender
  const genderApplicants = useMemo(() => {
    return applicants.filter((a) => a.gender === gender);
  }, [applicants, gender]);

  // Helper to get normalized candidate experience items
  const getApplicantExperiences = (app: ApplicantOverview): { company: string; job_category: string; year: string }[] => {
    if (app.experiences && app.experiences.length > 0) {
      return app.experiences.map((exp: WorkExperience) => ({
        company: exp.company_place || app.company_name || 'Not Specified',
        job_category: exp.position || app.preferred_job_category || 'General Helper',
        year: exp.duration || exp.from_date || app.year || '02 Years'
      }));
    }

    // Secondary fallback from experience_summary if multiple mentioned
    if (app.experience_summary && app.experience_summary.includes(',')) {
      const parts = app.experience_summary.split(',');
      return parts.map((part, i) => {
        const trimmed = part.trim();
        return {
          company: i === 0 ? (app.company_name || 'Not Specified') : 'Previous Employer',
          job_category: trimmed || app.preferred_job_category || 'General Helper',
          year: app.year || '02 Years'
        };
      });
    }

    // Default single experience record
    return [
      {
        company: app.company_name && app.company_name !== 'None' ? app.company_name : 'Not Specified',
        job_category: app.preferred_job_category || 'General Helper',
        year: app.experienced === 'Yes' ? '02 Years' : 'Fresh'
      }
    ];
  };

  // Assign applicant to ONE of the selected categories based on experience & value demand rank
  const assignApplicantToCategory = (app: ApplicantOverview): string => {
    const experiences = getApplicantExperiences(app);
    const expCategories = experiences.map((e) => e.job_category.toLowerCase());
    const preferredCat = (app.preferred_job_category || '').toLowerCase();

    // Check which selected categories match candidate experience or preferred job
    const matchingSelected = selectedCategories.filter((selCat) => {
      const selLower = selCat.toLowerCase();
      return (
        expCategories.some((eCat) => eCat.includes(selLower) || selLower.includes(eCat)) ||
        preferredCat.includes(selLower) ||
        selLower.includes(preferredCat)
      );
    });

    if (matchingSelected.length > 0) {
      // Pick the highest priority category among matching
      const priorityList = gender === 'Male' ? MALE_PRIORITY : FEMALE_PRIORITY;
      matchingSelected.sort((a, b) => {
        const idxA = priorityList.findIndex((p) => p.toLowerCase() === a.toLowerCase());
        const idxB = priorityList.findIndex((p) => p.toLowerCase() === b.toLowerCase());
        const rankA = idxA === -1 ? 99 : idxA;
        const rankB = idxB === -1 ? 99 : idxB;
        return rankA - rankB;
      });
      return matchingSelected[0];
    }

    // Fallback: If Factory Helper is selected, put in Factory Helper. Else first selected category.
    const factoryHelperMatch = selectedCategories.find((c) => c.toLowerCase().includes('factory helper'));
    return factoryHelperMatch || selectedCategories[0] || 'Factory Helper';
  };

  // Group applicants into selected categories
  const groupedApplicants = useMemo(() => {
    const groups: Record<string, ApplicantOverview[]> = {};
    selectedCategories.forEach((cat) => {
      groups[cat] = [];
    });

    genderApplicants.forEach((app) => {
      const targetCat = assignApplicantToCategory(app);
      if (!groups[targetCat]) {
        groups[targetCat] = [];
      }
      groups[targetCat].push(app);
    });

    // Sort categories according to priority order
    const priorityList = gender === 'Male' ? MALE_PRIORITY : FEMALE_PRIORITY;
    const sortedCats = Object.keys(groups).sort((a, b) => {
      const idxA = priorityList.findIndex((p) => p.toLowerCase() === a.toLowerCase());
      const idxB = priorityList.findIndex((p) => p.toLowerCase() === b.toLowerCase());
      const rankA = idxA === -1 ? 99 : idxA;
      const rankB = idxB === -1 ? 99 : idxB;
      return rankA - rankB;
    });

    return sortedCats.map((catName) => ({
      categoryName: catName,
      applicants: groups[catName]
    }));
  }, [genderApplicants, selectedCategories, gender]);

  const handlePrint = () => {
    window.print();
  };

  // Export exact multi-category formatted Excel sheet
  const handleExportModalExcel = () => {
    try {
      const excelRows: any[] = [];

      // Main Header
      excelRows.push({
        'TRANS ARABIAN RECRUITMENT AGENCY': `REGISTER ${gender.toUpperCase()} — CATEGORIZED ROSTER`
      });
      excelRows.push({}); // Empty row

      groupedApplicants.forEach((group, groupIdx) => {
        const countFormatted = String(group.applicants.length).padStart(2, '0');
        excelRows.push({
          'NO': `${groupIdx + 1}. ${group.categoryName.toUpperCase()} (${countFormatted} CANDIDATES)`
        });

        // Table Header
        excelRows.push({
          'NO': 'NO',
          'NAME': 'NAME',
          'PP NO': 'PP NO',
          'PREFERRED JOB CATEGORY': 'PREFERRED JOB CATEGORY',
          'ENGLISH LEVEL': 'ENGLISH LEVEL',
          'COMPANY': 'COMPANY (EXPERIENCE)',
          'JOB CATEGORY': 'JOB CATEGORY (EXPERIENCE)',
          'YEAR': 'YEAR',
          'REG DATE': 'REG DATE',
          'POLICE REPORT': 'POLICE REPORT',
          'REMARKS': 'REMARKS'
        });

        group.applicants.forEach((app, idx) => {
          const experiences = getApplicantExperiences(app);
          const isCouple = app.applied_as_couple === 'Yes' || app.closed_remarks?.includes('COUPLE');
          const policeOk = app.police_report_ready || app.police_report_status === 'OK';

          experiences.forEach((exp, expIdx) => {
            if (expIdx === 0) {
              excelRows.push({
                'NO': idx + 1,
                'NAME': app.full_name,
                'PP NO': app.passport_number || 'PENDING',
                'PREFERRED JOB CATEGORY': app.preferred_job_category || group.categoryName,
                'ENGLISH LEVEL': app.english_level ? `Level ${app.english_level} (${app.english_percentage || 0}%)` : 'Level B (65%)',
                'COMPANY': exp.company,
                'JOB CATEGORY': exp.job_category,
                'YEAR': exp.year,
                'REG DATE': app.registration_date ? app.registration_date.replace(/-/g, '.') : '2026.02.15',
                'POLICE REPORT': policeOk ? 'OK' : 'Pending',
                'REMARKS': isCouple ? 'COUPLE' : app.closed_remarks || ''
              });
            } else {
              excelRows.push({
                'NO': '',
                'NAME': '',
                'PP NO': '',
                'PREFERRED JOB CATEGORY': '',
                'ENGLISH LEVEL': '',
                'COMPANY': exp.company,
                'JOB CATEGORY': exp.job_category,
                'YEAR': exp.year,
                'REG DATE': '',
                'POLICE REPORT': '',
                'REMARKS': ''
              });
            }
          });
        });

        excelRows.push({}); // Space between groups
      });

      const ws = XLSX.utils.json_to_sheet(excelRows, { skipHeader: true });
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, `REGISTER_${gender.toUpperCase()}`);
      const filename = `TransArabian_Register_${gender}_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(wb, filename);
    } catch (err) {
      console.error('Excel Export Error:', err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-6xl w-full overflow-hidden flex flex-col my-auto max-h-[94vh]">
        {/* Modal Header & Control Bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between px-6 py-3.5 border-b border-slate-200 bg-slate-900 text-white print:hidden gap-3">
          <div className="flex items-center gap-2.5">
            <FileText className="w-5 h-5 text-emerald-400" />
            <div>
              <h3 className="text-sm font-bold tracking-tight">
                {gender === 'Male' ? 'REGISTER - MALE (MALE NEW.pdf)' : 'REGISTER - FEMALE (FEMALE NEW.pdf)'}
              </h3>
              <p className="text-[11px] text-slate-400">
                Official statutory categorized layout · Total {genderApplicants.length} candidates
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto justify-end">
            {/* Major Job Categories Dropdown Selector with Checkboxes */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsCategoryDropdownOpen(!isCategoryDropdownOpen)}
                className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold px-3 py-2 rounded-xl border border-slate-700 transition cursor-pointer"
              >
                <Filter className="w-3.5 h-3.5 text-emerald-400" />
                <span>Job Categories ({selectedCategories.length})</span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {isCategoryDropdownOpen && (
                <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-2xl border border-slate-200 p-3 z-50 text-slate-900 max-h-80 overflow-y-auto">
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 text-xs font-bold">
                    <span className="text-slate-700">Choose Major Categories</span>
                    <div className="flex items-center gap-2 text-[10px]">
                      <button
                        type="button"
                        onClick={handleSelectAllCategories}
                        className="text-emerald-700 hover:underline cursor-pointer"
                      >
                        All
                      </button>
                      <button
                        type="button"
                        onClick={handleResetDefaultCategories}
                        className="text-slate-500 hover:underline cursor-pointer"
                      >
                        Reset
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    {masterCategories.map((cat) => {
                      const isSelected = selectedCategories.includes(cat);
                      return (
                        <label
                          key={cat}
                          onClick={() => handleToggleCategory(cat)}
                          className={`flex items-center justify-between p-1.5 rounded-lg text-xs cursor-pointer transition select-none ${
                            isSelected ? 'bg-emerald-50 text-emerald-950 font-bold' : 'hover:bg-slate-100 text-slate-700'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-emerald-600 shrink-0" />
                            ) : (
                              <Square className="w-4 h-4 text-slate-300 shrink-0" />
                            )}
                            <span>{cat}</span>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={handleExportModalExcel}
              className="flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs px-3.5 py-2 rounded-xl transition cursor-pointer shadow-xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Excel (.xlsx)</span>
            </button>

            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-3.5 py-2 rounded-xl transition cursor-pointer shadow-xs"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print / Download PDF</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable Canvas */}
        <div className="p-6 overflow-y-auto bg-slate-100/60 print:bg-white print:p-0">
          <div className="max-w-[210mm] mx-auto bg-white p-8 rounded-lg shadow-sm border border-slate-200 print:border-none print:shadow-none print:p-0 space-y-6">
            {/* Header */}
            <div className="text-center pb-3 border-b-2 border-black">
              <h1 className="text-base font-black tracking-wider uppercase text-black font-sans">
                TRANS ARABIAN RECRUITMENT AGENCY — REGISTER {gender.toUpperCase()}
              </h1>
              <p className="text-[10px] text-black tracking-wide font-mono mt-0.5">
                SLBFE REGISTERED LICENSE NO: 2601 · CATEGORIZED CANDIDATE ROSTER
              </p>
            </div>

            {/* Category Groups */}
            {groupedApplicants.map((group, groupIdx) => {
              const countFormatted = String(group.applicants.length).padStart(2, '0');

              return (
                <div key={group.categoryName} className="space-y-1 page-break-inside-avoid">
                  {/* Category Header */}
                  <div className="bg-slate-100 border border-black px-3 py-1 text-center font-bold text-xs text-black tracking-wide uppercase">
                    {groupIdx + 1}. {group.categoryName} ({countFormatted} Candidates)
                  </div>

                  {/* Category Table */}
                  <table className="w-full text-[10px] text-left border-collapse border border-black font-sans">
                    <thead className="bg-white font-bold uppercase text-[9px] border-b border-black">
                      {/* Header Row 1 */}
                      <tr className="border-b border-black">
                        <th rowSpan={2} className="border border-black p-1 text-center w-7">NO</th>
                        <th rowSpan={2} className="border border-black p-1 min-w-[120px]">NAME</th>
                        <th rowSpan={2} className="border border-black p-1 font-mono min-w-[80px]">PP NO</th>
                        <th rowSpan={2} className="border border-black p-1 min-w-[110px]">PREFERRED JOB CATEGORY</th>
                        <th colSpan={3} className="border border-black p-1 text-center bg-slate-50">EXPERIENCE</th>
                        <th rowSpan={2} className="border border-black p-1 text-center whitespace-nowrap">REG DATE</th>
                        <th rowSpan={2} className="border border-black p-1 text-center whitespace-nowrap">POLICE REPORT</th>
                        <th rowSpan={2} className="border border-black p-1 min-w-[90px]">REMARKS</th>
                      </tr>
                      {/* Header Row 2 (Sub-columns under EXPERIENCE) */}
                      <tr className="border-b border-black bg-slate-50">
                        <th className="border border-black p-1">COMPANY</th>
                        <th className="border border-black p-1">JOB CATEGORY</th>
                        <th className="border border-black p-1 text-center w-16">YEAR</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black">
                      {group.applicants.length === 0 ? (
                        <tr>
                          <td colSpan={10} className="border border-black p-3 text-center text-slate-500 italic">
                            No candidates currently allocated to {group.categoryName}.
                          </td>
                        </tr>
                      ) : (
                        group.applicants.map((app, idx) => {
                          const experiences = getApplicantExperiences(app);
                          const expCount = experiences.length;
                          const isCouple = app.applied_as_couple === 'Yes' || app.closed_remarks?.includes('COUPLE');
                          const policeOk = app.police_report_ready || app.police_report_status === 'OK';

                          return experiences.map((exp, expIdx) => {
                            const isFirst = expIdx === 0;

                            return (
                              <tr key={`${app.applicant_id}-${expIdx}`} className="border-b border-black">
                                {isFirst && (
                                  <>
                                    <td rowSpan={expCount} className="border border-black p-1 text-center font-mono font-bold align-top">
                                      {idx + 1}
                                    </td>
                                    <td rowSpan={expCount} className="border border-black p-1 font-bold text-black uppercase align-top">
                                      <div>{app.full_name}</div>
                                      <div className="text-[8px] font-mono font-semibold text-slate-700 normal-case tracking-normal">
                                        English: Level {app.english_level || 'B'} ({app.english_percentage || (app.english_level === 'A' ? 80 : app.english_level === 'B' ? 65 : 45)}%)
                                      </div>
                                    </td>
                                    <td rowSpan={expCount} className="border border-black p-1 font-mono font-semibold align-top whitespace-nowrap">
                                      {app.passport_number || 'PENDING'}
                                    </td>
                                    <td rowSpan={expCount} className="border border-black p-1 text-black uppercase align-top">
                                      {app.preferred_job_category || group.categoryName}
                                    </td>
                                  </>
                                )}

                                {/* Sub-columns under EXPERIENCE */}
                                <td className="border border-black p-1 text-black font-medium">
                                  {exp.company}
                                </td>
                                <td className="border border-black p-1 text-black font-medium">
                                  {exp.job_category}
                                </td>
                                <td className="border border-black p-1 text-center font-mono font-medium whitespace-nowrap">
                                  {exp.year}
                                </td>

                                {isFirst && (
                                  <>
                                    <td rowSpan={expCount} className="border border-black p-1 font-mono text-center whitespace-nowrap align-top">
                                      {app.registration_date ? app.registration_date.replace(/-/g, '.') : '2026.02.15'}
                                    </td>
                                    <td rowSpan={expCount} className="border border-black p-1 text-center font-bold align-top">
                                      {policeOk ? 'OK' : ''}
                                    </td>
                                    <td rowSpan={expCount} className="border border-black p-1 font-bold align-top">
                                      {isCouple ? 'COUPLE' : app.closed_remarks || ''}
                                    </td>
                                  </>
                                )}
                              </tr>
                            );
                          });
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              );
            })}

            {/* Document Footer */}
            <div className="pt-4 border-t border-black text-[9px] text-black flex justify-between font-mono">
              <span>Trans Arabian Foreign Employment Agency</span>
              <span>Generated on: {new Date().toLocaleDateString()}</span>
              <span>Total Roster Count: {genderApplicants.length}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
