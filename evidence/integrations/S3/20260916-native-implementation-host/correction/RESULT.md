# Independent-review correction

Preimages:

- `app/native-implementation-host.mjs`: `5f6368b8abb53984756370d45ced7dd207a575f4ac42ea2ebed36629d04abf41`
- `daemon/test/integration-native-implementation-host.test.ts`: `3b711b4a2ad7bf58d3c5052a1e192c7aaf6e3be5947b73c080fff8d93c40a5a0`

Exact byte copies are under `preimages/`.

The correction snapshots the nested verifier candidate before reading `supportedRoles`; a hostile accessor is rejected with getter count zero. Every fresh engine observation is now revalidated against candidate identity, currency, and the configured role-specific conservative cost cap. A verifier estimate changed from 1 to 100 is rejected before reservation or launch (`reservations=0`, provider launches remain zero).

Post-correction hashes:

- `app/native-implementation-host.mjs`: `7b1889677fa70bdefd90903fd40cfb0f1d16d8c9a2590a6a27553652d1513cfd`
- `daemon/test/integration-native-implementation-host.test.ts`: `06fd292e74bf9f0afd2ca8547b95c0e939c28e09b986b88d72865e254f94d2dd`

Locked focused gate: `cd daemon && npx --no-install vitest run test/integration-native-implementation-host.test.ts --fileParallelism=false --maxWorkers=1`, Vitest 4.1.11, 2/2 PASS, exit 0, duration 1.27s.

No-emit gate: `cd daemon && .\\node_modules\\.bin\\tsc.cmd -p tsconfig.json --noEmit --pretty false --incremental false`, exit 0, empty output.
