import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { UserX, Ban, Trash2 } from "lucide-react";

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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <UserX className="h-6 w-6" /> User Audit
        </h1>
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
          <Badge className="bg-red-500/30 text-red-400 text-xs ml-1">{deletedUsers.length}</Badge>
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
          <Badge className="bg-orange-500/30 text-orange-400 text-xs ml-1">{blockedUsers.length}</Badge>
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {deletedUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-12">
                      <div className="flex flex-col items-center gap-2">
                        <Trash2 className="h-10 w-10 text-[#334155]" />
                        <p>No deleted users found</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  deletedUsers.map((u) => (
                    <TableRow key={u.id} className="border-[#334155] hover:bg-[#334155]/50 transition-colors">
                      <TableCell className="font-medium">{u.full_name || "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{u.email || "—"}</TableCell>
                      <TableCell>{u.total_purchases}</TableCell>
                      <TableCell className="text-green-400">₹{u.total_amount_spent.toLocaleString()}</TableCell>
                      <TableCell className="text-sm">{new Date(u.deleted_at).toLocaleString()}</TableCell>
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {blockedUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-12">
                      <div className="flex flex-col items-center gap-2">
                        <Ban className="h-10 w-10 text-[#334155]" />
                        <p>No blocked users found</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  blockedUsers.map((u) => (
                    <TableRow key={u.id} className="border-[#334155] hover:bg-[#334155]/50 transition-colors">
                      <TableCell className="font-medium">{u.full_name || "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{u.email || "—"}</TableCell>
                      <TableCell className="text-blue-400">{u.telegram_username ? `@${u.telegram_username}` : "—"}</TableCell>
                      <TableCell className="text-sm">{new Date(u.created_at).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <Badge className="bg-red-500/20 text-red-500 hover:bg-red-500/30">Blocked</Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
