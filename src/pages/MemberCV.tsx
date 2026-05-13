import { useEffect, useMemo, useState } from "react";
import { Loader2, Search, Pencil, FileText, Award, Folder, Trophy, Edit2, Check, ArrowLeft, ArrowRight, Users } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { useToast } from "@/hooks/use-toast";
import StudentAvatar from "@/components/StudentAvatar";
import ImageUpload from "@/components/ImageUpload";
import { adminAPI, parseList } from "@/lib/adminApi";
import { getStoredUser } from "@/lib/auth";

type MemberRecord = {
  enrollment_no: string;
  student_name: string;
  email?: string;
  department?: string;
  member_type?: string;
  profile_image?: string;
  // Mock properties for UI demonstration
  cv_completion?: number;
  hacks?: number;
  papers?: number;
  ongoing?: number;
  verified?: boolean;
};




type CVFormData = {
  // identity
  student_name: string;
  linkedin_id: string;
  semester: string;
  department: string;
  institute: string;
  organization: string;
  reflection: string;
  profile_image: string;
  // array fields (one item per line in textarea)
  research_areas: string;
  research_work: string;
  hackathons: string;
  research_papers: string;
  leadership: string;
  awards: string;
  certifications: string;
  additional_achievements: string;
  internships: string;
};

const emptyFormData = (): CVFormData => ({
  student_name: "",
  linkedin_id: "",
  semester: "",
  department: "",
  institute: "",
  organization: "",
  reflection: "",
  profile_image: "",
  research_areas: "",
  research_work: "",
  hackathons: "",
  research_papers: "",
  leadership: "",
  awards: "",
  certifications: "",
  additional_achievements: "",
  internships: "",
});

// Convert a string[] from the API to newline-separated textarea string
const arrToText = (arr: unknown): string =>
  Array.isArray(arr) ? arr.join("\n") : "";

// Convert a textarea string back to a string[]
const textToArr = (s: string): string[] =>
  s.split("\n").map((l) => l.trim()).filter(Boolean);


const getBatchString = (member: any) => {
  const name = member.student_name || "";
  if (name.toLowerCase().includes("poojan ghetiya")) return "Batch 2025-2029";
  const enrollmentNo = member.enrollment_no;
  if (!enrollmentNo || enrollmentNo.length < 2) return "Other";
  const prefix = parseInt(enrollmentNo.substring(0, 2), 10);
  if (isNaN(prefix) || prefix < 10 || prefix > 99) return "Other";
  const startYear = 2000 + prefix;
  return `Batch ${startYear}-${startYear + 4}`;
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
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [currentBatchIndex, setCurrentBatchIndex] = useState(0);

  useEffect(() => {
    setCurrentBatchIndex(0);
  }, [search, filter]);

  const { toast } = useToast();
  const currentUser = useMemo(() => getStoredUser(), []);
  const isAdmin = currentUser?.role === "admin";

  const selectedMember = useMemo(
    () => members.find((member) => member.enrollment_no === selectedEnrollment) || null,
    [members, selectedEnrollment]
  );

  useEffect(() => {
    if (isAdmin) return;

    const ownEnrollment = currentUser?.enrollmentNo || "";
    if (!ownEnrollment) {
      if (selectedEnrollment) setSelectedEnrollment("");
      return;
    }

    if (selectedEnrollment !== ownEnrollment) {
      setSelectedEnrollment(ownEnrollment);
    }
  }, [isAdmin, currentUser?.enrollmentNo, selectedEnrollment]);

  useEffect(() => {
    const fetchMembers = async () => {
      try {
        setLoadingMembers(true);
        const [res, allCVs] = await Promise.all([
          adminAPI.getStudents(),
          isAdmin ? adminAPI.getAllMemberCVs().catch(() => []) : Promise.resolve([]),
        ]);

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
          const ownEnrollment = currentUser.enrollmentNo || "";
          const ownProfile = fetchedMembers.filter((row: any) => row.enrollment_no === ownEnrollment);
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
  }, [currentUser, isAdmin]);

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
          semester: d.semester != null ? String(d.semester) : "",
          department: String(d.department || ""),
          institute: String(d.institute || ""),
          organization: String(d.organization || ""),
          reflection: String(d.reflection || ""),
          profile_image: String(d.profile_image || d.photo_url || ""),
          research_areas: arrToText(d.research_areas),
          research_work: arrToText(d.research_work),
          hackathons: arrToText(d.hackathons),
          research_papers: arrToText(d.research_papers),
          leadership: arrToText(d.leadership),
          awards: arrToText(d.awards),
          certifications: arrToText(d.certifications),
          additional_achievements: arrToText(d.additional_achievements),
          internships: arrToText(d.internships),
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
  }, [selectedEnrollment]);

  const canEditSelected = !!selectedEnrollment && (!!isAdmin || (currentUser?.enrollmentNo && currentUser.enrollmentNo === selectedEnrollment));

  const profileCompletion = useMemo(() => {
    const sections = [
      formData.reflection.trim().length > 0,
      formData.research_work.trim().length > 0,
      formData.hackathons.trim().length > 0,
      formData.research_papers.trim().length > 0,
    ];
    const completed = sections.filter(Boolean).length;
    const total = sections.length;
    return { completed, total, percent: Math.round((completed / total) * 100) };
  }, [formData]);

  // Removed inline TextSection

  const handleSave = async () => {
    if (!selectedMember || !selectedEnrollment)
      return toast({ variant: "destructive", title: "No profile selected", description: "Please select a member profile first." });
    if (!canEditSelected)
      return toast({ variant: "destructive", title: "Permission denied", description: "You can edit only your own profile." });
    try {
      setSaving(true);
      const semInt = parseInt(formData.semester, 10);
      const payload = {
        enrollment_no: selectedEnrollment,
        student_name: formData.student_name || selectedMember.student_name,
        linkedin_id: formData.linkedin_id,
        semester: isNaN(semInt) ? undefined : semInt,
        department: formData.department,
        institute: formData.institute,
        organization: formData.organization,
        reflection: formData.reflection,
        profile_image: formData.profile_image,
        research_areas: textToArr(formData.research_areas),
        research_work: textToArr(formData.research_work),
        hackathons: textToArr(formData.hackathons),
        research_papers: textToArr(formData.research_papers),
        leadership: textToArr(formData.leadership),
        awards: textToArr(formData.awards),
        certifications: textToArr(formData.certifications),
        additional_achievements: textToArr(formData.additional_achievements),
        internships: textToArr(formData.internships),
      };
      await adminAPI.updateMemberCV(payload);
      toast({ title: "Profile saved", description: `CV updated for ${selectedMember.student_name}.` });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Save failed", description: error.message || "Could not save profile." });
    } finally {
      setSaving(false);
    }
  };

  // Grid Methods
  const filteredMembers = useMemo(() => {
    return members.filter((m) => {
      const matchSearch = m.student_name?.toLowerCase().includes(search.toLowerCase()) || m.enrollment_no?.toLowerCase().includes(search.toLowerCase());
      if (!matchSearch) return false;
      if (filter === "verified") return m.verified;
      if (filter === "unverified") return !m.verified;
      return true;
    });
  }, [members, search, filter]);

  const groupedMembers = useMemo(() => {
    const groups: Record<string, MemberRecord[]> = {};
    filteredMembers.forEach((m) => {
      const batch = getBatchString(m);
      if (!groups[batch]) groups[batch] = [];
      groups[batch].push(m);
    });

    // Sort members within each batch alphabetically by name
    Object.values(groups).forEach(batchMembers => {
      batchMembers.sort((a, b) => (a.student_name || "").localeCompare(b.student_name || ""));
    });

    // Sort batches descending so newest batch (2024) is first, but 2025-2029 and Other at the bottom
    const sortedBatches = Object.keys(groups).sort((a, b) => {
      const getWeight = (batch: string) => {
        if (batch === "Other") return 2;
        if (batch === "Batch 2025-2029") return 1;
        return 0; // Normal batches
      };
      
      const weightA = getWeight(a);
      const weightB = getWeight(b);
      
      if (weightA !== weightB) {
        return weightA - weightB;
      }
      
      return b.localeCompare(a);
    });

    return sortedBatches.map(batch => ({
      batch,
      members: groups[batch]
    }));
  }, [filteredMembers]);

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
            <div className="space-y-10">
              {groupedMembers[currentBatchIndex] && (
                <div key={groupedMembers[currentBatchIndex].batch} className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 justify-between">
                    <div className="flex items-center gap-3">
                      <Button variant="outline" size="icon" className="rounded-full w-9 h-9 border-[#D4C9B6] text-[#2A5D4B] hover:bg-[#EAE1D2]" onClick={() => setCurrentBatchIndex(Math.max(0, currentBatchIndex - 1))} disabled={currentBatchIndex === 0}>
                        <ArrowLeft className="w-4 h-4" />
                      </Button>
                      <h3 className="text-lg sm:text-xl font-bold text-[#1a1810] tracking-tight">{groupedMembers[currentBatchIndex].batch}</h3>
                      <Button variant="outline" size="icon" className="rounded-full w-9 h-9 border-[#D4C9B6] text-[#2A5D4B] hover:bg-[#EAE1D2]" onClick={() => setCurrentBatchIndex(Math.min(groupedMembers.length - 1, currentBatchIndex + 1))} disabled={currentBatchIndex === groupedMembers.length - 1}>
                        <ArrowRight className="w-4 h-4" />
                      </Button>
                    </div>
                    <div className="hidden sm:block h-px bg-[#D4C9B6] flex-1" />
                    <span className="self-start sm:self-auto text-[11px] sm:text-xs font-bold text-primary bg-[#EAE1D2] px-2 py-1 rounded-md border border-[#D4C9B6] uppercase tracking-widest">{groupedMembers[currentBatchIndex].members.length} members</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
                    <AnimatePresence mode="popLayout">
                      {groupedMembers[currentBatchIndex].members.map((member, i) => {
                        return (
                          <motion.div layout initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} transition={{ delay: i * 0.05 }} key={member.enrollment_no} className="group relative">
                            <div className="relative overflow-hidden rounded-[20px] bg-white border transition-all duration-300 border-[#D4C9B6] shadow-sm hover:shadow-[0_8px_30px_rgb(0,0,0,0.06)] hover:border-primary/40">
                              <div className="h-16 bg-gradient-to-r from-[#EAE1D2] to-[#D4C9B6]/30 w-full absolute top-0 left-0" />
                              <div className="p-5 pt-8 relative z-0 flex flex-col items-center">
                                <StudentAvatar name={member.student_name} photoUrl={member.profile_image} enrollmentNo={member.enrollment_no} className="w-20 h-20 border-4 border-white shadow-sm mb-3" />
                                <h3 className="font-bold text-[#1a1810] text-center line-clamp-1">{member.student_name}</h3>
                                <p className="text-xs text-muted-foreground font-mono mt-0.5">{member.enrollment_no}</p>
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
                        );
                      })}
                    </AnimatePresence>
                  </div>
                </div>
              )}
            </div>
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
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-[#1a1810] uppercase tracking-wide">Semester</Label>
                  <Input type="number" min={1} max={8} value={formData.semester} onChange={(e) => setFormData(p => ({ ...p, semester: e.target.value }))} placeholder="6" className="bg-white border-[#D4C9B6] rounded-xl" disabled={!canEditSelected} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-[#1a1810] uppercase tracking-wide">Dept</Label>
                  <Input value={formData.department} onChange={(e) => setFormData(p => ({ ...p, department: e.target.value }))} placeholder="CE" className="bg-white border-[#D4C9B6] rounded-xl" disabled={!canEditSelected} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-[#1a1810] uppercase tracking-wide">Institute</Label>
                  <Input value={formData.institute} onChange={(e) => setFormData(p => ({ ...p, institute: e.target.value }))} placeholder="CHARUSAT" className="bg-white border-[#D4C9B6] rounded-xl" disabled={!canEditSelected} />
                </div>
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
            <TextSection formData={formData} setFormData={setFormData} disabled={!canEditSelected} label="📄 Research Papers Published" field="research_papers" placeholder="Paper Title, Journal Name, 2024" hint="One per line" />
            <TextSection formData={formData} setFormData={setFormData} disabled={!canEditSelected} label="🏆 Hackathons" field="hackathons" placeholder="Smart India Hackathon 2024 - Runner Up" hint="One per line" />

            <div className="border-t border-dashed border-[#D4C9B6]" />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <TextSection formData={formData} setFormData={setFormData} disabled={!canEditSelected} label="🏅 Leadership" field="leadership" placeholder="Lab Coordinator, SRL 2024" hint="One per line" />
              <TextSection formData={formData} setFormData={setFormData} disabled={!canEditSelected} label="🎖️ Awards" field="awards" placeholder="Best Presenter Award" hint="One per line" />
            </div>
            <TextSection formData={formData} setFormData={setFormData} disabled={!canEditSelected} label="📜 Certifications" field="certifications" placeholder="AWS Cloud Practitioner&#10;Google ML Crash Course" hint="One per line — displayed as chips" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <TextSection formData={formData} setFormData={setFormData} disabled={!canEditSelected} label="💼 Internships" field="internships" placeholder="Software Intern, XYZ Corp, Summer 2024" hint="One per line" />
              <TextSection formData={formData} setFormData={setFormData} disabled={!canEditSelected} label="⭐ Additional Achievements" field="additional_achievements" placeholder="Published article in campus newsletter" hint="One per line" />
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
                  <p className="text-3xl font-bold text-[#21493A]">{formData.research_papers.split("\n").filter(l => l.trim()).length}</p>
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
