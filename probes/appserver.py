"""Minimal, evidence-first JSON-RPC client for `codex app-server` (stdio).

Design constraints from CUE_V01_DESIGN:
  - the adapter carries RAW text only; every decision is made by the caller
  - every line in and out is appended to a ledger file verbatim
"""
from __future__ import annotations

import json
import os
import pathlib
import queue
import subprocess
import threading
import time

DEFAULT_CODEX = (
    "C:/Users/User/AppData/Roaming/npm/node_modules/@openai/codex/"
    "node_modules/@openai/codex-win32-x64/vendor/x86_64-pc-windows-msvc/bin/codex.exe"
)


class AppServer:
    def __init__(self, ledger_path: str, codex_bin: str | None = None, env: dict | None = None):
        self.ledger = pathlib.Path(ledger_path)
        self.ledger.parent.mkdir(parents=True, exist_ok=True)
        self._lf = self.ledger.open("w", encoding="utf-8")
        self.bin = codex_bin or os.environ.get("CUE_CODEX_BIN") or DEFAULT_CODEX
        self.q: "queue.Queue[dict]" = queue.Queue()
        self._id = 0
        self.proc = subprocess.Popen(
            [self.bin, "app-server"],
            stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
            text=True, bufsize=1, env=env,
        )
        threading.Thread(target=self._read_out, daemon=True).start()
        threading.Thread(target=self._read_err, daemon=True).start()

    # ---------- ledger ----------
    def _log(self, tag: str, text: str) -> None:
        self._lf.write(f"{time.time():.3f} {tag} {text}\n")
        self._lf.flush()

    def _read_out(self) -> None:
        for ln in self.proc.stdout:
            ln = ln.rstrip("\r\n")
            if not ln:
                continue
            self._log("OUT", ln)
            try:
                self.q.put(json.loads(ln))
            except json.JSONDecodeError:
                self._log("OUT_UNPARSED", ln)

    def _read_err(self) -> None:
        for ln in self.proc.stderr:
            self._log("ERR", ln.rstrip("\r\n"))

    # ---------- io ----------
    def send(self, obj: dict) -> None:
        raw = json.dumps(obj)
        self._log("IN", raw)
        self.proc.stdin.write(raw + "\n")
        self.proc.stdin.flush()

    def request(self, method: str, params: dict | None = None) -> int:
        self._id += 1
        self.send({"jsonrpc": "2.0", "id": self._id, "method": method,
                   "params": params if params is not None else {}})
        return self._id

    def respond(self, req_id, result: dict) -> None:
        self.send({"jsonrpc": "2.0", "id": req_id, "result": result})

    # ---------- pump ----------
    def pump(self, seconds: float, on_message):
        """Feed every message to on_message(msg) until `seconds` elapse.

        on_message may return "stop" to end early.
        """
        end = time.time() + seconds
        while time.time() < end:
            try:
                msg = self.q.get(timeout=0.25)
            except queue.Empty:
                continue
            if on_message(msg) == "stop":
                return "stopped"
        return "timeout"

    def wait_result(self, req_id: int, seconds: float = 30.0):
        box = {}

        def h(msg):
            if msg.get("id") == req_id and ("result" in msg or "error" in msg):
                box["msg"] = msg
                return "stop"
        self.pump(seconds, h)
        return box.get("msg")

    def close(self) -> None:
        try:
            self.proc.terminate()
            self.proc.wait(timeout=5)
        except Exception:
            self.proc.kill()
        self._lf.close()
