# Focused gate transcript

Command:

`npx vitest run test/integration-owned-writer-quiescence.test.ts --fileParallelism=false --maxWorkers=1 -t "withholds publication"`

Observed output:

```text
RUN  v4.1.11 C:/Users/User/cue/daemon

Test Files  1 passed (1)
Tests       1 passed (1)
Start at    08:16:11
Duration    22.23s (transform 284ms, setup 0ms, import 474ms, tests 21.63s, environment 0ms)
```

Exit code: `0`.

This is a faithful summary recorded after the tool call because the command was not originally redirected to a raw file. `receipt.json` was written by the passing test and contains the process and database observations from that run.
