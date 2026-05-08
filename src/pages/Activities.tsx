import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Plus, Edit, Trash2, Calendar as CalendarIcon, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { hasWriteAccess } from "@/lib/auth";
import { adminAPI } from "@/lib/adminApi";
import ImageUpload from "@/components/ImageUpload";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface Activity {
  id: string | number;
  title: string;
  date?: string;
  enrollment_no?: string;
  description?: string;
  category?: string;
  hours?: number;
  status?: string;
  Photo?: string;
}

export default function Activities() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    category: "",
    description: "",
    date: new Date().toISOString().split('T')[0],
    enrollment_no: "",
    hours: "",
    Photo: "",
  });
  const [editFormData, setEditFormData] = useState({
    title: "",
    category: "",
    description: "",
    date: "",
    hours: "",
    Photo: "",
  });
  const { toast } = useToast();
  const canEdit = hasWriteAccess();

  useEffect(() => {
    fetchActivities();
  }, []);

  const fetchActivities = async () => {
    try {
      setLoading(true);
      const response = await adminAPI.getActivities();

      if (response.success && Array.isArray(response.data)) {
        setActivities(response.data.sort((a, b) => {
          const dateA = new Date(a.date || 0).getTime();
          const dateB = new Date(b.date || 0).getTime();
          return dateB - dateA;
        }));
      } else {
        setActivities([]);
      }
    } catch (error: any) {
      console.error('API error:', error);
      toast({
        variant: "destructive",
        title: "Error fetching activities",
        description: error.message,
      });
      setActivities([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAddActivity = async () => {
    if (!canEdit) {
      toast({
        variant: "destructive",
        title: "Read-only access",
        description: "Only admin can add activities.",
      });
      return;
    }

    try {
      if (!formData.title) {
        toast({
          variant: "destructive",
          title: "Validation error",
          description: "Title is required.",
        });
        return;
      }

      const response = await adminAPI.createActivity({
        title: formData.title.trim(),
        category: formData.category || null,
        description: formData.description.trim() || null,
        date: formData.date || new Date().toISOString(),
        enrollment_no: formData.enrollment_no || null,
        hours: formData.hours ? parseFloat(formData.hours) : 0,
        Photo: formData.Photo.trim() || null,
      });

      if (response.success) {
        toast({
          title: "Activity added successfully",
        });

        setOpen(false);
        setFormData({
          title: "",
          category: "",
          description: "",
          date: new Date().toISOString().split('T')[0],
          enrollment_no: "",
          hours: "",
          Photo: "",
        });
        fetchActivities();
      }
    } catch (error: any) {
      console.error('Error adding activity:', error);
      toast({
        variant: "destructive",
        title: "Error adding activity",
        description: error.message,
      });
    }
  };

  const handleStartEdit = (activity: Activity) => {
    if (!canEdit) {
      toast({
        variant: "destructive",
        title: "Read-only access",
        description: "Only admin can edit activities.",
      });
      return;
    }

    setEditingActivity(activity);
    const dateStr = activity.date ? activity.date.split('T')[0] : new Date().toISOString().split('T')[0];
    setEditFormData({
      title: activity.title,
      category: activity.category || "",
      description: activity.description || "",
      date: dateStr,
      hours: activity.hours?.toString() || "",
      Photo: activity.Photo || "",
    });
    setEditOpen(true);
  };

  const handleUpdateActivity = async () => {
    if (!canEdit || !editingActivity) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Cannot update activity.",
      });
      return;
    }

    try {
      if (!editFormData.title.trim()) {
        toast({
          variant: "destructive",
          title: "Validation error",
          description: "Title is required.",
        });
        return;
      }

      const response = await adminAPI.updateActivity(String(editingActivity.id), {
        title: editFormData.title.trim(),
        category: editFormData.category || null,
        description: editFormData.description.trim() || null,
        date: editFormData.date,
        hours: editFormData.hours ? parseFloat(editFormData.hours) : 0,
        Photo: editFormData.Photo.trim() || null,
      });

      if (response.success) {
        toast({
          title: "Activity updated successfully",
        });
        setEditOpen(false);
        setEditingActivity(null);
        fetchActivities();
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error updating activity",
        description: error.message,
      });
    }
  };

  const handleDeleteActivity = async (id: string | number) => {
    if (!canEdit) {
      toast({
        variant: "destructive",
        title: "Read-only access",
        description: "Only admin can delete activities.",
      });
      return;
    }

    try {
      const response = await adminAPI.deleteActivity(String(id));
      if (response.success) {
        toast({
          title: "Activity deleted successfully",
        });
        fetchActivities();
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error deleting activity",
        description: error.message,
      });
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "Date unavailable";
    try {
      return new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch {
      return dateString;
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
    <div className="space-y-4 sm:space-y-5 max-w-7xl">
      {canEdit && (
        <div className="flex justify-start sm:justify-end">
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-teal-700 hover:bg-teal-800 text-white rounded-xl gap-1.5 text-sm sm:text-base font-bold shadow-md">
                <Plus className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Add Activity</span><span className="sm:hidden">Add</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="rounded-3xl sm:max-w-md max-h-[90vh] overflow-y-auto bg-[#FAF7F2] border-[#EAD8C0]/50 shadow-2xl
              [&::-webkit-scrollbar]:w-2
              [&::-webkit-scrollbar-track]:bg-transparent
              [&::-webkit-scrollbar-thumb]:bg-[#EAD8C0]
              [&::-webkit-scrollbar-thumb]:rounded-full
              hover:[&::-webkit-scrollbar-thumb]:bg-[#d4bc9a]">
              <DialogHeader><DialogTitle className="text-[#8B735B] font-bold">Add Activity / Event</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-1.5">
                  <Label className="text-[#8B735B] font-bold">Title *</Label>
                  <Input
                    placeholder="Event title"
                    className="rounded-xl border-[#EAD8C0]/40 bg-white focus:border-[#EAD8C0] focus:ring-1 focus:ring-[#EAD8C0]"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[#8B735B] font-bold">Category</Label>
                  <Input
                    placeholder="e.g. Workshop, Seminar"
                    className="rounded-xl border-[#EAD8C0]/40 bg-white focus:border-[#EAD8C0] focus:ring-1 focus:ring-[#EAD8C0]"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[#8B735B] font-bold">Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant={"outline"}
                        className={cn(
                          "w-full rounded-xl border-[#EAD8C0]/40 bg-white px-3 py-2 text-sm font-normal justify-between text-left h-10",
                          !formData.date && "text-muted-foreground"
                        )}
                      >
                        {formData.date ? format(new Date(formData.date), "do MMMM yyyy") : <span>Pick a date</span>}
                        <CalendarIcon className="ml-2 h-4 w-4 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 border-none shadow-none bg-transparent" align="start" side="bottom">
                      <Calendar
                        mode="single"
                        selected={formData.date ? new Date(formData.date) : undefined}
                        onSelect={(date) => setFormData({ ...formData, date: date ? format(date, "yyyy-MM-dd") : "" })}
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
                  <Label className="text-[#8B735B] font-bold">Hours</Label>
                  <Input
                    type="number"
                    placeholder="e.g. 2"
                    className="rounded-xl border-[#EAD8C0]/40 bg-white focus:border-[#EAD8C0] focus:ring-1 focus:ring-[#EAD8C0]"
                    value={formData.hours}
                    onChange={(e) => setFormData({ ...formData, hours: e.target.value })}
                  />
                </div>
                <ImageUpload
                  label="Activity Photo"
                  onImageUpload={(url) => setFormData({ ...formData, Photo: url })}
                  currentImage={formData.Photo}
                />
                <div className="space-y-1.5">
                  <Label className="text-[#8B735B] font-bold">Description</Label>
                  <Textarea
                    placeholder="Describe the event..."
                    className="rounded-xl resize-none border-[#EAD8C0]/40 bg-white focus:border-[#EAD8C0] focus:ring-1 focus:ring-[#EAD8C0]"
                    rows={3}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" className="rounded-xl border-[#EAD8C0] text-[#8B735B] hover:bg-[#EAD8C0]/20" onClick={() => setOpen(false)}>Cancel</Button>
                  <Button className="rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-bold" onClick={handleAddActivity}>Create</Button>
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
              setEditingActivity(null);
            }
          }}
        >
          <DialogContent className="rounded-3xl sm:max-w-md max-h-[90vh] overflow-y-auto bg-[#FAF7F2] border-[#EAD8C0]/50 shadow-2xl
            [&::-webkit-scrollbar]:w-2
            [&::-webkit-scrollbar-track]:bg-transparent
            [&::-webkit-scrollbar-thumb]:bg-[#EAD8C0]
            [&::-webkit-scrollbar-thumb]:rounded-full
            hover:[&::-webkit-scrollbar-thumb]:bg-[#d4bc9a]">
            <DialogHeader><DialogTitle className="text-[#8B735B] font-bold">Edit Activity / Event</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <Label className="text-[#8B735B] font-bold">Title *</Label>
                <Input
                  placeholder="Event title"
                  className="rounded-xl border-[#EAD8C0]/40 bg-white focus:border-[#EAD8C0] focus:ring-1 focus:ring-[#EAD8C0]"
                  value={editFormData.title}
                  onChange={(e) => setEditFormData({ ...editFormData, title: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[#8B735B] font-bold">Category</Label>
                <Input
                  placeholder="e.g. Workshop, Seminar"
                  className="rounded-xl border-[#EAD8C0]/40 bg-white focus:border-[#EAD8C0] focus:ring-1 focus:ring-[#EAD8C0]"
                  value={editFormData.category}
                  onChange={(e) => setEditFormData({ ...editFormData, category: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[#8B735B] font-bold">Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant={"outline"}
                      className={cn(
                        "w-full rounded-xl border-[#EAD8C0]/40 bg-white px-3 py-2 text-sm font-normal justify-between text-left h-10",
                        !editFormData.date && "text-muted-foreground"
                      )}
                    >
                      {editFormData.date ? format(new Date(editFormData.date), "do MMMM yyyy") : <span>Pick a date</span>}
                      <CalendarIcon className="ml-2 h-4 w-4 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 border-none shadow-none bg-transparent" align="start" side="bottom">
                    <Calendar
                      mode="single"
                      selected={editFormData.date ? new Date(editFormData.date) : undefined}
                      onSelect={(date) => setEditFormData({ ...editFormData, date: date ? format(date, "yyyy-MM-dd") : "" })}
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
                <Label className="text-[#8B735B] font-bold">Hours</Label>
                <Input
                  type="number"
                  placeholder="e.g. 2"
                  className="rounded-xl border-[#EAD8C0]/40 bg-white focus:border-[#EAD8C0] focus:ring-1 focus:ring-[#EAD8C0]"
                  value={editFormData.hours}
                  onChange={(e) => setEditFormData({ ...editFormData, hours: e.target.value })}
                />
              </div>
              <ImageUpload
                label="Activity Photo"
                onImageUpload={(url) => setEditFormData({ ...editFormData, Photo: url })}
                currentImage={editFormData.Photo}
              />
              <div className="space-y-1.5">
                <Label className="text-[#8B735B] font-bold">Description</Label>
                <Textarea
                  placeholder="Describe the event..."
                  className="rounded-xl resize-none border-[#EAD8C0]/40 bg-white focus:border-[#EAD8C0] focus:ring-1 focus:ring-[#EAD8C0]"
                  rows={3}
                  value={editFormData.description}
                  onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" className="rounded-xl border-[#EAD8C0] text-[#8B735B] hover:bg-[#EAD8C0]/20" onClick={() => setEditOpen(false)}>Cancel</Button>
                <Button className="rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-bold" onClick={handleUpdateActivity}>Update</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Activities List & Image */}
      <div className="flex flex-col lg:flex-row gap-8 items-start">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="flex-1 w-full bg-[#FAF7F2]/60 backdrop-blur-sm rounded-[32px] border-2 border-[#EAD8C0]/50 shadow-xl overflow-hidden"
        >
          {!canEdit && <p className="text-[10px] text-muted-foreground p-4 text-center">You have read-only access. Only admin can manage activities.</p>}

          {activities.length === 0 ? (
            <div className="text-center py-20 text-muted-foreground font-medium">
              <Calendar className="w-12 h-12 mx-auto text-[#EAD8C0] mb-4 opacity-50" />
              No activities found.
            </div>
          ) : (
            <div className="p-3 sm:p-6 space-y-3 max-h-[500px] overflow-y-auto
              [&::-webkit-scrollbar]:w-2
              [&::-webkit-scrollbar-track]:bg-transparent
              [&::-webkit-scrollbar-thumb]:bg-[#EAD8C0]
              [&::-webkit-scrollbar-thumb]:rounded-full
              hover:[&::-webkit-scrollbar-thumb]:bg-[#d4bc9a]">
              {activities.map((activity) => (
                <motion.div
                  key={activity.id}
                  whileHover={{ scale: 1.01 }}
                  className="flex items-center justify-between p-4 rounded-2xl bg-white border border-[#EAD8C0]/30 shadow-sm hover:shadow-md hover:border-[#EAD8C0] transition-all group"
                >
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="w-12 h-12 rounded-xl bg-[#FAF7F2] flex items-center justify-center text-[#8B735B] border border-[#EAD8C0]/40 group-hover:bg-[#EAD8C0]/20 transition-colors">
                      <CalendarIcon className="w-6 h-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-[#8B735B] truncate text-base sm:text-lg">{activity.title}</p>
                      <div className="flex items-center gap-3 text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider">
                        <span>{formatDate(activity.date)}</span>
                        {activity.category && (
                          <>
                            <span className="w-1 h-1 rounded-full bg-[#EAD8C0]" />
                            <span className="text-[#8B735B]/80">{activity.category}</span>
                          </>
                        )}
                        {activity.hours && (
                          <>
                            <span className="w-1 h-1 rounded-full bg-[#EAD8C0]" />
                            <span className="text-[#8B735B]/80">{activity.hours} Hours</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  {canEdit && (
                    <div className="flex gap-2 ml-4">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleStartEdit(activity)}
                        className="h-9 w-9 rounded-xl hover:bg-[#EAD8C0]/20 text-[#8B735B]"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteActivity(activity.id)}
                        className="h-9 w-9 rounded-xl text-destructive hover:bg-destructive/10"
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

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="hidden lg:flex flex-col items-center justify-start pt-24 sticky top-20"
        >
          <img
            src="/Activity.jpg"
            alt="Activities"
            className="max-w-[320px] rounded-3xl shadow-[0_0_50px_rgba(234,216,192,1),0_0_20px_rgba(255,255,255,0.4)] border-4 border-[#EAD8C0] transform hover:scale-[1.02] transition-transform duration-500"
          />
        </motion.div>
      </div>
    </div>
  );
}
