# Finalization correction results

The inbound decoder now remains active from the final account response through stdin shutdown and verified process termination. Receipt issuance occurs only after process close, absence verification, and a final channel health assertion. EOF caused by intentional shutdown is harmless only with no pending request; account invalidation and all other fatal protocol states remain sticky.

Hostile tests reject account invalidation and duplicate responses after the final result in the same delivery turn, plus account invalidation delivered when stdin closes before process death.

- Focused gate: **9/9 passed**, exit 0.
- TypeScript no-emit: **passed**, exit 0.
- No fixed sleep or quiescence heuristic was introduced.
- No live provider, model, service, or network call occurred.

Pins:

- Source: `4a687cc7f804027c5eee1fe295ce225494485ef5f149e90c39950b93e4227aac`
- Test: `f10a93746bb68cd376e14e6f7eb9a445c9f278c18a2cb589a91e214afe8e12ba`
- Focused log: `490c6540b25046f41360afc736ce3226c5aa34b0d24537b03a8717f94b007df3`
- TypeScript log: `5913c4acfaced3b4ce71164e1ec2e8a6ba3e6a5a545d8676aa07e7d17b9c8cb8`

Source is frozen pending independent re-review.
