# Claim clock correction result

PASS for the bounded callback ordering defect, independently reviewed in [INDEPENDENT-CHECK.md](INDEPENDENT-CHECK.md).

Baseline `7817be`: fixture failed before assertion (stage bound before attempt); correcting the order reduced failures to one (`26f22f`, 5/6 passing), demonstrating that the final clock callback could consume the last slot after count validation and still admit the retry.

The final timestamp callback now precedes retry, cap, seal, current revision, run and lease checks. Caps use that captured timestamp and perform no callback. The final count sees a callback mutation; rejection rolls it back with the attempted claim. Normal retry still succeeds. The regression targets the last callback in the corrected call sequence.

Root focused gate `7494cb`: 2 files, 17/17 passing. Independent checker additionally ran the build through daemon pretest, then 17/17. Root combined gate subsequently passed 7 files, 75/75: [budget root review](../20260912-budget-regression/root-review.md).

Only one product correction hypothesis was needed after repairing the fixture. No real model/provider/native process was invoked. The checked 036 role and attempt immutability prerequisite is narrow; complete migration, crash recovery and live execution are not claimed.
