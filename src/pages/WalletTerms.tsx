import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { Wallet, Mail, User, Globe } from 'lucide-react';

const WalletTerms = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-primary/10 via-background to-accent/10 py-16 md:py-20">
        <div className="container mx-auto px-4 text-center">
          <div className="inline-flex items-center justify-center p-3 bg-primary/10 rounded-full mb-4">
            <Wallet className="w-8 h-8 text-primary" />
          </div>
          <h1 className="font-display font-bold text-3xl md:text-5xl text-foreground mb-4">
            Wallet Terms
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Terms governing the use of your CourseVerse Wallet balance.
          </p>
          <p className="text-sm text-muted-foreground mt-4">
            Last Updated: July 2026
          </p>
        </div>
      </section>

      {/* Content Section */}
      <section className="py-12 md:py-16">
        <div className="container mx-auto px-4 max-w-3xl">
          <div className="prose prose-slate dark:prose-invert max-w-none space-y-8">
            
            <section>
              <h2 className="font-display font-semibold text-xl text-foreground mb-3 pb-2 border-b border-border">
                1. Overview
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                The CourseVerse Wallet is an in-app store credit system. It is NOT a bank account, e-wallet, or financial instrument.
              </p>
            </section>

            <section>
              <h2 className="font-display font-semibold text-xl text-foreground mb-3 pb-2 border-b border-border">
                2. Wallet Balance - Non-Withdrawable & Non-Transferable
              </h2>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 leading-relaxed">
                <li>Wallet balance is non-withdrawable and cannot be transferred to any bank account, UPI ID, or any external payment method.</li>
                <li>Wallet balance cannot be transferred to another user.</li>
                <li>Wallet balance can ONLY be used to purchase courses on the CourseVerse platform.</li>
                <li>Wallet balance has no cash value and is non-refundable.</li>
                <li>Wallet balance has NO expiry.</li>
              </ul>
            </section>

            <section>
              <h2 className="font-display font-semibold text-xl text-foreground mb-3 pb-2 border-b border-border">
                3. Adding Funds (Top-Up)
              </h2>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 leading-relaxed">
                <li>Users can add funds via UPI through our payment gateway (ZapUPI).</li>
                <li>Funds are credited after successful payment verification.</li>
                <li>Top-up amounts are non-refundable once credited to the wallet.</li>
              </ul>
            </section>

            <section>
              <h2 className="font-display font-semibold text-xl text-foreground mb-3 pb-2 border-b border-border">
                4. Using Wallet Balance
              </h2>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 leading-relaxed">
                <li>Balance can be used to purchase individual courses.</li>
                <li>Full or partial balance can be applied at checkout.</li>
                <li>Purchases are final once completed using wallet balance.</li>
              </ul>
            </section>

            <section>
              <h2 className="font-display font-semibold text-xl text-foreground mb-3 pb-2 border-b border-border">
                5. Refunds to Wallet
              </h2>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 leading-relaxed">
                <li>Course refunds (where eligible per our Refund Policy) are credited to the CourseVerse Wallet.</li>
                <li>Refunds are NEVER issued to the original payment method or bank account.</li>
                <li>Refund credits can only be used for future course purchases on CourseVerse.</li>
              </ul>
            </section>

            <section>
              <h2 className="font-display font-semibold text-xl text-foreground mb-3 pb-2 border-b border-border">
                6. Account Termination
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                If your account is terminated due to violation of Terms, any remaining wallet balance may be forfeited. CourseVerse reserves the right to adjust wallet balance in case of fraudulent activity.
              </p>
            </section>

            <section>
              <h2 className="font-display font-semibold text-xl text-foreground mb-3 pb-2 border-b border-border">
                7. Changes to Wallet Terms
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                We may update these terms; continued use constitutes acceptance.
              </p>
            </section>

            <section>
              <h2 className="font-display font-semibold text-xl text-foreground mb-3 pb-2 border-b border-border">
                8. Contact Information
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                If you have any questions about these Wallet Terms, please contact us:
              </p>
              <div className="bg-secondary/30 p-6 rounded-lg space-y-3">
                <div className="flex items-center gap-3 text-muted-foreground">
                  <Mail className="w-5 h-5 text-primary" />
                  <span>courseversehere@gmail.com</span>
                </div>
                <div className="flex items-center gap-3 text-muted-foreground">
                  <User className="w-5 h-5 text-primary" />
                  <span>Owner: Aditya Mishra</span>
                </div>
                <div className="flex items-center gap-3 text-muted-foreground">
                  <Globe className="w-5 h-5 text-primary" />
                  <span>Website: skill-nexus-gate.vercel.app</span>
                </div>
              </div>
            </section>

          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default WalletTerms;
