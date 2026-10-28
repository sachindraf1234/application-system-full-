// A syntactically successful AI response with only empty template rows is not an extraction.
// In particular, never treat a blank 'careers' array as successful identity recognition.
export function hasMeaningfulCvFields(data: unknown): boolean {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
  const fields = data as Record<string, unknown>;
  const identity = ['name', 'surname', 'passportNo', 'dateOfBirth'];
  return identity.filter(key => typeof fields[key] === 'string' && String(fields[key]).trim().length > 0).length >= 2;
}
