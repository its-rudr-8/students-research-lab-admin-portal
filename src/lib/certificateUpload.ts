/**
 * Certificate Upload Utilities
 * ─────────────────────────────
 * Handles:
 *  1. PDF → WebP image conversion (browser-side, pdfjs-dist)
 *  2. Non-PDF image → WebP conversion (browser canvas)
 *  3. File size validation (≤ 10MB)
 *  4. Cloudinary upload via POST /api/admin/upload-certificate
 */

const MAX_CERT_SIZE_MB = 10;
const MAX_CERT_SIZE_BYTES = MAX_CERT_SIZE_MB * 1024 * 1024;

export const SUPPORTED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
  "image/bmp",
  "image/tiff",
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
 * Convert a canvas to a WebP Blob.
 * Falls back to PNG if the browser doesn't support WebP encoding
 * (extremely rare — all modern browsers support it).
 */
async function canvasToWebpBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (b) return resolve(b);
        // Fallback: try PNG if WebP encoding failed
        canvas.toBlob(
          (fallback) => {
            if (fallback) resolve(fallback);
            else reject(new Error("Canvas toBlob() failed for both WebP and PNG"));
          },
          "image/png"
        );
      },
      "image/webp",
      0.92
    );
  });
}

/**
 * Convert the first page of a PDF to a WebP File using pdfjs-dist.
 * Renders at 2× device pixel ratio for crisp output.
 */
export async function convertPdfToImageBlob(file: File): Promise<File> {
  const pdfjsLib = await import("pdfjs-dist");

  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url
  ).toString();

  const arrayBuffer = await file.arrayBuffer();
  const pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  const page = await pdfDoc.getPage(1);
  const SCALE = 2;
  const viewport = page.getViewport({ scale: SCALE });

  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;

  const ctx = canvas.getContext("2d")!;
  await page.render({ canvasContext: ctx, viewport }).promise;

  const blob = await canvasToWebpBlob(canvas);

  // Dispose canvas to release memory
  canvas.width = 0;
  canvas.height = 0;
  pdfDoc.destroy();

  const baseName = file.name.replace(/\.pdf$/i, "");
  const ext = blob.type === "image/webp" ? "webp" : "png";
  return new File([blob], `${baseName}_page1.${ext}`, { type: blob.type });
}

/**
 * Convert a raster image file (JPEG, PNG, GIF, AVIF, BMP …) to WebP
 * by drawing it onto a canvas and re-encoding.
 * If the file is already WebP, it is returned as-is without re-encoding.
 */
async function convertImageToWebp(file: File): Promise<File> {
  if (file.type === "image/webp") return file;

  return new Promise<File>((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = async () => {
      URL.revokeObjectURL(objectUrl);
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0);

      try {
        const blob = await canvasToWebpBlob(canvas);
        canvas.width = 0;
        canvas.height = 0;
        const baseName = file.name.replace(/\.[^/.]+$/, "");
        const ext = blob.type === "image/webp" ? "webp" : "png";
        resolve(new File([blob], `${baseName}.${ext}`, { type: blob.type }));
      } catch (err) {
        canvas.width = 0;
        canvas.height = 0;
        reject(err);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error(`Failed to load image: ${file.name}`));
    };

    img.src = objectUrl;
  });
}

/**
 * Process a certificate file:
 * - Validates size + type
 * - PDF → WebP (via pdfjs canvas render)
 * - Any other image → WebP (via canvas re-encode)
 * Returns the WebP File ready for upload, or throws on error.
 */
export async function processCertificateFile(file: File): Promise<File> {
  const validationError = validateCertificateFile(file);
  if (validationError) throw new Error(validationError);

  if (file.type === "application/pdf") {
    return convertPdfToImageBlob(file);
  }

  return convertImageToWebp(file);
}
