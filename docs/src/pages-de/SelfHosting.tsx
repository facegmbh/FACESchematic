export default function SelfHostingPage() {
  return (
    <>
      <h1>Self-Hosting</h1>

      <p>
        FACESchematic lässt sich mit Docker selbst hosten. Es gibt zwei
        Compose-Profile: ein <strong>Produktions</strong>-Image, das das Frontend
        baut und mit nginx ausliefert, und ein <strong>Entwicklungs</strong>-Image,
        das das Repository beim Start des Containers klont und den
        Vite-Entwicklungsserver mit Hot Reload startet. Alle Offline-Funktionen
        der Zeichenfläche arbeiten genauso wie in der gehosteten Version unter{" "}
        <a href="https://easyschematic.live">easyschematic.live</a>.
      </p>

      <div
        className="border-l-4 border-blue-400 bg-blue-50 p-4 rounded-r my-4"
        role="note"
      >
        <strong>Hinweis:</strong> Die Cloud-Funktionen — Speichern in der Cloud,
        Geräte-Einreichungen, geteilte Links — sprechen mit der gehosteten API
        unter{" "}
        <code>api.easyschematic.live</code>. Die API läuft auf Cloudflare Workers
        und ist nicht im Docker-Image enthalten. Für den reinen Lesezugriff
        (Gerätebibliothek durchsuchen, geteilte Schaltpläne laden) ist weder ein
        Konto noch ein API-Schlüssel nötig.
      </div>

      <h2>Produktion (nginx)</h2>

      <p>
        Baut die App im Image und liefert die statischen Dateien auf Port{" "}
        <strong>8080</strong> aus.
      </p>

      <pre>
        <code>{`git clone https://github.com/duremovich/EasySchematic.git
cd FACESchematic
docker compose up -d`}</code>
      </pre>

      <p>
        <a href="http://localhost:8080">http://localhost:8080</a> im Browser
        öffnen. Der erste Build dauert einige Minuten, weil npm die
        Abhängigkeiten installiert und Vite die App bündelt.
      </p>

      <h3>Befehle für die Produktion</h3>

      <table>
        <thead>
          <tr>
            <th>Befehl</th>
            <th>Beschreibung</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <code>make build</code>
            </td>
            <td>Docker-Image bauen</td>
          </tr>
          <tr>
            <td>
              <code>make up</code>
            </td>
            <td>Container starten (Port 8080)</td>
          </tr>
          <tr>
            <td>
              <code>make down</code>
            </td>
            <td>Container stoppen</td>
          </tr>
          <tr>
            <td>
              <code>make restart</code>
            </td>
            <td>Container neu starten</td>
          </tr>
          <tr>
            <td>
              <code>make logs</code>
            </td>
            <td>Container-Logs mitlesen</td>
          </tr>
          <tr>
            <td>
              <code>make build-clean</code>
            </td>
            <td>Ohne Cache neu bauen</td>
          </tr>
        </tbody>
      </table>

      <p>
        Alternativ <code>docker compose</code> direkt verwenden — das Makefile
        ist nur eine bequeme Hülle um <code>compose.yml</code>.
      </p>

      <h2>Entwicklung (Vite, Pull zur Laufzeit)</h2>

      <p>
        Das Entwicklungsprofil nutzt <code>compose.dev.yml</code> und{" "}
        <code>docker/Dockerfile.dev</code>. Bei jedem Start legt der Container
        einen flachen Klon (Shallow Clone) des GitHub-Repositorys in einem
        benannten Docker-Volume an, führt{" "}
        <code>npm ci</code> aus und startet Vite auf Port <strong>5173</strong>.
        Der Klon bleibt zwischen Neustarts erhalten; spätere Starts holen also
        nur den neuesten Commit und installieren die Abhängigkeiten nur dann
        neu, wenn sich das Lockfile geändert hat.
      </p>

      <pre>
        <code>{`git clone https://github.com/duremovich/EasySchematic.git
cd FACESchematic
make dev`}</code>
      </pre>

      <p>
        <a href="http://localhost:5173">http://localhost:5173</a> öffnen. Der
        erste Start dauert etwa 30–60 Sekunden (Klonen + Installieren). Weitere
        Starts sind schneller (Pull + Prüfung).
      </p>

      <p>
        Auf dem eigenen Rechner werden nur die Compose-Dateien und das
        Verzeichnis <code>docker/</code> gebraucht; der Quellcode der Anwendung
        liegt im Container-Volume. Um auf einen anderen Branch oder Fork zu
        zeigen,{" "}
        <code>REPO_URL</code> und <code>BRANCH</code> in{" "}
        <code>compose.dev.yml</code> setzen oder sie vor dem Aufruf von{" "}
        <code>make dev</code> in der Shell überschreiben.
      </p>

      <h3>Befehle für die Entwicklung</h3>

      <table>
        <thead>
          <tr>
            <th>Befehl</th>
            <th>Beschreibung</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <code>make dev</code>
            </td>
            <td>Repository klonen oder aktualisieren und den Vite-Entwicklungsserver starten (im Vordergrund)</td>
          </tr>
          <tr>
            <td>
              <code>make dev-detach</code>
            </td>
            <td>Wie <code>make dev</code>, läuft aber im Hintergrund</td>
          </tr>
          <tr>
            <td>
              <code>make dev-down</code>
            </td>
            <td>Entwicklungs-Container stoppen</td>
          </tr>
          <tr>
            <td>
              <code>make dev-logs</code>
            </td>
            <td>Logs des Entwicklungs-Containers mitlesen</td>
          </tr>
          <tr>
            <td>
              <code>make dev-update</code>
            </td>
            <td>Entwicklungs-Container neu starten (führt Pull und <code>npm ci</code> erneut aus)</td>
          </tr>
        </tbody>
      </table>

      <p>
        Gleichwertiger Compose-Aufruf:
      </p>

      <pre>
        <code>docker compose -f compose.dev.yml up</code>
      </pre>

      <p>
        Um den geklonten Quellcode zu löschen und frisch von GitHub zu beginnen:
      </p>

      <pre>
        <code>{`docker compose -f compose.dev.yml down -v
make dev`}</code>
      </pre>

      <h2>Die API mit <code>.env</code> konfigurieren</h2>

      <p>
        Standardmäßig spricht die App mit der gehosteten API unter{" "}
        <code>https://api.easyschematic.live</code>. Für den
        Entwicklungs-Container lässt sich das mit einer Datei <code>.env</code>{" "}
        im Wurzelverzeichnis des Repositorys überschreiben (demselben
        Verzeichnis, in dem <code>compose.yml</code> liegt). Die Datei steht in{" "}
        <code>.gitignore</code> und wird nie committet.
      </p>

      <ol>
        <li>
          Im geklonten FACESchematic-Verzeichnis eine Datei namens{" "}
          <code>.env</code> anlegen.
        </li>
        <li>
          Die API-URL eintragen, die Vite verwenden soll. Nur Variablen mit dem
          Präfix{" "}
          <code>VITE_</code> gelangen in das Browser-Bundle.
        </li>
        <li>
          Den Entwicklungs-Container starten oder neu starten, damit er die
          neuen Werte übernimmt (
          <code>make dev</code> oder <code>make dev-update</code>).
        </li>
      </ol>

      <p>Beispiel — die gehostete API verwenden (der Standard, ausdrücklich gesetzt):</p>

      <pre>
        <code>VITE_TEMPLATE_API_URL=https://api.easyschematic.live</code>
      </pre>

      <p>Beispiel — auf eine lokale API zeigen (z. B. Wrangler auf Port 8787):</p>

      <pre>
        <code>VITE_TEMPLATE_API_URL=http://localhost:8787</code>
      </pre>

      <p>
        Fehlt die <code>.env</code>, verwendet der Entwicklungsserver denselben
        Standard wie ein Produktions-Build. Die Community-Gerätebibliothek ist
        öffentlich, die Live-Bibliothek lädt also von <em>jedem</em> Origin —
        eine selbst gehostete Instanz zeigt die vollständige, aktuelle
        Bibliothek, egal auf welchem Port oder Host sie ausgeliefert wird.
        Cloud-Anmeldung und Speichern funktionieren von jedem{" "}
        <code>localhost</code>-Origin aus (die API lässt Loopback auf jedem Port
        zu); um sie von einer Domain außerhalb von Loopback zu nutzen, müsste
        dieser Origin in die CORS-Freigabeliste der API aufgenommen werden.
      </p>

      <p>
        Der nginx-Container für die Produktion liest <code>.env</code> zur
        Laufzeit nicht; die API-URL wird beim Build fest eingebaut. Um sie für
        ein selbst gehostetes Produktivsystem zu ändern, muss{" "}
        <code>VITE_TEMPLATE_API_URL</code> beim Bauen des Images als
        Build-Argument übergeben werden, oder es wird neu gebaut, nachdem die
        Variable in der Umgebung gesetzt wurde, die{" "}
        <code>npm run build</code> verwendet.
      </p>

      <h2>Port ändern</h2>

      <p>
        <strong>Produktion:</strong> <code>compose.yml</code> bearbeiten und den
        Host-Port ändern (die erste Zahl):
      </p>

      <pre>
        <code>{`ports:
  - "3000:80"  # now available at localhost:3000`}</code>
      </pre>

      <p>
        <strong>Entwicklung:</strong> <code>compose.dev.yml</code> bearbeiten und
        beide Seiten der Zuordnung ändern; wird der Container-Port geändert,
        denselben Port auch in{" "}
        <code>docker/entrypoint-dev.sh</code> an Vite übergeben.
      </p>

      <h2>Reverse Proxy</h2>

      <p>
        Um FACESchematic hinter einem Reverse Proxy (nginx, Caddy, Traefik)
        auszuliefern, den Proxy auf den Container-Port zeigen lassen. Für den
        Produktions-Container genügt ein einfacher HTTP-Proxy, da er nur
        statische Dateien ausliefert. Für den Entwicklungsserver muss der Proxy
        WebSocket-Upgrades unterstützen, wenn Vite Hot Module Replacement über
        den Proxy laufen soll.
      </p>

      <p>Beispielkonfiguration für Caddy (Produktion auf Port 8080):</p>

      <pre>
        <code>{`easyschematic.example.com {
    reverse_proxy localhost:8080
}`}</code>
      </pre>

      <h2>Was offline funktioniert</h2>

      <table>
        <thead>
          <tr>
            <th>Funktion</th>
            <th>Funktioniert in Docker</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Bearbeiten auf der Zeichenfläche, Geräte platzieren, Verbindungen</td>
            <td>Ja</td>
          </tr>
          <tr>
            <td>Mitgelieferte Offline-Gerätevorlagen (~780)</td>
            <td>
              Ja (beim Build mitgeliefert; die Live-Bibliothek der Community
              lädt weiterhin, wenn die gehostete API erreichbar ist)
            </td>
          </tr>
          <tr>
            <td>Export (PNG, SVG, DXF, PDF, JSON)</td>
            <td>Ja</td>
          </tr>
          <tr>
            <td>Import (JSON, Kabelliste als CSV)</td>
            <td>Ja</td>
          </tr>
          <tr>
            <td>Packliste, Kabelliste, Berichte</td>
            <td>Ja</td>
          </tr>
          <tr>
            <td>Automatisches Speichern im localStorage des Browsers</td>
            <td>Ja</td>
          </tr>
          <tr>
            <td>Drucken mit Schriftfeld</td>
            <td>Ja</td>
          </tr>
          <tr>
            <td>In Cloud speichern</td>
            <td>Konto erforderlich (nutzt die gehostete API)</td>
          </tr>
          <tr>
            <td>Geräte-Einreichungen</td>
            <td>Konto erforderlich (nutzt die gehostete API)</td>
          </tr>
          <tr>
            <td>Geteilte Links</td>
            <td>Gehostete API erforderlich</td>
          </tr>
        </tbody>
      </table>
    </>
  );
}
