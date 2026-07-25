import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { Shield } from 'lucide-react';

const PrivacyPolicy = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <section className="bg-gradient-to-br from-primary/10 via-background to-accent/10 py-16 md:py-20">
        <div className="container mx-auto px-4 flex flex-col items-center text-center">
          <Shield className="w-12 h-12 text-primary mb-6" />
          <h1 className="text-3xl md:text-5xl font-display font-bold text-foreground mb-4">
            Privacy Policy
          </h1>
          <p className="text-muted-foreground max-w-2xl text-lg mb-4">
            How we collect, use, and protect your information
          </p>
          <p className="text-sm text-muted-foreground font-medium">
            Last Updated: July 2026
          </p>
        </div>
      </section>

      <section className="py-12 md:py-16">
        <div className="container mx-auto px-4 max-w-3xl">
          <div className="space-y-8">
            {/* 1. Introduction */}
            <div>
              <h2 className="font-display font-semibold text-xl text-foreground mb-3 pb-2 border-b border-border">
                1. Introduction
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                Welcome to CourseVerse. This Privacy Policy explains our commitment to protecting your privacy and how we handle your personal information when you use our online course marketplace.
              </p>
            </div>

            {/* 2. Information We Collect */}
            <div>
              <h2 className="font-display font-semibold text-xl text-foreground mb-3 pb-2 border-b border-border">
                2. Information We Collect
              </h2>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 leading-relaxed">
                <li><strong>Account Data:</strong> Name, email address, and phone number when you register.</li>
                <li><strong>Payment Data:</strong> Processed via ZapUPI and our payment gateways. We do not store credit card or payment details on our servers.</li>
                <li><strong>Usage Data:</strong> Information about pages visited and courses viewed on our platform.</li>
                <li><strong>Device Information:</strong> Device type, operating system, and browser information.</li>
              </ul>
            </div>

            {/* 3. How We Use Your Information */}
            <div>
              <h2 className="font-display font-semibold text-xl text-foreground mb-3 pb-2 border-b border-border">
                3. How We Use Your Information
              </h2>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 leading-relaxed">
                <li>To provide, maintain, and improve our services.</li>
                <li>To process payments securely.</li>
                <li>To send administrative notifications and course updates.</li>
                <li>To provide customer support and respond to inquiries.</li>
              </ul>
            </div>

            {/* 4. Data Sharing & Third-Party Services */}
            <div>
              <h2 className="font-display font-semibold text-xl text-foreground mb-3 pb-2 border-b border-border">
                4. Data Sharing & Third-Party Services
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-2">
                We do not sell your personal data. We share information only with trusted third-party services necessary to operate our platform:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 leading-relaxed">
                <li><strong>Supabase:</strong> For secure database management and authentication.</li>
                <li><strong>ZapUPI:</strong> For processing payments securely.</li>
                <li><strong>Telegram:</strong> For course delivery and communication.</li>
              </ul>
            </div>

            {/* 5. Cookies & Tracking */}
            <div>
              <h2 className="font-display font-semibold text-xl text-foreground mb-3 pb-2 border-b border-border">
                5. Cookies & Tracking
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                We use session cookies for user authentication and local storage to save your platform preferences. These are essential for providing a seamless user experience.
              </p>
            </div>

            {/* 6. Data Security */}
            <div>
              <h2 className="font-display font-semibold text-xl text-foreground mb-3 pb-2 border-b border-border">
                6. Data Security
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                We implement robust security measures, including data encryption, secure authentication via Supabase, and HTTPS protocols across our platform to protect your personal information from unauthorized access.
              </p>
            </div>

            {/* 7. Your Rights */}
            <div>
              <h2 className="font-display font-semibold text-xl text-foreground mb-3 pb-2 border-b border-border">
                7. Your Rights
              </h2>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 leading-relaxed">
                <li>Access the personal data we hold about you.</li>
                <li>Update or correct your profile information.</li>
                <li>Request deletion of your account and associated data.</li>
                <li>Withdraw consent for data processing where applicable.</li>
              </ul>
            </div>

            {/* 8. Children's Privacy */}
            <div>
              <h2 className="font-display font-semibold text-xl text-foreground mb-3 pb-2 border-b border-border">
                8. Children's Privacy
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                Our platform is intended for users who are 18 years of age or older. We do not knowingly collect personal information from children under 18.
              </p>
            </div>

            {/* 9. Changes to This Policy */}
            <div>
              <h2 className="font-display font-semibold text-xl text-foreground mb-3 pb-2 border-b border-border">
                9. Changes to This Policy
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                We may update this Privacy Policy from time to time. Any changes will be effective immediately upon posting the updated policy on this page, with the "Last Updated" date revised accordingly.
              </p>
            </div>

            {/* 10. Contact Information */}
            <div>
              <h2 className="font-display font-semibold text-xl text-foreground mb-3 pb-2 border-b border-border">
                10. Contact Information
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                If you have any questions or concerns about this Privacy Policy, please contact us:
              </p>
              <div className="bg-card border border-border rounded-lg p-6">
                <ul className="text-muted-foreground space-y-2 leading-relaxed">
                  <li><strong>Owner:</strong> Aditya Mishra</li>
                  <li><strong>Email:</strong> <a href="mailto:courseversehere@gmail.com" className="text-primary hover:underline">courseversehere@gmail.com</a></li>
                  <li><strong>Website:</strong> <a href="https://skill-nexus-gate.vercel.app" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">skill-nexus-gate.vercel.app</a></li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default PrivacyPolicy;
