# Struktura backendu

## 1. Přehled

Backend aplikace SportSlot tvoří sada mikroslužeb implementovaných v Node.js s využitím Express.js. Frontend (Next.js) nekomunikuje se službami přímo, ale prostřednictvím API gateway, která předává požadavky příslušným mikroslužbám.

Seznam API endpointů a jejich parametrů je uveden v [dokumentaci API](api.md).

## 2. Adresářová struktura repozitáře

Projekt je organizován jako monorepo. Závislosti se instalují jednou v kořeni pomocí npm workspaces.

```text
SportSlot/
├── frontend/                # Next.js aplikace (port 3000)
├── gateway/                 # API gateway (port 4000)
├── services/                # Backend mikroslužby (Express.js)
│   ├── auth-service/        # port 4001
│   ├── venue-service/       # port 4002
│   ├── reservation-service/ # port 4003
│   ├── review-service/      # port 4004
│   └── audit-service/       # port 4005
├── db/                      # Databáze (viz db/README.md)
├── docs/                    # Technická dokumentace (api.md, struktura.md)
├── .github/workflows/       # CI workflow (ci.yml)
├── .env.example             # Vzor konfigurace prostředí
└── .nvmrc                   # Požadovaná verze Node.js (22)
```

## 3. API gateway

Gateway přijímá požadavky pod prefixem `/api/` a podle cesty je předává mikroslužbě, která danou oblast vlastní. Prefix `/api` se při předání odstraňuje.

| Cesta                                                 | Cílová mikroslužba  |
| --------------------------------------------------    | ------------------- |
| `/api/auth/…`, `/api/user/…`, `/api/managerRequest/…` | auth-service        |
| `/api/venue/…`, `/api/court/…`, `/api/priceRule/…`    | venue-service       |
| `/api/reservation/…`                                  | reservation-service |
| `/api/review/…`                                       | review-service      |
| `/api/audit/…`                                        | audit-service       |

- Adresy mikroslužeb se konfigurují pomocí proměnných prostředí `*_SERVICE_URL`. Výchozí adresy jsou `http://localhost:4001` až `http://localhost:4005`.
- Endpoint `GET /health` slouží ke kontrole dostupnosti gateway.
- Gateway ověřuje JWT z hlavičky `Authorization: Bearer …` (vydává ho auth-service po přihlášení přes Google). Veřejné endpointy (vyhledání a detail sportoviště, seznam kurtů, přihlášení) projdou i bez tokenu, zakládání sportoviště a kurtu vyžaduje roli `MANAGER`. Podrobnosti v [gateway/README.md](../gateway/README.md).
- Dokumentace API ve Swagger UI je na `GET /api-docs` (zdroj `docs/openapi.yaml`).

## 4. Mikroslužby a vlastnictví dat

Každá mikroslužba odpovídá za určitou oblast aplikace a správu souvisejících dat.

| Mikroslužba         | Port | Spravovaná data             | Odpovědnost                                      |
| ------------------- | ---- | --------------------------- | ------------------------------------------------ |
| auth-service        | 4001 | users, manager_requests      | Uživatelé a jejich role a žádosti o roli správce |
| venue-service       | 4002 | venues, courts, price_rules | Sportoviště, kurty a cenová pravidla             |
| reservation-service | 4003 | reservations                | Rezervace                                        |
| review-service      | 4004 | reviews                     | Hodnocení sportovišť                             |
| audit-service       | 4005 | audit_logs                  | Záznamy o důležitých akcích                      |

Rozdělení dat vychází z datového modelu projektu. Tabulka vyjadřuje logické vlastnictví dat jednotlivými službami, nikoli nutně jejich fyzické oddělení v databázi.

## 5. Průchod požadavku

Běžný požadavek z frontendu prochází následujícími kroky:

1. Frontend odešle požadavek na API gateway pod cestou `/api/…`.
2. Gateway podle cesty vybere cílovou mikroslužbu, odstraní prefix `/api` a předá jí požadavek.
3. Mikroslužba požadavek zpracuje nad svými daty a vrátí odpověď.

Před předáním gateway u chráněných endpointů ověří JWT a roli, odstraní hlavičky identity od klienta a doplní vlastní `x-user-id`, `x-user-roles` a `x-gateway-secret`. Služby věří identitě jen tehdy, když `x-gateway-secret` souhlasí s jejich `GATEWAY_SECRET`.

Mikroslužby mohou komunikovat také přímo mezi sebou. Například `reservation-service` volá endpoint `priceRule/listByCourt` ve `venue-service`, aby získala cenová pravidla potřebná pro výpočet ceny rezervace.

## 6. Struktura jedné mikroslužby

Všechny mikroslužby vycházejí ze společné šablony:

```text
services/<nazev>-service/
├── src/
│   ├── app.js       # Express aplikace a endpoint GET /health
│   └── server.js    # Spuštění serveru na portu z .env
└── test/            # Automatizované testy
```

Testy využívají vestavěný test runner Node.js (`node --test`) a knihovnu Supertest. Spouštějí se příkazem `npm test`.

## 7. Databáze

Data projektu se ukládají do hostované databáze PostgreSQL poskytované službou Supabase. Postup připojení a popis databáze jsou uvedeny v souboru [db/README.md](../db/README.md).