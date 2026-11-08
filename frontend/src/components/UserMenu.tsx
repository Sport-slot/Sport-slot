"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Buildings, CaretDown, MagnifyingGlass, Plus, SignOut } from "@phosphor-icons/react";
import type { CurrentUser } from "@/lib/api";
import { initialsOf, logout, roleLabels } from "@/lib/auth";

export function Avatar({ name, size = "md" }: { name: string; size?: "md" | "lg" }) {
  const sizeClass = size === "lg" ? "size-11 text-base" : "size-9 text-sm";
  return (
    <span
      aria-hidden="true"
      className={`${sizeClass} flex shrink-0 items-center justify-center rounded-full bg-ball font-display font-bold text-brand-900`}
    >
      {initialsOf(name)}
    </span>
  );
}

export function RoleBadges({ user }: { user: CurrentUser }) {
  return (
    <span className="flex flex-wrap gap-1.5">
      {user.roles.map((role) => (
        <span
          key={role}
          className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-semibold text-brand-700"
        >
          {roleLabels[role]}
        </span>
      ))}
    </span>
  );
}

export function UserMenu({ user, onOpen }: { user: CurrentUser; onOpen?: () => void }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const isManager = user.roles.includes("MANAGER");
  const firstName = user.name.trim().split(/\s+/)[0];

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const itemClass =
    "flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium text-foreground transition-colors hover:bg-surface";

  return (
    <div ref={rootRef} className="relative" onBlur={(event) => {
      if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) setOpen(false);
    }}>
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => { if (!open) onOpen?.(); setOpen(!open); }}
        className="flex min-h-11 items-center gap-2 rounded-full border border-line p-1 transition-colors hover:bg-surface sm:pr-3"
      >
        <Avatar name={user.name} />
        <span className="hidden max-w-32 truncate text-sm font-semibold sm:block">{firstName}</span>
        <CaretDown
          size={14}
          aria-hidden="true"
          className={`hidden transition-transform duration-200 sm:block ${open ? "rotate-180" : ""}`}
        />
        <span className="sr-only">Účet uživatele {user.name}</span>
      </button>
      <div
        id={menuId}
        hidden={!open}
        className="mobile-nav absolute -right-13 mt-3 w-72 max-w-[calc(100vw-2.5rem)] rounded-2xl border border-line bg-page p-2 shadow-[0_18px_50px_-20px_rgba(23,59,43,.45)] sm:right-0"
      >
        <div className="flex items-center gap-3 px-3 pt-2 pb-3">
          <Avatar name={user.name} size="lg" />
          <div className="min-w-0">
            <p className="truncate font-semibold">{user.name}</p>
            <p className="truncate text-xs text-muted">{user.email}</p>
          </div>
        </div>
        <div className="px-3 pb-3">
          <RoleBadges user={user} />
        </div>
        <nav aria-label="Účet" className="border-t border-line pt-2">
          <Link href="/venues" onClick={() => setOpen(false)} className={itemClass}>
            <MagnifyingGlass size={18} aria-hidden="true" /> Najít sportoviště
          </Link>
          {isManager && (
            <>
              <Link href="/venues/mine" onClick={() => setOpen(false)} className={itemClass}>
                <Buildings size={18} aria-hidden="true" /> Moje sportoviště
              </Link>
              <Link href="/venues/new" onClick={() => setOpen(false)} className={itemClass}>
                <Plus size={18} aria-hidden="true" /> Přidat sportoviště
              </Link>
            </>
          )}
        </nav>
        <div className="mt-2 border-t border-line pt-2">
          <button type="button" onClick={logout} className={`${itemClass} w-full`}>
            <SignOut size={18} aria-hidden="true" /> Odhlásit se
          </button>
        </div>
      </div>
    </div>
  );
}
