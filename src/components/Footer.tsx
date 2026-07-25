import { Link } from "react-router-dom";

const Footer = () => (
  <footer className="border-t border-border bg-card mt-20">
    <div className="container mx-auto px-4 py-12">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
        <div>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-display font-bold text-sm">CV</span>
            </div>
            <span className="font-display font-bold text-lg text-foreground">CourseVerse</span>
          </div>
          <p className="text-sm text-muted-foreground">Premium courses for trading, investing, and business mastery. Delivered via Telegram.</p>
          <div className="flex gap-3 mt-4">
            <a href="https://t.me/courseverse" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors text-sm">Telegram</a>
            <a href="https://youtube.com/@courseverse" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors text-sm">YouTube</a>
            <a href="https://instagram.com/courseverse" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors text-sm">Instagram</a>
          </div>
        </div>
        <div>
          <h4 className="font-display font-semibold text-foreground mb-3">Explore</h4>
          <div className="flex flex-col gap-2 text-sm text-muted-foreground">
            <Link to="/courses" className="hover:text-primary transition-colors">All Courses</Link>
            <Link to="/free-learning" className="hover:text-primary transition-colors">Free Learning</Link>
            <Link to="/subscribe" className="hover:text-primary transition-colors">Premium Subscription</Link>
            <Link to="/cv-business" className="hover:text-primary transition-colors">CV Business</Link>
            <Link to="/exchange" className="hover:text-primary transition-colors">Exchange Courses</Link>
          </div>
        </div>
        <div>
          <h4 className="font-display font-semibold text-foreground mb-3">Company</h4>
          <div className="flex flex-col gap-2 text-sm text-muted-foreground">
            <Link to="/contact" className="hover:text-primary transition-colors">Contact Us</Link>
            <Link to="/privacy" className="hover:text-primary transition-colors">Privacy Policy</Link>
            <Link to="/terms" className="hover:text-primary transition-colors">Terms and Conditions</Link>
            <Link to="/refund-policy" className="hover:text-primary transition-colors">Refund Policy</Link>
            <Link to="/wallet-terms" className="hover:text-primary transition-colors">Wallet Terms</Link>
          </div>
        </div>
        <div>
          <h4 className="font-display font-semibold text-foreground mb-3">Support</h4>
          <div className="flex flex-col gap-2 text-sm text-muted-foreground">
            <Link to="/help" className="hover:text-primary transition-colors">Help & Support</Link>
            <Link to="/help" className="hover:text-primary transition-colors">FAQ</Link>
            <Link to="/refund-policy" className="hover:text-primary transition-colors">Refund Policy</Link>
          </div>
        </div>
      </div>
      <div className="border-t border-border mt-8 pt-8 text-center text-sm text-muted-foreground">
        © 2026 CourseVerse. All rights reserved.
      </div>
    </div>
  </footer>
);

export default Footer;
