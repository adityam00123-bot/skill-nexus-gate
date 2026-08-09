import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import ScrollToTop from "@/components/ScrollToTop";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { WishlistProvider } from "@/contexts/WishlistContext";
import { CartProvider } from "@/contexts/CartContext";
import { PurchaseProvider } from "@/contexts/PurchaseContext";
import { SubscriptionProvider } from "@/contexts/SubscriptionContext";
import { NotificationProvider } from "@/contexts/NotificationContext";
import Index from "./pages/Index";
import Courses from "./pages/Courses";
import CourseDetail from "./pages/CourseDetail";
import FreeLearning from "./pages/FreeLearning";
import Subscribe from "./pages/Subscribe";
import CVBusiness from "./pages/CVBusiness";
import ResellerDashboard from "./pages/ResellerDashboard";
import Exchange from "./pages/Exchange";
import MyLearning from "./pages/MyLearning";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import AccountSettings from "./pages/AccountSettings";
import Billing from "./pages/Billing";
import Wishlist from "./pages/Wishlist";
import Cart from "./pages/Cart";
import PurchaseHistory from "./pages/PurchaseHistory";
import CourseList from "./pages/CourseList";
import ReferAFriend from "./pages/ReferAFriend";
import Notifications from "./pages/Notifications";
import NotFound from "./pages/NotFound";
import TermsAndConditions from "./pages/TermsAndConditions";
import RefundPolicy from "./pages/RefundPolicy";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import WalletTerms from "./pages/WalletTerms";
import FloatingSupport from "./components/FloatingSupport";
import HelpCenter from "./pages/HelpCenter";
import Contact from "./pages/Contact";
import CvCoins from "./pages/CvCoins";
import Checkout from "./pages/Checkout";
import SubscriptionCheckout from "./pages/SubscriptionCheckout";
import PaymentSuccess from "./pages/PaymentSuccess";
import Wallet from "./pages/Wallet";
import AdminRoute from "./components/admin/AdminRoute";
import AdminLayout from "./pages/admin/AdminLayout";
import AdminDashboard from "./pages/admin/Dashboard";
import AdminCourses from "./pages/admin/Courses";
import AdminTelegramAssign from "./pages/admin/TelegramAssign";
import AdminUsers from "./pages/admin/Users";
import AdminOrders from "./pages/admin/Orders";
import AdminSubscriptions from "./pages/admin/Subscriptions";
import AdminResellers from "./pages/admin/Resellers";
import AdminCvCoins from "./pages/admin/CvCoinsAdmin";
import AdminExchangeRequests from "./pages/admin/ExchangeRequests";
import AdminSellRequests from "./pages/admin/SellRequests";
import AdminNotifications from "./pages/admin/AdminNotifications";
import DeletedBlockedUsers from "./pages/admin/DeletedBlockedUsers";
import AdminSettings from "./pages/admin/Settings";
import AdminSupport from "./pages/admin/Support";

const queryClient = new QueryClient();

// Homepage now handles both guest and logged-in states internally

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <ScrollToTop />
          <AuthProvider>
            <WishlistProvider>
              <CartProvider>
                <PurchaseProvider>
                <SubscriptionProvider>
                <NotificationProvider>
                <Routes>
                  <Route path="/" element={<Index />} />
                  <Route path="/course-list" element={<CourseList />} />
                  <Route path="/courses" element={<Courses />} />
                  <Route path="/course/:id" element={<CourseDetail />} />
                  <Route path="/free-learning" element={<FreeLearning />} />
                  <Route path="/subscribe" element={<Subscribe />} />
                  <Route path="/cv-business" element={<CVBusiness />} />
                  <Route path="/reseller-dashboard" element={<ResellerDashboard />} />
                  <Route path="/exchange" element={<Exchange />} />
                  <Route path="/my-learning" element={<MyLearning />} />
                  <Route path="/wishlist" element={<Wishlist />} />
                  <Route path="/cart" element={<Cart />} />
                  <Route path="/purchase-history" element={<PurchaseHistory />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/signup" element={<Signup />} />
                  <Route path="/forgot-password" element={<ForgotPassword />} />
                  <Route path="/reset-password" element={<ResetPassword />} />
                  <Route path="/refer" element={<ReferAFriend />} />
                  <Route path="/notifications" element={<Notifications />} />
                  <Route path="/settings" element={<AccountSettings />} />
                  <Route path="/settings/:section" element={<AccountSettings />} />
                  <Route path="/billing" element={<Billing />} />
                  <Route path="/help" element={<HelpCenter />} />
                  <Route path="/contact" element={<Contact />} />
                  <Route path="/cv-coins" element={<CvCoins />} />
                  <Route path="/checkout" element={<Checkout />} />
                  <Route path="/subscription-checkout" element={<SubscriptionCheckout />} />
                  <Route path="/payment-success" element={<PaymentSuccess />} />
                  <Route path="/wallet" element={<Wallet />} />
                  <Route path="/terms" element={<TermsAndConditions />} />
                  <Route path="/refund-policy" element={<RefundPolicy />} />
                  <Route path="/privacy" element={<PrivacyPolicy />} />
                  <Route path="/wallet-terms" element={<WalletTerms />} />
                  <Route path="/admin" element={<AdminRoute><AdminLayout /></AdminRoute>}>
                    <Route index element={<AdminDashboard />} />
                    <Route path="courses" element={<AdminCourses />} />
                    <Route path="telegram-assign" element={<AdminTelegramAssign />} />
                    <Route path="users" element={<AdminUsers />} />
                    <Route path="orders" element={<AdminOrders />} />
                    <Route path="subscriptions" element={<AdminSubscriptions />} />
                    <Route path="resellers" element={<AdminResellers />} />
                    <Route path="cv-coins" element={<AdminCvCoins />} />
                    <Route path="exchange-requests" element={<AdminExchangeRequests />} />
                    <Route path="sell-requests" element={<AdminSellRequests />} />
                    <Route path="notifications" element={<AdminNotifications />} />
                    <Route path="user-audit" element={<DeletedBlockedUsers />} />
                    <Route path="settings" element={<AdminSettings />} />
                    <Route path="support" element={<AdminSupport />} />
                  </Route>
                  <Route path="*" element={<NotFound />} />
                </Routes>
                <FloatingSupport />
                </NotificationProvider>
                </SubscriptionProvider>
                </PurchaseProvider>
              </CartProvider>
            </WishlistProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
