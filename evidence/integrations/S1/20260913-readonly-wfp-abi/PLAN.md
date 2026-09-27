# Native WFP ABI layout probe

## Done contract

- Compile `scripts/reuse/native/wfp-layout-probe.cpp` as x64 with the installed MSVC and Windows SDK headers, then run the resulting console executable once.
- Attempt cap: 2 compile/run passes. Each pass records compiler, SDK, command, source hash, and exact output.
- Done means exit 0 and numeric `sizeof`/`offsetof` output for `FWPM_NET_EVENT_HEADER3`, `FWPM_NET_EVENT3`, `FWPM_NET_EVENT_CAPABILITY_DROP0`, `FWPM_NET_EVENT_SUBSCRIPTION0`, `FWP_VALUE0`, and an `FWPM_NET_EVENT_CALLBACK2` pointer.
- Failure changes hypothesis once; after a second failure, report the exact compiler diagnostic without installing tools.

This header-only program performs no WFP calls, networking, subscription, query, or operating-system mutation. The executable is stored only as an evidence artifact.
