@echo off
rem Linggan scheduled task entry: sync:events (frontend event inbox -> SQLite product_events)
rem Called by Windows Task Scheduler. Full instructions (Chinese): docs/OPERATIONS.md
rem ASCII-only on purpose: cmd.exe parses batch files with the OEM codepage, so
rem non-ASCII comments would render as mojibake on Chinese Windows.
setlocal

rem This machine defaults to Node v14; the pipeline needs Node >= 22.6
rem (--experimental-strip-types). Override via LINGGAN_NODE_DIR if Node moves.
if not defined LINGGAN_NODE_DIR set "LINGGAN_NODE_DIR=D:\development\nodejs"
set "PATH=%LINGGAN_NODE_DIR%;%PATH%"

rem Project root is two levels up from this script (scripts/scheduled/).
cd /d "%~dp0..\.." || exit /b 1

rem Wrapper log (append): captures output even when Node itself fails to start.
rem Structured JSON run-logs in data\run-logs\<date>\ remain the source of truth.
mkdir "%~dp0..\..\data\run-logs" 2>nul
set "WRAPPER_LOG=%~dp0..\..\data\run-logs\scheduled-sync-events-wrapper.log"
echo [%DATE% %TIME%] sync-events entry started >> "%WRAPPER_LOG%"

rem Version guard: fail fast with exit code 1 when the resolved Node is too old,
rem instead of a confusing TypeScript syntax error from npm run.
node -e "const v=process.versions.node.split('.').map(Number);if(v[0]<22){console.error('Node >= 22.6 required, got '+process.versions.node);process.exit(1)}" >> "%WRAPPER_LOG%" 2>&1 || exit /b 1

call npm run sync:events >> "%WRAPPER_LOG%" 2>&1
exit /b %ERRORLEVEL%
