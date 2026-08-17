from __future__ import annotations

from pathlib import Path
import shutil
import subprocess
import unittest


ROOT = Path(__file__).resolve().parents[2]


class TouchVisualsTests(unittest.TestCase):
    def test_vector_adapter_draws_without_replacing_input(self) -> None:
        executable = next(
            (
                value
                for name in ("lua", "lua5.4", "lua5.3", "lua5.2", "lua5.1", "luajit")
                if (value := shutil.which(name)) is not None
            ),
            None,
        )
        if executable is None:
            self.skipTest("Lua interpreter is unavailable")
        result = subprocess.run(
            [
                executable,
                str(ROOT / "tests" / "compatibility" / "touch_visuals_test.lua"),
                str(ROOT / "compatibility" / "love-web" / "touch.lua"),
            ],
            check=False,
            capture_output=True,
            text=True,
            cwd=ROOT,
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("touch vector visuals fake runtime: passed", result.stdout)
        self.assertIn("vector touch controls installed", result.stdout)


if __name__ == "__main__":
    unittest.main()
