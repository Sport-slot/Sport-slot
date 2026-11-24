# Dokumentace frontendu – Hráč vytvoří rezervaci

**Projekt:** SportSlot  
**Sprint:** S2W2 (termín 29. 11. 2026)  
**Role:** PLAYER  
**Stav dokumentu:** Návrh frontendového řešení k implementaci a týmové revizi

## 1. Cíl a rozsah

Cílem je umožnit přihlášenému hráči rezervovat volný termín zvoleného kurtu. Frontend nabídne výběr kurtu, dne a dostupných hodinových slotů, zobrazí souhrn a odešle potvrzenou rezervaci na API gateway.

Tento dokument specifikuje **požadované chování frontendu**, nikoli již hotovou implementaci. Ke dni vypracování jsou v `main` dostupné detail sportoviště a příslušná backendová API; UI pro dokončení online rezervace zatím není součástí frontendu.

## 2. Vstupní podmínky a role

- Uživatel otevře detail sportoviště (`/venues/[id]`) a vybere existující kurt.
- Volné sloty si může prohlížet i návštěvník; k potvrzení rezervace je nutné přihlášení a oprávnění `PLAYER`.
- Sportoviště musí být aktivní, termín musí být v budoucnosti a v otevírací době.
- Rezervace probíhá v celých hodinách na navazujících volných slotech stejného kurtu.
- Pro vybraný interval musí existovat ceník; konečnou cenu vždy určuje backend.

## 3. Navrhovaný uživatelský scénář

1. Hráč otevře detail sportoviště a v seznamu kurtů vybere konkrétní kurt.
2. Zobrazí se formulář rezervace s názvem kurtu, výběrem data a seznamem časových slotů.
3. Hráč zvolí datum; frontend načte dostupnost pro `courtId` a `date`.
4. Volné sloty jsou označené jako dostupné, obsazené či minulé sloty nejsou aktivní.
5. Hráč vybere začátek a konec souvislého intervalu po celých hodinách.
6. Frontend zobrazí rekapitulaci: sportoviště, kurt, datum, čas, délku a předběžnou cenu, pokud lze určit z ceníku.
7. Nepřihlášeného uživatele před potvrzením přesměruje na přihlášení, s bezpečným návratem na stránku.
8. Po kliknutí na **„Potvrdit rezervaci“** frontend odešle `POST /api/reservation/create` a při čekání zabrání duplicitnímu odeslání.
9. Při úspěšné odpovědi zobrazí potvrzení a finální cenu z `totalPrice` vrácenou backendem.
10. Při chybě zobrazí srozumitelnou zprávu a umožní opravu výběru; při konfliktu dostupnosti znovu načte sloty.

## 4. Prvky rozhraní

| Prvek | Úloha | Základní stavy |
| --- | --- | --- |
| Výběr kurtu | Výběr kurtu na detailu sportoviště | vybrán / nevybrán |
| Výběr data | Zvolení dne rezervace | zvoleno / neplatné datum |
| Přehled slotů | Zobrazení dostupných časů | načítání / volno / obsazeno / bez termínů / chyba |
| Výběr intervalu | Volba navazujících hodin | neúplný / platný / kolize |
| Rekapitulace | Zobrazení parametrů a předběžné ceny | kompletní / chybí ceník |
| Potvrzovací tlačítko | Odeslání nové rezervace | nepovoleno / připraveno / odesílání |
| Výsledek | Potvrzení s ID nebo popis chyby | úspěch / chyba |

Rozhraní má být použitelné na mobilu i desktopu; upozornění na chyby a potvrzení musí být čitelná a přístupná pomocí klávesnice.

## 5. API a datové kontrakty

Frontend komunikuje přes API gateway (`NEXT_PUBLIC_API_URL`, standardně prefix `/api`). Pro chráněné endpointy používá hlavičku `Authorization: Bearer <JWT>`.

### 5.1 `GET /api/venue/get?id=<venueId>`

Zobrazí detail sportoviště a jeho seznam kurtů. Z odpovědi frontend využije zejména `id`, `name`, `active` a `courts` (`id`, `name`, `sport`, `surface`, `indoor`).

### 5.2 `GET /api/court/availability?courtId=<UUID>&date=<YYYY-MM-DD>`

Vrací `slotList`, kde slot obsahuje `startTime`, `endTime`, `startAt`, `endAt` a `free`. Časy `startTime` a `endTime` jsou pro místní zobrazení; `startAt` a `endAt` z API se použijí při odeslání rezervace.

### 5.3 `GET /api/priceRule/listByCourt?courtId=<UUID>`

Vrací cenová pravidla kurtu. Frontend je může použít pro **orientační** výpočet ceny před odesláním. Při chybějícím ceníku nelze objednávku považovat za platnou.

### 5.4 `POST /api/reservation/create`

Vyžaduje přihlášeného hráče. JSON tělo:

```json
{
  "courtId": "00000000-0000-4000-8000-000000000202",
  "startAt": "2026-11-30T14:00:00Z",
  "endAt": "2026-11-30T16:00:00Z"
}
```

Úspěšná odpověď (`200`) obsahuje mimo jiné `id`, `courtId`, `courtName`, `venueId`, `venueName`, `playerId`, `startAt`, `endAt`, `totalPrice`, `status: ACTIVE`, `createdAt` a `uuAppErrorMap`. Po úspěchu je zdrojem pravdy odpověď backendu, nikoli předběžný stav formuláře.

## 6. Validace a chybové stavy

| HTTP | Příčina | Reakce frontendu |
| --- | --- | --- |
| 400 | Neplatná data, minulý termín, mimo otevírací dobu nebo chybějící cena (`invalidDtoIn`, `reservationInPast`, `outsideOpeningHours`, `priceNotSet`) | Zobrazit popis chyby a umožnit upravit výběr |
| 401 | Chybí nebo vypršel JWT (`notAuthenticated`) | Nabídnout přihlášení |
| 403 | Chybí oprávnění (`notAuthorized`) | Informovat uživatele, neodesílat opakovaně |
| 404 | Kurt neexistuje (`courtDoesNotExist`) | Upozornit na změnu a vrátit hráče k výběru kurtu |
| 409 | Slot již není volný (`slotNotAvailable`) nebo je sportoviště deaktivované (`venueIsNotActive`) | Zobrazit upozornění, obnovit dostupnost a vyžadovat nový výběr |
| 5xx / síť | Nedostupnost služby | Zobrazit obecnou chybu; opakování ponechat na uživateli |

Frontend musí zohlednit načítání a prázdný seznam termínů. Zakázané sloty nesmí působit jako klikatelné. Během odesílání má být tlačítko potvrzení deaktivované, aby uživatel neodeslal více požadavků zároveň.

## 7. Časová pásma a cena

- Datum a hodiny se hráči zobrazují v časovém pásmu `Europe/Prague`.
- `startAt` a `endAt` se API předávají v ISO 8601 s časovou zónou; vhodné je převzít hodnoty ze zvolených slotů API, nikoli je ručně převádět z textového času.
- Délka rezervace je počet navazujících celých hodin.
- Předběžná cena je pouze informativní. **Konečná cena** je `totalPrice` z `reservation/create`.

## 8. Akceptační kritéria

- [ ] Hráč si vybere existující kurt a datum.
- [ ] Frontend načte a správně rozliší volné a obsazené sloty.
- [ ] Lze zvolit pouze platný, souvislý hodinový interval v budoucnosti.
- [ ] Před odesláním se zobrazí rekapitulace kurtu, termínu a ceny, pokud je dostupná.
- [ ] Nepřihlášený uživatel je vyzván k přihlášení.
- [ ] Po potvrzení se odešlou správná pole `courtId`, `startAt`, `endAt` na `POST /api/reservation/create`.
- [ ] Úspěch zobrazí ID rezervace a `totalPrice` z backendu.
- [ ] Chybové odpovědi a síťová chyba jsou srozumitelně zobrazené bez falešného potvrzení.
- [ ] Při `slotNotAvailable` se obnoví dostupnost a hráč musí zvolit jiný termín.
- [ ] UI je použitelné na mobilu a ovladatelné klávesnicí.

*Checklist je pro následné testování implementace; zaškrtnutí není součástí tohoto dokumentačního úkolu.*

## 9. Doporučené ověření po implementaci

1. Otevřít aktivní sportoviště s kurtem a zobrazit dostupnost pro vybraný den.
2. Potvrdit volný interval jako přihlášený hráč a ověřit úspěšnou odpověď.
3. Simulovat obsazený slot / konflikt 409 a ověřit obnovení nabídky.
4. Zkusit minulý termín, deaktivované sportoviště, chybějící cenu a vypršený token.
5. Ověřit mobilní zobrazení a ovládání klávesnicí.

## 10. Související soubory

- [`docs/api.md`](api.md) – datový a chybový kontrakt pro dostupnost, ceník a rezervaci.
- [`docs/openapi.yaml`](openapi.yaml) – OpenAPI definice použitých endpointů.
- [`frontend/README.md`](../frontend/README.md) – Next.js, autentizace a konfigurace API.
- [`frontend/src/components/VenueDetail.tsx`](../frontend/src/components/VenueDetail.tsx) – existující detail sportoviště; online rezervace je zde dosud označená jako připravovaná.
- [`frontend/src/components/FreeSlots.tsx`](../frontend/src/components/FreeSlots.tsx) – týdenní kalendář volných termínů s cenami (kurt × 7 dní × hodiny). Výběr intervalu pro rezervaci je vhodné postavit přímo na jeho buňkách volných hodin.

**Poznámka:** Dokument je specifikace zamýšleného frontendového chování. Po dokončení implementace je vhodné ověřit konkrétní komponenty a případné změny UX s implementátorem.
