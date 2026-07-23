# start-proxy.ps1
#
# Run this in PowerShell WINDOW 1 and leave it open. It starts the local
# pxpipe token-saving proxy and does nothing else — no Claude Code launch
# here, so you don't lose track of the proxy process by closing the wrong
# window later.
#
# Usage:
#   cd "C:\Users\Chanchal Sharma\Desktop\Gloobal"
#   .\.claude\pxpipe\start-proxy.ps1

Write-Host "=== pxpipe proxy ===" -ForegroundColor Cyan
Write-Host "Starting on http://127.0.0.1:47821 ..."
Write-Host "Dashboard will be at:  http://127.0.0.1:47821/"
Write-Host "Leave THIS window open. Close it (Ctrl+C) to stop the proxy."
Write-Host ""

npx --yes pxpipe-proxy@latest
