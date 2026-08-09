import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from 'react-router-dom';
import { ToastAction } from '@/components/ui/toast';
import React from 'react';
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";

const isUUID = (str: string) => 
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str);

const LOCAL_STORAGE_KEY = "cv_cart_dummy_ids";

export function useCart() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [cartIds, setCartIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  // Helper to get dummy IDs from localStorage
  const getLocalDummyIds = (): string[] => {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      return [];
    }
  };

  // Helper to save dummy IDs to localStorage
  const saveLocalDummyIds = (ids: string[]) => {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(ids));
  };

  const fetchCart = useCallback(async () => {
    setLoading(true);
    
    // 1. Get dummy IDs from local storage (works for both logged in and guest)
    const localIds = getLocalDummyIds();
    const combinedIds = new Set<string>(localIds);

    // 2. If logged in, get real IDs from Supabase
    if (user) {
      const { data, error } = await supabase
        .from("cart")
        .select("course_id")
        .eq("user_id", user.id);

      if (!error && data) {
        data.forEach((r: { course_id: string }) => {
          if (isUUID(r.course_id)) {
            combinedIds.add(r.course_id);
          }
        });
      } else if (error) {
        console.error("[useCart] fetch error:", error);
      }
    }
    
    setCartIds(combinedIds);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchCart();
  }, [fetchCart]);

  const addToCart = useCallback(
    async (courseId: string) => {
      if (cartIds.has(courseId)) return;

      // Case A: Dummy Course (Non-UUID)
      if (!isUUID(courseId)) {
        const localIds = getLocalDummyIds();
        if (!localIds.includes(courseId)) {
          const updated = [...localIds, courseId];
          saveLocalDummyIds(updated);
          setCartIds(new Set([...Array.from(cartIds), courseId]));
          toast({
            title: "Added to cart",
            description: "Example course added to your cart (local storage).",
            action: React.createElement(ToastAction, {
              altText: "View Cart",
              onClick: () => navigate('/cart'),
              className: "bg-primary text-primary-foreground hover:bg-primary/90 px-3 py-1.5 rounded-md text-xs font-medium"
            }, "View Cart")
          });
        }
        return;
      }

      // Case B: Real Course (UUID) - Requires Login
      if (!user) {
        toast({ title: "Please log in", description: "Sign in to add real courses to your cart.", variant: "destructive" });
        return;
      }

      setCartIds((prev) => new Set(prev).add(courseId));

      const { error } = await supabase
        .from("cart")
        .upsert(
          { user_id: user.id, course_id: courseId },
          { onConflict: "user_id,course_id" }
        );

      if (error) {
        console.error("[useCart] Error adding to cart:", error);
        setCartIds((prev) => {
          const next = new Set(prev);
          next.delete(courseId);
          return next;
        });
        toast({ title: "Error", description: error.message || "Could not add to cart.", variant: "destructive" });
      } else {
        toast({
          title: "Added to cart",
          description: "Course added to your cart.",
          action: React.createElement(ToastAction, {
            altText: "View Cart",
            onClick: () => navigate('/cart'),
            className: "bg-primary text-primary-foreground hover:bg-primary/90 px-3 py-1.5 rounded-md text-xs font-medium"
          }, "View Cart")
        });
      }
    },
    [user, cartIds],
  );

  const removeFromCart = useCallback(
    async (courseId: string) => {
      // Optimistically remove from state
      setCartIds((prev) => {
        const next = new Set(prev);
        next.delete(courseId);
        return next;
      });

      // Case A: Dummy Course (Non-UUID)
      if (!isUUID(courseId)) {
        const localIds = getLocalDummyIds();
        saveLocalDummyIds(localIds.filter(id => id !== courseId));
        toast({ title: "Removed", description: "Example course removed from your cart." });
        return;
      }

      // Case B: Real Course (UUID)
      if (!user) return;

      const { error } = await supabase
        .from("cart")
        .delete()
        .eq("user_id", user.id)
        .eq("course_id", courseId);

      if (error) {
        console.error("[useCart] Error removing from cart:", error);
        setCartIds((prev) => new Set(prev).add(courseId));
        toast({ title: "Error", description: "Could not remove from cart.", variant: "destructive" });
      } else {
        toast({ title: "Removed", description: "Course removed from your cart." });
      }
    },
    [user],
  );

  const isInCart = useCallback((courseId: string) => cartIds.has(courseId), [cartIds]);

  const cartCount = cartIds.size;

  return { cartIds, cartCount, loading, addToCart, removeFromCart, isInCart, refetch: fetchCart };
}
