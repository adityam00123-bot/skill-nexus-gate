import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Search, SlidersHorizontal, X, Star, ChevronDown, ChevronUp } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import Navbar from "@/components/Navbar";
import CategoryBar from "@/components/CategoryBar";
import Footer from "@/components/Footer";
import CourseCard from "@/components/CourseCard";
import { categories, courses as staticCourses, type Course } from "@/data/courses";
import { categoryGroups } from "@/data/categoryData";
import { supabase } from "@/integrations/supabase/client";

// Helper to check if a string is a UUID (i.e. a real Supabase course, not a dummy)
const isUUID = (str: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str);

const ITEMS_PER_PAGE = 20;
const LEVELS = ["Beginner", "Intermediate", "Advanced"] as const;
const RATING_OPTIONS = [4.5, 4.0, 3.5, 3.0] as const;

// Map a Supabase course row to the frontend Course type
function mapDbCourse(row: any): Course {
  return {
    id: row.id,
    title: row.title || "Untitled",
    description: row.short_description || row.description || "",
    longDescription: row.description || "",
    price: Number(row.price) || 0,
    originalPrice: Number(row.original_price) || Number(row.price) || 0,
    category: Array.isArray(row.category) ? (row.category[0] || "Trading") : (row.category || "Trading"),
    subcategory: Array.isArray(row.subcategory) ? (row.subcategory[0] || "") : (row.subcategory || ""),
    instructor: row.instructor_name || "Unknown",
    rating: Number(row.rating) || 0,
    students: Number(row.total_students) || 0,
    duration: row.duration_hours ? `${row.duration_hours}h` : "0h",
    lessons: Number(row.total_lectures) || 0,
    level: (row.level as Course["level"]) || "Beginner",
    thumbnail: row.thumbnail_url || "/placeholder.svg",
    tags: row.tags || [],
    telegramLink: row.telegram_link || "",
    featured: !!row.is_featured,
  };
}

const Courses = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuery = searchParams.get("q") || "";
  const initialCategory = searchParams.get("category") || "all";
  const initialSub = searchParams.get("subcategory") || "";

  const [query, setQuery] = useState(initialQuery);
  const [category, setCategory] = useState(initialCategory);
  const [subcategory, setSubcategory] = useState(initialSub);
  const [sortBy, setSortBy] = useState("popular");
  const [page, setPage] = useState(1);

  // Supabase courses
  const [dbCourses, setDbCourses] = useState<Course[]>([]);

  useEffect(() => {
    const fetchPublished = async () => {
      const { data, error } = await supabase
        .from("courses")
        .select("*")
        .eq("is_published", true)
        .or("is_deleted.eq.false,is_deleted.is.null");
      if (data) setDbCourses(data.map(mapDbCourse));
    };
    fetchPublished();
  }, []);

  useEffect(() => {
    const cat = searchParams.get("category") || "all";
    const sub = searchParams.get("subcategory") || "";
    const q = searchParams.get("q") || "";
    setCategory(cat);
    setSubcategory(sub);
    setQuery(q);
    setPage(1);
  }, [searchParams]);

  const [showFilters, setShowFilters] = useState(false);
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 50000]);
  const [selectedLevels, setSelectedLevels] = useState<Set<string>>(new Set());
  const [minRating, setMinRating] = useState<number>(0);

  const toggleLevel = (level: string) => {
    setSelectedLevels((prev) => {
      const next = new Set(prev);
      if (next.has(level)) next.delete(level);
      else next.add(level);
      return next;
    });
    setPage(1);
  };

  const activeFilterCount =
    (priceRange[0] > 0 || priceRange[1] < 50000 ? 1 : 0) +
    (selectedLevels.size > 0 ? 1 : 0) +
    (minRating > 0 ? 1 : 0);

  const clearFilters = () => {
    setPriceRange([0, 50000]);
    setSelectedLevels(new Set());
    setMinRating(0);
    setPage(1);
  };

  const activeCatGroup = categoryGroups.find((c) => c.id === category);
  const activeSubObj = activeCatGroup?.subcategories.find((s) => s.id === subcategory);
  const categoryLabel = activeCatGroup?.name || "All";
  const subcategoryLabel = activeSubObj?.name || "";
  const availableSubs = activeCatGroup?.subcategories || [];

  // Merge static + DB courses, DB courses override by id
  const allCourses = useMemo(() => {
    const dbIds = new Set(dbCourses.map(c => c.id));
    // DB courses first, then static courses not already in DB
    return [...dbCourses, ...staticCourses.filter(c => !dbIds.has(c.id))];
  }, [dbCourses]);

  const filtered = useMemo(() => {
    let results = allCourses;

    // Search filter
    if (query) {
      const q = query.toLowerCase();
      results = results.filter(c =>
        c.title.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q) ||
        c.instructor.toLowerCase().includes(q)
      );
    }

    // Category filter — match against both slug IDs (dummy) and display names (DB)
    if (category !== "all") {
      const catGroup = categoryGroups.find(g => g.id === category);
      if (catGroup) {
        const catId = catGroup.id.toLowerCase();
        const catName = catGroup.name.toLowerCase();
        results = results.filter(c => {
          const cat = (Array.isArray(c.category) ? (c.category[0] || "") : (c.category || "")).toLowerCase();
          return cat === catId || cat === catName || cat.includes(catName) || catName.includes(cat) || catGroup.subcategories.some(s => c.subcategory === s.id || c.subcategory === s.name);
        });
      }
    }

    // Subcategory filter
    if (subcategory) {
      results = results.filter(c => c.subcategory === subcategory || c.subcategory === activeSubObj?.name);
    }

    // Price filter
    results = results.filter((c) => c.price >= priceRange[0] && c.price <= priceRange[1]);

    if (selectedLevels.size > 0) {
      results = results.filter((c) => selectedLevels.has(c.level));
    }

    if (minRating > 0) {
      results = results.filter((c) => c.rating >= minRating);
    }

    // Always show real (Supabase) courses first, then apply chosen sort within each group
    const realFirst = (a: Course, b: Course) => {
      const aReal = isUUID(a.id) ? 1 : 0;
      const bReal = isUUID(b.id) ? 1 : 0;
      return bReal - aReal;
    };
    if (sortBy === "price-low") results.sort((a, b) => realFirst(a, b) || a.price - b.price);
    else if (sortBy === "price-high") results.sort((a, b) => realFirst(a, b) || b.price - a.price);
    else if (sortBy === "rating") results.sort((a, b) => realFirst(a, b) || b.rating - a.rating);
    else results.sort((a, b) => realFirst(a, b) || b.students - a.students);

    return results;
  }, [query, category, subcategory, sortBy, priceRange, selectedLevels, minRating, allCourses, activeSubObj]);

  const paginated = filtered.slice(0, page * ITEMS_PER_PAGE);
  const hasMore = paginated.length < filtered.length;

  const updateParams = (updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([key, val]) => {
      if (val === null || val === "" || val === "all") params.delete(key);
      else params.set(key, val);
    });
    setSearchParams(params);
  };

  const handleCategoryChange = (val: string) => {
    updateParams({ category: val, subcategory: null });
  };

  const handleSubcategoryChange = (val: string) => {
    updateParams({ subcategory: val === "all" ? null : val });
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <CategoryBar />

      <div className="container mx-auto px-4 pt-16 pb-8">
        <div className="mb-8">
          <h1 className="font-display font-bold text-3xl md:text-4xl text-foreground mb-1">
            {category !== "all" ? categoryLabel : "All"} Courses
          </h1>
          {subcategoryLabel && (
            <p className="text-lg text-primary font-medium mb-1">{subcategoryLabel}</p>
          )}
          <p className="text-muted-foreground">{filtered.length.toLocaleString()} courses available</p>
        </div>

        {/* Search + Sort bar */}
        <div className="flex flex-col sm:flex-row gap-4 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => { setQuery(e.target.value); setPage(1); }}
              placeholder="Search courses..."
              className="pl-10 bg-card border-border"
            />
          </div>
          <Select value={category} onValueChange={handleCategoryChange}>
            <SelectTrigger className="w-full sm:w-48 bg-card border-border">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {availableSubs.length > 0 && (
            <Select value={subcategory || "all"} onValueChange={handleSubcategoryChange}>
              <SelectTrigger className="w-full sm:w-52 bg-card border-border">
                <SelectValue placeholder="Subcategory" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Subcategories</SelectItem>
                {availableSubs.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Select value={sortBy} onValueChange={(v) => { setSortBy(v); setPage(1); }}>
            <SelectTrigger className="w-full sm:w-40 bg-card border-border">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="popular">Most Popular</SelectItem>
              <SelectItem value="rating">Highest Rated</SelectItem>
              <SelectItem value="price-low">Price: Low-High</SelectItem>
              <SelectItem value="price-high">Price: High-Low</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
            className={`gap-2 border-border ${showFilters ? "bg-primary/10 border-primary/50 text-primary" : ""}`}
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filters
            {activeFilterCount > 0 && (
              <Badge className="bg-primary text-primary-foreground text-xs h-5 w-5 p-0 flex items-center justify-center rounded-full">
                {activeFilterCount}
              </Badge>
            )}
            {showFilters ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </Button>
        </div>

        {/* Advanced Filters Panel */}
        {showFilters && (
          <div className="bg-card border border-border rounded-xl p-5 mb-6 space-y-5 animate-in slide-in-from-top-2 duration-200">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-semibold text-foreground">Advanced Filters</h3>
              {activeFilterCount > 0 && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground hover:text-foreground gap-1.5 text-xs">
                  <X className="h-3.5 w-3.5" /> Clear all
                </Button>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-3">
                <label className="text-sm font-medium text-foreground">Price Range</label>
                <Slider min={0} max={50000} step={100} value={priceRange} onValueChange={(val) => { setPriceRange(val as [number, number]); setPage(1); }} className="mt-2" />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>₹{priceRange[0]}</span>
                  <span>₹{priceRange[1]}</span>
                </div>
              </div>
              <div className="space-y-3">
                <label className="text-sm font-medium text-foreground">Difficulty Level</label>
                <div className="space-y-2">
                  {LEVELS.map((level) => (
                    <label key={level} className="flex items-center gap-2.5 cursor-pointer group">
                      <Checkbox checked={selectedLevels.has(level)} onCheckedChange={() => toggleLevel(level)} />
                      <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">{level}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="space-y-3">
                <label className="text-sm font-medium text-foreground">Minimum Rating</label>
                <div className="space-y-2">
                  {RATING_OPTIONS.map((r) => (
                    <label key={r} className="flex items-center gap-2.5 cursor-pointer group">
                      <Checkbox checked={minRating === r} onCheckedChange={() => { setMinRating(minRating === r ? 0 : r); setPage(1); }} />
                      <div className="flex items-center gap-1.5">
                        <div className="flex">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <Star key={s} className={`h-3.5 w-3.5 ${s <= r ? "fill-warning text-warning" : "text-muted-foreground/30"}`} />
                          ))}
                        </div>
                        <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors">{r}+</span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Active filter tags */}
        {activeFilterCount > 0 && !showFilters && (
          <div className="flex flex-wrap gap-2 mb-6">
            {(priceRange[0] > 0 || priceRange[1] < 50000) && (
              <Badge variant="secondary" className="gap-1.5 text-xs py-1 px-2.5">
                ₹{priceRange[0]} – ₹{priceRange[1]}
                <button onClick={() => { setPriceRange([0, 50000]); setPage(1); }}><X className="h-3 w-3" /></button>
              </Badge>
            )}
            {Array.from(selectedLevels).map((level) => (
              <Badge key={level} variant="secondary" className="gap-1.5 text-xs py-1 px-2.5">
                {level}
                <button onClick={() => toggleLevel(level)}><X className="h-3 w-3" /></button>
              </Badge>
            ))}
            {minRating > 0 && (
              <Badge variant="secondary" className="gap-1.5 text-xs py-1 px-2.5">
                {minRating}+ ★
                <button onClick={() => { setMinRating(0); setPage(1); }}><X className="h-3 w-3" /></button>
              </Badge>
            )}
            <button onClick={clearFilters} className="text-xs text-muted-foreground hover:text-foreground transition-colors">Clear all</button>
          </div>
        )}

        {/* Course grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {paginated.map((course) => (
            <CourseCard key={course.id} course={course} />
          ))}
        </div>

        {paginated.length === 0 && (
          <div className="text-center py-20">
            <p className="text-muted-foreground text-lg">No courses found. Try adjusting your filters.</p>
            {activeFilterCount > 0 && (
              <Button variant="outline" className="mt-4" onClick={clearFilters}>Clear Filters</Button>
            )}
          </div>
        )}

        {hasMore && (
          <div className="text-center mt-10">
            <Button variant="outline" size="lg" onClick={() => setPage((p) => p + 1)} className="border-border hover:bg-muted">Load More Courses</Button>
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
};

export default Courses;
