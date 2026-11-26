export default function ApiPage() {
  return (
    <>
      <h1>Öffentliche API</h1>

      <p>
        Die Gerätedatenbank unter <code>api.easyschematic.live</code> stellt öffentliche Endpunkte mit reinem Lesezugriff bereit.
        Eine Authentifizierung ist nicht nötig. Die Antworten sind JSON und werden 5 Minuten lang gecacht.
      </p>
      <p>
        Diese Daten dürfen frei verwendet werden. Wer AV-Werkzeuge baut und eine strukturierte Datenbank professioneller
        audiovisueller Geräte mit Port-Definitionen, Signaltypen und Steckertypen braucht, darf sich gern bedienen.
      </p>

      <h2>Endpunkte</h2>

      <h3>GET /templates</h3>
      <p>Liefert alle Gerätevorlagen.</p>
      <pre><code>GET https://api.easyschematic.live/templates</code></pre>
      <p>Jede Vorlage enthält:</p>
      <ul>
        <li><code>id</code> — eindeutige ID der Vorlage</li>
        <li><code>version</code> — wird bei jeder Bearbeitung hochgezählt</li>
        <li><code>label</code> — Anzeigename (z. B. "BMD SDI→HDMI")</li>
        <li><code>deviceType</code> — Kategorie (z. B. "converter", "camera", "audio-mixer")</li>
        <li><code>manufacturer</code> — Markenname (optional)</li>
        <li><code>modelNumber</code> — Modellbezeichnung (optional)</li>
        <li><code>referenceUrl</code> — URL der Produktseite des Herstellers (optional)</li>
        <li><code>color</code> — Hex-Farbe des Geräts (optional)</li>
        <li><code>searchTerms</code> — Array mit Suchbegriffen (optional)</li>
        <li><code>ports</code> — Array mit Port-Objekten (siehe unten)</li>
      </ul>

      <h4>Port-Objekt</h4>
      <ul>
        <li><code>id</code> — eindeutige ID des Ports innerhalb der Vorlage</li>
        <li><code>label</code> — Anzeigename (z. B. "SDI In 1")</li>
        <li><code>signalType</code> — einer der Werte: <code>sdi</code>, <code>hdmi</code>, <code>ndi</code>, <code>dante</code>,
          {" "}<code>analog-audio</code>, <code>aes</code>, <code>dmx</code>, <code>madi</code>, <code>usb</code>, <code>ethernet</code>, <code>fiber</code>,
          {" "}<code>displayport</code>, <code>hdbaset</code>, <code>srt</code>, <code>genlock</code>, <code>gpio</code>,
          {" "}<code>rs422</code>, <code>serial</code>, <code>thunderbolt</code>, <code>composite</code>, <code>component-video</code>, <code>vga</code>,
          {" "}<code>power</code>, <code>power-l1</code>, <code>power-l2</code>, <code>power-l3</code>, <code>power-neutral</code>, <code>power-ground</code>,
          {" "}<code>midi</code>, <code>tally</code>, <code>spdif</code>, <code>adat</code>,
          {" "}<code>ultranet</code>, <code>aes50</code>, <code>stageconnect</code>, <code>wordclock</code>, <code>aes67</code>,
          {" "}<code>ydif</code>, <code>rf</code>, <code>st2110</code>, <code>custom</code></li>
        <li><code>direction</code> — <code>input</code>, <code>output</code> oder <code>bidirectional</code></li>
        <li><code>connectorType</code> — physischer Stecker (z. B. <code>bnc</code>, <code>hdmi</code>, <code>xlr-3</code>,
          {" "}<code>rj45</code>, <code>usb-c</code>) (optional)</li>
        <li><code>section</code> — Bezeichnung der Port-Gruppe (optional)</li>
      </ul>

      <h3>GET /templates/:id</h3>
      <p>Liefert eine einzelne Vorlage anhand ihrer ID, einschließlich der Nennung der Beitragenden.</p>
      <pre><code>GET https://api.easyschematic.live/templates/c0a80101-0006-4000-8000-000000000006</code></pre>
      <p>
        Zusätzlich zu den üblichen Vorlagenfeldern enthält dieser Endpunkt die Objekte <code>submittedBy</code> und{" "}
        <code>lastEditedBy</code> (jeweils mit einem Feld <code>name</code>), wenn die Vorlage von einem Mitglied der
        Community beigetragen oder bearbeitet wurde.
      </p>

      <h3>GET /templates/device-types</h3>
      <p>Liefert ein sortiertes Array aller unterschiedlichen <code>deviceType</code>-Werte, die derzeit in der Datenbank stehen.</p>
      <pre><code>GET https://api.easyschematic.live/templates/device-types</code></pre>
      <pre><code>["adapter", "audio-embedder", "audio-interface", "av-over-ip", "camera", ...]</code></pre>

      <h3>GET /templates/search-terms</h3>
      <p>Liefert ein sortiertes Array aller Suchbegriffe aus allen Vorlagen (kleingeschrieben, ohne Duplikate).</p>
      <pre><code>GET https://api.easyschematic.live/templates/search-terms</code></pre>
      <pre><code>["3g", "8x8", "aja", "blackmagic", "bolt", "capture", ...]</code></pre>

      <h3>GET /contributors</h3>
      <p>Liefert die 50 aktivsten Beitragenden der Community, geordnet nach der Zahl der freigegebenen Einreichungen.</p>
      <pre><code>GET https://api.easyschematic.live/contributors</code></pre>
      <p>Jeder Eintrag enthält <code>id</code>, <code>name</code> (Anzeigename oder anonymisierte E-Mail-Adresse), <code>approvedCount</code>, <code>createdCount</code> (neu eingereichte Vorlagen) und <code>editedCount</code> (Bearbeitungen bestehender Vorlagen).</p>

      <h2>Authentifizierung</h2>
      <p>
        Schreibende Operationen (Geräte einreichen, Moderation, Administration) erfordern eine sitzungsbasierte Authentifizierung über einen
        Magic Link per E-Mail. Diese Endpunkte sind hier nicht dokumentiert, da sie für die Nutzung über die Oberfläche der{" "}
        <a href="https://devices.easyschematic.live" target="_blank" rel="noopener noreferrer">Geräte-Website</a> gedacht sind.
      </p>

      <h2>Ratenbegrenzung</h2>
      <p>
        Die Lese-Endpunkte sind über die üblichen Schutzmechanismen von Cloudflare hinaus nicht ratenbegrenzt. Die Antworten enthalten{" "}
        <code>Cache-Control</code>-Header — bitte beachte sie, um unnötige Last zu vermeiden.
      </p>
    </>
  );
}
