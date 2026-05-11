import { useEffect, useState, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Loader2, Download, Filter, Calendar, Mail, Phone, ExternalLink, ChevronLeft, ChevronRight, CheckCircle, XCircle } from "lucide-react";
import { adminAPI, parseList } from "@/lib/adminApi";
import { motion, AnimatePresence } from "framer-motion";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";

interface JoinUsRow {
  id: string;
  name: string;
  enrollment: string;
  semester: string;
  division: string;
  branch: string;
  college: string;
  contact: string;
  email: string;
  batch: string;
  source: string;
  department?: string | null;
  after_ug?: string | null;
  cpi?: string | null;
  ieee_membership?: string | null;
  resume_link?: string | null;
  research_expertise?: string[];
  research_publication?: string | null;
  research_ongoing?: string | null;
  status?: string;
  created_at: string;
}

const ITEMS_PER_PAGE = 8;
const GRN = "linear-gradient(135deg,#1e4a34,#122a1e)";

export default function JoinRequests() {
  const [rows, setRows] = useState<JoinUsRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [yearFilter, setYearFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const { toast } = useToast();

  useEffect(() => {
    fetchRows();
  }, []);

  const fetchRows = async () => {
    setLoading(true);
    try {
      const response = await adminAPI.getJoinRequests();
      
      setRows(
        parseList(response).map((row: any) => ({
          ...row,
          id: String(row.id),
          status: String(row.status || "pending").trim().toLowerCase(),
          batch: "2026",
          research_expertise: Array.isArray(row.research_expertise) ? row.research_expertise : [],
        }))
      );
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error fetching join requests",
        description: error.message,
      });
      setRows([]);
    }
    setLoading(false);
  };

  const filteredRows = useMemo(() => {
    if (yearFilter === "all") return rows;
    return rows.filter(r => r.batch === yearFilter);
  }, [rows, yearFilter]);

  const totalPages = Math.ceil(filteredRows.length / ITEMS_PER_PAGE);
  const pagedRows = filteredRows.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const exportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(filteredRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "JoinRequests");
    XLSX.writeFile(wb, "join_requests.xlsx");
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    autoTable(doc, {
      head: [
        [
          "Name", "Enrollment", "Semester", "Division", "Branch", "College", "Contact", "Email", "Batch", "Created At"
        ]
      ],
      body: filteredRows.map(r => [
        r.name, r.enrollment, r.semester, r.division, r.branch, r.college, r.contact, r.email, r.batch, r.created_at
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [22, 178, 157] },
      margin: { top: 20 },
    });
    doc.save("join_requests.pdf");
  };

  const handleAccept = async (id: string) => {
    setUpdatingId(id);
    try {
      await adminAPI.updateJoinRequest(id, "approved");
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status: "approved" } : r)));
      toast({ title: "Request accepted" });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } finally {
      setUpdatingId(null);
    }
  };

  const handleReject = async (id: string) => {
    setUpdatingId(id);
    try {
      await adminAPI.updateJoinRequest(id, "rejected");
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status: "rejected" } : r)));
      toast({ title: "Request rejected" });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } finally {
      setUpdatingId(null);
    }
  };

  const formatValue = (value: unknown) => {
    if (Array.isArray(value)) return value.length > 0 ? value.join(", ") : "-";
    const text = String(value || "").trim();
    return text.length > 0 ? text : "-";
  };

  return (
    <div className="max-w-[1400px] mx-auto space-y-6 px-4 pb-12" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-white p-6 rounded-2xl shadow-sm border border-[#EAD8C0]/50">
        <div>
          <h2 className="text-2xl font-bold text-[#4a453c] flex items-center gap-2">
            <Filter className="w-6 h-6 text-teal-700" />
            Join Requests
          </h2>
          <p className="text-sm text-[#8a7e72] mt-1 font-medium">Manage and review student applications for SRL membership.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-2 bg-[#FAF7F2] p-1.5 rounded-xl border border-[#EAD8C0]/60">
            <Calendar className="w-4 h-4 text-[#8a7e72] ml-2" />
            <Select value={yearFilter} onValueChange={(v) => { setYearFilter(v); setCurrentPage(1); }}>
              <SelectTrigger className="w-[130px] border-none bg-transparent h-9 text-sm font-semibold text-[#5a5248] focus:ring-0">
                <SelectValue placeholder="Year Filter" />
              </SelectTrigger>
              <SelectContent className="bg-[#FAF7F2] border-[#EAD8C0]">
                <SelectItem value="all">All Batches</SelectItem>
                <SelectItem value="2025">Batch 2025</SelectItem>
                <SelectItem value="2026">Batch 2026</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="h-10 w-[1px] bg-[#EAD8C0]/50 hidden md:block" />

          <div className="flex gap-2">
            <Button onClick={exportExcel} variant="outline" className="gap-2 rounded-xl border-[#EAD8C0] text-[#5a5248] hover:bg-[#FAF7F2] font-semibold">
              <Download className="w-4 h-4" /> Excel
            </Button>
            <Button onClick={exportPDF} variant="outline" className="gap-2 rounded-xl border-[#EAD8C0] text-[#5a5248] hover:bg-[#FAF7F2] font-semibold">
              <Download className="w-4 h-4" /> PDF
            </Button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center h-80 gap-4">
          <Loader2 className="w-10 h-10 animate-spin text-teal-700" />
          <p className="text-[#8a7e72] font-medium animate-pulse">Fetching request data...</p>
        </div>
      ) : filteredRows.length === 0 ? (
        <div className="text-center py-24 bg-white rounded-2xl border border-dashed border-[#EAD8C0] shadow-sm">
          <div className="text-5xl mb-4">📂</div>
          <h3 className="text-lg font-bold text-[#4a453c]">No join requests found</h3>
          <p className="text-[#8a7e72] mt-1">There are no applications matching the current filter.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4">
            <AnimatePresence mode="popLayout">
              {pagedRows.map((r, idx) => (
                <motion.div
                  key={r.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: idx * 0.05 }}
                  className="bg-white rounded-2xl border border-[#EAD8C0]/60 shadow-sm hover:shadow-md transition-all overflow-hidden group mb-4"
                >
                  <div className="flex flex-col xl:flex-row items-stretch min-h-[180px]">
                    {/* Section 1: Profile Info */}
                    <div className="p-5 xl:w-[22%] bg-[#FAF7F2]/30 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center gap-4 mb-4">
                          <div className="w-12 h-12 rounded-full bg-teal-100 flex items-center justify-center text-teal-800 font-bold text-lg border-2 border-teal-200 shadow-sm">
                            {r.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <h3 className="font-bold text-[#1a1810] text-lg leading-tight">{r.name}</h3>
                            <span className="text-[11px] font-bold text-teal-700 uppercase tracking-wider">{r.batch} Batch</span>
                          </div>
                        </div>
                        
                        <div className="space-y-2.5">
                          <div className="flex items-center gap-2 text-sm text-[#5a5248]">
                            <Mail className="w-4 h-4 text-[#8a7e72]" />
                            <span className="truncate" title={r.email}>{r.email}</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-[#5a5248]">
                            <Phone className="w-4 h-4 text-[#8a7e72]" />
                            <span>{r.contact}</span>
                          </div>
                        </div>
                      </div>

                      <div className="pt-4">
                         <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          r.status === 'approved' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                          r.status === 'rejected' ? 'bg-rose-100 text-rose-800 border border-rose-200' :
                          'bg-amber-100 text-amber-800 border border-amber-200'
                        }`}>
                          {r.status === 'approved' ? 'Accepted' : r.status === 'rejected' ? 'Rejected' : 'Pending'}
                        </span>
                      </div>
                    </div>

                    <div className="hidden xl:block w-[1px] bg-[#EAD8C0]" />

                    {/* Section 2: Academic Details */}
                    <div className="p-5 xl:w-[22%] grid grid-cols-2 gap-4 h-full items-start">
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-[#b0a898] uppercase">Enrollment</p>
                        <code className="text-xs font-bold text-[#4a453c] bg-[#FAF7F2] px-2 py-1 rounded border border-[#EAD8C0]/40">{r.enrollment}</code>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-[#b0a898] uppercase">Semester</p>
                        <p className="text-sm font-semibold text-[#5a5248]">{r.semester} (Div {r.division})</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-[#b0a898] uppercase">Branch</p>
                        <p className="text-sm font-semibold text-[#5a5248]">{r.branch}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-[#b0a898] uppercase">College</p>
                        <p className="text-xs font-semibold text-[#5a5248] leading-tight">{r.college}</p>
                      </div>
                    </div>

                    <div className="hidden xl:block w-[1px] bg-[#EAD8C0]" />

                    {/* Section 3: Research & Expertise */}
                    <div className="p-5 xl:w-[25%] space-y-4">
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-[#b0a898] uppercase">Research Expertise</p>
                        <div className="flex flex-wrap gap-1">
                          {r.research_expertise && r.research_expertise.length > 0 ? (
                            r.research_expertise.map((exp, i) => (
                              <span key={i} className="text-[10px] bg-stone-100 text-[#5a5248] px-2 py-0.5 rounded-md border border-stone-200 font-medium">{exp}</span>
                            ))
                          ) : <span className="text-xs text-[#8a7e72] italic">No expertise listed</span>}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-[#b0a898] uppercase">CPI / GPA</p>
                        <p className="text-sm font-bold text-teal-800">{formatValue(r.cpi)}</p>
                      </div>
                      {r.resume_link && (
                        <a href={r.resume_link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs font-bold text-teal-700 hover:text-teal-800 hover:underline transition-colors mt-2">
                          <ExternalLink className="w-3.5 h-3.5" /> View Resume
                        </a>
                      )}
                    </div>

                    <div className="hidden xl:block w-[1px] bg-[#EAD8C0]" />

                    {/* Section 4: Other Details & Actions */}
                    <div className="p-5 xl:flex-1 flex flex-col justify-between">
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-[#b0a898] uppercase">Other Details</p>
                        <p className="text-xs text-[#5a5248] leading-relaxed line-clamp-3">
                          <span className="font-bold">After UG:</span> {formatValue(r.after_ug)}<br/>
                          <span className="font-bold">IEEE:</span> {formatValue(r.ieee_membership)}<br/>
                          <span className="font-bold">Pubs:</span> {formatValue(r.research_publication)}
                        </p>
                      </div>

                      <div className="flex justify-end items-center gap-3 pt-6 relative z-30">
                        {r.status === 'pending' || !r.status ? (
                          <>
                            <Button 
                              size="sm" 
                              onClick={() => handleAccept(r.id)}
                              disabled={updatingId === r.id}
                              className="bg-gradient-to-br from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white rounded-full h-10 px-6 font-bold transition-all shadow-md hover:shadow-lg active:scale-95 cursor-pointer gap-2 border-b-2 border-teal-800/30"
                            >
                              {updatingId === r.id ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                                <>
                                  <CheckCircle className="w-4 h-4" />
                                  Accept
                                </>
                              )}
                            </Button>
                            <Button 
                              size="sm" 
                              onClick={() => handleReject(r.id)}
                              disabled={updatingId === r.id}
                              className="bg-gradient-to-br from-rose-500 to-red-600 hover:from-rose-600 hover:to-red-700 text-white rounded-full h-10 px-6 font-bold transition-all shadow-md hover:shadow-lg active:scale-95 cursor-pointer gap-2 border-b-2 border-red-800/30"
                            >
                              <XCircle className="w-4 h-4" />
                              Reject
                            </Button>
                          </>
                        ) : (
                          <div className={`text-xs font-bold italic px-5 py-2.5 rounded-xl border flex items-center gap-2 ${
                            r.status === 'approved' 
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 shadow-sm' 
                              : 'bg-rose-50 text-rose-700 border-rose-200 shadow-sm'
                          }`}>
                            {r.status === 'approved' ? <CheckCircle className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                            This request has been {r.status === 'approved' ? 'accepted' : 'rejected'}.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* Footer Bar */}
                  <div className="px-5 py-2 bg-stone-50/50 border-t border-[#EAD8C0]/30 flex justify-between items-center">
                    <span className="text-[10px] text-[#b0a898] font-medium italic">Applied via {r.source || 'Direct'}</span>
                    <span className="text-[10px] text-[#b0a898] font-medium">{new Date(r.created_at).toLocaleString()}</span>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-4 bg-white rounded-2xl border border-[#EAD8C0]/50 shadow-sm mt-6">
              <span className="text-xs font-bold text-[#8a7e72]">
                Showing {Math.min((currentPage - 1) * ITEMS_PER_PAGE + 1, filteredRows.length)}–{Math.min(currentPage * ITEMS_PER_PAGE, filteredRows.length)} of {filteredRows.length}
              </span>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="w-9 h-9 rounded-full border border-[#EAD8C0] flex items-center justify-center text-[#5a5248] disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#FAF7F2] transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(n => (
                  <button 
                    key={n}
                    onClick={() => setCurrentPage(n)}
                    className={`w-9 h-9 rounded-full text-sm font-bold transition-all ${
                      currentPage === n 
                        ? 'bg-teal-700 text-white shadow-lg shadow-teal-700/20' 
                        : 'text-[#5a5248] hover:bg-[#FAF7F2]'
                    }`}
                  >
                    {n}
                  </button>
                ))}
                <button 
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="w-9 h-9 rounded-full border border-[#EAD8C0] flex items-center justify-center text-[#5a5248] disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#FAF7F2] transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}