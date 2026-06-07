import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Calendar, Loader2, Pencil, Plus, Trash2, Award, ExternalLink } from "lucide-react";
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

interface Achievement {
  id: number;
  serial_no: number;
  title: string;
  description?: string;
  achievement_date?: string;
  category?: string;
  linkedin_url?: string;
  image_url?: string;
  media_urls?: string[];
  created_at?: string;
}

const todayStr = new Date().toISOString().split("T")[0];
const isValidUrl = (url: string) =>
  !url || /^(https?:\/\/)?(([\w-]+\.)+[\w-]{2,})(\/[\w\-./?%&=#]*)?$/i.test(url);

export default function Achievements() {
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingAchievement, setEditingAchievement] = useState<Achievement | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [editSubmitting, setEditSubmitting] = useState(false);
  // image_url is used as the working image field in both forms;
  // on submit it is mapped to media_urls for the backend
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    achievement_date: "",
    category: "",
    linkedin_url: "",
    image_url: "",
  });
  const [editFormData, setEditFormData] = useState({
    title: "",
    description: "",
    achievement_date: "",
    category: "",
    linkedin_url: "",
    image_url: "",
  });
  const { toast } = useToast();
  const canEdit = hasWriteAccess();
  const confirm = useConfirm();

  useEffect(() => {
    fetchAchievements();
  }, []);

  const fetchAchievements = async () => {
    try {
      setLoading(true);
      const response = await adminAPI.getAchievements();

      const list = parseList(response);
      const sorted = list.sort((a: any, b: any) => (a.serial_no || 0) - (b.serial_no || 0));
      setAchievements(sorted as Achievement[]);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error fetching achievements",
        description: error.message,
      });
      setAchievements([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAddAchievement = async () => {
    if (!canEdit) return;

    const errs: string[] = [];
    if (!formData.title.trim()) errs.push("Title is required.");
    if (!formData.achievement_date) errs.push("Date is required.");
    if (!isValidUrl(formData.linkedin_url)) errs.push("LinkedIn URL is not a valid URL.");
    if (formData.achievement_date && formData.achievement_date > todayStr) errs.push("Date cannot be in the future.");
    if (errs.length) {
      toast({ variant: "destructive", title: "Validation error", description: errs.join(" ") });
      return;
    }

    try {
      setSubmitting(true);
      // Build media_urls from the uploaded image URL
      const mediaUrlsForCreate = formData.image_url.trim() ? [formData.image_url.trim()] : [];
      const response = await adminAPI.createAchievement({
        title: formData.title.trim(),
        description: formData.description.trim() || null,
        achievement_date: formData.achievement_date || null,
        category: formData.category.trim() || null,
        linkedin_url: formData.linkedin_url.trim() || null,
        image_url: formData.image_url.trim() || null,
        media_urls: mediaUrlsForCreate,
      });

      if (response) {
        toast({ title: "Achievement added" });
        setOpen(false);
        setFormData({
          title: "",
          description: "",
          achievement_date: "",
          category: "",
          linkedin_url: "",
          image_url: "",
        });
        fetchAchievements();
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error adding achievement",
        description: error.message,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteAchievement = async (id: number) => {
    if (!canEdit) return;
    const ok = await confirm({ title: "Delete achievement", description: "Are you sure you want to delete this achievement?" });
    if (!ok) return;

    try {
      await adminAPI.deleteAchievement(String(id));
      toast({ title: "Achievement deleted" });
      fetchAchievements();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error deleting achievement",
        description: error.message,
      });
    }
  };

  const handleStartEdit = (achievement: Achievement) => {
    setEditingAchievement(achievement);
    // Prefer media_urls[0] as the current image (canonical DB field),
    // fall back to image_url for legacy records
    const currentImage =
      (achievement.media_urls && achievement.media_urls.length > 0
        ? achievement.media_urls[0]
        : null) ||
      achievement.image_url ||
      "";
    setEditFormData({
      title: achievement.title || "",
      description: achievement.description || "",
      achievement_date: achievement.achievement_date
        ? achievement.achievement_date.split("T")[0]
        : "",
      category: achievement.category || "",
      linkedin_url: achievement.linkedin_url || "",
      image_url: currentImage,
    });
    setEditOpen(true);
  };

  const handleUpdateAchievement = async () => {
    if (!editingAchievement || !canEdit) return;

    const errs: string[] = [];
    if (!editFormData.title.trim()) errs.push("Title is required.");
    if (!editFormData.achievement_date) errs.push("Date is required.");
    if (!isValidUrl(editFormData.linkedin_url)) errs.push("LinkedIn URL is not a valid URL.");
    if (editFormData.achievement_date && editFormData.achievement_date > todayStr) errs.push("Date cannot be in the future.");
    if (errs.length) {
      toast({ variant: "destructive", title: "Validation error", description: errs.join(" ") });
      return;
    }

    try {
      setEditSubmitting(true);
      // Build media_urls from the uploaded/existing image URL
      const mediaUrlsForUpdate = editFormData.image_url.trim() ? [editFormData.image_url.trim()] : [];
      const response = await adminAPI.updateAchievement(String(editingAchievement.id), {
        title: editFormData.title.trim(),
        description: editFormData.description.trim() || null,
        achievement_date: editFormData.achievement_date || null,
        category: editFormData.category.trim() || null,
        linkedin_url: editFormData.linkedin_url.trim() || null,
        image_url: editFormData.image_url.trim() || null,
        // Always send media_urls so the backend persists the image correctly
        media_urls: mediaUrlsForUpdate,
      });

      if (response) {
        toast({ title: "Achievement updated" });
        setEditOpen(false);
        fetchAchievements();
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error updating achievement",
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
                <Award className="w-6 h-6 text-orange-500" />
                Lab Achievements
              </h1>
              <p className="text-xs text-[#8B735B]/70 font-medium uppercase tracking-wider mt-1">Celebrating our milestones and success</p>
            </div>
            {canEdit && (
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-teal-700 hover:bg-teal-800 text-white rounded-xl gap-2 font-bold shadow-md">
                    <Plus className="w-4 h-4" /> Add New
                  </Button>
                </DialogTrigger>
                <DialogContent className="rounded-[32px] max-w-[92vw] sm:max-w-md max-h-[90vh] overflow-y-auto bg-[#FAF7F2] border-[#EAD8C0]/50 shadow-2xl p-4 sm:p-6">
                  <DialogHeader><DialogTitle className="text-[#8B735B] font-bold">Add Achievement</DialogTitle></DialogHeader>
                  <div className="space-y-4 pt-2">
                    <div className="grid gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-[#8B735B] font-bold">Title *</Label>
                        <Input placeholder="Achievement title" className="rounded-xl border-[#EAD8C0]/40 bg-white" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <Label className="text-[#8B735B] font-bold">Category</Label>
                          <Input placeholder="e.g. Award" className="rounded-xl border-[#EAD8C0]/40 bg-white" value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-[#8B735B] font-bold">Date</Label>
                          <Input type="date" max={todayStr} className="rounded-xl border-[#EAD8C0]/40 bg-white" value={formData.achievement_date} onChange={(e) => setFormData({ ...formData, achievement_date: e.target.value })} />
                        </div>
                      </div>
                      <ImageUpload label="Achievement Media" onImageUpload={(url) => setFormData(prev => ({ ...prev, image_url: url }))} currentImage={formData.image_url} section="achievement" mediaType="both" maxSize={50} />
                      <div className="space-y-1.5">
                        <Label className="text-[#8B735B] font-bold">Description</Label>
                        <Textarea placeholder="Details..." className="rounded-xl resize-none border-[#EAD8C0]/40 bg-white" rows={3} value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[#8B735B] font-bold">LinkedIn Link</Label>
                        <Input placeholder="https://..." className="rounded-xl border-[#EAD8C0]/40 bg-white" value={formData.linkedin_url} onChange={(e) => setFormData({ ...formData, linkedin_url: e.target.value })} />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                      <Button variant="outline" className="rounded-xl border-[#EAD8C0]" onClick={() => setOpen(false)}>Cancel</Button>
                      <Button className="rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-bold" onClick={handleAddAchievement} disabled={submitting}>
                        {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create"}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>

          <div className="glass-card rounded-2xl overflow-hidden border-[#EAD8C0]/50 shadow-xl bg-white/50">
            <div className="px-5 py-3 border-b border-[#EAD8C0]/40 bg-[#FAF7F2]/80 flex justify-between items-center">
              <span className="text-[10px] font-black text-[#8B735B]/60 uppercase tracking-[0.2em]">Recognition Dashboard</span>
              <span className="text-[10px] font-bold text-[#8B735B]/40">{achievements.length} ENTRIES</span>
            </div>

            <div className={cn(
              "overflow-y-auto pr-1 transition-all duration-300",
              achievements.length > 5 ? "max-h-[620px]" : "max-h-none"
            )}>
              <div className="divide-y divide-[#EAD8C0]/20">
                <AnimatePresence mode="popLayout">
                  {achievements.length === 0 ? (
                    <div className="p-12 text-center text-muted-foreground italic">No achievements recorded yet.</div>
                  ) : (
                    achievements.map((achievement, i) => (
                      <motion.div
                        key={achievement.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className={cn(
                          "group p-6 flex flex-col sm:flex-row gap-6 hover:bg-[#FAF7F2] transition-all duration-300 relative",
                          i % 2 === 0 ? "bg-white/40" : "bg-[#FAF7F2]/10"
                        )}
                      >
                        {/* Decorative separator line */}
                        {i < achievements.length - 1 && (
                          <div className="absolute bottom-0 left-6 right-6 h-px bg-gradient-to-r from-transparent via-[#EAD8C0]/60 to-transparent" />
                        )}
                        {((achievement.media_urls && achievement.media_urls.length > 0) || achievement.image_url) && !achievement.title.includes("8 Teams") && (
                          <div className="w-full sm:w-24 h-24 rounded-xl overflow-hidden shadow-md border-2 border-white shrink-0">
                            <img src={(achievement.media_urls && achievement.media_urls.length > 0) ? achievement.media_urls[0] : achievement.image_url} alt="" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                          </div>
                        )}
                        <div className="flex-1 space-y-2">
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 border border-orange-200 uppercase tracking-tighter">
                                  #{achievement.serial_no}
                                </span>
                                {achievement.category && (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-100 uppercase tracking-tighter">
                                    {achievement.category}
                                  </span>
                                )}
                              </div>
                              <h3 className="text-base font-bold text-[#8B735B] mt-1.5 group-hover:text-teal-800 transition-colors">{achievement.title}</h3>
                            </div>
                            {canEdit && (
                              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-[#EAD8C0]/30" onClick={() => handleStartEdit(achievement)}>
                                  <Pencil className="w-3.5 h-3.5" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-red-50 text-red-500" onClick={() => handleDeleteAchievement(achievement.id)}>
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            )}
                          </div>

                          <p className="text-xs sm:text-sm text-[#8B735B]/80 leading-relaxed italic">
                            "{achievement.description || "Consistent excellence and research contribution."}"
                          </p>

                          <div className="flex flex-wrap items-center gap-4 pt-1">
                            <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#8B735B]/60">
                              <Calendar className="w-3.5 h-3.5" />
                              {formatDate(achievement.achievement_date)}
                            </div>
                            {achievement.linkedin_url && (
                              <a
                                href={achievement.linkedin_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-[11px] font-bold text-teal-700 hover:underline bg-teal-50/50 px-2 py-0.5 rounded-lg border border-teal-100/50"
                              >
                                <ExternalLink className="w-3 h-3" /> LinkedIn
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

        <div className="hidden lg:flex flex-col items-center justify-start pt-52 pr-4 flex-[0.35]">
          <div className="sticky top-44">
            <img
              src="/Achievement.webp"
              alt="Achievements"
              className="max-w-[340px] rounded-[2rem] shadow-[0_0_50px_rgba(234,216,192,1),0_0_20px_rgba(255,255,255,0.4)] border-4 border-[#EAD8C0] transform hover:rotate-1 transition-all duration-700"
            />
          </div>
        </div>
      </motion.div>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="rounded-[32px] max-w-[92vw] sm:max-w-md max-h-[90vh] overflow-y-auto bg-[#FAF7F2] border-[#EAD8C0]/50 shadow-2xl p-4 sm:p-6">
          <DialogHeader><DialogTitle className="text-[#8B735B] font-bold">Edit Achievement</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid gap-4">
              <div className="space-y-1.5">
                <Label className="text-[#8B735B] font-bold">Title *</Label>
                <Input placeholder="Achievement title" className="rounded-xl border-[#EAD8C0]/40 bg-white" value={editFormData.title} onChange={(e) => setEditFormData({ ...editFormData, title: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-[#8B735B] font-bold">Category</Label>
                  <Input placeholder="e.g. Award" className="rounded-xl border-[#EAD8C0]/40 bg-white" value={editFormData.category} onChange={(e) => setEditFormData({ ...editFormData, category: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[#8B735B] font-bold">Date</Label>
                  <Input type="date" max={todayStr} className="rounded-xl border-[#EAD8C0]/40 bg-white" value={editFormData.achievement_date} onChange={(e) => setEditFormData({ ...editFormData, achievement_date: e.target.value })} />
                </div>
              </div>
              <ImageUpload label="Achievement Media" onImageUpload={(url) => setEditFormData(prev => ({ ...prev, image_url: url }))} currentImage={editFormData.image_url} section="achievement" mediaType="both" maxSize={50} />
              <div className="space-y-1.5">
                <Label className="text-[#8B735B] font-bold">Description</Label>
                <Textarea placeholder="Details..." className="rounded-xl resize-none border-[#EAD8C0]/40 bg-white" rows={3} value={editFormData.description} onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[#8B735B] font-bold">LinkedIn Link</Label>
                <Input placeholder="https://..." className="rounded-xl border-[#EAD8C0]/40 bg-white" value={editFormData.linkedin_url} onChange={(e) => setEditFormData({ ...editFormData, linkedin_url: e.target.value })} />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" className="rounded-xl border-[#EAD8C0]" onClick={() => setEditOpen(false)}>Cancel</Button>
              <Button className="rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-bold" onClick={handleUpdateAchievement} disabled={editSubmitting}>
                {editSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Changes"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
