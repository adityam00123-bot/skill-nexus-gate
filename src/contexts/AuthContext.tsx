import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

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
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();
    
    if (!data || data.is_blocked) {
      if (data?.is_blocked) {
        toast({ 
          title: "Account Blocked", 
          description: "Your account is blocked due to violation of our terms and conditions. Please contact support.", 
          variant: "destructive" 
        });
      }
      // Profile deleted or blocked
      await signOut();
      setLoading(false);
      return;
    }
    
    setProfile(data);
    setLoading(false);
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
              toast({ 
                title: "Account Deleted", 
                description: "Your account has been deleted by an administrator. Please contact support if you believe this is a mistake.", 
                variant: "destructive" 
              });
              signOut();
            } else if (payload.eventType === "UPDATE") {
              const updatedProfile = payload.new as Profile;
              setProfile(updatedProfile);
              if (updatedProfile.is_blocked) {
                toast({ 
                  title: "Account Blocked", 
                  description: "Your account is blocked due to violation of our terms and conditions. Please contact support.", 
                  variant: "destructive" 
                });
                signOut();
              }
            }
          }
        )
        .subscribe();
    };

    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          // Use setTimeout to avoid Supabase client deadlock
          setTimeout(() => fetchProfile(session.user.id), 0);
          setupProfileSubscription(session.user.id);
        } else {
          setProfile(null);
          if (profileSubscription) supabase.removeChannel(profileSubscription);
          setLoading(false);
        }
      }
    );

    // THEN check existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
        setupProfileSubscription(session.user.id);
      } else {
        setLoading(false);
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
  };

  return (
    <AuthContext.Provider value={{ user, session, profile, loading, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};
