# Attempt 1: visual gate failed

The raw automated result remains unchanged: exit 0, real Core evaluation calls 9 / IPC calls 5, backup integrity and owned cleanup passed. Direct PNG inspection shows the evaluation cohort details closed. All three PNGs share SHA256 `c9ec11eb12e5491c4e7cc978948e926883714a4359b1fff84090a999fe6040c0`; they do not demonstrate the form, observation, or coverage contents. Overall requested visual QA is **FAIL**, despite DOM/data gates passing.

Cause confirmed in the harness: capture assigned `.open` to inner form/output elements instead of opening their ancestor details. Product code was not implicated. Backup SHA256: `474ca06c3deb7c7b0bf10514618a7ce3b0bba63b9f081bda76dcbe51c09f9328`. PID 64160 exited 0; the exact owned temporary root was removed. No approval, execution, Stop, provider, model, native helper, or network calls occurred.
