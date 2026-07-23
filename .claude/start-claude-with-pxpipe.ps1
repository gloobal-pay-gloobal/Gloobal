# start-claude-with-pxpipe.ps1
#
# Convenience entry point at the repo root — launches Claude Code routed
# through the local pxpipe token-saving proxy. This just calls the
# canonical script at .claude\pxpipe\start-claude-through-pxpipe.ps1; see
# that file (and .claude\pxpipe\README.md) for what it actually does and
# for the full two-window explanation.
#
# BEFORE running this script: start the pxpipe proxy in its own PowerShell
# window and leave it running (.claude\pxpipe\start-proxy.ps1, or directly
# npx --yes pxpipe-proxy@latest). This script does NOT start the proxy
# itself — a proxy running in the background of a script window is easy to
# lose track of / kill by accident — it only points Claude Code at it.
#
#   PowerShell window 1 (leave open):
#     .\.claude\pxpipe\start-proxy.ps1
#
#   PowerShell window 2 (run this script):
#     .\.claude\start-claude-with-pxpipe.ps1

& (Join-Path $PSScriptRoot "pxpipe\start-claude-through-pxpipe.ps1")
