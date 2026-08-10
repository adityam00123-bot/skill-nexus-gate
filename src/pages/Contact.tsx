import { useState, useEffect, useRef } from "react";
import { Mail, Send, MessageSquare, Clock, CheckCircle2, ChevronRight, User as UserIcon, ShieldAlert, Paperclip, Image as ImageIcon, X, Reply, Camera, FileImage, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import CameraCapture from "@/components/CameraCapture";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const topics = [
  { value: "course", label: "Course Issue" },
  { value: "payment", label: "Payment Problem" },
  { value: "account", label: "Account Help" },
  { value: "refund", label: "Refund Request" },
  { value: "reseller", label: "Reseller Inquiry" },
  { value: "other", label: "Other" },
];

export default function Contact() {
  const { user, profile } = useAuth();
  
  // Form State
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState(profile?.full_name || user?.user_metadata?.full_name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [topic, setTopic] = useState("");
  const [message, setMessage] = useState("");

  // Tickets State
  const [tickets, setTickets] = useState<any[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [replyMessage, setReplyMessage] = useState("");
  const [replyLoading, setReplyLoading] = useState(false);
  const [attachment, setAttachment] = useState<File | null>(null);
  const [replyingTo, setReplyingTo] = useState<any | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (profile?.full_name) setName(profile.full_name);
    if (user?.email) setEmail(user.email);
  }, [profile, user]);

  useEffect(() => {
    if (!user) return;
    const fetchTickets = async () => {
      const { data } = await supabase
        .from('support_tickets')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });
      if (data) setTickets(data);
    };
    fetchTickets();
  }, [user, submitted]);

  useEffect(() => {
    if (!selectedTicket || !user) return;
    
    const fetchMessages = async () => {
      const { data } = await supabase
        .from('support_messages')
        .select('*')
        .eq('ticket_id', selectedTicket.id)
        .order('created_at', { ascending: true });
      if (data) setMessages(data);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    };
    fetchMessages();

    const subscription = supabase
      .channel(`public:support_messages:ticket_id=eq.${selectedTicket.id}`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'support_messages',
        filter: `ticket_id=eq.${selectedTicket.id}`
      }, (payload) => {
        setMessages((prev) => {
          if (prev.some(m => m.id === payload.new.id)) return prev;
          return [...prev, payload.new];
        });
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [selectedTicket, user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !topic || !message.trim()) {
      toast({ title: "Missing fields", description: "Please fill in all required fields.", variant: "destructive" });
      return;
    }
    
    setLoading(true);
    try {
      if (user) {
        // Logged in user: create real support ticket
        const { data: ticket, error: ticketError } = await supabase
          .from('support_tickets')
          .insert({ user_id: user.id, topic: topics.find(t => t.value === topic)?.label || topic })
          .select()
          .single();
          
        if (ticketError) throw ticketError;
        
        const { error: msgError } = await supabase
          .from('support_messages')
          .insert({
            ticket_id: ticket.id,
            sender_type: 'user',
            sender_id: user.id,
            message: message
          });
          
        if (msgError) throw msgError;
      } else {
        // Guest user: Just simulate
        await new Promise((r) => setTimeout(r, 1000));
      }
      setSubmitted(true);
    } catch (error: any) {
      toast({ title: "Error submitting ticket", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!replyMessage.trim() && !attachment) || !selectedTicket || !user) return;
    
    setReplyLoading(true);
    try {
      let attachment_url = null;
      if (attachment) {
        if (attachment.size > 5 * 1024 * 1024) {
          throw new Error("File size must be less than 5MB");
        }
        const invalidTypes = ['.exe', '.js', '.php', '.html', '.bat', '.sh'];
        const fileNameOriginal = attachment.name.toLowerCase();
        if (invalidTypes.some(ext => fileNameOriginal.endsWith(ext))) {
          throw new Error("Invalid file type");
        }
        const fileExt = attachment.name.split('.').pop();
        const fileName = `${crypto.randomUUID()}.${fileExt}`;
        const filePath = `${selectedTicket.id}/${fileName}`;
        const { error: uploadError } = await supabase.storage.from('support_attachments').upload(filePath, attachment);
        if (uploadError) throw uploadError;
        const { data: { publicUrl } } = supabase.storage.from('support_attachments').getPublicUrl(filePath);
        attachment_url = publicUrl;
      }

      const { error } = await supabase
        .from('support_messages')
        .insert({
          ticket_id: selectedTicket.id,
          sender_type: 'user',
          sender_id: user.id,
          message: replyMessage,
          attachment_url,
          reply_to_id: replyingTo?.id || null
        });
      if (error) throw error;
      setReplyMessage("");
      setAttachment(null);
      setReplyingTo(null);
    } catch (error: any) {
      toast({ title: "Failed to send reply", description: error.message, variant: "destructive" });
    } finally {
      setReplyLoading(false);
    }
  };

  const formatRelativeTime = (dateStr: string) => {
    const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
    const diff = new Date().getTime() - new Date(dateStr).getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor(diff / (1000 * 60));
    
    if (days > 0) return rtf.format(-days, 'day');
    if (hours > 0) return rtf.format(-hours, 'hour');
    if (minutes > 0) return rtf.format(-minutes, 'minute');
    return 'just now';
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-20 text-center max-w-md">
          <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
          <h1 className="font-display font-bold text-2xl text-foreground mb-2">Message Sent!</h1>
          <p className="text-muted-foreground mb-6">
            Thank you for reaching out. Our support team will get back to you soon.
          </p>
          <Button onClick={() => { setSubmitted(false); setMessage(""); setTopic(""); }}>
            Back to Support
          </Button>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Hero */}
      <section className="bg-gradient-to-br from-primary/10 via-background to-accent/10 py-16 md:py-20">
        <div className="container mx-auto px-4 text-center max-w-2xl">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Mail className="h-7 w-7 text-primary" />
          </div>
          <h1 className="font-display font-bold text-3xl md:text-4xl text-foreground mb-3">Contact Us</h1>
          <p className="text-muted-foreground">Have a question or need help? We're here for you.</p>
        </div>
      </section>

      <section className="py-12 md:py-16">
        <div className="container mx-auto px-4 max-w-2xl">
          <div className="grid md:grid-cols-3 gap-6 mb-10">
            <Card className="border-border">
              <CardContent className="p-5 text-center">
                <MessageSquare className="h-6 w-6 text-primary mx-auto mb-2" />
                <p className="text-sm font-medium text-foreground">Telegram Support</p>
                <a href="https://t.me/courseversesupport" target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">
                  @courseversesupport
                </a>
              </CardContent>
            </Card>
            <Card className="border-border">
              <CardContent className="p-5 text-center">
                <Mail className="h-6 w-6 text-primary mx-auto mb-2" />
                <p className="text-sm font-medium text-foreground">Email Us</p>
                <p className="text-xs text-muted-foreground">courseversehere@gmail.com</p>
              </CardContent>
            </Card>
            <Card className="border-border">
              <CardContent className="p-5 text-center">
                <Clock className="h-6 w-6 text-primary mx-auto mb-2" />
                <p className="text-sm font-medium text-foreground">Response Time</p>
                <p className="text-xs text-muted-foreground">Within 24-48 hours</p>
              </CardContent>
            </Card>
          </div>

          <Card className="border-border mb-12">
            <CardContent className="p-6 md:p-8">
              <h2 className="font-display font-semibold text-lg text-foreground mb-6">Send us a message</h2>
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="name">Full Name *</Label>
                    <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" maxLength={100} required />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="email">Email *</Label>
                    <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="your@email.com" maxLength={255} required />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Topic *</Label>
                  <Select value={topic} onValueChange={setTopic}>
                    <SelectTrigger><SelectValue placeholder="Select a topic" /></SelectTrigger>
                    <SelectContent>
                      {topics.map((t) => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="message">Message *</Label>
                  <Textarea id="message" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Describe your issue or question..." rows={5} maxLength={2000} required />
                </div>
                <Button type="submit" disabled={loading} className="w-full gap-2">
                  {loading ? "Sending..." : <><Send className="h-4 w-4" /> Send Message</>}
                </Button>
              </form>
            </CardContent>
          </Card>
          
          {/* User Tickets Section */}
          {user && (
            <div className="space-y-6">
              <h2 className="font-display font-bold text-2xl text-foreground mb-4">Your Queries</h2>
              
              {!selectedTicket ? (
                <div className="space-y-3">
                  {tickets.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground bg-muted/20 rounded-xl border border-dashed border-border">
                      <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-20" />
                      <p>You haven't submitted any queries yet.</p>
                      <p className="text-sm mt-1">Use the form above to send us a message.</p>
                    </div>
                  ) : (
                    tickets.map(ticket => (
                      <Card key={ticket.id} className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setSelectedTicket(ticket)}>
                        <CardContent className="p-4 flex items-center justify-between">
                          <div>
                            <div className="flex items-center gap-3 mb-1">
                              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${ticket.status === 'resolved' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                                {ticket.status.toUpperCase()}
                              </span>
                              <h3 className="font-semibold text-foreground">{ticket.topic}</h3>
                            </div>
                            <p className="text-xs text-muted-foreground">Updated {formatRelativeTime(ticket.updated_at)}</p>
                          </div>
                          <ChevronRight className="h-5 w-5 text-muted-foreground" />
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              ) : (
                <Card className="flex flex-col h-[500px] border-border overflow-hidden">
                  <div className="p-4 border-b border-border bg-muted/30 flex items-center justify-between shrink-0">
                    <div>
                      <h3 className="font-semibold text-foreground flex items-center gap-2">
                        {selectedTicket.topic}
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${selectedTicket.status === 'resolved' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                          {selectedTicket.status.toUpperCase()}
                        </span>
                      </h3>
                      <p className="text-xs text-muted-foreground">Ticket #{selectedTicket.id.slice(0,8)}</p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setSelectedTicket(null)}>
                      Back to List
                    </Button>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {messages.map((msg: any) => {
                      const isUser = msg.sender_type === 'user';
                      const replyToMsg = msg.reply_to_id ? messages.find(m => m.id === msg.reply_to_id) : null;
                      return (
                        <div key={msg.id} id={`msg-${msg.id}`} className={`flex gap-3 group ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
                          <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${isUser ? 'bg-primary text-primary-foreground' : 'bg-accent text-accent-foreground'}`}>
                            {isUser ? <UserIcon className="h-4 w-4" /> : <ShieldAlert className="h-4 w-4" />}
                          </div>
                          <div className="flex items-center gap-2 max-w-[75%]">
                            {isUser && (
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 shrink-0"
                                onClick={() => setReplyingTo(msg)}
                              >
                                <Reply className="h-4 w-4" />
                              </Button>
                            )}
                            <div className={`w-full rounded-2xl p-3 text-sm ${isUser ? 'bg-primary text-primary-foreground rounded-tr-sm' : 'bg-muted text-foreground rounded-tl-sm'}`}>
                              {replyToMsg && (
                                <div 
                                  className="mb-2 p-2 rounded bg-black/10 cursor-pointer hover:bg-black/20 transition-colors text-xs border-l-2 border-primary"
                                  onClick={() => document.getElementById(`msg-${msg.reply_to_id}`)?.scrollIntoView({ behavior: 'smooth' })}
                                >
                                  <p className="font-semibold">{replyToMsg.sender_type === 'user' ? 'You' : 'Admin'}</p>
                                  <p className="line-clamp-1 opacity-80">{replyToMsg.message || "Attachment"}</p>
                                </div>
                              )}
                              {msg.attachment_url && (
                                <div className="mb-2 rounded-lg overflow-hidden border border-white/20">
                                  <a href={msg.attachment_url} target="_blank" rel="noopener noreferrer">
                                    <img src={msg.attachment_url} alt="Attachment" className="max-h-60 w-auto object-cover hover:opacity-90 transition-opacity" />
                                  </a>
                                </div>
                              )}
                              {msg.message && <p className="whitespace-pre-wrap">{msg.message}</p>}
                              <p className={`text-[10px] mt-1 text-right ${isUser ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                                {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </p>
                            </div>
                            {!isUser && (
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 shrink-0"
                                onClick={() => setReplyingTo(msg)}
                              >
                                <Reply className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </div>
                  
                  {selectedTicket.status === 'open' ? (
                    <div className="p-3 border-t border-border bg-background shrink-0 flex flex-col gap-2">
                      {replyingTo && (
                        <div className="flex items-center justify-between p-2 bg-muted/50 rounded-lg border-l-4 border-primary text-sm mb-2">
                          <div className="flex flex-col overflow-hidden">
                            <span className="font-semibold text-primary text-xs">
                              Replying to {replyingTo.sender_type === 'user' ? 'You' : 'Admin'}
                            </span>
                            <span className="text-muted-foreground truncate">
                              {replyingTo.message || "Attachment"}
                            </span>
                          </div>
                          <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => setReplyingTo(null)}>
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                      {attachment && (
                        <div className="relative inline-block w-fit">
                          {attachment.type.startsWith('image/') ? (
                            <img src={URL.createObjectURL(attachment)} alt="Preview" className="h-20 w-auto rounded border border-border object-cover" />
                          ) : (
                            <div className="h-20 w-20 flex items-center justify-center rounded border border-border bg-muted">
                              <FileText className="h-8 w-8 text-muted-foreground" />
                            </div>
                          )}
                          <button 
                            type="button" 
                            onClick={() => setAttachment(null)} 
                            className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-0.5 hover:bg-destructive/90"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      )}
                      <form onSubmit={handleReply} className="flex gap-2 items-end">
                        <Input 
                          value={replyMessage}
                          onChange={(e) => setReplyMessage(e.target.value)}
                          placeholder="Type your reply..."
                          className="flex-1"
                          disabled={replyLoading}
                        />
                        <input

                          type="file"
                          accept="image/*"
                          className="hidden"
                          ref={galleryInputRef}
                          onChange={(e) => {
                            if (e.target.files && e.target.files[0]) setAttachment(e.target.files[0]);
                          }}
                        />
                        <input
                          type="file"
                          accept="image/*,application/pdf"
                          className="hidden"
                          ref={documentInputRef}
                          onChange={(e) => {
                            if (e.target.files && e.target.files[0]) setAttachment(e.target.files[0]);
                          }}
                        />
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button 
                              type="button" 
                              variant="outline" 
                              size="icon"
                              disabled={replyLoading || messages.filter(m => m.attachment_url).length >= 5}
                              onClick={(e) => {
                                if (messages.filter(m => m.attachment_url).length >= 5) {
                                  e.preventDefault();
                                  toast({ title: "Attachment limit reached", description: "Maximum 5 attachments allowed per support ticket." });
                                }
                              }}
                            >
                              <Paperclip className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setIsCameraOpen(true)}>
                              <Camera className="mr-2 h-4 w-4" />
                              <span>Camera</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => galleryInputRef.current?.click()}>
                              <FileImage className="mr-2 h-4 w-4" />
                              <span>Gallery</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => documentInputRef.current?.click()}>
                              <FileText className="mr-2 h-4 w-4" />
                              <span>Files / Documents</span>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                        <Button type="submit" size="icon" disabled={replyLoading || (!replyMessage.trim() && !attachment)}>
                          {replyLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                        </Button>
                      </form>
                      
                      <CameraCapture 
                        isOpen={isCameraOpen} 
                        onClose={() => setIsCameraOpen(false)} 
                        onCapture={(file) => setAttachment(file)} 
                      />
                    </div>
                  ) : (
                    <div className="p-3 border-t border-border bg-muted/30 text-center shrink-0">
                      <p className="text-sm text-muted-foreground">This ticket has been marked as resolved.</p>
                    </div>
                  )}
                </Card>
              )}
            </div>
          )}
        </div>
      </section>

      <Footer />
    </div>
  );
}
