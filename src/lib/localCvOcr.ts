import type { OCRSuggestion } from '../utils/ocrFields';

/** CV-only local review path. AI has already been attempted by the caller. */
export async function extractLocalCvSuggestions(files: Array<{name: string; base64: string; type: string}>): Promise<{suggestions: OCRSuggestion[]; text: string; engine: string; confidence: number}> {
  const { convertPdfToImages, dataUrlToFile } = await import('../utils/pdfUtils');
  const images: string[] = [];
  for (const file of files) {
    if (images.length >= 5) break;
    if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
      const pages = await convertPdfToImages(dataUrlToFile(file.base64, file.name), 5 - images.length);
      images.push(...pages.map(page => page.dataUrl));
    } else if (/^data:image\/(?:png|jpeg|webp);base64,/.test(file.base64)) {
      images.push(file.base64);
    }
  }
  if (!images.length) throw new Error('No readable image/PDF pages for local OCR. Enter the applicant details manually.');
  const response = await fetch('/api/ocr/local', {
    method: 'POST', headers: {'Content-Type':'application/json'},
    body: JSON.stringify({images, languages:['eng','sin']})
  });
  const result = await response.json();
  if (!response.ok || !result.success) throw new Error(result.error || 'Local OCR is unavailable. Enter details manually.');
  return {suggestions: result.suggestions || [], text: result.text || '', engine: result.engine || 'Local OCR', confidence: result.confidence || 0};
}
