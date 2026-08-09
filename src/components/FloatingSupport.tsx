import { useState, useRef } from "react";
import { MessageCircle, Send, HelpCircle, Mail } from "lucide-react";
import { Link } from "react-router-dom";

const menuItems = [
  {
    icon: Send,
    label: "Telegram Support",
    href: "https://t.me/courseversesupport",
    external: true,
  },
  {
    icon: HelpCircle,
    label: "Help Center",
    to: "/help",
    external: false,
  },
  {
    icon: Mail,
    label: "Email Support",
    to: "/contact",
    external: false,
  },
];

const FloatingSupport = () => {
  const [hovered, setHovered] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleEnter = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setHovered(true);
  };

  const handleLeave = () => {
    timeoutRef.current = setTimeout(() => setHovered(false), 250);
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end pointer-events-none">
      {/* Menu */}
      <div
        className={`mb-3 w-52 rounded-2xl bg-card border border-border overflow-hidden transition-all duration-300 ease-out origin-bottom-right ${
          hovered
            ? "opacity-100 translate-y-0 scale-100"
            : "opacity-0 translate-y-3 scale-95"
        }`}
        style={{
          boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
          pointerEvents: hovered ? "auto" : "none",
        }}
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
      >
        <div className="px-4 py-3 border-b border-border">
          <p className="text-sm font-semibold text-foreground">Need Help?</p>
          <p className="text-xs text-muted-foreground">Choose an option</p>
        </div>
        <div className="py-1.5">
          {menuItems.map((item) => {
            const content = (
              <div className="flex items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-muted transition-colors cursor-pointer">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <item.icon className="h-4 w-4 text-primary" />
                </div>
                <span className="font-medium">{item.label}</span>
              </div>
            );

            return item.external ? (
              <a
                key={item.label}
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
              >
                {content}
              </a>
            ) : (
              <Link key={item.label} to={item.to!}>
                {content}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Button */}
      <button
        className="h-14 w-14 rounded-full bg-primary flex items-center justify-center cursor-pointer transition-transform duration-200 hover:scale-105 focus:outline-none pointer-events-auto"
        style={{ boxShadow: "0 8px 20px rgba(0,0,0,0.15)" }}
        aria-label="Contact support"
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
      >
        <MessageCircle className="h-6 w-6 text-primary-foreground" />
      </button>
    </div>
  );
};

export default FloatingSupport;
