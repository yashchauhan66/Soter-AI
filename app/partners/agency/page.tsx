import type { Metadata } from "next";
import Link from "next/link";
const resources=["White-label security reports","Client and chatbot portfolio","Signed alerts and policy controls","Referral code and commission placeholder","Proposal, pitch, and demo resources","Security badge deployment guide"];
export const metadata: Metadata = {
  title: "Agency Partner Program | SoterAI",
  description:
    "Offer AI chatbot security as a managed service with SoterAI's agency partner program. White-label reports, client portfolios, security badges, and partner resources.",
  alternates: { canonical: "/partners/agency" },
};

export default function AgencyPartnerPage(){return <main className="container-page py-16"><p className="eyebrow">Agency partner program</p><h1 className="mt-2 text-4xl font-bold">Offer AI chatbot security as a managed service</h1><p className="mt-5 max-w-3xl text-slate-300">Protect client AI workflows with reusable guard integrations, defensive monitoring, and honest white-label reporting.</p><div className="mt-8 flex gap-3"><Link className="button-primary" href="/signup">Join partner beta</Link><Link className="button-secondary" href="/contact">Talk to partnerships</Link></div><div className="mt-12 grid gap-4 md:grid-cols-2">{resources.map(resource=><div className="card p-5 font-medium" key={resource}>{resource}</div>)}</div><p className="mt-8 text-sm text-slate-500">Verified and Premium tiers require operational review. Commission payouts are not active until commercial and tax terms are finalized.</p></main>}
