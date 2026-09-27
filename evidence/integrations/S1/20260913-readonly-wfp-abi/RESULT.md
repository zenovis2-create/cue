# Native WFP ABI layout result

Status: PASS. The x64 header-only probe compiled on attempt 2 of 2 after correcting shell quoting and ran once with exit code 0. It made no WFP or other Windows API call.

## Toolchain

- Compiler: `C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Tools\MSVC\14.44.35207\bin\Hostx64\x64\cl.exe`
- Compiler version: Microsoft C/C++ 19.44.35228 for x64
- Windows SDK include version: `10.0.26100.0`
- Primary header: `C:\Program Files (x86)\Windows Kits\10\Include\10.0.26100.0\shared\fwpmtypes.h`
- Compile command: `cl.exe /nologo /std:c++17 /EHsc /W4 /Fe:evidence\integrations\S1\20260913-readonly-wfp-abi\wfp-layout-probe.exe /Fo:evidence\integrations\S1\20260913-readonly-wfp-abi\wfp-layout-probe.obj scripts\reuse\native\wfp-layout-probe.cpp` from the x64 developer environment.
- Measurement command: `evidence\integrations\S1\20260913-readonly-wfp-abi\wfp-layout-probe.exe`

## Exact measurement

```text
pointer.bits=64
sizeof.FWPM_NET_EVENT_HEADER3=136
offsetof.FWPM_NET_EVENT_HEADER3.timeStamp=0
offsetof.FWPM_NET_EVENT_HEADER3.flags=8
offsetof.FWPM_NET_EVENT_HEADER3.ipVersion=12
offsetof.FWPM_NET_EVENT_HEADER3.ipProtocol=16
offsetof.FWPM_NET_EVENT_HEADER3.localAddrV4=20
offsetof.FWPM_NET_EVENT_HEADER3.remoteAddrV4=36
offsetof.FWPM_NET_EVENT_HEADER3.localPort=52
offsetof.FWPM_NET_EVENT_HEADER3.remotePort=54
offsetof.FWPM_NET_EVENT_HEADER3.appId=64
offsetof.FWPM_NET_EVENT_HEADER3.packageSid=96
sizeof.FWPM_NET_EVENT3=152
offsetof.FWPM_NET_EVENT3.header=0
offsetof.FWPM_NET_EVENT3.type=136
offsetof.FWPM_NET_EVENT3.capabilityDrop=144
sizeof.FWPM_NET_EVENT_CAPABILITY_DROP0=24
offsetof.FWPM_NET_EVENT_CAPABILITY_DROP0.networkCapabilityId=0
offsetof.FWPM_NET_EVENT_CAPABILITY_DROP0.filterId=8
offsetof.FWPM_NET_EVENT_CAPABILITY_DROP0.isLoopback=16
sizeof.FWPM_NET_EVENT_SUBSCRIPTION0=32
offsetof.FWPM_NET_EVENT_SUBSCRIPTION0.enumTemplate=0
offsetof.FWPM_NET_EVENT_SUBSCRIPTION0.flags=8
offsetof.FWPM_NET_EVENT_SUBSCRIPTION0.sessionKey=12
sizeof.FWP_VALUE0=16
offsetof.FWP_VALUE0.type=0
offsetof.FWP_VALUE0.uint32=8
sizeof.FWPM_NET_EVENT_CALLBACK2.pointer=8
```

The standalone `output.txt` contains the same console bytes. The `FWPM_NET_EVENT3` and `FWPM_NET_EVENT_CALLBACK2` symbols compiling against this SDK confirm that the intended versioned event and callback declarations are available.

## SHA-256

- Source: `c76826013005ab3f7f3d125253e7481af9b302e9533507c4fc321017ebd74720`
- Executable: `5bee726afa282c215daacd4bcc5d7eb944ef64413aac3ee27a6f13c6bdd2952e`
- Output: `ed519d1b30e7ca6172eb0db8059d5baa16c653c1cf4b9f341a0e371fef93ef1e`
