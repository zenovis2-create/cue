"""P1-4: exercise Orca worker-read cursor paging against an existing Dispatch.

Read-only: this script only invokes help/list/show/read commands.  Every command,
exit code, stdout, and stderr is copied verbatim to the ledger.
"""
from __future__ import annotations

import json
import pathlib
import subprocess


ROOT = pathlib.Path(__file__).resolve().parents[1]
LEDGER = ROOT / "evidence" / "P1" / "p1_4_ledger.log"
DEFAULT_DISPATCH = "ctx_462f43f3380e"  # completed, archived Codex transcript


def run(argv: list[str], ledger) -> tuple[int, str, str]:
    command = subprocess.list2cmdline(argv)
    ledger.write(f"\n=== COMMAND ===\n{command}\n")
    completed = subprocess.run(argv, cwd=ROOT, text=True, capture_output=True)
    ledger.write(f"=== EXIT CODE ===\n{completed.returncode}\n")
    ledger.write("=== STDOUT (verbatim) ===\n")
    ledger.write(completed.stdout)
    if completed.stdout and not completed.stdout.endswith("\n"):
        ledger.write("\n")
    ledger.write("=== STDERR (verbatim) ===\n")
    ledger.write(completed.stderr)
    if completed.stderr and not completed.stderr.endswith("\n"):
        ledger.write("\n")
    ledger.flush()
    return completed.returncode, completed.stdout, completed.stderr


def parse(stdout: str) -> dict:
    try:
        return json.loads(stdout)
    except json.JSONDecodeError:
        return {}


def main() -> int:
    LEDGER.parent.mkdir(parents=True, exist_ok=True)
    with LEDGER.open("w", encoding="utf-8", newline="") as ledger:
        run(["orca", "orchestration", "worker-read", "--help"], ledger)
        run(["orca", "orchestration", "worker-show", "--dispatch", DEFAULT_DISPATCH, "--json"], ledger)

        pages: list[dict] = []
        argv = ["orca", "orchestration", "worker-read", "--dispatch", DEFAULT_DISPATCH,
                "--limit", "2", "--json"]
        code, out, _ = run(argv, ledger)
        obj = parse(out)
        pages.append(obj)
        cursor = obj.get("result", {}).get("cursor")
        if code or not cursor:
            return 1

        # Required real cursor round trip #1.
        code, out, _ = run(["orca", "orchestration", "worker-read", "--dispatch",
                            DEFAULT_DISPATCH, "--cursor", cursor, "--limit", "2", "--json"], ledger)
        obj = parse(out)
        pages.append(obj)
        cursor = obj.get("result", {}).get("cursor")
        if code or not cursor:
            return 1

        # Exercise a pinned cursor against another requested source.  This does
        # not mutate the source; it probes the runtime's source-change response.
        run(["orca", "orchestration", "worker-read", "--dispatch", DEFAULT_DISPATCH,
             "--source", "terminal", "--cursor", cursor, "--limit", "2", "--json"], ledger)

        # Required round trip #2, then continue until the source is exhausted.
        for _ in range(200):
            code, out, _ = run(["orca", "orchestration", "worker-read", "--dispatch",
                                DEFAULT_DISPATCH, "--cursor", cursor, "--limit", "100", "--json"], ledger)
            obj = parse(out)
            pages.append(obj)
            result = obj.get("result", {})
            next_cursor = result.get("cursor")
            if code or not next_cursor:
                return 1
            cursor = next_cursor
            if result.get("transcript", {}).get("limited") is False or result.get("limited") is False:
                break
        else:
            ledger.write("\nPROBE ERROR: exhaustion not reached within 200 pages\n")
            return 2

        # Read once more from the exhaustion cursor to observe resume-at-end.
        run(["orca", "orchestration", "worker-read", "--dispatch", DEFAULT_DISPATCH,
             "--cursor", cursor, "--limit", "2", "--json"], ledger)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
