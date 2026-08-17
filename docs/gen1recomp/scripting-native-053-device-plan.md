# Native 0.5.3 — Toolbar-Isolation und korrekter Yellow-Status

**Kandidat:** `Gen1Recomp Native 053` / 0.5.3 (053)

**SHA-256:** `3cdef5e264e236ed70705ceac041fae48b3c3489e7f0e50341c5adc9daf7b0a4`

## Was Native 053 gezielt ändert

Native 052 bewies, dass die modernen Tabs korrekt gerendert werden, `t.__type__` aber nicht beseitigen. Native 053 entfernt deshalb alle fünf Toolbar-Deskriptoren und verwendet nur noch einen zentralen nativen Dismiss-Callback. Jeder Tab besitzt weiterhin einen sichtbaren gewöhnlichen **Schließen**-Button in seiner Liste.

Die Meldung „Noch kein Spiel importiert“ war eine UI-Fehlklassifikation: Home zählte ausschließlich `ready`-Spiele. Pending, Neuimport, Laden und Fehler sahen dadurch wie eine leere Bibliothek aus. Der erfolgreiche Yellow-Start beweist, dass die privaten Spieldaten nicht allein wegen dieser Anzeige verloren waren.

## 1. Identität und Komponentenfehler

Erwartete Identität:

```text
runtime identity 0.5.3 / 053
```

Bitte melden, ob davor erneut erscheint:

```text
Failed to build component ... t.__type__
```

**Pass:** kein Vorkommen. Falls es wiederkehrt, sind sowohl Tab- als auch Toolbar-Deskriptoren als vollständige Ursache ausgeschlossen und die nächste Isolation konzentriert sich auf den `WebViewController.present`-Modalpfad beziehungsweise dynamische List-Teilbäume.

## 2. Home-Status

Direkt nach Öffnen darf während der Initialisierung nur **Bibliothek wird geladen…** erscheinen, niemals vorschnell „Noch kein Spiel importiert“.

Nach dem Laden muss genau einer dieser Fälle sichtbar sein:

- `1 Spiel bereit`;
- `1 Spiel importiert` plus `1 Import ausstehend`;
- `1 Spiel importiert` plus `1 Neuimport erforderlich`;
- nur bei tatsächlich leerer geladener Registry: `Noch kein Spiel importiert`;
- bei Registryfehler: verständliche Fehlermeldung und **Spiele öffnen**.

Für das vorhandene Yellow ist „kein Spiel importiert“ nicht mehr zulässig.

## 3. Schließen und Tabs

1. Alle fünf Tabs öffnen.
2. Jeder Tab zeigt oben in der ersten Listengruppe einen Button **Schließen** mit X-Symbol.
3. Ein beliebiger dieser Buttons schließt die native Scripting-Seite.
4. App erneut öffnen und Yellow starten.

## 4. Kumulative Regression

Beim Yellow-Start weiterhin prüfen:

```text
transient game title shown for 5500ms
ready frame ...
viewport 440x956 CSS -> 1320x2868 canvas
```

Titel, Top-Reveal, Game-Close und Vektorsteuerung sollen unverändert funktionieren.

Save-Backup/Restore/Delete und Telefonunterbrechung bleiben optionale getrennte Tests; private Backupdaten müssen nicht geteilt werden.
