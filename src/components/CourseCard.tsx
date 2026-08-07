import { Link, useNavigate } from "react-router-dom";
import { Star, Users, Clock, ShoppingCart, Heart, CheckCircle, Crown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useWishlistContext } from "@/contexts/WishlistContext";
import { useCartContext } from "@/contexts/CartContext";
import { usePurchaseContext } from "@/contexts/PurchaseContext";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { useAuth } from "@/contexts/AuthContext";
import type { Course } from "@/data/courses";

const CourseCard = ({ course }: { course: Course }) => {
  const navigate = useNavigate();
  const { isWishlisted, toggleWishlist } = useWishlistContext();
  const { isInCart, addToCart } = useCartContext();
  const { isPurchased } = usePurchaseContext();
  const { isSubscribed } = useSubscription();
  const { loading } = useAuth();
  
  const price = course.price || 0;
  const originalPrice = course.originalPrice || price;
  const discount = originalPrice > 0 ? Math.round((1 - price / originalPrice) * 100) : 0;
  // Don't show "View Course" / purchased state while the auth block-check is still resolving
  // This prevents a flash of "View Course" for blocked users on the public homepage
  const hasAccess = !loading && (isPurchased(course.id) || isSubscribed);

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    addToCart(course.id);
  };

  return (
    <div className="rounded-xl overflow-hidden bg-card border border-border hover:border-primary/50 transition-all duration-300 shadow-card hover:shadow-glow hover:-translate-y-1 flex flex-col group">
      <Link to={`/course/${course.id}`} className="block">
        <div className="relative aspect-video overflow-hidden">
          <img
            src={course.thumbnail}
            alt={course.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
          />
          <div className="absolute top-3 left-3 flex flex-col gap-1.5">
            {originalPrice > price && (
              <Badge className="bg-[#16a34a] text-white border-none text-[10px] font-bold px-2 py-0.5 rounded-full">
                {discount}% OFF
              </Badge>
            )}
            {!loading && isPurchased(course.id) ? (
              <Badge className="bg-primary text-primary-foreground text-[10px] font-semibold gap-1 px-2 py-0.5">
                <CheckCircle className="h-3 w-3" /> Purchased
              </Badge>
            ) : !loading && isSubscribed ? (
              <Badge className="bg-secondary text-secondary-foreground text-[10px] font-semibold gap-1 px-2 py-0.5">
                <Crown className="h-3 w-3" /> Premium
              </Badge>
            ) : null}
          </div>
          <div className="absolute top-3 right-3">
            <Badge variant="secondary" className="bg-secondary/90 text-secondary-foreground text-[10px] font-medium px-2 py-0.5">
              {course.level}
            </Badge>
          </div>
        </div>
      </Link>

      <div className="p-4 space-y-3 flex-1 flex flex-col">
        <Link to={`/course/${course.id}`}>
          <h3 className="font-display font-semibold text-foreground line-clamp-2 hover:text-primary transition-colors text-sm sm:text-base">
            {course.title}
          </h3>
        </Link>
        <p className="text-xs text-muted-foreground line-clamp-2">{course.description}</p>

        <div className="flex items-center gap-3 text-[10px] sm:text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Star className="h-3.5 w-3.5 fill-warning text-warning" />
            {course.rating}
          </span>
          <span className="flex items-center gap-1">
            <Users className="h-3.5 w-3.5" />
            {course.students.toLocaleString()}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            {course.duration}
          </span>
        </div>

        <div className="mt-auto pt-3 border-t border-border space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-display font-bold text-base sm:text-lg text-foreground">₹{price}</span>
              {originalPrice > price && (
                <span className="text-xs text-muted-foreground line-through">₹{originalPrice}</span>
              )}
            </div>
            <span className="text-[10px] text-muted-foreground font-medium">{course.instructor}</span>
          </div>

          {hasAccess ? (
            <div className="flex items-center gap-2">
              <Link to={`/course/${course.id}`} className="flex-1">
                <Button size="sm" className="w-full bg-primary text-primary-foreground hover:bg-primary/90 shadow-glow text-xs gap-1.5 font-bold transition-all">
                  <CheckCircle className="h-3.5 w-3.5" /> View Course
                </Button>
              </Link>
              <Button
                size="sm"
                variant="outline"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleWishlist(course.id); }}
                className={`border-border hover:border-primary px-3 ${isWishlisted(course.id) ? "text-destructive border-destructive/50" : "text-muted-foreground hover:text-primary"}`}
              >
                <Heart className={`h-4 w-4 ${isWishlisted(course.id) ? "fill-current" : ""}`} />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={handleAddToCart}
                disabled={isInCart(course.id)}
                className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 text-xs gap-1.5 font-bold shadow-glow"
              >
                <ShoppingCart className="h-3.5 w-3.5" />
                {isInCart(course.id) ? "In Cart" : "Add to Cart"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleWishlist(course.id); }}
                className={`border-border hover:border-primary px-3 ${isWishlisted(course.id) ? "text-destructive border-destructive/50" : "text-muted-foreground hover:text-primary"}`}
              >
                <Heart className={`h-4 w-4 ${isWishlisted(course.id) ? "fill-current" : ""}`} />
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CourseCard;
