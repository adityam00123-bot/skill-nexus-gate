import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Star, Plus, Pencil, Trash2, ExternalLink, Download, Upload, X, Loader2, Copy, Image as ImageIcon, Link as LinkIcon, CheckSquare, EyeOff, Eye, TrendingUp, Users, BookOpen } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Checkbox } from "@/components/ui/checkbox";

const CATEGORIES = [
  "Trading", "Options", "Investing", "Technical Analysis",
  "Price Action/SMC", "Indicators & Tools", "Crypto & Forex", "Algo & AI Skills"
];

const SUBCATEGORY_MAP: Record<string, string[]> = {
  "Trading": ["Intraday Trading", "Swing Trading", "Positional Trading", "Price Action", "Algo Trading", "Scalping", "F&O Trading"],
  "Options": ["Options Basics", "Options Strategies", "Option Chain Analysis", "Greeks", "Hedging Strategies", "Iron Condor", "Bull Call Spread"],
  "Investing": ["Stock Market Basics", "Fundamental Analysis", "IPO & NFO", "Portfolio Management", "Sector Analysis", "Value Investing", "Dividend Investing"],
  "Technical Analysis": ["Candlestick Patterns", "Chart Patterns", "Support & Resistance", "Moving Averages", "RSI & MACD", "Elliott Wave", "Fibonacci"],
  "Price Action/SMC": ["Smart Money Concepts", "Order Blocks", "Fair Value Gaps", "ICT Concepts", "Liquidity Zones", "Break of Structure"],
  "Indicators & Tools": ["TradingView", "Screeners", "Scanners", "Amibroker", "Python for Trading", "Excel for Trading"],
  "Crypto & Forex": ["Crypto Basics", "Bitcoin & Altcoins", "DeFi", "NFT", "Forex Basics", "Currency Pairs", "MT4/MT5 Platform"],
  "Algo & AI Skills": ["Python Basics", "Algo Trading", "Backtesting", "AI in Trading", "Quantitative Trading"],
};
const LEVELS = ["Beginner", "Intermediate", "Advanced"];

const DEFAULT_LEARN = [
  "Master the fundamentals from scratch",
  "Build real-world trading strategies",
  "Understand risk management and position sizing",
  "Read and analyze market charts with confidence",
  "Develop a disciplined trading psychology",
  "Apply advanced techniques used by professionals",
  "Create your own personalized trading system",
  "Access exclusive community resources and support",
];

const DEFAULT_REQUIREMENTS = [
  "No prior experience required — we start from the basics",
  "A computer or mobile device with internet access",
  "A demo or real trading/demat account (guidance provided)",
  "Willingness to practice and learn consistently",
];

const DEFAULT_TAGS = [
  "trading",
  "investing",
  "stock market",
  "beginners",
  "technical analysis",
];

const CAT_COLORS: Record<string, string> = {
  "Trading": "bg-blue-500/20 text-blue-400",
  "Options": "bg-purple-500/20 text-purple-400",
  "Investing": "bg-emerald-500/20 text-emerald-400",
  "Technical Analysis": "bg-amber-500/20 text-amber-400",
  "Price Action/SMC": "bg-rose-500/20 text-rose-400",
  "Indicators & Tools": "bg-cyan-500/20 text-cyan-400",
  "Crypto & Forex": "bg-orange-500/20 text-orange-400",
  "Algo & AI Skills": "bg-indigo-500/20 text-indigo-400",
};

interface CourseForm {
  title: string; short_description: string; description: string; category: string[];
  subcategory: string[];
  instructor_name: string; instructor_bio: string; price: string; original_price: string;
  thumbnail_url: string; telegram_link: string; telegram_channel_id: string; level: string; language: string;
  duration_hours: string; total_lectures: string; manual_rating: string; manual_students: string;
  is_featured: boolean; is_free: boolean; is_published: boolean;
  what_you_learn: string[]; requirements: string[]; tags: string[];
}

const emptyForm: CourseForm = {
  title: "", short_description: "", description: "", category: [],
  subcategory: [],
  instructor_name: "", instructor_bio: "", price: "", original_price: "",
  thumbnail_url: "", telegram_link: "", telegram_channel_id: "", level: "Beginner", language: "Hindi",
  duration_hours: "", total_lectures: "", manual_rating: "", manual_students: "0",
  is_featured: false, is_free: false, is_published: true,
  what_you_learn: [], requirements: [], tags: [],
};

export default function AdminCourses() {
  const [courses, setCourses] = useState<any[]>([]);
  const [purchases, setPurchases] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [botChannels, setBotChannels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("all");
  const [subcatFilter, setSubcatFilter] = useState("all");
  const [levelFilter, setLevelFilter] = useState("all");
  const [pubFilter, setPubFilter] = useState("all");
  const [featFilter, setFeatFilter] = useState("all");
  const [page, setPage] = useState(0);
  const [catInput, setCatInput] = useState("");
  const [subcatInput, setSubcatInput] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const perPage = 20;
  const { toast } = useToast();

  const [formOpen, setFormOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<CourseForm>({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);

  const [thumbMode, setThumbMode] = useState<"url" | "upload">("url");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [manualChannelMode, setManualChannelMode] = useState(false);

  const [tagInput, setTagInput] = useState("");
  const [learnInput, setLearnInput] = useState("");
  const [reqInput, setReqInput] = useState("");

  const [csvOpen, setCsvOpen] = useState(false);
  const [csvData, setCsvData] = useState<any[]>([]);
  const [csvErrors, setCsvErrors] = useState<string[]>([]);
  const [csvImporting, setCsvImporting] = useState(false);

  const fetchCourses = useCallback(async () => {
    try {
      setLoading(true);
      const { data: cData, error: cError } = await (supabase as any)
        .from("courses")
        .select("*")
        .or("is_deleted.eq.false,is_deleted.is.null")
        .order("created_at", { ascending: false });

      if (cError) {
        console.error("Error fetching courses:", cError);
        return;
      }

      const { data: pData, error: pError } = await supabase.from("purchases").select("*");
      if (pError) console.error("Error fetching purchases:", pError);
      
      const { data: rData, error: rError } = await (supabase as any).from("reviews").select("course_id, rating");
      if (rError) console.error("Error fetching reviews:", rError);

      const { data: bData, error: bError } = await supabase.from("telegram_bot_channels").select("*").order("detected_at", { ascending: false });
      if (bError) console.error("Error fetching bot channels:", bError);
      
      setCourses(cData || []);
      setPurchases(pData || []);
      setReviews(rData || []);
      setBotChannels(bData || []);
    } catch (err) {
      console.error("Unexpected error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchCourses(); }, [fetchCourses]);

  const filtered = courses.filter((c) => {
    if (search && !c.title?.toLowerCase().includes(search.toLowerCase()) && !c.instructor_name?.toLowerCase().includes(search.toLowerCase())) return false;
    if (catFilter !== "all") {
      const cats: string[] = Array.isArray(c.category) ? c.category : (c.category ? [c.category] : []);
      if (!cats.includes(catFilter)) return false;
    }
    if (subcatFilter !== "all") {
      const subcats: string[] = Array.isArray(c.subcategory) ? c.subcategory : (c.subcategory ? [c.subcategory] : []);
      if (!subcats.includes(subcatFilter)) return false;
    }
    if (levelFilter !== "all" && c.level !== levelFilter) return false;
    if (pubFilter === "published" && !c.is_published) return false;
    if (pubFilter === "unpublished" && c.is_published) return false;
    if (featFilter === "featured" && !c.is_featured) return false;
    if (featFilter === "not-featured" && c.is_featured) return false;
    return true;
  });

  const paged = filtered.slice(page * perPage, (page + 1) * perPage);
  const totalPages = Math.ceil(filtered.length / perPage);

  // Stats Calculations
  const courseRevenueMap = useMemo(() => {
    const map = new Map<string, { students: number, revenue: number }>();
    purchases.forEach(p => {
      const existing = map.get(p.course_id) || { students: 0, revenue: 0 };
      existing.students += 1;
      existing.revenue += Number(p.price_paid) || 0;
      map.set(p.course_id, existing);
    });
    return map;
  }, [purchases]);

  const courseRatingMap = useMemo(() => {
    const map = new Map<string, { total: number, count: number }>();
    reviews.forEach(r => {
      const existing = map.get(r.course_id) || { total: 0, count: 0 };
      existing.total += Number(r.rating) || 0;
      existing.count += 1;
      map.set(r.course_id, existing);
    });
    return map;
  }, [reviews]);

  const totalCourses = courses.length; // Already filtered is_deleted=false locally via state
  const publishedCourses = courses.filter(c => c.is_published).length;
  const draftCourses = courses.filter(c => !c.is_published).length;
  const totalRevenue = purchases.reduce((sum, p) => sum + (Number(p.price_paid) || 0), 0);
  const totalStudents = purchases.length;

  const openAdd = () => {
    setEditId(null); setForm({ ...emptyForm }); setLearnInput(""); setReqInput("");
    setTagInput(""); setThumbMode("url"); setCatInput(""); setSubcatInput(""); setFormOpen(true);
  };

  const openEdit = (c: any) => {
    setEditId(c.id);
    setForm({
      title: c.title || "", short_description: c.short_description || "", description: c.description || "",
      category: Array.isArray(c.category) ? c.category : (c.category ? [c.category] : []),
      subcategory: Array.isArray(c.subcategory) ? c.subcategory : (c.subcategory ? [c.subcategory] : []),
      instructor_name: c.instructor_name || "", instructor_bio: c.instructor_bio || "",
      price: c.price != null && c.price !== 0 ? String(c.price) : "",
      original_price: c.original_price != null && c.original_price !== 0 ? String(c.original_price) : "",
      thumbnail_url: c.thumbnail_url || "", telegram_link: c.telegram_link || "",
      telegram_channel_id: c.telegram_channel_id || "",
      level: c.level || "Beginner", language: c.language || "Hindi",
      duration_hours: c.duration_hours != null && c.duration_hours !== 0 ? String(c.duration_hours) : "",
      total_lectures: c.total_lectures != null && c.total_lectures !== 0 ? String(c.total_lectures) : "",
      manual_rating: c.rating != null ? String(c.rating) : "",
      manual_students: c.total_students != null ? String(c.total_students) : "0",
      is_featured: !!c.is_featured, is_free: !!c.is_free, is_published: !!c.is_published,
      what_you_learn: c.what_you_learn || [], requirements: c.requirements || [], tags: c.tags || [],
    });
    setLearnInput(""); setReqInput(""); setTagInput(""); setCatInput(""); setSubcatInput("");
    setThumbMode(c.thumbnail_url ? "url" : "url");
    setFormOpen(true);
  };

  const buildPayload = (f: CourseForm) => ({
    title: f.title,
    short_description: f.short_description,
    description: f.description,
    category: f.category.length > 0 ? f.category : null,
    subcategory: f.subcategory.length > 0 ? f.subcategory : null,
    instructor_name: f.instructor_name,
    instructor_bio: f.instructor_bio,
    price: f.price !== "" ? Number(f.price) : null,
    original_price: f.original_price !== "" ? Number(f.original_price) : null,
    thumbnail_url: f.thumbnail_url,
    telegram_link: f.telegram_link,
    telegram_channel_id: f.telegram_channel_id || null,
    level: f.level,
    language: f.language,
    duration_hours: f.duration_hours !== "" ? Number(f.duration_hours) : null,
    total_lectures: f.total_lectures !== "" ? Number(f.total_lectures) : null,
    rating: f.manual_rating !== "" ? Number(f.manual_rating) : null,
    total_students: f.manual_students !== "" ? Number(f.manual_students) : 0,
    is_featured: f.is_featured,
    is_free: f.is_free,
    is_published: f.is_published,
    what_you_learn: f.what_you_learn.length > 0 ? f.what_you_learn : DEFAULT_LEARN,
    requirements: f.requirements.length > 0 ? f.requirements : DEFAULT_REQUIREMENTS,
    tags: f.tags.length > 0 ? f.tags : DEFAULT_TAGS,
  });

  const handleSave = async () => {
    // Validation
    const errors: string[] = [];
    if (!form.title.trim()) errors.push("Course Title is required");
    if (form.category.length === 0) errors.push("Category is required");
    if (form.price !== "" && Number(form.price) < 0) errors.push("Price must be >= 0");
    if (!form.telegram_link.trim() && !form.telegram_channel_id?.trim()) {
      errors.push("Either a Telegram Link (Legacy) or a Telegram Channel ID is required");
    }
    
    const ms = Number(form.manual_students);
    if (form.manual_students === "" || isNaN(ms) || ms < 0 || !Number.isInteger(ms)) errors.push("Manual Students must be an integer >= 0");
    
    if (form.manual_rating !== "") {
      const mr = Number(form.manual_rating);
      if (isNaN(mr) || mr < 0 || mr > 5) errors.push("Manual Rating must be between 0 and 5");
    }

    if (errors.length > 0) {
      toast({ title: "Validation Error", description: errors[0], variant: "destructive" });
      const modal = document.querySelector('[role="dialog"]');
      if (modal) modal.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setSaving(true);

    // Capture any pending inputs before building payload
    const finalLearn = [...form.what_you_learn];
    if (learnInput.trim()) finalLearn.push(learnInput.trim());

    const finalReq = [...form.requirements];
    if (reqInput.trim()) finalReq.push(reqInput.trim());

    const finalTags = [...form.tags];
    if (tagInput.trim()) {
      const t = tagInput.trim();
      if (!finalTags.includes(t)) finalTags.push(t);
    }

    const payload = buildPayload({
      ...form,
      what_you_learn: finalLearn.filter(i => i.trim() !== ""),
      requirements: finalReq.filter(i => i.trim() !== ""),
      tags: finalTags.filter(i => i.trim() !== "")
    });

    try {
      let savedCourseId = editId;
      if (editId) {
        const { error } = await supabase.from("courses").update(payload as any).eq("id", editId);
        if (error) throw error;
        toast({ title: "Course updated successfully" });
      } else {
        const { data, error } = await supabase.from("courses").insert(payload as any).select().single();
        if (error) throw error;
        savedCourseId = data.id;
        toast({ title: "Course added successfully" });
      }

      if (savedCourseId) {
        // Free up any channel previously mapped to this course
        await supabase.from("telegram_bot_channels")
          .update({ assigned_to_course_id: null })
          .eq("assigned_to_course_id", savedCourseId);
          
        // Map the new channel
        if (payload.telegram_channel_id) {
          await supabase.from("telegram_bot_channels")
            .update({ assigned_to_course_id: savedCourseId })
            .eq("channel_id", payload.telegram_channel_id);
        }
      }

      setFormOpen(false);
      fetchCourses();
    } catch (error: any) {
      console.error("Save error:", error);
      toast({ title: "Error saving course", description: error.message || "Unknown error", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      // Soft delete logic: set is_deleted = true
      const { error } = await (supabase as any).from("courses").update({ is_deleted: true }).eq("id", deleteId);
      if (error) {
        console.error("Delete error:", error);
        toast({ title: "Error deleting course", description: error.message, variant: "destructive" });
        return;
      }
      toast({ title: "Course moved to trash (soft deleted)" });
      setDeleteId(null);
      setSelectedIds(new Set([...selectedIds].filter(id => id !== deleteId)));
      fetchCourses();
    } catch (err: any) {
      console.error("Unexpected error:", err);
      toast({ title: "Error deleting course", description: err.message || "Unknown error", variant: "destructive" });
    }
  };

  const handleBulkAction = async (action: "publish" | "unpublish" | "featured" | "delete") => {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    setToggling("bulk");
    try {
      if (action === "publish") {
        const { error } = await supabase.from("courses").update({ is_published: true }).in("id", ids);
        if (error) throw error;
        toast({ title: `${ids.length} courses published` });
      } else if (action === "unpublish") {
        const { error } = await supabase.from("courses").update({ is_published: false }).in("id", ids);
        if (error) throw error;
        toast({ title: `${ids.length} courses unpublished` });
      } else if (action === "featured") {
        const { error } = await supabase.from("courses").update({ is_featured: true }).in("id", ids);
        if (error) throw error;
        toast({ title: `${ids.length} courses featured` });
      } else if (action === "delete") {
        const { error } = await (supabase as any).from("courses").update({ is_deleted: true }).in("id", ids);
        if (error) throw error;
        toast({ title: `${ids.length} courses soft deleted` });
      }
      setSelectedIds(new Set());
      fetchCourses();
    } catch (err: any) {
      console.error("Bulk action failed:", err);
      toast({ title: "Bulk action failed", description: err.message || "Unknown error", variant: "destructive" });
    } finally {
      setToggling(null);
    }
  };

  const handleDuplicate = async (c: any) => {
    try {
      const { id, created_at, updated_at, ...rest } = c;
      const { error } = await supabase.from("courses").insert({ ...rest, title: `${c.title} (Copy)`, is_published: false });
      if (error) {
        console.error("Duplicate error:", error);
        toast({ title: "Duplicate failed", description: error.message, variant: "destructive" });
        return;
      }
      toast({ title: "Course duplicated" });
      fetchCourses();
    } catch (err: any) {
      console.error("Unexpected error:", err);
      toast({ title: "Duplicate failed", description: err.message || "Unknown error", variant: "destructive" });
    }
  };

  const toggleField = async (id: string, field: "is_published" | "is_featured", current: boolean) => {
    setToggling(id + field);
    try {
      const { error } = await supabase.from("courses").update({ [field]: !current }).eq("id", id);
      if (error) {
        console.error("Toggle error:", error);
        toast({ title: "Update failed", description: error.message, variant: "destructive" });
        return;
      }
      toast({ title: `Course ${field === "is_published" ? (!current ? "published" : "unpublished") : (!current ? "featured" : "unfeatured")}` });
      setCourses(prev => prev.map(c => c.id === id ? { ...c, [field]: !current } : c));
    } catch (err: any) {
      console.error("Unexpected error:", err);
      toast({ title: "Update failed", description: err.message || "Unknown error", variant: "destructive" });
    } finally {
      setToggling(null);
    }
  };

  // Thumbnail upload — uses course-thumbnails bucket
  const handleThumbUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const allowed = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!allowed.includes(file.type)) {
      toast({ title: "Invalid file type", description: "Only JPG, PNG, WEBP allowed", variant: "destructive" });
      return;
    }
    try {
      setUploading(true);
      const ext = file.name.split(".").pop();
      const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from("course-thumbnails").upload(path, file);
      if (error) {
        console.error("Upload error:", error);
        toast({ title: "Image upload failed", description: error.message || "Please try URL instead", variant: "destructive" });
        return;
      }
      const { data: urlData } = supabase.storage.from("course-thumbnails").getPublicUrl(path);
      setForm(f => ({ ...f, thumbnail_url: urlData.publicUrl }));
      toast({ title: "Image uploaded successfully" });
    } catch (err: any) {
      console.error("Unexpected error:", err);
      toast({ title: "Image upload failed", description: err.message || "Unknown error", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const addTag = (val: string) => {
    const tag = val.trim();
    if (tag && !form.tags.includes(tag)) setForm(f => ({ ...f, tags: [...f.tags, tag] }));
    setTagInput("");
  };
  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addTag(tagInput); }
    if (e.key === "Backspace" && !tagInput && form.tags.length) {
      setForm(f => ({ ...f, tags: f.tags.slice(0, -1) }));
    }
  };

  const addLearnPoint = () => { if (learnInput.trim()) { setForm(f => ({ ...f, what_you_learn: [...f.what_you_learn, learnInput.trim()] })); setLearnInput(""); } };
  const addReqPoint = () => { if (reqInput.trim()) { setForm(f => ({ ...f, requirements: [...f.requirements, reqInput.trim()] })); setReqInput(""); } };

  // CSV
  const exportCSV = () => {
    const exportColumns = [
      "title", "description", "short_description", "price", "original_price",
      "thumbnail_url", "instructor_name", "instructor_bio", "category",
      "subcategory", "level", "language", "duration_hours", "total_lectures",
      "manual_rating", "manual_students", "is_free",
      "is_featured", "is_published", "tags", "what_you_learn", "requirements"
    ];

    const header = exportColumns.join(",") + "\n";
    const rows = courses.map(c => {
      return exportColumns.map(col => {
        // Map export column names to actual DB field names
        let val: any;
        if (col === "manual_rating") val = c["rating"];
        else if (col === "manual_students") val = c["total_students"];
        else val = c[col];

        if (val === null || val === undefined) val = "";

        if (col === "thumbnail_url" && typeof val === "string" && val.startsWith("data:")) {
          // Skip base64 strings — export empty string
          val = "";
        }

        if ((col === "category" || col === "subcategory" || col === "tags") && Array.isArray(val)) {
          val = `"${val.join(",")}"`;
        } else if ((col === "what_you_learn" || col === "requirements") && Array.isArray(val)) {
          val = `"${val.join("|")}"`;
        } else if (typeof val === "string" && val !== "") {
          val = `"${val.replace(/"/g, '""')}"`;
        }
        return val;
      }).join(",");
    }).join("\n");

    const blob = new Blob([header + rows], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `courses_export_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    toast({ title: "Export successful", description: `${courses.length} courses exported.` });
  };

  const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const lines = text.split("\n").filter(Boolean);
      if (lines.length < 2) { setCsvErrors(["CSV file must have a header and at least one row"]); return; }
      const headers = lines[0].split(",").map(h => h.trim().replace(/"/g, ""));
      const errors: string[] = [];
      const rows = lines.slice(1).map((line, idx) => {
        const vals = line.split(",").map(v => v.trim().replace(/^"|"$/g, ""));
        const obj: any = {};
        headers.forEach((h, i) => { obj[h] = vals[i] || ""; });
        if (!obj.title) errors.push(`Row ${idx + 2}: Title is required`);
        // Number fields: empty/missing → null, not 0
        obj.price = obj.price !== "" ? (Number(obj.price) || null) : null;
        obj.original_price = obj.original_price !== "" ? (Number(obj.original_price) || null) : null;
        obj.duration_hours = obj.duration_hours !== "" ? (Number(obj.duration_hours) || null) : null;
        obj.total_lectures = obj.total_lectures !== "" ? (Number(obj.total_lectures) || null) : null;
        obj.rating = obj.rating !== "" ? (Number(obj.rating) || null) : null;
        obj.total_students = obj.total_students !== "" ? (Number(obj.total_students) || null) : null;
        // Boolean fields: default to false
        obj.is_free = obj.is_free === "true";
        obj.is_featured = obj.is_featured === "true";
        
        // Force draft state and clear telegram fields for new imports
        obj.is_published = false;
        obj.status = 'draft';
        obj.telegram_channel_id = null;
        obj.telegram_link = null;

        // Handle arrays with specific separators and defaults
        if (obj.tags && typeof obj.tags === "string" && obj.tags.trim()) {
          obj.tags = obj.tags.split(",").map((t: string) => t.trim()).filter(Boolean);
        } else {
          obj.tags = DEFAULT_TAGS;
        }

        if (obj.what_you_learn && typeof obj.what_you_learn === "string" && obj.what_you_learn.trim()) {
          obj.what_you_learn = obj.what_you_learn.split("|").map((t: string) => t.trim()).filter(Boolean);
        } else {
          obj.what_you_learn = DEFAULT_LEARN;
        }

        if (obj.requirements && typeof obj.requirements === "string" && obj.requirements.trim()) {
          obj.requirements = obj.requirements.split("|").map((t: string) => t.trim()).filter(Boolean);
        } else {
          obj.requirements = DEFAULT_REQUIREMENTS;
        }
        
        // Categoria & Subcategory comma parsing
        if (obj.category && typeof obj.category === "string" && obj.category.trim()) {
           obj.category = obj.category.split(",").map((c: string) => c.trim()).filter(Boolean);
        } else {
           obj.category = null;
        }

        if (obj.subcategory && typeof obj.subcategory === "string" && obj.subcategory.trim()) {
           obj.subcategory = obj.subcategory.split(",").map((s: string) => s.trim()).filter(Boolean);
        } else {
           obj.subcategory = null;
        }

        if (!obj.instructor_name) obj.instructor_name = null;
        if (!obj.level) obj.level = null;
        return obj;
      });
      setCsvErrors(errors);
      setCsvData(rows);
    };
    reader.readAsText(file);
  };

  const importCSV = async () => {
    try {
      setCsvImporting(true);
      const cleaned = csvData.map(r => ({ ...r, title: r.title || "Untitled" }));
      const { error } = await supabase.from("courses").insert(cleaned);
      if (error) {
        console.error("Import error:", error);
        toast({ title: "Import failed", description: error.message, variant: "destructive" });
        return;
      }
      toast({ title: `${csvData.length} courses imported successfully` });
      setCsvOpen(false); setCsvData([]); setCsvErrors([]);
      fetchCourses();
    } catch (err: any) {
      console.error("Unexpected error:", err);
      toast({ title: "Import failed", description: err.message || "Unknown error", variant: "destructive" });
    } finally {
      setCsvImporting(false);
    }
  };

  const priceNum = form.price !== "" ? Number(form.price) : 0;
  const origNum = form.original_price !== "" ? Number(form.original_price) : 0;
  const discount = origNum > 0 ? Math.round(((origNum - priceNum) / origNum) * 100) : 0;

  const SectionHeading = ({ title }: { title: string }) => (
    <div className="border-b border-[#334155] pb-1 mb-3 mt-4 first:mt-0">
      <h3 className="text-sm font-semibold text-green-400 uppercase tracking-wider">{title}</h3>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold flex items-center gap-2"><BookOpen className="h-6 w-6"/> Courses ({filtered.length})</h1>
        <div className="flex gap-2 flex-wrap">
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-2 bg-[#1E293B] border border-[#334155] rounded-md px-2 mr-2">
               <span className="text-sm text-green-400 font-semibold px-2">{selectedIds.size} Selected</span>
               <div className="h-4 w-px bg-[#334155] mx-1"></div>
               <Button size="sm" variant="ghost" className="h-8 px-2" disabled={toggling === "bulk"} onClick={() => handleBulkAction("publish")}><Eye className="h-4 w-4 mr-1"/> Publish</Button>
               <Button size="sm" variant="ghost" className="h-8 px-2" disabled={toggling === "bulk"} onClick={() => handleBulkAction("unpublish")}><EyeOff className="h-4 w-4 mr-1"/> Unpublish</Button>
               <Button size="sm" variant="ghost" className="h-8 px-2 text-yellow-500" disabled={toggling === "bulk"} onClick={() => handleBulkAction("featured")}><Star className="h-4 w-4 mr-1"/> Feature</Button>
               <div className="h-4 w-px bg-[#334155] mx-1"></div>
               <Button size="sm" variant="ghost" className="h-8 px-2 text-red-500 hover:text-red-400 hover:bg-red-500/10" disabled={toggling === "bulk"} onClick={() => handleBulkAction("delete")}><Trash2 className="h-4 w-4 mr-1"/> Bulk Delete</Button>
            </div>
          )}
          <Button onClick={() => setCsvOpen(true)} variant="outline" className="gap-2 border-[#334155]"><Upload className="h-4 w-4" /> CSV Upload</Button>
          <Button onClick={exportCSV} variant="outline" className="gap-2 border-[#334155]"><Download className="h-4 w-4" /> Export</Button>
          <Button onClick={openAdd} className="gap-2 bg-green-600 hover:bg-green-700 text-white"><Plus className="h-4 w-4" /> Add New Course</Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="bg-[#1E293B] border-[#334155]">
          <CardContent className="p-4 flex flex-col justify-center gap-1">
            <p className="text-xs font-medium text-muted-foreground uppercase flex items-center gap-1.5"><BookOpen className="h-3 w-3" /> Total Courses</p>
            <p className="text-xl font-bold text-white">{totalCourses}</p>
          </CardContent>
        </Card>
        <Card className="bg-[#1E293B] border-[#334155]">
          <CardContent className="p-4 flex flex-col justify-center gap-1">
            <p className="text-xs font-medium text-muted-foreground uppercase flex items-center gap-1.5"><Eye className="h-3 w-3" /> Published</p>
            <p className="text-xl font-bold text-green-400">{publishedCourses}</p>
          </CardContent>
        </Card>
        <Card className="bg-[#1E293B] border-[#334155]">
          <CardContent className="p-4 flex flex-col justify-center gap-1">
            <p className="text-xs font-medium text-muted-foreground uppercase flex items-center gap-1.5"><EyeOff className="h-3 w-3" /> Drafts</p>
            <p className="text-xl font-bold text-muted-foreground">{draftCourses}</p>
          </CardContent>
        </Card>
        <Card className="bg-[#1E293B] border-[#334155]">
          <CardContent className="p-4 flex flex-col justify-center gap-1">
            <p className="text-xs font-medium text-muted-foreground uppercase flex items-center gap-1.5"><Users className="h-3 w-3" /> Total Students</p>
            <p className="text-xl font-bold text-white">{totalStudents.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="bg-[#1E293B] border-[#334155]">
          <CardContent className="p-4 flex flex-col justify-center gap-1">
            <p className="text-xs font-medium text-muted-foreground uppercase flex items-center gap-1.5"><TrendingUp className="h-3 w-3" /> Total Revenue</p>
            <p className="text-xl font-bold text-green-400">₹{totalRevenue.toLocaleString()}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search courses..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} className="pl-10 bg-[#1E293B] border-[#334155]" />
        </div>
        <Select value={catFilter} onValueChange={(v) => { setCatFilter(v); setSubcatFilter("all"); setPage(0); }}>
          <SelectTrigger className="w-44 bg-[#1E293B] border-[#334155]"><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent><SelectItem value="all">All Categories</SelectItem>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
        </Select>
        {/* Subcategory filter — show all subcats or filtered by selected category */}
        <Select value={subcatFilter} onValueChange={(v) => { setSubcatFilter(v); setPage(0); }}>
          <SelectTrigger className="w-48 bg-[#1E293B] border-[#334155]"><SelectValue placeholder="Subcategory" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Subcategories</SelectItem>
            {catFilter === "all" 
              ? Object.entries(SUBCATEGORY_MAP).flatMap(([cat, subs]) => 
                  subs.map(s => <SelectItem key={`${cat}-${s}`} value={s}>{s}</SelectItem>)
                )
              : (SUBCATEGORY_MAP[catFilter] || []).map(s => (
                  <SelectItem key={`${catFilter}-${s}`} value={s}>{s}</SelectItem>
                ))
            }
          </SelectContent>
        </Select>
        <Select value={levelFilter} onValueChange={(v) => { setLevelFilter(v); setPage(0); }}>
          <SelectTrigger className="w-36 bg-[#1E293B] border-[#334155]"><SelectValue placeholder="Level" /></SelectTrigger>
          <SelectContent><SelectItem value="all">All Levels</SelectItem>{LEVELS.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={pubFilter} onValueChange={(v) => { setPubFilter(v); setPage(0); }}>
          <SelectTrigger className="w-40 bg-[#1E293B] border-[#334155]"><SelectValue placeholder="Published" /></SelectTrigger>
          <SelectContent><SelectItem value="all">All Status</SelectItem><SelectItem value="published">Published</SelectItem><SelectItem value="unpublished">Unpublished</SelectItem></SelectContent>
        </Select>
        <Select value={featFilter} onValueChange={(v) => { setFeatFilter(v); setPage(0); }}>
          <SelectTrigger className="w-36 bg-[#1E293B] border-[#334155]"><SelectValue placeholder="Featured" /></SelectTrigger>
          <SelectContent><SelectItem value="all">All</SelectItem><SelectItem value="featured">Featured</SelectItem><SelectItem value="not-featured">Not Featured</SelectItem></SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card className="bg-[#1E293B] border-[#334155]">
        <CardContent className="p-0 overflow-x-auto">
          {loading ? (
            <div className="p-4 space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full bg-[#334155]" />)}</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-[#334155]">
                  <TableHead className="w-10">
                    <Checkbox 
                      checked={selectedIds.size === paged.length && paged.length > 0} 
                      onCheckedChange={(c) => {
                        if (c) setSelectedIds(new Set([...selectedIds, ...paged.map(x => x.id)]));
                        else {
                          const newSet = new Set(selectedIds);
                          paged.forEach(x => newSet.delete(x.id));
                          setSelectedIds(newSet);
                        }
                      }} 
                    />
                  </TableHead>
                  <TableHead className="w-14">Thumb</TableHead>
                  <TableHead>Course Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Subcategory</TableHead>
                  <TableHead>Instructor</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Students</TableHead>
                  <TableHead>Revenue</TableHead>
                  <TableHead>Rating</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Featured</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paged.map((c, idx) => {
                  const dynamicStats = courseRevenueMap.get(c.id) || { students: 0, revenue: 0 };
                  const display_students = dynamicStats.students + (Number(c.total_students) || 0);

                  const reviewStats = courseRatingMap.get(c.id) || { total: 0, count: 0 };
                  const dbRating = c.rating != null ? Number(c.rating) : null;
                  const avgRating = reviewStats.count > 0 ? (reviewStats.total / reviewStats.count) : 0;
                  const display_rating = dbRating !== null ? dbRating : avgRating;
                  
                  return (
                  <TableRow key={c.id} className="border-[#334155] hover:bg-[#334155]/50 transition-colors">
                    <TableCell>
                      <Checkbox checked={selectedIds.has(c.id)} onCheckedChange={(ch) => {
                        const newSet = new Set(selectedIds);
                        if (ch) newSet.add(c.id); else newSet.delete(c.id);
                        setSelectedIds(newSet);
                      }} />
                    </TableCell>
                    <TableCell>
                      {c.thumbnail_url ? (
                        <img src={c.thumbnail_url} alt="" className="h-12 w-12 rounded-lg object-cover" />
                      ) : (
                        <div className="h-12 w-12 rounded-lg bg-[#334155] flex items-center justify-center"><ImageIcon className="h-5 w-5 text-muted-foreground" /></div>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="font-medium text-sm whitespace-normal break-words max-w-[200px] block line-clamp-2" title={c.title}>{c.title}</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        {(Array.isArray(c.category) ? c.category : (c.category ? [c.category] : [])).map((cat: string) => (
                          <Badge key={cat} className={`text-xs ${CAT_COLORS[cat] || "bg-secondary/20 text-secondary"}`}>{cat}</Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        {(Array.isArray(c.subcategory) ? c.subcategory : (c.subcategory ? [c.subcategory] : [])).map((sub: string) => (
                          <span key={sub} className="text-[10px] text-muted-foreground bg-[#334155]/60 px-1.5 py-0.5 rounded">{sub}</span>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{c.instructor_name}</TableCell>
                    <TableCell>
                      {c.is_free ? (
                        <Badge className="bg-green-500/20 text-green-400">Free</Badge>
                      ) : (
                        <div className="text-sm">
                          <span className="font-semibold">₹{c.price ?? 0}</span>
                          {c.original_price != null && c.original_price > 0 && c.original_price !== c.price && (
                            <span className="text-muted-foreground line-through ml-1 text-xs">₹{c.original_price}</span>
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-sm font-medium">{display_students}</TableCell>
                    <TableCell className="text-sm text-green-400 font-semibold">₹{dynamicStats.revenue.toLocaleString()}</TableCell>
                    <TableCell>
                      <span className="flex items-center gap-1 text-sm">
                        <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                        {display_rating.toFixed(1)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <button onClick={() => toggleField(c.id, "is_published", c.is_published)} disabled={toggling === c.id + "is_published"} className="cursor-pointer">
                        <Badge className={`text-xs transition-colors ${c.is_published ? "bg-green-500/20 text-green-400 hover:bg-green-500/30" : "bg-red-500/20 text-red-400 hover:bg-red-500/30"}`}>
                          {toggling === c.id + "is_published" ? <Loader2 className="h-3 w-3 animate-spin" /> : (c.is_published ? "Published" : "Draft")}
                        </Badge>
                      </button>
                    </TableCell>
                    <TableCell>
                      <button onClick={() => toggleField(c.id, "is_featured", c.is_featured)} disabled={toggling === c.id + "is_featured"} className="cursor-pointer">
                        <Badge className={`text-xs transition-colors ${c.is_featured ? "bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30" : "bg-[#334155]/50 text-muted-foreground hover:bg-[#334155]"}`}>
                          {toggling === c.id + "is_featured" ? <Loader2 className="h-3 w-3 animate-spin" /> : (c.is_featured ? "Yes" : "No")}
                        </Badge>
                      </button>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-0.5">
                        <Button variant="ghost" size="icon" className="h-8 w-8" title="Edit" onClick={() => openEdit(c)}><Pencil className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" title="Preview" onClick={() => window.open(`/course/${c.id}`, "_blank")}><ExternalLink className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" title="Duplicate" onClick={() => handleDuplicate(c)}><Copy className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400 hover:text-red-300" title="Delete" onClick={() => setDeleteId(c.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )})}
                {paged.length === 0 && (
                  <TableRow><TableCell colSpan={12} className="text-center text-muted-foreground py-12">
                    <div className="flex flex-col items-center gap-2">
                      <Search className="h-10 w-10 text-[#334155]" />
                      <p>No courses found</p>
                    </div>
                  </TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)} className="border-[#334155]">Previous</Button>
          <span className="text-sm text-muted-foreground">Page {page + 1} of {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)} className="border-[#334155]">Next</Button>
        </div>
      )}

      {/* Add/Edit Modal */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-[#1E293B] border-[#334155]">
          <DialogHeader>
            <DialogTitle>{editId ? "Edit Course" : "Add New Course"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-1">
            {/* Section 1: Basic Info */}
            <SectionHeading title="Basic Info" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Course Title *</Label>
                <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="bg-[#0F172A] border-[#334155]" />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Category <span className="text-muted-foreground text-xs">(select multiple)</span></Label>
                {/* Chip display */}
                <div className="flex flex-wrap gap-1.5 p-2 bg-[#0F172A] border border-[#334155] rounded-md min-h-[40px] items-center">
                  {form.category.map((cat) => (
                    <Badge key={cat} className={`gap-1 text-xs ${CAT_COLORS[cat] || "bg-secondary/20 text-secondary"}`}>
                      {cat}
                      <X className="h-3 w-3 cursor-pointer" onClick={() => setForm(f => ({ ...f, category: f.category.filter(c => c !== cat), subcategory: f.subcategory.filter(s => (SUBCATEGORY_MAP[cat] || []).indexOf(s) === -1) }))} />
                    </Badge>
                  ))}
                </div>
                {/* Add category dropdown */}
                {form.category.length < CATEGORIES.length && (
                  <div className="flex gap-2">
                    <Select value={catInput} onValueChange={v => {
                      if (v && !form.category.includes(v)) {
                        setForm(f => ({ ...f, category: [...f.category, v] }));
                      }
                      setCatInput("");
                    }}>
                      <SelectTrigger className="bg-[#0F172A] border-[#334155] text-sm">
                        <SelectValue placeholder="+ Add category" />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.filter(c => !form.category.includes(c)).map(c => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Subcategory <span className="text-muted-foreground text-xs">(select multiple)</span></Label>
                {/* Chip display */}
                <div className="flex flex-wrap gap-1.5 p-2 bg-[#0F172A] border border-[#334155] rounded-md min-h-[40px] items-center">
                  {form.subcategory.map((sub) => (
                    <Badge key={sub} variant="secondary" className="gap-1 text-xs">
                      {sub}
                      <X className="h-3 w-3 cursor-pointer" onClick={() => setForm(f => ({ ...f, subcategory: f.subcategory.filter(s => s !== sub) }))} />
                    </Badge>
                  ))}
                  {form.category.length === 0 && form.subcategory.length === 0 && (
                    <span className="text-xs text-muted-foreground/50">Select a category first</span>
                  )}
                </div>
                {/* Available subcategory options based on selected categories */}
                {(() => {
                  const available = form.category.flatMap(c => SUBCATEGORY_MAP[c] || []).filter((s, i, arr) => arr.indexOf(s) === i && !form.subcategory.includes(s));
                  return (
                    <Select disabled={form.category.length === 0} value={subcatInput} onValueChange={v => {
                      if (v && !form.subcategory.includes(v)) {
                        setForm(f => ({ ...f, subcategory: [...f.subcategory, v] }));
                      }
                      setSubcatInput("");
                    }}>
                      <SelectTrigger className="bg-[#0F172A] border-[#334155] text-sm">
                        <SelectValue placeholder={form.category.length === 0 ? "Select category first" : "+ Add subcategory"} />
                      </SelectTrigger>
                      <SelectContent>
                        {available.map(s => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  );
                })()}
              </div>
              <div className="space-y-1.5">
                <Label>Level</Label>
                <Select value={form.level} onValueChange={v => setForm(f => ({ ...f, level: v }))}>
                  <SelectTrigger className="bg-[#0F172A] border-[#334155]"><SelectValue /></SelectTrigger>
                  <SelectContent>{LEVELS.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Language</Label>
                <Input value={form.language} onChange={e => setForm(f => ({ ...f, language: e.target.value }))} className="bg-[#0F172A] border-[#334155]" />
              </div>
              <div className="space-y-1.5">
                <Label>Instructor Name</Label>
                <Input value={form.instructor_name} onChange={e => setForm(f => ({ ...f, instructor_name: e.target.value }))} className="bg-[#0F172A] border-[#334155]" />
              </div>
            </div>

            {/* Section 2: Pricing */}
            <SectionHeading title="Pricing" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Selling Price (₹)</Label>
                <Input type="number" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} placeholder="e.g. 499" className="bg-[#0F172A] border-[#334155]" />
              </div>
              <div className="space-y-1.5">
                <Label>Original Price (₹) {discount > 0 && <span className="text-green-400 ml-1 text-xs">{discount}% off</span>}</Label>
                <Input type="number" value={form.original_price} onChange={e => setForm(f => ({ ...f, original_price: e.target.value }))} placeholder="e.g. 1999" className="bg-[#0F172A] border-[#334155]" />
              </div>
            </div>

            {/* Section 3: Course Details */}
            <SectionHeading title="Course Details" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Duration (hours)</Label>
                <Input type="number" value={form.duration_hours} onChange={e => setForm(f => ({ ...f, duration_hours: e.target.value }))} placeholder="e.g. 8.5" className="bg-[#0F172A] border-[#334155]" />
              </div>
              <div className="space-y-1.5">
                <Label>Total Lectures</Label>
                <Input type="number" value={form.total_lectures} onChange={e => setForm(f => ({ ...f, total_lectures: e.target.value }))} placeholder="e.g. 42" className="bg-[#0F172A] border-[#334155]" />
              </div>
              <div className="space-y-1.5">
                <Label>Manual Rating Override (0-5)</Label>
                <Input type="number" min={0} max={5} step={0.1} value={form.manual_rating} onChange={e => setForm(f => ({ ...f, manual_rating: e.target.value }))} placeholder="e.g. 4.7" className="bg-[#0F172A] border-[#334155]" />
                <p className="text-xs text-muted-foreground">Override rating manually (leave empty for auto from reviews)</p>
              </div>
              <div className="space-y-1.5">
                <Label>Manual Students Boost</Label>
                <Input type="number" min={0} value={form.manual_students} onChange={e => setForm(f => ({ ...f, manual_students: e.target.value }))} placeholder="e.g. 1000" className="bg-[#0F172A] border-[#334155]" />
                <p className="text-xs text-muted-foreground">Extra students for display (marketing boost)</p>
              </div>
            </div>

            {/* Section 4: Media */}
            <SectionHeading title="Media" />
            <div className="space-y-3">
              <div className="flex gap-2 mb-2">
                <Button type="button" size="sm" variant={thumbMode === "upload" ? "default" : "outline"} onClick={() => setThumbMode("upload")} className={thumbMode === "upload" ? "bg-green-600 hover:bg-green-700" : "border-[#334155]"}>
                  <ImageIcon className="h-3.5 w-3.5 mr-1" /> Upload Image
                </Button>
                <Button type="button" size="sm" variant={thumbMode === "url" ? "default" : "outline"} onClick={() => setThumbMode("url")} className={thumbMode === "url" ? "bg-green-600 hover:bg-green-700" : "border-[#334155]"}>
                  <LinkIcon className="h-3.5 w-3.5 mr-1" /> Paste URL
                </Button>
              </div>
              {thumbMode === "upload" ? (
                <div className="space-y-2">
                  <input ref={fileRef} type="file" accept=".jpg,.jpeg,.png,.webp" onChange={handleThumbUpload} className="hidden" />
                  <Button type="button" variant="outline" className="border-[#334155] gap-2" onClick={() => fileRef.current?.click()} disabled={uploading}>
                    {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                    {uploading ? "Uploading..." : "Choose File"}
                  </Button>
                </div>
              ) : (
                <Input placeholder="https://example.com/image.jpg" value={form.thumbnail_url} onChange={e => setForm(f => ({ ...f, thumbnail_url: e.target.value }))} className="bg-[#0F172A] border-[#334155]" />
              )}
              {form.thumbnail_url && (
                <div className="mt-2 text-center">
                  <img src={form.thumbnail_url} alt="preview" onError={(e) => { e.currentTarget.src = "/placeholder.svg"; }} className="h-[200px] w-[350px] mx-auto rounded-lg object-cover border border-[#334155] shadow-lg" />
                </div>
              )}
            </div>

            {/* Section 5: Links */}
            <SectionHeading title="Links" />
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Telegram Link (Legacy)</Label>
                <Input value={form.telegram_link} onChange={e => setForm(f => ({ ...f, telegram_link: e.target.value }))} className="bg-[#0F172A] border-[#334155]" />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label>Telegram Channel ID (Automated Access)</Label>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="manual-channel-mode" className="text-xs text-muted-foreground cursor-pointer">Manual ID Entry</Label>
                    <Switch id="manual-channel-mode" checked={manualChannelMode} onCheckedChange={setManualChannelMode} />
                  </div>
                </div>
                {manualChannelMode ? (
                  <Input value={form.telegram_channel_id} onChange={e => setForm(f => ({ ...f, telegram_channel_id: e.target.value }))} placeholder="-1001234567890" className="bg-[#0F172A] border-[#334155]" />
                ) : (
                  <Select value={form.telegram_channel_id || ""} onValueChange={(val) => setForm(f => ({ ...f, telegram_channel_id: val === "none" ? "" : val }))}>
                    <SelectTrigger className="bg-[#0F172A] border-[#334155]">
                      <SelectValue placeholder="Select a detected channel..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No Channel Assigned</SelectItem>
                      {botChannels
                        .filter(c => !c.assigned_to_course_id || c.assigned_to_course_id === editId || c.channel_id === form.telegram_channel_id)
                        .map(c => (
                        <SelectItem key={c.id} value={c.channel_id}>
                          {c.channel_title} {c.assigned_to_course_id && c.assigned_to_course_id !== editId ? "(In Use)" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>

            {/* Section 6: Description */}
            <SectionHeading title="Description" />
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Short Description</Label>
                <Textarea value={form.short_description} onChange={e => setForm(f => ({ ...f, short_description: e.target.value }))} className="bg-[#0F172A] border-[#334155]" rows={2} />
              </div>
              <div className="space-y-1.5">
                <Label>Full Description</Label>
                <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="bg-[#0F172A] border-[#334155]" rows={4} />
              </div>
            </div>

            {/* Section 7: Tags & Learning */}
            <SectionHeading title="Tags & Learning" />
            <div className="space-y-1.5">
              <Label>Tags</Label>
              <div className="flex flex-wrap gap-1.5 p-2 bg-[#0F172A] border border-[#334155] rounded-md min-h-[40px] items-center">
                {form.tags.map((tag, i) => (
                  <Badge key={i} variant="secondary" className="gap-1 text-xs">
                    {tag}
                    <X className="h-3 w-3 cursor-pointer" onClick={() => setForm(f => ({ ...f, tags: f.tags.filter((_, j) => j !== i) }))} />
                  </Badge>
                ))}
                <input
                  value={tagInput}
                  onChange={e => setTagInput(e.target.value)}
                  onKeyDown={handleTagKeyDown}
                  placeholder={form.tags.length === 0 ? `Defaults: ${DEFAULT_TAGS.join(", ")}` : ""}
                  className="bg-transparent outline-none text-sm flex-1 min-w-[100px] text-foreground placeholder:text-muted-foreground/50"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>What You'll Learn</Label>
              <div className="space-y-2">
                {form.what_you_learn.map((p, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input 
                      value={form.what_you_learn[i]} 
                      onChange={e => {
                        const val = e.target.value;
                        setForm(f => {
                          const updated = [...f.what_you_learn];
                          updated[i] = val;
                          return { ...f, what_you_learn: updated };
                        });
                      }} 
                      className="bg-[#0F172A] border-[#334155] flex-1" 
                    />
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-red-400" onClick={() => setForm(f => ({ ...f, what_you_learn: f.what_you_learn.filter((_, j) => j !== i) }))}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
                <div className="flex gap-2">
                  <Input value={learnInput} onChange={e => setLearnInput(e.target.value)} className="bg-[#0F172A] border-[#334155]" placeholder={form.what_you_learn.length === 0 ? "Empty will use 8 default points..." : "Add a learning point"} onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addLearnPoint())} />
                  <Button type="button" size="sm" onClick={addLearnPoint} className="bg-green-600 hover:bg-green-700"><Plus className="h-4 w-4" /></Button>
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Requirements</Label>
              <div className="space-y-2">
                {form.requirements.map((p, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input 
                      value={form.requirements[i]} 
                      onChange={e => {
                        const val = e.target.value;
                        setForm(f => {
                          const updated = [...f.requirements];
                          updated[i] = val;
                          return { ...f, requirements: updated };
                        });
                      }} 
                      className="bg-[#0F172A] border-[#334155] flex-1" 
                    />
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-red-400" onClick={() => setForm(f => ({ ...f, requirements: f.requirements.filter((_, j) => j !== i) }))}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
                <div className="flex gap-2">
                  <Input value={reqInput} onChange={e => setReqInput(e.target.value)} className="bg-[#0F172A] border-[#334155]" placeholder={form.requirements.length === 0 ? "Empty will use 4 default points..." : "Add a requirement"} onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addReqPoint())} />
                  <Button type="button" size="sm" onClick={addReqPoint} className="bg-green-600 hover:bg-green-700"><Plus className="h-4 w-4" /></Button>
                </div>
              </div>
            </div>

            {/* Section 8: Settings */}
            <SectionHeading title="Settings" />
            <div className="flex flex-wrap gap-6 pt-2">
              <div className="flex items-center gap-2"><Switch checked={form.is_published} onCheckedChange={v => setForm(f => ({ ...f, is_published: v }))} /><Label>Published</Label></div>
              <div className="flex items-center gap-2"><Switch checked={form.is_featured} onCheckedChange={v => setForm(f => ({ ...f, is_featured: v }))} /><Label>Featured</Label></div>
              <div className="flex items-center gap-2"><Switch checked={form.is_free} onCheckedChange={v => setForm(f => ({ ...f, is_free: v }))} /><Label>Free</Label></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)} className="border-[#334155]">Cancel</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-green-600 hover:bg-green-700 gap-2">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}{editId ? "Update" : "Create"} Course
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent className="bg-[#1E293B] border-[#334155]">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Course?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone. The course will be permanently removed.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-[#334155]">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* CSV Upload Modal with Preview */}
      <Dialog open={csvOpen} onOpenChange={setCsvOpen}>
        <DialogContent className="max-w-2xl bg-[#1E293B] border-[#334155]">
          <DialogHeader><DialogTitle>Bulk Upload Courses (CSV)</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="border-2 border-dashed border-[#334155] rounded-lg p-8 text-center">
              <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground mb-2">Upload CSV file</p>
              <Input type="file" accept=".csv" onChange={handleCSVUpload} className="bg-[#0F172A] border-[#334155]" />
            </div>

            {csvErrors.length > 0 && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 space-y-1">
                {csvErrors.map((err, i) => <p key={i} className="text-sm text-red-400">⚠ {err}</p>)}
              </div>
            )}

            {csvData.length > 0 && (
              <>
                <p className="text-sm text-green-400 font-medium">{csvData.length} courses found in CSV</p>
                <div className="overflow-x-auto max-h-56 border border-[#334155] rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-[#334155]">
                        <TableHead>#</TableHead>
                        <TableHead>Title</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Instructor</TableHead>
                        <TableHead>Price</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {csvData.slice(0, 5).map((r, i) => (
                        <TableRow key={i} className={`border-[#334155] ${!r.title ? "bg-red-500/10" : ""}`}>
                          <TableCell className="text-xs">{i + 1}</TableCell>
                          <TableCell className="text-sm font-medium">{r.title || <span className="text-red-400">Missing</span>}</TableCell>
                          <TableCell className="text-sm">{r.category || "—"}</TableCell>
                          <TableCell className="text-sm">{r.instructor_name || "—"}</TableCell>
                          <TableCell className="text-sm">{r.price != null ? `₹${r.price}` : "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {csvData.length > 5 && <p className="text-xs text-muted-foreground text-center py-2">...and {csvData.length - 5} more rows</p>}
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setCsvOpen(false); setCsvData([]); setCsvErrors([]); }} className="border-[#334155]">Cancel</Button>
            <Button onClick={importCSV} disabled={csvData.length === 0 || csvImporting || csvErrors.length > 0} className="bg-green-600 hover:bg-green-700 gap-2">
              {csvImporting && <Loader2 className="h-4 w-4 animate-spin" />}Confirm Import ({csvData.length})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
