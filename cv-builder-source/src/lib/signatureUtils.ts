// Helper utilities for canvas signature processing, background transparentization, and bounding-box cropping

export const makeCanvasBackgroundTransparent = (canvas: HTMLCanvasElement): void => {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const W = canvas.width;
  const H = canvas.height;
  if (!W || !H) return;

  const imgData = ctx.getImageData(0, 0, W, H);
  const data = imgData.data;

  // 1. Identify paper background color from four corners, but only use bright corners
  const cornerRgb: [number, number, number][] = [
    [data[0], data[1], data[2]],
    [data[(W - 1) * 4], data[(W - 1) * 4 + 1], data[(W - 1) * 4 + 2]],
    [data[(H - 1) * W * 4], data[(H - 1) * W * 4 + 1], data[(H - 1) * W * 4 + 2]],
    [data[((H - 1) * W + (W - 1)) * 4], data[((H - 1) * W + (W - 1)) * 4 + 1], data[((H - 1) * W + (W - 1)) * 4 + 2]],
  ];

  const validCorners = cornerRgb.filter(([r, g, b]) => r > 160 && g > 160 && b > 160);
  const isNormalLightBg = validCorners.length > 0;

  let bgR = 255, bgG = 255, bgB = 255;
  if (isNormalLightBg) {
    bgR = Math.round(validCorners.reduce((acc, c) => acc + c[0], 0) / validCorners.length);
    bgG = Math.round(validCorners.reduce((acc, c) => acc + c[1], 0) / validCorners.length);
    bgB = Math.round(validCorners.reduce((acc, c) => acc + c[2], 0) / validCorners.length);
  }

  const bgLuminance = 0.299 * bgR + 0.587 * bgG + 0.114 * bgB;

  for (let i = 0; i < W * H; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];

    const luminance = 0.299 * r + 0.587 * g + 0.114 * b;

    if (isNormalLightBg) {
      const distToBg = Math.sqrt(
        Math.pow(r - bgR, 2) + Math.pow(g - bgG, 2) + Math.pow(b - bgB, 2)
      );

      // Clean paper background without destroying light blue ink or ballpoint strokes
      if (distToBg < 35 && luminance > 140) {
        data[i * 4 + 3] = 0; // Transparent
      } else if (distToBg < 50 && luminance > bgLuminance - 25) {
        // Edge of paper background
        const alpha = Math.max(0, Math.min(255, Math.round(((distToBg - 35) / 15) * 255)));
        data[i * 4 + 3] = alpha;
      } else {
        // Genuine pen ink (blue, black, navy, etc.)
        // Enhance ink contrast cleanly without erasing
        data[i * 4] = Math.max(0, Math.min(r, 15));
        data[i * 4 + 1] = Math.max(0, Math.min(g, 30));
        data[i * 4 + 2] = Math.max(0, Math.min(b, 110));
        data[i * 4 + 3] = 255;
      }
    } else {
      // Dark/inverted background
      if (luminance > 100) {
        data[i * 4] = 12;
        data[i * 4 + 1] = 24;
        data[i * 4 + 2] = 90;
        data[i * 4 + 3] = 255;
      } else {
        data[i * 4 + 3] = 0;
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);
  removeDottedLinesFromCanvas(canvas);
};

export const removeDottedLinesFromCanvas = (canvas: HTMLCanvasElement): void => {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const W = canvas.width;
  const H = canvas.height;
  if (!W || !H || W < 5 || H < 5) return;

  const imgData = ctx.getImageData(0, 0, W, H);
  const data = imgData.data;

  // 1. Identify non-transparent ink pixels
  const isInk = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) {
    isInk[i] = data[i * 4 + 3] > 30 ? 1 : 0;
  }

  // 2. Find connected components (blobs)
  const visited = new Uint8Array(W * H);
  const blobs: { pixels: number[]; minX: number; maxX: number; minY: number; maxY: number; centerY: number; width: number; height: number }[] = [];

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = y * W + x;
      if (isInk[idx] && !visited[idx]) {
        const queue = [idx];
        visited[idx] = 1;
        const pixels: number[] = [];
        let minX = x, maxX = x, minY = y, maxY = y;

        let head = 0;
        while (head < queue.length) {
          const curr = queue[head++];
          pixels.push(curr);
          const cx = curr % W;
          const cy = Math.floor(curr / W);

          if (cx < minX) minX = cx;
          if (cx > maxX) maxX = cx;
          if (cy < minY) minY = cy;
          if (cy > maxY) maxY = cy;

          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              if (dx === 0 && dy === 0) continue;
              const nx = cx + dx;
              const ny = cy + dy;
              if (nx >= 0 && nx < W && ny >= 0 && ny < H) {
                const nidx = ny * W + nx;
                if (isInk[nidx] && !visited[nidx]) {
                  visited[nidx] = 1;
                  queue.push(nidx);
                }
              }
            }
          }
        }

        const width = maxX - minX + 1;
        const height = maxY - minY + 1;
        const centerY = (minY + maxY) / 2;

        blobs.push({ pixels, minX, maxX, minY, maxY, centerY, width, height });
      }
    }
  }

  const erasedPixels = new Set<number>();

  // Rule 1: Small dots / dashes that form horizontal alignment (dotted/dashed signature guide line)
  const smallBlobs = blobs.filter((b) => b.width <= 14 && b.height <= 8 && b.pixels.length <= 60);

  for (let i = 0; i < smallBlobs.length; i++) {
    const b1 = smallBlobs[i];
    let alignedDots = [b1];

    for (let j = 0; j < smallBlobs.length; j++) {
      if (i === j) continue;
      const b2 = smallBlobs[j];
      if (Math.abs(b1.centerY - b2.centerY) <= 3) {
        alignedDots.push(b2);
      }
    }

    if (alignedDots.length >= 3) {
      for (const dot of alignedDots) {
        for (const px of dot.pixels) {
          erasedPixels.add(px);
        }
      }
    }
  }

  // Erase detected dotted line pixels
  erasedPixels.forEach((pxIdx) => {
    data[pxIdx * 4 + 3] = 0;
  });

  ctx.putImageData(imgData, 0, 0);
};

export const trimTransparentPadding = (canvas: HTMLCanvasElement): HTMLCanvasElement => {
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  const W = canvas.width;
  const H = canvas.height;
  if (!W || !H) return canvas;

  const imgData = ctx.getImageData(0, 0, W, H);
  const data = imgData.data;

  let minX = W;
  let minY = H;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = (y * W + x) * 4;
      const alpha = data[idx + 3];
      if (alpha > 20) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < minX || maxY < minY) return canvas;

  const padX = 4;
  const padYTop = 2;
  const padYBottom = 0;
  const cropX = Math.max(0, minX - padX);
  const cropY = Math.max(0, minY - padYTop);
  const cropW = Math.min(W - cropX, (maxX - minX + 1) + padX * 2);
  const cropH = Math.min(H - cropY, (maxY - cropY + 1) + padYBottom);

  const trimmedCanvas = document.createElement("canvas");
  trimmedCanvas.width = cropW;
  trimmedCanvas.height = cropH;
  const trimmedCtx = trimmedCanvas.getContext("2d");
  if (!trimmedCtx) return canvas;

  trimmedCtx.drawImage(canvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
  return trimmedCanvas;
};

export const cropAndCleanSignature = (
  base64PageImage: string,
  box: [number, number, number, number]
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const W = img.naturalWidth || img.width;
      const H = img.naturalHeight || img.height;

      const [ymin, xmin, ymax, xmax] = box;
      const xmin_px = (xmin / 1000) * W;
      const ymin_px = (ymin / 1000) * H;
      const xmax_px = (xmax / 1000) * W;
      const ymax_px = (ymax / 1000) * H;

      const cropW = Math.max(10, xmax_px - xmin_px);
      const cropH = Math.max(10, ymax_px - ymin_px);

      const canvas = document.createElement("canvas");
      canvas.width = cropW;
      canvas.height = cropH;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Could not acquire 2D canvas context."));
        return;
      }

      ctx.drawImage(img, xmin_px, ymin_px, cropW, cropH, 0, 0, cropW, cropH);

      makeCanvasBackgroundTransparent(canvas);
      const trimmed = trimTransparentPadding(canvas);
      resolve(trimmed.toDataURL("image/png"));
    };
    img.onerror = () => reject(new Error("Failed to load image for cropping signature."));
    img.src = base64PageImage;
  });
};

export const removeSignatureBackground = (imageSource: string): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const W = img.naturalWidth || img.width;
      const H = img.naturalHeight || img.height;

      if (!W || !H) {
        resolve(imageSource);
        return;
      }

      const canvas = document.createElement("canvas");
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(imageSource);
        return;
      }

      ctx.drawImage(img, 0, 0);
      makeCanvasBackgroundTransparent(canvas);
      const trimmed = trimTransparentPadding(canvas);
      resolve(trimmed.toDataURL("image/png"));
    };

    img.onerror = () => {
      resolve(imageSource);
    };

    img.src = imageSource;
  });
};

export async function detectAndCleanSignatureFromDocs(
  files: { fileBase64: string; mimeType: string; fileName?: string; isFromSignatureSlot?: boolean }[]
): Promise<string | null> {
  if (!files || files.length === 0) return null;

  // Helper to determine if filename indicates a standalone signature file
  const isStandaloneSigFile = (f: { fileName?: string; isFromSignatureSlot?: boolean }): boolean => {
    if (f.isFromSignatureSlot) return true;
    const fname = (f.fileName || "").toLowerCase();
    
    // Explicit signature filename terms
    const hasSigTerm = 
      fname.includes("signature") || 
      fname.includes("semnat") || 
      fname.includes("autograph") || 
      fname.includes("sig_") || 
      fname.includes("_sig") ||
      fname === "sig" ||
      fname === "sign" ||
      fname.includes("sign_") ||
      fname.includes("_sign") ||
      fname.includes("customer_signature") ||
      fname.includes("applicant_signature");

    // Must NOT be a full multi-page document form/passport/police report
    const isFullDoc = 
      fname.includes("declaration") ||
      fname.includes("declara") ||
      fname.includes("migrant") ||
      fname.includes("worker") ||
      fname.includes("report") ||
      fname.includes("clearance") ||
      fname.includes("passport") ||
      fname.includes("pasaport") ||
      fname.includes("police") ||
      fname.includes("cazier");

    return hasSigTerm && !isFullDoc;
  };

  // Sort files with strict priority:
  // 1. Standalone signature files or files explicitly in signature slot
  // 2. "Self Declaration Form for Migrant Workers" -> ("declaration"/"self"/"declara") AND ("migrant"/"worker"/"form")
  // 3. Date and signature documents -> "date" AND ("signature"/"sign"/"semnat")
  // 4. Other declarations / forms
  // 5. Other documents
  const sortedFiles = [...files].sort((a, b) => {
    const getPriority = (f: { fileName?: string; isFromSignatureSlot?: boolean }) => {
      if (isStandaloneSigFile(f)) return 1;

      const n = (f.fileName || "").toLowerCase();
      const isSelfDeclaration = (n.includes("declaration") || n.includes("self") || n.includes("declara")) && (n.includes("migrant") || n.includes("worker") || n.includes("form"));
      if (isSelfDeclaration) return 2;

      const isDateAndSignature = n.includes("date") && (n.includes("signature") || n.includes("sign") || n.includes("semnat") || n.includes("sig"));
      if (isDateAndSignature) return 3;

      const isOtherDeclaration = n.includes("declaration") || n.includes("self") || n.includes("declara");
      if (isOtherDeclaration) return 4;

      return 5;
    };

    return getPriority(a) - getPriority(b);
  });

  // 1. First check standalone signature files (images or PDFs)
  for (const f of sortedFiles) {
    if (isStandaloneSigFile(f)) {
      let imageBase64 = f.fileBase64;
      const isPdf = f.mimeType === "application/pdf" || f.fileBase64.startsWith("data:application/pdf");

      if (isPdf) {
        try {
          const { convertPdfToImages, dataUrlToFile } = await import("../utils/pdfUtils");
          const fileObj = dataUrlToFile(f.fileBase64, f.fileName || "signature.pdf");
          const pages = await convertPdfToImages(fileObj);
          if (pages.length > 0 && pages[0].dataUrl) {
            imageBase64 = pages[0].dataUrl;
          }
        } catch (pdfErr) {
          console.warn("Failed to convert signature PDF to image:", pdfErr);
        }
      }

      if (imageBase64 && (imageBase64.startsWith("data:image/") || !isPdf)) {
        try {
          const cleanedSig = await removeSignatureBackground(imageBase64);
          if (cleanedSig && cleanedSig.startsWith("data:image/")) {
            return cleanedSig;
          }
        } catch (e) {
          console.warn("Direct signature clean failed for standalone file:", e);
        }
      }
    }
  }

  // 2. Pre-process: flatten all PDFs into images so that AI vision can scan all pages
  let flattenedFiles: { fileName?: string; fileBase64: string; mimeType?: string }[] = [];
  try {
    const { convertPdfToImages, dataUrlToFile } = await import("../utils/pdfUtils");
    for (const f of sortedFiles) {
      const isPdf = f.mimeType === "application/pdf" || f.fileBase64.startsWith("data:application/pdf");
      if (isPdf) {
        try {
          const fileObj = dataUrlToFile(f.fileBase64, f.fileName || "doc.pdf");
          const pages = await convertPdfToImages(fileObj);
          for (let i = 0; i < pages.length; i++) {
            flattenedFiles.push({
              fileName: `${f.fileName}_page${i + 1}.png`,
              fileBase64: pages[i].dataUrl,
              mimeType: "image/png",
            });
          }
        } catch (pdfErr) {
          console.error("Failed to convert PDF to images:", pdfErr);
          flattenedFiles.push(f);
        }
      } else {
        flattenedFiles.push(f);
      }
    }
  } catch (e) {
    console.error("Failed to import pdfUtils:", e);
    flattenedFiles = sortedFiles;
  }

  // 3. Call AI signature extraction endpoint /api/extract-signature
  try {
    const response = await fetch("/api/extract-signature", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ files: flattenedFiles }),
    });

    if (response.ok) {
      const result = await response.json();
      if (result.success && result.found && result.box) {
        const targetPageIndex = typeof result.pageIndex === "number" ? result.pageIndex : 0;
        const pageFile = flattenedFiles[targetPageIndex] || flattenedFiles[0];
        if (pageFile && pageFile.fileBase64) {
          const cropped = await cropAndCleanSignature(pageFile.fileBase64, result.box);
          if (cropped && cropped.startsWith("data:image/")) {
            return cropped;
          }
        }
      }
    }
  } catch (err) {
    console.error("Auto signature detection failed:", err);
  }

  // 4. Fallback: Check all image files in flattened list and attempt transparentization
  for (const f of flattenedFiles) {
    const mime = f.mimeType || "";
    if (f.fileBase64 && (mime.startsWith("image/") || f.fileBase64.startsWith("data:image/"))) {
      try {
        const cleanedSig = await removeSignatureBackground(f.fileBase64);
        if (cleanedSig && cleanedSig.startsWith("data:image/")) {
          return cleanedSig;
        }
      } catch (e) {
        // ignore fallback errors
      }
    }
  }

  return null;
}

export const processSignatureImage = removeSignatureBackground;
