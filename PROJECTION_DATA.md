# Projektionsdaten (Epson)

Der Projektionsplaner im Grundriss (`SPEC-projektion.md`) rechnet mit den Daten, die auch
Epsons Throw Distance Simulator verwendet: je Objektiv und Bildformat der Zusammenhang
zwischen Bilddiagonale und Projektionsabstand, die Lens-Shift-Grenzen und der Lichtstrom.

## Die Daten liegen nicht in diesem Repository

Sie sind Epson-Material, und dieses Repository ist öffentlich. Eingecheckt ist nur der
Code, der sie benutzt. Ohne die Datei arbeitet der Planer weiter — dann mit einem von Hand
eingegebenen Projektionsverhältnis und Lichtstrom.

## Erzeugen

```
node tools/epsonThrowData.mjs
```

Holt die Daten bei Epson ab und schreibt `public/projection/epson.json` (rund 420 kB,
gitignoriert): alle Modelle, die festen Optiken und die Wechselobjektive je Panelgröße.

## Auf den Server

Auf face-docker1, außerhalb von git:

```
/home/user/faceschematic/projection/epson.json
```

```
node tools/epsonThrowData.mjs
rsync -a public/projection/ user@192.168.100.70:faceschematic/projection/
```

Der Deploy kopiert die Datei vor dem Image-Build in den Checkout (Schritt
„Projektionsdaten einsetzen“ in `.github/workflows/deploy.yml`). Danach einmal deployen.

## Aktualisieren

Kommt ein neues Epson-Modell dazu: Skript erneut laufen lassen, rsync, deployen. Bereits
gezeichnete Projektionen ändern sich dadurch nicht — jede speichert die Optik, mit der sie
geplant wurde. Um eine Projektion auf neue Daten zu heben, das Modell im Inspektor neu
auswählen.

## Was gerechnet wird

- **Abstand:** `a · Diagonale + b` je Bildformat, einmal für Wide, einmal für Tele.
- **Shift H:** seitlicher Versatz des Beamers zur Bildmitte in % der Bildbreite.
- **Shift V:** Höhe der Bildmitte über dem Objektiv in % der Bildhöhe. Bei vollem Shift H
  bleibt vertikal nur der kombinierte Wert, dazwischen linear.
- **Helligkeit:** Lichtstrom × Gain ÷ Bildfläche.

Der Abstand zählt ab dem Beamer-Symbol; die wenigen Zentimeter zwischen Gehäusemitte und
Objektiv-Vorderkante sind nicht berücksichtigt.
