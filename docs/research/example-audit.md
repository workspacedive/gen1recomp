# Audit der heruntergeladenen Scripting-Beispiele

**Stand:** 2026-08-15
**Prinzip:** Beispiele dienen der Orientierung, nicht als API-Autorität. Jede übernommene Technik wird gegen aktuelle offizielle Doku und lokale `.d.ts` geprüft.

## 1. Lokale Ablage und Lizenzgrenze

Reproduzierbar heruntergeladene Rohreferenzen liegen unter `research/downloads/` und werden bewusst von Git ausgeschlossen:

```text
research/downloads/
├── community/
│   ├── Health Center.scripting
│   ├── RSS.scripting
│   ├── Script Launchpad.scripting
│   ├── Widget Animation Demo.scripting
│   └── Colorful Clouds.scripting
├── official/
│   ├── Scripting Documentation.zip
│   ├── Video to Live Photo/
│   └── scripting-app-development/
└── official-skills/
    ├── design-scripting-custom-gradient-background/
    ├── rich-charts/
    └── rich-maps/
```

Warum nicht als Produktcode einchecken:

- Das Community-Repository weist auf Root-Ebene keine klare Lizenz aus.
- Die Skill-Sammlung weist ebenfalls keine einheitliche Root-Lizenz aus.
- Unklare Fremdquellen werden daher weder kopiert noch abgeleitet in ausgelieferten Produktcode übernommen.
- Der kuratierte `ScriptingApp/scripts`-README deklariert MIT; dessen fertiges Beispiel und der ebenfalls MIT-deklarierte Development-Skill liegen zusätzlich als nachvollziehbare Snapshots unter `references/official/`.

`research/source-manifest.json` pinnt URLs, Commits und Prüfsummen. `tools/sync_references.py` reproduziert die Downloads.

## 2. Fertiges offizielles Projekt: Video to Live Photo

**Quelle:** [ScriptingApp/scripts/Video to Live Photo](https://github.com/ScriptingApp/scripts/tree/main/Video%20to%20Live%20Photo)
**Revision:** `69115b32e48497e18c114f9c40b9ab89f9364847`
**Lokaler Snapshot:** `references/official/video-to-live-photo/`

### Gute Muster

- vollständiges Projekt mit `script.json`, `index.tsx` und Micro-Spec;
- native `NavigationStack` + `List` + `Section`;
- klarer endlicher Lifecycle: `Navigation.present` → `Script.exit`;
- typed `SelectedVideo`;
- paralleles Laden unabhängiger Metadaten über `Promise.all`;
- native Fotoauswahl und Media-APIs hinter kleinen Funktionen;
- Busy-State verhindert Doppelausführung;
- englische/chinesische Texte zentral in Objekten;
- `try/finally` gibt AV-Assets frei;
- Loading-, Success- und Failure-Feedback.

### Nicht blind übernehmen

- Die gesamte Fachlogik und View liegen noch in einer großen Datei; bei Erweiterung in Domain/Data/UI teilen.
- `String(error)` wird direkt in Alerts ausgegeben; für Produkt-UX in sichere, verständliche Fehlermeldungen übersetzen.
- Locale-Erkennung und Übersetzungen sollten bei mehr Sprachen in ein eigenes i18n-Modul.
- Slider-Updates erzeugen viele Frame-Anfragen; bei schwerer Verarbeitung Debounce/Cancel prüfen.
- Das Beispiel nutzt APIs aus dem Juli 2026; Signaturen vor Wiederverwendung aktuell prüfen.

## 3. Community-Projekt: Health Center

**Paket:** `Health Center.scripting`
**Quelle:** [ScriptingApp/Community-Scripts](https://github.com/ScriptingApp/Community-Scripts)
**Revision:** `1eb87838d2fc60635cfdff762cc88502966f1e99`

Das ZIP-basierte `.scripting`-Paket enthält 16 Einträge, darunter:

- `widget.tsx` und `app_intents.tsx`;
- getrennte Small-/Medium-/Large-Komponenten;
- `utils/health.ts`, `utils/activity.ts`, `utils/stress.ts`;
- `i18n/en.ts`, `i18n/zh.ts`, `i18n/index.ts`.

### Gute Muster

- echte modulare Trennung von Datenerhebung, Analyse, i18n und familienabhängiger UI;
- `Widget.family` entscheidet bewusst über unterschiedliche Views;
- teure zusätzliche Aktivitätsdaten werden nur für `systemLarge` geladen;
- Daten werden vor `Widget.present(...)` vorbereitet;
- App Intent aktualisiert das Widget;
- semantische Statusmodelle über `StressLevel` und typed Props.

### Risiken / Verbesserungen

- Gesundheitsdaten sind hochsensibel: Log-Ausgaben mit Messwerten wären in Produktcode zu entfernen oder strikt zu redigieren.
- Status darf nicht nur aus Rot/Grün entstehen; Text/Symbol ist vorhanden und muss erhalten bleiben.
- Ein Gradient-Mapping über feste Statusfarben ist eine zentrale Produktregel, sollte aber Appearance-/Kontrasttests bestehen.
- Fallback, Denial und partielle Health-Daten müssen am realen Gerät geprüft werden.
- `else` wird faktisch als `systemLarge` behandelt; unbekannte/weitere Familien brauchen expliziten Fallback.
- Die medizinisch klingende „Stress“-Interpretation aus HRV erfordert fachliche Validierung und einen klaren Nicht-Diagnose-Hinweis.

## 4. Community-Projekt: RSS

**Paket:** `RSS.scripting`
**Revision:** `1eb87838d2fc60635cfdff762cc88502966f1e99`

Das Paket enthält 32 Einträge mit `page/`, `widget/`, `util/`, `module/`, App Intents und Parser-Bundles.

### Gute Muster

- Seiten, Widgets, Config, RSS-Parsing, Cache und externe Module sind getrennt;
- Navigation zu Listen- und Detailansichten;
- datengetriebenes Rendering der Feedquellen;
- Swipe Actions für Bearbeiten/Löschen;
- Widget und Hauptseite teilen Config-/Parser-Layer.

### Risiken / Verbesserungen

- sichtbare Texte sind gemischt Chinesisch/Englisch und nicht zentral lokalisiert;
- mehrere `any`-Typen reduzieren Verifizierbarkeit;
- direkte Mutation (`source[idx] = res`) vor State-Update vermeiden;
- Array-Index als Key/Identität ist bei editierbaren Listen instabil;
- Löschen benötigt je nach Tragweite Undo oder Bestätigung;
- Loading/Empty/Error/Offline-Zustände sind nicht durchgängig sichtbar;
- eingebundene, gebündelte Parserdateien müssen lizenz- und sicherheitsseitig getrennt geprüft werden.

## 5. Community-Projekt: Script Launchpad

**Paket:** `Script Launchpad.scripting`
**Revision:** `1eb87838d2fc60635cfdff762cc88502966f1e99`

### Gute Muster

- dynamische Erkennung installierter Projekte aus `FileManager.scriptsDirectory`;
- `script.json` wird als Metadatenquelle genutzt, statt Skripte hart zu codieren;
- `useObservable` hält Auswahlzustand reaktiv;
- Auswahl, Persistenz und Widgetfamilien sind getrennt;
- Save/Close als native Toolbar-Aktionen.

### Risiken / Verbesserungen

- JSON wird ohne Schema-/Fehlerbehandlung geparst;
- `any` für Skriptmetadaten vermeiden;
- Verzeichnis-/Dateifehler brauchen sichtbaren Error-State;
- Dateizugriff und globale APIs vor Nutzung aktuell dokumentieren;
- vor Sortierung und Persistenz stabilen Identifier definieren; Name allein kann kollidieren.

## 6. Community-Projekte: Widget Animation Demo und Colorful Clouds

Diese Pakete wurden für zwei spezielle Prüfziele heruntergeladen:

- **Widget Animation Demo:** Grenzen und zulässige Aktualisierung/Animation im Widget untersuchen.
- **Colorful Clouds:** datengetriebene, visuell reichere Widgetkomposition und Remote-Resource-Metadaten untersuchen.

Sie werden erst detailliert analysiert, wenn die kommende Anforderung Animation oder Wetter/Remote-Ressourcen benötigt. Ihre Existenz ist kein Beleg, dass jede enthaltene API in der Ziel-App-Version verfügbar oder empfehlenswert ist.

## 7. Offizielles Scripting-Dokumentationsprojekt

**Datei:** `research/downloads/official/Scripting Documentation.zip`
**Größe:** 4.608.028 Bytes
**Inhalt:** 1.314 ZIP-Einträge, ca. 4,38 MB unkomprimiert, einschließlich 136 `.ts`/`.tsx`-Beispieldateien.

Nützliche Muster:

- durchsuchbare, lokalisierte Dokumentationsseite;
- `NavigationStack`, Suche, Picker, Menu und `ContentUnavailableView`;
- eigene Beispiele für Listen, Navigation, Widget, Charts, MapKit, Media und native APIs;
- englische/chinesische API-Texte.

Grenze: Paketdateien tragen überwiegend 2026-07-01. Vor Übernahme wird die Online-Dokumentation aus `llms.txt` geprüft.

## 8. Offizielle Skills: Gradient, Charts und Maps

### Custom Gradient Background

Gute Regeln:

- ein Root-Background-Owner;
- Light-/Dark-Farben getrennt;
- `allowsHitTesting={false}`;
- Config statt verteilter Farbcodes;
- Farbe nicht als einziges Signal.

Nur verwenden, wenn ein Custom-Gradient funktional begründet ist. Native Listen-/Systemhintergründe bleiben Standard.

### Rich Charts

Gute Architektur:

- typisierte Konfiguration;
- mehrere Renderer hinter einer gemeinsamen API;
- explizite Empty-/Invalid-Config-Zustände;
- horizontales Scrollen für dichte Kategorien;
- stabile Series-IDs und explizite Legende.

Vor Produktnutzung Chart-API, Accessibility und große Datenmengen aktuell prüfen.

### Rich Maps

Gute Architektur:

- typisierte Map-Modi;
- kompakte, horizontal scrollende Karten;
- systemische Farbsemantik;
- stabile Trennung von Renderer, Typen und Use-Case-Beispielen.

Standortzugriff, WGS84, Such-/Routing-API und Datenziele erfordern pro Aufgabe gesonderte Doku-/Privacy-Prüfung.

## 9. Verbindliche Übernahmeregel

Ein Muster darf nur in Produktcode gelangen, wenn alle fünf Fragen mit „ja“ beantwortet sind:

1. Passt es zum tatsächlichen Host und Nutzerziel?
2. Ist die genaue API in aktueller offizieller Doku und lokalen Typen bestätigt?
3. Ist die Lizenz für eine Übernahme klar?
4. Sind Privacy, Fehlerwege und Lifecycle für den Zielkontext geklärt?
5. Ist das Muster einfacher und robuster als eine kleinere native Lösung?
