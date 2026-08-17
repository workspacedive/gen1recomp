#!/usr/bin/env python3
"""Inventory Gen1Recomp's lexical Lua/LÖVE web-runtime compatibility surface.

This is a static occurrence audit, not a Lua parser and not runtime evidence. It
intentionally reports call sites for probe planning without claiming support.
"""

from __future__ import annotations

import argparse
from collections import Counter, defaultdict
from datetime import datetime, timezone
import json
from pathlib import Path
import re
import subprocess
from typing import Iterable

LOVE_MEMBER = re.compile(r"\blove\.([A-Za-z_]\w*)\.([A-Za-z_]\w*)\b")
LOVE_CALL = re.compile(r"\blove\.([A-Za-z_]\w*)\.([A-Za-z_]\w*)\s*\(")
LOVE_DIRECT_CALL = re.compile(r"\blove\.([A-Za-z_]\w*)\s*\(")
LOVE_CALLBACK = re.compile(r"\bfunction\s+love\.([A-Za-z_]\w*)\s*\(")
REQUIRE_CALL = re.compile(r"\brequire\s*\(?\s*[\"']([^\"']+)[\"']\s*\)?")
PCALL_REQUIRE = re.compile(r"\bpcall\s*\(\s*require\s*,\s*[\"']([^\"']+)[\"']")
LUA51_SYMBOL = re.compile(r"\b(setfenv|getfenv|loadstring|unpack)\s*\(")
DYNAMIC_LOVE = re.compile(r"\blove\s*\[")


def lua_files(source: Path) -> Iterable[Path]:
    roots = [source / "src", source / "main.lua", source / "conf.lua"]
    for root in roots:
        if root.is_file():
            yield root
        elif root.is_dir():
            yield from sorted(root.rglob("*.lua"))


def relative(source: Path, path: Path) -> str:
    return path.relative_to(source).as_posix()


def git_revision(source: Path) -> str | None:
    result = subprocess.run(
        ["git", "rev-parse", "HEAD"],
        cwd=source,
        capture_output=True,
        text=True,
        check=False,
    )
    return result.stdout.strip() if result.returncode == 0 else None


def analyze(source: Path) -> dict[str, object]:
    member_counts: Counter[str] = Counter()
    member_sites: dict[str, set[str]] = defaultdict(set)
    api_counts: Counter[str] = Counter()
    api_sites: dict[str, set[str]] = defaultdict(set)
    callbacks: Counter[str] = Counter()
    callback_sites: dict[str, set[str]] = defaultdict(set)
    requires: Counter[str] = Counter()
    require_sites: dict[str, set[str]] = defaultdict(set)
    guarded_requires: Counter[str] = Counter()
    guarded_require_sites: dict[str, set[str]] = defaultdict(set)
    lua51: Counter[str] = Counter()
    lua51_sites: dict[str, set[str]] = defaultdict(set)
    dynamic_love_files: list[str] = []
    file_count = 0

    for path in lua_files(source):
        file_count += 1
        rel = relative(source, path)
        text = path.read_text(encoding="utf-8", errors="replace")
        callback_names = LOVE_CALLBACK.findall(text)
        call_text = LOVE_CALLBACK.sub("function __love_callback(", text)
        for module, function in LOVE_MEMBER.findall(text):
            key = f"love.{module}.{function}"
            member_counts[key] += 1
            member_sites[key].add(rel)
        for module, function in LOVE_CALL.findall(call_text):
            key = f"love.{module}.{function}"
            api_counts[key] += 1
            api_sites[key].add(rel)
        for function in LOVE_DIRECT_CALL.findall(call_text):
            key = f"love.{function}"
            api_counts[key] += 1
            api_sites[key].add(rel)
        for callback in callback_names:
            callbacks[callback] += 1
            callback_sites[callback].add(rel)
        for required in REQUIRE_CALL.findall(text):
            requires[required] += 1
            require_sites[required].add(rel)
        for required in PCALL_REQUIRE.findall(text):
            guarded_requires[required] += 1
            guarded_require_sites[required].add(rel)
        for symbol in LUA51_SYMBOL.findall(text):
            lua51[symbol] += 1
            lua51_sites[symbol].add(rel)
        if DYNAMIC_LOVE.search(text):
            dynamic_love_files.append(rel)

    high_risk_prefixes = (
        "love.thread.",
        "love.audio.",
        "love.sound.",
        "love.joystick.",
        "love.touch.",
        "love.graphics.newShader",
        "love.graphics.newCanvas",
        "love.filesystem.mount",
        "love.filesystem.unmount",
        "love.system.openURL",
    )
    probe_priority = {
        key: {
            "occurrences": member_counts[key],
            "files": sorted(member_sites[key]),
            "reason": "web/runtime behavior requires execution evidence",
        }
        for key in sorted(member_counts)
        if key.startswith(high_risk_prefixes)
    }

    return {
        "schemaVersion": 1,
        "analyzedAt": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
        "source": {
            "path": source.as_posix(),
            "revision": git_revision(source),
        },
        "scope": {
            "luaFiles": file_count,
            "roots": ["main.lua", "conf.lua", "src/**/*.lua"],
            "method": "lexical occurrence scan; comments/strings may contribute false positives",
        },
        "loveMemberReferences": {
            key: {
                "occurrences": count,
                "files": len(member_sites[key]),
                "paths": sorted(member_sites[key]),
            }
            for key, count in sorted(member_counts.items())
        },
        "loveCalls": {
            key: {
                "occurrences": count,
                "files": len(api_sites[key]),
                "paths": sorted(api_sites[key]),
            }
            for key, count in sorted(api_counts.items())
        },
        "callbacks": {
            key: {
                "occurrences": count,
                "files": len(callback_sites[key]),
                "paths": sorted(callback_sites[key]),
            }
            for key, count in sorted(callbacks.items())
        },
        "requires": {
            key: {
                "occurrences": count,
                "files": len(require_sites[key]),
                "paths": sorted(require_sites[key]),
            }
            for key, count in sorted(requires.items())
        },
        "guardedRequires": {
            key: {
                "occurrences": count,
                "files": len(guarded_require_sites[key]),
                "paths": sorted(guarded_require_sites[key]),
            }
            for key, count in sorted(guarded_requires.items())
        },
        "lua51Symbols": {
            key: {
                "occurrences": count,
                "files": len(lua51_sites[key]),
                "paths": sorted(lua51_sites[key]),
            }
            for key, count in sorted(lua51.items())
        },
        "dynamicLoveIndexFiles": sorted(dynamic_love_files),
        "probePriority": probe_priority,
        "totals": {
            "distinctLoveMembers": len(member_counts),
            "loveMemberReferences": sum(member_counts.values()),
            "distinctLoveCalls": len(api_counts),
            "loveCallOccurrences": sum(api_counts.values()),
            "distinctCallbacks": len(callbacks),
            "distinctRequires": len(requires),
            "distinctGuardedRequires": len(guarded_requires),
            "priorityMembers": len(probe_priority),
        },
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", required=True, type=Path)
    parser.add_argument("--out", type=Path)
    args = parser.parse_args()
    source = args.source.resolve()
    if not (source / "src").is_dir() or not (source / "main.lua").is_file():
        parser.error("--source is not a Gen1Recomp source tree")
    report = analyze(source)
    output = json.dumps(report, indent=2, sort_keys=False) + "\n"
    if args.out is None:
        print(output, end="")
    else:
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_text(output, encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
