# Diagnostic-gate read-only follow-up

Status: the single authorized gate is consumed and failed. This document changes no source, gate, client, profile, ACL, or process state.

## Retained observation

The retained receipt records PID `113624`, launcher status and exit frame `72`, one matching cleanup frame, `observed: null`, `diagnosticExists: false`, and no accepted controlled-loopback connection. Post-observation records the same root identity and SDDL, unchanged fixture bytes, profile count zero, and cleanup. Under the pinned client contract, exit `72` means its single diagnostic persistence attempt failed. It does not identify the stage or the underlying error.

## Runtime-path ambiguity

The diagnostic wrapper derives its output directory solely from `process.env.TEMP`. The host payload passes all of `APPDATA`, `HOME`, `LOCALAPPDATA`, `TEMP`, `TMP`, and `USERPROFILE` as the declared owned runtime. The launcher grants the AppContainer modify access to that declared `runtimeRoot` and passes the eight-key environment block to `CreateProcess`.

The established model-only launcher documents a Windows package behavior at its environment construction: Windows derives package TEMP from LOCALAPPDATA, so it discovers the AppContainer profile path, creates the profile-private `Temp`, grants that profile path, passes the real local-app-data base as `LOCALAPPDATA`, and treats the actual private package Temp as distinct from an arbitrary requested TEMP value. The read-only launcher does not observe or persist the child-effective TEMP, and the failed client could not persist it. Therefore the declared runtime path and child-effective `process.env.TEMP` remain ambiguous. The retained exit `72` is consistent with an unavailable or unauthorized derived output path, but does not prove that explanation; it can also represent another failure in record construction or exclusive writing.

## Smallest discriminator

For any separately reviewed future diagnostic experiment, bind the already host-authorized `runtimeRoot` as a fixed additional argv value covered by the prelaunch command digest and nonce receipt. The diagnostic wrapper should validate it as an absolute, non-reparse path equal to that frozen expected value and use it only for `diagnostic.json` and `result.json`; it should not derive authority from environment variables. Keep the eight-key environment unchanged so the experiment changes only output-path selection.

If exclusive diagnostic writing still fails, map the closed stage to distinct reserved failure exits while retaining the general diagnostic-write-failed class. That mapping can show which wrapper stage invoked the recorder without treating the exit as filesystem, network, command, or permission evidence. Offline tests must prove every stage mapping, invalid/mismatched runtime argv rejection, and diagnostic/result coexistence rejection before another native authorization is considered.

This discriminator can separate host-bound runtime output from package environment rewriting. It supplies no permission-boundary, cleanup, readiness, acceptance, or causal claim by itself.
