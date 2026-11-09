# SportSlot: identita a frontend

Značka pro lidi, kteří chtějí dostat sport zpátky do svého týdne.

**Hlavní sdělení:** Méně domlouvání. Více hraní.

**Podpůrné sdělení:** Tvůj čas. Tvoje hra.

## Vizuální systém

Symbol je atletický ovál shora: dvě dráhy, které končí uprostřed protilehlých zatáček (vpravo nahoře a vlevo dole) šikmým řezem pod 45°. Mezery jsou volné sloty, ovál je sportoviště. Nejde o písmeno S, aby se značka nepletla se „swoosh“ symboly jiných sportovních aplikací. Používejte dodané SVG, nepřekreslujte symbol podle generovaných mockupů.

| Role | Barva |
| --- | --- |
| Hlavní zelená | `#173B2B` |
| Akcent a hlavní CTA | `#D2F34C` |
| Světlé pozadí | `#F7F9F4` |
| Vedlejší text | `#5A685F` |

Nadpisy a wordmark používají Bricolage Grotesque. Běžný text používá Inter. Obě písma jsou uložená lokálně v `frontend/public/fonts`, včetně licencí a rozšířené latinky pro češtinu. Web se při buildu ani načítání nespoléhá na Google Fonts.

Kolem loga nechte alespoň čtvrtinu výšky symbolu volného místa. Symbol používejte od 24 px, celé logo od 120 px. Neměňte poměr stran, nepřidávejte stíny ani obrysy. Na tmavých fotografiích použijte světlou variantu a dostatečný kontrast.

## Soubory

Všechny výstupy jsou v `frontend/public/brand`:

- `sportslot-logo-{forest,chalk,lime}.svg`: logo s textem převedeným na křivky.
- Stejnojmenné PNG: průhledné exporty pro prezentace a sociální sítě.
- `sportslot-symbol-{forest,chalk,lime}.svg`: samostatný symbol.
- `sportslot-avatar.{svg,png}`: profilový obrázek.
- `sportslot-identity.{svg,png}`: přesný přehled identity.
- `sportslot-social-landscape.jpg`: 1200 × 630 pro sdílení.
- `sportslot-social-portrait.jpg`: 1080 × 1350 pro feed.
- `sportslot-brand-kit.zip`: balíček log, přehledu identity, vizualizací, sociálních grafik a tohoto návodu.

Přesné vektorové exporty a sociální grafiky lze obnovit příkazem `node scripts/build-brand-assets.cjs`. Skript využívá `fontkit`, `wawoff2` a knihovnu `sharp` dodávanou s Next.js. Logo je kreslené jako SVG, text v exportech je převedený na křivky.

## Fotografie a hero video

Čtyři původní AI fotografie jsou v `frontend/public/images`. Vznikly pomocí vestavěného generátoru obrázků, nikoliv stažením cizích fotografií. Nezobrazují nabídku skutečných partnerských sportovišť.

`frontend/public/media/court-loop.mp4` je **dočasný desetisekundový kamerový pohyb nad AI fotografií**. Neobsahuje skutečně generovaný pohyb hráčky. Finální AI video s tenisovým úderem zatím není vygenerované: je potřeba připojený video generátor. Zadání je v `hero-video-brief.md`. Hotové video může nahradit tento soubor bez změny komponenty.

Komponenta `HeroMedia` zajišťuje:

- tiché nekonečné přehrávání pomocí `muted`, `loop`, `playsInline`;
- nejdřív optimalizovaný obrázek, video až po inicializaci klienta;
- ovládání přehrávání a pauzy;
- pozastavení mimo viewport i na neaktivní kartě;
- statický obraz při preferenci omezeného pohybu a při zapnutém šetření dat;
- zachování obrázku při chybě přehrávání.

Nejde o samostatný přehrávač filmu. Video je součást pozadí hlavního hero bloku, jak bylo upřesněno v zadání.

## Frontend a obsah

Původní frontend používal zelenou paletu, Bricolage Grotesque / Inter, malé logo kurtu, statickou ilustraci a opakované textové karty. Redesign zachovává rodinu barev, písma, cestu `/venues/new` a kotvy `#jak-to-funguje`, `#pro-spravce`. Přidává fotografickou hierarchii, vlastní symbol, responzivní navigaci, decentní vstupní animace, FAQ a značkové sdílecí obrázky.

Designová intenzita: variabilita 7/10, pohyb 6/10, hustota 3/10. Základ tvoří existující Next.js 15, React 19 a Tailwind 4. Animace používají CSS a Web Animations API; není přidaný framework pro animace.

Interaktivní rezervace je čistě frontendová ukázka. Nevytváří rezervaci, neodesílá data a nepředstírá skutečnou dostupnost. Původní formulář pro založení sportoviště zůstává dostupný přihlášeným správcům. Návštěvník bez této role dostane vysvětlení v dialogu, protože v této větvi není implementovaná přihlašovací stránka.

Backend, databáze a autentizace se tímto úkolem neimplementují. Žádné změny nejsou publikované na sportelo.cz.

## Kontrola

- `npm run lint --workspace frontend`
- `npm run build --workspace frontend`
- `npm run start --workspace frontend -- --port 3012`

Před zveřejněním ověřte desktop i mobil, světlý/tmavý režim, klávesnici, otevření a zavření dialogu, výběr termínu, pauzu videa a reduced motion ve skutečném prohlížeči. Automatický browser byl v této relaci zablokovaný sandboxem, proto vizuální kontrola celé stránky není potvrzená.

Pro produkční sdílecí odkazy nastavte `NEXT_PUBLIC_SITE_URL` na skutečnou adresu nasazeného frontendu. Bez ní se na Vercelu použije produkční adresa projektu (`VERCEL_PROJECT_PRODUCTION_URL`), na Netlify proměnná `URL`. Lokální fallback je `http://localhost:3000`; není zvolena ani přivlastněna doména sportelo.cz.
