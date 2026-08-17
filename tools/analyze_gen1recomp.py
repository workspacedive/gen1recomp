#!/usr/bin/env python3
"""Produce reproducible static forensics for an upstream Gen1Recomp checkout.

The analyzer reads source and optional ZIP-compatible .love/APK artifacts. It
never executes ROM content and never copies upstream sources into this repo.
"""

from __future__ import annotations

import argparse
from collections import Counter, defaultdict
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path, PurePosixPath
import re
import subprocess
import sys
from typing import Any, Iterable
import zipfile

TEXT_EXTENSIONS = {
    ".lua", ".c", ".cc", ".cpp", ".h", ".hpp", ".m", ".mm", ".swift",
    ".java", ".kt", ".py", ".sh", ".js", ".ts", ".tsx", ".md", ".json",
    ".xml", ".gradle", ".properties", ".yml", ".yaml",
}
CODE_EXTENSIONS = {
    ".lua", ".c", ".cc", ".cpp", ".h", ".hpp", ".m", ".mm", ".swift",
    ".java", ".kt", ".py", ".sh", ".js", ".ts", ".tsx",
}
VENDORED_PREFIXES = (
    "mobile/android/love/",
    "mobile/android/gradle/",
    "ports/uwp/third_party/",
)
REQUIRE_RE = re.compile(r"require\s*\(?\s*['\"]([^'\"]+)['\"]")
LOVE_RE = re.compile(r"\blove\.([A-Za-z_][A-Za-z0-9_]*)")
FFI_RE = re.compile(r"require\s*\(?\s*['\"]ffi['\"]|\bffi\.")
JIT_RE = re.compile(r"require\s*\(?\s*['\"]jit|\bjit\.")
LUA51_RE = re.compile(r"\b(setfenv|getfenv|loadstring|unpack)\b|package\.loaders|\bbit\.")
ROM_EXTENSIONS = {".gb", ".gbc", ".gba", ".rom", ".ips", ".bps", ".ups"}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def git_value(source: Path, *args: str) -> str | None:
    try:
        return subprocess.check_output(
            ["git", "-C", str(source), *args], text=True, stderr=subprocess.DEVNULL
        ).strip()
    except (OSError, subprocess.CalledProcessError):
        return None


def source_files(source: Path) -> Iterable[Path]:
    """Yield tracked source files when Git metadata exists, else all files.

    Using `git ls-files` keeps local build products (for example a compiled
    vendored LuaJIT) from changing the forensic inventory.
    """
    try:
        tracked = subprocess.check_output(
            ["git", "-C", str(source), "ls-files", "-z"],
            stderr=subprocess.DEVNULL,
        )
        for raw in tracked.split(b"\0"):
            if not raw:
                continue
            path = source / raw.decode("utf-8", errors="surrogateescape")
            if path.is_file():
                yield path
        return
    except (OSError, subprocess.CalledProcessError):
        pass

    for path in source.rglob("*"):
        if not path.is_file() or ".git" in path.parts:
            continue
        yield path


def read_text(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8")
    except (UnicodeDecodeError, OSError):
        return path.read_text(encoding="utf-8", errors="ignore")


def relative(source: Path, path: Path) -> str:
    return path.relative_to(source).as_posix()


def is_vendored(rel: str) -> bool:
    return rel.startswith(VENDORED_PREFIXES)


def line_count(path: Path) -> int:
    with path.open("rb") as stream:
        return sum(1 for _ in stream)


def parse_lua_components(source: Path) -> dict[str, Any]:
    source_root = source / "src"
    component_stats: dict[str, dict[str, int]] = defaultdict(
        lambda: {"files": 0, "lines": 0, "loveReferences": 0, "loveFiles": 0}
    )
    edges: Counter[tuple[str, str]] = Counter()
    edge_files: dict[tuple[str, str], set[str]] = defaultdict(set)
    love_modules: Counter[str] = Counter()
    ffi_files: set[str] = set()
    jit_files: set[str] = set()
    lua51_files: set[str] = set()
    non_src_requires: Counter[str] = Counter()

    lua_paths = [source / "main.lua"] if (source / "main.lua").is_file() else []
    lua_paths += sorted(source_root.rglob("*.lua")) if source_root.is_dir() else []
    for path in lua_paths:
        rel = relative(source, path)
        component = "entry" if path == source / "main.lua" else path.relative_to(source_root).parts[0]
        text = read_text(path)
        stats = component_stats[component]
        stats["files"] += 1
        stats["lines"] += text.count("\n") + (0 if text.endswith("\n") or not text else 1)
        love_hits = LOVE_RE.findall(text)
        stats["loveReferences"] += len(love_hits)
        if love_hits:
            stats["loveFiles"] += 1
            love_modules.update(love_hits)
        if FFI_RE.search(text):
            ffi_files.add(rel)
        if JIT_RE.search(text):
            jit_files.add(rel)
        if LUA51_RE.search(text):
            lua51_files.add(rel)

        for module in REQUIRE_RE.findall(text):
            if module.startswith("src."):
                parts = module.split(".")
                target = parts[1] if len(parts) > 1 else "src"
                if target != component:
                    edges[(component, target)] += 1
                    edge_files[(component, target)].add(rel)
            else:
                non_src_requires[module] += 1

    edge_rows = [
        {
            "from": start,
            "to": end,
            "requires": count,
            "files": len(edge_files[(start, end)]),
        }
        for (start, end), count in sorted(
            edges.items(), key=lambda item: (-item[1], item[0][0], item[0][1])
        )
    ]
    return {
        "components": dict(sorted(component_stats.items())),
        "crossComponentRequireEdges": edge_rows,
        "loveModules": dict(love_modules.most_common()),
        "ffiFiles": sorted(ffi_files),
        "jitFiles": sorted(jit_files),
        "lua51SpecificFiles": sorted(lua51_files),
        "nonSrcRequires": dict(non_src_requires.most_common()),
    }


def parse_versions(source: Path) -> dict[str, Any]:
    values: dict[str, Any] = {}
    version_file = source / "src" / "core" / "Version.lua"
    if version_file.is_file():
        text = read_text(version_file)
        for key in ("engine", "shell", "payloadHost", "minShell", "modApi", "linkProtocol", "saveFormat", "cache"):
            match = re.search(rf"\b{key}\s*=\s*(?:['\"]([^'\"]+)['\"]|([0-9]+))", text)
            if match:
                values[key] = match.group(1) if match.group(1) is not None else int(match.group(2))
    conf = source / "conf.lua"
    if conf.is_file():
        text = read_text(conf)
        values["loveConfig"] = {
            "ios": (re.search(r'love\._os\s*==\s*["\']iOS["\']\s+and\s+["\']([^"\']+)', text) or [None, None])[1],
            "other": (re.search(r'and\s+["\'][^"\']+["\']\s+or\s+["\']([^"\']+)["\']', text) or [None, None])[1],
        }
    ios_version = source / "mobile" / "ios" / "LOVE_VERSION"
    if ios_version.is_file():
        values["iosLoveVersionFile"] = read_text(ios_version).strip()
    gradle = source / "mobile" / "android" / "gradle.properties"
    if gradle.is_file():
        props: dict[str, str] = {}
        for line in read_text(gradle).splitlines():
            if "=" in line and not line.lstrip().startswith("#"):
                key, value = line.split("=", 1)
                props[key.strip()] = value.strip()
        values["androidGradle"] = {
            key: props.get(key)
            for key in ("app.application_id", "app.version_name", "app.version_code", "app.orientation")
        }
    return values


def analyze_archive(path: Path) -> dict[str, Any]:
    result: dict[str, Any] = {
        "path": str(path),
        "size": path.stat().st_size,
        "sha256": sha256(path),
    }
    if path.stat().st_size == 0:
        result["error"] = "empty artifact"
        return result
    try:
        with zipfile.ZipFile(path) as archive:
            bad = archive.testzip()
            infos = [info for info in archive.infolist() if not info.is_dir()]
            unsafe = [
                info.filename
                for info in infos
                if PurePosixPath(info.filename).is_absolute() or ".." in PurePosixPath(info.filename).parts
            ]
            extensions = Counter(
                PurePosixPath(info.filename).suffix.lower() or "[none]" for info in infos
            )
            top_levels = Counter(PurePosixPath(info.filename).parts[0] for info in infos)
            rom_like = [
                info.filename
                for info in infos
                if PurePosixPath(info.filename).suffix.lower() in ROM_EXTENSIONS
                or "generated" in PurePosixPath(info.filename).parts
                or "baseroms" in PurePosixPath(info.filename).parts
            ]
            abis = sorted(
                {
                    PurePosixPath(info.filename).parts[1]
                    for info in infos
                    if len(PurePosixPath(info.filename).parts) >= 3
                    and PurePosixPath(info.filename).parts[0] == "lib"
                    and info.filename.endswith(".so")
                }
            )
            result.update(
                {
                    "zipIntegrity": "passed" if bad is None else f"failed:{bad}",
                    "unsafePaths": unsafe,
                    "entries": len(infos),
                    "compressedBytes": sum(info.compress_size for info in infos),
                    "uncompressedBytes": sum(info.file_size for info in infos),
                    "extensions": dict(extensions.most_common()),
                    "topLevels": dict(top_levels.most_common()),
                    "romCacheLikeEntries": rom_like,
                    "nativeAbis": abis,
                }
            )
    except zipfile.BadZipFile as error:
        result["error"] = f"not a ZIP-compatible artifact: {error}"
    return result


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", required=True, type=Path)
    parser.add_argument("--artifact", action="append", default=[], type=Path)
    parser.add_argument("--out", type=Path)
    args = parser.parse_args()

    source = args.source.resolve()
    if not (source / "src" / "core" / "Version.lua").is_file():
        parser.error("--source is not a Gen1Recomp checkout")

    extensions: Counter[str] = Counter()
    code_lines: Counter[str] = Counter()
    project_files = 0
    project_bytes = 0
    total_files = 0
    total_bytes = 0
    largest: list[tuple[int, str]] = []
    tests: Counter[str] = Counter()

    for path in source_files(source):
        rel = relative(source, path)
        size = path.stat().st_size
        total_files += 1
        total_bytes += size
        extensions[path.suffix.lower() or "[none]"] += 1
        if not is_vendored(rel):
            project_files += 1
            project_bytes += size
            largest.append((size, rel))
        if path.suffix.lower() in CODE_EXTENSIONS:
            code_lines[path.suffix.lower()] += line_count(path)
        if rel.startswith("tests/"):
            parts = PurePosixPath(rel).parts
            tests[parts[1] if len(parts) > 2 else "root"] += 1

    report: dict[str, Any] = {
        "schemaVersion": 1,
        "analyzedAt": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
        "source": {
            "path": args.source.as_posix(),
            "revision": git_value(source, "rev-parse", "HEAD"),
            "commitDate": git_value(source, "show", "-s", "--format=%cI", "HEAD"),
            "license": "MIT",
        },
        "inventory": {
            "totalFilesIncludingVendored": total_files,
            "totalBytesIncludingVendored": total_bytes,
            "projectFilesExcludingMajorVendoredTrees": project_files,
            "projectBytesExcludingMajorVendoredTrees": project_bytes,
            "extensions": dict(extensions.most_common()),
            "codeLines": dict(sorted(code_lines.items(), key=lambda item: -item[1])),
            "largestProjectFiles": [
                {"path": rel, "bytes": size} for size, rel in sorted(largest, reverse=True)[:30]
            ],
        },
        "versions": parse_versions(source),
        "luaArchitecture": parse_lua_components(source),
        "tests": {
            "files": sum(tests.values()),
            "groups": dict(tests.most_common()),
        },
        "artifacts": [analyze_archive(path) for path in args.artifact],
    }

    output = json.dumps(report, ensure_ascii=False, indent=2) + "\n"
    if args.out:
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_text(output, encoding="utf-8")
    else:
        print(output, end="")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
