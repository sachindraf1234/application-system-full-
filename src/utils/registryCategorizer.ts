import { ApplicantOverview, WorkExperience } from '../types';

export interface FormattedExperience {
  company: string;
  job_category: string;
  year: string;
}

export interface CandidateWithExperiences {
  applicant: ApplicantOverview;
  experiences: FormattedExperience[];
}

export const MAJOR_MALE_CATEGORIES = [
  'Kitchen Helper',
  'Chef',
  'Factory Helper',
  'Welder',
  'Driver',
  'Construction Worker',
  'Hotel / Restaurant Staff',
  'Store Keeper / Cashier'
];

export const MAJOR_FEMALE_CATEGORIES = [
  'Housekeeping',
  'Cleaner',
  'Factory Helper',
  'Salon Worker',
  'Garment / Production Worker',
  'Receptionist / Office Staff',
  'Waiter / Restaurant Staff'
];

// Value / Demand priority order (higher index = lower priority, so lower index wins in tie-break)
const MALE_PRIORITY = [
  'Welder',
  'Chef',
  'Kitchen Helper',
  'Factory Helper',
  'Driver',
  'Construction Worker',
  'Store Keeper / Cashier',
  'Hotel / Restaurant Staff'
];

const FEMALE_PRIORITY = [
  'Housekeeping',
  'Cleaner',
  'Factory Helper',
  'Salon Worker',
  'Garment / Production Worker',
  'Receptionist / Office Staff',
  'Waiter / Restaurant Staff'
];

/**
 * Extracts all formatted experience rows for an applicant.
 */
export function getApplicantExperiences(app: ApplicantOverview): FormattedExperience[] {
  if (app.experiences && app.experiences.length > 0) {
    return app.experiences.map((e: WorkExperience) => ({
      company: e.company_place || 'Not Specified',
      job_category: e.position || app.preferred_job_category || 'General',
      year: e.duration || '01 Year'
    }));
  }

  // Fallback if app.experiences is empty: construct experience from summary/profile
  const defaultCompany = app.company_name && app.company_name !== 'None' ? app.company_name : 'Not Specified';
  const defaultCategory = app.preferred_job_category || 'Factory Helper';
  const defaultYear = app.experienced === 'Yes' ? '02 Years' : 'Not Specified';

  return [{
    company: defaultCompany,
    job_category: defaultCategory,
    year: defaultYear
  }];
}

/**
 * Maps a single experience text or applicant position to one of the selected categories.
 */
function matchCategoryForString(text: string, selectedCats: string[]): string | null {
  const t = text.toLowerCase();

  for (const cat of selectedCats) {
    const cLower = cat.toLowerCase();
    if (t.includes(cLower) || cLower.includes(t)) {
      return cat;
    }

    // Specific domain keywords
    if (cLower === 'kitchen helper') {
      if (t.includes('kitchen') || t.includes('steward') || t.includes('bartender') || t.includes('bar helper') || t.includes('room boy') || t.includes('pastry') || t.includes('baker') || t.includes('waiter')) {
        return cat;
      }
    }
    if (cLower === 'chef') {
      if (t.includes('chef') || t.includes('cook') || t.includes('head chef')) {
        return cat;
      }
    }
    if (cLower === 'welder') {
      if (t.includes('weld') || t.includes('gas cutter') || t.includes('fabricator')) {
        return cat;
      }
    }
    if (cLower === 'housekeeping') {
      if (t.includes('housekeeping') || t.includes('housekeeper') || t.includes('room attendant')) {
        return cat;
      }
    }
    if (cLower === 'cleaner') {
      if (t.includes('cleaner') || t.includes('cleaning') || t.includes('janitor') || t.includes('bus attendant')) {
        return cat;
      }
    }
    if (cLower === 'factory helper') {
      if (t.includes('factory') || t.includes('production') || t.includes('garment') || t.includes('packing') || t.includes('machine operator') || t.includes('forklift') || t.includes('driver') || t.includes('farmer') || t.includes('helper')) {
        return cat;
      }
    }
  }

  return null;
}

/**
 * Main function: Categorize applicants into chosen categories based on experience & priority.
 * Fallback to 'Factory Helper' if no match.
 */
export function categorizeApplicantsByExperience(
  applicants: ApplicantOverview[],
  selectedCategories: string[],
  gender: 'Male' | 'Female'
): Record<string, CandidateWithExperiences[]> {
  // Ensure Factory Helper exists in categories as statutory fallback
  const activeCategories = Array.from(new Set(selectedCategories));
  if (!activeCategories.includes('Factory Helper')) {
    activeCategories.push('Factory Helper');
  }

  const priorityOrder = gender === 'Male' ? MALE_PRIORITY : FEMALE_PRIORITY;

  // Initialize result map
  const result: Record<string, CandidateWithExperiences[]> = {};
  activeCategories.forEach((cat) => {
    result[cat] = [];
  });

  applicants.forEach((app) => {
    const exps = getApplicantExperiences(app);
    const matchedCategoriesSet = new Set<string>();

    // 1. Check direct preferred_job_category match
    if (app.preferred_job_category) {
      const directMatch = matchCategoryForString(app.preferred_job_category, activeCategories);
      if (directMatch) matchedCategoriesSet.add(directMatch);
    }

    // 2. Check each work experience entry match
    exps.forEach((e) => {
      const match = matchCategoryForString(e.job_category, activeCategories);
      if (match) matchedCategoriesSet.add(match);
    });

    // 3. Resolve category selection
    let assignedCategory = 'Factory Helper'; // Fallback

    const matches = Array.from(matchedCategoriesSet);
    if (matches.length === 1) {
      assignedCategory = matches[0];
    } else if (matches.length > 1) {
      // Tie-breaking: Choose the category with highest demand/value priority
      matches.sort((a, b) => {
        const idxA = priorityOrder.indexOf(a);
        const idxB = priorityOrder.indexOf(b);
        const rankA = idxA !== -1 ? idxA : 99;
        const rankB = idxB !== -1 ? idxB : 99;
        return rankA - rankB;
      });
      assignedCategory = matches[0];
    } else {
      // No match -> Fallback to Factory Helper
      assignedCategory = 'Factory Helper';
    }

    if (!result[assignedCategory]) {
      result[assignedCategory] = [];
    }

    result[assignedCategory].push({
      applicant: app,
      experiences: exps
    });
  });

  return result;
}
