#!/usr/bin/env python3
"""Serve the prepared love.js smoke probe with required isolation headers."""

from __future__ import annotations

import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
from threading import Lock
from typing import Any, cast

REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DIRECTORY = (
    REPO_ROOT / "research" / "downloads" / "gen1recomp" / "lovejs-smoke"
)


class ProbeHandler(SimpleHTTPRequestHandler):
    extensions_map = {
        **SimpleHTTPRequestHandler.extensions_map,
        ".js": "text/javascript; charset=utf-8",
        ".json": "application/json; charset=utf-8",
        ".love": "application/zip",
        ".wasm": "application/wasm",
    }

    @property
    def probe_server(self) -> "ProbeServer":
        return cast("ProbeServer", self.server)

    def do_GET(self) -> None:
        if self.path == "/__probe_report":
            with self.probe_server.report_lock:
                report = self.probe_server.latest_report
            payload = json.dumps(report, indent=2, sort_keys=True).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)
            return
        super().do_GET()

    def do_POST(self) -> None:
        if self.path != "/__probe_report":
            self.send_error(404)
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            self.send_error(400, "invalid content length")
            return
        if length <= 0 or length > 65536:
            self.send_error(413, "report must be between 1 and 65536 bytes")
            return
        try:
            report = json.loads(self.rfile.read(length))
        except (UnicodeDecodeError, json.JSONDecodeError):
            self.send_error(400, "report must be UTF-8 JSON")
            return
        if not isinstance(report, dict) or report.get("schemaVersion") != 1:
            self.send_error(422, "unsupported report schema")
            return
        with self.probe_server.report_lock:
            self.probe_server.latest_report = report
        payload = b'{"accepted":true}\n'
        self.send_response(202)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def end_headers(self) -> None:
        self.send_header("Cross-Origin-Opener-Policy", "same-origin")
        self.send_header("Cross-Origin-Embedder-Policy", "require-corp")
        self.send_header(
            "Content-Security-Policy",
            "default-src 'self'; script-src 'self' 'unsafe-eval'; "
            "style-src 'self'; img-src 'self' data:; media-src 'self' blob:; "
            "connect-src 'self'; worker-src 'self' blob:; object-src 'none'; "
            "base-uri 'none'",
        )
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


class ProbeServer(ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = True

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        self.latest_report: dict[str, object] | None = None
        self.report_lock = Lock()
        super().__init__(*args, **kwargs)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--bind", default="0.0.0.0")
    parser.add_argument("--port", type=int, default=4173)
    parser.add_argument("--directory", type=Path, default=DEFAULT_DIRECTORY)
    args = parser.parse_args()
    directory = args.directory.resolve()
    required = directory / "probe-manifest.json"
    if not required.is_file():
        raise RuntimeError(
            f"prepared probe not found at {directory}; run tools/prepare_lovejs_smoke.py"
        )
    handler = partial(ProbeHandler, directory=str(directory))
    server = ProbeServer((args.bind, args.port), handler)
    print(f"serving love.js smoke probe from {directory} at http://{args.bind}:{args.port}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
