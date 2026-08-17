#!/usr/bin/env python3
"""Acquire pinned Gen1Recomp source/wiki/runtime/release artifacts for forensics.

Everything is written under the Git-ignored research/downloads/gen1recomp tree.
Release files are accepted only after size and SHA-256 match the lock file.
"""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import re
import subprocess
import sys
import tempfile
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_LOCK = REPO_ROOT / "research" / "gen1recomp-lock.json"
DEFAULT_DEST = REPO_ROOT / "research" / "downloads" / "gen1recomp"


def run(command: list[str], *, cwd: Path | None = None, stdout: Any = None) -> None:
    print("+", " ".join(command))
    subprocess.run(command, cwd=cwd, stdout=stdout, check=True)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def validate_asset(asset: dict[str, Any]) -> None:
    name = asset.get("name")
    size = asset.get("size")
    digest = asset.get("sha256")
    asset_id = asset.get("githubAssetId")
    if (
        not isinstance(name, str)
        or not name
        or Path(name).name != name
        or name in {".", ".."}
        or "\\" in name
    ):
        raise RuntimeError("locked asset name must be a safe basename")
    if not isinstance(size, int) or isinstance(size, bool) or size < 0:
        raise RuntimeError(f"locked asset {name} has invalid size")
    if not isinstance(digest, str) or re.fullmatch(r"[a-f0-9]{64}", digest) is None:
        raise RuntimeError(f"locked asset {name} has invalid SHA-256")
    if not isinstance(asset_id, int) or isinstance(asset_id, bool) or asset_id <= 0:
        raise RuntimeError(f"locked asset {name} has invalid GitHub asset ID")


def verify(path: Path, asset: dict[str, Any]) -> None:
    validate_asset(asset)
    actual_size = path.stat().st_size
    actual_hash = sha256(path)
    if actual_size != asset["size"] or actual_hash != asset["sha256"]:
        path.unlink(missing_ok=True)
        raise RuntimeError(
            f"verification failed for {asset['name']}: "
            f"size {actual_size}/{asset['size']}, sha256 {actual_hash}/{asset['sha256']}"
        )


def clone_at(url: str, revision: str, destination: Path) -> None:
    if (destination / ".git").exists():
        run(["git", "fetch", "--quiet", "origin", revision], cwd=destination)
    else:
        destination.parent.mkdir(parents=True, exist_ok=True)
        run(["git", "clone", "--quiet", "--filter=blob:none", url, str(destination)])
    run(["git", "checkout", "--quiet", "--detach", revision], cwd=destination)


def acquire_asset(repository: str, asset: dict[str, Any], destination: Path) -> None:
    validate_asset(asset)
    destination.parent.mkdir(parents=True, exist_ok=True)
    if destination.is_file():
        try:
            verify(destination, asset)
            print(f"verified existing {destination.name}")
            return
        except RuntimeError:
            pass

    with tempfile.NamedTemporaryFile(
        prefix=destination.name + ".", suffix=".part", dir=destination.parent, delete=False
    ) as temporary:
        temporary_path = Path(temporary.name)
        try:
            run(
                [
                    "gh",
                    "api",
                    "-H",
                    "Accept: application/octet-stream",
                    f"repos/{repository}/releases/assets/{asset['githubAssetId']}",
                ],
                stdout=temporary,
            )
        except Exception:
            temporary_path.unlink(missing_ok=True)
            raise
    verify(temporary_path, asset)
    temporary_path.replace(destination)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--lock", type=Path, default=DEFAULT_LOCK)
    parser.add_argument("--destination", type=Path, default=DEFAULT_DEST)
    parser.add_argument("--source-only", action="store_true")
    parser.add_argument("--assets-only", action="store_true")
    parser.add_argument(
        "--skip-runtime-candidates",
        action="store_true",
        help="Do not clone pinned feasibility runtime candidates",
    )
    parser.add_argument("--asset", action="append", help="Only download a named locked asset")
    args = parser.parse_args()

    lock = json.loads(args.lock.read_text(encoding="utf-8"))
    if lock.get("schemaVersion") != 1:
        raise RuntimeError("unsupported lock schema")
    upstream = lock["upstream"]
    release_assets = lock.get("releaseAssets")
    if not isinstance(release_assets, list) or not all(
        isinstance(asset, dict) for asset in release_assets
    ):
        raise RuntimeError("releaseAssets must be an array of objects")
    for asset in release_assets:
        validate_asset(asset)
    destination = args.destination.resolve()

    if not args.assets_only:
        clone_at(upstream["repository"], upstream["devRevision"], destination / "upstream-dev")
        clone_at(
            upstream["wikiRepository"], upstream["wikiRevision"], destination / "wiki"
        )
        release = destination / f"source-{upstream['releaseTag']}"
        clone_at(upstream["repository"], upstream["releaseRevision"], release)
        if not args.skip_runtime_candidates:
            runtime = lock.get("runtimeCandidates", {}).get("lovejs11_5")
            if runtime is not None:
                if not isinstance(runtime, dict):
                    raise RuntimeError("runtimeCandidates.lovejs11_5 must be an object")
                clone_at(
                    runtime["repository"],
                    runtime["revision"],
                    destination / "lovejs-11.5",
                )

    if not args.source_only:
        names = set(args.asset or [])
        assets = [
            asset
            for asset in release_assets
            if not names or asset["name"] in names
        ]
        unknown = names - {asset["name"] for asset in release_assets}
        if unknown:
            raise RuntimeError(f"unknown locked assets: {', '.join(sorted(unknown))}")
        release_dir = destination / f"release-{upstream['releaseTag']}"
        failures: list[str] = []
        for asset in assets:
            try:
                acquire_asset(
                    "bryanthaboi/gen1recomp", asset, release_dir / asset["name"]
                )
            except (OSError, RuntimeError, subprocess.CalledProcessError) as error:
                failures.append(f"{asset['name']}: {error}")
        if failures:
            raise RuntimeError("release acquisition failed:\n" + "\n".join(failures))

    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (OSError, ValueError, RuntimeError, subprocess.CalledProcessError) as error:
        print(f"error: {error}", file=sys.stderr)
        raise SystemExit(1)
