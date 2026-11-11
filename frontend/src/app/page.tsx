import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, Check, MagnifyingGlass, MapPin, Plus, Sun } from "@phosphor-icons/react/dist/ssr";
import { LogoMark } from "@/components/Logo";
import { Reveal } from "@/components/Reveal";
import { HeroMedia } from "@/components/HeroMedia";
import { HeroSearch } from "@/components/HeroSearch";
import { OwnerCta } from "@/components/OwnerCta";

const quickSports = ["tenis", "padel", "badminton", "fotbal"];

const sportTiles = [
  { sport: "tenis", name: "Tenis", line: "Antuka, tvrdý povrch i haly přes zimu.", image: "/images/venues/tennis-clay.webp", alt: "Antukový tenisový kurt shora", className: "col-span-2 row-span-2 min-h-[340px] lg:min-h-0" },
  { sport: "padel", name: "Padel", line: "Ve čtyřech je to lepší.", image: "/images/padel.webp", alt: "Hráči padelu na venkovním kurtu se skleněnou stěnou", className: "col-span-2 min-h-[220px] lg:min-h-0" },
  { sport: "badminton", name: "Badminton", line: "Vypni hlavu. Zapni hru.", image: "/images/venues/badminton-hall.webp", alt: "Badmintonová hala s kurty", className: "min-h-[200px] lg:min-h-0" },
  { sport: "fotbal", name: "Fotbal", line: "Malá kopaná po práci.", image: "/images/venues/football.webp", alt: "Fotbalové hřiště s umělým trávníkem shora", className: "min-h-[200px] lg:min-h-0" },
];
const moreSports = ["volejbal", "basketbal", "squash"];

const ownerFeatures = [
  "Sportoviště, adresa a fotka na jednom místě",
  "Otevírací doba pro každý den zvlášť",
  "Kurty s povrchem, sporty a halou či venkem",
];

const faqs = [
  { question: "Co je SportSlot?", answer: "SportSlot je vznikající platforma pro rezervace sportovišť. Spojuje hráče, kteří hledají místo pro svou další hru, se správci kurtů a sportovních areálů." },
  { question: "Můžu si už rezervovat skutečný kurt?", answer: "Zatím ne. Sportoviště, jejich kurty a otevírací dobu už můžeš procházet a hledat podle města a sportu. Online rezervace přidáme v dalším kroku." },
  { question: "Jaké sporty tu najdu?", answer: "Tenis, padel, badminton, squash, volejbal, fotbal i basketbal. Konkrétní nabídka záleží na sportovištích, která se do SportSlotu zapojí." },
  { question: "Jak přidám své sportoviště?", answer: "Přihlášený správce vyplní název, adresu, fotku, otevírací dobu a kurty v průvodci pro nové sportoviště. Veřejnou registraci správců zatím připravujeme." },
];

const weekBars = [
  { day: "Po", from: 7, to: 22 },
  { day: "Út", from: 7, to: 22 },
  { day: "St", from: 7, to: 22 },
  { day: "Čt", from: 7, to: 22 },
  { day: "Pá", from: 7, to: 23 },
  { day: "So", from: 8, to: 20 },
  { day: "Ne", from: 8, to: 20 },
];

function sportHref(sport: string) {
  return `/venues?sport=${encodeURIComponent(sport)}`;
}

export default function Home() {
  return (
    <main id="main-content">
      <section aria-labelledby="hero-title" className="mx-auto max-w-[1440px] px-3 pt-3 sm:px-5 sm:pt-5 md:px-6">
        <div className="relative isolate flex min-h-[640px] flex-col justify-end overflow-hidden rounded-[28px] bg-brand-900 text-white lg:min-h-[min(760px,86dvh)]">
          <HeroMedia />
          <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(8,31,21,.86)_0%,rgba(8,31,21,.5)_50%,rgba(8,31,21,.05)_100%)]" />
          <div aria-hidden="true" className="absolute inset-x-0 bottom-0 -z-10 h-1/2 bg-linear-to-t from-[rgba(8,31,21,.7)] to-transparent" />
          <div className="hero-copy max-w-[920px] px-5 pt-16 pb-24 sm:px-10 md:px-16 md:pb-16">
            <p className="text-sm font-medium text-ball sm:text-base">Tvůj čas. Tvoje hra.</p>
            <h1 id="hero-title" className="mt-4 font-display text-[clamp(2.9rem,7vw,6.25rem)] leading-[.98] font-semibold tracking-[-.055em] text-balance">Méně domlouvání.<br /><span className="text-ball">Více hraní.</span></h1>
            <p className="mt-6 max-w-[34rem] text-base leading-relaxed text-white/85 sm:text-lg">Najdi kurt, halu nebo hřiště ve svém městě. Podívej se, kdy mají otevřeno, a vyraz.</p>
            <div className="mt-9 max-w-[760px]">
              <HeroSearch />
              <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
                <span className="mr-1 text-white/65">Rovnou na</span>
                {quickSports.map((sport) => (
                  <Link key={sport} href={sportHref(sport)} className="inline-flex min-h-9 items-center rounded-full border border-white/20 bg-white/8 px-3.5 font-medium text-white backdrop-blur-sm transition-colors hover:border-white/40 hover:bg-white/15 focus-visible:outline-white">
                    {sport.charAt(0).toLocaleUpperCase("cs") + sport.slice(1)}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="sporty" aria-labelledby="sports-title" className="section-wrap scroll-mt-28 pt-24 pb-20 md:pt-32 md:pb-28">
        <Reveal className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <h2 id="sports-title" className="section-heading">Na co máš dnes chuť?</h2>
            <p className="mt-4 max-w-lg text-base leading-relaxed text-muted">Na známý kurt, nebo něco úplně nového? Vyber sport a podívej se, kde se dá hrát.</p>
          </div>
          <Link href="/venues" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold underline decoration-line underline-offset-8 hover:decoration-current">Všechna sportoviště <ArrowRight size={17} aria-hidden="true" /></Link>
        </Reveal>

        <Reveal delay={60} stagger="li" className="mt-10">
          <ul className="grid grid-cols-2 gap-3 sm:gap-4 lg:h-[560px] lg:grid-cols-4 lg:grid-rows-2">
            {sportTiles.map((tile) => (
              <li key={tile.sport} className={tile.className}>
                <Link href={sportHref(tile.sport)} className="group relative isolate flex size-full flex-col justify-end overflow-hidden rounded-2xl bg-brand-900 p-5 text-white sm:p-6">
                  <Image src={tile.image} alt={tile.alt} fill sizes="(min-width: 1024px) 50vw, 100vw" className="-z-20 object-cover transition-transform duration-700 ease-[cubic-bezier(.16,1,.3,1)] group-hover:scale-[1.04]" />
                  <span aria-hidden="true" className="absolute inset-0 -z-10 bg-linear-to-t from-[rgba(8,31,21,.85)] via-[rgba(8,31,21,.25)] to-transparent" />
                  <span aria-hidden="true" className="absolute top-4 right-4 flex size-10 items-center justify-center rounded-full bg-page/90 text-foreground transition-colors duration-300 group-hover:bg-ball group-hover:text-brand-900">
                    <ArrowUpRight size={18} weight="bold" />
                  </span>
                  <h3 className="font-display text-2xl leading-none font-semibold tracking-[-.03em] sm:text-3xl">{tile.name}</h3>
                  <p className="mt-2 max-w-[28ch] text-sm leading-snug text-white/80">{tile.line}</p>
                </Link>
              </li>
            ))}
          </ul>
        </Reveal>
        <Reveal delay={120} className="mt-5 flex flex-wrap items-center gap-2 text-sm">
          <span className="mr-1 text-muted">Další sporty</span>
          {moreSports.map((sport) => (
            <Link key={sport} href={sportHref(sport)} className="inline-flex min-h-10 items-center rounded-full border border-line px-4 font-medium transition-colors hover:border-muted hover:bg-surface">
              {sport.charAt(0).toLocaleUpperCase("cs") + sport.slice(1)}
            </Link>
          ))}
        </Reveal>
      </section>

      <section id="jak-to-funguje" aria-labelledby="how-title" className="scroll-mt-24 border-y border-line bg-surface">
        <div className="section-wrap py-20 md:py-28">
          <Reveal>
            <h2 id="how-title" className="section-heading max-w-2xl text-balance">Od „jdeme hrát?“ rovnou ke hře.</h2>
            <p className="mt-5 max-w-lg text-base leading-relaxed text-muted">Méně zpráv ve skupině. Méně volání na recepci. Více času na to, kvůli čemu ses vlastně domluvil.</p>
          </Reveal>
          <Reveal stagger=":scope > ol > li" className="mt-14">
            <ol className="grid gap-10 md:grid-cols-3 md:gap-6">
              <Step number={1} title="Najdi svoje místo." text="Zadej město a sport. Uvidíš sportoviště, kurty a jejich povrch.">
                <div className="flex items-center gap-2.5 rounded-xl border border-line bg-surface/60 px-3.5 py-3 text-sm">
                  <MapPin size={16} className="text-muted" />Praha
                  <span className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-ball px-2.5 py-1 text-xs font-semibold text-brand-900"><MagnifyingGlass size={12} weight="bold" />Hledat</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5 text-xs font-medium">
                  <span className="rounded-full bg-foreground px-3 py-1.5 text-page">Tenis</span>
                  <span className="rounded-full border border-line px-3 py-1.5">Padel</span>
                  <span className="rounded-full border border-line px-3 py-1.5">Badminton</span>
                </div>
              </Step>
              <Step number={2} title="Zjisti, kdy mají otevřeno." text="Na detailu vidíš, jestli je teď otevřeno, kurty a cestu na místo.">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="inline-flex items-center gap-2 font-semibold"><span className="size-2 rounded-full bg-brand-500 shadow-[0_0_0_4px] shadow-brand-500/20" />Otevřeno</span>
                  <span className="text-muted">Zavírá ve 22:00</span>
                </div>
                <ul className="mt-3 divide-y divide-line border-t border-line text-xs">
                  {[["01", "Kurt 1", "Antuka"], ["02", "Kurt 2", "Antuka"], ["03", "Hala", "Parket"]].map(([n, name, surface]) => (
                    <li key={n} className="flex items-center gap-3 py-2"><span className="text-muted tabular-nums">{n}</span><span className="font-semibold">{name}</span><span className="ml-auto inline-flex items-center gap-1 text-muted">{n === "03" ? null : <Sun size={12} />}{surface}</span></li>
                  ))}
                </ul>
              </Step>
              <Step number={3} title="Zarezervuj si čas." text="Výběr volného termínu online připravujeme. Brzy na jedno kliknutí." badge="Připravujeme">
                <div className="grid grid-cols-4 gap-1.5 text-center text-xs font-medium tabular-nums">
                  {["16:00", "17:00", "18:00", "19:00", "20:00", "21:00"].map((time) => (
                    <span key={time} className={`rounded-lg py-2 ${time === "18:00" ? "bg-ball text-brand-900" : time === "17:00" || time === "20:00" ? "bg-surface/70 text-muted line-through" : "border border-line"}`}>{time}</span>
                  ))}
                </div>
              </Step>
            </ol>
          </Reveal>
        </div>
      </section>

      <section id="o-sportslotu" aria-labelledby="about-title" className="section-wrap scroll-mt-24 py-20 md:py-32">
        <Reveal className="grid items-center gap-10 md:grid-cols-[1.1fr_.9fr] md:gap-20">
          <div className="relative aspect-[6/5] overflow-hidden rounded-2xl bg-brand-900"><Image src="/images/community.webp" alt="Tři přátelé se po tenisu smějí u sítě" fill sizes="(max-width: 767px) 100vw, 55vw" className="object-cover" /></div>
          <div>
            <LogoMark className="mb-8 size-12 text-brand-600" />
            <h2 id="about-title" className="section-heading">Nejde jen<br />o skóre.</h2>
            <p className="mt-6 max-w-md text-base leading-7 text-muted">Jde o ten pocit po zápase. O smích u sítě. O hodinu, kdy jsi byl hlavou úplně jinde.</p>
            <p className="mt-4 max-w-md text-base leading-7 text-muted">SportSlot vzniká pro všechny, kteří chtějí sport dostat zpátky do svého týdne. Ať hraješ na body, nebo jen tak.</p>
            <p className="mt-8 font-display text-xl font-semibold">Tvůj další dobrý den začíná hrou.</p>
          </div>
        </Reveal>
      </section>

      <section id="pro-spravce" aria-labelledby="owners-title" className="section-wrap scroll-mt-28 pb-20 md:pb-28">
        <Reveal className="relative isolate overflow-hidden rounded-[28px] bg-brand-900 p-7 text-white sm:p-10 md:p-14">
          <div className="pointer-events-none absolute -top-30 -left-24 -z-10 size-[520px] rotate-[-18deg] text-white/[.03]" aria-hidden="true"><LogoMark className="size-full" /></div>
          <div className="grid gap-12 lg:grid-cols-[1fr_1fr] lg:items-center lg:gap-20">
            <div>
              <p className="text-sm font-medium text-ball">Pro správce sportovišť</p>
              <h2 id="owners-title" className="mt-4 font-display text-[clamp(2.2rem,4.4vw,3.8rem)] leading-[1.04] font-semibold tracking-[-.045em]">Váš kurt.<br />Jejich nejlepší hodina dne.</h2>
              <p className="mt-6 max-w-md text-base leading-7 text-white/75">Dejte hráčům prostor pro další zápas. Správa sportoviště má zabrat méně času než samotná hra.</p>
              <ul className="mt-8 grid gap-3 text-[15px]">
                {ownerFeatures.map((feature) => (
                  <li key={feature} className="flex items-start gap-3"><span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-ball text-brand-900"><Check size={12} weight="bold" aria-hidden="true" /></span>{feature}</li>
                ))}
              </ul>
              <div className="mt-10"><OwnerCta /></div>
            </div>
            <OwnerPreview />
          </div>
        </Reveal>
      </section>

      <section id="otazky" aria-labelledby="faq-title" className="section-wrap scroll-mt-28 pb-20 md:pb-28">
        <Reveal className="grid gap-8 md:grid-cols-[.75fr_1.25fr] md:gap-20" stagger="h2, details"><h2 id="faq-title" className="section-heading">Ještě něco<br />před hrou?</h2><div>{faqs.map(item=><details key={item.question} className="faq group border-b border-line first:border-t"><summary className="flex min-h-20 cursor-pointer list-none items-center justify-between gap-5 py-5 text-base font-medium [&::-webkit-details-marker]:hidden">{item.question}<span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-full border border-line transition-[transform,background-color,border-color,color] duration-300 ease-[cubic-bezier(.16,1,.3,1)] group-hover:border-foreground group-open:rotate-45 group-open:border-ball group-open:bg-ball group-open:text-brand-900"><Plus size={18} /></span></summary><p className="faq-answer max-w-xl pb-6 pr-8 text-sm leading-7 text-muted">{item.answer}</p></details>)}</div></Reveal>
      </section>

      <section aria-labelledby="final-cta-title" className="section-wrap pb-20 md:pb-28">
        <div className="relative isolate overflow-hidden rounded-[28px] bg-ball px-7 py-14 text-brand-900 sm:px-10 md:px-16 md:py-20">
          <LogoMark className="pointer-events-none absolute -right-16 -bottom-24 -z-10 size-[420px] rotate-[-18deg] text-brand-900/[.07]" />
          <div className="flex flex-col items-start justify-between gap-8 md:flex-row md:items-end">
            <h2 id="final-cta-title" className="max-w-2xl font-display text-[clamp(2.6rem,6vw,5rem)] leading-[.98] font-semibold tracking-[-.05em]">Tak co,<br />dáme hru?</h2>
            <Link href="/venues" className="button bg-brand-900 text-white hover:bg-brand-700">Najít sportoviště <ArrowUpRight size={20} aria-hidden="true" /></Link>
          </div>
        </div>
      </section>
    </main>
  );
}

function Step({ number, title, text, badge, children }: { number: number; title: string; text: string; badge?: string; children: React.ReactNode }) {
  return (
    <li className="flex flex-col">
      <div aria-hidden="true" className="relative flex h-44 flex-col justify-center rounded-2xl border border-line bg-page p-5 shadow-[0_24px_50px_-36px_rgb(23_59_43/.45)]">
        {badge && <span className="absolute top-3 right-3 rounded-md bg-surface px-2 py-0.5 text-[11px] font-medium text-muted">{badge}</span>}
        {children}
      </div>
      <p className="mt-6 font-display text-sm font-semibold text-muted tabular-nums">0{number}</p>
      <h3 className="mt-1 font-display text-2xl font-semibold tracking-[-.025em]">{title}</h3>
      <p className="mt-2 max-w-sm text-sm leading-6 text-muted">{text}</p>
    </li>
  );
}

function OwnerPreview() {
  const start = 6;
  const span = 18;
  return (
    <figure className="rounded-2xl border border-white/12 bg-white/[.04] p-5 backdrop-blur-sm sm:p-7">
      <div aria-hidden="true">
        <div className="flex items-center justify-between gap-4">
          <p className="font-display text-lg font-semibold">Vaše sportoviště</p>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-ball/15 px-2.5 py-1 text-xs font-medium text-ball"><span className="size-1.5 rounded-full bg-ball" />Aktivní</span>
        </div>
        <p className="mt-6 text-xs font-medium text-white/55">Otevírací doba</p>
        <div className="mt-3 grid gap-2.5">
          {weekBars.map(({ day, from, to }) => (
            <div key={day} className="grid grid-cols-[1.75rem_minmax(0,1fr)_5.5rem] items-center gap-3 text-xs">
              <span className="text-white/60">{day}</span>
              <span className="relative h-1.5 rounded-full bg-white/10">
                <span className="absolute inset-y-0 rounded-full bg-ball/85" style={{ left: `${((from - start) / span) * 100}%`, right: `${100 - ((to - start) / span) * 100}%` }} />
              </span>
              <span className="text-right text-white/75 tabular-nums">{String(from).padStart(2, "0")}:00–{to}:00</span>
            </div>
          ))}
        </div>
        <p className="mt-7 text-xs font-medium text-white/55">Kurty</p>
        <ul className="mt-2 divide-y divide-white/10 text-sm">
          {[["Kurt 1", "Tenis · Antuka", "Venku"], ["Kurt 2", "Tenis · Antuka", "Venku"], ["Hala", "Badminton · Parket", "V hale"]].map(([name, detail, setting]) => (
            <li key={name} className="flex items-center gap-3 py-2.5"><span className="font-semibold">{name}</span><span className="text-white/60">{detail}</span><span className="ml-auto text-xs text-white/50">{setting}</span></li>
          ))}
        </ul>
      </div>
      <figcaption className="mt-5 border-t border-white/10 pt-4 text-xs text-white/50">Ukázka správy sportoviště</figcaption>
    </figure>
  );
}
