from __future__ import annotations

import importlib.util
from pathlib import Path
import tempfile
import unittest


MODULE_PATH = Path(__file__).resolve().parents[2] / "tools" / "analyze_web_runtime_surface.py"
SPEC = importlib.util.spec_from_file_location("analyze_web_runtime_surface", MODULE_PATH)
assert SPEC is not None and SPEC.loader is not None
surface = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(surface)


class WebRuntimeSurfaceTests(unittest.TestCase):
    def test_inventory_separates_callbacks_calls_requires_and_dynamic_access(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory)
            (source / "src").mkdir()
            (source / "conf.lua").write_text("", encoding="utf-8")
            (source / "main.lua").write_text(
                """
                local bit = require("bit")
                local loader = loadstring("return 1")
                function love.load()
                  love.graphics.newCanvas(160, 144)
                  love.event.quit()
                  pcall(love.thread.newThread, "worker.lua")
                  pcall(require, "ffi")
                end
                local dynamic = love["graphics"]
                """,
                encoding="utf-8",
            )
            report = surface.analyze(source)

        self.assertEqual(report["scope"]["luaFiles"], 2)
        self.assertIn("love.graphics.newCanvas", report["loveCalls"])
        self.assertIn("love.event.quit", report["loveCalls"])
        self.assertNotIn("love.thread.newThread", report["loveCalls"])
        self.assertIn("love.thread.newThread", report["loveMemberReferences"])
        self.assertNotIn("love.load", report["loveCalls"])
        self.assertIn("load", report["callbacks"])
        self.assertIn("bit", report["requires"])
        self.assertIn("ffi", report["guardedRequires"])
        self.assertIn("loadstring", report["lua51Symbols"])
        self.assertEqual(report["dynamicLoveIndexFiles"], ["main.lua"])
        self.assertIn("love.graphics.newCanvas", report["probePriority"])


if __name__ == "__main__":
    unittest.main()
