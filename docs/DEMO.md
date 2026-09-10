# Cue demo guide

Show the result first, then the decision that made it possible. The central story is: **a goal becomes an approved scope, then a working file you can inspect.**

## Current English demo

[Watch / download the 34-second MP4](assets/cue-demo-en.mp4) · [English SRT](assets/cue-demo-en.srt)

- 34.35 seconds, 1920×1080, 30 fps; English narration and captions.
- Actual Cue UI and generated HTML interactions, from one successful run captured on 2026-09-10.
- Source snapshot: [`51d1e36`](https://github.com/zenovis2-create/cue/tree/51d1e36cacc30bc8ae6040284ea74c7814fb20fc).
- Only UI presentation strings were translated for capture. Runtime/core and worker isolation were preserved. The current repository UI remains Korean.
- Waiting is omitted; the runtime recording was approximately two minutes. This is not a 34-second execution guarantee.
- The ledger records completion. A model verification command returned nonzero because of an overly strict checkbox regex; independent browser checks confirmed all three controls, progress, completion, and unchecking. Do not describe this as “every test passed.”
- The capture used the installed official Codex 0.154.0 through the documented executable override and exact SHA validation. The repository's default pin remains 0.153.0.

The final MP4 passed full decoding, caption interval checks, and desktop/mobile browser playback including seeking and EOF. The completed three-checkbox state is held for 1.2 seconds. Fine UI copy is small on phones; no listening review was performed. The production pipeline's separate upload gate remained blocked by legacy format/metadata expectations and bitrate, with a loudness warning. Publishing this demonstration does not assert those gates passed or establish release/security readiness.

MP4 SHA-256: `a065f0292e0ec91c48967f2246f5dc9c5d7292d585ef83e6ca3bd8434b91dd58`.

## 30–60 second storyboard

Use the 34-second cut as the default. Extend to 45–60 seconds only when the added footage explains a real action or limitation.

| Approx. time | Show | Narration purpose |
| --- | --- | --- |
| 0–3 s | The generated checklist responding to a click. | “This checklist started as one request in Cue.” Establish the result immediately. |
| 3–9 s | Enter the goal and select autonomy. | Explain the desired output: one interactive HTML file. |
| 9–15 s | The prepared scope and execution envelope. | Show what can change and what stays untouched. |
| 15–19 s | Review, then approve. | Make the user's decision visible. |
| 19–24 s | Actual progress followed by recorded completion. | Label omitted waiting; never imply instant execution. |
| 24–31 s | Open the file; check all three boxes. | Let the working result carry the explanation. Hold completion for at least one second. |
| 31–35 s | Cue name and repository URL. | “From a clear goal to a working result. This is Cue.” |
| Optional +10–20 s | A separate, clearly identified stop or blocked-run example. | Explain control or recovery with real footage; do not splice another run into a fake continuous success. |

## Capture tips

1. Choose a small, self-contained file task with a visible result. Keep tool instructions out of the goal text; dotted executable/API names can be interpreted as expected output paths by the current goal verifier.
2. Keep worker isolation and executable validation enabled. Capture actual observed states; retain the source revision and original recording.
3. Use a clean demo workspace. Hide credentials, private paths, and identifying environment details. Keep the allowed actions and approval decision readable.
4. Record at a readable native size. Crop to one action per shot; use large, short captions. Avoid stretching tiny UI text to fill the frame.
5. Show the cursor action and its response. Allow a brief pause after approval and a full second on the finished result.
6. Cut waiting explicitly. Keep blocked runs in the production record; do not turn a failure into a fabricated success state.
7. Check the generated output independently. Listen to narration, check caption timing, and preview on desktop and phone before a new cut is published.

## README assets and filenames

| File in `docs/assets/` | Status / use |
| --- | --- |
| `cue-demo-en.mp4` | Present: full English demo, linked from README. |
| `cue-demo-en.srt` | Present: English subtitle sidecar. |
| `cue-demo-poster.png` | Planned: actual result still, ideally 1280×720. No placeholder image is shipped. |
| `cue-demo-loop.gif` | Planned: short silent action/result loop; keep the full MP4 as the primary demo. |

README image blocks remain inside an HTML comment until the real PNG/GIF exists. The MP4 uses a regular file link; an inline GitHub video player is not guaranteed by a Markdown link. Do not use a nonexistent image as the only route to the demo.

When replacing the movie, update the duration, subtitles, hash and this provenance note together. Keep unsupported claims out of the title, narration, captions and launch copy.
