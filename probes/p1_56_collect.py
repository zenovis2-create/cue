"""Read-only evidence collector for P1-5 accounting and P1-6 Hermes surfaces."""
from __future__ import annotations

import os
import pathlib
import shutil
import subprocess
import tempfile


ROOT = pathlib.Path(__file__).resolve().parents[1]
EV = ROOT / "evidence" / "P1"
CODEX = pathlib.Path(
    "C:/Users/User/AppData/Roaming/npm/node_modules/@openai/codex/"
    "node_modules/@openai/codex-win32-x64/vendor/x86_64-pc-windows-msvc/bin/codex.exe"
)


def run(argv: list[str], ledger, *, env: dict[str, str] | None = None) -> int:
    ledger.write(f"\n=== COMMAND ===\n{subprocess.list2cmdline(argv)}\n")
    cp = subprocess.run(argv, cwd=ROOT, env=env, text=True, capture_output=True)
    ledger.write(f"=== EXIT CODE ===\n{cp.returncode}\n=== STDOUT (verbatim) ===\n")
    ledger.write(cp.stdout)
    if cp.stdout and not cp.stdout.endswith("\n"):
        ledger.write("\n")
    ledger.write("=== STDERR (verbatim) ===\n")
    ledger.write(cp.stderr)
    if cp.stderr and not cp.stderr.endswith("\n"):
        ledger.write("\n")
    ledger.flush()
    return cp.returncode


def accounting() -> None:
    with (EV / "p1_5_accounting.log").open("w", encoding="utf-8", newline="") as f:
        run(["rg", "-n", "-i", "usage|token|cost|price|billing|inputTokens|outputTokens",
             "evidence/P1/p1_1_ledger.log", "evidence/P1/p1_2_ledger.log"], f)
        run(["orca", "orchestration", "run-show", "--id", "run_6a3a832eebc9", "--json"], f)
        run(["orca", "orchestration", "task-list", "--run", "run_6a3a832eebc9", "--json"], f)
        run(["orca", "orchestration", "worker-show", "--dispatch", "ctx_462f43f3380e", "--json"], f)

        # Actual codex exec, isolated from hooks/MCP.  The disposable home and
        # cwd are removed by TemporaryDirectory after stdout/stderr are logged.
        source_home = pathlib.Path(os.environ["CODEX_HOME"])
        with tempfile.TemporaryDirectory(prefix="cue-p1-5-home-") as home_s, tempfile.TemporaryDirectory(prefix="cue-p1-5-cwd-") as cwd_s:
            home = pathlib.Path(home_s)
            shutil.copy2(source_home / "auth.json", home / "auth.json")
            (home / "config.toml").write_text("disable_response_storage = true\n", encoding="utf-8")
            env = os.environ.copy()
            env["CODEX_HOME"] = str(home)
            argv = [str(CODEX), "exec", "--json", "--skip-git-repo-check", "--cd", cwd_s,
                    "Reply with exactly: CUE-P1-5-OK"]
            run(argv, f, env=env)


def hermes() -> None:
    commands = [
        ["hermes", "--version"], ["hermes", "--help"],
        ["hermes", "webhook", "--help"], ["hermes", "webhook", "list"],
        ["hermes", "logs", "--help"], ["hermes", "logs", "list"],
        ["hermes", "logs", "agent", "-n", "5"],
        ["hermes", "serve", "--help"], ["hermes", "serve", "--status"],
        ["hermes", "gateway", "--help"], ["hermes", "gateway", "status"],
        ["hermes", "monitoring", "--help"], ["hermes", "monitoring", "status"],
        ["hermes", "mcp", "serve", "--help"], ["hermes", "acp", "--help"],
        ["hermes", "send", "--help"], ["hermes", "send", "--list"],
    ]
    with (EV / "p1_6_hermes_events.log").open("w", encoding="utf-8", newline="") as f:
        for argv in commands:
            run(argv, f)
        # Read-only source/config surface search; excludes credentials and venv.
        run(["rg", "-n", "-i", "websocket|json-rpc|jsonrpc|event stream|webhook|inject|interrupt|message",
             "--glob", "!venv/**", "--glob", "!.git/**", "E:/AppData/Hermes/hermes-agent/cli.py",
             "E:/AppData/Hermes/hermes-agent/hermes_cli", "E:/AppData/Hermes/hermes-agent/gateway",
             "E:/AppData/Hermes/hermes-agent/web"], f)
        run(["rg", "-n", "api/events|api/ws|api/pty|event subscriber|busy_input_mode|/steer|agent\\.steer|agent\\.interrupt",
             "--glob", "!venv/**", "--glob", "!.git/**", "--glob", "!web/node_modules/**",
             "E:/AppData/Hermes/hermes-agent/cli.py",
             "E:/AppData/Hermes/hermes-agent/cli-config.yaml.example",
             "E:/AppData/Hermes/hermes-agent/hermes_cli",
             "E:/AppData/Hermes/hermes-agent/web/src"], f)


if __name__ == "__main__":
    EV.mkdir(parents=True, exist_ok=True)
    accounting()
    hermes()
