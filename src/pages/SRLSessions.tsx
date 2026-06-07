import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Calendar, Loader2, Pencil, Plus, Trash2, Video, ExternalLink, Presentation, Film } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useConfirm } from "@/components/ConfirmProvider";
import { hasWriteAccess } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { adminAPI, parseList } from "@/lib/adminApi";
import ImageUpload from "@/components/ImageUpload";
import { cn } from "@/lib/utils";

interface SRLSession {
  id: number;
  serial_no: number;
  title: string;
  description?: string;
  session_date?: string;
  category?: string;
  linkedin_url?: string;
  image_url?: string;
  media_urls?: string[];
  created_at?: string;
}

const isVideoMedia = (url: string | null): boolean => {
  if (!url) return false;
  const urlLower = url.toLowerCase();
  const videoExtensions = [".mp4", ".webm", ".ogg", ".mov", ".m4v", ".quicktime"];
  return (
    videoExtensions.some((ext) => urlLower.includes(ext)) ||
    urlLower.includes("/video/upload/") ||
    urlLower.startsWith("data:video/") ||
    urlLower.startsWith("blob:")
  );
};

const MediaRenderer = ({ url, className, showControls = false }: { url: string; className?: string; showControls?: boolean }) => {
  if (!url) return null;
  const isVideo = isVideoMedia(url);
  
  if (isVideo) {
    return (
      <video
        key={url}
        src={url}
        className={cn("w-full h-full object-cover", className)}
        controls={showControls}
        muted={!showControls}
        loop={!showControls}
        playsInline
        onMouseOver={(e) => !showControls && e.currentTarget.play()}
        onMouseOut={(e) => {
          if (!showControls) {
            e.currentTarget.pause();
            e.currentTarget.currentTime = 0;
          }
        }}
      >
        Your browser does not support the video tag.
      </video>
    );
  }
  
  return <img src={url} alt="Preview" className={cn("w-full h-full object-cover", className)} />;
};

const todayStr = new Date().toISOString().split("T")[0];
const isValidUrl = (url: string) =>
  !url || /^(https?:\/\/)?(([\w-]+\.)+[\w-]{2,})(\/[\w\-./?%&=#]*)?$/i.test(url);

export default function SRLSessions() {
  const [sessions, setSessions] = useState<SRLSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<SRLSession | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [editSubmitting, setEditSubmitting] = useState(false);
  
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    session_date: "",
    category: "",
    linkedin_url: "",
    media_urls: [] as string[],
  });
  
  const [editFormData, setEditFormData] = useState({
    title: "",
    description: "",
    session_date: "",
    category: "",
    linkedin_url: "",
    media_urls: [] as string[],
  });
  
  const { toast } = useToast();
  const canEdit = hasWriteAccess();
  const confirm = useConfirm();

  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    try {
      setLoading(true);
      const response = await adminAPI.getSessions();

      const list = parseList(response);
      const sorted = list.sort((a: any, b: any) => (a.serial_no || 0) - (b.serial_no || 0));
      setSessions(sorted as SRLSession[]);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error fetching sessions",
        description: error.message,
      });
      setSessions([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAddSession = async () => {
    if (!canEdit) return;

    const errs: string[] = [];
    if (!formData.title.trim()) errs.push("Title is required.");
    if (!formData.session_date) errs.push("Session date is required.");
    if (!isValidUrl(formData.linkedin_url)) errs.push("Resource link is not a valid URL.");
    if (formData.session_date && formData.session_date > todayStr) errs.push("Session date cannot be in the future.");
    if (errs.length) {
      toast({ variant: "destructive", title: "Validation error", description: errs.join(" ") });
      return;
    }

    try {
      setSubmitting(true);
      
      const response = await adminAPI.createSession({
        title: formData.title.trim(),
        description: formData.description.trim() || null,
        session_date: formData.session_date || null,
        category: formData.category.trim() || null,
        linkedin_url: formData.linkedin_url.trim() || null,
        // Send media_urls[0] as image_url for compatibility, and the full array
        image_url: formData.media_urls.length > 0 ? formData.media_urls[0] : null,
        media_urls: formData.media_urls,
      });

      if (response) {
        toast({ title: "Session added successfully" });
        setOpen(false);
        setFormData({
          title: "",
          description: "",
          session_date: "",
          category: "",
          linkedin_url: "",
          media_urls: [],
        });
        fetchSessions();
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error adding session",
        description: error.message,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteSession = async (id: number) => {
    if (!canEdit) return;
    const ok = await confirm({ title: "Delete session", description: "Are you sure you want to delete this session?" });
    if (!ok) return;

    try {
      await adminAPI.deleteSession(String(id));
      toast({ title: "Session deleted" });
      fetchSessions();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error deleting session",
        description: error.message,
      });
    }
  };

  const handleStartEdit = (session: SRLSession) => {
    setEditingSession(session);
    
    // Standardize the media URLs
    const mediaUrls = session.media_urls && session.media_urls.length > 0 
      ? session.media_urls 
      : (session.image_url ? [session.image_url] : []);

    setEditFormData({
      title: session.title || "",
      description: session.description || "",
      session_date: session.session_date
        ? session.session_date.split("T")[0]
        : "",
      category: session.category || "",
      linkedin_url: session.linkedin_url || "",
      media_urls: mediaUrls,
    });
    setEditOpen(true);
  };

  const handleUpdateSession = async () => {
    if (!editingSession || !canEdit) return;

    const errs: string[] = [];
    if (!editFormData.title.trim()) errs.push("Title is required.");
    if (!editFormData.session_date) errs.push("Session date is required.");
    if (!isValidUrl(editFormData.linkedin_url)) errs.push("Resource link is not a valid URL.");
    if (editFormData.session_date && editFormData.session_date > todayStr) errs.push("Session date cannot be in the future.");
    if (errs.length) {
      toast({ variant: "destructive", title: "Validation error", description: errs.join(" ") });
      return;
    }

    try {
      setEditSubmitting(true);
      
      const response = await adminAPI.updateSession(String(editingSession.id), {
        title: editFormData.title.trim(),
        description: editFormData.description.trim() || null,
        session_date: editFormData.session_date || null,
        category: editFormData.category.trim() || null,
        linkedin_url: editFormData.linkedin_url.trim() || null,
        image_url: editFormData.media_urls.length > 0 ? editFormData.media_urls[0] : null,
        media_urls: editFormData.media_urls,
      });

      if (response) {
        toast({ title: "Session updated successfully" });
        setEditOpen(false);
        fetchSessions();
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error updating session",
        description: error.message,
      });
    } finally {
      setEditSubmitting(false);
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "N/A";
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
    } catch (e) {
      return dateStr;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-[#8B735B]" />
      </div>
    );
  }

  return (
    <div className="min-h-full">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col lg:flex-row gap-8 items-start"
      >
        <div className="flex-1 w-full space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-[#EAD8C0]/20 to-transparent p-4 rounded-2xl border border-[#EAD8C0]/30">
            <div>
              <h1 className="text-xl font-bold text-[#8B735B] flex items-center gap-2">
                <Presentation className="w-6 h-6 text-orange-500" />
                SRL Sessions
              </h1>
              <p className="text-xs text-[#8B735B]/70 font-medium uppercase tracking-wider mt-1">Managing Lab technical sessions and presentations</p>
            </div>
            {canEdit && (
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-teal-700 hover:bg-teal-800 text-white rounded-xl gap-2 font-bold shadow-md">
                    <Plus className="w-4 h-4" /> Add New Session
                  </Button>
                </DialogTrigger>
                <DialogContent className="rounded-[32px] max-w-[92vw] sm:max-w-md max-h-[90vh] overflow-y-auto bg-[#FAF7F2] border-[#EAD8C0]/50 shadow-2xl p-4 sm:p-6">
                  <DialogHeader><DialogTitle className="text-orange-700 font-bold">Add New Session</DialogTitle></DialogHeader>
                  <div className="space-y-4 pt-2">
                    <div className="grid gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-[#8B735B] font-bold">Session Title *</Label>
                        <Input placeholder="Session title" className="rounded-xl border-[#EAD8C0]/40 bg-white" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <Label className="text-[#8B735B] font-bold">Category</Label>
                          <Input placeholder="e.g. Technical" className="rounded-xl border-[#EAD8C0]/40 bg-white" value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-[#8B735B] font-bold">Session Date</Label>
                          <Input type="date" max={todayStr} className="rounded-xl border-[#EAD8C0]/40 bg-white" value={formData.session_date} onChange={(e) => setFormData({ ...formData, session_date: e.target.value })} />
                        </div>
                      </div>
                      
                      {/* Standardized Media Upload Section */}
                      <div className="space-y-2 p-4 bg-white rounded-2xl border border-[#EAD8C0]/40 shadow-sm">
                        <div className="flex items-center gap-2 mb-1">
                          <Film className="w-4 h-4 text-orange-600" />
                          <p className="text-[10px] font-black text-[#8B735B]/50 uppercase tracking-[0.18em]">Session Media</p>
                        </div>
                        <ImageUpload 
                          label="" 
                          onImageUpload={(url) => setFormData(prev => ({ ...prev, media_urls: url ? [url] : [] }))} 
                          currentImage={formData.media_urls[0]} 
                          section="session" 
                          mediaType="both" 
                          maxSize={50} 
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-[#8B735B] font-bold">Description</Label>
                        <Textarea placeholder="What was covered in this session?" className="rounded-xl resize-none border-[#EAD8C0]/40 bg-white" rows={3} value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[#8B735B] font-bold">Resource Link (LinkedIn/Drive)</Label>
                        <Input placeholder="https://..." className="rounded-xl border-[#EAD8C0]/40 bg-white" value={formData.linkedin_url} onChange={(e) => setFormData({ ...formData, linkedin_url: e.target.value })} />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                      <Button variant="outline" className="rounded-xl border-[#EAD8C0]" onClick={() => setOpen(false)}>Cancel</Button>
                      <Button className="rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-bold" onClick={handleAddSession} disabled={submitting}>
                        {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create Session"}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>

          <div className="glass-card rounded-2xl overflow-hidden border-[#EAD8C0]/50 shadow-xl bg-white/50">
            <div className="px-5 py-3 border-b border-[#EAD8C0]/40 bg-[#FAF7F2]/80 flex justify-between items-center">
              <span className="text-[10px] font-black text-[#8B735B]/60 uppercase tracking-[0.2em]">Session Records</span>
              <span className="text-[10px] font-bold text-[#8B735B]/40">{sessions.length} ENTRIES</span>
            </div>

            <div className={cn(
              "overflow-y-auto pr-1 transition-all duration-300",
              sessions.length > 5 ? "max-h-[620px]" : "max-h-none"
            )}>
              <div className="divide-y divide-[#EAD8C0]/20">
                <AnimatePresence mode="popLayout">
                  {sessions.length === 0 ? (
                    <div className="p-12 text-center text-muted-foreground italic">No sessions recorded yet.</div>
                  ) : (
                    sessions.map((session, i) => (
                      <motion.div
                        key={session.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className={cn(
                          "group p-6 flex flex-col sm:flex-row gap-6 hover:bg-[#FAF7F2] transition-all duration-300 relative",
                          i % 2 === 0 ? "bg-white/40" : "bg-[#FAF7F2]/10"
                        )}
                      >
                        {i < sessions.length - 1 && (
                          <div className="absolute bottom-0 left-6 right-6 h-px bg-gradient-to-r from-transparent via-[#EAD8C0]/60 to-transparent" />
                        )}
                        {(() => {
                          const mediaUrl = (session.media_urls && session.media_urls.length > 0) ? session.media_urls[0] : session.image_url || "";
                          const hasMedia = !!mediaUrl;
                          
                          if (!hasMedia) return null;

                          return (
                            <div className="w-full sm:w-40 aspect-video sm:aspect-square rounded-xl overflow-hidden shadow-lg border-2 border-white shrink-0 bg-orange-50/50 flex items-center justify-center group/media relative">
                              <MediaRenderer 
                                url={mediaUrl} 
                                className="group-hover/media:scale-110 transition-transform duration-700"
                              />
                              {isVideoMedia(mediaUrl) ? (
                                <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover/media:bg-transparent transition-colors pointer-events-none">
                                  <Video className="w-8 h-8 text-white drop-shadow-md group-hover/media:opacity-0 transition-opacity" />
                                </div>
                              ) : null}
                            </div>
                          );
                        })()}
                        <div className="flex-1 space-y-2">
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 border border-orange-200 uppercase tracking-tighter">
                                  #{session.serial_no}
                                </span>
                                {session.category && (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 uppercase tracking-tighter">
                                    {session.category}
                                  </span>
                                )}
                              </div>
                              <h3 className="text-base sm:text-lg font-bold text-[#8B735B] mt-1.5 group-hover:text-orange-700 transition-colors">{session.title}</h3>
                            </div>
                            {canEdit && (
                              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-[#EAD8C0]/30" onClick={() => handleStartEdit(session)}>
                                  <Pencil className="w-3.5 h-3.5" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-red-50 text-red-500" onClick={() => handleDeleteSession(session.id)}>
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            )}
                          </div>

                          <p className="text-xs sm:text-sm text-[#8B735B]/80 leading-relaxed line-clamp-2">
                            {session.description || "Knowledge sharing session conducted by Lab members."}
                          </p>

                          <div className="flex flex-wrap items-center gap-4 pt-1">
                            <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#8B735B]/60">
                              <Calendar className="w-3.5 h-3.5" />
                              {formatDate(session.session_date)}
                            </div>
                            {session.linkedin_url && (
                              <a
                                href={session.linkedin_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-[11px] font-bold text-orange-700 hover:underline bg-orange-50/50 px-2 py-0.5 rounded-lg border border-orange-100/50"
                              >
                                <ExternalLink className="w-3 h-3" /> Resources
                              </a>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    ))
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>

        <div className="hidden lg:flex flex-col items-center justify-start pt-32 pr-4 flex-[0.35]">
          <div className="sticky top-44">
            <img
              src="/session.webp"
              alt="SRL Sessions"
              className="max-w-[340px] rounded-[2rem] shadow-[0_0_50px_rgba(234,216,192,1),0_0_20px_rgba(255,255,255,0.4)] transform hover:-translate-y-1 transition-all duration-700"
            />
          </div>
        </div>
      </motion.div>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="rounded-[32px] max-w-[92vw] sm:max-w-md max-h-[90vh] overflow-y-auto bg-[#FAF7F2] border-[#EAD8C0]/50 shadow-2xl p-4 sm:p-6">
          <DialogHeader><DialogTitle className="text-orange-700 font-bold">Edit Session Details</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid gap-4">
              <div className="space-y-1.5">
                <Label className="text-[#8B735B] font-bold">Session Title *</Label>
                <Input placeholder="Session title" className="rounded-xl border-[#EAD8C0]/40 bg-white" value={editFormData.title} onChange={(e) => setEditFormData({ ...editFormData, title: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-[#8B735B] font-bold">Category</Label>
                  <Input placeholder="e.g. Technical" className="rounded-xl border-[#EAD8C0]/40 bg-white" value={editFormData.category} onChange={(e) => setEditFormData({ ...editFormData, category: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[#8B735B] font-bold">Session Date</Label>
                  <Input type="date" max={todayStr} className="rounded-xl border-[#EAD8C0]/40 bg-white" value={editFormData.session_date} onChange={(e) => setEditFormData({ ...editFormData, session_date: e.target.value })} />
                </div>
              </div>

              {/* Standardized Media Edit Section */}
              <div className="space-y-2 p-4 bg-white rounded-2xl border border-[#EAD8C0]/40 shadow-sm">
                <div className="flex items-center gap-2 mb-1">
                  <Film className="w-4 h-4 text-orange-600" />
                  <p className="text-[10px] font-black text-[#8B735B]/50 uppercase tracking-[0.18em]">Session Media</p>
                </div>
                <ImageUpload 
                  label="" 
                  onImageUpload={(url) => setEditFormData(prev => ({ ...prev, media_urls: url ? [url] : [] }))} 
                  currentImage={editFormData.media_urls[0]} 
                  section="session" 
                  mediaType="both" 
                  maxSize={50} 
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-[#8B735B] font-bold">Description</Label>
                <Textarea placeholder="What was covered in this session?" className="rounded-xl resize-none border-[#EAD8C0]/40 bg-white" rows={3} value={editFormData.description} onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[#8B735B] font-bold">Resource Link (LinkedIn/Drive)</Label>
                <Input placeholder="https://..." className="rounded-xl border-[#EAD8C0]/40 bg-white" value={editFormData.linkedin_url} onChange={(e) => setEditFormData({ ...editFormData, linkedin_url: e.target.value })} />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" className="rounded-xl border-[#EAD8C0]" onClick={() => setEditOpen(false)}>Cancel</Button>
              <Button className="rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-bold" onClick={handleUpdateSession} disabled={editSubmitting}>
                {editSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Changes"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
