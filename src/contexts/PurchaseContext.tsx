import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface PurchaseContextType {
  purchasedIds: Set<string>;
  isPurchased: (courseId: string) => boolean;
  addPurchasedIds: (ids: string[]) => void;
}

const PurchaseContext = createContext<PurchaseContextType>({
  purchasedIds: new Set(),
  isPurchased: () => false,
  addPurchasedIds: () => {},
});

export const usePurchaseContext = () => useContext(PurchaseContext);

export const PurchaseProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [purchasedIds, setPurchasedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user) { setPurchasedIds(new Set()); return; }
    supabase
      .from("purchases")
      .select("course_id")
      .eq("user_id", user.id)
      .then(({ data }) => {
        setPurchasedIds(new Set((data || []).map((r: any) => r.course_id)));
      });
  }, [user]);

  const isPurchased = useCallback((courseId: string) => purchasedIds.has(courseId), [purchasedIds]);

  const addPurchasedIds = (ids: string[]) => {
    setPurchasedIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.add(id));
      return next;
    });
  };

  return (
    <PurchaseContext.Provider value={{ purchasedIds, isPurchased, addPurchasedIds }}>
      {children}
    </PurchaseContext.Provider>
  );
};
