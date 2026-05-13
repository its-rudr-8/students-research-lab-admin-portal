import { useState, useRef, useEffect } from "react";
import { Upload, X, Loader2, Image as ImageIcon, Film } from "lucide-react";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { adminAPI } from "@/lib/adminApi";
import { cn } from "@/lib/utils";

interface ImageUploadProps {
  onImageUpload: (imageUrl: string, publicId?: string) => void;
  currentImage?: string;
  label?: string;
  required?: boolean;
  maxSize?: number; // in MB, default 10
  section?: "activity" | "achievement" | "student" | "session" | string;
  mediaType?: "image" | "video" | "both";
  variant?: "default" | "avatar";
}

export default function ImageUpload({
  onImageUpload,
  currentImage,
  label = "Upload Media",
  required = false,
  maxSize = 10,
  section = "student",
  mediaType = "image",
  variant = "default",
}: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(currentImage || null);
  const [isLocalVideo, setIsLocalVideo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const isVideoUrl = (url: string | null): boolean => {
    if (!url) return false;
    // For blob URLs, we rely on the state set during file selection
    if (url.startsWith("blob:")) return isLocalVideo;
    
    const urlLower = url.toLowerCase();
    const videoExtensions = [".mp4", ".webm", ".ogg", ".mov", ".m4v", ".quicktime"];
    
    return (
      videoExtensions.some(ext => urlLower.includes(ext)) || 
      urlLower.includes("/video/upload/") ||
      urlLower.startsWith("data:video/")
    );
  };

  useEffect(() => {
    // Debug log to trace media initialization
    if (currentImage) {
      console.log(`[ImageUpload] Initializing with currentImage: ${currentImage} | isVideo: ${isVideoUrl(currentImage)}`);
    }
    setPreview(currentImage || null);
    // If it's an external URL, reset isLocalVideo as we rely on the robust detection
    if (currentImage && !currentImage.startsWith("blob:")) {
      setIsLocalVideo(false);
    }
  }, [currentImage]);

  const validateFile = (file: File): string | null => {
    const fileSizeMB = file.size / (1024 * 1024);
    if (fileSizeMB > maxSize) {
      return `File size must be less than ${maxSize}MB. Your file is ${fileSizeMB.toFixed(1)}MB.`;
    }
    const isVideo = file.type.startsWith("video/");
    const isImage = file.type.startsWith("image/");
    if (mediaType === "image" && !isImage) {
      return "Only image files (JPEG, PNG, GIF, WebP) are allowed.";
    }
    if (mediaType === "video" && !isVideo) {
      return "Only video files (MP4, WebM, OGG, MOV) are allowed.";
    }
    if (mediaType === "both" && !isImage && !isVideo) {
      return "Only image or video files are allowed.";
    }
    return null;
  };

  const uploadFile = async (file: File) => {
    const validationError = validateFile(file);
    if (validationError) {
      toast({ variant: "destructive", title: "Invalid file", description: validationError });
      return;
    }

    const isVideo = file.type.startsWith("video/");
    setIsLocalVideo(isVideo);

    // Show a local object URL as an instant preview before the upload completes
    const localObjectUrl = URL.createObjectURL(file);
    const previousPreview = preview; 
    setPreview(localObjectUrl);

    try {
      setUploading(true);

      const formData = new FormData();
      formData.append("file", file);
      if (section) formData.append("section", section);
      formData.append("mediaType", isVideo ? "video" : "image");

      const data = await adminAPI.uploadMedia(formData);
      const imageUrl = data.url || data.data?.url;
      const publicId = data.public_id || data.data?.public_id;

      if (imageUrl) {
        URL.revokeObjectURL(localObjectUrl);
        setPreview(imageUrl);
        setIsLocalVideo(isVideo); // Update again in case it changed (shouldn't)
        onImageUpload(imageUrl, publicId);
        toast({ title: "Success", description: "File uploaded successfully!" });
      } else {
        throw new Error(data.message || "Server did not return a valid URL.");
      }
    } catch (error: any) {
      URL.revokeObjectURL(localObjectUrl);
      setPreview(previousPreview);
      setIsLocalVideo(previousPreview ? isVideoUrl(previousPreview) : false);

      console.error("[ImageUpload] Upload error:", error);
      toast({
        variant: "destructive",
        title: "Upload failed",
        description: error.message || "Failed to upload file. Please try again.",
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleRemoveImage = () => {
    setPreview(null);
    setIsLocalVideo(false);
    onImageUpload("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files?.[0];
    if (file) await uploadFile(file);
  };

  const isCurrentPreviewVideo = isVideoUrl(preview);

  return (
    <div className="w-full">
      <Label className="mb-2 block text-[#8B735B] font-bold">
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </Label>

      <div
        className={cn(
          "relative border-2 border-dashed border-[#EAD8C0]/60 transition-all hover:border-teal-600/50 cursor-pointer overflow-hidden group",
          variant === "avatar"
            ? "w-32 h-32 mx-auto rounded-full p-1.5 flex items-center justify-center bg-white shadow-sm"
            : "w-full rounded-2xl p-4 min-h-[160px] bg-white/50 hover:bg-white/80"
        )}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={() => !uploading && fileInputRef.current?.click()}
      >
        <input
          id="image-file-upload"
          name="image-file-upload"
          ref={fileInputRef}
          type="file"
          accept={
            mediaType === "video" 
              ? "video/*" 
              : mediaType === "both" 
                ? "image/*,video/*" 
                : "image/*"
          }
          onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFile(f); }}
          className="hidden"
          disabled={uploading}
        />

        {!preview ? (
          <div className="flex flex-col items-center justify-center gap-3 text-center py-4">
            {uploading ? (
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
                <p className="text-[10px] font-bold text-teal-600 uppercase tracking-widest">Uploading...</p>
              </div>
            ) : (
              <>
                <div className="w-12 h-12 rounded-full bg-[#EAD8C0]/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                  {mediaType === "video" ? (
                    <Film className="w-6 h-6 text-[#8B735B]" />
                  ) : (
                    <Upload className="w-6 h-6 text-[#8B735B]" />
                  )}
                </div>
                
                {variant !== "avatar" && (
                  <div>
                    <p className="text-sm font-bold text-[#8B735B]">
                      Drop your {mediaType === "both" ? "media" : mediaType} here
                    </p>
                    <p className="text-[10px] text-[#8B735B]/60 mt-1 font-medium uppercase tracking-wider">
                      {mediaType === "video" 
                        ? "MP4, WebM, OGG, MOV" 
                        : mediaType === "both" 
                          ? "Images or Videos" 
                          : "JPEG, PNG, GIF, WebP"} up to {maxSize}MB
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        ) : (
          <div className={cn("relative w-full h-full animate-in fade-in duration-300", variant === "avatar" ? "rounded-full" : "rounded-xl")}>
            <div className={cn(
              "relative bg-slate-100 overflow-hidden shadow-inner",
              variant === "avatar" ? "w-full h-full rounded-full" : "w-full h-48 sm:h-56 rounded-xl border border-[#EAD8C0]/30"
            )}>
              {isCurrentPreviewVideo ? (
                <video
                  key={preview || "empty"} // Force re-mount when source changes
                  src={preview || ""}
                  className="w-full h-full object-cover"
                  controls
                  playsInline
                >
                  Your browser does not support the video tag.
                </video>
              ) : (
                <img
                  src={preview}
                  alt="Preview"
                  className="w-full h-full object-cover"
                />
              )}
              
              {uploading && (
                <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex flex-col items-center justify-center text-white gap-2">
                  <Loader2 className="w-8 h-8 animate-spin" />
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em]">Updating...</span>
                </div>
              )}
            </div>

            {!uploading && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemoveImage();
                }}
                className={cn(
                  "absolute bg-red-500 text-white rounded-full p-1.5 hover:bg-red-600 transition-all shadow-lg z-10 hover:scale-110",
                  variant === "avatar" ? "bottom-0 right-0" : "top-2 right-2"
                )}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}

            {variant !== "avatar" && !uploading && (
              <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                <p className="text-[10px] text-white text-center font-bold uppercase tracking-widest">
                  Click to replace
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
