#!/usr/bin/env python3
"""Prepare a ROM-free Gen1Recomp launcher boot probe for pinned love.js."""

from __future__ import annotations

import argparse
import json
from pathlib import Path, PurePosixPath
import shutil
import tempfile
import zipfile

from prepare_lovejs_smoke import (
    DEFAULT_LOCK,
    DEFAULT_SOURCE,
    EXTERNAL_FILES,
    REPO_ROOT,
    sha256,
    source_revision,
    verify_file,
)

DEFAULT_PAYLOAD = (
    REPO_ROOT
    / "research"
    / "downloads"
    / "gen1recomp"
    / "android-v0.1.96"
    / "source-built"
    / "game.love"
)
DEFAULT_OUTPUT = (
    REPO_ROOT / "research" / "downloads" / "gen1recomp" / "lovejs-launcher"
)
PROBE_SOURCE = REPO_ROOT / "probes" / "lovejs-launcher"
SHIM = REPO_ROOT / "compatibility" / "love-web" / "bit.lua"
PROBE_FILES = ("index.html", "launcher-probe.js", "launcher-probe.css")


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
        if "bit.lua" in names:
            raise RuntimeError("source payload already contains bit.lua; overlay decision is ambiguous")
        with zipfile.ZipFile(destination, "w") as output:
            for info in original.infolist():
                output.writestr(info, original.read(info.filename))
            shim_info = zipfile.ZipInfo("bit.lua", (1980, 1, 1, 0, 0, 0))
            shim_info.compress_type = zipfile.ZIP_DEFLATED
            shim_info.external_attr = 0o100644 << 16
            output.writestr(shim_info, SHIM.read_bytes())

    with zipfile.ZipFile(destination) as result:
        if result.testzip() is not None:
            raise RuntimeError("overlaid payload failed ZIP integrity")
        return {
            "entries": len(result.infolist()),
            "size": destination.stat().st_size,
            "sha256": sha256(destination),
            "overlay": {
                "path": "bit.lua",
                "source": SHIM.relative_to(REPO_ROOT).as_posix(),
                "sha256": sha256(SHIM),
            },
        }


def prepare(lock_path: Path, runtime: Path, payload: Path, output: Path) -> dict[str, object]:
    lock = json.loads(lock_path.read_text(encoding="utf-8"))
    candidate = lock["runtimeCandidates"]["lovejs11_5"]
    revision = source_revision(runtime)
    if revision != candidate["revision"]:
        raise RuntimeError(f"love.js revision mismatch: {revision}/{candidate['revision']}")
    for relative in EXTERNAL_FILES:
        verify_file(runtime / relative, candidate["files"][relative])

    expected_payload = lock["androidAnalysis"]["sourceBuiltPayload"]
    verify_file(payload, {
        "name": payload.name,
        "size": expected_payload["size"],
        "sha256": expected_payload["sha256"],
        "githubAssetId": 1,
    })

    output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="lovejs-launcher.", dir=output.parent) as temporary:
        staging = Path(temporary) / "web"
        staging.mkdir()
        for relative in EXTERNAL_FILES:
            target = staging / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(runtime / relative, target)
        for relative in PROBE_FILES:
            shutil.copyfile(PROBE_SOURCE / relative, staging / relative)
        payload_report = add_compatibility_overlay(payload, staging / "gen1recomp.love")
        report: dict[str, object] = {
            "schemaVersion": 1,
            "runtimeRevision": revision,
            "sourcePayload": {
                "path": payload.as_posix(),
                "size": payload.stat().st_size,
                "sha256": sha256(payload),
                "provenance": "local v0.1.96 source build; not official release artifact",
            },
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
    parser.add_argument("--runtime", type=Path, default=DEFAULT_SOURCE)
    parser.add_argument("--payload", type=Path, default=DEFAULT_PAYLOAD)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()
    report = prepare(
        args.lock.resolve(),
        args.runtime.resolve(),
        args.payload.resolve(),
        args.output.resolve(),
    )
    prepared = report["preparedPayload"]
    print(
        f"prepared ROM-free launcher at {args.output} "
        f"({prepared['entries']} entries, sha256 {prepared['sha256']})"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
