# Gateway

API brána projektu SportSlot. Přijímá HTTP požadavky na `/api/...`, ověřuje JWT tokeny a oprávnění uživatelů a předává požadavky příslušným backendovým mikroslužbám.

## 1. Směrování požadavků

Gateway odstraňuje prefix `/api` a předává požadavek službě, která danou oblast vlastní.

| Cesta | Služba | Výchozí port |
|---|---|---|
| `/api/auth/...` | auth-service | 4001 |
| `/api/managerRequest/...` | auth-service | 4001 |
| `/api/venue/...` | venue-service | 4002 |
| `/api/court/...` | venue-service | 4002 |
| `/api/priceRule/...` | venue-service | 4002 |
| `/api/reservation/...` | reservation-service | 4003 |
| `/api/review/...` | review-service | 4004 |
| `/api/audit/...` | audit-service | 4005 |

Příklad: `POST /api/court/create` je po kontrole oprávnění předán do venue-service jako `POST /court/create`.

`GET /health` je veřejný endpoint Gateway a vrací:

```json
{
  "status": "ok",
  "service": "gateway"
}
```

## 2. Autentizace – JWT

Gateway používá JWT podepsané algoritmem HS256 podle týmového Auth kontraktu.

Frontend posílá token v HTTP hlavičce:

```http
Authorization: Bearer <token>
```

Middleware `src/middleware/auth.js`:

- Ověřuje podpis JWT pomocí `JWT_SECRET`.
- Kontroluje platnost tokenu a čas expirace.
- Vyžaduje `userId` ve formátu UUID.
- Kontroluje role `PLAYER`, `MANAGER`, `ADMIN`.
- Vyžaduje, aby každý uživatel měl roli `PLAYER`.
- Nepřijímá token s deklarovanou platností delší než 24 hodin.
- Ukládá ověřené `userId` a `roles` do `req.auth`.

Chybějící, neplatný nebo expirovaný token vrací HTTP 401.

Gateway tokeny nevydává. Jejich vytváření při přihlášení zajišťuje auth-service. Obě služby musí používat stejný `JWT_SECRET` v daném prostředí.

## 3. Autorizace – kontrola rolí

Middleware `src/middleware/roles.js` kontroluje oprávnění uživatele pomocí `requireRole(requiredRole)`.

Pokud uživatel nemá požadovanou roli, vrací HTTP 403.

### Veřejné endpointy

Následující endpointy nevyžadují JWT:

| Metoda | Endpoint |
|---|---|
| POST | `/api/auth/googleCallback` |
| GET | `/api/venue/list` |
| GET | `/api/venue/get` |
| GET | `/api/court/list` |
| GET | `/api/priceRule/listByCourt` |
| GET | `/api/review/listByVenue` |

Veřejný je také `GET /health`.

### Endpointy vyžadující roli MANAGER

| Metoda | Endpoint |
|---|---|
| POST | `/api/venue/create` |
| POST | `/api/court/create` |
| POST | `/api/priceRule/create` |

Ostatní požadavky směrované do mikroslužeb vyžadují platný JWT, ale aktuální Gateway pro ně neprovádí další specifickou kontrolu rolí.

Role `ADMIN` automaticky nenahrazuje roli `MANAGER`.

Kontrola vlastnictví sportoviště a další business pravidla jsou odpovědností příslušné backendové služby.

## 4. Komunikace s mikroslužbami

Po úspěšném ověření JWT předává Gateway do backendové služby následující interní hlavičky:

```http
x-user-id: <ověřené UUID>
x-user-roles: PLAYER,MANAGER
x-gateway-secret: <interní tajný klíč>
```

Gateway odstraňuje případné klientem podvržené hlavičky `x-user-id`, `x-user-roles` a `x-gateway-secret` a nastavuje vlastní důvěryhodné hodnoty.

U veřejných endpointů se `x-user-id` a `x-user-roles` nenastavují.

**Důležité:** Backendové služby musí samostatně ověřovat `x-gateway-secret` nebo být dostupné pouze přes důvěryhodné interní spojení. Samotné předání hlavičky nezajišťuje ochranu proti přímému volání služby. Tato integrace musí být dokončena před produkčním nasazením.

## 5. Formát chyb

Gateway používá společný workspace balíček `@sportslot/api-format` a formát `uuAppErrorMap` podle `docs/api.md`.

| HTTP status | Kód chyby | Význam |
|---|---|---|
| 401 | `notAuthenticated` | Chybějící nebo neplatný JWT |
| 403 | `notAuthorized` | Nedostatečná oprávnění |
| 404 | `unknownCommand` | Neznámý endpoint |
| 503 | `authUnavailable` | Chybějící konfigurace JWT |
| 503 | `gatewayUnavailable` | Chybějící konfigurace interního klíče |

Příklad odpovědi pro `POST /api/court/create` bez tokenu:

```json
{
  "uuAppErrorMap": {
    "court/create/notAuthenticated": {
      "type": "error",
      "message": "Nejste přihlášen.",
      "paramMap": {}
    }
  }
}
```

## 6. CORS

Gateway povoluje komunikaci z frontendu definovaného proměnnou `FRONTEND_ORIGIN`.

- Povoluje metody `GET`, `POST`, `PATCH`, `DELETE` a `OPTIONS`.
- Povoluje hlavičky `Authorization` a `Content-Type`.
- Podporuje CORS preflight požadavky.
- Nepoužívá credentials ani cookies.

CORS je ochranný mechanismus prohlížeče, nikoli náhrada JWT autentizace.

## 7. Konfigurace prostředí

Lokální konfigurace je uložena v root `.env`, podle šablony `.env.example`.

| Proměnná | Účel |
|---|---|
| `GATEWAY_PORT` | Port Gateway, výchozí `4000` |
| `JWT_SECRET` | Sdílený klíč pro podepisování a ověřování JWT |
| `GATEWAY_SECRET` | Interní klíč pro komunikaci Gateway se službami |
| `FRONTEND_ORIGIN` | Povolená adresa frontendu |
| `AUTH_SERVICE_URL` | Adresa auth-service |
| `VENUE_SERVICE_URL` | Adresa venue-service |
| `RESERVATION_SERVICE_URL` | Adresa reservation-service |
| `REVIEW_SERVICE_URL` | Adresa review-service |
| `AUDIT_SERVICE_URL` | Adresa audit-service |

`JWT_SECRET` a `GATEWAY_SECRET` musí být odlišné, bezpečně vygenerované hodnoty dlouhé alespoň 32 znaků.

Skutečné klíče a hesla nikdy necommitovat do GitHubu. V `.env.example` jsou pouze zástupné hodnoty.

## 8. Lokální spuštění

Požadavky:

- Node.js 22+
- npm
- Nainstalované závislosti projektu

Z kořene repozitáře:

```bash
npm ci
```

Vytvořit root `.env` podle `.env.example` a nastavit potřebné proměnné.

Spuštění Gateway ve vývojovém režimu:

```bash
npm run dev:gateway
```

Gateway standardně běží na `http://localhost:4000`.

Kontrola dostupnosti:

```bash
curl http://localhost:4000/health
```

Pro správné přeposílání požadavků musí být dostupné také odpovídající mikroslužby na nakonfigurovaných adresách.

## 9. Testování

Jednotkové a integrační testy používají Node.js test runner a Supertest.

Spuštění testů Gateway:

```bash
npm test --workspace @sportslot/gateway
```

Kontrola ESLint:

```bash
npm run lint --workspace @sportslot/gateway
```

Testovací soubory:

- `test/app.test.js` – health endpoint, směrování a 404.
- `test/auth.test.js` – ověřování JWT, podpisu, rolí a expirace.
- `test/roles.test.js` – kontrola rolí a odpovědi 401/403.
- `test/gateway-auth.test.js` – integrační testy Gateway, předávání identity, ochrana hlaviček a CORS.

Aktuální testovací sada obsahuje 20 úspěšně ověřených testů Gateway.

Všechny testy používají testovací konfiguraci a falešné backendové služby. Nevyžadují přístup k Supabase.

## 10. Aktuální integrační návaznosti

Gateway middleware pro JWT, role, interní hlavičky, CORS a společný formát chyb je implementovaný a otestovaný.

Před dokončením integrace celého systému je ještě potřeba:

- Zajistit ověřování `x-gateway-secret` v backendových službách nebo bezpečné omezení jejich přímé dostupnosti.
- Ověřit kompatibilitu se skutečným JWT vydaným auth-service.
- Doplnit a otestovat směrování `/api/user/me` podle schváleného Auth kontraktu.
- Zkontrolovat oprávnění dalších endpointů podle jejich API dokumentace.

Tyto návaznosti nejsou pokryté současnými testy Gateway a musí být vyřešeny před produkčním nasazením.