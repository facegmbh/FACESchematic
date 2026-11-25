# Spec: Abdeckung von Deckenmikrofonen (Shure MXA)

Stand 25.11.2026. Bestellt von Jean-Luc: „für das Shure MXA920 und co möchte ich auch
Abdeckung planen können“ — nur Shure, mit der Reichweite aus der Montagehöhe.

## Ziel

Ein Shure-Deckenmikrofon auf dem Grundriss zeigt die Bodenfläche, die es abdeckt, in
echten Metern — so wie Shure Designer sie zeigt. Dazu rechnet der Plan aus der
Montagehöhe, wie weit ein Sprecher seitlich entfernt sein darf.

## Herstellerangaben

Gelesen am 25.11.2026, abgelegt in `src/micCoverageData.ts`.

| Modell | Fläche | Flächen | Sprecherabstand | Montagehöhe |
|---|---|---|---|---|
| MXA920, MXA925 | 9 × 9 m ab Werk, frei einstellbar | bis 8; feste Flächen 2 × 2 m | bis 4,9 m | bis 3,7 m |
| MXA901 | 6,1 × 6,1 m, einstellbar bis 3 × 3 m | 1 | nicht genannt | bis 3,7 m |
| MXA902 | 6,1 × 6,1 m, fest | 1 | nicht genannt | nicht genannt |

Quellen: MXA920-Handbuch und Shure-Support („How do MXA920 coverage areas work“),
MXA901-Handbuch, Shure-Produktseite MXA902. MXA710 und MXA310 fehlen, weil keine
belegten Maße vorliegen.

## Was gebaut ist

- **Geräte:** MXA920, MXA901, MXA902 in der Bibliothek (`src/devices/audio.ts`). Einträge
  der gemeinsamen Bibliothek („MXA 920 Ceiling Array Microphone“) werden am Modellnamen
  erkannt (`micCoverageSpecFor`).
- **Form „box“:** ein Rechteck um das Gerät, Länge `rangeM`, Breite `widthM`, Versatz
  `offsetM` in Metern vor Ort, dreht mit dem Gerät.
- **Fläche beim Ablegen:** Das Mikrofon bringt seine Fläche mit. Weitere Flächen über das
  Kontextmenü des Symbols: 2 × 2 m, auf einen Platz gerichtet, bis zur Höchstzahl.
- **Verschieben:** Die Fläche wird gegen das Mikrofon gezogen und bleibt an ihm hängen.
- **Reichweite:** `r = √(Sprecherabstand² − (Montagehöhe − Mundhöhe)²)`, Mundhöhe 1,2 m
  sitzend. Gestrichelter Kreis um das Gerät; der Teil der Fläche im Kreis ist voll, der
  Rest blass gefüllt. Der Anteil steht in Prozent im Reiter „Planung“.
- **Hinweise:** höher als empfohlen, Fläche teils oder ganz außer Reichweite, mehr Flächen
  als das Gerät trägt.
- **PDF:** zeichnet dasselbe. **Ausführungsplan:** blendet die Flächen aus.

## Annahmen und Grenzen

- Die Reichweite ist unsere Ableitung aus Shures Sprecherabstand. Shure Designer zeichnet
  sie nicht. Ob Shure die 4,9 m als schräge oder waagerechte Strecke meint, ist nicht
  belegt; gerechnet wird die schräge.
- Raumakustik, Nachhall und Störgeräusche gehen nicht ein.
- Stromaufnahme und Maße der Geräte sind nicht eingetragen.
- Über den Connector (`set_floorplan_coverage`) lässt sich die Form „box“ nicht setzen.

## Tests

- `src/__tests__/micCoverage.test.ts`: Herstellerangaben, Geometrie, Reichweite, Anteil,
  Hinweise, weitere Flächen, Erkennung am Modellnamen.
- `e2e/floorplan-mic-coverage.spec.ts`: Ablegen aus der Bibliothek, Werte im Reiter
  „Planung“, Montagehöhe, Größe, Ziehen, zweite Fläche, PDF, Ausführungsplan.
