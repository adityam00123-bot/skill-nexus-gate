import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { FileText } from "lucide-react";

const TermsAndConditions = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Hero */}
      <section className="bg-gradient-to-br from-primary/10 via-background to-accent/10 py-16 md:py-20">
        <div className="container mx-auto px-4 text-center max-w-2xl">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <FileText className="h-7 w-7 text-primary" />
          </div>
          <h1 className="font-display font-bold text-3xl md:text-4xl text-foreground mb-3">
            Terms and Conditions
          </h1>
          <p className="text-muted-foreground">
            Please read these terms carefully before using CourseVerse.
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            Last Updated: March 2026
          </p>
        </div>
      </section>

      {/* Content */}
      <section className="py-12 md:py-16">
        <div className="container mx-auto px-4 max-w-3xl">
          <div className="prose prose-sm prose-invert max-w-none space-y-10 text-foreground">

            {/* 1. Introduction */}
            <div>
              <h2 className="font-display font-semibold text-xl text-foreground mb-3 pb-2 border-b border-border">
                1. Introduction &amp; Acceptance
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                Welcome to CourseVerse. By accessing or using our website at{" "}
                <a
                  href="https://skill-nexus-gate.vercel.app"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  skill-nexus-gate.vercel.app
                </a>{" "}
                ("Platform"), you agree to be bound by these Terms and Conditions
                ("Terms"). If you do not agree with any part of these Terms, you
                must not access or use our Platform. These Terms constitute a
                legally binding agreement between you and CourseVerse.
              </p>
            </div>

            {/* 2. About */}
            <div>
              <h2 className="font-display font-semibold text-xl text-foreground mb-3 pb-2 border-b border-border">
                2. About CourseVerse
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                CourseVerse is an India-first online marketplace for trading and
                investing education. We provide curated courses and subscription
                plans designed to help individuals learn about stock markets,
                trading strategies, and personal finance. Course content is
                delivered digitally via Telegram after successful payment.
                CourseVerse is owned and operated by CourseVerse, based in
                India.
              </p>
            </div>

            {/* 3. User Accounts */}
            <div>
              <h2 className="font-display font-semibold text-xl text-foreground mb-3 pb-2 border-b border-border">
                3. User Accounts
              </h2>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 leading-relaxed">
                <li>
                  You must be at least 18 years of age to register and use
                  CourseVerse.
                </li>
                <li>
                  You are responsible for maintaining the confidentiality of
                  your account credentials and for all activities under your
                  account.
                </li>
                <li>
                  You must provide accurate, current, and complete information
                  during registration.
                </li>
                <li>
                  You must immediately notify us at{" "}
                  <a
                    href="mailto:courseversehere@gmail.com"
                    className="text-primary hover:underline"
                  >
                    courseversehere@gmail.com
                  </a>{" "}
                  of any unauthorized use of your account.
                </li>
                <li>
                  We reserve the right to suspend or terminate accounts that
                  violate these Terms or engage in fraudulent activity.
                </li>
              </ul>
            </div>

            {/* 4. Course Purchases */}
            <div>
              <h2 className="font-display font-semibold text-xl text-foreground mb-3 pb-2 border-b border-border">
                4. Course Purchases &amp; Access
              </h2>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 leading-relaxed">
                <li>
                  Individual courses are priced between ₹99 and ₹1,999 per
                  course.
                </li>
                <li>
                  Upon successful payment, you will receive access to the
                  purchased course content via a Telegram channel or group
                  link.
                </li>
                <li>
                  Access is granted to you personally and is non-transferable.
                  Sharing your access link or credentials with others is strictly
                  prohibited.
                </li>
                <li>
                  CourseVerse reserves the right to update, modify, or remove
                  course content at any time without prior notice.
                </li>
                <li>
                  We do not guarantee that the Telegram platform will be
                  continuously available, and we are not liable for any
                  third-party platform outages.
                </li>
              </ul>
            </div>

            {/* 5. Subscription Plans */}
            <div>
              <h2 className="font-display font-semibold text-xl text-foreground mb-3 pb-2 border-b border-border">
                5. Subscription Plans
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-3">
                CourseVerse offers the following subscription plans:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 leading-relaxed">
                <li>
                  <span className="text-foreground font-medium">Monthly Plan:</span>{" "}
                  ₹499 per month — provides access to all available course
                  content for one calendar month.
                </li>
                <li>
                  <span className="text-foreground font-medium">Yearly Plan:</span>{" "}
                  ₹3,999 per year — provides access to all available course
                  content for one full year at a discounted rate.
                </li>
                <li>
                  Subscriptions automatically expire at the end of the billing
                  period unless renewed.
                </li>
                <li>
                  We do not offer automatic renewals. You must manually renew
                  your subscription to continue access.
                </li>
                <li>
                  Subscription access is personal and non-transferable.
                </li>
              </ul>
            </div>

            {/* 6. Payment Terms */}
            <div>
              <h2 className="font-display font-semibold text-xl text-foreground mb-3 pb-2 border-b border-border">
                6. Payment Terms
              </h2>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 leading-relaxed">
                <li>
                  All payments are processed securely through our payment partners,
                  a RBI-authorised payment aggregator.
                </li>
                <li>
                  All prices are listed in Indian Rupees (₹) and are inclusive
                  of applicable taxes unless stated otherwise.
                </li>
                <li>
                  Payments must be completed in full before course access is
                  granted.
                </li>
                <li>
                  In the event of a payment failure, access will not be granted.
                  Please contact us if you were charged but did not receive
                  access.
                </li>
                <li>
                  CourseVerse is not liable for any additional charges imposed
                  by your bank or payment provider.
                </li>
              </ul>
            </div>

            {/* 7. Intellectual Property */}
            <div>
              <h2 className="font-display font-semibold text-xl text-foreground mb-3 pb-2 border-b border-border">
                7. Intellectual Property
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                All content on the CourseVerse platform, including but not
                limited to text, graphics, logos, videos, course materials,
                and software, is the exclusive property of CourseVerse or its
                content licensors and is protected under applicable Indian and
                international intellectual property laws. You may not reproduce,
                distribute, modify, transmit, publish, or sell any content
                obtained through CourseVerse without express prior written
                permission from us. Unauthorized use may result in immediate
                account termination and legal action.
              </p>
            </div>

            {/* 8. Prohibited Activities */}
            <div>
              <h2 className="font-display font-semibold text-xl text-foreground mb-3 pb-2 border-b border-border">
                8. Prohibited Activities
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-3">
                You agree not to engage in any of the following activities:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 leading-relaxed">
                <li>
                  Sharing, redistributing, or reselling any course content
                  without authorization.
                </li>
                <li>
                  Sharing your account credentials or Telegram access links with
                  others.
                </li>
                <li>
                  Using the Platform for any unlawful purpose or in violation of
                  any applicable laws.
                </li>
                <li>
                  Attempting to reverse-engineer, decompile, or disassemble any
                  part of the Platform.
                </li>
                <li>
                  Posting or transmitting any harmful, abusive, defamatory, or
                  obscene content.
                </li>
                <li>
                  Impersonating any person or entity, or misrepresenting your
                  affiliation with any entity.
                </li>
                <li>
                  Using automated tools, bots, or scrapers to access or extract
                  content from the Platform.
                </li>
              </ul>
            </div>

            {/* 9. Disclaimer */}
            <div>
              <h2 className="font-display font-semibold text-xl text-foreground mb-3 pb-2 border-b border-border">
                9. Disclaimer
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                <span className="text-foreground font-medium">
                  CourseVerse provides educational content for informational
                  purposes only. Nothing on this platform constitutes financial,
                  investment, or trading advice.
                </span>{" "}
                Trading and investing in financial markets involves significant
                risk, including the risk of loss of capital. Past performance is
                not indicative of future results. You should conduct your own
                research and consult a qualified financial adviser before making
                any investment decisions. CourseVerse, its owner, and its
                instructors shall not be liable for any financial losses incurred
                as a result of using our content.
              </p>
              <p className="text-muted-foreground leading-relaxed mt-3">
                The Platform is provided on an "as is" and "as available" basis
                without warranties of any kind, either express or implied. We do
                not warrant that the Platform will be error-free or uninterrupted.
              </p>
            </div>

            {/* 10. Governing Law */}
            <div>
              <h2 className="font-display font-semibold text-xl text-foreground mb-3 pb-2 border-b border-border">
                10. Governing Law
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                These Terms and Conditions shall be governed by and construed in
                accordance with the laws of India. Any disputes arising out of
                or in connection with these Terms shall be subject to the
                exclusive jurisdiction of the competent courts in India. By
                using CourseVerse, you consent to submit to the personal
                jurisdiction of such courts for the purpose of litigating any
                such claims.
              </p>
            </div>

            {/* 11. Contact */}
            <div>
              <h2 className="font-display font-semibold text-xl text-foreground mb-3 pb-2 border-b border-border">
                11. Contact Information
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                If you have any questions, concerns, or feedback regarding these
                Terms and Conditions, please contact us:
              </p>
              <div className="mt-4 p-4 rounded-lg bg-muted/30 border border-border space-y-1">
                <p className="text-foreground font-medium">CourseVerse</p>
                <p className="text-muted-foreground text-sm">
                  Company: CourseVerse
                </p>
                <p className="text-muted-foreground text-sm">
                  Email:{" "}
                  <a
                    href="mailto:courseversehere@gmail.com"
                    className="text-primary hover:underline"
                  >
                    courseversehere@gmail.com
                  </a>
                </p>
                <p className="text-muted-foreground text-sm">
                  Website:{" "}
                  <a
                    href="https://skill-nexus-gate.vercel.app"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    skill-nexus-gate.vercel.app
                  </a>
                </p>
              </div>
            </div>

          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default TermsAndConditions;
