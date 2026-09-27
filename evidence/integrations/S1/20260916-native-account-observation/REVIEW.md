# Native account observation independent review

## Review contract

**Done:** inspect the frozen module, focused test, plan, results, correction history, and artifact pins; run the required focused fixture once; determine whether the bounded exported API fails closed. This review writes only `REVIEW.md` and `independent-focused.log`.

**Attempt cap:** one independent focused run. The required command was `npm exec -- vitest run test/integration-native-account-observation.test.ts --reporter=verbose --fileParallelism=false --maxWorkers=1` from `daemon/`. A failure would have been returned as a concrete defect without changing source or repeating the same run.

**Final verdict: NOT CLEAR.** The focused synthetic gate passes, and the API-key/cleanup correction is sound, but valid pinned protocol inputs and bounded stream handling expose release-blocking defects in this producer. This verdict does not close S1.

## Source findings

`observeNativeProviderAccount` accepts only a current Codex installation whose selected auth profile belongs to the pinned descriptor. It constructs an isolated Codex home, obtains the fixed vendor launch specification for `-a on-request app-server`, launches through the ledger-owned `spawnOwned` path, records native PID/creation identity, and limits JSON-RPC activity to initialization, `account/read` with `refreshToken:false`, and the optional policy-requested `account/rateLimits/read`.

The issued record does not promote the response to an authorization fact. `authentication`, `entitlement`, and `capability` are always `unknown`; rate-limit success remains a separate observation. ChatGPT account material is reduced to a digest and neither normalized nor original email appears in source bytes. An API-key response has `accountPresence:'present'` while both `accountRef` and `accountIdentityDigest` remain null, so two credential profiles cannot acquire a fabricated shared stable identity.

The returned object is private-authority evidence rather than caller-shaped JSON. A `WeakMap` binds the exact issued object to the exact installation object, measurement-subject digest, immutable source bytes, and freshness window. Copies, proxies, foreign installations, changed subjects, stale observations, drifted installations, and source digest mismatches fail closed.

Every post-launch path runs the same stop routine. `terminateVerifiedTree` verifies the captured attributed process tree is dead before returning; the module then awaits child close and checks root absence. Only a verified path deletes the owned temporary home. An unverifiable termination surfaces the cleanup failure and leaves the home retained. I therefore do not classify the later root-only check as a separate cleanup blocker: the shared termination authority has already verified every PID in its captured tree.

## Blocking findings

1. **Valid server notifications abort the probe.** The line handler requires every stdout object to have exactly `id,result` or `id,error`. A valid server notification shaped as `method,params` fails `plain(...)`, calls `fail`, and rejects every pending request. The pinned Codex protocol explicitly defines `ServerNotification`, and the existing production Codex session has a dedicated notification path. The focused fixture emits responses only, so 5/5 does not cover this valid interleaving. Exact-key parsing also rejects a response carrying an otherwise optional JSON-RPC envelope field. The producer must distinguish response, notification, and server-request frames and safely ignore or refuse unrelated frames without invalidating a matching account response.

2. **The advertised stream bounds are not enforced at the buffering boundary.** `readline` accumulates a complete line before the code checks `Buffer.byteLength(line) > MAX_LINE`, so an unterminated or oversized line can consume unbounded memory before refusal. The child is also launched with piped stderr but no listener drains or bounds it; enough diagnostic output can backpressure the app server and turn the account request into a timeout/deadlock. Both stdout framing and stderr must be consumed with byte bounds before this is a bounded native probe.

3. **A valid ChatGPT account shape is rejected and the identity is not stable across plan changes.** The pinned `GetAccountResponse` schema requires the `email` property but permits its value to be null. `accountResult` instead requires a non-empty string, so a valid present ChatGPT account can fail the observation. For non-null email, `accountIdentityDigest` hashes both normalized email and `planType`; changing subscription plan changes the purported account identity. The API-key correction correctly returns null identity when the protocol offers none. ChatGPT should likewise separate stable identity material from mutable plan metadata and define a truthful null-identity result when stable identity is unavailable.

## Independent evidence

The corrected source, test, focused maker log, and TypeScript log match the four corrected SHA-256 pins in `RESULTS.md`. The independent focused fixture passed **5/5 tests in 1 file**, exit 0. It covers the fixed launch and synthetic response set, sanitized advisory evidence, opt-in rate-limit observation, unissued/foreign/drifted/stale refusal, API-key null identity, timeout cleanup, and home retention when termination is unverified. It does not cover server notifications, nullable ChatGPT email, mutable plan identity, oversized unterminated stdout, or stderr pressure.

No provider, model, network, real credential profile, shared build, or production process was used by this review.

## Remaining gaps

- No Core, preflight, setup, or startup consumer calls this exported probe yet.
- Account presence and `requiresOpenaiAuth` are advisory protocol observations. They grant no authentication, selection eligibility, entitlement, quota, model availability, or spending authority.
- The focused test uses synthetic process, installation, home, and RPC mocks. It does not freshly qualify an installed executable, real auth profile, OS process-tree cleanup, or provider acceptance.
- The module covers Codex account observation only. It does not supply the missing authority composition or qualification for other configured providers.

Those gaps require separate integration and independently accepted runtime evidence. The current unit is suitable as a bounded producer API, not as an S1 completion claim.

The three blocking findings above require source correction and hostile focused cases before the producer API itself is clear. No real provider or model call is needed to test them.

## Protocol correction re-review

The correction at source pin `C7187CF235D54CFCE6F54D8A57BF4317A1EAAAD61927C56104C7BB945474A7BC` and test pin `54F1E8C76542276F8C39F6DFCFAFE4270A9532221635C3F147BA4AAD7D8E180` resolves most initial findings. It incrementally bounds stdout before newline assembly, continuously drains and caps stderr, classifies optional `jsonrpc:"2.0"` responses and bounded notifications, invalidates on `account/updated`, accepts nullable ChatGPT email, and excludes mutable plan type from non-null identity. The preserved correction evidence reports 8/8 focused tests and TypeScript exit 0.

**Correction verdict: NOT CLEAR — final-response invalidation can be lost.** The channel's `fail` function stores `fatal` and rejects current pending requests. Once the final `account/read` response is processed, however, its pending request is removed and resolved. If a later frame in the same buffered chunk or a subsequent data event is `account/updated`, a duplicate or unknown response, oversized stdout, or excess stderr, `fail` records the fatal state with no pending request left to reject. With rate-limit observation disabled, the caller performs no later `send`, and `close()` does not throw or expose `fatal`; receipt construction can therefore continue after invalidation.

The new hostile tests do not cover that ordering. They place `account/updated` before its response and duplicate the `initialize` response, where later client activity surfaces the fatal state. A correction needs an explicit final channel-health/invalidation barrier with defined buffered-frame ordering, plus hostile cases that emit the valid final account response **before** `account/updated` and duplicate/unknown final responses. Equivalent post-final stdout/stderr fatal cases must also be unable to yield a receipt. Cleanup and home-retention behavior should remain unchanged.

The initial `NOT CLEAR` and this correction finding remain preserved. No provider/model/network call or shared build is needed to resolve the bounded protocol ordering defect.

## Finalization correction verdict

**CLEAR for the bounded account-observation producer API at source pin `4A687CC7F804027C5EEE1FE295CE225494485EF5F149E90C39950B93E4227AAC` and test pin `F10A93746BB68CD376E14E6F7EB9A445C9F278C18A2CB589A91E214AFE8E12BA`.** The two earlier `NOT CLEAR` findings above remain the correction history.

The decoder now stays attached after `beginClose()` through verified process-tree termination, child `close`, and the final absence check. Because Node child `close` follows closure of its stdio streams, `channel.assertHealthy()` runs after the remaining inbound frames have been classified and before the observation is issued. Protocol fatal state remains sticky. Intentional EOF is harmless only while shutting down with no pending request; buffered partial data, pending work, account invalidation, duplicate/unknown responses, and stream-bound failures remain fatal. Listener disposal happens only after this assertion.

The focused fixture now exercises the precise missed orderings: `account/updated` after the final account result, a duplicate final account response, and `account/updated` emitted during stdin close before process death. Each rejects observation issuance. The independent focused command passed **9/9 tests in 1 file**, exit 0. The maker's pinned TypeScript check is exit 0; this reviewer did not rerun a shared build.

This clears only the offline-reviewed producer API. It still does not provide a Core/preflight consumer, an authentication or service-acceptance grant, installed-provider qualification, entitlement/capability authority, or S1 closure. No provider, model, service, network, or real credential call occurred.
