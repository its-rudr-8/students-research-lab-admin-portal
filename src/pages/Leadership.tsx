import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Plus, Edit, Mail, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { adminAPI } from "@/lib/adminApi";
import { useToast } from "@/hooks/use-toast";

export default function Leadership() {
  const [open, setOpen] = useState(false);
  const [leaders, setLeaders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchLeaders();
  }, []);

  const fetchLeaders = async () => {
    try {
      setLoading(true);
      const data = await adminAPI.getLeadership();
      setLeaders(data || []);
    } catch (error: any) {
      toast({
        title: "Error fetching leadership",
        description: error.message || "Could not load leadership data.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5 max-w-5xl">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="rounded-xl gap-1.5">
              <Plus className="w-3.5 h-3.5" /> Add Leader
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-2xl sm:max-w-md">
            <DialogHeader><DialogTitle>Add Research Leader</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-1.5"><Label>Full Name</Label><Input placeholder="Enter name" className="rounded-xl" /></div>
              <div className="space-y-1.5"><Label>Role / Position</Label><Input placeholder="e.g. Principal Investigator" className="rounded-xl" /></div>
              <div className="space-y-1.5"><Label>Bio</Label><Textarea placeholder="Brief bio..." className="rounded-xl resize-none" rows={3} /></div>
              <div className="space-y-1.5">
                <Label>Profile Image</Label>
                <div className="border-2 border-dashed border-border rounded-xl p-6 text-center cursor-pointer hover:border-primary/40 transition-colors">
                  <p className="text-sm text-muted-foreground">Click to upload</p>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" className="rounded-xl" onClick={() => setOpen(false)}>Cancel</Button>
                <Button className="rounded-xl" onClick={() => setOpen(false)}>Add</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {loading ? (
          <div className="col-span-2 flex justify-center py-10">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : leaders.length === 0 ? (
          <div className="col-span-2 text-center py-10 text-muted-foreground">
            No leaders found.
          </div>
        ) : (
          leaders.map((leader, i) => (
          <motion.div
            key={leader.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08, duration: 0.4 }}
            whileHover={{ y: -2 }}
            className="glass-card rounded-2xl p-6"
          >
            <div className="flex items-start gap-4">
              <Avatar className="w-14 h-14 shrink-0">
                <AvatarFallback className="bg-primary/10 text-primary text-lg font-semibold">{leader.initials}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-semibold text-foreground">{leader.name}</h3>
                <p className="text-xs font-medium text-primary mt-0.5">{leader.position}</p>
                <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{leader.bio}</p>
                <div className="flex gap-2 mt-3">
                  <Button variant="outline" size="sm" className="rounded-lg gap-1.5 h-7 text-xs">
                    <Edit className="w-3 h-3" /> Edit
                  </Button>
                  <Button variant="ghost" size="sm" className="rounded-lg gap-1.5 h-7 text-xs">
                    <Mail className="w-3 h-3" /> Contact
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        )))}
      </div>
    </div>
  );
}