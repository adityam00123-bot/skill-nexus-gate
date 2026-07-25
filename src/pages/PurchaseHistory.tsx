import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Receipt, ExternalLink, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import Navbar from "@/components/Navbar";
import CategoryBar from "@/components/CategoryBar";
import Footer from "@/components/Footer";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getCourseById } from "@/data/courses";

interface Purchase {
  id: string;
  course_id: string;
  price_paid: number;
  created_at: string;
  courses?: {
    title: string;
    instructor_name: string;
    thumbnail_url: string;
    price: number;
    telegram_link?: string;
  };
}

const PurchaseHistory = () => {
  const { user, loading: authLoading } = useAuth();
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    const fetchPurchases = async () => {
      // Step 1: Get purchases
      const { data: purchaseData, error: purchaseError } = await supabase
        .from("purchases")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (purchaseError || !purchaseData) {
        setPurchases([]);
        setLoading(false);
        return;
      }

      const allPurchasedIds = purchaseData.map((r: any) => r.course_id);

      // Separate real (UUID) IDs from dummy (slug) IDs
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      const realIds = allPurchasedIds.filter(id => uuidRegex.test(id));

      // Step 2: Fetch real course details from Supabase
      let realCoursesMap: Record<string, any> = {};
      if (realIds.length > 0) {
        const { data: courseRows } = await supabase
          .from("courses")
          .select("id, title, instructor_name, thumbnail_url, price, telegram_link")
          .in("id", realIds);

        if (courseRows) {
          courseRows.forEach((c: any) => {
            realCoursesMap[c.id] = c;
          });
        }
      }

      // Step 3: Map course info to purchases
      const enrichedPurchases = purchaseData.map((p: any) => {
        let courseInfo = null;
        if (uuidRegex.test(p.course_id)) {
          courseInfo = realCoursesMap[p.course_id];
        }
        
        return {
          ...p,
          courses: courseInfo || undefined
        };
      });

      setPurchases(enrichedPurchases);
      setLoading(false);
    };

    fetchPurchases();
  }, [user]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <CategoryBar />
        <div className="container mx-auto px-4 py-12">
          <p className="text-muted-foreground">Loading…</p>
        </div>
        <Footer />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <CategoryBar />
        <div className="container mx-auto px-4 py-12 text-center space-y-4">
          <Receipt className="h-16 w-16 text-muted-foreground mx-auto" />
          <h1 className="font-display font-bold text-2xl text-foreground">Sign in to view purchases</h1>
          <Link to="/login"><Button>Login</Button></Link>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <CategoryBar />
      <div className="container mx-auto px-4 py-12">
        <h1 className="font-display font-bold text-3xl text-foreground mb-8">Purchase History</h1>

        {purchases.length === 0 ? (
          <div className="bg-card rounded-xl border border-border p-12 text-center space-y-4 my-8">
            <ShoppingBag className="h-16 w-16 text-muted-foreground mx-auto" />
            <h2 className="font-display font-semibold text-xl text-foreground">No courses purchased yet</h2>
            <p className="text-muted-foreground max-w-md mx-auto">Browse our courses and start your learning journey today!</p>
            <Link to="/courses">
              <Button className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold px-8">Browse Courses</Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {purchases.map((p) => {
              const staticCourse = getCourseById(p.course_id);
              const courseData = p.courses || staticCourse;
              
              if (!courseData) {
                return (
                  <div key={p.id} className="bg-card rounded-xl border border-border p-4 flex gap-4 items-center">
                    <div className="shrink-0 w-28 h-18 bg-muted rounded-lg flex items-center justify-center">
                      <ShoppingBag className="h-6 w-6 text-muted-foreground/50" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-foreground line-clamp-1">Unknown Course ({p.course_id})</h3>
                      <p className="text-xs text-muted-foreground">
                        Purchased on {new Date(p.created_at).toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" })}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-display font-bold text-foreground">₹{p.price_paid}</p>
                    </div>
                  </div>
                );
              }

              const title = (courseData as any).title;
              const instructor = (courseData as any).instructor_name || (courseData as any).instructor || "Unknown Instructor";
              const thumbnail = (courseData as any).thumbnail_url || (courseData as any).thumbnail;
              const telegramLink = (courseData as any).telegram_link || (courseData as any).telegramLink;

              return (
                <div key={p.id} className="bg-card rounded-xl border border-border p-4 flex gap-4 items-center">
                  <div className="shrink-0">
                    {thumbnail ? (
                      <Link to={`/course/${p.course_id}`}>
                        <img src={thumbnail} alt={title} className="w-28 h-18 object-cover rounded-lg" />
                      </Link>
                    ) : (
                      <div className="w-28 h-18 bg-muted rounded-lg flex items-center justify-center">
                        <ShoppingBag className="h-6 w-6 text-muted-foreground/50" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <Link to={`/course/${p.course_id}`}>
                      <h3 className="font-semibold text-foreground line-clamp-1 hover:text-primary transition-colors">{title}</h3>
                    </Link>
                    <p className="text-xs text-muted-foreground mt-1">by {instructor}</p>
                    <p className="text-xs text-muted-foreground">
                      Purchased on {new Date(p.created_at).toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" })}
                    </p>
                  </div>
                  <div className="text-right shrink-0 space-y-2">
                    <p className="font-display font-bold text-foreground">₹{p.price_paid}</p>
                    {telegramLink && (
                      <a href={telegramLink} target="_blank" rel="noopener noreferrer">
                        <Button size="sm" variant="outline" className="gap-1.5 text-xs">
                          <ExternalLink className="h-3 w-3" /> Access
                        </Button>
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
};

export default PurchaseHistory;
