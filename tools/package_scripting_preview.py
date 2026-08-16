#!/usr/bin/env python3
"""Build the deterministic ROM-free interactive Gen1Recomp Preview .scripting archive."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from package_scripting_phase0_probe import (
    DEFAULT_LAUNCHER,
    DEFAULT_LOCK,
    PAYLOAD_BYTES,
    PAYLOAD_ENTRIES,
    PAYLOAD_SHA256,
    REPO_ROOT,
    RUNTIME_REVISION,
    bundle_browser_entry,
    read_required,
    runtime_config,
    safe_path,
    sha256_bytes,
    verify_locked_runtime,
    write_archive,
)

DEFAULT_SOURCE = REPO_ROOT / "scripting" / "Gen1RecompPreview"
DEFAULT_OUTPUT = (
    REPO_ROOT / "research" / "downloads" / "gen1recomp" / "Gen1Recomp Preview 013.scripting"
)
RUNTIME_ROOT = "runtime-v013"
SOURCE_FILES = (
    "script.json",
    "index.tsx",
    f"{RUNTIME_ROOT}/index.html",
    f"{RUNTIME_ROOT}/preview.css",
    f"{RUNTIME_ROOT}/preview-bootstrap.js",
    f"{RUNTIME_ROOT}/preview-loader.js",
)
LAUNCHER_FILES = (
    "player.js",
    "lua/normalize1.lua",
    "lua/normalize2.lua",
    "11.5/love.js",
    "11.5/love.wasm",
)


def collect_entries(
    source: Path,
    launcher: Path,
    lock_path: Path,
) -> dict[str, bytes]:
    if not lock_path.is_file():
        raise RuntimeError(f"required Preview input is missing: {lock_path}")
    lock = json.loads(lock_path.read_text(encoding="utf-8"))
    verify_locked_runtime(launcher, lock)
    entries: dict[str, bytes] = {}
    for relative in SOURCE_FILES:
        entries[relative] = read_required(source, relative)
    for relative in LAUNCHER_FILES:
        entries[f"{RUNTIME_ROOT}/{relative}"] = read_required(launcher, relative)
    payload = read_required(launcher, "gen1recomp.love")
    if len(payload) != PAYLOAD_BYTES or sha256_bytes(payload) != PAYLOAD_SHA256:
        raise RuntimeError("prepared ROM-free launcher payload mismatch")
    entries[f"{RUNTIME_ROOT}/gen1recomp.love"] = payload
    entries[f"{RUNTIME_ROOT}/preview-bundle.js"] = bundle_browser_entry(
        source / RUNTIME_ROOT / "preview.js"
    )
    entries[f"{RUNTIME_ROOT}/runtime-config.js"] = runtime_config()

    metadata = json.loads(entries["script.json"])
    for required in ("name", "icon", "color", "version", "entry"):
        if not isinstance(metadata.get(required), str) or not metadata[required]:
            raise RuntimeError(f"script.json field is required: {required}")
    if metadata["name"] != "Gen1Recomp Preview 013" or metadata["entry"] != "index.tsx":
        raise RuntimeError("Preview metadata identity is invalid")
    if any(not safe_path(name) for name in entries):
        raise RuntimeError("Preview package contains an unsafe path")
    return entries


def package(
    source: Path,
    launcher: Path,
    lock_path: Path,
    output: Path,
) -> dict[str, object]:
    report = write_archive(
        collect_entries(source, launcher, lock_path),
        output,
    )
    return {
        **report,
        "runtimeRevision": RUNTIME_REVISION,
        "payloadSha256": PAYLOAD_SHA256,
        "payloadEntries": PAYLOAD_ENTRIES,
        "scope": "interactive ROM-free Scripting Preview; physical device verification pending",
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE)
    parser.add_argument("--launcher", type=Path, default=DEFAULT_LAUNCHER)
    parser.add_argument("--lock", type=Path, default=DEFAULT_LOCK)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()
    report = package(
        args.source.resolve(),
        args.launcher.resolve(),
        args.lock.resolve(),
        args.output.resolve(),
    )
    print(json.dumps(report, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
