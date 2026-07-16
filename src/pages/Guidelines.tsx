import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, FileText, Upload, Loader2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { adminAPI, parseList } from "@/lib/adminApi";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface Guideline {
  id: number;
  year: number;
  pdf_url: string;
  uploaded_at: string;
}

export default function Guidelines() {
  const [open, setOpen] = useState(false);
  const [guidelines, setGuidelines] = useState<Guideline[]>([]);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(new Date().getFullYear());
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchGuidelines();
  }, []);

  const fetchGuidelines = async () => {
    try {
      setLoading(true);
      const res = await adminAPI.getGuidelines();
      setGuidelines(parseList(res));
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error fetching guidelines", description: error.message || "Could not load guidelines." });
    } finally {
      setLoading(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) setFile(dropped);
  };

  const handleUpload = async () => {
    if (!year) {
      toast({ variant: "destructive", title: "Missing year", description: "Please select a year." });
      return;
    }
    if (!file) {
      toast({ variant: "destructive", title: "Missing file", description: "Please choose a PDF to upload." });
      return;
    }
    try {
      setSubmitting(true);
      await adminAPI.uploadGuideline(year, file);
      toast({ title: "Success", description: `Guidelines for ${year} saved.` });
      setOpen(false);
      setFile(null);
      fetchGuidelines();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Upload failed", description: error.message || "Failed to upload guidelines." });
    } finally {
      setSubmitting(false);
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
    <div className="min-h-full">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-white p-6 rounded-2xl shadow-sm border border-[#EAD8C0]/50">
          <div>
            <h2 className="text-2xl font-bold text-[#4a453c] flex items-center gap-2">
              <FileText className="w-6 h-6 text-teal-700" />
              Guidelines
            </h2>
            <p className="text-sm text-[#8a7e72] mt-1 font-medium">Manage the yearly SRL Rules &amp; Regulations PDF.</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="bg-teal-700 hover:bg-teal-800 text-white rounded-xl gap-2 font-bold shadow-md">
                <Plus className="w-4 h-4" /> Upload Guidelines
              </Button>
            </DialogTrigger>
            <DialogContent className="rounded-[32px] max-w-[92vw] sm:max-w-md max-h-[90vh] overflow-y-auto bg-[#FAF7F2] border-[#EAD8C0]/50 shadow-2xl p-4 sm:p-6">
              <DialogHeader><DialogTitle className="text-[#8B735B] font-bold">Upload Guidelines PDF</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-1.5">
                  <Label className="text-[#8B735B] font-bold">Year</Label>
                  <Input
                    type="number"
                    className="rounded-xl border-[#EAD8C0]/40 bg-white"
                    value={year}
                    onChange={(e) => setYear(Number(e.target.value))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[#8B735B] font-bold">PDF File</Label>
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                    className="border-2 border-dashed border-[#EAD8C0] rounded-2xl p-6 flex flex-col items-center justify-center bg-white/50 hover:bg-white hover:border-teal-600/50 transition-all cursor-pointer group min-h-[120px]"
                  >
                    {file ? (
                      <p className="text-sm text-[#8B735B] font-bold">{file.name}</p>
                    ) : (
                      <>
                        <div className="w-10 h-10 rounded-full bg-[#FAF7F2] flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                          <Upload className="w-5 h-5 text-[#8B735B]" />
                        </div>
                        <p className="text-xs font-bold text-[#8B735B]">Click or drag PDF here</p>
                      </>
                    )}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="application/pdf"
                      className="hidden"
                      onChange={(e) => setFile(e.target.files?.[0] || null)}
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" className="rounded-xl border-[#EAD8C0]" onClick={() => setOpen(false)} disabled={submitting}>Cancel</Button>
                  <Button className="rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-bold" onClick={handleUpload} disabled={submitting}>
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {guidelines.length === 0 ? (
          <div className="text-center py-24 bg-white rounded-2xl border border-dashed border-[#EAD8C0] shadow-sm">
            <FileText className="w-10 h-10 text-[#EAD8C0] mx-auto mb-3" />
            <h3 className="text-lg font-bold text-[#4a453c]">No guidelines uploaded yet</h3>
            <p className="text-[#8a7e72] mt-1">Upload a PDF above to make it available on the site.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            <AnimatePresence mode="popLayout">
              {guidelines.map((g, idx) => (
                <motion.div
                  key={g.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: idx * 0.05 }}
                  className="bg-white rounded-2xl border border-[#EAD8C0]/60 shadow-sm hover:shadow-md transition-all overflow-hidden group"
                >
                  <div className="p-5 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-teal-100 flex items-center justify-center text-teal-800 border-2 border-teal-200 shadow-sm shrink-0">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-[#1a1810] text-lg leading-tight">Guidelines {g.year}</h3>
                        <span className="text-[11px] font-bold text-teal-700 uppercase tracking-wider">{g.year} Batch</span>
                      </div>
                    </div>
                    <a href={g.pdf_url} target="_blank" rel="noopener noreferrer">
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-2 rounded-xl border-[#EAD8C0] text-[#5a5248] hover:bg-[#FAF7F2] font-semibold"
                      >
                        <ExternalLink className="w-4 h-4" /> View
                      </Button>
                    </a>
                  </div>

                  {/* Footer Bar */}
                  <div className="px-5 py-2 bg-stone-50/50 border-t border-[#EAD8C0]/30 flex justify-between items-center">
                    <span className="text-[10px] text-[#b0a898] font-medium italic">Guidelines PDF</span>
                    <span className="text-[10px] text-[#b0a898] font-medium">Uploaded {format(new Date(g.uploaded_at), "dd/MM/yyyy")}</span>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </motion.div>
    </div>
  );
}
