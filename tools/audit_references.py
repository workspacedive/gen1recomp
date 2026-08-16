#!/usr/bin/env python3
"""Audit pinned Scripting references, archives, governance, and metadata."""

from __future__ import annotations

import argparse
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path, PurePosixPath
import sys
import zipfile
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_MANIFEST = REPO_ROOT / "research" / "source-manifest.json"
REQUIRED_METADATA = ("name", "icon", "color", "version")


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def safe_zip_names(archive: zipfile.ZipFile) -> list[str]:
    unsafe: list[str] = []
    for name in archive.namelist():
        path = PurePosixPath(name)
        if path.is_absolute() or ".." in path.parts:
            unsafe.append(name)
    return unsafe


def parse_project_metadata(raw: bytes, label: str, result: dict[str, Any]) -> None:
    try:
        metadata = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        result["errors"].append(f"{label}: invalid script.json: {error}")
        return

    for field in REQUIRED_METADATA:
        if field not in metadata:
            result["errors"].append(f"{label}: script.json missing field '{field}'")
        elif metadata[field] in (None, ""):
            result["warnings"].append(f"{label}: script.json field '{field}' is empty")


def audit_scripting_archive(path: Path, result: dict[str, Any]) -> None:
    label = str(path.relative_to(REPO_ROOT))
    try:
        with zipfile.ZipFile(path) as archive:
            bad_member = archive.testzip()
            if bad_member:
                result["errors"].append(f"{label}: corrupt ZIP member {bad_member}")
            unsafe = safe_zip_names(archive)
            if unsafe:
                result["errors"].append(f"{label}: unsafe ZIP paths: {unsafe}")
            names = set(archive.namelist())
            for required in ("script.json", "index.tsx"):
                if required not in names:
                    result["errors"].append(f"{label}: missing {required}")
            if "script.json" in names:
                parse_project_metadata(archive.read("script.json"), label, result)
            result["metrics"][label] = {
                "entries": len(names),
                "typescriptFiles": sum(name.endswith((".ts", ".tsx")) for name in names),
            }
    except zipfile.BadZipFile as error:
        result["errors"].append(f"{label}: invalid .scripting ZIP: {error}")


def audit_documentation_archive(path: Path, result: dict[str, Any]) -> None:
    label = str(path.relative_to(REPO_ROOT))
    try:
        with zipfile.ZipFile(path) as archive:
            bad_member = archive.testzip()
            if bad_member:
                result["errors"].append(f"{label}: corrupt ZIP member {bad_member}")
            unsafe = safe_zip_names(archive)
            if unsafe:
                result["errors"].append(f"{label}: unsafe ZIP paths: {unsafe[:5]}")
            names = archive.namelist()
            result["metrics"][label] = {
                "entries": len(names),
                "typescriptFiles": sum(name.endswith((".ts", ".tsx")) for name in names),
                "markdownFiles": sum(name.endswith(".md") for name in names),
                "uncompressedBytes": sum(item.file_size for item in archive.infolist()),
            }
    except zipfile.BadZipFile as error:
        result["errors"].append(f"{label}: invalid documentation ZIP: {error}")


def audit_governance(result: dict[str, Any]) -> None:
    required_files = {
        "skills.md": ("# Scripting iOS Development Skill", "## 8. Verifikation"),
        "agent.md": ("# Agent Contract", "## Definition of Done"),
        "docs/ui-ux.md": ("# UI/UX-System", "## 11. Review-Checkliste"),
        "docs/research/scripting-app.md": ("# Tiefenrecherche", "## 7. Quellenlage"),
        "docs/research/example-audit.md": ("# Audit der heruntergeladenen", "## 9. Verbindliche Übernahmeregel"),
    }
    for relative, markers in required_files.items():
        path = REPO_ROOT / relative
        if not path.is_file():
            result["errors"].append(f"missing governance/research file: {relative}")
            continue
        text = path.read_text(encoding="utf-8")
        for marker in markers:
            if marker not in text:
                result["errors"].append(f"{relative}: missing section marker {marker!r}")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", type=Path, default=DEFAULT_MANIFEST)
    parser.add_argument("--report", type=Path, help="Write a JSON evidence report")
    parser.add_argument(
        "--allow-missing-downloads",
        action="store_true",
        help="Warn instead of fail when ignored raw downloads are absent",
    )
    args = parser.parse_args()

    result: dict[str, Any] = {
        "schemaVersion": 1,
        "checkedAt": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
        "status": "pending",
        "errors": [],
        "warnings": [],
        "metrics": {},
    }

    try:
        manifest = json.loads(args.manifest.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        print(f"error: cannot read manifest: {error}", file=sys.stderr)
        return 1

    if manifest.get("schemaVersion") != 1:
        result["errors"].append("unsupported source manifest schema")

    artifact_paths: list[Path] = []
    for artifact in manifest.get("artifacts", []):
        path = REPO_ROOT / artifact["path"]
        artifact_paths.append(path)
        if not path.is_file():
            message = f"missing downloaded artifact: {artifact['path']}"
            target = result["warnings"] if args.allow_missing_downloads else result["errors"]
            target.append(message)
            continue
        actual = sha256(path)
        if actual != artifact["sha256"]:
            result["errors"].append(
                f"{artifact['path']}: SHA-256 mismatch; expected {artifact['sha256']}, got {actual}"
            )

    for path in artifact_paths:
        if not path.is_file():
            continue
        if path.suffix == ".scripting":
            audit_scripting_archive(path, result)
        elif path.name == "Scripting Documentation.zip":
            audit_documentation_archive(path, result)

    official_project = REPO_ROOT / "references" / "official" / "video-to-live-photo"
    for required in ("script.json", "index.tsx", "specs/2026-07-28-video-to-live-photo.md"):
        if not (official_project / required).is_file():
            result["errors"].append(f"official project snapshot missing: {required}")
    if (official_project / "script.json").is_file():
        parse_project_metadata(
            (official_project / "script.json").read_bytes(),
            "references/official/video-to-live-photo",
            result,
        )

    audit_governance(result)
    result["status"] = "passed" if not result["errors"] else "failed"

    report_text = json.dumps(result, ensure_ascii=False, indent=2) + "\n"
    if args.report:
        report_path = args.report if args.report.is_absolute() else REPO_ROOT / args.report
        report_path.parent.mkdir(parents=True, exist_ok=True)
        report_path.write_text(report_text, encoding="utf-8")
    print(report_text, end="")
    return 0 if result["status"] == "passed" else 1


if __name__ == "__main__":
    raise SystemExit(main())
