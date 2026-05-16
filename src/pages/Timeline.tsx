import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Calendar as CalendarIcon, Loader2, Pencil, Plus, Trash2, Award, Trophy, BookOpen, GraduationCap, Rocket } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { hasWriteAccess } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { adminAPI, parseList } from "@/lib/adminApi";
import ImageUpload from "@/components/ImageUpload";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface TimelineEntry {
  id: string | number;
  serial_no: number;
  title: string;
  description?: string;
  session_date?: string;
  category?: string;
  type?: string;
  linkedin_url?: string;
  image_url?: string;
  media_urls?: string[];
  created_at?: string;
}

const todayStr = new Date().toISOString().split("T")[0];
const isValidUrl = (url: string) =>
  !url || /^(https?:\/\/)?(([\w-]+\.)+[\w-]{2,})(\/[\w\-./?%&=#]*)?$/i.test(url);
const toTimelineStep = (date: string) => format(new Date(date), "MMM yyyy");

export default function Timeline() {
  const [entries, setEntries] = useState<TimelineEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<TimelineEntry | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    description: "",

    session_date: "",
    category: "",
    type: "video",
    linkedin_url: "",
    image_url: "",
  });
  const [editFormData, setEditFormData] = useState({
    title: "",
    description: "",

    session_date: "",
    category: "",
    type: "video",
    linkedin_url: "",
    image_url: "",
  });
  const { toast } = useToast();
  const canEdit = hasWriteAccess();

  useEffect(() => {
    fetchTimelineEntries();
  }, []);

  const fetchTimelineEntries = async () => {
    try {
      setLoading(true);
      const response = await adminAPI.getTimeline();

      const list = parseList(response);
      const normalized = (list || []).map((item: any, idx: number) => {
        if (item && (item.step !== undefined || item.display_order !== undefined)) {
          let session_date: string | undefined = undefined;
          if (item.step) {
            const monthYearMatch = String(item.step).match(/([A-Za-z]+)\s*(\d{4})/);
            if (monthYearMatch) {
              const parsed = new Date(`${monthYearMatch[1]} 1, ${monthYearMatch[2]}`);
              if (!isNaN(parsed.getTime())) session_date = parsed.toISOString();
            }
          }

          return {
            id: item.id ? String(item.id) : String(idx + 1),
            serial_no: item.display_order || idx + 1,
            title: item.title || `Step ${idx + 1}`,
            description: item.description || "",
            session_date: session_date || "",
            category: item.is_active === false ? "inactive" : "timeline",
            type: "timeline",
            linkedin_url: "",
            image_url: item.icon_svg || "",
            media_urls: [],
            created_at: item.created_at || "",
          } as TimelineEntry;
        }

        return item as TimelineEntry;
      });

      const sorted = normalized.sort((a: any, b: any) => (a.serial_no || 0) - (b.serial_no || 0));
      setEntries(sorted as TimelineEntry[]);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error fetching timeline",
        description: error.message,
      });
      setEntries([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAddEntry = async () => {
    if (!canEdit) {
      toast({
        variant: "destructive",
        title: "Read-only access",
        description: "Only admin can add timeline entries.",
      });
      return;
    }

    const errs: string[] = [];
    if (!formData.title.trim()) errs.push("Title is required.");
    if (!formData.session_date) errs.push("Date is required.");
    if (!isValidUrl(formData.linkedin_url)) errs.push("LinkedIn URL is not a valid URL.");
    if (formData.session_date && formData.session_date > todayStr) errs.push("Date cannot be in the future.");
    if (errs.length) {
      toast({ variant: "destructive", title: "Validation error", description: errs.join(" ") });
      return;
    }

    try {
      setSubmitting(true);
      const response = await adminAPI.createTimelineEntry({
        step: toTimelineStep(formData.session_date),
        title: formData.title.trim(),
        description: formData.description.trim() || null,
        icon_svg: formData.image_url.trim() || null,
        is_active: formData.category.trim().toLowerCase() !== "inactive",
      });

      if (response) {
        toast({
          title: "Timeline entry added",
        });

        setOpen(false);
        setFormData({
          title: "",
          description: "",

          session_date: "",
          category: "",
          type: "video",
          linkedin_url: "",
          image_url: "",
        });
        fetchTimelineEntries();
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error adding timeline entry",
        description: error.message,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteEntry = async (id: number) => {
    if (!canEdit) {
      toast({
        variant: "destructive",
        title: "Read-only access",
        description: "Only admin can delete timeline entries.",
      });
      return;
    }

    try {
      await adminAPI.deleteTimelineEntry(String(id));
      toast({
        title: "Timeline entry deleted",
      });
      fetchTimelineEntries();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error deleting timeline entry",
        description: error.message,
      });
    }
  };

  const handleStartEdit = (entry: TimelineEntry) => {
    if (!canEdit) {
      toast({
        variant: "destructive",
        title: "Read-only access",
        description: "Only admin can edit timeline entries.",
      });
      return;
    }

    // Format session_date to YYYY-MM-DD string for date input
    let formattedDate = "";
    if (entry.session_date) {
      try {
        const dateObj = new Date(entry.session_date);
        if (!isNaN(dateObj.getTime())) {
          formattedDate = dateObj.toISOString().split('T')[0];
        }
      } catch (e) {
        formattedDate = "";
      }
    }

    setEditingEntry(entry);
    setEditFormData({
      title: entry.title || "",
      description: entry.description || "",
      session_date: formattedDate,
      category: entry.category || "",
      type: entry.type || "video",
      linkedin_url: entry.linkedin_url || "",
      image_url: entry.image_url || "",
    });
    setEditOpen(true);
  };

  const handleUpdateEntry = async () => {
    if (!canEdit) {
      toast({
        variant: "destructive",
        title: "Read-only access",
        description: "Only admin can edit timeline entries.",
      });
      return;
    }

    if (!editingEntry) return;

    const editErrs: string[] = [];
    if (!editFormData.title.trim()) editErrs.push("Title is required.");
    if (!editFormData.session_date) editErrs.push("Date is required.");
    if (!isValidUrl(editFormData.linkedin_url)) editErrs.push("LinkedIn URL is not a valid URL.");
    if (editFormData.session_date && editFormData.session_date > todayStr) editErrs.push("Date cannot be in the future.");
    if (editErrs.length) {
      toast({ variant: "destructive", title: "Validation error", description: editErrs.join(" ") });
      return;
    }

    try {
      setEditSubmitting(true);
      const response = await adminAPI.updateTimelineEntry(String(editingEntry.id), {
        step: toTimelineStep(editFormData.session_date),
        title: editFormData.title.trim(),
        description: editFormData.description.trim() || null,
        icon_svg: editFormData.image_url.trim() || null,
        is_active: editFormData.category.trim().toLowerCase() !== "inactive",
      });

      if (response) {
        toast({
          title: "Timeline entry updated",
        });

        setEditOpen(false);
        setEditingEntry(null);
        fetchTimelineEntries();
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error updating timeline entry",
        description: error.message,
      });
    } finally {
      setEditSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-5 max-w-4xl mx-auto">
      {canEdit && (
        <div className="flex justify-start sm:justify-end">
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="rounded-xl gap-1.5 text-sm sm:text-base">
                <Plus className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Add Timeline Entry</span><span className="sm:hidden">Add</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="rounded-3xl sm:max-w-md max-h-[90vh] overflow-y-auto bg-[#FAF7F2] border-[#EAD8C0]/50 shadow-2xl
              [&::-webkit-scrollbar]:w-2
              [&::-webkit-scrollbar-track]:bg-transparent
              [&::-webkit-scrollbar-thumb]:bg-[#EAD8C0]
              [&::-webkit-scrollbar-thumb]:rounded-full
              hover:[&::-webkit-scrollbar-thumb]:bg-[#d4bc9a]">
              <DialogHeader>
                <DialogTitle>Add Timeline Entry</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-1.5">
                  <Label className="text-[#8B735B] font-semibold">Title *</Label>
                  <Input
                    placeholder="e.g., SRL Foundation Ceremony"
                    className="rounded-xl border-[#EAD8C0]/40 bg-white/50 focus:border-[#EAD8C0] focus:ring-1 focus:ring-[#EAD8C0]"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[#8B735B] font-semibold">Description</Label>
                  <Textarea
                    placeholder="Event description..."
                    className="rounded-xl resize-none border-[#EAD8C0]/40 bg-white/50 focus:border-[#EAD8C0] focus:ring-1 focus:ring-[#EAD8C0]"
                    rows={3}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[#8B735B] font-semibold">Session Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant={"outline"}
                        className={cn(
                          "w-full rounded-xl border-[#EAD8C0]/40 bg-white/50 px-3 py-2 text-sm font-normal justify-between text-left h-10",
                          !formData.session_date && "text-muted-foreground"
                        )}
                      >
                        {formData.session_date ? format(new Date(formData.session_date), "do MMMM yyyy") : <span>Pick a date</span>}
                        <CalendarIcon className="ml-2 h-4 w-4 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 border-none shadow-none bg-transparent" align="start" side="bottom">
                      <Calendar
                        mode="single"
                        selected={formData.session_date ? new Date(formData.session_date) : undefined}
                        onSelect={(date) => setFormData({ ...formData, session_date: date ? format(date, "yyyy-MM-dd") : "" })}
                        disabled={{ after: new Date() }}
                        initialFocus
                        className="bg-[#FAF7F2] border-2 border-[#EAD8C0]/50 rounded-2xl scale-90 origin-top-left"
                        classNames={{
                          day_selected: "!bg-[#EAD8C0] !text-[#8B735B] hover:!bg-[#d4bc9a] focus:!bg-[#EAD8C0]",
                          day_today: "bg-white text-[#8B735B] font-bold border border-[#EAD8C0]",
                          day: "hover:!bg-[#EAD8C0]/20 rounded-md transition-colors",
                          head_cell: "text-[#8B735B] font-bold w-7",
                          cell: "h-7 w-7 text-center text-[11px] p-0 relative [&:has([aria-selected])]:!bg-transparent focus-within:relative focus-within:z-20",
                        }}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[#8B735B] font-semibold">Category</Label>
                  <Input
                    placeholder="e.g., Workshop, Seminar"
                    className="rounded-xl border-[#EAD8C0]/40 bg-white/50 focus:border-[#EAD8C0] focus:ring-1 focus:ring-[#EAD8C0]"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[#8B735B] font-semibold">Type</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(value) => setFormData({ ...formData, type: value })}
                  >
                    <SelectTrigger className="w-full rounded-xl border-[#EAD8C0]/40 bg-white/50 focus:border-[#EAD8C0] focus:ring-1 focus:ring-[#EAD8C0] h-10 transition-colors">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#FAF7F2] border-2 border-[#EAD8C0]/50 shadow-xl rounded-xl">
                      <SelectItem value="video" className="focus:bg-[#EAD8C0]/40 focus:text-[#8B735B] cursor-pointer">Video</SelectItem>
                      <SelectItem value="image" className="focus:bg-[#EAD8C0]/40 focus:text-[#8B735B] cursor-pointer">Image</SelectItem>
                      <SelectItem value="document" className="focus:bg-[#EAD8C0]/40 focus:text-[#8B735B] cursor-pointer">Document</SelectItem>
                      <SelectItem value="other" className="focus:bg-[#EAD8C0]/40 focus:text-[#8B735B] cursor-pointer">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <ImageUpload
                  label="Timeline Media"
                  onImageUpload={(url) => setFormData({ ...formData, image_url: url })}
                  currentImage={formData.image_url}
                  section="timeline"
                  mediaType="both"
                  maxSize={50}
                />
                <div className="space-y-1.5">
                  <Label className="text-[#8B735B] font-semibold">LinkedIn URL</Label>
                  <Input
                    placeholder="https://linkedin.com/..."
                    className="rounded-xl border-[#EAD8C0]/40 bg-white/50 focus:border-[#EAD8C0] focus:ring-1 focus:ring-[#EAD8C0]"
                    value={formData.linkedin_url}
                    onChange={(e) => setFormData({ ...formData, linkedin_url: e.target.value })}
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" className="rounded-xl" onClick={() => setOpen(false)} disabled={submitting}>
                    Cancel
                  </Button>
                  <Button className="rounded-xl" onClick={handleAddEntry} disabled={submitting}>
                    {submitting ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      "Create"
                    )}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      )}

      {canEdit && (
        <Dialog
          open={editOpen}
          onOpenChange={(isOpen) => {
            setEditOpen(isOpen);
            if (!isOpen) {
              setEditingEntry(null);
            }
          }}
        >
          <DialogContent className="rounded-3xl sm:max-w-md max-h-[90vh] overflow-y-auto bg-[#FAF7F2] border-[#EAD8C0]/50 shadow-2xl
            [&::-webkit-scrollbar]:w-2
            [&::-webkit-scrollbar-track]:bg-transparent
            [&::-webkit-scrollbar-thumb]:bg-[#EAD8C0]
            [&::-webkit-scrollbar-thumb]:rounded-full
            hover:[&::-webkit-scrollbar-thumb]:bg-[#d4bc9a]">
            <DialogHeader>
              <DialogTitle>Edit Timeline Entry</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <Label className="text-[#8B735B] font-semibold">Title *</Label>
                <Input
                  placeholder="e.g., SRL Foundation Ceremony"
                  className="rounded-xl border-[#EAD8C0]/40 bg-white/50 focus:border-[#EAD8C0] focus:ring-1 focus:ring-[#EAD8C0]"
                  value={editFormData.title}
                  onChange={(e) => setEditFormData({ ...editFormData, title: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[#8B735B] font-semibold">Description</Label>
                <Textarea
                  placeholder="Event description..."
                  className="rounded-xl resize-none border-[#EAD8C0]/40 bg-white/50 focus:border-[#EAD8C0] focus:ring-1 focus:ring-[#EAD8C0]"
                  rows={3}
                  value={editFormData.description}
                  onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[#8B735B] font-semibold">Session Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant={"outline"}
                      className={cn(
                        "w-full rounded-xl border-[#EAD8C0]/40 bg-white/50 px-3 py-2 text-sm font-normal justify-between text-left h-10",
                        !editFormData.session_date && "text-muted-foreground"
                      )}
                    >
                      {editFormData.session_date ? format(new Date(editFormData.session_date), "do MMMM yyyy") : <span>Pick a date</span>}
                      <CalendarIcon className="ml-2 h-4 w-4 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 border-none shadow-none bg-transparent" align="start" side="bottom">
                    <Calendar
                      mode="single"
                      selected={editFormData.session_date ? new Date(editFormData.session_date) : undefined}
                      onSelect={(date) => setEditFormData({ ...editFormData, session_date: date ? format(date, "yyyy-MM-dd") : "" })}
                      disabled={{ after: new Date() }}
                      initialFocus
                      className="bg-[#FAF7F2] border-2 border-[#EAD8C0]/50 rounded-2xl scale-90 origin-top-left"
                      classNames={{
                        day_selected: "!bg-[#EAD8C0] !text-[#8B735B] hover:!bg-[#d4bc9a] focus:!bg-[#EAD8C0]",
                        day_today: "bg-white text-[#8B735B] font-bold border border-[#EAD8C0]",
                        day: "hover:!bg-[#EAD8C0]/20 rounded-md transition-colors",
                        head_cell: "text-[#8B735B] font-bold w-7",
                        cell: "h-7 w-7 text-center text-[11px] p-0 relative [&:has([aria-selected])]:!bg-transparent focus-within:relative focus-within:z-20",
                      }}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[#8B735B] font-semibold">Category</Label>
                <Input
                  placeholder="e.g., Workshop, Seminar"
                  className="rounded-xl border-[#EAD8C0]/40 bg-white/50 focus:border-[#EAD8C0] focus:ring-1 focus:ring-[#EAD8C0]"
                  value={editFormData.category}
                  onChange={(e) => setEditFormData({ ...editFormData, category: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[#8B735B] font-semibold">Type</Label>
                <Select
                  value={editFormData.type}
                  onValueChange={(value) => setEditFormData({ ...editFormData, type: value })}
                >
                  <SelectTrigger className="w-full rounded-xl border-[#EAD8C0]/40 bg-white/50 focus:border-[#EAD8C0] focus:ring-1 focus:ring-[#EAD8C0] h-10 transition-colors">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#FAF7F2] border-2 border-[#EAD8C0]/50 shadow-xl rounded-xl">
                    <SelectItem value="video" className="focus:bg-[#EAD8C0]/40 focus:text-[#8B735B] cursor-pointer">Video</SelectItem>
                    <SelectItem value="image" className="focus:bg-[#EAD8C0]/40 focus:text-[#8B735B] cursor-pointer">Image</SelectItem>
                    <SelectItem value="document" className="focus:bg-[#EAD8C0]/40 focus:text-[#8B735B] cursor-pointer">Document</SelectItem>
                    <SelectItem value="other" className="focus:bg-[#EAD8C0]/40 focus:text-[#8B735B] cursor-pointer">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <ImageUpload
                label="Timeline Media"
                onImageUpload={(url) => setEditFormData({ ...editFormData, image_url: url })}
                currentImage={editFormData.image_url}
                section="timeline"
                mediaType="both"
                maxSize={50}
              />
              <div className="space-y-1.5">
                <Label className="text-[#8B735B] font-semibold">LinkedIn URL</Label>
                <Input
                  placeholder="https://linkedin.com/..."
                  className="rounded-xl border-[#EAD8C0]/40 bg-white/50 focus:border-[#EAD8C0] focus:ring-1 focus:ring-[#EAD8C0]"
                  value={editFormData.linkedin_url}
                  onChange={(e) => setEditFormData({ ...editFormData, linkedin_url: e.target.value })}
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" className="rounded-xl" onClick={() => setEditOpen(false)} disabled={editSubmitting}>
                  Cancel
                </Button>
                <Button className="rounded-xl" onClick={handleUpdateEntry} disabled={editSubmitting}>
                  {editSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Changes"
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {!canEdit && <p className="text-xs text-muted-foreground mb-12 text-center">You have read-only access. Only admin can manage timeline entries.</p>}

      {entries.length === 0 ? (
        <div className="text-center py-20 glass-card rounded-3xl border-dashed">
          <CalendarIcon className="w-12 h-12 mx-auto text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground font-medium">No timeline entries found.</p>
        </div>
      ) : (
        <div className="relative max-w-[1500px] mx-auto px-4 pb-20">
          <div className="bg-[#FAF7F2]/80 backdrop-blur-xl rounded-[40px] sm:rounded-[60px] border-2 border-[#EAD8C0]/50 shadow-2xl overflow-hidden relative group transition-all duration-500 hover:shadow-[#EAD8C0]/20">
            <div className="max-h-[820px] overflow-y-auto overflow-x-hidden p-6 sm:p-16 relative scroll-smooth 
              [&::-webkit-scrollbar]:w-2
              [&::-webkit-scrollbar-track]:bg-transparent
              [&::-webkit-scrollbar-thumb]:bg-[#EAD8C0]
              [&::-webkit-scrollbar-thumb]:rounded-full
              hover:[&::-webkit-scrollbar-thumb]:bg-[#d4bc9a]
              transition-all">
              <div className="space-y-0 relative min-h-full">
                {/* Vertical Line for Mobile */}
                <div className="sm:hidden absolute left-1/2 -translate-x-1/2 top-[50px] bottom-[50px] w-1 bg-[#EAD8C0] opacity-40 rounded-full" />
                
                {entries.map((entry, i) => {
                  const isEven = i % 2 === 0;
                  const colors = [
                    { primary: "bg-[#f97316]", light: "bg-orange-50", border: "border-orange-500", text: "text-[#f97316]", shadow: "shadow-orange-100" },
                    { primary: "bg-[#0d9488]", light: "bg-teal-50", border: "border-teal-500", text: "text-[#0d9488]", shadow: "shadow-teal-100" },
                    { primary: "bg-[#3b82f6]", light: "bg-blue-50", border: "border-blue-500", text: "text-[#3b82f6]", shadow: "shadow-blue-100" },
                    { primary: "bg-[#eab308]", light: "bg-yellow-50", border: "border-yellow-200", text: "text-[#eab308]", shadow: "shadow-yellow-100" },
                  ];
                  const color = colors[i % colors.length];
                  const beigePath = "bg-[#EAD8C0]"; 

                  const getIcon = (category: string = "", title: string = "") => {
                    const cat = (category || "").toLowerCase();
                    const t = (title || "").toLowerCase();
                    if (cat.includes('success') || t.includes('success')) return <Trophy className="w-8 h-8 sm:w-10 sm:h-10 text-white" />;
                    if (cat.includes('learning') || t.includes('debate') || cat.includes('study')) return <BookOpen className="w-8 h-8 sm:w-10 sm:h-10 text-white" />;
                    if (cat.includes('alumni') || t.includes('alumni')) return <GraduationCap className="w-8 h-8 sm:w-10 sm:h-10 text-white" />;
                    if (cat.includes('event') || t.includes('presents')) return <Award className="w-8 h-8 sm:w-10 sm:h-10 text-white" />;
                    return <Rocket className="w-8 h-8 sm:w-10 sm:h-10 text-white" />;
                  };

                  return (
                    <div key={entry.id} className="relative">
                      {i < entries.length - 1 && (
                        <div className="hidden sm:block absolute top-[80px] left-0 w-full h-[224px] pointer-events-none z-0">
                          {isEven ? (
                            <>
                              <div className={`absolute h-2 ${beigePath} rounded-full opacity-60`} style={{ left: '91.66%', right: '0%' }} />
                              <div className={`absolute w-2 h-full ${beigePath} rounded-full opacity-60`} style={{ right: '0%' }} />
                              <div className={`absolute h-2 ${beigePath} rounded-full opacity-60`} style={{ bottom: '0%', left: '75%', right: '0%' }} />
                            </>
                          ) : (
                            <>
                              <div className={`absolute h-2 ${beigePath} rounded-full opacity-60`} style={{ left: '0%', right: '91.66%' }} />
                              <div className={`absolute w-2 h-full ${beigePath} rounded-full opacity-60`} style={{ left: '0%' }} />
                              <div className={`absolute h-2 ${beigePath} rounded-full opacity-60`} style={{ bottom: '0%', left: '0%', right: '75%' }} />
                            </>
                          )}
                        </div>
                      )}

                      <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.4, delay: i * 0.05 }}
                        className="flex flex-col sm:grid sm:grid-cols-12 items-center gap-4 sm:gap-0 mb-6 sm:mb-16"
                      >
                        {isEven ? (
                          <>
                            <div className="sm:col-span-2 flex justify-center z-10">
                              <motion.div 
                                whileHover={{ scale: 1.1 }}
                                className={`w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-white shadow-xl flex items-center justify-center border-4 ${color.border} relative`}
                              >
                                <div className={`w-14 h-14 sm:w-16 sm:h-16 rounded-full ${color.light} flex items-center justify-center text-xl font-black ${color.text}`}>
                                  {entry.serial_no}
                                </div>
                                <div className={`absolute -bottom-1 -right-1 w-7 h-7 rounded-full ${color.primary} text-white flex items-center justify-center shadow-md border-2 border-white`}>
                                  <Plus className="w-4 h-4" />
                                </div>
                              </motion.div>
                            </div>
                            <div className="hidden sm:block sm:col-span-1 h-1 bg-muted/20" />
                            <div className="sm:col-span-8">
                              <motion.div 
                                whileHover={{ scale: 1.01, y: -2 }}
                                className="flex bg-white rounded-2xl shadow-xl border border-[#EAD8C0]/30 overflow-hidden h-[180px] sm:h-[160px] group w-full"
                              >
                                <div className={`${color.primary} w-20 sm:w-32 shrink-0 flex flex-col items-center justify-center p-4 text-white text-center`}>
                                  <div className="opacity-90 transform group-hover:scale-110 transition-transform duration-300">
                                    {getIcon(entry.category, entry.title)}
                                  </div>
                                  <div className="mt-3 w-8 h-1 bg-white/30 rounded-full" />
                                </div>
                                <div className="p-4 sm:p-5 flex-1 relative flex flex-col justify-center bg-gradient-to-br from-white to-[#FAF7F2]/30">
                                  <div className="flex justify-between items-start mb-1">
                                    <h3 className="text-base sm:text-lg font-bold text-foreground leading-tight line-clamp-1">{entry.title}</h3>
                                    {canEdit && (
                                      <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg hover:bg-[#EAD8C0]/20" onClick={() => handleStartEdit(entry)}>
                                          <Pencil className="w-3.5 h-3.5" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg text-destructive hover:bg-destructive/10" onClick={() => handleDeleteEntry(entry.id)}>
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </Button>
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 mb-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wider text-[#8B735B]">
                                    <CalendarIcon className="w-3 h-3" />
                                    {entry.session_date ? new Date(entry.session_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Future'}
                                    {entry.category && <span className="ml-2 px-1 py-0.5 rounded bg-[#EAD8C0]/30 text-[#8B735B]">{entry.category}</span>}
                                  </div>
                                  <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed line-clamp-2">
                                    {entry.description || "The journey of Students Research Lab continues with this significant milestone."}
                                  </p>
                                  {entry.linkedin_url && (
                                    <a href={entry.linkedin_url} target="_blank" rel="noopener noreferrer" className={`mt-2 inline-flex items-center gap-1 text-[11px] font-bold ${color.text} hover:underline`}>
                                      View on LinkedIn <Plus className="w-3 h-3" />
                                    </a>
                                  )}
                                </div>
                              </motion.div>
                            </div>
                            <div className="sm:col-span-1" />
                          </>
                        ) : (
                          <>
                            <div className="sm:hidden flex justify-center z-10 w-full">
                              <motion.div 
                                whileHover={{ scale: 1.1 }}
                                className={`w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-white shadow-xl flex items-center justify-center border-4 ${color.border} relative`}
                              >
                                <div className={`w-14 h-14 sm:w-16 sm:h-16 rounded-full ${color.light} flex items-center justify-center text-xl font-black ${color.text}`}>
                                  {entry.serial_no}
                                </div>
                                <div className={`absolute -bottom-1 -right-1 w-7 h-7 rounded-full ${color.primary} text-white flex items-center justify-center shadow-md border-2 border-white`}>
                                  <Plus className="w-4 h-4" />
                                </div>
                              </motion.div>
                            </div>
                            <div className="sm:col-span-1" />
                            <div className="sm:col-span-8">
                              <motion.div 
                                whileHover={{ scale: 1.01, y: -2 }}
                                className="flex bg-white rounded-2xl shadow-xl border border-[#EAD8C0]/30 overflow-hidden h-[180px] sm:h-[160px] group w-full flex-row-reverse"
                              >
                                <div className={`${color.primary} w-20 sm:w-32 shrink-0 flex flex-col items-center justify-center p-4 text-white text-center`}>
                                  <div className="opacity-90 transform group-hover:scale-110 transition-transform duration-300">
                                    {getIcon(entry.category, entry.title)}
                                  </div>
                                  <div className="mt-3 w-8 h-1 bg-white/30 rounded-full" />
                                </div>
                                <div className="p-4 sm:p-5 flex-1 relative flex flex-col justify-center text-right bg-gradient-to-bl from-white to-[#FAF7F2]/30">
                                  <div className="flex flex-row-reverse justify-between items-start mb-1">
                                    <h3 className="text-base sm:text-lg font-bold text-foreground leading-tight line-clamp-1">{entry.title}</h3>
                                    {canEdit && (
                                      <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg hover:bg-[#EAD8C0]/20" onClick={() => handleStartEdit(entry)}>
                                          <Pencil className="w-3.5 h-3.5" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg text-destructive hover:bg-destructive/10" onClick={() => handleDeleteEntry(entry.id)}>
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </Button>
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex flex-row-reverse items-center gap-2 mb-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wider text-[#8B735B]">
                                    <CalendarIcon className="w-3 h-3" />
                                    {entry.session_date ? new Date(entry.session_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Future'}
                                    {entry.category && <span className="mr-2 px-1 py-0.5 rounded bg-[#EAD8C0]/30 text-[#8B735B]">{entry.category}</span>}
                                  </div>
                                  <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed line-clamp-2">
                                    {entry.description || "The journey of Students Research Lab continues with this significant milestone."}
                                  </p>
                                  {entry.linkedin_url && (
                                    <a href={entry.linkedin_url} target="_blank" rel="noopener noreferrer" className={`mt-2 inline-flex items-center flex-row-reverse gap-1 text-[11px] font-bold ${color.text} hover:underline`}>
                                      View on LinkedIn <Plus className="w-3 h-3" />
                                    </a>
                                  )}
                                </div>
                              </motion.div>
                            </div>
                            <div className="hidden sm:block sm:col-span-1 h-1 bg-muted/20" />
                            <div className="hidden sm:flex sm:col-span-2 justify-center z-10">
                              <motion.div 
                                whileHover={{ scale: 1.1 }}
                                className={`w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-white shadow-xl flex items-center justify-center border-4 ${color.border} relative`}
                              >
                                <div className={`w-14 h-14 sm:w-16 sm:h-16 rounded-full ${color.light} flex items-center justify-center text-xl font-black ${color.text}`}>
                                  {entry.serial_no}
                                </div>
                                <div className={`absolute -bottom-1 -right-1 w-7 h-7 rounded-full ${color.primary} text-white flex items-center justify-center shadow-md border-2 border-white`}>
                                  <Plus className="w-4 h-4" />
                                </div>
                              </motion.div>
                            </div>
                          </>
                        )}
                      </motion.div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-[#FAF7F2] to-transparent pointer-events-none rounded-b-[40px] sm:rounded-b-[60px]" />
          </div>
        </div>
      )}
    </div>
  );
}
