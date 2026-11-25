# Spec: face-identity

Modul aus `CAPABILITY-MAP.md` · hängt ab von backend-deploy · Stand 2026-10-19

## Objective

Wer FACESchematic auf schematic.face-gmbh.com nutzt, meldet sich einmal mit seinem
Odoo-Konto an (Odoo-E-Mail + persönlicher API-Schlüssel) und bleibt 30 Tage angemeldet.
Danach handelt das Backend mit genau diesen Odoo-Rechten — Grundlage für odoo-drawings und
cloud-bridge. Der Anmelde-Knopf oben rechts, der heute zum gesperrten Upstream-Konto führt,
wird zur FACE-Anmeldung.

User Stories:
- Als Mitarbeiter melde ich mich mit Odoo-E-Mail und API-Schlüssel an und sehe danach
  meinen Namen oben rechts.
- Als Mitarbeiter melde ich mich ab; danach ist im Browser keine Sitzung mehr gültig.
- Wird mein API-Schlüssel in Odoo widerrufen, fordert mich die App beim nächsten
  Odoo-Zugriff zur neuen Anmeldung auf.

## Tech Stack

Backend wie `SPEC-backend-deploy.md`. Frontend: React 19 + Zustand wie die App, Texte über
`useT()` mit deutschen Einträgen in `src/i18n/de/`.

## Schnittstelle (Backend)

| Methode | Pfad | Body / Antwort |
|---|---|---|
| POST | `/face/api/login` | `{ login, apiKey }` → `200 { uid, name, login }` + Cookie · `401 { error }` · `429` |
| GET | `/face/api/me` | `200 { uid, name, login }` · `401` |
| POST | `/face/api/logout` | `204`, Cookie gelöscht, Sitzung serverseitig entfernt |

- Prüfung: `common.authenticate` gegen Odoo, Name aus `res.users`.
- Cookie `face_session`: HttpOnly, Secure, SameSite=Lax, Path=/face, 30 Tage.
- Ändernde Anfragen verlangen den Header `X-FACE-Request: 1` (CSRF-Schutz zusätzlich zu SameSite).
- Speicherung: API-Schlüssel AES-256-GCM-verschlüsselt (Schlüssel aus `FACE_SECRET`),
  Sitzungs-IDs nur als SHA-256-Hash.
- Schutz vor IP-Sperre durch Odoo (Fail2Ban): max. 10 Anmeldeversuche je 15 min und IP;
  nach einer abgelehnten Anmeldung 5 min Pause für diese E-Mail; erst 3 abgelehnte Anmeldungen
  in 15 min (gleich von wem) pausieren alle für 5 min (geändert 21.11.: vorher pausierte schon
  ein einzelner abgelaufener Schlüssel alle).

## Frontend

- Nur im FACE-Build (`VITE_FACE_BACKEND=1`, gesetzt im Dockerfile): Der Knopf „Anmelden“
  öffnet den FACE-Anmeldedialog (E-Mail, API-Schlüssel, Hinweis „API-Schlüssel erstellen:
  Odoo → Avatar → Mein Profil → Kontosicherheit → Neuer API-Schlüssel“). Angemeldet zeigt
  er den Namen mit Menü „Abmelden“.
- Ohne das Flag (öffentlicher Build, `npm run dev` ohne Flag) bleibt das Upstream-Verhalten.
- Anmeldezustand liegt im Store (`faceUser`), beim Start einmal per `/face/api/me` geladen.

## Pflichtanmeldung (ergänzt 23.11.2026)

Im FACE-Build kommt niemand ohne Odoo-Anmeldung in die App (`FaceLoginGate` um die ganze
Oberfläche, Regeln in `faceGate` in `src/faceBackend.ts`):

- Nicht angemeldet → nur der Anmeldedialog, ohne „Abbrechen“; die App wird nicht geladen.
- Endet die Sitzung mitten in der Arbeit (Abmelden, Schlüssel widerrufen), legt sich der Dialog
  über den Editor; die Zeichnung bleibt geladen.
- Eingebetteter Betrachter (`?embed=1`, Odoo) bleibt ohne Anmeldung — er zeigt nur, was Odoo
  ihm übergibt, und das Cookie käme im fremden Rahmen ohnehin nicht an.
- Backend nicht erreichbar (offline, Container aus): Ein Gerät, auf dem sich schon jemand
  angemeldet hat (Marker `face-signed-in` im localStorage, ohne Name und Schlüssel), arbeitet
  weiter; ein unbekanntes Gerät sieht „Anmeldung nicht erreichbar“ mit „Erneut versuchen“.
- Grenze: Das ist eine Sperre in der Oberfläche. Die App-Dateien selbst liefert nginx
  weiterhin an jeden aus (öffentliches Repository, und die Anmeldeseite muss laden können).

## Sperre am Server (ergänzt 25.11.2026)

Lizenzmaterial gibt nginx nur an angemeldete Browser: `/symbols/` (BHE) und `/projection/`
(Epson) laufen über `auth_request` gegen `/face/api/me` (`docker/nginx.conf`); ohne Sitzung 401.

- Das Cookie `face_session` gilt dafür für die ganze Seite (`Path=/` statt `/face`). Sitzungen
  von vorher zieht `/face/api/me` beim nächsten App-Start um (gleiche Restlaufzeit); das alte
  Cookie wird bei Anmeldung, `/me` und Abmeldung gelöscht.
- Der Service Worker lädt beides nicht mehr vorab (ein 401 ließe sonst seine Installation
  scheitern), sondern merkt es sich beim Benutzen. Offline ist also da, was schon einmal
  gezeigt wurde — nicht mehr die ganze Bibliothek.
- Eingebetteter Betrachter: bekommt die Symbole, wenn der Nutzer im selben Browser hier
  angemeldet ist (portal.face-gmbh.com ist dieselbe Site); sonst die gezeichneten Formen.
- Backend aus → nginx verweigert (500), die App zeichnet ihre eigenen Formen.

## Commands / Structure / Style

Wie `SPEC-backend-deploy.md`. Neue Dateien: `mcp-server/src/cloud/{odoo,store,auth}.ts`,
`src/faceBackend.ts` (API-Client), `src/components/FaceLoginDialog.tsx`; geändert:
`UserMenuButton.tsx`, `store.ts`, `Dockerfile`, `src/i18n/de/settings.ts`.

## Testing Strategy

- Backend (`node:test`) gegen einen Mock-Odoo im Test: richtige Daten → Cookie und `/me`;
  falsche Daten → 401 und Pause; ohne `X-FACE-Request` → 403; Logout macht die Sitzung
  ungültig; Store-Datei enthält weder Klartext-Schlüssel noch Klartext-Sitzungs-ID.
- Frontend (`vitest`): API-Client und Anmeldezustand im Store.
- Abnahme durch Jean-Luc: Anmeldung auf schematic.face-gmbh.com mit echtem Odoo-Konto.

## Boundaries

- Always: Odoo-Rechte des Nutzers sind die einzige Autorisierung; Fehlermeldungen auf Deutsch.
- Ask first: Anmeldung per Odoo-Passwort oder Odoo-OAuth statt API-Schlüssel.
- Never: Schlüssel oder Sitzungen loggen; Klartext-Schlüssel auf die Platte schreiben.

## Success Criteria

1. Anmeldung mit gültigen Daten → Name oben rechts; nach Neuladen weiterhin angemeldet.
2. Falsche Daten → deutsche Fehlermeldung, kein Cookie; ein elfter Versuch in 15 min → 429.
3. Abmelden → `/face/api/me` liefert 401, auch mit dem alten Cookie.
4. `store.json` enthält keinen API-Schlüssel und keine Sitzungs-ID im Klartext.
5. Alle bestehenden Tests grün; ohne `VITE_FACE_BACKEND` sieht der Build aus wie vorher.

## Open Questions

Keine.
