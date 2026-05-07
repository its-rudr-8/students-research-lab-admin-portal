import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Loader2, Pencil, Plus, Trash2, BookOpen } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { hasWriteAccess } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { adminAPI } from "@/lib/adminApi";

const PUBLICATION_TYPES = [
  { label: "Conference", value: "conference" },
  { label: "Journal", value: "journal" },
  { label: "Book Chapter", value: "book chapter" },
  { label: "Patent", value: "patent" },
];

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
}

export default function Publications() {
  const [publications, setPublications] = useState<Publication[]>([]);
  const [loading, setLoading] = useState(true);
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
  });
  const { toast } = useToast();
  const canEdit = hasWriteAccess();

  useEffect(() => {
    fetchPublications();
  }, []);

  const fetchPublications = async () => {
    try {
      setLoading(true);
      const response = await adminAPI.getPublications();

      if (response.success && Array.isArray(response.data)) {
        const sorted = response.data.sort((a: any, b: any) =>
          new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
        );
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
      toast({
        variant: "destructive",
        title: "Read-only access",
        description: "Only admin can add publications.",
      });
      return;
    }

    if (!formData.title.trim()) {
      toast({
        variant: "destructive",
        title: "Missing required fields",
        description: "Title is required.",
      });
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
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
        year: formData.year || new Date().getFullYear(),
      };

      const response = await adminAPI.createPublication(payload);

      if (response.success || response.data) {
        toast({
          title: "Success",
          description: "Publication added successfully",
        });
        setOpen(false);
        setFormData({
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
        });
        fetchPublications();
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to add publication",
      });
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

    try {
      setEditSubmitting(true);
      const payload = {
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
        year: editFormData.year || new Date().getFullYear(),
      };

      const response = await adminAPI.updatePublication(editingPublication.id, payload);

      if (response.success || response.data) {
        toast({
          title: "Success",
          description: "Publication updated successfully",
        });
        setEditOpen(false);
        setEditingPublication(null);
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

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <BookOpen className="w-6 h-6" />
            Publications
          </h2>
          <p className="text-sm text-muted-foreground mt-1">Manage academic publications and research papers</p>
        </div>
        {canEdit && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 rounded-lg">
                <Plus className="w-4 h-4" /> Add Publication
              </Button>
            </DialogTrigger>
            <DialogContent className="rounded-xl sm:max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add Publication</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Title *</Label>
                  <Input
                    placeholder="Publication title"
                    className="rounded-lg"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Authors</Label>
                  <Input
                    placeholder="Comma-separated author names"
                    className="rounded-lg"
                    value={formData.authors}
                    onChange={(e) => setFormData({ ...formData, authors: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Published Date</Label>
                    <Input
                      type="date"
                      className="rounded-lg"
                      value={formData.published_date}
                      onChange={(e) => setFormData({ ...formData, published_date: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Conference Date</Label>
                    <Input
                      type="date"
                      className="rounded-lg"
                      value={formData.conference_date}
                      onChange={(e) => setFormData({ ...formData, conference_date: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Type of Publication</Label>
                  <Select value={formData.type_of_publication} onValueChange={(value) => setFormData({ ...formData, type_of_publication: value })}>
                    <SelectTrigger className="rounded-lg">
                      <SelectValue placeholder="Select publication type" />
                    </SelectTrigger>
                    <SelectContent>
                      {PUBLICATION_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Publisher</Label>
                  <Input
                    placeholder="Publisher name"
                    className="rounded-lg"
                    value={formData.publisher}
                    onChange={(e) => setFormData({ ...formData, publisher: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Department</Label>
                    <Input
                      placeholder="Department"
                      className="rounded-lg"
                      value={formData.department}
                      onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Institute</Label>
                    <Input
                      placeholder="Institute name"
                      className="rounded-lg"
                      value={formData.institute}
                      onChange={(e) => setFormData({ ...formData, institute: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Link to Paper</Label>
                  <Input
                    placeholder="https://..."
                    className="rounded-lg"
                    value={formData.link_to_paper}
                    onChange={(e) => setFormData({ ...formData, link_to_paper: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Venue</Label>
                  <Input
                    placeholder="Conference/Journal venue"
                    className="rounded-lg"
                    value={formData.venue}
                    onChange={(e) => setFormData({ ...formData, venue: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Year</Label>
                    <Input
                      type="number"
                      placeholder="Year"
                      className="rounded-lg"
                      value={formData.year}
                      onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value) || new Date().getFullYear() })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Category</Label>
                    <Input
                      placeholder="e.g., Indexed, SRL"
                      className="rounded-lg"
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    placeholder="Brief description"
                    className="rounded-lg resize-none"
                    rows={3}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>
                <div className="flex justify-end gap-3 pt-4">
                  <Button
                    variant="outline"
                    className="rounded-lg"
                    onClick={() => setOpen(false)}
                    disabled={submitting}
                  >
                    Cancel
                  </Button>
                  <Button
                    className="rounded-lg"
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
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Empty State */}
      {!loading && publications.length === 0 && (
        <div className="text-center py-12 bg-muted/30 rounded-lg border border-border">
          <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
          <p className="text-muted-foreground">No publications found</p>
        </div>
      )}

      {/* Publications Grid */}
      {!loading && publications.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {publications.map((publication, index) => (
            <motion.div
              key={publication.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="p-4 border border-border rounded-lg hover:border-primary/50 hover:shadow-md transition-all"
            >
              <div className="flex justify-between items-start gap-2 mb-3">
                <div className="flex-1">
                  <h3 className="font-semibold text-foreground line-clamp-2">{publication.title}</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    {publication.student_authors || publication.authors || "No authors"}
                  </p>
                </div>
                {canEdit && (
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleEditPublication(publication)}
                      className="p-1.5 hover:bg-muted rounded-md transition-colors"
                      title="Edit"
                    >
                      <Pencil className="w-4 h-4 text-blue-600" />
                    </button>
                    <button
                      onClick={() => handleDeletePublication(publication.id)}
                      className="p-1.5 hover:bg-muted rounded-md transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </button>
                  </div>
                )}
              </div>
              <div className="space-y-2 text-sm">
                {publication.venue && (
                  <p className="text-muted-foreground">
                    <span className="font-medium">Venue:</span> {publication.venue}
                  </p>
                )}
                {publication.type_of_publication && (
                  <p className="text-muted-foreground">
                    <span className="font-medium">Type:</span> {publication.type_of_publication}
                  </p>
                )}
                {(publication.published_date || publication.date) && (
                  <p className="text-muted-foreground">
                    <span className="font-medium">Date:</span> {publication.published_date || publication.date}
                  </p>
                )}
                {publication.year && (
                  <p className="text-muted-foreground">
                    <span className="font-medium">Year:</span> {publication.year}
                  </p>
                )}
                {publication.category && (
                  <p className="text-muted-foreground">
                    <span className="font-medium">Category:</span> {publication.category}
                  </p>
                )}
                {publication.link_to_paper && (
                  <a
                    href={publication.link_to_paper}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline inline-block"
                  >
                    View Paper →
                  </a>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Edit Dialog */}
      {editingPublication && (
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent className="rounded-xl sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Publication</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Title *</Label>
                <Input
                  placeholder="Publication title"
                  className="rounded-lg"
                  value={editFormData.title}
                  onChange={(e) => setEditFormData({ ...editFormData, title: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Authors</Label>
                <Input
                  placeholder="Comma-separated author names"
                  className="rounded-lg"
                  value={editFormData.authors}
                  onChange={(e) => setEditFormData({ ...editFormData, authors: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Published Date</Label>
                  <Input
                    type="date"
                    className="rounded-lg"
                    value={editFormData.published_date}
                    onChange={(e) => setEditFormData({ ...editFormData, published_date: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Conference Date</Label>
                  <Input
                    type="date"
                    className="rounded-lg"
                    value={editFormData.conference_date}
                    onChange={(e) => setEditFormData({ ...editFormData, conference_date: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Type of Publication</Label>
                <Select value={editFormData.type_of_publication} onValueChange={(value) => setEditFormData({ ...editFormData, type_of_publication: value })}>
                  <SelectTrigger className="rounded-lg">
                    <SelectValue placeholder="Select publication type" />
                  </SelectTrigger>
                  <SelectContent>
                    {PUBLICATION_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Publisher</Label>
                <Input
                  placeholder="Publisher name"
                  className="rounded-lg"
                  value={editFormData.publisher}
                  onChange={(e) => setEditFormData({ ...editFormData, publisher: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Department</Label>
                  <Input
                    placeholder="Department"
                    className="rounded-lg"
                    value={editFormData.department}
                    onChange={(e) => setEditFormData({ ...editFormData, department: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Institute</Label>
                  <Input
                    placeholder="Institute name"
                    className="rounded-lg"
                    value={editFormData.institute}
                    onChange={(e) => setEditFormData({ ...editFormData, institute: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Link to Paper</Label>
                <Input
                  placeholder="https://..."
                  className="rounded-lg"
                  value={editFormData.link_to_paper}
                  onChange={(e) => setEditFormData({ ...editFormData, link_to_paper: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Venue</Label>
                <Input
                  placeholder="Conference/Journal venue"
                  className="rounded-lg"
                  value={editFormData.venue}
                  onChange={(e) => setEditFormData({ ...editFormData, venue: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Year</Label>
                  <Input
                    type="number"
                    placeholder="Year"
                    className="rounded-lg"
                    value={editFormData.year}
                    onChange={(e) => setEditFormData({ ...editFormData, year: parseInt(e.target.value) || new Date().getFullYear() })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Input
                    placeholder="e.g., Indexed, SRL"
                    className="rounded-lg"
                    value={editFormData.category}
                    onChange={(e) => setEditFormData({ ...editFormData, category: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  placeholder="Brief description"
                  className="rounded-lg resize-none"
                  rows={3}
                  value={editFormData.description}
                  onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <Button
                  variant="outline"
                  className="rounded-lg"
                  onClick={() => setEditOpen(false)}
                  disabled={editSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  className="rounded-lg"
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
