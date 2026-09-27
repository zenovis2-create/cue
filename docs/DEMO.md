# Cue demo recording guide (30–60s)

Record on a **Windows 11** machine with Cue already able to start (`npm start`, Codex authenticated). Do not fake UI.

## Goal of the clip

A stranger should understand in under a minute:

1. You type a goal  
2. You approve a bounded envelope  
3. Work runs in isolation  
4. Stop actually ends it  

## Recommended storyboard

| # | Duration | On screen | Say / caption |
| --- | --- | --- | --- |
| 1 | 0–5s | Empty Cue window + chosen work folder path visible | “Cue only runs inside the folder I approve.” |
| 2 | 5–15s | Type a **small, file-changing** goal (e.g. create `hello.txt` with one line) | Show natural language, not a shell dump |
| 3 | 15–25s | Three-line summary + execution envelope | Pause so viewers can read |
| 4 | 25–30s | Autonomy picker → **Approve and start** | Click clearly |
| 5 | 30–45s | Ledger: progress, tool/worker PID, completion or blocked | Prefer a successful tiny write |
| 6 | 45–55s | Optional second short run → hit **Stop** mid-flight | Prove Stop kills controller + worker |
| 7 | 55–60s | End card: repo URL + “Star if you want hard floors for agents” | https://github.com/zenovis2-create/cue |

## Still frames for README

Export these PNGs into `docs/assets/`:

| File | Content |
| --- | --- |
| `01-goal.png` | Goal input filled |
| `02-envelope.png` | Summary + envelope before approve |
| `03-ledger.png` | Ledger showing run / PIDs / result |
| `demo.gif` | Full 30–60s loop (or link a short MP4 in README instead) |

Also keep any existing Electron proof PNG under `evidence/P12/` as technical proof — demo assets are for humans, evidence is for verification.

## Capture tips (Windows)

- **ShareX** or **OBS**: 1280×720 or 1600×900, 30fps  
- Cursor size large; disable noisy desktop notifications  
- Hide secrets: never show `%USERPROFILE%\.codex\auth.json` or API tokens  
- Prefer a disposable worktree folder named like `cue-demo-worktree`  
- GIF: target **under ~8–12 MB**; if too large, use MP4 in an issue/discussion and keep a short GIF in README  
- Dark theme + one consistent window size across frames  

## After recording

1. Drop files into `docs/assets/`  
2. Uncomment the image block at the top of `README.md`  
3. Watch the GIF once at 1× — if envelope text is unreadable, lengthen that beat  
4. Commit assets + README together so the launch PR/post has visuals day one  

## What not to show

- Exaggerated “fully syscall-blocked network” claims (P3-16 is detect-then-stop)  
- Non-Windows platforms  
- Credential files or token values  
- Long failing runs with no payoff — keep the demo boring and successful, then optionally show Stop  
