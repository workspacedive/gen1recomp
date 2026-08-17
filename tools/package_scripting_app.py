#!/usr/bin/env python3
"""Build the deterministic ROM-free native Gen1Recomp Scripting product shell."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from package_scripting_phase0_probe import (
    DEFAULT_LAUNCHER,
    DEFAULT_LOCK,
    DIRECT_LAUNCHER_FILES,
    PAYLOAD_BYTES,
    PAYLOAD_ENTRIES,
    PAYLOAD_SHA256,
    REPO_ROOT,
    RUNTIME_REVISION,
    bundle_browser_entry,
    embedded_packages_script,
    read_required,
    runtime_config,
    safe_path,
    sha256_bytes,
    verify_locked_runtime,
    write_archive,
)

DEFAULT_SOURCE = REPO_ROOT / "scripting" / "Gen1RecompApp"
DEFAULT_OUTPUT = REPO_ROOT / "research" / "downloads" / "gen1recomp" / "Gen1Recomp Native 050.scripting"
PACKAGED_RUNTIME = "runtime-v050"
RUNTIME_SHELL = "runtime-shell-v050"
STATIC_RUNTIME_FILES = (
    "index.html",
    "preview.css",
    "preview-bootstrap.js",
    "preview-loader.js",
    "maintenance.html",
    "maintenance.js",
)


def collect_source_modules(source: Path) -> dict[str, bytes]:
    entries: dict[str, bytes] = {}
    for path in sorted((source / "src").rglob("*")):
        if path.is_file() and path.suffix in (".ts", ".tsx"):
            relative = path.relative_to(source).as_posix()
            entries[relative] = path.read_bytes()
    if not entries:
        raise RuntimeError("native Scripting source modules are missing")
    return entries


def collect_entries(source: Path, launcher: Path, lock_path: Path) -> dict[str, bytes]:
    if not lock_path.is_file():
        raise RuntimeError(f"required native-app input is missing: {lock_path}")
    lock = json.loads(lock_path.read_text(encoding="utf-8"))
    verify_locked_runtime(launcher, lock)
    entries = {
        "script.json": read_required(source, "script.json"),
        "index.tsx": read_required(source, "index.tsx"),
        **collect_source_modules(source),
    }
    for root in (PACKAGED_RUNTIME, RUNTIME_SHELL):
        for name in STATIC_RUNTIME_FILES:
            entries[f"{root}/{name}"] = read_required(source, f"{root}/{name}")
        entries[f"{root}/preview-bundle.js"] = bundle_browser_entry(source / PACKAGED_RUNTIME / "preview.js")
        entries[f"{root}/runtime-config.js"] = runtime_config()

    for relative in DIRECT_LAUNCHER_FILES:
        entries[f"{PACKAGED_RUNTIME}/{relative}"] = read_required(launcher, relative)
    payload = read_required(launcher, "gen1recomp.love")
    if len(payload) != PAYLOAD_BYTES or sha256_bytes(payload) != PAYLOAD_SHA256:
        raise RuntimeError("prepared ROM-free launcher payload mismatch")
    entries[f"{PACKAGED_RUNTIME}/embedded-packages.js"] = embedded_packages_script(launcher)

    metadata = json.loads(entries["script.json"])
    for required in ("name", "icon", "color", "version", "entry"):
        if not isinstance(metadata.get(required), str) or not metadata[required]:
            raise RuntimeError(f"script.json field is required: {required}")
    if metadata["name"] != "Gen1Recomp Native 050" or metadata["version"] != "0.5.0":
        raise RuntimeError("native Scripting product identity is invalid")
    if any(not safe_path(name) for name in entries):
        raise RuntimeError("native Scripting package contains an unsafe path")
    return entries


def package(source: Path, launcher: Path, lock_path: Path, output: Path) -> dict[str, object]:
    report = write_archive(collect_entries(source, launcher, lock_path), output)
    return {
        **report,
        "runtimeRevision": RUNTIME_REVISION,
        "payloadSha256": PAYLOAD_SHA256,
        "payloadEntries": PAYLOAD_ENTRIES,
        "scope": "native verified-ROM library, Retina/vector runtime, post-ready animated game chrome, native TabView descriptor tree, interruption recovery, cache, updates and mods; physical 0.5.0 verification pending",
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE)
    parser.add_argument("--launcher", type=Path, default=DEFAULT_LAUNCHER)
    parser.add_argument("--lock", type=Path, default=DEFAULT_LOCK)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()
    report = package(args.source.resolve(), args.launcher.resolve(), args.lock.resolve(), args.output.resolve())
    print(json.dumps(report, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
