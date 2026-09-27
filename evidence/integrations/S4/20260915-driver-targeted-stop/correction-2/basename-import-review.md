# Basename import correction review

Verdict: **CLEAR; prior A03 preflight clearance remains valid.**

The preserved preimage and current test differ in exactly one line: `basename` was added to the existing `node:path` named imports. This supplies the identifier already used by both reviewed cleanup path guards. No fixture behavior, assertion, process identity, Stop routing, or cleanup logic changed.

- preimage SHA-256: `fefb2d5617f9862a3f83d5b0c5e5dc05e63b971e8cdb0d95c01f68056ac5524d`
- current test SHA-256: `ae232e31b794863c7d5dd4602003ca5a529f915a85b0404361e1558ebb2e1fff`

No actual OS test or build was run during this audit.
