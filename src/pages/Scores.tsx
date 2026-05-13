import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Plus, Clock, Star, ChevronLeft, ChevronRight, Pencil, Trash2, X, Search, Loader2, Medal } from "lucide-react";
import StudentAvatar from "@/components/StudentAvatar";
import { hasWriteAccess } from "@/lib/auth";
import { adminAPI, parseList } from "@/lib/adminApi";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ScoreRow {
  id: string;
  enrollment_no: string;
  points: number;
  name: string;
  initials: string;
  profile_image?: string;
  hours?: number;
  batch?: string;
  department?: string;
}

const GRN = "linear-gradient(135deg,#1e4a34,#122a1e)";
const PG = 7; 

export default function Scores() {
  const [scores, setScores] = useState<ScoreRow[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [monthOptions, setMonthOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [cachedLeaderboardStats, setCachedLeaderboardStats] = useState<any[]>([]);
  const [cachedStudentsData, setCachedStudentsData] = useState<any[]>([]);
  const [viewMode, setViewMode] = useState<"cumulative" | "monthly" | "contributors">("cumulative");
  const [currentPage, setCurrentPage] = useState(1);
  const { toast } = useToast();

  // CRUD States
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingScore, setEditingScore] = useState<ScoreRow | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  // Form States
  const [formData, setFormData] = useState({
    points: 0,
    hours: 0,
    enrollment_no: "",
    period: ""
  });
  
  // Bulk Add States
  const [showAddForm, setShowAddForm] = useState(false);
  const [addPeriod, setAddPeriod] = useState("");
  const [addScores, setAddScores] = useState<{ [enrollment_no: string]: { points: string; hours: string } }>({});
  const [searchName, setSearchName] = useState("");
  const [addError, setAddError] = useState("");
  const [adding, setAdding] = useState(false);

  const normalizeText = (value: unknown) => String(value || "").trim();

  const parseList = (value: any) => {
    if (Array.isArray(value)) return value;
    if (Array.isArray(value?.data)) return value.data;
    if (Array.isArray(value?.leaderboard)) return value.leaderboard;
    if (Array.isArray(value?.data?.leaderboard)) return value.data.leaderboard;
    return [];
  };

  const monthRank = (value: string) => {
    const raw = normalizeText(value);
    const match = raw.match(/^([A-Za-z]{3,9})\s+(\d{4})$/);
    if (!match) return 0;
    const m: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
    return (Number(match[2]) || 0) * 100 + (m[match[1].toLowerCase().substring(0, 3)] || 0);
  };

  const normalizePeriod = (period: string) => {
    const raw = normalizeText(period);
    if (/^all\s*time$/i.test(raw)) return "All Time";
    // Check for academic year format (YYYY-YYYY)
    if (/^\d{4}-\d{4}$/.test(raw)) return raw;
    const match = raw.match(/^([A-Za-z]+)\s+(\d{4})$/);
    if (!match) return raw;
    const monthMap: Record<string, string> = {
      january: "Jan", february: "Feb", march: "Mar", april: "Apr", may: "May", june: "Jun",
      july: "Jul", august: "Aug", september: "Sep", october: "Oct", november: "Nov", december: "Dec",
      jan: "Jan", feb: "Feb", mar: "Mar", apr: "Apr", jun: "Jun", jul: "Jul", aug: "Aug", sep: "Sep", oct: "Oct", nov: "Nov", dec: "Dec"
    };
    const monthName = monthMap[match[1].toLowerCase()] || match[1];
    return `${monthName} ${match[2]}`;
  };

  const parsePeriod = (period: string): { month: number; year: number } | null => {
    const raw = normalizeText(period);
    if (/^all\s*time$/i.test(raw)) return null;
    const match = raw.match(/^([A-Za-z]{3,9})\s+(\d{4})$/);
    if (!match) return null;
    const monthMap: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
    const month = monthMap[match[1].toLowerCase().substring(0, 3)] || 0;
    const year = Number(match[2]);
    return month > 0 ? { month, year } : null;
  };

  const isInAcademicYear = (period: string, acadYearStart: number): boolean => {
    const parsed = parsePeriod(period);
    if (!parsed) return false;
    // Academic year: May of acadYearStart to April of (acadYearStart + 1)
    const startMonth = 5; // May
    const endMonth = 4; // April
    if (parsed.year === acadYearStart && parsed.month >= startMonth) return true;
    if (parsed.year === acadYearStart + 1 && parsed.month <= endMonth) return true;
    return false;
  };

  const getAcademicYearFormat = (acadYearStart: number): string => {
    return `${acadYearStart}-${acadYearStart + 1}`;
  };

  const getCurrentAcademicYear = (): number => {
    const now = new Date();
    const currentMonth = now.getMonth() + 1; // 1-12
    const currentYear = now.getFullYear();
    // Academic year starts in May (month 5)
    return currentMonth >= 5 ? currentYear : currentYear - 1;
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [scoresRes, studentsRes] = await Promise.all([adminAPI.getScores(), adminAPI.getStudents()]);

      const rawStats: any[] = scoresRes?.data?.leaderboardStats ?? scoresRes?.leaderboardStats ?? parseList(scoresRes?.data ?? scoresRes);
      const stats = rawStats.map((s: any) => ({ ...s, period: normalizePeriod(s.period) }));

      setCachedStudentsData(parseList(studentsRes));
      // Get months but exclude "All Time" and academic year format (YYYY-YYYY)
      const months = Array.from(new Set<string>(stats.map((r: any) => r.period).filter((p: string) => p && !/^all\s*time$/i.test(p) && !/^\d{4}-\d{4}$/.test(p)))).sort((a, b) => monthRank(b) - monthRank(a));
      
      setMonthOptions(months);
      setCachedLeaderboardStats(stats);
      if (months.length > 0 && !selectedMonth) setSelectedMonth(months[0]);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    if (cachedLeaderboardStats.length === 0) return;
    try {
      const nameMap = new Map<string, any>();
      cachedStudentsData.forEach((s: any) => { const e = normalizeText(s.enrollment_no); if (e) nameMap.set(e, s); });
      const agg = new Map<string, ScoreRow>();
      
      let stats: any[] = [];
      if (viewMode === "cumulative") {
        const currentAcadYear = getCurrentAcademicYear();
        const previousAcadYear = currentAcadYear - 1;
        const currentAcadYearStr = getAcademicYearFormat(currentAcadYear);
        const previousAcadYearStr = getAcademicYearFormat(previousAcadYear);
        
        // First check for YYYY-YYYY format (e.g., "2026-2027", fallback to "2025-2026")
        let hasCurrentYearFormat = cachedLeaderboardStats.some(s => normalizeText(s.period) === currentAcadYearStr);
        let hasPreviousYearFormat = cachedLeaderboardStats.some(s => normalizeText(s.period) === previousAcadYearStr);
        
        if (hasCurrentYearFormat) {
          stats = cachedLeaderboardStats.filter(s => normalizeText(s.period) === currentAcadYearStr);
        } else if (hasPreviousYearFormat) {
          stats = cachedLeaderboardStats.filter(s => normalizeText(s.period) === previousAcadYearStr);
        } else {
          // Fallback to month-based filtering
          stats = cachedLeaderboardStats.filter(s => {
            const period = normalizeText(s.period);
            if (/^all\s*time$/i.test(period)) return false;
            if (isInAcademicYear(period, currentAcadYear)) return true;
            if (isInAcademicYear(period, previousAcadYear)) return true;
            return false;
          });
        }
      } else {
        // Monthly or contributors view
        stats = cachedLeaderboardStats.filter(s => normalizeText(s.period) === selectedMonth);
      }
      stats.forEach((score: any) => {
        const enr = normalizeText(score.enrollment_no);
        const stu = nameMap.get(enr) || {};
        const name = normalizeText(stu.student_name) || enr;
        if (!agg.has(enr)) {
          agg.set(enr, { 
            id: normalizeText(score.id), 
            enrollment_no: enr, 
            points: Number(score.debate_score || score.points || score.total_score || score.monthly_score || 0), 
            name, 
            initials: name.split(' ').map((n: string) => n[0]).join('').toUpperCase().substring(0, 2), 
            profile_image: stu.profile_image || stu.photo_url || score.profile_image || score.image || score.photo, 
            hours: Number(score.hours || score.total_hours || score.monthly_hours || 0),
            batch: stu.batch,
            department: stu.department
          });
        } else {
          const ex = agg.get(enr)!;
          ex.points += Number(score.debate_score || score.points || score.total_score || score.monthly_score || 0);
          ex.hours = Number(((ex.hours || 0) + Number(score.hours || score.total_hours || score.monthly_hours || 0)).toFixed(1));
        }
      });
      let rows = Array.from(agg.values());
      rows.sort((a, b) => viewMode === "contributors" ? (b.hours || 0) - (a.hours || 0) : b.points - a.points);
      setScores(rows);
    } catch (e) { console.error(e); }
  }, [viewMode, selectedMonth, cachedLeaderboardStats, cachedStudentsData]);

  const paged = scores.slice((currentPage - 1) * PG, currentPage * PG);

  const handleEditClick = (score: ScoreRow) => {
    setEditingScore(score);
    setFormData({ points: score.points, hours: score.hours || 0, enrollment_no: score.enrollment_no, period: selectedMonth || "" });
    setIsEditModalOpen(true);
  };

  const handleUpdate = async () => {
    if (!editingScore) return;
    setIsSaving(true);
    try {
      const res = await adminAPI.updateScore(editingScore.id, { points: formData.points, hours: formData.hours });
      if (res) {
        toast({ title: "Updated" });
        setIsEditModalOpen(false);
        loadData();
      }
    } catch (e: any) { toast({ variant: "destructive", title: "Error", description: e.message }); }
    finally { setIsSaving(false); }
  };

  const handleDelete = async () => {
    if (!editingScore) return;
    if (!confirm("Delete this record?")) return;
    setIsSaving(true);
    try {
      await adminAPI.deleteScore(editingScore.id);
      toast({ title: "Deleted" });
      setIsEditModalOpen(false);
      loadData();
    } catch (e: any) { toast({ variant: "destructive", title: "Error", description: e.message }); }
    finally { setIsSaving(false); }
  };

  const handleAdd = async () => {
    setAdding(true);
    setAddError("");
    
    if (!addPeriod) {
      setAddError("Please select a period.");
      setAdding(false);
      return;
    }
    
    // Prepare rows for students with entered scores
    const rows = Object.entries(addScores)
      .filter(([_, data]) => (data.points !== "" && !isNaN(Number(data.points))) || (data.hours !== "" && !isNaN(Number(data.hours))))
      .map(([enrollment_no, data]) => ({
        enrollment_no,
        points: data.points !== "" ? parseFloat(data.points) : 0,
        hours: data.hours !== "" ? parseFloat(data.hours) : 0,
        period: addPeriod
      }));
    
    if (rows.length === 0) {
      setAddError("Please enter points or hours for at least one student.");
      setAdding(false);
      return;
    }
    
    try {
      // Insert score records
      for (const row of rows) {
        await adminAPI.createScore(row);
      }
      
      toast({ title: "Scores added successfully" });
      setShowAddForm(false);
      setAddScores({});
      setAddPeriod(selectedMonth || "");
      setSearchName("");
      loadData();
    } catch (e: any) {
      setAddError(e.message || "Failed to add scores");
    }
    setAdding(false);
  };
  
  const handleAddClick = () => {
    if (showAddForm) {
      setShowAddForm(false);
    } else {
      setShowAddForm(true);
      setAddPeriod(selectedMonth || monthOptions[0] || "");
      setAddScores({});
      setSearchName("");
      setAddError("");
    }
  };

  return (
    <div style={{ fontFamily: "'Inter','Plus Jakarta Sans',sans-serif", maxWidth: 1160, display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      
      {/* Top Bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22, gap: 14, flexWrap: "wrap", flexShrink: 0 }}>
        <div style={{ display: "inline-flex", gap: 5, padding: 6, borderRadius: 50, background: "linear-gradient(135deg,#eae6dc,#f2ede4)", border: "1px solid #d8d2c6", boxShadow: "inset 0 1.5px 4px rgba(0,0,0,0.08)" }}>
          {[
            { id: "cumulative", label: "All-Time", icon: <Trophy size={14} /> },
            { id: "monthly", label: "Monthly", icon: <Star size={14} /> },
            { id: "contributors", label: "Hours", icon: <Clock size={14} /> }
          ].map(m => {
            const active = viewMode === m.id;
            return (
              <button
                key={m.id}
                onClick={() => { setViewMode(m.id as any); setCurrentPage(1); }}
                style={{
                  display: "flex", alignItems: "center", gap: 7, padding: "8px 20px", borderRadius: 50, border: "none", cursor: "pointer", fontSize: "0.835rem", fontWeight: active ? 700 : 500,
                  background: active ? GRN : "transparent", color: active ? "#fff" : "#8a7e72", transition: "all 0.2s", boxShadow: active ? "0 3px 12px rgba(26,74,52,0.3)" : "none"
                }}
              >
                {m.icon} {m.label}
              </button>
            );
          })}
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {viewMode !== "cumulative" && (
            <Select value={selectedMonth || ""} onValueChange={setSelectedMonth}>
              <SelectTrigger style={{ height: 42, padding: "0 16px", borderRadius: 50, border: "1.5px solid #dde8e2", background: "#f8fdfb", fontSize: "0.875rem", fontWeight: 600, color: "#1e1e18", width: 160 }}>
                <SelectValue placeholder="Month" />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-slate-100 shadow-xl">
                {monthOptions.map(m => (
                  <SelectItem key={m} value={m} className="font-bold">{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {hasWriteAccess() && (
            <button
              onClick={handleAddClick}
              style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "11px 22px", borderRadius: 50, background: GRN, color: "#fff", fontSize: "0.875rem", fontWeight: 700, cursor: "pointer", border: "none", boxShadow: "0 4px 16px rgba(26,74,52,0.34)", letterSpacing: "0.02em" }}
            >
              <Plus size={16} strokeWidth={2.5} /> {showAddForm ? "Hide Form" : "Add Score"}
            </button>
          )}
        </div>
      </div>

      {/* Leaderboard Table */}
      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
        {loading && <div style={{ display: "flex", justifyContent: "center", padding: "4rem 0" }}><Loader2 style={{ width: 28, height: 28, color: "#1e4a34", animation: "spin 1s linear infinite" }} /></div>}
        
        {!loading && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} style={{ background: "#fff", borderRadius: 18, overflow: "hidden", border: "1.5px solid #e0dbd2", boxShadow: "0 6px 32px rgba(26,74,52,0.09)", borderTop: "3.5px solid #1a3a2a", flex: 1, display: "flex", flexDirection: "column" }}>
            <div style={{ overflowX: "auto", flex: 1 }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "linear-gradient(90deg,#f8f6f1,#fbfaf7)" }}>
                    <th style={{ padding: "13px 24px", textAlign: "left", fontSize: "0.72rem", fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: "#6a6050", borderBottom: "2px solid #ede8e0", width: 80 }}>Rank</th>
                    <th style={{ padding: "13px 16px", textAlign: "left", fontSize: "0.72rem", fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: "#6a6050", borderBottom: "2px solid #ede8e0" }}>Student</th>
                    <th style={{ padding: "13px 16px", textAlign: "left", fontSize: "0.72rem", fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: "#6a6050", borderBottom: "2px solid #ede8e0", width: 140 }}>Batch</th>
                    {viewMode === "cumulative" ? (
                      <>
                        <th style={{ padding: "13px 16px", textAlign: "right", fontSize: "0.72rem", fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: "#6a6050", borderBottom: "2px solid #ede8e0", width: 120 }}>Total Hours</th>
                        <th style={{ padding: "13px 16px", textAlign: "right", fontSize: "0.72rem", fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: "#6a6050", borderBottom: "2px solid #ede8e0", width: 120 }}>Total Score</th>
                      </>
                    ) : (
                      <th style={{ padding: "13px 16px", textAlign: "right", fontSize: "0.72rem", fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: "#6a6050", borderBottom: "2px solid #ede8e0", width: 120 }}>
                        {viewMode === 'contributors' ? 'Hours' : 'Score'}
                      </th>
                    )}
                    <th style={{ padding: "13px 24px", textAlign: "center", fontSize: "0.72rem", fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: "#6a6050", borderBottom: "2px solid #ede8e0", width: 100 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <AnimatePresence mode="wait">
                    {paged.map((s, i) => {
                      const rank = (currentPage - 1) * PG + i;
                      const metric = viewMode === 'contributors' ? (s.hours || 0) : s.points;
                      
                      return (
                        <motion.tr key={s.enrollment_no} initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} transition={{ delay: i * 0.02, duration: 0.2 }}
                          style={{ borderBottom: "1px solid #f4f1eb", transition: "background 0.15s" }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "linear-gradient(90deg,#f5f3ee,#faf9f6)"; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}>
                          
                          <td style={{ padding: "12px 24px" }}>
                            {rank < 3 ? (
                              <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: 8, background: rank === 0 ? "#fff3cc" : rank === 1 ? "#f0f0f0" : "#ffeadb", border: `1px solid ${rank === 0 ? "#f0d060" : rank === 1 ? "#d0d0d0" : "#f0b080"}` }}>
                                <Trophy size={14} color={rank === 0 ? "#b08000" : rank === 1 ? "#606060" : "#a05020"} />
                              </div>
                            ) : (
                              <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "#8a7e72", marginLeft: 8 }}>#{rank + 1}</span>
                            )}
                          </td>

                          <td style={{ padding: "12px 16px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                              <StudentAvatar name={s.name} enrollmentNo={s.enrollment_no} photoUrl={s.profile_image} className="w-10 h-10" />
                              <div>
                                <p style={{ fontSize: "0.875rem", fontWeight: 700, color: "#18180e", lineHeight: 1.3, margin: 0 }}>{s.name}</p>
                                <p style={{ fontSize: "0.72rem", color: "#b0a898", lineHeight: 1.3, margin: 0 }}>{s.enrollment_no}</p>
                              </div>
                            </div>
                          </td>

                          <td style={{ padding: "12px 16px" }}>
                            <span style={{ display: "inline-flex", alignItems: "center", padding: "4px 11px", borderRadius: 50, fontSize: "0.74rem", fontWeight: 700, background: "#e4f0ec", color: "#1e5c42", border: "1.5px solid #aad4c0" }}>{s.batch || "N/A"}</span>
                          </td>

                          {viewMode === "cumulative" ? (
                            <>
                              <td style={{ padding: "12px 16px", textAlign: "right" }}>
                                <span style={{ fontSize: "0.95rem", fontWeight: 700, color: "#18180e" }}>{s.hours || 0}h</span>
                              </td>
                              <td style={{ padding: "12px 16px", textAlign: "right" }}>
                                <span style={{ fontSize: "1rem", fontWeight: 800, color: rank === 0 ? "#1e4a34" : "#18180e" }}>{s.points}</span>
                              </td>
                            </>
                          ) : (
                            <td style={{ padding: "12px 16px", textAlign: "right" }}>
                              <span style={{ fontSize: "1rem", fontWeight: 800, color: rank === 0 ? "#1e4a34" : "#18180e" }}>
                                {metric}{viewMode === 'contributors' ? 'h' : ''}
                              </span>
                            </td>
                          )}

                          <td style={{ padding: "12px 24px", textAlign: "center" }}>
                            {hasWriteAccess() && (
                              <button onClick={() => handleEditClick(s)} style={{ width: 30, height: 30, borderRadius: 8, border: "1.5px solid #c8d8c0", background: "#edf6f0", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "all 0.15s" }} onMouseEnter={e => (e.currentTarget.style.background = "#d4ecdc")} onMouseLeave={e => (e.currentTarget.style.background = "#edf6f0")}>
                                <Pencil size={13} color="#1e5c42" />
                              </button>
                            )}
                          </td>
                        </motion.tr>
                      );
                    })}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div style={{ padding: "13px 24px", borderTop: "1px solid #f4f1eb", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#fbfaf7", borderBottomLeftRadius: 18, borderBottomRightRadius: 18 }}>
              <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "#8a7e72", letterSpacing: "0.05em", textTransform: "uppercase" }}>
                Showing {(currentPage - 1) * PG + 1}–{Math.min(currentPage * PG, scores.length)} of {scores.length}
              </span>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} style={{ width: 32, height: 32, borderRadius: 8, border: "1.5px solid #e0dbd2", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", opacity: currentPage === 1 ? 0.4 : 1 }}><ChevronLeft size={16} /></button>
                <div style={{ display: "flex", gap: 4 }}>
                  {Array.from({ length: Math.ceil(scores.length / PG) }, (_, i) => i + 1).map(p => (
                    <button key={p} onClick={() => setCurrentPage(p)} style={{ width: 32, height: 32, borderRadius: 8, border: "1.5px solid #e0dbd2", background: currentPage === p ? GRN : "#fff", color: currentPage === p ? "#fff" : "#6a6050", fontSize: "0.82rem", fontWeight: 700, cursor: "pointer", transition: "0.2s" }}>{p}</button>
                  ))}
                </div>
                <button onClick={() => setCurrentPage(p => Math.min(Math.ceil(scores.length / PG), p + 1))} disabled={currentPage === Math.ceil(scores.length / PG)} style={{ width: 32, height: 32, borderRadius: 8, border: "1.5px solid #e0dbd2", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", opacity: currentPage === Math.ceil(scores.length / PG) ? 0.4 : 1 }}><ChevronRight size={16} /></button>
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* Bulk Add Scores Form */}
      {showAddForm && (
        <motion.form onSubmit={(e) => { e.preventDefault(); handleAdd(); }} initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-4 p-4 sm:p-6 border-2 border-[#EAD8C0]/50 rounded-2xl bg-gradient-to-br from-[#FAF7F2]/30 to-stone-50/20 flex flex-col gap-4 max-w-6xl mx-auto w-full glass-card">
          <div className="flex flex-col md:flex-row gap-4 md:items-center">
            <div className="flex flex-col sm:flex-row gap-3 sm:items-center flex-1">
              <label className="font-semibold text-sm text-stone-700 shrink-0">Period:</label>
              <Select value={addPeriod} onValueChange={setAddPeriod}>
                <SelectTrigger className="border-2 border-[#EAD8C0]/40 bg-white px-3 py-2 rounded-lg text-sm flex-1 text-stone-700 font-medium">
                  <SelectValue placeholder="Select Period" />
                </SelectTrigger>
                <SelectContent className="bg-[#FAF7F2] border-2 border-[#EAD8C0]">
                  {monthOptions.map(m => (
                    <SelectItem key={m} value={m} className="font-medium">{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 sm:items-center flex-1">
              <label className="font-semibold text-sm text-stone-700 shrink-0">Search Name:</label>
              <input
                type="text"
                placeholder="Search by student name..."
                value={searchName}
                onChange={e => setSearchName(e.target.value)}
                className="border-2 border-[#EAD8C0]/40 bg-white px-3 py-2 rounded-lg text-sm flex-1 text-stone-700 font-medium focus:outline-none focus:border-[#EAD8C0] focus:ring-2 focus:ring-[#EAD8C0]/20"
              />
            </div>
          </div>
          <div className="overflow-x-auto max-h-96 -mx-4 sm:-mx-6 px-4 sm:px-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gradient-to-r from-[#EAD8C0]/30 to-stone-100/30 border-b-2 border-[#EAD8C0]/50">
                  <th className="text-left px-4 py-3 text-[#8B735B] font-bold">Student</th>
                  <th className="text-center px-4 py-3 text-[#8B735B] font-bold">Enrollment No.</th>
                  <th className="text-center px-4 py-3 text-[#8B735B] font-bold">Points</th>
                  <th className="text-center px-4 py-3 text-[#8B735B] font-bold">Hours</th>
                </tr>
              </thead>
              <tbody>
                {cachedStudentsData.filter((s: any) => s.student_name?.toLowerCase().includes(searchName.toLowerCase())).map((student: any, idx: number) => (
                  <tr key={student.enrollment_no} className={`border-b border-[#EAD8C0]/20 hover:bg-[#EAD8C0]/10 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-[#FAF7F2]/50'}`}>
                    <td className="px-4 py-3 text-stone-700 font-medium">{student.student_name}</td>
                    <td className="px-4 py-3 text-center text-stone-600 font-mono text-xs">{student.enrollment_no}</td>
                    <td className="px-4 py-3 text-center">
                      <input
                        type="number"
                        step="1"
                        min="0"
                        value={addScores[student.enrollment_no]?.points || ""}
                        onChange={e => setAddScores({ ...addScores, [student.enrollment_no]: { ...addScores[student.enrollment_no], points: e.target.value } })}
                        className="border-2 border-[#EAD8C0]/40 bg-white px-2 py-2 rounded-md w-24 text-center text-stone-700 font-medium focus:outline-none focus:border-[#EAD8C0] focus:ring-2 focus:ring-[#EAD8C0]/20"
                        placeholder="0"
                      />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        value={addScores[student.enrollment_no]?.hours || ""}
                        onChange={e => setAddScores({ ...addScores, [student.enrollment_no]: { ...addScores[student.enrollment_no], hours: e.target.value } })}
                        className="border-2 border-[#EAD8C0]/40 bg-white px-2 py-2 rounded-md w-24 text-center text-stone-700 font-medium focus:outline-none focus:border-[#EAD8C0] focus:ring-2 focus:ring-[#EAD8C0]/20"
                        placeholder="0.0"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {addError && <div className="text-red-700 text-sm mt-2 p-2 bg-red-50 rounded-md border border-red-300">{addError}</div>}
          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={adding} className="bg-teal-700 hover:bg-teal-800 text-white font-semibold py-2 rounded-lg transition-colors flex-1">
              {adding ? "Adding..." : "Submit Scores"}
            </Button>
            <Button type="button" onClick={() => setShowAddForm(false)} className="bg-stone-200 hover:bg-stone-300 text-stone-700 font-semibold py-2 rounded-lg transition-colors">
              Close
            </Button>
          </div>
        </motion.form>
      )}

      {/* Modals */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="rounded-2xl sm:max-w-md" style={{ background: "#fffdf9", border: "1.5px solid #e4ddd0" }}>
          <DialogHeader><DialogTitle style={{ color: "#1a1810" }}>Edit Score Record</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: 12, background: "#f8f6f1", borderRadius: 12, border: "1px solid #ede8e0" }}>
              <StudentAvatar name={editingScore?.name || ""} photoUrl={editingScore?.profile_image} className="w-12 h-12" />
              <div>
                <p style={{ fontSize: "0.9rem", fontWeight: 700, color: "#18180e", margin: 0 }}>{editingScore?.name}</p>
                <p style={{ fontSize: "0.75rem", color: "#8a7e72", margin: 0 }}>{editingScore?.enrollment_no}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label style={{ fontSize: "0.8rem", fontWeight: 600, color: "#5a4a38" }}>Academic Points</Label><Input type="number" value={formData.points} onChange={e => setFormData({ ...formData, points: Number(e.target.value) })} className="rounded-xl" /></div>
              <div className="space-y-1"><Label style={{ fontSize: "0.8rem", fontWeight: 600, color: "#5a4a38" }}>Dedicated Hours</Label><Input type="number" value={formData.hours} onChange={e => setFormData({ ...formData, hours: Number(e.target.value) })} className="rounded-xl" /></div>
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <button onClick={handleDelete} disabled={isSaving} style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 40, height: 40, borderRadius: 12, background: "#fde8ec", border: "1.5px solid #f4b8c0", color: "#c0363a", cursor: "pointer" }}><Trash2 size={18} /></button>
              <Button variant="outline" className="rounded-xl" onClick={() => setIsEditModalOpen(false)}>Cancel</Button>
              <Button className="rounded-xl" style={{ background: GRN, color: "#fff" }} onClick={handleUpdate} disabled={isSaving}>{isSaving ? "Saving..." : "Save Changes"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}