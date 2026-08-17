from __future__ import annotations

import importlib.util
from pathlib import Path
import subprocess
import tempfile
import unittest
import zipfile


ROOT = Path(__file__).resolve().parents[2]
MODULE_PATH = ROOT / "tools" / "package_gen1recomp_payload.py"
SPEC = importlib.util.spec_from_file_location("package_gen1recomp_payload", MODULE_PATH)
assert SPEC is not None and SPEC.loader is not None
payload = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(payload)


def fixture_source(root: Path) -> Path:
    source = root / "source"
    files = {
        "main.lua": "return true\n",
        "conf.lua": "function love.conf(t) end\n",
        "src/core/Version.lua": 'return { engine = "0.0.0-dev" }\n',
        "src/ui/kit/Kit.lua": "return {}\n",
        "data/readme.txt": "safe\n",
        "assets/readme.txt": "safe\n",
        "data/generated/private.bin": "must not package\n",
        "assets/generated/private.png": "must not package\n",
        "tools/save-editor/App.lua": "return {}\n",
        "tools/rom_manifest.json": "{}\n",
        "tools/rom_manifest_blue.json": "{}\n",
        "tools/rom_manifest_yellow.json": "{}\n",
        "tools/rom_manifest_gold.json": "{}\n",
    }
    for relative, content in files.items():
        path = source / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding="utf-8")
    subprocess.run(["git", "init", "-q"], cwd=source, check=True)
    subprocess.run(["git", "add", "."], cwd=source, check=True)
    subprocess.run(
        [
            "git", "-c", "user.name=Test", "-c", "user.email=test@example.invalid",
            "commit", "-qm", "fixture",
        ],
        cwd=source,
        check=True,
    )
    return source


class DeterministicPayloadTests(unittest.TestCase):
    def test_payload_is_byte_reproducible_stamped_and_rom_free(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = fixture_source(root)
            first = root / "first.love"
            second = root / "second.love"
            first_report = payload.package(source, first, "0.1.96")
            second_report = payload.package(source, second, "0.1.96")
            self.assertEqual(first.read_bytes(), second.read_bytes())
            self.assertEqual(first_report["sha256"], second_report["sha256"])
            with zipfile.ZipFile(first) as archive:
                self.assertIn(b'engine = "0.1.96"', archive.read("src/core/Version.lua"))
                self.assertNotIn("data/generated/private.bin", archive.namelist())
                self.assertNotIn("assets/generated/private.png", archive.namelist())
                self.assertTrue(all(
                    info.date_time == (1980, 1, 1, 0, 0, 0)
                    for info in archive.infolist()
                ))

    def test_payload_rejects_non_semantic_version(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = fixture_source(root)
            with self.assertRaisesRegex(RuntimeError, "version must be X.Y.Z"):
                payload.package(source, root / "game.love", "latest")

    def test_payload_rejects_missing_required_source(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = fixture_source(root)
            (source / "tools" / "rom_manifest_gold.json").unlink()
            with self.assertRaisesRegex(RuntimeError, "required payload source is missing"):
                payload.package(source, root / "game.love", "0.1.96")


if __name__ == "__main__":
    unittest.main()
