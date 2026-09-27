# Integrated regression gate

Done: latest joint build exits 0 and complete serial Vitest report is retained as JSON. No whole-goal completion inference. The historical unknown Codex hash file p10c-manifest.test.ts is explicitly excluded per user instruction and remains unqualified.

Attempt cap: one full-suite run on this frozen source. Every pass records durable JSON and command exit. A failed case is diagnosed before any scoped correction; no blind full-suite retry. Existing focused passes are not summed with this suite.

Build: npm --prefix daemon run build, exit 0 (root tool a29e77).
Command from daemon: npx --no-install vitest run --reporter=json --outputFile=../evidence/integrations/20260912-full-regression/integrated.json --fileParallelism=false --maxWorkers=1 --exclude=test/p10c-manifest.test.ts

The initial receipt write used the wrong relative directory and failed; this corrected receipt records the same already-running command, session 86811. No suite restart occurred.
