#!/usr/bin/env python3
"""Reproduce the pinned Scripting research downloads.

The source list and revisions live in research/source-manifest.json. Downloads are
kept outside Git because some upstream collections have no asserted license.
This tool intentionally shells out to git and the authenticated GitHub CLI (`gh`)
instead of embedding credentials or relying on third-party Python packages.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
from typing import Any
from urllib.parse import quote

REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_MANIFEST = REPO_ROOT / "research" / "source-manifest.json"
DOWNLOAD_ROOT = (REPO_ROOT / "research" / "downloads").resolve()


def run(command: list[str], *, cwd: Path | None = None, stdout: Any = None) -> None:
    print("+", " ".join(command))
    subprocess.run(command, cwd=cwd, stdout=stdout, check=True)


def require_tool(name: str) -> None:
    if shutil.which(name) is None:
        raise RuntimeError(f"Required tool not found: {name}")


def safe_download_path(relative: str) -> Path:
    target = (REPO_ROOT / relative).resolve()
    if target != DOWNLOAD_ROOT and DOWNLOAD_ROOT not in target.parents:
        raise ValueError(f"Destination escapes research/downloads: {relative}")
    return target


def reset_destination(destination: Path) -> None:
    if destination.exists():
        if destination.is_dir():
            shutil.rmtree(destination)
        else:
            destination.unlink()
    destination.parent.mkdir(parents=True, exist_ok=True)


def copy_without_git(source: Path, destination: Path) -> None:
    shutil.copytree(source, destination, ignore=shutil.ignore_patterns(".git"))


def sync_repository(source: dict[str, Any], temporary_root: Path) -> None:
    checkout = temporary_root / source["id"]
    run(["git", "clone", "--quiet", "--filter=blob:none", source["url"], str(checkout)])
    run(["git", "checkout", "--quiet", "--detach", source["revision"]], cwd=checkout)

    destination = safe_download_path(source["destination"])
    files: list[str] = source["files"]
    reset_destination(destination)

    if files == ["."]:
        copy_without_git(checkout, destination)
        return

    if len(files) == 1:
        selected = checkout / files[0]
        if selected.is_dir() and destination.name == selected.name:
            copy_without_git(selected, destination)
            return

    destination.mkdir(parents=True, exist_ok=True)
    for relative in files:
        selected = checkout / relative
        if not selected.exists():
            raise FileNotFoundError(f"Missing selected upstream path: {source['id']}:{relative}")
        target = destination / selected.name
        if selected.is_dir():
            copy_without_git(selected, target)
        else:
            shutil.copy2(selected, target)


def sync_github_file(source: dict[str, Any]) -> None:
    require_tool("gh")
    destination = safe_download_path(source["destination"])
    reset_destination(destination)
    api_path = (
        f"repos/{source['repository']}/contents/"
        f"{quote(source['repoPath'], safe='/')}?ref={source['revision']}"
    )
    with destination.open("wb") as output:
        run(
            ["gh", "api", "-H", "Accept: application/vnd.github.raw+json", api_path],
            stdout=output,
        )


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def validate_locked_artifacts(manifest: dict[str, Any]) -> None:
    failures: list[str] = []
    for artifact in manifest["artifacts"]:
        path = REPO_ROOT / artifact["path"]
        if not path.is_file():
            failures.append(f"missing: {artifact['path']}")
            continue
        actual = sha256(path)
        if actual != artifact["sha256"]:
            failures.append(
                f"hash mismatch: {artifact['path']}\n"
                f"  expected {artifact['sha256']}\n  actual   {actual}"
            )
    if failures:
        raise RuntimeError("Pinned artifact verification failed:\n" + "\n".join(failures))


def write_checksums() -> None:
    entries: list[str] = []
    for path in sorted(DOWNLOAD_ROOT.rglob("*")):
        if path.is_file() and path.name != "CHECKSUMS.sha256":
            entries.append(f"{sha256(path)}  {path.relative_to(REPO_ROOT)}")
    (DOWNLOAD_ROOT / "CHECKSUMS.sha256").write_text("\n".join(entries) + "\n", encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", type=Path, default=DEFAULT_MANIFEST)
    args = parser.parse_args()

    require_tool("git")
    manifest = json.loads(args.manifest.read_text(encoding="utf-8"))
    if manifest.get("schemaVersion") != 1:
        raise ValueError("Unsupported source manifest schema")

    DOWNLOAD_ROOT.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="scripting-references-") as temporary:
        temporary_root = Path(temporary)
        for source in manifest["repositories"]:
            sync_repository(source, temporary_root)
        for source in manifest["githubFiles"]:
            sync_github_file(source)

    validate_locked_artifacts(manifest)
    write_checksums()
    print(f"Verified pinned downloads in {DOWNLOAD_ROOT.relative_to(REPO_ROOT)}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (OSError, subprocess.CalledProcessError, ValueError, RuntimeError) as error:
        print(f"error: {error}", file=sys.stderr)
        raise SystemExit(1)
