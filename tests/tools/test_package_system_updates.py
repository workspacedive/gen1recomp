from __future__ import annotations

import hashlib
import json
from pathlib import Path
import tempfile
import unittest
import zipfile

import sys

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "tools"))

import package_system_updates as packager  # noqa: E402


class PackageSystemUpdatesTests(unittest.TestCase):
    def test_build_is_deterministic_and_rom_free(self) -> None:
        launcher = ROOT / "research" / "downloads" / "gen1recomp" / "lovejs-launcher"
        lock = ROOT / "research" / "gen1recomp-lock.json"
        with tempfile.TemporaryDirectory() as first_raw, tempfile.TemporaryDirectory() as second_raw:
            first = Path(first_raw)
            second = Path(second_raw)
            first_report = packager.build(launcher, lock, first)
            second_report = packager.build(launcher, lock, second)

            self.assertTrue(first_report["romFree"])
            self.assertEqual(first_report["catalogSha256"], second_report["catalogSha256"])
            for artifact in first_report["artifacts"]:
                name = artifact["path"]
                self.assertEqual((first / "artifacts" / name).read_bytes(), (second / "artifacts" / name).read_bytes())

            catalog = json.loads((first / "catalog" / "stable.json").read_text(encoding="utf-8"))
            self.assertEqual(catalog["domain"], "system")
            self.assertEqual(catalog["sequence"], 4)
            self.assertEqual(
                {release["manifest"]["id"] for release in catalog["releases"]},
                {packager.RUNTIME_COMPONENT_ID, packager.CORE_COMPONENT_ID},
            )
            serialized = json.dumps(catalog).lower()
            self.assertNotIn("baserom", serialized)
            self.assertNotIn("pokemon red", serialized)

    def test_published_archives_match_catalog_and_expected_allowlists(self) -> None:
        catalog_path = ROOT / "updates" / "catalog" / "stable.json"
        catalog = json.loads(catalog_path.read_text(encoding="utf-8"))
        expected = {
            packager.RUNTIME_COMPONENT_ID: set(packager.RUNTIME_FILES),
            packager.CORE_COMPONENT_ID: set(packager.CORE_FILES),
        }
        for release in catalog["releases"]:
            manifest = release["manifest"]
            artifact = ROOT / "updates" / "artifacts" / manifest["artifact"]["path"]
            data = artifact.read_bytes()
            self.assertEqual(len(data), manifest["artifact"]["size"])
            self.assertEqual(hashlib.sha256(data).hexdigest(), manifest["artifact"]["integrity"]["digest"])
            with zipfile.ZipFile(artifact) as archive:
                self.assertIsNone(archive.testzip())
                self.assertEqual(set(archive.namelist()), expected[manifest["id"]])
                for info in archive.infolist():
                    self.assertEqual(info.date_time, packager.ZIP_TIMESTAMP)
                    self.assertNotIn("..", Path(info.filename).parts)

    def test_locked_input_mismatch_is_rejected(self) -> None:
        launcher = ROOT / "research" / "downloads" / "gen1recomp" / "lovejs-launcher"
        lock = json.loads((ROOT / "research" / "gen1recomp-lock.json").read_text(encoding="utf-8"))
        lock["runtimeCandidates"]["lovejs11_5"]["files"]["player.js"]["sha256"] = "0" * 64
        with tempfile.TemporaryDirectory() as temp_raw:
            temp = Path(temp_raw)
            lock_path = temp / "lock.json"
            lock_path.write_text(json.dumps(lock), encoding="utf-8")
            with self.assertRaisesRegex(RuntimeError, "locked runtime input mismatch"):
                packager.build(launcher, lock_path, temp / "out")


if __name__ == "__main__":
    unittest.main()
