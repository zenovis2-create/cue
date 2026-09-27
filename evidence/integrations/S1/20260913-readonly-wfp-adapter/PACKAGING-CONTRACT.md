# WFP adapter asset packaging contract

Done: register copies of the canonical native collector and concrete observation adapter beside the existing built launcher; `npm run build` from `daemon` exits 0; source and copied asset bytes match; an independent checker compiles the exact built collector, adapter, and extracted launcher C# together and confirms their factory/lease types resolve without invoking WFP or creating an AppContainer worker.

Attempt cap: two packaging correction passes. Every pass checks the scoped copy-assets diff, build result, exact asset hashes, and independent joint-compilation result. A failure requires a new hypothesis rather than a blind retry.

This packages the components for protected host composition. It does not attach a provider to the default launcher, introduce a payload/CLI switch, or add unpinned runtime reads through PSScriptRoot. The launcher is executed from a pinned base64 ScriptBlock; its current invocation path is preserved. No historical gate, WFP option/query/subscription, model, or OS setting is changed.
