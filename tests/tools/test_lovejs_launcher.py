from __future__ import annotations

import importlib.util
from pathlib import Path
import sys
import tempfile
import unittest
import zipfile


ROOT = Path(__file__).resolve().parents[2]
TOOLS = ROOT / "tools"
sys.path.insert(0, str(TOOLS))
SPEC = importlib.util.spec_from_file_location(
    "prepare_lovejs_launcher", TOOLS / "prepare_lovejs_launcher.py"
)
assert SPEC is not None and SPEC.loader is not None
launcher = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(launcher)


class LauncherPreparationTests(unittest.TestCase):
    def test_overlay_adds_bit_without_changing_existing_files(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / "game.love"
            output = Path(directory) / "overlaid.love"
            with zipfile.ZipFile(source, "w") as archive:
                archive.writestr("main.lua", b"return true")
                archive.writestr("src/core.lua", b"return {}")
            report = launcher.add_compatibility_overlay(source, output)
            with zipfile.ZipFile(output) as archive:
                self.assertEqual(archive.read("gen1recomp-main.lua"), b"return true")
                self.assertIn(b"love-web-bootstrap", archive.read("main.lua"))
                self.assertEqual(
                    archive.read("bit.lua"),
                    (ROOT / "compatibility" / "love-web" / "bit.lua").read_bytes(),
                )
                self.assertEqual(
                    archive.read("love-web-bootstrap.lua"),
                    (ROOT / "compatibility" / "love-web" / "bootstrap.lua").read_bytes(),
                )
            self.assertEqual(report["entries"], 5)

    def test_overlay_rejects_traversal_and_existing_bit_module(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / "bad.love"
            output = Path(directory) / "out.love"
            with zipfile.ZipFile(source, "w") as archive:
                archive.writestr("../escape.lua", b"")
            with self.assertRaisesRegex(RuntimeError, "unsafe paths"):
                launcher.add_compatibility_overlay(source, output)

            with zipfile.ZipFile(source, "w") as archive:
                archive.writestr("main.lua", b"")
                archive.writestr("bit.lua", b"untrusted")
            with self.assertRaisesRegex(RuntimeError, "reserved overlay paths"):
                launcher.add_compatibility_overlay(source, output)

    def test_overlay_rejects_symbolic_links(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / "link.love"
            output = Path(directory) / "out.love"
            link = zipfile.ZipInfo("src/link.lua")
            link.create_system = 3
            link.external_attr = 0o120777 << 16
            with zipfile.ZipFile(source, "w") as archive:
                archive.writestr("main.lua", b"")
                archive.writestr(link, "target.lua")
            with self.assertRaisesRegex(RuntimeError, "symbolic links"):
                launcher.add_compatibility_overlay(source, output)


if __name__ == "__main__":
    unittest.main()
