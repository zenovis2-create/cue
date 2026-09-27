# Independent S3-02 actual-attempt-4 visual audit

Verdict: **FAIL / OPEN with a concrete current-product layout defect.**

The nested-scroll harness now supplies adequate diagnostic evidence. The first required field exists with the expected fixed-pair text, but its actual rectangle is only 7 px wide and 1067.87 px tall (`left 1137.15`, `right 1144.15`, `top -46.77`, `bottom 1021.09`) in an 1187 × 989 viewport. Its `OL#orchestration-stages` clipping client area is only 29 px wide and 245 px tall. The page also reports horizontal overflow.

The retained PNG confirms the geometry: the right-hand status column is compressed to roughly one Korean character per line, the selection content is clipped inside a narrow independently scrolling strip, and the whole page has a large horizontal scrollbar. This is not a false rejection caused by window-versus-inner scrolling. A 1068 px-tall field cannot fit inside its 245 px clipping ancestor, and `scrollIntoView` cannot correct the seven-pixel layout width.

The source supports a grid intrinsic-sizing diagnosis. `main` uses three fractional columns, while its direct `section` grid items retain the default `min-width:auto`. The third section contains long orchestration/detail content and nested scroll lists; `.orchestration ol, .orchestration ul` adds vertical scrolling but no `min-width:0`/width constraint. The grid therefore honors a large min-content contribution, expands beyond the viewport, and leaves the visible status track collapsed at the far right. The exact minimal CSS fix still requires implementation and regression testing, but it should start by allowing grid children and orchestration descendants to shrink (`main > section { min-width:0 }` plus bounded width/min-width rules for the orchestration list/detail content) and retaining `overflow-wrap:anywhere`. A visual regression must verify normal readable line width, no page horizontal overflow, and all required fields without relying on a harness-only style override.

The actual flow reached real Core/preload/trusted IPC/renderer running state and recorded correct running values. It failed before UI Stop. The single cancellation was teardown through `Core.close()`, not a UI Stop request. No stopped result or Stop behavior is qualified.

Teardown passed: child PID `129716` exited 1 and closed; backup integrity and native identity count zero were verified; expected close rejection was retained; before/after hashes match; fetch/request counts are zero; the exact owned root was removed; `final.json` remains `passed:false` with no parent errors.

No provider/model/native process or billing behavior was exercised. S3-02 remains open pending a product CSS correction, ordinary renderer/layout regression tests, and a separately authorized actual visual run.

## Evidence pins

- raw bounds: `9dadf99c3ede966086e0ec01fbe030100bb9d94f77e7fbcde2da03c0473e05dc`
- failure PNG: `cbf2a92f77a7d5385f9828c41bd436454521936ef5a8aada3ca9c4a9a0680d8e`
- failure receipt: `14b8a64c9c83d3d3f65b022737d416b79c53b82de129c427a04b0348a31bb78a`
- result receipt: `07ea773fcae140f4f54407a20f56fce7bfa7737bddbf8b58937a94db58f53bcd`
- final receipt: `0e353cf41b1fbd414135597c02c1a090e22b96fbefee5ffecf73d8f03bec981e`
- before/after source snapshot: `703551b9862bebac1b9a4e58ce712b9e870efb68548bcc475e7ce49bc236aef2`
