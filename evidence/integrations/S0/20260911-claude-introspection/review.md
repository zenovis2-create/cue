# Independent CLI declaration review

Reviewer: /root. Operator: /root/reuse_pure. Date: 2026-09-11.

The two exact-path diagnostic invocations used --version and --help only. Recorded exits are0, elapsed54ms and178ms, both within10s; stderr is empty. Pre/post executable SHA256 is unchanged:23dde2a47cf1d7d9c4a2d96d21fa80ea9bfc872dfde0ee06e9982d2908603350.

Root independently verified all four saved stdout/stderr hashes against the two JSON receipts and inspected the version/help declarations. A first read-only audit command had a PowerShell foreach pipeline syntax error before reading hashes; assigning its results before piping fixed that diagnostic command. No CLI invocation was repeated for review.

The binary reports2.1.267 (Claude Code). Help declares print JSON/stream-json, structured schema output, tool controls, restricted/safe modes and settings/MCP controls. Restricted mode still allows explicit overrides and managed settings; safe mode still leaves normal authentication and built-in permissions. These are declared features, not measured isolation guarantees. Bare mode has different auth behavior; it must not be selected blindly for an existing OAuth account.

Verdict: PASS for bounded version/help observation and saved evidence integrity. Authentication, model access, billing, child ownership, cancellation and P/B/M qualification remain unverified. No prompt/model/auth/init/update command was invoked, and no executable redistribution is implied.
