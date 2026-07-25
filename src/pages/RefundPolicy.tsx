import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { RotateCcw, Mail, Clock, AlertCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const RefundPolicy = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Hero */}
      <section className="bg-gradient-to-br from-primary/10 via-background to-accent/10 py-16 md:py-20">
        <div className="container mx-auto px-4 text-center max-w-2xl">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <RotateCcw className="h-7 w-7 text-primary" />
          </div>
          <h1 className="font-display font-bold text-3xl md:text-4xl text-foreground mb-3">
            Refund Policy
          </h1>
          <p className="text-muted-foreground">
            We want you to be satisfied with your purchase. Read our refund
            policy carefully.
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            Last Updated: July 2026
          </p>
        </div>
      </section>

      {/* Quick Summary Cards */}
      <section className="py-10">
        <div className="container mx-auto px-4 max-w-3xl">
          <div className="grid sm:grid-cols-3 gap-4">
            <Card className="border-border">
              <CardContent className="p-5 text-center">
                <Clock className="h-6 w-6 text-primary mx-auto mb-2" />
                <p className="text-sm font-medium text-foreground">
                  7-Day Window
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Refund requests for courses within 7 days of purchase
                </p>
              </CardContent>
            </Card>
            <Card className="border-border">
              <CardContent className="p-5 text-center">
                <Mail className="h-6 w-6 text-primary mx-auto mb-2" />
                <p className="text-sm font-medium text-foreground">
                  Email to Request
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  courseversehere@gmail.com with order details
                </p>
              </CardContent>
            </Card>
            <Card className="border-border">
              <CardContent className="p-5 text-center">
                <RotateCcw className="h-6 w-6 text-primary mx-auto mb-2" />
                <p className="text-sm font-medium text-foreground">
                  Wallet Credit
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Refunds credited to your CourseVerse Wallet
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Content */}
      <section className="pb-16">
        <div className="container mx-auto px-4 max-w-3xl">
          <div className="space-y-10 text-foreground">

            {/* 1. Overview */}
            <div>
              <h2 className="font-display font-semibold text-xl text-foreground mb-3 pb-2 border-b border-border">
                1. Overview
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                At CourseVerse, we are committed to providing high-quality
                educational content. We understand that a course may not always
                meet your expectations, and we have a fair refund policy in
                place. Please read the following terms carefully to understand
                the conditions under which refunds are granted.
              </p>
              <p className="text-muted-foreground leading-relaxed mt-3">
                This Refund Policy applies to all purchases made on the
                CourseVerse Platform at{" "}
                <a
                  href="https://skill-nexus-gate.vercel.app"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  skill-nexus-gate.vercel.app
                </a>
                . By making a purchase, you agree to the terms of this policy.
              </p>
            </div>

            {/* 2. Individual Course Refund */}
            <div>
              <h2 className="font-display font-semibold text-xl text-foreground mb-3 pb-2 border-b border-border">
                2. Individual Course Refunds
              </h2>

              <div className="space-y-6">
                <div>
                  <h3 className="font-semibold text-foreground mb-2">
                    Refund Window
                  </h3>
                  <p className="text-muted-foreground leading-relaxed">
                    Refund requests for individual courses are accepted within{" "}
                    <span className="text-foreground font-medium">7 days</span>{" "}
                    of the original purchase date. Requests submitted after
                    this window will not be eligible for a refund.
                  </p>
                </div>

                <div>
                  <h3 className="font-semibold text-foreground mb-2">
                    Conditions for Refund
                  </h3>
                  <p className="text-muted-foreground leading-relaxed mb-2">
                    A refund may be granted if:
                  </p>
                  <ul className="list-disc list-inside text-muted-foreground space-y-2 leading-relaxed">
                    <li>
                      The course content is significantly different from what
                      was described on the Platform.
                    </li>
                    <li>
                      You did not receive access to the purchased course within
                      48 hours of payment confirmation.
                    </li>
                    <li>
                      There are technical issues on our end that prevent you
                      from accessing the course content.
                    </li>
                    <li>
                      You have completed less than 20% of the course content.
                    </li>
                  </ul>
                </div>

                <div>
                  <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/30 flex gap-3">
                    <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                    <div>
                      <h3 className="font-semibold text-foreground mb-2">
                        Non-Refundable Cases
                      </h3>
                      <p className="text-muted-foreground text-sm leading-relaxed mb-2">
                        Refunds will <strong>not</strong> be granted in the
                        following cases:
                      </p>
                      <ul className="list-disc list-inside text-muted-foreground text-sm space-y-1.5 leading-relaxed">
                        <li>
                          The 7-day refund window has passed since purchase.
                        </li>
                        <li>
                          You have completed more than 20% of the course
                          content.
                        </li>
                        <li>
                          You have downloaded or shared any course materials.
                        </li>
                        <li>
                          The course was purchased during a sale, promotion, or
                          with a discount code.
                        </li>
                        <li>
                          Your account is found to have violated our Terms and
                          Conditions.
                        </li>
                        <li>
                          Refund requests citing a general change of mind
                          without a valid reason.
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 3. Subscription Refunds */}
            <div>
              <h2 className="font-display font-semibold text-xl text-foreground mb-3 pb-2 border-b border-border">
                3. Subscription Refunds
              </h2>

              <div className="space-y-5">
                <div className="p-4 rounded-lg bg-muted/30 border border-border">
                  <h3 className="font-semibold text-foreground mb-2">
                    Monthly Plan (₹499/month)
                  </h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    Monthly subscriptions are{" "}
                    <span className="text-foreground font-medium">
                      non-refundable
                    </span>{" "}
                    once access to course content has been granted. Given the
                    short subscription period, we are unable to offer refunds
                    for monthly plans. Please review the available content
                    before subscribing.
                  </p>
                </div>

                <div className="p-4 rounded-lg bg-muted/30 border border-border">
                  <h3 className="font-semibold text-foreground mb-2">
                    Yearly Plan (₹3,999/year)
                  </h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    For yearly subscriptions, a{" "}
                    <span className="text-foreground font-medium">
                      pro-rata refund
                    </span>{" "}
                    may be issued if a refund request is submitted within{" "}
                    <span className="text-foreground font-medium">7 days</span>{" "}
                    of the original subscription purchase date. The refundable
                    amount will be calculated based on the number of unused
                    months remaining, minus a processing fee of ₹299. After 7
                    days from the purchase date, no refund will be provided for
                    yearly subscriptions.
                  </p>
                </div>
              </div>
            </div>

            {/* 4. How to Request */}
            <div>
              <h2 className="font-display font-semibold text-xl text-foreground mb-3 pb-2 border-b border-border">
                4. How to Request a Refund
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                To initiate a refund request, please send an email to{" "}
                <a
                  href="mailto:tradezone1104@gmail.com"
                  className="text-primary hover:underline"
                >
                  tradezone1104@gmail.com
                </a>{" "}
                with the subject line:{" "}
                <span className="text-foreground font-medium">
                  "Refund Request – [Your Order ID]"
                </span>
              </p>
              <p className="text-muted-foreground leading-relaxed mb-3">
                Your email should include the following information:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 leading-relaxed">
                <li>Full name and registered email address on CourseVerse</li>
                <li>Order ID or transaction reference number</li>
                <li>Name of the course or subscription purchased</li>
                <li>Date of purchase</li>
                <li>Reason for the refund request</li>
              </ul>
              <p className="text-muted-foreground leading-relaxed mt-4">
                Our support team will review your request and respond within{" "}
                <span className="text-foreground font-medium">
                  3–5 business days
                </span>
                . We may request additional information to process your request.
              </p>
            </div>

            {/* 5. Processing Time */}
            <div>
              <h2 className="font-display font-semibold text-xl text-foreground mb-3 pb-2 border-b border-border">
                5. Refund Processing Time
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                Once a refund is approved, it will be credited to your{" "}
                <span className="text-foreground font-medium">
                  CourseVerse Wallet
                </span>
                . Refunds are{" "}
                <span className="text-foreground font-medium">
                  never issued to the original payment method, bank account, or UPI ID
                </span>
                . Your wallet balance can be used to purchase any course on CourseVerse.
                Please allow{" "}
                <span className="text-foreground font-medium">
                  1–2 business days
                </span>{" "}
                for the refund to be credited to your wallet after approval.
              </p>
              <p className="text-muted-foreground leading-relaxed mt-3">
                For details on wallet balance usage and restrictions, please refer
                to our{" "}
                <a
                  href="/wallet-terms"
                  className="text-primary hover:underline"
                >
                  Wallet Terms
                </a>
                .
              </p>
            </div>

            {/* 6. Contact */}
            <div>
              <h2 className="font-display font-semibold text-xl text-foreground mb-3 pb-2 border-b border-border">
                6. Contact Information
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                For any questions or concerns about our Refund Policy, please
                reach out to us:
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
                <p className="text-muted-foreground text-sm">
                  Response Time: 3–5 business days
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

export default RefundPolicy;
