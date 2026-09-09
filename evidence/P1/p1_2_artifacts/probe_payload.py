from pathlib import Path
import json
import urllib.request

inside = Path("D:\\Temp\\User\\cue-p1-2-worktree-qeakf7xj\\inside_marker.txt")
outside = Path("D:\\Temp\\User\\cue-p1-2-outside-bv3n3xe2\\outside_marker.txt")
result_path = Path("D:\\Temp\\User\\cue-p1-2-worktree-qeakf7xj\\payload_result.json")
network_url = "https://example.com/"
results = {}

try:
    inside.write_text("inside-ok", encoding="utf-8")
    results["inside"] = {"ok": True}
except Exception as exc:
    results["inside"] = {"ok": False, "error": f"{type(exc).__name__}: {exc}"}

try:
    outside.write_text("outside-escape", encoding="utf-8")
    results["outside"] = {"ok": True}
except Exception as exc:
    results["outside"] = {"ok": False, "error": f"{type(exc).__name__}: {exc}"}

try:
    with urllib.request.urlopen(network_url, timeout=15) as response:
        response.read(16)
        results["network"] = {"ok": True, "status": getattr(response, "status", None)}
except Exception as exc:
    results["network"] = {"ok": False, "error": f"{type(exc).__name__}: {exc}"}

result_path.write_text(json.dumps(results, sort_keys=True), encoding="utf-8")
