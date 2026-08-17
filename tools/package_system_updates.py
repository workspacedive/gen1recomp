#!/usr/bin/env python3
"""Build deterministic ROM-free system-component packages and the stable update catalog."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path, PurePosixPath
import zipfile

REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_LAUNCHER = REPO_ROOT / "research" / "downloads" / "gen1recomp" / "lovejs-launcher"
DEFAULT_LOCK = REPO_ROOT / "research" / "gen1recomp-lock.json"
DEFAULT_OUTPUT = REPO_ROOT / "updates"
ARTIFACT_BASE_URL = (
    "https://raw.githubusercontent.com/workspacedive/gen1recomp/"
    "main/updates/artifacts/"
)
RUNTIME_COMPONENT_ID = "org.gen1recomp.runtime.lovejs"
RUNTIME_COMPONENT_VERSION = "0.1.0"
CORE_COMPONENT_ID = "org.gen1recomp.core"
CORE_COMPONENT_VERSION = "0.1.96"
CORE_PAYLOAD_SHA256 = "89de911ef5118be90c9df0385abf6f76949573f1d424c377efe5362aa46e9043"
ZIP_TIMESTAMP = (1980, 1, 1, 0, 0, 0)
RUNTIME_FILES = (
    "player.js",
    "11.5/love.js",
    "11.5/love.wasm",
    "lua/normalize1.lua",
    "lua/normalize2.lua",
)
CORE_FILES = ("gen1recomp.love",)


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def safe_path(value: str) -> bool:
    path = PurePosixPath(value)
    return (
        bool(value)
        and not value.startswith(("/", "\\"))
        and "\\" not in value
        and all(part not in ("", ".", "..") for part in path.parts)
    )


def read_inputs(root: Path, names: tuple[str, ...]) -> dict[str, bytes]:
    entries: dict[str, bytes] = {}
    for name in names:
        if not safe_path(name):
            raise RuntimeError(f"unsafe component entry: {name}")
        path = root / name
        if not path.is_file():
            raise RuntimeError(f"required component input is missing: {path}")
        entries[name] = path.read_bytes()
    return entries


def verify_inputs(launcher: Path, lock_path: Path) -> None:
    lock = json.loads(lock_path.read_text(encoding="utf-8"))
    runtime = lock["runtimeCandidates"]["lovejs11_5"]
    if runtime["revision"] != "9355186de22db13bd88bf2a0db75d2925647d036":
        raise RuntimeError("unexpected love.js revision")
    for name in RUNTIME_FILES:
        expected = runtime["files"][name]
        data = (launcher / name).read_bytes()
        if len(data) != expected["size"] or sha256(data) != expected["sha256"]:
            raise RuntimeError(f"locked runtime input mismatch: {name}")
    payload = (launcher / "gen1recomp.love").read_bytes()
    # outsideLauncherBoot is immutable historical evidence for the prior
    # payload. Current packaging binds the corrected compatibility overlay
    # explicitly without rewriting that archived observation.
    if sha256(payload) != CORE_PAYLOAD_SHA256:
        raise RuntimeError("locked ROM-free Gen1Recomp payload mismatch")


def write_zip(path: Path, entries: dict[str, bytes]) -> dict[str, object]:
    path.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(path, "w") as archive:
        for name in sorted(entries):
            info = zipfile.ZipInfo(name, ZIP_TIMESTAMP)
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o100644 << 16
            archive.writestr(info, entries[name])
    with zipfile.ZipFile(path) as archive:
        corrupt = archive.testzip()
        if corrupt is not None:
            raise RuntimeError(f"component archive failed at {corrupt}")
        if archive.namelist() != sorted(entries):
            raise RuntimeError("component archive order is not deterministic")
    data = path.read_bytes()
    return {
        "path": path.name,
        "size": len(data),
        "sha256": sha256(data),
        "entries": len(entries),
        "uncompressedBytes": sum(len(value) for value in entries.values()),
    }


def component_manifest(
    *,
    component_id: str,
    kind: str,
    version: str,
    api_version: str,
    artifact: dict[str, object],
    dependencies: list[dict[str, object]],
    compatibility: dict[str, str],
) -> dict[str, object]:
    return {
        "schemaVersion": 1,
        "id": component_id,
        "kind": kind,
        "version": version,
        "apiVersion": api_version,
        "artifact": {
            "path": artifact["path"],
            "size": artifact["size"],
            "integrity": {
                "algorithm": "sha256",
                "digest": artifact["sha256"],
            },
        },
        "dependencies": dependencies,
        "compatibility": compatibility,
        "capabilities": [],
        "migrations": [],
        "selfTests": [],
    }


def build(launcher: Path, lock_path: Path, output: Path) -> dict[str, object]:
    verify_inputs(launcher, lock_path)
    artifacts = output / "artifacts"
    runtime_name = f"{RUNTIME_COMPONENT_ID}-{RUNTIME_COMPONENT_VERSION}.zip"
    core_name = f"{CORE_COMPONENT_ID}-{CORE_COMPONENT_VERSION}.zip"
    runtime_artifact = write_zip(artifacts / runtime_name, read_inputs(launcher, RUNTIME_FILES))
    core_artifact = write_zip(artifacts / core_name, read_inputs(launcher, CORE_FILES))

    runtime_manifest = component_manifest(
        component_id=RUNTIME_COMPONENT_ID,
        kind="runtime",
        version=RUNTIME_COMPONENT_VERSION,
        api_version="11.5.0",
        artifact=runtime_artifact,
        dependencies=[],
        compatibility={"hostProtocol": "^1.0.0", "platformApi": "^1.0.0"},
    )
    core_manifest = component_manifest(
        component_id=CORE_COMPONENT_ID,
        kind="core",
        version=CORE_COMPONENT_VERSION,
        api_version="1.0.0",
        artifact=core_artifact,
        dependencies=[{"id": RUNTIME_COMPONENT_ID, "range": "^0.1.0"}],
        compatibility={
            "hostProtocol": "^1.0.0",
            "kernelApi": "^1.0.0",
            "loveApi": "11.5.x",
            "modApi": "^2.0.0",
        },
    )
    catalog = {
        "schemaVersion": 1,
        "catalogId": "org.gen1recomp.system",
        "domain": "system",
        "channel": "stable",
        "sequence": 1,
        "generatedAt": "2026-08-16T20:00:00.000Z",
        "artifactBaseURL": ARTIFACT_BASE_URL,
        "releases": [
            {
                "manifest": core_manifest,
                "publishedAt": "2026-08-16T18:00:00.000Z",
                "notes": {
                    "en": "Pinned ROM-free Gen1Recomp 0.1.96 core payload.",
                    "de": "Gepinnter ROM-freier Gen1Recomp-0.1.96-Core-Payload.",
                },
            },
            {
                "manifest": runtime_manifest,
                "publishedAt": "2026-08-11T19:51:49.000Z",
                "notes": {
                    "en": "Pinned love.js LÖVE 11.5 and Lua runtime for the no-worker iOS path.",
                    "de": "Gepinnte love.js-LÖVE-11.5-/Lua-Laufzeit für den iOS-Pfad ohne Worker.",
                },
            },
        ],
    }
    catalog_path = output / "catalog" / "stable.json"
    catalog_path.parent.mkdir(parents=True, exist_ok=True)
    catalog_bytes = (json.dumps(catalog, indent=2, sort_keys=True) + "\n").encode("utf-8")
    catalog_path.write_bytes(catalog_bytes)
    try:
        catalog_report_path = catalog_path.relative_to(REPO_ROOT).as_posix()
    except ValueError:
        catalog_report_path = catalog_path.as_posix()
    return {
        "catalog": catalog_report_path,
        "catalogSha256": sha256(catalog_bytes),
        "catalogSequence": 1,
        "artifacts": [runtime_artifact, core_artifact],
        "romFree": True,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--launcher", type=Path, default=DEFAULT_LAUNCHER)
    parser.add_argument("--lock", type=Path, default=DEFAULT_LOCK)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()
    report = build(args.launcher.resolve(), args.lock.resolve(), args.output.resolve())
    print(json.dumps(report, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
