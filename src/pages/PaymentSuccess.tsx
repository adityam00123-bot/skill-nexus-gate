import { useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { PartyPopper, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

const PaymentSuccess = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const hasRunRef = useRef(false);

  useEffect(() => {
    if (hasRunRef.current) return;
    hasRunRef.current = true;
    
    // Payment and subscription update is now handled securely on the server via RPC 
    // before navigating to this page. We just display the success state here.
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="text-center space-y-6 max-w-md">
        <div className="mx-auto h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center">
          <PartyPopper className="h-10 w-10 text-primary" />
        </div>
        <h1 className="font-display font-extrabold text-3xl text-foreground">
          🎉 Subscription Activated!
        </h1>
        <div className="space-y-2">
          <p className="text-lg font-semibold text-foreground flex items-center justify-center gap-2">
            <Crown className="h-5 w-5 text-primary" /> Welcome to CourseVerse Premium
          </p>
          <p className="text-muted-foreground">You now have access to 2000+ courses</p>
        </div>
        <Button
          size="lg"
          className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold h-12 px-8 text-base"
          onClick={() => navigate("/my-learning")}
        >
          Go to My Learning
        </Button>
      </div>
    </div>
  );
};

export default PaymentSuccess;
