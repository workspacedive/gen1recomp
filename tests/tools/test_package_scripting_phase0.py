from __future__ import annotations

import importlib.util
from pathlib import Path
import sys
import tempfile
import unittest
import zipfile

ROOT = Path(__file__).resolve().parents[2]
MODULE_PATH = ROOT / "tools" / "package_scripting_phase0_probe.py"
SPEC = importlib.util.spec_from_file_location("package_scripting_phase0_probe", MODULE_PATH)
assert SPEC is not None and SPEC.loader is not None
package_probe = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(package_probe)
sys.modules["package_scripting_phase0_probe"] = package_probe
PREVIEW_PATH = ROOT / "tools" / "package_scripting_preview.py"
PREVIEW_SPEC = importlib.util.spec_from_file_location("package_scripting_preview", PREVIEW_PATH)
assert PREVIEW_SPEC is not None and PREVIEW_SPEC.loader is not None
package_preview = importlib.util.module_from_spec(PREVIEW_SPEC)
PREVIEW_SPEC.loader.exec_module(package_preview)


class PackageScriptingPhase0Tests(unittest.TestCase):
    def test_archive_is_deterministic_sorted_and_timestamped(self) -> None:
        entries = {
            "script.json": b'{"name":"Probe"}',
            "index.tsx": b"void 0\n",
            "runtime/gen1recomp.love": b"PK\x03\x04fixture",
        }
        with tempfile.TemporaryDirectory() as directory:
            first = Path(directory) / "first.scripting"
            second = Path(directory) / "second.scripting"
            first_report = package_probe.write_archive(entries, first)
            second_report = package_probe.write_archive(entries, second)
            self.assertEqual(first.read_bytes(), second.read_bytes())
            self.assertEqual(first_report["sha256"], second_report["sha256"])
            with zipfile.ZipFile(first) as archive:
                self.assertEqual(archive.namelist(), sorted(entries))
                self.assertTrue(all(
                    info.date_time == package_probe.ZIP_TIMESTAMP
                    for info in archive.infolist()
                ))

    def test_paths_and_generated_config_are_closed(self) -> None:
        self.assertTrue(package_probe.safe_path("runtime/11.5/love.wasm"))
        for unsafe in ("../game.love", "/absolute", "runtime\\escape"):
            self.assertFalse(package_probe.safe_path(unsafe))
        config = package_probe.runtime_config().decode()
        self.assertIn(package_probe.RUNTIME_REVISION, config)
        self.assertIn(package_probe.PAYLOAD_SHA256, config)
        self.assertNotIn("sessionId", config)

    def test_missing_inputs_fail_before_archive_creation(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            with self.assertRaisesRegex(RuntimeError, "missing"):
                package_probe.collect_entries(
                    root / "source",
                    root / "launcher",
                    root / "lock.json",
                )
            with self.assertRaisesRegex(RuntimeError, "missing"):
                package_preview.collect_entries(
                    root / "source",
                    root / "launcher",
                    root / "lock.json",
                )

    def test_preview_output_name_matches_project_identity(self) -> None:
        self.assertEqual(package_preview.DEFAULT_OUTPUT.name, "Gen1Recomp Preview 013.scripting")

    def test_browser_bundle_is_deterministic_classic_script(self) -> None:
        entry = ROOT / "scripting/Gen1RecompPreview/runtime-v013/preview.js"
        first = package_probe.bundle_browser_entry(entry)
        second = package_probe.bundle_browser_entry(entry)
        self.assertEqual(first, second)
        self.assertNotIn(b"import ", first)
        self.assertNotIn(b"export ", first)
        self.assertNotIn(b"#bindings", first)
        self.assertNotIn(b"?.", first)
        self.assertIn(b"BrowserLoveJsGameSurface", first)


if __name__ == "__main__":
    unittest.main()
