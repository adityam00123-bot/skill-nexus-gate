import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { Wallet as WalletIcon, IndianRupee, ArrowUpRight, ArrowDownLeft, Clock, RefreshCw } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

interface Transaction {
  id: string;
  amount: number;
  type: "credit" | "debit";
  status: "pending" | "completed" | "failed";
  description: string;
  created_at: string;
}

const Wallet = () => {
  const { user, profile, loading: authLoading, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const [amount, setAmount] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loadingTx, setLoadingTx] = useState(true);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    
    if (!user) {
      navigate("/login?redirect=/wallet");
      return;
    }
    
    fetchTransactions();
    
    // Check if returning from payment gateway
    const orderId = searchParams.get("order_id");
    if (orderId) {
      verifyPayment(orderId);
    }
    
    // Check if amount is pre-filled from checkout
    const amountParam = searchParams.get("amount");
    if (amountParam && amount === "") {
      setAmount(amountParam);
    }
  }, [user, authLoading, navigate, searchParams]);

  const fetchTransactions = async () => {
    if (!user) return;
    setLoadingTx(true);
    try {
      const { data, error } = await supabase
        .from("wallet_transactions")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20);
        
      if (error) throw error;
      setTransactions(data || []);
    } catch (err) {
      console.error("Failed to fetch transactions", err);
    } finally {
      setLoadingTx(false);
    }
  };

  const verifyPayment = async (orderId: string) => {
    setVerifying(true);
    try {
      const res = await fetch(`/api/verify-wallet-payment?order_id=${orderId}`);
      const data = await res.json();
      
      if (data.status === "completed") {
        toast({ title: "Payment Successful", description: "Funds have been added to your wallet." });
        await refreshProfile();
        await fetchTransactions();
      } else if (data.status === "failed") {
        toast({ title: "Payment Failed", description: "Your transaction could not be completed.", variant: "destructive" });
      } else {
        toast({ title: "Payment Pending", description: "We are still verifying your payment." });
      }
      
      // Clean up URL
      searchParams.delete("order_id");
      setSearchParams(searchParams, { replace: true });
    } catch (err) {
      console.error("Verification error", err);
    } finally {
      setVerifying(false);
    }
  };

  const handleTopUp = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseInt(amount);
    
    if (isNaN(numAmount) || numAmount < 100 || numAmount > 50000) {
      toast({
        title: "Invalid Amount",
        description: "Please enter an amount between ₹100 and ₹50,000.",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/create-wallet-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: numAmount, userId: user?.id })
      });
      
      const data = await res.json();
      
      if (res.ok && data.success && data.payment_url) {
        // Redirect to ZapUPI payment page
        window.location.href = data.payment_url;
      } else {
        const errorMsg = data.error || (data.details && (data.details.message || data.details.msg)) || "Failed to initialize payment";
        throw new Error(errorMsg);
      }
    } catch (err: any) {
      console.error("Top-up error", err);
      toast({
        title: "Payment Gateway Error",
        description: err.message || "Failed to start top-up process. Please try again.",
        variant: "destructive"
      });
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Navbar />
        <main className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      
      <main className="flex-1 container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-3xl font-display font-bold text-foreground flex items-center gap-2">
            <WalletIcon className="h-8 w-8 text-primary" />
            CourseVerse Wallet
          </h1>
          <p className="text-muted-foreground mt-2">Manage your funds and view transaction history.</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-8">
          {/* Balance Card */}
          <Card className="md:col-span-1 bg-gradient-to-br from-primary/10 to-accent/5 border-primary/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                Current Balance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-bold text-foreground">
                  ₹{(profile?.wallet_balance || 0).toLocaleString()}
                </span>
              </div>
              {verifying && (
                <div className="mt-4 flex items-center gap-2 text-sm text-amber-500 bg-amber-500/10 p-2 rounded-md">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Verifying payment...
                </div>
              )}
            </CardContent>
          </Card>

          {/* Top Up Card */}
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="text-lg">Add Funds</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleTopUp} className="flex flex-col sm:flex-row gap-4 items-end">
                <div className="space-y-2 flex-1 w-full">
                  <Label htmlFor="amount">Amount (₹)</Label>
                  <div className="relative">
                    <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="amount"
                      type="number"
                      min="100"
                      max="50000"
                      placeholder="Enter amount (100 - 50,000)"
                      className="pl-9"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <Button type="submit" disabled={loading || verifying} className="w-full sm:w-auto">
                  {loading ? "Processing..." : "Add Money"}
                </Button>
              </form>
              <p className="text-xs text-muted-foreground mt-4">
                By adding funds, you agree to our <a href="/wallet-terms" className="text-primary hover:underline">Wallet Terms</a>. Funds are non-withdrawable.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Transaction History */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recent Transactions</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingTx ? (
              <div className="py-8 text-center text-muted-foreground">Loading transactions...</div>
            ) : transactions.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                <Clock className="h-10 w-10 mx-auto mb-3 opacity-20" />
                <p>No transactions yet.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {transactions.map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between p-4 rounded-lg border border-border bg-card">
                    <div className="flex items-center gap-4">
                      <div className={`p-2 rounded-full ${
                        tx.type === "credit" ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"
                      }`}>
                        {tx.type === "credit" ? <ArrowDownLeft className="h-5 w-5" /> : <ArrowUpRight className="h-5 w-5" />}
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{tx.description}</p>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span>{new Date(tx.created_at).toLocaleDateString()}</span>
                          <span>•</span>
                          <span className={`capitalize ${
                            tx.status === "completed" ? "text-green-500" :
                            tx.status === "failed" ? "text-red-500" :
                            "text-amber-500"
                          }`}>
                            {tx.status}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className={`font-bold ${tx.type === "credit" ? "text-green-500" : "text-foreground"}`}>
                      {tx.type === "credit" ? "+" : "-"}₹{tx.amount.toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      <Footer />
    </div>
  );
};

export default Wallet;
