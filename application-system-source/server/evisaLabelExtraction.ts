import { newEvisaRecord } from '../src/evisa/defaults.js';

// Conservative, section-aware fallback for clearly labelled text. It never
// guesses identity, marriage, travel dates, employer, nationality, or birth data.
const rules:Record<string,Record<string,Record<string,string[]>>>={
  applicant:{
    PersonalData:{surname:['Surname','Applicant Surname'],first_names:['First Names','Given Names','Applicant First Names'],surname_at_birth:['Surname at Birth'],dob_day:['Birth Day'],dob_month:['Birth Month'],dob_year:['Birth Year'],country_of_birth:['Country of Birth'],place_of_birth:['Place of Birth'],country_of_residence:['Country of Residence'],place_of_residence:['Place of Residence'],current_nationality:['Nationality','Current Nationality'],nationality_at_birth:['Nationality at Birth'],sex:['Sex','Gender'],marital_status:['Civil Status','Marital Status'],phone_number:['Phone Number','Telephone']},
    TravelDocument:{travel_document_type:['Travel Document Type','Passport Type'],passport_number:['Passport Number','Passport No'],issuing_country:['Passport Issuing Country'],issuing_authority:['Issuing Authority'],date_of_issue:['Date of Issue','Passport Issue Date'],valid_until:['Valid Until','Passport Expiry Date','Date of Expiry'],residence_permission_return:['Residence Permission'],current_occupation:['Current Occupation','Job Position'],other_occupation:['Other Occupation']},
    AddressData:{home_country:['Home Country'],place:['Address Place'],address:['Home Address','Residence Address','Address']},
    FamilyData:{father_surname:['Father Surname'],father_first_name:['Father First Name'],mother_surname:['Mother Surname'],mother_first_name:['Mother First Name']},
    VisaApplicationSelection:{visa_type:['Visa Type'],diplomatic_mission:['Diplomatic Mission','Consular Post'],visa_purpose:['Visa Purpose','Purpose of Stay'],particular_situation:['Particular Situation'],territorial_jurisdiction:['Territorial Jurisdiction'],is_biometric:['Is Biometric','Biometric Passport']},
    JourneyDetailsData:{arrival_date:['Intended Arrival','Arrival Date'],departure_date:['Intended Departure','Departure Date'],first_entry_state:['First Entry State'],border_post:['Border Post'],main_destination_state:['Main Destination State'],planned_route:['Planned Route']},
    VisaRequestedDetails:{main_destination:['Main Destination'],number_of_entries:['Number of Entries'],duration_of_stay:['Duration of Stay'],previous_stays:['Previous Stays'],means_of_transport:['Means of Transport']},
    CostAndMeansData:{cost_covered_by:['Cost Coverage','Cost Covered By'],insurance_valid_until:['Insurance Valid Until']},
  },
  spouse:{SpouseData:{spouse_surname:['Spouse Surname','Surname'],spouse_first_names:['Spouse First Names','Spouse First Name','First Names'],spouse_surname_at_birth:['Spouse Surname at Birth','Surname at Birth'],spouse_dob_day:['Spouse Birth Day'],spouse_dob_month:['Spouse Birth Month'],spouse_dob_year:['Spouse Birth Year'],spouse_country_of_birth:['Spouse Country of Birth','Country of Birth'],spouse_place_of_birth:['Spouse Place of Birth','Place of Birth']}},
  company:{CompanyContactData:{name:['Company Name','Employer Name','Societatea'],telephone_fax:['Telephone/Fax','Company Phone','Phone Number'],full_address:['Company Address','Full Address'],email:['Company Email','Email'],work_permit_number:['Work Permit Number','Aviz de Munca']},HostData:{type_of_host:['Type of Host'],hotel_name:['Host Name','Hotel Name'],host_address:['Host Address']}},
  other:{CostAndMeansData:{insurance_valid_until:['Insurance Valid Until','Travel Medical Insurance Valid Until'],cost_covered_by:['Cost Coverage','Cost Covered By']},JourneyDetailsData:{arrival_date:['Arrival Date','Intended Arrival'],departure_date:['Departure Date','Intended Departure'],planned_route:['Planned Route']},VisaRequestedDetails:{means_of_transport:['Means of Transport'],number_of_entries:['Number of Entries']}},
};
const groupMap:Record<string,string>={PersonalData:'personalData',TravelDocument:'travelDoc',AddressData:'addressData',FamilyData:'familyData',VisaApplicationSelection:'selection',JourneyDetailsData:'journeyDetailsData',VisaRequestedDetails:'visaRequestedDetails',CostAndMeansData:'costAndMeansData',SpouseData:'spouseData',CompanyContactData:'companyContactData',HostData:'hostData'};
const defaults=newEvisaRecord() as unknown as Record<string,Record<string,unknown>>;
const normalized=(label:string)=>label.toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
function parseDates(label:string,value:string,group:Record<string,string>) {
  if(!/^(?:date of birth|spouse date of birth)$/.test(label))return;
  const iso=/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(value);
  const dmy=/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(value);
  const parts=iso?[iso[3],iso[2],iso[1]]:dmy?[dmy[1],dmy[2],dmy[3]]:null;
  if(parts){const prefix=label.startsWith('spouse')?'spouse_dob_':'dob_';[prefix+'day',prefix+'month',prefix+'year'].forEach((key,index)=>group[key]=parts[index]);}
}
export function extractEvisaLabels(text:string) {
  const sections:Record<string,string[]>={applicant:[],spouse:[],company:[],other:[]};
  let current='applicant';
  for(const line of text.split(/\r?\n/)){
    const cat=/^\s*(Applicant|Spouse|Company|Other)\s*:(.*)$/i.exec(line);
    if(cat){current=cat[1].toLowerCase();if(cat[2].trim())sections[current].push(cat[2]);continue;}
    sections[current].push(line);
  }
  const result:Record<string,Record<string,string>>={};
  for(const [category,lines] of Object.entries(sections)){
    for(const line of lines){
      const entry=/^\s*([^:]{2,80}):\s*(.{1,500})\s*$/.exec(line);if(!entry)continue;
      const label=normalized(entry[1]);const value=entry[2].trim();
      if(!value || /^\.{2,}$/.test(value))continue;
      for(const [section,fields] of Object.entries(rules[category])){
        const group=result[section]||{};
        for(const [key,aliases] of Object.entries(fields))if(aliases.some(alias=>normalized(alias)===label) && Object.hasOwn(defaults[groupMap[section]]||{},key))group[key]=value;
        if(section==='PersonalData' || section==='SpouseData')parseDates(label,value,group);
        if(Object.keys(group).length)result[section]=group;
      }
    }
  }
  return result;
}
