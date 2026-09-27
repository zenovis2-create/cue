Build-pass3: root reported npm run build exit 0.
Packaged companion gate: npx vitest run test/integration-model-qualification.test.ts test/integration-fixed-model-qualification.test.ts test/integration-native-execution-identity-store.test.ts test/integration-goal-proposal-checker-client.test.ts --reporter=verbose (daemon cwd): PASS 26/26, four files.
Goal production vectors exercised real pinned pass/structural_match, fail/checker_registry, unknown/input_contract child verdicts with native identity and verified cleanup. Fixture qualification M1-M3 pass, eligible=false; model/json existing legs pass.
Narrow boundary corrections: persisted native identity accepts exactly goal-proposal-checker among known kinds; goal adapter compares sorted verdict keys in sorted order.
Manual diagnostic script probe-native-goal.mjs confirmed the native launcher emitted checker_request and checker_result, clean exit and cleanup before adapter corrections.
Final SHA256:
daemon/src/model-qualification.ts SHA256 36F3AAB7992929BAB4FBF6105DCC039F704502A78E5AFF4BE4F7F7600FEC6B34
daemon/src/native-execution-identity-store.ts SHA256 5FBFBC92C3F22B5177A9244ECF169C6F3B1285C7E13D18DEAB3F89F26FDC289B
daemon/src/adapters/isolated-goal-proposal-checker.ts SHA256 41DFB3634293C8B26463F32323CE97CC066689DDD7FD0751F9AE404555DC5B7F
daemon/test/integration-model-qualification.test.ts SHA256 ABE5BDDA65B0B40BEB227CCF1617324C4A80321D08192C5FFDE23FF47BC4C73D
daemon/test/integration-native-execution-identity-store.test.ts SHA256 261F1F818A658003C618409F0E9BFF2EC2063466367D9A6DE97C0A4255524C28
daemon/dist/src/model-qualification.js SHA256 06F86FF2D87CD8EBE98E15C721956D4F63531D27DC83652A22315CFBD4BA9A26
daemon/dist/src/native-execution-identity-store.js SHA256 45B6BB33BB7B18065AE7E0B2ADEEAB2473873014B9B7384B94945E2992206647
daemon/dist/src/adapters/isolated-goal-proposal-checker.js SHA256 F90B104DC9ADB6CBE446C1B4FD0EC933A62651EADC5D8D70842C0B526687E77E
daemon/dist/src/goal-proposal-checker-client.cjs SHA256 C7DEB44A926C792985B869E0AB4D1C011CD18D61D0267EA8EC1BDBBB06C03526
daemon/dist/src/verification/goal-proposal-checker.cjs SHA256 CCD7598C57306FF1E3FD2B0DF1468F43A7D3F466E39E57D9F83EBA2EC26F9D62
