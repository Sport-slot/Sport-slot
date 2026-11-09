# SportSlot 

## Pravidla pro větve
* Nové funkce vyvíjíme ve větvích s prefixem: `feature/<nazev-ukolu>`
* Opravy chyb: `bugfix/<nazev-chyby>`

## Pravidla pro commity
Každá commit zpráva musí začínat jedním z následujících prefixů podle toho, co přesně mění:
* **feat:** Přidání nové funkcionality (např. `feat: založení endpointu pro kurty`)
* **fix:** Oprava chyby (např. `fix: oprava padání vyhledávání`)
* **refactor:** Úprava struktury kódu bez změny chování (např. `refactor: přepsání komponenty detailu`)
* **chore:** Pomocné práce a konfigurace (např. `chore: úprava CI`)
* **docs:** Úprava dokumentace (např. `docs: doplnění návodu k databázi`)

## Jak otevřít Pull Request (PR)
1. Pushněte svou branch na GitHub.
2. Otevřete PR proti větvi `main`.
3. Vyplňte automatickou šablonu.
4. Před mergem musí PR schválit minimálně 1 další člen týmu.

## Lokální vývoj
Potřebujete Node.js 22 (`.nvmrc`). Repozitář používá npm workspaces – závislosti se instalují jednou v kořeni.

```bash
npm install
npm run dev:frontend   # Next.js na http://localhost:3000
npm run dev:gateway    # API gateway na http://localhost:4000
npm run dev --workspace services/venue-service   # jednotlivá služba (porty 4001–4005)
```

| Část | Složka | Port |
|---|---|---|
| Frontend (Next.js) | `frontend/` | 3000 |
| API gateway | `gateway/` | 4000 |
| auth-service | `services/auth-service/` | 4001 |
| venue-service | `services/venue-service/` | 4002 |
| reservation-service | `services/reservation-service/` | 4003 |
| review-service | `services/review-service/` | 4004 |
| audit-service | `services/audit-service/` | 4005 |

Proměnné prostředí jsou popsané v `.env.example`.

Frontend jde spustit i proti nasazenému backendu bez lokální databáze: do `frontend/.env.local` dejte `NEXT_PUBLIC_API_URL=https://sport-slot-api.onrender.com/api` a `NEXT_PUBLIC_GOOGLE_CLIENT_ID` z `.env.example` a spusťte `npm run dev:frontend`. Gateway povoluje CORS vždy pro `http://localhost:3000` a `http://127.0.0.1:3000`, další adresy se přidávají do `FRONTEND_ORIGIN` (víc adres oddělte čárkou).

## Kontroly (CI)
Každý PR do `main` spouští GitHub Actions (`.github/workflows/ci.yml`):
* název větve `feature/…` nebo `bugfix/…`,
* commit zprávy s prefixem `feat:`, `fix:`, `refactor:`, `chore:` nebo `docs:`,
* `npm run lint`, `npm test` a `npm run build` ve všech částech.

Stejné kontroly spustíte lokálně příkazy `npm run lint`, `npm test` a `npm run build`.

## Jak přidat nový endpoint do OpenAPI
1. Otevři soubor `docs/openapi.yaml`.
2. V sekci `paths` přidej požadovanou cestu a HTTP metodu (`get`, `post` atd.).
3. Po uložení souboru se dokumentace automaticky aktualizuje na adrese `/api-docs`.

## Nasazení

| Část | Kde | Adresa |
|---|---|---|
| Frontend | Vercel, projekt `sport-slot` | https://sport-slot.vercel.app |
| Backend (gateway + služby) | Render, služba `sport-slot-api` | https://sport-slot-api.onrender.com |
| Databáze | Supabase | viz `db/README.md` |

### Backend na Renderu
Celý backend běží jako jedna webová služba: `scripts/start-backend.mjs` spustí všech pět mikroslužeb na interních portech 4001–4005 a gateway na portu, který přidělí Render (`PORT`). Když kterýkoli proces spadne, skončí celá služba a Render ji restartuje. Jedna služba se vejde do free tarifu.

Nastavení je v `render.yaml` (Render Blueprint):
1. Render → **New → Blueprint** → vybrat tento repozitář (větev `main`).
2. Vyplnit `DATABASE_URL` (Supabase, session pooler, port 5432). `JWT_SECRET` a `GATEWAY_SECRET` Render vygeneruje sám, `GOOGLE_CLIENT_ID` a `FRONTEND_ORIGIN` jsou v `render.yaml`.
3. Po nasazení ověřit `https://sport-slot-api.onrender.com/health` a Swagger na `/api-docs`.

Free služba po 15 minutách nečinnosti usne a první požadavek pak trvá asi minutu. Před demem ji probuďte otevřením `/health`.

### Frontend na Vercelu
Nastavení projektu (Settings → Build and Deployment):
* Root Directory: `frontend`, Framework Preset: Next.js, zapnuté „Include files outside the root directory“ (kvůli npm workspaces a kořenovému `package-lock.json`).
* Install a Build Command ponechat výchozí. Instalace jen frontendu nespouští `prisma generate`, Prisma klient se generuje až při instalaci balíčku `db`.

V Settings → Environment Variables nastavit a pak spustit nový deploy:
* `NEXT_PUBLIC_API_URL` = `https://sport-slot-api.onrender.com/api`
* `NEXT_PUBLIC_GOOGLE_CLIENT_ID` = Client ID z `.env.example`

`NEXT_PUBLIC_MOCK_ROLE` na Vercelu nikdy nenastavujte.

Adresa frontendu musí být v `FRONTEND_ORIGIN` na Renderu (víc adres oddělte čárkou), jinak gateway zablokuje požadavky přes CORS. Dřívější frontend na Netlify (https://sport-slot.netlify.app) už se neaktualizuje, jeho adresa v `FRONTEND_ORIGIN` zůstává jen kvůli kompatibilitě.

### Google přihlášení
OAuth Client ID (projekt `sportslot-513614`) musí mít v Google Cloud Console → Credentials v **Authorized JavaScript origins** adresu frontendu (`https://sport-slot.vercel.app`) a pro lokální vývoj `http://localhost:3000`. Redirect URI ani client secret aplikace nepoužívá – frontend dostane ID token přímo od Google a backend ho ověří proti Client ID. Client secret do repozitáře nepatří.

## Fotky sportovišť

Fotky demo sportovišť v `frontend/public/images/venues/` jsou z [Unsplash](https://unsplash.com) pod [Unsplash License](https://unsplash.com/license) (volné použití i bez uvedení autora, autory přesto uvádíme):

| Soubor | Autor |
|---|---|
| `tennis-clay.webp` | Maurits Bausenhart |
| `tennis-blue.webp` | Gilley Aguilar |
| `football.webp` | Izuddin Helmi Adnan |
| `basketball-hall.webp` | Mattia Graziani |
| `volleyball.webp` | Michele Feola |
| `padel.webp` | Sergio Contreras |
| `sports-hall.webp` | Dmitry Ant |
| `badminton-hall.webp` | Palak Pitroda |
| `sports-dome.webp` | Gabriele Romano |
