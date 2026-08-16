#!/usr/bin/env python3
"""Serve the compiled love.js browser-surface lifecycle probe from the repository root."""

from __future__ import annotations

import argparse
from functools import partial
from pathlib import Path, PurePosixPath
from urllib.parse import unquote, urlsplit

from serve_lovejs_smoke import ProbeHandler, ProbeServer, REPO_ROOT

REQUIRED = (
    ".tmp/ts/runtime/adapters/lovejs/browser-surface.js",
    ".tmp/ts/runtime/adapters/lovejs/persistence.js",
    ".tmp/ts/runtime/adapters/lovejs/runtime-port.js",
    ".tmp/ts/components/contracts/src/json.js",
    ".tmp/ts/components/contracts/src/result.js",
    ".tmp/ts/components/contracts/src/runtime.js",
    "research/downloads/gen1recomp/lovejs-launcher/player.js",
    "research/downloads/gen1recomp/lovejs-launcher/gen1recomp.love",
    "research/downloads/gen1recomp/lovejs-launcher/launcher-manifest.json",
    "research/downloads/gen1recomp/lovejs-launcher/lua/normalize1.lua",
    "research/downloads/gen1recomp/lovejs-launcher/lua/normalize2.lua",
    "research/downloads/gen1recomp/lovejs-launcher/11.5/love.js",
    "research/downloads/gen1recomp/lovejs-launcher/11.5/love.wasm",
    "probes/lovejs-runtime-surface/index.html",
    "probes/lovejs-runtime-surface/surface-bootstrap.js",
    "probes/lovejs-runtime-surface/surface-probe.js",
    "probes/lovejs-runtime-surface/surface-probe.css",
)

PROBE_URL_PREFIX = "/probes/lovejs-runtime-surface/"
PLAYER_RELATIVE_PATHS = frozenset(("gen1recomp.love",))
PLAYER_RELATIVE_PREFIXES = ("lua/", "11.5/")
ALLOWED_PATHS = frozenset("/" + relative for relative in REQUIRED)


class SurfaceProbeHandler(ProbeHandler):
    launcher_directory = REPO_ROOT / "research/downloads/gen1recomp/lovejs-launcher"

    @staticmethod
    def _decoded_path(path: str) -> str:
        return unquote(urlsplit(path).path)

    @classmethod
    def _player_relative_path(cls, path: str) -> PurePosixPath | None:
        decoded = cls._decoded_path(path)
        if not decoded.startswith(PROBE_URL_PREFIX):
            return None
        relative = decoded.removeprefix(PROBE_URL_PREFIX)
        candidate = PurePosixPath(relative)
        safe = (
            relative in PLAYER_RELATIVE_PATHS
            or relative.startswith(PLAYER_RELATIVE_PREFIXES)
        ) and all(part not in ("", ".", "..") for part in candidate.parts)
        return candidate if safe else None

    @classmethod
    def _allowed(cls, path: str) -> bool:
        decoded = cls._decoded_path(path)
        return (
            decoded == "/__probe_report"
            or decoded in ALLOWED_PATHS
            or cls._player_relative_path(path) is not None
        )

    def do_GET(self) -> None:
        if not self._allowed(self.path):
            self.send_error(404)
            return
        super().do_GET()

    def do_HEAD(self) -> None:
        if not self._allowed(self.path):
            self.send_error(404)
            return
        super().do_HEAD()

    def translate_path(self, path: str) -> str:
        alias = self._player_relative_path(path)
        if alias is not None:
            return str(self.launcher_directory.joinpath(*alias.parts))
        return super().translate_path(path)


def verify_inputs(root: Path) -> None:
    missing = [relative for relative in REQUIRED if not (root / relative).is_file()]
    if missing:
        raise RuntimeError(
            "runtime-surface probe inputs are missing: " + ", ".join(missing)
        )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--bind", default="0.0.0.0")
    parser.add_argument("--port", type=int, default=4174)
    parser.add_argument("--root", type=Path, default=REPO_ROOT)
    args = parser.parse_args()
    root = args.root.resolve()
    verify_inputs(root)
    SurfaceProbeHandler.launcher_directory = (
        root / "research/downloads/gen1recomp/lovejs-launcher"
    )
    handler = partial(SurfaceProbeHandler, directory=str(root))
    server = ProbeServer((args.bind, args.port), handler)
    print(
        "serving love.js runtime-surface probe at "
        f"http://{args.bind}:{args.port}/probes/lovejs-runtime-surface/index.html"
    )
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
