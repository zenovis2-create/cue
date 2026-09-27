Attempt 1 passed the focused gate but delayed pending-start cancellation by awaiting the original start promise.
Attempt 2 replayed the claimed engine request; build passed and 64/65 tests passed, but the strengthened stop-during-start test observed zero provider cancellations before launch release.
The current engine/runtime lifecycle does not expose prompt control of still-unpublished parallel starts. Production and test changes were restored byte-for-byte from the recorded preimages.
