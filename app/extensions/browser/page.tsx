import Link from "next/link";

export const metadata = {
  title: "SoterAI Browser Extension",
  description: "Guarded AI browsing for Chrome and Microsoft Edge with SoterAI Browser Guard.",
};

export default function BrowserExtensionPage() {
  return (
    <main className="container-page py-16">
      <h1 className="text-3xl font-bold text-white">SoterAI Browser Guard</h1>
      <p className="mt-4 max-w-2xl text-slate-400">
        Install SoterAI in your favorite browser to get real-time AI protection while you use web-based chatbots and copilots.
      </p>

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <section className="rounded-2xl border border-slate-800 bg-slate-950/60 p-6">
          <h2 className="text-xl font-semibold text-white">Chrome and Microsoft Edge</h2>
          <p className="mt-2 text-sm text-slate-400">One command to install the same guarded experience across browsers that share the WebExtensions API.</p>
          <Link
            href="https://soterai.in/extensions/browser/chrome"
            className="mt-4 inline-flex items-center text-sm font-medium text-cyan hover:text-cyan-300"
          >
            Install for Chrome →
          </Link>
          <Link
            href="https://soterai.in/extensions/browser/edge"
            className="mt-2 inline-flex items-center text-sm font-medium text-cyan hover:text-cyan-300"
          >
            Install for Microsoft Edge →
          </Link>
        </section>

        <aside className="text-sm text-slate-500">
          <p>This page is intentionally lightweight so it can be embedded as a card in your main marketing flows.</p>
        </aside>
      </div>
    </main>
  );
}
