import { useState, useEffect, useCallback, useRef } from "react";
import { ChevronLeft, ChevronRight, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const slides = [
  {
    title: "Welcome to CourseVerse",
    subtitle: "Explore Our Courses",
    description: "Master trading, investing, and business with expert-led courses.",
    cta: "Explore Courses",
    ctaLink: "/courses",
    gradient: "from-primary/20 via-accent/10 to-transparent",
  },
  {
    title: "Premium Membership",
    subtitle: "Unlock All Courses",
    description: "Get unlimited access to every course with our subscription plans.",
    cta: "View Plans",
    ctaLink: "/subscribe",
    gradient: "from-accent/20 via-primary/10 to-transparent",
  },
  {
    title: "Free Learning",
    subtitle: "Access Free Resources",
    description: "Explore free trading courses, tools and resources.",
    cta: "Explore Free Resources",
    ctaLink: "/free-learning",
    gradient: "from-success/20 via-accent/10 to-transparent",
  },
  {
    title: "Course Bundles",
    subtitle: "Save More, Learn More",
    description: "Bundle your favourite courses together and save up to 60%.",
    cta: "Browse Bundles",
    ctaLink: "/courses",
    gradient: "from-info/20 via-primary/10 to-transparent",
  },
  {
    title: "CV Business",
    subtitle: "Become a Reseller",
    description: "Join our reseller program and earn by selling courses to your network.",
    cta: "Learn More",
    ctaLink: "/cv-business",
    gradient: "from-warning/20 via-accent/10 to-transparent",
  },
];

const DRAG_THRESHOLD = 80;

const HeroSlider = () => {
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const [isGrabbing, setIsGrabbing] = useState(false);
  const [isSnapping, setIsSnapping] = useState(false);
  const dragStartX = useRef<number | null>(null);

  const next = useCallback(() => setCurrent((c) => (c + 1) % slides.length), []);
  const prev = useCallback(() => setCurrent((c) => (c - 1 + slides.length) % slides.length), []);

  useEffect(() => {
    if (paused) return;
    const timer = setInterval(next, 5000);
    return () => clearInterval(timer);
  }, [next, paused]);

  const handlePointerDown = (clientX: number) => {
    dragStartX.current = clientX;
    setIsGrabbing(true);
    setIsSnapping(false);
    setDragOffset(0);
  };

  const handlePointerMove = (clientX: number) => {
    if (dragStartX.current === null) return;
    setDragOffset(clientX - dragStartX.current);
  };

  const finishDrag = () => {
    if (dragStartX.current === null) return;
    setIsSnapping(true);
    if (Math.abs(dragOffset) > DRAG_THRESHOLD) {
      dragOffset < 0 ? next() : prev();
    }
    setDragOffset(0);
    dragStartX.current = null;
    setIsGrabbing(false);
    setTimeout(() => setIsSnapping(false), 350);
  };

  const handleMouseMove = (e: React.MouseEvent) => handlePointerMove(e.clientX);
  const handleTouchMove = (e: React.TouchEvent) => handlePointerMove(e.touches[0].clientX);

  const slide = slides[current];

  return (
    <section
      className={`relative overflow-hidden bg-hero-gradient mt-6 select-none ${isGrabbing ? "cursor-grabbing" : "cursor-grab"}`}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => { setPaused(false); finishDrag(); }}
      onMouseDown={(e) => { e.preventDefault(); handlePointerDown(e.clientX); }}
      onMouseMove={handleMouseMove}
      onMouseUp={finishDrag}
      onTouchStart={(e) => handlePointerDown(e.touches[0].clientX)}
      onTouchMove={handleTouchMove}
      onTouchEnd={finishDrag}
    >
      <div className={`absolute inset-0 bg-gradient-to-r ${slide.gradient} transition-all duration-700`} />
      <div
        className="container mx-auto px-4 py-16 md:py-24 relative"
        style={{
          transform: `translateX(${dragOffset}px)`,
          transition: isSnapping ? "transform 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94)" : isGrabbing ? "none" : undefined,
        }}
      >
        <div className="max-w-3xl mx-auto text-center space-y-5 animate-fade-up" key={current}>
          <p className="text-sm font-semibold text-primary uppercase tracking-widest">{slide.subtitle}</p>
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-display font-bold tracking-tight text-foreground">
            {slide.title}
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
            {slide.description}
          </p>
          <div className="pt-4">
            <Link to={slide.ctaLink}>
              <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold px-8 shadow-glow">
                {slide.cta} <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>

        {/* Dots */}
        <div className="flex justify-center gap-2 mt-10">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={`w-2.5 h-2.5 rounded-full transition-all ${i === current ? "bg-primary w-8" : "bg-muted-foreground/30 hover:bg-muted-foreground/50"}`}
            />
          ))}
        </div>
      </div>

      {/* Arrows */}
      <button onClick={prev} className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-card/80 border border-border text-foreground hover:bg-card transition-colors">
        <ChevronLeft className="h-5 w-5" />
      </button>
      <button onClick={next} className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-card/80 border border-border text-foreground hover:bg-card transition-colors">
        <ChevronRight className="h-5 w-5" />
      </button>
    </section>
  );
};

export default HeroSlider;
