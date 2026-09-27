# Generated launcher build registration

Done: `npm run build` from `daemon` generates the standalone WFP launcher alongside the original launcher. An independent checker verifies that the built bytes exactly equal the pure renderer output for the final canonical inputs, parses the generated PowerShell, and compiles its embedded C# without executing the wrapper. The original launcher and its invocation remain unchanged.

Attempt cap: two build-registration correction passes. Every pass checks the scoped copy-assets change, build result, generated hash/input parity, and independent parse/compile result. A failure requires a different hypothesis before retrying.

The existing version-one control measures and rechecks the complete generated launcher bytes. No additional runtime asset loads, global default selection, caller flags, live WFP query/subscription, AppContainer worker, model, or OS policy change is part of this build step.
