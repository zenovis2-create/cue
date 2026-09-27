# Native compare/write final pins

- `change-snapshot.exe`: `82ff0f80ecb63293de0eed39296bf66ad51b4cfdeee2d8d7aaea062fae80d07e`
- `main_windows.go`: `d782a8a5da8437417fc4f30e805be21c627df1bcbea07da2b3a7678c2008fdbd`
- `main_other.go`: `0277d1af3fc37f03a053dbf431aaaa99f742b84ced351266c445949acdf055d8`
- `go.mod`: `0edebd0660f8677d4fd0806ff805b442f74bcf77fffdfe1120364685ffb78415`
- `main_windows_test.go`: `130052aab38f5bb1aca14fa07cf63464c7b7d641e223dade978a3b3fd3428566`
- `manifest.json`: `ea238284edd4069f181fb31ec5b42817e1fd81d54973715649c3021488c0dacf`
- `change-snapshot-host.ts`: `b83901ed2a1e3b02c9f3078ae89206109f26e5f95181aca5a49dc7951b49e450`
- `integration-change-records-native.test.ts`: `4e1f9a4253a50e6293602521034017ee9e307817e26e565a33478b13281cbaac`
- `integration-change-snapshot-host-protocol.test.ts`: `82a39f0c9dc032ca48da4670fbefefe8b4e0525cb48e4c0e852454a6bea62115`

Build command: `go build -trimpath -ldflags '-s -w -buildid=' -o change-snapshot.exe .`

The manifest retains `cue-change-snapshot-v1` for the existing identify/snapshot surface and separately binds `compareWriteProtocol` to `cue-change-snapshot-v2`.
