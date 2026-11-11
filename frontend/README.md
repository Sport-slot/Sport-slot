# Frontend

Frontend aplikace v Next.js.
## Spuštění

```bash
npm install          # v kořeni repozitáře (npm workspaces)
npm run dev:frontend # http://localhost:3000
```

Adresu API gateway čte aplikace z `NEXT_PUBLIC_API_URL` (viz `.env.example`).

### Lokální ukázka detailu sportoviště

Po spuštění `npm run dev:frontend` otevřete [localhost:3000/venues/preview](http://localhost:3000/venues/preview). Stránka používá skutečnou komponentu detailu s ukázkovými daty podle seedu Sportcentra; nepotřebuje API ani databázi. Fungují filtry sportů, zvětšení fotografie a kopírování odkazu. Ukázka je dostupná pouze ve vývojovém režimu, v produkci vrací 404.

Styling je v Tailwind CSS v4 (dohodnuto v týmu 4. 11. 2026). Layouty používají utility třídy v `className`; `globals.css` obsahuje barevné tokeny, několik sdílených komponentových tříd a přístupné animace. Vlastní hodnoty patří do bloku `@theme`, samostatný `tailwind.config` není potřeba.

### Brand

- Barvy jsou v `@theme` v `globals.css`: `brand-50` až `brand-900` (zelená kurtu), `ball` (žlutozelená tenisového míčku, jen na akcenty a hlavní CTA), `ink-500` a `ink-900` pro text. Používejte je místo výchozí palety Tailwindu (`text-brand-900`, `bg-ball`…).
- Písma: `font-display` (Bricolage Grotesque) na nadpisy, `font-sans` (Inter) na text. Jsou self-hostovaná v `public/fonts` včetně češtiny a licencí; načítá je `fonts.css` s `font-display: swap`.
- Logo: `<Logo />` (značka + název, odkaz na úvod) a `<LogoMark />` (jen značka) v `src/components/Logo.tsx`, favicon je `src/app/icon.svg`.
- Hlavička (`SiteHeader`) a patička (`SiteFooter`) jsou v root layoutu. V pravé části hlavičky je tlačítko „Přihlásit se“ (odkaz na `/login`, zobrazí se jen nepřihlášenému). Přihlášenému uživateli ukazuje jméno a tlačítko „Odhlásit se“.

Podklady značky, marketingové texty a zadání pro AI video jsou v [`docs/brand`](../docs/brand/README.md). Hero obsahuje tiché nekonečné video na pozadí s pauzou, statickým fallbackem a respektem k reduced motion / save-data. Video `public/media/court-loop.mp4` je AI záběr tenistky (720p, zrychleno na 1,25×, 3,5 s), konec je prolnutý se začátkem, aby smyčka nenaskočila. Plakát před spuštěním videa je jeho první snímek `public/images/hero-poster.webp`. Rezervace na úvodní stránce je jasně označená frontendová ukázka bez odesílání dat.

## Ochrana stránek podle role

Stránku chráníte obalením obsahu komponentou `RequireRole`:

```tsx
<RequireRole roles={["MANAGER"]}>…</RequireRole>
```

Bez `roles` stačí libovolný přihlášený uživatel. Nepřihlášený uživatel je přesměrován na `/login?next=<aktuální cesta>`, přihlášený bez potřebné role vidí „Nemáte oprávnění“.

Dokud není hotové `user/me`, lze použít mock uživatele (`visitor`, `player`, `manager`, `admin`):

```bash
NEXT_PUBLIC_MOCK_ROLE=manager npm run dev:frontend
```

`NEXT_PUBLIC_MOCK_ROLE` je jen pro lokální vývoj – nikdy ho nenastavujte na Vercelu. Hodnota se vkládá do buildu, takže by se tam každý návštěvník stal mock uživatelem.

## Přihlášení

Stránka `/login` zobrazí tlačítko Google (Google Identity Services, `NEXT_PUBLIC_GOOGLE_CLIENT_ID` z `.env.example`). Google vrátí ID token, `signInWithGoogle()` z `@/lib/api` ho pošle na `POST /api/auth/googleCallback` a `signIn()` z `useAuth()` uloží JWT aplikace i uživatele. Pak stránka přesměruje na `safeNextPath(next)` z `@/lib/auth` – nikdy přímo na hodnotu `next`. Parametr `next` se čte přes `useSearchParams()`, proto je obsah stránky v `<Suspense>`.

JWT je v `localStorage` (`sportslot.token`) a chráněné endpointy ho dostávají v hlavičce `Authorization: Bearer …` – volejte `fetch` s `headers: { ...authHeaders() }`. Při 401 z `user/me` se token smaže a uživatel je brán jako nepřihlášený.

Odhlášení je `logout()` z `@/lib/auth` (tlačítko v hlavičce): smaže token a načte úvodní stránku. Backend žádné odhlášení nemá. Samotné `setUser(null)` na chráněné stránce by přesměrovalo na přihlášení s `next` na tuto stránku.

`RequireRole` je jen UX, ne bezpečnostní hranice: obsah serverových komponent uvnitř je i tak v HTML stránky. Citlivá data načítejte až v klientské komponentě po přihlášení – oprávnění vždy ověřuje backend.

## Založení sportoviště

Formulář je na `/venues/new` (jen role `MANAGER`). Volá `createVenue()` z `@/lib/api`, tedy `POST /api/venue/create`. S nastaveným `NEXT_PUBLIC_MOCK_ROLE` místo API použije mock: sportoviště drží v paměti prohlížeče a druhé se stejným názvem, adresou a městem odmítne chybou `venue/create/venueAlreadyExists` (409).

Předpokládaný dtoIn (dokud není hotová dokumentace API v Command listu):

```json
{
  "name": "Sportcentrum Lužánky",
  "address": "Lidická 1",
  "city": "Brno",
  "description": "…",
  "openingHoursList": [{ "dayOfWeek": 1, "openTime": "08:00", "closeTime": "22:00" }]
}
```

`dayOfWeek` je 1 = pondělí až 7 = neděle, zavřené dny v seznamu nejsou.
