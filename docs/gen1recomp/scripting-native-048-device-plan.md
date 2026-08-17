# Native 0.4.8 — Retina-Qualität und Telefonunterbrechung

**Kandidat:** `Gen1Recomp Native 048` / 0.4.8 (048)  
**SHA-256:** `de7fbce88a51c9e843277a2a142ec310e8dcbe8a4d6ba04fa76379872580413c`

Native 047 lief subjektiv deutlich flüssiger und erreichte bis zu 601 Frames in 10,017 Sekunden bei p95 20 ms. Native 048 konzentriert sich deshalb auf maximale sichtbare Qualität und robuste Unterbrechungen.

## 1. Retina- und Control-Qualität

Auf dem iPhone 16 Pro Max wird erwartet:

```text
visible viewport 440x956
viewport 440x956 CSS -> 1320x2868 canvas, scale 8, portrait, DPR 3
[host-ui] vector touch controls installed
display: 1320x2868 units, 1320x2868 px, fit scale 8 px/GB px
surface 1320x2868 canvas -> 440x956 CSS
```

Bitte beurteilen oder per Screenshot belegen:

- A/B-Kreise sauber und nicht pixelig;
- START/SELECT-Kapseln und Text scharf;
- D-pad-Kanten und Richtungshervorhebung sauber;
- Controls ausreichend groß, nicht überlappend und innerhalb sicherer Ränder;
- Spielpixel weiterhin scharf, quadratisch und ohne geometrische Streckung;
- volle Hochformatfläche und zusätzliche Welt weiterhin vorhanden.

Die Vektorgrafik ersetzt nur `TouchControls.draw`. Hit-Test, Multi-Touch, Press/Release, Haptik und Game-Boy-Buttonzustand bleiben upstream.

## 2. Performance bei voller Retina-Fläche

Bitte mindestens 30 Sekunden denselben Weg spielen und kopieren:

```text
performance ...
[host-perf] frame update ... draw ...
[host-perf] music synth ...
[host-perf] effect cache=hit ...
```

Native 048 übernimmt denselben Effektcache-Namespace. Die in Native 047 gespeicherten Effekte sollten daher bereits `cache=hit` melden. Wichtig ist, ob die höhere physische Auflösung die bisherige gleichmäßige Bewegung sichtbar verschlechtert.

## 3. Eingehenden Anruf reproduzieren

Nur wenn sicher und praktisch möglich:

1. Spiel starten und alle Berührungen loslassen.
2. Einen kurzen eingehenden Anruf annehmen oder ablehnen.
3. Zu Scripting/Gen1Recomp zurückkehren.

Erwartete Zeilen:

```text
lifecycle suspended hidden|blur at frame ...
lifecycle resumed visible|focus|pageshow after ...ms at frame ...
```

Falls der Frame danach nicht weiterlief, sollte erscheinen:

```text
lifecycle watchdog restarted stalled loop at frame ...
```

Bitte melden:

- Spiel läuft weiter oder bleibt eingefroren;
- Musik läuft weiter oder setzt aus;
- Eingabe reagiert und keine Richtung bleibt hängen;
- ob Scripting die WebView vollständig geschlossen/neugeladen hat.

Die Recovery kann einen pausierten WebView-Prozess fortsetzen. Wenn iOS oder Scripting den Prozess beendet, kann kein JavaScript denselben Prozess erhalten; das muss anhand des Logs unterschieden werden.

`t.__type__` bleibt ein separater Scripting-Komponentenbuilderfehler. Anzahl und Zeitpunkt bitte weiterhin mitloggen.
