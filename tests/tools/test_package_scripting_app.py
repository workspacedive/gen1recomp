from __future__ import annotations

import importlib.util
import json
from pathlib import Path
import sys
import tempfile
import unittest
import zipfile

ROOT = Path(__file__).resolve().parents[2]
TOOLS = ROOT / "tools"
sys.path.insert(0, str(TOOLS))

SPEC = importlib.util.spec_from_file_location("package_scripting_app", TOOLS / "package_scripting_app.py")
assert SPEC is not None and SPEC.loader is not None
packager = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(packager)


class PackageScriptingAppTests(unittest.TestCase):
    def test_native_product_package_is_deterministic_and_modular(self) -> None:
        source = ROOT / "scripting" / "Gen1RecompApp"
        launcher = ROOT / "research" / "downloads" / "gen1recomp" / "lovejs-launcher"
        lock = ROOT / "research" / "gen1recomp-lock.json"
        with tempfile.TemporaryDirectory() as raw:
            root = Path(raw)
            first = root / "first.scripting"
            second = root / "second.scripting"
            first_report = packager.package(source, launcher, lock, first)
            second_report = packager.package(source, launcher, lock, second)
            self.assertEqual(first.read_bytes(), second.read_bytes())
            self.assertEqual(first_report["sha256"], second_report["sha256"])

            with zipfile.ZipFile(first) as archive:
                names = archive.namelist()
                self.assertEqual(names, sorted(names))
                self.assertIn("src/data/system-update-service.ts", names)
                self.assertIn("src/data/game-library-service.ts", names)
                self.assertIn("src/data/mod-service.ts", names)
                self.assertIn("src/domain/games.ts", names)
                self.assertIn("src/domain/save-backups.ts", names)
                self.assertIn("src/domain/models.ts", names)
                self.assertIn("src/domain/mods.ts", names)
                self.assertIn("src/platform/game-runtime.ts", names)
                self.assertIn("src/ui/app.tsx", names)
                self.assertIn("runtime-v052/embedded-packages.js", names)
                self.assertIn("runtime-v052/player.js", names)
                self.assertIn("runtime-v052/maintenance.html", names)
                self.assertIn("runtime-shell-v052/preview-bundle.js", names)
                self.assertNotIn("runtime-shell-v052/embedded-packages.js", names)
                metadata = json.loads(archive.read("script.json"))
                self.assertEqual(metadata["name"], "Gen1Recomp Native 052")
                self.assertEqual(metadata["version"], "0.5.2")
                source_text = "\n".join(
                    archive.read(name).decode("utf-8", errors="ignore")
                    for name in names
                    if name.endswith((".ts", ".tsx", ".json"))
                ).lower()
                self.assertNotIn("baserom.gbc", source_text)
                self.assertNotIn("scriptable", source_text)
                app_source = archive.read("src/ui/app.tsx").decode("utf-8")
                self.assertNotIn("<ScreenToolbar", app_source)
                self.assertEqual(
                    app_source.count('toolbar={{ cancellationAction: <Button title={t("close")}'),
                    5,
                )
                self.assertEqual(app_source.count("      <Tab title={t("), 5)
                self.assertEqual(app_source.count("        <NavigationStack>"), 5)
                self.assertIn('<TabView selection={selectedTab}>', app_source)
                self.assertIn('useObservable<ProductTabId>("home")', app_source)
                self.assertNotIn("tabIndex=", app_source)
                self.assertNotIn("onTabIndexChanged=", app_source)
                self.assertNotIn("tabItem=", app_source)
                self.assertNotIn(" tag=", app_source)
                self.assertIn(b'id="game-chrome"', archive.read("runtime-v052/index.html"))
                self.assertIn(b'transient game title installed', archive.read("runtime-v052/preview-bundle.js"))
                runtime_source = archive.read("src/platform/game-runtime.ts").decode("utf-8")
                self.assertIn("controller.dismiss()", runtime_source)
                self.assertNotIn("navigationTitle: game.title", runtime_source)
                self.assertIn("DocumentPicker.exportFiles", app_source)
                self.assertIn("--slot=${saveId}", runtime_source)
                self.assertIn("Data.fromBase64String", runtime_source)
                maintenance_source = archive.read("runtime-v052/maintenance.js").decode("utf-8")
                self.assertIn('"restore-save"', maintenance_source)
                self.assertIn("backup payload integrity mismatch", maintenance_source)
                self.assertIn("store.put(currentRecord, paths.backup)", maintenance_source)
                self.assertIn("backupRecord == null", maintenance_source)

    def test_published_native_product_has_expected_identity(self) -> None:
        artifact = ROOT / "artifacts" / "Gen1Recomp-Native-052.scripting"
        self.assertTrue(artifact.is_file())
        with zipfile.ZipFile(artifact) as archive:
            self.assertIsNone(archive.testzip())
            self.assertEqual(len(archive.namelist()), 33)
            self.assertIn(b"verified ROM", archive.read("script.json"))
            self.assertIn(b"runtime identity 0.5.2 / 052", archive.read("runtime-v052/preview-loader.js"))

    def test_missing_native_source_fails_closed(self) -> None:
        launcher = ROOT / "research" / "downloads" / "gen1recomp" / "lovejs-launcher"
        lock = ROOT / "research" / "gen1recomp-lock.json"
        with tempfile.TemporaryDirectory() as raw:
            root = Path(raw)
            with self.assertRaisesRegex(RuntimeError, "missing"):
                packager.collect_entries(root / "source", launcher, lock)


if __name__ == "__main__":
    unittest.main()
