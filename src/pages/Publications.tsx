import { useEffect, useState, useRef } from "react";
import { motion } from "framer-motion";
import { Loader2, Pencil, Plus, Trash2, BookOpen, Calendar as CalendarIcon, ExternalLink, Users, Building2, Landmark, GraduationCap, Upload, X, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { hasWriteAccess } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { adminAPI } from "@/lib/adminApi";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const PUBLICATION_TYPES = [
  { label: "Conference", value: "conference" },
  { label: "Journal", value: "journal" },
  { label: "Book Chapter", value: "book chapter" },
  { label: "Patent", value: "patent" },
  { label: "Poster", value: "poster" },
  { label: "Research Artical", value: "research artical" },
];

interface Publisher {
  id: number;
  publisher_name: string;
}

interface Publication {
  id: string;
  title: string;
  authors?: string;
  student_authors?: string;
  published_date?: string;
  date?: string;
  conference_date?: string;
  type_of_publication?: string;
  event_type?: string;
  publisher?: string;
  department?: string;
  institute?: string;
  link_to_paper?: string;
  paper_url?: string;
  venue?: string;
  description?: string;
  category?: string;
  created_at?: string;
  year?: number;
  publisher_photo?: string;
  publisher_logo_id?: number;
  logo_url?: string;
  status?: string;
  approved_by?: string;
  approved_at?: string;
  source?: string;
}

export default function Publications() {
  const [publications, setPublications] = useState<Publication[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const approvedPublications = publications.filter(p => p.status !== "PENDING");
  const pendingPublications = publications.filter(p => p.status === "PENDING");

  const filteredAllPublications = publications.filter(p => {
    if (filterStatus === "ALL") return true;
    return p.status === filterStatus;
  });

  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingPublication, setEditingPublication] = useState<Publication | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    authors: "",
    published_date: "",
    conference_date: "",
    type_of_publication: "",
    publisher: "",
    department: "",
    institute: "",
    link_to_paper: "",
    venue: "",
    description: "",
    category: "",
    year: new Date().getFullYear(),
    publisher_photo: "",
  });
  const [editFormData, setEditFormData] = useState({
    title: "",
    authors: "",
    published_date: "",
    conference_date: "",
    type_of_publication: "",
    publisher: "",
    department: "",
    institute: "",
    link_to_paper: "",
    venue: "",
    description: "",
    category: "",
    year: new Date().getFullYear(),
    publisher_photo: "",
  });
  const [uploadingImage, setUploadingImage] = useState(false);

  // Controlled open state for date pickers (so they close on date selection)
  const [addConferenceDateOpen, setAddConferenceDateOpen] = useState(false);
  const [addPublishedDateOpen, setAddPublishedDateOpen] = useState(false);
  const [editConferenceDateOpen, setEditConferenceDateOpen] = useState(false);
  const [editPublishedDateOpen, setEditPublishedDateOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const canEdit = hasWriteAccess();

  // Publisher is required for all publication types except "poster"
  const isPublisherRequired = formData.type_of_publication !== "poster";
  const isEditPublisherRequired = editFormData.type_of_publication !== "poster";

  // Conference Venue is required only when publication type is "conference"
  const isConferenceVenueRequired = formData.type_of_publication === "conference";
  const isEditConferenceVenueRequired = editFormData.type_of_publication === "conference";

  // Published Date must be today or in the past
  const today = new Date();
  today.setHours(0, 0, 0, 0); // normalize to midnight so today is always allowed
  const disableFutureDates = (date: Date) => date > today;

  // URL format validator — accepts with or without protocol, requires a valid domain extension
  const isValidUrl = (value: string): boolean => {
    const urlRegex = /^(https?:\/\/)?(([\w-]+\.)+[\w-]{2,})(\/[\w\-./?%&=#]*)?$/i;
    return urlRegex.test(value);
  };

  // Publisher logo state
  const [publishers, setPublishers] = useState<Publisher[]>([]);
  const [publisherLogoId, setPublisherLogoId] = useState<number | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);
  const [isLogoLoading, setIsLogoLoading] = useState(false);
  const [showOtherFields, setShowOtherFields] = useState(false);
  const [customPublisher, setCustomPublisher] = useState("");
  const [customLogoFile, setCustomLogoFile] = useState<File | null>(null);
  const [logoError, setLogoError] = useState<string | null>(null);
  const customLogoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchPublications();
    fetchPublishers();
  }, []);

  const fetchPublishers = async () => {
    try {
      const res = await adminAPI.getPublishers();
      if (res.success && Array.isArray(res.data)) {
        setPublishers(res.data);
      }
    } catch {
      // Publishers load silently; fallback to empty list
    }
  };

  const handlePublisherSelect = async (publisherId: number) => {
    const OTHER_ID = 7;
    setPublisherLogoId(null);
    setLogoPreviewUrl(null);
    setLogoError(null);
    setShowOtherFields(publisherId === OTHER_ID);
    setCustomPublisher("");
    setCustomLogoFile(null);

    if (publisherId === OTHER_ID) return;

    try {
      setIsLogoLoading(true);
      const res = await adminAPI.getPublisherLogo(publisherId);
      if (res.success) {
        setPublisherLogoId(publisherId);
        setLogoPreviewUrl(res.logo_url || null);
      }
    } catch {
      setLogoError("Could not load publisher logo.");
    } finally {
      setIsLogoLoading(false);
    }
  };

  const handleCustomLogoUpload = async (file: File) => {
    if (!customPublisher.trim() || !file) return;
    try {
      setIsLogoLoading(true);
      setLogoError(null);
      const res = await adminAPI.uploadPublisherLogo(customPublisher.trim(), file);
      if (res.success) {
        setPublisherLogoId(res.symbol_id);
        setLogoPreviewUrl(res.logo_url || null);
      }
    } catch (err: any) {
      const msg = err.message || "";
      setLogoError(msg.includes("502") ? "Logo upload failed. Please try again." : err.message || "Upload failed.");
    } finally {
      setIsLogoLoading(false);
    }
  };

  const resetLogoState = () => {
    setPublisherLogoId(null);
    setLogoPreviewUrl(null);
    setIsLogoLoading(false);
    setShowOtherFields(false);
    setCustomPublisher("");
    setCustomLogoFile(null);
    setLogoError(null);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, isEdit: boolean) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast({
        variant: "destructive",
        title: "File too large",
        description: "Image size should be less than 10MB",
      });
      return;
    }

    try {
      setUploadingImage(true);
      const uploadData = new FormData();
      uploadData.append("image", file);

      const response = await adminAPI.uploadImage(uploadData);

      if (response.success || response.url) {
        const imageUrl = response.url || response.data?.url;
        if (isEdit) {
          setEditFormData(prev => ({ ...prev, publisher_photo: imageUrl }));
        } else {
          setFormData(prev => ({ ...prev, publisher_photo: imageUrl }));
        }
        toast({
          title: "Success",
          description: "Image uploaded successfully",
        });
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Upload failed",
        description: error.message || "Failed to upload image",
      });
    } finally {
      setUploadingImage(false);
      // Clear the input value so the same file can be selected again
      e.target.value = "";
    }
  };

  const fetchPublications = async () => {
    try {
      setLoading(true);
      const response = await adminAPI.getPublications();

      if (response.success && Array.isArray(response.data)) {
        const sorted = response.data.sort((a: any, b: any) => {
          const dateA = new Date(a.published_date || a.date || 0).getTime();
          const dateB = new Date(b.published_date || b.date || 0).getTime();
          
          if (dateB !== dateA) {
            return dateB - dateA; // Latest publication date first
          }
          
          // Fallback to most recently created if publication dates are equal
          return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
        });
        setPublications(sorted as Publication[]);
      } else {
        setPublications([]);
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error fetching publications",
        description: error.message,
      });
      setPublications([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAddPublication = async () => {
    if (!canEdit) {
      toast({ variant: "destructive", title: "Read-only access", description: "Only admin can add publications." });
      return;
    }

    // --- Required field validation ---
    if (!formData.title.trim()) {
      toast({ variant: "destructive", title: "Missing required fields", description: "Title is required." });
      return;
    }

    if (!formData.type_of_publication.trim()) {
      toast({ variant: "destructive", title: "Missing required fields", description: "Type of Publication is required." });
      return;
    }

    if (!formData.authors.trim()) {
      toast({ variant: "destructive", title: "Missing required fields", description: "Authors are required." });
      return;
    }

    if (!formData.link_to_paper.trim()) {
      toast({ variant: "destructive", title: "Missing required fields", description: "Link to Paper is required." });
      return;
    }

    if (!isValidUrl(formData.link_to_paper.trim())) {
      toast({ variant: "destructive", title: "Invalid URL", description: "Link to Paper must contain a valid domain like .com, .org, .edu, etc." });
      return;
    }

    if (!formData.published_date) {
      toast({ variant: "destructive", title: "Missing required fields", description: "Published Date is required." });
      return;
    }

    if (isConferenceVenueRequired) {
      if (!formData.conference_date) {
        toast({ variant: "destructive", title: "Missing required fields", description: "Conference Date is required." });
        return;
      }
      const pickedConf = new Date(formData.conference_date);
      pickedConf.setHours(0, 0, 0, 0);
      if (pickedConf > today) {
        toast({ variant: "destructive", title: "Invalid date", description: "Conference Date cannot be a future date." });
        return;
      }
    }

    if (isConferenceVenueRequired && !formData.venue.trim()) {
      toast({ variant: "destructive", title: "Missing required fields", description: "Conference Venue is required." });
      return;
    }

    // --- Date range validation (published_date is guaranteed non-empty here) ---
    const picked = new Date(formData.published_date);
    picked.setHours(0, 0, 0, 0);
    if (picked > today) {
      toast({ variant: "destructive", title: "Invalid date", description: "Future publication dates are not allowed." });
      return;
    }

    if (isPublisherRequired && !formData.publisher.trim()) {
      toast({ variant: "destructive", title: "Missing required fields", description: "Publisher is required." });
      return;
    }

    if (formData.publisher && publisherLogoId === null) {
      toast({ variant: "destructive", title: "Missing publisher logo", description: "Please wait for the publisher logo to load, or upload one for a custom publisher." });
      return;
    }

    try {
      setSubmitting(true);
      const payload: any = {
        title: formData.title.trim(),
        student_authors: formData.authors.trim() || null,
        published_date: formData.published_date || null,
        conference_date: formData.conference_date || null,
        type_of_publication: formData.type_of_publication.trim() || null,
        publisher: formData.publisher.trim() || null,
        department: formData.department.trim() || null,
        institute: formData.institute.trim() || null,
        link_to_paper: formData.link_to_paper.trim() || null,
        venue: formData.venue.trim() || null,
        description: formData.description.trim() || null,
        category: formData.category.trim() || null,
        year: formData.published_date ? new Date(formData.published_date).getFullYear() : new Date().getFullYear(),
        publisher_photo: formData.publisher_photo || null,
        status: "APPROVED",
        source: "admin manual creation",
      };

      if (publisherLogoId !== null) {
        payload.publisher_logo_id = publisherLogoId;
      }

      const response = await adminAPI.createPublication(payload);

      if (response.success || response.data) {
        toast({ title: "Success", description: "Publication added successfully and is now active." });
        setOpen(false);
        setFormData({
          title: "", authors: "", published_date: "", conference_date: "",
          type_of_publication: "", publisher: "", department: "", institute: "",
          link_to_paper: "", venue: "", description: "", category: "",
          year: new Date().getFullYear(), publisher_photo: "",
        });
        resetLogoState();
        fetchPublications();
      }
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message || "Failed to add publication" });
    } finally {
      setSubmitting(false);
    }
  };


  const handleDeletePublication = async (id: string) => {
    if (!canEdit) {
      toast({
        variant: "destructive",
        title: "Read-only access",
        description: "Only admin can delete publications.",
      });
      return;
    }

    try {
      const response = await adminAPI.deletePublication(id);
      if (response.success) {
        toast({
          title: "Success",
          description: "Publication deleted successfully",
        });
        fetchPublications();
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to delete publication",
      });
    }
  };

  const handleEditPublication = (publication: Publication) => {
    if (!canEdit) {
      toast({
        variant: "destructive",
        title: "Read-only access",
        description: "Only admin can edit publications.",
      });
      return;
    }

    setEditingPublication(publication);
    resetLogoState();
    // Pre-populate logo from existing publication data
    if (publication.logo_url) {
      setLogoPreviewUrl(publication.logo_url);
    }
    if (publication.publisher_logo_id) {
      setPublisherLogoId(publication.publisher_logo_id);
    }
    setEditFormData({
      title: publication.title || "",
      authors: publication.authors || publication.student_authors || "",
      published_date: publication.published_date || publication.date || "",
      conference_date: publication.conference_date || "",
      type_of_publication: publication.type_of_publication || publication.event_type || "",
      publisher: publication.publisher || "",
      department: publication.department || "",
      institute: publication.institute || "",
      link_to_paper: publication.link_to_paper || publication.paper_url || "",
      venue: publication.venue || "",
      description: publication.description || "",
      category: publication.category || "",
      year: publication.year || new Date().getFullYear(),
      publisher_photo: publication.publisher_photo || "",
    });
    setEditOpen(true);
  };

  const handleUpdatePublication = async () => {
    if (!editingPublication || !canEdit) {
      toast({
        variant: "destructive",
        title: "Read-only access",
        description: "Only admin can edit publications.",
      });
      return;
    }

    if (!editFormData.title.trim()) {
      toast({
        variant: "destructive",
        title: "Missing required fields",
        description: "Title is required.",
      });
      return;
    }

    if (editFormData.published_date) {
      const picked = new Date(editFormData.published_date);
      picked.setHours(0, 0, 0, 0);
      if (picked > today) {
        toast({ variant: "destructive", title: "Invalid date", description: "Future publication dates are not allowed." });
        return;
      }
    }

    if (isEditPublisherRequired && !editFormData.publisher.trim()) {
      toast({ variant: "destructive", title: "Missing required fields", description: "Publisher is required." });
      return;
    }

    try {
      setEditSubmitting(true);
      const payload: any = {
        title: editFormData.title.trim(),
        student_authors: editFormData.authors.trim() || null,
        published_date: editFormData.published_date || null,
        conference_date: editFormData.conference_date || null,
        type_of_publication: editFormData.type_of_publication.trim() || null,
        publisher: editFormData.publisher.trim() || null,
        department: editFormData.department.trim() || null,
        institute: editFormData.institute.trim() || null,
        link_to_paper: editFormData.link_to_paper.trim() || null,
        venue: editFormData.venue.trim() || null,
        description: editFormData.description.trim() || null,
        category: editFormData.category.trim() || null,
        year: editFormData.published_date ? new Date(editFormData.published_date).getFullYear() : new Date().getFullYear(),
        publisher_photo: editFormData.publisher_photo || null,
      };

      if (publisherLogoId !== null) {
        payload.publisher_logo_id = publisherLogoId;
      }

      const response = await adminAPI.updatePublication(editingPublication.id, payload);

      if (response.success || response.data) {
        toast({ title: "Success", description: "Publication updated successfully" });
        setEditOpen(false);
        setEditingPublication(null);
        resetLogoState();
        fetchPublications();
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to update publication",
      });
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleApprovePublication = async (id: string) => {
    try {
      const response = await adminAPI.approvePublication(id);
      if (response.success) {
        toast({ title: "Approved", description: "Publication approved and is now live on the website." });
        fetchPublications();
      }
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message || "Failed to approve publication" });
    }
  };

  const handleRejectRequest = async (id: string) => {
    try {
      const response = await adminAPI.rejectPublication(id);
      if (response.success) {
        toast({ title: "Rejected", description: "Publication request has been rejected." });
        fetchPublications();
      }
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message || "Failed to reject publication" });
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "";
    try {
      return format(new Date(dateString), "dd/MM/yyyy");
    } catch {
      return dateString;
    }
  };

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[#8B735B] flex items-center gap-2">
            <BookOpen className="w-6 h-6" />
            Publications
          </h2>
          <p className="text-sm text-[#8B735B]/70 mt-1">Manage academic publications and research papers</p>
        </div>
        {canEdit && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="bg-teal-700 hover:bg-teal-800 text-white gap-2 rounded-xl font-bold shadow-md">
                <Plus className="w-4 h-4" /> Add Publication
              </Button>
            </DialogTrigger>
            <DialogContent className="rounded-3xl sm:max-w-lg max-h-[90vh] overflow-y-auto bg-[#FAF7F2] border-[#EAD8C0]/50 shadow-2xl
              [&::-webkit-scrollbar]:w-2
              [&::-webkit-scrollbar-track]:bg-transparent
              [&::-webkit-scrollbar-thumb]:bg-[#EAD8C0]
              [&::-webkit-scrollbar-thumb]:rounded-full
              hover:[&::-webkit-scrollbar-thumb]:bg-[#d4bc9a]">
              <DialogHeader>
                <DialogTitle className="text-[#8B735B] font-bold">Add Publication</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label className="text-[#8B735B] font-bold">
                    Type of Publication <span className="text-red-500">*</span>
                  </Label>
                  <Select value={formData.type_of_publication} onValueChange={(value) => setFormData({ ...formData, type_of_publication: value })}>
                    <SelectTrigger className="rounded-xl border-[#EAD8C0]/40 bg-white focus:ring-[#EAD8C0]">
                      <SelectValue placeholder="Select publication type" />
                    </SelectTrigger>
                    <SelectContent className="bg-white border-[#EAD8C0]">
                      {PUBLICATION_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value} className="focus:bg-[#8B735B] focus:text-white text-[#8B735B] cursor-pointer">
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-[#8B735B] font-bold">Title *</Label>
                  <Input
                    placeholder="Publication title"
                    className="rounded-xl border-[#EAD8C0]/40 bg-white focus:border-[#EAD8C0] focus:ring-1 focus:ring-[#EAD8C0]"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[#8B735B] font-bold">
                    Authors <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    placeholder="Comma-separated author names"
                    className="rounded-xl border-[#EAD8C0]/40 bg-white focus:border-[#EAD8C0] focus:ring-1 focus:ring-[#EAD8C0]"
                    value={formData.authors}
                    onChange={(e) => setFormData({ ...formData, authors: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[#8B735B] font-bold">
                    Venue{isConferenceVenueRequired && <span className="text-red-500 ml-0.5">*</span>}
                  </Label>
                  <Input
                    placeholder="Conference/Journal venue"
                    className="rounded-xl border-[#EAD8C0]/40 bg-white focus:border-[#EAD8C0] focus:ring-1 focus:ring-[#EAD8C0]"
                    value={formData.venue}
                    onChange={(e) => setFormData({ ...formData, venue: e.target.value })}
                  />
                </div>
                {isConferenceVenueRequired && (
                  <div className="space-y-2">
                    <Label className="text-[#8B735B] font-bold">
                      Conference Date <span className="text-red-500">*</span>
                    </Label>
                    <Popover open={addConferenceDateOpen} onOpenChange={setAddConferenceDateOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant={"outline"}
                          className={cn(
                            "w-full rounded-xl border-[#EAD8C0]/40 bg-white px-3 py-2 text-sm font-normal justify-between text-left h-10",
                            !formData.conference_date && "text-muted-foreground"
                          )}
                        >
                          {formData.conference_date ? format(new Date(formData.conference_date), "do MMMM yyyy") : <span>Pick a date</span>}
                          <CalendarIcon className="ml-2 h-4 w-4 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 border-none shadow-none bg-transparent" align="start" side="bottom">
                        <Calendar
                          mode="single"
                          selected={formData.conference_date ? new Date(formData.conference_date) : undefined}
                          onSelect={(date) => {
                            setFormData({ ...formData, conference_date: date ? format(date, "yyyy-MM-dd") : "" });
                            setAddConferenceDateOpen(false);
                          }}
                          disabled={disableFutureDates}
                          initialFocus
                          className="bg-[#FAF7F2] border-2 border-[#EAD8C0]/50 rounded-2xl scale-90 origin-top-left shadow-xl"
                          classNames={{
                            day_selected: "!bg-[#EAD8C0] !text-[#8B735B] hover:!bg-[#d4bc9a] focus:!bg-[#EAD8C0]",
                            day_today: "bg-white text-[#8B735B] font-bold border border-[#EAD8C0]",
                            day: "hover:!bg-[#EAD8C0]/20 rounded-md transition-colors",
                            day_disabled: "opacity-30 cursor-not-allowed hover:!bg-transparent",
                            head_cell: "text-[#8B735B] font-bold w-7",
                            cell: "h-7 w-7 text-center text-[11px] p-0 relative [&:has([aria-selected])]:!bg-transparent focus-within:relative focus-within:z-20",
                          }}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                )}
                <div className="space-y-2">
                  <Label className="text-[#8B735B] font-bold">
                    Link to Paper <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    placeholder="https://..."
                    className={cn(
                      "rounded-xl border-[#EAD8C0]/40 bg-white focus:border-[#EAD8C0] focus:ring-1 focus:ring-[#EAD8C0]",
                      formData.link_to_paper.trim() && !isValidUrl(formData.link_to_paper.trim()) && "border-red-400 focus:border-red-400 focus:ring-red-200"
                    )}
                    value={formData.link_to_paper}
                    onChange={(e) => setFormData({ ...formData, link_to_paper: e.target.value })}
                  />
                  {formData.link_to_paper.trim() && !isValidUrl(formData.link_to_paper.trim()) && (
                    <p className="text-xs text-red-500 mt-1">Please enter a valid link with a proper domain (e.g. https://example.com)</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label className="text-[#8B735B] font-bold">
                    Publisher{isPublisherRequired && <span className="text-red-500 ml-0.5">*</span>}
                  </Label>
                  <Select
                    value={formData.publisher}
                    onValueChange={(value) => {
                      const selected = publishers.find(p => p.publisher_name === value);
                      setFormData({ ...formData, publisher: value });
                      if (selected) handlePublisherSelect(selected.id);
                    }}
                  >
                    <SelectTrigger className="rounded-xl border-[#EAD8C0]/40 bg-white focus:ring-[#EAD8C0]">
                      <SelectValue placeholder="Select publisher" />
                    </SelectTrigger>
                    <SelectContent className="bg-white border-[#EAD8C0]">
                      {publishers.map((p) => (
                        <SelectItem key={p.id} value={p.publisher_name} className="focus:bg-[#8B735B] focus:text-white text-[#8B735B] cursor-pointer">
                          {p.publisher_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Logo preview — Case 1: predefined publisher */}
                  {formData.publisher && !showOtherFields && (
                    <div className="mt-2 flex items-center gap-3 min-h-[56px]">
                      {isLogoLoading ? (
                        <div className="flex items-center gap-2 text-[#8B735B]/60 text-xs">
                          <Loader2 className="w-4 h-4 animate-spin" /> Fetching logo…
                        </div>
                      ) : logoPreviewUrl ? (
                        <img src={logoPreviewUrl} alt="Publisher logo" className="h-12 w-auto object-contain rounded-lg border border-[#EAD8C0]/40 p-1 bg-white" />
                      ) : (
                        <div className="text-xs text-[#8B735B]/50 italic">No logo available</div>
                      )}
                      {logoError && <span className="text-xs text-red-500">{logoError}</span>}
                    </div>
                  )}

                  {/* Case 2: Other — custom publisher name + logo upload */}
                  {showOtherFields && (
                    <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-300 pt-2">
                      <div className="space-y-1">
                        <Label className="text-[#8B735B] font-bold text-sm">Publisher Name *</Label>
                        <Input
                          placeholder="e.g. Elsevier"
                          className="rounded-xl border-[#EAD8C0]/40 bg-white focus:border-[#EAD8C0] focus:ring-1 focus:ring-[#EAD8C0]"
                          value={customPublisher}
                          onChange={(e) => setCustomPublisher(e.target.value)}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[#8B735B] font-bold text-sm">Upload Logo *</Label>
                        <div
                          onClick={() => customLogoInputRef.current?.click()}
                          className={cn(
                            "border-2 border-dashed border-[#EAD8C0] rounded-2xl p-6 flex flex-col items-center justify-center bg-white/50 hover:bg-white hover:border-teal-600/50 transition-all cursor-pointer group relative overflow-hidden min-h-[140px]",
                            isLogoLoading && "opacity-50 cursor-not-allowed"
                          )}
                        >
                          {isLogoLoading ? (
                            <div className="flex flex-col items-center gap-2">
                              <Loader2 className="w-7 h-7 animate-spin text-[#8B735B]" />
                              <p className="text-xs font-medium text-[#8B735B]">Uploading logo…</p>
                            </div>
                          ) : logoPreviewUrl ? (
                            <img src={logoPreviewUrl} alt="Logo preview" className="h-16 w-auto object-contain rounded-lg" />
                          ) : (
                            <>
                              <div className="w-10 h-10 rounded-full bg-[#FAF7F2] flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                                <Upload className="w-5 h-5 text-[#8B735B]" />
                              </div>
                              <p className="text-xs font-bold text-[#8B735B]">Click to upload logo</p>
                              <p className="text-[10px] text-[#8B735B]/60 mt-1">JPEG, PNG, WebP, GIF, SVG · max 10 MB</p>
                            </>
                          )}
                          <input
                            ref={customLogoInputRef}
                            type="file"
                            className="hidden"
                            accept="image/*"
                            disabled={isLogoLoading}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              setCustomLogoFile(file);
                              handleCustomLogoUpload(file);
                              e.target.value = "";
                            }}
                          />
                        </div>
                        {logoError && <p className="text-xs text-red-500 mt-1">{logoError}</p>}
                        {publisherLogoId !== null && logoPreviewUrl && (
                          <p className="text-xs text-teal-700 font-medium">✓ Logo uploaded successfully</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label className="text-[#8B735B] font-bold">
                    Published Date <span className="text-red-500">*</span>
                  </Label>
                  <Popover open={addPublishedDateOpen} onOpenChange={setAddPublishedDateOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant={"outline"}
                        className={cn(
                          "w-full rounded-xl border-[#EAD8C0]/40 bg-white px-3 py-2 text-sm font-normal justify-between text-left h-10",
                          !formData.published_date && "text-muted-foreground"
                        )}
                      >
                        {formData.published_date ? format(new Date(formData.published_date), "do MMMM yyyy") : <span>Pick a date</span>}
                        <CalendarIcon className="ml-2 h-4 w-4 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 border-none shadow-none bg-transparent" align="start" side="bottom">
                      <Calendar
                        mode="single"
                        selected={formData.published_date ? new Date(formData.published_date) : undefined}
                        onSelect={(date) => {
                          setFormData({ ...formData, published_date: date ? format(date, "yyyy-MM-dd") : "" });
                          setAddPublishedDateOpen(false);
                        }}
                        disabled={disableFutureDates}
                        initialFocus
                        className="bg-[#FAF7F2] border-2 border-[#EAD8C0]/50 rounded-2xl scale-90 origin-top-left shadow-xl"
                        classNames={{
                          day_selected: "!bg-[#EAD8C0] !text-[#8B735B] hover:!bg-[#d4bc9a] focus:!bg-[#EAD8C0]",
                          day_today: "bg-white text-[#8B735B] font-bold border border-[#EAD8C0]",
                          day: "hover:!bg-[#EAD8C0]/20 rounded-md transition-colors",
                          day_disabled: "opacity-30 cursor-not-allowed hover:!bg-transparent",
                          head_cell: "text-[#8B735B] font-bold w-7",
                          cell: "h-7 w-7 text-center text-[11px] p-0 relative [&:has([aria-selected])]:!bg-transparent focus-within:relative focus-within:z-20",
                        }}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-[#8B735B] font-bold">Department</Label>
                    <Input
                      placeholder="Department"
                      className="rounded-xl border-[#EAD8C0]/40 bg-white focus:border-[#EAD8C0] focus:ring-1 focus:ring-[#EAD8C0]"
                      value={formData.department}
                      onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[#8B735B] font-bold">Institute</Label>
                    <Input
                      placeholder="Institute name"
                      className="rounded-xl border-[#EAD8C0]/40 bg-white focus:border-[#EAD8C0] focus:ring-1 focus:ring-[#EAD8C0]"
                      value={formData.institute}
                      onChange={(e) => setFormData({ ...formData, institute: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-[#8B735B] font-bold">Category</Label>
                  <Input
                    placeholder="e.g., Indexed, SRL"
                    className="rounded-xl border-[#EAD8C0]/40 bg-white focus:border-[#EAD8C0] focus:ring-1 focus:ring-[#EAD8C0]"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[#8B735B] font-bold">Description</Label>
                  <Textarea
                    placeholder="Brief description"
                    className="rounded-xl resize-none border-[#EAD8C0]/40 bg-white focus:border-[#EAD8C0] focus:ring-1 focus:ring-[#EAD8C0]"
                    rows={3}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>
                <div className="flex justify-end gap-3 pt-4">
                  <Button
                    variant="outline"
                    className="rounded-xl border-[#EAD8C0] text-[#8B735B] hover:bg-[#EAD8C0]/20"
                    onClick={() => setOpen(false)}
                    disabled={submitting}
                  >
                    Cancel
                  </Button>
                  <Button
                    className="rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-bold"
                    onClick={handleAddPublication}
                    disabled={submitting}
                  >
                    {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Add Publication
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-10 h-10 animate-spin text-[#8B735B]" />
        </div>
      )}

      {/* Main Content Tabs */}
      {!loading && (
        <Tabs defaultValue="approved" className="w-full">
          <TabsList className="bg-[#FAF7F2] border border-[#EAD8C0]/30 rounded-xl mb-6 p-1">
            <TabsTrigger value="approved" className="rounded-lg data-[state=active]:bg-[#EAD8C0] data-[state=active]:text-[#8B735B] font-bold text-sm px-6">
              All Publications
            </TabsTrigger>
            <TabsTrigger value="pending" className="rounded-lg data-[state=active]:bg-[#EAD8C0] data-[state=active]:text-[#8B735B] font-bold text-sm px-6 flex items-center gap-2">
              New Requests
              {pendingPublications.length > 0 && (
                <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full leading-none">
                  {pendingPublications.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="approved" className="mt-0 outline-none space-y-6">
            <div className="flex justify-end mb-4">
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[180px] rounded-xl border-[#EAD8C0]/40 bg-white focus:ring-[#EAD8C0]">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent className="bg-white border-[#EAD8C0]">
                  <SelectItem value="ALL" className="focus:bg-[#8B735B] focus:text-white text-[#8B735B] cursor-pointer">All Statuses</SelectItem>
                  <SelectItem value="APPROVED" className="focus:bg-[#8B735B] focus:text-white text-[#8B735B] cursor-pointer">Approved</SelectItem>
                  <SelectItem value="PENDING" className="focus:bg-[#8B735B] focus:text-white text-[#8B735B] cursor-pointer">Pending</SelectItem>
                  <SelectItem value="REJECTED" className="focus:bg-[#8B735B] focus:text-white text-[#8B735B] cursor-pointer">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {filteredAllPublications.length === 0 ? (
              <div className="text-center py-20 bg-[#FAF7F2]/50 rounded-3xl border-2 border-[#EAD8C0]/50 shadow-sm">
                <BookOpen className="w-16 h-16 text-[#EAD8C0] mx-auto mb-4 opacity-50" />
                <p className="text-[#8B735B] font-medium">No publications found</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredAllPublications.map((publication, index) => (
                  <motion.div
                    key={publication.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: index * 0.05 }}
                    whileHover={{ y: -6 }}
                    className="group bg-white rounded-[32px] border border-[#EAD8C0]/30 shadow-sm hover:shadow-2xl transition-all duration-300 flex flex-col h-full overflow-hidden relative"
                  >
                    <div className="p-6 flex-1 flex flex-col">
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex gap-2 flex-wrap items-center">
                          {publication.status === "PENDING" && (
                            <span className="px-3 py-1 bg-yellow-100 text-yellow-800 text-[10px] font-bold uppercase tracking-[0.1em] rounded-lg border border-yellow-200">
                              PENDING
                            </span>
                          )}
                          {publication.status === "APPROVED" && (
                            <span 
                              className="px-3 py-1 bg-green-100 text-green-800 text-[10px] font-bold uppercase tracking-[0.1em] rounded-lg border border-green-200"
                              title={publication.source === "user request" && publication.approved_by ? `Approved by ${publication.approved_by} on ${formatDate(publication.approved_at)}` : "Approved"}
                            >
                              APPROVED
                            </span>
                          )}
                          {publication.status === "REJECTED" && (
                            <span className="px-3 py-1 bg-red-100 text-red-800 text-[10px] font-bold uppercase tracking-[0.1em] rounded-lg border border-red-200">
                              REJECTED
                            </span>
                          )}
                          <span className="px-3 py-1 bg-[#FAF7F2] text-[#8B735B] text-[10px] font-bold uppercase tracking-[0.1em] rounded-lg border border-[#EAD8C0]/50">
                            {publication.type_of_publication || "Publication"}
                          </span>
                        </div>
                        {canEdit && (
                          <div className="flex gap-1 transition-all duration-300">
                            <button
                              onClick={() => handleEditPublication(publication)}
                              className="p-2 hover:bg-[#EAD8C0]/20 rounded-xl transition-colors text-[#8B735B]"
                              title="Edit"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeletePublication(publication.id)}
                              className="p-2 hover:bg-red-50 rounded-xl transition-colors text-red-500"
                              title="Delete"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="flex-1">
                        <h3 className="font-bold text-[#0D685B] text-lg leading-snug mb-3">
                          {publication.title}
                        </h3>
                        <div className="flex items-start gap-2 text-[#8B735B] mb-4">
                          <Users className="w-4 h-4 mt-0.5 shrink-0 opacity-60" />
                          <p className="text-sm font-bold leading-tight">
                            {publication.student_authors || publication.authors || "No authors listed"}
                          </p>
                        </div>

                        {publication.description && (
                          <div className="mb-4">
                            <p className="text-[11px] text-[#8B735B]/70 leading-relaxed italic">
                              {publication.description}
                            </p>
                          </div>
                        )}

                        <div className="space-y-3 pt-4">
                          {publication.venue && (
                            <div className="flex items-center gap-3 text-sm">
                              <div className="w-8 h-8 rounded-full bg-[#FAF7F2] flex items-center justify-center shrink-0 border border-[#EAD8C0]/20">
                                <Building2 className="w-4 h-4 text-[#8B735B]/60" />
                              </div>
                              <span className="text-[#8B735B]/60 font-medium">{publication.venue}</span>
                            </div>
                          )}
                          {publication.publisher && (
                            <div className="flex items-center gap-3 text-sm">
                              {publication.logo_url ? (
                                <img
                                  src={publication.logo_url}
                                  alt={publication.publisher}
                                  className="h-7 w-auto max-w-[80px] object-contain rounded border border-[#EAD8C0]/30 bg-white p-0.5"
                                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                                />
                              ) : (
                                <div className="w-8 h-8 rounded-full bg-[#FAF7F2] flex items-center justify-center shrink-0 border border-[#EAD8C0]/20">
                                  <Landmark className="w-4 h-4 text-[#8B735B]/60" />
                                </div>
                              )}
                              <span className="text-[#8B735B]/60 font-medium">{publication.publisher}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="px-6 py-4 bg-[#FAF7F2]/50 border-t border-[#EAD8C0]/20 flex items-center justify-between mt-auto">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2 text-[10px] font-bold text-[#8B735B]/50 uppercase tracking-widest">
                          <CalendarIcon className="w-3 h-3" />
                          {publication.published_date ? formatDate(publication.published_date) : publication.year || "N/A"}
                        </div>
                        {publication.type_of_publication === "conference" && publication.conference_date && (
                          <div className="flex items-center gap-2 text-[9px] font-bold text-teal-700/60 uppercase tracking-widest">
                            <span className="w-1 h-1 rounded-full bg-teal-400" />
                            Conf: {formatDate(publication.conference_date)}
                          </div>
                        )}
                      </div>
                      {publication.link_to_paper && (
                        <a
                          href={publication.link_to_paper}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-700 hover:bg-teal-800 text-white text-[10px] font-bold rounded-lg transition-all shadow-lg shadow-teal-900/10"
                        >
                          PAPER <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="pending" className="mt-0 outline-none">
            {pendingPublications.length === 0 ? (
              <div className="text-center py-20 bg-[#FAF7F2]/50 rounded-3xl border-2 border-[#EAD8C0]/50 shadow-sm">
                <BookOpen className="w-16 h-16 text-[#EAD8C0] mx-auto mb-4 opacity-50" />
                <p className="text-[#8B735B] font-medium">No pending requests</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {pendingPublications.map((publication, index) => (
                  <motion.div
                    key={publication.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: index * 0.05 }}
                    className="group bg-white rounded-[32px] border-2 border-amber-500/30 shadow-sm hover:shadow-2xl transition-all duration-300 flex flex-col h-full overflow-hidden relative"
                  >
                    <div className="absolute top-0 inset-x-0 h-1 bg-amber-500/50" />
                    
                    <div className="p-6 flex-1 flex flex-col">
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex gap-2 items-center">
                          <span className="px-3 py-1 bg-amber-50 text-amber-700 text-[10px] font-bold uppercase tracking-[0.1em] rounded-lg border border-amber-200">
                            PENDING
                          </span>
                          <span className="px-3 py-1 bg-[#FAF7F2] text-[#8B735B] text-[10px] font-bold uppercase tracking-[0.1em] rounded-lg border border-[#EAD8C0]/50">
                            {publication.type_of_publication || "Publication"}
                          </span>
                        </div>
                      </div>

                      <div className="flex-1">
                        <h3 className="font-bold text-[#0D685B] text-lg leading-snug mb-3">
                          {publication.title}
                        </h3>
                        <div className="flex items-start gap-2 text-[#8B735B] mb-4">
                          <Users className="w-4 h-4 mt-0.5 shrink-0 opacity-60" />
                          <p className="text-sm font-bold leading-tight">
                            {publication.student_authors || publication.authors || "No authors listed"}
                          </p>
                        </div>

                        <div className="space-y-3 pt-4 border-t border-[#EAD8C0]/30 mt-4">
                          {publication.venue && (
                            <div className="flex items-center gap-3 text-sm">
                              <div className="w-8 h-8 rounded-full bg-[#FAF7F2] flex items-center justify-center shrink-0 border border-[#EAD8C0]/20">
                                <Building2 className="w-4 h-4 text-[#8B735B]/60" />
                              </div>
                              <span className="text-[#8B735B]/60 font-medium">{publication.venue}</span>
                            </div>
                          )}
                          {publication.publisher && (
                            <div className="flex items-center gap-3 text-sm">
                              {publication.logo_url ? (
                                <img
                                  src={publication.logo_url}
                                  alt={publication.publisher}
                                  className="h-7 w-auto max-w-[80px] object-contain rounded border border-[#EAD8C0]/30 bg-white p-0.5"
                                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                                />
                              ) : (
                                <div className="w-8 h-8 rounded-full bg-[#FAF7F2] flex items-center justify-center shrink-0 border border-[#EAD8C0]/20">
                                  <Landmark className="w-4 h-4 text-[#8B735B]/60" />
                                </div>
                              )}
                              <span className="text-[#8B735B]/60 font-medium">{publication.publisher}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="px-6 py-4 bg-amber-50/50 border-t border-amber-100 flex items-center justify-between mt-auto">
                      {publication.link_to_paper ? (
                        <a
                          href={publication.link_to_paper}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-amber-200 hover:bg-amber-100 text-amber-800 text-[10px] font-bold rounded-lg transition-all"
                        >
                          REVIEW PAPER <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : <div />}
                      
                      {canEdit && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleRejectRequest(publication.id)}
                            disabled={publication.status === "REJECTED"}
                            className={cn(
                              "p-1.5 rounded-lg transition-colors border border-transparent",
                              publication.status === "REJECTED" ? "text-gray-400 opacity-50 cursor-not-allowed" : "hover:bg-red-100 text-red-600 hover:border-red-200"
                            )}
                            title="Reject"
                          >
                            <X className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleApprovePublication(publication.id)}
                            disabled={publication.status === "APPROVED"}
                            className={cn(
                              "p-1.5 rounded-lg transition-colors border border-transparent",
                              publication.status === "APPROVED" ? "text-gray-400 opacity-50 cursor-not-allowed" : "hover:bg-green-100 text-green-600 hover:border-green-200"
                            )}
                            title="Approve"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}

      {/* Edit Dialog */}
      {editingPublication && (
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent className="rounded-3xl sm:max-w-lg max-h-[90vh] overflow-y-auto bg-[#FAF7F2] border-[#EAD8C0]/50 shadow-2xl
            [&::-webkit-scrollbar]:w-2
            [&::-webkit-scrollbar-track]:bg-transparent
            [&::-webkit-scrollbar-thumb]:bg-[#EAD8C0]
            [&::-webkit-scrollbar-thumb]:rounded-full
            hover:[&::-webkit-scrollbar-thumb]:bg-[#d4bc9a]">
            <DialogHeader>
              <DialogTitle className="text-[#8B735B] font-bold">Edit Publication</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label className="text-[#8B735B] font-bold">Type of Publication</Label>
                <Select value={editFormData.type_of_publication} onValueChange={(value) => setEditFormData({ ...editFormData, type_of_publication: value })}>
                  <SelectTrigger className="rounded-xl border-[#EAD8C0]/40 bg-white focus:ring-[#EAD8C0]">
                    <SelectValue placeholder="Select publication type" />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-[#EAD8C0]">
                    {PUBLICATION_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value} className="focus:bg-[#8B735B] focus:text-white text-[#8B735B] cursor-pointer">
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-[#8B735B] font-bold">Title *</Label>
                <Input
                  placeholder="Publication title"
                  className="rounded-xl border-[#EAD8C0]/40 bg-white focus:border-[#EAD8C0] focus:ring-1 focus:ring-[#EAD8C0]"
                  value={editFormData.title}
                  onChange={(e) => setEditFormData({ ...editFormData, title: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[#8B735B] font-bold">Authors</Label>
                <Input
                  placeholder="Comma-separated author names"
                  className="rounded-xl border-[#EAD8C0]/40 bg-white focus:border-[#EAD8C0] focus:ring-1 focus:ring-[#EAD8C0]"
                  value={editFormData.authors}
                  onChange={(e) => setEditFormData({ ...editFormData, authors: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[#8B735B] font-bold">Venue</Label>
                <Input
                  placeholder="Conference/Journal venue"
                  className="rounded-xl border-[#EAD8C0]/40 bg-white focus:border-[#EAD8C0] focus:ring-1 focus:ring-[#EAD8C0]"
                  value={editFormData.venue}
                  onChange={(e) => setEditFormData({ ...editFormData, venue: e.target.value })}
                />
              </div>
              {editFormData.type_of_publication === "conference" && (
                <div className="space-y-2">
                  <Label className="text-[#8B735B] font-bold">Conference Date</Label>
                  <Popover open={editConferenceDateOpen} onOpenChange={setEditConferenceDateOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant={"outline"}
                        className={cn(
                          "w-full rounded-xl border-[#EAD8C0]/40 bg-white px-3 py-2 text-sm font-normal justify-between text-left h-10",
                          !editFormData.conference_date && "text-muted-foreground"
                        )}
                      >
                        {editFormData.conference_date ? format(new Date(editFormData.conference_date), "do MMMM yyyy") : <span>Pick a date</span>}
                        <CalendarIcon className="ml-2 h-4 w-4 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 border-none shadow-none bg-transparent" align="start" side="bottom">
                      <Calendar
                        mode="single"
                        selected={editFormData.conference_date ? new Date(editFormData.conference_date) : undefined}
                        onSelect={(date) => {
                          setEditFormData({ ...editFormData, conference_date: date ? format(date, "yyyy-MM-dd") : "" });
                          setEditConferenceDateOpen(false);
                        }}
                        initialFocus
                        className="bg-[#FAF7F2] border-2 border-[#EAD8C0]/50 rounded-2xl scale-90 origin-top-left shadow-xl"
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
              )}
              <div className="space-y-2">
                <Label className="text-[#8B735B] font-bold">Link to Paper</Label>
                <Input
                  placeholder="https://..."
                  className="rounded-xl border-[#EAD8C0]/40 bg-white focus:border-[#EAD8C0] focus:ring-1 focus:ring-[#EAD8C0]"
                  value={editFormData.link_to_paper}
                  onChange={(e) => setEditFormData({ ...editFormData, link_to_paper: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[#8B735B] font-bold">
                  Publisher{isEditPublisherRequired && <span className="text-red-500 ml-0.5">*</span>}
                </Label>
                <Select
                  value={editFormData.publisher}
                  onValueChange={(value) => {
                    const selected = publishers.find(p => p.publisher_name === value);
                    setEditFormData({ ...editFormData, publisher: value });
                    if (selected) handlePublisherSelect(selected.id);
                  }}
                >
                  <SelectTrigger className="rounded-xl border-[#EAD8C0]/40 bg-white focus:ring-[#EAD8C0]">
                    <SelectValue placeholder="Select publisher" />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-[#EAD8C0]">
                    {publishers.map((p) => (
                      <SelectItem key={p.id} value={p.publisher_name} className="focus:bg-[#8B735B] focus:text-white text-[#8B735B] cursor-pointer">
                        {p.publisher_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Logo preview — predefined publisher */}
                {editFormData.publisher && !showOtherFields && (
                  <div className="mt-2 flex items-center gap-3 min-h-[48px]">
                    {isLogoLoading ? (
                      <div className="flex items-center gap-2 text-[#8B735B]/60 text-xs">
                        <Loader2 className="w-4 h-4 animate-spin" /> Fetching logo…
                      </div>
                    ) : logoPreviewUrl ? (
                      <img src={logoPreviewUrl} alt="Publisher logo" className="h-12 w-auto object-contain rounded-lg border border-[#EAD8C0]/40 p-1 bg-white" />
                    ) : (
                      <div className="text-xs text-[#8B735B]/50 italic">No logo available</div>
                    )}
                    {logoError && <span className="text-xs text-red-500">{logoError}</span>}
                  </div>
                )}

                {/* Other — custom name + upload */}
                {showOtherFields && (
                  <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-300 pt-2">
                    <div className="space-y-1">
                      <Label className="text-[#8B735B] font-bold text-sm">Publisher Name *</Label>
                      <Input
                        placeholder="e.g. Elsevier"
                        className="rounded-xl border-[#EAD8C0]/40 bg-white focus:border-[#EAD8C0] focus:ring-1 focus:ring-[#EAD8C0]"
                        value={customPublisher}
                        onChange={(e) => setCustomPublisher(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[#8B735B] font-bold text-sm">Upload Logo *</Label>
                      <div
                        onClick={() => editFileInputRef.current?.click()}
                        className={cn(
                          "border-2 border-dashed border-[#EAD8C0] rounded-2xl p-6 flex flex-col items-center justify-center bg-white/50 hover:bg-white hover:border-teal-600/50 transition-all cursor-pointer group min-h-[120px]",
                          isLogoLoading && "opacity-50 cursor-not-allowed"
                        )}
                      >
                        {isLogoLoading ? (
                          <div className="flex flex-col items-center gap-2">
                            <Loader2 className="w-7 h-7 animate-spin text-[#8B735B]" />
                            <p className="text-xs font-medium text-[#8B735B]">Uploading logo…</p>
                          </div>
                        ) : logoPreviewUrl ? (
                          <img src={logoPreviewUrl} alt="Logo" className="h-14 w-auto object-contain rounded-lg" />
                        ) : (
                          <>
                            <Upload className="w-5 h-5 text-[#8B735B] mb-1" />
                            <p className="text-xs font-bold text-[#8B735B]">Click to upload logo</p>
                          </>
                        )}
                        <input
                          ref={editFileInputRef}
                          type="file"
                          className="hidden"
                          accept="image/*"
                          disabled={isLogoLoading}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            setCustomLogoFile(file);
                            handleCustomLogoUpload(file);
                            e.target.value = "";
                          }}
                        />
                      </div>
                      {logoError && <p className="text-xs text-red-500 mt-1">{logoError}</p>}
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-[#8B735B] font-bold">Published Date</Label>
                <Popover open={editPublishedDateOpen} onOpenChange={setEditPublishedDateOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant={"outline"}
                      className={cn(
                        "w-full rounded-xl border-[#EAD8C0]/40 bg-white px-3 py-2 text-sm font-normal justify-between text-left h-10",
                        !editFormData.published_date && "text-muted-foreground"
                      )}
                    >
                      {editFormData.published_date ? format(new Date(editFormData.published_date), "do MMMM yyyy") : <span>Pick a date</span>}
                      <CalendarIcon className="ml-2 h-4 w-4 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 border-none shadow-none bg-transparent" align="start" side="bottom">
                    <Calendar
                      mode="single"
                      selected={editFormData.published_date ? new Date(editFormData.published_date) : undefined}
                      onSelect={(date) => {
                        setEditFormData({ ...editFormData, published_date: date ? format(date, "yyyy-MM-dd") : "" });
                        setEditPublishedDateOpen(false);
                      }}
                      disabled={disableFutureDates}
                      initialFocus
                      className="bg-[#FAF7F2] border-2 border-[#EAD8C0]/50 rounded-2xl scale-90 origin-top-left shadow-xl"
                      classNames={{
                        day_selected: "!bg-[#EAD8C0] !text-[#8B735B] hover:!bg-[#d4bc9a] focus:!bg-[#EAD8C0]",
                        day_today: "bg-white text-[#8B735B] font-bold border border-[#EAD8C0]",
                        day: "hover:!bg-[#EAD8C0]/20 rounded-md transition-colors",
                        day_disabled: "opacity-30 cursor-not-allowed hover:!bg-transparent",
                        head_cell: "text-[#8B735B] font-bold w-7",
                        cell: "h-7 w-7 text-center text-[11px] p-0 relative [&:has([aria-selected])]:!bg-transparent focus-within:relative focus-within:z-20",
                      }}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[#8B735B] font-bold">Department</Label>
                  <Input
                    placeholder="Department"
                    className="rounded-xl border-[#EAD8C0]/40 bg-white focus:border-[#EAD8C0] focus:ring-1 focus:ring-[#EAD8C0]"
                    value={editFormData.department}
                    onChange={(e) => setEditFormData({ ...editFormData, department: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[#8B735B] font-bold">Institute</Label>
                  <Input
                    placeholder="Institute name"
                    className="rounded-xl border-[#EAD8C0]/40 bg-white focus:border-[#EAD8C0] focus:ring-1 focus:ring-[#EAD8C0]"
                    value={editFormData.institute}
                    onChange={(e) => setEditFormData({ ...editFormData, institute: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-[#8B735B] font-bold">Category</Label>
                <Input
                  placeholder="e.g., Indexed, SRL"
                  className="rounded-xl border-[#EAD8C0]/40 bg-white focus:border-[#EAD8C0] focus:ring-1 focus:ring-[#EAD8C0]"
                  value={editFormData.category}
                  onChange={(e) => setEditFormData({ ...editFormData, category: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[#8B735B] font-bold">Description</Label>
                <Textarea
                  placeholder="Brief description"
                  className="rounded-xl resize-none border-[#EAD8C0]/40 bg-white focus:border-[#EAD8C0] focus:ring-1 focus:ring-[#EAD8C0]"
                  rows={3}
                  value={editFormData.description}
                  onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <Button
                  variant="outline"
                  className="rounded-xl border-[#EAD8C0] text-[#8B735B] hover:bg-[#EAD8C0]/20"
                  onClick={() => setEditOpen(false)}
                  disabled={editSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  className="rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-bold"
                  onClick={handleUpdatePublication}
                  disabled={editSubmitting}
                >
                  {editSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Update Publication
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
