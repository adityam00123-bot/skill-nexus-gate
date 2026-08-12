import { useParams, Link, useNavigate } from "react-router-dom";
import {
  Star, Users, Clock, BookOpen, CheckCircle, MessageCircle, Heart,
  ShoppingCart, Play, ChevronDown, ChevronUp, Globe, Calendar, Award,
  Shield, Lock, Timer, Gift, Share2, Crown, Tag, Loader2, ChevronRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink,
  BreadcrumbSeparator, BreadcrumbPage
} from "@/components/ui/breadcrumb";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger
} from "@/components/ui/accordion";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import CourseReviews from "@/components/CourseReviews";
import CourseCard from "@/components/CourseCard";
import CategoryBar from "@/components/CategoryBar";
import { useCartContext } from "@/contexts/CartContext";
import { useWishlistContext } from "@/contexts/WishlistContext";
import { usePurchaseContext } from "@/contexts/PurchaseContext";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useState, useMemo, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { getCourseById, courses as localCourses } from "@/data/courses";

type Course = Tables<"courses">;

// Helper to check if a string is a UUID
const isUUID = (str: string) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
};

/* ── Scroll-reveal hook ── */
function useScrollReveal() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); io.unobserve(el); } },
      { threshold: 0.08 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return { ref, className: visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5", style: { transition: "opacity 0.5s ease, transform 0.5s ease" } };
}

function RevealSection({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const reveal = useScrollReveal();
  return (
    <div ref={reveal.ref} className={`${reveal.className} ${className}`} style={reveal.style}>
      {children}
    </div>
  );
}


const DEFAULT_LEARNING_POINTS = [
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

const CourseDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { addToCart, isInCart } = useCartContext();
  const { toggleWishlist, isWishlisted } = useWishlistContext();
  const { isPurchased } = usePurchaseContext();
  const { isSubscribed } = useSubscription();
  const { profile } = useAuth();
  const { toast } = useToast();
  const [showFullDesc, setShowFullDesc] = useState(false);
  const [expandAll, setExpandAll] = useState(false);
  const [openSections, setOpenSections] = useState<string[]>([]);
  const [isSticky, setIsSticky] = useState(false);
  const thumbnailRef = useRef<HTMLDivElement>(null);

  const [course, setCourse] = useState<any | null>(null);
  const [courseSections, setCourseSections] = useState<any[]>([]);
  const [mentorCourses, setMentorCourses] = useState<any[]>([]);
  const [relatedCourses, setRelatedCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [persistentAccessLink, setPersistentAccessLink] = useState<string | null>(null);

  // Map a Supabase course row to the frontend Course type
  const mapDbCourse = (row: any) => ({
    id: row.id,
    title: row.title || "Untitled",
    description: row.short_description || row.description || "",
    longDescription: row.description || "",
    price: Number(row.price) || 0,
    originalPrice: Number(row.original_price) || Number(row.price) || 0,
    category: row.category || "Trading",
    subcategory: row.subcategory || "",
    instructor: row.instructor_name || "Unknown",
    rating: Number(row.rating) || 0,
    students: Number(row.total_students) || 0,
    duration: row.duration_hours ? `${row.duration_hours}h` : "0h",
    lessons: Number(row.total_lectures) || 0,
    level: (row.level) || "Beginner",
    thumbnail: row.thumbnail_url || "/placeholder.svg",
    tags: row.tags || [],
    telegramLink: row.telegram_link || "",
    featured: !!row.is_featured,
  });

  useEffect(() => {
    if (!id) { setNotFound(true); setLoading(false); return; }
    setLoading(true);
    setNotFound(false);

    const fetchData = async () => {
      // Case 1: Check if it's a dummy course (slug-based ID like "course-123")
      if (!isUUID(id)) {
        const dummyCourse = getCourseById(id);
        if (dummyCourse) {
          // Map dummy course to match expected structure
          setCourse({
            id: dummyCourse.id,
            title: dummyCourse.title,
            description: dummyCourse.longDescription || dummyCourse.description,
            short_description: dummyCourse.description,
            price: dummyCourse.price,
            original_price: dummyCourse.originalPrice,
            category: dummyCourse.category,
            instructor_name: dummyCourse.instructor,
            rating: dummyCourse.rating,
            total_students: dummyCourse.students,
            duration_hours: parseFloat(dummyCourse.duration),
            thumbnail_url: dummyCourse.thumbnail,
            telegram_link: dummyCourse.telegramLink,
            level: dummyCourse.level,
            language: "English", // Default for dummy
            what_you_learn: [],
            requirements: [],
            is_free: dummyCourse.price === 0,
            is_featured: !!dummyCourse.featured,
            is_published: true
          });
          setCourseSections([]); // Dummy courses don't have real sections
          
          // Fetch recommendations for dummy courses based on category/instructor
          fetchRecommendations(dummyCourse.category, dummyCourse.instructor, id);
          
          setLoading(false);
          return;
        }
      }

      // Case 2: Fetch from Supabase if it's a UUID
      const { data: courseData, error: courseError } = await supabase
        .from("courses")
        .select("*")
        .eq("id", id)
        .eq("is_published", true)
        .or("is_deleted.eq.false,is_deleted.is.null")
        .maybeSingle();

      if (courseError || !courseData) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      setCourse(courseData);
      fetchRecommendations((courseData.category && courseData.category.length > 0) ? courseData.category[0] : "", courseData.instructor_name || "", id);

      // Fetch persistent access link if the course has a telegram_channel_id
      if (courseData.telegram_channel_id) {
        const { data: channelData } = await supabase
          .from('telegram_bot_channels')
          .select('persistent_access_link')
          .eq('channel_id', courseData.telegram_channel_id)
          .maybeSingle();
        if (channelData?.persistent_access_link) {
          setPersistentAccessLink(channelData.persistent_access_link);
        }
      }

      // Fetch sections for this course
      const { data: sectionsData } = await (supabase as any)
        .from("course_sections")
        .select(`
          id,
          title,
          order_index,
          course_lectures (
            id,
            title,
            duration,
            order_index,
            is_preview
          )
        `)
        .eq("course_id", id)
        .order("order_index");

      if (sectionsData) {
        const mappedSections = sectionsData.map(s => ({
          title: s.title,
          duration: "", // Optional: sum lecture durations if needed
          lectures: (s.course_lectures as any[] || [])
            .sort((a, b) => a.order_index - b.order_index)
            .map(l => ({
              title: l.title,
              duration: l.duration || "0:00",
              preview: !!l.is_preview
            }))
        }));
        setCourseSections(mappedSections);
      }
      setLoading(false);
    };

    const fetchRecommendations = async (category: string, instructor: string, currentId: string) => {
      // 1. More from this Mentor
      if (instructor) {
        // Fetch from Supabase
        const { data: dbMentorData } = await supabase
          .from("courses")
          .select("*")
          .eq("instructor_name", instructor)
          .eq("is_published", true)
          .neq("id", currentId)
          .limit(4);
        
        const dbMentorMapped = dbMentorData ? dbMentorData.map(mapDbCourse) : [];
        
        // Fetch from local data if we need more
        const localMentorData = localCourses
          .filter(c => c.instructor === instructor && c.id !== currentId)
          .slice(0, 4 - dbMentorMapped.length);
        
        setMentorCourses([...dbMentorMapped, ...localMentorData]);
      }

      // 2. Students Also Bought (Related by Category)
      if (category) {
        // Fetch from Supabase
        const { data: dbRelatedData } = await (supabase as any)
          .from("courses")
          .select("*")
          .contains("category", [category])
          .eq("is_published", true)
          .neq("id", currentId)
          .limit(4);
        
        const dbRelatedMapped = dbRelatedData ? dbRelatedData.map(mapDbCourse) : [];
        
        // Fetch from local data if we need more
        const localRelatedData = localCourses
          .filter(c => (Array.isArray(c.category) ? c.category.includes(category) : c.category === category) && c.id !== currentId)
          .slice(0, 4 - dbRelatedMapped.length);
          
        setRelatedCourses([...dbRelatedMapped, ...localRelatedData]);
      }
    };

    fetchData();
  }, [id]);

  useEffect(() => {
    const el = thumbnailRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setIsSticky(!entry.isIntersecting),
      { threshold: 0, rootMargin: "-80px 0px 0px 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [course?.id]);


  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-20 flex items-center justify-center">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  // Not found state
  if (notFound || !course) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-20 text-center">
          <h1 className="font-display font-bold text-2xl text-foreground">Course not found</h1>
          <p className="text-muted-foreground mt-2 text-sm">This course may have been removed or the link is invalid.</p>
          <Link to="/courses"><Button className="mt-4">Browse Courses</Button></Link>
        </div>
      </div>
    );
  }

  // Derived values from Supabase fields
  const price = course.price ?? 0;
  const originalPrice = course.original_price ?? price;
  const discount = originalPrice > 0 ? Math.round((1 - price / originalPrice) * 100) : 0;
  const rating = course.rating ?? 0;
  const students = course.total_students ?? 0;
  const durationHours = course.duration_hours ?? 0;
  const totalLecturesCount = courseSections.reduce((s, sec) => s + sec.lectures.length, 0);
  const learningPoints = (course.what_you_learn && course.what_you_learn.length > 0)
    ? course.what_you_learn
    : DEFAULT_LEARNING_POINTS;
  const requirements = (course.requirements && course.requirements.length > 0)
    ? course.requirements
    : DEFAULT_REQUIREMENTS;
  const purchased = isPurchased(course.id);
  const hasAccess = purchased || isSubscribed;
  const wishlisted = isWishlisted(course.id);
  const inCart = isInCart(course.id);
  const daysLeft = (parseInt(course.id.replace(/-/g, "").slice(0, 4), 16) % 5) + 1;

  const handleBuyNow = () => {
    if (profile?.is_blocked) {
      toast({ title: "Account Blocked", description: "You are not allowed to make purchases.", variant: "destructive" });
      return;
    }
    navigate(`/checkout?courseId=${course.id}`);
  };

  const handleAddToCart = () => {
    if (profile?.is_blocked) {
      toast({ title: "Account Blocked", description: "You are not allowed to make purchases.", variant: "destructive" });
      return;
    }
    addToCart(course.id);
  };

  const handleToggleExpandAll = () => {
    if (expandAll) {
      setOpenSections([]);
    } else {
      setOpenSections(courseSections.map((_, i) => `section-${i}`));
    }
    setExpandAll(!expandAll);
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <CategoryBar />

      {/* Dark hero header */}
      <div className="bg-card border-b border-border">
        <div className="container mx-auto px-4 py-6 lg:py-10">
          <Breadcrumb className="mb-4">
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link to="/courses" className="text-muted-foreground hover:text-foreground text-xs">Courses</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              {course.category && (
                <>
                  <BreadcrumbItem>
                    <BreadcrumbLink asChild>
                      <Link to={`/courses?category=${course.category}`} className="text-muted-foreground hover:text-foreground text-xs">{course.category}</Link>
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                </>
              )}
              <BreadcrumbItem>
                <BreadcrumbPage className="text-xs">{course.title}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          <div className="lg:max-w-[65%]">
            <h1 className="font-display font-bold text-2xl md:text-3xl lg:text-4xl text-foreground mb-3">{course.title}</h1>
            <p className="text-muted-foreground text-sm md:text-base mb-4 leading-relaxed line-clamp-2">
              {course.short_description || course.description}
            </p>

            <div className="flex flex-wrap items-center gap-2 mb-3">
              {rating >= 4.5 && (
                <Badge className="bg-warning/20 text-warning border-warning/30 text-xs font-semibold">Bestseller</Badge>
              )}
              {rating >= 4.0 && rating < 4.5 && (
                <Badge className="bg-primary/20 text-primary border-primary/30 text-xs font-semibold">Top Rated</Badge>
              )}
              {course.is_free && (
                <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs font-semibold">Free</Badge>
              )}
              {course.level && (
                <Badge variant="outline" className="text-xs">{course.level}</Badge>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3 text-sm mb-3">
              <span className="text-warning font-bold">{rating.toFixed(1)}</span>
              <div className="flex">
                {[1,2,3,4,5].map(s => (
                  <Star key={s} className={`h-3.5 w-3.5 ${s <= Math.round(rating) ? "fill-warning text-warning" : "text-muted-foreground/30"}`} />
                ))}
              </div>
              <span className="text-muted-foreground">({(students * 0.3).toFixed(0)} ratings)</span>
              <span className="text-muted-foreground">{students.toLocaleString()} students</span>
            </div>

            {course.instructor_name && (
              <p className="text-sm text-muted-foreground mb-2">
                Created by <span className="text-secondary">{course.instructor_name}</span>
              </p>
            )}

            <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> Last updated March 2026</span>
              <span className="flex items-center gap-1"><Globe className="h-3.5 w-3.5" /> {course.language || "Hindi"}</span>
              {durationHours > 0 && (
                <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {durationHours}h total</span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* ===== LEFT SIDE ===== */}
          <div className="lg:col-span-2 space-y-8">
            {/* What you will learn */}
            <RevealSection>
              <div className="border border-border rounded-lg p-6">
                <h2 className="font-display font-bold text-xl text-foreground mb-4">What you'll learn</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {learningPoints.map((point, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      <span className="text-sm text-muted-foreground">{point}</span>
                    </div>
                  ))}
                </div>
              </div>
            </RevealSection>

            {/* Course Content */}
            {courseSections.length > 0 && (
              <RevealSection>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="font-display font-bold text-xl text-foreground">Course Content</h2>
                    <p className="text-xs text-muted-foreground mt-1">
                      {courseSections.length} sections · {totalLecturesCount} lectures · {durationHours}h total length
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={handleToggleExpandAll} className="text-secondary text-xs hover:text-secondary/80">
                    {expandAll ? "Collapse all" : "Expand all sections"}
                  </Button>
                </div>

                <Accordion
                  type="multiple"
                  value={openSections}
                  onValueChange={setOpenSections}
                  className="border border-border rounded-lg overflow-hidden"
                >
                  {courseSections.map((section, i) => (
                    <AccordionItem key={i} value={`section-${i}`} className="border-b border-border last:border-0">
                      <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/30">
                        <div className="flex items-center justify-between w-full pr-2">
                          <span className="text-sm font-semibold text-foreground text-left">{section.title}</span>
                          <span className="text-xs text-muted-foreground whitespace-nowrap ml-4">
                            {section.lectures.length} lectures · {section.duration}
                          </span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="p-0">
                        {section.lectures.map((lec, j) => (
                          <div key={j} className="flex items-center justify-between px-6 py-2.5 border-t border-border/50 hover:bg-muted/20">
                            <div className="flex items-center gap-2">
                              {hasAccess || lec.preview ? (
                                <Play className="h-3.5 w-3.5 text-primary shrink-0" />
                              ) : (
                                <Lock className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
                              )}
                              <span className="text-sm text-muted-foreground">{lec.title}</span>
                              {lec.preview && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Preview</Badge>}
                            </div>
                            <span className="text-xs text-muted-foreground">{lec.duration}</span>
                          </div>
                        ))}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </RevealSection>
            )}

            {/* Requirements */}
            <RevealSection>
              <h2 className="font-display font-bold text-xl text-foreground mb-4">Requirements</h2>
              <ul className="space-y-2">
                {requirements.map((req, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <span className="text-foreground mt-1">•</span>
                    {req}
                  </li>
                ))}
              </ul>
            </RevealSection>

            {/* Description */}
            <RevealSection>
              <h2 className="font-display font-bold text-xl text-foreground mb-4">Description</h2>
              <div className={`text-sm text-muted-foreground leading-relaxed whitespace-pre-line ${!showFullDesc ? "line-clamp-6" : ""}`}>
                {course.description || course.short_description || "No description available."}
                {"\n\nThis course is regularly updated with new content and real market examples. Join thousands of students who have transformed their trading careers with this comprehensive program."}
              </div>
              <button
                onClick={() => setShowFullDesc(!showFullDesc)}
                className="text-secondary hover:underline text-sm font-medium mt-2 flex items-center gap-1"
              >
                {showFullDesc ? "Show less" : "Show more"}
                {showFullDesc ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
            </RevealSection>

            {/* Instructor */}
            {course.instructor_name && (
              <RevealSection>
                <h2 className="font-display font-bold text-xl text-foreground mb-4">Instructor</h2>
                <span className="text-secondary font-semibold text-lg">{course.instructor_name}</span>
                <p className="text-xs text-muted-foreground mt-1">Professional Trader & Educator</p>

                <div className="flex items-start gap-4 mt-4">
                  <div className="h-20 w-20 rounded-full bg-primary/20 text-primary flex items-center justify-center text-2xl font-bold shrink-0">
                    {course.instructor_name.split(" ").map(n => n[0]).join("")}
                  </div>
                  <div className="space-y-1.5">
                    <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1.5"><Star className="h-3.5 w-3.5 text-warning" /> {rating.toFixed(1)} Instructor Rating</span>
                      <span className="flex items-center gap-1.5"><Award className="h-3.5 w-3.5" /> {Math.floor(students * 0.3)} Reviews</span>
                      <span className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5" /> {(students * 3).toLocaleString()} Students</span>
                      <span className="flex items-center gap-1.5"><BookOpen className="h-3.5 w-3.5" /> Multiple Courses</span>
                    </div>
                    {course.instructor_bio ? (
                      <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{course.instructor_bio}</p>
                    ) : (
                      <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                        {course.instructor_name} is a seasoned market professional with experience in financial markets. Known for a practical, no-nonsense teaching style that breaks down complex concepts into actionable steps.
                      </p>
                    )}
                  </div>
                </div>
              </RevealSection>
            )}

            {/* Reviews */}
            <RevealSection>
              <CourseReviews courseId={course.id} />
            </RevealSection>
          </div>

          {/* ===== RIGHT SIDE — STICKY PURCHASE CARD ===== */}
          <div className="hidden lg:block lg:col-span-1">
            <div ref={thumbnailRef} className="h-0" />

            <div
              className="sticky top-20"
              style={{ transition: "box-shadow 0.3s ease" }}
            >
              <div className={`bg-card rounded-xl border border-border overflow-hidden transition-shadow duration-300 ${isSticky ? "shadow-lg" : "shadow-card"}`}>
                {/* Thumbnail */}
                <div
                  className="overflow-hidden transition-all duration-400 ease-in-out"
                  style={{
                    maxHeight: isSticky ? 0 : 300,
                    opacity: isSticky ? 0 : 1,
                    transition: "max-height 0.4s ease, opacity 0.3s ease",
                  }}
                >
                  <div className="aspect-video relative">
                    {course.thumbnail_url ? (
                      <img src={course.thumbnail_url} alt={course.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-primary/10 flex items-center justify-center">
                        <BookOpen className="h-12 w-12 text-primary/40" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-background/30 flex items-center justify-center">
                      <div className="h-14 w-14 rounded-full bg-background/80 flex items-center justify-center">
                        <Play className="h-6 w-6 text-foreground ml-1" />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-5 space-y-4">
                  {hasAccess ? (
                    /* Owned / Subscribed state */
                    <div className="space-y-3">
                      <div className="bg-primary/10 border border-primary/30 rounded-lg p-4 text-center">
                        <CheckCircle className="h-8 w-8 text-primary mx-auto mb-2" />
                        <p className="font-semibold text-foreground">{purchased ? "You own this course" : "Included in Premium"}</p>
                        <p className="text-xs text-muted-foreground mt-1">Access via Telegram below</p>
                      </div>
                      {persistentAccessLink ? (
                        <a href={persistentAccessLink} target="_blank" rel="noopener noreferrer">
                          <Button size="lg" className="w-full bg-[#0088cc] text-white hover:bg-[#0088cc]/90 font-semibold">
                            <MessageCircle className="mr-2 h-5 w-5" /> View Course
                          </Button>
                        </a>
                      ) : course.telegram_link && (
                        <a href={course.telegram_link} target="_blank" rel="noopener noreferrer">
                          <Button size="lg" className="w-full bg-info text-foreground hover:bg-info/90 font-semibold">
                            <MessageCircle className="mr-2 h-5 w-5" /> View Course
                          </Button>
                        </a>
                      )}
                    </div>
                  ) : (
                    <>
                      {/* Subscription banner */}
                      <div className="space-y-3 text-center">
                        <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                          <Crown className="h-3.5 w-3.5 text-warning" />
                          <span>This course is included in Premium</span>
                        </div>
                        <p className="font-display font-bold text-base text-foreground leading-tight">
                          Subscribe to CourseVerse Premium
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Get this course plus 2000+ top courses
                        </p>
                        <Button
                          size="lg"
                          className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-semibold"
                          onClick={() => navigate("/subscription-checkout")}
                        >
                          Start Subscription
                        </Button>
                        <p className="text-xs text-muted-foreground">Starting at ₹333/month</p>
                        <p className="text-[11px] text-muted-foreground/70">Cancel anytime</p>
                      </div>

                      <div className="flex items-center gap-3">
                        <Separator className="flex-1" />
                        <span className="text-xs text-muted-foreground font-medium">or</span>
                        <Separator className="flex-1" />
                      </div>

                      {/* Individual purchase */}
                      {!course.is_free && (
                        <div className="space-y-3">
                          <div>
                            <div className="flex items-center gap-3">
                              <span className="font-display font-bold text-3xl text-foreground">₹{price}</span>
                              {originalPrice > price && (
                                <span className="text-base text-muted-foreground line-through">₹{originalPrice}</span>
                              )}
                              {discount > 0 && (
                                <Badge className="bg-destructive/20 text-destructive border-destructive/30 text-xs">{discount}% off</Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 mt-1.5 text-warning text-xs font-medium">
                              <Timer className="h-3.5 w-3.5" />
                              <span>{daysLeft} day{daysLeft > 1 ? "s" : ""} left at this price!</span>
                            </div>
                          </div>

                          <div className="flex gap-2">
                            <Button
                              onClick={handleAddToCart}
                              size="lg"
                              variant="outline"
                              className="flex-1 font-semibold"
                              disabled={inCart || !!profile?.is_blocked}
                            >
                              <ShoppingCart className="mr-2 h-4 w-4" />
                              {inCart ? "In Cart" : "Add to Cart"}
                            </Button>
                            <Button
                              variant="outline"
                              size="lg"
                              className="px-3"
                              onClick={() => toggleWishlist(course.id)}
                            >
                              <Heart className={`h-5 w-5 ${wishlisted ? "fill-destructive text-destructive" : ""}`} />
                            </Button>
                          </div>

                          <Button
                            onClick={handleBuyNow}
                            size="lg"
                            disabled={!!profile?.is_blocked}
                            className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-semibold shadow-glow"
                          >
                            Buy Now — ₹{price}
                          </Button>

                          <div className="text-center space-y-0.5">
                            <p className="text-[11px] text-muted-foreground">7-day refund only if any issue found</p>
                            <p className="text-[11px] text-muted-foreground">Full Lifetime Access</p>
                          </div>
                        </div>
                      )}

                      {course.is_free && (
                        <div className="space-y-3">
                          <Badge className="w-full justify-center py-2 text-sm bg-green-500/20 text-green-400 border-green-500/30">
                            🎉 This course is Free!
                          </Badge>
                          {course.telegram_link && (
                            <a href={course.telegram_link} target="_blank" rel="noopener noreferrer">
                              <Button size="lg" className="w-full font-semibold">
                                <MessageCircle className="mr-2 h-5 w-5" /> Access Free Course
                              </Button>
                            </a>
                          )}
                        </div>
                      )}

                      <Separator />
                      <div className="flex items-center justify-center gap-2 text-sm">
                        <button className="text-foreground hover:underline transition-all">Share</button>
                        <span className="text-border">|</span>
                        <button className="text-foreground hover:underline transition-all">Gift this Course</button>
                        <span className="text-border">|</span>
                        <button className="text-foreground hover:underline transition-all">Apply Coupon</button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recommended Sections */}
      <div className="container mx-auto px-4 pb-20 space-y-16">
        {/* Section 1: More from this Mentor */}
        {mentorCourses.length > 0 && (
          <RevealSection>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="font-display font-bold text-2xl text-foreground">More from this Mentor</h2>
                <p className="text-muted-foreground text-sm mt-1">Check out other courses by {course.instructor_name}</p>
              </div>
              <Link to={`/courses?instructor=${encodeURIComponent(course.instructor_name)}`}>
                <Button variant="ghost" className="text-primary hover:text-primary/80 gap-1 text-sm font-semibold">
                  View All <ChevronRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {mentorCourses.map((c) => (
                <CourseCard key={c.id} course={c} />
              ))}
            </div>
          </RevealSection>
        )}

        {/* Section 2: Students Also Bought */}
        {relatedCourses.length > 0 && (
          <RevealSection>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="font-display font-bold text-2xl text-foreground">Students Also Bought</h2>
                <p className="text-muted-foreground text-sm mt-1">Recommended courses in {course.category}</p>
              </div>
              <Link to={`/courses?category=${encodeURIComponent(course.category)}`}>
                <Button variant="ghost" className="text-primary hover:text-primary/80 gap-1 text-sm font-semibold">
                  View All <ChevronRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {relatedCourses.map((c) => (
                <CourseCard key={c.id} course={c} />
              ))}
            </div>
          </RevealSection>
        )}
      </div>

      {/* Mobile sticky bottom bar */}
      {!hasAccess && !course.is_free && (
        <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border p-3 z-50 flex items-center gap-3 shadow-card">
          <div className="shrink-0">
            <span className="font-display font-bold text-lg text-foreground">₹{price}</span>
            {originalPrice > price && (
              <span className="text-xs text-muted-foreground line-through ml-1.5">₹{originalPrice}</span>
            )}
          </div>
          <Button onClick={handleBuyNow} disabled={!!profile?.is_blocked} className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold">
            Buy Now
          </Button>
          <Button variant="outline" size="icon" onClick={handleAddToCart} disabled={inCart || !!profile?.is_blocked}>
            <ShoppingCart className="h-4 w-4" />
          </Button>
        </div>
      )}

      <Footer />
    </div>
  );
};

export default CourseDetail;
