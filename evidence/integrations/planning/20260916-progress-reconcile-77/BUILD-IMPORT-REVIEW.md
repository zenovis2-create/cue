# Native compiled-import build correction review

Date: 2026-09-16 (Asia/Seoul)  
Reviewer: `provider_installation72`, independent of the root-owned build correction  
Verdict: **CLEAR**

## Reviewed change

The preserved `daemon/scripts/copy-assets.mjs` preimage matches SHA-256 `AB5BB35D383E9A413D09BC55E4938DEBCAB3FFB9B25662E8FD4CFD8D52C3270D`. The current script SHA-256 is `3B66B60AE2D3E7877FBC0D0995DCC23138E9917A1FB43A382E2DFEAEB6D6BD07`.

The diff adds one exact post-compile relocation loop for two emitted modules, `native-provider-measurement-subject` and `native-account-observation`. It changes exactly one preserved TypeScript import in each emitted file from `../../app/provider-installation.mjs` to `../../../app/provider-installation.mjs`, which resolves from `daemon/dist/src` to the existing root `app` module. The loop requires either one source specifier before relocation or one already-relocated specifier; missing, duplicate, or mixed matches fail the build.

The correction does not copy `provider-installation.mjs` into `daemon`, so the built modules continue sharing the single application issuer and its private identity state. No production TypeScript/source authority module changed in this correction.

## Smoke and regression evidence

The new compiled-import smoke SHA-256 is `F0859FCEBA052E6EB222568450BDF473A0BDFA69A9B27B050DB4F41374C375DC`. It launches an ordinary Node process that imports the two compiled modules and checks five public exports are functions. It does not invoke those exports, launch a provider, read credentials, call a model, or access the network.

The coordinated build completed with exit 0. The compiled-import gate passed **17/17 tests in 4 files** with zero failures, covering the smoke plus account observation, native subject measurement, and provider-installation binding regressions. Gate SHA-256: `AEEA308F703AAFAC8A1B0E794E0CCAFCE508435BCB9124FD90C8EB722F0EEFA6`. Plan SHA-256: `FF04B8760496AF2089FD3490A3F2A41FCF29FC9D71D95F135FD16C860D10AE26`.

The expected emitted compiled-subject hash changes because its import specifier now points to the correct root application module. Any earlier compiled-asset pin remains valid only for its historical build and is superseded for the current build; this review does not rewrite earlier results. Root owns the separate current-pin refresh.

This verdict covers only compiled module resolution and importability. It does not authenticate, entitle, qualify, or invoke a provider and does not close the native authority workflow or S1.
