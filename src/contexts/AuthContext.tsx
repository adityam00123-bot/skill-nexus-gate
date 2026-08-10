import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import AuthModal from "@/components/AuthModal";
import { Loader2, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

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
  isAuthModalOpen: boolean;
  setAuthModalOpen: (open: boolean) => void;
  authModalView: "login" | "signup";
  setAuthModalView: (view: "login" | "signup") => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  profile: null,
  loading: true,
  signOut: async () => {},
  refreshProfile: async () => {},
  isAuthModalOpen: false,
  setAuthModalOpen: () => {},
  authModalView: "login",
  setAuthModalView: () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  
  // UI States
  const [isAuthModalOpen, setAuthModalOpen] = useState(false);
  const [authModalView, setAuthModalView] = useState<"login" | "signup">("login");
  const [isBlocked, setIsBlocked] = useState(false);
  
  // Loading gates
  const [loading, setLoading] = useState(true);
  
  // Check if there's any supabase token in localStorage before React renders
  // This helps us show a full screen loader instead of the public site flashing
  const [isInitializing, setIsInitializing] = useState(() => {
    try {
      // Find any key in localStorage matching sb-*-auth-token
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith("sb-") && key.endsWith("-auth-token")) {
          return true; // We likely have a session, show loading gate
        }
      }
    } catch (e) {
      // Ignore
    }
    return false; // No session apparent, let public site load instantly
  });

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();
    
    if (data?.is_blocked) {
      setIsBlocked(true);
      await supabase.auth.signOut();
      setLoading(false);
      setIsInitializing(false);
      return;
    }
    
    setIsBlocked(false);
    setProfile(data);
    setLoading(false);
    setIsInitializing(false);
  };

  const refreshProfile = useCallback(async () => {
    if (user) {
      await fetchProfile(user.id);
    }
  }, [user]);

  const checkOAuthIntent = async (currentUser: User) => {
    const intent = localStorage.getItem("oauth_intent");
    if (!intent) return true;

    const createdAt = new Date(currentUser.created_at).getTime();
    const lastSignIn = new Date(currentUser.last_sign_in_at || currentUser.created_at).getTime();
    const isNewUser = Math.abs(lastSignIn - createdAt) < 15000; // within 15 seconds

    localStorage.removeItem("oauth_intent");

    if (intent === "login" && isNewUser) {
      await supabase.rpc('delete_current_user');
      await supabase.auth.signOut();
      toast({
        title: "Account not found",
        description: "Please sign up first before logging in.",
        variant: "destructive"
      });
      return false;
    }

    if (intent === "signup" && !isNewUser) {
      await supabase.auth.signOut();
      toast({
        title: "User already exists",
        description: "Please use the Login button instead.",
        variant: "destructive"
      });
      return false;
    }

    return true;
  };

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
                window.location.href = "/";
              });
            } else if (payload.eventType === "UPDATE") {
              const updatedProfile = payload.new as Profile;
              setProfile(updatedProfile);
              if (updatedProfile.is_blocked) {
                setIsBlocked(true);
                supabase.auth.signOut();
              }
            }
          }
        )
        .subscribe();
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (session?.user) {
          const isValid = await checkOAuthIntent(session.user);
          if (!isValid) {
            setSession(null);
            setUser(null);
            setLoading(false);
            setIsInitializing(false);
            return;
          }
        }
        
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
      if (session?.user) {
        const isValid = await checkOAuthIntent(session.user);
        if (!isValid) {
          setSession(null);
          setUser(null);
          setLoading(false);
          setIsInitializing(false);
          return;
        }
      }

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
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setIsBlocked(false);
  };

  // 1. Loading Gate
  if (isInitializing) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center">
        <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center mb-6 animate-pulse shadow-lg shadow-primary/20">
          <span className="text-primary-foreground font-bold text-2xl">CV</span>
        </div>
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // 2. Blocked Screen
  if (isBlocked) {
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
      refreshProfile,
      isAuthModalOpen,
      setAuthModalOpen,
      authModalView,
      setAuthModalView
    }}>
      {children}
      <AuthModal 
        isOpen={isAuthModalOpen} 
        onClose={() => setAuthModalOpen(false)} 
        defaultView={authModalView}
      />
    </AuthContext.Provider>
  );
};
