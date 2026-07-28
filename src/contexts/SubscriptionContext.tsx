import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface Subscription {
  plan_name: "monthly" | "yearly";
  status: string;
  start_date: string;
  end_date: string;
}

interface SubscriptionContextType {
  subscription: Subscription | null;
  isSubscribed: boolean;
  loading: boolean;
  subscribe: (plan: "monthly" | "yearly") => Promise<void>;
  reactivate: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextType>({
  subscription: null,
  isSubscribed: false,
  loading: true,
  subscribe: async () => {},
  reactivate: async () => {},
});

export const useSubscription = () => useContext(SubscriptionContext);

export const SubscriptionProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setSubscription(null);
      setLoading(false);
      return;
    }
    let subSubscription: any = null;

    const fetchSubscription = () => {
      setLoading(true);
      (supabase as any)
        .from("subscriptions")
        .select("*")
        .eq("user_id", user.id)
        .in("status", ["active", "cancelled"])
        .order("created_at", { ascending: false })
        .then(({ data }: any) => {
          if (data && data.length > 0) {
            const now = new Date();
            const validSub = data.find((sub: any) => 
              !sub.end_date || new Date(sub.end_date) > now
            );
            if (validSub) {
              setSubscription(validSub as Subscription);
            } else {
              setSubscription(null);
            }
          } else {
            setSubscription(null);
          }
          setLoading(false);
        });
    };

    fetchSubscription();

    subSubscription = supabase
      .channel(`public:subscriptions:user_id=eq.${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "subscriptions", filter: `user_id=eq.${user.id}` },
        () => {
          fetchSubscription();
        }
      )
      .subscribe();

    return () => {
      if (subSubscription) supabase.removeChannel(subSubscription);
    };
  }, [user]);

  const isSubscribed = !!subscription;

  const subscribe = async (plan: "monthly" | "yearly") => {
    if (!user) return;
    const now = new Date();
    const expiry = new Date(now);
    if (plan === "monthly") expiry.setMonth(expiry.getMonth() + 1);
    else expiry.setFullYear(expiry.getFullYear() + 1);

    const { data, error } = await (supabase as any)
      .from("subscriptions")
      .upsert(
        {
          user_id: user.id,
          plan_name: plan,
          course_id: null,
          status: "active",
          start_date: now.toISOString(),
          end_date: expiry.toISOString(),
        },
        { onConflict: "user_id" }
      )
      .select();

    if (!error && data && data.length > 0) {
      setSubscription(data[0] as Subscription);
      
      // History Tracking
      try {
        await (supabase as any)
          .from("subscription_history")
          .insert({
            user_id: user.id,
            plan_name: plan,
            action: "subscribed",
            days_changed: plan === "monthly" ? 30 : 365,
            amount: plan === "monthly" ? 499 : 3999,
            created_at: new Date().toISOString()
          });
      } catch (histError) {
        console.error("History tracking failed:", histError);
      }
    }
  };

  const reactivate = async () => {
    if (!subscription || !user) return;
    const { error } = await (supabase as any)
      .from("subscriptions")
      .update({ status: "active" })
      .eq("id", (subscription as any).id);

    if (!error) {
      setSubscription({ ...subscription, status: "active" } as Subscription);

      // History Tracking
      try {
        await (supabase as any)
          .from("subscription_history")
          .insert({
            user_id: user.id,
            plan_name: subscription.plan_name,
            action: "reactivated",
            days_changed: 0,
            amount: null,
            created_at: new Date().toISOString()
          });
      } catch (histError) {
        console.error("History tracking failed:", histError);
      }
    }
  };

  return (
    <SubscriptionContext.Provider value={{ subscription, isSubscribed, loading, subscribe, reactivate }}>
      {children}
    </SubscriptionContext.Provider>
  );
};
