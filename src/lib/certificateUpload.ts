/**
 * Certificate Upload Utilities
 * ─────────────────────────────
 * Handles:
 *  1. PDF → JPEG image conversion (browser-side, pdfjs-dist)
 *  2. File size validation (≤ 10MB)
 *  3. Cloudinary upload via POST /api/admin/upload-certificate
 */

const MAX_CERT_SIZE_MB = 10;
const MAX_CERT_SIZE_BYTES = MAX_CERT_SIZE_MB * 1024 * 1024;

export const SUPPORTED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
];

export interface CertUploadResult {
  url: string;
  publicId: string;
}

/**
 * Validate file before processing.
 * Returns an error string if invalid, null if valid.
 */
export function validateCertificateFile(file: File): string | null {
  if (file.size > MAX_CERT_SIZE_BYTES) {
    return `Certificate size must be less than or equal to ${MAX_CERT_SIZE_MB}MB. Your file is ${(file.size / (1024 * 1024)).toFixed(1)}MB.`;
  }
  if (!SUPPORTED_TYPES.includes(file.type)) {
    return `Unsupported file type "${file.type}". Supported: JPG, PNG, WebP, GIF, PDF.`;
  }
  return null;
}

/**
 * Convert first page of a PDF to a JPEG Blob using pdfjs-dist.
 * Renders at 2× device pixel ratio for high-quality output.
 * The canvas is disposed after conversion to avoid memory leaks.
 */
export async function convertPdfToImageBlob(file: File): Promise<File> {
  // Dynamically import pdfjs-dist to enable code-splitting
  const pdfjsLib = await import("pdfjs-dist");

  // Set worker source — use local copy bundled with pdfjs-dist
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url
  ).toString();

  const arrayBuffer = await file.arrayBuffer();
  const pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  // Always render first page
  const page = await pdfDoc.getPage(1);

  // 2× scale for crisp rendering
  const SCALE = 2;
  const viewport = page.getViewport({ scale: SCALE });

  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;

  const ctx = canvas.getContext("2d")!;
  await page.render({ canvasContext: ctx, viewport }).promise;

  // Convert to JPEG blob
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (b) resolve(b);
        else reject(new Error("Canvas toBlob() failed"));
      },
      "image/jpeg",
      0.92
    );
  });

  // Dispose canvas to release memory
  canvas.width = 0;
  canvas.height = 0;
  pdfDoc.destroy();

  const baseName = file.name.replace(/\.pdf$/i, "");
  return new File([blob], `${baseName}_page1.jpg`, { type: "image/jpeg" });
}

/**
 * Process a certificate file:
 * - Validates size + type
 * - Converts PDF → JPEG if needed
 * Returns the image File ready for upload, or throws on error.
 */
export async function processCertificateFile(file: File): Promise<File> {
  const validationError = validateCertificateFile(file);
  if (validationError) throw new Error(validationError);

  if (file.type === "application/pdf") {
    return await convertPdfToImageBlob(file);
  }

  // Image files are used as-is
  return file;
}
