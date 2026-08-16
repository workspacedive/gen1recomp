from __future__ import annotations

from functools import partial
import hashlib
import importlib.util
import json
from pathlib import Path
import tempfile
from threading import Thread
import unittest
from urllib.request import Request, urlopen
import zipfile


ROOT = Path(__file__).resolve().parents[2]


def load(name: str, relative: str):  # type: ignore[no-untyped-def]
    path = ROOT / relative
    spec = importlib.util.spec_from_file_location(name, path)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


prepare = load("prepare_lovejs_smoke", "tools/prepare_lovejs_smoke.py")
serve = load("serve_lovejs_smoke", "tools/serve_lovejs_smoke.py")


class PrepareTests(unittest.TestCase):
    def test_love_archive_is_deterministic_and_rooted(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            first = Path(directory) / "first.love"
            second = Path(directory) / "second.love"
            prepare.write_love_archive(first)
            prepare.write_love_archive(second)
            self.assertEqual(first.read_bytes(), second.read_bytes())
            with zipfile.ZipFile(first) as archive:
                self.assertEqual(sorted(archive.namelist()), ["conf.lua", "main.lua"])
                self.assertTrue(all(info.date_time == (1980, 1, 1, 0, 0, 0) for info in archive.infolist()))

    def test_verify_file_rejects_digest_mismatch(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "love.wasm"
            path.write_bytes(b"wasm")
            expected = {
                "size": 4,
                "sha256": hashlib.sha256(b"different").hexdigest(),
            }
            with self.assertRaisesRegex(RuntimeError, "pinned runtime mismatch"):
                prepare.verify_file(path, expected)


class ServerTests(unittest.TestCase):
    def test_server_headers_and_bounded_report_endpoint(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "index.html").write_text("probe", encoding="utf-8")
            (root / "love.wasm").write_bytes(b"wasm")
            handler = partial(serve.ProbeHandler, directory=str(root))
            server = serve.ProbeServer(("127.0.0.1", 0), handler)
            thread = Thread(target=server.serve_forever, daemon=True)
            thread.start()
            try:
                base = f"http://127.0.0.1:{server.server_port}"
                with urlopen(base + "/love.wasm") as response:
                    self.assertEqual(response.headers["Content-Type"], "application/wasm")
                    self.assertEqual(response.headers["Cross-Origin-Opener-Policy"], "same-origin")
                    self.assertEqual(response.headers["Cross-Origin-Embedder-Policy"], "require-corp")

                report = {"schemaVersion": 1, "status": "pass", "lines": ["PROBE_COMPLETE|PASS"]}
                request = Request(
                    base + "/__probe_report",
                    data=json.dumps(report).encode("utf-8"),
                    headers={"Content-Type": "application/json"},
                    method="POST",
                )
                with urlopen(request) as response:
                    self.assertEqual(response.status, 202)
                with urlopen(base + "/__probe_report") as response:
                    self.assertEqual(json.load(response), report)
            finally:
                server.shutdown()
                server.server_close()
                thread.join(timeout=2)


if __name__ == "__main__":
    unittest.main()
