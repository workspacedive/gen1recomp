#!/usr/bin/env python3
"""Build a ROM-free LÖVE 11.5 browser smoke probe from the pinned candidate."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import tempfile
import zipfile

REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_LOCK = REPO_ROOT / "research" / "gen1recomp-lock.json"
DEFAULT_SOURCE = REPO_ROOT / "research" / "downloads" / "gen1recomp" / "lovejs-11.5"
DEFAULT_OUTPUT = REPO_ROOT / "research" / "downloads" / "gen1recomp" / "lovejs-smoke"
PROBE_SOURCE = REPO_ROOT / "probes" / "lovejs-smoke"
EXTERNAL_FILES = (
    "player.js",
    "11.5/love.js",
    "11.5/love.wasm",
    "lua/normalize1.lua",
    "lua/normalize2.lua",
)
PROBE_FILES = ("index.html", "probe-ui.js", "probe.css")
LOVE_FILES = ("main.lua", "conf.lua")
ZIP_TIMESTAMP = (1980, 1, 1, 0, 0, 0)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def verify_file(path: Path, expected: dict[str, object]) -> None:
    if not path.is_file():
        raise RuntimeError(f"missing pinned runtime file: {path}")
    size = path.stat().st_size
    digest = sha256(path)
    if size != expected["size"] or digest != expected["sha256"]:
        raise RuntimeError(
            f"pinned runtime mismatch for {path}: "
            f"size {size}/{expected['size']}, sha256 {digest}/{expected['sha256']}"
        )


def source_revision(source: Path) -> str:
    result = subprocess.run(
        ["git", "rev-parse", "HEAD"],
        cwd=source,
        check=True,
        capture_output=True,
        text=True,
    )
    return result.stdout.strip()


def write_love_archive(destination: Path) -> None:
    with zipfile.ZipFile(destination, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for name in LOVE_FILES:
            data = (PROBE_SOURCE / name).read_bytes()
            info = zipfile.ZipInfo(name, ZIP_TIMESTAMP)
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o100644 << 16
            archive.writestr(info, data)
    with zipfile.ZipFile(destination) as archive:
        if archive.testzip() is not None:
            raise RuntimeError("generated smoke.love failed ZIP integrity")
        if sorted(archive.namelist()) != sorted(LOVE_FILES):
            raise RuntimeError("generated smoke.love has unexpected entries")


def prepare(lock_path: Path, source: Path, output: Path) -> dict[str, object]:
    lock = json.loads(lock_path.read_text(encoding="utf-8"))
    candidate = lock["runtimeCandidates"]["lovejs11_5"]
    revision = source_revision(source)
    if revision != candidate["revision"]:
        raise RuntimeError(
            f"love.js revision mismatch: {revision}/{candidate['revision']}"
        )
    for relative in EXTERNAL_FILES:
        verify_file(source / relative, candidate["files"][relative])

    output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="lovejs-smoke.", dir=output.parent) as temporary:
        staging = Path(temporary) / "web"
        staging.mkdir()
        for relative in EXTERNAL_FILES:
            destination = staging / relative
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(source / relative, destination)
        for relative in PROBE_FILES:
            shutil.copyfile(PROBE_SOURCE / relative, staging / relative)
        write_love_archive(staging / "smoke.love")

        files = {
            path.relative_to(staging).as_posix(): {
                "size": path.stat().st_size,
                "sha256": sha256(path),
            }
            for path in sorted(staging.rglob("*"))
            if path.is_file()
        }
        report: dict[str, object] = {
            "schemaVersion": 1,
            "runtimeRevision": revision,
            "loveVersion": "11.5",
            "probe": "ROM-free browser smoke; not Scripting/device evidence",
            "files": files,
        }
        (staging / "probe-manifest.json").write_text(
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
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()
    report = prepare(args.lock.resolve(), args.source.resolve(), args.output.resolve())
    print(
        f"prepared {args.output} from {report['runtimeRevision']} "
        f"({len(report['files'])} verified files)"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
