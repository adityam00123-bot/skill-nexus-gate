import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const DEFAULT_SETTINGS: Record<string, string> = {
  site_name: "CourseVerse",
  site_description: "Premium trading & investing courses",
  maintenance_mode: "false",
  support_email: "courseversehere@gmail.com",
  telegram_support: "",
  telegram_bot: "",
  monthly_price: "499",
  yearly_price: "3999",
  referral_reward_pct: "20",
  min_withdrawal: "100",
  refund_policy: "",
  about_content: "",
};

export default function AdminSettings() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    (supabase as any).from("platform_settings").select("key, value").then(({ data }: any) => {
      const map: Record<string, string> = { ...DEFAULT_SETTINGS };
      (data || []).forEach((d: any) => { map[d.key] = d.value; });
      setSettings(map);
      setLoading(false);
    });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    for (const [key, value] of Object.entries(settings)) {
      await (supabase as any).from("platform_settings").upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "key" });
    }
    toast({ title: "Settings saved" });
    setSaving(false);
  };

  const update = (key: string, value: string) => setSettings(s => ({ ...s, [key]: value }));

  if (loading) return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-48 bg-[#334155]" />
      {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-48 bg-[#1E293B]" />)}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Platform Settings</h1>
        <Button onClick={handleSave} disabled={saving} className="gap-2 bg-green-600 hover:bg-green-700">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Save All
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* General */}
        <Card className="bg-[#1E293B] border-[#334155]">
          <CardHeader><CardTitle className="text-lg">General</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5"><Label>Site Name</Label><Input value={settings.site_name} onChange={e => update("site_name", e.target.value)} className="bg-[#0F172A] border-[#334155]" /></div>
            <div className="space-y-1.5"><Label>Site Description</Label><Textarea value={settings.site_description} onChange={e => update("site_description", e.target.value)} className="bg-[#0F172A] border-[#334155]" rows={2} /></div>
            <div className="flex items-center justify-between">
              <div><Label>Maintenance Mode</Label><p className="text-xs text-muted-foreground">Take the site offline</p></div>
              <Switch checked={settings.maintenance_mode === "true"} onCheckedChange={v => update("maintenance_mode", v ? "true" : "false")} />
            </div>
          </CardContent>
        </Card>

        {/* Support */}
        <Card className="bg-[#1E293B] border-[#334155]">
          <CardHeader><CardTitle className="text-lg">Support & Links</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5"><Label>Support Email</Label><Input value={settings.support_email} onChange={e => update("support_email", e.target.value)} className="bg-[#0F172A] border-[#334155]" /></div>
            <div className="space-y-1.5"><Label>Telegram Support Link</Label><Input value={settings.telegram_support} onChange={e => update("telegram_support", e.target.value)} className="bg-[#0F172A] border-[#334155]" /></div>
            <div className="space-y-1.5"><Label>Telegram Bot Link</Label><Input value={settings.telegram_bot} onChange={e => update("telegram_bot", e.target.value)} className="bg-[#0F172A] border-[#334155]" /></div>
          </CardContent>
        </Card>

        {/* Pricing */}
        <Card className="bg-[#1E293B] border-[#334155]">
          <CardHeader><CardTitle className="text-lg">Pricing</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5"><Label>Monthly Subscription Price (₹)</Label><Input type="number" value={settings.monthly_price} onChange={e => update("monthly_price", e.target.value)} className="bg-[#0F172A] border-[#334155]" /></div>
            <div className="space-y-1.5"><Label>Yearly Subscription Price (₹)</Label><Input type="number" value={settings.yearly_price} onChange={e => update("yearly_price", e.target.value)} className="bg-[#0F172A] border-[#334155]" /></div>
            <p className="text-xs text-muted-foreground">Yearly savings: ₹{(Number(settings.monthly_price) * 12 - Number(settings.yearly_price)).toLocaleString()}</p>
          </CardContent>
        </Card>

        {/* Referral */}
        <Card className="bg-[#1E293B] border-[#334155]">
          <CardHeader><CardTitle className="text-lg">Referral Settings</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5"><Label>Referral Reward (%)</Label><Input type="number" value={settings.referral_reward_pct} onChange={e => update("referral_reward_pct", e.target.value)} className="bg-[#0F172A] border-[#334155]" /></div>
            <div className="space-y-1.5"><Label>Min Withdrawal (₹)</Label><Input type="number" value={settings.min_withdrawal} onChange={e => update("min_withdrawal", e.target.value)} className="bg-[#0F172A] border-[#334155]" /></div>
          </CardContent>
        </Card>

        {/* Refund Policy */}
        <Card className="bg-[#1E293B] border-[#334155]">
          <CardHeader><CardTitle className="text-lg">Refund Policy</CardTitle></CardHeader>
          <CardContent>
            <Textarea value={settings.refund_policy} onChange={e => update("refund_policy", e.target.value)} className="bg-[#0F172A] border-[#334155]" rows={6} />
          </CardContent>
        </Card>

        {/* About */}
        <Card className="bg-[#1E293B] border-[#334155]">
          <CardHeader><CardTitle className="text-lg">About Page Content</CardTitle></CardHeader>
          <CardContent>
            <Textarea value={settings.about_content} onChange={e => update("about_content", e.target.value)} className="bg-[#0F172A] border-[#334155]" rows={6} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
