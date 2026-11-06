# Wichteln – Rubbellos-Generator

Eine einzige Datei (`index.html`), kein Server, keine Anmeldung.

**Ablauf**
1. Organisator öffnet die Seite ohne `#…`, trägt Namen ein (optional: Ausnahmen wie Paare, Budget, Datum, Nachricht) und tippt auf „Auslosen“.
2. Für jede Person entsteht ein eigener Link `…/#l=<token>`. „Senden“ öffnet das Teilen-Menü (WhatsApp & Co.), das Kopier-Symbol kopiert Text + Link.
3. Wer den Link öffnet, bestätigt „Ja, das bin ich“ und rubbelt sein Los frei (Glöckchen, Konfetti, Vibration). Beim nächsten Öffnen ist es schon aufgerubbelt.

**Wie es funktioniert**
- Im Token steckt nur das eigene Los: `{v, k: Auslosungs-Nr., f: von, t: an, g, b, d, m}`, als JSON mit einem Zufalls-Salt XOR-verschleiert und base64url-kodiert. Der Teil nach `#` geht nie an den Server.
- Das ist Verschleierung, keine echte Verschlüsselung: Damit sieht niemand aus Versehen etwas, aber wer technisch versiert ist und alle Links hat (also der Organisator), könnte sie entschlüsseln.
- Auslosung: zufällig mischen (crypto-Zufall) bis gültig, also gleichverteilt. Niemand zieht sich selbst, Ausnahmen gelten in beide Richtungen, gegenseitige Paare („ich hab dich, du hast mich“) werden vermieden, solange die Ausnahmen das zulassen. Wenn es gar nicht geht, kommt eine Meldung.
- Der Organisator-Stand (Namen + Links) liegt nur im localStorage seines Geräts.
- Wird neu ausgelost, zeigen alte Links noch die alte Auslosung. Deshalb steht die Auslosungs-Nr. auf jedem Los.

**Musik:** Spieluhr-Version von „Stille Nacht“ (Gruber 1818, gemeinfrei) als `stille-nacht.mp3` (31 s, nahtlose Schleife), abgespielt über ein `<audio>`-Element – das startet am iPhone zuverlässig beim ersten Antippen und spielt auch bei Lautlos-Schalter. (Live per Web Audio erzeugt hat sie am iPhone erst nach Aus/An gespielt.) Neu rendern: `node tools/render_music.js` und dann `ffmpeg -y -i tools/stille-nacht.wav -codec:a libmp3lame -b:a 112k stille-nacht.mp3`. Lautstärke steckt in der Datei (`TARGET` im Script), weil das iPhone `audio.volume` ignoriert. Rubbel-Geräusch und Glöckchen laufen weiter über Web Audio. 🔊 oben rechts schaltet alles aus (wird gemerkt).

**Testen:** `.claude/launch.json` → „wichteln“ (Port 8767). `#demo` zeigt ein Beispiel-Los.
**og.png** ist das WhatsApp-Vorschaubild (1200×630, mit Chrome headless gerendert). Die og:image-URL in `index.html` zeigt auf `https://chrisladner.github.io/wichteln/og.png`.
