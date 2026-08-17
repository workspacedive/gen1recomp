# Native 0.4.9 — ausblendender Spieltitel und Komponentenbuilder

**Kandidat:** `Gen1Recomp Native 049` / 0.4.9 (049)  
**SHA-256:** `7127e47a49f894d95aeafaf0a3d02288eabf8f132fbe66b3b5aa81a172b98b64`

## 1. Start ohne `t.__type__`

Bitte Native 049 normal öffnen und zunächst nur den Scripting-Logbeginn prüfen.

**Pass:** Vor `runtime identity 0.4.9 / 049` erscheint kein

```text
Failed to build component ... t.__type__
```

Native 049 verwendet in allen fünf Toolbars direkte native Buttons wie das offizielle fertige Scripting-Beispiel. Der vorherige Custom-Component-Wrapper in `toolbar.cancellationAction` wurde entfernt.

## 2. Titel und schwarzer Verlauf

Die native Präsentation erhält keinen permanenten `navigationTitle` mehr. Stattdessen zeigt der WebView kurz einen eigenen Titel mit Verlauf und Close-Button.

Erwartet:

1. `Pokémon Yellow` und schwarzer Verlauf erscheinen beim Start.
2. Nach 3,2 Sekunden beginnt eine 0,7-sekündige Ausblendung.
3. Danach ist die Spielfläche frei.
4. Ein Druck in die obersten 48 CSS-Punkte blendet Titel und Close-Button erneut ein.
5. Der Close-Button schließt das Spiel sauber.

Passender Log:

```text
transient game title installed
```

Bitte melden, ob zusätzlich noch ein permanenter nativer Scripting-Titel oder Verlauf sichtbar bleibt. Die offizielle API erlaubt keine Animation dieses nativen Chromes; deshalb wird `navigationTitle` absichtlich weggelassen.

## 3. Kurze Regression

Bitte etwa 20 Sekunden spielen und kopieren:

```text
viewport ...
[host-ui] vector touch controls installed
performance ...
[host-perf] frame update ... draw ...
[host-perf] effect cache=hit|store ...
```

Prüfen:

- Retina-/Vektor-Controls weiterhin sauber;
- D-pad/A/B/Start/Select weiterhin funktional;
- volle Fläche und Spielpixel unverändert;
- kein Performance-Rückschritt;
- Schließen speichert und ein erneuter Start funktioniert.

Telefonunterbrechung und Cache-Hit können später im selben Build geprüft werden; dafür ist keine weitere Paketänderung nötig.
