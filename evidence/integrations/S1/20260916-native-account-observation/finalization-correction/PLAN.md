# Finalization correction plan

Independent re-review found that fatal protocol state arising after resolution of the final response could be ignored by `close()`. Done means finalization checks the channel fatal state after processing all frames already delivered in the response turn, and rejects account invalidation, duplicate/unknown response IDs, stdout overflow, or stderr overflow that follows the final account response.

- New reviewer-driven correction cap: 2.
- Run focused account-observation tests and TypeScript no-emit every pass.
- Preserve prior correction artifacts and exact current preimages.
- No service-auth extension or live call in this correction.
