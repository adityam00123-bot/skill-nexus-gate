import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Download, Trash2, Eye, RefreshCcw, HandCoins, Info, LayoutList, Calendar, IndianRupee, CreditCard, ShoppingCart, User as UserIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

// Extended interface handling dynamic columns
interface OrderRow {
  id: string; 
  display_id: string; // first 8 chars of UUID
  user_id: string;
  course_id: string;
  price_paid: number;
  created_at: string;
  payment_status: string;
  payment_method: string;
  is_deleted: boolean;
  
  // Merged properties
  user_name: string;
  user_email: string;
  user_avatar?: string;
  course_name: string;
  course_thumb?: string;
  course_instructor: string;
}

export default function AdminOrders() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filtering & Pagination
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState("all");
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [page, setPage] = useState(0);
  const perPage = 20;
  
  const { toast } = useToast();
  
  // Modals
  const [viewOrder, setViewOrder] = useState<OrderRow | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<{ isOpen: boolean; orderId: string | null }>({ isOpen: false, orderId: null });
  const [submitting, setSubmitting] = useState(false);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      // Fetching separately as requested
      const [purchasesRes, profilesRes, coursesRes, subHistoryRes] = await Promise.all([
        supabase.from("purchases").select("*").order("created_at", { ascending: false }),
        supabase.from("profiles").select("id, full_name, email, avatar_url"),
        supabase.from("courses").select("id, title, thumbnail_url, instructor_name"),
        (supabase as any).from("subscription_history").select("amount").eq("action", "subscribed").not("amount", "is", null),
      ]);

      if (purchasesRes.error) throw purchasesRes.error;
      
      // Merge using Maps
      const userMap = new Map();
      (profilesRes.data || []).forEach(p => userMap.set(p.id, p));

      const courseMap = new Map();
      (coursesRes.data || []).forEach(c => courseMap.set(c.id, c));

      const mergedOrders: OrderRow[] = [];
      
      (purchasesRes.data || []).forEach(p => {
        // ALWAYS FILTER is_deleted = false inside processing stringently to handle nulls/undefined safely
        if (p.is_deleted === true) return;

        const user = userMap.get(p.user_id);
        const course = courseMap.get(p.course_id);
        
        const price = Number(p.price_paid) || 0;

        mergedOrders.push({
          id: p.id,
          display_id: p.id.substring(0, 8),
          user_id: p.user_id,
          course_id: p.course_id,
          price_paid: price,
          created_at: p.created_at,
          payment_status: p.payment_status || "Success",
          payment_method: p.payment_method || "UPI",
          is_deleted: p.is_deleted || false,
          user_name: user?.full_name || "Unknown User",
          user_email: user?.email || "",
          user_avatar: user?.avatar_url,
          course_name: course?.title || "Deleted Course",
          course_thumb: course?.thumbnail_url,
          course_instructor: course?.instructor_name || "Unknown",
        });
      });

      setOrders(mergedOrders);
      setSubscriptions(subHistoryRes.data || []);
    } catch (error: any) {
      console.error("Error fetching orders:", error);
      toast({ title: "Error fetching data", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const handleSoftDelete = async () => {
    if (!deleteDialog.orderId) return;
    setSubmitting(true);
    try {
      // Cast as any to bypass TS complaining about is_deleted if not generated yet
      const { error } = await supabase.from("purchases").update({ is_deleted: true } as any).eq("id", deleteDialog.orderId);
      if (error) throw error;
      
      toast({ title: "Order successfully marked as deleted" });
      
      // Hide from UI immediately
      setOrders(prev => prev.filter(o => o.id !== deleteDialog.orderId));
    } catch (error: any) {
      toast({ title: "Failed to delete order", description: error.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
      setDeleteDialog({ isOpen: false, orderId: null });
    }
  };

  // Filter Logic
  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      // 1. Search filter
      const searchLower = search.toLowerCase();
      if (search && !(
        o.user_name.toLowerCase().includes(searchLower) ||
        o.user_email.toLowerCase().includes(searchLower) ||
        o.course_name.toLowerCase().includes(searchLower) ||
        o.display_id.toLowerCase().includes(searchLower)
      )) {
        return false;
      }
      
      // 2. Date filter (UTC)
      if (dateFilter !== "all") {
        const orderDate = new Date(o.created_at).getTime();
        const now = new Date();
        const utcNow = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
        
        let minDate = 0;
        if (dateFilter === "today") {
          minDate = utcNow;
        } else if (dateFilter === "7days") {
          minDate = utcNow - (7 * 24 * 60 * 60 * 1000);
        } else if (dateFilter === "30days") {
          minDate = utcNow - (30 * 24 * 60 * 60 * 1000);
        }
        if (orderDate < minDate) return false;
      }
      
      // 3. Price filter
      const p = o.price_paid;
      const min = parseFloat(priceMin);
      const max = parseFloat(priceMax);
      if (!isNaN(min) && p < min) return false;
      if (!isNaN(max) && p > max) return false;
      
      return true;
    });
  }, [orders, search, dateFilter, priceMin, priceMax]);

  // Derived stats using filtered data (or all orders, depending on intent. Usually metrics are for ALL visible orders)
  // Recomputing stats for total dataset (excluding deleted is handled inside fetch) 
  const totalOrders = orders.length + subscriptions.length; // exclude deleted
  const courseRevenue = orders.reduce((sum, o) => sum + o.price_paid, 0);
  const subRevenue = subscriptions.reduce((sum, s) => sum + (Number(s.amount) || 0), 0);
  const totalRevenue = courseRevenue + subRevenue;
  const uniqueCustomers = new Set(orders.map(o => o.user_id)).size;
  const avgOrderValue = totalOrders > 0 ? (totalRevenue / totalOrders).toFixed(0) : 0;

  const paged = filteredOrders.slice(page * perPage, (page + 1) * perPage);
  const totalPages = Math.ceil(filteredOrders.length / perPage);

  // CSV Export
  const exportCSV = () => {
    if (filteredOrders.length === 0) {
      toast({ title: "No data to export", variant: "destructive" });
      return;
    }
    
    // Proper escaping function for CSV
    const escapeCSV = (str: string) => {
      if (str === null || str === undefined) return '""';
      const escaped = String(str).replace(/"/g, '""');
      return `"${escaped}"`;
    };

    const header = ["Order ID", "User Name", "Email", "Course Name", "Amount", "Date", "Status"].join(",") + "\n";
    
    const rows = filteredOrders.map(o => {
      return [
        escapeCSV(o.display_id),
        escapeCSV(o.user_name),
        escapeCSV(o.user_email),
        escapeCSV(o.course_name),
        o.price_paid,
        escapeCSV(new Date(o.created_at).toLocaleString()),
        escapeCSV(o.payment_status)
      ].join(",");
    }).join("\n");
    
    // Add UTF-8 BOM to ensure Excel reads Unicode correctly
    const blob = new Blob(["\ufeff" + header + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `orders_export_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Export Started", description: `Exporting ${filteredOrders.length} orders.` });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold flex items-center gap-2"><LayoutList className="h-6 w-6" /> Orders Management</h1>
        <Button onClick={exportCSV} variant="outline" className="gap-2 border-[#334155] bg-card hover:bg-muted">
          <Download className="h-4 w-4" /> Export CSV
        </Button>
      </div>

      {/* SECTION 1 — STATS CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-[#1E293B] border-[#334155]">
          <CardContent className="p-5 flex flex-col justify-center gap-1">
            <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <IndianRupee className="h-4 w-4" /> Total Revenue
            </p>
            <p className="text-2xl font-bold text-green-400">₹{totalRevenue.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="bg-[#1E293B] border-[#334155]">
          <CardContent className="p-5 flex flex-col justify-center gap-1">
            <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <ShoppingCart className="h-4 w-4" /> Total Orders
            </p>
            <p className="text-2xl font-bold text-white">{totalOrders}</p>
          </CardContent>
        </Card>
        <Card className="bg-[#1E293B] border-[#334155]">
          <CardContent className="p-5 flex flex-col justify-center gap-1">
            <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <UserIcon className="h-4 w-4" /> Unique Customers
            </p>
            <p className="text-2xl font-bold text-white">{uniqueCustomers}</p>
          </CardContent>
        </Card>
        <Card className="bg-[#1E293B] border-[#334155]">
          <CardContent className="p-5 flex flex-col justify-center gap-1">
            <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <HandCoins className="h-4 w-4" /> Avg Order Value
            </p>
            <p className="text-2xl font-bold text-blue-400">₹{Number(avgOrderValue).toLocaleString()}</p>
          </CardContent>
        </Card>
      </div>

      {/* SECTION 2 — SEARCH & FILTERS */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search orders..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} className="pl-10 bg-[#1E293B] border-[#334155]" />
        </div>
        <Select value={dateFilter} onValueChange={(v) => { setDateFilter(v); setPage(0); }}>
          <SelectTrigger className="w-40 bg-[#1E293B] border-[#334155]"><SelectValue placeholder="Date" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Time</SelectItem>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="7days">Last 7 Days</SelectItem>
            <SelectItem value="30days">Last 30 Days</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2">
          <Input type="number" placeholder="Min ₹" value={priceMin} onChange={e => { setPriceMin(e.target.value); setPage(0); }} className="w-24 bg-[#1E293B] border-[#334155]" />
          <span className="text-muted-foreground">-</span>
          <Input type="number" placeholder="Max ₹" value={priceMax} onChange={e => { setPriceMax(e.target.value); setPage(0); }} className="w-24 bg-[#1E293B] border-[#334155]" />
        </div>
      </div>

      {/* SECTION 3 — ORDERS TABLE */}
      <Card className="bg-[#1E293B] border-[#334155]">
        <CardContent className="p-0 overflow-x-auto">
          {loading ? (
            <div className="p-4 space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full bg-[#334155]" />)}</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-[#334155]">
                  <TableHead className="w-24">Order ID</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Course</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paged.map((o) => (
                  <TableRow key={o.id} className="border-[#334155] hover:bg-[#334155]/50 transition-colors">
                    <TableCell className="font-mono text-xs text-muted-foreground">{o.display_id}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8 border border-[#334155]">
                          <AvatarImage src={o.user_avatar || ""} />
                          <AvatarFallback className="bg-primary/20 text-primary text-xs font-semibold">
                            {(o.user_name || "U").charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col max-w-[150px] lg:max-w-[180px]">
                          <span className="font-semibold text-sm truncate">{o.user_name}</span>
                          <span className="text-xs text-muted-foreground truncate">{o.user_email || "—"}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {o.course_thumb ? (
                          <img src={o.course_thumb} alt="" className="h-8 w-12 rounded object-cover border border-[#334155]" />
                        ) : (
                          <div className="h-8 w-12 rounded bg-[#0F172A] border border-[#334155]"></div>
                        )}
                        <span className="font-medium text-sm truncate max-w-[200px]">{o.course_name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-green-400 font-medium whitespace-nowrap">₹{o.price_paid.toLocaleString()}</TableCell>
                    <TableCell className="text-xs whitespace-nowrap">
                      {new Date(o.created_at).toLocaleDateString()} <span className="text-muted-foreground">{new Date(o.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                    </TableCell>
                    <TableCell>
                      <Badge className={`bg-green-500/20 text-green-400 border-green-500/30 font-medium ${o.payment_status?.toLowerCase() !== 'success' ? 'bg-orange-500/20 text-orange-400 border-orange-500/30' : ''}`}>
                        {o.payment_status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => setViewOrder(o)} className="h-8 w-8 text-blue-400 hover:text-blue-300 hover:bg-blue-400/10" title="View Details"><Eye className="h-4 w-4" /></Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-muted-foreground hover:bg-muted" 
                          title="Refund - Coming soon"
                          disabled
                        >
                          <RefreshCcw className="h-4 w-4 opacity-50" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeleteDialog({ isOpen: true, orderId: o.id })} className="h-8 w-8 text-red-500 hover:text-red-400 hover:bg-red-500/10" title="Soft Delete"><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {paged.length === 0 && (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-12">
                    <div className="flex flex-col items-center gap-2"><LayoutList className="h-10 w-10 text-[#334155]" /><p>No orders found matching criteria</p></div>
                  </TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)} className="border-[#334155] hover:bg-muted">Previous</Button>
          <span className="text-sm text-muted-foreground">Page {page + 1} of {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)} className="border-[#334155] hover:bg-muted">Next</Button>
        </div>
      )}

      {/* ===================== VIEW ORDER MODAL ===================== */}
      <Dialog open={!!viewOrder} onOpenChange={(o) => !o && setViewOrder(null)}>
        <DialogContent className="max-w-2xl bg-[#1E293B] border-[#334155]">
          <DialogHeader className="border-b border-[#334155] pb-4">
            <DialogTitle className="flex items-center justify-between">
              Order Details
              <Badge className="bg-green-500/20 text-green-400 mr-4 font-semibold">{viewOrder?.payment_status}</Badge>
            </DialogTitle>
          </DialogHeader>
          
          {viewOrder && (
            <div className="py-2 space-y-6">
              
              {/* Info Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* User Info */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2"><UserIcon className="h-4 w-4" /> Customer Info</h3>
                  <div className="bg-[#0F172A] p-4 rounded-lg border border-[#334155] flex items-center gap-3">
                    <Avatar className="h-12 w-12 border border-[#334155]">
                      <AvatarImage src={viewOrder.user_avatar || ""} />
                      <AvatarFallback className="bg-primary/20 text-primary">
                        {(viewOrder.user_name || "U").charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="overflow-hidden">
                      <p className="font-semibold text-white truncate">{viewOrder.user_name}</p>
                      <p className="text-xs text-muted-foreground truncate">{viewOrder.user_email || "No Email"}</p>
                    </div>
                  </div>
                </div>
                
                {/* Course Info */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2"><Info className="h-4 w-4" /> Course Info</h3>
                  <div className="bg-[#0F172A] p-4 rounded-lg border border-[#334155] flex items-start gap-3">
                   {viewOrder.course_thumb ? (
                      <img src={viewOrder.course_thumb} alt="" className="h-12 w-16 rounded object-cover border border-[#334155] shrink-0" />
                    ) : (
                      <div className="h-12 w-16 rounded bg-[#1E293B] border border-[#334155] shrink-0"></div>
                    )}
                    <div className="overflow-hidden">
                      <p className="font-semibold text-white truncate line-clamp-2 leading-tight text-sm">{viewOrder.course_name}</p>
                      <p className="text-xs text-muted-foreground mt-1">Instructor: {viewOrder.course_instructor}</p>
                    </div>
                  </div>
                </div>
                
                {/* Payment Info */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2"><CreditCard className="h-4 w-4" /> Payment Info</h3>
                  <div className="bg-[#0F172A] p-4 rounded-lg border border-[#334155] space-y-2">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Amount Paid:</span>
                      <span className="font-bold text-green-400">₹{viewOrder.price_paid.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Method:</span>
                      <span className="font-medium">{viewOrder.payment_method}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Date:</span>
                      <span className="font-medium text-right">{new Date(viewOrder.created_at).toLocaleDateString()}</span>
                    </div>
                     <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Time:</span>
                      <span className="font-medium text-right">{new Date(viewOrder.created_at).toLocaleTimeString()}</span>
                    </div>
                  </div>
                </div>

                {/* Order Meta */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2"><Calendar className="h-4 w-4" /> Order Meta</h3>
                  <div className="bg-[#0F172A] p-4 rounded-lg border border-[#334155] flex flex-col justify-center gap-2">
                    <p className="text-xs text-muted-foreground">Order UUID</p>
                    <p className="font-mono text-xs text-white break-all select-all bg-[#1E293B] p-2 rounded">{viewOrder.id}</p>
                  </div>
                </div>

              </div>
              
            </div>
          )}
          <DialogFooter className="mt-2">
            <Button variant="outline" onClick={() => setViewOrder(null)} className="border-[#334155] hover:bg-muted">Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialog.isOpen} onOpenChange={(o) => !o && setDeleteDialog({ isOpen: false, orderId: null })}>
        <AlertDialogContent className="bg-[#1E293B] border-red-500/50">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-500">Soft Delete Order</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to hide this order? It will be removed from your dashboard totals and tables, but the record will remain safely in the database.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting} className="border-[#334155] hover:bg-muted">Cancel</AlertDialogCancel>
            <Button disabled={submitting} onClick={handleSoftDelete} className="bg-red-600 hover:bg-red-700 text-white">
              {submitting ? "Processing..." : "Yes, Hide Order"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
