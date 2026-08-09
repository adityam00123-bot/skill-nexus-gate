import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageCircle, CheckCircle, Clock, Send, AlertCircle, Search, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

interface Profile {
  full_name: string | null;
  email: string | null;
}

interface SupportTicket {
  id: string;
  user_id: string;
  subject: string;
  status: string;
  created_at: string;
  updated_at: string;
  profiles: Profile | null;
}

interface SupportMessage {
  id: string;
  ticket_id: string;
  sender_type: string;
  message: string;
  created_at: string;
}

export default function AdminSupport() {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchTickets = async () => {
    try {
      const { data, error } = await supabase
        .from("support_tickets")
        .select(`
          *,
          profiles (full_name, email)
        `)
        .order("updated_at", { ascending: false });

      if (error) throw error;
      setTickets(data || []);
    } catch (err: any) {
      console.error(err);
      toast({ title: "Error fetching tickets", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, []);

  useEffect(() => {
    let channel: any;
    
    if (selectedTicket) {
      fetchMessages(selectedTicket.id);
      
      // Subscribe to real-time changes
      channel = supabase
        .channel(`messages-${selectedTicket.id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'support_messages',
            filter: `ticket_id=eq.${selectedTicket.id}`
          },
          (payload) => {
            const newMessage = payload.new as SupportMessage;
            setMessages((prev) => [...prev, newMessage]);
            scrollToBottom();
          }
        )
        .subscribe();
    }
    
    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [selectedTicket?.id]);

  const fetchMessages = async (ticketId: string) => {
    setMessagesLoading(true);
    try {
      const { data, error } = await supabase
        .from("support_messages")
        .select("*")
        .eq("ticket_id", ticketId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      setMessages(data || []);
      setTimeout(scrollToBottom, 100);
    } catch (err: any) {
      console.error(err);
      toast({ title: "Error fetching messages", description: err.message, variant: "destructive" });
    } finally {
      setMessagesLoading(false);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || !selectedTicket) return;

    setSending(true);
    try {
      const { error } = await supabase
        .from("support_messages")
        .insert({
          ticket_id: selectedTicket.id,
          sender_type: 'admin',
          message: replyText.trim()
        });

      if (error) throw error;
      
      // Update the ticket's updated_at
      await supabase
        .from("support_tickets")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", selectedTicket.id);

      setReplyText("");
      fetchTickets(); // Refresh tickets to update sorting/timestamps
    } catch (err: any) {
      console.error(err);
      toast({ title: "Error sending reply", description: err.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const handleMarkResolved = async () => {
    if (!selectedTicket) return;
    
    try {
      const { error } = await supabase
        .from("support_tickets")
        .update({ status: 'resolved', updated_at: new Date().toISOString() })
        .eq("id", selectedTicket.id);

      if (error) throw error;

      toast({ title: "Ticket Resolved", description: "The ticket has been marked as resolved." });
      setSelectedTicket({ ...selectedTicket, status: 'resolved' });
      fetchTickets();
    } catch (err: any) {
      console.error(err);
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const filteredTickets = tickets.filter(t => 
    (t.subject?.toLowerCase().includes(searchQuery.toLowerCase())) || 
    (t.profiles?.full_name?.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (t.profiles?.email?.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="flex h-[calc(100vh-6rem)] gap-4 overflow-hidden">
      {/* Sidebar - Ticket List */}
      <Card className="w-1/3 flex flex-col bg-[#1E293B] border-[#334155] h-full overflow-hidden">
        <div className="p-4 border-b border-[#334155]">
          <h2 className="font-bold text-xl mb-4 flex items-center gap-2">
            <MessageCircle className="h-5 w-5" /> Support Tickets
          </h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search tickets..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-[#0F172A] border border-[#334155] rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {loading ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-20 w-full bg-[#334155]" />)}
            </div>
          ) : filteredTickets.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground flex flex-col items-center gap-2">
              <CheckCircle className="h-8 w-8 text-[#334155]" />
              <p>No tickets found</p>
            </div>
          ) : (
            <div className="flex flex-col">
              {filteredTickets.map(ticket => (
                <div
                  key={ticket.id}
                  onClick={() => setSelectedTicket(ticket)}
                  className={cn(
                    "p-4 border-b border-[#334155] cursor-pointer transition-colors hover:bg-[#334155]/50",
                    selectedTicket?.id === ticket.id && "bg-[#334155]/80 border-l-4 border-l-primary"
                  )}
                >
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-semibold text-sm truncate pr-2" title={ticket.subject}>
                      {ticket.subject}
                    </h3>
                    <Badge variant="outline" className={cn(
                      "text-xs whitespace-nowrap",
                      ticket.status === 'open' ? "bg-orange-500/20 text-orange-400 border-orange-500/30" :
                      ticket.status === 'resolved' ? "bg-green-500/20 text-green-400 border-green-500/30" :
                      "bg-blue-500/20 text-blue-400 border-blue-500/30"
                    )}>
                      {ticket.status}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center text-xs text-muted-foreground">
                    <div className="flex items-center gap-1 truncate">
                      <User className="h-3 w-3" />
                      <span className="truncate max-w-[120px]">{ticket.profiles?.full_name || ticket.profiles?.email || 'Unknown User'}</span>
                    </div>
                    <div className="flex items-center gap-1 whitespace-nowrap">
                      <Clock className="h-3 w-3" />
                      {formatDistanceToNow(new Date(ticket.updated_at), { addSuffix: true })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      {/* Main Area - Chat Window */}
      <Card className="flex-1 flex flex-col bg-[#1E293B] border-[#334155] h-full overflow-hidden">
        {selectedTicket ? (
          <>
            {/* Header */}
            <div className="p-4 border-b border-[#334155] flex justify-between items-center bg-[#0F172A]">
              <div>
                <h2 className="font-bold text-lg">{selectedTicket.subject}</h2>
                <p className="text-sm text-muted-foreground">
                  {selectedTicket.profiles?.full_name} ({selectedTicket.profiles?.email})
                </p>
              </div>
              {selectedTicket.status !== 'resolved' && (
                <Button onClick={handleMarkResolved} variant="outline" className="border-green-500/50 text-green-400 hover:bg-green-500/10">
                  <CheckCircle className="mr-2 h-4 w-4" /> Mark Resolved
                </Button>
              )}
            </div>
            
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-[#0F172A]/50">
              {messagesLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map(i => (
                    <div key={i} className={`flex ${i % 2 === 0 ? 'justify-end' : 'justify-start'}`}>
                      <Skeleton className="h-16 w-64 bg-[#334155] rounded-2xl" />
                    </div>
                  ))}
                </div>
              ) : messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
                  <MessageCircle className="h-10 w-10 mb-2 opacity-50" />
                  <p>No messages yet.</p>
                </div>
              ) : (
                messages.map((msg) => {
                  const isAdmin = msg.sender_type === 'admin';
                  return (
                    <div key={msg.id} className={`flex ${isAdmin ? 'justify-end' : 'justify-start'}`}>
                      <div className={`flex max-w-[75%] gap-3 ${isAdmin ? 'flex-row-reverse' : 'flex-row'}`}>
                        <Avatar className="h-8 w-8 shrink-0 mt-auto">
                          <AvatarFallback className={isAdmin ? 'bg-primary text-primary-foreground text-xs' : 'bg-muted text-muted-foreground text-xs'}>
                            {isAdmin ? 'AD' : (selectedTicket.profiles?.full_name?.[0] || 'U').toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className={`flex flex-col ${isAdmin ? 'items-end' : 'items-start'}`}>
                          <div className={cn(
                            "px-4 py-2 rounded-2xl",
                            isAdmin 
                              ? "bg-primary text-primary-foreground rounded-br-sm" 
                              : "bg-[#1E293B] border border-[#334155] text-foreground rounded-bl-sm"
                          )}>
                            <p className="whitespace-pre-wrap break-words text-sm">{msg.message}</p>
                          </div>
                          <span className="text-[10px] text-muted-foreground mt-1 mx-1">
                            {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Form */}
            {selectedTicket.status !== 'resolved' ? (
              <form onSubmit={handleSendReply} className="p-4 border-t border-[#334155] bg-[#0F172A] flex gap-2">
                <Input
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Type your reply here..."
                  className="flex-1 bg-[#1E293B] border-[#334155]"
                  disabled={sending}
                />
                <Button type="submit" disabled={sending || !replyText.trim()}>
                  <Send className="h-4 w-4 mr-2" />
                  {sending ? "Sending" : "Send"}
                </Button>
              </form>
            ) : (
              <div className="p-4 border-t border-[#334155] bg-[#0F172A]/50 text-center text-muted-foreground flex items-center justify-center gap-2 text-sm">
                <AlertCircle className="h-4 w-4" /> This ticket is resolved. Reopen it to send more messages.
              </div>
            )}
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
            <MessageCircle className="h-16 w-16 mb-4 opacity-20" />
            <h3 className="text-xl font-medium mb-1">No Ticket Selected</h3>
            <p className="text-sm">Select a ticket from the sidebar to view the conversation</p>
          </div>
        )}
      </Card>
    </div>
  );
}
