import type { Metadata } from "next";
import { RequireRole } from "@/components/RequireRole";
import { MyReservations } from "@/components/MyReservations";

export const metadata: Metadata = {
  title: "Moje rezervace · SportSlot",
};

export default function MyReservationsPage() {
  return (
    <RequireRole roles={["PLAYER"]} reason="Své rezervace uvidíte po přihlášení. Po přihlášení budete pokračovat tady.">
      <MyReservations />
    </RequireRole>
  );
}
