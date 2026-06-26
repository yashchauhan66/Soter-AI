import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | SoterAI",
  description:
    "SoterAI privacy policy: how we collect, use, and protect your data. Minimized content retention, in-memory processing, encrypted API key storage, and stateless platform integrations.",
  alternates: { canonical: "/privacy" },
  openGraph: {
    title: "Privacy Policy | SoterAI",
    description:
      "SoterAI privacy policy: how we collect, use, and protect your data. Minimized content retention, in-memory processing, encrypted API key storage, and stateless platform integrations.",
    url: "/privacy",
    type: "website",
  },
};

export default function PrivacyPage() {
  return (
    <main className="container-page py-16">
      <p className="eyebrow">Privacy</p>
      <h1 className="mt-3 text-4xl font-bold">Privacy Policy</h1>

      <div className="mt-8 max-w-3xl space-y-5 leading-7 text-slate-400">
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-5 py-4 text-amber-400 text-sm">
          This privacy policy is a product policy draft. It should be reviewed
          by qualified legal counsel before public commercial launch.
        </div>

        {/* 1. Introduction */}
        <h2
          id="introduction"
          className="text-2xl font-semibold text-white mt-12 mb-4"
        >
          1. Introduction
        </h2>
        <p className="text-slate-400 leading-7">
          SoterAI (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) provides
          AI security software including prompt injection detection, data-loss
          prevention, content moderation, red-team analysis, and workflow
          integration tools. This Privacy Policy describes how we collect, use,
          store, and protect information when you use the SoterAI platform,
          APIs, dashboard, marketplace integrations, and related services
          (collectively, the &quot;Service&quot;).
        </p>
        <p className="text-slate-400 leading-7">
          By accessing or using the Service, you agree to this Privacy Policy.
          If you do not agree, please discontinue use of the Service.
        </p>

        {/* 2. Information We Collect */}
        <h2
          id="information-we-collect"
          className="text-2xl font-semibold text-white mt-12 mb-4"
        >
          2. Information We Collect
        </h2>
        <p className="text-slate-400 leading-7">
          We collect the following categories of information:
        </p>
        <ul className="list-disc pl-6 space-y-2 text-slate-400">
          <li>
            <strong className="text-slate-300">Account information:</strong>{" "}
            Email address, display name, organization name, and authentication
            credentials provided during registration.
          </li>
          <li>
            <strong className="text-slate-300">API usage data:</strong> Request
            counts, endpoint usage, response times, error rates, and rate-limit
            metrics associated with your API keys.
          </li>
          <li>
            <strong className="text-slate-300">Integration data:</strong>{" "}
            Configuration metadata for connected workflow platforms (n8n,
            Zapier, Make, Dify, Botpress), including webhook URLs and node
            configuration settings.
          </li>
          <li>
            <strong className="text-slate-300">Dashboard activity:</strong>{" "}
            Pages visited, features used, dashboard preferences, and security
            policy configurations.
          </li>
          <li>
            <strong className="text-slate-300">Support communications:</strong>{" "}
            Emails, tickets, and messages sent to our support or security teams.
          </li>
        </ul>

        {/* 3. AI Workflow Data */}
        <h2
          id="ai-workflow-data"
          className="text-2xl font-semibold text-white mt-12 mb-4"
        >
          3. AI Workflow Data
        </h2>
        <p className="text-slate-400 leading-7">
          SoterAI processes text content (prompts, AI outputs) server-side for
          security analysis. Raw text is processed in-memory and is not
          persisted to long-term storage.
        </p>
        <p className="text-slate-400 leading-7">
          Threat detection summaries (risk scores, categories, timestamps,
          actions taken) are stored for audit and dashboard display. These
          summaries are derived from the analysis but do not contain the
          original raw text.
        </p>
        <p className="text-slate-400 leading-7">
          Where content redaction is applied, only redacted versions, hashes,
          truncated previews, or structured findings are retained. The original
          unredacted content is discarded after processing.
        </p>

        {/* 4. Logs and Audit Records */}
        <h2
          id="logs-and-audit-records"
          className="text-2xl font-semibold text-white mt-12 mb-4"
        >
          4. Logs and Audit Records
        </h2>
        <p className="text-slate-400 leading-7">
          SoterAI maintains audit logs for security events, policy enforcement
          actions, and administrative changes. These logs include:
        </p>
        <ul className="list-disc pl-6 space-y-2 text-slate-400">
          <li>Timestamps and event identifiers</li>
          <li>Risk scores, threat categories, and actions taken (block, flag, allow)</li>
          <li>API key identifiers (not the full key value)</li>
          <li>IP addresses and user-agent strings for security monitoring</li>
          <li>Policy configuration changes and the user who made them</li>
        </ul>
        <p className="text-slate-400 leading-7">
          Audit logs are retained according to the data retention schedule
          described in Section 8. Logs do not contain the raw text content of
          scanned prompts or AI outputs.
        </p>

        {/* 5. API Keys and Authentication */}
        <h2
          id="api-keys-and-authentication"
          className="text-2xl font-semibold text-white mt-12 mb-4"
        >
          5. API Keys and Authentication
        </h2>
        <p className="text-slate-400 leading-7">
          API keys are stored in encrypted form and cannot be retrieved after
          creation. You are shown the full key value only once at the time of
          generation. If a key is lost, it must be revoked and a new key created.
        </p>
        <p className="text-slate-400 leading-7">
          Raw API keys, SCIM tokens, SAML secrets, integration tokens, and
          detected secrets from content scanning are not stored in plaintext.
          Authentication credentials are protected using industry-standard
          hashing and encryption methods.
        </p>

        {/* 6. How We Use Information */}
        <h2
          id="how-we-use-information"
          className="text-2xl font-semibold text-white mt-12 mb-4"
        >
          6. How We Use Information
        </h2>
        <p className="text-slate-400 leading-7">
          We use the information we collect for the following purposes:
        </p>
        <ul className="list-disc pl-6 space-y-2 text-slate-400">
          <li>Providing, operating, and maintaining the Service</li>
          <li>Performing security analysis on submitted content</li>
          <li>Generating threat detection summaries and risk assessments</li>
          <li>Populating dashboards, audit logs, and reporting features</li>
          <li>Enforcing rate limits and usage quotas</li>
          <li>Authenticating users and authorizing API requests</li>
          <li>Responding to support requests and security inquiries</li>
          <li>Improving detection accuracy, performance, and reliability</li>
          <li>Sending service-related communications (outage alerts, security advisories, billing notices)</li>
        </ul>
        <p className="text-slate-400 leading-7">
          We do not sell personal information to third parties. We do not use
          customer content to train machine learning models without explicit
          opt-in consent.
        </p>

        {/* 7. How We Protect Data */}
        <h2
          id="how-we-protect-data"
          className="text-2xl font-semibold text-white mt-12 mb-4"
        >
          7. How We Protect Data
        </h2>
        <p className="text-slate-400 leading-7">
          We implement technical and organizational measures to protect the
          information we process, including:
        </p>
        <ul className="list-disc pl-6 space-y-2 text-slate-400">
          <li>Encryption of data in transit (TLS 1.2+) and at rest</li>
          <li>API key hashing and encrypted storage</li>
          <li>Role-based access controls for internal systems</li>
          <li>CSRF protection, rate limiting, and input validation on all endpoints</li>
          <li>Regular security reviews of application code and infrastructure</li>
          <li>In-memory processing of raw content to minimize data persistence</li>
        </ul>
        <p className="text-slate-400 leading-7">
          While we take reasonable measures to protect your data, no system is
          completely secure. We encourage responsible disclosure of any security
          vulnerabilities to{" "}
          <a href="mailto:security@soterai.dev" className="text-cyan underline">
            security@soterai.dev
          </a>
          .
        </p>

        {/* 8. Data Retention */}
        <h2
          id="data-retention"
          className="text-2xl font-semibold text-white mt-12 mb-4"
        >
          8. Data Retention
        </h2>
        <p className="text-slate-400 leading-7">
          We retain data according to the following guidelines:
        </p>
        <ul className="list-disc pl-6 space-y-2 text-slate-400">
          <li>
            <strong className="text-slate-300">Raw content:</strong> Not
            persisted. Processed in-memory and discarded after analysis
            completes.
          </li>
          <li>
            <strong className="text-slate-300">Threat summaries and audit logs:</strong>{" "}
            Retained for the duration specified by your plan and organization
            settings, typically 30 to 90 days.
          </li>
          <li>
            <strong className="text-slate-300">Account information:</strong>{" "}
            Retained while your account is active and for a reasonable period
            afterward for legal and operational purposes.
          </li>
          <li>
            <strong className="text-slate-300">API usage metrics:</strong>{" "}
            Aggregated usage data may be retained indefinitely in anonymized
            form for capacity planning.
          </li>
        </ul>
        <p className="text-slate-400 leading-7">
          You may request deletion of your account and associated data by
          contacting{" "}
          <a href="mailto:support@soterai.dev" className="text-cyan underline">
            support@soterai.dev
          </a>
          .
        </p>

        {/* 9. Third-Party Integrations */}
        <h2
          id="third-party-integrations"
          className="text-2xl font-semibold text-white mt-12 mb-4"
        >
          9. Third-Party Integrations
        </h2>
        <p className="text-slate-400 leading-7">
          SoterAI provides integration nodes and connectors for workflow
          automation platforms including n8n, Zapier, Make, Dify, and Botpress.
        </p>
        <p className="text-slate-400 leading-7">
          Platform integration nodes (n8n, Zapier, Make, Dify, Botpress) are
          stateless connectors that do not store user data locally. These
          connectors transmit data to SoterAI&apos;s API for processing and
          return results to the calling platform. Data handling on third-party
          platforms is governed by those platforms&apos; respective privacy
          policies.
        </p>
        <p className="text-slate-400 leading-7">
          We recommend reviewing the privacy policies of any third-party
          platforms you connect to SoterAI to understand how they handle data
          that passes through their systems.
        </p>

        {/* 10. Cookies and Analytics */}
        <h2
          id="cookies-and-analytics"
          className="text-2xl font-semibold text-white mt-12 mb-4"
        >
          10. Cookies and Analytics
        </h2>
        <p className="text-slate-400 leading-7">
          The SoterAI dashboard may use the following types of cookies and
          similar technologies:
        </p>
        <ul className="list-disc pl-6 space-y-2 text-slate-400">
          <li>
            <strong className="text-slate-300">Essential cookies:</strong>{" "}
            Required for authentication, session management, and CSRF
            protection. These cannot be disabled.
          </li>
          <li>
            <strong className="text-slate-300">Preference cookies:</strong>{" "}
            Store dashboard preferences, theme settings, and UI state.
          </li>
          <li>
            <strong className="text-slate-300">Analytics:</strong> We may use
            privacy-respecting analytics tools to understand aggregate usage
            patterns. We do not use advertising trackers or share analytics data
            with ad networks.
          </li>
        </ul>
        <p className="text-slate-400 leading-7">
          The SoterAI API does not set cookies. API interactions are
          authenticated solely via API keys transmitted in request headers.
        </p>

        {/* 11. Your Rights */}
        <h2
          id="your-rights"
          className="text-2xl font-semibold text-white mt-12 mb-4"
        >
          11. Your Rights
        </h2>
        <p className="text-slate-400 leading-7">
          Depending on your jurisdiction, you may have the following rights
          regarding your personal information:
        </p>
        <ul className="list-disc pl-6 space-y-2 text-slate-400">
          <li>
            <strong className="text-slate-300">Access:</strong> Request a copy
            of the personal information we hold about you.
          </li>
          <li>
            <strong className="text-slate-300">Correction:</strong> Request
            correction of inaccurate or incomplete personal information.
          </li>
          <li>
            <strong className="text-slate-300">Deletion:</strong> Request
            deletion of your account and associated personal information.
          </li>
          <li>
            <strong className="text-slate-300">Data portability:</strong>{" "}
            Request an export of your data in a structured, machine-readable
            format.
          </li>
          <li>
            <strong className="text-slate-300">Objection:</strong> Object to
            certain processing of your personal information.
          </li>
          <li>
            <strong className="text-slate-300">Withdrawal of consent:</strong>{" "}
            Where processing is based on consent, withdraw consent at any time.
          </li>
        </ul>
        <p className="text-slate-400 leading-7">
          To exercise any of these rights, please contact us at{" "}
          <a href="mailto:support@soterai.dev" className="text-cyan underline">
            support@soterai.dev
          </a>
          . We will respond to requests within 30 days.
        </p>

        {/* 12. Children's Privacy */}
        <h2
          id="childrens-privacy"
          className="text-2xl font-semibold text-white mt-12 mb-4"
        >
          12. Children&apos;s Privacy
        </h2>
        <p className="text-slate-400 leading-7">
          SoterAI is not directed at individuals under 18 years of age. We do
          not knowingly collect personal information from children. If you
          believe we have inadvertently collected information from a child under
          18, please contact us at{" "}
          <a href="mailto:support@soterai.dev" className="text-cyan underline">
            support@soterai.dev
          </a>{" "}
          and we will promptly delete such information.
        </p>

        {/* 13. Changes to This Policy */}
        <h2
          id="changes-to-this-policy"
          className="text-2xl font-semibold text-white mt-12 mb-4"
        >
          13. Changes to This Policy
        </h2>
        <p className="text-slate-400 leading-7">
          We may update this Privacy Policy from time to time to reflect changes
          in our practices, technology, legal requirements, or other factors. If
          we make material changes, we will notify you by posting the updated
          policy on our website and updating the &quot;Last Updated&quot; date
          below. For significant changes, we may also notify you via email or
          through an in-dashboard notification.
        </p>
        <p className="text-slate-400 leading-7">
          Your continued use of the Service after the effective date of a
          revised Privacy Policy constitutes acceptance of the updated terms.
        </p>

        {/* 14. Contact Information */}
        <h2
          id="contact-information"
          className="text-2xl font-semibold text-white mt-12 mb-4"
        >
          14. Contact Information
        </h2>
        <p className="text-slate-400 leading-7">
          If you have questions, concerns, or requests regarding this Privacy
          Policy or our data practices, please contact us:
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

        {/* 15. Last Updated */}
        <h2
          id="last-updated"
          className="text-2xl font-semibold text-white mt-12 mb-4"
        >
          15. Last Updated
        </h2>
        <p className="text-slate-400 leading-7">
          This Privacy Policy was last updated on{" "}
          <strong className="text-slate-300">June 2026</strong>.
        </p>
      </div>
    </main>
  );
}
