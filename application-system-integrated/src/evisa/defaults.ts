import type { ApplicantRecord, AutomationConfig } from './types';
import type { ApplicantOverview } from '../types';

// The upstream sample applicant is deliberately NOT used. A new record begins blank.
export function newEvisaRecord(): ApplicantRecord {
  const now = new Date().toISOString();
  return {
    id: '', fileNumber: '', status: 'Draft', applicant_civil_status: '',
    selection: { visa_type:'', current_nationality:'', country_of_residence:'', diplomatic_mission:'', type_of_travel_document:'', is_biometric:'', visa_purpose:'', particular_situation:'', territorial_jurisdiction:'' },
    personalData: { surname:'', first_names:'', surname_at_birth:'', same_surname_at_birth:false, former_surnames:'', no_former_surnames:false, dob_day:'', dob_month:'', dob_year:'', country_of_birth:'', place_of_birth:'', country_of_residence:'', place_of_residence:'', current_nationality:'', nationality_at_birth:'', sex:'', marital_status:'', phone_number:'' },
    travelDoc: { travel_document_type:'', passport_number:'', issuing_country:'', issuing_authority:'', date_of_issue:'', valid_until:'', residence_permission_return:'', current_occupation:'', other_occupation:'', employer_name:'', employer_phone:'', employer_address:'' },
    familyData: { father_surname:'', father_first_name:'', mother_surname:'', mother_first_name:'' },
    spouseData: { spouse_surname:'', spouse_first_names:'', spouse_surname_at_birth:'', spouse_dob_day:'', spouse_dob_month:'', spouse_dob_year:'', spouse_country_of_birth:'', spouse_place_of_birth:'' },
    hostData: { type_of_host:'', hotel_name:'', host_address:'' },
    addressData: { home_country:'', place:'', address:'' },
    visaRequestedDetails: { main_destination:'', number_of_entries:'', duration_of_stay:'', previous_stays:'', means_of_transport:'' },
    companyContactData: { name:'', telephone_fax:'', full_address:'', email:'', work_permit_number:'' },
    costAndMeansData: { cost_covered_by:'', host_name:'', means_cash:false, means_travellers_cheques:false, means_accommodation:false, means_credit_cards:false, means_insurance:false, insurance_valid_until:'', means_other:false },
    journeyDetailsData: { arrival_date:'', departure_date:'', first_entry_state:'', border_post:'', main_destination_state:'', planned_route:'' },
    createdAt: now, updatedAt: now
  };
}

export const defaultEvisaConfig: AutomationConfig = {
  targetMode: 'FULL_PIPELINE', chromeHost:'', chromePort:0, elementWaitTimeoutSec:5,
  pageSaveTimeoutSec:10, crashDetectionEnabled:false, autoSaveEachStage:false,
  verboseLogging:false, browserHeadlessMode:false
};

export function recordFromRegistry(person: ApplicantOverview, passport?: {passport_number?:string;date_of_issue?:string;date_of_expiry?:string;place_of_birth?:string}, embassy?: {e_number?:string;company_name?:string}): ApplicantRecord {
  const result = newEvisaRecord();
  const dob = person.date_of_birth?.split('-') || [];
  return {
    ...result, id: person.applicant_id, fileNumber: embassy?.e_number || '',
    applicant_civil_status: (['Married','Single','Divorced','Widowed','Separated'].includes(person.civil_status || '') ? person.civil_status : '') as ApplicantRecord['applicant_civil_status'],
    personalData: {...result.personalData, surname: person.surname || '', first_names:person.other_name || '', dob_day:dob[2] || '', dob_month:dob[1] || '', dob_year:dob[0] || '', sex:person.gender || '', marital_status:person.civil_status || '', phone_number:person.mobile_number || '', place_of_residence:person.living_place || '', current_nationality:person.nationality || ''},
    travelDoc: {...result.travelDoc, passport_number:passport?.passport_number || person.passport_number || '', date_of_issue:passport?.date_of_issue || '', valid_until:passport?.date_of_expiry || ''},
    addressData: {...result.addressData, address:person.address || '', place:person.living_place || ''},
    companyContactData: {...result.companyContactData, name:embassy?.company_name || ''}
  };
}
