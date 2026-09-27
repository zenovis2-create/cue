# Three-candidate bounded identity/introspection

2026-09-11. Executor contracts_review. Scope maximum3 candidates agy/grok/nlm, exact inventory paths only. Done: source/PE/wrapper identity and safe invocation route assessment, one documented version command with10s bound, record hashes. Stop on first timeout; no timeout occurred. No model prompt/auth/login/update/install command, auth-home scan, node_modules source read, or global setting change.

## Observations

- agy: both recorded paths are PE executables, not readable shell wrappers. AppData/Local/agy/bin/agy.exe is189485208bytes; .local/bin/agy.exe is164096152bytes. Both hashes match earlier inventory but differ from each other. No embedded product/version metadata. Do not merge installations by command name. Official docs support agy --help; neither executable was launched here, so installed protocol/version and startup side effects remain unverified.
- grok: .grok/bin/grok.exe is145096520bytes; .local/bin/grok.exe is129910600bytes. Both are PE with no embedded product/version metadata and distinct hashes matching inventory. Exact .grok/bin executable --version ran once: exit0,191ms, stdout grok1.0.25 (f7e67d6988e2) [stable], stderr empty. Actual output in grok-version.json preserves spacing. Before/after hash identical. Other path was not executed and must not inherit this version.
- nlm: .local/bin/nlm.exe is46080bytes and contains uv trampoline diagnostics plus embedded __main__.py declaring notebooklm_tools.cli.main:cli_main. Its exact embedded interpreter is AppData/Roaming/uv/tools/notebooklm-mcp-cli/Scripts/python.exe (255200bytes). Only that executable and exact referenced installed package __init__.py/cli/main.py were inspected. Package declaration __version__=0.11.1; this is not a launched CLI version. main.py declares --version and Typer no_args_is_help. Imports/initialization safety is not fully traced; nlm was not executed. No account/config/cookie files were accessed. This identifies the local notebooklm-mcp-cli distribution, not official Google ownership or live NotebookLM/MCP protocol compatibility.

## Route decisions and protocol limits

Use canonical executable path with separate argv, never a PATH alias or shell command string. Grok --version is documented by the publisher and now observed on one installed binary. agy --help is documented but remains unexecuted. nlm --version/--help are declared by its installed CLI source but should wait for bounded import/startup safety inspection if the next unit executes them. No command initializes authentication as part of this work.

Official AGY headless documentation declares text/json/stream-json input/output and structured output flags. Grok publisher README declares headless/ACP support. These are documentation claims, not observed installed-version contracts, cancellation/billing/cleanup guarantees, model availability or M/P eligibility. No qualification is issued.

Grok execution used ProcessStartInfo direct executable/argv, hidden window, redirected pipes and closed stdin, wait10000ms and owned-process-tree kill on timeout. Timeout branch was not exercised. No blanket no-network/side-effect proof is inferred from a successful version command.

Sources:

- https://github.com/xai-org/grok-build (publisher README documents grok --version and headless/ACP)
- https://www.antigravity.google/docs/cli/modes/ (documents agy --help)
- https://www.antigravity.google/docs/cli/headless/ (protocol declarations)
- Previous command-discovery inventory and Claude-introspection report; discovery is not qualification.

Current exact-path SHA256:
- C:\Users\User\AppData\Local\agy\bin\agy.exe : D3BAE6895069231C169F427C99527D1F556951E9C43488F45E8B040FBF3011ED
- C:\Users\User\.local\bin\agy.exe : A09B6862388138F9DFD8FED2570D59FD4F20DD3CC095CF32ADB927FDFC51A0B3
- C:\Users\User\.grok\bin\grok.exe : 387B2B192FD5C82919D8302EBF46FB4A369D14D8BDE1C629C815B0B0C5A40EFC
- C:\Users\User\.local\bin\grok.exe : 51ED25F26FE344E1F2BFDE92F5AB67B8C0C0BEF6287FC523591D49A84850777B
- C:\Users\User\.local\bin\nlm.exe : 495169FC21AACB22152FC99A3E31E3A0F6D46790BF75A5CEDDDF74174FB8386F
- C:\Users\User\AppData\Roaming\uv\tools\notebooklm-mcp-cli\Scripts\python.exe : B70275AD94210FCE7548761143BE5E177769721045E287BB6C80AAC3F928C65B
- C:\Users\User\AppData\Roaming\uv\tools\notebooklm-mcp-cli\Lib\site-packages\notebooklm_tools\__init__.py : BE6FC6FD754C8AA8CA326E974930DF6C26338682B429225C3393435161FC21DB
- C:\Users\User\AppData\Roaming\uv\tools\notebooklm-mcp-cli\Lib\site-packages\notebooklm_tools\cli\main.py : 55F0F8252250A17561CA24755140F31684D8BDC1CD89A0F55985CFDA3B7391F2
