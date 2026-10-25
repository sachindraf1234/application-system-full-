// Conservative, language-aware label matcher. OCR is not a verified identity source:
// every suggestion is shown to the operator before it can change a form.
export interface OCRSuggestion { field: string; value: string; evidence: string; confidence: number }

const rules: Array<{ field: string; label: RegExp; type?: 'date' | 'number' }> = [
  { field: 'se_number', label: /^(?:se[ -]?(?:number|no\.?|#)|එස් ඊ අංකය|எஸ் ஈ எண்)\s*[:：\-]?\s*(.*)$/i },
  { field: 'e_number', label: /^(?:e[ -]?(?:number|no\.?|#)|ඊ අංකය|ஈ எண்)\s*[:：\-]?\s*(.*)$/i },
  { field: 'company_name', label: /^(?:company(?: name)?|employer|ආයතනය|සමාගමේ නම|நிறுவனத்தின் பெயர்)\s*[:：\-]?\s*(.*)$/i },
  { field: 'embassy_applied_date', label: /^(?:embassy applied date|appointment date|application date|තානාපති කාර්යාල දිනය|விண்ணப்ப தேதி)\s*[:：\-]?\s*(.*)$/i, type: 'date' },
  { field: 'surname', label: /^(?:surname|family name|last name|වාසගම|පෙළපත් නම|குடும்பப் பெயர்|கடைசிப் பெயர்)\s*[:：\-]?\s*(.*)$/i },
  { field: 'name', label: /^(?:given names?|first names?|other names?|name|නම|මුල් නම|பெயர்|முதல் பெயர்)\s*[:：\-]?\s*(.*)$/i },
  { field: 'passportNo', label: /^(?:passport\s*(?:no\.?|number|nr\.?|#)?|ගමන් බලපත්ර අංකය|கடவுச்சீட்டு எண்)\s*[:：\-]?\s*(.*)$/i },
  { field: 'dateOfBirth', label: /^(?:date of birth|birth date|dob|උපන් දිනය|උපන් දිනයන්|பிறந்த தேதி)\s*[:：\-]?\s*(.*)$/i, type: 'date' },
  { field: 'placeOfBirth', label: /^(?:place of birth|birth place|උපන් ස්ථානය|பிறந்த இடம்)\s*[:：\-]?\s*(.*)$/i },
  { field: 'passportIssuedDate', label: /^(?:date of issue|issued on|issue date|නිකුත් කළ දිනය|வழங்கப்பட்ட தேதி)\s*[:：\-]?\s*(.*)$/i, type: 'date' },
  { field: 'passportValidTo', label: /^(?:date of expiry|expiry date|expires?|valid (?:until|to)|කල් ඉකුත් වන දිනය|காலாவதி தேதி)\s*[:：\-]?\s*(.*)$/i, type: 'date' },
  { field: 'residence', label: /^(?:residential address|permanent address|residence|address|ලිපිනය|පදිංචි ලිපිනය|முகவரி|வசிப்பிடம்)\s*[:：\-]?\s*(.*)$/i },
  { field: 'phone', label: /^(?:mobile(?: number)?|telephone|phone(?: number)?|දුරකථන අංකය|ජංගම දුරකථන|தொலைபேசி எண்)\s*[:：\-]?\s*(.*)$/i },
  { field: 'email', label: /^(?:e[ -]?mail(?: address)?|විද්‍යුත් තැපෑල|மின்னஞ்சல்)\s*[:：\-]?\s*(.*)$/i },
  { field: 'nationality', label: /^(?:nationality|citizenship|ජාතිකත්වය|පුරවැසිභාවය|தேசியம்|குடியுரிமை)\s*[:：\-]?\s*(.*)$/i },
  { field: 'maritalStatus', label: /^(?:marital status|civil status|විවාහක තත්ත්වය|திருமண நிலை)\s*[:：\-]?\s*(.*)$/i },
  { field: 'professionalSkill', label: /^(?:job title|occupation|position|profession|රැකියාව|தொழில்|பதவி)\s*[:：\-]?\s*(.*)$/i },
  { field: 'fatherName', label: /^(?:father(?:'s)? name|පියාගේ නම|தந்தையின் பெயர்)\s*[:：\-]?\s*(.*)$/i },
  { field: 'motherName', label: /^(?:mother(?:'s)? name|මවගේ නම|தாயின் பெயர்)\s*[:：\-]?\s*(.*)$/i },
  { field: 'nic_number', label: /^(?:national identity card(?: number)?|nic(?: number| no\.?| #)?|ජාතික හැඳුනුම්පත් අංකය|தேசிய அடையாள அட்டை எண்)\s*[:：\-]?\s*(.*)$/i }
];

const normalizeDate = (value: string) => {
  const match = /\b(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\b/.exec(value);
  if (match) return `${match[3].padStart(2,'0')}/${match[2].padStart(2,'0')}/${match[1]}`;
  return /\b\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}\b/.exec(value)?.[0] || value;
};

export function suggestFields(text: string, ocrConfidence = 100): OCRSuggestion[] {
  const lines = text.normalize('NFKC').split(/\r?\n/).map(line => line.replace(/[\t ]+/g, ' ').trim()).filter(Boolean);
  const found = new Map<string, OCRSuggestion>();
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    // Sinhala OCR frequently inserts zero-width joiners inside printed labels.
    const comparable = line.replace(/[\u200c\u200d]/g, '');
    for (const rule of rules) {
      const match = rule.label.exec(comparable);
      if (!match) continue;
      const rawAfterColon = /[:：]/.test(line) ? line.split(/[:：]/).slice(1).join(':').trim() : '';
      let value = rawAfterColon || match[1]?.trim() || '';
      if (!value && lines[index + 1] && !rules.some(item => item.label.test(lines[index + 1]))) value = lines[index + 1];
      value = value.replace(/^[\s:：\-–]+/, '').replace(/[|\s]+$/, '').slice(0, 180);
      if (rule.type === 'date') value = normalizeDate(value);
      const unverifiedPassport = rule.field === 'passportNo' && (/[^A-Z0-9\s-]/i.test(value) || !/[A-Z]/i.test(value));
      if (rule.field === 'passportNo') value = value.replace(/[^A-Z0-9]/gi,'').toUpperCase();
      if (rule.field === 'email') value = /[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/.exec(value)?.[0] || '';
      if (!value || value.length > 180 || found.has(rule.field)) continue;
      // A suggestion is a label/value match, never a verified fact.
      found.set(rule.field, { field: rule.field, value, evidence: unverifiedPassport ? `Uncertain passport characters: ${line.slice(0, 200)} — verify against document before selection` : line.slice(0, 240), confidence: unverifiedPassport ? 0.25 : Math.min(0.85, Math.max(0.25, ocrConfidence / 100 * 0.84)) });
    }
  }
  if (!found.has('email')) {
    const email = /[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/.exec(text)?.[0];
    if (email) found.set('email', { field:'email', value:email, evidence:email, confidence:0.68 });
  }
  // ICAO MRZ is a useful secondary hint when legible. Never overwrite explicit labels.
  const mrz = lines.find(line => /^P<[A-Z]{3}[A-Z<]{8,}/.test(line.replace(/\s/g,'')));
  if (mrz) {
    const names = mrz.replace(/\s/g,'').slice(5).split('<<');
    if (names.length > 1) {
      if (!found.has('surname') && names[0].replace(/</g,'').length > 1) found.set('surname', {field:'surname',value:names[0].replace(/</g,' ').trim(),evidence:mrz,confidence:0.58});
      if (!found.has('name') && names[1].replace(/</g,'').length > 1) found.set('name', {field:'name',value:names[1].replace(/</g,' ').trim(),evidence:mrz,confidence:0.58});
    }
  }
  return [...found.values()];
}
