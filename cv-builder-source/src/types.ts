export type AppFormat = "format1" | "format2" | "format3"; // format1: Standard Green Bilingual CV, format2: Clever Recruitment Agency Format, format3: Classic Curriculum Vitae Format

export interface CareerRow {
  id: number;
  employerDetails: string;
  period: string;
  position: string;
}

export interface TrainingRow {
  id: number;
  courseName: string;
  duration: string;
  diploma: string;
}

export interface CVData {
  // Common & Format 01 Fields
  name: string; // 1. Nume / Name
  surname: string; // 2. Prenumele/Surname
  previousName: string; // 3. Numele purtate anterior/Previous name
  placeOfBirth: string; // 4. Locul Nasterii/Place of birth
  dateOfBirth: string; // 5. Data nasterii/Date of birth
  fatherName: string; // 6. Parinti/Parents: tata/Father
  motherName: string; // 7. mama/mother
  citizenship: string; // 8. Cetatenie/Citizenship
  nationality: string; // 9. Nationalitate/ Nationality
  passportNo: string; // 10. Pasaport/Passport Nr./NO.
  passportIssuedBy: string; // eliberat de/Issued by
  passportIssuedDate: string; // la data/date
  passportValidFrom: string; // valabil de la/valability from
  passportValidTo: string; // pana/to
  residence: string; // 11. Domiciliu/Residence
  country: string; // 12. Tara/Country
  city: string; // 13. Localitatea/City...
  lastResidence: string; // 14. Ultima resedinta/Last residence
  lastResidenceCountry: string; // Tara/Country
  lastResidenceCity: string; // Localiatea/City...
  maritalStatus: string; // 15. Starea civila/Marital status
  childrenToSupport: string; // Copii in intretinere/Children to support financialy
  professionalSkill: string; // 16. Calificari profesionale/Proffesional skill
  appliedPosition?: string; // Applied position for Form 2 & synced across formats
  careers: CareerRow[]; // 17. Career table
  classesGraduate: string; // 18. Numar clase absolvite/ No of classes graduate
  foreignLanguage: string; // 19. Limbi straine Engleza/ Foreign English Language
  email: string; // 20. Adresa de email / email address
  
  // Format 02 Specific Fields (Clever Recruitment Format)
  phone: string; // Mobile / WhatsApp
  height: string; // Inaltime / Height
  weight: string; // Greutate / Weight
  religion: string; // Religia / Religion
  college: string; // Colegiu / College
  secondarySchool: string; // Secundar / Secondary
  primarySchool: string; // Primar / Primary
  trainings: TrainingRow[]; // Formari / Cursuri Trainings
  langUnderstanding: "Excellent" | "Good" | "Fair" | "Poor" | "None";
  langSpeaking: "Excellent" | "Good" | "Fair" | "Poor" | "None";
  langWriting: "Excellent" | "Good" | "Fair" | "Poor" | "None";

  // Page 2 Declarations
  otherMentions: string; // 21. Alte mentiuni/Other mentions
  declarationRomanian: string;
  declarationEnglish: string;
  declarationHealth: string;
  date: string;
  
  // Uploaded assets
  photoUrl: string | null; // Customer Image
  signatureUrl: string | null; // Signature Image
  topLeftPhotoUrl: string | null; // Top-left corner agency logo

  // Supporting Document Attachments (Police Report, Passport, Photos, etc.)
  attachments?: AttachedDoc[];
}

export type AttachmentType = "police_report" | "passport" | "applicant_photo" | "other";

export interface AttachedDoc {
  id: string;
  type: AttachmentType;
  title: string;
  url: string;
  fileName?: string;
}

export const INITIAL_CV_DATA: CVData = {
  name: "KALUWA DEWAGE DHANUSHKA",
  surname: "NISHSHANKA",
  previousName: "-",
  placeOfBirth: "RAGAMA",
  dateOfBirth: "22.03.2000",
  fatherName: "K.D. MOHAN LAL SIRISENA",
  motherName: "HETTINARAYAN MUDIYANSELAGE RENUKA NISHANTHI",
  citizenship: "SRI LANKAN",
  nationality: "SRI LANKA",
  passportNo: "N9516135",
  passportIssuedBy: "COLOMBO",
  passportIssuedDate: "04/08/2022",
  passportValidFrom: "04/08/2022",
  passportValidTo: "04/08/2032",
  residence: "WELANGASWEWA, BORALUWEWA, SRI LANKA",
  country: "SRI LANKA",
  city: "BORALUWEWA",
  lastResidence: "WELANGASWEWA, BORALUWEWA, SRI LANKA",
  lastResidenceCountry: "SRI LANKA",
  lastResidenceCity: "BORALUWEWA",
  maritalStatus: "SINGLE",
  childrenToSupport: "-",
  professionalSkill: "VEHICLE SALE OWNER",
  appliedPosition: "VEHICLE SALE OWNER",
  careers: [
    { id: 1, employerDetails: "VEHICLE SALE COMPNAY", period: "02 YEARS", position: "OWNER" },
    { id: 2, employerDetails: "", period: "", position: "" },
    { id: 3, employerDetails: "", period: "", position: "" }
  ],
  classesGraduate: "O/L – 1999",
  foreignLanguage: "NORMAL ENGLISH",
  email: "TRANSARABIAN@YAHOO.COM",

  // Format 02 Specific Initial Values
  phone: "+94775960561",
  height: "",
  weight: "",
  religion: "BUDDHIST",
  college: "",
  secondarySchool: "YES",
  primarySchool: "YES",
  trainings: [
    { id: 1, courseName: "-", duration: "-", diploma: "-" },
    { id: 2, courseName: "", duration: "", diploma: "" },
    { id: 3, courseName: "", duration: "", diploma: "" }
  ],
  langUnderstanding: "Good",
  langSpeaking: "Good",
  langWriting: "Good",

  otherMentions: "",
  declarationRomanian: "Declar pe proprie raspundere sunt apt din punct de vedere medical pentru a fi încadrat în muncă şi că am cunoştinţe minime de limba română si cunostiinte de limba engleza.",
  declarationEnglish: "I declare on my own responsibility that I am medically fit to work and that I have minimal knowledge of Romanian and English knowledge.",
  declarationHealth: "I am maintaining a good health & able to work . I can understand Little bite of the Romanian language.",
  date: new Date().toLocaleDateString("en-GB"),
  photoUrl: null,
  signatureUrl: null,
  topLeftPhotoUrl: null,
  attachments: [],
};
