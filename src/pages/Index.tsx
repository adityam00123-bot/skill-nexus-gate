import { Link } from "react-router-dom";
import { ArrowRight, BookOpen, TrendingUp, Users, Clock, Flame, Star as StarIcon, LayoutGrid } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import Navbar from "@/components/Navbar";
import CategoryBar from "@/components/CategoryBar";
import HeroSlider from "@/components/HeroSlider";
import Footer from "@/components/Footer";
import CourseCard from "@/components/CourseCard";
import { categories, type Course } from "@/data/courses";
import { useAuth } from "@/contexts/AuthContext";
import { usePurchaseContext } from "@/contexts/PurchaseContext";
import { useMemo, useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

const SectionHeader = ({
  title,
  icon,
  linkTo,
  linkText,
}: {
  title: string;
  icon?: React.ReactNode;
  linkTo: string;
  linkText: string;
}) => (
  <div className="flex items-center justify-between mb-6">
    <div className="flex items-center gap-2">
      {icon}
      <h2 className="font-display font-bold text-xl md:text-2xl text-foreground">{title}</h2>
    </div>
    <Link to={linkTo}>
      <Button variant="ghost" size="sm" className="text-primary hover:text-primary/80">
        {linkText} <ArrowRight className="ml-1 h-4 w-4" />
      </Button>
    </Link>
  </div>
);

const CourseScrollGrid = ({ children }: { children: React.ReactNode }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 md:grid-cols-2">
    {children}
  </div>
);

// Map Supabase course row to the frontend Course type
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

const Index = () => {
  const { user } = useAuth();
  const { purchasedIds } = usePurchaseContext();
  const [dbCourses, setDbCourses] = useState<Course[]>([]);

  // Fetch real courses from Supabase
  useEffect(() => {
    const fetchCourses = async () => {
      const { data } = await supabase
        .from("courses")
        .select("*")
        .eq("is_published", true)
        .or("is_deleted.eq.false,is_deleted.is.null");
      if (data) setDbCourses(data.map(mapDbCourse));
    };
    fetchCourses();
  }, []);

  // Continue Learning – purchased courses from Supabase
  const purchasedCourses = useMemo(() => {
    return dbCourses
      .filter((c) => purchasedIds.has(c.id))
      .slice(0, 4);
  }, [purchasedIds, dbCourses]);

  // Latest courses – most recently created
  const latestCourses = useMemo(() => [...dbCourses].reverse().slice(0, 8), [dbCourses]);

  // Top selling – sort by student count desc
  const topSelling = useMemo(
    () => [...dbCourses].sort((a, b) => b.students - a.students).slice(0, 8),
    [dbCourses]
  );

  // Recommended – a different slice
  const recommended = useMemo(() => dbCourses.slice(0, 8), [dbCourses]);

  // Featured
  const featured = useMemo(() => dbCourses.filter((c) => c.featured).slice(0, 8), [dbCourses]);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <CategoryBar />
      <HeroSlider />


      {/* SECTION 1 – Continue Learning (purchased only) */}
      {user && purchasedCourses.length > 0 && (
        <section className="max-w-[1200px] mx-auto px-6 py-10">
          <SectionHeader
            title="Continue Learning"
            icon={<Clock className="h-5 w-5 text-primary" />}
            linkTo="/my-learning"
            linkText="View All"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {purchasedCourses.map((course) => {
              const mockProgress = Math.floor(Math.random() * 80) + 10;
              return (
                <div
                  key={course!.id}
                  className="rounded-xl overflow-hidden bg-card border border-border hover:border-primary/50 transition-all duration-300 shadow-card hover:shadow-glow hover:-translate-y-1 flex flex-col"
                >
                  <Link to={`/course/${course!.id}`} className="block">
                    <div className="relative aspect-video overflow-hidden">
                      <img
                        src={course!.thumbnail}
                        alt={course!.title}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    </div>
                  </Link>
                  <div className="p-4 space-y-3 flex-1 flex flex-col">
                    <Link to={`/course/${course!.id}`}>
                      <h3 className="font-display font-semibold text-foreground line-clamp-2 hover:text-primary transition-colors">
                        {course!.title}
                      </h3>
                    </Link>
                    <div className="space-y-1.5 mt-auto">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{mockProgress}% complete</span>
                      </div>
                      <Progress value={mockProgress} className="h-2" />
                    </div>
                    <Link to={`/course/${course!.id}`} className="mt-2">
                      <Button size="sm" className="w-full bg-primary text-primary-foreground hover:bg-primary/90 text-xs">
                        Resume
                      </Button>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* SECTION 2 – Latest Courses */}
      {latestCourses.length > 0 && (
      <section className="max-w-[1200px] mx-auto px-6 py-10">
        <SectionHeader
          title="Latest Courses"
          icon={<BookOpen className="h-5 w-5 text-primary" />}
          linkTo="/courses"
          linkText="View All Courses"
        />
        <CourseScrollGrid>
          {latestCourses.map((course) => (
            <CourseCard key={course.id} course={course} />
          ))}
        </CourseScrollGrid>
      </section>
      )}

      {/* SECTION 3 – Top Selling Courses */}
      {topSelling.length > 0 && (
      <section className="max-w-[1200px] mx-auto px-6 py-10">
        <SectionHeader
          title="Top Selling Courses 🔥"
          icon={<TrendingUp className="h-5 w-5 text-primary" />}
          linkTo="/courses"
          linkText="View All Courses"
        />
        <CourseScrollGrid>
          {topSelling.map((course) => (
            <CourseCard key={course.id} course={course} />
          ))}
        </CourseScrollGrid>
      </section>
      )}

      {/* SECTION 4 – Recommended For You (logged in only) */}
      {user && recommended.length > 0 && (
        <section className="max-w-[1200px] mx-auto px-6 py-10">
          <SectionHeader
            title="Recommended For You"
            icon={<Users className="h-5 w-5 text-primary" />}
            linkTo="/courses"
          linkText="View All Courses"
        />
        <CourseScrollGrid>
          {recommended.map((course) => (
              <CourseCard key={course.id} course={course} />
            ))}
          </CourseScrollGrid>
        </section>
      )}

      {/* SECTION 5 – Featured Courses */}
      {featured.length > 0 && (
      <section className="max-w-[1200px] mx-auto px-6 py-10">
        <SectionHeader
          title="Featured Courses ⭐"
          icon={<StarIcon className="h-5 w-5 text-primary" />}
          linkTo="/courses"
          linkText="View All Courses"
        />
        <CourseScrollGrid>
          {featured.map((course) => (
            <CourseCard key={course.id} course={course} />
          ))}
        </CourseScrollGrid>
      </section>
      )}

      {/* Explore by Category */}
      <section className="max-w-[1200px] mx-auto px-6 py-10">
        <div className="text-center mb-8">
          <h2 className="font-display font-bold text-2xl md:text-3xl text-foreground">Explore by Category</h2>
          <p className="text-muted-foreground mt-2">Find courses that match your learning goals</p>
        </div>
        {/* All Courses – full width card */}
        <Link
          to="/courses"
          className="group flex items-center gap-4 p-6 rounded-xl bg-card border border-border hover:border-primary/50 transition-all duration-300 hover:shadow-glow hover:-translate-y-1 mb-4 w-full"
        >
          <LayoutGrid className="h-9 w-9 text-primary group-hover:scale-110 transition-transform duration-300 shrink-0" />
          <div>
            <span className="font-display font-semibold text-foreground text-lg">All Courses</span>
            <span className="block text-sm text-muted-foreground">Browse All Courses</span>
          </div>
          <ArrowRight className="ml-auto h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
        </Link>
        {/* Category grid – 4 per row */}
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {categories.map((cat) => (
            <Link
              key={cat.id}
              to={`/courses?category=${cat.id}`}
              className="group flex flex-col items-center gap-3 p-6 rounded-xl bg-card border border-border hover:border-primary/50 transition-all duration-300 hover:shadow-glow hover:-translate-y-1"
            >
              <span className="text-4xl group-hover:scale-110 transition-transform duration-300">{cat.icon}</span>
              <span className="font-display font-semibold text-foreground">{cat.name}</span>
              <span className="text-sm text-muted-foreground">Explore</span>
            </Link>
          ))}
        </div>
      </section>
      {/* CTA - guest only */}
      {!user && (
        <section className="container mx-auto px-4 py-10">
          <div className="rounded-2xl bg-card-gradient border border-border p-8 md:p-16 text-center shadow-glow">
            <h2 className="font-display font-bold text-3xl md:text-4xl text-foreground mb-4">
              Ready to Start Learning?
            </h2>
            <p className="text-muted-foreground mb-8 max-w-lg mx-auto">
              Join thousands of students who are already mastering the markets and building wealth.
            </p>
            <Link to="/courses">
              <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold px-8 shadow-glow">
                Browse All Courses <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </section>
      )}

      <Footer />
    </div>
  );
};

export default Index;
