# UI/UX-System für Scripting iOS

**Status:** verbindliche Designreferenz für alle folgenden Scripting-Projekte in diesem Repository.
**Stand:** 2026-08-15. Grundlage sind die offizielle Scripting-Dokumentation und Apples aktuelle Human Interface Guidelines.

## 1. Designprinzipien

1. **Klarheit:** Inhalt und nächste Aktion sind ohne Erklärung erkennbar.
2. **Konsistenz:** Native iOS-Komponenten, Begriffe, Symbole und Navigationsmuster wiederholen sich verlässlich.
3. **Zurückhaltung:** Oberfläche unterstützt die Aufgabe; Dekoration konkurriert nicht mit Daten.
4. **Direktes Feedback:** Jede längere oder fehleranfällige Aktion zeigt ihren Status nahe am Auslöser.
5. **Adaptivität:** Layout, Text und Farben funktionieren bei verschiedenen Geräten, Orientierungen, Textgrößen, Sprachen und Appearance-Modi.
6. **Datenschutz:** Sensible Daten und Berechtigungen werden kontextuell, sparsam und verständlich behandelt.

Referenzen: [Layout](https://developer.apple.com/design/human-interface-guidelines/layout), [Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility), [Feedback](https://developer.apple.com/design/human-interface-guidelines/feedback), [Writing](https://developer.apple.com/design/human-interface-guidelines/writing).

## 2. Native Informationsarchitektur

### 2.1 Standardseite

Bevorzugtes Grundmuster für ein modales Utility:

```text
NavigationStack
└── List oder ScrollView
    ├── Navigationstitel
    ├── optional: Toolbar mit Cancel/Done
    ├── Section: wichtigste Daten/Aktion
    ├── Section: Einstellungen/Details
    └── Section: sekundäre Information
```

- `NavigationStack` definiert Hierarchie.
- `List` + `Section` eignet sich für Formulare, Einstellungen und scannbare Daten.
- `ScrollView` eignet sich für freie Dashboards, Medien oder individuelle Komposition.
- Der sichtbare Seiteninhalt trägt Navigationstitel und Toolbar; nicht blind SwiftUI-Syntax übertragen. Exakte Scripting-Props vor Nutzung prüfen.
- Eine Root-Modalansicht erhält eine verständliche Schließen-/Abbrechen-Aktion. Detailseiten behalten normalerweise den systemeigenen Zurück-Button.
- Bottom Tabs nur für echte, gleichrangige Hauptbereiche. Keine Tabs für einen linearen Ablauf.
- Progressive Disclosure: Primärinformation zuerst; seltene Optionen in Detailseite, Disclosure oder Menü.

### 2.2 Aktionshierarchie

- Pro Ansicht möglichst **eine**, maximal zwei prominente Aktionen.
- Hauptaktion als klares Verb: „Speichern“, „Aktualisieren“, „Route starten“.
- Sekundäraktion visuell zurücknehmen.
- Destruktive Aktionen mit systemischer destructive role; keine primäre Hervorhebung.
- Symbol nur verwenden, wenn es allgemein verständlich ist. Sonst Text oder Text + SF Symbol.
- Tap-Fläche mindestens **44 × 44 pt** ([Apple HIG Buttons](https://developer.apple.com/design/human-interface-guidelines/buttons)).
- Während einer nicht sofortigen Aktion Hauptaktion deaktivieren oder mit passendem Progresszustand ersetzen; Doppelausführung verhindern.

## 3. Design-Tokens statt Magic Values

Jedes größere Projekt besitzt ein zentrales, typisiertes Theme-Modul. Die Werte sind Defaults und dürfen pro Kontext begründet angepasst werden.

```ts
type SpacingToken = "xs" | "sm" | "md" | "lg" | "xl"

const spacing: Record<SpacingToken, number> = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
}
```

Regeln:

- Abstände basieren bevorzugt auf 4-pt-Schritten.
- Seiten-/Kartenwerte nicht direkt über Views verstreuen.
- Semantische Farben (`label`, `secondaryLabel`, Systemfarben usw.) vor festen Hexwerten, **soweit aktuell von Scripting dokumentiert**.
- Custom Colors nur zentral, mit separater Light-/Dark-Variante und Kontrastprüfung.
- Corner Radius und Bildgrößen über benannte Tokens, wenn sie mehrfach auftreten.
- Ein Token ist kein Nutzerwert. Nutzerwerte gehören in validierte Config/Storage.

## 4. Typografie und Inhalt

- Systemschrift und dynamische Textstile (`body`, `headline`, `title*`, `caption` usw.) bevorzugen.
- Fließtext standardmäßig in Body-Hierarchie; Text nie kleiner als **11 pt**.
- Kleine Schrift nicht durch dünnes Gewicht zusätzlich schwächen.
- Maximal drei klar erkennbare Hierarchiestufen pro kompakter Ansicht.
- Zahlen und Einheiten an der ersten Textbasis ausrichten; Einheiten visuell sekundär, aber lesbar.
- Keine gerasterten Texte in Widgets.
- Zeilenbegrenzung nur, wenn Informationsverlust akzeptabel ist; sonst Wrap oder Detailansicht.
- Deutsche Komposita und englische/übersetzte Langtexte testen.

Apple-Werte: iOS-Default 17 pt, Minimum 11 pt; regulärer Text bis 17 pt mindestens 4,5:1 Kontrast, große oder fette Schrift mindestens 3:1 ([Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility)). Für Custom-Farben im Dark Mode möglichst 7:1 anstreben ([Dark Mode](https://developer.apple.com/design/human-interface-guidelines/dark-mode)).

## 5. Farbe, Symbole und Appearance

### Farbe

- Status nie nur per Farbe. Immer Text, Symbol, Form oder Position ergänzen.
- Gleiche Farbe bedeutet im ganzen Projekt dieselbe Semantik.
- Systemfarben bevorzugen, da sie Light/Dark und erhöhte Kontraste besser adaptieren.
- Custom-Farbe in Light, Dark und wenn möglich erhöhtem Kontrast prüfen.
- Verläufe höchstens unterstützend; der hellste und dunkelste Bereich muss lesbar bleiben.

### Symbole

- SF Symbols bevorzugen.
- Bekanntes Symbol nicht mit fremder Bedeutung belegen.
- Symbolgewicht an begleitenden Text anpassen.
- Kritische Icon-only-Aktionen vermeiden; ohne eindeutig verständliches Symbol Text ergänzen.

### Appearance-Testmatrix

- Light Mode
- Dark Mode
- Increase Contrast
- Reduced Transparency, sofern relevante Materialien verwendet werden
- große Textgröße
- bei Widgets zusätzlich Full Color, Tinted und Clear/Glass, soweit Ziel-iOS unterstützt

Referenzen: [Color](https://developer.apple.com/design/human-interface-guidelines/color), [Dark Mode](https://developer.apple.com/design/human-interface-guidelines/dark-mode), [SF Symbols](https://developer.apple.com/design/human-interface-guidelines/sf-symbols).

## 6. Zustandsmodell

Asynchrone Screens modellieren einen diskriminierten Zustand:

```ts
type LoadState<T> =
  | { status: "idle" }
  | { status: "loading"; previous?: T }
  | { status: "content"; data: T; updatedAt?: Date }
  | { status: "empty"; reason?: string }
  | { status: "error"; message: string; canRetry: boolean; previous?: T }
```

Für Schreibaktionen gegebenenfalls `saving`, `success` und `validationError` ergänzen. Nicht mehrere unabhängige Flags wie `isLoading`, `hasError`, `isEmpty` verwenden, die widersprüchliche Kombinationen erlauben.

### Loading

- Spinner für unbekannte Dauer, determinierten Progress für messbare Arbeit.
- Kontext nennen, wenn er Mehrwert bietet („3 von 10 Dateien verarbeitet“ statt „Lädt …“).
- Bei bereits vorhandenen Daten möglichst Inhalt sichtbar halten und Aktualisierung dezent anzeigen.
- Abbrechen anbieten, wenn sicher möglich.

### Empty

- Was fehlt?
- Warum ist die Ansicht leer?
- Welche konkrete Aktion ist jetzt möglich?
- Leere Collection ist kein Fehler.

### Error

- Nah an der Ursache anzeigen.
- Keine ungefilterten Stacktraces, Statusobjekte oder `String(error)` als alleinige Nutzerbotschaft.
- Keine Schuldzuweisung.
- Konkreter nächster Schritt: Wiederholen, Einstellung öffnen, anderes Format wählen.
- Alert nur, wenn Unterbrechung angemessen ist; sonst Inline-Status.

### Success

- Routineerfolg nicht mit Alert-Spam bestätigen.
- Bedeutende externe Aktion (z. B. Export gespeichert) klar bestätigen.
- Erfolgsfeedback verschwindet nicht, bevor die Person es wahrnehmen kann.

Referenzen: [Feedback](https://developer.apple.com/design/human-interface-guidelines/feedback), [Progress indicators](https://developer.apple.com/design/human-interface-guidelines/progress-indicators).

## 7. Formulare und Validierung

- Verwandte Felder in `Section` gruppieren.
- Label bleibt sichtbar; Placeholder ersetzt kein Label.
- Passenden Keyboard-/Content-Type nur nutzen, wenn aktuell in Scripting dokumentiert.
- Eingabe normalisieren und an Systemgrenzen erneut validieren.
- Validierungsfehler am Feld und konkret formulieren.
- Speichern erst aktivieren, wenn Mindestanforderungen erfüllt sind, sofern dies nicht Fehlerentdeckung versteckt.
- Ungespeicherte Änderungen bei unerwartetem Verlassen schützen.
- Defaultwerte sichtbar und reversibel machen.
- API-Keys/Credentials weder im Klartext protokollieren noch in `script.json` ablegen.

## 8. Listen, Suche und Datenmengen

- Stabile IDs als Keys; keine Array-Indizes für veränderliche Collections.
- Daten vor Rendern normalisieren/sortieren, aber Quell-State nicht direkt mutieren.
- Suche bei längeren Listen; Query trimmen, localegeeignet vergleichen und leere Query explizit behandeln.
- Pull-to-refresh nur zusätzlich zu sinnvoller automatischer Aktualisierung.
- Swipe Actions beschränken und destructive role verwenden.
- Bei sehr großen Datenmengen Lazy-Container/Pagination nur nach dokumentierter API-Verfügbarkeit.
- Charts nie als einzigen Datenträger; aussagekräftige Beschriftung/Legende und Empty/Error-State.

## 9. Widgets

### Informationsarchitektur pro Familie

| Familie | Ziel |
|---|---|
| Accessory inline/circular | eine Kennzahl oder ein kurzer Status |
| Accessory rectangular | wenige, priorisierte Zeilen |
| System small | eine Hauptinformation und optional ein fokussierter Tap/Intent |
| System medium | Hauptinformation plus kompakter Kontext oder Vergleich |
| System large | strukturierte Übersicht; keine verkleinerte App |
| Extra large | nur unterstützen, wenn der zusätzliche Raum echten Nutzen bringt |

Regeln:

- Layout über `Widget.family` bewusst verzweigen; keine Annahme, dass eine View nur skaliert.
- `Widget.displaySize` für tatsächliche Größe berücksichtigen.
- `Widget.parameter` nur über validierte, versionierbare Config lesen; ungültige Parameter erhalten sicheren Default.
- Daten, Cache und Bilder **vor** `Widget.present(...)` laden.
- Hook-State nicht als persistente Interaktivität einplanen; App Intents verwenden.
- Ein Widget zeigt Aktualitätszeitpunkt, wenn Staleness entscheidungsrelevant ist.
- Standardrand 16 pt; 11 pt nur bei sinnvollen kompakten Gruppen.
- Keine Schrift unter 11 pt.
- Interaktion bleibt einfach und relevant; übrige Fläche deep-linkt zum passenden App-Kontext, sofern unterstützt.
- Tinted/clear darf Bedeutung nicht zerstören. Widgethintergrund und Accent-Verhalten nur mit aktuell dokumentierten Scripting-Modifikatoren implementieren.
- Preview ist keine Endabnahme: reale Home-/Lock-Screen-Prüfung pro Familie.

Referenz: [Apple HIG Widgets](https://developer.apple.com/design/human-interface-guidelines/widgets).

## 10. Lokalisierung und UX Writing

- Produkttexte zentral in `src/i18n` oder einem vergleichbaren Modul.
- Mindestens Deutsch und Englisch, sofern der Nutzer nichts anderes festlegt.
- Locale über die aktuell dokumentierte Scripting-/Device-API bestimmen.
- Datum, Uhrzeit, Zahl, Währung und Einheit über localegeeignete Formatter.
- Klar, kurz, aktiv und ohne Jargon.
- Buttons beginnen nach Möglichkeit mit einem Verb.
- Konsistente Begriffe; kein Wechsel zwischen „Aktualisieren“, „Neu laden“ und „Sync“, wenn dasselbe gemeint ist.
- Fehler: Problem + Lösung, nicht interne Ursache.
- Keine unnötigen Possessivpronomen („Favoriten“ statt „Deine Favoriten“).
- RTL nicht durch fest codierte Links-/Rechts-Annahmen beschädigen; führend/folgend denken.

Referenz: [Apple HIG Writing](https://developer.apple.com/design/human-interface-guidelines/writing).

## 11. Review-Checkliste

### Struktur

- [ ] Native Navigation und Controls verwendet
- [ ] Wichtigste Information in Leserichtung zuerst
- [ ] Maximal ein bis zwei prominente Aktionen
- [ ] Wiederverwendete Werte über Tokens/Config

### Zustände

- [ ] Loading, Content, Empty und Error vorhanden
- [ ] Schreibaktion gegen Doppeltrigger geschützt
- [ ] Fehler mit konkreter Handlung
- [ ] Aktualität sichtbar, wenn relevant

### Accessibility

- [ ] Tap-Ziele ≥ 44 × 44 pt
- [ ] Text ≥ 11 pt und dynamische Systemstile bevorzugt
- [ ] Kontrast geprüft
- [ ] Bedeutung nicht nur per Farbe
- [ ] große Textgröße und lange Lokalisierung geprüft

### Appearance

- [ ] Light/Dark
- [ ] Increase Contrast
- [ ] Symbole und Medien in beiden Modi lesbar
- [ ] Widget zusätzlich tinted/clear und reale Hostdarstellung

### Inhalt

- [ ] zentrale i18n-Texte
- [ ] localegerechte Formate
- [ ] klare Verben und konsistente Terminologie
- [ ] keine technischen Rohfehler

### Evidenz

- [ ] Typecheck/Diagnostics
- [ ] UI-Preview mit Zielgrößen
- [ ] mindestens ein Fehler- und Empty-Weg
- [ ] echtes Geräte-E2E bestanden oder separat offen dokumentiert
