# Native 0.4.7 — gleichmäßige Frames und privater Effektcache

**Kandidat:** `Gen1Recomp Native 047` / 0.4.7 (047)  
**SHA-256:** `68077463086b37df5cc82bb3829b3a33fca444ed093bceeb6f194de14491620a`

Native 046 hat den Viewport korrigiert und das starke regelmäßige Ruckeln weitgehend entfernt. Tonwiedergabe war hörbar nicht defekt; die Synthese belegt jedoch denselben Main Thread wie Spiellogik und Rendering. Einzelne erstmals erzeugte Effekte benötigten 106–412 ms und erklären mehrere verbleibende sichtbare Hänger.

Native 047:

- verteilt Musik auf 512 Samples × maximal zwei Slices pro Update;
- behält 44,1 kHz, ChipSynth und maximal 1024 erzeugte Samples pro Update;
- speichert erstmals erzeugte SFX/Schreie als privaten PCM-WAV-Cache;
- akzeptiert einen Cachetreffer nur bei exakt passender vollständiger Synthese-Signatur;
- löscht diesen Cache zusammen mit dem Spielcache;
- misst `love.update` und `love.draw` getrennt.

## Lauf 1 — Cache aufbauen

Spiele erneut denselben Weg vom Haus nach Oaks Labor. Bleibe anschließend mindestens zwölf Sekunden im Spiel, damit IDBFS den privaten Cache sicher flushen kann.

Bitte kopieren:

```text
runtime identity 0.4.7 / 047
visible viewport ...
[host-perf] audio slicing samples=512 buffers=256 initial=4 perCall=2 cache=private
[host-perf] effect cache=store label=...
[host-perf] music synth ... slice=512
[host-perf] frame update ... draw ...
performance ...
```

`cache=store` darf beim ersten Auftreten noch einen sichtbaren Hänger haben. Entscheidend sind Label und CPU-Zeit.

## Lauf 2 — Cachetreffer prüfen

Schließe das Spielfenster vollständig, starte Native 047 erneut und spiele denselben Weg. Es darf keine ROM-Auswahl oder neue Extraktion nötig sein.

Bitte kopieren:

```text
[host-perf] effect cache=hit label=...
[host-perf] frame ...
performance ...
```

Für identische Effekte sollten im zweiten Lauf `cache=hit` statt `cache=store` erscheinen. Bitte melden:

- ob die kleinen Ruckler im zweiten Lauf verschwunden, seltener oder unverändert sind;
- welche `label=`-Zeile zeitlich zu einem sichtbaren Hänger gehört;
- ob Musik und Effekte unverändert klingen und ohne Aussetzer laufen;
- ob Spielbild, größere Controls und voller Hochformat-Viewport unverändert korrekt bleiben.

## Noch separat offen

`t.__type__` trat bei Native 046 zweimal vor dem erfolgreichen Runtime-Start auf. Native 047 verändert diesen Scripting-Komponentenbuilder nicht; bitte nur Anzahl und Zeitpunkt mitmelden.
