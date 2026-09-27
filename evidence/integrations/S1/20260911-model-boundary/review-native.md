# Native DACL correction — independent execution

Date: 2026-09-11. Implementation: `reuse_cli`. Independent source inspection and execution: `cue_fit`. This artifact is transcribed by parent `/root` from the reviewer's terminal report; it is not a parent self-review.

Command in `daemon`:

```text
npx --no-install vitest run test/integration-model-boundary.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1
3 passed / 1 failed
```

| Source | SHA-256 |
| --- | --- |
| daemon/src/model-only-launch.ps1 | b51b27a6cca8166f9643ca2effd82c9765caad3f917913e74c1efd7924f5e4da |
| daemon/test/integration-model-boundary.test.ts | dda575fafd74dacc519769398e2ed2488688a85082ee8e14579a46c19161303d |
| scripts/reuse/model-acl-diagnostic.ps1 | 0c0826268b50ce1cb20eb5032e4f1774a84b679ab2d9c22431bdb0c0898c350d |

The fresh native DACL diagnostic independently produced exact desired/actual bytes, protected ACLs and package RX mask `0x001200A9` on its own root/profile/Temp. No child was launched by that diagnostic. Its later readback remained RX and its profile/root cleanup succeeded. This distinguishes ACL construction from the earlier unsuccessful .NET rule removal; it does not prove provider isolation.

The corrected launcher retained suspended creation, private-tree sealing and readback before resume. Independent runtime probes now returned `EPERM` for work/profile/actual Temp/outside writes. Production protocol and cleanup passed (4.9 s), timeout/observed-parent-death cleanup passed (5.0 s), and payload/harness/protocol-limit checks passed (0.75 s).

The complete denial test still failed: child execution returned `UNKNOWN`; network returned `ETIMEDOUT`. Neither is a verified denial. M1/M3 and overall model qualification remain UNKNOWN. No eligibility evidence is issued. Hard-kill launcher cleanup and production model broker integration remain separate work.

This direct native gate did not run the daemon build. A prior premature reviewer build encountered concurrent acceptance-history edits; that intermediate result is not the final acceptance build result. Previous failing .NET ACL artifacts are preserved rather than rewritten as success.
