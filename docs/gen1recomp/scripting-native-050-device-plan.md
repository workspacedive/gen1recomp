# Native 0.5.0 — sichtbarer Titel und nativer Tab-Baum

**Kandidat:** `Gen1Recomp Native 050` / 0.5.0 (050)  
**SHA-256:** `dba920d60b0ccb50e68a14d1007afa207c5234dbffb82257b21e4d403783a62b`

## Komponentenbuilder

Native 049 bewies, dass direkte Toolbar-Buttons allein `t.__type__` nicht beseitigen. Native 050 macht nun fünf native, getaggte `NavigationStack`-Deskriptoren zu den unmittelbaren Kindern von `TabView`. Die Custom-Screens liegen erst darunter als normaler Inhalt.

**Pass:** Vor

```text
runtime identity 0.5.0 / 050
```

erscheint kein `Failed to build component ... t.__type__`.

## Titelanimation

Der Titel wird nicht mehr beim Bundle-Start getaktet. Er bleibt während WASM-/Game-Startup verborgen und erscheint erst nach dem Runtime-Ready-Frame.

Erwartete Logs:

```text
transient game title installed
transient game title shown for 5500ms
```

Visuell:

1. `Pokémon Yellow` und schwarzer Verlauf erscheinen, wenn die Spielansicht bereit ist.
2. Sie bleiben 5,5 Sekunden sichtbar.
3. Danach blenden sie über 0,9 Sekunden mit leichter Aufwärtsbewegung und Blur aus.
4. Druck in die obersten 48 Punkte blendet sie für 3,2 Sekunden erneut ein.
5. Close-Button schließt sauber.
6. Kein zweiter permanenter nativer Titel bleibt stehen.

## Kurze Regression

Bitte zusätzlich melden:

- Retina-/Vektor-Controls weiterhin sauber;
- Tabs der nativen App weiterhin korrekt;
- D-pad/A/B/Start/Select funktionieren;
- keine neue Performanceverschlechterung;
- `cache=hit` oder weiter `cache=store`;
- Telefonunterbrechung nur, wenn sicher/praktisch.
