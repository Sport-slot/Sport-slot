import type { Metadata } from "next";
import { RequireRole } from "@/components/RequireRole";
import { MyVenues } from "@/components/MyVenues";

export const metadata: Metadata = {
  title: "Moje sportoviště · SportSlot",
};

export default function MyVenuesPage() {
  return (
    <RequireRole roles={["MANAGER"]} reason="Přehled svých sportovišť vidí jen přihlášený správce.">
      <MyVenues />
    </RequireRole>
  );
}
