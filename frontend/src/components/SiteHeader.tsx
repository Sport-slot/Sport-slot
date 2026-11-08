"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, Buildings, List, MagnifyingGlass, Plus, X } from "@phosphor-icons/react";
import { Logo } from "@/components/Logo";
import { UserMenu } from "@/components/UserMenu";
import { loginPath, useAuth } from "@/lib/auth";

const links = [
  { href: "/venues", label: "Sportoviště" },
  { href: "/#jak-to-funguje", label: "Jak to funguje" },
  { href: "/#pro-spravce", label: "Pro sportoviště" },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { user, loading, openLogin } = useAuth();
  const pathname = usePathname();
  const headerRef = useRef<HTMLElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const showLogin = !loading && !user && pathname !== loginPath;
  const isVenuePage = pathname === "/venues" || pathname.startsWith("/venues/");

  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 8);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  useEffect(() => { setOpen(false); }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        toggleRef.current?.focus();
      }
    };
    const closeOutside = (event: PointerEvent) => {
      if (!headerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const desktop = window.matchMedia("(min-width: 1024px)");
    const closeOnDesktop = () => { if (desktop.matches) setOpen(false); };
    document.addEventListener("keydown", closeOnEscape);
    document.addEventListener("pointerdown", closeOutside);
    desktop.addEventListener("change", closeOnDesktop);
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.removeEventListener("pointerdown", closeOutside);
      desktop.removeEventListener("change", closeOnDesktop);
    };
  }, [open]);

  return (
    <header
      ref={headerRef}
      data-scrolled={scrolled}
      onBlur={(event) => {
        if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
      className="sticky top-0 z-30 border-b border-line/70 bg-page/95 backdrop-blur-md transition-shadow duration-200 data-[scrolled=true]:shadow-[0_8px_30px_-12px_rgba(23,59,43,.2)]"
    >
      <div className="section-wrap flex h-18 items-center justify-between gap-3 md:h-20">
        <Logo className="max-sm:gap-1.5 max-sm:text-[24px] max-[380px]:text-[22px] max-[380px]:[&>svg]:hidden" />
        <nav aria-label="Hlavní navigace" className="hidden items-center gap-1 lg:flex">
          {links.map((link) => {
            const active = link.href === "/venues" && isVenuePage;
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={`inline-flex min-h-11 items-center gap-2 rounded-full px-5 text-sm font-medium transition-colors ${active ? "bg-surface font-semibold text-foreground" : "text-muted hover:bg-surface/70 hover:text-foreground"}`}
              >
                {link.href === "/venues" && <MagnifyingGlass size={17} aria-hidden="true" />}
                {link.label}
              </Link>
            );
          })}
        </nav>
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          {loading && <span aria-hidden="true" className="h-10 w-20 animate-pulse rounded-full bg-surface sm:w-28" />}
          {user && <UserMenu user={user} onOpen={() => setOpen(false)} />}
          {showLogin && (
            <button type="button" onClick={() => { setOpen(false); openLogin(); }} className="button button-dark min-h-11 px-4 py-2.5 sm:px-5">
              Přihlásit se
            </button>
          )}
          <button
            ref={toggleRef}
            type="button"
            className={`flex size-11 items-center justify-center rounded-full border border-line transition-colors hover:bg-surface lg:hidden ${open ? "bg-surface" : ""}`}
            aria-label={open ? "Zavřít navigaci" : "Otevřít navigaci"}
            aria-expanded={open}
            aria-controls="mobile-navigation"
            onClick={() => setOpen(!open)}
          >
            {open ? <X size={21} aria-hidden="true" /> : <List size={21} aria-hidden="true" />}
          </button>
        </div>
      </div>
      <nav
        id="mobile-navigation"
        aria-label="Mobilní navigace"
        hidden={!open}
        className="mobile-nav absolute inset-x-0 top-full max-h-[calc(100dvh-5rem)] overflow-y-auto border-b border-line bg-page px-5 pt-3 pb-6 shadow-[0_20px_30px_-20px_rgba(23,59,43,.3)] md:px-10 lg:hidden"
      >
        {links.map((link) => {
          const active = link.href === "/venues" && isVenuePage;
          return (
            <Link key={link.href} href={link.href} aria-current={active ? "page" : undefined} onClick={() => setOpen(false)} className={`flex min-h-14 items-center justify-between rounded-xl px-4 text-base font-medium transition-colors hover:bg-surface ${active ? "bg-surface font-semibold" : ""}`}>
              {link.label}<ArrowRight size={18} aria-hidden="true" />
            </Link>
          );
        })}
        <div className="mt-3 grid gap-1 border-t border-line pt-3">
          <Link href="/#sporty" onClick={() => setOpen(false)} className="flex min-h-11 items-center rounded-xl px-4 text-sm text-muted hover:bg-surface">Najdi svůj sport</Link>
          <Link href="/#o-sportslotu" onClick={() => setOpen(false)} className="flex min-h-11 items-center rounded-xl px-4 text-sm text-muted hover:bg-surface">O SportSlotu</Link>
          {user?.roles.includes("MANAGER") && (
            <>
              <Link href="/venues/mine" onClick={() => setOpen(false)} className="flex min-h-11 items-center gap-2 rounded-xl px-4 text-sm font-semibold hover:bg-surface">
                <Buildings size={18} aria-hidden="true" /> Moje sportoviště
              </Link>
              <Link href="/venues/new" onClick={() => setOpen(false)} className="flex min-h-11 items-center gap-2 rounded-xl px-4 text-sm font-semibold hover:bg-surface">
                <Plus size={18} aria-hidden="true" /> Přidat sportoviště
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
