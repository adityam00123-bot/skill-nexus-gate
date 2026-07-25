import { useState, useMemo, useEffect } from "react";
import { useSearchParams, Link, useNavigate } from "react-router-dom";
import {
  CheckCircle, MessageCircle, Shield, CreditCard, Smartphone,
  Building, Coins, Tag, X, Lock, Wallet, ChevronDown, Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { getCourseById } from "@/data/courses";
import { useAuth } from "@/contexts/AuthContext";
import { useCartContext } from "@/contexts/CartContext";
import { usePurchaseContext } from "@/contexts/PurchaseContext";
import { useCvCoins } from "@/hooks/useCvCoins";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type PaymentMethod = "wallet";

// Helper to check if a string is a UUID
const isUUID = (str: string) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
};

const Checkout = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const courseId = searchParams.get("courseId") || searchParams.get("course") || "";
  const { user, profile } = useAuth();
  const { cartIds, removeFromCart } = useCartContext();
  const { isPurchased, addPurchasedIds } = usePurchaseContext();
  const { balance, spendCoins } = useCvCoins();

  const [checkoutCourses, setCheckoutCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("wallet");
  const [coupon, setCoupon] = useState("");
  const [couponApplied, setCouponApplied] = useState(false);
  const [couponError, setCouponError] = useState(false);
  const [useCoins, setUseCoins] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const fetchCheckoutData = async () => {
      setLoading(true);
      
      const idsToFetch = courseId ? [courseId] : Array.from(cartIds);
      if (idsToFetch.length === 0) {
        setCheckoutCourses([]);
        setLoading(false);
        return;
      }

      const uuidList = idsToFetch.filter(isUUID);
      const slugList = idsToFetch.filter(id => !isUUID(id));

      const fetched: any[] = [];

      // Fetch dummy courses
      slugList.forEach(slug => {
        const dummy = getCourseById(slug);
        if (dummy && !isPurchased(dummy.id)) {
          fetched.push({
            id: dummy.id,
            title: dummy.title,
            price: dummy.price,
            originalPrice: dummy.originalPrice,
            thumbnail: dummy.thumbnail,
            instructor: dummy.instructor,
            telegramLink: dummy.telegramLink
          });
        }
      });

      // Fetch Supabase courses
      if (uuidList.length > 0) {
        const { data, error } = await supabase
          .from("courses")
          .select("*")
          .in("id", uuidList);

        if (!error && data) {
          data.forEach(d => {
            if (!isPurchased(d.id)) {
              fetched.push({
                id: d.id,
                title: d.title,
                price: d.price || 0,
                originalPrice: d.original_price || d.price || 0,
                thumbnail: d.thumbnail_url,
                instructor: d.instructor_name,
                telegramLink: d.telegram_link
              });
            }
          });
        }
      }

      setCheckoutCourses(fetched);
      setLoading(false);
    };

    fetchCheckoutData();
  }, [courseId, cartIds, isPurchased]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (checkoutCourses.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="font-display font-bold text-2xl text-foreground">No courses to checkout</h1>
          <Link to="/courses"><Button className="mt-4">Browse Courses</Button></Link>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="font-display font-bold text-2xl text-foreground mb-4">Sign in required</h1>
          <p className="text-muted-foreground mb-6">You need to sign in to complete your purchase.</p>
          <Link to="/login"><Button>Sign In</Button></Link>
        </div>
      </div>
    );
  }

  const subtotal = checkoutCourses.reduce((sum, c) => sum + c.price, 0);
  const originalSubtotal = checkoutCourses.reduce((sum, c) => sum + c.originalPrice, 0);
  const discountAmount = originalSubtotal - subtotal;
  const discountPercent = originalSubtotal > 0 ? Math.round((discountAmount / originalSubtotal) * 100) : 0;
  
  const couponDiscount = couponApplied ? Math.floor(subtotal * 0.1) : 0;
  const maxCoins = Math.min(balance, Math.floor((subtotal - couponDiscount) * 0.5));
  const coinDiscount = useCoins ? maxCoins : 0;
  const total = Math.max(0, subtotal - couponDiscount - coinDiscount);

  const handleApplyCoupon = () => {
    if (coupon.trim().toUpperCase() === "CV10") {
      setCouponApplied(true);
      setCouponError(false);
      toast.success("Coupon CV10 applied! 10% off");
    } else {
      setCouponError(true);
    }
  };

  const handlePayment = async () => {
    if (paymentMethod === "wallet" && (profile?.wallet_balance || 0) < total) {
      toast.error("Insufficient wallet balance. Please add funds.");
      return;
    }

    setProcessing(true);
    try {
      // Only real courses (UUIDs) can be purchased in DB
      const realCourses = checkoutCourses.filter(c => isUUID(c.id));
      
      if (useCoins && coinDiscount > 0) {
        await spendCoins(coinDiscount, `Discount on checkout`);
      }

      if (realCourses.length > 0) {
        const rows = realCourses.map(c => ({
          user_id: user.id,
          course_id: c.id,
          price_paid: c.price - (realCourses.length > 0 ? (couponDiscount + coinDiscount) / realCourses.length : 0),
        }));

        if (paymentMethod === "wallet") {
          const { data: rpcRes, error: rpcError } = await supabase.rpc("process_wallet_purchase", {
            p_user_id: user.id,
            p_amount: total,
            p_course_ids: realCourses.map(c => c.id)
          });
          if (rpcError) throw rpcError;
          if (!rpcRes.success) throw new Error(rpcRes.error || "Wallet purchase failed");
        } else {
          const { error } = await supabase.from("purchases").insert(rows);
          if (error) throw error;
        }
        
        // Subscription Logic Injection
        try {
          console.log("Purchase success — inserting subscriptions...");
          
          for (const course of checkoutCourses) {
            if (!course.id || !user?.id) continue;
            console.log("user_id:", user.id, "course_id:", course.id);
            
            // Check if subscription already exists
            const { data: existing } = await (supabase as any)
              .from("subscriptions")
              .select("id")
              .eq("user_id", user.id)
              .eq("course_id", course.id);
            
            if (existing && existing.length > 0) {
              console.log("Subscription already exists, skipping...");
              continue;
            }
            
            const { error: subError } = await (supabase as any)
              .from("subscriptions")
              .insert({
                user_id: user.id,
                course_id: course.id,
                plan_name: "Lifetime",
                start_date: new Date().toISOString(),
                end_date: null,
                status: "active"
              });
            
            if (subError) {
              console.error("Subscription insert error:", subError);
            } else {
              console.log("Subscription inserted for:", course.id);
            }
          }
        } catch (err) {
          console.error("Subscription insert failed:", err);
        }
        
        // Remove real courses from cart if checking out entire cart
        if (!courseId) {
          for (const c of realCourses) {
            await removeFromCart(c.id);
          }
        }
        
        addPurchasedIds(realCourses.map(c => c.id));
      }

      // Handle dummy courses success state separately (they don't go to DB)
      const dummyCourses = checkoutCourses.filter(c => !isUUID(c.id));
      if (dummyCourses.length > 0) {
        if (!courseId) {
          for (const c of dummyCourses) {
            await removeFromCart(c.id);
          }
        }
        addPurchasedIds(dummyCourses.map(c => c.id));
      }

      setSuccess(true);
    } catch (e: any) {
      toast.error(e.message || "Payment failed. Please try again.");
    } finally {
      setProcessing(false);
    }
  };

  // ===== SUCCESS STATE =====
  if (success) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center space-y-6 py-12">
          <div className="bg-card border border-border rounded-2xl p-8 space-y-6">
            <div className="text-6xl">🎉</div>
            <div>
              <h1 className="font-display font-bold text-2xl text-foreground">Payment Successful!</h1>
              <p className="text-muted-foreground mt-2">You now have access to {checkoutCourses.length} course(s)</p>
            </div>

            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
              {checkoutCourses.map(c => (
                <div key={c.id} className="flex items-center gap-3 bg-muted/30 rounded-lg p-3">
                  <img src={c.thumbnail} alt={c.title} className="w-16 h-11 rounded object-cover shrink-0" />
                  <p className="font-semibold text-foreground text-xs text-left line-clamp-2">{c.title}</p>
                </div>
              ))}
            </div>

            <div className="space-y-3">
              {checkoutCourses.length === 1 && checkoutCourses[0].telegramLink && (
                <a href={checkoutCourses[0].telegramLink} target="_blank" rel="noopener noreferrer" className="block">
                  <Button size="lg" className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-semibold">
                    <MessageCircle className="mr-2 h-5 w-5" /> Access Course on Telegram
                  </Button>
                </a>
              )}
              <Link to="/purchase-history" className="block">
                <Button size="lg" variant="outline" className="w-full font-semibold">
                  View Purchase History
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ===== CHECKOUT LAYOUT =====
  return (
    <div className="min-h-screen bg-background">
      {/* Minimal top bar */}
      <div className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 h-14 flex items-center justify-between max-w-6xl">
          <Link to="/" className="font-display font-bold text-lg text-foreground">
            Course<span className="text-primary">Verse</span>
          </Link>
          <button
            onClick={() => navigate(-1)}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <h1 className="font-display font-bold text-3xl text-foreground mb-8">Checkout</h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* LEFT — Payment + Order Details */}
          <div className="lg:col-span-2 space-y-6">

            {/* Payment Method */}
            <div className="bg-card border border-border rounded-xl p-6">
              <h2 className="font-display font-bold text-lg text-foreground mb-4 flex items-center">
                <Wallet className="w-5 h-5 mr-2 text-primary" />
                Payment Method: CourseVerse Wallet
              </h2>

              <div className="p-4 bg-muted/50 rounded-lg border border-border flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm text-muted-foreground">Current Balance</p>
                  <p className="font-display font-bold text-xl">₹{(profile?.wallet_balance || 0).toLocaleString()}</p>
                </div>
              </div>

              {(profile?.wallet_balance || 0) < total ? (
                 <div className="space-y-2">
                   <p className="text-sm text-destructive font-medium">Insufficient balance to complete this purchase.</p>
                 </div>
              ) : (
                 <p className="text-sm text-green-500 font-medium">Sufficient balance available. Amount will be deducted securely.</p>
              )}
            </div>

            {/* Order Details */}
            <div className="bg-card border border-border rounded-xl p-6">
              <h2 className="font-display font-bold text-lg text-foreground mb-4">
                Order details <span className="text-muted-foreground font-normal text-sm">({checkoutCourses.length} {checkoutCourses.length === 1 ? 'course' : 'courses'})</span>
              </h2>
              <div className="space-y-4">
                {checkoutCourses.map(c => (
                  <div key={c.id} className="flex gap-4 items-start pb-4 border-b border-border last:border-0 last:pb-0">
                    <img src={c.thumbnail} alt={c.title} className="w-28 h-[4.5rem] rounded-lg object-cover shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-foreground text-sm leading-tight line-clamp-2">{c.title}</p>
                      <p className="text-xs text-muted-foreground mt-1">by {c.instructor}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-display font-bold text-foreground">₹{c.price}</p>
                      <p className="text-xs text-muted-foreground line-through">₹{c.originalPrice}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* RIGHT — Order Summary (sticky) */}
          <div className="lg:col-span-1">
            <div className="sticky top-20 space-y-4">
              {/* Coupon Code */}
              <div className="bg-card border border-border rounded-xl p-5">
                <p className="text-sm font-semibold text-foreground mb-3">Have a coupon?</p>
                <div className="flex gap-2">
                  <Input
                    placeholder="Enter coupon code"
                    value={coupon}
                    onChange={(e) => {
                      setCoupon(e.target.value);
                      if (!couponApplied) setCouponError(false);
                    }}
                    disabled={couponApplied}
                    className="bg-background text-sm"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                    onClick={handleApplyCoupon}
                    disabled={couponApplied || !coupon.trim()}
                  >
                    {couponApplied ? "Applied" : "Apply"}
                  </Button>
                </div>
                {couponApplied && (
                  <p className="text-xs text-primary mt-2">Coupon applied! You saved ₹{couponDiscount}</p>
                )}
                {couponError && (
                  <p className="text-xs text-destructive mt-2">Invalid coupon code</p>
                )}
              </div>

              {/* Order Summary */}
              <div className="bg-card border border-border rounded-xl p-6 space-y-5">
                <h2 className="font-display font-bold text-lg text-foreground">Order Summary</h2>

                <div className="space-y-2.5 text-sm">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Original Price</span>
                    <span>₹{originalSubtotal}</span>
                  </div>
                  <div className="flex justify-between text-primary">
                    <span>Discount ({discountPercent}% Off)</span>
                    <span>-₹{discountAmount}</span>
                  </div>
                  {couponApplied && (
                    <div className="flex justify-between text-primary">
                      <span>Coupon (CV10)</span>
                      <span>-₹{couponDiscount}</span>
                    </div>
                  )}
                  {useCoins && coinDiscount > 0 && (
                    <div className="flex justify-between text-[hsl(var(--warning))]">
                      <span>CV Coins ({coinDiscount})</span>
                      <span>-₹{coinDiscount}</span>
                    </div>
                  )}
                </div>

                <Separator />

                <div className="flex justify-between font-display font-bold text-xl text-foreground">
                  <span>Total ({checkoutCourses.length} {checkoutCourses.length === 1 ? 'course' : 'courses'})</span>
                  <span>₹{total}</span>
                </div>

                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  By completing your purchase, you agree to our{" "}
                  <span className="underline cursor-pointer">Terms of Use</span>
                </p>

                {(profile?.wallet_balance || 0) < total ? (
                  <Link to={`/wallet?amount=${total - (profile?.wallet_balance || 0)}`} className="block w-full">
                    <Button
                      size="lg"
                      className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-bold text-base"
                    >
                      <Wallet className="mr-2 h-4 w-4" />
                      Add Funds (₹{total - (profile?.wallet_balance || 0)})
                    </Button>
                  </Link>
                ) : (
                  <Button
                    size="lg"
                    className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-bold text-base"
                    onClick={handlePayment}
                    disabled={processing || checkoutCourses.every(c => isPurchased(c.id))}
                  >
                    <Lock className="mr-2 h-4 w-4" />
                    {processing ? "Processing…" : "Complete Purchase"}
                  </Button>
                )}

                <p className="text-[11px] text-muted-foreground text-center">
                  7-day refund only if any issue found
                </p>

                {/* CV Coins */}
                {balance > 0 && (
                  <>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                          <Coins className="h-4 w-4 text-[hsl(var(--warning))]" /> Use CV Coins
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {balance} coins available · Max ₹{maxCoins} off
                        </p>
                      </div>
                      <Switch checked={useCoins} onCheckedChange={setUseCoins} />
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ── Payment Option Component ── */
function PaymentOption({
  selected,
  onClick,
  label,
  description,
  icon,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  label: string;
  description: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`border rounded-xl p-4 cursor-pointer transition-all ${
        selected
          ? "border-primary bg-primary/5"
          : "border-border hover:border-muted-foreground/40"
      }`}
      onClick={onClick}
    >
      <div className="flex items-center gap-3">
        <div
          className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
            selected ? "border-primary" : "border-muted-foreground/40"
          }`}
        >
          {selected && <div className="w-2 h-2 rounded-full bg-primary" />}
        </div>
        <div className="text-muted-foreground">{icon}</div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-foreground">{label}</p>
          <p className="text-[11px] text-muted-foreground">{description}</p>
        </div>
      </div>
      {selected && <div className="ml-7">{children}</div>}
    </div>
  );
}

export default Checkout;
