import { useCallback, useState, useEffect, useMemo } from "react";
import ImageUpload from "@/components/ImageUpload";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Plus, Loader2, ChevronLeft, ChevronRight, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import StudentAvatar from "@/components/StudentAvatar";
import BatchTabs from "@/components/BatchTabs";
import { hasWriteAccess } from "@/lib/auth";
import { adminAPI, parseList } from "@/lib/adminApi";
import { useServerEvent } from "@/hooks/useServerEvents";

interface Student { id?: number; student_name: string; enrollment_no: string; institute_name?: string; department?: string; semester?: number; division?: string; batch?: string; email: string; contact_no?: string; gender?: string; member_type?: string; profile_image?: string; }

const PG = 10;
const GRN = "linear-gradient(135deg,#1e4a34,#122a1e)";
const mb = (t?: string) => { const s = (t || "").toLowerCase(); if (s.includes("head")) return { bg: "#dcf0e6", c: "#1a5c3a", b: "#a8d8bc", d: "#2e8a58" }; if (s.includes("peer")) return { bg: "#fde8f3", c: "#8f2557", b: "#f4b8d8", d: "#c94080" }; return { bg: "#f0eee8", c: "#5a5248", b: "#d8d4cc", d: "#8a8278" }; };
const BB = { bg: "#e4f0ec", c: "#1e5c42", b: "#aad4c0" };
const BLANK = { student_name: "", enrollment_no: "", email: "", contact_no: "", department: "", institute_name: "", semester: "", division: "", batch: "", gender: "male", member_type: "General Members", profile_image: "" };

function FormFields({
  data,
  set,
  onImageUpload,
}: {
  data: typeof BLANK;
  set: (v: typeof BLANK) => void;
  onImageUpload: (url: string) => void;
}) {
  const fields: [string, string, string, string?][] = [
    ["Email *", "email", "student@example.com", "email"],
    ["Institute", "institute_name", "KSV University"],
    ["Department", "department", "CE"],
  ];
  const fieldsBefore = fields.slice(0, 1);   // Email
  const fieldsAfter  = fields.slice(1);       // Institute, Department

  return (
    <div className="space-y-5 pt-2">
      {/* Profile header: avatar left, name + enrollment right */}
      <div className="flex flex-col sm:flex-row gap-5 items-center sm:items-start bg-[#faf8f5] p-5 rounded-2xl border border-[#e4ddd0]">
        {/* Left – avatar uploader */}
        <div className="flex-shrink-0 flex flex-col items-center gap-2">
          <ImageUpload
            currentImage={data.profile_image}
            onImageUpload={onImageUpload}
            label="Profile Photo"
            maxSize={10}
            section="student"
            mediaType="image"
            variant="avatar"
          />
          <span style={{ fontSize: "0.7rem", color: "#a89880", fontWeight: 500 }}>JPG / PNG / WEBP</span>
        </div>

        {/* Divider – vertical on desktop, hidden on mobile */}
        <div className="hidden sm:block w-px self-stretch bg-[#e4ddd0] mx-1" />

        {/* Right – identity fields */}
        <div className="w-full flex flex-col gap-3 flex-grow justify-center">
          <div className="space-y-1.5">
            <Label style={{ color: "#5a4a38", fontSize: "0.82rem", fontWeight: 700, letterSpacing: "0.01em" }}>Student Name *</Label>
            <Input
              type="text"
              placeholder="Full name"
              className="rounded-xl border-[#d8d2c6] bg-white h-11 text-[#1a1810] text-sm"
              value={data.student_name}
              onChange={e => set({ ...data, student_name: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label style={{ color: "#5a4a38", fontSize: "0.82rem", fontWeight: 700, letterSpacing: "0.01em" }}>Enrollment No *</Label>
            <Input
              type="text"
              placeholder="24BECE30001"
              className="rounded-xl border-[#d8d2c6] bg-white h-11 font-mono text-sm tracking-wide text-[#1a1810]"
              value={data.enrollment_no}
              onChange={e => set({ ...data, enrollment_no: e.target.value.toUpperCase() })}
            />
          </div>
        </div>
      </div>

      {/* Remaining fields */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {fieldsBefore.map(([l, k, p, t]) => (
          <div key={k} className="space-y-1">
            <Label style={{ color: "#5a4a38", fontSize: "0.8rem", fontWeight: 600 }}>{l}</Label>
            <Input type={t || "text"} placeholder={p} className="rounded-xl" value={(data as any)[k]} onChange={e => set({ ...data, [k]: e.target.value })} />
          </div>
        ))}
        <div className="space-y-1">
          <Label style={{ color: "#5a4a38", fontSize: "0.8rem", fontWeight: 600 }}>Contact</Label>
          <Input type="tel" placeholder="9876543210" className="rounded-xl" value={data.contact_no} maxLength={10} onChange={e => set({ ...data, contact_no: e.target.value.replace(/\D/g, "").slice(0, 10) })} />
        </div>
        {fieldsAfter.map(([l, k, p, t]) => (
          <div key={k} className="space-y-1">
            <Label style={{ color: "#5a4a38", fontSize: "0.8rem", fontWeight: 600 }}>{l}</Label>
            <Input type={t || "text"} placeholder={p} className="rounded-xl" value={(data as any)[k]} onChange={e => set({ ...data, [k]: e.target.value })} />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {(["semester", "division", "batch"] as const).map(k => (
          <div key={k} className="space-y-1">
            <Label style={{ color: "#5a4a38", fontSize: "0.8rem", fontWeight: 600 }}>{k.charAt(0).toUpperCase() + k.slice(1)}</Label>
            <Input
              placeholder={k === "semester" ? "5" : k === "division" ? "A" : "2024-2028"}
              className="rounded-xl"
              value={(data as any)[k]}
              onChange={e => set({ ...data, [k]: e.target.value })}
            />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label style={{ color: "#5a4a38", fontSize: "0.8rem", fontWeight: 600 }}>Gender</Label>
          <Select value={data.gender} onValueChange={v => set({ ...data, gender: v })}>
            <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="male">Male</SelectItem>
              <SelectItem value="female">Female</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label style={{ color: "#5a4a38", fontSize: "0.8rem", fontWeight: 600 }}>Member Type</Label>
          <Select value={data.member_type} onValueChange={v => set({ ...data, member_type: v })}>
            <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="General Members">General Members</SelectItem>
              <SelectItem value="Head-Appointed">Head-Appointed</SelectItem>
              <SelectItem value="Peer-Nominated">Peer-Nominated</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}

export default function Students() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [batchFilter, setBatchFilter] = useState("");
  const [page, setPage] = useState(1);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [addOpen, setAddOpen] = useState(false);
  const [editSt, setEditSt] = useState<Student | null>(null);
  const [form, setForm] = useState<typeof BLANK>(BLANK);
  const [selMode, setSelMode] = useState(false);
  const { toast } = useToast();
  const canEdit = hasWriteAccess();

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    try {
      if (!opts?.silent) setLoading(true);
      const r = await adminAPI.getStudents();
      setStudents(parseList(r));
    } catch (e: any) {
      if (!opts?.silent) {
        toast({ variant: "destructive", title: "Error", description: e.message });
      }
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  useServerEvent("student_changed", () => {
    load({ silent: true });
  });

  const sorted = useMemo(() => [...students].sort((a, b) => { const isMaster = (s: Student) => (s.batch?.toLowerCase().includes("master")) || (s.enrollment_no?.toUpperCase().includes("ME")) || (s.student_name?.toLowerCase().includes("ghetiya poojan")); const aM = isMaster(a) ? 1 : 0, bM = isMaster(b) ? 1 : 0; if (aM !== bM) return aM - bM; const x = (a.batch || "").toUpperCase(), y = (b.batch || "").toUpperCase(); return y < x ? -1 : y > x ? 1 : (a.student_name || "").localeCompare(b.student_name || ""); }), [students]);
  const batches = useMemo(() => { const seen = new Set<string>(); const result: string[] = []; for (const s of sorted) { const b = (s.batch || "").trim(); if (b && !seen.has(b)) { seen.add(b); result.push(b); } } return result.sort((a, b) => b.localeCompare(a)); }, [sorted]);
  const filtered = useMemo(() => sorted.filter(s => { const q = search.toLowerCase(); return (!q || [s.student_name, s.enrollment_no, s.email, s.department, s.batch].some(v => v?.toLowerCase().includes(q))) && (!batchFilter || s.batch === batchFilter); }), [sorted, search, batchFilter]);
  const pages = Math.max(1, Math.ceil(filtered.length / PG));
  const paged = filtered.slice((page - 1) * PG, page * PG);
  const allSel = paged.length > 0 && paged.every(s => sel.has(s.enrollment_no));

  const onBatch = (v: string) => { setBatchFilter(v); setPage(1); setSel(new Set()); };
  useEffect(() => { if (batchFilter && !batches.includes(batchFilter)) setBatchFilter(""); }, [batches, batchFilter]);
  const onSearch = (v: string) => { setSearch(v); setPage(1); setSel(new Set()); };
  const toggleSel = (id: string) => { const s = new Set(sel); s.has(id) ? s.delete(id) : s.add(id); setSel(s); };
  const toggleAll = () => { if (allSel) { const s = new Set(sel); paged.forEach(st => s.delete(st.enrollment_no)); setSel(s); } else { const s = new Set(sel); paged.forEach(st => s.add(st.enrollment_no)); setSel(s); } };
  const openEdit = (s: Student) => { setEditSt(s); setForm({ student_name: s.student_name || "", enrollment_no: s.enrollment_no || "", email: s.email || "", contact_no: s.contact_no || "", department: s.department || "", institute_name: s.institute_name || "", semester: String(s.semester || ""), division: s.division || "", batch: s.batch || "", gender: s.gender || "male", member_type: s.member_type || "General Members", profile_image: s.profile_image || "" }); };

  const handleAdd = async () => {
    if (!canEdit) return;
    const errs: string[] = [];
    if (!form.student_name.trim()) errs.push("Student name is required.");
    if (!form.enrollment_no.trim()) errs.push("Enrollment number is required.");
    else if (/\s/.test(form.enrollment_no)) errs.push("Enrollment number must not contain spaces.");
    if (!form.email.trim()) errs.push("Email is required.");
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.push("Enter a valid email address.");
    if (errs.length) { toast({ variant: "destructive", title: "Validation error", description: errs.join(" ") }); return; }
    try { const r = await adminAPI.createStudent(form); if (r) { setAddOpen(false); setForm(BLANK); toast({ title: "Student added" }); await load(); } } catch (e: any) { toast({ variant: "destructive", title: "Error", description: e.message }); } };
  const handleEdit = async () => { if (!editSt || !canEdit) return; try { const r = await adminAPI.updateStudent(editSt.enrollment_no, form); if (r) { setEditSt(null); toast({ title: "Student updated" }); await load(); } } catch (e: any) { toast({ variant: "destructive", title: "Error", description: e.message }); } };
  const handleDel = async (s: Student) => { if (!canEdit) return; try { await adminAPI.deleteStudent(s.enrollment_no); setStudents(p => p.filter(x => x.id !== s.id)); setSel(prev => { const n = new Set(prev); n.delete(s.enrollment_no); return n; }); toast({ title: "Student removed" }); } catch (e: any) { toast({ variant: "destructive", title: "Error", description: e.message }); } };
  const handleBulkDel = async () => { if (!canEdit) return; const rm = students.filter(s => sel.has(s.enrollment_no)); try { await Promise.all(rm.map(s => adminAPI.deleteStudent(s.enrollment_no))); setStudents(p => p.filter(s => !sel.has(s.enrollment_no))); setSel(new Set()); toast({ title: `${rm.length} students removed` }); } catch (e: any) { toast({ variant: "destructive", title: "Error", description: e.message }); } };

  const THcols = ["STUDENT", "ENROLLMENT NO", "DEPARTMENT", "BATCH", "MEMBER TYPE", "ACTIONS"];
  const THcls = ["", "hidden lg:table-cell", "hidden md:table-cell", "", "hidden xl:table-cell", ""];

  return (
    <div style={{ fontFamily: "'Inter','Plus Jakarta Sans',sans-serif", maxWidth: 1160 }}>
      {/* Top Bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22, gap: 14, flexWrap: "wrap" as const }}>
        <div style={{ position: "relative", width: 360 }}>
          <Search size={15} style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", color: "#7abda0", pointerEvents: "none" }} />
          <input placeholder="Search students..." value={search} onChange={e => onSearch(e.target.value)} style={{ width: "100%", paddingLeft: 44, paddingRight: 16, paddingTop: 11, paddingBottom: 11, borderRadius: 50, border: "1.5px solid #dde8e2", background: "#f8fdfb", fontSize: "0.875rem", color: "#1e1e18", outline: "none", boxSizing: "border-box" as const, boxShadow: "0 1px 6px rgba(26,58,42,0.06)" }} />
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <AnimatePresence>
            {selMode && canEdit && (
              <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 16px", borderRadius: 50, background: "#f0ece4", border: "1.5px solid #ddd8ce", fontSize: "0.82rem", color: "#3a3020", fontWeight: 600 }}>
                <span>{sel.size} Selected</span>
                {sel.size > 0 && (
                  <>
                    <button title="Multi-Edit" onClick={() => { if (sel.size === 1) { const s = students.find(x => sel.has(x.enrollment_no)); if (s) openEdit(s); } }} style={{ width: 28, height: 28, borderRadius: 8, border: "1.5px solid #b8d8c8", background: "#e8f4ee", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><Pencil size={13} color="#1e5c42" /></button>
                    <button title="Bulk Deactivate" onClick={handleBulkDel} style={{ width: 28, height: 28, borderRadius: 8, border: "1.5px solid #f4b8c0", background: "#fde8ec", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><Trash2 size={13} color="#c0363a" /></button>
                  </>
                )}
                <button title="Cancel Selection" onClick={() => { setSelMode(false); setSel(new Set()); }} style={{ marginLeft: 4, padding: "4px 10px", borderRadius: 50, border: "1px solid #d0ccc4", background: "#fff", fontSize: "0.75rem", cursor: "pointer" }}>Cancel</button>
              </motion.div>
            )}
          </AnimatePresence>
          {canEdit && !selMode && (
            <button onClick={() => setSelMode(true)} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "11px 22px", borderRadius: 50, background: "#f0ece4", color: "#3a3020", fontSize: "0.875rem", fontWeight: 600, cursor: "pointer", border: "1.5px solid #ddd8ce" }}>Select</button>
          )}
          {canEdit && (
            <Dialog open={addOpen} onOpenChange={(o) => {
              if (o) setForm(BLANK);
              setAddOpen(o);
            }}>
              <DialogTrigger asChild>
                <button onClick={() => setForm(BLANK)} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "11px 22px", borderRadius: 50, background: GRN, color: "#fff", fontSize: "0.875rem", fontWeight: 700, cursor: "pointer", border: "none", boxShadow: "0 4px 16px rgba(26,74,52,0.34)", letterSpacing: "0.02em" }}><Plus size={16} strokeWidth={2.5} /> Add Student</button>
              </DialogTrigger>
              <DialogContent className="rounded-2xl sm:max-w-md max-h-[85vh] overflow-y-auto" style={{ background: "#fffdf9", border: "1.5px solid #e4ddd0" }}>
                <DialogHeader><DialogTitle style={{ color: "#1a1810" }}>Add New Student</DialogTitle></DialogHeader>
                <FormFields data={form} set={setForm} onImageUpload={(url) => setForm(prev => ({ ...prev, profile_image: url }))} />
                <div className="flex justify-end gap-2 pt-4"><Button variant="outline" className="rounded-xl" onClick={() => setAddOpen(false)}>Cancel</Button><Button className="rounded-xl" style={{ background: GRN, color: "#fff" }} onClick={handleAdd}>Add Student</Button></div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      <Dialog open={!!editSt} onOpenChange={v => !v && setEditSt(null)}>
        <DialogContent className="rounded-2xl sm:max-w-md max-h-[85vh] overflow-y-auto" style={{ background: "#fffdf9", border: "1.5px solid #e4ddd0" }}>
          <DialogHeader><DialogTitle style={{ color: "#1a1810" }}>Edit Student</DialogTitle></DialogHeader>
          <FormFields data={form} set={setForm} onImageUpload={(url) => setForm(prev => ({ ...prev, profile_image: url }))} />
          <div className="flex justify-end gap-2 pt-4"><Button variant="outline" className="rounded-xl" onClick={() => setEditSt(null)}>Cancel</Button><Button className="rounded-xl" style={{ background: GRN, color: "#fff" }} onClick={handleEdit}>Save Changes</Button></div>
        </DialogContent>
      </Dialog>

      {/* Batch Tabs — dynamic slider with arrow navigation */}
      <BatchTabs batches={batches} selected={batchFilter} onSelect={onBatch} />

      {loading && <div style={{ display: "flex", justifyContent: "center", padding: "4rem 0" }}><Loader2 style={{ width: 28, height: 28, color: "#1e4a34", animation: "spin 1s linear infinite" }} /></div>}

      {!loading && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} style={{ background: "#fff", borderRadius: 18, overflow: "hidden", border: "1.5px solid #e0dbd2", boxShadow: "0 6px 32px rgba(26,74,52,0.09)", borderTop: "3.5px solid #1a3a2a" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "linear-gradient(90deg,#f8f6f1,#fbfaf7)" }}>
                  {selMode && (
                    <th style={{ padding: "13px 8px 13px 24px", width: 44, borderBottom: "2px solid #ede8e0" }}>
                      <input type="checkbox" checked={allSel} onChange={toggleAll} style={{ width: 15, height: 15, accentColor: "#1a3a2a", cursor: "pointer" }} />
                    </th>
                  )}
                  {THcols.map((col, ci) => (
                    <th key={col} className={THcls[ci]} style={{ padding: "13px 16px", textAlign: (ci === 5 ? "center" : "left") as "center" | "left", fontSize: "0.72rem", fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase" as const, color: "#6a6050", borderBottom: "2px solid #ede8e0", whiteSpace: "nowrap" as const }}>{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <AnimatePresence mode="wait">
                  {paged.map((s, i) => {
                    const badge = mb(s.member_type);
                    const isSel = sel.has(s.enrollment_no);
                    return (
                      <motion.tr key={s.enrollment_no || i} initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} transition={{ delay: i * 0.02, duration: 0.2 }}
                        style={{ borderBottom: i < paged.length - 1 ? "1px solid #f4f1eb" : "none", background: isSel ? "rgba(228,240,236,0.5)" : "transparent", transition: "background 0.15s" }}
                        onMouseEnter={e => { if (!isSel) (e.currentTarget as HTMLElement).style.background = "linear-gradient(90deg,#f5f3ee,#faf9f6)"; }}
                        onMouseLeave={e => { if (!isSel) (e.currentTarget as HTMLElement).style.background = "transparent"; }}>
                        {selMode && (
                          <td style={{ padding: "13px 8px 13px 24px", width: 44 }}>
                            <input type="checkbox" checked={isSel} onChange={() => toggleSel(s.enrollment_no)} style={{ width: 15, height: 15, accentColor: "#1a3a2a", cursor: "pointer" }} />
                          </td>
                        )}
                        <td style={{ padding: "12px 16px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <div style={{ position: "relative", flexShrink: 0 }}>
                              <StudentAvatar name={s.student_name || "N/A"} enrollmentNo={s.enrollment_no} photoUrl={s.profile_image} className="w-10 h-10" fallbackClassName="text-xs font-bold" style={{ "--tw-ring-color": "#b8d8c8", background: "#e0f0e8", color: "#1a5c3a" } as any} />
                              <span style={{ position: "absolute", bottom: -1, right: -1, width: 9, height: 9, borderRadius: "50%", background: "#22c55e", border: "2px solid #fff" }} />
                            </div>
                            <div>
                              <p style={{ fontSize: "0.875rem", fontWeight: 700, color: "#18180e", lineHeight: 1.3, margin: 0 }}>{s.student_name || "N/A"}</p>
                              <p style={{ fontSize: "0.72rem", color: "#b0a898", lineHeight: 1.3, margin: 0 }}>{s.email || "N/A"}</p>
                            </div>
                          </div>
                        </td>
                        <td className="hidden lg:table-cell" style={{ padding: "12px 16px" }}>
                          <code style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "0.77rem", fontWeight: 600, background: "linear-gradient(135deg,#f2ede4,#eae6dc)", color: "#4a453c", border: "1px solid #ddd8ce", padding: "4px 10px", borderRadius: 7, letterSpacing: "0.03em" }}>{s.enrollment_no || "N/A"}</code>
                        </td>
                        <td className="hidden md:table-cell" style={{ padding: "12px 16px" }}>
                          <span style={{ fontSize: "0.85rem", color: "#3a3830", fontWeight: 600, background: "#f5f3ee", padding: "4px 9px", borderRadius: 6, border: "1px solid #e8e4dc" }}>{s.department || "N/A"}</span>
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          <span style={{ display: "inline-flex", alignItems: "center", padding: "4px 11px", borderRadius: 50, fontSize: "0.74rem", fontWeight: 700, background: BB.bg, color: BB.c, border: `1.5px solid ${BB.b}`, letterSpacing: "0.02em" }}>{s.batch || "N/A"}</span>
                        </td>
                        <td className="hidden xl:table-cell" style={{ padding: "12px 16px" }}>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 12px", borderRadius: 50, fontSize: "0.74rem", fontWeight: 600, background: badge.bg, color: badge.c, border: `1.5px solid ${badge.b}` }}>
                            <span style={{ width: 6, height: 6, borderRadius: "50%", background: badge.d, flexShrink: 0 }} />{s.member_type || "Member"}
                          </span>
                        </td>
                        <td style={{ padding: "12px 16px", textAlign: "center" as const }}>
                          {canEdit && (
                            <div style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                              <button title="Edit" onClick={() => openEdit(s)} style={{ width: 30, height: 30, borderRadius: 8, border: "1.5px solid #c8d8c0", background: "#edf6f0", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "all 0.15s" }} onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = "#d4ecdc")} onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = "#edf6f0")}><Pencil size={13} color="#1e5c42" /></button>
                              <button title="Deactivate" onClick={() => handleDel(s)} style={{ width: 30, height: 30, borderRadius: 8, border: "1.5px solid #f4c0c4", background: "#fdedf0", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "all 0.15s" }} onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = "#f8d0d4")} onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = "#fdedf0")}><Trash2 size={13} color="#c0363a" /></button>
                            </div>
                          )}
                        </td>
                      </motion.tr>
                    );
                  })}
                </AnimatePresence>
              </tbody>
            </table>
          </div>

          {filtered.length === 0 && <div style={{ textAlign: "center", padding: "4rem 1rem" }}><div style={{ fontSize: "2.5rem", marginBottom: 10 }}>🎓</div><p style={{ fontSize: "0.9rem", color: "#b0a898", fontWeight: 500 }}>No students match your criteria.</p></div>}

          {filtered.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "13px 24px", borderTop: "2px solid #ece8e0", background: "linear-gradient(90deg,#f6f4ef,#faf9f6)" }}>
              <span style={{ fontSize: "0.78rem", color: "#a09880", fontWeight: 600 }}>Showing {Math.min((page - 1) * PG + 1, filtered.length)}–{Math.min(page * PG, filtered.length)} of {filtered.length}</span>
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={{ width: 32, height: 32, borderRadius: "50%", border: "1.5px solid #ddd8ce", background: "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: page === 1 ? "not-allowed" : "pointer", color: page === 1 ? "#d0ccc4" : "#5a5248" }}><ChevronLeft size={14} /></button>
                {Array.from({ length: Math.min(pages, 4) }, (_, i) => i + 1).map(n => (
                  <button key={n} onClick={() => setPage(n)} style={{ width: 32, height: 32, borderRadius: "50%", border: page === n ? "none" : "1.5px solid #ddd8ce", background: page === n ? GRN : "transparent", color: page === n ? "#fff" : "#6a6058", fontSize: "0.82rem", fontWeight: page === n ? 700 : 500, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: page === n ? "0 3px 10px rgba(26,74,52,0.32)" : "none", transition: "all 0.18s" }}>{n}</button>
                ))}
                {pages > 4 && <span style={{ color: "#a09888", padding: "0 2px" }}>…</span>}
                <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages} style={{ width: 32, height: 32, borderRadius: "50%", border: "1.5px solid #ddd8ce", background: "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: page === pages ? "not-allowed" : "pointer", color: page === pages ? "#d0ccc4" : "#5a5248" }}><ChevronRight size={14} /></button>
              </div>
              <span style={{ fontSize: "0.78rem", color: "#a09880", fontWeight: 600 }}>Page {page} of {pages}</span>
            </div>
          )}

          <div style={{ padding: "9px 24px", borderTop: "1px solid #f0ece4", background: "#faf8f4" }}>
            <p style={{ fontSize: "0.7rem", color: "#c0b8b0", margin: 0 }}>* Deactivating a student will remove their active status from the system.</p>
          </div>
        </motion.div>
      )}

      {!canEdit && <p style={{ fontSize: "0.75rem", color: "#b8b0a8", marginTop: 12 }}>Read-only access — only admin can edit students.</p>}
    </div>
  );
}