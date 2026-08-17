# Native 0.4.6 — sichtbarer Viewport und Audio-Slices

**Kandidat:** `Gen1Recomp Native 046` / 0.4.6 (046)  
**SHA-256:** `82ff76ce5beacce9075fb4f5388fbe19b760d9f5504e8783d582c12a4ec88a96`

Native 045 hat zwei Ursachen messbar gemacht:

1. Scripting meldete vor der WebView-Präsentation nur `1×1` CSS-Pixel. Dadurch wurde korrekt, aber mit dem falschen Seitenverhältnis, eine quadratische `640×640`-Surface erzeugt und später als `440×440` dargestellt.
2. In ruhigen Zehn-Sekunden-Fenstern traten 26–52 Abstände über 50 ms auf. Die Frequenz liegt nahe an den 5,38 synchron erzeugten 8192-Sample-Musikblöcken pro Sekunde.

Native 046 startet das Bundle deshalb erst, wenn der präsentierte Viewport mindestens 250 ms stabil ist. Die Musik bleibt bei 44,1 kHz und verwendet denselben ChipSynth-Zustand; lediglich die Main-Thread-Arbeit wird in 1024-Sample-Blöcke geteilt und auf einen Block pro Update begrenzt.

## Bitte kopieren

Direkt nach dem Start:

```text
runtime identity 0.4.6 / 046
visible viewport ...; starting runtime
viewport ... CSS -> ... canvas, scale ..., ..., DPR ...
[host-perf] audio slicing samples=1024 buffers=128 initial=4 perCall=1
display: ...
surface ... canvas -> ... CSS
```

**Pass für den Viewport:** `visible viewport` und `viewport` dürfen nicht `1x1` sein; Canvas, LÖVE-Display und CSS-Fläche müssen zum tatsächlichen Hoch- oder Querformat passen. Bitte kurz beschreiben, ob die Fläche nun vollständig genutzt wird, mehr Welt sichtbar ist und nichts geometrisch gestreckt erscheint.

## Vergleichbare Ruckel-Messung

Bitte denselben Weg wie zuvor mindestens 40 Sekunden spielen und alle folgenden Zeilen kopieren:

```text
performance {"type":"preview.performance"...
[host-perf] music synth ...
[host-perf] effect synth ...
```

Wenn möglich je mindestens zehn Sekunden:

1. im Haus oder frei in Pallet Town laufen;
2. Oaks Erklärung/Namenswahl;
3. in Oaks Labor;
4. ein Kampf.

Bitte zusätzlich angeben:

- sichtbar flüssiger, gleich oder schlechter;
- Musik durchgehend oder mit Aussetzern;
- Tonhöhe/Tempo unverändert oder auffällig;
- welcher konkrete Ton/Schrei mit einer großen Pause zusammenfiel;
- ob D-pad/A/B/Start/Select weiterhin funktionieren und größer erscheinen.

Die direkten `host-perf`-Zeilen trennen Musik-Streaming von einmalig synchron erzeugten SFX/Schreien. Falls nach der Musik-Slice-Korrektur noch einzelne Hänger bleiben, wird damit der nächste Eingriff gezielt statt pauschal.

## Weiterhin offen

Bitte ebenfalls melden, ob `t.__type__` erneut vor dem Runtime-Start erscheint. Native 046 behebt diesen separaten, bislang nicht blockierenden Scripting-Komponentenfehler nicht.
