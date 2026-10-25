export interface SchoolDistrict {
  district: string;
  province: string;
  schools: string[];
}

export function sanitizeSchoolName(name: string): string {
  if (!name) return "";
  let clean = name.trim();
  // Remove duplicated adjacent word/phrase repetitions like "Colombo Colombo" or "Colombo, Colombo" or "Gampaha Gampaha"
  clean = clean.replace(/\b([A-Za-z]+)(?:[,\s]+\1)+\b/gi, "$1");
  clean = clean.replace(/([A-Za-z]+),\s*\1/gi, "$1");
  
  // Split by comma and remove any duplicate comma parts (case-insensitive)
  const parts = clean.split(/[,]+/);
  if (parts.length > 1) {
    const trimmedParts = parts.map(p => p.trim()).filter(Boolean);
    const seen = new Set<string>();
    const uniqueParts: string[] = [];
    for (const p of trimmedParts) {
      const lower = p.toLowerCase();
      if (!seen.has(lower)) {
        seen.add(lower);
        uniqueParts.push(p);
      }
    }
    clean = uniqueParts.join(", ");
  }

  // Also remove duplicate adjacent words in school names
  const words = clean.split(/\s+/);
  const dedupedWords: string[] = [];
  for (let i = 0; i < words.length; i++) {
    if (i === 0 || words[i].toLowerCase() !== words[i - 1].toLowerCase()) {
      dedupedWords.push(words[i]);
    }
  }
  clean = dedupedWords.join(" ");

  return clean.trim();
}

export const SRI_LANKA_SCHOOLS: SchoolDistrict[] = [
  {
    district: "Colombo",
    province: "Western",
    schools: [
      "Colombo South Central College 1",
      "Colombo South Boys' College 3",
      "Colombo South National School 4",
      "Colombo South Balika Vidyalaya 6",
      "Colombo South Central College 8",
      "Colombo South Boys' College 10",
      "Colombo South National School 11",
      "Colombo South Central College 15",
      "Colombo South Boys' College 17",
      "Colombo South National School 18",
      "Colombo North Boys' College 1",
      "Colombo North National School 2",
      "Colombo North Maha Vidyalaya 3",
      "Colombo North Balika Vidyalaya 4",
      "Colombo North Central College 6",
      "Colombo North Boys' College 8",
      "Colombo North National School 9",
      "Colombo Central College 4",
      "Colombo Central Boys' College 6",
      "Colombo Central National School 7",
      "Sri Jayawardenepura Central College 2",
      "Sri Jayawardenepura Boys' College 4",
      "Sri Jayawardenepura National School 5",
      "Homagama Boys' College 2",
      "Homagama National School 3",
      "Homagama Central College 7"
    ]
  },
  {
    district: "Gampaha",
    province: "Western",
    schools: [
      "Gampaha National School 1",
      "Gampaha Maha Vidyalaya 2",
      "Gampaha Central College 5",
      "Gampaha Boys' College 7",
      "Gampaha National School 8",
      "Minuwangoda Central College 3",
      "Minuwangoda Boys' College 5",
      "Minuwangoda National School 6",
      "Negombo Central College 1",
      "Negombo Boys' College 3",
      "Negombo National School 4",
      "Kelaniya Boys' College 1",
      "Kelaniya National School 2",
      "Kelaniya Central College 6",
      "Attanagalla Central College 4",
      "Attanagalla Boys' College 6",
      "Attanagalla National School 7"
    ]
  },
  {
    district: "Kalutara",
    province: "Western",
    schools: [
      "Kalutara Central College 2",
      "Kalutara Boys' College 4",
      "Kalutara National School 5",
      "Kalutara Central College 9",
      "Matugama Boys' College 2",
      "Matugama National School 3",
      "Matugama Central College 7",
      "Horana National School 1",
      "Horana Central College 5",
      "Horana Boys' College 7"
    ]
  },
  {
    district: "Kandy",
    province: "Central",
    schools: [
      "Kandy Central College 3",
      "Kandy Boys' College 5",
      "Kandy National School 6",
      "Kandy Central College 10",
      "Denuwara Central College 1",
      "Denuwara Boys' College 3",
      "Denuwara National School 4",
      "Gampola Boys' College 1",
      "Gampola National School 2",
      "Gampola Central College 6",
      "Teldeniya Central College 4",
      "Teldeniya Boys' College 6",
      "Teldeniya National School 7",
      "Wattegama Central College 2",
      "Wattegama Boys' College 4",
      "Wattegama National School 5"
    ]
  },
  {
    district: "Matale",
    province: "Central",
    schools: [
      "Matale Boys' College 2",
      "Matale National School 3",
      "Matale Central College 7",
      "Galevela National School 1",
      "Galevela Central College 5",
      "Galevela Boys' College 7",
      "Naula Central College 3",
      "Naula Boys' College 5",
      "Naula National School 6",
      "Wilgamuwa Central College 1",
      "Wilgamuwa Boys' College 3",
      "Wilgamuwa National School 4"
    ]
  },
  {
    district: "Nuwara Eliya",
    province: "Central",
    schools: [
      "Nuwara Eliya Boys' College 1",
      "Nuwara Eliya National School 2",
      "Nuwara Eliya Central College 6",
      "Kotmale Central College 4",
      "Kotmale Boys' College 6",
      "Kotmale National School 7",
      "Hatton Central College 2",
      "Hatton Boys' College 4",
      "Hatton National School 5",
      "Walapane Boys' College 2",
      "Walapane National School 3",
      "Walapane Central College 7"
    ]
  },
  {
    district: "Galle",
    province: "Southern",
    schools: [
      "Galle National School 1",
      "Galle Central College 5",
      "Galle Boys' College 7",
      "Galle National School 8",
      "Elpitiya Central College 3",
      "Elpitiya Boys' College 5",
      "Elpitiya National School 6",
      "Ambalangoda Central College 1",
      "Ambalangoda Boys' College 3",
      "Ambalangoda National School 4",
      "Udugama Boys' College 1",
      "Udugama National School 2",
      "Udugama Central College 6"
    ]
  },
  {
    district: "Matara",
    province: "Southern",
    schools: [
      "Matara Central College 4",
      "Matara Boys' College 6",
      "Matara National School 7",
      "Akuressa Central College 2",
      "Akuressa Boys' College 4",
      "Akuressa National School 5",
      "Mulatiyana Central College 7",
      "Mulatiyana Boys' College 9",
      "Mulatiyana National School 10",
      "Morawaka National School 1",
      "Morawaka Central College 5",
      "Morawaka Boys' College 7"
    ]
  },
  {
    district: "Hambantota",
    province: "Southern",
    schools: [
      "Hambantota Central College 3",
      "Hambantota Boys' College 5",
      "Hambantota National School 6",
      "Tangalle Central College 1",
      "Tangalle Boys' College 3",
      "Tangalle National School 4",
      "Walasmulla Boys' College 1",
      "Walasmulla National School 2",
      "Walasmulla Central College 6"
    ]
  },
  {
    district: "Jaffna",
    province: "Northern",
    schools: [
      "Jaffna Central College 4",
      "Jaffna Boys' College 6",
      "Jaffna National School 7",
      "Thenmaradchy Central College 2",
      "Thenmaradchy Boys' College 4",
      "Thenmaradchy National School 5",
      "Vadamaradchy National School 3",
      "Vadamaradchy Central College 7",
      "Vadamaradchy Boys' College 9",
      "Valikamam National School 1",
      "Valikamam Central College 5",
      "Valikamam Boys' College 7",
      "Islands Central College 3",
      "Islands Boys' College 5",
      "Islands National School 6"
    ]
  },
  {
    district: "Kilinochchi",
    province: "Northern",
    schools: [
      "Kilinochchi Central College 1",
      "Kilinochchi Boys' College 3",
      "Kilinochchi National School 4",
      "Kilinochchi Central College 8"
    ]
  },
  {
    district: "Mannar",
    province: "Northern",
    schools: [
      "Mannar Boys' College 1",
      "Mannar National School 2",
      "Mannar Central College 6",
      "Madhu Central College 4",
      "Madhu Boys' College 6",
      "Madhu National School 7"
    ]
  },
  {
    district: "Vavuniya",
    province: "Northern",
    schools: [
      "Vavuniya South Central College 2",
      "Vavuniya South Boys' College 4",
      "Vavuniya South National School 5",
      "Vavuniya North Central College 7",
      "Vavuniya North Boys' College 9",
      "Vavuniya North National School 10"
    ]
  },
  {
    district: "Mullaitivu",
    province: "Northern",
    schools: [
      "Mullaitivu National School 1",
      "Mullaitivu Central College 5",
      "Mullaitivu Boys' College 7",
      "Tunukkai Central College 3",
      "Tunukkai Boys' College 5",
      "Tunukkai National School 6"
    ]
  },
  {
    district: "Trincomalee",
    province: "Eastern",
    schools: [
      "Trincomalee Central College 1",
      "Trincomalee Boys' College 3",
      "Trincomalee National School 4",
      "Mutur National School 2",
      "Mutur Central College 6",
      "Mutur Boys' College 8",
      "Kinniya Central College 4",
      "Kinniya Boys' College 6",
      "Kinniya National School 7"
    ]
  },
  {
    district: "Ampara",
    province: "Eastern",
    schools: [
      "Ampara Central College 3",
      "Ampara Boys' College 5",
      "Ampara National School 6",
      "Kalmunai Central College 1",
      "Kalmunai Boys' College 3",
      "Kalmunai National School 4",
      "Samanthurai Boys' College 1",
      "Samanthurai National School 2",
      "Samanthurai Central College 6",
      "Mahaoya Central College 4",
      "Mahaoya Boys' College 6",
      "Mahaoya National School 7"
    ]
  },
  {
    district: "Batticaloa",
    province: "Eastern",
    schools: [
      "Batticaloa Central College 2",
      "Batticaloa Boys' College 4",
      "Batticaloa National School 5",
      "Kalkudah National School 3",
      "Kalkudah Central College 7",
      "Kalkudah Boys' College 9",
      "Paddipalai National School 1",
      "Paddipalai Central College 5",
      "Paddipalai Boys' College 7"
    ]
  },
  {
    district: "Kurunegala",
    province: "North Western",
    schools: [
      "Kurunegala Central College 2",
      "Kurunegala Boys' College 4",
      "Kurunegala National School 5",
      "Kuliyapitiya Boys' College 2",
      "Kuliyapitiya National School 3",
      "Kuliyapitiya Central College 7",
      "Ibbagamuwa National School 1",
      "Ibbagamuwa Central College 5",
      "Ibbagamuwa Boys' College 7",
      "Maho Central College 3",
      "Maho Boys' College 5",
      "Maho National School 6",
      "Giriulla Central College 1",
      "Giriulla Boys' College 3",
      "Giriulla National School 4"
    ]
  },
  {
    district: "Puttalam",
    province: "North Western",
    schools: [
      "Kirimatiyana National School 1",
      "Lunuwila Central College 1",
      "Lunuwila National School 2",
      "Wennappuwa National School 1",
      "Wennappuwa Central College 2",
      "Dankotuwa Central College 1",
      "Marawila Central College 2",
      "Nattandiya Dhammissara National School 1",
      "Chilaw Central College 4",
      "Chilaw National School 7",
      "Mahawewa Central College 1",
      "Katuneriya St. Sebastian's College 1",
      "Puttalam Boys' College 1",
      "Puttalam National School 2",
      "Puttalam Central College 6",
      "Anamaduwa Central College 1",
      "Kalpitiya Central College 1"
    ]
  },
  {
    district: "Anuradhapura",
    province: "North Central",
    schools: [
      "Anuradhapura Central College 2",
      "Anuradhapura Boys' College 4",
      "Anuradhapura National School 5",
      "Galenbindunuwewa Boys' College 2",
      "Galenbindunuwewa National School 3",
      "Galenbindunuwewa Central College 7",
      "Kekirawa National School 1",
      "Kekirawa Central College 5",
      "Kekirawa Boys' College 7",
      "Kebithigollewa Central College 3",
      "Kebithigollewa Boys' College 5",
      "Kebithigollewa National School 6"
    ]
  },
  {
    district: "Polonnaruwa",
    province: "North Central",
    schools: [
      "Polonnaruwa Central College 1",
      "Polonnaruwa Boys' College 3",
      "Polonnaruwa National School 4",
      "Dimbulagala National School 2",
      "Dimbulagala Central College 6",
      "Dimbulagala Boys' College 8",
      "Thamankaduwa Central College 4",
      "Thamankaduwa Boys' College 6",
      "Thamankaduwa National School 7"
    ]
  },
  {
    district: "Badulla",
    province: "Uva",
    schools: [
      "Badulla Central College 2",
      "Badulla Boys' College 4",
      "Badulla National School 5",
      "Bandarawela Boys' College 2",
      "Bandarawela National School 3",
      "Bandarawela Central College 7",
      "Mahiyanganaya National School 1",
      "Mahiyanganaya Central College 5",
      "Mahiyanganaya Boys' College 7",
      "Welimada Central College 3",
      "Welimada Boys' College 5",
      "Welimada National School 6"
    ]
  },
  {
    district: "Moneragala",
    province: "Uva",
    schools: [
      "Moneragala Central College 1",
      "Moneragala Boys' College 3",
      "Moneragala National School 4",
      "Wellawaya National School 2",
      "Wellawaya Central College 6",
      "Wellawaya Boys' College 8",
      "Bibile Central College 4",
      "Bibile Boys' College 6",
      "Bibile National School 7"
    ]
  },
  {
    district: "Ratnapura",
    province: "Sabaragamuwa",
    schools: [
      "Ratnapura Central College 2",
      "Ratnapura Boys' College 4",
      "Ratnapura National School 5",
      "Balangoda Boys' College 2",
      "Balangoda National School 3",
      "Balangoda Central College 7",
      "Embilipitiya Central College 5",
      "Embilipitiya Boys' College 7",
      "Embilipitiya National School 8",
      "Nivitigala National School 6",
      "Nivitigala Central College 10"
    ]
  },
  {
    district: "Kegalle",
    province: "Sabaragamuwa",
    schools: [
      "Kegalle Central College 1",
      "Kegalle Boys' College 3",
      "Kegalle National School 4",
      "Mawanella National School 2",
      "Mawanella Central College 6",
      "Mawanella Boys' College 8",
      "Dehiowita Central College 4",
      "Dehiowita Boys' College 6",
      "Dehiowita National School 7"
    ]
  }
];

export function getSchoolsForDistrict(district: string): string[] {
  const distLower = district.trim().toLowerCase();
  const match = SRI_LANKA_SCHOOLS.find(
    (d) => d.district.toLowerCase() === distLower
  );
  return match ? match.schools.map(sanitizeSchoolName) : [];
}

export function getAllDistricts(): { district: string; province: string }[] {
  return SRI_LANKA_SCHOOLS.map((d) => ({
    district: d.district,
    province: d.province
  }));
}

export function findDistrictFromAddress(address: string): string | null {
  if (!address) return null;
  const addrUpper = address.toUpperCase();
  for (const item of SRI_LANKA_SCHOOLS) {
    const distUpper = item.district.toUpperCase();
    if (addrUpper.includes(distUpper)) {
      return item.district;
    }
  }
  // Try matching province
  for (const item of SRI_LANKA_SCHOOLS) {
    const provUpper = item.province.toUpperCase();
    if (addrUpper.includes(provUpper)) {
      return item.district;
    }
  }
  return null;
}

export function autoSelectSchoolForAddress(address: string): string {
  if (!address) return sanitizeSchoolName(SRI_LANKA_SCHOOLS[0].schools[0]);
  const addrLower = address.toLowerCase();

  const keywordMappings: { keywords: string[]; school: string }[] = [
    // Puttalam / North Western Specific Regional Schools
    { keywords: ["kirimatiyana", "kirimetiyana"], school: "Kirimatiyana National School 1" },
    { keywords: ["lunuwila", "luniwila"], school: "Lunuwila Central College 1" },
    { keywords: ["wennappuwa"], school: "Wennappuwa National School 1" },
    { keywords: ["dankotuwa"], school: "Dankotuwa Central College 1" },
    { keywords: ["marawila"], school: "Marawila Central College 2" },
    { keywords: ["nattandiya"], school: "Nattandiya Dhammissara National School 1" },
    { keywords: ["mahawewa"], school: "Mahawewa Central College 1" },
    { keywords: ["katuneriya"], school: "Katuneriya St. Sebastian's College 1" },
    { keywords: ["chilaw", "arachchikattuwa"], school: "Chilaw Central College 4" },
    { keywords: ["anamaduwa"], school: "Anamaduwa Central College 1" },
    { keywords: ["kalpitiya"], school: "Kalpitiya Central College 1" },
    { keywords: ["puttalam"], school: "Puttalam National School 2" },

    // Colombo District Specific Regional Schools
    { keywords: ["maharagama"], school: "Maharagama Central College 1" },
    { keywords: ["dehiwala", "attidiya", "mount lavinia"], school: "Dehiwala Central College 1" },
    { keywords: ["moratuwa", "ratmalana"], school: "Moratuwa Central College 2" },
    { keywords: ["piliyandala", "kesbewa", "boralesgamuwa"], school: "Piliyandala Central College 1" },
    { keywords: ["bambalapitiya", "havelock", "kirulapone", "pamankada", "narahenpita", "pannipitiya", "wellawatte", "colombo south"], school: "Colombo South Central College 1" },
    { keywords: ["kotte", "jayawardenepura", "jayawardanapura", "kolonnawa", "kollupitiya", "battaramulla", "malabe", "koswatta", "welikada", "rajagiriya"], school: "Sri Jayawardenepura Central College 2" },
    { keywords: ["homagama", "hanwella", "padukka", "avissawella", "gotatuwa", "nawala", "magammana"], school: "Homagama Boys' College 2" },
    { keywords: ["colombo north", "galle face", "kotahena", "grandpass", "modara", "mattakkuliya", "mutwal"], school: "Colombo North National School 2" },
    { keywords: ["colombo central", "pettah", "maradana", "panchikawa", "borella", "thimbirigasyaya", "nugegoda", "mirihana", "milagiriya", "dematagoda"], school: "Colombo Central College 4" },
    
    // Gampaha District Specific Regional Schools
    { keywords: ["yakkala", "mudungoda", "miriswatta"], school: "Gampaha National School 1" },
    { keywords: ["ja-ela", "ja ela", "kandana", "seeduwa", "ekala"], school: "Ja-Ela Central College 1" },
    { keywords: ["kelaniya", "dalugama", "kiribathgoda", "kadawatha", "enderamulla", "wattala", "mabola"], school: "Kelaniya Boys' College 1" },
    { keywords: ["negombo", "katana", "kochchikade"], school: "Negombo Central College 1" },
    { keywords: ["minuwangoda", "divulapitiya"], school: "Minuwangoda Central College 3" },
    { keywords: ["pasyala", "veyangoda", "nittambuwa", "attanagalla"], school: "Attanagalla Central College 4" },
    { keywords: ["gampaha", "dompe"], school: "Gampaha National School 1" },

    // Kalutara District Specific Regional Schools
    { keywords: ["panadura"], school: "Panadura Central College 1" },
    { keywords: ["horana", "ingiriya", "govinna", "bandaragama", "bulathsinhala", "madurawela", "millaniya"], school: "Horana National School 1" },
    { keywords: ["matugama", "agalawatta", "walallawita", "palindanura", "palindanuwara"], school: "Matugama Boys' College 2" },
    { keywords: ["kalutara", "beruwala", "aluthgama", "dharga", "katukurunda", "wekada", "dodangoda"], school: "Kalutara Central College 2" },

    // Kandy District
    { keywords: ["kandy", "muladhaniwasaya", "lewella", "ampitiya", "tennekumbura", "peradeniya", "gelioya", "batawala"], school: "Kandy Central College 3" },
    { keywords: ["katugastota", "wattegama", "panwila", "pathadumbara", "akurana", "hatharaliyadda", "poojapitiya", "thumpane"], school: "Wattegama Central College 2" },
    { keywords: ["gampola", "nawalapitiya", "doluwa", "uda-palatha", "uda palatha"], school: "Gampola Boys' College 1" },
    { keywords: ["kadugannawa", "pilimathalawa", "denuwara"], school: "Denuwara Central College 1" },
    { keywords: ["teldeniya", "ududumbara", "kundasale", "minipe", "medadumbara"], school: "Teldeniya Central College 4" },

    // Galle District
    { keywords: ["elpitiya", "nagoda", "neluwa", "niyagama", "thawalama"], school: "Elpitiya Central College 3" },
    { keywords: ["ambalangoda", "balapitiya", "benthota", "hikkaduwa", "karandeniya", "welivitiya"], school: "Ambalangoda Central College 1" },
    { keywords: ["udugama", "baddegama", "imaduwa", "yakkalamulla"], school: "Udugama Boys' College 1" },
    { keywords: ["galle", "habaraduwa", "akmeemana", "bope"], school: "Galle National School 1" },

    // Matara District
    { keywords: ["akuressa", "athuraliya", "malimbada"], school: "Akuressa Central College 2" },
    { keywords: ["mulatiyana", "hakmana", "kamburupitiya", "kirinda", "puhulwella"], school: "Mulatiyana Central College 7" },
    { keywords: ["morawaka", "kotapola", "pasgoda", "pitabeddara"], school: "Morawaka National School 1" },
    { keywords: ["matara", "devinuwara", "dickwella", "thihagoda", "weligama", "welipitiya"], school: "Matara Central College 4" },

    // Kurunegala District
    { keywords: ["kuliyapitiya", "bingiriya", "ibbagamuwa", "maho", "galgamuwa", "giriulla", "alawwa", "kurunegala", "narammala", "wariyapola"], school: "Kuliyapitiya Boys' College 2" },

    // General fallback mappings for districts
    { keywords: ["colombo"], school: "Colombo South Central College 1" },
    { keywords: ["gampaha"], school: "Gampaha National School 1" },
    { keywords: ["kalutara"], school: "Kalutara Central College 2" },
    { keywords: ["kandy"], school: "Kandy Central College 3" },
    { keywords: ["galle"], school: "Galle National School 1" },
    { keywords: ["matara"], school: "Matara Central College 4" },
    { keywords: ["hambantota"], school: "Hambantota Central College 3" },
    { keywords: ["jaffna"], school: "Jaffna Central College 4" },
    { keywords: ["kurunegala"], school: "Kurunegala Central College 2" },
    { keywords: ["puttalam"], school: "Chilaw Central College 4" }
  ];

  // Tokenize and segment address by commas, slashes, dashes, newlines, etc. Use 3+ chars and non-pure digits for towns.
  const rawSegments = address
    .split(/[,/\-\n\._]+/)
    .map(s => s.trim().toLowerCase())
    .filter(s => s.length >= 3 && !/^\d+$/.test(s));

  // Pass 1: Highly specific match (where the matched school name contains the segment or keyword)
  // We search from right to left (last place first)
  for (let i = rawSegments.length - 1; i >= 0; i--) {
    const segment = rawSegments[i];
    for (const mapping of keywordMappings) {
      for (const keyword of mapping.keywords) {
        if (segment === keyword || segment.includes(keyword) || keyword.includes(segment)) {
          const cleanSchool = mapping.school.toLowerCase();
          if (cleanSchool.includes(segment) || cleanSchool.includes(keyword)) {
            return sanitizeSchoolName(mapping.school);
          }
        }
      }
    }
  }

  // Pass 2: Fallback/General match if no highly specific school matched
  for (let i = rawSegments.length - 1; i >= 0; i--) {
    const segment = rawSegments[i];
    for (const mapping of keywordMappings) {
      for (const keyword of mapping.keywords) {
        if (segment === keyword || segment.includes(keyword) || keyword.includes(segment)) {
          return sanitizeSchoolName(mapping.school);
        }
      }
    }
  }

  // Pass 3: Check subqueries right-to-left
  for (let i = rawSegments.length; i > 0; i--) {
    const subQuery = rawSegments.slice(i - 1).join(" ");
    for (const mapping of keywordMappings) {
      for (const keyword of mapping.keywords) {
        if (subQuery.includes(keyword) || keyword.includes(subQuery)) {
          return sanitizeSchoolName(mapping.school);
        }
      }
    }
  }

  // 3. District-level matching if no specific DS division matched
  const district = findDistrictFromAddress(address);
  if (district) {
    const schools = getSchoolsForDistrict(district);
    if (schools.length > 0) {
      return sanitizeSchoolName(schools[0]);
    }
  }

  // 4. Absolute fallback
  return sanitizeSchoolName(SRI_LANKA_SCHOOLS[0].schools[0]);
}

