"""P1-0 smoke: does `codex app-server` speak JSON-RPC over stdio?
Evidence-only. Writes raw request/response lines to evidence/P1/p1_0_initialize.log
"""
import json, subprocess, sys, threading, time, os, pathlib

EV = pathlib.Path(__file__).resolve().parents[1] / "evidence" / "P1"
EV.mkdir(parents=True, exist_ok=True)
LOG = EV / "p1_0_initialize.log"

CODEX = os.environ.get("CUE_CODEX_BIN") or (
    "C:/Users/User/AppData/Roaming/npm/node_modules/@openai/codex/"
    "node_modules/@openai/codex-win32-x64/vendor/x86_64-pc-windows-msvc/bin/codex.exe"
)

p = subprocess.Popen(
    [CODEX, "app-server"],
    stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
    text=True, bufsize=1,
)

lines = []
def reader(stream, tag):
    for ln in stream:
        lines.append(f"{tag} {ln.rstrip()}")

threading.Thread(target=reader, args=(p.stdout, "OUT"), daemon=True).start()
threading.Thread(target=reader, args=(p.stderr, "ERR"), daemon=True).start()

req = {
    "jsonrpc": "2.0", "id": 1, "method": "initialize",
    "params": {"clientInfo": {"name": "cue-probe", "title": "Cue P1 probe", "version": "0.0.1"}},
}
raw = json.dumps(req)
lines.append("IN  " + raw)
p.stdin.write(raw + "\n")
p.stdin.flush()
time.sleep(6)
p.terminate()
try:
    p.wait(timeout=5)
except Exception:
    p.kill()

LOG.write_text("\n".join(lines) + "\n", encoding="utf-8")
print(f"exit={p.returncode} lines={len(lines)} log={LOG}")
print("\n".join(lines[:40]))
