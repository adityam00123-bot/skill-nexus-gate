import { NavLink, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import {
  LayoutDashboard, BookOpen, Users, ShoppingCart, CreditCard,
  Briefcase, Coins, ArrowLeftRight, DollarSign, Bell, Settings, LogOut, X, Menu, ExternalLink, Link as LinkIcon
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

interface BadgeCounts { exchange: number; sell: number; reseller: number; }

export default function AdminSidebar() {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [badges, setBadges] = useState<BadgeCounts>({ exchange: 0, sell: 0, reseller: 0 });

  useEffect(() => {
    async function loadBadges() {
      const [e, s, r] = await Promise.all([
        supabase.from("exchange_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("sell_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("reseller_applications").select("id", { count: "exact", head: true }).eq("status", "pending"),
      ]);
      setBadges({ exchange: e.count || 0, sell: s.count || 0, reseller: r.count || 0 });
    }
    loadBadges();
  }, []);

  const links = [
    { to: "/admin", icon: LayoutDashboard, label: "Dashboard", end: true },
    { to: "/admin/courses", icon: BookOpen, label: "Courses" },
    { to: "/admin/telegram-assign", icon: LinkIcon, label: "Channel Assignment" },
    { to: "/admin/users", icon: Users, label: "Users" },
    { to: "/admin/orders", icon: ShoppingCart, label: "Orders" },
    { to: "/admin/subscriptions", icon: CreditCard, label: "Subscriptions" },
    { to: "/admin/resellers", icon: Briefcase, label: "Resellers", badge: badges.reseller },
    { to: "/admin/cv-coins", icon: Coins, label: "CV Coins" },
    { to: "/admin/exchange-requests", icon: ArrowLeftRight, label: "Exchange Requests", badge: badges.exchange },
    { to: "/admin/sell-requests", icon: DollarSign, label: "Sell Requests", badge: badges.sell },
    { to: "/admin/notifications", icon: Bell, label: "Notifications" },
    { to: "/admin/settings", icon: Settings, label: "Settings" },
  ];

  const handleLogout = async () => { await signOut(); navigate("/"); };

  const sidebar = (
    <div className="flex flex-col h-full bg-[#0F172A] border-r border-[#1E293B] w-64">
      <div className="p-4 border-b border-[#1E293B] flex items-center justify-between">
        <NavLink to="/admin" className="text-xl font-bold text-primary">CV Admin</NavLink>
        <button className="lg:hidden text-muted-foreground" onClick={() => setOpen(false)}><X className="h-5 w-5" /></button>
      </div>
      <nav className="flex-1 overflow-y-auto p-2 space-y-1">
        {links.map((l) => (
          <NavLink
            key={l.to} to={l.to} end={l.end}
            onClick={() => setOpen(false)}
            className={({ isActive }) => cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
              isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-[#1E293B] hover:text-foreground"
            )}
          >
            <l.icon className="h-4 w-4 shrink-0" />
            <span className="flex-1">{l.label}</span>
            {l.badge ? <span className="bg-red-500 text-white text-xs font-bold rounded-full h-5 min-w-[20px] flex items-center justify-center px-1">{l.badge}</span> : null}
          </NavLink>
        ))}
      </nav>
      <div className="p-2 border-t border-[#1E293B] space-y-1">
        <button
          onClick={() => window.open("/", "_blank")}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-[#1E293B] hover:text-foreground w-full transition-colors"
        >
          <ExternalLink className="h-4 w-4" /><span>Back to Site</span>
        </button>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-[#1E293B] hover:text-foreground w-full transition-colors"
        >
          <LogOut className="h-4 w-4" /><span>Log Out</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      <button className="lg:hidden fixed top-4 left-4 z-50 bg-[#1E293B] p-2 rounded-lg text-foreground" onClick={() => setOpen(true)}>
        <Menu className="h-5 w-5" />
      </button>
      {open && (
        <div className="lg:hidden fixed inset-0 z-40 bg-black/60" onClick={() => setOpen(false)}>
          <div className="fixed inset-y-0 left-0 z-50" onClick={e => e.stopPropagation()}>{sidebar}</div>
        </div>
      )}
      <div className="hidden lg:block shrink-0">{sidebar}</div>
    </>
  );
}
