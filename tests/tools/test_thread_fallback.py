from __future__ import annotations

from pathlib import Path
import shutil
import subprocess
import unittest


ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "research" / "downloads" / "gen1recomp" / "source-v0.1.96"
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


def luajit() -> str | None:
    if VENDORED_LUAJIT.is_file():
        return str(VENDORED_LUAJIT)
    return shutil.which("luajit")


class ThreadFallbackTests(unittest.TestCase):
    def setUp(self) -> None:
        self.executable = luajit()
        if self.executable is None or not SOURCE.is_dir():
            self.skipTest("pinned source and LuaJIT reference executable are required")

    def run_lua(self, arguments: list[str], *, cwd: Path = ROOT) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            [self.executable, *arguments],
            cwd=cwd,
            check=False,
            capture_output=True,
            text=True,
        )

    def test_measured_worker_failure_selects_soft_fallbacks(self) -> None:
        result = self.run_lua([
            str(ROOT / "tests" / "compatibility" / "thread_fallback_test.lua"),
            str(SOURCE),
            str(ROOT / "compatibility" / "love-web" / "bootstrap.lua"),
        ])
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("thread fallback characterization: passed", result.stdout)

    def test_chip_audio_synchronous_path_matches_upstream_characterization(self) -> None:
        result = self.run_lua(["tests/engine/fanfare_music_hold.lua"], cwd=SOURCE)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("fanfare music hold", result.stdout)


if __name__ == "__main__":
    unittest.main()
