import type { Metadata } from "next";
import { RequireRole } from "@/components/RequireRole";
import { CourtCreator } from "@/components/court-form/CourtCreator";

export const metadata: Metadata = {
  title: "Nový kurt · SportSlot",
};

export default async function NewCourtPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <RequireRole roles={["MANAGER"]} reason="Kurt může přidat jen přihlášený správce sportoviště. Po přihlášení budete pokračovat tady.">
      <CourtCreator venueId={id} />
    </RequireRole>
  );
}
