import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Plus, Clock, Star, ChevronLeft, ChevronRight, Pencil, Trash2, X, Search, Loader2, Medal } from "lucide-react";
import StudentAvatar from "@/components/StudentAvatar";
import { hasWriteAccess } from "@/lib/auth";
import { adminAPI } from "@/lib/adminApi";
import { useToast } from "@/hooks/use-toast";
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

interface ScoreRow {
  id: string;
  enrollment_no: string;
  points: number;
  name: string;
  initials: string;
  photo_url?: string;
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

  const normalizeText = (value: unknown) => String(value || "").trim();

  const monthRank = (value: string) => {
    const raw = normalizeText(value);
    const match = raw.match(/^([A-Za-z]{3,9})\s+(\d{4})$/);
    if (!match) return 0;
    const m: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
    return (Number(match[2]) || 0) * 100 + (m[match[1].toLowerCase().substring(0, 3)] || 0);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [scoresRes, studentsRes] = await Promise.all([adminAPI.getScores(), adminAPI.getStudents()]);
      if (!scoresRes.success) { setLoading(false); return; }
      const stats = Array.isArray(scoresRes.data.leaderboardStats) ? scoresRes.data.leaderboardStats : [];
      setCachedStudentsData(studentsRes.data || []);
      const months = Array.from(new Set<string>(stats.map((r: any) => normalizeText(r.period)).filter((p: string) => p && !/^all\s*time$/i.test(p)))).sort((a, b) => monthRank(b) - monthRank(a));
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
      const stats = viewMode === "cumulative" ? cachedLeaderboardStats : cachedLeaderboardStats.filter(s => normalizeText(s.period) === selectedMonth);
      stats.forEach((score: any) => {
        const enr = normalizeText(score.enrollment_no);
        const stu = nameMap.get(enr) || {};
        const name = normalizeText(stu.student_name) || enr;
        if (!agg.has(enr)) {
          agg.set(enr, { 
            id: normalizeText(score.id), 
            enrollment_no: enr, 
            points: Number(score.debate_score || score.points || score.total_score) || 0, 
            name, 
            initials: name.split(' ').map((n: string) => n[0]).join('').toUpperCase().substring(0, 2), 
            photo_url: stu.photo_url || score.image || score.photo, 
            hours: Number(score.hours || score.total_hours || 0),
            batch: stu.batch,
            department: stu.department
          });
        } else {
          const ex = agg.get(enr)!;
          ex.points += Number(score.debate_score || score.points || 0);
          if (viewMode === "cumulative") ex.hours = Number(((ex.hours || 0) + Number(score.hours || 0)).toFixed(1));
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
      if (res.success) {
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
      const res = await adminAPI.deleteScore(editingScore.id);
      if (res.success) {
        toast({ title: "Deleted" });
        setIsEditModalOpen(false);
        loadData();
      }
    } catch (e: any) { toast({ variant: "destructive", title: "Error", description: e.message }); }
    finally { setIsSaving(false); }
  };

  const handleAdd = async () => {
    setIsSaving(true);
    try {
      const res = await adminAPI.createScore({ enrollment_no: formData.enrollment_no, points: formData.points, hours: formData.hours, period: formData.period || selectedMonth });
      if (res.success) {
        toast({ title: "Added" });
        setIsAddModalOpen(false);
        loadData();
      }
    } catch (e: any) { toast({ variant: "destructive", title: "Error", description: e.message }); }
    finally { setIsSaving(false); }
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
              onClick={() => { setFormData({ points: 0, hours: 0, enrollment_no: "", period: selectedMonth || "" }); setIsAddModalOpen(true); }}
              style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "11px 22px", borderRadius: 50, background: GRN, color: "#fff", fontSize: "0.875rem", fontWeight: 700, cursor: "pointer", border: "none", boxShadow: "0 4px 16px rgba(26,74,52,0.34)", letterSpacing: "0.02em" }}
            >
              <Plus size={16} strokeWidth={2.5} /> Add Score
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
                    <th className="hidden md:table-cell" style={{ padding: "13px 16px", textAlign: "left", fontSize: "0.72rem", fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: "#6a6050", borderBottom: "2px solid #ede8e0", width: 140 }}>Batch</th>
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
                              <StudentAvatar name={s.name} enrollmentNo={s.enrollment_no} photoUrl={s.photo_url} className="w-10 h-10" />
                              <div>
                                <p style={{ fontSize: "0.875rem", fontWeight: 700, color: "#18180e", lineHeight: 1.3, margin: 0 }}>{s.name}</p>
                                <p style={{ fontSize: "0.72rem", color: "#b0a898", lineHeight: 1.3, margin: 0 }}>{s.enrollment_no}</p>
                              </div>
                            </div>
                          </td>

                          <td className="hidden md:table-cell" style={{ padding: "12px 16px" }}>
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
                              <span style={{ fontSize: "1rem", fontWeight: 800, color: rank === 0 ? "#1e4a34" : "#18180e" }}>{metric}</span>
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

      {/* Modals */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="rounded-2xl sm:max-w-md" style={{ background: "#fffdf9", border: "1.5px solid #e4ddd0" }}>
          <DialogHeader><DialogTitle style={{ color: "#1a1810" }}>Edit Score Record</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: 12, background: "#f8f6f1", borderRadius: 12, border: "1px solid #ede8e0" }}>
              <StudentAvatar name={editingScore?.name || ""} photoUrl={editingScore?.photo_url} className="w-12 h-12" />
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

      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="rounded-2xl sm:max-w-md" style={{ background: "#fffdf9", border: "1.5px solid #e4ddd0" }}>
          <DialogHeader><DialogTitle style={{ color: "#1a1810" }}>New Score Entry</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1"><Label style={{ fontSize: "0.8rem", fontWeight: 600, color: "#5a4a38" }}>Enrollment ID</Label><Input placeholder="24BECE30001" value={formData.enrollment_no} onChange={e => setFormData({ ...formData, enrollment_no: e.target.value })} className="rounded-xl" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label style={{ fontSize: "0.8rem", fontWeight: 600, color: "#5a4a38" }}>Points</Label><Input type="number" value={formData.points} onChange={e => setFormData({ ...formData, points: Number(e.target.value) })} className="rounded-xl" /></div>
              <div className="space-y-1"><Label style={{ fontSize: "0.8rem", fontWeight: 600, color: "#5a4a38" }}>Hours</Label><Input type="number" value={formData.hours} onChange={e => setFormData({ ...formData, hours: Number(e.target.value) })} className="rounded-xl" /></div>
            </div>
            <div className="space-y-1"><Label style={{ fontSize: "0.8rem", fontWeight: 600, color: "#5a4a38" }}>Period (Optional)</Label><Input placeholder={selectedMonth || "May 2026"} value={formData.period} onChange={e => setFormData({ ...formData, period: e.target.value })} className="rounded-xl" /></div>
            <div className="flex justify-end gap-2 pt-4"><Button variant="outline" className="rounded-xl" onClick={() => setIsAddModalOpen(false)}>Cancel</Button><Button className="rounded-xl" style={{ background: GRN, color: "#fff" }} onClick={handleAdd} disabled={isSaving}>{isSaving ? "Adding..." : "Add Entry"}</Button></div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}