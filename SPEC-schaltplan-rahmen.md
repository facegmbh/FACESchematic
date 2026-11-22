# Spec: schaltplan-rahmen

Modul aus `CAPABILITY-MAP.md` · hängt ab von schaltplan-leitungen · Stand 2026-11-22

## Objective

Leitungen sollen Rahmen respektieren, und Geräte dürfen ein wenig rücken, damit Leitungen gerade
laufen. Jean-Luc am 22.11., nachdem Claude in claude.ai die Kapelle nach dem Leitfaden gebaut
hatte: „Linien laufen aber noch auf Linien von Rahmen und Geräte könnten leicht verschoben werden
damit die Linien sauberer laufen. Linien sollen auch nicht durch die Rahmen laufen von anderen.“

Nachgeprüft an seiner gespeicherten Zeichnung „Medientechnik Kapelle“ (Odoo, 22.11. 11:58,
26 Verbindungen, 5 davon von Claude mit `set_connection_path` gelegt):
- **Auf Rahmen (7 Stellen):** Zum Beispiel läuft Kirche → Switch auf dem rechten Rahmen von
  „Kamera-Position“, PureLink → Switch auf dem von „Rollwagen“.
- **Durch fremde Rahmen (3 Stellen):** Epson und RX1 Bildschirm laufen senkrecht durch
  „SAT-Kopfstelle Haus-TV“, Kirche → Switch quer durch „Kapelle“.
- **Ursache:** Der Router kannte Rahmen gar nicht. Räume waren für ihn freie Fläche, nur Geräte
  und Texte (Phase 7) waren Hindernisse.

Entscheidung Jean-Luc (22.11.): Die Regeln gelten **für alle Zeichnungen**, auch beim Zeichnen von
Hand im Editor, nicht nur wenn Claude verlegt.

User Stories:
1. Eine Leitung läuft nie auf dem Rahmen eines Orts oder Bereichs, sie kreuzt ihn nur.
2. Eine Leitung läuft nicht durch einen Ort oder Bereich, der keines ihrer beiden Geräte enthält,
   solange es einen Weg darum herum innerhalb der Zeichnung gibt.
3. `check_layout` meldet beides (`on_frame`, `through_room`) mit Ort und Abhilfe.
4. Claude kann Geräte ein Rasterfeld oder zwei verschieben lassen (`straighten_lines`), damit
   Leitungen mit gegenüberliegenden Ports gerade laufen statt mit Versatz.

## Begriffe

- **Rahmen:** die vier Seiten eines Raums (Ort, Bereich, Schrank-Kasten).
- **Eigene Räume einer Leitung:** alle Räume, die Quelle oder Ziel enthalten, auch verschachtelt.
  Durch sie darf die Leitung, durch alle anderen nicht.
- **Zeichnung:** das Rechteck um alle Orte. Es ist dasselbe wie bei `line_outside` in Phase 7.

## Lösung

**Router** (`pathfinding.ts`, `edgeRouter.ts`):
- **A\*:** Jedes Rasterfeld auf einem Rahmen kostet `FRAME_COST` (40). Einen Rahmen kreuzen kostet
  das einmal, an ihm entlanglaufen kostet es bei jedem Feld.
  - Durch einen fremden Raum heißt zweimal kreuzen. Ein Umweg von bis zu etwa 80 Feldern ist
    günstiger.
  - Die Kreuzungen der eigenen Räume fallen auf jedem Weg gleich an.
- **Außerhalb der Zeichnung:** Jedes Feld kostet `OUTSIDE_COST` (4). Durch einen fremden Ort ist
  dann besser als außen herum, denn außen herum meldet `line_outside`.
- **Spaltenverteiler:** Er vergibt keine Bahn auf einem Rahmen. Durch einen Raum, der keines der
  Geräte der Leitung enthält, vergibt er auch keine. Senkrechte Bahnen setzt der Verteiler, nicht
  A\*.
- **Ohne Räume:** Alles bleibt wie bisher. `routing:check` liefert 13/13 Fixtures unverändert.

**Prüfung** (`layoutCheck.ts`):
- **`on_frame`:** Ein Abschnitt liegt bis zu 8 px neben einer Rahmenseite und läuft mindestens
  16 px an ihr entlang.
- **`through_room`:** Ein Abschnitt tritt in einen fremden Raum ein. Gemeldet wird nur der äußerste
  fremde Raum. Ist das ein Ort, lautet die Abhilfe `arrange_rooms` mit einer `order`, die die
  beiden Orte nebeneinanderstellt.

**`straighten_lines`** (`straightenLines.ts`, Befehl in `mcpBridge.ts`):
- **Welche Leitungen:** Gerade gelegt werden nur Leitungen, deren Ports zueinander zeigen und die
  nicht von Hand gelegt wurden. Die Port-Positionen kommen aus den verlegten Leitungen, denn Anfang
  und Ende liegen genau auf dem Port.
- **Wer rückt:** Das Gerät mit weniger Verbindungen rückt, nur senkrecht und um ganze Rasterfelder,
  höchstens `maxShift` (Standard 64 px, 16–160).
- **Wann nicht:**
  - wenn das Gerät auf ein anderes Gerät träfe (16 px Abstand) oder in einen anderen Raum rutschte;
  - wenn es aus seinem Raum ragte (Platz für den Namen oben, 16 px unten);
  - wenn eine schon gerade Leitung dadurch einen Knick bekäme.
- **Schrank-Kasten:** Geräte dort rücken wie andere auch, denn die Höheneinheiten stehen in der
  Schrankansicht. Geräte in gesperrten Räumen bleiben stehen.
- **Ablauf:** ein Undo-Schritt. Danach verlegt der Befehl neu und wartet auf den Router.

**Playbook und Leitfaden:** Der Ablauf heißt jetzt: `route_connections` → `straighten_lines` →
`check_layout`.
- `through_room` → Orte nebeneinander.
- `on_frame` → wie `line_outside`: Rand einmal auf 96, Lücke einmal auf 160.
- Ein Ort, der direkt mit der Technik verdrahtet ist (Kirche), steht neben ihr.

## Entscheidungen

1. Die Regeln gelten für alle Zeichnungen (Jean-Luc, 22.11.).
2. „Durch fremde Rahmen“ ist eine Kostenfrage, kein Verbot. Wenn es keinen Weg darum herum gibt
   (Kirche über der Kapelle, Technik darunter), läuft die Leitung durch, und die Prüfung sagt,
   wie die Anordnung es löst. Ein hartes Verbot hätte die Leitung aus der Zeichnung gedrängt.
3. Schrank-Kasten-Geräte dürfen beim Geraderücken senkrecht rücken (beim Bauen entschieden,
   22.11.). Sonst blieben die Versätze im Schrank stehen.
4. Von Claude früher gelegte Wege (`set_connection_path`) gibt nur der Nutzer oder Claude auf
   Wunsch zurück (`route_connections` mit `connectionIds`). An Jean-Lucs Zeichnung ist der neue
   Router bei BirdDog besser (keine 12 Knicke mehr). Beim Access Point zum ESP macht er aber einen
   Bogen unter dem Schrank-Kasten durch, weil dessen Name die Lücke verdeckt.

## Testing Strategy

- `roomFrames.test.ts`: Router meidet Rahmen und fremde Räume, läuft gerade durch eigene. Jean-Lucs
  Kapelle (Fixture `kapelle-jl-2026-11-22.json`): 0 `on_frame`, nur der eine `through_room`
  (Kirche über Kapelle), kein `line_outside`.
- `layoutCheck.test.ts`: `on_frame` (auf dem Rahmen, wenige px daneben, Kreuzen zählt nicht),
  `through_room` (fremd, eigene Räume und Lücke zwischen Orten erlaubt).
- `straightenLines.test.ts` (8) und `mcpLayout.test.ts` (Befehl, Undo, Argumente).
- Harness `routing:check` 13/13 unverändert. Ende-zu-Ende über `/face/service/call` mit den
  Korrekturrunden des Leitfadens.

## Boundaries

- Always: Regeln nur wirksam, wo Räume sind; Undo für jedes Verschieben.
- Ask first: Gewichte (`FRAME_COST`, `OUTSIDE_COST`) ändern, waagerechtes Verschieben, Geräte in
  gesperrten Räumen bewegen.
- Never: von Hand gelegte Wege ungefragt verwerfen.
