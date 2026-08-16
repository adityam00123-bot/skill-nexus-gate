import { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  Camera, User, Lock, Eye, EyeOff, Shield, CreditCard,
  Crown, Bell, Send, ChevronRight, CheckCircle2, ExternalLink, Bot,
  Mail, HelpCircle
} from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

type Section = "profile" | "security" | "payments" | "subscription" | "notifications";

const sidebarItems: { id: Section; label: string; icon: React.ElementType }[] = [
  { id: "profile", label: "Profile", icon: User },
  { id: "security", label: "Security", icon: Shield },
  { id: "payments", label: "Payment Methods", icon: CreditCard },
  { id: "subscription", label: "Subscription", icon: Crown },
  { id: "notifications", label: "Notification Preferences", icon: Bell },
];

const AccountSettings = () => {
  const { user, profile, loading: authLoading } = useAuth();
  const { isSubscribed, subscription } = useSubscription();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Determine initial section from path
  const pathSection = location.pathname.split("/settings/")[1] as Section | undefined;
  const [activeSection, setActiveSection] = useState<Section>(
    pathSection && sidebarItems.some((s) => s.id === pathSection) ? pathSection : "profile"
  );

  // Profile state
  const [fullName, setFullName] = useState("");
  const [telegramUsername, setTelegramUsername] = useState("");
  const [telegramId, setTelegramId] = useState<number | null>(null);
  const [avatarUrl, setAvatarUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [connectingTelegram, setConnectingTelegram] = useState(false);

  // Security state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [updatingPassword, setUpdatingPassword] = useState(false);

  // Payment state
  const [upiId, setUpiId] = useState("");
  const [paytmNumber, setPaytmNumber] = useState("");
  const [bankAccount, setBankAccount] = useState("");
  const [bankIfsc, setBankIfsc] = useState("");
  const [savingPayment, setSavingPayment] = useState(false);
  const [courseAccessList, setCourseAccessList] = useState<any[]>([]);
  const [loadingCourseAccess, setLoadingCourseAccess] = useState(false);

  // Notification prefs
  const [notifCourseUpdates, setNotifCourseUpdates] = useState(true);
  const [notifDiscounts, setNotifDiscounts] = useState(true);
  const [notifReferrals, setNotifReferrals] = useState(true);
  const [notifSystem, setNotifSystem] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) navigate("/login");
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (profile) {
      const p = profile as any;
      setFullName(p.full_name || "");
      setAvatarUrl(p.avatar_url || "");
      setTelegramUsername(p.telegram_username || "");
      setTelegramId(p.telegram_id || null);
      setUpiId(p.upi_id || "");
      setPaytmNumber(p.paytm_number || "");
      setBankAccount(p.bank_account || "");
      setBankIfsc(p.bank_ifsc || "");
    }
  }, [profile]);

  const fetchCourseAccess = async () => {
    if (!user) return;
    setLoadingCourseAccess(true);
    try {
      const { data: purchases } = await supabase
        .from('purchases')
        .select('course_id, created_at, courses(id, title, thumbnail_url, course_number)')
        .eq('user_id', user.id)
        .or('is_deleted.is.null,is_deleted.eq.false');

      const { data: tgAccess } = await supabase
        .from('telegram_access')
        .select('course_id, joined_telegram_user_id, joined_telegram_username')
        .eq('user_id', user.id);

      const tgMap = new Map<string, { id: number | null; username: string | null }>();
      (tgAccess || []).forEach((ta: any) => {
        tgMap.set(ta.course_id, {
          id: ta.joined_telegram_user_id ? Number(ta.joined_telegram_user_id) : null,
          username: ta.joined_telegram_username || null
        });
      });

      const list = (purchases || []).map((p: any) => {
        const c = p.courses || {};
        const access = tgMap.get(p.course_id);
        return {
          course_id: p.course_id,
          title: c.title || 'Untitled Course',
          thumbnail: c.thumbnail_url || '/placeholder.svg',
          course_number: c.course_number,
          joined_telegram_user_id: access?.id || null,
          joined_telegram_username: access?.username || null
        };
      });

      setCourseAccessList(list);
    } catch (e) {
      console.error('fetchCourseAccess error:', e);
    } finally {
      setLoadingCourseAccess(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchCourseAccess();
    }
  }, [user]);

  const handleSectionChange = (section: Section) => {
    setActiveSection(section);
    window.history.replaceState(null, "", `/settings/${section}`);
  };

  // === Profile Handlers ===
  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowedTypes.includes(file.type)) {
      toast({ title: "Invalid file type", description: "Please upload a JPG, PNG, WebP or GIF.", variant: "destructive" });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "File too large", description: "Max size is 2MB.", variant: "destructive" });
      return;
    }
    setUploading(true);
    const ext = file.name.split(".").pop();
    const filePath = `avatars/${user.id}-${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage.from("profiles").upload(filePath, file, { upsert: true });
    if (uploadError) {
      toast({ title: "Upload failed", description: uploadError.message, variant: "destructive" });
      setUploading(false);
      return;
    }
    const { data: urlData } = supabase.storage.from("profiles").getPublicUrl(filePath);
    setAvatarUrl(urlData.publicUrl);
    setUploading(false);
    toast({ title: "Avatar uploaded" });
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    setSaving(true);
    const payload: any = {
      full_name: fullName.trim(),
      avatar_url: avatarUrl,
      updated_at: new Date().toISOString()
    };
    if (!telegramId && telegramUsername.trim()) {
      payload.telegram_username = telegramUsername.trim().replace(/^@/, '');
    }
    const { error } = await supabase
      .from("profiles")
      .update(payload)
      .eq("id", user.id);
    setSaving(false);
    if (error) {
      toast({ title: "Error saving profile", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Profile saved successfully" });
    }
  };

  const handleConnectTelegram = async (courseId?: string) => {
    if (!user) return;
    setConnectingTelegram(true);
    try {
      const session = (await supabase.auth.getSession()).data.session;
      const res = await fetch("/api/telegram/generate-link-token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session?.access_token || ""}`
        },
        body: JSON.stringify(courseId ? { course_id: courseId } : {})
      });
      const data = await res.json();
      if (data.success && data.url) {
        window.open(data.url, "_blank");
        toast({
          title: "Telegram Bot Opened",
          description: "Click 'Start' in the bot to connect and access your course."
        });
      } else {
        toast({
          title: "Connection Failed",
          description: data.error || "Could not generate Telegram connection link",
          variant: "destructive"
        });
      }
    } catch (err: any) {
      toast({
        title: "Connection Error",
        description: err.message || "Failed to initiate Telegram connection",
        variant: "destructive"
      });
    } finally {
      setConnectingTelegram(false);
    }
  };

  // === Security Handlers ===
  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) { toast({ title: "Passwords don't match", variant: "destructive" }); return; }
    if (newPassword.length < 6) { toast({ title: "Password must be at least 6 characters", variant: "destructive" }); return; }
    setUpdatingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { toast({ title: "Password updated" }); setCurrentPassword(""); setNewPassword(""); setConfirmPassword(""); }
    setUpdatingPassword(false);
  };

  // === Payment Handlers ===
  const handleSavePayment = async () => {
    if (!user) return;
    setSavingPayment(true);
    const { error } = await supabase.from("profiles").update({
      upi_id: upiId.trim(),
      paytm_number: paytmNumber.trim(),
      bank_account: bankAccount.trim(),
      bank_ifsc: bankIfsc.trim()
    } as any).eq("id", user.id);
    
    if (error) toast({ title: "Save failed", description: error.message, variant: "destructive" });
    else toast({ title: "Payment details updated" });
    setSavingPayment(false);
  };

  // === Notification Handlers ===
  const handleSaveNotifications = () => {
    toast({ title: "Preferences saved", description: "Your notification preferences have been updated." });
  };

  const displayAvatar = avatarUrl || profile?.avatar_url || "";

  if (authLoading) return null;

  const renderSection = () => {
    switch (activeSection) {
      case "profile":
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-foreground">Profile</h2>
              <p className="text-sm text-muted-foreground mt-1">Update your personal information</p>
            </div>

            {/* Avatar */}
            <Card className="border-border">
              <CardContent className="p-6">
                <div className="flex items-center gap-6">
                  <div className="relative">
                    <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center overflow-hidden border-2 border-border">
                      {displayAvatar ? (
                        <img src={displayAvatar} alt="Avatar" className="w-full h-full object-cover" />
                      ) : (
                        <User className="h-8 w-8 text-muted-foreground" />
                      )}
                    </div>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-md hover:bg-primary/90"
                      disabled={uploading}
                    >
                      <Camera className="h-4 w-4" />
                    </button>
                    <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={handleAvatarUpload} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{fullName || "Your Name"}</p>
                    <p className="text-xs text-muted-foreground">{uploading ? "Uploading..." : "JPG, PNG, WebP or GIF. Max 2MB."}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Info */}
            <Card className="border-border">
              <CardContent className="p-6 space-y-4">
                <div className="space-y-1.5">
                  <Label>Full Name</Label>
                  <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your full name" maxLength={100} />
                </div>
                <div className="space-y-1.5">
                  <Label>Email Address</Label>
                  <Input value={user?.email || ""} disabled className="opacity-60" />
                  <p className="text-xs text-muted-foreground">Email cannot be changed here.</p>
                </div>
                <div className="space-y-1.5">
                  <Label>Telegram Username</Label>
                  <div className="relative">
                    <Send className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      value={telegramUsername}
                      onChange={(e) => setTelegramUsername(e.target.value)}
                      placeholder="@username"
                      className="pl-10"
                      maxLength={50}
                      disabled={!!telegramId}
                    />
                  </div>
                  {telegramId ? (
                    <p className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Verified and locked to your account
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">Used for matching your Telegram identity</p>
                  )}
                </div>
                <Button onClick={handleSaveProfile} disabled={saving}>
                  {saving ? "Saving..." : "Save Changes"}
                </Button>
              </CardContent>
            </Card>

            {/* Telegram Delivery Bot Connection */}
            <Card className="border-border overflow-hidden">
              <CardHeader className="pb-3 border-b border-border/50 bg-muted/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Bot className="h-5 w-5 text-primary" />
                    <CardTitle className="text-base font-semibold">Telegram Delivery Bot</CardTitle>
                  </div>
                  {telegramId ? (
                    <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 flex items-center gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Connected & Verified
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20">
                      Not Connected
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-6 space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-lg bg-primary/5 border border-primary/20">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Official Course Delivery Bot</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Access all your authorized course lectures & materials in one place.</p>
                  </div>
                  <Button
                    type="button"
                    className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90 font-medium shrink-0"
                    onClick={() => window.open("https://t.me/CourseVerseofficialbot", "_blank")}
                  >
                    <Send className="h-4 w-4" />
                    Open My Courses Bot
                    <ExternalLink className="h-3.5 w-3.5 opacity-70" />
                  </Button>
                </div>

                {/* Per-Course Telegram Access List */}
                {courseAccessList.length > 0 && (
                  <div className="space-y-3 pt-1">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Course Telegram Bindings ({courseAccessList.length})
                    </p>
                    <div className="space-y-2">
                      {courseAccessList.map((item) => (
                        <div
                          key={item.course_id}
                          className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg bg-card border border-border/80 gap-3 hover:border-primary/30 transition-colors"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <img
                              src={item.thumbnail}
                              alt={item.title}
                              className="w-14 h-9 rounded object-cover shrink-0 border border-border"
                            />
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-foreground truncate">
                                {item.course_number ? `#${item.course_number} ` : ''}{item.title}
                              </p>
                              {item.joined_telegram_user_id ? (
                                <p className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-mono">
                                  <CheckCircle2 className="h-3 w-3" />
                                  {item.joined_telegram_username ? `@${item.joined_telegram_username}` : `ID: ${item.joined_telegram_user_id}`}
                                </p>
                              ) : (
                                <p className="text-xs text-amber-600 dark:text-amber-400">Not linked to Telegram yet</p>
                              )}
                            </div>
                          </div>
                          {item.joined_telegram_user_id ? (
                            <Badge
                              variant="outline"
                              className="self-start sm:self-auto bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-[11px] gap-1 shrink-0"
                            >
                              <Shield className="h-3 w-3" /> Bound & Locked
                            </Badge>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleConnectTelegram(item.course_id)}
                              disabled={connectingTelegram}
                              className="self-start sm:self-auto text-xs gap-1 h-8 border-primary/30 text-primary hover:bg-primary/10 shrink-0"
                            >
                              <Send className="h-3 w-3" /> Connect Course
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Security Notice Box */}
                <div className="rounded-lg bg-muted/20 border border-border/80 p-4 text-xs space-y-2.5">
                  <div className="flex items-center gap-2 text-foreground font-semibold">
                    <Shield className="h-4 w-4 text-primary" />
                    <span>Account Security & Anti-Piracy Protection</span>
                  </div>
                  <p className="text-muted-foreground leading-relaxed">
                    For fraud prevention and secure delivery, each course is locked to its verified Telegram identity. To transfer or update your registered Telegram account, please reach out to our support team with your registered email.
                  </p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <a
                      href="https://t.me/courseversesupport"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-muted/70 hover:bg-muted text-foreground font-medium transition-colors"
                    >
                      <Send className="h-3.5 w-3.5 text-primary" />
                      Telegram Support
                    </a>
                    <Link
                      to="/contact"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-muted/70 hover:bg-muted text-foreground font-medium transition-colors"
                    >
                      <Mail className="h-3.5 w-3.5 text-primary" />
                      Email Support
                    </Link>
                    <Link
                      to="/help"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-muted/70 hover:bg-muted text-foreground font-medium transition-colors"
                    >
                      <HelpCircle className="h-3.5 w-3.5 text-primary" />
                      Help Center
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        );

      case "security":
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-foreground">Security</h2>
              <p className="text-sm text-muted-foreground mt-1">Manage your password and security settings</p>
            </div>
            <Card className="border-border">
              <CardHeader><CardTitle className="text-base">Change Password</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Current Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input type={showPassword ? "text" : "password"} value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="••••••••" className="pl-10 pr-10" />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>New Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input type={showPassword ? "text" : "password"} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="••••••••" className="pl-10" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Confirm New Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input type={showPassword ? "text" : "password"} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••••" className="pl-10" />
                  </div>
                </div>
                <Button onClick={handleChangePassword} disabled={updatingPassword}>
                  {updatingPassword ? "Updating..." : "Update Password"}
                </Button>
              </CardContent>
            </Card>
          </div>
        );

      case "payments":
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-foreground">Payment Methods</h2>
              <p className="text-sm text-muted-foreground mt-1">Add payout details for your CV Business earnings</p>
            </div>
            <Card className="border-border">
              <CardHeader><CardTitle className="text-base">UPI</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label>UPI ID</Label>
                  <Input value={upiId} onChange={(e) => setUpiId(e.target.value)} placeholder="yourname@upi" maxLength={50} />
                </div>
              </CardContent>
            </Card>
            <Card className="border-border">
              <CardHeader><CardTitle className="text-base">Paytm</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Paytm Number</Label>
                  <Input value={paytmNumber} onChange={(e) => setPaytmNumber(e.target.value)} placeholder="10 digit number" maxLength={10} />
                </div>
              </CardContent>
            </Card>
            <Card className="border-border">
              <CardHeader><CardTitle className="text-base">Bank Transfer</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Bank Account Number</Label>
                  <Input value={bankAccount} onChange={(e) => setBankAccount(e.target.value)} placeholder="Account number" maxLength={20} />
                </div>
                <div className="space-y-1.5">
                  <Label>IFSC Code</Label>
                  <Input value={bankIfsc} onChange={(e) => setBankIfsc(e.target.value)} placeholder="IFSC code" maxLength={11} />
                </div>
              </CardContent>
            </Card>
            <Button onClick={handleSavePayment} disabled={savingPayment}>
              {savingPayment ? "Saving..." : "Save Payment Method"}
            </Button>
          </div>
        );

      case "subscription":
        const reactivate = (useSubscription() as any).reactivate;
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-foreground">Subscription</h2>
              <p className="text-sm text-muted-foreground mt-1">Manage your CourseVerse Premium plan</p>
            </div>
            
            {isSubscribed ? (
              <Card className="border-border relative overflow-hidden shadow-sm bg-card transition-all">
                <div className="absolute top-0 left-0 w-full h-1 bg-primary" />
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />
                <CardContent className="p-6 relative z-10 md:p-8">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
                    <div>
                      <h3 className="text-2xl font-display font-bold text-foreground mb-1">Your Premium Membership</h3>
                      <p className="text-sm text-muted-foreground font-medium">Full unrestricted access active</p>
                    </div>
                    <Badge className={subscription?.status === 'cancelled' ? "bg-destructive/10 text-destructive hover:bg-destructive font-semibold px-3 py-1 text-sm gap-1.5 shadow-glow" : "bg-primary text-primary-foreground hover:bg-primary font-semibold px-3 py-1 text-sm gap-1.5 shadow-glow"}>
                      {subscription?.status === 'cancelled' ? "Cancelled" : <><Crown className="w-4 h-4" /> Active</>}
                    </Badge>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                    <div className="space-y-1.5 p-4 rounded-xl border border-border bg-card shadow-sm">
                      <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Plan</span>
                      <p className="font-semibold text-foreground text-sm capitalize">{(subscription as any)?.plan_name || 'Premium'}</p>
                    </div>
                    <div className="space-y-1.5 p-4 rounded-xl border border-border bg-card shadow-sm">
                      <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Access</span>
                      <p className="font-semibold text-foreground text-sm">All Courses Access</p>
                    </div>
                    <div className="space-y-1.5 p-4 rounded-xl border border-border bg-card shadow-sm">
                      <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Status</span>
                      <p className={subscription?.status === 'cancelled' ? "font-semibold text-destructive text-sm flex items-center gap-1.5" : "font-semibold text-primary text-sm flex items-center gap-1.5"}>
                        {subscription?.status !== 'cancelled' && (
                          <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                          </span>
                        )}
                        {subscription?.status === 'cancelled' ? "Pending Expiration" : "Active"}
                      </p>
                    </div>
                    <div className="space-y-1.5 p-4 rounded-xl border border-border bg-card shadow-sm">
                      <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Next Billing Date</span>
                      <p className="font-semibold text-foreground text-sm">
                        {subscription?.end_date ? new Date(subscription.end_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Lifetime — No renewal'}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-border/50">
                    {subscription?.status === 'cancelled' ? (
                      <Button onClick={async () => {
                        await (reactivate as any)();
                        toast({ title: "Welcome back!", description: "Your Premium access has been reactivated." });
                      }} className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm font-semibold h-11 transition-all">
                        Reactivate Premium
                      </Button>
                    ) : (
                      <Button onClick={() => navigate("/my-learning")} className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm font-semibold h-11 transition-all">
                        Go to My Learning
                      </Button>
                    )}
                    <Button variant="outline" onClick={() => navigate("/billing")} className="flex-1 border-border text-foreground hover:bg-accent font-semibold h-11 transition-all">
                      Manage Billing
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-border bg-card relative overflow-hidden transition-all shadow-sm">
                <div className="absolute inset-0 bg-gradient-to-tr from-primary/5 via-transparent to-transparent pointer-events-none" />
                <CardContent className="p-8 md:p-12 text-center relative z-10 flex flex-col items-center justify-center">
                  <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-6 ring-8 ring-primary/5">
                    <Crown className="h-10 w-10 text-primary" />
                  </div>
                  <h3 className="font-display font-extrabold text-2xl md:text-3xl text-foreground mb-3">Upgrade to Premium</h3>
                  <p className="text-muted-foreground mb-8 max-w-sm mx-auto text-base">Unlock 2,000+ premium courses, exclusive communities, and more starting at just ₹333/month.</p>
                  <Button onClick={() => navigate("/subscribe")} size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-glow font-bold h-12 px-10 text-base transition-all">
                    View Premium Plans
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        );

      case "notifications":
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-foreground">Notification Preferences</h2>
              <p className="text-sm text-muted-foreground mt-1">Control what notifications you receive</p>
            </div>
            <Card className="border-border">
              <CardContent className="p-6 space-y-5">
                {[
                  { label: "Course Updates", desc: "New lessons, course completions, and learning reminders", checked: notifCourseUpdates, set: setNotifCourseUpdates },
                  { label: "Discount Alerts", desc: "Flash sales, special offers, and promotional discounts", checked: notifDiscounts, set: setNotifDiscounts },
                  { label: "Referral Earnings", desc: "When friends purchase through your referral link", checked: notifReferrals, set: setNotifReferrals },
                  { label: "System Messages", desc: "Account updates, security alerts, and platform news", checked: notifSystem, set: setNotifSystem },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground">{item.label}</p>
                      <p className="text-xs text-muted-foreground">{item.desc}</p>
                    </div>
                    <Switch checked={item.checked} onCheckedChange={item.set} />
                  </div>
                ))}
              </CardContent>
            </Card>
            <Button onClick={handleSaveNotifications}>Save Preferences</Button>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <div className="flex-1 w-full max-w-6xl mx-auto px-4 py-10">
        <h1 className="font-display font-bold text-2xl md:text-3xl text-foreground mb-8">Account Settings</h1>

        <div className="flex flex-col md:flex-row gap-8">
          {/* Sidebar */}
          <nav className="w-full md:w-60 shrink-0">
            <div className="bg-card border border-border rounded-2xl overflow-hidden md:sticky md:top-24">
              {sidebarItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleSectionChange(item.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3.5 text-sm font-medium transition-colors text-left ${
                    activeSection === item.id
                      ? "bg-primary/10 text-primary border-l-2 border-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground border-l-2 border-transparent"
                  }`}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  <span className="flex-1">{item.label}</span>
                  <ChevronRight className={`h-4 w-4 shrink-0 transition-opacity ${activeSection === item.id ? "opacity-100" : "opacity-0"}`} />
                </button>
              ))}
            </div>
          </nav>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {renderSection()}
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default AccountSettings;
