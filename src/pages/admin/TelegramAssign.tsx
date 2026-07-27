import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { LinkIcon, Check, Image as ImageIcon, Loader2 } from "lucide-react";

export default function AdminTelegramAssign() {
  const [courses, setCourses] = useState<any[]>([]);
  const [channels, setChannels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  
  const { toast } = useToast();

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch unassigned courses (telegram_channel_id is null)
      const { data: coursesData, error: coursesError } = await (supabase as any)
        .from("courses")
        .select("id, title, thumbnail_url, created_at")
        .is("telegram_channel_id", null)
        .or("is_deleted.eq.false,is_deleted.is.null")
        .order("created_at", { ascending: false });

      if (coursesError) throw coursesError;
      setCourses(coursesData || []);

      // Fetch unassigned channels (assigned_to_course_id is null)
      const { data: channelsData, error: channelsError } = await (supabase as any)
        .from("telegram_bot_channels")
        .select("id, channel_id, channel_title, channel_username, created_at")
        .is("assigned_to_course_id", null)
        .order("created_at", { ascending: false });

      if (channelsError) throw channelsError;
      setChannels(channelsData || []);
    } catch (error: any) {
      console.error("Error fetching data:", error);
      toast({ title: "Error fetching data", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAssign = async () => {
    if (!selectedCourseId || !selectedChannelId) return;
    setAssigning(true);
    try {
      const channel = channels.find(c => c.channel_id === selectedChannelId);
      const course = courses.find(c => c.id === selectedCourseId);
      
      if (!channel || !course) throw new Error("Invalid selection");

      // Update courses table
      const { error: courseError } = await (supabase as any)
        .from("courses")
        .update({ telegram_channel_id: channel.channel_id })
        .eq("id", course.id);
        
      if (courseError) throw courseError;

      // Update telegram_bot_channels table
      const { error: channelError } = await (supabase as any)
        .from("telegram_bot_channels")
        .update({ assigned_to_course_id: course.id })
        .eq("channel_id", channel.channel_id);

      if (channelError) {
        // Rollback course update if channel update fails
        await (supabase as any).from("courses").update({ telegram_channel_id: null }).eq("id", course.id);
        throw channelError;
      }

      toast({ title: "Channel Assigned Successfully", description: `Linked "${course.title}" to "${channel.channel_title || channel.channel_username}"` });
      
      // Remove assigned items from state
      setCourses(prev => prev.filter(c => c.id !== course.id));
      setChannels(prev => prev.filter(c => c.channel_id !== channel.channel_id));
      setSelectedCourseId(null);
      setSelectedChannelId(null);
      
    } catch (error: any) {
      console.error("Error assigning channel:", error);
      toast({ title: "Assignment failed", description: error.message, variant: "destructive" });
    } finally {
      setAssigning(false);
    }
  };

  // Basic word overlap scoring for suggestions
  const getSimilarityScore = (str1: string, str2: string) => {
    if (!str1 || !str2) return 0;
    const s1 = str1.toLowerCase().replace(/[^a-z0-9]/g, ' ').split(/\s+/).filter(Boolean);
    const s2 = str2.toLowerCase().replace(/[^a-z0-9]/g, ' ').split(/\s+/).filter(Boolean);
    let score = 0;
    for (const w1 of s1) {
      if (s2.includes(w1) && w1.length > 2) score += 1;
    }
    return score;
  };

  const selectedCourseTitle = useMemo(() => {
    return courses.find(c => c.id === selectedCourseId)?.title || "";
  }, [selectedCourseId, courses]);

  // Map of channel_id -> score, if selected course exists
  const suggestionScores = useMemo(() => {
    if (!selectedCourseTitle) return new Map();
    const map = new Map<string, number>();
    channels.forEach(ch => {
      const score = getSimilarityScore(selectedCourseTitle, ch.channel_title || ch.channel_username || "");
      map.set(ch.channel_id, score);
    });
    return map;
  }, [selectedCourseTitle, channels]);

  return (
    <div className="space-y-6 h-[calc(100vh-6rem)] flex flex-col">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><LinkIcon className="h-6 w-6"/> Assign Telegram Channels</h1>
        <p className="text-muted-foreground mt-1 text-sm">Quickly pair your imported courses with newly added Telegram channels.</p>
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-2 gap-6 relative">
        {/* Left Column: Courses */}
        <Card className="bg-[#1E293B] border-[#334155] flex flex-col min-h-0 h-full">
          <CardHeader className="py-4 border-b border-[#334155]">
            <CardTitle className="text-base font-semibold">Unassigned Courses ({courses.length})</CardTitle>
            <CardDescription>Select a course to assign a channel</CardDescription>
          </CardHeader>
          <CardContent className="p-2 overflow-y-auto flex-1 custom-scrollbar">
            {loading ? (
              <div className="space-y-2 p-2">{Array.from({length: 5}).map((_, i) => <Skeleton key={i} className="h-16 w-full bg-[#334155]" />)}</div>
            ) : courses.length === 0 ? (
              <div className="h-full flex items-center justify-center text-muted-foreground text-sm p-4 text-center">
                All courses have channels assigned!
              </div>
            ) : (
              <div className="space-y-2 p-2 pb-24">
                {courses.map(course => (
                  <div 
                    key={course.id}
                    onClick={() => setSelectedCourseId(course.id)}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                      selectedCourseId === course.id 
                        ? 'bg-blue-500/10 border-blue-500/50 ring-1 ring-blue-500' 
                        : 'bg-[#0F172A] border-[#334155] hover:border-[#475569]'
                    }`}
                  >
                    <div className="h-10 w-10 shrink-0 rounded bg-[#334155] flex items-center justify-center overflow-hidden">
                      {course.thumbnail_url ? (
                        <img src={course.thumbnail_url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <ImageIcon className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate" title={course.title}>{course.title}</p>
                      <p className="text-xs text-muted-foreground">ID: {course.id.slice(0, 8)}...</p>
                    </div>
                    {selectedCourseId === course.id && <Check className="h-4 w-4 text-blue-400 shrink-0" />}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right Column: Channels */}
        <Card className="bg-[#1E293B] border-[#334155] flex flex-col min-h-0 h-full">
          <CardHeader className="py-4 border-b border-[#334155]">
            <CardTitle className="text-base font-semibold">Unassigned Channels ({channels.length})</CardTitle>
            <CardDescription>Select a channel for the chosen course</CardDescription>
          </CardHeader>
          <CardContent className="p-2 overflow-y-auto flex-1 custom-scrollbar">
            {loading ? (
              <div className="space-y-2 p-2">{Array.from({length: 5}).map((_, i) => <Skeleton key={i} className="h-16 w-full bg-[#334155]" />)}</div>
            ) : channels.length === 0 ? (
              <div className="h-full flex items-center justify-center text-muted-foreground text-sm p-4 text-center">
                No unassigned channels found.<br/>Add the bot to a new channel first.
              </div>
            ) : (
              <div className="space-y-2 p-2 pb-24">
                {channels
                  .sort((a, b) => (suggestionScores.get(b.channel_id) || 0) - (suggestionScores.get(a.channel_id) || 0))
                  .map(channel => {
                  const score = suggestionScores.get(channel.channel_id) || 0;
                  const isSuggested = selectedCourseTitle && score > 0;
                  return (
                    <div 
                      key={channel.channel_id}
                      onClick={() => setSelectedChannelId(channel.channel_id)}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                        selectedChannelId === channel.channel_id 
                          ? 'bg-blue-500/10 border-blue-500/50 ring-1 ring-blue-500' 
                          : isSuggested 
                            ? 'bg-green-500/5 border-green-500/30'
                            : 'bg-[#0F172A] border-[#334155] hover:border-[#475569]'
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-white truncate" title={channel.channel_title || ""}>
                            {channel.channel_title || "Unnamed Channel"}
                          </p>
                          {isSuggested && selectedChannelId !== channel.channel_id && (
                            <Badge variant="outline" className="bg-green-500/10 text-green-400 border-green-500/20 text-[10px] py-0 h-4">Suggested</Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground flex items-center gap-2 mt-1">
                          {channel.channel_username && <span>@{channel.channel_username}</span>}
                          <span className="opacity-50">[{channel.channel_id}]</span>
                        </p>
                      </div>
                      {selectedChannelId === channel.channel_id && <Check className="h-4 w-4 text-blue-400 shrink-0" />}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Floating Action Bar */}
        {(selectedCourseId || selectedChannelId) && (
          <div className="absolute bottom-6 left-6 right-6 p-4 rounded-xl bg-[#0F172A] border border-[#334155] shadow-2xl shadow-black/50 flex items-center justify-between z-10 animate-in slide-in-from-bottom-5 fade-in duration-200">
            <div className="flex-1 flex flex-col md:flex-row md:items-center gap-2 md:gap-4 truncate mr-4">
              <div className="flex-1 truncate text-sm">
                <span className="text-muted-foreground mr-2">Course:</span>
                {selectedCourseId ? <span className="font-medium text-white">{courses.find(c => c.id === selectedCourseId)?.title}</span> : <span className="text-red-400">Select a course</span>}
              </div>
              <LinkIcon className="h-4 w-4 text-muted-foreground hidden md:block shrink-0" />
              <div className="flex-1 truncate text-sm">
                <span className="text-muted-foreground mr-2">Channel:</span>
                {selectedChannelId ? <span className="font-medium text-white">{channels.find(c => c.channel_id === selectedChannelId)?.channel_title || "Unnamed Channel"}</span> : <span className="text-red-400">Select a channel</span>}
              </div>
            </div>
            
            <Button 
              onClick={handleAssign} 
              disabled={!selectedCourseId || !selectedChannelId || assigning}
              className="bg-green-600 hover:bg-green-700 text-white shrink-0 shadow-lg shadow-green-900/20"
            >
              {assigning ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Assigning...</> : 'Confirm Assignment'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
