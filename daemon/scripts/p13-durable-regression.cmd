@echo off
REM Durable full-regression runner. Detached from the shell that starts it so the
REM caller's lifetime cannot decide whether evidence exists. Absolute rule 2: a
REM timeout is a FAIL, never silence - the exit line is written unconditionally.
set "CUE_VENDOR_CODEX=C:/Users/User/cue-toolchain/node_modules/@openai/codex-win32-x64/vendor/x86_64-pc-windows-msvc/bin/codex.exe"
set "LOG=C:\Users\User\cue\evidence\P13\%~1"
cd /d C:\Users\User\cue\daemon
echo runner_pid=%~2 started=%DATE% %TIME% > "%LOG%"
echo CUE_VENDOR_CODEX=%CUE_VENDOR_CODEX% >> "%LOG%"
call npm.cmd test >> "%LOG%" 2>&1
echo exit=%ERRORLEVEL% >> "%LOG%"
echo finished=%DATE% %TIME% >> "%LOG%"
