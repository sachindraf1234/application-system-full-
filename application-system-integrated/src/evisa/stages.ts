// Stage identifiers remain available for script generation and stage-entry routing.
// The former application-stages visualizer is not part of the workspace UI.
export const PIPELINE_STAGES = [
  {id:'SELECT_VISA_TYPE',name:'1. Visa Type'},
  {id:'DIPLOMATIC_MISSION',name:'2. Consular Post'},
  {id:'VISA_PURPOSE',name:'3. Purpose of Stay'},
  {id:'PARTICULAR_SITUATIONS',name:'4. Particulars'},
  {id:'TERRITORIAL_JURISDICTION',name:'5. Jurisdiction'},
  {id:'PERSONAL_DATA',name:'7. Personal Data'},
  {id:'TRAVEL_DOCUMENT_OCCUPATION',name:'8. Passport & Job'},
  {id:'APPLICANT_HOME_ADDRESS',name:'9. Home Address'},
  {id:'HOST_DETAILS',name:'10. Host Details'},
  {id:'COMPANY_CONTACT',name:'11. Company Contact'},
  {id:'DETAILS_ABOUT_VISA',name:'12. Visa Requested'},
  {id:'COST_AND_MEANS',name:'13. Cost & Means'},
  {id:'FAMILY_DETAILS',name:'14. Family & Spouse'},
  {id:'DETAILS_REGARDING_JOURNEY',name:'15. Journey Details'},
  {id:'PHOTO_UPLOAD',name:'16. Biometric Photo'},
  {id:'SUMMARY_FILE',name:'17. Summary File'},
] as const;
