# start-claude-through-pxpipe.ps1
#
# Run this in PowerShell WINDOW 2, AFTER window 1 is already running
# start-proxy.ps1 (or `npx --yes pxpipe-proxy@latest` directly).
#
# What this script actually does:
#   1. Checks the proxy is reachable at http://127.0.0.1:47821
#   2. Sets $env:ANTHROPIC_BASE_URL for THIS PowerShell process only
#   3. Prints an honest note about which Claude Code models pxpipe
#      currently compresses by default (most don't, see below)
#   4. Starts `claude`
#
# IMPORTANT — installing the pxpipe-token-saver skill does NOT save any
# tokens by itself. Tokens are only saved when Claude Code's own process
# was STARTED with ANTHROPIC_BASE_URL pointed at the proxy, which is what
# this script does. A Claude Code session already running (e.g. one you
# started normally, without this script) cannot be switched into the
# proxy retroactively — you have to start a NEW session via this script.
#
# Usage:
#   cd "C:\Users\Chanchal Sharma\Desktop\Gloobal"
#   .\.claude\pxpipe\start-claude-through-pxpipe.ps1

$proxyUrl = "http://127.0.0.1:47821"

Write-Host "=== Claude Code via pxpipe ===" -ForegroundColor Cyan
Write-Host "Checking proxy at $proxyUrl ..."

$proxyUp = $false
try {
    Invoke-WebRequest -Uri $proxyUrl -UseBasicParsing -TimeoutSec 3 | Out-Null
    $proxyUp = $true
    Write-Host "Proxy is UP." -ForegroundColor Green
}
catch {
    Write-Host ""
    Write-Host "pxpipe proxy is NOT reachable at $proxyUrl." -ForegroundColor Red
    Write-Host "Open ANOTHER PowerShell window FIRST and run:" -ForegroundColor Yellow
    Write-Host "    .\.claude\pxpipe\start-proxy.ps1" -ForegroundColor Yellow
    Write-Host "  (or directly: npx --yes pxpipe-proxy@latest)" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "That window must stay open the whole time you want routing active." -ForegroundColor Yellow
    Write-Host ""
    $answer = Read-Host "Continue anyway and start Claude Code unrouted? (y/N)"
    if ($answer -ne "y" -and $answer -ne "Y") {
        Write-Host "Cancelled. Start the proxy first, then re-run this script." -ForegroundColor Yellow
        exit 1
    }
}

if ($proxyUp) {
    Write-Host ""
    Write-Host "Model support note (verified from pxpipe-proxy source, 2026-07-10):" -ForegroundColor Cyan
    Write-Host "  By default pxpipe only compresses these model bases:"
    Write-Host "    - claude-fable-5"
    Write-Host "    - gpt-5.6"
    Write-Host "  Claude Sonnet 5, Claude Opus 4.8, and Claude Haiku 4.5 are NOT in the"
    Write-Host "  default list, so requests from those models will show up in"
    Write-Host "  events.jsonl as compressed:false, reason:unsupported_model."
    Write-Host "  This is intentional (Opus 4.8 measurably reads imaged content worse"
    Write-Host "  than Fable 5, per the proxy's own FINDINGS.md) — not a bug."
    Write-Host ""

    # This process only sets $env:PXPIPE_MODELS for THIS window (window 2),
    # which does nothing — the proxy (window 1) is what needs the var set,
    # before start-proxy.ps1 runs. This prompt just tells you what to copy
    # into window 1's env, or skip and use the dashboard toggle instead.
    Write-Host "Pick which models pxpipe should compress (accuracy tradeoff above applies" -ForegroundColor Cyan
    Write-Host "to every choice except Fable 5 only):"
    Write-Host "  [1] Fable 5 only (default, validated — press Enter)"
    Write-Host "  [2] Fable 5 + Sonnet 5"
    Write-Host "  [3] Fable 5 + Opus 4.8"
    Write-Host "  [4] Fable 5 + Haiku 4.5"
    Write-Host "  [5] All Claude models (Fable 5, Sonnet 5, Opus 4.8, Haiku 4.5) + gpt-5.6"
    $modelChoice = Read-Host "Choice (1-5, Enter = 1)"

    $pxpipeModels = switch ($modelChoice) {
        "2" { "claude-fable-5,claude-sonnet-5,gpt-5.6" }
        "3" { "claude-fable-5,claude-opus-4-8,gpt-5.6" }
        "4" { "claude-fable-5,claude-haiku-4-5,gpt-5.6" }
        "5" { "claude-fable-5,claude-sonnet-5,claude-opus-4-8,claude-haiku-4-5,gpt-5.6" }
        default { "" }
    }

    if ($pxpipeModels) {
        Write-Host ""
        Write-Host "  This window (window 2) can't change the proxy's compression set." -ForegroundColor Yellow
        Write-Host "  Go to window 1 (the one running start-proxy.ps1), stop it (Ctrl+C)," -ForegroundColor Yellow
        Write-Host "  and restart it with:" -ForegroundColor Yellow
        Write-Host "    `$env:PXPIPE_MODELS = `"$pxpipeModels`"" -ForegroundColor Yellow
        Write-Host "    .\.claude\pxpipe\start-proxy.ps1" -ForegroundColor Yellow
        Write-Host "  Or open $proxyUrl/ and flip the toggle live (no restart needed)." -ForegroundColor Yellow
        Write-Host ""
    } else {
        Write-Host "  Keeping default (Fable 5, gpt-5.6 only)." -ForegroundColor Green
        Write-Host ""
    }
}

$env:ANTHROPIC_BASE_URL = $proxyUrl
Write-Host "ANTHROPIC_BASE_URL set to $proxyUrl for this session." -ForegroundColor Green
Write-Host "Starting claude..."
Write-Host ""

$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $repoRoot

claude
