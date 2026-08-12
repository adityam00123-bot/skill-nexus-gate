import { useState, useMemo, useEffect } from "react";
import { Link } from "react-router-dom";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { courses as staticCourses } from "@/data/courses";
import { supabase } from "@/integrations/supabase/client";

const CourseList = () => {
  const [search, setSearch] = useState("");
  const [dbCourses, setDbCourses] = useState<any[]>([]);

  useEffect(() => {
    const fetchCourses = async () => {
      const { data } = await supabase
        .from("courses")
        .select("id, title")
        .eq("is_published", true)
        .or("is_deleted.eq.false,is_deleted.is.null");
      if (data) setDbCourses(data);
    };
    fetchCourses();
  }, []);

  const allCourses = useMemo(() => {
    const dbIds = new Set(dbCourses.map(c => c.id));
    return [...dbCourses, ...staticCourses.filter(c => !dbIds.has(c.id))];
  }, [dbCourses]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allCourses;
    return allCourses.filter((c) => c.title.toLowerCase().includes(q));
  }, [search, allCourses]);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-1 w-full max-w-[800px] mx-auto px-6 py-10">
        <h1 className="text-2xl font-bold text-foreground mb-6">All Courses</h1>

        <div className="relative mb-8">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search courses..."
            className="pl-11 h-11 bg-muted border-border focus:border-primary rounded-full text-sm"
          />
        </div>

        {filtered.length === 0 ? (
          <p className="text-muted-foreground text-sm">No courses found.</p>
        ) : (
          <ul className="divide-y divide-border">
            {filtered.map((course) => (
              <li key={course.id}>
                <Link
                  to={`/course/${course.id}`}
                  className="block py-3 px-2 text-sm text-foreground hover:bg-muted rounded-md transition-colors"
                >
                  {course.title}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default CourseList;
