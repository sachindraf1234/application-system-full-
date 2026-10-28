// Original CV-BUILDER Gemini document endpoints, mounted on the APPLICATION-SYSTEM server.
// Source: https://github.com/sachindraf1234/CV-BUILDER
import { Router } from 'express';
import { GoogleGenAI, Type } from '@google/genai';

const router = Router();
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || 'UNCONFIGURED' });

// Robust retry & fallback mechanism for handling transient/demand spikes (e.g. 503/429 errors)
async function generateContentWithRetry(aiClient: any, params: any, maxRetries = 2) {
  let lastError: any = null;
  let delay = 800;

  // Try valid Gemini models in fallback order (prioritize flash-lite models for higher availability / quota pools)
  const modelsToTry = Array.from(
    new Set(
      [
        "gemini-3.5-flash-lite",
        "gemini-3.1-flash-lite",
        "gemini-3.5-flash",
        "gemini-3.6-flash",
        "gemini-3.7-flash",
        params.model,
      ].filter(Boolean)
    )
  );

  for (const model of modelsToTry) {
    if (!model) continue;

    // Retry at most 2 times per model to avoid stalling. If still failing, fall back to the next active model immediately.
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        console.log(`[Gemini API] Requesting content using model "${model}" - Attempt ${attempt}/2`);
        const response = await aiClient.models.generateContent({
          ...params,
          model: model,
        });
        console.log(`[Gemini API] Successfully generated content using model "${model}" on attempt ${attempt}`);
        return response;
      } catch (error: any) {
        lastError = error;
        console.error(`[Gemini API] Error on model "${model}" (Attempt ${attempt}/2):`, error.message || error);

        const errorCode = error.status || error.code || (error.error && error.error.code);
        const errorMessage = String(error.message || error.description || "").toLowerCase();

        const isRateLimit =
          errorCode === "RESOURCE_EXHAUSTED" ||
          errorCode === 429 ||
          errorMessage.includes("429") ||
          errorMessage.includes("rate limit") ||
          errorMessage.includes("quota") ||
          errorMessage.includes("exhausted");
        
        if (isRateLimit) {
          // If we hit any rate limit or quota exceeded, fall back to the next model immediately
          console.warn(`[Gemini API] Quota limit reached for "${model}". Falling back to next model immediately...`);
          break; // Break the attempt loop to try the next model
        }

        const isUnavailable =
          errorCode === "UNAVAILABLE" ||
          errorCode === 503 ||
          errorMessage.includes("503") ||
          errorMessage.includes("demand") ||
          errorMessage.includes("unavailable");

        if (isUnavailable && attempt < 2) {
          console.log(`[Gemini API] Transient error on "${model}". Retrying in ${delay}ms...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
          delay *= 1.5;
          continue;
        }

        break;
      }
    }
    delay = 800;
  }

  throw lastError || new Error("Gemini API rate limit or service unavailable.");
}

// JSON Schema for structured extraction matching the exact 22 CV fields
const cvResponseSchema = {
  type: Type.OBJECT,
  properties: {
    name: { type: Type.STRING, description: "1. Nume / Given name(s) / First Name(s) in CAPITAL letters. MUST be separate from surname. Do NOT include surname in this field." },
    surname: { type: Type.STRING, description: "2. Prenumele / Surname / Family Name / Last Name in CAPITAL letters. MUST be separate from name. Do NOT include given names in this field." },
    previousName: { type: Type.STRING, description: "3. Numele purtate anterior/Previous name (leave empty if not mentioned or blank)" },
    placeOfBirth: { type: Type.STRING, description: "4. Locul Nasterii/Place of birth" },
    dateOfBirth: { type: Type.STRING, description: "5. Data nasterii/Date of birth (e.g. DD/MM/YYYY)" },
    fatherName: { type: Type.STRING, description: "6. Parents tata/Father: Father's full name" },
    motherName: { type: Type.STRING, description: "7. mama/mother: Mother's full name" },
    citizenship: { type: Type.STRING, description: "8. Cetatenie/Citizenship" },
    nationality: { type: Type.STRING, description: "9. Nationalitate/ Nationality" },
    passportNo: { type: Type.STRING, description: "10. Passport Nr./NO." },
    passportIssuedBy: { type: Type.STRING, description: "Passport eliberat de/Issued by (e.g. COLOMBO)" },
    passportIssuedDate: { type: Type.STRING, description: "Passport la data/date (e.g. DD/MM/YYYY)" },
    passportValidFrom: { type: Type.STRING, description: "Passport valabil de la /valability from (e.g. DD/MM/YYYY)" },
    passportValidTo: { type: Type.STRING, description: "Passport pana/to (e.g. DD/MM/YYYY)" },
    residence: { type: Type.STRING, description: "11. Domiciliu/Residence full address" },
    country: { type: Type.STRING, description: "12. Tara/Country" },
    city: { type: Type.STRING, description: "13. Localitatea/City..." },
    lastResidence: { type: Type.STRING, description: "14. Ultima resedinta/Last residence full address" },
    lastResidenceCountry: { type: Type.STRING, description: "Last residence country (Tara/Country)" },
    lastResidenceCity: { type: Type.STRING, description: "Last residence city (Localiatea/City...)" },
    maritalStatus: { type: Type.STRING, description: "15. Starea civila/Marital status" },
    childrenToSupport: { type: Type.STRING, description: "Children to support financially (Copii in intretinere/Children to support financialy)" },
    professionalSkill: { type: Type.STRING, description: "16. Calificari profesionale/Proffesional skill" },
    careers: {
      type: Type.ARRAY,
      description: "17. Career table. Max 3 entries",
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.INTEGER, description: "Row number (1, 2, 3)" },
          employerDetails: { type: Type.STRING, description: "Angajator/date de identificare / Employeer/identification details" },
          period: { type: Type.STRING, description: "Perioada/Period" },
          position: { type: Type.STRING, description: "Functia/Position" }
        },
        required: ["id", "employerDetails", "period", "position"]
      }
    },
    classesGraduate: { type: Type.STRING, description: "18. Numar clase absolvite/ No of classes graduate" },
    foreignLanguage: { type: Type.STRING, description: "19. Limbi straine Engleza/ Foreign English Language" },
    email: { type: Type.STRING, description: "20. Adresa de email / email address" },
    otherMentions: { type: Type.STRING, description: "21. Alte mentiuni/Other mentions (Page 2)" },
    phone: { type: Type.STRING, description: "Applicant mobile/WhatsApp phone number if found in any document" },
    height: { type: Type.STRING, description: "Applicant height if found in any document, e.g., '5.8 ft' or '5.5'" },
    weight: { type: Type.STRING, description: "Applicant weight if found in any document, e.g., '65 kg' or '60'" },
    college: { type: Type.STRING, description: "Applicant attended school/college name if found in any document" }
  },
  required: [
    "name", "surname", "previousName", "placeOfBirth", "dateOfBirth", "fatherName", "motherName",
    "citizenship", "nationality", "passportNo", "passportIssuedBy", "passportIssuedDate",
    "passportValidFrom", "passportValidTo", "residence", "country", "city", "lastResidence",
    "lastResidenceCountry", "lastResidenceCity", "maritalStatus", "childrenToSupport",
    "professionalSkill", "careers", "classesGraduate", "foreignLanguage", "email", "otherMentions",
    "phone", "height", "weight", "college"
  ]
};

// API Endpoint to process OCR using Gemini API
const handleCvOcr = async (req: import("express").Request, res: import("express").Response) => {
  try {
    const { fileBase64, mimeType, files, formatType } = req.body;
    const activeFormatName = formatType === "format2"
      ? "Format 2 (Work Permit & Visa Application Form / Cerere de Angajare)"
      : "Format 1 (Standard Bilingual CV / Curriculum Vitae)";

    // Check if API key is present
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({
        error: "GEMINI_API_KEY environment variable is not configured. Please add it to your secrets.",
      });
    }

    let fileParts = [];

    if (files && Array.isArray(files) && files.length > 0) {
      fileParts = files.flatMap((f: any, idx: number) => {
        const base64Data = f.fileBase64.replace(/^data:.*?;base64,/, "");
        const fileNameStr = f.fileName ? ` (Filename: "${f.fileName}")` : "";
        return [
          { text: `--- Attached Document Page ${idx + 1}${fileNameStr} ---` },
          {
            inlineData: {
              mimeType: f.mimeType,
              data: base64Data,
            },
          },
        ];
      });
    } else if (fileBase64 && mimeType) {
      const base64Data = fileBase64.replace(/^data:.*?;base64,/, "");
      fileParts = [{
        inlineData: {
          mimeType: mimeType,
          data: base64Data,
        },
      }];
    } else {
      return res.status(400).json({ error: "Missing required fields: files list or fileBase64 and mimeType" });
    }

    const promptText = `
      You are a specialized OCR and structured application extractor. 
      Target application format selected by user: ${activeFormatName}.
      Your task is to analyze the uploaded document(s) (which can be a single file or multiple files/pages of a bilingual Romanian-English CV, Work Permit Application form, or supporting documents like passports, language certificates, and police clearance reports / regional police reports) 
      and extract ALL relevant fields accurately to populate the selected application format for this specific person.

      Please adhere strictly to these extraction instructions:
      1. CRITICAL REQUIREMENT - SEPARATE NAME AND SURNAME & FORMAT PLACEMENT:
         - You MUST extract 'name' (Given names / First and Middle names) and 'surname' (Surname / Family Name / Last Name) as TWO SEPARATE fields directly and exclusively from the PASSPORT.
         - Do NOT combine them into a single whole name in either field.
         - 'name' MUST contain ONLY given/first/middle names (e.g., "WARNAKULASOORIYA VIHANGA THIMALKA").
         - 'surname' MUST contain ONLY the surname / family name / last name (e.g., "THISERA").
         - FORMAT-SPECIFIC NAME PLACEMENT RULES:
           * FOR FORMAT 01: Put extracted given/first/middle names in the 'name' field, and extracted surname in the 'surname' field.
           * FOR FORMAT 02: For the "Nume si prenume / Name and Surname" field, surname comes first followed by name (i.e. SURNAME NAME).
           * FOR FORMAT 03: Put extracted given names in the 'name' field (Numele) and surname in the 'surname' field (Prenumele).

      2. STRICT MANDATORY PRIORITY RULE FOR PASSPORT AND POLICE REPORTS FOR SINGLE AND BATCH PROCESSING:
         - RULE 01 (PASSPORT DETAILS & NAME/SURNAME EXTRACTION WITH WATERMARK HANDLING):
           * NAMES AND SURNAMES EXTRACTION MUST BE EXACTLY THE SAME AS WHICH MENTIONED IN THE PASSPORT. DO NOT TRY TO CHANGE IT. IT IS A MUST.
           * IF YOU CANNOT EXTRACT APPLICANT NAME DETAILS DUE TO THE PURPLE COLOR AND THE SRI LANKAN SYMBOL (SPECIALLY IN THE NEW TYPE PASSPORT), YOU CAN VERIFY AND EXTRACT THAT SPECIFIC NAME PART FROM THE APPLICANT'S JOB APPLICATION FORM, BUT ONLY THAT SPECIFIC PART. ALL OTHER PARTS OF THE NAME AND SURNAME MUST BE EXTRACTED DIRECTLY FROM THE PASSPORT.
           * WHEN YOU EXTRACT THAT SPECIFIC NAME PART FROM THE APPLICANT'S JOB APPLICATION FORM, YOU HAVE TO PLACE IT IN THE EXACT CORRECT PLACE WHERE THAT NAME PART IS DEPICTED IN THE PASSPORT INTO THE CREATED APPLICANT'S APPLICATION FORMAT FIELDS.
           * TO ENSURE ACCURACY, ALSO INSPECT THE MRZ (MACHINE READABLE ZONE) LINES AT THE ABSOLUTE BOTTOM OF THE PASSPORT PAGE WHERE DOUBLE ARROWS "<< " SEPARATE SURNAME FROM GIVEN NAMES. BUT AGAIN, NAMES AND SURNAMES IN THE OUTPUT MUST MATCH THE PASSPORT EXACTLY, AND NO PART SHOULD BE ALTERED EXCEPT TO COMPLETE OBSCURED CHARACTERS/WORDS SOLVED VIA THE JOB APPLICATION FORM. DO NOT EXTRACT OR VERIFY THIS PART FROM THE MIGRANT WORKER DECLARATION OR SELF DECLARATION.
           * SPECIAL PASSPORT WATERMARK HANDLING (SRI LANKAN PASSPORTS): These passports contain a large purple circular security watermark/seal overlaid on the middle-right side, which can obscure parts of the Surname or Other Names. To extract the full name flawlessly, if any part of the applicant's name or surname is obscured by the purple watermark/seal, or truncated at the end of the MRZ lines, you MUST check ONLY the uploaded Job Application Form and extract ONLY the missing part from that specific Job Application Form, merging it perfectly with the passport data. Do NOT check or extract this missing part from the Migrant Worker Declaration, Self Declaration form, or any other document. You must ONLY look for that missing part in the Job Application Form if you cannot take it from the Passport. Take ONLY the missing characters/words from the Job Application Form—do not allow different name structures or spelling from application forms to override what is visible on the passport.
           * When extracting names of the applicant, you must put the applicant name and surname exactly as mentioned on the passport (with missing parts filled from the application form if obscured) into the relevant places of the application forms. It is an absolute must. If the passport document is not found, you can take details from other documents (only if passport is not there).
         - RULE 02 (ADDRESS DETAILS): ADDRESS DETAILS MUST EXTRACT FROM POLICE REPORT AND REGIONAL POLICE REPORT DOCUMENTS. IF NOT FIND THE DOCUMENT YOU CAN TAKE DETAILS FROM OTHER DOCUMENTS (ONLY IF POLICE REPORT / REGIONAL POLICE REPORT NOT THERE).
         - Do NOT allow any spelling, formatting, or name variations from application forms, standard CV pages, certificates, or other secondary documents to override or alter any values found on the official Passport (for applicant name, surname, passport number, birth date, birth place) or Police Report/Regional Police Report (for address details).
         - For other fields that are not covered in the Passport or Police Report (such as foreign languages, professional skills, previous career history / employers, education, email, etc.), extract those details from whichever other documents contain them.

      3. Keep names, cities, and addresses in the original casing (usually CAPITALIZED in the documents).
      4. Do NOT invent or guess any details. If a field is blank or not mentioned anywhere in the files, return an empty string "".
      5. Ensure dates are parsed in DD/MM/YYYY format if possible, or left as they appear.
      6. Under the 'careers' list, parse the previous employer details table (usually under point 17 or 18). Extract up to 3 rows. 
         If there are fewer than 3, you MUST pad the remaining rows with empty strings for 'employerDetails', 'period', and 'position' to ensure 3 rows are always returned.
         Maintain IDs 1, 2, and 3.
      7. For the 'otherMentions' field (point 21/Other mentions), ALWAYS return an empty string "". Do NOT fill this section automatically for any reason, as it must be filled manually by the user. Do not add any default or watermark sentences/words to this section.
      8. For 'foreignLanguage', always set this field to "NORMAL ENGLISH" permanently.
      9. FOR FORMAT 02 (Clever Recruitment/Application Layout):
         - Address and Residence ('residence'): You MUST identify the applicant's residential address from the documents. Match and structure it clearly using Sri Lankan divisions (Province, District, DS Division, Grama Niladari Sector e.g., Colombo Sector 13, Homagama Sector 9, Minuwangoda Sector 10). Use the uploaded PDF of Grama Niladari sectors and regions to recognize this place cleanly.
         - School / College Name ('college'): Check the LAST place in the Police Report / Regional Police Report (e.g. Lunuwila, Wennappuwa, Dankotuwa, Marawila, Maharagama, Dehiwala, Chilaw, Negombo, etc.). If missing, check applicant's address. Use exact regional school (e.g. Lunuwila Central College 1, Wennappuwa National School 1, Dankotuwa Central College 1, Maharagama Central College 1). Never write place names twice.
           * If in Lunuwila / Luniwila -> use "Lunuwila Central College 1"
           * If in Wennappuwa -> use "Wennappuwa National School 1"
           * If in Dankotuwa -> use "Dankotuwa Central College 1"
           * If in Marawila -> use "Marawila Central College 2"
           * If in Maharagama -> use "Maharagama Central College 1"
           * If in Dehiwala / Mount Lavinia -> use "Dehiwala Central College 1"
           * If in Moratuwa / Ratmalana -> use "Moratuwa Central College 2"
           * If in Piliyandala / Kesbewa -> use "Piliyandala Central College 1"
           * If in Sri Jayawardanapura Kotte -> use "Sri Jayawardenepura Central College 2"
           * If in Homagama / Hanwella -> use "Homagama Boys' College 2"
           * If in Minuwangoda / Divulapitiya -> use "Minuwangoda Central College 3"
           * If in Negombo / Katana -> use "Negombo Central College 1"
           * If in Kelaniya / Biyagama / Ja-Ela -> use "Kelaniya Boys' College 1"
           * If in Gampaha / Dompe -> use "Gampaha National School 1"
           * If in Horana / Bandaragama -> use "Horana National School 1"
           * If in Matugama / Agalawatta -> use "Matugama Boys' College 2"
           * If in Kalutara / Beruwala / Panadura -> use "Kalutara Central College 2"
           * If in Kandy -> use "Kandy Central College 3"
           * If in Galle -> use "Galle National School 1"
           * If in Matara -> use "Matara Central College 4"
           * If in Kurunegala / Kuliyapitiya -> use "Kuliyapitiya Boys' College 2"
         - Phone Number ('phone'): It is essential to extract at least one mobile / phone number (usually starting with +94 or 07 or similar) and put it in the 'phone' field.
         - Height & Weight ('height', 'weight'): Extract height and weight if mentioned anywhere in the application form or any document.
    `;

    // Call Gemini API using modern @google/genai SDK via robust retry & fallback helper
    const response = await generateContentWithRetry(ai, {
      model: "gemini-3.7-flash",
      contents: [...fileParts, { text: promptText }],
      config: {
        responseMimeType: "application/json",
        responseSchema: cvResponseSchema,
        temperature: 0.1,
      },
    });

    const resultText = response.text;
    if (!resultText) {
      throw new Error("Empty response from Gemini API");
    }

    const cleanSpaces = (val: any): any => {
      if (typeof val === "string") {
        return val.replace(/\s+/g, " ").trim();
      }
      if (Array.isArray(val)) {
        return val.map(cleanSpaces);
      }
      if (typeof val === "object" && val !== null) {
        const cleaned: any = {};
        for (const k of Object.keys(val)) {
          cleaned[k] = cleanSpaces(val[k]);
        }
        return cleaned;
      }
      return val;
    };

    const parsedData = JSON.parse(resultText.trim());
    const cleanedData = cleanSpaces(parsedData);
    return res.json({ success: true, data: cleanedData });
  } catch (error: any) {
    console.error("Error processing OCR in backend:", error);
    const errMessage = String(error.message || error).toLowerCase();
    if (errMessage.includes("quota") || errMessage.includes("429") || errMessage.includes("exhausted") || errMessage.includes("rate limit")) {
      return res.status(429).json({ error: "AI quota exhausted. Please retry later; no candidate details were changed." });
    }
    return res.status(500).json({
      error: "Failed to extract CV details. Please make sure the uploaded image/PDF is readable.",
      details: error.message || error,
    });
  }
 };

// CV builder calls both aliases; use one handler without rewriting request URLs.
router.post(["/api/ocr", "/api/ocr-scan", "/api/ocr-cv"], handleCvOcr);


// API Endpoint to detect and locate applicant signature in document pages
router.post("/api/extract-signature", async (req, res) => {
  try {
    const { files } = req.body;

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({
        error: "GEMINI_API_KEY environment variable is not configured. Please add it to your secrets.",
      });
    }

    if (!files || !Array.isArray(files) || files.length === 0) {
      return res.status(400).json({ error: "Missing required field: files array" });
    }

    // Convert input files to Gemini multi-modal content parts with page names and index labels
    const contentParts: any[] = [
      { text: "You are being provided with a list of document pages/images. Each page has a page label indicating its index and original filename." }
    ];

    files.forEach((f: any, idx: number) => {
      const base64Data = f.fileBase64.replace(/^data:.*?;base64,/, "");
      contentParts.push({ text: `--- Document Page Index ${idx} (Filename: "${f.fileName || "Page_" + (idx + 1)}") ---` });
      contentParts.push({
        inlineData: {
          mimeType: f.mimeType || "image/png",
          data: base64Data,
        },
      });
    });

    const promptText = `
      You are an elite, highly precise computer vision system specializing in document signature extraction.
      Your goal is to detect and extract the handwriting signature of the APPLICANT (also referred to as the Customer, Candidate, or Migrant Worker) from the uploaded pages.
      
      WHAT IS A VALID SIGNATURE (CRITICAL RULE):
      - A signature MUST BE a handwritten, cursive, or dynamic pen-ink scribble/shape drawn by hand with a pen.
      - It is NEVER printed text, typed text, or standard font characters.
      - It is NEVER a rectangular box, table cell border, stamp, date, barcode, passport photo, or blank region.
      - If a candidate has only typed or printed their name, do NOT treat that as a signature. Look for the handwritten scribble.
      - If you do not see a real handwritten/hand-drawn signature on any of the pages, do NOT extract anything.
      - If a page is a standalone signature scan or cropped image (containing only the handwritten signature scribble), extract the bounding box [ymin, xmin, ymax, xmax] around that handwritten signature scribble even if no printed label text is present on that page.
      
      CRITICAL EXTRACTION PRIORITY & LOGIC:
      1. ABSOLUTE HIGHEST PRIORITY FOR SPECIFIC DOCUMENTS:
         - Give Higher Priority to Signature extraction automatically to the "Self Declaration Form for Migrant Workers" (also files containing "Self Declaration", "Migrant Workers", "Declaration Form") AND any "document/page which only includes 'date and signature'" when thoroughly searching documents.
         - If any of these documents are found in the list, you MUST check them first and extract the applicant's signature from them.
         
      2. THOROUGH SEARCH FALLBACK:
         - If those specific high-priority documents are not found, or do not contain a clear signature, you MUST thoroughly search all other documents (such as general forms, letters, passport, or job applications) until you match and find the exact customer signature ("CUSTOMER SIGNATURE", "APPLICANT SIGNATURE", or zone labeled "SIGNATURE") to extract.
         - Do not stop until you have thoroughly checked every document page.
         
      3. CRITICAL - SPECIFIC SIGNATURE LABELS TO CHECK:
         - Thoroughly search for text blocks or sections labeled: "CUSTOMER SIGNATURE", "APPLICANT SIGNATURE", "SIGNATURE", "SEMNATURA", "SIGNATURE OF APPLICANT", "SIGNATURE OF THE APPLICANT", "SIGNATURE OF CUSTOMER".
         - Extract only the hand-written signature situated directly adjacent to, near, or above those labels.
         
      4. CRITICAL - AVOID ILLEGITIMATE / WRONG SIGNATURES (MISATTRIBUTION):
         - Avoid official or authority signatures (e.g., "Signature of Issuing Authority", "Superintendent of Police Signature", "Officer-in-Charge Signature", "Witness Signature", "Guardian Signature", "Authorized Officer", "Inspector", "Employer Signature").
         - Only extract the applicant/customer's own hand-written signature.
         
      5. STRICT CROP & UNNECESSARY TEXT REMOVAL INSTRUCTIONS:
         - To remove the background and unnecessary text, your bounding box [ymin, xmin, ymax, xmax] must be cropped EXTREMELY TIGHTLY around the signature's hand-written lines.
         - It must NOT include adjacent printed words (like "SIGNATURE", "DATE", names, labels) or table borders/lines.
         - Position the bottom edge (ymax) exactly on or just above the dotted or solid baseline, excluding the dotted/dashed line itself. The extracted box must contain ONLY the hand-written signature ink.
         
      6. COORDINATE MAPPING INSTRUCTIONS:
         - Provide the exact bounding box of the hand-written signature in the chosen page.
         - The coordinates MUST be normalized integers between 0 and 1000 in the format [ymin, xmin, ymax, xmax].
         - 0,0 is the top-left corner, and 1000,1000 is the bottom-right corner.
         - Be extremely precise so that the bounding box sits strictly above the dash line and is cropped tightly on the signature, excluding background noise.
      
      Return a JSON object matching this schema:
      {
        "found": boolean,
        "box": [number, number, number, number], // [ymin, xmin, ymax, xmax] coordinates from 0 to 1000
        "confidence": number, // 0.0 to 1.0
        "pageIndex": number // The 0-based index of the file/page containing the selected signature (must match the Document Page Index label of the page)
      }
    `;

    // Call Gemini API using modern @google/genai SDK via robust retry & fallback helper
    const response = await generateContentWithRetry(ai, {
      model: "gemini-3.7-flash",
      contents: [...contentParts, { text: promptText }],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            found: { type: Type.BOOLEAN, description: "True if a signature was successfully found" },
            box: {
              type: Type.ARRAY,
              description: "The [ymin, xmin, ymax, xmax] bounding box coordinates of the signature, normalized from 0 to 1000",
              items: { type: Type.INTEGER }
            },
            confidence: { type: Type.NUMBER, description: "The confidence score from 0.0 to 1.0" },
            pageIndex: { type: Type.INTEGER, description: "The 0-based index of the file/page containing the signature" }
          },
          required: ["found", "box", "confidence", "pageIndex"]
        },
        temperature: 0.1,
      },
    });

    const resultText = response.text;
    if (!resultText) {
      throw new Error("Empty response from Gemini API");
    }

    const parsedData = JSON.parse(resultText.trim());
    return res.json({ success: true, ...parsedData });
  } catch (error: any) {
    console.error("Error extracting signature:", error);
    return res.json({
      success: false,
      found: false,
      box: [0, 0, 0, 0],
      confidence: 0,
      pageIndex: 0,
      error: error.message || String(error),
    });
  }
});

// API Endpoint to classify uploaded document using AI vision
router.post("/api/classify-document", async (req, res) => {
  try {
    const { fileBase64, mimeType, fileName, forcedType, allFileNames } = req.body;

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({
        error: "GEMINI_API_KEY environment variable is not configured.",
      });
    }

    if (!fileBase64) {
      return res.status(400).json({ error: "Missing required field: fileBase64" });
    }

    const base64Data = fileBase64.replace(/^data:.*?;base64,/, "");
    const inlineData = {
      inlineData: {
        mimeType: mimeType || "image/jpeg",
        data: base64Data,
      },
    };

    const promptText = `
      You are an expert document classifier for official visa and work permit application files.
      Analyze the provided document page/image and recognize what type of document it is by reading text words, seals, stamps, layout, or visual format.
      
      We also provide some context metadata:
      - Current File Name: "${fileName || "Unknown"}"
      - Selected Upload Category/Slot (if any): "${forcedType || "None"}"
      - All File Names in this batch: "${allFileNames && Array.isArray(allFileNames) ? allFileNames.join(", ") : "Unknown"}"

      IMPORTANT SPECIAL DOCUMENT IDENTIFICATION RULES:
      1. Check the main header/title printed at the top of the page.
      2. If the document has a header at the top that reads "JOB APPLICATION FORM" or "APPLICATION FORM" (or mentions Job Application), you MUST set the title to exactly "Job Application Form".
      3. If the document has a header at the top that reads "SELF DECLARATION FORM FOR MIGRANT WORKERS" or "SELF DECLARATION" (or mentions Migrant Workers Self Declaration), you MUST set the title to exactly "Self Declaration Form for Migrant Workers".

      IMPORTANT HEURISTICS FOR MULTI-PAGE/PART DOCUMENTS (PASSPORTS & POLICE REPORTS):
      1. Passports and Police Reports frequently consist of multiple pages or parts (e.g., page 1: personal bio/photo page, page 2: visa stamps, signature page, address page, or booklet cover page; or police report front page: personal detail, police report back page: translation, stamp, apostille, or validation seals).
      2. If you see a document page that contains seals, stamps, signatures, translations, or blank passport booklet layouts, AND the Current File Name or other file names in the batch contain keywords like "passport", "pass", "pasaport", "police", "cazier", "clearance", "report", "doc", or "scan", you MUST classify it as "passport" or "police_report" accordingly, rather than "other".
      3. Do NOT classify passport pages (such as signature pages, visa stamp pages, cover pages) or police report pages (such as translation pages, back seal pages) as "other". They belong to the "passport" or "police_report" categories.

      Categorize strictly into one of these 4 types:
      1. "passport": Passport booklet page, passport photo/bio page, MRZ zone page, passport scan/copy, as well as secondary passport booklet pages (e.g., signature page, visa stamps page, blank booklet pages, passport cover page, or address page of the passport).
         - NOTE: Passports often have 2 pages in a scan. Ensure stamps, visa pages, cover pages, and signature pages of a passport are classified as "passport".
         - Look for headings like "PASAPORT", "PASSPORT", "REPUBLICA", national emblems, or biometric page layouts.
      2. "police_report": Police clearance certificate, Cazier judiciar, background check, character certificate, regional police report, or law enforcement clearance document, as well as any secondary pages (e.g., back page, official certification stamps, apostille pages, or translation/stamp pages of the police clearance report).
         - NOTE: Police reports often have 2 pages (front with details, back with stamps/apostille/translations). Ensure all such pages are classified as "police_report".
         - Look for headings like "CAZIER JUDICIAR", "POLICE CLEARANCE", "CERTIFICATE OF CHARACTER", "BACKGROUND CHECK", "POLICE REPORT", official stamps/seals, or law enforcement signatures.
      3. "applicant_photo": Portrait photo / headshot / passport size photograph of the applicant person (ID photograph).
         - CRITICAL DETECTOR RULE: You must detect whether the file contains ONLY a person's visible face/portrait headshot (like a passport photograph). 
         - A file (PDF or Image) containing text details of the applicant, a signature, an application form layout, a table, or multi-column fields must NEVER be classified as "applicant_photo", even if there is a small photo of the applicant on that page. It must be classified as "other" (or its specific category like "passport" or "police_report").
         - If the document is a PDF or image with applicant details and signatures, do NOT classify it as "applicant_photo".
         - An "applicant_photo" MUST strictly contain ONLY the applicant's face/headshot occupying most of the page/image area.
      4. "other": Any other document (such as diploma, CV page, school certificate, birth certificate, marriage certificate, driving license, work agreement, contract, utility bill, job application form, declaration form, etc.).
         - Note: If a PDF contains applicant details and signatures, classify it as "other" (or "passport" / "police_report" if applicable), NEVER "applicant_photo".

      Also generate a clear descriptive title for this document (e.g. "Passport Scan", "Police Clearance Report", "Applicant Photo", "Supporting Document").
      - For page 2 or secondary pages, generate an appropriate title (e.g., "Passport Scan (Page 2)", "Police Clearance Report (Back Page)").
      - If it matches Rule 2 or 3 of the special identification rules, you MUST use "Job Application Form" or "Self Declaration Form for Migrant Workers" as the title.

      Return JSON matching this schema:
      {
        "type": "passport" | "police_report" | "applicant_photo" | "other",
        "title": string,
        "confidence": number
      }
    `;

    const response = await generateContentWithRetry(ai, {
      model: "gemini-3.7-flash",
      contents: [inlineData, { text: promptText }],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            type: {
              type: Type.STRING,
              description: "Must be one of: 'passport', 'police_report', 'applicant_photo', 'other'"
            },
            title: {
              type: Type.STRING,
              description: "Short human-readable title for document"
            },
            confidence: {
              type: Type.NUMBER,
              description: "Confidence score between 0.0 and 1.0"
            }
          },
          required: ["type", "title", "confidence"]
        },
        temperature: 0.1,
      },
    });

    const resultText = response.text;
    if (!resultText) {
      throw new Error("Empty response from Gemini API");
    }

    const parsedData = JSON.parse(resultText.trim());
    return res.json({ success: true, ...parsedData });
  } catch (error: any) {
    console.error("Error classifying document with AI:", error);

    // Smart fallback based on fileName and mimeType so client never fails
    const fname = (req.body?.fileName || "").toLowerCase();
    const mtype = (req.body?.mimeType || "").toLowerCase();

    let docType = "other";
    let docTitle = req.body?.fileName ? req.body.fileName.replace(/\.[^/.]+$/, "").replace(/_/g, " ") : "Supporting Document";

    const isDetailsOrFormDocServer = (name: string): boolean => {
      const indicators = [
        "declaration", "declara", "form", "cerere", "application", "migrant",
        "job", "apply", "cv", "resume", "biodata", "contract", "agreement",
        "diploma", "certificate", "signature", "sign", "semnat", "sig",
        "details", "personal", "reference", "character", "recommendation",
        "sheet", "info", "work", "permit", "visa_application", "visa-application",
        "statement", "letter", "candidat", "candidate", "doc", "curriculum", "vitae"
      ];
      return indicators.some(ind => name.includes(ind));
    };

    if (isDetailsOrFormDocServer(fname)) {
      docType = "other";
      docTitle = req.body?.fileName ? req.body.fileName.replace(/\.[^/.]+$/, "").replace(/_/g, " ") : "Supporting Document";
    } else if (fname.includes("passport") || fname.includes("pasaport") || fname.includes("pass")) {
      docType = "passport";
      docTitle = "Passport Scan";
    } else if (
      fname.includes("police") || fname.includes("cazier") || fname.includes("clearance") ||
      fname.includes("report") || fname.includes("character") || fname.includes("background")
    ) {
      docType = "police_report";
      docTitle = "Police Clearance Report";
    } else if (
      (fname.includes("photo") || fname.includes("portrait") || fname.includes("avatar") ||
      fname.includes("face") || fname.includes("profile") || fname.includes("headshot") ||
      fname.includes("candidat") || fname.includes("poza") || fname.includes("personal") ||
      fname.includes("img") || fname.includes("image") || fname.includes("pic") || fname.includes("picture") ||
      mtype.startsWith("image/"))
    ) {
      docType = "applicant_photo";
      docTitle = "Applicant Photo";
    }

    return res.json({
      success: true,
      type: docType,
      title: docTitle,
      confidence: 0.8,
      fallback: true,
    });
  }
});

// API Endpoint to identify which of the provided images is strictly the applicant's standalone portrait/headshot photo
router.post("/api/identify-applicant-photo", async (req, res) => {
  try {
    const { images } = req.body; // Array of { id: string, fileBase64: string, mimeType: string, fileName: string }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({
        error: "GEMINI_API_KEY environment variable is not configured.",
      });
    }

    if (!images || !Array.isArray(images) || images.length === 0) {
      return res.json({ success: true, bestPhotoId: null });
    }

    // Prepare contents array for Gemini containing all images plus text prompt
    const contents: any[] = [];
    
    // We only send up to 8 images to save tokens and speed up API response
    const limitedImages = images.slice(0, 8);

    limitedImages.forEach((img) => {
      const base64Data = img.fileBase64.replace(/^data:.*?;base64,/, "");
      contents.push({
        inlineData: {
          mimeType: img.mimeType || "image/jpeg",
          data: base64Data,
        },
      });
    });

    const promptText = `
      You are an expert image analyzer. You are given a set of ${limitedImages.length} images uploaded by an applicant.
      Your task is to identify which image (by its 0-based index) is strictly the standalone portrait/headshot photograph of the applicant.
      
      The standalone portrait/headshot photograph MUST meet these criteria:
      1. It is an image showing strictly the person's face (headshot / passport photo / selfie / avatar / face photo).
      2. It must NOT contain text lists, handwritten signatures, multi-column tables, application form structures, contracts, CV text, or self-declaration sections.
      3. A page containing details and signatures with only a tiny embedded picture is NOT an applicant photo. It must be classified as a document.
      4. Standard documents (like full sheets of paper with text, passports with stamps/MRZ zones, police report tables) are NOT standalone portrait photos.
      
      Here are the 0-based index references and filenames for the images we provided above in sequence:
      ${limitedImages.map((img, idx) => `- Index ${idx}: ${img.fileName || "unknown"}`).join("\n")}
      
      Return a JSON object containing:
      - "bestPhotoIndex": The 0-based index of the image that is strictly the applicant's standalone portrait photo. If multiple match, choose the best headshot. If NONE of the images are strictly a standalone portrait photo of a face, return null.
      - "confidence": Your confidence score between 0.0 and 1.0.
      - "explanation": A very brief sentence explaining why you chose this image or why none of them match.
      
      Response MUST be in this JSON format:
      {
        "bestPhotoIndex": number | null,
        "confidence": number,
        "explanation": string
      }
    `;

    contents.push({ text: promptText });

    const response = await generateContentWithRetry(ai, {
      model: "gemini-3.7-flash",
      contents: contents,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            bestPhotoIndex: {
              type: Type.INTEGER,
              description: "0-based index of the best standalone portrait photo, or null if none."
            },
            confidence: {
              type: Type.NUMBER,
              description: "Confidence score between 0.0 and 1.0"
            },
            explanation: {
              type: Type.STRING,
              description: "Brief reason for selection"
            }
          },
          required: ["confidence", "explanation"]
        },
        temperature: 0.1,
      },
    });

    const resultText = response.text;
    if (!resultText) {
      throw new Error("Empty response from Gemini API");
    }

    const parsedData = JSON.parse(resultText.trim());
    
    let bestPhotoId: string | null = null;
    if (parsedData.bestPhotoIndex !== null && parsedData.bestPhotoIndex !== undefined && parsedData.bestPhotoIndex >= 0 && parsedData.bestPhotoIndex < limitedImages.length) {
      bestPhotoId = limitedImages[parsedData.bestPhotoIndex].id;
    }

    console.log(`[Photo Identification] Selected image ID ${bestPhotoId} (${parsedData.explanation})`);
    return res.json({ success: true, bestPhotoId, ...parsedData });

  } catch (error: any) {
    console.error("Error identifying applicant photo with AI:", error);
    return res.json({ success: false, bestPhotoId: null, error: error.message || String(error) });
  }
});


export default router;
