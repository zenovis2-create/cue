# Native existing-file authority implementation

## Completion contract

Done means the new declarative constructor returns a complete option set for
`createNativeImplementationHost`, denies malformed or missing authority facts,
and the focused source test proves the real persisted receipt/checker path. The
root coordinator owns shared compilation and the final combined gate.

## Preimages

- `app/native-existing-file-authorities.mjs`: absent
- `app/native-existing-file-authorities.d.mts`: absent
- `daemon/test/integration-native-existing-file-authorities.test.ts`: absent

## Attempt contract

- Maximum correction hypotheses: 2.
- Every pass: focused constructor test, then the existing native receipt,
  cleanup, checker and host suites when the compiled imports are available.
- Keep a revision only when the measured gate improves. On failure, diagnose a
  new hypothesis or return the exact implementable boundary to the coordinator.
- Final shared TypeScript/build and independent checker are owned by root.

## Scope

Only the three source/test files above and this evidence directory may change.
No provider process, model call, network call, user profile deletion, setup
schema or startup wiring is permitted.
