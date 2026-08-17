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
                self.assertIn("src/domain/models.ts", names)
                self.assertIn("src/domain/mods.ts", names)
                self.assertIn("src/platform/game-runtime.ts", names)
                self.assertIn("src/ui/app.tsx", names)
                self.assertIn("runtime-v042/embedded-packages.js", names)
                self.assertIn("runtime-v042/player.js", names)
                self.assertIn("runtime-v042/maintenance.html", names)
                self.assertIn("runtime-shell-v042/preview-bundle.js", names)
                self.assertNotIn("runtime-shell-v042/embedded-packages.js", names)
                metadata = json.loads(archive.read("script.json"))
                self.assertEqual(metadata["name"], "Gen1Recomp Native 042")
                self.assertEqual(metadata["version"], "0.4.2")
                source_text = "\n".join(
                    archive.read(name).decode("utf-8", errors="ignore")
                    for name in names
                    if name.endswith((".ts", ".tsx", ".json"))
                ).lower()
                self.assertNotIn("baserom.gbc", source_text)
                self.assertNotIn("scriptable", source_text)

    def test_published_native_product_has_expected_identity(self) -> None:
        artifact = ROOT / "artifacts" / "Gen1Recomp-Native-042.scripting"
        self.assertTrue(artifact.is_file())
        with zipfile.ZipFile(artifact) as archive:
            self.assertIsNone(archive.testzip())
            self.assertEqual(len(archive.namelist()), 32)
            self.assertIn(b"verified ROM import", archive.read("script.json"))
            self.assertIn(b"runtime identity 0.4.2 / 042", archive.read("runtime-v042/preview-loader.js"))

    def test_missing_native_source_fails_closed(self) -> None:
        launcher = ROOT / "research" / "downloads" / "gen1recomp" / "lovejs-launcher"
        lock = ROOT / "research" / "gen1recomp-lock.json"
        with tempfile.TemporaryDirectory() as raw:
            root = Path(raw)
            with self.assertRaisesRegex(RuntimeError, "missing"):
                packager.collect_entries(root / "source", launcher, lock)


if __name__ == "__main__":
    unittest.main()
