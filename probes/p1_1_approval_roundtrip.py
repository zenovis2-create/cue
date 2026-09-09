"""P1-1 — Codex app-server approval real round-trip.

Goal (checklist P1-1): in a disposable worktree, start app-server, actually receive
`item/commandExecution/requestApproval`, send one `accept` and one `decline`,
and record the raw request JSON, our raw response JSON, and the worker's
subsequent behaviour.

Evidence: evidence/P1/p1_1_ledger.log (every line in/out) + p1_1_result.json
"""
from __future__ import annotations

import json
import pathlib
import shutil
import subprocess
import sys
import tempfile
import time

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from appserver import AppServer  # noqa: E402

ROOT = pathlib.Path(__file__).resolve().parents[1]
EV = ROOT / "evidence" / "P1"
EV.mkdir(parents=True, exist_ok=True)

WT = pathlib.Path(tempfile.mkdtemp(prefix="cue-p1-1-"))
(WT / "README.md").write_text("cue disposable probe worktree\n", encoding="utf-8")
subprocess.run(["git", "init", "-q"], cwd=WT, check=False)

srv = AppServer(str(EV / "p1_1_ledger.log"))
record = {
    "worktree": str(WT),
    "approval_requests": [],
    "responses_sent": [],
    "decisions": [],
    "notes": [],
}

rid = srv.request("initialize", {"clientInfo": {"name": "cue-probe", "title": "Cue P1-1", "version": "0.0.1"}})
init = srv.wait_result(rid, 30)
record["initialize"] = init
srv.send({"jsonrpc": "2.0", "method": "initialized", "params": {}})

rid = srv.request("thread/start", {
    "cwd": str(WT),
    # untrusted => every command execution must be approved by us
    "approvalPolicy": "untrusted",
    "approvalsReviewer": "user",
})
th = srv.wait_result(rid, 60)
record["thread_start"] = th
thread_id = (th or {}).get("result", {}).get("threadId") or (th or {}).get("result", {}).get("thread", {}).get("id")
record["threadId"] = thread_id
if not thread_id:
    record["notes"].append("no threadId; aborting")
    (EV / "p1_1_result.json").write_text(json.dumps(record, indent=2, ensure_ascii=False), encoding="utf-8")
    srv.close()
    print(json.dumps({"fatal": "no threadId", "thread_start": th}, indent=2)[:2000])
    raise SystemExit(1)

PROMPT = (
    "Run exactly two shell commands, one after the other, and nothing else.\n"
    "1) `echo cue-probe-first`\n"
    "2) `echo cue-probe-second`\n"
    "Do not read or write any files. After both attempts, reply with one line stating "
    "for each command whether it ran or was rejected."
)
rid_turn = srv.request("turn/start", {
    "threadId": thread_id,
    "input": [{"type": "text", "text": PROMPT}],
})

seen = 0
done = {"v": False}


def on_msg(msg):
    global seen
    method = msg.get("method")
    if method and "requestApproval" in str(method):
        record["approval_requests"].append(msg)
        seen += 1
        decision = "accept" if seen == 1 else "decline"
        resp = {"decision": decision}
        srv.respond(msg.get("id"), resp)
        record["responses_sent"].append({"id": msg.get("id"), "method": method, "response": resp})
        record["decisions"].append({"seq": seen, "decision": decision})
        return None
    if msg.get("id") == rid_turn and ("result" in msg or "error" in msg):
        record["turn_ack"] = msg
        return None
    if method == "turn/completed":
        record["turn_completed"] = msg
        done["v"] = True
        return "stop"
    if method in ("item/completed", "item/started", "turn/started", "error"):
        record.setdefault("items", []).append(msg)
    return None


status = srv.pump(240, on_msg)
record["pump_status"] = status
time.sleep(2)
srv.close()

(EV / "p1_1_result.json").write_text(json.dumps(record, indent=2, ensure_ascii=False), encoding="utf-8")

print("worktree:", WT)
print("approval requests seen:", len(record["approval_requests"]))
print("decisions:", record["decisions"])
print("pump:", status)
for a in record["approval_requests"]:
    print("REQ", a.get("method"), json.dumps(a.get("params"), ensure_ascii=False)[:400])
print("turn_completed:", json.dumps(record.get("turn_completed"), ensure_ascii=False)[:1500])
print("items:", len(record.get("items", [])))
for it in record.get("items", []):
    print(" ", it.get("method"), json.dumps(it.get("params"), ensure_ascii=False)[:300])
shutil.rmtree(WT, ignore_errors=True)
