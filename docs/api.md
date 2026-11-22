# Specifikace API (SportSlot)

Tento dokument obsahuje seznam endpointů, které zajišťuje `venue-service` (správa sportovišť a kurtů). 
Gateway předává požadavky této službě po ověření uživatele v `auth-service`.

## 0. Formát odpovědí a chyb

Platí pro gateway i všechny mikroslužby. Vychází ze šablony commandu v Command listu (uuApp). Implementace je v balíčku `packages/api-format` (`@sportslot/api-format`).

### Úspěšná odpověď
HTTP 200, tělo = dtoOut a vždy klíč `uuAppErrorMap` (bez varování prázdný `{}`).

```json
{ "id": "…", "name": "Tenisový areál Lužánky", "uuAppErrorMap": {} }
```

Seznamy vracejí `itemList` a `pageInfo` (výchozí `pageSize` je 20):

```json
{ "itemList": [ … ], "pageInfo": { "pageIndex": 0, "pageSize": 20, "total": 42 }, "uuAppErrorMap": {} }
```

### Chyba
Tělo obsahuje jen `uuAppErrorMap`. Klíč je `{command}/{kódChyby}`, např. `venue/get/venueDoesNotExist`. `message` je česky, aby ji frontend mohl rovnou zobrazit. `paramMap` nese podrobnosti (může být `{}`).

```json
{
  "uuAppErrorMap": {
    "venue/get/venueDoesNotExist": {
      "type": "error",
      "message": "Sportoviště nenalezeno.",
      "paramMap": { "id": "…" }
    }
  }
}
```

### Varování
Požadavek projde (HTTP 200), varování je v `uuAppErrorMap` s `"type": "warning"`. Jediné společné varování je `unsupportedKeys`: dtoIn obsahuje klíče, které command nezná, a ty se ignorují. `paramMap`: `{ "unsupportedKeyList": ["foo"] }`.

### HTTP statusy a kódy chyb

| HTTP | Kód chyby | Kdy | Zpráva |
|---|---|---|---|
| 400 | `invalidDtoIn` | dtoIn neprošel validací nebo tělo není platný JSON. `paramMap`: `invalidTypeKeyMap`, `invalidValueKeyMap`, `missingKeyMap` | Vstupní data nejsou platná. |
| 401 | `notAuthenticated` | Command vyžaduje přihlášení a uživatel přihlášený není. | Nejste přihlášen. |
| 403 | `notAuthorized` | Uživatel nemá potřebnou roli nebo není vlastníkem (např. cizí sportoviště). | Nemáte oprávnění. |
| 404 | `{entita}DoesNotExist` | Záznam neexistuje, např. `venue/get/venueDoesNotExist`. | Např. Sportoviště nenalezeno. |
| 404 | `unknownCommand` | Neexistující URL. | Neznámý příkaz. |
| 409 | `{entita}AlreadyExists` | Porušení jedinečnosti, např. `venue/create/venueAlreadyExists`, `court/create/courtAlreadyExists`. | Např. Kurt s tímto názvem už existuje. |
| 500 | `unexpectedError` | Neočekávaná chyba serveru. Podrobnosti jen v logu služby, nikdy v odpovědi. | Neočekávaná chyba serveru. |

Kódy chyb jsou anglicky v camelCase. Každý command uvádí své konkrétní chyby v sekci **Seznam chyb** v Command listu.

### Použití v mikroslužbě

```js
import { AppError, invalidDtoIn, unsupportedKeys } from '@sportslot/api-format'

app.get('/venue/get', async (req, res) => {
	if (!req.query.id) throw invalidDtoIn({ missingKeyMap: { id: 'Klíč id je povinný.' } })
	const venue = await venueDao.get(req.query.id)
	if (!venue) throw new AppError('venueDoesNotExist', 'Sportoviště nenalezeno.', 404, { id: req.query.id })
	res.json({ ...venue, uuAppErrorMap: unsupportedKeys(req, req.query, ['id']) })
})
```

Command (`venue/get`) se do klíče doplní automaticky z URL. `app.use(notFound)` a `app.use(errorHandler)` jsou už zapojené v `app.js` každé služby i gateway; nové routy se přidávají **před** ně. Express 5 předá vyhozenou chybu do `errorHandler` i z `async` funkce. Pro 401 a 403 jsou připravené `notAuthenticated()` a `notAuthorized()`.

### Frontend
Když `response.ok` je `false`, zobrazte `message` první položky v `uuAppErrorMap`. Pro konkrétní chování (např. přesměrování na přihlášení při 401) rozhodujte podle HTTP statusu nebo podle konce klíče (`…/notAuthenticated`), ne podle textu zprávy.

## 1. Sportoviště (Venue)

### `POST venue/create`
* **Popis:** Založení nového sportoviště (US 3, BUC 1).
* **Práva:** Správce (role `PLAYER` + `MANAGER`). Vlastníkem sportoviště se stane přihlášený uživatel.
* **dtoIn (JSON):** `name` (1–100 znaků), `address` (1–200), `city` (1–100), `description?` (max. 2000), `openingHoursList: [{ dayOfWeek, openTime, closeTime }]` – 1 až 7 položek, každý den nejvýš jednou, `dayOfWeek` 1–7 (Po–Ne), časy `"HH:MM"`, zavření po otevření, `imageUrl?` (odkaz z `venueImage/upload` nahraný stejným správcem, nebo ilustrační fotka `/images/venues/*.webp`). Texty se ořezávají o mezery.
* **dtoOut:** `id, managerId, name, address, city, description, imageUrl, createdAt, openingHoursList` (seřazené podle dne).
* **Poznámka:** Sportoviště i otevírací doba se uloží v jednom zápisu. Ve vyhledávání se zobrazí až po přidání prvního kurtu.
* **Chyby:** `venue/create/invalidDtoIn` (400, klíče položek např. `openingHoursList[0].closeTime`), `notAuthenticated` (401), `notAuthorized` (403), `venue/create/venueAlreadyExists` (409 – stejný název, adresa a město), varování `venue/create/unsupportedKeys`.

### `POST venueImage/upload`
* **Popis:** Nahrání hlavní fotky sportoviště před jeho založením (průvodce „Nové sportoviště", krok Fotka).
* **Práva:** Správce (role `PLAYER` + `MANAGER`).
* **dtoIn:** tělo požadavku jsou přímo bajty obrázku, `Content-Type` `image/jpeg`, `image/png` nebo `image/webp`, max. 3 MB. Server ověří, že obsah odpovídá deklarovanému formátu. Frontend fotku před nahráním zmenší (delší strana max. 1920 px, WebP).
* **dtoOut:** `id, imageUrl` (`/venueImage/get?id=…`), `contentType, size, createdAt`.
* **Poznámka:** Fotka se ukládá do tabulky `venue.venue_images` (sloupec `bytea`). Ke sportovišti se připojí předáním `imageUrl` do `venue/create`.
* **Chyby:** `venueImage/upload/invalidDtoIn` (400, prázdné tělo), `notAuthenticated` (401), `notAuthorized` (403), `venueImage/upload/imageTooLarge` (413), `venueImage/upload/unsupportedImageType` (415).

### `GET venueImage/get`
* **Popis:** Vrátí bajty nahrané fotky s hlavičkou `Cache-Control: public, max-age=31536000, immutable`.
* **Práva:** Veřejné.
* **dtoIn (query):** `id` (UUID).
* **Chyby:** `venueImage/get/invalidDtoIn` (400), `venueImage/get/venueImageDoesNotExist` (404).

### `POST venue/setActive`
* **Popis:** Deaktivace nebo opětovná aktivace sportoviště (BUC Správce deaktivuje sportoviště). Sportoviště se nemaže.
* **Práva:** Správce (role `PLAYER` + `MANAGER`), který sportoviště založil.
* **dtoIn (JSON):** `id` (UUID), `active` (boolean).
* **dtoOut:** `id, name, active, deactivatedAt` (`null` u aktivního).
* **Poznámka:** Deaktivované sportoviště se nevrací ve `venue/list`; kurty, hodnocení a rezervace zůstávají. Opakované volání se stejnou hodnotou nic nemění. `reservation/create` (S2) musí deaktivované sportoviště odmítnout.
* **Chyby:** `venue/setActive/invalidDtoIn` (400), `notAuthenticated` (401), `notAuthorized` (403 – není vlastník), `venue/setActive/venueDoesNotExist` (404), varování `venue/setActive/unsupportedKeys`.

### `GET venue/listMine`
* **Popis:** Přehled „Moje sportoviště“ (BUC Správce zobrazí svá sportoviště).
* **Práva:** Správce (role `PLAYER` + `MANAGER`); vrací jen sportoviště přihlášeného správce.
* **dtoIn:** žádné.
* **dtoOut:** `itemList: [{ id, name, city, imageUrl, active, deactivatedAt, courtCount, sports: [], createdAt }]` seřazené podle názvu. Obsahuje i deaktivovaná sportoviště a sportoviště bez kurtů.
* **Chyby:** `notAuthenticated` (401), `notAuthorized` (403), varování `venue/listMine/unsupportedKeys`.

### `GET venue/list`
* **Popis:** Vyhledání sportovišť podle sportu a města (US 6, BUC 3).
* **Práva:** Návštěvník (nepřihlášený) i Hráč.
* **dtoIn (query):** `city?`, `sport?`, `pageIndex?` (od 0), `pageSize?` (1–100, výchozí 20). Filtry fungují samostatně i společně; `city` i `sport` ignorují velikost písmen a diakritiku (`plzen` = `Plzeň`). Prázdný text = bez filtru.
* **dtoOut:** `itemList: [{ id, name, city, imageUrl, sports: [] }]` seřazené podle názvu, `pageInfo: { pageIndex, pageSize, total }`.
* **Poznámka:** Vrací jen aktivní sportoviště, která mají alespoň jeden kurt.
* **Chyby:** `venue/list/invalidDtoIn` (400), varování `venue/list/unsupportedKeys`.

### `GET venue/get`
* **Popis:** Detail konkrétního sportoviště (US 6, BUC 3).
* **Práva:** Návštěvník i Hráč.
* **dtoIn (query):** `id` (UUID, povinné).
* **dtoOut:** `id, name, address, city, description, imageUrl, active, deactivatedAt, isOwner, openingHours: [{ dayOfWeek, openTime, closeTime }], courts: [{ id, name, sport, surface, indoor }]`. Čas je `"HH:MM"`, `dayOfWeek` 1–7 (Po–Ne).
* **Deaktivace:** detail vrací i deaktivované sportoviště (`active: false`, `deactivatedAt`), aby odkazy fungovaly a frontend mohl zobrazit upozornění. `isOwner` je `true` jen tehdy, když požadavek nese platný JWT vlastníka; gateway u veřejných endpointů token volitelně ověří a identitu předá službě.
* **Chyby:** `venue/get/invalidDtoIn` (400), `venue/get/venueDoesNotExist` (404), varování `venue/get/unsupportedKeys`.

`imageUrl` je cesta k fotce sportoviště (např. `/images/venues/padel.webp`) nebo `null`, když fotka není; frontend pak použije fotku podle sportu.

Hodnocení (průměr recenzí) zatím venue/list ani venue/get nevrací. Recenze patří `review-service`, doplní se v S3.

## 2. Kurty (Court)

### `POST court/create`
* **Popis:** Přidání nového kurtu pod existující sportoviště (US 4, BUC 2).
* **Práva:** Správce (musí být vlastníkem sportoviště).
* **dtoIn (JSON):** `venueId` (UUID), `name` (1–50 znaků), `sport` (1–50), `surface` (1–100), `indoor` (boolean).
* **dtoOut:** `id, venueId, name, sport, surface, indoor`.
* **Chyby:** `court/create/invalidDtoIn` (400), `notAuthenticated` (401), `notAuthorized` (403 – chybí role nebo cizí sportoviště), `court/create/venueDoesNotExist` (404), `court/create/courtAlreadyExists` (409 – název kurtu ve sportovišti už existuje).

### `GET court/list`
* **Popis:** Získání seznamu všech kurtů daného sportoviště (US 5).
* **Práva:** Návštěvník i Hráč.
* **dtoIn (query):** `venueId` (UUID, povinné), `pageIndex?` (od 0), `pageSize?` (výchozí 20).
* **dtoOut:** `itemList: [{ id, venueId, name, sport, surface, indoor }]` seřazené podle názvu, `pageInfo`.
* **Chyby:** `court/list/invalidDtoIn` (400), `court/list/venueDoesNotExist` (404).

### `GET court/availability`
* **Popis:** Volné a obsazené termíny kurtu pro zvolený den (US 5).
* **Práva:** Návštěvník i Hráč.
* **dtoIn (query):** `courtId` (UUID), `date` (`YYYY-MM-DD`, místní datum v Praze).
* **dtoOut:** `courtId, venueId, date, dayOfWeek` (1–7, Po–Ne), `openTime, closeTime` (`"HH:MM"`, `null` když je v ten den zavřeno), `slotList: [{ startTime, endTime, startAt, endAt, free }]`. `startTime`/`endTime` jsou místní `"HH:MM"`, `startAt`/`endAt` okamžik v ISO 8601 (UTC) pro `reservation/create`.
* **Poznámka:** Sloty jsou hodinové od otevření; zbytek kratší než hodina se nevrací. Slot je obsazený, když ho aspoň částečně překrývá rezervace se stavem `ACTIVE` (zrušená termín uvolní). Slot, který už začal, není volný. Cenu slotu zatím nevrací (ceník US 7 se dělá v S2W1).
* **Chyby:** `court/availability/invalidDtoIn` (400), `court/availability/courtDoesNotExist` (404), `court/availability/venueIsNotActive` (409), varování `court/availability/unsupportedKeys`.

## 3. Ceníky a pravidla (PriceRule)

### `POST priceRule/create`
* **Popis:** Správce přidá cenové pravidlo kurtu (US 7).
* **Práva:** Správce (role `PLAYER` + `MANAGER`), který je vlastníkem sportoviště kurtu.
* **dtoIn (JSON):** `courtId` (UUID), `dayOfWeek` (1–7, Po–Ne), `startTime`, `endTime` (`"HH:MM"`, `startTime` < `endTime`), `pricePerHour` (číslo v Kč, nezáporné, nejvýše 2 desetinná místa).
* **dtoOut:** `id, courtId, dayOfWeek, startTime, endTime, pricePerHour`.
* **Pravidla:** Pravidla stejného kurtu a dne se nesmí překrývat; navazující pravidlo (např. 07:00–16:00 a 16:00–22:00) je v pořádku. Hlídá to i databáze. Pravidlo a záznam do audit logu (`priceRule/create`) se uloží v jednom zápisu. Změna ceníku nemění cenu existujících rezervací.
* **Chyby:** `priceRule/create/invalidDtoIn` (400), `priceRule/create/notAuthenticated` (401), `priceRule/create/notAuthorized` (403, cizí sportoviště nebo chybí role), `priceRule/create/courtDoesNotExist` (404), `priceRule/create/priceRuleOverlap` (409, `paramMap.conflictingRule`: `id, startTime, endTime` překrývajícího se pravidla), varování `priceRule/create/unsupportedKeys`.

### `GET priceRule/listByCourt`
* **Popis:** Ceník kurtu (US 7). Používá ho detail kurtu a `reservation/create` počítá cenu ze stejných pravidel.
* **Práva:** Návštěvník i Hráč.
* **dtoIn (query):** `courtId` (UUID).
* **dtoOut:** `courtId`, `itemList: [{ id, courtId, dayOfWeek, startTime, endTime, pricePerHour }]` seřazené podle dne a času začátku.
* **Chyby:** `priceRule/listByCourt/invalidDtoIn` (400), `priceRule/listByCourt/courtDoesNotExist` (404), varování `priceRule/listByCourt/unsupportedKeys`.

## 4. Auth – Google přihlášení

### POST /api/auth/googleCallback

**Popis:** Přihlášení uživatele pomocí Google účtu. Backend ověří Google ID token, vyhledá nebo vytvoří uživatele a vrátí JWT token aplikace.

**Autentizace:** Není vyžadována.

**dtoIn:**
```json
{
  "idToken": "google-id-token"
}
```

**dtoOut (200):**
```json
{
  "token": "application-jwt-token",
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "name": "Test User",
    "roles": ["PLAYER"]
  },
  "uuAppErrorMap": {}
}
```

**Ověření:** auth-service ověří podpis ID tokenu veřejnými klíči Google, vydavatele (`accounts.google.com`), audience (= `GOOGLE_CLIENT_ID`) a ověřený e-mail. Uživatele najde podle Google ID, nebo ho založí s rolí `PLAYER`.

**JWT aplikace:** HS256 (`JWT_SECRET`), payload `{ userId, roles }`, platnost 8 hodin. Frontend ho posílá v hlavičce `Authorization: Bearer <token>`.

**Možné chyby:**
- 400 – `auth/googleCallback/invalidDtoIn`
- 401 – `auth/googleCallback/invalidGoogleToken` (neplatný nebo cizí Google token)
- 503 – `auth/googleCallback/googleLoginUnavailable` (chybí `GOOGLE_CLIENT_ID` nebo `JWT_SECRET`)
- 500 – `unexpectedError`

---

## 5. User – Informace o přihlášeném uživateli


### GET /api/user/me

**Popis:** Vrátí informace o aktuálně přihlášeném uživateli.

**Autentizace:** Vyžadován JWT token aplikace.

**HTTP hlavička:**
```text
Authorization: Bearer <JWT_TOKEN>
```

**dtoIn:** Žádné vstupní parametry.

**dtoOut (200):**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "email": "user@example.com",
  "name": "Test User",
  "roles": ["PLAYER"],
  "uuAppErrorMap": {}
}
```

**Možné chyby:**
- 401 – `user/me/notAuthenticated`
- 404 – `user/me/userDoesNotExist`
- 500 – `unexpectedError`

Role se čtou z databáze, takže změna role (např. schválení správce) se projeví hned, bez nového přihlášení. JWT ale nese role z okamžiku přihlášení – oprávnění na gateway se změní až s novým tokenem.


## 6. Rezervace (Reservation)

Endpointy zajišťuje `reservation-service`.

### `POST reservation/create`
* **Popis:** Hráč vytvoří rezervaci volného termínu kurtu (US 6).
* **Práva:** Přihlášený hráč (role `PLAYER`). Rezervace patří přihlášenému uživateli.
* **dtoIn (JSON):** `courtId` (UUID), `startAt`, `endAt` (datum a čas v ISO 8601 s časovou zónou, např. `startAt`/`endAt` slotu z `court/availability`).
* **dtoOut:** `id, courtId, courtName, venueId, venueName, playerId, playerName, startAt, endAt, totalPrice, status` (`ACTIVE`), `createdAt`.
* **Pravidla:**
  * Rezervace trvá celé hodiny a začíná na hodinovém slotu od otevření sportoviště (pražský čas).
  * Termín musí být v budoucnosti a celý v otevírací době toho dne.
  * Deaktivované sportoviště rezervace nepřijímá.
  * Cena je součet hodinových cen z ceníku kurtu pro daný den a čas; hodina bez ceny rezervovat nejde.
  * Aktivní rezervace stejného kurtu se nesmí překrývat. Hlídá to i databáze, takže ze dvou současných požadavků na stejný termín projde jen jeden.
  * Rezervace a záznam do audit logu (`reservation/create`) se uloží v jednom zápisu.
* **Chyby:** `reservation/create/invalidDtoIn` (400, mj. rezervace, která netrvá celé hodiny), `reservation/create/reservationInPast` (400), `reservation/create/outsideOpeningHours` (400, `paramMap`: `date, openTime, closeTime`), `reservation/create/priceNotSet` (400, `paramMap`: `startTime, endTime` hodiny bez ceny), `reservation/create/notAuthenticated` (401), `reservation/create/notAuthorized` (403), `reservation/create/courtDoesNotExist` (404), `reservation/create/venueIsNotActive` (409), `reservation/create/slotNotAvailable` (409), varování `reservation/create/unsupportedKeys`.

### `POST reservation/cancel`
* **Popis:** Hráč zruší svou rezervaci (US 8).
* **Práva:** Přihlášený hráč (role `PLAYER`), jen vlastní rezervaci.
* **dtoIn (JSON):** `id` (UUID rezervace).
* **dtoOut:** `id, courtId, venueId, playerId, playerName, startAt, endAt, totalPrice, status, createdAt, cancelledAt`.
* **Pravidla:**
  * Zrušit lze nejpozději 24 hodin před začátkem rezervace.
  * Rezervace se nemaže, dostane stav `CANCELLED` a čas zrušení; termín se tím uvolní pro ostatní.
  * Už zrušená rezervace se nemění a vrátí se její aktuální stav (opakované volání je bezpečné).
  * Zrušení a záznam do audit logu (`reservation/cancel`) se uloží v jednom zápisu.
* **Chyby:** `reservation/cancel/invalidDtoIn` (400), `reservation/cancel/cancellationTooLate` (400, `paramMap`: `startAt, cancellableUntil`), `reservation/cancel/notAuthenticated` (401), `reservation/cancel/notAuthorized` (403, cizí rezervace), `reservation/cancel/reservationDoesNotExist` (404), varování `reservation/cancel/unsupportedKeys`.


## 7. Žádosti o roli správce (ManagerRequest)

Zajišťuje `auth-service`. Hráč požádá o roli správce a administrátor žádost schválí nebo zamítne. Všechny endpointy vyžadují JWT. Role se kontrolují v `auth-service` podle databáze.

### POST /api/managerRequest/create

**Popis:** Hráč požádá o roli správce. Vznikne žádost ve stavu `PENDING`.

**Práva:** Přihlášený uživatel, který ještě není správce ani administrátor.

**dtoIn:**
```json
{ "message": "Chci spravovat kurty" }
```
`message` je nepovinné, nejvýše 1000 znaků.

**dtoOut (200):**
```json
{
  "id": "…",
  "userId": "…",
  "message": "Chci spravovat kurty",
  "status": "PENDING",
  "decidedById": null,
  "createdAt": "2026-11-20T15:27:11.542Z",
  "decidedAt": null,
  "uuAppErrorMap": {}
}
```

**Možné chyby:**
- 400 – `managerRequest/create/invalidDtoIn`
- 401 – `managerRequest/create/notAuthenticated`
- 409 – `managerRequest/create/alreadyManager` (uživatel už je správce nebo administrátor)
- 409 – `managerRequest/create/managerRequestAlreadyPending` (už má nevyřízenou žádost)

### GET /api/managerRequest/list

**Popis:** Seznam žádostí o roli správce.

**Práva:** Administrátor (role `ADMIN`).

**dtoIn (query):** `status?` – `PENDING`, `APPROVED` nebo `REJECTED`. Bez filtru vrací všechny žádosti.

**dtoOut (200):** `itemList: [{ id, userId, message, status, decidedById, createdAt, decidedAt, user: { id, email, name } }]` seřazené od nejstarší žádosti. Bez stránkování.

**Možné chyby:**
- 400 – `managerRequest/list/invalidDtoIn`
- 401 – `managerRequest/list/notAuthenticated`
- 403 – `managerRequest/list/notAuthorized`

### POST /api/managerRequest/approve

**Popis:** Schválení žádosti. Žádost přejde do stavu `APPROVED` a žadatel dostane roli `MANAGER`. Obojí se provede v jedné transakci.

**Práva:** Administrátor (role `ADMIN`).

**dtoIn:**
```json
{ "id": "uuid-žádosti" }
```

**dtoOut (200):** upravená žádost (stejný tvar jako u `create`), `status` je `APPROVED`, `decidedById` a `decidedAt` jsou vyplněné.

**Možné chyby:**
- 400 – `managerRequest/approve/invalidDtoIn`
- 401 – `managerRequest/approve/notAuthenticated`
- 403 – `managerRequest/approve/notAuthorized`
- 404 – `managerRequest/approve/managerRequestDoesNotExist`
- 409 – `managerRequest/approve/managerRequestAlreadyDecided` (žádost už byla vyřízena)

### POST /api/managerRequest/reject

**Popis:** Zamítnutí žádosti. Stav se změní na `REJECTED`, role uživatele se nemění.

**Práva, dtoIn, dtoOut a chyby:** stejné jako u `approve` (v klíčích chyb je `reject`).

**Poznámka:** Role se v `auth-service` čtou z databáze, takže schválený uživatel je správcem hned. JWT ale nese role z okamžiku přihlášení, takže gateway mu pustí endpointy správce (např. `venue/create`) až po novém přihlášení.

## 8. Audit log (AuditLog)

Zajišťuje `audit-service`. Záznamy o důležitých akcích zapisují přímo služby, které akci provedou, ve stejné transakci jako samotnou změnu. `audit-service` je jen vypisuje.

### `GET audit/list`
* **Popis:** Výpis záznamů audit logu pro administrátora.
* **Práva:** Administrátor (role `ADMIN`). Role se berou z hlavičky `x-user-roles` od gateway, takže nově přidělená role se projeví až po novém přihlášení.
* **dtoIn (query):** `action?` (max. 100 znaků, např. `reservation/create`), `entityType?` (max. 50 znaků, např. `Reservation`), `pageIndex?` (od 0), `pageSize?` (1–100, výchozí 20). Filtry fungují samostatně i společně.
* **dtoOut:** `itemList: [{ id, userId, action, entityType, entityId, details, createdAt }]` seřazené od nejnovějšího, `pageInfo: { pageIndex, pageSize, total }`. `userId` a `details` mohou být `null`.
* **Chyby:** `audit/list/invalidDtoIn` (400), `audit/list/notAuthenticated` (401), `audit/list/notAuthorized` (403), varování `audit/list/unsupportedKeys`.