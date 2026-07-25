import { useState } from "react";
import { Mail, Send, MessageSquare, Clock, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";

const topics = [
  { value: "course", label: "Course Issue" },
  { value: "payment", label: "Payment Problem" },
  { value: "account", label: "Account Help" },
  { value: "refund", label: "Refund Request" },
  { value: "reseller", label: "Reseller Inquiry" },
  { value: "other", label: "Other" },
];

const Contact = () => {
  const { user, profile } = useAuth();
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const [name, setName] = useState(profile?.full_name || user?.user_metadata?.full_name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [topic, setTopic] = useState("");
  const [message, setMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !topic || !message.trim()) {
      toast({ title: "Missing fields", description: "Please fill in all required fields.", variant: "destructive" });
      return;
    }
    setLoading(true);
    // Simulate submission
    await new Promise((r) => setTimeout(r, 1000));
    setLoading(false);
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-20 text-center max-w-md">
          <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
          <h1 className="font-display font-bold text-2xl text-foreground mb-2">Message Sent!</h1>
          <p className="text-muted-foreground mb-6">
            Thank you for reaching out. Our support team will get back to you within 24-48 hours.
          </p>
          <Button onClick={() => { setSubmitted(false); setMessage(""); setTopic(""); }}>
            Send Another Message
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
                <a href="https://t.me/courseverse_support" target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">
                  @courseverse_support
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

          <Card className="border-border">
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
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Contact;
