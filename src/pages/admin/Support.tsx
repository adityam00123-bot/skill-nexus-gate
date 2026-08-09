import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageCircle, CheckCircle, Clock, Send, AlertCircle, Search, User, Paperclip, Image as ImageIcon, X, Reply, Camera, FileImage, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";

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
  sender_id?: string;
  message: string;
  created_at: string;
  attachment_url?: string | null;
  reply_to_id?: string | null;
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
  const [attachment, setAttachment] = useState<File | null>(null);
  const [replyingTo, setReplyingTo] = useState<SupportMessage | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);

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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const attachmentCount = messages.filter(m => m.attachment_url).length;
      if (attachmentCount >= 5) {
        toast({ title: "Limit reached", description: "Maximum 5 attachments allowed per support ticket.", variant: "destructive" });
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast({ title: "File too large", description: "File size must be less than 5MB.", variant: "destructive" });
        return;
      }
      const invalidTypes = ['application/x-msdownload', 'application/javascript', 'text/javascript', 'application/x-php', 'text/html', 'application/x-sh'];
      if (invalidTypes.includes(file.type) || file.name.match(/\.(exe|js|php|html|sh|bat)$/i)) {
        toast({ title: "Invalid file", description: "This file type is not allowed.", variant: "destructive" });
        return;
      }
      setAttachment(file);
    }
    e.target.value = '';
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!replyText.trim() && !attachment) || !selectedTicket) return;

    setSending(true);
    try {
      let attachment_url = null;

      if (attachment) {
        if (attachment.size > 5 * 1024 * 1024) {
          throw new Error("File size must be less than 5MB");
        }
        const fileExt = attachment.name.split('.').pop();
        const fileName = `${crypto.randomUUID()}.${fileExt}`;
        const filePath = `${selectedTicket.id}/${fileName}`;
        
        const { error: uploadError } = await supabase.storage
          .from('support_attachments')
          .upload(filePath, attachment);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('support_attachments')
          .getPublicUrl(filePath);

        attachment_url = publicUrl;
      }

      const { error } = await supabase
        .from("support_messages")
        .insert({
          ticket_id: selectedTicket.id,
          sender_type: 'admin',
          sender_id: user?.id,
          message: replyText.trim(),
          attachment_url,
          reply_to_id: replyingTo?.id || null
        });

      if (error) throw error;
      
      // Update the ticket's updated_at
      await supabase
        .from("support_tickets")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", selectedTicket.id);

      setReplyText("");
      setAttachment(null);
      setReplyingTo(null);
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
                  const repliedToMsg = msg.reply_to_id ? messages.find(m => m.id === msg.reply_to_id) : null;
                  return (
                    <div key={msg.id} id={`msg-${msg.id}`} className={`flex group ${isAdmin ? 'justify-end' : 'justify-start'}`}>
                      {isAdmin && (
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center pr-2">
                          <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full" onClick={() => setReplyingTo(msg)}>
                            <Reply className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        </div>
                      )}
                      <div className={`flex max-w-[75%] gap-3 ${isAdmin ? 'flex-row-reverse' : 'flex-row'}`}>
                        <Avatar className="h-8 w-8 shrink-0 mt-auto">
                          <AvatarFallback className={isAdmin ? 'bg-primary text-primary-foreground text-xs' : 'bg-muted text-muted-foreground text-xs'}>
                            {isAdmin ? 'AD' : (selectedTicket.profiles?.full_name?.[0] || 'U').toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className={`flex flex-col ${isAdmin ? 'items-end' : 'items-start'}`}>
                          <div className={cn(
                            "px-4 py-2 rounded-2xl flex flex-col",
                            isAdmin 
                              ? "bg-primary text-primary-foreground rounded-br-sm" 
                              : "bg-[#1E293B] border border-[#334155] text-foreground rounded-bl-sm"
                          )}>
                            {repliedToMsg && (
                              <div 
                                onClick={() => document.getElementById(`msg-${repliedToMsg.id}`)?.scrollIntoView({ behavior: 'smooth' })}
                                className="mb-2 p-2 rounded bg-black/10 hover:bg-black/20 cursor-pointer text-xs border-l-2 border-primary-foreground/50 transition-colors"
                              >
                                <div className="font-semibold opacity-80 mb-1">
                                  {repliedToMsg.sender_type === 'admin' ? 'Admin' : (selectedTicket.profiles?.full_name || 'User')}
                                </div>
                                <div className="opacity-90 line-clamp-1">
                                  {repliedToMsg.message || (repliedToMsg.attachment_url ? 'Attachment' : '')}
                                </div>
                              </div>
                            )}
                            {msg.attachment_url && (
                              <img 
                                src={msg.attachment_url} 
                                alt="Attachment" 
                                className="max-w-full rounded-lg mb-2"
                              />
                            )}
                            {msg.message && <p className="whitespace-pre-wrap break-words text-sm">{msg.message}</p>}
                          </div>
                          <span className="text-[10px] text-muted-foreground mt-1 mx-1">
                            {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                      {!isAdmin && (
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center pl-2">
                          <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full" onClick={() => setReplyingTo(msg)}>
                            <Reply className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Form */}
            {selectedTicket.status !== 'resolved' ? (
              <div className="p-4 border-t border-[#334155] bg-[#0F172A] flex flex-col gap-2 relative">
                {replyingTo && (
                  <div className="flex items-center justify-between p-2 mb-2 bg-[#1E293B] border-l-2 border-primary rounded-r text-sm">
                    <div className="flex flex-col">
                      <span className="font-semibold text-primary text-xs">
                        {replyingTo.sender_type === 'admin' ? 'Replying to Admin' : `Replying to ${selectedTicket.profiles?.full_name || 'User'}`}
                      </span>
                      <span className="text-muted-foreground truncate max-w-[300px]">
                        {replyingTo.message || (replyingTo.attachment_url ? 'Attachment' : '')}
                      </span>
                    </div>
                    <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => setReplyingTo(null)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}
                {attachment && (
                  <div className="relative w-20 h-20 mb-2">
                    <img 
                      src={URL.createObjectURL(attachment)} 
                      alt="Preview" 
                      className="w-full h-full object-cover rounded-md border border-[#334155]"
                    />
                    <button
                      type="button"
                      onClick={() => setAttachment(null)}
                      className="absolute -top-2 -right-2 bg-red-500 rounded-full p-1 text-white hover:bg-red-600"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                )}
                <form onSubmit={handleSendReply} className="flex gap-2">
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    ref={cameraInputRef}
                    onChange={handleFileSelect}
                  />
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    ref={galleryInputRef}
                    onChange={handleFileSelect}
                  />
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    className="hidden"
                    ref={documentInputRef}
                    onChange={handleFileSelect}
                  />
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button 
                        type="button" 
                        variant="outline" 
                        size="icon"
                        className="shrink-0 bg-[#1E293B] border-[#334155]"
                        onClick={(e) => {
                          const attachmentCount = messages.filter(m => m.attachment_url).length;
                          if (attachmentCount >= 5) {
                            e.preventDefault();
                            toast({ description: "Maximum 5 attachments allowed per support ticket.", variant: "destructive" });
                          }
                        }}
                      >
                        <Paperclip className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="bg-[#1E293B] border-[#334155]">
                      <DropdownMenuItem onClick={() => cameraInputRef.current?.click()} className="cursor-pointer gap-2">
                        <Camera className="h-4 w-4" /> Camera
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => galleryInputRef.current?.click()} className="cursor-pointer gap-2">
                        <FileImage className="h-4 w-4" /> Gallery
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => documentInputRef.current?.click()} className="cursor-pointer gap-2">
                        <FileText className="h-4 w-4" /> Files / Documents
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Input
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Type your reply here..."
                    className="flex-1 bg-[#1E293B] border-[#334155]"
                    disabled={sending}
                  />
                  <Button type="submit" disabled={sending || (!replyText.trim() && !attachment)}>
                    {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                    {sending ? "Sending" : "Send"}
                  </Button>
                </form>
              </div>
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
