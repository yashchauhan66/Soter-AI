export default function PrivacyPage() {
  return (
    <main className="container-page py-16">
      <p className="eyebrow">Privacy</p>
      <h1 className="mt-3 text-4xl font-bold">Privacy commitments</h1>
      <div className="mt-8 max-w-3xl space-y-5 leading-7 text-slate-400">
        <p>SoterAI minimizes retained content by storing redacted text, hashes, previews, and structured findings where practical.</p>
        <p>Raw API keys, SCIM tokens, SAML secrets, integration tokens, and detected secrets are not stored.</p>
      </div>
    </main>
  );
}