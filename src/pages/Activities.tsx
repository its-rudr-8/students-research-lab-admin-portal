import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Plus, Edit, Trash2, Calendar as CalendarIcon, Loader2, Link as LinkIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { hasWriteAccess } from "@/lib/auth";
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

// ─── Types ────────────────────────────────────────────────────────────────────

interface Activity {
  id: string | number;
  title: string;
  description?: string;
  link?: string;
  brief?: string;
  date?: string;
  Photo?: string;
}

type ActivityForm = {
  title: string;
  description: string;
  link: string;
  brief: string;
  date: string;
  Photo: string;
};

const EMPTY_FORM = (): ActivityForm => ({
  title: "",
  description: "",
  link: "",
  brief: "",
  date: new Date().toISOString().split("T")[0],
  Photo: "",
});

// ─── Shared date picker ───────────────────────────────────────────────────────

function DatePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-full rounded-xl border-[#EAD8C0]/40 bg-white px-3 py-2 text-sm font-normal justify-between text-left h-10",
            !value && "text-muted-foreground"
          )}
        >
          {value ? format(new Date(value), "do MMMM yyyy") : <span>Pick a date</span>}
          <CalendarIcon className="ml-2 h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 border-none shadow-none bg-transparent" align="start" side="bottom">
        <Calendar
          mode="single"
          selected={value ? new Date(value) : undefined}
          onSelect={(date) => onChange(date ? format(date, "yyyy-MM-dd") : "")}
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
  );
}

const isValidUrl = (url: string) =>
  !url || /^(https?:\/\/)?(([\w-]+\.)+[\w-]{2,})(\/[\w\-./?%&=#]*)?$/i.test(url);

// ─── Shared form body ─────────────────────────────────────────────────────────

function ActivityFormBody({
  data,
  set,
  onImageUpload,
  errors = {},
}: {
  data: ActivityForm;
  set: React.Dispatch<React.SetStateAction<ActivityForm>>;
  onImageUpload: (url: string) => void;
  errors?: Record<string, string>;
}) {
  const lbl = "text-[#8B735B] font-bold text-sm";
  const inp = "rounded-xl border-[#EAD8C0]/40 bg-white focus:border-[#EAD8C0] focus:ring-1 focus:ring-[#EAD8C0]";
  const inpErr = "rounded-xl border-red-400 bg-white focus:border-red-400 focus:ring-1 focus:ring-red-200";

  return (
    <div className="space-y-5 pt-2">
      {/* ── Core identity ── */}
      <div className="space-y-3 p-4 bg-white rounded-2xl border border-[#EAD8C0]/40">
        <p className="text-[10px] font-black text-[#8B735B]/50 uppercase tracking-[0.18em]">Basic Info</p>

        <div className="space-y-1.5">
          <Label className={lbl}>Title *</Label>
          <Input
            placeholder="Activity / event title"
            className={errors.title ? inpErr : inp}
            value={data.title}
            onChange={(e) => set((prev) => ({ ...prev, title: e.target.value }))}
          />
          {errors.title && <p className="text-xs text-red-500 mt-0.5">{errors.title}</p>}
        </div>

        <div className="space-y-1.5">
          <Label className={lbl}>Brief</Label>
          <Input
            placeholder="One-line summary shown in the list"
            className={inp}
            value={data.brief}
            onChange={(e) => set((prev) => ({ ...prev, brief: e.target.value }))}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className={lbl}>Date</Label>
            <DatePicker value={data.date} onChange={(v) => set((prev) => ({ ...prev, date: v }))} />
          </div>
          <div className="space-y-1.5">
            <Label className={lbl}>Link</Label>
            <Input
              type="url"
              placeholder="https://..."
              className={errors.link ? inpErr : inp}
              value={data.link}
              onChange={(e) => set((prev) => ({ ...prev, link: e.target.value }))}
            />
            {errors.link && <p className="text-xs text-red-500 mt-0.5">{errors.link}</p>}
          </div>
        </div>
      </div>

      {/* ── Media ── */}
      <div className="space-y-2 p-4 bg-white rounded-2xl border border-[#EAD8C0]/40">
        <p className="text-[10px] font-black text-[#8B735B]/50 uppercase tracking-[0.18em]">Media</p>
        <ImageUpload
          label="Activity Photo"
          onImageUpload={onImageUpload}
          currentImage={data.Photo}
          section="activity"
          mediaType="image"
          maxSize={10}
        />
      </div>

      {/* ── Description ── */}
      <div className="space-y-1.5">
        <Label className={lbl}>Description</Label>
        <Textarea
          placeholder="Full description of the activity / event..."
          className={`${inp} resize-none`}
          rows={4}
          value={data.description}
          onChange={(e) => set((prev) => ({ ...prev, description: e.target.value }))}
        />
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function Activities() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState<ActivityForm>(EMPTY_FORM());
  const [editFormData, setEditFormData] = useState<ActivityForm>(EMPTY_FORM());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});

  const { toast } = useToast();
  const canEdit = hasWriteAccess();

  useEffect(() => { fetchActivities(); }, []);

  const fetchActivities = async () => {
    try {
      setLoading(true);
      const response = await adminAPI.getActivities();
      const list = parseList(response);
      setActivities(
        list.sort((a: any, b: any) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime())
      );
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error fetching activities", description: error.message });
      setActivities([]);
    } finally {
      setLoading(false);
    }
  };

  // ── Add ──

  const handleAddActivity = async () => {
    if (!canEdit) return;
    const errs: Record<string, string> = {};
    if (!formData.title.trim()) errs.title = "Title is required.";
    if (!formData.date) errs.date = "Date is required.";
    if (!isValidUrl(formData.link)) errs.link = "Enter a valid URL (e.g. https://example.com).";
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    try {
      setSubmitting(true);
      const payload = {
        title: formData.title.trim(),
        description: formData.description.trim() || null,
        link: formData.link.trim() || null,
        brief: formData.brief.trim() || null,
        date: formData.date,
        Photo: formData.Photo || null,
      };
      console.log("[Activities] CREATE payload:", payload);
      const response = await adminAPI.createActivity(payload);
      if (response) {
        toast({ title: "Activity added successfully" });
        setOpen(false);
        setFormData(EMPTY_FORM());
        fetchActivities();
      }
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error adding activity", description: error.message });
    } finally {
      setSubmitting(false);
    }
  };

  // ── Edit ──

  const handleStartEdit = (activity: Activity) => {
    if (!canEdit) return;
    setEditingActivity(activity);
    setEditFormData({
      title: activity.title || "",
      description: activity.description || "",
      link: activity.link || "",
      brief: activity.brief || "",
      date: activity.date ? activity.date.split("T")[0] : new Date().toISOString().split("T")[0],
      Photo: activity.Photo || "",
    });
    setEditOpen(true);
  };

  const handleUpdateActivity = async () => {
    if (!canEdit || !editingActivity) return;
    const errs: Record<string, string> = {};
    if (!editFormData.title.trim()) errs.title = "Title is required.";
    if (!editFormData.date) errs.date = "Date is required.";
    if (!isValidUrl(editFormData.link)) errs.link = "Enter a valid URL (e.g. https://example.com).";
    if (Object.keys(errs).length) { setEditErrors(errs); return; }
    setEditErrors({});
    try {
      setSubmitting(true);
      const payload = {
        title: editFormData.title.trim(),
        description: editFormData.description.trim() || null,
        link: editFormData.link.trim() || null,
        brief: editFormData.brief.trim() || null,
        date: editFormData.date,
        Photo: editFormData.Photo || null,
      };
      console.log("[Activities] UPDATE payload:", payload);
      const response = await adminAPI.updateActivity(String(editingActivity.id), payload);
      if (response) {
        toast({ title: "Activity updated successfully" });
        setEditOpen(false);
        setEditingActivity(null);
        fetchActivities();
      }
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error updating activity", description: error.message });
    } finally {
      setSubmitting(false);
    }
  };

  // ── Delete ──

  const handleDeleteActivity = async (id: string | number) => {
    if (!canEdit) return;
    try {
      await adminAPI.deleteActivity(String(id));
      toast({ title: "Activity deleted" });
      fetchActivities();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error deleting activity", description: error.message });
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "—";
    try {
      return new Date(dateString).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
    } catch { return dateString; }
  };

  // ── Dialog content class ──
  const dialogCls = `rounded-[32px] max-w-[92vw] sm:max-w-lg max-h-[90vh] overflow-y-auto bg-[#FAF7F2]
    border-[#EAD8C0]/50 shadow-2xl p-4 sm:p-6
    [&::-webkit-scrollbar]:w-1.5
    [&::-webkit-scrollbar-track]:bg-transparent
    [&::-webkit-scrollbar-thumb]:bg-[#EAD8C0]/60
    [&::-webkit-scrollbar-thumb]:rounded-full
    hover:[&::-webkit-scrollbar-thumb]:bg-[#d4bc9a]`;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-[#8B735B]" />
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-5 max-w-7xl">

      {/* ── Add button + dialog ── */}
      {canEdit && (
        <div className="flex justify-start sm:justify-end">
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setFormData(EMPTY_FORM()); setErrors({}); } }}>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-teal-700 hover:bg-teal-800 text-white rounded-xl gap-1.5 font-bold shadow-md">
                <Plus className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Add Activity</span>
                <span className="sm:hidden">Add</span>
              </Button>
            </DialogTrigger>
            <DialogContent className={dialogCls}>
              <DialogHeader>
                <DialogTitle className="text-[#8B735B] font-bold">Add Activity / Event</DialogTitle>
              </DialogHeader>
              <ActivityFormBody
                data={formData}
                set={setFormData}
                onImageUpload={(url) => {
                  console.log("[Activities] Add form — image uploaded, url:", url);
                  setFormData((prev) => ({ ...prev, Photo: url }));
                }}
                errors={errors}
              />
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" className="rounded-xl border-[#EAD8C0] text-[#8B735B] hover:bg-[#EAD8C0]/20" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button className="rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-bold" onClick={handleAddActivity} disabled={submitting}>
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      )}

      {/* ── Edit dialog ── */}
      {canEdit && (
        <Dialog open={editOpen} onOpenChange={(o) => { setEditOpen(o); if (!o) { setEditingActivity(null); setEditErrors({}); } }}>
          <DialogContent className={dialogCls}>
            <DialogHeader>
              <DialogTitle className="text-[#8B735B] font-bold">Edit Activity / Event</DialogTitle>
            </DialogHeader>
            <ActivityFormBody
              data={editFormData}
              set={setEditFormData}
              onImageUpload={(url) => {
                console.log("[Activities] Edit form — image uploaded, url:", url);
                setEditFormData((prev) => ({ ...prev, Photo: url }));
              }}
              errors={editErrors}
            />
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" className="rounded-xl border-[#EAD8C0] text-[#8B735B] hover:bg-[#EAD8C0]/20" onClick={() => setEditOpen(false)}>
                Cancel
              </Button>
              <Button className="rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-bold" onClick={handleUpdateActivity} disabled={submitting}>
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Changes"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* ── List + side image ── */}
      <div className="flex flex-col lg:flex-row gap-8 items-start">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="flex-1 w-full bg-[#FAF7F2]/60 backdrop-blur-sm rounded-[32px] border-2 border-[#EAD8C0]/50 shadow-xl overflow-hidden"
        >
          {!canEdit && (
            <p className="text-[10px] text-muted-foreground p-4 text-center">
              Read-only access — only admin can manage activities.
            </p>
          )}

          {activities.length === 0 ? (
            <div className="text-center py-20 text-muted-foreground font-medium">
              <CalendarIcon className="w-12 h-12 mx-auto text-[#EAD8C0] mb-4 opacity-50" />
              No activities found.
            </div>
          ) : (
            <div className="p-3 sm:p-5 space-y-3 max-h-[600px] overflow-y-auto
              [&::-webkit-scrollbar]:w-2
              [&::-webkit-scrollbar-track]:bg-transparent
              [&::-webkit-scrollbar-thumb]:bg-[#EAD8C0]
              [&::-webkit-scrollbar-thumb]:rounded-full
              hover:[&::-webkit-scrollbar-thumb]:bg-[#d4bc9a]">
              {activities.map((activity) => (
                <motion.div
                  key={activity.id}
                  whileHover={{ scale: 1.005 }}
                  className="flex items-start gap-4 p-4 rounded-2xl bg-white border border-[#EAD8C0]/30 shadow-sm hover:shadow-md hover:border-[#EAD8C0] transition-all group"
                >
                  {/* Thumbnail */}
                  {activity.Photo ? (
                    <div className="w-14 h-14 rounded-xl overflow-hidden border border-[#EAD8C0]/40 shadow-sm shrink-0 mt-0.5">
                      <img
                        src={activity.Photo}
                        alt=""
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                      />
                    </div>
                  ) : (
                    <div className="w-14 h-14 rounded-xl bg-[#FAF7F2] flex items-center justify-center text-[#8B735B] border border-[#EAD8C0]/40 group-hover:bg-[#EAD8C0]/20 transition-colors shrink-0 mt-0.5">
                      <CalendarIcon className="w-6 h-6" />
                    </div>
                  )}

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-[#8B735B] truncate text-base sm:text-[17px] leading-snug">
                      {activity.title}
                    </p>
                    {activity.brief && (
                      <p className="text-xs text-[#8B735B]/70 mt-0.5 truncate">{activity.brief}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-wider">
                      <span>{formatDate(activity.date)}</span>
                      {activity.link && (
                        <>
                          <span className="w-1 h-1 rounded-full bg-[#EAD8C0]" />
                          <a
                            href={activity.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-teal-700 hover:underline normal-case tracking-normal"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <LinkIcon className="w-3 h-3" /> Link
                          </a>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  {canEdit && (
                    <div className="flex gap-1.5 ml-2 shrink-0 self-center">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleStartEdit(activity)}
                        className="h-8 w-8 rounded-xl hover:bg-[#EAD8C0]/20 text-[#8B735B]"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteActivity(activity.id)}
                        className="h-8 w-8 rounded-xl text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Side illustration */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="hidden lg:flex flex-col items-center justify-start pt-24 sticky top-20"
        >
          <img
            src="/Activity.jpg"
            alt="Activities"
            className="max-w-[300px] rounded-3xl shadow-[0_0_50px_rgba(234,216,192,1),0_0_20px_rgba(255,255,255,0.4)] border-4 border-[#EAD8C0] transform hover:scale-[1.02] transition-transform duration-500"
          />
        </motion.div>
      </div>
    </div>
  );
}
