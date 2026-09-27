# Independent final native measurement review

Verdict: **PASS for the frozen Batch85 native subject scope**. I inspected the final source, dedicated tests, saved preimages and result notes without editing implementation or calling a provider.

The fixed list contains 131 unique paths plus `binary/provider`, and refuses a count or duplicate change. It includes migration 051 in source and packaged form, `ledger.ts` and packaged `ledger.js`, `copy-assets.mjs`, and the startup/staging planning authorities. `measureArtifactSet` allows at most 128 entries per call; the subject calls it on entries 0–127 and 128–131, spreads both returned artifact arrays, then sorts by ID. The resulting manifest test checks the exact set of all 132 IDs. Group digests select their named IDs and reject a missing member, so the final second-batch probe is included in subject identity.

The executable hash is compared with the issued installation descriptor and that descriptor is checked again after file measurement. Required source and packaged paths fail on absence. Tests change the measured digest of source migration 051, packaged migration 051, packaging script, ledger, and the last second-batch probe at the artifact seam; each changes the subject digest and makes old P1 evidence fail with `subject-drift`. This seam tests propagation and admission, while the artifact reader's own file hashing is a separate existing component.

Independent Windows command from `daemon`: `npx vitest run test/native-provider-measurement-subject.test.ts --reporter=dot --maxWorkers=1`, exit 0, **98/98** tests. The source and packaged artifact pins observed at review:

| Artifact | SHA256 |
| --- | --- |
| `daemon/src/native-provider-measurement-subject.ts` | `4F5BBD30486973B5A52A9EF8C1698C6CF1EC8E2EBE76A0B2B24366C3D96969D0` |
| `daemon/test/native-provider-measurement-subject.test.ts` | `AC9D8DA4615695FC21F29AE619531827181951FBD248F7D1077ADF56A08298F7` |
| `daemon/dist/src/native-provider-measurement-subject.js` | `94D3B51CB0511AC7D68816B8C4A877C01EFBF5A3A1AA896D2A74BA9C8E611517` |
| migration 051, source and packaged | `BA4C94D715773BD9175B209671779F699B612B74B78CB0FC9FBFD2DCAFCD68CA` |

This is a fixed named-authority fingerprint, not recursive transitive closure or a provider qualification. Root owns the full regression and final packaging gate.
