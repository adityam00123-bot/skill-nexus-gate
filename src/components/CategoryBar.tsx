import { useState, useRef } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { CATEGORIES, SUBCATEGORY_MAP } from "@/utils/courseConstants";

const CategoryBar = () => {
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);
  const [arrowLeft, setArrowLeft] = useState(0);
  const barRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const catRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseEnter = (cat: string) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setHoveredCategory(cat);
    const el = catRefs.current[cat];
    const container = containerRef.current;
    if (el && container) {
      const elRect = el.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      setArrowLeft(elRect.left - containerRect.left + elRect.width / 2);
    }
  };

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => setHoveredCategory(null), 150);
  };

  const handleSubbarEnter = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  };

  const scroll = (dir: "left" | "right") => {
    barRef.current?.scrollBy({ left: dir === "left" ? -200 : 200, behavior: "smooth" });
  };

  const activeCat = CATEGORIES.find((c) => c === hoveredCategory);
  const activeSubcats = activeCat ? (SUBCATEGORY_MAP[activeCat] || []) : [];

  return (
    <div ref={containerRef} className="relative z-40" onMouseLeave={handleMouseLeave}>
      {/* Main category bar */}
      <div className="border-b border-border bg-card">
        <div className="max-w-[1200px] mx-auto px-6 relative">
          <button onClick={() => scroll("left")} className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-card/90 p-1 rounded-r border-r border-border text-muted-foreground hover:text-foreground lg:hidden">
            <ChevronLeft className="h-4 w-4" />
          </button>

          <div ref={barRef} className="flex items-center gap-0.5 overflow-x-auto scrollbar-hide py-2 px-6 lg:px-0 lg:justify-center">
            {CATEGORIES.map((cat) => (
              <div
                key={cat}
                ref={(el) => { catRefs.current[cat] = el; }}
                onMouseEnter={() => handleMouseEnter(cat)}
                className="relative"
              >
                <Link
                  to={`/courses?category=${encodeURIComponent(cat)}`}
                  className={`flex items-center px-3.5 py-2 text-sm font-medium rounded-md whitespace-nowrap transition-all duration-150 ${
                    hoveredCategory === cat
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  {cat}
                </Link>
              </div>
            ))}
          </div>

          <button onClick={() => scroll("right")} className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-card/90 p-1 rounded-l border-l border-border text-muted-foreground hover:text-foreground lg:hidden">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Overlay: arrow + subcategory bar */}
      {activeCat && activeSubcats.length > 0 && (
        <div className="absolute top-full left-0 w-full z-50" onMouseEnter={handleSubbarEnter}>
          {/* Triangle arrow */}
          <div
            className="absolute -top-[8px]"
            style={{ left: `${arrowLeft}px`, transform: "translateX(-50%)" }}
          >
            <div
              className="w-0 h-0"
              style={{
                borderLeft: "8px solid transparent",
                borderRight: "8px solid transparent",
                borderBottom: "8px solid hsl(222 47% 11%)",
              }}
            />
          </div>

          {/* Subcategory bar */}
          <div
            className="animate-fade-in"
            style={{ background: "hsl(222 47% 11%)", height: "48px" }}
          >
            <div className="max-w-[1200px] mx-auto px-6 h-full flex items-center justify-center gap-6 overflow-x-auto scrollbar-hide">
              {activeSubcats.map((sub) => (
                <Link
                  key={sub}
                  to={`/courses?category=${encodeURIComponent(activeCat)}&subcategory=${encodeURIComponent(sub)}`}
                  className="text-sm whitespace-nowrap font-medium transition-colors duration-150 py-1"
                  style={{ color: "hsl(215 20% 65%)" }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "#fff")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "hsl(215 20% 65%)")}
                >
                  {sub}
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CategoryBar;
