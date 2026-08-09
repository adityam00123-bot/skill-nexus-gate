import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { UserX, Ban, Trash2, Search, Eye, Info, ShoppingBag, CreditCard, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface DeletedUser {
  id: string;
  original_user_id: string;
  full_name: string | null;
  email: string | null;
  total_purchases: number;
  total_amount_spent: number;
  deleted_at: string;
  deleted_by: string | null;
}

interface BlockedUser {
  id: string;
  full_name: string | null;
  email: string | null;
  created_at: string;
  telegram_username: string | null;
}

export default function DeletedBlockedUsers() {
  const [activeTab, setActiveTab] = useState<"deleted" | "blocked">("deleted");
  const [deletedUsers, setDeletedUsers] = useState<DeletedUser[]>([]);
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Actions state
  const [viewUser, setViewUser] = useState<BlockedUser | null>(null);
  const [activeViewTab, setActiveViewTab] = useState<"basic" | "finance" | "coins">("basic");
  const [viewUserData, setViewUserData] = useState<{
    purchases: any[];
    subscriptions: any[];
    cvCoins: number;
    cvCoinTransactions: any[];
    loading: boolean;
  }>({ purchases: [], subscriptions: [], cvCoins: 0, cvCoinTransactions: [], loading: false });
  const [unblockUser, setUnblockUser] = useState<BlockedUser | null>(null);
  const [deleteArchiveUser, setDeleteArchiveUser] = useState<DeletedUser | null>(null);
  const [submitting, setSubmitting] = useState(false);
  
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [deletedRes, blockedRes] = await Promise.all([
        supabase
          .from("deleted_users_archive")
          .select("*")
          .order("deleted_at", { ascending: false }),
        supabase
          .from("profiles")
          .select("id, full_name, email, created_at, telegram_username")
          .eq("is_blocked", true)
          .order("created_at", { ascending: false })
      ]);

      setDeletedUsers((deletedRes.data || []) as DeletedUser[]);
      setBlockedUsers((blockedRes.data || []) as BlockedUser[]);
    } catch (error) {
      console.error("Error fetching user audit data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleUnblock = async () => {
    if (!unblockUser) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/telegram/ban-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target_user_id: unblockUser.id, action: "unban" })
      });
      if (!res.ok) throw new Error("Failed to unban from Telegram");

      const { error } = await supabase.from("profiles").update({ is_blocked: false }).eq("id", unblockUser.id);
      if (error) throw error;

      toast({ title: "User Unblocked", description: `${unblockUser.full_name || "User"} has been unblocked.` });
      setUnblockUser(null);
      setViewUser(null);
      fetchData();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteArchive = async () => {
    if (!deleteArchiveUser) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from("deleted_users_archive").delete().eq("id", deleteArchiveUser.id);
      if (error) throw error;

      toast({ title: "Record Deleted", description: "Audit record permanently removed." });
      setDeleteArchiveUser(null);
      fetchData();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleViewUser = async (user: BlockedUser) => {
    setViewUser(user);
    setActiveViewTab("basic");
    setViewUserData(prev => ({ ...prev, loading: true }));
    try {
      const [purchasesRes, subRes, coinRes, coinTxRes] = await Promise.all([
        supabase.from("purchases").select("*, courses(title)").eq("user_id", user.id),
        (supabase as any).from("subscription_history").select("*").eq("user_id", user.id).eq("action", "subscribed"),
        supabase.from("cv_coin_balances").select("balance").eq("user_id", user.id).maybeSingle(),
        supabase.from("cv_coin_transactions").select("*").eq("user_id", user.id).order("created_at", { ascending: false })
      ]);
      setViewUserData({
        purchases: purchasesRes.data || [],
        subscriptions: subRes.data || [],
        cvCoins: coinRes.data?.balance || 0,
        cvCoinTransactions: coinTxRes.data || [],
        loading: false
      });
    } catch (err) {
      console.error(err);
      setViewUserData(prev => ({ ...prev, loading: false }));
    }
  };

  const filteredDeleted = deletedUsers.filter(u => 
    (u.full_name?.toLowerCase().includes(searchQuery.toLowerCase())) || 
    (u.email?.toLowerCase().includes(searchQuery.toLowerCase()))
  );
  const filteredBlocked = blockedUsers.filter(u => 
    (u.full_name?.toLowerCase().includes(searchQuery.toLowerCase())) || 
    (u.email?.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <UserX className="h-6 w-6" /> User Audit
        </h1>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-[#1E293B] border border-[#334155] rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
          />
        </div>
      </div>

      {/* Toggle Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setActiveTab("deleted")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            activeTab === "deleted"
              ? "bg-red-500/20 text-red-400 border border-red-500/30"
              : "bg-[#1E293B] text-muted-foreground border border-[#334155] hover:bg-[#334155]"
          }`}
        >
          <Trash2 className="h-4 w-4" />
          Deleted Users
          <Badge className="bg-red-500/30 text-red-400 text-xs ml-1">{filteredDeleted.length}</Badge>
        </button>
        <button
          onClick={() => setActiveTab("blocked")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            activeTab === "blocked"
              ? "bg-orange-500/20 text-orange-400 border border-orange-500/30"
              : "bg-[#1E293B] text-muted-foreground border border-[#334155] hover:bg-[#334155]"
          }`}
        >
          <Ban className="h-4 w-4" />
          Blocked Users
          <Badge className="bg-orange-500/30 text-orange-400 text-xs ml-1">{filteredBlocked.length}</Badge>
        </button>
      </div>

      {/* Content */}
      <Card className="bg-[#1E293B] border-[#334155]">
        <CardContent className="p-0 overflow-x-auto">
          {loading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full bg-[#334155]" />
              ))}
            </div>
          ) : activeTab === "deleted" ? (
            <Table>
              <TableHeader>
                <TableRow className="border-[#334155]">
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Total Purchases</TableHead>
                  <TableHead>Total Spent</TableHead>
                  <TableHead>Deleted At</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDeleted.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-12">
                      <div className="flex flex-col items-center gap-2">
                        <Trash2 className="h-10 w-10 text-[#334155]" />
                        <p>No deleted users found matching search</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredDeleted.map((u) => (
                    <TableRow key={u.id} className="border-[#334155] hover:bg-[#334155]/50 transition-colors">
                      <TableCell className="font-medium">{u.full_name || "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{u.email || "—"}</TableCell>
                      <TableCell>{u.total_purchases}</TableCell>
                      <TableCell className="text-green-400">₹{u.total_amount_spent.toLocaleString()}</TableCell>
                      <TableCell className="text-sm">{new Date(u.deleted_at).toLocaleString()}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => setDeleteArchiveUser(u)} className="text-red-400 hover:text-red-300 hover:bg-red-400/10">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-[#334155]">
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Telegram</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredBlocked.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-12">
                      <div className="flex flex-col items-center gap-2">
                        <Ban className="h-10 w-10 text-[#334155]" />
                        <p>No blocked users found matching search</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredBlocked.map((u) => (
                    <TableRow key={u.id} className="border-[#334155] hover:bg-[#334155]/50 transition-colors">
                      <TableCell className="font-medium">{u.full_name || "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{u.email || "—"}</TableCell>
                      <TableCell className="text-blue-400">{u.telegram_username ? `@${u.telegram_username}` : "—"}</TableCell>
                      <TableCell className="text-sm">{new Date(u.created_at).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <Badge className="bg-red-500/20 text-red-500 hover:bg-red-500/30">Blocked</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => handleViewUser(u)} className="text-blue-400 hover:text-blue-300 hover:bg-blue-400/10">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      {/* Delete Archive Dialog */}
      <AlertDialog open={!!deleteArchiveUser} onOpenChange={(o) => !o && setDeleteArchiveUser(null)}>
        <AlertDialogContent className="bg-[#1E293B] border-red-500/30">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-400 flex items-center gap-2">
              <AlertCircle className="h-5 w-5" /> Permanently Remove Audit Record
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure? This will permanently delete this record from the audit log. The underlying user data was already deleted. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting} className="border-[#334155] hover:bg-[#334155]">Cancel</AlertDialogCancel>
            <Button variant="destructive" disabled={submitting} onClick={handleDeleteArchive}>
              {submitting ? "Deleting..." : "Yes, Remove Record"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Unblock Dialog */}
      <AlertDialog open={!!unblockUser} onOpenChange={(o) => !o && setUnblockUser(null)}>
        <AlertDialogContent className="bg-[#1E293B] border-green-500/30">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-green-400">Unblock User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to unblock {unblockUser?.full_name}? They will regain access to their courses and can purchase new ones.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting} className="border-[#334155] hover:bg-[#334155]">Cancel</AlertDialogCancel>
            <Button className="bg-green-600 hover:bg-green-700 text-white" disabled={submitting} onClick={handleUnblock}>
              {submitting ? "Unblocking..." : "Yes, Unblock"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* View User Modal */}
      <Dialog open={!!viewUser} onOpenChange={(o) => !o && setViewUser(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col bg-[#1E293B] border-[#334155]">
          <DialogHeader>
            <DialogTitle>Blocked User Profile</DialogTitle>
          </DialogHeader>
          
          {viewUser && (
            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-6">
              <div className="flex items-center gap-4 bg-[#0F172A] p-4 rounded-xl border border-[#334155]">
                <Avatar className="h-20 w-20 border-2 border-primary">
                  <AvatarFallback className="bg-primary/20 text-primary text-3xl font-bold">
                    {(viewUser.full_name || viewUser.email || "U")[0].toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <h2 className="text-2xl font-bold flex items-center gap-2">
                    {viewUser.full_name || "Unnamed User"}
                    <Badge className="bg-red-500/20 text-red-500 text-xs uppercase px-2 py-0.5">Blocked</Badge>
                  </h2>
                  <p className="text-muted-foreground">{viewUser.email}</p>
                </div>
              </div>

              {/* Tabs Navbar */}
              <div className="flex border-b border-[#334155]">
                <button onClick={() => setActiveViewTab("basic")} className={`px-4 py-2 font-medium text-sm transition-colors border-b-2 ${activeViewTab === "basic" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-white"}`}>
                  <div className="flex items-center gap-2"><Info className="h-4 w-4" /> Basic Info</div>
                </button>
                <button onClick={() => setActiveViewTab("finance")} className={`px-4 py-2 font-medium text-sm transition-colors border-b-2 ${activeViewTab === "finance" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-white"}`}>
                  <div className="flex items-center gap-2"><ShoppingBag className="h-4 w-4" /> Financial</div>
                </button>
                <button onClick={() => setActiveViewTab("coins")} className={`px-4 py-2 font-medium text-sm transition-colors border-b-2 ${activeViewTab === "coins" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-white"}`}>
                  <div className="flex items-center gap-2"><CreditCard className="h-4 w-4" /> CV Coins</div>
                </button>
              </div>

              {/* Tab Content */}
              <div className="py-2">
                {activeViewTab === "basic" && (
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
                  </div>
                )}

                {activeViewTab === "finance" && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <Card className="bg-[#0F172A] border-[#334155]"><CardContent className="p-4 text-center">
                        <p className="text-xs text-muted-foreground uppercase mb-1">Total Purchases</p>
                        <p className="text-2xl font-bold">{viewUserData.purchases.length + viewUserData.subscriptions.length}</p>
                      </CardContent></Card>
                      <Card className="bg-[#0F172A] border-[#334155]"><CardContent className="p-4 text-center">
                        <p className="text-xs text-muted-foreground uppercase mb-1">Total Spent</p>
                        <p className="text-2xl font-bold text-green-400">
                          ₹{[...viewUserData.purchases, ...viewUserData.subscriptions].reduce((sum, p) => sum + (Number(p.price_paid || p.amount) || 0), 0).toLocaleString()}
                        </p>
                      </CardContent></Card>
                    </div>
                    {viewUserData.loading ? (
                      <p className="text-sm text-muted-foreground">Loading purchases...</p>
                    ) : (
                      <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                        {[...viewUserData.purchases, ...viewUserData.subscriptions]
                          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                          .map((p, i) => (
                          <div key={i} className="flex justify-between items-center p-3 bg-[#0F172A] rounded-lg border border-[#334155]">
                            <div>
                              <p className="font-medium text-sm">{p.courses?.title || p.plan_name + " Subscription" || "Unknown Item"}</p>
                              <p className="text-xs text-muted-foreground">{new Date(p.created_at).toLocaleString()}</p>
                            </div>
                            <p className="font-bold text-green-400">₹{p.price_paid || p.amount}</p>
                          </div>
                        ))}
                        {viewUserData.purchases.length === 0 && viewUserData.subscriptions.length === 0 && (
                          <p className="text-sm text-muted-foreground text-center py-4">No purchase history found.</p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {activeViewTab === "coins" && (
                  <div className="space-y-4">
                    <Card className="bg-[#0F172A] border-[#334155]">
                      <CardContent className="p-6 flex flex-col items-center justify-center">
                        <p className="text-sm text-muted-foreground uppercase mb-2">Current Balance</p>
                        <p className="text-4xl font-bold text-yellow-400 flex items-center gap-2">
                          <CreditCard className="h-6 w-6" /> {viewUserData.cvCoins} CV
                        </p>
                      </CardContent>
                    </Card>
                    {viewUserData.loading ? (
                      <p className="text-sm text-muted-foreground">Loading transactions...</p>
                    ) : (
                      <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                        {viewUserData.cvCoinTransactions.map((tx: any, i) => (
                          <div key={i} className="flex justify-between items-center p-3 bg-[#0F172A] rounded-lg border border-[#334155]">
                            <div>
                              <p className="font-medium text-sm">{tx.description}</p>
                              <p className="text-xs text-muted-foreground">{new Date(tx.created_at).toLocaleString()}</p>
                            </div>
                            <Badge className={tx.type === 'earned' || tx.type === 'admin_add' ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'}>
                              {tx.type === 'earned' || tx.type === 'admin_add' ? '+' : '-'}{tx.amount} CV
                            </Badge>
                          </div>
                        ))}
                        {viewUserData.cvCoinTransactions.length === 0 && (
                          <p className="text-sm text-muted-foreground text-center py-4">No coin transactions found.</p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-[#334155]">
                <Button variant="outline" className="border-[#334155]" onClick={() => setViewUser(null)}>Close</Button>
                <Button className="bg-green-600 hover:bg-green-700" onClick={() => setUnblockUser(viewUser)}>
                  Unblock User
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
