export default function DevicesAndPortsPage() {
  return (
    <>
      <h1>Geräte &amp; Ports</h1>

      <h2>Geräte</h2>
      <p>
        Jedes Gerät in FACESchematic ist ein Kasten auf der Zeichenfläche mit beschrifteten{" "}
        <strong>Ports</strong> an der linken und rechten Seite:
      </p>
      <ul>
        <li><strong>Eingangs-Ports</strong> (linke Seite) — nehmen Signale von anderen Geräten entgegen</li>
        <li><strong>Ausgangs-Ports</strong> (rechte Seite) — geben Signale an andere Geräte ab</li>
        <li>
          <strong>Bidirektionale Ports</strong> (beide Seiten) — können als Eingang oder als Ausgang arbeiten, aber
          immer nur in einer Richtung gleichzeitig
        </li>
      </ul>

      <h2>Signalarten</h2>
      <p>
        Jeder Port hat eine <strong>Signalart</strong>, die seine Farbe und seine Verbindungskompatibilität bestimmt.
        Verbinden lassen sich nur Ports <strong>derselben Signalart</strong>, mit Ausnahmen dort, wo die echte Hardware
        zusammenarbeitet: Ein <strong>SLink</strong>-Port von Allen &amp; Heath lässt sich direkt mit <strong>dSnake</strong>-,
        <strong> DX5</strong>- und <strong>GigaACE</strong>-Ports verbinden, da SLink alle drei Protokolle automatisch erkennt.
        FACESchematic bringt 72 eingebaute Signalarten für Video, Audio, Daten, Strom und Steuerung mit:
      </p>
      <table>
        <thead>
          <tr>
            <th>Signalart</th>
            <th>Farbe</th>
            <th>Einsatz</th>
          </tr>
        </thead>
        <tbody>
          <tr><td colSpan={3}><strong>Video</strong></td></tr>
          <tr><td><strong>SDI</strong></td><td>Blau</td><td>Broadcast-Video (BNC)</td></tr>
          <tr><td><strong>HDMI</strong></td><td>Rot</td><td>Consumer-/Prosumer-Video</td></tr>
          <tr><td><strong>DisplayPort</strong></td><td>Dunkles Blaugrün</td><td>Display-Verbindungen</td></tr>
          <tr><td><strong>Composite</strong></td><td>Gelb</td><td>Älteres analoges Video (BNC/Cinch)</td></tr>
          <tr><td><strong>Component Video</strong></td><td>Grün/Blau/Rot</td><td>Älteres analoges Komponentenvideo (Y/Pb/Pr, dreimal BNC/Cinch)</td></tr>
          <tr><td><strong>VGA</strong></td><td>Dunkelblau</td><td>Analoges Video (DB15)</td></tr>
          <tr><td><strong>S-Video</strong></td><td>Bernstein</td><td>Älteres Y/C-Video (Mini-DIN-4)</td></tr>
          <tr><td><strong>DVI</strong></td><td>Tiefblau</td><td>Digital Visual Interface</td></tr>

          <tr><td colSpan={3}><strong>Video über IP</strong></td></tr>
          <tr><td><strong>NDI</strong></td><td>Grün</td><td>Netzwerkvideo (NewTek)</td></tr>
          <tr><td><strong>HDBaseT</strong></td><td>Violett</td><td>HDMI über Cat-Kabel</td></tr>
          <tr><td><strong>SRT</strong></td><td>Waldgrün</td><td>Streaming-Protokoll</td></tr>
          <tr><td><strong>ST 2110</strong></td><td>Tiefes Indigo</td><td>IP-Medientransport nach SMPTE 2110</td></tr>

          <tr><td colSpan={3}><strong>Audio</strong></td></tr>
          <tr><td><strong>Dante</strong></td><td>Orange</td><td>Netzwerkaudio (Audinate)</td></tr>
          <tr><td><strong>AVB</strong></td><td>Limette</td><td>Netzwerkaudio (IEEE 802.1 / TSN, Avnu — Biamp, Meyer, MOTU, PreSonus)</td></tr>
          <tr><td><strong>Analog Audio</strong></td><td>Braun</td><td>XLR-/TRS-Audio</td></tr>
          <tr><td><strong>Speaker-Level</strong></td><td>Braun</td><td>Verstärkter Lautsprecherausgang (Bananenstecker, Polklemme, speakON)</td></tr>
          <tr><td><strong>Bluetooth</strong></td><td>Blau</td><td>Drahtloses Audio (kein physisches Kabel)</td></tr>
          <tr><td><strong>AES</strong></td><td>Lila</td><td>Digitales Audio</td></tr>
          <tr><td><strong>MADI</strong></td><td>Smaragd</td><td>Mehrkanaliges digitales Audio (BNC/Glasfaser)</td></tr>
          <tr><td><strong>S/PDIF</strong></td><td>Helles Violett</td><td>Digitales Audio (koaxial, Cinch)</td></tr>
          <tr><td><strong>ADAT</strong></td><td>Dunkles Cyan</td><td>Mehrkanaliges optisches Audio (TOSLINK)</td></tr>
          <tr><td><strong>Ultranet</strong></td><td>Smaragd</td><td>Personal Monitoring von Behringer</td></tr>
          <tr><td><strong>AES50</strong></td><td>Lila</td><td>Digitales Audio von Klark Teknik/Behringer</td></tr>
          <tr><td><strong>StageConnect</strong></td><td>Orange</td><td>Digitales Audio von Yamaha</td></tr>
          <tr><td><strong>AES67</strong></td><td>Tiefes Indigo</td><td>Interoperabilitätsstandard für AoIP</td></tr>
          <tr><td><strong>YDIF</strong></td><td>Dunkles Cyan</td><td>Digitale Schnittstelle von Yamaha</td></tr>
          <tr><td><strong>GigaACE</strong></td><td>Violett</td><td>Proprietäres Audionetzwerk von Allen &amp; Heath</td></tr>
          <tr><td><strong>DX5</strong></td><td>Helleres Violett</td><td>DX5-Audionetzwerk von Allen &amp; Heath</td></tr>
          <tr><td><strong>SLink</strong></td><td>Helles Violett</td><td>SLink-Audionetzwerk von Allen &amp; Heath</td></tr>
          <tr><td><strong>SoundGrid</strong></td><td>Tiefes Violett</td><td>SoundGrid-Audionetzwerk von Waves</td></tr>
          <tr><td><strong>fibreACE</strong></td><td>Lila</td><td>Glasfaser-Audionetzwerk von Allen &amp; Heath</td></tr>
          <tr><td><strong>dSnake</strong></td><td>Orange</td><td>dSnake-Protokoll von Allen &amp; Heath über Cat5</td></tr>
          <tr><td><strong>Digilink</strong></td><td>Indigo</td><td>Digilink-Audio-I/O von Avid/Digidesign (HD/HDX)</td></tr>
          <tr><td><strong>BLU link</strong></td><td>Blau</td><td>Digitaler Audiobus von BSS/Harman Soundweb London</td></tr>

          <tr><td colSpan={3}><strong>Netzwerk</strong></td></tr>
          <tr><td><strong>Ethernet</strong></td><td>Blaugrün</td><td>Netzwerkdaten</td></tr>
          <tr><td><strong>Glasfaser</strong></td><td>Bernstein</td><td>Lichtwellenleiter</td></tr>

          <tr><td colSpan={3}><strong>Steuerung / Daten</strong></td></tr>
          <tr><td><strong>USB</strong></td><td>Pink</td><td>USB-Verbindungen</td></tr>
          <tr><td><strong>Thunderbolt</strong></td><td>Indigo</td><td>Schnelle I/O-Schnittstelle</td></tr>
          <tr><td><strong>DMX</strong></td><td>Dunkelrot</td><td>Lichtsteuerung (XLR-5)</td></tr>
          <tr><td><strong>GPIO</strong></td><td>Warmes Grau</td><td>Universelle Ein-/Ausgänge</td></tr>
          <tr><td><strong>Kontaktschluss</strong></td><td>Schiefer</td><td>Potentialfreie Relaisausgänge / -eingänge</td></tr>
          <tr><td><strong>Sensor</strong></td><td>Grau</td><td>Sensoreingang (Präsenz, Tageslicht, Kontakt)</td></tr>
          <tr><td><strong>Control Voltage</strong></td><td>Bernstein</td><td>Steuerspannung 0–10 V (Lichtdimmer, Modularsynthesizer)</td></tr>
          <tr><td><strong>RS-422</strong></td><td>Tiefes Violett</td><td>Maschinensteuerung</td></tr>
          <tr><td><strong>RS-485</strong></td><td>Violett</td><td>Serielle Multi-Drop-Steuerung</td></tr>
          <tr><td><strong>Seriell</strong></td><td>Grau</td><td>Allgemein seriell</td></tr>
          <tr><td><strong>Tally</strong></td><td>Rosé</td><td>Tally-/Statusanzeigen</td></tr>
          <tr><td><strong>Art-Net</strong></td><td>Bernstein</td><td>Netzwerkprotokoll für Licht (Ethernet)</td></tr>
          <tr><td><strong>sACN</strong></td><td>Gelb</td><td>Lichtprotokoll Streaming ACN</td></tr>
          <tr><td><strong>nLight</strong></td><td>Goldener Bernstein</td><td>Steuerbus Acuity nLight für Architekturbeleuchtung (über Cat5/RJ45)</td></tr>
          <tr><td><strong>IR</strong></td><td>Orange</td><td>Infrarotsteuerung</td></tr>
          <tr><td><strong>DX Link</strong></td><td>Blau</td><td>Steuernetzwerk von AMX/Harman</td></tr>
          <tr><td><strong>eBUS</strong></td><td>Schiefer</td><td>Steuerbus Crestron eBUS</td></tr>
          <tr><td><strong>Cresnet</strong></td><td>Magenta</td><td>Steuerbus Crestron Cresnet</td></tr>
          <tr><td><strong>Extron Expansion</strong></td><td>Schiefer</td><td>Proprietärer Erweiterungsbus von Extron</td></tr>
          <tr><td><strong>POTS</strong></td><td>Grau</td><td>Klassischer Telefondienst / analoge Telefonleitung</td></tr>
          <tr><td><strong>MIDI</strong></td><td>Fuchsia</td><td>Musical Instrument Digital Interface</td></tr>

          <tr><td colSpan={3}><strong>Sync / Takt</strong></td></tr>
          <tr><td><strong>Genlock</strong></td><td>Schiefer</td><td>Sync-/Timing-Referenz</td></tr>
          <tr><td><strong>Word Clock</strong></td><td>Schiefer</td><td>Taktreferenz</td></tr>
          <tr><td><strong>Timecode</strong></td><td>Cyan</td><td>Timecode-Synchronisation</td></tr>
          <tr><td><strong>DARS</strong></td><td>Schiefer</td><td>Digital Audio Reference Signal</td></tr>
          <tr><td><strong>GPS</strong></td><td>Smaragd</td><td>GPS-Zeitreferenz</td></tr>

          <tr><td colSpan={3}><strong>Streaming</strong></td></tr>
          <tr><td><strong>RF</strong></td><td>Magenta</td><td>Hochfrequenz (Funk, Antenne)</td></tr>
          <tr><td><strong>RTMP</strong></td><td>Rot</td><td>Real-Time Messaging Protocol</td></tr>
          <tr><td><strong>RTSP</strong></td><td>Orange</td><td>Real-Time Streaming Protocol</td></tr>
          <tr><td><strong>MPEG-TS</strong></td><td>Gold</td><td>MPEG Transport Stream</td></tr>

          <tr><td colSpan={3}><strong>Strom</strong></td></tr>
          <tr><td><strong>Power</strong></td><td>Dunkler Bernstein</td><td>Stromverbindungen</td></tr>
          <tr><td><strong>L1 (Phase A)</strong></td><td>Schwarz</td><td>Drehstrom, Phase A</td></tr>
          <tr><td><strong>L2 (Phase B)</strong></td><td>Rot</td><td>Drehstrom, Phase B</td></tr>
          <tr><td><strong>L3 (Phase C)</strong></td><td>Blau</td><td>Drehstrom, Phase C</td></tr>
          <tr><td><strong>Neutral</strong></td><td>Grau</td><td>Neutralleiter</td></tr>
          <tr><td><strong>Erde</strong></td><td>Grün</td><td>Schutzleiter / Erde</td></tr>

          <tr><td colSpan={3}><strong>Sonstige</strong></td></tr>
          <tr><td><strong>Benutzerdefiniert</strong></td><td>Frei wählbar</td><td>Eigene Signalarten für alles, was oben nicht abgedeckt ist</td></tr>
        </tbody>
      </table>

      <h2>Mehrere Ports auf einmal anlegen</h2>
      <p>
        Im Geräte-Editor legt <strong>+ Mehrere anlegen</strong> in der Kopfzeile jedes Port-Abschnitts einen
        nummerierten Bereich von Ports in einem Zug an. Gewählt werden ein <strong>Präfix</strong>, die Nummern <strong>von</strong> und
        <strong> bis</strong>, die <strong>Signalart</strong> und der <strong>Steckverbinder</strong>.
        Der Steckverbinder steht anfangs auf dem für das Signal üblichen, sodass ein Glasfaser-Switch SFP-Ports bekommen
        kann, ohne danach jeden Ethernet-Port einzeln zu bearbeiten. Wird <strong>Leerzeichen vor der Nummer</strong> abgewählt, heißen die Ports
        „Port1“ statt „Port 1“. Die Vorschauzeile zeigt die Namen, bevor sie angelegt werden.
      </p>

      <h2>Port-Abschnitte</h2>
      <p>
        Geräte mit vielen Ports können diese in <strong>Abschnitte</strong> gliedern — logische Gruppen wie „Video“,
        „Audio“, „Control“. Abschnitte erscheinen als beschriftete Trenner innerhalb der Port-Spalten.
      </p>

      <h2>Erweiterungs-Slots</h2>
      <p>
        Manche Geräte haben <strong>Erweiterungs-Slots</strong> — wechselbare Kartenschächte, die verschiedene I/O-Karten aufnehmen.
        Das bildet die echte Hardware ab: Ein Router-Chassis kann leere Slots haben, die je nach Auftrag mit SDI-, HDMI-
        oder Glasfaserkarten bestückt werden.
      </p>
      <ul>
        <li><strong>Rechtsklick auf einen Slot</strong> an einem Gerät zeigt die verfügbaren Karten und setzt eine ein</li>
        <li>Jede Karte bringt ihre eigenen Ports in das übergeordnete Gerät ein</li>
        <li>Slots zeigen den Namen der aktuell eingebauten Karte (oder „Empty“, wenn sie unbelegt sind)</li>
        <li>Beim Tausch einer Karte werden die Ports der alten Karte entfernt und die der neuen hinzugefügt</li>
        <li>Im Geräte-Editor legt <strong>+ Slot anlegen</strong> einen Schacht an; <strong>+ Mehrere anlegen</strong>
          {" "}erzeugt einen nummerierten Bereich auf einmal (z. B. Slot 1–16) für große modulare Rahmen</li>
      </ul>
      <p>
        Manche Erweiterungskarten haben eigene <strong>Unter-Slots</strong> — zum Beispiel eine
        Netzwerk-I/O-Karte mit SFP- oder QSFP-Schächten für wechselbare Transceiver. Diese verschachtelten Slots
        funktionieren genauso: Per Rechtsklick werden Module eingesetzt oder entnommen. Die Ports des Unter-Slots kommen
        neben den eigenen Ports der Karte zum übergeordneten Gerät hinzu.
      </p>

      <h2>Steckverbinder-Typen</h2>
      <p>
        Jeder Port kann einen <strong>Steckverbinder-Typ</strong> (XLR-3, HDMI, RJ45 usw.) haben, der die physische
        Kabelkompatibilität bestimmt. Manche Steckverbinder sind <strong>Kombi-Typen</strong> — eine XLR/TRS-Combo-Buchse
        nimmt zum Beispiel sowohl XLR-3- als auch 1/4"-TRS-Stecker auf. FACESchematic berücksichtigt das automatisch: Ein TRS-Kabel
        an einer Combo-Buchse zeigt keinen Konflikt, und die Kabelliste beschriftet es korrekt.
      </p>
      <table>
        <thead>
          <tr>
            <th>Steckverbinder</th>
            <th>Kabeltyp</th>
          </tr>
        </thead>
        <tbody>
          <tr><td colSpan={2}><strong>Video</strong></td></tr>
          <tr><td>BNC</td><td>Coaxial</td></tr>
          <tr><td>HDMI</td><td>HDMI</td></tr>
          <tr><td>DisplayPort</td><td>DisplayPort</td></tr>
          <tr><td>DVI</td><td>DVI</td></tr>
          <tr><td>Mini HDMI</td><td>Mini HDMI</td></tr>
          <tr><td>Micro HDMI</td><td>Micro HDMI</td></tr>
          <tr><td>Mini DisplayPort</td><td>Mini DisplayPort</td></tr>
          <tr><td>VGA (DB15)</td><td>VGA</td></tr>

          <tr><td colSpan={2}><strong>Audio</strong></td></tr>
          <tr><td>XLR-3</td><td>XLR</td></tr>
          <tr><td>XLR-5</td><td>XLR-5</td></tr>
          <tr><td>Mini XLR</td><td>Mini XLR</td></tr>
          <tr><td>XLR/TRS Combo</td><td>XLR</td></tr>
          <tr><td>{"1/4\" TRS (6.35mm)"}</td><td>{"1/4\" TRS"}</td></tr>
          <tr><td>{"1/4\" TS (6.35mm)"}</td><td>{"1/4\" TS"}</td></tr>
          <tr><td>3.5mm TRS</td><td>3.5mm TRS</td></tr>
          <tr><td>RCA</td><td>RCA</td></tr>
          <tr><td>TOSLINK</td><td>TOSLINK</td></tr>
          <tr><td>DIN-5</td><td>DIN-5</td></tr>
          <tr><td>speakON</td><td>speakON</td></tr>
          <tr><td>XLR-4</td><td>XLR-4</td></tr>
          <tr><td>Mini-DIN 4-pin</td><td>S-Video cable</td></tr>
          <tr><td>Mini-DIN 7-pin</td><td>Mini-DIN-7</td></tr>
          <tr><td>2.5mm TRS</td><td>2.5mm TRS</td></tr>

          <tr><td colSpan={2}><strong>Netzwerk / Daten</strong></td></tr>
          <tr><td>RJ45</td><td>Cat6</td></tr>
          <tr><td>EtherCon</td><td>Cat6 (EtherCon)</td></tr>
          <tr><td>SFP/SFP+</td><td>SFP Fiber</td></tr>
          <tr><td>LC Fiber</td><td>LC Fiber</td></tr>
          <tr><td>SC Fiber</td><td>SC Fiber</td></tr>
          <tr><td>ST Fiber</td><td>ST Fiber</td></tr>
          <tr><td>opticalCON</td><td>opticalCON Fiber</td></tr>
          <tr><td>QSFP</td><td>QSFP Fiber</td></tr>
          <tr><td>MPO/MTP</td><td>MPO Fiber</td></tr>
          <tr><td>RJ11</td><td>RJ11</td></tr>
          <tr><td>RJ12</td><td>RJ12</td></tr>

          <tr><td colSpan={2}><strong>USB</strong></td></tr>
          <tr><td>USB-A</td><td>USB</td></tr>
          <tr><td>USB-B</td><td>USB</td></tr>
          <tr><td>USB-C</td><td>USB-C</td></tr>
          <tr><td>USB Mini-B</td><td>USB</td></tr>
          <tr><td>USB Micro-B</td><td>USB</td></tr>

          <tr><td colSpan={2}><strong>D-Sub / Seriell</strong></td></tr>
          <tr><td>DB9</td><td>DB9</td></tr>
          <tr><td>DB15</td><td>DB15</td></tr>
          <tr><td>DB25</td><td>DB25</td></tr>
          <tr><td>DB37</td><td>DB37</td></tr>
          <tr><td>D-Sub 7W2</td><td>D-Sub 7W2</td></tr>
          <tr><td>Phoenix</td><td>Phoenix</td></tr>
          <tr><td>Terminal Block</td><td>Terminal Block</td></tr>

          <tr><td colSpan={2}><strong>Strom</strong></td></tr>
          <tr><td>powerCON</td><td>powerCON</td></tr>
          <tr><td>powerCON TRUE1</td><td>powerCON TRUE1</td></tr>
          <tr><td>Edison</td><td>Edison</td></tr>
          <tr><td>IEC C13/C14</td><td>IEC C13/C14 (Kaltgerätekabel — Einbaustecker C14, Kupplung C13)</td></tr>
          <tr><td>IEC C5</td><td>IEC C5</td></tr>
          <tr><td>IEC C7</td><td>IEC C7</td></tr>
          <tr><td>IEC C15</td><td>IEC C15</td></tr>
          <tr><td>IEC C20</td><td>IEC C20</td></tr>
          <tr><td>L5-20</td><td>L5-20</td></tr>
          <tr><td>L6-20</td><td>L6-20</td></tr>
          <tr><td>L6-30</td><td>L6-30</td></tr>
          <tr><td>L21-30</td><td>L21-30</td></tr>
          <tr><td>Cam-Lok</td><td>Cam-Lok</td></tr>
          <tr><td>Socapex</td><td>Socapex</td></tr>
          <tr><td>DC Barrel</td><td>DC Barrel</td></tr>
          <tr><td>Kycon 4-pin</td><td>Kycon 4-pin (verriegelbare DC-Versorgung)</td></tr>

          <tr><td colSpan={2}><strong>Lautsprecher</strong></td></tr>
          <tr><td>Banana</td><td>Speaker Wire</td></tr>
          <tr><td>Binding Post</td><td>Speaker Wire</td></tr>
          <tr><td>Binding Post/Banana</td><td>Speaker Wire</td></tr>

          <tr><td colSpan={2}><strong>RF</strong></td></tr>
          <tr><td>Reverse TNC</td><td>Reverse TNC</td></tr>
          <tr><td>SMA</td><td>SMA</td></tr>

          <tr><td colSpan={2}><strong>Sonstige</strong></td></tr>
          <tr><td>Multi-pin</td><td>Multi-pin</td></tr>
          <tr><td>Wireless</td><td>—</td></tr>
          <tr><td>None</td><td>—</td></tr>
          <tr><td>Other</td><td>Other</td></tr>
        </tbody>
      </table>
      <p>
        <strong>Steckverbinder für blanke Adern</strong> — Ports vom Typ Phoenix und Terminal Block sind mit jedem
        anderen Steckverbinder-Typ kompatibel, da am Panel kein physischer Steckverbinder sitzt — das Kabel wird direkt
        in der Klemme aufgelegt. FACESchematic überspringt bei diesen Verbindungen die Adapter-Abfrage.
      </p>

      <h2>Steckerausführung</h2>
      <p>
        Die meisten Steckverbinder haben eine <strong>Ausführung</strong> (männlich oder weiblich), von der abhängt, welches Kabel tatsächlich gebraucht wird. FACESchematic
        leitet die Ausführung automatisch aus Steckverbinder-Typ und Richtung ab — ein XLR-3-Eingang ist zum Beispiel weiblich und
        ein XLR-3-Ausgang männlich, während powerCON-Eingänge männlich und -Ausgänge weiblich sind. Steckverbinder mit fester Ausführung
        (RJ45, HDMI, USB-C usw.) sind unabhängig von der Richtung immer gleich.
      </p>
      <p>
        Bei Steckverbindern, deren Ausführung an echten Geräten tatsächlich wechselt (XLR-Familie, powerCON, IEC, Cam-Lok, Bananenstecker, speakON,
        BNC, TRS), zeigt der Port-Editor neben dem Steckverbinder-Typ ein <strong>Auswahlfeld zum Überschreiben der Ausführung</strong>. Es wird gesetzt, wenn
        die tatsächliche Hardware des Geräts nicht der üblichen Konvention folgt — etwa bei einem Trennübertrager gegen Brummschleifen mit
        männlichen XLR-Eingängen.
      </p>
      <p>
        Die Ausführung fließt in die <strong>Kabelliste</strong> ein. Ein Kabelstecker hat immer die <em>entgegengesetzte</em> Ausführung des Ports, in den
        er gesteckt wird — ein männlicher Stecker passt in eine weibliche Buchse. Bei einer normalen Strecke von Gerät zu Gerät (weiblicher Eingang, männlicher Ausgang)
        ist das ein übliches M-F-Kabel, und die Packliste zeigt den einfachen Kabelnamen.
      </p>
      <p>
        Haben beide Endpunkte dieselbe Ausführung, erhält die Kabelbezeichnung einen Zusatz, der die Enden des Kabels selbst beschreibt:
      </p>
      <ul>
        <li>Zwei weibliche Ports (z. B. Vorder- und Rückseite eines TT-Bantam-Patchfelds) brauchen ein <strong>M-M</strong>-Kabel — männliche Stecker an beiden Enden</li>
        <li>Zwei männliche Ports (selten — z. B. zwei geräteseitige IEC-Einbaustecker, Rücken an Rücken verdrahtet) brauchen ein <strong>F-F</strong>-Kabel</li>
      </ul>

      <h2>Patchpanels</h2>
      <p>
        Patchpanels (RJ45-Panels, BNC-Videofelder, XLR-Audiofelder, Glasfaser-Panels, TT-Bantam-Patchfelder) sind bidirektionale
        Durchführungen mit Ports auf zwei physischen Seiten. FACESchematic bildet sie als besonderen Gerätetyp ab:
      </p>
      <ul>
        <li>Der Port-Editor zeigt die beiden Seiten als <strong>Rückseite</strong> und <strong>Front</strong> statt „Eingänge“ und „Ausgänge“</li>
        <li>Das Gerät auf der Zeichenfläche zeigt <strong>Rückseite</strong> links und <strong>Front</strong> rechts, mit einer Überschrift über jeder Spalte</li>
        <li>Ports auf Rückseite und Front haben standardmäßig dieselbe Ausführung — Patchfelder haben in der Regel auf beiden Seiten weibliche Buchsen, sodass ein
            Kabel zwischen zwei Front-Ports in der Packliste korrekt als <code>M-M</code> (männliche Stecker an beiden Kabelenden) erscheint</li>
        <li>Verbindungen funktionieren wie bei jedem anderen Gerät — von einer Seite dorthin ziehen, wohin das Kabel physisch führt</li>
      </ul>
      <p>
        Eingebaute Vorlagen decken RJ45 (12/24/32/48 Ports), BNC-Video, XLR-Audio, Glasfaser LC und TT-Bantam-Audio-Patchfelder
        in gängigen Port-Anzahlen ab.
      </p>
      <p>
        Ein eigener Bericht <strong>Patchfeld-Belegung</strong> (Menü → Berichte → Patchfelder) listet jeden Port jedes
        Patchpanels im Schaltplan auf — eine Zeile pro Port, auch die unbelegten. Jede Zeile zeigt Panel, Raum, Seite,
        Position, Steckverbinder, Ausführung und das, was am anderen Ende angeschlossen ist (Gerät, Port, Raum, Kabel-ID, Kabeltyp,
        Signal, Länge). Gruppiert wird nach Panel, Panel-Raum, Signalart oder Seite. Eine Belegungsanzeige oben im Bericht
        zeigt, wie viele Ports jedes Panels belegt sind, sodass freie Kapazität auf einen Blick zu erkennen ist.
      </p>

      <h2>Geräte bearbeiten</h2>
      <p>
        Ein <strong>Doppelklick</strong> auf ein beliebiges Gerät öffnet den Geräte-Editor. Dort lässt sich Folgendes tun:
      </p>
      <ul>
        <li>Das Gerät umbenennen</li>
        <li>Identitätsfelder bearbeiten — <strong>Hersteller</strong>, <strong>Modellnummer</strong>, <strong>Kategorie</strong> und eine <strong>Referenz-URL</strong> (Link zum Datenblatt)</li>
        <li>Ports hinzufügen, entfernen oder umsortieren</li>
        <li>Signalarten und Richtungen der Ports ändern</li>
        <li>Eine eigene Gehäusefarbe setzen oder über die separate <strong>Farbauswahl für die Kopfzeile</strong> die Farbe der Kopfzeile unabhängig davon festlegen</li>
        <li>Als wiederverwendbare eigene Vorlage speichern oder als Projekt-Preset setzen</li>
        <li>Auf die ursprünglichen Vorgaben der Vorlage oder auf das aktive Preset zurücksetzen</li>
        <li>Mit <strong>Ctrl+Enter</strong> (oder <strong>Cmd+Enter</strong> am Mac) aus jedem Feld heraus die Änderungen übernehmen und den Editor schließen</li>
        <li>Einen <strong>Hostname</strong> für netzwerkadressierbare Geräte setzen</li>
        <li>Die Markierung <strong>Vom Veranstaltungsort gestellt</strong> umschalten, um Geräte zu kennzeichnen, die der Veranstaltungsort stellt</li>
      </ul>

      <h3>Standard-Kopfzeilenfarbe</h3>
      <p>
        Wer die Kopfzeilenfarbe nicht Gerät für Gerät setzen möchte, wählt einen Standard unter{" "}
        <strong>Einstellungen → Darstellung → Kopfzeilenfarbe der Geräte</strong>. Es gibt zwei Einstellungen:
      </p>
      <ul>
        <li>
          <strong>Standard für neue Geräte</strong> — die eigene Vorliebe, angewendet in jedem Projekt,
          das auf diesem Rechner geöffnet wird.
        </li>
        <li>
          <strong>Nur dieses Projekt</strong> — eine Überschreibung, die in der Schaltplandatei gespeichert wird; sie
          reist also mit der Zeichnung mit und hat überall dort, wo sie gesetzt ist, Vorrang vor dem persönlichen Standard.
        </li>
      </ul>
      <p>
        In beiden Fällen wird die Farbe angewendet, sobald ein Gerät platziert wird — aus der Bibliothek, als eigenes
        Gerät, über einen CSV-Import oder als automatisch eingefügter Adapter. Geräte, die bereits auf der Zeichenfläche liegen,
        behalten ihre Farben; ändern lässt sich eine über die Farbauswahl für die Kopfzeile im Geräte-Editor. Ein
        Gerät behält seine eigene Kopfzeilenfarbe über ein <strong>Gerät tauschen...</strong> hinweg, und ein Gerät,
        das gar keine Kopfzeilenfarbe hat, übernimmt eine vom Ersatzmodell, wenn dieses Modell mit einer
        gespeichert wurde.
      </p>
      <p>
        Eine Kopfzeilenfarbe ist die Farbe des Geräts überall, wo es gezeichnet wird, nicht nur auf der Zeichenfläche. Sie
        tritt auch in der Rack-Ansicht, in den Rack-Exporten als SVG und PDF,
        im Frontblenden-Editor und im DXF-Export an die Stelle der eigenen Farbe des Geräts. Eine Standard-Kopfzeilenfarbe sorgt also dafür, dass alle
        neuen Geräte in diesen Ansichten eine gemeinsame Farbe haben, statt nach Gerätetyp eingefärbt zu werden — soll
        diese Farbcodierung erhalten bleiben, den Standard ungesetzt lassen oder die Kopfzeilenfarbe eines Geräts im Geräte-Editor
        entfernen.
      </p>

      <h3>Eine an einer Vorlage oder einem Preset gespeicherte Farbe hat Vorrang</h3>
      <p>
        Wird die Kopfzeilenfarbe eines Geräts gesetzt und das Gerät dann gespeichert — <strong>Als eigene Vorlage speichern</strong>,{" "}
        <strong>Eigene Vorlage aktualisieren</strong>, <strong>Als eigene Vorlage aktualisieren</strong> oder{" "}
        <strong>Als Preset speichern</strong> —, wird die Farbe mitgespeichert. Jedes Gerät, das aus
        dieser Vorlage oder aus dem Projekt-Preset dieser Vorlage platziert wird, erhält diese Farbe, ganz gleich, was
        die beiden Standard-Einstellungen sagen. Die vollständige Reihenfolge, die höchste Priorität zuerst:
      </p>
      <ol>
        <li>Die am <strong>Projekt-Preset</strong> der Vorlage gespeicherte Farbe</li>
        <li>Die an der <strong>Vorlage</strong> selbst gespeicherte Farbe</li>
        <li>Die Projekt-Überschreibung — <strong>Nur dieses Projekt</strong></li>
        <li>Der persönliche <strong>Standard für neue Geräte</strong></li>
        <li>Nichts davon — das Gerät wird in der Flächenfarbe des Themes gezeichnet</li>
      </ol>
      <p>
        Auf diese Weise wird nur eine Farbe gespeichert, die selbst gewählt wurde. Ein Gerät, das lediglich eine der
        Standardfarben trägt — jedes Gerät wird mit dem Standard eingefärbt, der beim Platzieren
        galt —, speichert eine Vorlage, die nichts über die Farbe aussagt, sodass weiterhin die Standards darüber
        entscheiden, genau wie zuvor. Um eine Vorlage oder ein Preset wieder in diesen Zustand zu versetzen, vor dem Speichern die Kopfzeilenfarbe
        des Geräts mit <strong>Zurücksetzen</strong> neben der Farbauswahl entfernen.
      </p>

      <h3>Wo welche Einstellung liegt</h3>
      <p>
        Das meiste davon reist mit der Zeichnung mit, ein Teil jedoch nie.
      </p>
      <ul>
        <li>
          Die <strong>Projekt-Überschreibung</strong> und die <strong>Projekt-Presets</strong> werden
          in die Schaltplandatei geschrieben und erreichen so jeden, der sie öffnet.
        </li>
        <li>
          <strong>Eigene Vorlagen</strong> werden ebenfalls in die Datei geschrieben, samt Kopfzeilenfarbe —
          und beim Öffnen dieser Datei wird jede Vorlage, die der Empfänger noch nicht hat, in dessen eigene
          Gerätebibliothek installiert. Eine Kopfzeilenfarbe, die an einer eigenen Vorlage gespeichert wird, folgt der Vorlage also auf
          die Rechner der Kollegen, wo sie auch in deren anderen Zeichnungen Vorrang vor deren Projekt-Überschreibungen
          hat. Eine Farbe an einer geteilten Vorlage sollte daher bewusst gespeichert werden.
        </li>
        <li>
          Der persönliche <strong>Standard für neue Geräte</strong> ist das Einzige, was auf dem
          Rechner bleibt, auf dem er gesetzt wurde. Er wird nie in die Datei geschrieben.
        </li>
      </ul>
      <p>
        Dieser letzte Punkt ist wichtig, wenn eine Datei zwischen Rechnern wandert. Der persönliche Standard wird
        nur in dem Moment herangezogen, in dem ein Gerät platziert wird; wird derselbe Schaltplan anderswo geöffnet, steht dort{" "}
        <strong>Nicht gesetzt</strong> unter <strong>Einstellungen → Darstellung</strong>, sofern dieser Rechner nicht
        seine eigene Einstellung hat — und neue Geräte, die dort hinzukommen, übernehmen die Einstellung <em>dieses</em> Rechners.
        Geräte, die bereits in der Zeichnung sind, bleiben unberührt: Ihre Farben wurden beim Platzieren
        fest eingetragen und reisen wie jede andere Geräteeigenschaft in der Datei mit. Soll eine Farbe in den Zeichnungen des ganzen
        Teams übereinstimmen, wird sie als Projekt-Überschreibung gesetzt oder an den Vorlagen und
        Presets gespeichert, aus denen alle platzieren.
      </p>

      <h2>Geräte tauschen</h2>
      <p>
        Ein Rechtsklick auf ein beliebiges Gerät und <strong>Gerät tauschen...</strong> ersetzt es durch ein
        anderes Modell — einen leeren Platzhalter zu einem echten Gerät machen, eine 32x32-Matrix
        auf eine 64x64 aufrüsten oder eine Marke gegen eine andere austauschen —, ohne die Verbindungen
        neu zu zeichnen, die daran hängen.
      </p>
      <p>
        Nach der Wahl eines Ersatzgeräts öffnet sich ein Dialog zur Port-Zuordnung, der automatisch vorschlägt, wo jede bestehende
        Verbindung am neuen Gerät landen soll, in dieser Rangfolge:
      </p>
      <ol>
        <li>Dieselbe Port-Abstammung in der Vorlage (passt über Versionen derselben Vorlage hinweg)</li>
        <li>Derselbe Port-Name und dieselbe Richtung (z. B. wird „INPUT 1“ an einer 3232 auf „INPUT 1“ an einer 6464 gelegt)</li>
        <li>Dieselbe Signalart, derselbe Steckverbinder und dieselbe Richtung</li>
        <li>Dieselbe Signalart und Richtung (mit einem Hinweis auf abweichenden Steckverbinder)</li>
        <li>Die Verbindung verwerfen</li>
      </ol>
      <p>
        Die Richtung wird nie automatisch gekreuzt — ein Ausgang wird nie einem Eingang zugeordnet, es sei denn, er wird
        ausdrücklich im Auswahlfeld gewählt; dann erscheint eine rote Warnung.
      </p>
      <p>
        Hat das neue Gerät <strong>Erweiterungs-Slots</strong> und braucht eine der Verbindungen, die
        erhalten bleiben sollen, Ports, die das neue Gerät an seinem Grundgerät nicht hat, baut der Dialog
        automatisch eine passende Karte in einen kompatiblen leeren Slot ein. Wird zum Beispiel
        eine dedizierte DisplayPort-Quelle gegen ein Chassis getauscht, das DisplayPort nur über Erweiterungskarten bietet,
        wird die Karte automatisch eingebaut, die für diese vier DisplayPort-Verbindungen nötig ist. Automatisch eingebaute
        Karten erscheinen als Kontrollkästchen — wird eines abgewählt, werden stattdessen die Verbindungen verworfen, die die Karte bedient.
      </p>
      <p>
        Karten, die bereits in den Slots des alten Geräts eingebaut sind, werden nach Slot-Familie in
        passende leere Slots des neuen Geräts <strong>übernommen</strong>. Gibt es keinen passenden Slot, listet der
        Dialog die Karten auf, die nicht übernommen werden konnten, damit sie von Hand wieder hinzugefügt werden können.
      </p>
      <p>
        Anpassungen einzelner Ports folgen der Verbindung an ihren neuen Platz — eigene Port-Namen (z. B.
        „Camera Bay A“ statt „INPUT 1“), die Netzwerkkonfiguration an Ethernet-/AoIP-Ports, Port-Notizen,
        PoE-Aufnahme und überschriebene Steckerausführungen bleiben alle erhalten. Auch Anpassungen am Gerät selbst wie
        eigener Hostname, Kurzname und die Einstellung zum Zeilenumbruch der Beschriftung überstehen den Tausch. Das Gerät behält
        seine Identität, sodass Rack-Platzierungen und der Rückgängig-Verlauf weiter funktionieren.
      </p>
      <p>
        Die Fußzeile fasst vor dem Bestätigen zusammen, wie viele Verbindungen neu zugeordnet und wie viele verworfen
        werden. Der gesamte Tausch ist ein einziger Rückgängig-Schritt.
      </p>

      <h2>Ports umlegen</h2>
      <p>
        Standardmäßig erscheinen Eingangs-Ports auf der <strong>linken</strong> Seite eines Geräts und Ausgangs-Ports auf
        der <strong>rechten</strong>. Jeder Port lässt sich <strong>umlegen</strong>, sodass er auf der gegenüberliegenden Seite erscheint.
      </p>
      <ul>
        <li><strong>Rechtsklick auf einen Port</strong> im Geräte-Editor legt ihn um</li>
        <li>Umgelegte Ports zeigen einen kleinen Pfeil, sodass sie auf einen Blick zu erkennen sind</li>
        <li>Nützlich für einen Signalfluss von links nach rechts oder zum Abbilden der physischen Rack-Anordnung</li>
        <li>Auch bidirektionale Ports lassen sich umlegen, um zu tauschen, auf welcher Seite sie standardmäßig liegen</li>
      </ul>

      <h2>Abmessungen</h2>
      <p>
        Geräte können physische Größenangaben speichern — <strong>Höhe</strong>, <strong>Breite</strong>
        {" "}und <strong>Tiefe</strong> in Millimetern sowie das <strong>Gewicht</strong> in Kilogramm.
        Gesetzt werden sie im Geräte-Editor in den Feldern für die Abmessungen. Diese Daten werden pro
        Gerät gespeichert und in Gerätevorlagen übernommen.
      </p>
      <p>
        Die Abmessungen steuern mehrere Funktionen im <a href="/racks">Rack-Editor</a>:
      </p>
      <ul>
        <li>
          <strong>Automatische Einordnung</strong> — eine Heuristik entscheidet anhand von Breite und Höhe,
          ob ein Gerät die volle Rackbreite (Frontplatte ≈482 mm) oder die halbe Rackbreite (≈220 mm) einnimmt, nur auf
          einen Fachboden gehört (kleine Tischgeräte) oder übergroß ist (passt nicht in ein 19&quot;-Rack). Wird ein kleines Gerät auf einen
          leeren Platz gezogen, legt FACESchematic einen 1-HE-Fachboden an und zentriert das Gerät darauf in seiner natürlichen Breite.
        </li>
        <li>
          <strong>Tiefenkonflikte in der Seitenansicht</strong> werden sichtbar, wenn ein tieferes Gerät über die
          Tiefe des Racks hinausragt oder mit rückseitig montierten Geräten kollidiert.
        </li>
        <li>
          <strong>Kennzahlen pro Rack</strong> — die Rack-Seite summiert die belegten HE, das Gesamtgewicht und die Leistungsaufnahme
          über alle platzierten Geräte.
        </li>
      </ul>
      <p>
        Für Sonderfälle, in denen die Größen-Heuristik danebenliegt (Tischgerät mit optionalen Rackwinkeln,
        Geräte halber Rackbreite mit ungewöhnlichen Maßen usw.), wird im Abschnitt Abmessungen des Geräte-Editors
        ausdrücklich eine <strong>Rack-Form</strong> gesetzt — <strong>Automatisch</strong>,{" "}
        <strong>Volle Breite</strong>, <strong>Halbe Breite</strong> oder <strong>Nur Fachboden</strong>.
      </p>

      <h2>Frontblenden-Editor</h2>
      <p>
        FACESchematic zeichnet die Frontplatte jedes Geräts in der
        <a href="/racks"> Rack-Ansicht</a> mit echten Steckverbinder-Symbolen. Ein Rechtsklick auf ein Gerät im Rack und{" "}
        <strong>Frontblenden-Layout bearbeiten</strong> erlaubt die Feinarbeit am Layout — Ports an eigene Positionen ziehen,
        am Raster einrasten, mehrere auswählen zum Ausrichten / Verteilen, eigene Beschriftungen hinzufügen und auf das
        automatische Layout zurücksetzen, falls es aus dem Ruder läuft.
      </p>
      <p>
        59 Steckverbinder-Typen werden nach Herstellerangaben in realen Millimetermaßen gezeichnet,
        in drei Detailstufen: Punkte bei kleiner Zoomstufe, Umrisse bei mittlerer Zoomstufe und detaillierte
        Symbole (Pin-Bilder, Ausrichtung der Schlitze, Anordnung der Kontakte) bei starker Vergrößerung.
        Eigene Layouts bleiben am Gerät oder an der Vorlage erhalten — einmal festlegen und das Layout
        bei jedem Platzieren des Geräts wiederverwenden.
      </p>

      <h2>Zusatzdaten</h2>
      <p>
        Jedes Gerät kann bis zu 5 Zeilen <strong>Zusatztext</strong> am unteren Rand
        des Geräts auf der Zeichenfläche anzeigen. Sie eignen sich für Angaben wie Seriennummern, Firmware-Versionen
        oder beliebige andere Metadaten zum einzelnen Gerät. Gesetzt werden die Zusatzzeilen im Geräte-Editor
        unter <strong>Zusatzdaten</strong>.
      </p>
      <p>Jede Zeile kann freier Text sein, eine gebundene Geräteeigenschaft oder eine Mischung aus beidem:</p>
      <ul>
        <li>
          <strong>Eigener Text</strong> — einfach das Gewünschte in die Zeile tippen.
        </li>
        <li>
          <strong>An eine Geräteeigenschaft binden</strong> — auf die Schaltfläche <strong>+</strong> neben
          einer Zeile klicken und ein Feld wählen. An der Cursorposition wird ein Platzhalter wie <code>{"{{hostname}}"}</code>
          {" "}eingefügt. Das Gerät zeigt den aktuellen Wert dieses Felds und aktualisiert sich automatisch,
          sobald sich das Feld ändert.
        </li>
        <li>
          <strong>Text und Platzhalter mischen</strong> — Platzhalter können mitten in freiem Text stehen. Wird zum Beispiel
          {" "}<code>IP: </code> getippt und dann das Feld Hostname eingefügt, ergibt das{" "}
          <code>IP: {"{{hostname}}"}</code>, was auf dem Gerät als <code>IP: studio-mixer-3</code> erscheint.
        </li>
        <li>
          <strong>Live-Vorschau</strong> — Zeilen, die einen Platzhalter enthalten, zeigen beim Bearbeiten unter dem Eingabefeld eine
          gedämpfte Zeile <code>→ preview</code>, sodass zu sehen ist, was das
          Gerät tatsächlich anzeigen wird.
        </li>
      </ul>
      <h3>Verfügbare Felder</h3>
      <ul>
        <li><strong>Identität</strong> — Gerätename, Hostname, Hersteller, Modellnummer, Gerätetyp</li>
        <li><strong>Strom</strong> — Leistungsaufnahme, Leistungsabgabe, PoE-Budget, Spannung</li>
        <li><strong>Physisch</strong> — Gewicht, Breite, Höhe, Tiefe</li>
        <li><strong>Kosten</strong> — Stückpreis</li>
        <li><strong>Ports</strong> — Ports gesamt, Eingangs-Ports, Ausgangs-Ports, Bidirektionale Ports, Belegte Ports</li>
      </ul>
      <p>
        Einheiten werden automatisch ergänzt — Strom-Felder erscheinen als <code>450 W</code>, physische
        Abmessungen als <code>482 mm</code>, das Gewicht als <code>12.3 kg</code> und die Kosten als <code>$1,299.00</code>.
        Ist ein gebundenes Feld an diesem Gerät leer, wird der Platzhalter zu nichts aufgelöst, aus{" "}
        <code>Weight: {"{{weightKg}}"}</code> wird also <code>Weight: </code>. Unbekannte Platzhalternamen
        (Tippfehler) bleiben als wörtlicher Text stehen, damit Fehler sichtbar sind.
      </p>
      <p>
        <em>Noch nicht unterstützt:</em> Felder einzelner Ports wie die IP-Adresse, das VLAN oder die
        MAC eines bestimmten Ports. Diese liegen an den einzelnen Ports und nicht am Gerät selbst und lassen sich in
        dieser Version nicht binden.
      </p>

      <h2>Port-Notizen</h2>
      <p>
        Jeder Port hat ein optionales Feld für <strong>Notizen</strong>, um die konkrete Verwendung zu dokumentieren —
        Ziele am Patchpanel, Signalbeschreibungen oder Konfigurationsdetails. Notizen werden pro
        Port im Geräte-Editor gesetzt. Port-Notizen erscheinen in den Berichten, in denen sie relevant sind.
      </p>

      <h2>Netzwerkkonfiguration</h2>
      <p>
        Geräte können ein Feld <strong>Hostname</strong> haben, das im Geräte-Editor gesetzt wird. Netzwerkfähige
        Ports (Ethernet, NDI, Dante, AVB, SRT, HDBaseT, AES67, ST 2110) können außerdem eine Netzwerkkonfiguration
        pro Port haben:
      </p>
      <ul>
        <li><strong>IP-Adresse</strong>, <strong>Subnetzmaske</strong> und <strong>Gateway</strong></li>
        <li><strong>VLAN-ID</strong></li>
        <li><strong>DHCP</strong> ein/aus</li>
        <li><strong>Verbindungsgeschwindigkeit</strong></li>
        <li><strong>PoE-Leistungsaufnahme</strong> (Watt)</li>
      </ul>
      <p>
        Die Netzwerkkonfiguration wird im Geräte-Editor in den Einstellungen des jeweiligen Ports eingetragen. Diese Daten fließen
        in den <a href="/pack-list">Netzwerkbericht</a> ein.
      </p>
      <p>
        <strong>USB-C Power Delivery.</strong> Ports mit einem USB-C-Steckverbinder erhalten zwei Watt-Felder
        pro Port — wie viel der Port <em>liefert</em> (ein Netzteil, ein Dock oder ein Laptop-Port) und wie viel er
        {" "}<em>aufnimmt</em> (ein busgespeistes Gerät). Anders als bei PoE teilen sich die Ports bei USB-C kein gemeinsames Budget,
        daher liegt die Angabe an jedem Port und nicht am Gerät. Liefert die Quelle einer Verbindung
        weniger, als das angeschlossene Gerät aufnimmt, wird das Kabel mit einer bernsteinfarbenen Unterversorgungswarnung markiert.
      </p>
    </>
  );
}
