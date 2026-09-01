import { db } from "@/lib/db";
import { getOrCreateAgency } from "@/lib/agency";
import { BrandingForm } from "@/components/dashboard/BrandingForm";
import { PageHeader } from "@/components/dashboard/PageHeader";

export const dynamic = "force-dynamic";

export default async function AgencySettingsPage() {
  const agency = await getOrCreateAgency();
  const branding = await db.brandingSettings.findUnique({ where: { agencyId: agency.id } });
  return (
    <div>
      <PageHeader
        eyebrow="Agency"
        title="Settings &amp; branding"
        description="Configure the brand used on white-label reports and the public security status pages."
      />
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
