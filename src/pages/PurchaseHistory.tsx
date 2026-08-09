import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Receipt, ExternalLink, ShoppingBag, Crown, Settings } from "lucide-react";
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
  const [subscriptionPurchases, setSubscriptionPurchases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetchSubscriptions = async () => {
      const { data } = await supabase
        .from('subscription_history')
        .select('plan_name, action, amount, created_at')
        .eq('user_id', user.id)
        .eq('action', 'subscribed')
        .not('amount', 'is', null)
        .order('created_at', { ascending: false });
      setSubscriptionPurchases((data || []).map((s: any) => ({
        id: `sub-${s.created_at}`,
        course_title: `${s.plan_name} Subscription`,
        instructor: 'Subscription Plan',
        thumbnail: null,
        price_paid: s.amount,
        created_at: s.created_at,
        telegram_link: null,
        is_subscription: true
      })));
    };
    fetchSubscriptions();
  }, [user]);

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

  const allPurchases = [...purchases, ...subscriptionPurchases].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <CategoryBar />
      <div className="container mx-auto px-4 py-12">
        <h1 className="font-display font-bold text-3xl text-foreground mb-8">Purchase History</h1>

        {allPurchases.length === 0 ? (
          <div className="bg-card rounded-xl border border-border p-12 text-center space-y-4 my-8">
            <ShoppingBag className="h-16 w-16 text-muted-foreground mx-auto" />
            <h2 className="font-display font-semibold text-xl text-foreground">No courses purchased yet</h2>
            <p className="text-muted-foreground max-w-md mx-auto">Browse our courses and start your learning journey today!</p>
            <Link to="/courses">
              <Button className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold px-8">Browse Courses</Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {allPurchases.map((p: any) => {
              if (p.is_subscription) {
                return (
                  <div key={p.id} className="bg-card rounded-2xl border border-border/50 p-5 flex flex-col sm:flex-row gap-5 items-start sm:items-center shadow-sm hover:shadow-md transition-all hover:border-border group">
                    <div className="shrink-0 w-24 h-24 sm:w-32 sm:h-24 bg-gradient-to-br from-amber-500/20 to-amber-600/10 rounded-xl flex items-center justify-center border border-amber-500/20 shadow-inner group-hover:scale-[1.02] transition-transform">
                      <Crown className="h-10 w-10 text-amber-500 drop-shadow-sm" />
                    </div>
                    <div className="flex-1 min-w-0 space-y-1">
                      <h3 className="font-display font-semibold text-lg text-foreground line-clamp-1 flex items-center gap-2">
                        {p.course_title} <Crown className="h-4 w-4 text-amber-500" />
                      </h3>
                      <p className="text-sm text-muted-foreground font-medium">Subscription Plan</p>
                      <p className="text-xs text-muted-foreground/80 pt-1">
                        Purchased on {new Date(p.created_at).toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" })}
                      </p>
                    </div>
                    <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-center w-full sm:w-auto gap-4 sm:gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-0 border-border/50">
                      <div className="bg-primary/10 text-primary px-3 py-1 rounded-full text-sm font-bold shadow-sm">
                        ₹{p.price_paid}
                      </div>
                      <Link to="/billing">
                        <Button size="sm" variant="default" className="w-full sm:w-auto gap-2 text-xs font-semibold shadow-sm hover:shadow">
                          <Settings className="h-3.5 w-3.5" /> Manage
                        </Button>
                      </Link>
                    </div>
                  </div>
                );
              }

              const staticCourse = getCourseById(p.course_id);
              const courseData = p.courses || staticCourse;
              
              if (!courseData) {
                return (
                  <div key={p.id} className="bg-card rounded-2xl border border-border/50 p-5 flex flex-col sm:flex-row gap-5 items-start sm:items-center shadow-sm">
                    <div className="shrink-0 w-24 h-24 sm:w-32 sm:h-24 bg-muted/50 rounded-xl flex items-center justify-center border border-border/50 shadow-inner">
                      <ShoppingBag className="h-10 w-10 text-muted-foreground/40" />
                    </div>
                    <div className="flex-1 min-w-0 space-y-1">
                      <h3 className="font-display font-semibold text-lg text-foreground line-clamp-1">Unknown Course</h3>
                      <p className="text-sm text-muted-foreground font-mono text-xs">{p.course_id}</p>
                      <p className="text-xs text-muted-foreground/80 pt-1">
                        Purchased on {new Date(p.created_at).toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" })}
                      </p>
                    </div>
                    <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-center w-full sm:w-auto gap-4 sm:gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-0 border-border/50">
                      <div className="bg-primary/10 text-primary px-3 py-1 rounded-full text-sm font-bold shadow-sm">
                        ₹{p.price_paid}
                      </div>
                    </div>
                  </div>
                );
              }

              const title = (courseData as any).title;
              const instructor = (courseData as any).instructor_name || (courseData as any).instructor || "Unknown Instructor";
              const thumbnail = (courseData as any).thumbnail_url || (courseData as any).thumbnail;
              const telegramLink = (courseData as any).telegram_link || (courseData as any).telegramLink;

              return (
                <div key={p.id} className="bg-card rounded-2xl border border-border/50 p-5 flex flex-col sm:flex-row gap-5 items-start sm:items-center shadow-sm hover:shadow-md transition-all hover:border-border group">
                  <div className="shrink-0 w-24 h-24 sm:w-32 sm:h-24 rounded-xl overflow-hidden shadow-inner border border-border/50 group-hover:shadow-md transition-shadow relative">
                    {thumbnail ? (
                      <Link to={`/course/${p.course_id}`} className="block w-full h-full">
                        <img src={thumbnail} alt={title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                        <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors"></div>
                      </Link>
                    ) : (
                      <div className="w-full h-full bg-muted/50 flex items-center justify-center">
                        <ShoppingBag className="h-10 w-10 text-muted-foreground/40" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <Link to={`/course/${p.course_id}`}>
                      <h3 className="font-display font-semibold text-lg text-foreground line-clamp-1 hover:text-primary transition-colors">{title}</h3>
                    </Link>
                    <p className="text-sm text-muted-foreground font-medium">by {instructor}</p>
                    <p className="text-xs text-muted-foreground/80 pt-1">
                      Purchased on {new Date(p.created_at).toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" })}
                    </p>
                  </div>
                  <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-center w-full sm:w-auto gap-4 sm:gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-0 border-border/50">
                    <div className="bg-primary/10 text-primary px-3 py-1 rounded-full text-sm font-bold shadow-sm">
                      ₹{p.price_paid}
                    </div>
                    {telegramLink && (
                      <a href={telegramLink} target="_blank" rel="noopener noreferrer" className="w-full sm:w-auto">
                        <Button size="sm" variant="outline" className="w-full gap-2 text-xs font-semibold shadow-sm hover:shadow hover:bg-primary/5 hover:text-primary hover:border-primary/30 transition-all">
                          <ExternalLink className="h-3.5 w-3.5" /> Access
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
