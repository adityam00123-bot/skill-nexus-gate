import { BookOpen, Download, Wrench, Play, Crown, ArrowRight, FileText, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Navbar from "@/components/Navbar";
import CategoryBar from "@/components/CategoryBar";
import Footer from "@/components/Footer";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

const freeCourses = [
  { title: "Trading Basics", desc: "Learn the fundamentals of stock market trading from scratch.", level: "Beginner", lessons: 8 },
  { title: "Introduction to Price Action", desc: "Understand price movements and chart reading without indicators.", level: "Beginner", lessons: 6 },
  { title: "Crypto Trading Starter", desc: "Get started with cryptocurrency trading and blockchain basics.", level: "Beginner", lessons: 10 },
  { title: "Risk Management Fundamentals", desc: "Master position sizing, stop losses, and capital preservation.", level: "Beginner", lessons: 5 },
];

const freePDFs = [
  { title: "Candlestick Cheat Sheet", desc: "All major candlestick patterns in one reference sheet.", pages: 12 },
  { title: "Options Strategy Guide", desc: "Complete guide to popular options trading strategies.", pages: 28 },
  { title: "Trading Psychology Guide", desc: "Control emotions and develop a winning trader mindset.", pages: 18 },
];

const tools = [
  { title: "Trading Journal Template", desc: "Track every trade with this structured journal template.", icon: FileText },
  { title: "Risk Calculator", desc: "Calculate position size and risk per trade instantly.", icon: Wrench },
  { title: "Trading Checklist", desc: "Pre-trade checklist to ensure disciplined entries.", icon: CheckCircle2 },
];

const freeVideos = [
  { title: "How Options Trading Works", desc: "A beginner-friendly breakdown of options contracts and strategies.", duration: "12 min" },
  { title: "Understanding Support and Resistance", desc: "Learn to identify key price levels on any chart.", duration: "9 min" },
];

const FreeLearning = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const handleDownload = (title: string) => {
    if (!user) {
      toast({ title: "Please log in to download resources", variant: "destructive" });
      navigate("/login");
      return;
    }
    toast({ title: `Downloading "${title}"...` });
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <CategoryBar />

      <div className="container mx-auto px-4 py-12 space-y-16">
        {/* Header */}
        <div className="text-center">
          <BookOpen className="h-12 w-12 text-primary mx-auto mb-4" />
          <h1 className="font-display font-bold text-3xl md:text-5xl text-foreground mb-3">Free Learning</h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">Learn trading and digital skills for free.</p>
        </div>

        {/* Section 1: Free Courses */}
        <section>
          <div className="flex items-center gap-3 mb-6">
            <BookOpen className="h-6 w-6 text-primary" />
            <h2 className="font-display font-bold text-2xl text-foreground">Free Courses</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {freeCourses.map((course) => (
              <div key={course.title} className="bg-card border border-border rounded-xl p-5 flex flex-col justify-between space-y-4 hover:shadow-lg transition-shadow">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">{course.level}</Badge>
                    <span className="text-xs text-muted-foreground">{course.lessons} lessons</span>
                  </div>
                  <h3 className="font-semibold text-foreground">{course.title}</h3>
                  <p className="text-sm text-muted-foreground">{course.desc}</p>
                </div>
                <Button className="w-full font-semibold gap-2">
                  <Play className="h-4 w-4" /> Start Learning
                </Button>
              </div>
            ))}
          </div>
        </section>

        {/* Section 2: Free PDFs */}
        <section>
          <div className="flex items-center gap-3 mb-6">
            <Download className="h-6 w-6 text-primary" />
            <h2 className="font-display font-bold text-2xl text-foreground">Free PDFs</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {freePDFs.map((pdf) => (
              <div key={pdf.title} className="bg-card border border-border rounded-xl p-5 flex flex-col justify-between space-y-4 hover:shadow-lg transition-shadow">
                <div className="space-y-2">
                  <FileText className="h-8 w-8 text-primary" />
                  <h3 className="font-semibold text-foreground">{pdf.title}</h3>
                  <p className="text-sm text-muted-foreground">{pdf.desc}</p>
                  <p className="text-xs text-muted-foreground">{pdf.pages} pages</p>
                </div>
                <Button variant="outline" className="w-full font-semibold gap-2" onClick={() => handleDownload(pdf.title)}>
                  <Download className="h-4 w-4" /> Download PDF
                </Button>
              </div>
            ))}
          </div>
        </section>

        {/* Section 3: Tools and Resources */}
        <section>
          <div className="flex items-center gap-3 mb-6">
            <Wrench className="h-6 w-6 text-primary" />
            <h2 className="font-display font-bold text-2xl text-foreground">Tools & Resources</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {tools.map((tool) => {
              const Icon = tool.icon;
              return (
                <div key={tool.title} className="bg-card border border-border rounded-xl p-5 space-y-3 hover:shadow-lg transition-shadow">
                  <Icon className="h-8 w-8 text-primary" />
                  <h3 className="font-semibold text-foreground">{tool.title}</h3>
                  <p className="text-sm text-muted-foreground">{tool.desc}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* Section 4: Free Videos */}
        <section>
          <div className="flex items-center gap-3 mb-6">
            <Play className="h-6 w-6 text-primary" />
            <h2 className="font-display font-bold text-2xl text-foreground">Free Videos</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {freeVideos.map((video) => (
              <div key={video.title} className="bg-card border border-border rounded-xl overflow-hidden hover:shadow-lg transition-shadow">
                <div className="aspect-video bg-muted flex items-center justify-center">
                  <Play className="h-12 w-12 text-muted-foreground" />
                </div>
                <div className="p-5 space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-foreground">{video.title}</h3>
                    <span className="text-xs text-muted-foreground">{video.duration}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{video.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* CTA Section */}
        <section className="bg-primary/10 border border-primary/20 rounded-2xl p-8 md:p-12 text-center space-y-4">
          <Crown className="h-10 w-10 text-primary mx-auto" />
          <h2 className="font-display font-bold text-2xl md:text-3xl text-foreground">Unlock premium courses with CourseVerse Premium</h2>
          <p className="text-muted-foreground max-w-xl mx-auto">Get unlimited access to expert-led courses, tools, and exclusive content.</p>
          <Button size="lg" className="font-semibold gap-2" onClick={() => navigate("/subscribe")}>
            Explore Premium <ArrowRight className="h-4 w-4" />
          </Button>
        </section>
      </div>

      <Footer />
    </div>
  );
};

export default FreeLearning;
