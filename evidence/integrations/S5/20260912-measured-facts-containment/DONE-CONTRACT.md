# S5 measured-fact containment done contract

Date: 2026-09-12 KST

- Done means product Core measured-fact capture and read always throw `evaluation_measured_fact_component_unverified` before host capture/resolver callbacks and with zero fact writes, including when a caller supplies extra flags.
- The unverified measured-fact store is not constructed by product Core.
- Existing evaluation enrollment, observation, trial, and comparison Core behavior remains covered by its focused regression.
- Attempt cap: 2 containment correction passes. Every pass runs the new containment test, the existing evaluation Core regression, Core syntax check, and proportional typecheck.
- A regression is rolled back. A failure gets a new hypothesis; after two failed passes the containment remains blocked.
- Scope excludes migration 034, measured-fact and registry factories, live calls, checklist completion, and broad documentation.

