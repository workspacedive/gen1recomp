from __future__ import annotations

from pathlib import Path
import os
import shutil
import subprocess
import unittest


ROOT = Path(__file__).resolve().parents[2]


class AudioAdapterTests(unittest.TestCase):
    def test_private_effect_cache_is_signature_bound(self) -> None:
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
        environment = {
            **os.environ,
            "POKEPORT_GAME": "yellow",
            "POKEPORT_AUDIO_CACHE": "1",
            "POKEPORT_AUDIO_CACHE_NAMESPACE": "gen1recomp-0.1.96-chip-v1",
        }
        result = subprocess.run(
            [
                executable,
                str(ROOT / "tests" / "compatibility" / "audio_adapter_test.lua"),
                str(ROOT / "compatibility" / "love-web" / "audio.lua"),
            ],
            check=False,
            capture_output=True,
            text=True,
            env=environment,
            cwd=ROOT,
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("audio adapter fake runtime: passed", result.stdout)
        self.assertIn("effect cache=store", result.stdout)
        self.assertIn("effect cache=hit", result.stdout)


if __name__ == "__main__":
    unittest.main()
