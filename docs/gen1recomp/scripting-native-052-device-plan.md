# Native 0.5.2 — moderner nativer Tab-Baum

**Kandidat:** `Gen1Recomp Native 052` / 0.5.2 (052)

**SHA-256:** `e86c6b908c24bae7541d329430e092db269ab75ec40611feacf01ba3a25f67c0`

## Warum dieser Lauf nötig ist

Native 051 hat den Titel-Timer korrigiert, aber `t.__type__` trat weiterhin einmal auf. Damit ist die Native-050-Hypothese widerlegt, dass direkte legacy-`NavigationStack`-Kinder allein den Fehler beheben.

Native 052 verwendet nun die aktuelle offizielle iOS-18+-Struktur:

```text
TabView(selection)
├─ Tab(home)
│  └─ NavigationStack
├─ Tab(games)
│  └─ NavigationStack
└─ … insgesamt fünf native Tabs
```

Dies ist ein gezielter Kandidat, noch kein behaupteter Fix.

## 1. Identität und Komponentenbuilder

Im Log muss stehen:

```text
runtime identity 0.5.2 / 052
```

Bitte die Anzahl von

```text
Failed to build component ... t.__type__
```

vor dem Runtime-Start melden. **Pass:** kein Vorkommen. Bei erneutem Vorkommen startet die Runtime voraussichtlich trotzdem; dann wird als Nächstes eine noch kleinere Modal-/Toolbar-Isolation gebaut.

## 2. Native Tabs

Vor dem Spielstart kurz prüfen:

1. Start, Spiele, Updates, Mods und Einstellungen sind vorhanden.
2. Jeder Tab zeigt seinen richtigen Inhalt.
3. Auf Start führt **Spiele öffnen** zuverlässig zum Spiele-Tab.
4. Zurückwechseln zwischen allen Tabs verursacht keinen leeren Bildschirm und keinen weiteren Komponentenfehler.

## 3. Kumulative Spielregression

Yellow starten und auf folgende Identitäten achten:

```text
transient game title installed
transient game title shown for 5500ms
ready frame ...
viewport 440x956 CSS -> 1320x2868 canvas
```

Visuell:

- Titel erscheint post-ready und blendet wie in 051 aus;
- oberer Rand zeigt ihn erneut;
- Close schließt nativ;
- Vektor-Controls und Spiel funktionieren weiter.

## 4. Save-Funktionen — optional

Falls ein Spielstand vorhanden ist:

- **Spielstände aktualisieren**;
- nummerierten Slot mit **Öffnen** starten;
- **Backup** in Dateien exportieren.

Restore/Delete nur mit sicher vorhandenem Backup und eigener Zustimmung. Private Backup-Dateien müssen nicht geteilt werden.

## 5. Weiter offene separate Evidenz

- `cache=hit` nach einem zweiten Start desselben 052-Artefakts;
- Rückkehr nach Telefon-/Hintergrundunterbrechung;
- iPad, große Schrift und VoiceOver;
- Save-Restore/Delete-Roundtrip.
