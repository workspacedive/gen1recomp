from __future__ import annotations

from pathlib import Path
import shutil
import subprocess
import unittest


ROOT = Path(__file__).resolve().parents[2]
VENDORED_LUAJIT = (
    ROOT
    / "research"
    / "downloads"
    / "gen1recomp"
    / "upstream-dev"
    / "mobile"
    / "android"
    / "love"
    / "src"
    / "jni"
    / "LuaJIT-2.1"
    / "src"
    / "luajit"
)


class BitShimParityTests(unittest.TestCase):
    def test_pure_lua_shim_matches_luajit_bitop(self) -> None:
        executable = VENDORED_LUAJIT if VENDORED_LUAJIT.is_file() else shutil.which("luajit")
        if executable is None:
            self.skipTest("LuaJIT reference executable is unavailable")
        result = subprocess.run(
            [
                str(executable),
                str(ROOT / "tests" / "compatibility" / "bit_shim_test.lua"),
                str(ROOT / "compatibility" / "love-web" / "bit.lua"),
            ],
            check=False,
            capture_output=True,
            text=True,
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("bit shim parity: passed", result.stdout)


if __name__ == "__main__":
    unittest.main()
