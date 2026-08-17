# Native 0.5.1 — Titel-/Tab-Regression und sichere Save-Backups

**Kandidat:** `Gen1Recomp Native 051` / 0.5.1 (051)

**SHA-256:** `6ab5468aac85c3e125e708dfb0b9c19dd361943add5008c95463e0172180e9cc`

**Status:** Teilweise als physischer Run 017 ausgeführt. Runtime/Retina/post-ready-Titel bestanden; `t.__type__` trat erneut auf; Save-/Close-/Unterbrechungsabschnitte blieben offen. Fortsetzung: `scripting-native-052-device-plan.md`.

Native 051 enthält alle Native-050-Korrekturen. Ein 051-Lauf kann daher die noch offene 050-Titel-/TabView-Prüfung kumulativ beantworten.

## 1. Identität und Komponentenbuilder

Im Log muss stehen:

```text
runtime identity 0.5.1 / 051
```

Vor dieser Zeile darf kein `Failed to build component ... t.__type__` erscheinen.

## 2. Spieltitel und Close

Erwartete Logs:

```text
transient game title installed
transient game title shown for 5500ms
```

Visuell prüfen:

1. Titel und schwarzer Verlauf erscheinen erst bei bereiter Spielansicht.
2. 5,5 Sekunden Halt, danach 0,9 Sekunden Fade/leichte Aufwärtsbewegung/Blur.
3. Druck in die obersten 48 Punkte zeigt ihn für 3,2 Sekunden erneut.
4. Close schließt den WebView zuverlässig.
5. Kein zweiter permanenter nativer Titel bleibt stehen.

## 3. Spielstände aktualisieren

Auf der Yellow-Karte **Spielstände aktualisieren** drücken.

Pass:

- kein sichtbarer Game-WebView öffnet sich;
- vorhandene Spielstände erscheinen mit Nummer und Änderungsdatum;
- bei mehreren Slots steht Slot 2 vor Slot 10;
- Spiel-/ROM-Cache und andere Karten ändern sich nicht.

Ein leerer Save-Bestand ist zulässig, wenn vorher noch nie im Spiel gespeichert wurde.

## 4. Verlustfreier Backup-Export

Nur mit einem angezeigten Spielstand:

1. **Backup** am gewünschten Spielstand drücken.
2. In Dateien einen selbst gewählten Ort bestätigen.
3. Ergebnisname endet auf `.gen1save.json`.
4. Die Datei bleibt außerhalb des `.scripting`-Pakets und wird nicht ins Repository übertragen.

Pass: Exporter erscheint, Export gelingt, App bleibt bedienbar. Der Backup-Inhalt muss nicht im Chat geteilt werden; er ist privat.

## 5. Slot-spezifischer Start

**Öffnen** an einem nummerierten Spielstand drücken.

Pass: Genau dieser Playthrough startet. Log und sichtbarer Spielstand dürfen keine andere Slot-Auswahl nahelegen. `legacy` nutzt absichtlich den bisherigen Standard-/Migrationsweg.

## 6. Restore und Delete — optional, nur nach Backup

Dieser Abschnitt verändert private Save-Daten und ist deshalb nicht erforderlich, solange kein sicher exportiertes Backup vorhanden ist.

1. **Backup wiederherstellen** drücken und das zuvor exportierte passende Backup auswählen.
2. Spiel/Slot in der Bestätigung prüfen und bestätigen.
3. **Spielstände aktualisieren**, dann den Slot öffnen.
4. Optional denselben Slot über **Löschen** entfernen; die zweite destruktive Bestätigung muss erscheinen.
5. Backup erneut wiederherstellen und den Slot öffnen.

Pass:

- falsches Spiel, veränderte JSON-Struktur oder falscher SHA-256 werden abgelehnt;
- Restore zeigt genau eine Bestätigung;
- Delete zeigt genau eine Bestätigung und entfernt keinen anderen Slot;
- Restore bringt den gewählten Spielstand zurück;
- eine fehlgeschlagene/ungültige Hauptkopie kann durch Gen1Recomps `.bak`-Recovery abgefangen werden.

## 7. Kurze Regression

Zusätzlich melden, wenn beobachtet:

- Retina-/Vektor-Controls weiterhin sauber;
- D-pad/A/B/Start/Select funktionieren;
- `cache=hit` oder weiter `cache=store`;
- Telefonunterbrechung kehrt ohne permanenten Hang zurück;
- auffälliges Layout auf kleinem iPhone, iPad, großer Schrift oder VoiceOver.
