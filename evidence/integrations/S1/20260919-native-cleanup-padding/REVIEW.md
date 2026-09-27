# Independent native cleanup padding review

The source change replaces duplicate PID padding with distinct positive PIDs absent from each request chunk. This satisfies the Windows helper's fixed three-PID and uniqueness contract while preserving the order of owned PIDs; only the first `chunk.length` results are returned. The observer still maps malformed cardinality, wrong PID order, and query failures to `unknown`, so they cannot become verified cleanup.

Independent command from `daemon`: `npx vitest run test/integration-native-process-cleanup.test.ts --reporter=verbose --no-file-parallelism` — exit 0, **9/9 passed**. It covers 1, 2, 3, and 4 owned PIDs, unique three-PID requests, original result order, malformed cardinality/order refusal, and a real Windows PowerShell helper read of the local Node process. The helper call is local and read-only; no provider, model, service, or network call was made.

Reviewed source SHA-256 `DC608953B8BCA5D4BDB9EA6391B8766CE56351B4ABD44591CBAC44327D9ACA60` and test SHA-256 `838A42CB126660EFD0AB1CCA88979824E6D9490E2B039B6223D683AB3E1D6A4E`. The direct batching tests mock the process launcher, while the separate local helper test verifies its Windows input contract. This review does not establish the full native execution, cleanup, handoff, publication, and acceptance chain.

The maker later supplied `preimages/native-process-cleanup.ts` and `preimages/integration-native-process-cleanup.test.ts`, labeled as post-edit reconstructions. I independently hashed them: `1BA52E80BC23DB88D358D49F0B33572D97A41D9AE18B77314E89D54477C5B504` and `8D34BCD97E25CBD1ED403912F38A4F90F53D7838BC31C557AD1DA8DBDA165510`, exactly matching the prior hashes in `PLAN.md`. They are hash-matched prior bytes, not contemporaneously captured pre-edit files.

No concrete defect found in this narrow fix.
