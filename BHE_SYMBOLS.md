# BHE-Symbolbibliothek

Die gezeichneten Symbole der Sicherheitstechnik (BHE Bundesverband Sicherheitstechnik).
Ein Installationsplan, der zum Installateur, zum Versicherer oder zum Sachverständigen
geht, wird gegen sie gelesen — also zeichnet das Werkzeug sie, wo es sie hat.

## Die Zeichnungen liegen nicht in diesem Repository

Sie sind BHE-Mitgliedsmaterial, und dieses Repository ist öffentlich. Symbole auf Plänen
zu verwenden ist etwas anderes, als die Zeichnungen weiterzuveröffentlichen. Eingecheckt
ist nur der Code, der sie benutzt. Die Bibliothek ist ein einziges ausgeliefertes
Verzeichnis — Zeichnungen und Index zusammen —, das man auf einen Server legen und wieder
herunternehmen kann, ohne den Quellcode anzufassen.

## Erzeugen

Mit der Mitglieder-CD („Symbole CD") erreichbar:

```
node tools/bheSymbols.mjs "<Pfad zur Symbole CD>"
```

Daraus werden 286 zugeschnittene SVGs unter `public/symbols/bhe/` (rund 1,3 MB) plus
`public/symbols/bhe/catalog.json` — der Index, den die App beim Start lädt. Das ganze
Verzeichnis ist gitignoriert.

## Auf den Server

Auf face-docker1, außerhalb von git:

```
/home/user/faceschematic/bhe/   ← der Inhalt von public/symbols/bhe (SVGs + catalog.json)
```

(`/srv/faceschematic/bhe` geht auch, gehört dort aber root; das Home des Runners tut es
ohne Rechteklimmzüge.)

Der Deploy kopiert beides vor dem Image-Build in den Checkout (Schritt „BHE-Symbole
einsetzen" in `.github/workflows/deploy.yml`). Fehlt das Verzeichnis, baut er ohne die
Bibliothek: der Dialog sagt dann, dass sie nicht installiert ist, und jedes Gerät behält
seine gezeichnete Form.

Nach einer neuen CD:

```
node tools/bheSymbols.mjs "<Pfad zur Symbole CD>"
rsync -a --delete public/symbols/bhe/ user@192.168.100.70:faceschematic/bhe/
```

Danach einmal deployen (Push auf master oder „Run workflow"), damit das Image sie
mitnimmt.

## Wie sie im Werkzeug ankommen

- **Am Modell** (Geräte-Editor → Plansymbol → „BHE-Symbol…"): jeder Plan, der das Modell
  verwendet, zeichnet es.
- **An der Plangruppe** (Plan → Symbolgruppen → „BHE-Symbol…"): für diesen Plan.
- **Von selbst**: `defaultSymbolLibraryIdFor` bildet Gerätetypen auf BHE-Kapitel und
  Namensmuster ab — PTZ → Speed-Dome, IP-Kamera → Fix-Dome, Bewegungsmelder → Infrarot
  Bewegungsmelder, Rauchmelder → Rauchmelder optisch. Findet eine Regel nichts, bleibt es
  bei der gezeichneten Form.

Im Plan reist nur die Id mit, nie die Zeichnung: Projektdateien bleiben klein, und
nachgebesserte Symbole erreichen auch alte Pläne.
