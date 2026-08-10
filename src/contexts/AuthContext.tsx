import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation, useNavigate } from "react-router-dom";

interface Profile {
  full_name: string | null;
  avatar_url: string | null;
  is_blocked?: boolean;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  profile: null,
  loading: true,
  signOut: async () => {},
  refreshProfile: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isBlocked, setIsBlocked] = useState(false);
  const [loading, setLoading] = useState(true);
  
  const location = useLocation();
  const navigate = useNavigate();
  const isAuthRoute = location.pathname === "/login" || location.pathname === "/signup";

  const [isProcessingHash, setIsProcessingHash] = useState(() => window.location.hash.includes("access_token"));

  useEffect(() => {
    if (isProcessingHash) {
      const interval = setInterval(() => {
        if (!window.location.hash.includes("access_token")) {
          setIsProcessingHash(false);
          clearInterval(interval);
        }
      }, 50);
      return () => clearInterval(interval);
    }
  }, [isProcessingHash]);

  const [isInitializing, setIsInitializing] = useState(() => {
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith("sb-") && key.endsWith("-auth-token")) {
          return true; 
        }
      }
    } catch (e) {}
    return false;
  });

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();
    
    if (data?.is_blocked && !isAuthRoute) {
      setIsBlocked(true);
      await supabase.auth.signOut();
      setLoading(false);
      setIsInitializing(false);
      return;
    }
    
    setIsBlocked(data?.is_blocked || false);
    setProfile(data);
    setLoading(false);
    setIsInitializing(false);
  };

  const refreshProfile = useCallback(async () => {
    if (user) {
      await fetchProfile(user.id);
    }
  }, [user]);

  useEffect(() => {
    let profileSubscription: any = null;

    const setupProfileSubscription = (userId: string) => {
      if (profileSubscription) supabase.removeChannel(profileSubscription);
      
      profileSubscription = supabase
        .channel(`public:profiles:id=eq.${userId}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "profiles", filter: `id=eq.${userId}` },
          (payload) => {
            if (payload.eventType === "DELETE") {
              supabase.auth.signOut().then(() => {
                if (!isAuthRoute) window.location.href = "/";
              });
            } else if (payload.eventType === "UPDATE") {
              const updatedProfile = payload.new as Profile;
              setProfile(updatedProfile);
              if (updatedProfile.is_blocked) {
                setIsBlocked(true);
                if (!isAuthRoute) supabase.auth.signOut();
              }
            }
          }
        )
        .subscribe();
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          setTimeout(() => fetchProfile(session.user.id), 0);
          setupProfileSubscription(session.user.id);
        } else {
          setProfile(null);
          if (profileSubscription) supabase.removeChannel(profileSubscription);
          setLoading(false);
          setIsInitializing(false);
        }
      }
    );

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
        setupProfileSubscription(session.user.id);
      } else {
        setLoading(false);
        setIsInitializing(false);
      }
    });

    return () => {
      subscription.unsubscribe();
      if (profileSubscription) supabase.removeChannel(profileSubscription);
    };
  }, [isAuthRoute]);

  // Safely intercept oauth_intent after Supabase finishes initializing and hash processing
  useEffect(() => {
    if (!isInitializing && !isProcessingHash && !isAuthRoute) {
      const intent = localStorage.getItem("oauth_intent");
      if (intent) {
        navigate(`/${intent}`, { replace: true });
      }
    }
  }, [isInitializing, isAuthRoute, navigate]);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setIsBlocked(false);
  };

  if (isInitializing && !isAuthRoute) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center">
        <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center mb-6 animate-pulse shadow-lg shadow-primary/20">
          <span className="text-primary-foreground font-bold text-2xl">CV</span>
        </div>
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Prevent homepage flash if we're about to redirect based on intent
  if (!isInitializing && !isAuthRoute && localStorage.getItem("oauth_intent")) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center">
        <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center mb-6 animate-pulse shadow-lg shadow-primary/20">
          <span className="text-primary-foreground font-bold text-2xl">CV</span>
        </div>
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Prevent homepage flash if we're about to redirect based on intent
  if ((isInitializing || isProcessingHash || localStorage.getItem("oauth_intent")) && !isAuthRoute) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center">
        <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center mb-6 animate-pulse shadow-lg shadow-primary/20">
          <span className="text-primary-foreground font-bold text-2xl">CV</span>
        </div>
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isBlocked && !isAuthRoute) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="bg-card border border-border rounded-2xl p-8 max-w-md w-full text-center shadow-lg">
          <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <ShieldAlert className="h-8 w-8 text-destructive" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">Account Blocked</h1>
          <p className="text-muted-foreground mb-6">
            Your account has been restricted due to a violation of our terms of service. You no longer have access to CourseVerse.
          </p>
          
          <div className="space-y-3 pt-4 border-t border-border">
            <p className="text-sm font-medium text-foreground">Think this is a mistake? Contact us:</p>
            <Button variant="outline" className="w-full" onClick={() => window.location.href = "mailto:support@courseverse.com"}>
              Email Support
            </Button>
            <Button variant="outline" className="w-full" onClick={() => window.open("https://t.me/courseversesupport", "_blank")}>
              Message on Telegram
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ 
      user, 
      session, 
      profile, 
      loading, 
      signOut, 
      refreshProfile
    }}>
      {children}
    </AuthContext.Provider>
  );
};
