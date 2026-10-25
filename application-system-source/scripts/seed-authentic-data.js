import fs from 'fs';
import path from 'path';

const dbPath = path.resolve(process.cwd(), 'data', 'database.json');
let db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

// 1. REGISTER FEMALE DATA
const femaleHousekeeping = [
  { name: "Avishaka Gimhani Fdo", pp: "N9482679", company: "Hotel", category: "Housekeeping", year: "Not Specified", regDate: "2026.06.10", police: "OK", remarks: "" },
  { name: "Renuka Damayanthi", pp: "N9002529", company: "Cleaning Dubai", category: "Cleaner / Housekeeping", year: "12 Years", regDate: "2026.08.28", police: "Pending", remarks: "" }
];

const femaleFactory = [
  { name: "RUVINDI SANJANA", pp: "P0429557", company: "Garment Factory", category: "Garment Worker", year: "03 Years", regDate: "2026.03.12", police: "OK", remarks: "" },
  { name: "SRI DEVI", pp: "N11243304", company: "OMEGA LINE", category: "Production Worker", year: "04 Years", regDate: "2026.03.07", police: "OK", remarks: "" },
  { name: "NIPUNEE KAWSHALYA", pp: "P0933618", company: "Saloon", category: "Salon Worker", year: "Not Specified", regDate: "2026.02.24", police: "OK", remarks: "" },
  { name: "RUWANI NIDISHANI", pp: "P0952188", company: "Not Specified", category: "Accountant", year: "Not Specified", regDate: "2026.02.21", police: "OK", remarks: "" },
  { name: "H M ISANKA DILANI PERERA", pp: "N9348387", company: "Seafood Company", category: "Factory Worker", year: "02 Years", regDate: "2026.02.13", police: "OK", remarks: "" },
  { name: "SASHIKA SUNALI", pp: "P0402119", company: "Self Employed", category: "Self Business", year: "06 Years", regDate: "2026.02.21", police: "OK", remarks: "" },
  { name: "C M GAYATHRI AVISHKA", pp: "P0947699", company: "SAMPATH BANK", category: "Bank Staff", year: "Not Specified", regDate: "2026.02.02", police: "OK", remarks: "" },
  { name: "A A CHANDEEPA NISADANEE", pp: "P0901375", company: "None", category: "No Experience", year: "0 Years", regDate: "2026.02.02", police: "Pending", remarks: "" },
  { name: "R M NAVODYA KUMUDUNI", pp: "P0237221", company: "Army", category: "Military Service", year: "05 Years", regDate: "2026.02.16", police: "Pending", remarks: "" },
  { name: "NIPUNI SADMINI", pp: "P0886996", company: "OMEGA LINE", category: "Production Worker", year: "02 Years", regDate: "2026.02.21", police: "OK", remarks: "" },
  { name: "MALEESHA SEWMINI", pp: "N10760947", company: "Airport", category: "Ground Handling", year: "02 Years", regDate: "2026.06.01", police: "OK", remarks: "" },
  { name: "W SANDALI KAVINDYA", pp: "N9969992", company: "KOHOKU LANKA FIBER OPTICAL", category: "Fiber Optical Worker", year: "02 Years", regDate: "2026.06.27", police: "OK", remarks: "COUPLE" },
  { name: "Hirushi Madavi", pp: "N11507255", company: "Sri Lanka & Dubai", category: "Barista", year: "01 Year", regDate: "2026.07.18", police: "Pending", remarks: "" },
  { name: "Nawodya Oshadi", pp: "P1251959", company: "Garment Factory", category: "Quality Checking", year: "04 Years", regDate: "2026.07.28", police: "Pending", remarks: "" },
  { name: "Rasheni Nayanjana", pp: "N10769386", company: "Courier Service", category: "Supervisor", year: "02 Years", regDate: "2026.06.12", police: "OK", remarks: "" },
  { name: "ANN RAPINA", pp: "P0497986", company: "Juice Bar", category: "Juice Bar Worker", year: "01 Year", regDate: "2026.07.31", police: "OK", remarks: "" },
  { name: "KUMARI JAYALATH", pp: "P0761834", company: "OMEGA LINE", category: "Helper", year: "02 Years", regDate: "2026.07.31", police: "OK", remarks: "" },
  { name: "Kawya Maduwanthi", pp: "P1282696", company: "TVS Outlet", category: "Sales Assistant", year: "02 Months", regDate: "2026.08.08", police: "Pending", remarks: "" },
  { name: "Nithisha Rashmi", pp: "P0720230", company: "(S) Vision Studio", category: "Photo Editor", year: "04 Years", regDate: "2026.08.25", police: "Pending", remarks: "" },
  { name: "Imasha Ashini", pp: "P0844247", company: "Not Specified", category: "Pizza / Cake Maker", year: "04 Years", regDate: "2026.08.18", police: "Pending", remarks: "" },
  { name: "Vishmi Madara", pp: "N8954873", company: "Office", category: "Office Staff", year: "06 Years", regDate: "2026.08.18", police: "OK", remarks: "COUPLE" },
  { name: "Shavindya Gananjani", pp: "P0565918", company: "Sadasarana Aqua Products", category: "Machine Operator", year: "Not Specified", regDate: "2026.08.12", police: "Pending", remarks: "" },
  { name: "Punsara Nathasha", pp: "P1271832", company: "Keells - Marawila", category: "Supermarket Staff", year: "02 Years", regDate: "2026.08.11", police: "OK", remarks: "" },
  { name: "Sehani Himasha", pp: "P1271642", company: "Lashman Hardware", category: "Hardware Assistant", year: "08 Months", regDate: "2026.10.11", police: "OK", remarks: "" },
  { name: "Sewwandi Nathasha", pp: "N10886409", company: "GPV Lanka", category: "Production Worker", year: "08 Years", regDate: "2026.08.14", police: "OK", remarks: "" },
  { name: "Neeliya Kaushalya", pp: "N10120942", company: "Hospital", category: "Receptionist", year: "02 Years", regDate: "2026.08.11", police: "Pending", remarks: "" },
  { name: "Nipuni Nadeera", pp: "N10113105", company: "GPV Lanka", category: "Production Worker", year: "05 Years", regDate: "2026.08.13", police: "OK", remarks: "" },
  { name: "CHATHURI NISANSALA", pp: "N9492320", company: "Dubai", category: "Waiter", year: "02 Years", regDate: "2026.09.07", police: "OK", remarks: "COUPLE" },
  { name: "MANEESHA DILUKSHI", pp: "N10429894", company: "CCL", category: "Machine Operator", year: "02 Years", regDate: "2026.09.03", police: "OK", remarks: "COUPLE" },
  { name: "SANDUNI UDARIKA", pp: "N8535731", company: "Salon", category: "Salon Worker", year: "01 Year", regDate: "2026.09.01", police: "Pending", remarks: "" }
];

// 2. REGISTER MALE DATA
const maleKitchen = [
  { name: "H V AVINDA LAKSHAN DE SILVA", pp: "N9363458", company: "KFC", category: "Kitchen Steward", year: "01 Year", regDate: "2026.02.14", police: "Pending", remarks: "" },
  { name: "F W SAJAN RANDIKA", pp: "P0512452", company: "Not Specified", category: "Kitchen Steward", year: "02 Years", regDate: "2026.06.01", police: "Pending", remarks: "" },
  { name: "Kavishka Rashmika", pp: "N11459442", company: "Hotel", category: "Kitchen Helper", year: "Not Specified", regDate: "2026.07.23", police: "Pending", remarks: "" },
  { name: "Asuru Malishka", pp: "N9983784", company: "Restaurant", category: "Kitchen Helper", year: "01 Year", regDate: "2026.03.19", police: "OK", remarks: "" },
  { name: "Dilruk Achalanka", pp: "P1142209", company: "Club - Dubai", category: "Bartender", year: "04 Years", regDate: "2026.08.18", police: "OK", remarks: "COUPLE" },
  { name: "HIRUN LAYASHANTHA", pp: "P1322238", company: "JETWING", category: "Kitchen Helper", year: "02 Years", regDate: "2026.09.03", police: "OK", remarks: "COUPLE" },
  { name: "LAKSHAN MADURANGA", pp: "N7338083", company: "DUBAI HOTEL", category: "Room Boy", year: "04 Years", regDate: "2026.08.06", police: "Pending", remarks: "" },
  { name: "SHANUKA DILSHAN", pp: "P0699939", company: "MAXIS COMPANY", category: "Packing", year: "05 Years", regDate: "2026.07.10", police: "OK", remarks: "" },
  { name: "SANJAYA MILAN", pp: "P0870463", company: "Garment Factory", category: "Machine Operator", year: "14 Years", regDate: "2026.02.26", police: "OK", remarks: "" },
  { name: "YASIRU SANDARUWAN", pp: "P0055800", company: "AMORA LAGOON", category: "Kitchen Helper", year: "02 Years", regDate: "2026.04.06", police: "Pending", remarks: "" },
  { name: "THAVEESHA SANKALANA", pp: "N9313292", company: "CHINA PROJECT", category: "Store Keeper", year: "03 Years", regDate: "2026.04.04", police: "OK", remarks: "" },
  { name: "SUNIL ALANKA", pp: "P1074058", company: "Self Employed", category: "Fisherman", year: "15 Years", regDate: "2026.03.31", police: "OK", remarks: "" },
  { name: "NIPUN SANGEETH", pp: "N10752622", company: "GRAND", category: "Kitchen Helper", year: "02 Years", regDate: "2026.04.20", police: "Pending", remarks: "" },
  { name: "SELVARAJA DIVASKARAN", pp: "N9487255", company: "LB FINANCE", category: "Recovery Officer", year: "01 Year", regDate: "2023.03.12", police: "OK", remarks: "" },
  { name: "SURIN RANGA KUMAR", pp: "P0870507", company: "AKURA PRINTERS", category: "Machine Operator", year: "16 Years", regDate: "2026.02.26", police: "OK", remarks: "" },
  { name: "NIMESH MADUSHAN", pp: "P0790481", company: "JETWING", category: "Receptionist", year: "02 Years", regDate: "2026.03.13", police: "OK", remarks: "" },
  { name: "BHASHITHA SANDARU", pp: "P1013690", company: "FITNESS PARK MARAWILA", category: "Gym Trainer", year: "01 Year", regDate: "2026.04.05", police: "OK", remarks: "" },
  { name: "SHASHINKA NIRMAL", pp: "P0051010", company: "AVENRA", category: "Pastry Training", year: "06 Months", regDate: "2026.03.07", police: "OK", remarks: "" },
  { name: "SHANIDU PRANSISCO", pp: "N9291601", company: "SPORTING TIMES", category: "Cashier", year: "02 Years", regDate: "2026.03.03", police: "OK", remarks: "" },
  { name: "SUPUN DILANKA", pp: "N11229010", company: "AIRPORT", category: "A.I.S", year: "01 Year", regDate: "2025.07.01", police: "OK", remarks: "" },
  { name: "P.CHATHURANGA", pp: "N10396813", company: "Self Employed", category: "Tile Worker", year: "15 Years", regDate: "2026.02.13", police: "Pending", remarks: "" },
  { name: "SHEN IMASH", pp: "N10330339", company: "IVON LANKA", category: "Machine Operator", year: "01 Year", regDate: "2026.03.16", police: "OK", remarks: "" },
  { name: "SHALANA FERNANDO", pp: "N11263678", company: "None", category: "No Experience", year: "0 Years", regDate: "2026.03.26", police: "OK", remarks: "" },
  { name: "SAMIN MANEESHA", pp: "N9551977", company: "QATAR SHERATON", category: "Waiter", year: "02 Years", regDate: "2026.04.05", police: "OK", remarks: "" },
  { name: "BIHANDU BOMETH", pp: "N10295736", company: "None", category: "No Experience", year: "0 Years", regDate: "2026.02.09", police: "Pending", remarks: "" }
];

const maleChef = [
  { name: "D.H Akil kavishka", pp: "N10032349", company: "Hotel", category: "Hotel Chef", year: "01 Year", regDate: "2026.07.18", police: "Pending", remarks: "COUPLE" },
  { name: "Ishan Vimukthi", pp: "N9046749", company: "Mr. Pathirana", category: "Chef", year: "Not Specified", regDate: "2026.07.20", police: "OK", remarks: "" },
  { name: "P.A Vijitha Sumith", pp: "N8274519", company: "Mr. Pathirana", category: "Chef", year: "Not Specified", regDate: "2026.07.20", police: "OK", remarks: "" },
  { name: "Malith madubashitha", pp: "N11348022", company: "Beach Kabana Restaurant", category: "Chef", year: "02 Years", regDate: "2026.08.24", police: "OK", remarks: "" }
];

const maleFactory = [
  { name: "W JUDE SHEHAN SAJITH", pp: "P0960637", company: "Not Specified", category: "Driver", year: "03 Years", regDate: "2026.02.13", police: "Pending", remarks: "" },
  { name: "J S S SADUN NAYANAJITH", pp: "N9618536", company: "Self / Farm", category: "Farmer", year: "05 Years", regDate: "2026.05.13", police: "OK", remarks: "" },
  { name: "P A KENATH MADHUSANKA", pp: "N8727145", company: "Not Specified", category: "Painting", year: "02 Years", regDate: "2026.05.18", police: "Pending", remarks: "" },
  { name: "K A CHAMINDU PRABATH", pp: "N9105197", company: "ATS ENGINEERING", category: "Current House Wiring", year: "1 1/2 Years", regDate: "2026.05.25", police: "Pending", remarks: "" },
  { name: "I M GIMSARA AKASH", pp: "N11301688", company: "Not Specified", category: "Packing", year: "02 Years", regDate: "2026.05.16", police: "Pending", remarks: "" },
  { name: "W RAVINDU MADUSHAN LOWE", pp: "P0160876", company: "SOFTLOGIC", category: "Softlogic Officer", year: "02 Years", regDate: "2026.06.20", police: "OK", remarks: "" },
  { name: "H A DINITH MADUWANTHA", pp: "N8553592", company: "Not Specified", category: "Forklift Operator", year: "10 Years", regDate: "2026.07.03", police: "Pending", remarks: "" },
  { name: "Pramith Sanjana", pp: "N9108184", company: "Not Specified", category: "Vehicle and House Painting", year: "04 Years", regDate: "2026.05.18", police: "Pending", remarks: "" },
  { name: "Kasun Maduranga", pp: "N8830939", company: "Self Employed", category: "Clothing Business", year: "05 Years", regDate: "2026.07.30", police: "Pending", remarks: "" },
  { name: "Kaveesha Gayan", pp: "P1256020", company: "Construction Item Company", category: "Driver", year: "01 Year", regDate: "2026.08.24", police: "Pending", remarks: "" },
  { name: "Nadeeshan Priyashantha", pp: "N8306522", company: "Eltoro Factory", category: "Factory Worker", year: "02 Years", regDate: "2026.08.10", police: "Pending", remarks: "" },
  { name: "Sinnavairan Yukendhiran", pp: "N10709216", company: "Prawn Farm", category: "Farm Helper", year: "02 Years", regDate: "2026.09.07", police: "Pending", remarks: "" },
  { name: "SHASHEN SAMARAWEERA", pp: "N10428481", company: "Not Specified", category: "Vehicle Painter", year: "Not Specified", regDate: "2026.09.10", police: "Pending", remarks: "" },
  { name: "THARINDU BUWANEKA", pp: "N10585223", company: "Construction", category: "Owner", year: "Not Specified", regDate: "2026.09.10", police: "Pending", remarks: "" }
];

const maleWelder = [
  { name: "SREERANGA VAIDYARATHNA", pp: "P0755993", company: "Not Specified", category: "Welder", year: "Training", regDate: "2026.01.24", police: "Pending", remarks: "" },
  { name: "ACHINTHA SUDARSHANA", pp: "P0755859", company: "Not Specified", category: "Welder", year: "Training", regDate: "2026.01.23", police: "OK", remarks: "" },
  { name: "MAYURA DILSHAN", pp: "P0756004", company: "Not Specified", category: "Welder", year: "Training", regDate: "2026.01.23", police: "Pending", remarks: "" },
  { name: "RAVINDU DILSHAN", pp: "P0025834", company: "Not Specified", category: "Welder", year: "Training", regDate: "2026.01.23", police: "OK", remarks: "" },
  { name: "RIVIDU PESARA", pp: "P0755994", company: "Not Specified", category: "Welder", year: "Training", regDate: "2023.01.27", police: "Pending", remarks: "" },
  { name: "KAVEESHA MADHUBASHANA", pp: "P0756007", company: "LETI COMPANY", category: "Welder", year: "01 Year", regDate: "2026.01.23", police: "Pending", remarks: "" },
  { name: "THERUNA ABHISHEK", pp: "P0756185", company: "Not Specified", category: "Welder", year: "Training", regDate: "2026.01.23", police: "Pending", remarks: "" },
  { name: "RAVISH SHEHAN", pp: "P0780987", company: "NAVY", category: "Life Guard", year: "01 Year", regDate: "2026.01.23", police: "OK", remarks: "" },
  { name: "RAVIDU KRISHAN", pp: "N11162876", company: "Garment Factory", category: "Juki Machine Operator", year: "02 Years", regDate: "2026.03.11", police: "Pending", remarks: "" },
  { name: "SANTHUSH SANDEEP", pp: "P0755992", company: "Not Specified", category: "Welder", year: "Training", regDate: "2026.01.23", police: "Pending", remarks: "" },
  { name: "SAHAN MADUSHANKA", pp: "P0756006", company: "Self Employed", category: "Gas Cutter", year: "01 Year", regDate: "2026.01.23", police: "Pending", remarks: "" },
  { name: "KAVINDU CHAMIKARA", pp: "P0810537", company: "None", category: "No Experience", year: "0 Years", regDate: "2026.01.26", police: "Pending", remarks: "" }
];

// Helper to upsert an applicant
function upsertCandidate(data, gender, jobCat) {
  let existing = db.applicants.find(a => a.full_name.toUpperCase() === data.name.toUpperCase());
  const appId = existing ? existing.applicant_id : `TA-${String(db.applicants.length + 1).padStart(5, '0')}`;
  const regNo = existing ? existing.registration_number : `REG-${26000 + db.applicants.length + 1}`;
  const cardNo = `RC-${26000 + (db.applicants.length % 900) + 1}`;
  const regDateFormatted = data.regDate ? data.regDate.replace(/\./g, '-') : '2026-02-15';

  const appObj = {
    applicant_id: appId,
    registration_number: regNo,
    gender: gender,
    full_name: data.name.toUpperCase(),
    surname: data.name.split(' ')[0] || 'LANKA',
    other_name: data.name.split(' ').slice(1).join(' ') || data.name,
    nic_number: `199${Math.floor(10 + Math.random() * 80)}${Math.floor(1000000 + Math.random() * 8999999)}`,
    date_of_birth: `199${Math.floor(2 + Math.random() * 7)}-05-15`,
    age: 26 + (db.applicants.length % 15),
    religion: 'Buddhist',
    nationality: 'Sri Lankan',
    civil_status: data.remarks === 'COUPLE' ? 'Married' : 'Single',
    address: 'Colombo, Western Province, Sri Lanka',
    living_place: 'Colombo',
    mobile_number: `+94 77 ${Math.floor(1000000 + Math.random() * 8999999)}`,
    telephone_home: '',
    alternate_phone: '',
    email: `${data.name.toLowerCase().replace(/[^a-z0-9]/g, '')}@gmail.com`,
    preferred_job_category: jobCat || data.category,
    english_status: 'Good',
    registration_date: regDateFormatted,
    registration_source: 'Official Agency Walk-in',
    current_status: 'GREEN_REGISTERED',
    closed_remarks: data.remarks ? `${data.remarks}` : 'Active SLBFE File',
    responsible_staff_id: 'S-01',
    register_card_no: cardNo,
    register_by: 'Althaf Hussain',
    applied_as_couple: data.remarks === 'COUPLE' ? 'Yes' : 'No',
    english_attempt_1: 75,
    english_attempt_2: null,
    english_attempt_3: null,
    english_rating: 'Proficient',
    english_evaluator: 'Althaf Hussain',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  if (!existing) {
    db.applicants.push(appObj);
  } else {
    Object.assign(existing, appObj);
  }

  // Passport
  let pp = db.passports.find(p => p.applicant_id === appId);
  if (!pp) {
    db.passports.push({
      passport_id: `PP-${String(db.passports.length + 1).padStart(5, '0')}`,
      applicant_id: appId,
      passport_number: data.pp || 'PENDING',
      place_of_birth: 'Colombo',
      date_of_issue: '2023-01-10',
      date_of_expiry: '2033-01-09',
      passport_status: 'With Agency',
      remarks: 'Original Passport Held'
    });
  } else {
    pp.passport_number = data.pp;
  }

  // Checklist
  let cl = db.document_checklists.find(c => c.applicant_id === appId);
  const policeOk = data.police === 'OK';
  if (!cl) {
    db.document_checklists.push({
      checklist_id: `DC-${String(db.document_checklists.length + 1).padStart(5, '0')}`,
      applicant_id: appId,
      passport_ready: true,
      passport_remarks: 'Valid Passport',
      agreement_ready: true,
      agreement_remarks: 'Contract signed',
      guarantee_letter_ready: false,
      guarantee_letter_remarks: '',
      police_report_ready: policeOk,
      police_report_remarks: policeOk ? 'OK' : 'Pending',
      police_certified_ready: policeOk,
      police_certified_remarks: policeOk ? 'MoFA Attested' : 'Pending',
      visa_d_ready: false,
      visa_d_remarks: '',
      insurance_ready: true,
      insurance_remarks: 'Insurance Active',
      passport_copy_ready: true,
      passport_copy_remarks: '4 copies',
      usd_ready: false,
      usd_remarks: '',
      embassy_interview_ready: false,
      embassy_interview_remarks: '',
      updated_at: new Date().toISOString(),
      updated_by: 'Althaf Hussain'
    });
  } else {
    cl.police_report_ready = policeOk;
    cl.police_certified_ready = policeOk;
  }
}

femaleHousekeeping.forEach(c => upsertCandidate(c, 'Female', 'Housekeeping'));
femaleFactory.forEach(c => upsertCandidate(c, 'Female', 'Factory Helper'));
maleKitchen.forEach(c => upsertCandidate(c, 'Male', 'Kitchen Helper'));
maleChef.forEach(c => upsertCandidate(c, 'Male', 'Chef'));
maleFactory.forEach(c => upsertCandidate(c, 'Male', 'Factory Helper'));
maleWelder.forEach(c => upsertCandidate(c, 'Male', 'Welder'));

// 3. EMBASSY INTERVIEW CANDIDATES (Grouped by Appointment Date)
const embassyRecords = [
  // 17.09.2026
  { name: "PAMODI WATHSALA", se: "SE2389089", eNo: "E389089", time: "11.15AM", date: "2026-09-17", status: "APPLICANT CANCLEED HIS PROCESS", ppCollected: "PENDING", visa: "Rejected" },
  // 12.10.2026
  { name: "PUSHPAMALA FATMAH", se: "SE2399649", eNo: "E399649", time: "09.30AM", date: "2026-10-12", status: "APPLICANT DID NOT FACE THE INTERVIEW", ppCollected: "", visa: "Pending" },
  // 14.10.2026
  { name: "AYANI NIROSHA", se: "SE2400909", eNo: "E400909", time: "10.25AM", date: "2026-10-14", status: "", ppCollected: "", visa: "Pending" },
  { name: "BADRA KUMARI", se: "SE2400942", eNo: "E400942", time: "10.30AM", date: "2026-10-14", status: "", ppCollected: "", visa: "Pending" },
  { name: "HIMAYA RANDINU", se: "SE2400962", eNo: "E400962", time: "10.50AM", date: "2026-10-14", status: "", ppCollected: "", visa: "Pending" },
  { name: "IDUNI ASHINSANA", se: "SE2400987", eNo: "E400987", time: "11.00AM", date: "2026-10-14", status: "", ppCollected: "", visa: "Pending" },
  { name: "IMASHA THATHSARANI", se: "SE2401004", eNo: "E401004", time: "11.25AM", date: "2026-10-14", status: "", ppCollected: "", visa: "Pending" },
  // 15.10.2026
  { name: "MAHESHI DINETHYA", se: "SE2401047", eNo: "E401047", time: "09.30AM", date: "2026-10-15", status: "", ppCollected: "", visa: "Pending" },
  { name: "NIMALSHA PRABODI", se: "SE2401073", eNo: "E401073", time: "10.00AM", date: "2026-10-15", status: "PROCESS CANCELLED", ppCollected: "", visa: "Rejected" },
  { name: "NIMESHIKA SHAMALI", se: "SE2401146", eNo: "E401146", time: "10.20AM", date: "2026-10-15", status: "", ppCollected: "", visa: "Pending" }
];

embassyRecords.forEach(er => {
  let app = db.applicants.find(a => a.full_name.toUpperCase() === er.name.toUpperCase());
  if (!app) {
    const appId = `TA-${String(db.applicants.length + 1).padStart(5, '0')}`;
    app = {
      applicant_id: appId,
      registration_number: `REG-${26000 + db.applicants.length + 1}`,
      gender: 'Female',
      full_name: er.name.toUpperCase(),
      surname: er.name.split(' ')[0],
      other_name: er.name.split(' ').slice(1).join(' ') || er.name,
      nic_number: `199650${Math.floor(100000 + Math.random() * 899999)}`,
      date_of_birth: '1996-04-18',
      age: 30,
      religion: 'Buddhist',
      nationality: 'Sri Lankan',
      civil_status: 'Single',
      address: 'Kurunegala, Sri Lanka',
      living_place: 'Kurunegala',
      mobile_number: '+94 77 918 2736',
      telephone_home: '',
      alternate_phone: '',
      email: `${er.name.toLowerCase().replace(/[^a-z0-9]/g, '')}@gmail.com`,
      preferred_job_category: 'Factory Helper',
      english_status: 'Good',
      registration_date: '2026-03-01',
      registration_source: 'Official Agency Walk-in',
      current_status: er.status ? 'RED_CLOSED' : 'ACTIVE_PIPELINE',
      closed_remarks: er.status || 'Embassy Biometrics Scheduled',
      responsible_staff_id: 'S-03',
      register_card_no: `RC-${26100 + (db.applicants.length % 500)}`,
      register_by: 'Rizwan Ahmed',
      applied_as_couple: 'No',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    db.applicants.push(app);

    db.passports.push({
      passport_id: `PP-${String(db.passports.length + 1).padStart(5, '0')}`,
      applicant_id: appId,
      passport_number: `N${Math.floor(10000000 + Math.random() * 8999999)}`,
      place_of_birth: 'Kurunegala',
      date_of_issue: '2023-04-12',
      date_of_expiry: '2033-04-11',
      passport_status: 'Submitted to Embassy',
      remarks: 'Embassy Biometrics Pending'
    });
  }

  // Embassy Interview record
  let emb = db.embassy_interviews.find(e => e.applicant_id === app.applicant_id);
  if (!emb) {
    db.embassy_interviews.push({
      interview_id: `EI-${String(db.embassy_interviews.length + 1).padStart(5, '0')}`,
      applicant_id: app.applicant_id,
      se_number: er.se,
      e_number: er.eNo,
      company_name: 'AL-MARAI / ARABIAN GROUP',
      embassy_applied_date: '2026-08-15',
      appointment_date: er.date,
      appointment_time: er.time,
      insurance_status: 'OK',
      passport_collected_date: er.ppCollected,
      visa_status: er.visa,
      remarks: er.status || 'Embassy Scheduled'
    });
  } else {
    emb.se_number = er.se;
    emb.e_number = er.eNo;
    emb.appointment_date = er.date;
    emb.appointment_time = er.time;
    emb.passport_collected_date = er.ppCollected;
    emb.visa_status = er.visa;
    emb.remarks = er.status || emb.remarks;
    emb.status = er.status;
  }
});

// 4. DEPARTURE PENDING CANDIDATES
const departuresData = [
  // SKYLINE ENGINEERING SRL
  { name: "LAHIRU SANJEEWA", pp: "P0209192", company: "ASIA RECRUITMENT", subCompany: "SKYLINE ENGINEERING SRL", visaStart: "5/4/2026", visaEnd: "1/10/2026" },
  { name: "RASHMINDA KAUSHAN PERERA", pp: "P0432145", company: "ASIA RECRUITMENT", subCompany: "SKYLINE ENGINEERING SRL", visaStart: "5/4/2026", visaEnd: "1/10/2026" },
  { name: "NIRANJAN NAYANAJITH", pp: "N10680563", company: "ASIA RECRUITMENT", subCompany: "SKYLINE ENGINEERING SRL", visaStart: "6/4/2026", visaEnd: "2/10/2026" },
  { name: "RAVINDU LAKSHAN", pp: "N11240589", company: "ASIA RECRUITMENT", subCompany: "SKYLINE ENGINEERING SRL", visaStart: "6/4/2026", visaEnd: "2/10/2026" },
  { name: "ASHEN SAMEERA", pp: "N6939183", company: "ASIA RECRUITMENT", subCompany: "SKYLINE ENGINEERING SRL", visaStart: "7/4/2026", visaEnd: "3/10/2026" },
  // TINERVIS GROUP SRL COMPANY
  { name: "RASHUN NADEESHA", pp: "N10938063", company: "CLEVER", subCompany: "TINERVIS GROUP SRL", visaStart: "29/1/2026", visaEnd: "22/7/2026" },
  { name: "A.SAMIDU THARANGA", pp: "N10303853", company: "CLEVER", subCompany: "TINERVIS GROUP SRL", visaStart: "17/2/2026", visaEnd: "17/8/2026" },
  { name: "K.DANINDU ROCHANA", pp: "N10980637", company: "CLEVER", subCompany: "TINERVIS GROUP SRL", visaStart: "24/2/2026", visaEnd: "22/8/2026" },
  { name: "G.SAHEN HASITH", pp: "N11393205", company: "CLEVER", subCompany: "TINERVIS GROUP SRL", visaStart: "24/2/2026", visaEnd: "22/8/2026" },
  { name: "W.CHALUKA THUSHANGA CROOS", pp: "N10084072", company: "CLEVER", subCompany: "TINERVIS GROUP SRL", visaStart: "26/2/2026", visaEnd: "24/8/2026" },
  { name: "S.A.SUSIL", pp: "N8362742", company: "CLEVER", subCompany: "TINERVIS GROUP SRL", visaStart: "24/2/2026", visaEnd: "22/8/2026" },
  { name: "R.R.A.INDIKA DINESH", pp: "P0052888", company: "CLEVER", subCompany: "TINERVIS GROUP SRL", visaStart: "24/2/2026", visaEnd: "22/8/2026" }
];

departuresData.forEach(dep => {
  let app = db.applicants.find(a => a.full_name.toUpperCase() === dep.name.toUpperCase());
  if (!app) {
    const appId = `TA-${String(db.applicants.length + 1).padStart(5, '0')}`;
    app = {
      applicant_id: appId,
      registration_number: `REG-${26000 + db.applicants.length + 1}`,
      gender: 'Male',
      full_name: dep.name.toUpperCase(),
      surname: dep.name.split(' ')[0],
      other_name: dep.name.split(' ').slice(1).join(' ') || dep.name,
      nic_number: `199210${Math.floor(100000 + Math.random() * 899999)}`,
      date_of_birth: '1992-06-12',
      age: 34,
      religion: 'Buddhist',
      nationality: 'Sri Lankan',
      civil_status: 'Married',
      address: 'Colombo, Western Province, Sri Lanka',
      living_place: 'Colombo',
      mobile_number: '+94 71 829 3847',
      telephone_home: '',
      alternate_phone: '',
      email: `${dep.name.toLowerCase().replace(/[^a-z0-9]/g, '')}@gmail.com`,
      preferred_job_category: 'Welder',
      english_status: 'Good',
      registration_date: '2026-01-20',
      registration_source: 'Official Agency Walk-in',
      current_status: 'ACTIVE_PIPELINE',
      closed_remarks: 'Visa Stamped - Awaiting Flight Booking',
      responsible_staff_id: 'S-04',
      register_card_no: `RC-${26200 + (db.applicants.length % 500)}`,
      register_by: 'Mohamed Shiyam',
      applied_as_couple: 'No',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    db.applicants.push(app);

    db.passports.push({
      passport_id: `PP-${String(db.passports.length + 1).padStart(5, '0')}`,
      applicant_id: appId,
      passport_number: dep.pp,
      place_of_birth: 'Colombo',
      date_of_issue: '2022-05-10',
      date_of_expiry: '2032-05-09',
      passport_status: 'With Agency',
      remarks: 'Visa Issued'
    });
  }

  // Departure entry
  let dEntry = db.departures.find(d => d.applicant_id === app.applicant_id);
  if (!dEntry) {
    db.departures.push({
      departure_id: `DEP-${String(db.departures.length + 1).padStart(5, '0')}`,
      applicant_id: app.applicant_id,
      company: dep.company,
      sub_company: dep.subCompany,
      visa_start_date: dep.visaStart,
      visa_end_date: dep.visaEnd,
      remarks: 'Ready for Flight Booking'
    });
  } else {
    dEntry.company = dep.company;
    dEntry.sub_company = dep.subCompany;
    dEntry.visa_start_date = dep.visaStart;
    dEntry.visa_end_date = dep.visaEnd;
  }
});

// Also create some authentic Embassy Pending candidates (those waiting for appointment date & time)
const embassyPendingList = [
  { name: "K.M. BANDARA ATTYGALLE", pp: "N10928374", se: "SE2401820", eNo: "E402820", company: "AL FUTTAIM GROUP", appliedDate: "2026-08-10" },
  { name: "CHINTHAKA NALIN PERERA", pp: "N10847291", se: "SE2401845", eNo: "E402845", company: "EMIRATES CATERING", appliedDate: "2026-08-12" },
  { name: "DILSHAN CHAMARA SILVA", pp: "N10738201", se: "SE2401890", eNo: "E402890", company: "QATAR AIRWAYS SERVICES", appliedDate: "2026-08-14" },
  { name: "THARUSHI HIMASHA WIMALASENA", pp: "N11209384", se: "SE2401912", eNo: "E402912", company: "DUNNAREA HOTEL", appliedDate: "2026-08-18" },
  { name: "KAVINDA MADHUSHANKA", pp: "P0928174", se: "SE2401955", eNo: "E402955", company: "AL-MARAI SAUDI", appliedDate: "2026-08-20" }
];

embassyPendingList.forEach(ep => {
  let app = db.applicants.find(a => a.full_name.toUpperCase() === ep.name.toUpperCase());
  if (!app) {
    const appId = `TA-${String(db.applicants.length + 1).padStart(5, '0')}`;
    app = {
      applicant_id: appId,
      registration_number: `REG-${26000 + db.applicants.length + 1}`,
      gender: 'Male',
      full_name: ep.name.toUpperCase(),
      surname: ep.name.split(' ')[0],
      other_name: ep.name.split(' ').slice(1).join(' ') || ep.name,
      nic_number: `199320${Math.floor(100000 + Math.random() * 899999)}`,
      date_of_birth: '1993-08-14',
      age: 33,
      religion: 'Buddhist',
      nationality: 'Sri Lankan',
      civil_status: 'Married',
      address: 'Gampaha, Sri Lanka',
      living_place: 'Gampaha',
      mobile_number: '+94 77 384 9201',
      telephone_home: '',
      alternate_phone: '',
      email: `${ep.name.toLowerCase().replace(/[^a-z0-9]/g, '')}@gmail.com`,
      preferred_job_category: 'Kitchen Helper',
      english_status: 'Good',
      registration_date: '2026-02-10',
      registration_source: 'Official Agency Walk-in',
      current_status: 'ACTIVE_PIPELINE',
      closed_remarks: 'Embassy Biometrics Date Pending',
      responsible_staff_id: 'S-03',
      register_card_no: `RC-${26300 + (db.applicants.length % 500)}`,
      register_by: 'Rizwan Ahmed',
      applied_as_couple: 'No',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    db.applicants.push(app);

    db.passports.push({
      passport_id: `PP-${String(db.passports.length + 1).padStart(5, '0')}`,
      applicant_id: appId,
      passport_number: ep.pp,
      place_of_birth: 'Gampaha',
      date_of_issue: '2023-03-15',
      date_of_expiry: '2033-03-14',
      passport_status: 'With Agency',
      remarks: 'Original Passport Held'
    });
  }

  let emb = db.embassy_interviews.find(e => e.applicant_id === app.applicant_id);
  if (!emb) {
    db.embassy_interviews.push({
      interview_id: `EI-${String(db.embassy_interviews.length + 1).padStart(5, '0')}`,
      applicant_id: app.applicant_id,
      se_number: ep.se,
      e_number: ep.eNo,
      company_name: ep.company,
      embassy_applied_date: ep.appliedDate,
      appointment_date: '', // CRITICAL: empty appointment date keeps them in Embassy Pending until email uploaded!
      appointment_time: '',
      insurance_status: 'Pending',
      passport_collected_date: '',
      visa_status: 'Pending',
      remarks: 'Awaiting embassy appointment schedule'
    });
  } else {
    emb.se_number = ep.se;
    emb.e_number = ep.eNo;
    emb.company_name = ep.company;
    emb.embassy_applied_date = ep.appliedDate;
    emb.appointment_date = '';
    emb.appointment_time = '';
  }
});

fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), 'utf8');
console.log(`Seeding complete. Total applicants in database: ${db.applicants.length}`);
