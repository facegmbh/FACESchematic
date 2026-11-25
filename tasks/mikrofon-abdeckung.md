# Aufgaben: Abdeckung von Deckenmikrofonen

Spec: `SPEC-mikrofon-abdeckung.md`

- [x] 1 Datenmodell: Form „box“, `offsetM`, `mic`, `MicCoverageSpec` am Template
- [x] 2 Geometrie: Rechteck, Reichweite, Schnitt Fläche ∩ Kreis, Anteil, Hinweise
- [x] 3 Geräte MXA920, MXA901, MXA902; Erkennung am Modellnamen
- [x] 4 Fläche beim Ablegen, weitere Flächen, Höchstzahl
- [x] 5 Zeichnung auf dem Plan, Ziehen als Versatz
- [x] 6 Reiter „Planung“: Montagehöhe, Sprecherhöhe, Versatz, Reichweite, Hinweise
- [x] 7 PDF
- [x] 8 Tests (Unit, Browser), Übersetzung

## Offen

- [ ] Connector: Form „box“, Montagehöhe und Versatz über `set_floorplan_coverage`
- [ ] MXA710 und MXA310, sobald belegte Maße da sind
- [ ] Shures Sprecherabstand: schräg oder waagerecht gemeint? Am Handbuch prüfen
- [ ] Stromaufnahme und Maße der drei Geräte vom Datenblatt
- [ ] Legendenzeile für die Mikrofonflächen (Größe, Höhe, Anteil in Reichweite)
