import React, { useRef, useState, useEffect } from "react";
import {
  Edit,
  Trash2,
  Check,
  Upload,
  Sparkles,
  FileText,
  Image as ImageIcon,
  AlertCircle,
  Loader2,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Crop,
  X,
} from "lucide-react";
import { makeCanvasBackgroundTransparent, trimTransparentPadding } from "../lib/signatureUtils";

interface SignaturePadProps {
  onSave: (signatureDataUrl: string) => void;
  onClear: () => void;
  currentSignature: string | null;
  stagedFiles?: { id: string; name: string; type: string; size: number; base64: string }[];
}

type SignatureTab = "draw" | "upload" | "extract";
type ExtractionMode = "ai" | "manual";

export default function SignaturePad({
  onSave,
  onClear,
  currentSignature,
  stagedFiles = [],
}: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const cropperContainerRef = useRef<HTMLDivElement | null>(null);

  const [activeTab, setActiveTab] = useState<SignatureTab>("draw");
  const [extractionMode, setExtractionMode] = useState<ExtractionMode>("ai");

  // Drawing Pad States
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [showPad, setShowPad] = useState(false);

  // Upload Tab States
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Extraction Doc States
  const [selectedStagedFileId, setSelectedStagedFileId] = useState<string>("");
  const [dedicatedExtractFile, setDedicatedExtractFile] = useState<{
    name: string;
    type: string;
    base64: string;
  } | null>(null);

  // PDF & Page Rendering States
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isRenderingPage, setIsRenderingPage] = useState(false);
  const [renderedPageImage, setRenderedPageImage] = useState<string | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);

  // AI Extraction States
  const [extractionStatus, setExtractionStatus] = useState<
    "idle" | "calling_api" | "success" | "error"
  >("idle");
  const [extractionError, setExtractionError] = useState<string | null>(null);
  const [aiExtractedPreview, setAiExtractedPreview] = useState<string | null>(null);

  // Manual Extraction States
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [dragEnd, setDragEnd] = useState<{ x: number; y: number } | null>(null);
  const [isDraggingCrop, setIsDraggingCrop] = useState(false);
  const [manualCroppedPreview, setManualCroppedPreview] = useState<string | null>(null);

  // Safeguard setting pdf.js GlobalWorkerOptions
  useEffect(() => {
    if (typeof window !== "undefined" && (window as any).pdfjsLib) {
      (window as any).pdfjsLib.GlobalWorkerOptions.workerSrc =
        "https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js";
    }
  }, []);

  // Helper to remove paper/white background from image data URL and return transparent PNG
  const removeSignatureBackground = (imageSource: string): Promise<string> => {
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

  // Pre-select first staged file if available
  useEffect(() => {
    if (stagedFiles.length > 0 && !selectedStagedFileId) {
      setSelectedStagedFileId(stagedFiles[0].id);
    }
  }, [stagedFiles, selectedStagedFileId]);

  // Load and render page image when the selected file or page changes
  useEffect(() => {
    let activeFile: { name: string; type: string; base64: string } | null = null;
    if (dedicatedExtractFile) {
      activeFile = dedicatedExtractFile;
    } else if (selectedStagedFileId) {
      const match = stagedFiles.find((f) => f.id === selectedStagedFileId);
      if (match) {
        activeFile = {
          name: match.name,
          type: match.type,
          base64: match.base64,
        };
      }
    }

    if (!activeFile) {
      setRenderedPageImage(null);
      setTotalPages(1);
      setCurrentPage(1);
      return;
    }

    const isPdf =
      activeFile.type.includes("pdf") || activeFile.name.toLowerCase().endsWith(".pdf");

    if (isPdf) {
      setIsRenderingPage(true);
      setRenderError(null);
      setManualCroppedPreview(null);
      setDragStart(null);
      setDragEnd(null);

      renderSinglePdfPage(activeFile.base64, currentPage)
        .then(({ dataUrl, totalPagesCount }) => {
          setRenderedPageImage(dataUrl);
          setTotalPages(totalPagesCount);
          setIsRenderingPage(false);
        })
        .catch((err) => {
          console.error("PDF rendering error:", err);
          setRenderError(err.message || "Failed to render PDF page.");
          setIsRenderingPage(false);
        });
    } else {
      setRenderedPageImage(activeFile.base64);
      setTotalPages(1);
      setCurrentPage(1);
      setRenderError(null);
      setManualCroppedPreview(null);
      setDragStart(null);
      setDragEnd(null);
    }
  }, [selectedStagedFileId, dedicatedExtractFile, currentPage]);

  // Client-side PDF page rendering using pdf.js or convertPdfToImages
  const renderSinglePdfPage = async (
    pdfBase64: string,
    pageNum: number
  ): Promise<{ dataUrl: string; totalPagesCount: number }> => {
    try {
      const { convertPdfToImages, dataUrlToFile } = await import("../utils/pdfUtils");
      const fileObj = dataUrlToFile(pdfBase64, "doc.pdf");
      const pages = await convertPdfToImages(fileObj);
      if (pages.length === 0) {
        throw new Error("No pages could be extracted from this PDF.");
      }
      const safePage = pages[Math.max(0, Math.min(pageNum - 1, pages.length - 1))];
      return {
        dataUrl: safePage.dataUrl,
        totalPagesCount: pages.length,
      };
    } catch (err: any) {
      console.error("PDF page render fallback error:", err);
      throw new Error(err.message || "Could not render PDF document.");
    }
  };

  // Initialize canvas with high DPI support for Drawing Pad
  useEffect(() => {
    if (activeTab !== "draw" || !showPad || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = 400;
    canvas.height = 150;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = "#1e293b";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.setLineDash([]);
  }, [showPad, activeTab]);

  const startDrawing = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = "touches" in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = "touches" in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
    setHasDrawn(true);
  };

  const draw = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) => {
    if (!isDrawing || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (e.cancelable) e.preventDefault();

    const rect = canvas.getBoundingClientRect();
    const x = "touches" in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = "touches" in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearPad = () => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#1e293b";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.setLineDash([]);

    setHasDrawn(false);
  };

  const saveDrawing = async () => {
    if (!canvasRef.current || !hasDrawn) return;
    const dataUrl = canvasRef.current.toDataURL("image/png");
    const transparentUrl = await removeSignatureBackground(dataUrl);
    onSave(transparentUrl);
    setShowPad(false);
  };

  // Direct PNG/JPEG upload with background removal
  const handleDirectUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setUploadError("Please upload a valid JPEG or PNG image file.");
      return;
    }

    setUploadError(null);
    const reader = new FileReader();
    reader.onload = async () => {
      if (typeof reader.result === "string") {
        const transparentUrl = await removeSignatureBackground(reader.result);
        onSave(transparentUrl);
      }
    };
    reader.onerror = () => {
      setUploadError("Failed to read image file.");
    };
    reader.readAsDataURL(file);
  };

  // Dedicated file upload for AI/Manual extraction
  const handleDedicatedExtractUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setDedicatedExtractFile({
          name: file.name,
          type: file.type || (file.name.endsWith(".pdf") ? "application/pdf" : "image/png"),
          base64: reader.result,
        });
        setAiExtractedPreview(null);
        setManualCroppedPreview(null);
        setExtractionStatus("idle");
        setExtractionError(null);
        setCurrentPage(1);
      }
    };
    reader.readAsDataURL(file);
  };

  // Crop helper using canvas drawing coordinates
  const cropSignatureFromPage = (
    base64PageImage: string,
    box: number[]
  ): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const [ymin, xmin, ymax, xmax] = box;
        const W = img.naturalWidth || img.width;
        const H = img.naturalHeight || img.height;

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

        ctx.drawImage(
          img,
          xmin_px,
          ymin_px,
          cropW,
          cropH,
          0,
          0,
          cropW,
          cropH
        );

        makeCanvasBackgroundTransparent(canvas);
        const trimmed = trimTransparentPadding(canvas);
        resolve(trimmed.toDataURL("image/png"));
      };
      img.onerror = () => reject(new Error("Failed to load page image for cropping."));
      img.src = base64PageImage;
    });
  };

  // Run AI signature detection using server-side Gemini
  const handleAiExtraction = async () => {
    setExtractionStatus("idle");
    setExtractionError(null);
    setAiExtractedPreview(null);

    if (!renderedPageImage) {
      setExtractionError("Please select or upload a document containing a signature first.");
      setExtractionStatus("error");
      return;
    }

    try {
      setExtractionStatus("calling_api");

      const response = await fetch("/api/extract-signature", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          files: [
            {
              fileBase64: renderedPageImage,
              mimeType: "image/png",
            },
          ],
        }),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(
          result.error || "The AI model was unable to detect a signature in this document page."
        );
      }

      if (!result.found || !result.box) {
        throw new Error(
          "No signature detected on this page. Please try another page or crop manually."
        );
      }

      const croppedUrl = await cropSignatureFromPage(renderedPageImage, result.box);
      setAiExtractedPreview(croppedUrl);
      setExtractionStatus("success");
    } catch (err: any) {
      console.error("Signature extraction error:", err);
      setExtractionError(
        err.message || "An unexpected error occurred during signature detection."
      );
      setExtractionStatus("error");
    }
  };

  // Mouse / Touch Event Handlers for Free Manual Cropping
  const handleCropMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cropperContainerRef.current || isRenderingPage || !renderedPageImage) return;
    const rect = cropperContainerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setDragStart({ x, y });
    setDragEnd({ x, y });
    setIsDraggingCrop(true);
    setManualCroppedPreview(null);
  };

  const handleCropMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDraggingCrop || !dragStart || !cropperContainerRef.current) return;
    const rect = cropperContainerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
    setDragEnd({ x, y });
  };

  const handleCropMouseUp = () => {
    if (!isDraggingCrop) return;
    setIsDraggingCrop(false);
    triggerManualCrop();
  };

  const handleCropTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!cropperContainerRef.current || isRenderingPage || !renderedPageImage) return;
    const rect = cropperContainerRef.current.getBoundingClientRect();
    const touch = e.touches[0];
    const x = ((touch.clientX - rect.left) / rect.width) * 100;
    const y = ((touch.clientY - rect.top) / rect.height) * 100;
    setDragStart({ x, y });
    setDragEnd({ x, y });
    setIsDraggingCrop(true);
    setManualCroppedPreview(null);
  };

  const handleCropTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!isDraggingCrop || !dragStart || !cropperContainerRef.current) return;
    const rect = cropperContainerRef.current.getBoundingClientRect();
    const touch = e.touches[0];
    const x = Math.max(0, Math.min(100, ((touch.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((touch.clientY - rect.top) / rect.height) * 100));
    setDragEnd({ x, y });
  };

  // Convert current drag box to normalized ymin, xmin, ymax, xmax and render crop preview
  const triggerManualCrop = async () => {
    if (!dragStart || !dragEnd || !renderedPageImage) return;

    const xmin = Math.round(Math.min(dragStart.x, dragEnd.x) * 10);
    const ymin = Math.round(Math.min(dragStart.y, dragEnd.y) * 10);
    const xmax = Math.round(Math.max(dragStart.x, dragEnd.x) * 10);
    const ymax = Math.round(Math.max(dragStart.y, dragEnd.y) * 10);

    if (xmax - xmin < 10 || ymax - ymin < 10) return;

    try {
      const croppedUrl = await cropSignatureFromPage(renderedPageImage, [
        ymin,
        xmin,
        ymax,
        xmax,
      ]);
      setManualCroppedPreview(croppedUrl);
    } catch (err) {
      console.error("Manual crop failed:", err);
    }
  };

  let selectionBoxStyle: React.CSSProperties = {};
  if (dragStart && dragEnd) {
    const x = Math.min(dragStart.x, dragEnd.x);
    const y = Math.min(dragStart.y, dragEnd.y);
    const width = Math.abs(dragStart.x - dragEnd.x);
    const height = Math.abs(dragStart.y - dragEnd.y);
    selectionBoxStyle = {
      left: `${x}%`,
      top: `${y}%`,
      width: `${width}%`,
      height: `${height}%`,
    };
  }

  return (
    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
      {/* HEADER SECTION */}
      <div className="flex items-center justify-between mb-3 border-b border-slate-200 pb-2">
        <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
          <Edit className="w-4 h-4 text-slate-500" />
          Applicant Signature / Semnătură
        </label>
        {currentSignature && (
          <button
            onClick={() => {
              onClear();
              setHasDrawn(false);
              setAiExtractedPreview(null);
              setManualCroppedPreview(null);
              setExtractionStatus("idle");
              setDedicatedExtractFile(null);
              setDragStart(null);
              setDragEnd(null);
            }}
            className="text-xs text-red-500 hover:text-red-600 flex items-center gap-1 bg-red-50 px-2 py-1 rounded transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete / Șterge
          </button>
        )}
      </div>

      {/* RENDER CURRENT SIGNATURE IF EXISTS */}
      {currentSignature &&
      !showPad &&
      extractionStatus !== "success" &&
      !manualCroppedPreview ? (
        <div className="border border-emerald-200 bg-emerald-50/50 p-3 rounded-lg flex flex-col items-center justify-center relative group min-h-[100px] bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:8px_8px]">
          <img src={currentSignature} alt="Signature Preview" className="h-16 object-contain" />
          <span className="text-[10px] bg-emerald-100/90 text-emerald-800 font-bold px-2 py-0.5 rounded-full mt-1.5 flex items-center gap-1 shadow-xs border border-emerald-200/60">
            ✨ Transparent Background Signature
          </span>
          <button
            onClick={() => setShowPad(true)}
            className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-semibold rounded-lg gap-1.5"
          >
            <Edit className="w-3.5 h-3.5" /> Modify Signature
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* TABS SELECTOR */}
          <div className="flex border border-slate-200 rounded-lg p-1 bg-slate-100 gap-1">
            <button
              type="button"
              onClick={() => {
                setActiveTab("draw");
                setShowPad(true);
              }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold rounded-md transition-all ${
                activeTab === "draw"
                  ? "bg-white text-blue-600 shadow-sm"
                  : "text-slate-600 hover:text-slate-800 hover:bg-white/50"
              }`}
            >
              <Edit className="w-3.5 h-3.5" />
              Draw Pad
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab("upload");
                setShowPad(false);
              }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold rounded-md transition-all ${
                activeTab === "upload"
                  ? "bg-white text-blue-600 shadow-sm"
                  : "text-slate-600 hover:text-slate-800 hover:bg-white/50"
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              Upload Image
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab("extract");
                setShowPad(false);
              }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold rounded-md transition-all ${
                activeTab === "extract"
                  ? "bg-white text-blue-600 shadow-sm"
                  : "text-slate-600 hover:text-slate-800 hover:bg-white/50"
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              Extract from Document
            </button>
          </div>

          {/* TAB CONTENT: DRAW */}
          {activeTab === "draw" && (
            <div className="space-y-3">
              <div className="bg-white rounded-lg border border-slate-300 overflow-hidden shadow-inner">
                <canvas
                  ref={canvasRef}
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onTouchStart={startDrawing}
                  onTouchMove={draw}
                  onTouchEnd={stopDrawing}
                  className="w-full h-[150px] cursor-crosshair touch-none"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={clearPad}
                  className="text-xs px-3 py-1.5 border border-slate-300 rounded text-slate-600 hover:bg-slate-50 font-medium"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={saveDrawing}
                  disabled={!hasDrawn}
                  className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center gap-1"
                >
                  <Check className="w-3.5 h-3.5" /> Apply Drawn Signature
                </button>
              </div>
            </div>
          )}

          {/* TAB CONTENT: UPLOAD IMAGE */}
          {activeTab === "upload" && (
            <div className="space-y-3">
              <div className="border-2 border-dashed border-slate-300 hover:border-blue-400 rounded-lg p-5 bg-white transition-all text-center relative">
                <input
                  type="file"
                  accept="image/png, image/jpeg, image/jpg"
                  onChange={handleDirectUpload}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <p className="text-xs font-semibold text-slate-600">
                  Drop signature image here or click to browse
                </p>
                <p className="text-[10px] text-slate-400 mt-1">
                  Supports PNG, JPEG, JPG with transparent or clean background
                </p>
              </div>
              {uploadError && (
                <div className="bg-red-50 text-red-600 text-[11px] p-2 rounded flex items-center gap-1.5 border border-red-100">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{uploadError}</span>
                </div>
              )}
            </div>
          )}

          {/* TAB CONTENT: EXTRACT FROM DOCUMENT */}
          {activeTab === "extract" && (
            <div className="space-y-4">
              {/* DOCUMENT SELECTOR / UPLOADER */}
              <div className="bg-white p-3 rounded-lg border border-slate-200 space-y-3.5">
                {stagedFiles.length > 0 && (
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                      Select document source:
                    </label>
                    <div className="flex flex-col gap-1.5">
                      {stagedFiles.map((file) => (
                        <label
                          key={file.id}
                          className={`flex items-center gap-2 p-2 border rounded-md cursor-pointer text-xs transition-colors ${
                            selectedStagedFileId === file.id && !dedicatedExtractFile
                              ? "bg-blue-50 border-blue-200 text-blue-700 font-medium"
                              : "border-slate-200 hover:bg-slate-50 text-slate-700"
                          }`}
                          onClick={() => {
                            setSelectedStagedFileId(file.id);
                            setDedicatedExtractFile(null);
                            setExtractionError(null);
                            setAiExtractedPreview(null);
                            setManualCroppedPreview(null);
                            setCurrentPage(1);
                          }}
                        >
                          <input
                            type="radio"
                            name="extractSource"
                            checked={selectedStagedFileId === file.id && !dedicatedExtractFile}
                            onChange={() => {}}
                            className="text-blue-600 focus:ring-blue-500"
                          />
                          {file.type.includes("pdf") ? (
                            <FileText className="w-4 h-4 text-red-500 shrink-0" />
                          ) : (
                            <ImageIcon className="w-4 h-4 text-blue-500 shrink-0" />
                          )}
                          <span className="truncate flex-1 text-left">{file.name}</span>
                          <span className="text-[10px] text-slate-400">
                            ({Math.round(file.size / 1024)} KB)
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {/* OR DEDICATED EXTRACT FILE UPLOAD */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                      {stagedFiles.length > 0
                        ? "Or upload another scan / photo:"
                        : "Upload a PDF or scan containing the signature:"}
                    </label>
                    {dedicatedExtractFile && (
                      <button
                        type="button"
                        onClick={() => {
                          setDedicatedExtractFile(null);
                          setExtractionError(null);
                          setAiExtractedPreview(null);
                          setManualCroppedPreview(null);
                          setExtractionStatus("idle");
                          setCurrentPage(1);
                        }}
                        className="text-[10px] text-red-500 hover:underline flex items-center gap-0.5"
                      >
                        Reset upload
                      </button>
                    )}
                  </div>

                  {!dedicatedExtractFile ? (
                    <div className="border border-dashed border-slate-300 hover:border-slate-400 rounded-md p-3 bg-slate-50 text-center relative transition-colors">
                      <input
                        type="file"
                        accept="image/png, image/jpeg, image/jpg, application/pdf"
                        onChange={handleDedicatedExtractUpload}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                      <div className="flex items-center justify-center gap-1.5 text-xs text-slate-600 font-semibold">
                        <Upload className="w-4 h-4 text-slate-400" />
                        <span>Upload PDF or Image</span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 p-2 bg-amber-50/50 border border-amber-200/50 rounded-md text-xs font-semibold text-amber-800">
                      {dedicatedExtractFile.type.includes("pdf") ? (
                        <FileText className="w-4 h-4 text-red-500 shrink-0" />
                      ) : (
                        <ImageIcon className="w-4 h-4 text-amber-500 shrink-0" />
                      )}
                      <span className="truncate flex-1 text-left">
                        {dedicatedExtractFile.name}
                      </span>
                      <span className="text-[9px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded uppercase">
                        Selected File
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* PDF PAGE NAVIGATION / CONTROL */}
              {renderedPageImage && totalPages > 1 && (
                <div className="flex items-center justify-between bg-white px-3 py-2 rounded-lg border border-slate-200">
                  <span className="text-xs text-slate-600 font-semibold">
                    Document Page: <b className="text-slate-800">{currentPage}</b> of{" "}
                    <b>{totalPages}</b>
                  </span>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      disabled={currentPage <= 1 || isRenderingPage}
                      onClick={() => setCurrentPage((prev) => prev - 1)}
                      className="p-1 border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-40 transition-colors"
                      title="Previous Page"
                    >
                      <ChevronLeft className="w-4 h-4 text-slate-700" />
                    </button>
                    <button
                      type="button"
                      disabled={currentPage >= totalPages || isRenderingPage}
                      onClick={() => setCurrentPage((prev) => prev + 1)}
                      className="p-1 border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-40 transition-colors"
                      title="Next Page"
                    >
                      <ChevronRight className="w-4 h-4 text-slate-700" />
                    </button>
                  </div>
                </div>
              )}

              {/* INTERACTIVE MODE SELECTION: AI VS MANUAL */}
              {renderedPageImage && !isRenderingPage && (
                <div className="flex border border-slate-200 rounded-lg p-0.5 bg-slate-200/60 gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setExtractionMode("ai");
                      setExtractionError(null);
                    }}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold rounded-md transition-all ${
                      extractionMode === "ai"
                        ? "bg-white text-blue-600 shadow-sm"
                        : "text-slate-600 hover:text-slate-800"
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    AI Auto-Detect
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setExtractionMode("manual");
                      setExtractionError(null);
                      setDragStart(null);
                      setDragEnd(null);
                    }}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold rounded-md transition-all ${
                      extractionMode === "manual"
                        ? "bg-white text-blue-600 shadow-sm"
                        : "text-slate-600 hover:text-slate-800"
                    }`}
                  >
                    <Crop className="w-3.5 h-3.5 text-emerald-500" />
                    Manual Crop (Free)
                  </button>
                </div>
              )}

              {/* RENDER DYNAMIC VISUAL STAGES */}
              {isRenderingPage ? (
                <div className="bg-slate-900 text-slate-100 p-4 rounded-lg border border-slate-800 text-xs flex items-center gap-3">
                  <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
                  <span className="font-semibold">Rendering PDF page preview via pdf.js...</span>
                </div>
              ) : renderError ? (
                <div className="bg-red-50 text-red-600 text-[11px] p-3 rounded border border-red-100 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{renderError}</span>
                </div>
              ) : (
                renderedPageImage && (
                  <div className="space-y-3">
                    {/* MODE 1: AI AUTO EXTRACTION CONTROLS */}
                    {extractionMode === "ai" && (
                      <div className="space-y-3">
                        {extractionStatus === "idle" && !aiExtractedPreview && (
                          <button
                            type="button"
                            onClick={handleAiExtraction}
                            className="w-full flex items-center justify-center gap-1.5 py-2 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-all shadow-md shadow-emerald-600/10 active:scale-[0.99]"
                          >
                            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                            <span>Scan page & Extract with AI</span>
                          </button>
                        )}

                        {extractionStatus === "calling_api" && (
                          <div className="bg-slate-900 text-slate-100 p-3 rounded-lg border border-slate-800 text-xs flex items-center gap-3">
                            <Loader2 className="w-4 h-4 text-emerald-400 animate-spin" />
                            <div className="flex-1">
                              <span className="font-bold block text-slate-200">
                                Gemini AI analyzing document...
                              </span>
                              <span className="text-[10px] text-slate-400">
                                Detecting signature curves and isolating background.
                              </span>
                            </div>
                          </div>
                        )}

                        {extractionStatus === "error" && extractionError && (
                          <div className="space-y-2">
                            <div className="bg-red-50 text-red-600 text-[11px] p-2.5 rounded border border-red-100 space-y-1">
                              <div className="flex items-center gap-1.5 font-bold">
                                <AlertCircle className="w-4 h-4 shrink-0" />
                                <span>AI Signature Detection Failed</span>
                              </div>
                              <p className="text-[10px] leading-relaxed text-red-500">
                                {extractionError}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={handleAiExtraction}
                              className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded text-xs font-semibold transition-colors"
                            >
                              <RefreshCw className="w-3.5 h-3.5" /> Retry AI Extraction
                            </button>
                          </div>
                        )}

                        {aiExtractedPreview && (
                          <div className="border border-emerald-200 bg-emerald-50/40 p-3 rounded-lg space-y-3 animate-fade-in">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-emerald-800 flex items-center gap-1">
                                <Check className="w-4 h-4" /> Signature Detected successfully!
                              </span>
                            </div>
                            <div className="bg-white border border-slate-200 p-4 rounded flex flex-col items-center justify-center min-h-[90px] shadow-sm bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:8px_8px]">
                              <img
                                src={aiExtractedPreview}
                                alt="Extracted Signature"
                                className="max-h-16 object-contain"
                              />
                              <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full mt-2">
                                ✨ Transparent Background
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                onSave(aiExtractedPreview);
                                setExtractionStatus("idle");
                                setAiExtractedPreview(null);
                              }}
                              className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-xs transition-colors flex items-center justify-center gap-1.5"
                            >
                              <Check className="w-4 h-4" /> Use AI Extracted Signature
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* MODE 2: FREE MANUAL CROP OVERLAY VIEWPORT */}
                    {extractionMode === "manual" && (
                      <div className="space-y-3">
                        <p className="text-[11px] text-slate-500 leading-normal font-semibold">
                          💡 <b>How to crop:</b> Click and drag (or slide with your finger)
                          directly over the document page below to select and crop your signature.
                        </p>

                        <div
                          ref={cropperContainerRef}
                          onMouseDown={handleCropMouseDown}
                          onMouseMove={handleCropMouseMove}
                          onMouseUp={handleCropMouseUp}
                          onTouchStart={handleCropTouchStart}
                          onTouchMove={handleCropTouchMove}
                          onTouchEnd={handleCropMouseUp}
                          className="relative border border-slate-300 rounded-lg overflow-hidden cursor-crosshair bg-slate-100 max-h-[320px] overflow-y-auto select-none"
                        >
                          <img
                            src={renderedPageImage}
                            alt="Signature Source Page"
                            className="w-full h-auto pointer-events-none select-none"
                            draggable={false}
                          />

                          {dragStart && dragEnd && (
                            <div className="absolute inset-0 bg-slate-900/20 pointer-events-none"></div>
                          )}

                          {dragStart && dragEnd && (
                            <div
                              style={selectionBoxStyle}
                              className="absolute border-2 border-solid border-blue-500 bg-white/20 shadow-[0_0_15px_rgba(59,130,246,0.3)] rounded pointer-events-none transition-[border-color,box-shadow]"
                            >
                              <div className="absolute -top-1 -left-1 w-2.5 h-2.5 border-t-2 border-l-2 border-blue-600 rounded-tl-sm"></div>
                              <div className="absolute -top-1 -right-1 w-2.5 h-2.5 border-t-2 border-r-2 border-blue-600 rounded-tr-sm"></div>
                              <div className="absolute -bottom-1 -left-1 w-2.5 h-2.5 border-b-2 border-l-2 border-blue-600 rounded-bl-sm"></div>
                              <div className="absolute -bottom-1 -right-1 w-2.5 h-2.5 border-b-2 border-r-2 border-blue-600 rounded-br-sm"></div>

                              <span className="absolute bottom-1 right-1 text-[8px] bg-blue-600 text-white font-bold px-1 py-0.2 rounded uppercase tracking-wider">
                                Crop Box
                              </span>
                            </div>
                          )}
                        </div>

                        {manualCroppedPreview && (
                          <div className="border border-emerald-200 bg-emerald-50/40 p-3 rounded-lg space-y-3 animate-fade-in">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-emerald-800 flex items-center gap-1">
                                <Check className="w-4 h-4" /> Ready to Use!
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  setManualCroppedPreview(null);
                                  setDragStart(null);
                                  setDragEnd(null);
                                }}
                                className="text-[10px] text-slate-500 hover:underline"
                              >
                                Reset Selection
                              </button>
                            </div>
                            <div className="bg-white border border-slate-200 p-4 rounded flex flex-col items-center justify-center min-h-[90px] shadow-sm bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:8px_8px]">
                              <img
                                src={manualCroppedPreview}
                                alt="Manual Cropped Preview"
                                className="max-h-16 object-contain"
                              />
                              <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full mt-2">
                                ✨ Transparent Background
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                onSave(manualCroppedPreview);
                                setManualCroppedPreview(null);
                                setDragStart(null);
                                setDragEnd(null);
                              }}
                              className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-xs transition-colors flex items-center justify-center gap-1.5"
                            >
                              <Check className="w-4 h-4" /> Use This Crop / Aplică semnătura
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
