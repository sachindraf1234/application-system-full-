import * as pdfjsLib from 'pdfjs-dist';

// Set up worker for pdfjs-dist using unpkg CDN matching version 3.11.174
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js`;
}

export interface ConvertedDocPage {
  dataUrl: string;
  pageNumber: number;
  totalPages: number;
}

/**
 * Helper to convert OKLCH to standard RGB/RGBA mathematically for perfect html2canvas compatibility
 */
export const oklchToRgb = (l: number, c: number, hDeg: number, alpha: number = 1): string => {
  const h = (hDeg * Math.PI) / 180;
  
  // OKLCH -> OKLAB
  const L = l;
  const a = c * Math.cos(h);
  const b = c * Math.sin(h);
  
  // OKLAB -> LMS
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541167 * b;
  const s_ = L - 0.0894841775 * a - 1.2914855480 * b;
  
  // LMS -> LMS cubed
  const l_3 = l_ * l_ * l_;
  const m_3 = m_ * m_ * m_;
  const s_3 = s_ * s_ * s_;
  
  // LMS cubed -> linear RGB
  let r = +4.0767416621 * l_3 - 3.3077115913 * m_3 + 0.2309699292 * s_3;
  let g = -1.2684380046 * l_3 + 2.6097574011 * m_3 - 0.3413190470 * s_3;
  let b_ = -0.0041960863 * l_3 - 0.7034186147 * m_3 + 1.7076147010 * s_3;
  
  // Helper to gamma correct linear RGB
  const gamma = (v: number) => {
    return v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
  };
  
  r = Math.max(0, Math.min(1, gamma(r)));
  g = Math.max(0, Math.min(1, gamma(g)));
  b_ = Math.max(0, Math.min(1, gamma(b_)));
  
  const ri = Math.round(r * 255);
  const gi = Math.round(g * 255);
  const bi = Math.round(b_ * 255);
  
  if (alpha === 1) {
    return `rgb(${ri}, ${gi}, ${bi})`;
  } else {
    return `rgba(${ri}, ${gi}, ${bi}, ${alpha})`;
  }
};

/**
 * Helper to parse oklch(...) syntax and replace with standard RGB
 */
export const resolveOklchToRgb = (cssStr: string): string => {
  if (!cssStr || typeof cssStr !== "string" || !cssStr.toLowerCase().includes("oklch")) {
    return cssStr;
  }
  return cssStr.replace(/oklch\(([^)]+)\)/gi, (match, p1) => {
    try {
      const cleanP1 = p1.trim().replace(/,/g, " ");
      const parts = cleanP1.split(/\s*[\s/]\s*/).filter(Boolean);
      if (parts.length >= 3) {
        let l = parseFloat(parts[0]);
        if (parts[0].includes("%")) {
          l = l / 100;
        }
        let c = parseFloat(parts[1]);
        if (parts[1].includes("%")) {
          c = c / 100;
        }
        const hVal = parts[2].replace(/deg/g, "");
        let h = parseFloat(hVal);
        if (hVal.includes("rad")) {
          h = h * (180 / Math.PI);
        } else if (hVal.includes("turn")) {
          h = h * 360;
        }
        
        let alpha = 1;
        if (parts[3]) {
          const alphaVal = parts[3];
          alpha = parseFloat(alphaVal);
          if (alphaVal.includes("%")) {
            alpha = alpha / 100;
          }
        }
        
        if (!isNaN(l) && !isNaN(c) && !isNaN(h)) {
          return oklchToRgb(l, c, h, alpha);
        }
      }
    } catch (e) {
      console.warn("Failed parsing oklch", match, e);
    }
    return match;
  });
};

/**
 * Helper to resolve oklab colors to rgb
 */
export const resolveOklabToRgb = (cssStr: string): string => {
  return cssStr; // Fallback helper simple mock
};

/**
 * Converts a PDF File into an array of high-quality image Data URLs (one per page).
 * Includes robust fallback handling if PDF worker initialization fails.
 */
export async function convertPdfToImages(file: File): Promise<ConvertedDocPage[]> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    
    let pdf: pdfjsLib.PDFDocumentProxy;
    try {
      const loadingTask = pdfjsLib.getDocument({
        data: arrayBuffer,
        cMapUrl: 'https://unpkg.com/pdfjs-dist@3.11.174/cmaps/',
        cMapPacked: true,
      });
      pdf = await loadingTask.promise;
    } catch (workerErr) {
      console.warn('PDF.js worker loading failed, trying inline disableWorker fallback:', workerErr);
      const loadingTask = pdfjsLib.getDocument({
        data: arrayBuffer,
        cMapUrl: 'https://unpkg.com/pdfjs-dist@3.11.174/cmaps/',
        cMapPacked: true,
        disableWorker: true,
      } as any);
      pdf = await loadingTask.promise;
    }

    const pages: ConvertedDocPage[] = [];

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      // High scale factor (2.0 to 2.5) to preserve crisp document quality
      const viewport = page.getViewport({ scale: 2.2 });
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');

      canvas.width = viewport.width;
      canvas.height = viewport.height;

      if (context) {
        await page.render({
          canvasContext: context,
          viewport: viewport,
        }).promise;

        const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
        pages.push({
          dataUrl,
          pageNumber: pageNum,
          totalPages: pdf.numPages,
        });
      }
    }

    return pages;
  } catch (error) {
    console.error('Error rendering PDF with PDF.js:', error);
    throw error;
  }
}

/**
 * Converts a Base64 Data URL to a native File object synchronously without using fetch().
 * This avoids iframe CORS or NetworkError issues with data: URLs.
 */
export function dataUrlToFile(dataUrl: string, filename: string = "doc.pdf"): File {
  const arr = dataUrl.split(',');
  const mimeMatch = arr[0].match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
  const bstr = atob(arr[1] || '');
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new File([u8arr], filename, { type: mime });
}

/**
 * Reads an image file (JPEG, PNG, WebP) and returns its Data URL.
 */
export function readImageFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        resolve(e.target.result as string);
      } else {
        reject(new Error('Failed to read image file'));
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
