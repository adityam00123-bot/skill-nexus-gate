import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, ShieldCheck, Shield, Eye, Users, Ban, Trash2, Send, CreditCard, ShoppingBag, Info, IndianRupee, AlertTriangle, Wallet } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

// Extended UserRow interface handling dynamic columns which might not be in types.ts yet
interface UserRow {
  id: string; 
  full_name: string | null; 
  email: string | null; 
  avatar_url: string | null;
  created_at: string; 
  telegram_username?: string | null;
  upi_id?: string | null;
  paytm_number?: string | null;
  is_blocked?: boolean;
  wallet_balance: number;
  
  // Merged properties
  role: "admin" | "user";
  balance: number;
  purchases: any[];
  purchase_count: number;
  total_spent: number;
  distinct_telegram_ids: number;
  telegram_access_map: Map<string, { tg_user_id: number | null, tg_username: string | null }>;
}

export default function AdminUsers() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filtering & Pagination
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [blockedFilter, setBlockedFilter] = useState("all");
  const [page, setPage] = useState(0);
  const perPage = 20;
  
  // Actions states
  const { toast } = useToast();
  const [viewUser, setViewUser] = useState<UserRow | null>(null);
  const [activeTab, setActiveTab] = useState("basic");
  
  // Modals
  const [roleDialog, setRoleDialog] = useState<{ isOpen: boolean; user: UserRow | null }>({ isOpen: false, user: null });
  const [notifyDialog, setNotifyDialog] = useState<{ isOpen: boolean; user: UserRow | null }>({ isOpen: false, user: null });
  const [blockDialog, setBlockDialog] = useState<{ isOpen: boolean; user: UserRow | null }>({ isOpen: false, user: null });
  const [deleteDialog, setDeleteDialog] = useState<{ isOpen: boolean; user: UserRow | null }>({ isOpen: false, user: null });
  
  // Modal forms
  const [notifyTitle, setNotifyTitle] = useState("");
  const [notifyMessage, setNotifyMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  
  // Current user specifics
  const [userTransactions, setUserTransactions] = useState<any[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      // Step 1: Fetch Profiles
      const { data: profilesRes, error: pErr } = await supabase
        .from("profiles")
        .select("id, full_name, email, avatar_url, created_at, is_blocked, telegram_username, upi_id, paytm_number, wallet_balance")
        .order("created_at", { ascending: false });
        
      if (pErr) throw pErr;

      // Step 2: Fetch Roles
      const { data: rolesRes, error: rErr } = await (supabase as any)
        .from("user_roles")
        .select("user_id, role");
        
      if (rErr) throw rErr;

      // Step 3: Fetch CV Coin Balances
      const { data: balancesRes, error: bErr } = await supabase
        .from("cv_coin_balances")
        .select("user_id, balance");
        
      if (bErr) throw bErr;

      // Step 4: Fetch Purchases
      const { data: purchasesRes, error: puErr } = await supabase
        .from("purchases")
        .select("id, user_id, price_paid, course_id, created_at");
        
      if (puErr) throw puErr;

      // Step 5: Fetch Telegram Access for fraud detection
      const { data: telegramAccessRes, error: taErr } = await supabase
        .from("telegram_access")
        .select("user_id, course_id, joined_telegram_user_id, joined_telegram_username");
      
      if (taErr) throw taErr;

      // Step 6: Fetch all courses from DB for name lookups
      const { data: coursesRes } = await supabase
        .from("courses")
        .select("id, title");
      
      const courseNameMap = new Map<string, string>();
      (coursesRes || []).forEach((c: any) => courseNameMap.set(c.id, c.title));

      // Step 7: Merge Safely
      const roleMap = new Map((rolesRes || []).map((r: any) => [r.user_id, r.role]));
      const balanceMap = new Map((balancesRes || []).map((b: any) => [b.user_id, b.balance]));
      
      const purchasesMap = new Map<string, any[]>();
      (purchasesRes || []).forEach((p: any) => {
        if (!purchasesMap.has(p.user_id)) purchasesMap.set(p.user_id, []);
        // Attach course_title from DB lookup
        p.course_title = courseNameMap.get(p.course_id) || null;
        purchasesMap.get(p.user_id)?.push(p);
      });

      // Build telegram access maps: user_id -> Map<course_id, { tg_user_id, tg_username }>
      // and user_id -> Set of distinct telegram user IDs
      const userTelegramAccessMap = new Map<string, Map<string, { tg_user_id: number | null, tg_username: string | null }>>();
      const userDistinctTgIds = new Map<string, Set<number>>();
      (telegramAccessRes || []).forEach((ta: any) => {
        if (!userTelegramAccessMap.has(ta.user_id)) userTelegramAccessMap.set(ta.user_id, new Map());
        userTelegramAccessMap.get(ta.user_id)!.set(ta.course_id, {
          tg_user_id: ta.joined_telegram_user_id,
          tg_username: ta.joined_telegram_username
        });
        
        if (ta.joined_telegram_user_id) {
          if (!userDistinctTgIds.has(ta.user_id)) userDistinctTgIds.set(ta.user_id, new Set());
          userDistinctTgIds.get(ta.user_id)!.add(ta.joined_telegram_user_id);
        }
      });

      const merged: UserRow[] = (profilesRes || []).map((p: any) => {
        const userPurchases = purchasesMap.get(p.id) || [];
        const totalSpent = userPurchases.reduce((sum, purchase) => sum + (Number(purchase.price_paid) || 0), 0);
        
        return {
          id: p.id,
          full_name: p.full_name,
          email: p.email,
          avatar_url: p.avatar_url,
          created_at: p.created_at,
          telegram_username: p.telegram_username,
          upi_id: p.upi_id,
          paytm_number: p.paytm_number,
          is_blocked: p.is_blocked || false,
          wallet_balance: Number(p.wallet_balance) || 0,
          role: (roleMap.get(p.id) || "user") as "admin" | "user",
          balance: balanceMap.get(p.id) || 0,
          purchases: userPurchases,
          purchase_count: userPurchases.length,
          total_spent: totalSpent,
          distinct_telegram_ids: userDistinctTgIds.get(p.id)?.size || 0,
          telegram_access_map: userTelegramAccessMap.get(p.id) || new Map(),
        };
      });

      setUsers(merged);
    } catch (error: any) {
      console.error("Error fetching users:", error);
      toast({ title: "Error fetching data", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // Fetch transactions when Modal opens for CV coins tab
  useEffect(() => {
    if (viewUser && activeTab === "coins") {
      setLoadingTransactions(true);
      supabase
        .from("cv_coin_transactions")
        .select("*")
        .eq("user_id", viewUser.id)
        .order("created_at", { ascending: false })
        .limit(10)
        .then(({ data }) => {
          setUserTransactions(data || []);
          setLoadingTransactions(false);
        });
    }
  }, [viewUser, activeTab]);

  const handleRoleChange = async () => {
    if (!roleDialog.user) return;
    setSubmitting(true);
    const u = roleDialog.user;
    const newRole = u.role === "admin" ? "user" : "admin";
    
    try {
      // Check if user role exists
      const { data: exist } = await (supabase as any).from("user_roles").select("id").eq("user_id", u.id).single();
      
      if (exist) {
        await (supabase as any).from("user_roles").update({ role: newRole }).eq("user_id", u.id);
      } else {
        await (supabase as any).from("user_roles").insert({ user_id: u.id, role: newRole });
      }
      
      toast({ title: `Role successfully updated to ${newRole}` });
      fetchUsers();
    } catch (error: any) {
      toast({ title: "Failed to change role", description: error.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
      setRoleDialog({ isOpen: false, user: null });
    }
  };

  const handleSendNotification = async () => {
    if (!notifyDialog.user || !notifyTitle.trim() || !notifyMessage.trim()) return;
    setSubmitting(true);
    try {
      const payload = {
        user_id: notifyDialog.user.id,
        title: notifyTitle.trim(),
        message: notifyMessage.trim(),
        icon: "Bell",
        is_read: false
      };
      
      const { error } = await supabase.from("notifications").insert([payload]);
      if (error) throw error;
      
      toast({ title: "Notification Sent Successfully" });
      setNotifyTitle("");
      setNotifyMessage("");
    } catch (error: any) {
      toast({ title: "Failed to send notification", description: error.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
      setNotifyDialog({ isOpen: false, user: null });
    }
  };

  const handleToggleBlock = async () => {
    if (!blockDialog.user) return;
    setSubmitting(true);
    const u = blockDialog.user;
    const newBlockedState = !u.is_blocked;
    
    try {
      // 1. Call Telegram API to ban/unban from channels
      const { data: authData } = await supabase.auth.getSession();
      const token = authData.session?.access_token;
      
      if (token) {
        // We do this concurrently or before DB update, doesn't matter, 
        // but doing it before ensures they are banned even if DB fails.
        // Doing it after DB ensures DB consistency. We'll do it before.
        await fetch('/api/telegram/ban-user', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            target_user_id: u.id,
            action: newBlockedState ? 'ban' : 'unban'
          })
        }).catch(err => console.error("Telegram API Error:", err));
      }

      // 2. Update DB
      const { error } = await supabase.from("profiles").update({ is_blocked: newBlockedState } as any).eq("id", u.id);
      if (error) throw error;
      
      toast({ title: newBlockedState ? "User has been blocked" : "User has been unblocked" });
      fetchUsers();
    } catch (error: any) {
      toast({ title: "Failed to update block status", description: error.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
      setBlockDialog({ isOpen: false, user: null });
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteDialog.user) return;
    setSubmitting(true);
    const uId = deleteDialog.user.id;
    
    try {
      const { data: authData } = await supabase.auth.getSession();
      const token = authData.session?.access_token;
      
      if (!token) throw new Error("Not authenticated");

      const res = await fetch('/api/admin/delete-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ target_user_id: uId })
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to delete user');
      
      toast({ title: "User completely deleted", description: "Auth account, all data, and Telegram access have been revoked." });
      fetchUsers();
    } catch (error: any) {
      toast({ title: "Failed to delete user", description: error.message, variant: "destructive" });
    } finally {
      setSubmitting(true);
      setDeleteDialog({ isOpen: false, user: null });
      if (viewUser && viewUser.id === uId) setViewUser(null);
      setSubmitting(false);
    }
  };

  // derived stats
  const totalUsers = users.length;
  const totalRevenue = users.reduce((sum, u) => sum + u.total_spent, 0);
  const avgPurchases = totalUsers > 0 ? (users.reduce((sum, u) => sum + u.purchase_count, 0) / totalUsers).toFixed(1) : 0;

  // filters
  const filtered = users.filter((u) => {
    if (search && !(u.full_name || "").toLowerCase().includes(search.toLowerCase()) && !(u.email || "").toLowerCase().includes(search.toLowerCase())) return false;
    if (roleFilter === "admin" && u.role !== "admin") return false;
    if (roleFilter === "user" && u.role === "admin") return false;
    if (blockedFilter === "active" && u.is_blocked) return false;
    if (blockedFilter === "blocked" && !u.is_blocked) return false;
    return true;
  });

  const paged = filtered.slice(page * perPage, (page + 1) * perPage);
  const totalPages = Math.ceil(filtered.length / perPage);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Users className="h-6 w-6" /> Users Management</h1>
      </div>

      {/* STATS CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-[#1E293B] border-[#334155]">
          <CardContent className="p-6 flex flex-col justify-center items-center">
            <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-2">Total Users</p>
            <p className="text-3xl font-bold text-white">{totalUsers}</p>
          </CardContent>
        </Card>
        <Card className="bg-[#1E293B] border-[#334155]">
          <CardContent className="p-6 flex flex-col justify-center items-center">
            <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-2">Total Revenue</p>
            <p className="text-3xl font-bold text-green-400">₹{totalRevenue.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="bg-[#1E293B] border-[#334155]">
          <CardContent className="p-6 flex flex-col justify-center items-center">
            <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-2">Avg Purchases / User</p>
            <p className="text-3xl font-bold text-blue-400">{avgPurchases}</p>
          </CardContent>
        </Card>
      </div>

      {/* FILTERS */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search users by name or email..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} className="pl-10 bg-[#1E293B] border-[#334155]" />
        </div>
        <Select value={roleFilter} onValueChange={(v) => { setRoleFilter(v); setPage(0); }}>
          <SelectTrigger className="w-32 bg-[#1E293B] border-[#334155]"><SelectValue placeholder="Role" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
            <SelectItem value="user">User</SelectItem>
          </SelectContent>
        </Select>
        <Select value={blockedFilter} onValueChange={(v) => { setBlockedFilter(v); setPage(0); }}>
          <SelectTrigger className="w-40 bg-[#1E293B] border-[#334155]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active Only</SelectItem>
            <SelectItem value="blocked">Blocked Only</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* USERS TABLE */}
      <Card className="bg-[#1E293B] border-[#334155]">
        <CardContent className="p-0 overflow-x-auto">
          {loading ? (
            <div className="p-4 space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full bg-[#334155]" />)}</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-[#334155]">
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead>Purchases</TableHead>
                  <TableHead>Spent</TableHead>
                  <TableHead>CV Coins</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paged.map((u) => (
                  <TableRow key={u.id} className="border-[#334155] hover:bg-[#334155]/50 transition-colors">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9 border border-[#334155]">
                          <AvatarImage src={u.avatar_url || ""} />
                          <AvatarFallback className="bg-primary/20 text-primary text-xs font-semibold">
                            {(u.full_name || u.email || "U").charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col max-w-[150px] lg:max-w-[200px]">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-sm truncate">{u.full_name || "No Name"}</span>
                            {u.distinct_telegram_ids >= 4 && (
                              <span title="Multiple Telegram IDs detected — possible account sharing" className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 whitespace-nowrap">
                                <AlertTriangle className="h-3 w-3" /> Multi-TG
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground truncate">{u.email || "—"}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={u.role === "admin" ? "default" : "outline"} className={u.role === "admin" ? "bg-primary text-primary-foreground border-transparent" : "text-muted-foreground border-[#334155]"}>
                        {u.role === "admin" ? "Admin" : "User"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{new Date(u.created_at).toLocaleDateString()}</TableCell>
                    <TableCell>{u.purchase_count}</TableCell>
                    <TableCell className="text-green-400 font-medium">₹{u.total_spent.toLocaleString()}</TableCell>
                    <TableCell className="text-yellow-400 font-medium">{u.balance.toLocaleString()}</TableCell>
                    <TableCell>
                      {u.is_blocked ? (
                        <Badge className="bg-red-500/20 text-red-500 hover:bg-red-500/30">Blocked</Badge>
                      ) : (
                        <Badge className="bg-green-500/20 text-green-400 hover:bg-green-500/30">Active</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => { setViewUser(u); setActiveTab("basic"); }} className="h-8 w-8" title="View Details"><Eye className="h-4 w-4 text-blue-400" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => setRoleDialog({ isOpen: true, user: u })} className="h-8 w-8" title="Change Role"><Shield className="h-4 w-4 text-purple-400" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => setNotifyDialog({ isOpen: true, user: u })} className="h-8 w-8" title="Send Notification"><Send className="h-4 w-4 text-primary" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => setBlockDialog({ isOpen: true, user: u })} className="h-8 w-8" title={u.is_blocked ? "Unblock User" : "Block User"}><Ban className={`h-4 w-4 ${u.is_blocked ? "text-green-400" : "text-orange-400"}`} /></Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeleteDialog({ isOpen: true, user: u })} className="h-8 w-8 hover:bg-red-500/20 hover:text-red-500" title="Delete User"><Trash2 className="h-4 w-4 text-red-400" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {paged.length === 0 && (
                  <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-12">
                    <div className="flex flex-col items-center gap-2"><Users className="h-10 w-10 text-[#334155]" /><p>No users found matching filters</p></div>
                  </TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)} className="border-[#334155]">Previous</Button>
          <span className="text-sm text-muted-foreground">Page {page + 1} of {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)} className="border-[#334155]">Next</Button>
        </div>
      )}

      {/* ===================== VIEW USER MODAL ===================== */}
      <Dialog open={!!viewUser} onOpenChange={(o) => !o && setViewUser(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col bg-[#1E293B] border-[#334155]">
          <DialogHeader>
            <DialogTitle>User Profile</DialogTitle>
          </DialogHeader>
          
          {viewUser && (
            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-6">
              
              {/* Top Banner */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 bg-[#0F172A] p-4 rounded-xl border border-[#334155]">
                <Avatar className="h-20 w-20 border-2 border-primary">
                  <AvatarImage src={viewUser.avatar_url || ""} />
                  <AvatarFallback className="bg-primary/20 text-primary text-3xl font-bold">{(viewUser.full_name || viewUser.email || "U")[0].toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <h2 className="text-2xl font-bold flex items-center gap-2">
                    {viewUser.full_name || "Unnamed User"}
                    {viewUser.role === "admin" && <Badge className="bg-primary text-xs uppercase px-2 py-0.5">Admin</Badge>}
                    {viewUser.is_blocked && <Badge className="bg-red-500/20 text-red-500 text-xs uppercase px-2 py-0.5">Blocked</Badge>}
                  </h2>
                  <p className="text-muted-foreground">{viewUser.email}</p>
                </div>
              </div>

              {/* Tabs Navbar */}
              <div className="flex border-b border-[#334155]">
                <button onClick={() => setActiveTab("basic")} className={`px-4 py-2 font-medium text-sm transition-colors border-b-2 ${activeTab === "basic" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-white"}`}>
                  <div className="flex items-center gap-2"><Info className="h-4 w-4" /> Basic Info</div>
                </button>
                <button onClick={() => setActiveTab("finance")} className={`px-4 py-2 font-medium text-sm transition-colors border-b-2 ${activeTab === "finance" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-white"}`}>
                  <div className="flex items-center gap-2"><ShoppingBag className="h-4 w-4" /> Financial</div>
                </button>
                <button onClick={() => setActiveTab("coins")} className={`px-4 py-2 font-medium text-sm transition-colors border-b-2 ${activeTab === "coins" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-white"}`}>
                  <div className="flex items-center gap-2"><CreditCard className="h-4 w-4" /> CV Coins</div>
                </button>
              </div>

              {/* TABS CONTENT */}
              <div className="py-2">
                
                {activeTab === "basic" && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card className="bg-[#0F172A] border-[#334155]"><CardContent className="p-4 space-y-1">
                      <p className="text-xs text-muted-foreground uppercase">User ID</p>
                      <p className="font-mono text-sm break-all">{viewUser.id}</p>
                    </CardContent></Card>
                    <Card className="bg-[#0F172A] border-[#334155]"><CardContent className="p-4 space-y-1">
                      <p className="text-xs text-muted-foreground uppercase">Joined Date</p>
                      <p className="text-sm">{new Date(viewUser.created_at).toLocaleString()}</p>
                    </CardContent></Card>
                    <Card className="bg-[#0F172A] border-[#334155]"><CardContent className="p-4 space-y-1">
                      <p className="text-xs text-muted-foreground uppercase">Telegram Username</p>
                      <p className="text-sm font-medium text-blue-400">{viewUser.telegram_username ? `@${viewUser.telegram_username}` : "Not Set"}</p>
                    </CardContent></Card>
                    <Card className="bg-[#0F172A] border-[#334155]"><CardContent className="p-4 space-y-1">
                      <p className="text-xs text-muted-foreground uppercase">UPI ID</p>
                      <p className="text-sm font-medium">{viewUser.upi_id || "Not Set"}</p>
                    </CardContent></Card>
                    <Card className="bg-[#0F172A] border-[#334155]"><CardContent className="p-4 space-y-1">
                      <p className="text-xs text-muted-foreground uppercase">Paytm Number</p>
                      <p className="text-sm font-medium">{viewUser.paytm_number || "Not Set"}</p>
                    </CardContent></Card>
                  </div>
                )}

                {activeTab === "finance" && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <Card className="bg-[#0F172A] border-[#334155]"><CardContent className="p-6 flex flex-col justify-center items-center text-center space-y-2">
                        <ShoppingBag className="h-8 w-8 text-blue-400 mb-2" />
                        <p className="text-sm text-muted-foreground uppercase">Total Purchases</p>
                        <p className="text-3xl font-bold">{viewUser.purchase_count}</p>
                      </CardContent></Card>
                      <Card className="bg-[#0F172A] border-[#334155]"><CardContent className="p-6 flex flex-col justify-center items-center text-center space-y-2">
                        <IndianRupee className="h-8 w-8 text-green-400 mb-2" />
                        <p className="text-sm text-muted-foreground uppercase">Total Spent</p>
                        <p className="text-3xl font-bold text-green-400">₹{viewUser.total_spent.toLocaleString()}</p>
                      </CardContent></Card>
                      <Card className="bg-[#0F172A] border-[#334155]"><CardContent className="p-6 flex flex-col justify-center items-center text-center space-y-2">
                        <Wallet className="h-8 w-8 text-purple-400 mb-2" />
                        <p className="text-sm text-muted-foreground uppercase">Wallet Balance</p>
                        <p className="text-3xl font-bold text-purple-400">₹{viewUser.wallet_balance.toLocaleString()}</p>
                      </CardContent></Card>
                    </div>

                    <div>
                      <h3 className="text-lg font-semibold mb-3">Purchase History</h3>
                      {viewUser.purchases.length > 0 ? (
                        <div className="rounded-md border border-[#334155] overflow-hidden">
                          <Table>
                            <TableHeader className="bg-[#0F172A]">
                              <TableRow className="border-[#334155]">
                                <TableHead>Course</TableHead>
                                <TableHead>Amount Paid</TableHead>
                                <TableHead>TG Handle</TableHead>
                                <TableHead>TG User ID</TableHead>
                                <TableHead>Date</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {viewUser.purchases.map(p => {
                                const tgAccess = viewUser.telegram_access_map.get(p.course_id);
                                return (
                                  <TableRow key={p.id} className="border-[#334155]">
                                    <TableCell className="font-medium max-w-[200px] truncate">{p.course_title || p.course_id}</TableCell>
                                    <TableCell className="text-green-400">₹{p.price_paid}</TableCell>
                                    <TableCell className="text-xs text-blue-300">{tgAccess?.tg_username ? `@${tgAccess.tg_username}` : 'null'}</TableCell>
                                    <TableCell className="font-mono text-xs text-muted-foreground">{tgAccess?.tg_user_id || '—'}</TableCell>
                                    <TableCell className="text-sm">{new Date(p.created_at).toLocaleDateString()}</TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        </div>
                      ) : (
                        <p className="text-muted-foreground text-sm p-4 bg-[#0F172A] rounded-md border border-[#334155] text-center">No purchases found for this user.</p>
                      )}
                    </div>
                  </div>
                )}

                {activeTab === "coins" && (
                  <div className="space-y-6">
                     <Card className="bg-[#0F172A] border-yellow-500/30 shadow-[0_0_15px_rgba(234,179,8,0.1)]">
                       <CardContent className="p-6 flex flex-col justify-center items-center text-center">
                        <p className="text-sm text-yellow-500/80 uppercase font-semibold mb-2">Current Balance</p>
                        <p className="text-5xl font-black text-yellow-400 drop-shadow-sm">{viewUser.balance.toLocaleString()}</p>
                      </CardContent>
                    </Card>

                    <div>
                      <h3 className="text-lg font-semibold mb-3">Recent Transactions (Last 10)</h3>
                      {loadingTransactions ? (
                         <div className="flex justify-center py-6"><Skeleton className="h-8 w-8 rounded-full animate-pulse bg-primary/20" /></div>
                      ) : userTransactions.length > 0 ? (
                         <div className="rounded-md border border-[#334155] overflow-hidden">
                          <Table>
                            <TableHeader className="bg-[#0F172A]">
                              <TableRow className="border-[#334155]">
                                <TableHead>Action</TableHead>
                                <TableHead>Coins</TableHead>
                                <TableHead>Description</TableHead>
                                <TableHead>Date</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {userTransactions.map(t => (
                                <TableRow key={t.id} className="border-[#334155]">
                                  <TableCell className="font-medium capitalize text-sm">{t.action.replace("_", " ")}</TableCell>
                                  <TableCell className={`font-bold ${t.coins > 0 ? "text-green-400" : "text-red-400"}`}>{t.coins > 0 ? "+" : ""}{t.coins}</TableCell>
                                  <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{t.description || "—"}</TableCell>
                                  <TableCell className="text-xs">{new Date(t.created_at).toLocaleDateString()}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      ) : (
                         <p className="text-muted-foreground text-sm p-4 bg-[#0F172A] rounded-md border border-[#334155] text-center">No transactions found.</p>
                      )}
                    </div>
                  </div>
                )}

              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      
      {/* ===================== ACTION DIALOGS ===================== */}

      {/* Change Role Dialog */}
      <AlertDialog open={roleDialog.isOpen} onOpenChange={(o) => !o && setRoleDialog({ isOpen: false, user: null })}>
        <AlertDialogContent className="bg-[#1E293B] border-[#334155]">
          <AlertDialogHeader>
            <AlertDialogTitle>Change User Role</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to change <span className="text-white font-medium">{roleDialog.user?.full_name}</span>'s 
              role from <span className="text-white font-medium capitalize">{roleDialog.user?.role}</span> to <span className="text-white font-medium capitalize">{roleDialog.user?.role === "admin" ? "user" : "admin"}</span>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting} className="border-[#334155] hover:bg-[#334155]">Cancel</AlertDialogCancel>
            <Button disabled={submitting} onClick={handleRoleChange} className="bg-primary hover:bg-primary/90">
              {submitting ? "Applying..." : "Confirm Change"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Block/Unblock Dialog */}
      <AlertDialog open={blockDialog.isOpen} onOpenChange={(o) => !o && setBlockDialog({ isOpen: false, user: null })}>
        <AlertDialogContent className="bg-[#1E293B] border-[#334155]">
          <AlertDialogHeader>
            <AlertDialogTitle>{blockDialog.user?.is_blocked ? "Unblock User" : "Block User"}</AlertDialogTitle>
            <AlertDialogDescription>
              {blockDialog.user?.is_blocked 
                ? "This user will regain access to platform features and purchases. Proceed?" 
                : "Blocked users cannot purchase new courses or perform certain actions. Proceed?"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting} className="border-[#334155] hover:bg-[#334155]">Cancel</AlertDialogCancel>
            <Button disabled={submitting} onClick={handleToggleBlock} className={blockDialog.user?.is_blocked ? "bg-green-600 hover:bg-green-700" : "bg-orange-600 hover:bg-orange-700"}>
              {submitting ? "Processing..." : blockDialog.user?.is_blocked ? "Unblock User" : "Block User"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialog.isOpen} onOpenChange={(o) => !o && setDeleteDialog({ isOpen: false, user: null })}>
        <AlertDialogContent className="bg-[#1E293B] border-red-500/50">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-500">Completely Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              This is a <span className="text-red-400 font-bold">highly destructive action</span>. 
              It will permanently delete ALL data tied to <span className="text-white font-medium">{deleteDialog.user?.full_name}</span> including their purchases, CV coins, and profile.
              This cannot be undone. Are you absolutely sure?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting} className="border-[#334155] hover:bg-[#334155]">Cancel</AlertDialogCancel>
            <Button disabled={submitting} onClick={handleDeleteUser} className="bg-red-600 hover:bg-red-700 text-white">
              {submitting ? "Deleting..." : "Yes, Delete Everything"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Send Notification Modal */}
      <Dialog open={notifyDialog.isOpen} onOpenChange={(o) => !o && setNotifyDialog({ isOpen: false, user: null })}>
        <DialogContent className="bg-[#1E293B] border-[#334155]">
          <DialogHeader><DialogTitle>Send Notification to {notifyDialog.user?.full_name}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Notification Title</Label>
              <Input placeholder="E.g., Welcome Gift!" value={notifyTitle} onChange={e => setNotifyTitle(e.target.value)} className="bg-[#0F172A] border-[#334155]" />
            </div>
            <div className="space-y-2">
              <Label>Message</Label>
              <Textarea placeholder="Type your message here..." rows={4} value={notifyMessage} onChange={e => setNotifyMessage(e.target.value)} className="bg-[#0F172A] border-[#334155]" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNotifyDialog({ isOpen: false, user: null })} disabled={submitting} className="border-[#334155]">Cancel</Button>
            <Button onClick={handleSendNotification} disabled={submitting || !notifyTitle.trim() || !notifyMessage.trim()} className="bg-primary">
              {submitting ? "Sending..." : "Send Notification"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
