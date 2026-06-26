import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service | SoterAI",
  description:
    "SoterAI terms of service: defense-in-depth AI security software, acceptable use, API responsibilities, marketplace integrations, and service limitations.",
  alternates: { canonical: "/terms" },
  openGraph: {
    title: "Terms of Service | SoterAI",
    description:
      "SoterAI terms of service: defense-in-depth AI security software, acceptable use, API responsibilities, marketplace integrations, and service limitations.",
    url: "/terms",
    type: "website",
  },
};

export default function TermsPage() {
  return (
    <main className="container-page py-16">
      <p className="eyebrow">Legal</p>
      <h1 className="mt-2 text-4xl font-bold">Terms of Service</h1>

      <div className="mt-8 max-w-3xl space-y-5 leading-7 text-slate-400">
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-5 py-4 text-amber-400 text-sm">
          This document is a product terms draft and should be reviewed by
          qualified legal counsel before public commercial launch.
        </div>

        {/* 1. Acceptance of Terms */}
        <h2
          id="acceptance-of-terms"
          className="text-2xl font-semibold text-white mt-12 mb-4"
        >
          1. Acceptance of Terms
        </h2>
        <p className="text-slate-400 leading-7">
          By accessing or using SoterAI&apos;s platform, APIs, dashboard,
          marketplace integrations, or related services (collectively, the
          &quot;Service&quot;), you agree to be bound by these Terms of Service
          (&quot;Terms&quot;). If you are using the Service on behalf of an
          organization, you represent that you have the authority to bind that
          organization to these Terms.
        </p>
        <p className="text-slate-400 leading-7">
          If you do not agree to these Terms, you must not access or use the
          Service.
        </p>

        {/* 2. Description of Service */}
        <h2
          id="description-of-service"
          className="text-2xl font-semibold text-white mt-12 mb-4"
        >
          2. Description of Service
        </h2>
        <p className="text-slate-400 leading-7">
          SoterAI provides defense-in-depth software for AI risk reduction. The
          Service includes prompt injection detection, data-loss prevention,
          content moderation, red-team analysis, security policy management,
          audit logging, and integration connectors for workflow automation
          platforms.
        </p>
        <p className="text-slate-400 leading-7">
          SoterAI provides defense-in-depth software for AI risk reduction. It
          does not guarantee prevention of every attack, disclosure, outage, or
          model failure. The Service is designed to reduce risk and provide
          security tooling, not to serve as a complete security solution in
          isolation.
        </p>

        {/* 3. Accounts and Access */}
        <h2
          id="accounts-and-access"
          className="text-2xl font-semibold text-white mt-12 mb-4"
        >
          3. Accounts and Access
        </h2>
        <p className="text-slate-400 leading-7">
          To use the Service, you must create an account and provide accurate,
          complete registration information. You are responsible for:
        </p>
        <ul className="list-disc pl-6 space-y-2 text-slate-400">
          <li>Maintaining the confidentiality of your account credentials</li>
          <li>All activities that occur under your account</li>
          <li>Promptly notifying us of any unauthorized access to your account</li>
          <li>Ensuring that account access is limited to authorized individuals within your organization</li>
        </ul>
        <p className="text-slate-400 leading-7">
          We reserve the right to suspend or terminate accounts that violate
          these Terms or that we reasonably believe have been compromised.
        </p>

        {/* 4. API Keys and Security Responsibilities */}
        <h2
          id="api-keys-and-security"
          className="text-2xl font-semibold text-white mt-12 mb-4"
        >
          4. API Keys and Security Responsibilities
        </h2>
        <p className="text-slate-400 leading-7">
          API keys are generated through the dashboard and are shown in full
          only once at the time of creation. API keys are stored in encrypted
          form and cannot be retrieved after creation. If a key is lost, you
          must revoke it and generate a new one.
        </p>
        <p className="text-slate-400 leading-7">You are responsible for:</p>
        <ul className="list-disc pl-6 space-y-2 text-slate-400">
          <li>Keeping API keys confidential and secure</li>
          <li>Not embedding API keys in client-side code, public repositories, or unencrypted storage</li>
          <li>Rotating keys periodically and revoking compromised keys immediately</li>
          <li>Monitoring API usage for anomalous activity</li>
        </ul>
        <p className="text-slate-400 leading-7">
          SoterAI is not liable for unauthorized use of your API keys resulting
          from your failure to secure them.
        </p>

        {/* 5. Acceptable Use */}
        <h2
          id="acceptable-use"
          className="text-2xl font-semibold text-white mt-12 mb-4"
        >
          5. Acceptable Use
        </h2>
        <p className="text-slate-400 leading-7">
          You agree to use the Service only for lawful purposes and in
          compliance with these Terms. Acceptable use includes:
        </p>
        <ul className="list-disc pl-6 space-y-2 text-slate-400">
          <li>Scanning prompts and AI outputs for security threats in your own applications</li>
          <li>Configuring security policies for your organization&apos;s AI workflows</li>
          <li>Using red-team and security testing features against systems you own or are explicitly authorized to assess</li>
          <li>Integrating SoterAI with workflow platforms for automated security analysis</li>
          <li>Reviewing audit logs and security reports for compliance purposes</li>
        </ul>

        {/* 6. Prohibited Use */}
        <h2
          id="prohibited-use"
          className="text-2xl font-semibold text-white mt-12 mb-4"
        >
          6. Prohibited Use
        </h2>
        <p className="text-slate-400 leading-7">
          You may not use the Service to:
        </p>
        <ul className="list-disc pl-6 space-y-2 text-slate-400">
          <li>Conduct security testing, red-teaming, or penetration testing against systems you do not own or are not explicitly authorized to assess</li>
          <li>Circumvent or attempt to circumvent rate limits, access controls, or security measures</li>
          <li>Reverse-engineer, decompile, or disassemble any part of the Service</li>
          <li>Resell, sublicense, or redistribute the Service or API access without authorization</li>
          <li>Transmit malware, viruses, or other harmful code through the Service</li>
          <li>Use the Service to facilitate illegal activities, harassment, or discrimination</li>
          <li>Submit content that infringes intellectual property rights of third parties</li>
          <li>Attempt to access other users&apos; data, accounts, or API keys</li>
          <li>Use automated means to scrape, crawl, or extract data from the dashboard or documentation beyond normal API usage</li>
        </ul>

        {/* 7. AI Security Limitations */}
        <h2
          id="ai-security-limitations"
          className="text-2xl font-semibold text-white mt-12 mb-4"
        >
          7. AI Security Limitations
        </h2>
        <p className="text-slate-400 leading-7">
          Users are responsible for configuring security policies correctly for
          their use case. SoterAI provides tools and defaults, but the
          effectiveness of security analysis depends on proper configuration,
          threshold settings, and policy definitions.
        </p>
        <p className="text-slate-400 leading-7">
          You acknowledge that:
        </p>
        <ul className="list-disc pl-6 space-y-2 text-slate-400">
          <li>No security system can detect all threats with 100% accuracy</li>
          <li>False positives and false negatives are inherent in any detection system</li>
          <li>SoterAI should be used as part of a defense-in-depth strategy, not as a sole security control</li>
          <li>You remain responsible for lawful data processing, application security, access control, human oversight, and incident response</li>
          <li>Detection capabilities may vary based on the type, language, and sophistication of threats</li>
        </ul>

        {/* 8. Customer Content and Data */}
        <h2
          id="customer-content-and-data"
          className="text-2xl font-semibold text-white mt-12 mb-4"
        >
          8. Customer Content and Data
        </h2>
        <p className="text-slate-400 leading-7">
          You retain all rights to the content you submit to the Service for
          analysis (&quot;Customer Content&quot;). By submitting content, you
          grant SoterAI a limited, non-exclusive license to process that content
          solely for the purpose of providing the Service.
        </p>
        <p className="text-slate-400 leading-7">
          SoterAI processes text content (prompts, AI outputs) server-side for
          security analysis. Raw text is processed in-memory and is not
          persisted to long-term storage. Threat detection summaries (risk
          scores, categories, timestamps, actions taken) are stored for audit
          and dashboard display.
        </p>
        <p className="text-slate-400 leading-7">
          We do not use Customer Content to train machine learning models
          without explicit opt-in consent.
        </p>

        {/* 9. Marketplace Integrations */}
        <h2
          id="marketplace-integrations"
          className="text-2xl font-semibold text-white mt-12 mb-4"
        >
          9. Marketplace Integrations
        </h2>
        <p className="text-slate-400 leading-7">
          SoterAI provides integration connectors for workflow automation
          platforms including n8n, Zapier, Make, Dify, and Botpress.
          Marketplace integrations (n8n, Zapier, Make, Dify, Botpress) may be
          subject to additional third-party platform terms.
        </p>
        <p className="text-slate-400 leading-7">
          Integration nodes are stateless connectors that transmit data to
          SoterAI&apos;s API for processing and return results to the calling
          platform. SoterAI is not responsible for the data handling practices,
          availability, or security of third-party platforms.
        </p>
        <p className="text-slate-400 leading-7">
          You are responsible for reviewing and complying with the terms of
          service and privacy policies of any third-party platforms you connect
          to SoterAI.
        </p>

        {/* 10. Billing and Subscriptions */}
        <h2
          id="billing-and-subscriptions"
          className="text-2xl font-semibold text-white mt-12 mb-4"
        >
          10. Billing and Subscriptions
        </h2>
        <p className="text-slate-400 leading-7">
          Paid plans are billed on a monthly or annual basis as specified at
          the time of subscription. All fees are non-refundable except as
          required by applicable law or as otherwise stated in your order form.
        </p>
        <ul className="list-disc pl-6 space-y-2 text-slate-400">
          <li>Subscription renewals are automatic unless cancelled before the renewal date</li>
          <li>Price changes will be communicated at least 30 days before taking effect</li>
          <li>Downgrading your plan may result in loss of access to certain features or data retention limits</li>
          <li>Overdue payments may result in service suspension after reasonable notice</li>
        </ul>

        {/* 11. Free Plan Limitations */}
        <h2
          id="free-plan-limitations"
          className="text-2xl font-semibold text-white mt-12 mb-4"
        >
          11. Free Plan Limitations
        </h2>
        <p className="text-slate-400 leading-7">
          Free plan usage is subject to rate limits and may be reduced or
          discontinued. Free plans are intended for evaluation, development,
          and small-scale use.
        </p>
        <ul className="list-disc pl-6 space-y-2 text-slate-400">
          <li>Free plan rate limits may be adjusted without prior notice</li>
          <li>Some features, integrations, or advanced capabilities may not be available on the free plan</li>
          <li>Audit log retention may be shorter on the free plan compared to paid plans</li>
          <li>SoterAI reserves the right to discontinue free plans with 30 days&apos; notice</li>
          <li>Free plan accounts inactive for more than 90 days may be scheduled for deletion</li>
        </ul>

        {/* 12. Service Availability */}
        <h2
          id="service-availability"
          className="text-2xl font-semibold text-white mt-12 mb-4"
        >
          12. Service Availability
        </h2>
        <p className="text-slate-400 leading-7">
          We aim to provide high availability for the Service but do not
          guarantee uninterrupted access. The Service may be temporarily
          unavailable due to:
        </p>
        <ul className="list-disc pl-6 space-y-2 text-slate-400">
          <li>Scheduled maintenance (communicated in advance where feasible)</li>
          <li>Unplanned outages or infrastructure failures</li>
          <li>Force majeure events beyond our reasonable control</li>
          <li>Security incidents requiring emergency remediation</li>
        </ul>
        <p className="text-slate-400 leading-7">
          Service-level commitments, where applicable, are defined in the
          applicable order form or published service-level documentation for
          your plan tier.
        </p>

        {/* 13. Beta and Developer-Preview Features */}
        <h2
          id="beta-features"
          className="text-2xl font-semibold text-white mt-12 mb-4"
        >
          13. Beta and Developer-Preview Features
        </h2>
        <p className="text-slate-400 leading-7">
          SoterAI may offer features designated as &quot;beta,&quot;
          &quot;preview,&quot; &quot;experimental,&quot; or &quot;developer
          preview.&quot; These features:
        </p>
        <ul className="list-disc pl-6 space-y-2 text-slate-400">
          <li>Are provided &quot;as-is&quot; without warranties of any kind</li>
          <li>May be incomplete, contain bugs, or behave unexpectedly</li>
          <li>May be modified, suspended, or discontinued without notice</li>
          <li>Should not be relied upon for production security workloads unless explicitly stated otherwise</li>
          <li>May have separate or additional terms communicated at the time of access</li>
        </ul>
        <p className="text-slate-400 leading-7">
          Feedback provided on beta features may be used by SoterAI to improve
          the Service without obligation or compensation.
        </p>

        {/* 14. Intellectual Property */}
        <h2
          id="intellectual-property"
          className="text-2xl font-semibold text-white mt-12 mb-4"
        >
          14. Intellectual Property
        </h2>
        <p className="text-slate-400 leading-7">
          SoterAI and its licensors retain all rights, title, and interest in
          the Service, including all software, algorithms, documentation,
          branding, trademarks, and related intellectual property. These Terms
          do not grant you any rights to SoterAI&apos;s intellectual property
          beyond the limited right to use the Service as described herein.
        </p>
        <p className="text-slate-400 leading-7">
          You retain all intellectual property rights in your Customer Content.
          SoterAI does not claim ownership of content you submit for analysis.
        </p>

        {/* 15. Disclaimers */}
        <h2
          id="disclaimers"
          className="text-2xl font-semibold text-white mt-12 mb-4"
        >
          15. Disclaimers
        </h2>
        <p className="text-slate-400 leading-7">
          THE SERVICE IS PROVIDED &quot;AS IS&quot; AND &quot;AS
          AVAILABLE&quot; WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED,
          INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS
          FOR A PARTICULAR PURPOSE, NON-INFRINGEMENT, OR ACCURACY.
        </p>
        <p className="text-slate-400 leading-7">
          SoterAI does not warrant that:
        </p>
        <ul className="list-disc pl-6 space-y-2 text-slate-400">
          <li>The Service will detect all security threats or prevent all attacks</li>
          <li>The Service will be uninterrupted, error-free, or free of vulnerabilities</li>
          <li>Detection results will be accurate, complete, or suitable for any particular compliance requirement</li>
          <li>The Service will meet your specific security or regulatory requirements</li>
        </ul>

        {/* 16. Limitation of Liability */}
        <h2
          id="limitation-of-liability"
          className="text-2xl font-semibold text-white mt-12 mb-4"
        >
          16. Limitation of Liability
        </h2>
        <p className="text-slate-400 leading-7">
          TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, SOTERAI AND ITS
          OFFICERS, DIRECTORS, EMPLOYEES, AND AGENTS SHALL NOT BE LIABLE FOR
          ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE
          DAMAGES, INCLUDING BUT NOT LIMITED TO LOSS OF PROFITS, DATA, USE,
          GOODWILL, OR OTHER INTANGIBLE LOSSES, RESULTING FROM:
        </p>
        <ul className="list-disc pl-6 space-y-2 text-slate-400">
          <li>Your use of or inability to use the Service</li>
          <li>Any unauthorized access to or alteration of your data</li>
          <li>Any failure of the Service to detect a security threat</li>
          <li>Actions taken or not taken based on Service outputs</li>
          <li>Any third-party conduct or content on the Service</li>
        </ul>
        <p className="text-slate-400 leading-7">
          IN NO EVENT SHALL SOTERAI&apos;S TOTAL LIABILITY EXCEED THE AMOUNTS
          PAID BY YOU TO SOTERAI IN THE TWELVE (12) MONTHS PRECEDING THE EVENT
          GIVING RISE TO THE CLAIM, OR ONE HUNDRED DOLLARS ($100), WHICHEVER IS
          GREATER.
        </p>

        {/* 17. Termination */}
        <h2
          id="termination"
          className="text-2xl font-semibold text-white mt-12 mb-4"
        >
          17. Termination
        </h2>
        <p className="text-slate-400 leading-7">
          You may terminate your account at any time by contacting{" "}
          <a href="mailto:support@soterai.dev" className="text-cyan underline">
            support@soterai.dev
          </a>{" "}
          or through the account settings in the dashboard.
        </p>
        <p className="text-slate-400 leading-7">
          SoterAI may suspend or terminate your access to the Service if:
        </p>
        <ul className="list-disc pl-6 space-y-2 text-slate-400">
          <li>You violate these Terms or any applicable policies</li>
          <li>Your account is used for prohibited activities</li>
          <li>Required by law or regulation</li>
          <li>Your account has been inactive for an extended period (with prior notice)</li>
        </ul>
        <p className="text-slate-400 leading-7">
          Upon termination, your right to use the Service ceases immediately.
          We may retain certain data as required by law or for legitimate
          business purposes, as described in our Privacy Policy.
        </p>

        {/* 18. Changes to Terms */}
        <h2
          id="changes-to-terms"
          className="text-2xl font-semibold text-white mt-12 mb-4"
        >
          18. Changes to Terms
        </h2>
        <p className="text-slate-400 leading-7">
          We may update these Terms from time to time. If we make material
          changes, we will notify you by posting the updated Terms on our
          website and updating the &quot;Last Updated&quot; date. For
          significant changes, we may also provide notice via email or an
          in-dashboard notification.
        </p>
        <p className="text-slate-400 leading-7">
          Your continued use of the Service after the effective date of revised
          Terms constitutes acceptance of the updated Terms. If you do not agree
          to the revised Terms, you must discontinue use of the Service.
        </p>

        {/* 19. Governing Law */}
        <h2
          id="governing-law"
          className="text-2xl font-semibold text-white mt-12 mb-4"
        >
          19. Governing Law
        </h2>
        <p className="text-slate-400 leading-7">
          These Terms shall be governed by and construed in accordance with the
          laws of the jurisdiction in which SoterAI is incorporated, without
          regard to conflict of law principles. Any disputes arising from or
          relating to these Terms or the Service shall be resolved in the
          courts of that jurisdiction.
        </p>
        <p className="text-slate-400 leading-7">
          If any provision of these Terms is found to be unenforceable, the
          remaining provisions shall continue in full force and effect.
        </p>

        {/* 20. Contact Information */}
        <h2
          id="contact-information"
          className="text-2xl font-semibold text-white mt-12 mb-4"
        >
          20. Contact Information
        </h2>
        <p className="text-slate-400 leading-7">
          If you have questions or concerns about these Terms, please contact
          us:
        </p>
        <ul className="list-disc pl-6 space-y-2 text-slate-400">
          <li>
            <strong className="text-slate-300">General support:</strong>{" "}
            <a
              href="mailto:support@soterai.dev"
              className="text-cyan underline"
            >
              support@soterai.dev
            </a>
          </li>
          <li>
            <strong className="text-slate-300">Security concerns:</strong>{" "}
            <a
              href="mailto:security@soterai.dev"
              className="text-cyan underline"
            >
              security@soterai.dev
            </a>
          </li>
        </ul>

        {/* 21. Last Updated */}
        <h2
          id="last-updated"
          className="text-2xl font-semibold text-white mt-12 mb-4"
        >
          21. Last Updated
        </h2>
        <p className="text-slate-400 leading-7">
          These Terms of Service were last updated on{" "}
          <strong className="text-slate-300">June 2026</strong>.
        </p>
      </div>
    </main>
  );
}
