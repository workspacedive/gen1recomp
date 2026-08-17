#!/usr/bin/env python3
"""Prepare a ROM-free Gen1Recomp launcher boot probe for pinned love.js."""

from __future__ import annotations

import argparse
import copy
import hashlib
import json
from pathlib import Path, PurePosixPath
import shutil
import tempfile
import zipfile

from prepare_lovejs_smoke import (
    DEFAULT_LOCK,
    DEFAULT_SOURCE as DEFAULT_RUNTIME,
    EXTERNAL_FILES,
    REPO_ROOT,
    sha256,
    source_revision,
    verify_file,
)
from package_gen1recomp_payload import (
    DEFAULT_SOURCE as DEFAULT_GAME_SOURCE,
    package as package_payload,
)

DEFAULT_OUTPUT = (
    REPO_ROOT / "research" / "downloads" / "gen1recomp" / "lovejs-launcher"
)
PROBE_SOURCE = REPO_ROOT / "probes" / "lovejs-launcher"
COMPATIBILITY_ROOT = REPO_ROOT / "compatibility" / "love-web"
BIT_SHIM = COMPATIBILITY_ROOT / "bit.lua"
BOOTSTRAP = COMPATIBILITY_ROOT / "bootstrap.lua"
AUDIO_SHIM = COMPATIBILITY_ROOT / "audio.lua"
PROBE_FILES = ("index.html", "launcher-probe.js", "launcher-probe.css")
ORIGINAL_MAIN = "gen1recomp-main.lua"
ORIGINAL_CONF = "gen1recomp-conf.lua"
CHIP_AUDIO_PATH = "src/core/ChipAudio.lua"
CHIP_AUDIO_FILL_ORIGINAL = b'''local MUSIC_FILL_INITIAL = 4\nlocal MUSIC_FILL_PER_CALL = 3\n'''
CHIP_AUDIO_FILL_ADAPTER = b'''local MUSIC_FILL_INITIAL = ChipSynth.MUSIC_FILL_INITIAL or 4\nlocal MUSIC_FILL_PER_CALL = ChipSynth.MUSIC_FILL_PER_CALL or 3\n'''
MAIN_WRAPPER = b'''-- Generated host wrapper; original upstream main.lua is gen1recomp-main.lua.\nlocal Bootstrap = require("love-web-bootstrap")\nBootstrap.install(love, {\n  disableThreadWorkers = true,\n  threadReason = "love.js 11.5 worker construction probe failed",\n})\nif os.getenv("POKEPORT_AUDIO_SLICE") == "1" then\n  require("love-web-audio").install(love)\nend\nlocal main, loadError = love.filesystem.load("gen1recomp-main.lua")\nassert(main, loadError)\nreturn main()\n'''
CONF_WRAPPER = b'''-- Generated host display wrapper; upstream conf.lua is gen1recomp-conf.lua.\nlocal conf, loadError = love.filesystem.load("gen1recomp-conf.lua")\nassert(conf, loadError)\nconf()\nlocal upstreamConf = assert(love.conf, "upstream love.conf missing")\nfunction love.conf(t)\n  upstreamConf(t)\n  local width = tonumber(os.getenv("POKEPORT_VIEW_WIDTH"))\n  local height = tonumber(os.getenv("POKEPORT_VIEW_HEIGHT"))\n  if width and height and width >= 320 and height >= 288\n      and width <= 2048 and height <= 2048 then\n    t.window.width = math.floor(width)\n    t.window.height = math.floor(height)\n    t.window.fullscreen = false\n    t.window.resizable = true\n    t.window.highdpi = false\n  end\nend\n'''


def safe_archive_path(name: str) -> bool:
    path = PurePosixPath(name)
    return (
        bool(name)
        and not name.startswith(("/", "\\"))
        and "\\" not in name
        and all(part not in ("", ".", "..") for part in path.parts)
    )


def add_compatibility_overlay(source: Path, destination: Path) -> dict[str, object]:
    with zipfile.ZipFile(source) as original:
        corrupt = original.testzip()
        if corrupt is not None:
            raise RuntimeError(f"source payload failed ZIP integrity at {corrupt}")
        names = original.namelist()
        unsafe = [name for name in names if not safe_archive_path(name.rstrip("/"))]
        symlinks = [
            info.filename
            for info in original.infolist()
            if (info.external_attr >> 16) & 0o170000 == 0o120000
        ]
        if unsafe:
            raise RuntimeError(f"source payload contains unsafe paths: {unsafe[:3]}")
        if symlinks:
            raise RuntimeError(f"source payload contains symbolic links: {symlinks[:3]}")
        reserved = {
            "bit.lua",
            "love-web-bootstrap.lua",
            "love-web-audio.lua",
            ORIGINAL_MAIN,
            ORIGINAL_CONF,
        }
        conflicts = sorted(reserved.intersection(names))
        if conflicts:
            raise RuntimeError(
                f"source payload already contains reserved overlay paths: {conflicts}"
            )
        with zipfile.ZipFile(destination, "w") as output:
            chip_audio_adapted = False
            for info in original.infolist():
                target_info = info
                data = original.read(info.filename)
                if info.filename == "main.lua":
                    target_info = copy.copy(info)
                    target_info.filename = ORIGINAL_MAIN
                elif info.filename == "conf.lua":
                    target_info = copy.copy(info)
                    target_info.filename = ORIGINAL_CONF
                elif info.filename == CHIP_AUDIO_PATH:
                    if data.count(CHIP_AUDIO_FILL_ORIGINAL) != 1:
                        raise RuntimeError("upstream ChipAudio fill constants changed")
                    data = data.replace(
                        CHIP_AUDIO_FILL_ORIGINAL,
                        CHIP_AUDIO_FILL_ADAPTER,
                        1,
                    )
                    chip_audio_adapted = True
                output.writestr(target_info, data)
            if not chip_audio_adapted:
                raise RuntimeError("upstream ChipAudio module is missing")

            def overlay(path: str, data: bytes) -> None:
                overlay_info = zipfile.ZipInfo(path, (1980, 1, 1, 0, 0, 0))
                overlay_info.compress_type = zipfile.ZIP_DEFLATED
                overlay_info.external_attr = 0o100644 << 16
                output.writestr(overlay_info, data)

            overlay("main.lua", MAIN_WRAPPER)
            overlay("conf.lua", CONF_WRAPPER)
            overlay("bit.lua", BIT_SHIM.read_bytes())
            overlay("love-web-bootstrap.lua", BOOTSTRAP.read_bytes())
            overlay("love-web-audio.lua", AUDIO_SHIM.read_bytes())

    with zipfile.ZipFile(destination) as result:
        if result.testzip() is not None:
            raise RuntimeError("overlaid payload failed ZIP integrity")
        return {
            "entries": len(result.infolist()),
            "size": destination.stat().st_size,
            "sha256": sha256(destination),
            "overlays": [
                {
                    "path": "bit.lua",
                    "source": BIT_SHIM.relative_to(REPO_ROOT).as_posix(),
                    "sha256": sha256(BIT_SHIM),
                },
                {
                    "path": "love-web-bootstrap.lua",
                    "source": BOOTSTRAP.relative_to(REPO_ROOT).as_posix(),
                    "sha256": sha256(BOOTSTRAP),
                },
                {
                    "path": "love-web-audio.lua",
                    "source": AUDIO_SHIM.relative_to(REPO_ROOT).as_posix(),
                    "sha256": sha256(AUDIO_SHIM),
                },
                {
                    "path": CHIP_AUDIO_PATH,
                    "source": "upstream plus generated host-configurable fill seam",
                    "sha256": hashlib.sha256(
                        result.read(CHIP_AUDIO_PATH)
                    ).hexdigest(),
                },
                {
                    "path": "main.lua",
                    "source": "generated host wrapper",
                    "upstreamMain": ORIGINAL_MAIN,
                    "sha256": hashlib.sha256(MAIN_WRAPPER).hexdigest(),
                },
                {
                    "path": "conf.lua",
                    "source": "generated host display wrapper",
                    "upstreamConf": ORIGINAL_CONF,
                    "sha256": hashlib.sha256(CONF_WRAPPER).hexdigest(),
                },
            ],
        }


def prepare(
    lock_path: Path,
    runtime: Path,
    game_source: Path,
    payload: Path | None,
    output: Path,
    version: str,
) -> dict[str, object]:
    lock = json.loads(lock_path.read_text(encoding="utf-8"))
    candidate = lock["runtimeCandidates"]["lovejs11_5"]
    revision = source_revision(runtime)
    if revision != candidate["revision"]:
        raise RuntimeError(f"love.js revision mismatch: {revision}/{candidate['revision']}")
    for relative in EXTERNAL_FILES:
        verify_file(runtime / relative, candidate["files"][relative])
    game_revision = source_revision(game_source)
    expected_revision = lock["upstream"]["releaseRevision"]
    if game_revision != expected_revision:
        raise RuntimeError(
            f"Gen1Recomp source revision mismatch: {game_revision}/{expected_revision}"
        )

    output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="lovejs-launcher.", dir=output.parent) as temporary:
        temporary_root = Path(temporary)
        if payload is None:
            base_payload = temporary_root / "deterministic-game.love"
            source_payload_report = package_payload(game_source, base_payload, version)
            source_payload_report.pop("path", None)
            source_payload_report["provenance"] = (
                "deterministic ROM-free package from pinned v0.1.96 source"
            )
        else:
            expected_payload = lock["androidAnalysis"]["sourceBuiltPayload"]
            verify_file(payload, {
                "size": expected_payload["size"],
                "sha256": expected_payload["sha256"],
            })
            base_payload = payload
            source_payload_report = {
                "path": payload.as_posix(),
                "size": payload.stat().st_size,
                "sha256": sha256(payload),
                "sourceRevision": game_revision,
                "provenance": "historical local v0.1.96 source build; not official",
            }

        staging = temporary_root / "web"
        staging.mkdir()
        for relative in EXTERNAL_FILES:
            target = staging / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(runtime / relative, target)
        for relative in PROBE_FILES:
            shutil.copyfile(PROBE_SOURCE / relative, staging / relative)
        payload_report = add_compatibility_overlay(
            base_payload, staging / "gen1recomp.love"
        )
        report: dict[str, object] = {
            "schemaVersion": 1,
            "runtimeRevision": revision,
            "sourcePayload": source_payload_report,
            "preparedPayload": payload_report,
            "scope": "ROM-free launcher boot only; no ROM/cache/save included",
        }
        (staging / "launcher-manifest.json").write_text(
            json.dumps(report, indent=2, sort_keys=True) + "\n",
            encoding="utf-8",
        )
        if output.exists():
            shutil.rmtree(output)
        staging.replace(output)
    return report


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--lock", type=Path, default=DEFAULT_LOCK)
    parser.add_argument("--runtime", type=Path, default=DEFAULT_RUNTIME)
    parser.add_argument("--source", type=Path, default=DEFAULT_GAME_SOURCE)
    parser.add_argument(
        "--payload",
        type=Path,
        help="Use the exact historical locked local payload instead of repackaging source",
    )
    parser.add_argument("--version", default="0.1.96")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()
    report = prepare(
        args.lock.resolve(),
        args.runtime.resolve(),
        args.source.resolve(),
        args.payload.resolve() if args.payload else None,
        args.output.resolve(),
        args.version,
    )
    prepared = report["preparedPayload"]
    print(
        f"prepared ROM-free launcher at {args.output} "
        f"({prepared['entries']} entries, sha256 {prepared['sha256']})"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
