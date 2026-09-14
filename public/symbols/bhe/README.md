# BHE symbol library

The drawn symbols of German security engineering (BHE Bundesverband Sicherheitstechnik).
An installation plan handed to an installer, an insurer or a Sachverständiger is read
against them, so the app draws them rather than its own shapes wherever it can.

**The artwork is not in this repository.** It is BHE member material, this repository is
public, and a licence to use symbols on plans is not a licence to republish the drawings.
What is committed is the code that uses them and the index of which symbol means what.

## Getting them in

With the member CD ("Symbole CD") reachable:

```
node tools/bheSymbols.mjs "<path to Symbole CD>"
```

That converts every symbol's PDF into a cropped SVG under this directory and writes the
index to `src/symbolLibraryCatalog.ts`. Both are generated; neither is committed.

## Getting them onto the server

The deploy builds on face-docker1 from a git checkout, which will not carry the artwork.
Either run the generator before the build and keep the output on that host, or commit the
files to a private repository the runner can reach. Until then the app runs without the
library: the picker says so, and every device keeps the shape it has always been drawn with.
