# Implementation results

`createCueCore` now constructs `createEvaluationMeasuredFactStore` only when `runtime.measuredFactHost` is explicitly present. Capture accepts the exact identifier-only DTO, validates all identifiers, requires a local workspace enrollment and its bound observation, and preflights any existing fact owner and immutable tuple before store delegation. Read validates the fact identifier and local workspace binding before store validation. These checks occur before host callbacks.

The real Core path captures and reads on the daemon ledger, preserves `trialReady:false`, and exact replay after a newer observation does not request a new host capture. Unconfigured capture, foreign enrollment, foreign fact read, and a foreign existing fact ID paired with a local tuple fail with zero host callbacks and no changed row. No Core trial, promotion, UI, provider, model, native, or network behavior was added.

Correction cap used: 2 of 2. Pass one corrected fixture enrollment lifecycle. Pass two corrected the observation schema join and disjoint cohort fixture while adding the required existing-fact ownership preflight. The final focused gates passed:

- measured-fact Core: 2/2
- observation Core: 1/1
- daemon TypeScript build through the earlier focused test prehook: exit 0
- `node --check app/core.mjs`: exit 0
- scoped `git diff --check`: exit 0

Frozen hashes:

- `app/core.mjs`: `896461800E8EB790286F529EF0728AF26D97691867E6F6E24BCF157F6696D209`
- `daemon/test/integration-evaluation-measured-facts-core-containment.test.ts`: `F4BF3741CC982BD6159040AFD22EF226504AE831E6C7B268DB546549823F253D`
- `daemon/test/integration-evaluation-observations-core.test.ts`: `E76DB8E2FFB837B54E720707D24651F44E8C790F93B13A5C8ADC1A0E261873AD`

`app/core.d.mts` required no edit.
