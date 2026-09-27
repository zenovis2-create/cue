# Native compiled import correction

The constructor's first unmocked import fails because TypeScript emits the two source-relative `../../app/provider-installation.mjs` imports unchanged under `daemon/dist/src`. They then resolve to nonexistent `daemon/app`, not the one root application module that owns installation identity. Compilation and mocked source tests did not exercise this path.

Root owns the narrow build-script correction and a compiled-import smoke test. Done: the standard build emits imports pointing to the existing root app module; an actual Node process imports both compiled native modules and verifies their public functions without launching a provider. Existing current-subject and account/service source regressions must remain green. Do not copy the installation module or create a second identity issuer.

Cap: two passes. Every pass runs the coordinated build, compiled-import smoke and related focused suites, records raw output, and checks the exact diff. A failure requires a changed diagnosis. Preserve the original build script bytes and the constructor's initial import failure. Maker/checker remain separate; no provider, model, service, or network call.
