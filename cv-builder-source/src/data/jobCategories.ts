export interface JobCategory {
  name: string;
  positions: string[];
  companies: string[];
}

export const JOB_CATEGORIES: JobCategory[] = [
  {
    name: "Hardware",
    positions: ["GOODS HANDLER"],
    companies: [
      "JAT Holdings PLC",
      "Hunter & Company PLC",
      "St. Anthony’s Industries Group",
      "Royal Ceramics Lanka PLC (Rocell)",
      "Lanka Tiles PLC",
      "Tokyo Cement Group",
      "Brown & Company PLC",
      "Sierra Cables PLC",
    ],
  },
  {
    name: "Vehicle Parts & Automotive",
    positions: [
      "BIKE RIDER",
      "HEAVY VEHICLE DRIVER",
      "DRIVER",
    ],
    companies: [
      "Diesel & Motor Engineering PLC (DIMO)",
      "Associated Motorways (AMW)",
      "United Motors Lanka PLC",
      "David Pieris Motor Company (DPMC)",
      "Sathosa Motors PLC",
      "Ideal Motors",
      "Colonial Motors PLC",
      "Micro Cars Limited",
    ],
  },
  {
    name: "Garments & Apparel",
    positions: [
      "JUKI MACHINE OPERATOR",
      "TAILOR",
    ],
    companies: [
      "MAS Holdings",
      "Brandix Lanka Limited",
      "Hirdaramani Group",
      "Hela Apparel Holdings",
      "Star Garments Group",
      "Jay Jay Mills Lanka",
      "Timex & Fergasam Group",
      "Orit Apparels Lanka",
    ],
  },
  {
    name: "Construction",
    positions: [
      "CONSTRUCTION HELPER",
      "CONSTRUCTION WORKER",
      "FACTORY HELPER",
      "MACHINE OPERATOR",
      "WELDER",
      "ELECTRICIAN",
      "PLUMBER",
      "MASON",
    ],
    companies: [
      "Access Engineering PLC",
      "Maga Engineering (Pvt) Ltd",
      "International Construction Consortium (ICC)",
      "Sanken Construction (Pvt) Ltd",
      "Tudawe Brothers",
      "Sierra Construction",
      "Nawaloka Construction Company",
      "ELS Construction (Pvt) Ltd",
    ],
  },
  {
    name: "Hotels & Resorts",
    positions: [
      "KITCHEN HELPER",
      "BAKER",
      "CHEF",
      "WAITER",
      "WAITER HELPER",
      "CLEANER",
      "WELDER",
      "ELECTRICIAN",
      "PLUMBER",
    ],
    companies: [
      "Cinnamon Hotels & Resorts",
      "Jetwing Hotels",
      "Heritance Hotels & Resorts",
      "Amaya Resorts & Spas",
      "Resplendent Ceylon",
      "Mount Lavinia Hotel",
      "The Kingsbury Colombo",
      "Galadari Hotel Colombo",
      "Shangri-La Hotel Colombo",
    ],
  },
  {
    name: "Restaurants & Food Chains",
    positions: [
      "KITCHEN HELPER",
      "BAKER",
      "CHEF",
      "WAITER",
    ],
    companies: [
      "Perera & Sons",
      "Ministry of Crab",
      "Upali’s by Nawaloka",
      "The Fab",
      "Green Cabin",
      "Palmyrah Restaurant",
      "Raja Bojun",
      "Shanmugas Restaurant",
      "The Cricket Club Café",
    ],
  },
];

// Flat list of all unique positions across categories
export const ALL_JOB_POSITIONS: string[] = Array.from(
  new Set(JOB_CATEGORIES.flatMap((c) => c.positions))
);

// Get companies associated with a specific position
export function getCompaniesForPosition(position?: string): string[] {
  if (!position) return getAllCompanies();
  const posUpper = position.trim().toUpperCase();
  const foundCat = JOB_CATEGORIES.find((c) =>
    c.positions.some((p) => p.toUpperCase() === posUpper)
  );
  if (foundCat && foundCat.companies.length > 0) {
    return foundCat.companies;
  }
  return getAllCompanies();
}

// Get a random company name for a given position
export function getRandomCompanyForPosition(position?: string): string {
  const comps = getCompaniesForPosition(position);
  if (!comps || comps.length === 0) return "PRIVATE COMPANY";
  const randomIndex = Math.floor(Math.random() * comps.length);
  return comps[randomIndex];
}

// Get a random period duration between 2 and 5 years (e.g., "02 YEARS" to "05 YEARS")
export function getRandomPeriod(): string {
  const years = Math.floor(Math.random() * 4) + 2; // 2, 3, 4, 5
  return `0${years} YEARS`;
}

// Flat list of all unique companies
export function getAllCompanies(): string[] {
  const all: string[] = [];
  JOB_CATEGORIES.forEach((cat) => {
    cat.companies.forEach((comp) => {
      if (!all.includes(comp)) {
        all.push(comp);
      }
    });
  });
  return all;
}
