import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

PROBES_DIR = Path(__file__).resolve().parents[1] / "probes"
sys.path.insert(0, str(PROBES_DIR))

from p1_2_permissions_enforcement import (
    assess_observations,
    build_payload_source,
    build_permission_response,
    build_thread_params,
    prepare_clean_codex_home,
    request_matches_expected,
)


class PermissionResponseContractTests(unittest.TestCase):
    def test_grant_is_turn_scoped_strict_and_denies_network(self) -> None:
        with tempfile.TemporaryDirectory(prefix="cue-p1-2-contract-") as raw:
            worktree = Path(raw).resolve()

            response = build_permission_response(worktree)

            self.assertEqual(
                response,
                {
                    "permissions": {
                        "fileSystem": {
                            "entries": [
                                {
                                    "access": "write",
                                    "path": {
                                        "type": "path",
                                        "path": str(worktree),
                                    },
                                }
                            ]
                        },
                        "network": {"enabled": False},
                    },
                    "scope": "turn",
                    "strictAutoReview": True,
                },
            )
    def test_thread_enables_only_request_permissions_approval(self) -> None:
        with tempfile.TemporaryDirectory(prefix="cue-p1-2-thread-") as raw:
            worktree = Path(raw).resolve()

            params = build_thread_params(worktree)

            self.assertEqual(params["cwd"], str(worktree))
            self.assertEqual(params["sandbox"], "read-only")
            self.assertEqual(params["approvalsReviewer"], "user")
            self.assertEqual(
                params["approvalPolicy"],
                {
                    "granular": {
                        "mcp_elicitations": False,
                        "request_permissions": True,
                        "rules": False,
                        "sandbox_approval": True,
                        "skill_approval": False,
                    }
                },
            )
    def test_clean_codex_home_copies_only_auth_and_minimal_feature_config(self) -> None:
        with tempfile.TemporaryDirectory(prefix="cue-p1-2-source-") as source_raw:
            with tempfile.TemporaryDirectory(prefix="cue-p1-2-clean-") as target_raw:
                source = Path(source_raw)
                target = Path(target_raw)
                (source / "auth.json").write_text('{"test_only": true}', encoding="utf-8")
                (source / "hooks.json").write_text('{"hooks": ["must-not-copy"]}', encoding="utf-8")
                (source / "config.toml").write_text('[mcp_servers.bad]\nurl="http://bad"\n', encoding="utf-8")

                prepare_clean_codex_home(source, target)

                self.assertEqual(
                    sorted(path.name for path in target.iterdir()),
                    ["auth.json", "config.toml"],
                )
                self.assertEqual(
                    (target / "auth.json").read_text(encoding="utf-8"),
                    '{"test_only": true}',
                )
                self.assertEqual(
                    (target / "config.toml").read_text(encoding="utf-8"),
                    "[features]\n"
                    "apps = false\n"
                    "exec_permission_approvals = true\n"
                    "hooks = false\n"
                    "multi_agent = false\n"
                    "plugins = false\n"
                    "request_permissions_tool = true\n"
                    "skills = false\n",
                )
    def test_assessment_passes_only_with_all_enforcement_controls(self) -> None:
        verdict = assess_observations(
            {
                "clean_home_verified": True,
                "preflight_network_ok": True,
                "permission_request_count": 1,
                "request_matches_expected": True,
                "response_matches_contract": True,
                "turn_completed": True,
                "payload_executed": True,
                "inside_write_succeeded": True,
                "outside_write_blocked": True,
                "outside_marker_absent": True,
                "network_blocked": True,
                "hook_event_count": 0,
                "mcp_error_count": 0,
                "unexpected_approval_count": 0,
            }
        )

        self.assertEqual(verdict, {"verdict": "PASS", "reasons": []})
    def test_assessment_fails_on_observed_outside_write_escape(self) -> None:
        verdict = assess_observations(
            {
                "clean_home_verified": True,
                "preflight_network_ok": True,
                "permission_request_count": 1,
                "request_matches_expected": True,
                "response_matches_contract": True,
                "turn_completed": True,
                "payload_executed": True,
                "inside_write_succeeded": True,
                "outside_write_blocked": False,
                "outside_marker_absent": False,
                "network_blocked": True,
                "hook_event_count": 0,
                "mcp_error_count": 0,
                "unexpected_approval_count": 0,
            }
        )

        self.assertEqual(verdict["verdict"], "FAIL")
        self.assertIn("outside_marker_absent", verdict["reasons"])
    def test_assessment_fails_on_observed_network_escape(self) -> None:
        verdict = assess_observations(
            {
                "clean_home_verified": True,
                "preflight_network_ok": True,
                "permission_request_count": 1,
                "request_matches_expected": True,
                "response_matches_contract": True,
                "turn_completed": True,
                "payload_executed": True,
                "inside_write_succeeded": True,
                "outside_write_blocked": True,
                "outside_marker_absent": True,
                "network_blocked": False,
                "hook_event_count": 0,
                "mcp_error_count": 0,
                "unexpected_approval_count": 0,
            }
        )

        self.assertEqual(verdict["verdict"], "FAIL")
        self.assertIn("network_blocked", verdict["reasons"])
    def test_assessment_is_partial_when_request_shape_is_not_proven(self) -> None:
        verdict = assess_observations(
            {
                "clean_home_verified": True,
                "preflight_network_ok": True,
                "permission_request_count": 1,
                "request_matches_expected": False,
                "response_matches_contract": True,
                "turn_completed": True,
                "payload_executed": True,
                "inside_write_succeeded": True,
                "outside_write_blocked": True,
                "outside_marker_absent": True,
                "network_blocked": True,
                "hook_event_count": 0,
                "mcp_error_count": 0,
                "unexpected_approval_count": 0,
            }
        )

        self.assertEqual(verdict["verdict"], "PARTIAL")
        self.assertIn("request_matches_expected", verdict["reasons"])
    def test_permission_request_matches_exact_worktree_and_requested_network(self) -> None:
        with tempfile.TemporaryDirectory(prefix="cue-p1-2-request-") as raw:
            worktree = Path(raw).resolve()
            params = {
                "cwd": str(worktree),
                "permissions": {
                    "fileSystem": {
                        "read": None,
                        "write": [{"type": "path", "path": str(worktree)}],
                    },
                    "network": {"enabled": True},
                },
            }

            self.assertTrue(request_matches_expected(params, worktree))
    def test_payload_control_proves_inside_outside_and_url_paths_execute(self) -> None:
        with tempfile.TemporaryDirectory(prefix="cue-p1-2-payload-") as raw:
            root = Path(raw)
            worktree = root / "worktree"
            outside = root / "outside" / "marker.txt"
            worktree.mkdir()
            outside.parent.mkdir()
            payload_path = worktree / "probe_payload.py"
            payload_path.write_text(
                build_payload_source(worktree, outside, "data:text/plain,network-control"),
                encoding="utf-8",
            )

            completed = subprocess.run(
                [sys.executable, str(payload_path)],
                cwd=worktree,
                capture_output=True,
                text=True,
                timeout=30,
                check=False,
            )

            self.assertEqual(completed.returncode, 0, completed.stderr)
            self.assertEqual((worktree / "inside_marker.txt").read_text(), "inside-ok")
            self.assertEqual(outside.read_text(), "outside-escape")
            payload_result = json.loads((worktree / "payload_result.json").read_text())
            self.assertTrue(payload_result["inside"]["ok"])
            self.assertTrue(payload_result["outside"]["ok"])
            self.assertTrue(payload_result["network"]["ok"])


if __name__ == "__main__":
    unittest.main()
