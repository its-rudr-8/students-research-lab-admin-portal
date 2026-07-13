/**
 * CertificateUpload
 * ─────────────────
 * Multi-certificate upload component with drag-and-drop, PDF conversion,
 * per-card preview, replace/remove, and smooth name-editing.
 *
 * BUG-FIX NOTES (focus/cursor loss):
 * ─────────────────────────────────────
 * Root causes of the original typing bugs:
 *  1. Render-time prop sync: `if (certifications !== prevCertsRef.current)`
 *     ran on every render, regenerating all items with new random IDs whenever
 *     the parent's `onChange` caused certifications to update — React then
 *     unmounted/remounted every card, killing focus.
 *  2. uid() used Math.random() — new IDs every re-derive = re-mounts.
 *  3. uploadFiles closed over `items` state — rebuilt on every setItems call.
 *
 * Fix approach:
 *  - Component is the single source of truth for `items` after mount.
 *  - Profile switching is handled by `key={selectedEnrollment}` in the parent
 *    (MemberCV.tsx), which unmounts/remounts the whole component cleanly.
 *  - CertCard owns its own `localName` state so typing never touches parent.
 *    It calls `onNameChange` only on blur — zero re-renders during typing.
 *  - React.memo + useCallback on all card handlers — stable references.
 *  - uploadFiles uses functional setItems(prev => ...) — no stale closure.
 *  - crypto.randomUUID() for stable, unique IDs.
 */

import { useState, useRef, useCallback, useEffect, memo } from "react";
import {
  Upload,
  X,
  Loader2,
  Award,
  Plus,
  AlertCircle,
  CheckCircle2,
  FileImage,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { adminAPI } from "@/lib/adminApi";
import { processCertificateFile, SUPPORTED_TYPES } from "@/lib/certificateUpload";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

// ─── Types ───────────────────────────────────────────────────────────────────

export type Certification = {
  name: string;
  url: string;
};

/** Internal item — extends Certification with local UI state */
interface CertItem {
  /** Stable, unique ID for React keying — never changes after creation */
  id: string;
  name: string;
  url: string;
  uploading: boolean;
  error?: string;
  /** Blob URL for local preview while uploading. Revoked after upload completes. */
  localPreview?: string;
}

interface CertificateUploadProps {
  /** Initial certifications loaded from the DB. Component owns state after mount. */
  certifications: Certification[];
  /** Called when the committed list of certifications changes (upload complete, remove, url-blur). */
  onChange: (certs: Certification[]) => void;
  disabled?: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function newId(): string {
  // crypto.randomUUID is available in all modern browsers and Node ≥ 15
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function certItemFromCert(c: Certification): CertItem {
  return { id: newId(), name: c.name, url: c.url, uploading: false };
}

function toCleanCerts(items: CertItem[]): Certification[] {
  return items.map(({ name, url }) => ({ name, url }));
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function CertificateUpload({
  certifications,
  onChange,
  disabled = false,
}: CertificateUploadProps) {
  // ── State ──────────────────────────────────────────────────────────────────
  // Items are initialised once from props. The component owns this state.
  // Parent switches profiles by changing `key` (selectedEnrollment), which
  // unmounts and remounts the component cleanly — no render-time sync needed.
  const [items, setItems] = useState<CertItem[]>(() =>
    certifications.map(certItemFromCert)
  );
  const [isDragging, setIsDragging] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  // Draft field for the manual add form (name only; image comes from the drop zone)
  const [draftName, setDraftName] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const replaceTargetIdRef = useRef<string>("");

  const { toast } = useToast();

  // Stable ref to onChange so upload callbacks never go stale
  const onChangeRef = useRef(onChange);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

  // ── Notify parent (only for committed changes — NOT keystrokes) ────────────
  const notifyParent = useCallback((items: CertItem[]) => {
    onChangeRef.current(toCleanCerts(items));
  }, []);

  // ── Name commit (called on blur from CertCard's local state) ──────────────
  // Typing happens entirely inside CertCard's localName state.
  // This runs only when the user leaves the input — no re-render per keystroke.
  const handleNameCommit = useCallback((id: string, name: string) => {
    setItems(prev => {
      const next = prev.map(it => it.id === id ? { ...it, name } : it);
      notifyParent(next);
      return next;
    });
  }, [notifyParent]);

  // ── URL commit (manual paste, on blur) ────────────────────────────────────
  const handleUrlCommit = useCallback((id: string, url: string) => {
    setItems(prev => {
      const next = prev.map(it => it.id === id ? { ...it, url } : it);
      notifyParent(next);
      return next;
    });
  }, [notifyParent]);

  // ── Remove ────────────────────────────────────────────────────────────────
  const handleRemove = useCallback((id: string) => {
    setItems(prev => {
      const item = prev.find(it => it.id === id);
      if (item?.localPreview) URL.revokeObjectURL(item.localPreview);
      const next = prev.filter(it => it.id !== id);
      notifyParent(next);
      return next;
    });
  }, [notifyParent]);

  // ── Add manual entry (name + URL filled in the top form) ──────────────────
  const handleAddManual = useCallback((name: string, url: string) => {
    setIsExpanded(true);
    const newItem: CertItem = { id: newId(), name: name.trim(), url: url.trim(), uploading: false };
    setItems(prev => {
      const next = [newItem, ...prev];
      notifyParent(next);
      return next;
    });
  }, [notifyParent]);

  // ── Replace click ─────────────────────────────────────────────────────────
  const handleReplaceClick = useCallback((id: string) => {
    replaceTargetIdRef.current = id;
    replaceInputRef.current?.click();
  }, []);

  // ── Upload files ──────────────────────────────────────────────────────────
  // Uses functional setItems(prev => ...) throughout — NO stale closure over items.
  const uploadFiles = useCallback(async (files: FileList, insertAtId?: string) => {
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;

    setIsExpanded(true); // Automatically expand list when files are uploaded

    // 1. Create placeholder items and insert them
    const placeholders: CertItem[] = fileArray.map(f => ({
      id: newId(),
      name: f.name.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " "),
      url: "",
      uploading: true,
      localPreview: URL.createObjectURL(f),
    }));

    setItems(prev => {
      if (insertAtId) {
        // Replace the target slot with the first placeholder; append the rest
        const replaced = prev.map(it =>
          it.id === insertAtId
            ? { ...placeholders[0], id: it.id } // keep the card's stable id
            : it
        );
        return [...replaced, ...placeholders.slice(1)];
      }
      return [...prev, ...placeholders];
    });

    // 2. Upload each file independently
    for (let i = 0; i < fileArray.length; i++) {
      const file = fileArray[i];
      // When replacing, the first file uses the existing card's id
      const itemId =
        insertAtId && i === 0 ? insertAtId : placeholders[i].id;

      try {
        const processedFile = await processCertificateFile(file);

        // ── Update preview immediately after conversion ────────────────────
        // PDFs render to a <img>-incompatible blob URL. All other formats get
        // re-encoded to WebP, so we always swap the preview to the converted
        // file so the user sees the result before the upload finishes.
        const convertedPreviewUrl = URL.createObjectURL(processedFile);
        setItems(prev => prev.map(it => {
          if (it.id !== itemId) return it;
          if (it.localPreview) URL.revokeObjectURL(it.localPreview);
          return { ...it, localPreview: convertedPreviewUrl };
        }));

        const fd = new FormData();
        fd.append("file", processedFile);

        const res = await adminAPI.uploadCertificate(fd);
        const uploadedUrl: string = res?.data?.url || res?.url || "";
        if (!uploadedUrl) throw new Error("Upload succeeded but no URL returned.");

        setItems(prev => {
          const next = prev.map(it => {
            if (it.id !== itemId) return it;
            if (it.localPreview) URL.revokeObjectURL(it.localPreview);
            return { ...it, url: uploadedUrl, uploading: false, localPreview: undefined, error: undefined };
          });
          onChangeRef.current(toCleanCerts(next));
          return next;
        });
      } catch (err: any) {
        const msg = err.message || "Upload failed.";
        toast({
          variant: "destructive",
          title: `Upload failed: ${file.name}`,
          description: msg,
        });
        setItems(prev =>
          prev.map(it =>
            it.id === itemId
              ? { ...it, uploading: false, error: msg }
              : it
          )
        );
      }
    }
  }, [toast]); // ← intentionally no `items` or `onChange` dependency

  // ── Drag handlers ─────────────────────────────────────────────────────────
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);
  const handleDragLeave = useCallback(() => setIsDragging(false), []);
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled) return;
    if (e.dataTransfer.files?.length) uploadFiles(e.dataTransfer.files);
  }, [disabled, uploadFiles]);

  // ── File input handlers ───────────────────────────────────────────────────
  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) uploadFiles(e.target.files);
    e.target.value = "";
  }, [uploadFiles]);

  const handleReplaceChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) uploadFiles(e.target.files, replaceTargetIdRef.current);
    e.target.value = "";
  }, [uploadFiles]);

  const anyUploading = items.some(it => it.uploading);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Award className="w-4 h-4 text-[#8B735B]" />
          <h3 className="text-base font-bold text-[#1a1810]">📜 Certifications</h3>
        </div>
        <span className="text-[11px] text-muted-foreground italic">
          JPG, PNG, WebP, AVIF, PDF · stored as WebP · max 10MB
        </span>
      </div>

      {/* Drop zone */}
      {!disabled && (
        <div
          className={cn(
            "relative border-2 border-dashed rounded-2xl p-6 transition-all duration-200 cursor-pointer",
            isDragging
              ? "border-[#2A5D4B] bg-[#2A5D4B]/5 scale-[1.01]"
              : "border-[#D4C9B6] bg-white/50 hover:border-[#2A5D4B]/50 hover:bg-white/80",
            anyUploading && "pointer-events-none opacity-60"
          )}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => !anyUploading && fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={SUPPORTED_TYPES.join(",")}
            className="hidden"
            onChange={handleFileInputChange}
          />
          <div className="flex flex-col items-center gap-3 text-center">
            {anyUploading ? (
              <Loader2 className="w-8 h-8 animate-spin text-[#2A5D4B]" />
            ) : (
              <div className="w-12 h-12 rounded-full bg-[#EAD8C0]/30 flex items-center justify-center">
                <Upload className="w-6 h-6 text-[#8B735B]" />
              </div>
            )}
            <div>
              <p className="text-sm font-bold text-[#8B735B]">
                {anyUploading ? "Uploading certificates..." : "Drop certificates here or click to browse"}
              </p>
              <p className="text-[11px] text-[#8B735B]/60 mt-0.5 font-medium uppercase tracking-wider">
                Supports JPG, PNG, WebP, AVIF, PDF · converted to WebP · up to 10MB each · multiple allowed
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Hidden replace input */}
      <input
        ref={replaceInputRef}
        type="file"
        accept={SUPPORTED_TYPES.join(",")}
        className="hidden"
        onChange={handleReplaceChange}
      />

      {/* Manual add form — fill name + URL, then Add */}
      {!disabled && (
        <div className="border border-dashed border-[#D4C9B6] rounded-xl p-3 bg-white/50 flex gap-2">
          <Input
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            placeholder="Certificate name (e.g. AWS Cloud Practitioner)"
            className="bg-white border-[#D4C9B6] rounded-xl text-sm h-9 flex-1"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-[#D4C9B6] text-[#1a1810] hover:bg-[#F3F0E8] h-9 shrink-0"
            disabled={anyUploading || !draftName.trim()}
            onClick={(e) => {
              e.stopPropagation();
              handleAddManual(draftName, "");
              setDraftName("");
            }}
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Add
          </Button>
        </div>
      )}

      {/* Certificate cards */}
      {items.length > 0 && (
        <div className="space-y-4">
          <motion.div layout="position" className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {items.map((item, idx) => {
              const isHidden = idx >= 2;
              return (
                <AnimatePresence key={item.id} initial={false}>
                  {(!isHidden || isExpanded) && (
                    <motion.div
                      layout
                      initial={isHidden ? { opacity: 0, scale: 0.95 } : undefined}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={isHidden ? { opacity: 0, scale: 0.95 } : undefined}
                      transition={{ duration: 0.25, ease: "easeInOut" }}
                      className="w-full"
                    >
                      <CertCard
                        item={item}
                        disabled={disabled}
                        onNameCommit={handleNameCommit}
                        onUrlCommit={handleUrlCommit}
                        onRemove={handleRemove}
                        onReplace={handleReplaceClick}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              );
            })}
          </motion.div>

          {/* Show More / Show Less button */}
          {items.length > 2 && (
            <div className="flex justify-center pt-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setIsExpanded(!isExpanded)}
                className="text-[#2A5D4B] hover:text-[#21493A] hover:bg-[#2A5D4B]/10 font-bold flex items-center gap-1.5 rounded-full px-4"
              >
                {isExpanded ? (
                  <>Show Less</>
                ) : (
                  <>Show More ({items.length - 2} more)</>
                )}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {items.length === 0 && disabled && (
        <p className="text-sm text-muted-foreground italic text-center py-4">
          No certifications added yet.
        </p>
      )}
    </div>
  );
}

// ─── Certificate Card ─────────────────────────────────────────────────────────
// Memoized so it only re-renders when its own item data or callbacks change.
// The name input is uncontrolled locally — typing never touches parent state.

interface CertCardProps {
  item: CertItem;
  disabled: boolean;
  /** Called on blur with the final committed name */
  onNameCommit: (id: string, name: string) => void;
  /** Called on blur with a manually pasted URL */
  onUrlCommit: (id: string, url: string) => void;
  onRemove: (id: string) => void;
  onReplace: (id: string) => void;
}

const CertCard = memo(function CertCard({
  item,
  disabled,
  onNameCommit,
  onUrlCommit,
  onRemove,
  onReplace,
}: CertCardProps) {
  // Local name state — completely isolated from parent.
  // Typing here causes ONLY this card to re-render.
  // The parent is notified only on blur via onNameCommit.
  const [localName, setLocalName] = useState(item.name);
  const [imgError, setImgError] = useState(false);

  // Keep localName in sync if the item's name changes externally
  // (e.g. when item is replaced by a new upload).
  // Using a ref-compare avoids re-running on every parent render.
  const prevItemNameRef = useRef(item.name);
  if (item.name !== prevItemNameRef.current && item.name !== localName) {
    prevItemNameRef.current = item.name;
    setLocalName(item.name);
  }

  const previewSrc = item.localPreview || item.url;
  const hasPreview = Boolean(previewSrc);

  // Stable callbacks — won't change between renders since they only depend on item.id
  const handleNameBlur = useCallback(() => {
    onNameCommit(item.id, localName);
  }, [item.id, localName, onNameCommit]);

  const handleUrlBlur = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    const url = e.target.value.trim();
    if (url) onUrlCommit(item.id, url);
  }, [item.id, onUrlCommit]);

  const handleRemoveClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onRemove(item.id);
  }, [item.id, onRemove]);

  const handleReplaceClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onReplace(item.id);
  }, [item.id, onReplace]);

  return (
    <div
      className={cn(
        "bg-white border rounded-2xl overflow-hidden shadow-sm transition-all duration-200",
        item.error
          ? "border-red-300 bg-red-50/30"
          : "border-[#D4C9B6] hover:border-[#8B735B]/40 hover:shadow-md"
      )}
    >
      {/* Image preview area */}
      <div className="relative w-full h-40 bg-slate-100 group">
        {item.uploading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm z-10">
            <Loader2 className="w-7 h-7 animate-spin text-[#2A5D4B] mb-2" />
            <span className="text-xs font-bold text-[#2A5D4B] uppercase tracking-widest">
              {item.localPreview ? "Uploading..." : "Converting to WebP..."}
            </span>
          </div>
        )}

        {hasPreview && !imgError ? (
          <img
            src={previewSrc}
            alt={localName || "Certificate preview"}
            className={cn(
              "w-full h-full object-cover transition-all duration-300",
              item.uploading && "opacity-40 blur-sm"
            )}
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-slate-400">
            {item.error ? (
              <>
                <AlertCircle className="w-8 h-8 text-red-400" />
                <p className="text-[11px] font-bold text-red-500 text-center px-3 leading-tight">
                  {item.error}
                </p>
              </>
            ) : (
              <>
                <FileImage className="w-8 h-8" />
                <p className="text-[11px] text-slate-400">No preview</p>
              </>
            )}
          </div>
        )}

        {/* Hover overlay with actions */}
        {!item.uploading && !disabled && (
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={handleReplaceClick}
              className="px-3 py-1.5 rounded-lg bg-white text-[11px] font-black uppercase tracking-wider text-slate-700 hover:bg-[#2A5D4B] hover:text-white transition-colors"
            >
              Replace
            </button>
            {item.url && (
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="px-3 py-1.5 rounded-lg bg-white text-[11px] font-black uppercase tracking-wider text-slate-700 hover:bg-blue-500 hover:text-white transition-colors flex items-center gap-1"
              >
                <ExternalLink className="w-3 h-3" /> View
              </a>
            )}
          </div>
        )}

        {/* Status badge */}
        {!item.uploading && (
          <div
            className={cn(
              "absolute top-2 left-2 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider",
              item.error
                ? "bg-red-100 text-red-600"
                : item.url
                ? "bg-emerald-100 text-emerald-700"
                : "bg-slate-100 text-slate-500"
            )}
          >
            {item.error ? (
              "Failed"
            ) : item.url ? (
              <span className="flex items-center gap-1">
                <CheckCircle2 className="w-2.5 h-2.5" /> Uploaded
              </span>
            ) : (
              "Draft"
            )}
          </div>
        )}

        {/* Remove button */}
        {!disabled && !item.uploading && (
          <button
            type="button"
            onClick={handleRemoveClick}
            className="absolute top-2 right-2 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 transition-colors shadow-sm z-10"
            title="Remove certificate"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Name input — local state, parent notified on blur only */}
      <div className="p-3 space-y-2">
        <Label className="text-[11px] font-bold text-[#8B735B] uppercase tracking-wide">
          Certificate Name
        </Label>
        <Input
          value={localName}
          onChange={(e) => setLocalName(e.target.value)}
          onBlur={handleNameBlur}
          placeholder="e.g. AWS Cloud Practitioner"
          className="bg-white border-[#D4C9B6] rounded-xl text-sm h-9"
          disabled={disabled || item.uploading}
        />

        {/* Manual URL field — visible only when no file uploaded */}
        {!item.url && !item.uploading && !disabled && (
          <Input
            defaultValue=""
            placeholder="Or paste image/Cloudinary URL..."
            className="bg-white border-[#D4C9B6] rounded-xl text-xs h-8 text-muted-foreground"
            onBlur={handleUrlBlur}
          />
        )}
      </div>
    </div>
  );
});
