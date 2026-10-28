import {readFileSync} from 'node:fs';

/* Applicant-specific values are substituted into a privacy-sanitized copy of
 * the attached Python source. Its automation functions—including Save/Next,
 * uploads and legacy helpers—are preserved. No original identity is checked
 * into this source archive. The direct attached-candidate ZIP uses exact bytes. */
const pyTemplate=readFileSync(new URL('./templates/evisa_original_automation.py',import.meta.url),'utf8');
const batTemplate=readFileSync(new URL('./templates/evisa_original_run.bat',import.meta.url),'utf8');
const cdpTemplate=readFileSync(new URL('./templates/evisa_original_cdp.bat',import.meta.url),'utf8');
const field=(obj:any,key:string)=>typeof obj?.[key]==='string'?obj[key].slice(0,500):'';
const flag=(obj:any,key:string)=>typeof obj?.[key]==='boolean'?obj[key]:false;
const section=(obj:any)=>obj&&typeof obj==='object'&&!Array.isArray(obj)?obj:{};
const safeName=(value:any)=>String(value||'draft').replace(/[^A-Za-z0-9_-]/g,'').slice(0,35)||'draft';
// IDs below come from the attached script, not from a verified live portal.
// Never assign its Sri Lankan IDs to a different selected nationality.
const countryId=(name:string)=>/^sri\s*lanka$/i.test(name.trim())?'172':/^romania$/i.test(name.trim())?'119':'';
const nationalityId=(name:string)=>/^sri\s*lank(?:a|an)$/i.test(name.trim())?'214':'';
const sexId=(name:string)=>({male:'1',female:'2',other:'3'} as Record<string,string>)[name.trim().toLowerCase()]||'';
const civilId=(name:string)=>({single:'1',married:'2',separated:'3',divorced:'4',widowed:'5',widow:'5',widower:'5'} as Record<string,string>)[name.trim().toLowerCase()]||'';
const documentTypeId=(name:string)=>/^(ordinary|ordinary\/national) passport$/i.test(name.trim())?'16':'';
const replaceOne=(template:string,token:string,value:string)=>{
  if(template.split(token).length!==2)throw new Error(`Invalid original automation template: ${token}`);
  return template.replace(token,value);
};
const inlinePythonLiteral=(value:string)=>JSON.stringify(value).slice(1,-1).replaceAll('{','{{').replaceAll('}','}}');
const replaceInline=(template:string,token:string,value:string)=>{
  if(!template.includes(token))throw new Error(`Missing applicant literal: ${token}`);
  return template.replaceAll(token,inlinePythonLiteral(value));
};

export function buildOriginalAutomationPackage(applicant:any,folderInput:unknown,urlInput:unknown){
  const folder=typeof folderInput==='string'?folderInput.trim().slice(0,500):'';
  const url=typeof urlInput==='string'?urlInput.trim().slice(0,500):'';
  const parsed=URL.canParse(url)?new URL(url):null;
  if(!folder || !parsed || parsed.protocol!=='https:' || !['evisa.mae.ro','eviza.mae.ro'].includes(parsed.hostname) || parsed.username || parsed.password)
    throw new Error('Original workflow requires a local document folder and official HTTPS e-Visa URL.');
  const personal=section(applicant.personalData),travel=section(applicant.travelDoc),selection=section(applicant.selection);
  const address=section(applicant.addressData),host=section(applicant.hostData),company=section(applicant.companyContactData);
  const cost=section(applicant.costAndMeansData),visa=section(applicant.visaRequestedDetails);
  const journey=section(applicant.journeyDetailsData),family=section(applicant.familyData),spouse=section(applicant.spouseData);
  const id=safeName(applicant.fileNumber);
  const data={
    start_url:url,documents_folder:folder,photo_folder:folder,
    personal:{surname:field(personal,'surname'),first_name:field(personal,'first_names'),same_surname_at_birth:flag(personal,'same_surname_at_birth'),no_former_surname:flag(personal,'no_former_surnames'),dob_day:field(personal,'dob_day'),dob_month:field(personal,'dob_month'),dob_year:field(personal,'dob_year'),birth_date:'',birth_country:field(personal,'country_of_birth'),birth_country_id:countryId(field(personal,'country_of_birth')),place_of_birth:field(personal,'place_of_birth'),residence_country:field(personal,'country_of_residence'),residence_country_id:countryId(field(personal,'country_of_residence')),place_of_residence:field(personal,'place_of_residence'),nationality:field(personal,'current_nationality'),nationality_id:nationalityId(field(personal,'current_nationality')),nationality_at_birth:field(personal,'nationality_at_birth'),nationality_at_birth_id:nationalityId(field(personal,'nationality_at_birth')),gender:field(personal,'sex'),sex_id:sexId(field(personal,'sex')),marital_status:field(personal,'marital_status'),marital_status_id:civilId(field(personal,'marital_status')),phone:field(personal,'phone_number'),father_surname:field(family,'father_surname'),father_first_name:field(family,'father_first_name'),mother_surname:field(family,'mother_surname'),mother_first_name:field(family,'mother_first_name')},
    address:{home_country:field(address,'home_country'),place:field(address,'place'),address:field(address,'address')},
    travel_doc:{type:field(travel,'travel_document_type'),type_id:documentTypeId(field(travel,'travel_document_type')),number:field(travel,'passport_number'),issuing_country:field(travel,'issuing_country'),issuing_country_id:countryId(field(travel,'issuing_country')),authority:field(travel,'issuing_authority'),issue_date:field(travel,'date_of_issue'),expiry_date:field(travel,'valid_until'),residence_permission_return:field(travel,'residence_permission_return'),occupation:field(travel,'current_occupation'),occupation_id:'',other_occupation:field(travel,'other_occupation')},
    selection:{visa_type:field(selection,'visa_type'),current_nationality:field(selection,'current_nationality'),country_of_residence:field(selection,'country_of_residence'),diplomatic_mission:field(selection,'diplomatic_mission'),type_of_travel_document:field(selection,'type_of_travel_document'),is_biometric:field(selection,'is_biometric'),visa_purpose:field(selection,'visa_purpose'),particular_situation:field(selection,'particular_situation'),territorial_jurisdiction:field(selection,'territorial_jurisdiction')},
    journey:{arrival_date:field(journey,'arrival_date'),departure_date:field(journey,'departure_date'),first_entry_state:field(journey,'first_entry_state'),first_entry_state_id:countryId(field(journey,'first_entry_state')),border_post:field(journey,'border_post'),planned_route:field(journey,'planned_route'),destination:field(journey,'main_destination_state'),stay_days:field(visa,'duration_of_stay'),work_permit_number:field(company,'work_permit_number'),igi_doc_number:''},
    company:{name:field(company,'name'),phone:field(company,'telephone_fax'),address:field(company,'full_address'),email:field(company,'email'),work_permit_number:field(company,'work_permit_number'),igi_doc_number:''},
    cost_means:{sponsor_name:field(cost,'host_name'),cost_coverage_val:field(cost,'cost_covered_by'),support_cash:flag(cost,'means_cash'),support_accommodation:flag(cost,'means_accommodation'),support_insurance:flag(cost,'means_insurance'),insurance_expiry:field(cost,'insurance_valid_until')},
    applicant_civil_status:typeof applicant.applicant_civil_status==='string'?applicant.applicant_civil_status:'',
    spouse:{},spouseData:{spouse_surname:field(spouse,'spouse_surname'),spouse_first_names:field(spouse,'spouse_first_names'),spouse_surname_at_birth:field(spouse,'spouse_surname_at_birth'),spouse_dob_day:field(spouse,'spouse_dob_day'),spouse_dob_month:field(spouse,'spouse_dob_month'),spouse_dob_year:field(spouse,'spouse_dob_year'),spouse_country_of_birth:field(spouse,'spouse_country_of_birth'),spouse_place_of_birth:field(spouse,'spouse_place_of_birth')},
    visa_requested:{main_destination:field(visa,'main_destination'),entry_type:field(visa,'number_of_entries'),duration_days:field(visa,'duration_of_stay'),previous_stays:field(visa,'previous_stays'),means_of_transport:field(visa,'means_of_transport')},
    host:{type:field(host,'type_of_host'),name:field(host,'hotel_name'),address:field(host,'host_address'),contact_person:''},
    aiExtractedData:{PersonalData:{},CompanyContactData:{},APPLICANT_CIVIL_STATUS:'',SpouseData:{}},
    files:{permit:'',support:'',agreement:'',criminal:'',insurance:'',passport:'',photo:''},documents:[],photoDataUrl:''
  };
  const fullName=[field(personal,'surname'),field(personal,'first_names')].filter(Boolean).join(' ');
  let script=replaceOne(pyTemplate,'__ORIGINAL_FOLDER__',JSON.stringify(folder));
  script=replaceOne(script,'__ORIGINAL_COMPANY__',JSON.stringify(data.company.name));
  script=replaceOne(script,'__ORIGINAL_BATCH__',JSON.stringify(''));
  script=replaceOne(script,'__ORIGINAL_NAME__',JSON.stringify(fullName));
  script=replaceOne(script,'__ORIGINAL_DATA__',JSON.stringify(JSON.stringify(data)));
  script=replaceOne(script,'__ORIGINAL_ID__',id);
  for(const [token,value] of Object.entries({
    __DATA_PHONE__:data.personal.phone,
    __DATA_PASSPORT__:data.travel_doc.number,
    __DATA_FULL_NAME__:fullName,
    __DATA_SPOUSE_FIRST_NAMES__:data.spouseData.spouse_first_names,
    __DATA_FIRST_NAMES__:data.personal.first_name,
    __DATA_ADDRESS__:data.address.address,
    __DATA_SURNAME__:data.personal.surname,
    __DATA_MOTHER_SURNAME__:data.personal.mother_surname,
    __DATA_MOTHER_FIRST_NAME__:data.personal.mother_first_name,
    __DATA_FATHER_FIRST_NAME__:data.personal.father_first_name,
    __DATA_BIRTH_PLACE__:data.personal.place_of_birth,
    __DATA_RESIDENCE_PLACE__:data.address.place||data.personal.place_of_residence
  }))script=replaceInline(script,token,value);
  const pythonFilename=`evisa_automation_${id}.py`;
  const batFilename=`run_evisa_automation_${id}.bat`;
  const cdpFilename=`launch_chrome_cdp_${id}.bat`;
  const bat=batTemplate.replaceAll('__ORIGINAL_ID__',id);
  const cdp=cdpTemplate.replaceAll('__ORIGINAL_ID__',id);
  const requirements='playwright>=1.45.0,<2.0.0\npython-dotenv>=1.0.0\nopencv-python>=4.8.0\nnumpy>=1.24.0\nPillow>=10.0.0\npypdf>=5,<8\n';
  const readme=`ORIGINAL E-VISA AUTOMATION PACKAGE (ADAPTED FOR ${id})\n\nContains the applicant-specific adaptation of the attached 11,708-line Python automation, its two Windows launchers, requirements and this README. Unlike the separate conservative draft assistant, the original script automatically drives the portal's Save/Next controls and optional document-upload flow. It does NOT perform the final manual visa submission.\n\nFolder reference: ${folder}\nOfficial e-Visa URL: ${url}\nApplicant source: selected application's populated fields. Missing fields and portal-specific dropdown IDs remain blank; review every value and legacy fallback before running. No document bytes or user-supplied scanned files are included in this ZIP.\n\nWindows: extract this ZIP, inspect the script and requirements, put the real documents on YOUR PC in the listed folder, then double-click ${batFilename}. This launcher installs Python dependencies/Chromium and runs ${pythonFilename}. The optional ${cdpFilename} opens Chrome with remote-debugging port 9222 and lets the script attach to an existing browser: only run this if you understand the security implications. By default the Python script also attempts an isolated browser if CDP is unavailable.\n\nThe Python automation functions are unchanged from the attachment; only applicant-specific values, local folder and URL are substituted. It was NOT live-tested against today's e-Visa portal. It contains legacy selector fallbacks, file discovery and automatic Save/Next actions. In the original flow Next can be clicked even if Save was not found. Do not run it with real documents until you verify applicant data, file mapping, login/session, portal URL, stage transitions and the current page controls. Final submission must remain human-controlled.\n`;
  return {script,bat,cdp,requirements,readme,pythonFilename,batFilename,cdpFilename};
}
