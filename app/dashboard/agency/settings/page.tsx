import { db } from "@/lib/db";
import { getOrCreateAgency } from "@/lib/agency";
import { BrandingForm } from "@/components/dashboard/BrandingForm";

export const dynamic = "force-dynamic";

export default async function AgencySettingsPage() {
  const agency = await getOrCreateAgency();
  const branding = await db.brandingSettings.findUnique({ where: { agencyId: agency.id } });
  return (
    <div>
      <p className="eyebrow">Agency</p>
      <h1 className="mt-2 text-3xl font-bold">Settings &amp; branding</h1>
      <p className="mt-3 text-slate-400">Configure the brand used on white-label reports and the public security status pages.</p>
      <BrandingForm
        agency={{ id: agency.id, name: agency.name, contactEmail: agency.contactEmail ?? "" }}
        branding={branding ? {
          agencyName: branding.agencyName,
          logoUrl: branding.logoUrl ?? "",
          contactEmail: branding.contactEmail ?? "",
          reportFooter: branding.reportFooter ?? "",
          brandColor: branding.brandColor ?? "",
        } : null}
      />
    </div>
  );
}
