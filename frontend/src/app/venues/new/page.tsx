import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { CaretRight } from "@phosphor-icons/react/dist/ssr";
import { RequireRole } from "@/components/RequireRole";
import { VenueWizard } from "@/components/venue-wizard/VenueWizard";

export const metadata: Metadata = {
  title: "Nové sportoviště · SportSlot",
};

export default function NewVenuePage() {
  return (
    <RequireRole roles={["MANAGER"]} reason="Sportoviště může založit jen přihlášený správce. Po přihlášení budete pokračovat tady.">
      <main id="main-content" className="section-wrap pt-7 pb-16 md:pt-10 md:pb-24">
        <nav aria-label="Drobečková navigace">
          <ol className="flex flex-wrap items-center gap-1.5 text-sm text-muted">
            <li>
              <Link href="/venues" className="inline-flex min-h-11 items-center font-medium hover:text-foreground hover:underline">
                Sportoviště
              </Link>
            </li>
            <li aria-hidden="true"><CaretRight size={12} /></li>
            <li aria-current="page" className="font-medium text-foreground">Nové sportoviště</li>
          </ol>
        </nav>
        <h1 className="mt-4 font-display text-[clamp(2rem,4.5vw,3.25rem)] leading-[1.08] font-semibold tracking-[-.045em]">
          Založte sportoviště
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted md:text-lg">
          Údaje, otevírací doba a fotka. Kurty přidáte hned potom.
        </p>
        <Suspense fallback={<div aria-hidden="true" className="mt-8 h-96 animate-pulse rounded-3xl bg-surface" />}>
          <VenueWizard />
        </Suspense>
      </main>
    </RequireRole>
  );
}
