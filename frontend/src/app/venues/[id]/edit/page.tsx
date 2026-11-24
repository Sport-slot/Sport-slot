import type { Metadata } from "next";
import { RequireRole } from "@/components/RequireRole";
import { VenueEditor } from "@/components/venue-wizard/VenueEditor";

export const metadata: Metadata = {
  title: "Upravit sportoviště · SportSlot",
};

export default async function EditVenuePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <RequireRole roles={["MANAGER"]} reason="Sportoviště může upravit jen přihlášený správce. Po přihlášení budete pokračovat tady.">
      <VenueEditor venueId={id} />
    </RequireRole>
  );
}
