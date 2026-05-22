import { useEffect, useMemo, useState } from "react";
import { API_BASE_URL } from "@/config/apiConfig";
import { Loader2, Search, Pencil, FileText, Folder, Trophy, Check, ArrowLeft, Users } from "lucide-react";
import BatchTabs from "@/components/BatchTabs";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ConfirmProvider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import StudentAvatar from "@/components/StudentAvatar";
import ImageUpload from "@/components/ImageUpload";
import CertificateUpload, { type Certification } from "@/components/CertificateUpload";
import { adminAPI, parseList } from "@/lib/adminApi";
import { getStoredUser } from "@/lib/auth";

type MemberRecord = {
  enrollment_no: string;
  student_name: string;
  email?: string;
  department?: string;
  member_type?: string;
  profile_image?: string;
  batch?: string;
  cv_completion?: number;
  hacks?: number;
  papers?: number;
  ongoing?: number;
  verified?: boolean;
};




type ResearchPaper = {
  link: string;
  title: string;
  status: "ongoing" | "completed" | "published";
};

type Patent = {
  patent_id?: number;
  patent_title: string;
  application_date: string;
  application_status: "Filed" | "Under Review" | "Published" | "Granted" | "Rejected";
  application_number: string;
};

type CVFormData = {
  // identity
  student_name: string;
  linkedin_id: string;
  batch: string;
  department: string;
  institute: string;
  organization: string;
  reflection: string;
  profile_image: string;
  // array fields (one item per line in textarea)
  research_areas: string;
  research_work: string;
  hackathons: string;
  research_papers: ResearchPaper[]; // Changed to JSON array format
  leadership: string;
  awards: string;
  certifications: Certification[]; // Now structured: [{name, url}]
  additional_achievements: string;
  internships: string;
  branch: string; // Added branch field
  patents: Patent[]; // Added patents array
};

const emptyFormData = (): CVFormData => ({
  student_name: "",
  linkedin_id: "",
  batch: "",
  department: "",
  institute: "",
  organization: "",
  reflection: "",
  profile_image: "",
  research_areas: "",
  research_work: "",
  hackathons: "",
  research_papers: [],
  leadership: "",
  awards: "",
  certifications: [], // structured array
  additional_achievements: "",
  internships: "",
  branch: "",
  patents: [],
});

function ResearchPaperDeleteButton({ idx, formData, setFormData }: { idx: number; formData: CVFormData; setFormData: (d: CVFormData) => void }) {
  const confirm = useConfirm();
  return (
    <Button
      variant="ghost"
      size="sm"
      className="text-red-500 hover:bg-red-50"
      onClick={async () => {
        const ok = await confirm({ title: "Delete research paper", description: "Remove this research paper from the CV?" });
        if (!ok) return;
        const updated = formData.research_papers.filter((_, i) => i !== idx);
        setFormData({ ...formData, research_papers: updated });
      }}
    >
      Delete
    </Button>
  );
}

function PatentDeleteButton({ idx, formData, setFormData }: { idx: number; formData: CVFormData; setFormData: (d: CVFormData) => void }) {
  const confirm = useConfirm();
  return (
    <Button
      variant="ghost"
      size="sm"
      className="w-full text-red-500 hover:bg-red-50"
      onClick={async () => {
        const ok = await confirm({ title: "Delete patent", description: "Remove this patent from the CV?" });
        if (!ok) return;
        const updated = formData.patents.filter((_, i) => i !== idx);
        setFormData({ ...formData, patents: updated });
      }}
    >
      Delete Patent
    </Button>
  );
}

// Convert a string[] from the API to newline-separated textarea string
const arrToText = (arr: unknown): string =>
  Array.isArray(arr) ? arr.join("\n") : "";

// Convert a textarea string back to a string[]
const textToArr = (s: string): string[] =>
  s.split("\n").map((l) => l.trim()).filter(Boolean);

// Parse research papers from API (could be array of objects or array of strings)
const parseResearchPapers = (data: unknown): ResearchPaper[] => {
  if (!Array.isArray(data)) return [];
  return data
    .map((item) => {
      if (typeof item === "object" && item !== null && "title" in item) {
        return {
          title: (item as any).title || "",
          link: (item as any).link || "",
          status: (item as any).status || "completed",
        };
      }
      return null;
    })
    .filter(Boolean) as ResearchPaper[];
};

// Parse patents from API
const parsePatents = (data: unknown): Patent[] => {
  if (!Array.isArray(data)) return [];
  return data
    .map((item) => {
      if (typeof item === "object" && item !== null) {
        return {
          patent_id: (item as any).patent_id,
          patent_title: (item as any).patent_title || "",
          application_date: (item as any).application_date || "",
          application_status: (item as any).application_status || "Filed",
          application_number: (item as any).application_number || "",
        };
      }
      return null;
    })
    .filter(Boolean) as Patent[];
};

// Parse certifications safely — handles null, old string arrays, and new {name, url} objects.
const parseCertifications = (data: unknown): Certification[] => {
  if (!data) return [];
  let arr: unknown[];
  if (Array.isArray(data)) {
    arr = data;
  } else if (typeof data === "string") {
    const t = data.trim();
    if (!t || t === "[]" || t === "null") return [];
    try {
      const parsed = JSON.parse(t);
      arr = Array.isArray(parsed) ? parsed : [];
    } catch {
      // Comma-separated fallback (really old data)
      return t
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => ({ name: s, url: "" }));
    }
  } else {
    return [];
  }
  return arr
    .map((item) => {
      if (typeof item === "string" && item.trim())
        return { name: item.trim(), url: "" };
      if (
        typeof item === "object" &&
        item !== null &&
        ((item as any).name || (item as any).url)
      ) {
        return {
          name: String((item as any).name || ""),
          url: String((item as any).url || ""),
        };
      }
      return null;
    })
    .filter(Boolean) as Certification[];
};

const TextSection = ({ label, field, placeholder, hint, formData, setFormData, disabled }: { label: string; field: keyof CVFormData; placeholder?: string; hint?: string; formData: CVFormData; setFormData: React.Dispatch<React.SetStateAction<CVFormData>>; disabled: boolean }) => (
  <div className="space-y-2">
    <div className="flex items-center justify-between">
      <h3 className="text-base font-bold text-[#1a1810]">{label}</h3>
      {hint && <span className="text-[11px] text-muted-foreground italic">{hint}</span>}
    </div>
    <Textarea
      value={formData[field] as string}
      onChange={(e) => setFormData((prev) => ({ ...prev, [field]: e.target.value }))}
      placeholder={placeholder}
      className="bg-white border-[#D4C9B6] rounded-xl min-h-[80px] text-sm"
      disabled={disabled}
    />
  </div>
);

export default function MemberCV() {
  const [members, setMembers] = useState<MemberRecord[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedEnrollment, setSelectedEnrollment] = useState("");
  const [formData, setFormData] = useState<CVFormData>(emptyFormData());

  // Grid states
  const [showGrid, setShowGrid] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [search, setSearch] = useState("");
  const [batchFilter, setBatchFilter] = useState("");
  const [page, setPage] = useState(1);


  const { toast } = useToast();
  const currentUser = useMemo(() => getStoredUser(), []);
  const isAdmin = currentUser?.role === "admin";
  const currentEmail = String(currentUser?.email || "").trim().toLowerCase();
  const currentEnrollment = String(currentUser?.enrollmentNo || "").trim().toUpperCase();

  const selectedMember = useMemo(
    () => members.find((member) => member.enrollment_no === selectedEnrollment) || null,
    [members, selectedEnrollment]
  );

  useEffect(() => {
    if (isAdmin) return;

    if (!currentEnrollment && !currentEmail) {
      if (selectedEnrollment) setSelectedEnrollment("");
      return;
    }
  }, [isAdmin, currentEmail, currentEnrollment, selectedEnrollment]);

  useEffect(() => {
    const fetchMembers = async () => {
      try {
        setLoadingMembers(true);
        const res = await adminAPI.getStudents();

        const allCVs = isAdmin
          ? await adminAPI.getAllMemberCVs().catch(() => [])
          : [];

        // Build enrollment_no → computed CV stats map (admin grid only)
        const cvMap = new Map<string, { ongoing: number; hacks: number; papers: number }>();
        (allCVs as any[]).forEach((cv: any) => {
          if (!cv?.enrollment_no) return;
          const rw: string[] = Array.isArray(cv.research_work) ? cv.research_work : [];
          cvMap.set(cv.enrollment_no, {
            ongoing: rw.filter((w: string) => w.trim().toLowerCase().startsWith("ongoing")).length,
            hacks: Array.isArray(cv.hackathons) ? cv.hackathons.length : 0,
            papers: Array.isArray(cv.research_papers) ? cv.research_papers.length : 0,
          });
        });

        // getStudents() may return {success, data:[...]} or an array directly
        const fetchedMembers = parseList(res)
          .filter((row: any) => row.enrollment_no && String(row.member_type || "member").toLowerCase() !== "admin")
          .map((row: any) => {
            const cv = cvMap.get(row.enrollment_no);
            return {
              ...row,
              hacks: cv?.hacks ?? row.execution_hacks ?? 0,
              papers: cv?.papers ?? row.execution_papers ?? 0,
              ongoing: cv?.ongoing ?? row.execution_ongoing ?? 0,
              verified: row.verified || false,
            };
          });

        if (!currentUser) {
          setMembers([]);
          setSelectedEnrollment("");
          return;
        }

        if (isAdmin) {
          setMembers(fetchedMembers);
          setSelectedEnrollment("");
          setShowGrid(true);
        } else {
          const ownProfile = fetchedMembers.filter((row: any) => {
            const rowEnrollment = String(row.enrollment_no || "").trim().toUpperCase();
            const rowEmail = String(row.email || "").trim().toLowerCase();
            return (
              (currentEnrollment && rowEnrollment === currentEnrollment) ||
              (currentEmail && rowEmail === currentEmail)
            );
          });
          setMembers(ownProfile);
          setSelectedEnrollment(ownProfile[0]?.enrollment_no || "");
          setShowGrid(false);
        }
      } catch (error: any) {
        toast({
          variant: "destructive",
          title: "Unable to load members",
          description: error.message || "Please check database connection.",
        });
      } finally {
        setLoadingMembers(false);
      }
    };
    fetchMembers();
  }, [currentUser, isAdmin, refreshKey]);

  useEffect(() => {
    const es = new EventSource(`${API_BASE_URL}/api/events`);
    es.addEventListener("student_changed", () => setRefreshKey((k) => k + 1));
    es.onerror = () => {};
    return () => es.close();
  }, []);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!selectedEnrollment) {
        setFormData(emptyFormData());
        return;
      }
      try {
        setLoadingProfile(true);
        // getMemberCVByEnrollment now returns the unwrapped data object (or null)
        const d = await adminAPI.getMemberCVByEnrollment(selectedEnrollment);
        if (!d) {
          setFormData(emptyFormData());
          return;
        }
        setFormData({
          student_name: String(d.student_name || ""),
          linkedin_id: String(d.linkedin_id || ""),
          batch: String(d.batch || selectedMember?.batch || ""),
          department: String(d.department || ""),
          institute: String(d.institute || ""),
          organization: String(d.organization || ""),
          reflection: String(d.reflection || ""),
          profile_image: String(d.profile_image || d.photo_url || ""),
          research_areas: arrToText(d.research_areas),
          research_work: arrToText(d.research_work),
          hackathons: arrToText(d.hackathons),
          research_papers: parseResearchPapers(d.research_papers),
          leadership: arrToText(d.leadership),
          awards: arrToText(d.awards),
          certifications: parseCertifications(d.certifications),
          additional_achievements: arrToText(d.additional_achievements),
          internships: arrToText(d.internships),
          branch: String(d.branch || ""),
          patents: parsePatents(d.patents),
        });
      } catch (error: any) {
        toast({
          variant: "destructive",
          title: "Unable to load profile",
          description: error.message || "Please try again.",
        });
      } finally {
        setLoadingProfile(false);
      }
    };
    fetchProfile();
  }, [selectedEnrollment, selectedMember?.batch]);

  const canEditSelected = !!selectedEnrollment && (!!isAdmin || (currentUser?.enrollmentNo && currentUser.enrollmentNo === selectedEnrollment));

  const handleSave = async () => {
    if (!selectedMember || !selectedEnrollment)
      return toast({ variant: "destructive", title: "No profile selected", description: "Please select a member profile first." });
    if (!canEditSelected)
      return toast({ variant: "destructive", title: "Permission denied", description: "You can edit only your own profile." });
    try {
      setSaving(true);
      const payload = {
        enrollment_no: selectedEnrollment,
        student_name: formData.student_name || selectedMember.student_name,
        linkedin_id: formData.linkedin_id,
        batch: formData.batch || selectedMember.batch || "",
        department: formData.department,
        institute: formData.institute,
        organization: formData.organization,
        reflection: formData.reflection,
        profile_image: formData.profile_image,
        branch: formData.branch,
        research_areas: textToArr(formData.research_areas),
        research_work: textToArr(formData.research_work),
        hackathons: textToArr(formData.hackathons),
        research_papers: formData.research_papers, // Now sending as JSON array
        leadership: textToArr(formData.leadership),
        awards: textToArr(formData.awards),
        certifications: formData.certifications, // already [{name,url}] array
        additional_achievements: textToArr(formData.additional_achievements),
        internships: textToArr(formData.internships),
        patents: formData.patents, // Now sending as JSON array
      };
      await adminAPI.updateMemberCV(payload);
      toast({ title: "Profile saved", description: `CV updated for ${selectedMember.student_name}.` });
      window.scrollTo({ top: 0, behavior: "smooth" });
      if (isAdmin) {
        setSelectedEnrollment("");
        setShowGrid(true);
      }
    } catch (error: any) {
      toast({ variant: "destructive", title: "Save failed", description: error.message || "Could not save profile." });
    } finally {
      setSaving(false);
    }
  };

  // Grid Methods
  const PG = 12;

  const sortedMembers = useMemo(() => [...members].sort((a, b) => { 
    const isMaster = (s: MemberRecord) => (s.batch?.toLowerCase().includes("master")) || (s.enrollment_no?.toUpperCase().includes("ME")) || (s.student_name?.toLowerCase().includes("ghetiya poojan")); 
    const aM = isMaster(a) ? 1 : 0, bM = isMaster(b) ? 1 : 0; 
    if (aM !== bM) return aM - bM; 
    const x = (a.batch || "").toUpperCase(), y = (b.batch || "").toUpperCase(); 
    return y < x ? -1 : y > x ? 1 : (a.student_name || "").localeCompare(b.student_name || ""); 
  }), [members]);

  const batches = useMemo(() => {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const m of sortedMembers) {
      const b = (m.batch || "").trim();
      if (b && !seen.has(b)) { seen.add(b); result.push(b); }
    }
    return result.sort((a, b) => b.localeCompare(a));
  }, [sortedMembers]);

  const batchOptions = useMemo(() => {
    const fixedOptions = [
      "2024",
      "2025",
      "2026",
      "2027",
      "2028",
      "2029",
      "2030",
    ];

    const current = [selectedMember?.batch, formData.batch, ...batches]
      .map((value) => (value || "").trim())
      .filter(Boolean);

    return Array.from(new Set([...fixedOptions, ...current]));
  }, [batches, formData.batch, selectedMember?.batch]);

  const filteredMembers = useMemo(() => {
    const q = search.toLowerCase();
    return sortedMembers.filter((m) => {
      const matchSearch = !q || [m.student_name, m.enrollment_no, m.department, m.batch].some(v => v?.toLowerCase().includes(q));
      const matchBatch = !batchFilter || (m.batch || "").trim() === batchFilter;
      return matchSearch && matchBatch;
    });
  }, [sortedMembers, search, batchFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredMembers.length / PG));
  const pagedMembers = filteredMembers.slice((page - 1) * PG, page * PG);

  useEffect(() => { setPage(1); }, [search, batchFilter]);
  useEffect(() => {
    if (batchFilter && !batches.includes(batchFilter)) setBatchFilter("");
  }, [batches, batchFilter]);

  // Render Grid View
  if (isAdmin && showGrid) {
    return (
      <div className="flex flex-col gap-6 max-w-[1400px] mx-auto min-h-[calc(100vh-100px)] relative pb-24">
        <div className="w-full space-y-6">
          <div className="glass-card p-4 rounded-2xl flex flex-col sm:flex-row items-center gap-4 justify-between border border-[#D4C9B6]/50 bg-[#EAE1D2]/30">
            <div className="relative w-full sm:w-[350px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Global Search Researchers..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 rounded-xl border-[#D4C9B6] bg-white/60 focus:bg-white transition-colors" />
            </div>
          </div>

          <BatchTabs batches={batches} selected={batchFilter} onSelect={(v) => { setBatchFilter(v); setPage(1); }} />

          {loadingMembers ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : filteredMembers.length === 0 ? (
            <div className="text-center py-20 text-muted-foreground bg-white/40 rounded-2xl border border-dashed border-[#D4C9B6]">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-20" />
              No researchers found matching your criteria.
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
                <AnimatePresence mode="popLayout">
                  {pagedMembers.map((member, i) => (
                    <motion.div layout initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} transition={{ delay: i * 0.05 }} key={member.enrollment_no} className="group relative">
                      <div className="relative overflow-hidden rounded-[20px] bg-white border transition-all duration-300 border-[#D4C9B6] shadow-sm hover:shadow-[0_8px_30px_rgb(0,0,0,0.06)] hover:border-primary/40">
                        <div className="h-16 bg-gradient-to-r from-[#EAE1D2] to-[#D4C9B6]/30 w-full absolute top-0 left-0" />
                        <div className="p-5 pt-8 relative z-0 flex flex-col items-center">
                          <StudentAvatar name={member.student_name} photoUrl={member.profile_image} enrollmentNo={member.enrollment_no} className="w-20 h-20 border-4 border-white shadow-sm mb-3" />
                          <h3 className="font-bold text-[#1a1810] text-center line-clamp-1">{member.student_name}</h3>
                          <p className="text-xs text-muted-foreground font-mono mt-0.5">{member.enrollment_no}</p>
                          {(member.batch || "").trim() && (
                            <p className="text-[10px] text-primary/70 font-medium mt-0.5">Batch {(member.batch || "").trim()}</p>
                          )}
                          <div className="grid grid-cols-3 w-full gap-1 sm:gap-2 mt-4 sm:mt-5 py-3 border-y border-dashed border-[#D4C9B6]">
                            <div className="text-center"><p className="text-base sm:text-lg font-bold text-primary leading-none">{member.ongoing}</p><p className="text-[9px] sm:text-[10px] text-muted-foreground uppercase tracking-wide mt-1">Ongoing</p></div>
                            <div className="text-center border-l border-dashed border-[#D4C9B6]"><p className="text-base sm:text-lg font-bold text-primary leading-none">{member.hacks}</p><p className="text-[9px] sm:text-[10px] text-muted-foreground uppercase tracking-wide mt-1">Hacks</p></div>
                            <div className="text-center border-l border-dashed border-[#D4C9B6]"><p className="text-base sm:text-lg font-bold text-primary leading-none">{member.papers}</p><p className="text-[9px] sm:text-[10px] text-muted-foreground uppercase tracking-wide mt-1">Papers</p></div>
                          </div>
                          <div className="w-full mt-4">
                            <Button variant="default" className="w-full rounded-xl text-xs font-semibold bg-primary hover:bg-primary/90 text-white shadow-sm h-9" onClick={() => { setSelectedEnrollment(member.enrollment_no); setShowGrid(false); }}>
                              <Pencil className="w-3.5 h-3.5 mr-1.5" /> Edit Profile
                            </Button>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-3 pt-2">
                  <Button variant="outline" size="sm" className="rounded-lg border-[#D4C9B6]" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>Previous</Button>
                  <span className="text-sm text-muted-foreground font-medium">Page {page} of {totalPages}</span>
                  <Button variant="outline" size="sm" className="rounded-lg border-[#D4C9B6]" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>Next</Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  // Render Edit Suite
  return (
    <div className="max-w-[1200px] mx-auto min-h-[calc(100vh-100px)] relative pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#1a1810] tracking-tight">Edit Researcher Profile</h1>
          {selectedMember && (
            <p className="text-muted-foreground mt-1 text-sm font-medium">Update the details for {selectedMember.student_name} ({selectedMember.enrollment_no})</p>
          )}
        </div>
        {isAdmin && (
          <Button variant="ghost" className="rounded-xl hover:bg-black/5 shrink-0" onClick={() => { setSelectedEnrollment(""); setShowGrid(true); }}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Grid
          </Button>
        )}
      </div>

      {!selectedEnrollment ? (
        <div className="glass-card rounded-2xl p-5 sm:p-8 text-center text-muted-foreground">No member profile available.</div>
      ) : loadingProfile ? (
        <div className="glass-card rounded-2xl p-5 sm:p-8 text-center text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin inline-block mr-2" /> Loading profile...</div>
      ) : (
        <div className="space-y-6 pb-24">
          {/* Main Form Card */}
          <div className="bg-[#F3F0E8] rounded-[24px] p-6 sm:p-10 border border-[#D4C9B6] shadow-sm space-y-8">

            {/* Profile Header Card */}
            <div className="flex flex-col sm:flex-row gap-6 items-start bg-[#faf8f5] p-5 sm:p-6 rounded-2xl border border-[#D4C9B6]">
              <div className="w-full sm:w-auto flex flex-col items-center justify-center flex-shrink-0">
                <ImageUpload
                  currentImage={formData.profile_image}
                  onImageUpload={(url) => setFormData(p => ({ ...p, profile_image: url }))}
                  label="Profile Photo"
                  maxSize={10}
                  section="student"
                  mediaType="image"
                  variant="avatar"
                />
              </div>
              
              <div className="w-full space-y-4 flex-grow pt-1">
                <div className="space-y-1.5">
                  <Label style={{ color: "#1a1810", fontSize: "0.85rem", fontWeight: 700 }}>Student Name *</Label>
                  <Input type="text" placeholder="Full name" className="rounded-xl border-[#D4C9B6] bg-white h-11 text-[#1a1810]" value={formData.student_name || (selectedMember?.student_name || "")} onChange={e => setFormData(p => ({ ...p, student_name: e.target.value }))} disabled={!canEditSelected} />
                </div>
                <div className="space-y-1.5">
                  <Label style={{ color: "#1a1810", fontSize: "0.85rem", fontWeight: 700 }}>Enrollment No *</Label>
                  <Input type="text" className="rounded-xl border-[#D4C9B6] bg-slate-50 h-11 font-mono text-sm text-[#1a1810] cursor-not-allowed opacity-80" value={selectedEnrollment} disabled={true} />
                </div>
              </div>
            </div>

            {/* Identity row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-xs font-bold text-[#1a1810] uppercase tracking-wide">LinkedIn URL</Label>
                <Input value={formData.linkedin_id} onChange={(e) => setFormData(p => ({ ...p, linkedin_id: e.target.value }))} placeholder="https://linkedin.com/in/..." className="bg-white border-[#D4C9B6] rounded-xl" disabled={!canEditSelected} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-bold text-[#1a1810] uppercase tracking-wide">Branch</Label>
                <Input value={formData.branch} onChange={(e) => setFormData(p => ({ ...p, branch: e.target.value }))} placeholder="Computer Science" className="bg-white border-[#D4C9B6] rounded-xl" disabled={!canEditSelected} />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="space-y-1">
                <Label className="text-xs font-bold text-[#1a1810] uppercase tracking-wide">Batch</Label>
                <Select value={formData.batch} onValueChange={(value) => setFormData((p) => ({ ...p, batch: value }))} disabled={!canEditSelected}>
                  <SelectTrigger className="bg-white border-[#D4C9B6] rounded-xl">
                    <SelectValue placeholder="Select batch" />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-[#D4C9B6]">
                    {batchOptions.map((batch) => (
                      <SelectItem key={batch} value={batch}>
                        Batch {batch}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-bold text-[#1a1810] uppercase tracking-wide">Dept</Label>
                <Input value={formData.department} onChange={(e) => setFormData(p => ({ ...p, department: e.target.value }))} placeholder="CE" className="bg-white border-[#D4C9B6] rounded-xl" disabled={!canEditSelected} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-bold text-[#1a1810] uppercase tracking-wide">Institute</Label>
                <Input value={formData.institute} onChange={(e) => setFormData(p => ({ ...p, institute: e.target.value }))} placeholder="LDRP-ITR" className="bg-white border-[#D4C9B6] rounded-xl" disabled={!canEditSelected} />
              </div>
            </div>

            {/* Reflection */}
            <div className="space-y-2">
              <h3 className="text-base font-bold text-[#1a1810]">✍️ Personal Reflection</h3>
              <Textarea value={formData.reflection} onChange={(e) => setFormData(p => ({ ...p, reflection: e.target.value }))} placeholder="Research has taught me..." className="bg-white border-[#D4C9B6] rounded-xl min-h-[90px] text-sm italic" disabled={!canEditSelected} />
            </div>

            <div className="border-t border-dashed border-[#D4C9B6]" />

            <TextSection formData={formData} setFormData={setFormData} disabled={!canEditSelected} label="🔬 Research Areas" field="research_areas" placeholder="Cloud Computing Optimization&#10;Microservices Architecture" hint="One per line" />
            <TextSection formData={formData} setFormData={setFormData} disabled={!canEditSelected} label="📁 Research Work" field="research_work" placeholder="Ongoing Research Paper: NLP Study&#10;Completed: Smart Parking System" hint="Prefix with 'Ongoing' for badge · one per line" />
            
            {/* Research Papers Section with JSON format */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-[#1a1810]">📄 Research Papers Published</h3>
                <span className="text-[11px] text-muted-foreground italic">Title, Link, Status</span>
              </div>
              <div className="space-y-3 bg-white/50 p-4 rounded-xl border border-[#D4C9B6]">
                {formData.research_papers.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">No research papers added yet</p>
                ) : (
                  formData.research_papers.map((paper, idx) => (
                    <div key={idx} className="p-4 bg-white border border-[#D4C9B6] rounded-lg space-y-2">
                      <Input
                        placeholder="Paper Title"
                        value={paper.title}
                        onChange={(e) => {
                          const updated = [...formData.research_papers];
                          updated[idx].title = e.target.value;
                          setFormData({ ...formData, research_papers: updated });
                        }}
                        className="bg-white border-[#D4C9B6] rounded-xl text-sm"
                        disabled={!canEditSelected}
                      />
                      <Input
                        placeholder="Paper Link (https://...)"
                        value={paper.link}
                        onChange={(e) => {
                          const updated = [...formData.research_papers];
                          updated[idx].link = e.target.value;
                          setFormData({ ...formData, research_papers: updated });
                        }}
                        className="bg-white border-[#D4C9B6] rounded-xl text-sm"
                        disabled={!canEditSelected}
                      />
                      <div className="flex gap-2">
                        <select
                          value={paper.status}
                          onChange={(e) => {
                            const updated = [...formData.research_papers];
                            updated[idx].status = e.target.value as any;
                            setFormData({ ...formData, research_papers: updated });
                          }}
                          className="flex-1 px-3 py-2 border border-[#D4C9B6] rounded-xl text-sm bg-white"
                          disabled={!canEditSelected}
                        >
                          <option value="ongoing">Ongoing</option>
                          <option value="completed">Completed</option>
                          <option value="published">Published</option>
                        </select>
                        {canEditSelected && (
                          <ResearchPaperDeleteButton idx={idx} formData={formData} setFormData={setFormData} />
                        )}
                      </div>
                    </div>
                  ))
                )}
                {canEditSelected && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full border-[#D4C9B6] text-[#1a1810]"
                    onClick={() => {
                      setFormData({
                        ...formData,
                        research_papers: [...formData.research_papers, { title: "", link: "", status: "ongoing" }],
                      });
                    }}
                  >
                    + Add Research Paper
                  </Button>
                )}
              </div>
            </div>

            <TextSection formData={formData} setFormData={setFormData} disabled={!canEditSelected} label="🏆 Hackathons" field="hackathons" placeholder="Smart India Hackathon 2024 - Runner Up" hint="One per line" />

            <div className="border-t border-dashed border-[#D4C9B6]" />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <TextSection formData={formData} setFormData={setFormData} disabled={!canEditSelected} label="🏅 Leadership" field="leadership" placeholder="Lab Coordinator, SRL 2024" hint="One per line" />
              <TextSection formData={formData} setFormData={setFormData} disabled={!canEditSelected} label="🎖️ Awards" field="awards" placeholder="Best Presenter Award" hint="One per line" />
            </div>
            <CertificateUpload
              key={selectedEnrollment}
              certifications={formData.certifications}
              onChange={(certs) => setFormData((p) => ({ ...p, certifications: certs }))}
              disabled={!canEditSelected}
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <TextSection formData={formData} setFormData={setFormData} disabled={!canEditSelected} label="💼 Internships" field="internships" placeholder="Software Intern, XYZ Corp, Summer 2024" hint="One per line" />
              <TextSection formData={formData} setFormData={setFormData} disabled={!canEditSelected} label="⭐ Additional Achievements" field="additional_achievements" placeholder="Published article in campus newsletter" hint="One per line" />
            </div>

            <div className="border-t border-dashed border-[#D4C9B6]" />

            {/* Patents Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-[#1a1810]">⚖️ Patents</h3>
                <span className="text-[11px] text-muted-foreground italic">Title, Application Date, Status</span>
              </div>
              <div className="space-y-3 bg-white/50 p-4 rounded-xl border border-[#D4C9B6]">
                {formData.patents.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">No patents added yet</p>
                ) : (
                  formData.patents.map((patent, idx) => (
                    <div key={idx} className="p-4 bg-white border border-[#D4C9B6] rounded-lg space-y-2">
                      <Input
                        placeholder="Patent Title"
                        value={patent.patent_title}
                        onChange={(e) => {
                          const updated = [...formData.patents];
                          updated[idx].patent_title = e.target.value;
                          setFormData({ ...formData, patents: updated });
                        }}
                        className="bg-white border-[#D4C9B6] rounded-xl text-sm"
                        disabled={!canEditSelected}
                      />
                      <Input
                        placeholder="Application Number"
                        value={patent.application_number}
                        onChange={(e) => {
                          const updated = [...formData.patents];
                          updated[idx].application_number = e.target.value;
                          setFormData({ ...formData, patents: updated });
                        }}
                        className="bg-white border-[#D4C9B6] rounded-xl text-sm"
                        disabled={!canEditSelected}
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <Input
                          placeholder="Application Date (YYYY-MM-DD)"
                          type="date"
                          value={patent.application_date}
                          onChange={(e) => {
                            const updated = [...formData.patents];
                            updated[idx].application_date = e.target.value;
                            setFormData({ ...formData, patents: updated });
                          }}
                          className="bg-white border-[#D4C9B6] rounded-xl text-sm"
                          disabled={!canEditSelected}
                        />
                        <select
                          value={patent.application_status}
                          onChange={(e) => {
                            const updated = [...formData.patents];
                            updated[idx].application_status = e.target.value as any;
                            setFormData({ ...formData, patents: updated });
                          }}
                          className="px-3 py-2 border border-[#D4C9B6] rounded-xl text-sm bg-white"
                          disabled={!canEditSelected}
                        >
                          <option value="Filed">Filed</option>
                          <option value="Under Review">Under Review</option>
                          <option value="Published">Published</option>
                          <option value="Granted">Granted</option>
                          <option value="Rejected">Rejected</option>
                        </select>
                      </div>
                      {canEditSelected && (
                        <PatentDeleteButton idx={idx} formData={formData} setFormData={setFormData} />
                      )}
                    </div>
                  ))
                )}
                {canEditSelected && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full border-[#D4C9B6] text-[#1a1810]"
                    onClick={() => {
                      setFormData({
                        ...formData,
                        patents: [...formData.patents, { patent_title: "", application_date: "", application_status: "Filed", application_number: "" }],
                      });
                    }}
                  >
                    + Add Patent
                  </Button>
                )}
              </div>
            </div>
          </div>
          
            <div className="bg-[#DAEBE1] rounded-[24px] p-6 sm:p-8 mt-6 border border-[#a8dbc0] shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/40 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none" />
            <h3 className="text-[#21493A] font-bold text-lg mb-6 relative z-10">5. Execution Analytics</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative z-10">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center shrink-0"><Folder className="w-6 h-6 text-[#2A5D4B]" /></div>
                <div>
                  <p className="text-3xl font-bold text-[#21493A]">{formData.research_work.split("\n").filter(l => l.trim().toLowerCase().startsWith("ongoing")).length}</p>
                  <p className="text-sm font-medium text-[#2A5D4B]/80 mt-1">Ongoing Projects</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center shrink-0"><Trophy className="w-6 h-6 text-amber-500" /></div>
                <div>
                  <p className="text-3xl font-bold text-[#21493A]">{formData.hackathons.split("\n").filter(l => l.trim()).length}</p>
                  <p className="text-sm font-medium text-[#2A5D4B]/80 mt-1">Total Hackathons</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center shrink-0"><FileText className="w-6 h-6 text-blue-500" /></div>
                <div>
                  <p className="text-3xl font-bold text-[#21493A]">{formData.research_papers.length}</p>
                  <p className="text-sm font-medium text-[#2A5D4B]/80 mt-1">Research Published</p>
                </div>
              </div>
            </div>
          </div>
          
          {/* Fixed Bottom Action Footer */}
          <div className="fixed bottom-0 left-0 right-0 bg-[#EDE8DE]/90 backdrop-blur-xl border-t border-[#D4C9B6] p-4 flex flex-col sm:flex-row justify-between items-center gap-4 z-50 shadow-[0_-10px_40px_rgba(0,0,0,0.03)] lg:pl-64">
            <div className="w-full sm:w-auto text-center sm:text-left flex items-center gap-4">
              <Button onClick={handleSave} disabled={saving || !canEditSelected} className="bg-[#2A5D4B] hover:bg-[#21493A] text-white rounded-full px-8 py-6 font-semibold shadow-md">
                {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</> : "Save Draft"}
              </Button>
            </div>
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <Button variant="outline" className="flex-1 sm:flex-none border-[#2A5D4B] text-[#2A5D4B] hover:bg-[#2A5D4B]/10 rounded-full px-8 py-6 font-semibold bg-white" onClick={() => { setSelectedEnrollment(""); setShowGrid(true); }}>
                Back
              </Button>
              <Button className="flex-1 sm:flex-none bg-[#2A5D4B] hover:bg-[#21493A] text-white rounded-full px-8 py-6 font-semibold shadow-md" onClick={handleSave} disabled={saving || !canEditSelected}>
                {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Submitting...</> : <>Submit <Check className="w-4 h-4 ml-2" /></>}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
