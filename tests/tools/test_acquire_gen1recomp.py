from __future__ import annotations

import hashlib
import importlib.util
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest import mock


MODULE_PATH = Path(__file__).resolve().parents[2] / "tools" / "acquire_gen1recomp.py"
SPEC = importlib.util.spec_from_file_location("acquire_gen1recomp", MODULE_PATH)
assert SPEC is not None and SPEC.loader is not None
acquire = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(acquire)


def asset(name: str, body: bytes) -> dict[str, object]:
    return {
        "name": name,
        "size": len(body),
        "sha256": hashlib.sha256(body).hexdigest(),
        "githubAssetId": 123,
    }


class VerifyTests(unittest.TestCase):
    def test_validate_asset_rejects_path_escape_and_malformed_digest(self) -> None:
        escaping = asset("../outside", b"body")
        with self.assertRaisesRegex(RuntimeError, "safe basename"):
            acquire.validate_asset(escaping)

        malformed = asset("game.love", b"body")
        malformed["sha256"] = "not-a-digest"
        with self.assertRaisesRegex(RuntimeError, "invalid SHA-256"):
            acquire.validate_asset(malformed)

    def test_verify_accepts_exact_size_and_digest(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "game.love"
            body = b"locked artifact"
            path.write_bytes(body)
            acquire.verify(path, asset(path.name, body))
            self.assertTrue(path.is_file())

    def test_verify_deletes_mismatched_artifact(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "game.love"
            path.write_bytes(b"tampered")
            with self.assertRaisesRegex(RuntimeError, "verification failed"):
                acquire.verify(path, asset(path.name, b"expected"))
            self.assertFalse(path.exists())


class CloneTests(unittest.TestCase):
    def test_existing_git_worktree_fetches_instead_of_cloning(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            destination = Path(directory) / "worktree"
            destination.mkdir()
            (destination / ".git").write_text("gitdir: ../repo/.git/worktrees/release\n")
            with mock.patch.object(acquire, "run") as run:
                acquire.clone_at("https://example.invalid/repo.git", "abc123", destination)
            self.assertEqual(run.call_args_list[0].args[0], [
                "git", "fetch", "--quiet", "origin", "abc123",
            ])
            self.assertEqual(run.call_args_list[1].args[0], [
                "git", "checkout", "--quiet", "--detach", "abc123",
            ])


class AcquireAssetTests(unittest.TestCase):
    def test_valid_existing_asset_skips_network(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            destination = Path(directory) / "release" / "game.love"
            destination.parent.mkdir()
            body = b"already complete"
            destination.write_bytes(body)
            with mock.patch.object(acquire, "run") as run:
                acquire.acquire_asset("owner/repository", asset(destination.name, body), destination)
            run.assert_not_called()
            self.assertEqual(destination.read_bytes(), body)

    def test_download_is_verified_then_atomically_replaced(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            destination = Path(directory) / "release" / "game.love"
            body = b"download result"

            def fake_run(command: list[str], **kwargs: object) -> None:
                self.assertEqual(command[0:2], ["gh", "api"])
                stream = kwargs["stdout"]
                stream.write(body)  # type: ignore[union-attr]
                stream.flush()  # type: ignore[union-attr]

            with mock.patch.object(acquire, "run", side_effect=fake_run):
                acquire.acquire_asset("owner/repository", asset(destination.name, body), destination)

            self.assertEqual(destination.read_bytes(), body)
            self.assertEqual(list(destination.parent.glob("*.part")), [])

    def test_failed_transport_removes_partial_file(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            destination = Path(directory) / "release" / "game.love"

            def fail_run(_command: list[str], **kwargs: object) -> None:
                stream = kwargs["stdout"]
                stream.write(b"partial")  # type: ignore[union-attr]
                stream.flush()  # type: ignore[union-attr]
                raise subprocess.CalledProcessError(1, "gh")

            with mock.patch.object(acquire, "run", side_effect=fail_run):
                with self.assertRaises(subprocess.CalledProcessError):
                    acquire.acquire_asset(
                        "owner/repository",
                        asset(destination.name, b"complete"),
                        destination,
                    )

            self.assertFalse(destination.exists())
            self.assertEqual(list(destination.parent.glob("*.part")), [])


if __name__ == "__main__":
    unittest.main()
