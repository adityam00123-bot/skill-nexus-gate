import { useMemo, useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Clock,
  BookOpen,
  Heart,
  Crown,
  Eye,
  Play,
  ArrowRight,
  MessageCircle,
  Loader2,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import Navbar from "@/components/Navbar";
import CategoryBar from "@/components/CategoryBar";
import Footer from "@/components/Footer";
import { usePurchaseContext } from "@/contexts/PurchaseContext";
import { useWishlistContext } from "@/contexts/WishlistContext";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { useAuth } from "@/contexts/AuthContext";
import { getCourseById, courses, Course } from "@/data/courses";
import { supabase } from "@/integrations/supabase/client";

// Simulated progress data (would come from DB in production)
const getProgress = (courseId: string) => {
  const hash = courseId.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return hash % 100;
};

const CourseRow = ({
  course,
  progress,
  badge,
  showResume,
}: {
  course: Course;
  progress?: number;
  badge?: string;
  showResume?: boolean;
}) => (
  <Link
    to={`/course/${course.id}`}
    className="flex gap-4 bg-card rounded-xl border border-border p-3 hover:border-primary/50 hover:shadow-glow transition-all group"
  >
    <div className="w-36 sm:w-44 shrink-0 rounded-lg overflow-hidden aspect-video">
      <img
        src={course.thumbnail}
        alt={course.title}
        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        loading="lazy"
      />
    </div>
    <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
      <div>
        <div className="flex items-start gap-2">
          <h3 className="font-display font-semibold text-foreground text-sm sm:text-base line-clamp-1 group-hover:text-primary transition-colors">
            {course.title}
          </h3>
          {badge && (
            <Badge className="shrink-0 bg-primary/10 text-primary border-primary/20 text-[10px] font-semibold gap-1">
              <Crown className="h-3 w-3" />
              {badge}
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">{course.instructor}</p>
        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {course.duration}
          </span>
          <span className="flex items-center gap-1">
            <BookOpen className="h-3 w-3" />
            {course.lessons} lessons
          </span>
        </div>
      </div>
      {typeof progress === "number" && (
        <div className="mt-2 space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">{progress}% complete</span>
          </div>
          <Progress value={progress} className="h-1.5" />
        </div>
      )}
      {showResume && (
        <div className="mt-2 flex flex-wrap gap-2">
          <Button
            size="sm"
            className="bg-primary text-primary-foreground hover:bg-primary/90 text-xs gap-1.5 h-8"
          >
            <Play className="h-3.5 w-3.5" /> Resume Learning
          </Button>
          {(course.persistentAccessLink || course.telegramLink) && (
            <Button
              size="sm"
              variant="outline"
              className="border-primary/20 text-primary hover:bg-primary/10 text-xs gap-1.5 h-8"
              onClick={(e) => {
                e.preventDefault();
                window.open(course.persistentAccessLink || course.telegramLink, "_blank");
              }}
            >
              <MessageCircle className="h-3.5 w-3.5" /> Open Telegram Channel
            </Button>
          )}
        </div>
      )}
    </div>
  </Link>
);

const SectionHeader = ({
  icon: Icon,
  title,
  linkTo,
  linkLabel,
}: {
  icon: React.ElementType;
  title: string;
  linkTo?: string;
  linkLabel?: string;
}) => (
  <div className="flex items-center justify-between mb-4">
    <div className="flex items-center gap-2">
      <Icon className="h-5 w-5 text-primary" />
      <h2 className="font-display font-bold text-lg text-foreground">{title}</h2>
    </div>
    {linkTo && (
      <Link to={linkTo}>
        <Button variant="ghost" size="sm" className="text-primary hover:text-primary/80 text-xs">
          {linkLabel || "View All"} <ArrowRight className="ml-1 h-3.5 w-3.5" />
        </Button>
      </Link>
    )}
  </div>
);

const MyLearning = () => {
  const { user, loading: authLoading } = useAuth();
  const { purchasedIds } = usePurchaseContext();
  const { wishlistIds } = useWishlistContext();
  const { isSubscribed } = useSubscription();
  const [purchasedCourses, setPurchasedCourses] = useState<Course[]>([]);
  const [subscriptionCourses, setSubscriptionCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const fetchPurchasedCourses = async () => {
      setLoading(true);

      // Step 1: Get all purchased course IDs for this user
      const { data: purchaseRows, error } = await supabase
        .from("purchases")
        .select("course_id")
        .eq("user_id", user.id);

      const allPurchasedIds = (purchaseRows || []).map((r: any) => r.course_id);

      // Separate real (UUID) IDs from dummy (slug) IDs
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      const realIds = allPurchasedIds.filter(id => uuidRegex.test(id));
      const dummyIds = allPurchasedIds.filter(id => !uuidRegex.test(id));

      // Step 2: Fetch real course details from Supabase
      let dbFetchedCourses: Course[] = [];
      if (realIds.length > 0) {
        const { data: courseRows } = await supabase
          .from("courses")
          .select(`
            id, title, description, short_description, instructor_name, thumbnail_url, price, original_price, category, duration_hours, total_lectures, level, telegram_link,
            telegram_bot_channels(persistent_access_link)
          `)
          .in("id", realIds);

        dbFetchedCourses = (courseRows || []).map((c: any) => {
          let persistentLink = null;
          if (c.telegram_bot_channels && c.telegram_bot_channels.length > 0) {
            persistentLink = c.telegram_bot_channels[0].persistent_access_link;
          }

          return {
            id: c.id,
            title: c.title,
            instructor: c.instructor_name || "Unknown Instructor",
            thumbnail: c.thumbnail_url || "/placeholder.svg",
            price: Number(c.price) || 0,
            originalPrice: Number(c.original_price) || Number(c.price) || 0,
            category: c.category || "Trading",
            subcategory: "",
            duration: c.duration_hours ? `${c.duration_hours}h` : "0h",
            lessons: Number(c.total_lectures) || 0,
            level: c.level || "Beginner",
            description: c.short_description || c.description || "",
            longDescription: c.description || "",
            rating: 0,
            students: 0,
            tags: [],
            telegramLink: c.telegram_link || "",
            persistentAccessLink: persistentLink
          } as Course;
        });
      }

      // Step 3: Look up dummy courses from local data + context
      const dbCourseIds = new Set(dbFetchedCourses.map(c => c.id));
      const contextOnlyIds = Array.from(purchasedIds).filter(id => !dbCourseIds.has(id) && !dummyIds.includes(id));
      const allDummyIds = [...dummyIds, ...contextOnlyIds];
      const dummyPurchased = allDummyIds
        .map(getCourseById)
        .filter(Boolean) as Course[];
      
      setPurchasedCourses([...dbFetchedCourses, ...dummyPurchased]);
      setLoading(false);
    };

    fetchPurchasedCourses();
  }, [user, purchasedIds]);

  const wishlistCourses = useMemo(
    () => Array.from(wishlistIds).map(getCourseById).filter(Boolean) as Course[],
    [wishlistIds]
  );

  // Simulated "last studied" = first purchased course with highest progress
  const continueCourse = purchasedCourses.length > 0 ? purchasedCourses[0] : null;

  // Simulated recently viewed (random selection from all courses)
  const recentlyViewed = useMemo(() => courses.slice(0, 6), []);

  // Fetch ALL published courses from DB for subscribed users
  useEffect(() => {
    if (!isSubscribed || !user) {
      setSubscriptionCourses([]);
      return;
    }

    const fetchSubscriptionCourses = async () => {
      const { data: courseRows } = await supabase
        .from("courses")
        .select(`
          id, title, description, short_description, instructor_name, thumbnail_url, price, original_price, category, duration_hours, total_lectures, level, telegram_link,
          telegram_bot_channels(persistent_access_link)
        `)
        .eq("is_published", true)
        .or("is_deleted.eq.false,is_deleted.is.null");

      const mapped: Course[] = (courseRows || []).map((c: any) => {
        let persistentLink = null;
        if (c.telegram_bot_channels && c.telegram_bot_channels.length > 0) {
          persistentLink = c.telegram_bot_channels[0].persistent_access_link;
        }
        return {
          id: c.id,
          title: c.title,
          instructor: c.instructor_name || "Unknown Instructor",
          thumbnail: c.thumbnail_url || "/placeholder.svg",
          price: Number(c.price) || 0,
          originalPrice: Number(c.original_price) || Number(c.price) || 0,
          category: c.category || "Trading",
          subcategory: "",
          duration: c.duration_hours ? `${c.duration_hours}h` : "0h",
          lessons: Number(c.total_lectures) || 0,
          level: c.level || "Beginner",
          description: c.short_description || c.description || "",
          longDescription: c.description || "",
          rating: 0,
          students: 0,
          tags: [],
          telegramLink: c.telegram_link || "",
          persistentAccessLink: persistentLink
        } as Course;
      });

      // Exclude courses already individually purchased
      const purchasedSet = new Set(purchasedCourses.map(c => c.id));
      setSubscriptionCourses(mapped.filter(c => !purchasedSet.has(c.id)));
    };

    fetchSubscriptionCourses();
  }, [isSubscribed, user, purchasedCourses]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <CategoryBar />
        <div className="container mx-auto px-4 py-20 flex items-center justify-center">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
        </div>
        <Footer />
      </div>
    );
  }

  const hasNoCourses = !user || (purchasedCourses.length === 0 && !isSubscribed);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <CategoryBar />

      <div className="container max-w-[1000px] mx-auto px-4 py-10 space-y-12">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="font-display font-bold text-3xl text-foreground">My Learning</h1>
            <p className="text-muted-foreground mt-1">Continue your learning journey.</p>
          </div>
          {!hasNoCourses && (
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search courses..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-card border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
              />
            </div>
          )}
        </div>

        {hasNoCourses ? (
          /* Empty State */
          <div className="bg-card rounded-2xl border border-border p-14 text-center space-y-5">
            <BookOpen className="h-16 w-16 text-muted-foreground mx-auto" />
            <h2 className="font-display font-semibold text-xl text-foreground">
              No courses purchased yet
            </h2>
            <p className="text-muted-foreground max-w-md mx-auto">
              Start learning today — browse our courses and find something you love!
            </p>
            <div className="flex gap-3 justify-center">
              <Link to="/courses">
                <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
                  Browse Courses
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          <>
            {/* Section 1 – Continue Learning */}
            {continueCourse && (
              <section>
                <SectionHeader icon={Play} title="Continue Learning" />
                <CourseRow
                  course={continueCourse}
                  progress={getProgress(continueCourse.id)}
                  showResume
                />
              </section>
            )}

            {/* Section 2 – My Courses */}
            <section>
              <SectionHeader
                icon={BookOpen}
                title="My Courses"
                linkTo="/purchase-history"
                linkLabel="Purchase History"
              />
              {purchasedCourses.length === 0 ? (
                <p className="text-sm text-muted-foreground">No purchased courses yet.</p>
              ) : (
                <div className="space-y-3">
                  {purchasedCourses
                    .filter(course => !searchQuery || course.title.toLowerCase().includes(searchQuery.toLowerCase()))
                    .map((course) => (
                    <CourseRow
                      key={course.id}
                      course={course}
                      progress={getProgress(course.id)}
                    />
                  ))}
                </div>
              )}
            </section>

            {/* Section 3 – Subscription Courses */}
            {isSubscribed && subscriptionCourses.length > 0 && (
              <section>
                <SectionHeader
                  icon={Crown}
                  title="Subscription Courses"
                  linkTo="/subscribe"
                  linkLabel="Manage"
                />
                <div className="space-y-3">
                  {subscriptionCourses
                    .filter(course => !searchQuery || course.title.toLowerCase().includes(searchQuery.toLowerCase()))
                    .map((course) => (
                    <CourseRow
                      key={course.id}
                      course={course}
                      badge="Included in Premium"
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Section 4 – Wishlist Courses */}
            <section>
              <SectionHeader
                icon={Heart}
                title="Wishlist Courses"
                linkTo="/wishlist"
                linkLabel="View All"
              />
              {wishlistCourses.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Your wishlist is empty.{" "}
                  <Link to="/courses" className="text-primary hover:underline">
                    Browse courses
                  </Link>
                </p>
              ) : (
                <div className="space-y-3">
                  {wishlistCourses.slice(0, 4).map((course) => (
                    <CourseRow key={course.id} course={course} />
                  ))}
                </div>
              )}
            </section>

            {/* Section 5 – Recently Viewed */}
            <section>
              <SectionHeader icon={Eye} title="Recently Viewed" />
              <div className="space-y-3">
                {recentlyViewed.map((course) => (
                  <CourseRow key={course.id} course={course} />
                ))}
              </div>
            </section>
          </>
        )}
      </div>

      <Footer />
    </div>
  );
};

export default MyLearning;
