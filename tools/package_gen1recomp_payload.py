#!/usr/bin/env python3
"""Create a deterministic ROM-free Gen1Recomp .love payload from pinned source."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path, PurePosixPath
import re
import subprocess
import zipfile

REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SOURCE = REPO_ROOT / "research" / "downloads" / "gen1recomp" / "source-v0.1.96"
DEFAULT_OUTPUT = (
    REPO_ROOT
    / "research"
    / "downloads"
    / "gen1recomp"
    / "deterministic-v0.1.96"
    / "game.love"
)
FIXED_TIMESTAMP = (1980, 1, 1, 0, 0, 0)
ROOT_FILES = ("main.lua", "conf.lua")
ROOT_TREES = ("src", "data", "assets", "tools/save-editor")
MANIFESTS = (
    "tools/rom_manifest.json",
    "tools/rom_manifest_blue.json",
    "tools/rom_manifest_yellow.json",
    "tools/rom_manifest_gold.json",
)
REQUIRED = (
    "main.lua",
    "conf.lua",
    "src/core/Version.lua",
    "src/ui/kit/Kit.lua",
    "tools/save-editor/App.lua",
    "tools/rom_manifest_yellow.json",
    "tools/rom_manifest_gold.json",
)
VERSION_PATTERN = re.compile(rb'(\bengine\s*=\s*")[^"]*(")')


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def revision(source: Path) -> str:
    result = subprocess.run(
        ["git", "rev-parse", "HEAD"],
        cwd=source,
        check=True,
        capture_output=True,
        text=True,
    )
    return result.stdout.strip()


def include(relative: PurePosixPath) -> bool:
    text = relative.as_posix()
    if relative.name == ".DS_Store" or ".git" in relative.parts:
        return False
    if text.startswith("data/generated/") or text.startswith("assets/generated/"):
        return False
    return True


def payload_files(source: Path) -> list[tuple[str, Path]]:
    output: dict[str, Path] = {}
    for name in ROOT_FILES + MANIFESTS:
        path = source / name
        if not path.is_file():
            raise RuntimeError(f"required payload source is missing: {name}")
        output[name] = path
    for tree in ROOT_TREES:
        root = source / tree
        if not root.is_dir():
            raise RuntimeError(f"required payload tree is missing: {tree}")
        for path in root.rglob("*"):
            if not path.is_file():
                continue
            relative = PurePosixPath(path.relative_to(source).as_posix())
            if include(relative):
                output[relative.as_posix()] = path
    return sorted(output.items())


def stamped_data(relative: str, path: Path, version: str) -> bytes:
    data = path.read_bytes()
    if relative != "src/core/Version.lua":
        return data
    replacement = rb'\g<1>' + version.encode("ascii") + rb'\g<2>'
    stamped, count = VERSION_PATTERN.subn(replacement, data, count=1)
    if count != 1:
        raise RuntimeError("could not stamp src/core/Version.lua")
    return stamped


def package(source: Path, output: Path, version: str) -> dict[str, object]:
    if re.fullmatch(r"\d+\.\d+\.\d+", version) is None:
        raise RuntimeError("version must be X.Y.Z")
    files = payload_files(source)
    output.parent.mkdir(parents=True, exist_ok=True)
    temporary = output.with_name(output.name + ".part")
    temporary.unlink(missing_ok=True)
    try:
        with zipfile.ZipFile(
            temporary,
            "w",
            compression=zipfile.ZIP_DEFLATED,
            compresslevel=9,
        ) as archive:
            for relative, path in files:
                info = zipfile.ZipInfo(relative, FIXED_TIMESTAMP)
                info.compress_type = zipfile.ZIP_DEFLATED
                info.external_attr = 0o100644 << 16
                archive.writestr(info, stamped_data(relative, path, version))
        with zipfile.ZipFile(temporary) as archive:
            if archive.testzip() is not None:
                raise RuntimeError("deterministic payload failed ZIP integrity")
            names = archive.namelist()
            missing = sorted(set(REQUIRED) - set(names))
            if missing:
                raise RuntimeError(f"deterministic payload is missing: {missing}")
            generated = [
                name for name in names
                if name.startswith(("data/generated/", "assets/generated/"))
            ]
            if generated:
                raise RuntimeError("deterministic payload contains generated ROM data")
            version_text = archive.read("src/core/Version.lua")
            if f'engine = "{version}"'.encode() not in version_text:
                raise RuntimeError("deterministic payload version stamp failed")
            uncompressed = sum(info.file_size for info in archive.infolist())
        temporary.replace(output)
    except Exception:
        temporary.unlink(missing_ok=True)
        raise
    return {
        "schemaVersion": 1,
        "sourceRevision": revision(source),
        "version": version,
        "path": output.as_posix(),
        "size": output.stat().st_size,
        "sha256": sha256(output),
        "fileEntries": len(files),
        "uncompressedBytes": uncompressed,
        "timestampPolicy": "every ZIP entry is 1980-01-01T00:00:00",
        "romOrCacheEntries": [],
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--version", default="0.1.96")
    parser.add_argument("--report", type=Path)
    args = parser.parse_args()
    report = package(
        args.source.resolve(),
        args.output.resolve(),
        args.version,
    )
    text = json.dumps(report, indent=2, sort_keys=True) + "\n"
    if args.report:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(text, encoding="utf-8")
    print(text, end="")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
