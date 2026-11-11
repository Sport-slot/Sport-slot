"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { CaretDown, MagnifyingGlass, MapPin, TennisBall } from "@phosphor-icons/react";
import { capitalize, popularSports } from "@/lib/venueVisuals";

export function HeroSearch() {
  const router = useRouter();
  const [city, setCity] = useState("");
  const [sport, setSport] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = new URLSearchParams();
    if (city.trim()) query.set("city", city.trim());
    if (sport) query.set("sport", sport);
    const search = query.toString();
    router.push(search ? `/venues?${search}` : "/venues");
  }

  return (
    <form role="search" aria-label="Hledat sportoviště" onSubmit={submit} className="grid gap-1.5 rounded-[22px] border border-white/15 bg-brand-900/45 p-1.5 text-white backdrop-blur-xl sm:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)_auto] sm:gap-0">
      <label className="flex min-h-14 items-center gap-3 rounded-2xl px-4 transition-colors focus-within:bg-white/[.07] hover:bg-white/[.05] max-sm:rounded-b-none max-sm:border-b max-sm:border-white/10">
        <MapPin size={20} className="shrink-0 text-white/55" aria-hidden="true" />
        <span className="sr-only">Město</span>
        <input value={city} onChange={(event) => setCity(event.target.value)} name="city" autoComplete="address-level2" placeholder="Kde chceš hrát?" className="w-full min-w-0 bg-transparent text-base outline-none [color-scheme:dark] placeholder:text-white/50" />
      </label>
      <label className="relative flex min-h-14 items-center gap-3 rounded-2xl px-4 transition-colors focus-within:bg-white/[.07] hover:bg-white/[.05] sm:border-l sm:border-white/12">
        <TennisBall size={20} className="shrink-0 text-white/55" aria-hidden="true" />
        <span className="sr-only">Sport</span>
        <select value={sport} onChange={(event) => setSport(event.target.value)} name="sport" className={`w-full min-w-0 appearance-none bg-transparent pr-6 text-base outline-none [color-scheme:dark] [&>option]:bg-brand-900 [&>option]:text-white ${sport ? "" : "text-white/50"}`}>
          <option value="">Jakýkoli sport</option>
          {popularSports.map((name) => <option key={name} value={name}>{capitalize(name)}</option>)}
        </select>
        <CaretDown size={14} className="pointer-events-none absolute right-4 text-white/55" aria-hidden="true" />
      </label>
      <button type="submit" className="button button-primary min-h-14 gap-2.5 rounded-2xl px-7 hover:translate-y-0">
        <MagnifyingGlass size={19} weight="bold" aria-hidden="true" /> Hledat
      </button>
    </form>
  );
}
