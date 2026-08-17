#!/usr/bin/env python3
"""Build a deterministic ROM-free Gen1Recomp Phase-0 .scripting probe."""

from __future__ import annotations

import argparse
import base64
import hashlib
import json
from pathlib import Path, PurePosixPath
import subprocess
import zipfile

REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SOURCE = REPO_ROOT / "scripting" / "Gen1RecompPhase0"
DEFAULT_LAUNCHER = REPO_ROOT / "research" / "downloads" / "gen1recomp" / "lovejs-launcher"
DEFAULT_LOCK = REPO_ROOT / "research" / "gen1recomp-lock.json"
DEFAULT_OUTPUT = (
    REPO_ROOT / "research" / "downloads" / "gen1recomp" / "Gen1Recomp Phase 0.scripting"
)
RUNTIME_REVISION = "9355186de22db13bd88bf2a0db75d2925647d036"
PAYLOAD_SHA256 = "f6a11c06cc68485481764942070c468c7597e2f6bddb649489cbddc9c59c64dd"
PAYLOAD_BYTES = 5_943_885
PAYLOAD_ENTRIES = 489
ZIP_TIMESTAMP = (1980, 1, 1, 0, 0, 0)

SOURCE_FILES = (
    "script.json",
    "index.tsx",
    "runtime/index.html",
    "runtime/phase0.css",
    "runtime/phase0-bootstrap.js",
    "runtime/phase0-loader.js",
)
LAUNCHER_FILES = (
    "player.js",
    "lua/normalize1.lua",
    "lua/normalize2.lua",
    "11.5/love.js",
    "11.5/love.wasm",
)
DIRECT_LAUNCHER_FILES = ("player.js", "11.5/love.js")


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def safe_path(name: str) -> bool:
    path = PurePosixPath(name)
    return (
        bool(name)
        and not name.startswith(("/", "\\"))
        and "\\" not in name
        and all(part not in ("", ".", "..") for part in path.parts)
    )


def read_required(root: Path, relative: str) -> bytes:
    path = root / relative
    if not path.is_file():
        raise RuntimeError(f"required Phase-0 input is missing: {path}")
    return path.read_bytes()


def bundle_browser_entry(entry: Path) -> bytes:
    esbuild = REPO_ROOT / "node_modules" / ".bin" / "esbuild"
    if not esbuild.is_file():
        raise RuntimeError("esbuild is missing; run npm install")
    if not entry.is_file():
        raise RuntimeError(f"browser entry is missing: {entry}")
    result = subprocess.run(
        [
            str(esbuild),
            str(entry),
            "--bundle",
            "--format=iife",
            "--platform=browser",
            "--target=safari13",
            "--charset=utf8",
            "--legal-comments=none",
            "--log-level=error",
        ],
        cwd=REPO_ROOT,
        check=True,
        capture_output=True,
    )
    if not result.stdout:
        raise RuntimeError("esbuild produced an empty browser bundle")
    return result.stdout


def verify_locked_runtime(
    launcher: Path,
    lock: dict[str, object],
) -> None:
    candidate = lock["runtimeCandidates"]["lovejs11_5"]  # type: ignore[index]
    if candidate["revision"] != RUNTIME_REVISION:  # type: ignore[index]
        raise RuntimeError("locked love.js revision does not match the Phase-0 package")
    files = candidate["files"]  # type: ignore[index]
    for relative in LAUNCHER_FILES:
        data = read_required(launcher, relative)
        expected = files[relative]  # type: ignore[index]
        if len(data) != expected["size"] or sha256_bytes(data) != expected["sha256"]:  # type: ignore[index]
            raise RuntimeError(f"pinned love.js file mismatch: {relative}")


def runtime_config() -> bytes:
    config = {
        "runtimeRevision": RUNTIME_REVISION,
        "hostSessionProtocol": 1,
        "cacheFormat": "rom-cache-v10",
        "payload": {
            "sha256": PAYLOAD_SHA256,
            "bytes": PAYLOAD_BYTES,
            "entries": PAYLOAD_ENTRIES,
        },
    }
    encoded = json.dumps(config, sort_keys=True, separators=(",", ":"))
    return f"window.__gen1recompRuntimeConfig = Object.freeze({encoded})\n".encode()


def embedded_packages_script(launcher: Path) -> bytes:
    packages = {
        "gen1recomp.love": read_required(launcher, "gen1recomp.love"),
        "lua/normalize1.lua": read_required(launcher, "lua/normalize1.lua"),
        "lua/normalize2.lua": read_required(launcher, "lua/normalize2.lua"),
        "11.5/love.wasm": read_required(launcher, "11.5/love.wasm"),
    }
    encoded = {
        name: base64.b64encode(data).decode("ascii")
        for name, data in sorted(packages.items())
    }
    payload = json.dumps(encoded, sort_keys=True, separators=(",", ":"))
    return f"window.__gen1recompEmbeddedPackages = {payload}\n".encode()


def collect_entries(
    source: Path,
    launcher: Path,
    lock_path: Path,
) -> dict[str, bytes]:
    if not lock_path.is_file():
        raise RuntimeError(f"required Phase-0 input is missing: {lock_path}")
    lock = json.loads(lock_path.read_text(encoding="utf-8"))
    verify_locked_runtime(launcher, lock)
    entries: dict[str, bytes] = {}
    for relative in SOURCE_FILES:
        entries[relative] = read_required(source, relative)
    for relative in DIRECT_LAUNCHER_FILES:
        entries[f"runtime/{relative}"] = read_required(launcher, relative)
    payload = read_required(launcher, "gen1recomp.love")
    if len(payload) != PAYLOAD_BYTES or sha256_bytes(payload) != PAYLOAD_SHA256:
        raise RuntimeError("prepared ROM-free launcher payload mismatch")
    entries["runtime/embedded-packages.js"] = embedded_packages_script(launcher)
    entries["runtime/phase0-bundle.js"] = bundle_browser_entry(
        source / "runtime" / "phase0-probe.js"
    )
    entries["runtime/runtime-config.js"] = runtime_config()

    metadata = json.loads(entries["script.json"])
    for required in ("name", "icon", "color", "version", "entry"):
        if not isinstance(metadata.get(required), str) or not metadata[required]:
            raise RuntimeError(f"script.json field is required: {required}")
    if metadata["entry"] != "index.tsx":
        raise RuntimeError("Phase-0 script entry must be index.tsx")
    if any(not safe_path(name) for name in entries):
        raise RuntimeError("Phase-0 package contains an unsafe path")
    if len(entries) != len(set(entries)):
        raise RuntimeError("Phase-0 package contains duplicate paths")
    return entries


def write_archive(entries: dict[str, bytes], destination: Path) -> dict[str, object]:
    destination.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(destination, "w") as archive:
        for name in sorted(entries):
            info = zipfile.ZipInfo(name, ZIP_TIMESTAMP)
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o100644 << 16
            archive.writestr(info, entries[name])
    with zipfile.ZipFile(destination) as archive:
        corrupt = archive.testzip()
        if corrupt is not None:
            raise RuntimeError(f"Phase-0 archive failed integrity at {corrupt}")
        if archive.namelist() != sorted(entries):
            raise RuntimeError("Phase-0 archive entry order is not deterministic")
    data = destination.read_bytes()
    return {
        "path": destination.as_posix(),
        "entries": len(entries),
        "bytes": len(data),
        "sha256": sha256_bytes(data),
        "runtimeRevision": RUNTIME_REVISION,
        "payloadSha256": PAYLOAD_SHA256,
        "scope": "ROM-free Scripting Phase-0 probe; not a production game application",
    }


def package(
    source: Path,
    launcher: Path,
    lock_path: Path,
    destination: Path,
) -> dict[str, object]:
    return write_archive(
        collect_entries(source, launcher, lock_path),
        destination,
    )


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
