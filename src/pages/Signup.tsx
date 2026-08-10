import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { UserPlus, Mail, Lock, Eye, EyeOff, Loader2, AlertCircle, User, BookOpen, Users } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useAuth } from "@/contexts/AuthContext";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function Signup() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const navigate = useNavigate();
  const { toast } = useToast();
  const { session } = useAuth();

  useEffect(() => {
    let isMounted = true;
    
    const verifyAuth = async () => {
      if (!session?.user) {
        if (isMounted) setIsVerifying(false);
        return;
      }
      
      if (isMounted) {
        setIsVerifying(true);
        setError(null);
      }

      // Check intent
      const intent = localStorage.getItem("oauth_intent");
      if (intent) {
        const createdAt = new Date(session.user.created_at).getTime();
        const lastSignIn = new Date(session.user.last_sign_in_at || session.user.created_at).getTime();
        const isNewUser = Math.abs(lastSignIn - createdAt) < 15000;

        localStorage.removeItem("oauth_intent");

        if (intent === "signup" && !isNewUser) {
          await supabase.auth.signOut();
          if (isMounted) {
            setError("User already exists. Please sign in instead.");
            setIsVerifying(false);
          }
          return;
        }
      }

      // Check blocked
      const { data } = await supabase.from("profiles").select("is_blocked").eq("id", session.user.id).single();
      if (data?.is_blocked) {
        await supabase.auth.signOut();
        if (isMounted) {
          setError("Your account is blocked due to a violation of our terms. Please contact support.");
          setIsVerifying(false);
        }
        return;
      }

      // If passed
      if (isMounted) {
        navigate("/", { replace: true });
      }
    };

    verifyAuth();
    
    return () => {
      isMounted = false;
    };
  }, [session, navigate]);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;

    if (password !== confirmPassword) {
      setError("Passwords don't match");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setLoading(true);
    setError(null);
    
    const { error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { full_name: fullName.trim() },
        emailRedirectTo: `${window.location.origin}/login`,
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
    } else {
      toast({ title: "Welcome!", description: "Your account has been created successfully." });
      // The onAuthStateChange will trigger and verify intent
    }
  };

  const handleGoogleSignup = async () => {
    setError(null);
    localStorage.setItem("oauth_intent", "signup");
    const { error: oauthError } = await lovable.auth.signInWithOAuth("google", {
      redirectTo: `${window.location.origin}/signup`,
    });

    if (oauthError) {
      setError(oauthError.message);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      
      <div className="flex-1 flex flex-col md:flex-row">
        {/* Left Side: Graphic */}
        <div className="hidden md:flex md:w-1/2 bg-muted/30 p-12 flex-col items-center justify-center relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent z-0"></div>
          
          <div className="relative z-10 text-center max-w-md mx-auto">
            <div className="w-20 h-20 rounded-2xl bg-primary flex items-center justify-center mx-auto mb-8 shadow-xl shadow-primary/20">
              <span className="text-primary-foreground font-bold text-3xl">CV</span>
            </div>
            <h2 className="font-display font-bold text-3xl text-foreground mb-4">
              Join CourseVerse Today
            </h2>
            <p className="text-muted-foreground text-lg mb-12">
              Unlock hundreds of premium courses and start advancing your career.
            </p>
            
            {/* Decorative pattern matching the theme */}
            <div className="grid grid-cols-2 gap-4 opacity-70">
              <div className="bg-card rounded-2xl p-6 border border-border shadow-sm text-left">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <BookOpen className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground mb-2">Expert Curated</h3>
                <p className="text-xs text-muted-foreground">Learn from the best instructors in the industry.</p>
              </div>
              <div className="bg-card rounded-2xl p-6 border border-border shadow-sm text-left mt-8">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <Users className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground mb-2">Community Driven</h3>
                <p className="text-xs text-muted-foreground">Join a network of thousands of active learners.</p>
              </div>
            </div>
          </div>
        </div>
        
        {/* Right Side: Form */}
        <div className="flex-1 flex items-center justify-center p-6 sm:p-12">
          <div className="w-full max-w-md space-y-8">
            <div className="text-center md:text-left">
              <h1 className="font-display font-bold text-2xl sm:text-3xl text-foreground">Create an account</h1>
              <p className="text-muted-foreground mt-2">Sign up with your email to get started.</p>
            </div>

            {error && (
              <Alert variant="destructive" className="animate-in fade-in slide-in-from-top-2">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {isVerifying ? (
              <div className="py-12 flex flex-col items-center justify-center space-y-4">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground font-medium animate-pulse">Setting up your account...</p>
              </div>
            ) : (
              <>
                <form onSubmit={handleSignup} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="fullName">Full Name</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                      <Input
                        id="fullName"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="John Doe"
                        className="pl-10 h-11"
                        required
                        disabled={loading}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                      <Input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        className="pl-10 h-11"
                        required
                        disabled={loading}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="pl-10 pr-10 h-11"
                        required
                        minLength={6}
                        disabled={loading}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        disabled={loading}
                      >
                        {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirm Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                      <Input
                        id="confirmPassword"
                        type={showPassword ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                        className="pl-10 h-11"
                        required
                        disabled={loading}
                      />
                    </div>
                  </div>

                  <Button type="submit" className="w-full h-11 mt-2 text-base font-bold" disabled={loading}>
                    {loading ? (
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    ) : (
                      <UserPlus className="mr-2 h-5 w-5" />
                    )}
                    {loading ? "Creating account..." : "Sign up"}
                  </Button>
                </form>

                <div className="mt-8 relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-border" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase font-medium">
                    <span className="bg-background px-3 text-muted-foreground">Or continue with</span>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-12 mt-6 border-border hover:bg-muted font-semibold text-foreground"
                  onClick={handleGoogleSignup}
                  disabled={loading}
                >
                  <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                    <path d="M1 1h22v22H1z" fill="none" />
                  </svg>
                  Sign up with Google
                </Button>

                <div className="mt-8 text-center text-sm text-muted-foreground font-medium">
                  Already have an account?{" "}
                  <Link to="/login" className="text-primary hover:underline font-bold">
                    Log in
                  </Link>
                </div>
                
                <p className="mt-6 text-center text-xs text-muted-foreground/60 max-w-sm mx-auto">
                  By signing up, you agree to our <a href="#" className="underline hover:text-primary">Terms of Use</a> and <a href="#" className="underline hover:text-primary">Privacy Policy</a>.
                </p>
              </>
            )}
          </div>
        </div>
      </div>
      
      <Footer />
    </div>
  );
}
