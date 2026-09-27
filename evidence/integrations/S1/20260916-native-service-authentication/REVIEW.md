# Native service authentication independent review

## Review contract

**Done:** inspect the frozen producer and reader, usage schema, measured-subject and installation binding, stable account sequence, shared decoder and teardown, private issuance, freshness, evidence pins, and service-specific hostile tests; run the focused offline fixture once.

**Attempt cap:** one independent focused run. A source or evidence defect is returned to the maker without source edits, a shared build, or any provider/model/network call.

**Verdict: NOT CLEAR — the producer is bounded, but the new service reader lacks its required direct hostile evidence.**

There is also a source-level profile-binding defect: the service receipt does not bind which approved auth profile produced the observation.

## Producer assessment

`observeNativeServiceAuthentication` remeasures the current pinned Codex installation and requires the caller's current subject to equal the actual measured native-provider subject before launch. It uses the exact owned app-server launch, observes a non-null ChatGPT identity, validates one `account/usage/read` response, and reads the account again. Both account observations must require OpenAI auth and hash to the same normalized, plan-independent identity. The installation and measured subject are checked again before issuance.

The producer inherits the corrected bounded decoder and finalization barrier. It begins shutdown, verifies exact process termination and absence, keeps inbound decoding active through child close, and asserts channel health before adding the receipt to its private `WeakMap`. Account updates, protocol faults, cleanup uncertainty, API-key/null identity, account drift, subject drift, and malformed or negative usage fail closed.

The receipt's authority is narrow and truthful: `serviceAccepted:true` applies only to `scope:'account-usage-read'`. `modelEntitlement`, `capability`, and `billing` remain `unknown`. It does not infer pricing, quota, model availability, spending authority, Core eligibility, provider qualification, or S1 completion.

The installation may contain one to four approved auth profiles, but the proof body, private issued record, and reader input omit the selected `authProfilePath`. The native measurement installation digest canonicalizes provider, executable, and version; it does not include the auth-profile list or chosen profile. Consequently, the same installation object can issue a receipt through profile A and later satisfy the reader while a caller is operating in profile-B context. Before composition, the proof must bind a non-secret digest of the exact selected pinned profile metadata/path into source bytes, private record, and reader validation. A hostile fixture with two approved profiles must prove that a profile-A receipt cannot authorize profile B.

The pinned usage schema requires `summary`, permits nullable summary metrics and nullable/absent daily usage, and permits an optional non-null `threadUsage`. The implementation validates the account-wide summary/daily form and deliberately rejects non-null `threadUsage`. That is a safe narrowing, but it is a compatibility limitation and should not be described as accepting every schema-valid response variant.

## Blocking evidence gap

`readIssuedNativeServiceAuthentication` contains meaningful new authority checks: exact issued object and installation identity, exact account reference, current remeasurement, current subject match, installation digest match, current issuer-module revision, freshness and caller max-age bounds, and stored source-byte digest. The service-specific suite directly tests repeat reads and a shaped copy only.

The results claim foreign installation, subject drift, and stale behavior are inherited from the shared reader boundary. They are not. The existing hostile test invokes `readIssuedNativeAccountObservation`, which uses a different `WeakMap`, record type, error namespace, and validation function. It does not execute the new service reader's branches.

Before CLEAR, focused service-reader cases must directly demonstrate refusal for:

- a foreign installation object and a current-installation drift/failure;
- current measured-subject or caller-subject drift;
- a wrong account reference;
- a wrong selected auth profile when the same installation descriptor contains two approved profiles;
- stale, future-dated, and excessive caller max-age reads;
- current issuer-revision and stored source-byte binding to the extent those private values can be changed through a controlled fixture seam.

The independent combined fixture passed **11/11 tests**, exit 0, and the frozen source/test and maker gate hashes match `RESULTS.md`. That passing result does not cover the reader branches above. No live service acceptance occurred.

## Correction verdict

**CLEAR for the bounded offline service-authentication producer and reader at source pin `529783E291F4A011E0960DBC657D7FD45DD330A8A8D2BC205FCF5FF3F2EE0C35` and test pin `E810C5A1D465A794F81583DC9B13B86C5365925375F22659E992B8FC6A0B56E4`.** The initial `NOT CLEAR` findings remain preserved above.

The correction binds the exact selected pinned profile metadata as `authProfileRef` in receipt and canonical source bytes, stores the exact selected path and digest in the private issuance record, and requires the reader's exact path plus a freshly recomputed metadata digest. A two-profile installation fixture proves a receipt issued through profile A cannot be read in profile-B context.

The direct service-reader hostile now exercises wrong profile, wrong account reference, foreign installation object, current-installation failure, caller-subject drift, future time, expiration, tighter caller max age, current issuer revision, shaped receipt refusal, repeat reads, and mutation isolation of returned source-byte copies. The earlier failed pass caused by a mock that omitted production installation validation remains preserved; the corrected fixture restores that behavior rather than weakening the assertion.

The independent focused suite passed **12/12 tests**, exit 0. The maker's pinned TypeScript check is exit 0. Non-null `threadUsage` remains a documented, deliberate compatibility refusal for this account-wide request; this verdict does not claim support for every schema-valid thread-specific variant.

This CLEAR is limited to the offline producer/reader contract. It does not establish a Core authority constructor, runtime/catalog consumption, real service acceptance, model entitlement, capability, billing, provider qualification, or S1 closure. No live provider, model, service, network, or real credential call occurred.
