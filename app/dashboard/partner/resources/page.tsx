import Link from "next/link";
import { PageHeader } from "@/components/dashboard/PageHeader";
const resources = [["Agency pitch deck", "/docs/sales/agency-pitch.md"],["Client proposal template", "/docs/sales/enterprise-pilot-proposal.md"],["AI chatbot security checklist", "/docs/phase8-production-readiness.md"],["White-label report sample", "/dashboard/reports/white-label"],["Security badge embed guide", "/docs#badge"],["Pricing calculator", "/dashboard/billing"]];
export default function PartnerResourcesPage() { return <div><PageHeader
        eyebrow="Enablement"
        title="Partner resources"
      /><div className="mt-7 grid gap-4 md:grid-cols-2">{resources.map(([title,href]) => <Link className="card p-5 font-semibold hover:border-cyan/50" href={href} key={title}>{title}</Link>)}</div></div>; }
