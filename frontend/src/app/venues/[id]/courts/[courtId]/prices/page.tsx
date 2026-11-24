import type { Metadata } from "next";
import { RequireRole } from "@/components/RequireRole";
import { CourtPricing } from "@/components/court-form/CourtPricing";

export const metadata: Metadata = {
  title: "Ceník kurtu · SportSlot",
};

export default async function CourtPricingPage({
  params,
}: {
  params: Promise<{ id: string; courtId: string }>;
}) {
  const { id, courtId } = await params;
  return (
    <RequireRole roles={["MANAGER"]} reason="Ceník kurtu může nastavit jen přihlášený správce sportoviště. Po přihlášení budete pokračovat tady.">
      <CourtPricing venueId={id} courtId={courtId} />
    </RequireRole>
  );
}
