# Independent nested-scroll visual preflight

Verdict: **CLEAR for the separately coordinated actual attempt 4.**

The capture path now calls `scrollIntoView({block:'center', inline:'nearest', behavior:'instant'})` on every concrete field, allowing the browser to scroll both the page and nested scroll containers. After two animation frames it records each field rectangle, text and disabled state, the viewport, and every ancestor whose computed overflow can clip on either axis. The assertion requires a positive field size, full viewport containment, full containment within every applicable ancestor client rectangle on the relevant axis, and no page-level horizontal overflow.

Raw bounds and clipping data are saved before assertions. The debugger is attached before validation, and an assertion failure writes a diagnostic PNG before rethrowing. A passing capture writes the named PNG and a visibility receipt containing the image SHA-256. Thus another visual failure remains diagnosable without weakening the field-level oracle.

The focused visibility tests cover nested vertical clipping, an oversized field, viewport clipping, multiple ancestors, and independent horizontal/vertical clipping. The prior bootstrap and writable-marker tests remain part of the seven-test offline gate. The real compiled Core/preload/IPC/JSDOM scenario also passes, while continuing to label layout as unproven offline.

After capturing the expanded fixed-pair selection details, the scenario closes those existing `<details>` elements before capturing the producer and verifier rows. This changes only the disclosure presentation after its own evidence is secured; it does not alter stage content, ledger state, fixture authority, or result data. All nine required captures and exact value assertions remain.

The harness writes exclusively to `actual-attempt4`; prior attempts remain preserved. Unknown cleanup, unresolved ownership, unverified acceptance, UI Stop, expected close rejection, backup/source/request/child/root guards, and the no-provider scope remain unchanged.

Reviewed pins:

- `electron-proof.mjs`: `e64578829bbc0285cdc47d0e426ea8b59ceff1e560b5745c32eed49f295bde2c`
- `scenarios.mjs`: `8c7ff7bcad747edca4ab66a2eed8b0b58242217825d0fa6052be32803cfb3cc7`
- `scroll-correction/visibility.mjs`: `f67fc7d04f4cf7d70afa4fa8db8a62144b5e126de3dedc02ba017ac436dfa0fb`
- `scroll-correction/visibility.test.mjs`: `2f655747fc9fc621e0762ca4de8313ef5b58ddea2ef16f700c3d4774ffdb39a`

No Electron window, OS integration test, build, product edit, provider, model, native helper, or network call was performed during this review.
