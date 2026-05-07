import { useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Trash2, Search, Pencil, Edit3, Settings2, Shield, Eye, CheckCircle2, AlertCircle, Users, ArrowLeft, X, FileText, Award, Folder, Trophy, Edit2, Check, ArrowRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import StudentAvatar from "@/components/StudentAvatar";
import * as api from "@/lib/api";
import { getStoredUser } from "@/lib/auth";

type MemberRecord = {
  enrollment_no: string;
  student_name: string;
  email?: string;
  department?: string;
  member_type?: string;
  photo_url?: string;
  // Mock properties for UI demonstration
  cv_completion?: number;
  hacks?: number;
  papers?: number;
  ongoing?: number;
  verified?: boolean;
};

type HackathonItem = {
  name: string;
  level: string;
  result: string;
  year: string;
  details: string;
};

type ResearchPaperItem = {
  title: string;
  journal: string;
  year: string;
  doi: string;
};

type LeadershipItem = {
  title: string;
  role: string;
  year: string;
  description: string;
};

type CVFormData = {
  knowledge_domains: string;
  hackathons: HackathonItem[];
  research_papers: ResearchPaperItem[];
  leadership_awards: LeadershipItem[];
  execution_ongoing: number;
  execution_hacks: number;
  execution_papers: number;
};

const emptyHackathon = (): HackathonItem => ({ name: "", level: "", result: "", year: "", details: "" });
const emptyResearchPaper = (): ResearchPaperItem => ({ title: "", journal: "", year: "", doi: "" });
const emptyLeadership = (): LeadershipItem => ({ title: "", role: "", year: "", description: "" });

const emptyFormData = (): CVFormData => ({
  knowledge_domains: "",
  hackathons: [emptyHackathon()],
  research_papers: [emptyResearchPaper()],
  leadership_awards: [emptyLeadership()],
  execution_ongoing: 0,
  execution_hacks: 0,
  execution_papers: 0,
});

const toHackathons = (value: unknown): HackathonItem[] => {
  if (!Array.isArray(value) || value.length === 0) return [emptyHackathon()];
  return value.map((item: any) => ({
    name: String(item?.name || ""), level: String(item?.level || ""), result: String(item?.result || ""),
    year: String(item?.year || ""), details: String(item?.details || ""),
  })).slice(0, 1);
};

const toPapers = (value: unknown): ResearchPaperItem[] => {
  if (!Array.isArray(value) || value.length === 0) return [emptyResearchPaper()];
  return value.map((item: any) => ({
    title: String(item?.title || ""), journal: String(item?.journal || ""),
    year: String(item?.year || ""), doi: String(item?.doi || ""),
  })).slice(0, 1);
};

const toLeadership = (value: unknown): LeadershipItem[] => {
  if (!Array.isArray(value) || value.length === 0) return [emptyLeadership()];
  return value.map((item: any) => ({
    title: String(item?.title || ""), role: String(item?.role || ""),
    year: String(item?.year || ""), description: String(item?.description || ""),
  })).slice(0, 1);
};

const getBatchString = (member: any) => {
  const name = member.student_name || "";
  if (name.toLowerCase().includes("poojan ghetiya")) {
    return "Batch 2025-2029";
  }

  const enrollmentNo = member.enrollment_no;
  if (!enrollmentNo || enrollmentNo.length < 2) return "Other";
  const prefix = parseInt(enrollmentNo.substring(0, 2), 10);
  if (isNaN(prefix) || prefix < 10 || prefix > 99) return "Other";
  const startYear = 2000 + prefix;
  const endYear = startYear + 4;
  return `Batch ${startYear}-${endYear}`;
};

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
        const data = await api.getStudents();
        const fetchedMembers = (data || [])
          .filter((row: any) => row.enrollment_no && String(row.member_type || "member").toLowerCase() !== "admin")
          .map((row: any) => ({
             ...row,
             cv_completion: Math.floor(Math.random() * 80) + 20,
             hacks: row.execution_hacks !== undefined ? row.execution_hacks : Math.floor(Math.random() * 5),
             papers: row.execution_papers !== undefined ? row.execution_papers : Math.floor(Math.random() * 3),
             ongoing: row.execution_ongoing !== undefined ? row.execution_ongoing : Math.floor(Math.random() * 4),
             verified: Math.random() > 0.4,
          }));

        if (!currentUser) {
          setMembers([]);
          setSelectedEnrollment("");
          return;
        }

        if (isAdmin) {
          setMembers(fetchedMembers);
          // For admin, start in grid view
          setSelectedEnrollment("");
          setShowGrid(true);
        } else {
          const ownEnrollment = currentUser.enrollmentNo || "";
          const ownProfile = fetchedMembers.filter((row: any) => row.enrollment_no === ownEnrollment);
          setMembers(ownProfile);
          setSelectedEnrollment(ownProfile[0]?.enrollment_no || "");
          setShowGrid(false); // Normal members don't see grid
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
        const data = await api.getMemberCVByEnrollment(selectedEnrollment);
        if (!data) {
          setFormData(emptyFormData());
          return;
        }
        setFormData({
          knowledge_domains: String(data.knowledge_domains || data.research_area || ""),
          hackathons: toHackathons(data.hackathons),
          research_papers: toPapers(data.research_papers),
          leadership_awards: toLeadership(data.leadership_awards || data.patents),
          execution_ongoing: Number(data.execution_ongoing || 0),
          execution_hacks: Number(data.execution_hacks || 0),
          execution_papers: Number(data.execution_papers || 0),
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

  // Handle Updates
  const updateHackathon = (index: number, key: keyof HackathonItem, value: string) => {
    setFormData((prev) => { const next = [...prev.hackathons]; next[index] = { ...next[index], [key]: value }; return { ...prev, hackathons: next }; });
  };
  const updatePaper = (index: number, key: keyof ResearchPaperItem, value: string) => {
    setFormData((prev) => { const next = [...prev.research_papers]; next[index] = { ...next[index], [key]: value }; return { ...prev, research_papers: next }; });
  };
  const updateLeadership = (index: number, key: keyof LeadershipItem, value: string) => {
    setFormData((prev) => { const next = [...prev.leadership_awards]; next[index] = { ...next[index], [key]: value }; return { ...prev, leadership_awards: next }; });
  };

  const canEditSelected = !!selectedEnrollment && (!!isAdmin || (currentUser?.enrollmentNo && currentUser.enrollmentNo === selectedEnrollment));

  const profileCompletion = useMemo(() => {
    const sections = [
      formData.knowledge_domains.trim().length > 0,
      formData.hackathons.some((item) => item.name.trim().length > 0), 
      formData.research_papers.some((item) => item.title.trim().length > 0),
      formData.leadership_awards.some((item) => item.title.trim().length > 0), 
    ];
    const completed = sections.filter(Boolean).length;
    const total = sections.length;
    return { completed, total, percent: Math.round((completed / total) * 100) };
  }, [formData]);

  const handleSave = async () => {
    if (!selectedMember || !selectedEnrollment) return toast({ variant: "destructive", title: "No profile selected", description: "Please select a member profile first." });
    if (!canEditSelected) return toast({ variant: "destructive", title: "Permission denied", description: "You can edit only your own profile." });

    try {
      setSaving(true);
      const payload = {
        enrollment_no: selectedEnrollment, student_name: selectedMember.student_name,
        knowledge_domains: formData.knowledge_domains,
        hackathons: formData.hackathons, 
        research_papers: formData.research_papers, 
        leadership_awards: formData.leadership_awards, 
        execution_ongoing: formData.execution_ongoing,
        execution_hacks: formData.execution_hacks,
        execution_papers: formData.execution_papers,
        updated_by: currentUser?.email || null,
      };
      await api.updateMemberCV(payload);
      toast({ title: "Profile saved", description: `CV profile updated for ${selectedMember.student_name}.` });
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
                                <StudentAvatar name={member.student_name} photoUrl={member.photo_url} enrollmentNo={member.enrollment_no} className="w-20 h-20 border-4 border-white shadow-sm mb-3" />
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
          <Button variant="ghost" className="rounded-xl hover:bg-black/5 shrink-0" onClick={() => { setSelectedEnrollment(null); setShowGrid(true); }}>
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
          {/* Main Content Card */}
          <div className="bg-[#F3F0E8] rounded-[24px] p-6 sm:p-10 border border-[#D4C9B6] shadow-sm space-y-12">
            
            {/* 1. Knowledge Domains */}
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-[#1a1810]">1. Knowledge Domains</h3>
              <Textarea value={formData.knowledge_domains} onChange={(e) => setFormData((prev) => ({ ...prev, knowledge_domains: e.target.value }))} placeholder="Example: Machine Learning, Cyber Security, Distributed Systems..." className="bg-white border-[#D4C9B6] rounded-xl min-h-20" disabled={!canEditSelected} />
            </div>

            {/* 2. Hackathons & Achievements */}
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-lg font-bold text-[#1a1810]">2. Hackathons & Achievements 🏆</h3>
                <Button type="button" className="bg-[#2A5D4B] hover:bg-[#21493A] text-white rounded-full px-5 shadow-sm" onClick={() => setFormData((prev) => ({ ...prev, hackathons: [...prev.hackathons, emptyHackathon()] }))} disabled={!canEditSelected}><Plus className="w-4 h-4 mr-2" /> Add Item</Button>
              </div>
              <div className="border border-[#D4C9B6] rounded-2xl overflow-x-auto bg-white shadow-sm">
                <table className="w-full text-sm text-left">
                  <thead className="bg-[#EDE8DE] text-muted-foreground text-xs font-semibold border-b border-[#D4C9B6]">
                    <tr>
                      <th className="px-4 py-3 w-12 text-center">Type</th>
                      <th className="px-4 py-3 min-w-[200px]">Hackathon Title</th>
                      <th className="px-4 py-3 min-w-[150px]">Level</th>
                      <th className="px-4 py-3 w-24">Year</th>
                      <th className="px-4 py-3 min-w-[150px]">Result/Details</th>
                      <th className="px-4 py-3 w-24 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#D4C9B6]">
                    {formData.hackathons.map((item, index) => (
                      <tr key={index} className="hover:bg-[#F3F0E8] transition-colors group">
                        <td className="px-4 py-3 text-center text-[#2A5D4B]"><Trophy className="w-5 h-5 mx-auto opacity-70" /></td>
                        <td className="px-2 py-2"><Input className="h-9 text-sm border-transparent hover:border-[#D4C9B6] focus:border-[#2A5D4B] bg-transparent shadow-none" value={item.name} onChange={(e) => updateHackathon(index, "name", e.target.value)} disabled={!canEditSelected} placeholder="Enter title" /></td>
                        <td className="px-2 py-2"><Input className="h-9 text-sm border-transparent hover:border-[#D4C9B6] focus:border-[#2A5D4B] bg-transparent shadow-none" value={item.level} onChange={(e) => updateHackathon(index, "level", e.target.value)} disabled={!canEditSelected} placeholder="Level" /></td>
                        <td className="px-2 py-2"><Input className="h-9 text-sm border-transparent hover:border-[#D4C9B6] focus:border-[#2A5D4B] bg-transparent shadow-none" value={item.year} onChange={(e) => updateHackathon(index, "year", e.target.value)} disabled={!canEditSelected} placeholder="Year" /></td>
                        <td className="px-2 py-2"><Input className="h-9 text-sm border-transparent hover:border-[#D4C9B6] focus:border-[#2A5D4B] bg-transparent shadow-none" value={item.result} onChange={(e) => updateHackathon(index, "result", e.target.value)} disabled={!canEditSelected} placeholder="Result" /></td>
                        <td className="px-4 py-3 text-right">
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => setFormData((prev) => ({ ...prev, hackathons: prev.hackathons.filter((_, i) => i !== index) || [emptyHackathon()] }))} disabled={!canEditSelected || formData.hackathons.length <= 1}><Trash2 className="w-4 h-4" /></Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 3. Papers Published & Year */}
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-lg font-bold text-[#1a1810]">3. Papers Published & Year 📄</h3>
                <Button type="button" className="bg-[#2A5D4B] hover:bg-[#21493A] text-white rounded-full px-5 shadow-sm" onClick={() => setFormData((prev) => ({ ...prev, research_papers: [...prev.research_papers, emptyResearchPaper()] }))} disabled={!canEditSelected}><Plus className="w-4 h-4 mr-2" /> Add Paper</Button>
              </div>
              <div className="border border-[#D4C9B6] rounded-2xl overflow-x-auto bg-white shadow-sm">
                <table className="w-full text-sm text-left">
                  <thead className="bg-[#EDE8DE] text-muted-foreground text-xs font-semibold border-b border-[#D4C9B6]">
                    <tr>
                      <th className="px-4 py-3 w-12 text-center">Type</th>
                      <th className="px-4 py-3 min-w-[200px]">Paper Title</th>
                      <th className="px-4 py-3 min-w-[150px]">Journal/Conference</th>
                      <th className="px-4 py-3 w-24">Year</th>
                      <th className="px-4 py-3 min-w-[150px]">DOI/Link</th>
                      <th className="px-4 py-3 w-24 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#D4C9B6]">
                    {formData.research_papers.map((item, index) => (
                      <tr key={index} className="hover:bg-[#F3F0E8] transition-colors group">
                        <td className="px-4 py-3 text-center text-[#2A5D4B]"><FileText className="w-5 h-5 mx-auto opacity-70" /></td>
                        <td className="px-2 py-2"><Input className="h-9 text-sm border-transparent hover:border-[#D4C9B6] focus:border-[#2A5D4B] bg-transparent shadow-none" value={item.title} onChange={(e) => updatePaper(index, "title", e.target.value)} disabled={!canEditSelected} placeholder="Paper title" /></td>
                        <td className="px-2 py-2"><Input className="h-9 text-sm border-transparent hover:border-[#D4C9B6] focus:border-[#2A5D4B] bg-transparent shadow-none" value={item.journal} onChange={(e) => updatePaper(index, "journal", e.target.value)} disabled={!canEditSelected} placeholder="Journal" /></td>
                        <td className="px-2 py-2"><Input className="h-9 text-sm border-transparent hover:border-[#D4C9B6] focus:border-[#2A5D4B] bg-transparent shadow-none" value={item.year} onChange={(e) => updatePaper(index, "year", e.target.value)} disabled={!canEditSelected} placeholder="Year" /></td>
                        <td className="px-2 py-2"><Input className="h-9 text-sm border-transparent hover:border-[#D4C9B6] focus:border-[#2A5D4B] bg-transparent shadow-none" value={item.doi} onChange={(e) => updatePaper(index, "doi", e.target.value)} disabled={!canEditSelected} placeholder="Link" /></td>
                        <td className="px-4 py-3 text-right flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-[#2A5D4B]"><Edit2 className="w-3.5 h-3.5" /></Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => setFormData((prev) => ({ ...prev, research_papers: prev.research_papers.filter((_, i) => i !== index) || [emptyResearchPaper()] }))} disabled={!canEditSelected || formData.research_papers.length <= 1}><Trash2 className="w-4 h-4" /></Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 4. Leadership & Awards */}
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-lg font-bold text-[#1a1810]">4. Leadership & Awards 🏅</h3>
                <Button type="button" className="bg-[#2A5D4B] hover:bg-[#21493A] text-white rounded-full px-5 shadow-sm" onClick={() => setFormData((prev) => ({ ...prev, leadership_awards: [...prev.leadership_awards, emptyLeadership()] }))} disabled={!canEditSelected}><Plus className="w-4 h-4 mr-2" /> Add Record</Button>
              </div>
              <div className="border border-[#D4C9B6] rounded-2xl overflow-x-auto bg-white shadow-sm">
                <table className="w-full text-sm text-left">
                  <thead className="bg-[#EDE8DE] text-muted-foreground text-xs font-semibold border-b border-[#D4C9B6]">
                    <tr>
                      <th className="px-4 py-3 w-12 text-center">Type</th>
                      <th className="px-4 py-3 min-w-[200px]">Award / Position Title</th>
                      <th className="px-4 py-3 min-w-[150px]">Role / Issuer</th>
                      <th className="px-4 py-3 w-24">Year</th>
                      <th className="px-4 py-3 min-w-[150px]">Short Description</th>
                      <th className="px-4 py-3 w-24 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#D4C9B6]">
                    {formData.leadership_awards.map((item, index) => (
                      <tr key={index} className="hover:bg-[#F3F0E8] transition-colors group">
                        <td className="px-4 py-3 text-center text-amber-600"><Award className="w-5 h-5 mx-auto opacity-70" /></td>
                        <td className="px-2 py-2"><Input className="h-9 text-sm border-transparent hover:border-[#D4C9B6] focus:border-[#2A5D4B] bg-transparent shadow-none" value={item.title} onChange={(e) => updateLeadership(index, "title", e.target.value)} disabled={!canEditSelected} placeholder="Title" /></td>
                        <td className="px-2 py-2"><Input className="h-9 text-sm border-transparent hover:border-[#D4C9B6] focus:border-[#2A5D4B] bg-transparent shadow-none" value={item.role} onChange={(e) => updateLeadership(index, "role", e.target.value)} disabled={!canEditSelected} placeholder="Issuer" /></td>
                        <td className="px-2 py-2"><Input className="h-9 text-sm border-transparent hover:border-[#D4C9B6] focus:border-[#2A5D4B] bg-transparent shadow-none" value={item.year} onChange={(e) => updateLeadership(index, "year", e.target.value)} disabled={!canEditSelected} placeholder="Year" /></td>
                        <td className="px-2 py-2"><Input className="h-9 text-sm border-transparent hover:border-[#D4C9B6] focus:border-[#2A5D4B] bg-transparent shadow-none" value={item.description} onChange={(e) => updateLeadership(index, "description", e.target.value)} disabled={!canEditSelected} placeholder="Description" /></td>
                        <td className="px-4 py-3 text-right flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-[#2A5D4B]"><Edit2 className="w-3.5 h-3.5" /></Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => setFormData((prev) => ({ ...prev, leadership_awards: prev.leadership_awards.filter((_, i) => i !== index) || [emptyLeadership()] }))} disabled={!canEditSelected || formData.leadership_awards.length <= 1}><Trash2 className="w-4 h-4" /></Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* 5. Execution Analytics (Preview) */}
          <div className="bg-[#DAEBE1] rounded-[24px] p-6 sm:p-8 mt-6 border border-[#a8dbc0] shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/40 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none" />
            <h3 className="text-[#21493A] font-bold text-lg mb-6 relative z-10">5. Execution Analytics (Preview)</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative z-10">
              {/* Ongoing Projects */}
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center shrink-0">
                  <Folder className="w-6 h-6 text-[#2A5D4B]" />
                </div>
                <div>
                  <div className="flex items-baseline">
                    <span className="text-3xl font-bold text-[#21493A]">[</span>
                    <Input type="number" min="0" value={formData.execution_ongoing} onChange={(e) => setFormData((prev) => ({ ...prev, execution_ongoing: parseInt(e.target.value) || 0 }))} disabled={!canEditSelected} className="w-8 h-8 text-center text-xl font-bold text-[#21493A] bg-transparent border-none p-0 focus:ring-0 shadow-none mx-0.5 [&::-webkit-inner-spin-button]:appearance-none" />
                    <span className="text-3xl font-bold text-[#21493A]">]</span>
                    <span className="text-[10px] text-[#2A5D4B] font-medium ml-1.5 flex items-center"><Edit2 className="w-3 h-3 mr-0.5" /> Edit</span>
                  </div>
                  <p className="text-sm font-medium text-[#2A5D4B]/80 mt-1">Ongoing Projects</p>
                </div>
              </div>
              {/* Total Hackathons */}
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center shrink-0">
                  <Trophy className="w-6 h-6 text-amber-500" />
                </div>
                <div>
                  <div className="flex items-baseline">
                    <span className="text-3xl font-bold text-[#21493A]">[</span>
                    <Input type="number" min="0" value={formData.execution_hacks} onChange={(e) => setFormData((prev) => ({ ...prev, execution_hacks: parseInt(e.target.value) || 0 }))} disabled={!canEditSelected} className="w-8 h-8 text-center text-xl font-bold text-[#21493A] bg-transparent border-none p-0 focus:ring-0 shadow-none mx-0.5 [&::-webkit-inner-spin-button]:appearance-none" />
                    <span className="text-3xl font-bold text-[#21493A]">]</span>
                    <span className="text-[10px] text-[#2A5D4B] font-medium ml-1.5 flex items-center"><Edit2 className="w-3 h-3 mr-0.5" /> Edit</span>
                  </div>
                  <p className="text-sm font-medium text-[#2A5D4B]/80 mt-1">Total Hackathons</p>
                </div>
              </div>
              {/* Research Published */}
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center shrink-0">
                  <FileText className="w-6 h-6 text-blue-500" />
                </div>
                <div>
                  <div className="flex items-baseline">
                    <span className="text-3xl font-bold text-[#21493A]">[</span>
                    <Input type="number" min="0" value={formData.execution_papers} onChange={(e) => setFormData((prev) => ({ ...prev, execution_papers: parseInt(e.target.value) || 0 }))} disabled={!canEditSelected} className="w-8 h-8 text-center text-xl font-bold text-[#21493A] bg-transparent border-none p-0 focus:ring-0 shadow-none mx-0.5 [&::-webkit-inner-spin-button]:appearance-none" />
                    <span className="text-3xl font-bold text-[#21493A]">]</span>
                    <span className="text-[10px] text-[#2A5D4B] font-medium ml-1.5 flex items-center"><Edit2 className="w-3 h-3 mr-0.5" /> Edit</span>
                  </div>
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
              <Button variant="outline" className="flex-1 sm:flex-none border-[#2A5D4B] text-[#2A5D4B] hover:bg-[#2A5D4B]/10 rounded-full px-8 py-6 font-semibold bg-white" onClick={() => { setSelectedEnrollment(null); setShowGrid(true); }}>
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
