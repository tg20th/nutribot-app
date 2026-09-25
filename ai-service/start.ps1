$ErrorActionPreference = "Stop"

Set-Location -LiteralPath $PSScriptRoot

$environmentFile = Join-Path $PSScriptRoot ".env"
$environmentExample = Join-Path $PSScriptRoot ".env.example"
$pythonExecutable = Join-Path $PSScriptRoot ".venv\Scripts\python.exe"

if (-not (Test-Path -LiteralPath $environmentFile)) {
    Copy-Item -LiteralPath $environmentExample -Destination $environmentFile
    Write-Host "Created ai-service/.env. Add GEMINI_API_KEY and run this script again."
    exit 1
}

$apiKeyLine = Get-Content -LiteralPath $environmentFile |
    Where-Object { $_ -match '^GEMINI_API_KEY=' } |
    Select-Object -First 1
$apiKey = if ($apiKeyLine) { ($apiKeyLine -split '=', 2)[1].Trim() } else { "" }

if ([string]::IsNullOrWhiteSpace($apiKey) -or $apiKey -eq "your_gemini_api_key_here") {
    Write-Host "Add your API key to GEMINI_API_KEY in ai-service/.env."
    exit 1
}

if (-not (Test-Path -LiteralPath $pythonExecutable)) {
    Write-Host "Creating the Python virtual environment..."
    python -m venv .venv
}

Write-Host "Installing Python dependencies..."
& $pythonExecutable -m pip install -r requirements.txt

Write-Host "NutriBot AI Service is running at http://localhost:8000"
& $pythonExecutable -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
