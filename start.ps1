# UCL MPA ESG Assistant - Startup Script
# Port: 4999
# Auto-kill process if port is occupied

$TargetPort = 4999
$ViteHost = "0.0.0.0"

Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "  UCL MPA ESG Assistant Start" -ForegroundColor Cyan
Write-Host "  Port: $TargetPort" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

# Check if port is occupied
Write-Host "[1/3] Checking port $TargetPort..." -ForegroundColor Yellow

$connection = Get-NetTCPConnection -LocalPort $TargetPort -ErrorAction SilentlyContinue

if ($connection) {
    Write-Host "Warning: Port $TargetPort is occupied" -ForegroundColor Red
    
    # Get process using the port
    $processId = $connection.OwningProcess
    $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
    
    if ($process) {
        Write-Host "    Process: $($process.ProcessName) (PID: $processId)" -ForegroundColor Red
        Write-Host "    Killing process..." -ForegroundColor Yellow
        
        try {
            # Force kill process
            Stop-Process -Id $processId -Force -ErrorAction Stop
            Write-Host "Success: Process killed" -ForegroundColor Green
            
            # Wait for port release
            Start-Sleep -Seconds 2
        }
        catch {
            Write-Host "Error: Cannot kill process - $_" -ForegroundColor Red
            Write-Host "Please kill manually or run as Administrator" -ForegroundColor Red
            exit 1
        }
    }
}
else {
    Write-Host "Success: Port $TargetPort is available" -ForegroundColor Green
}

Write-Host ""

# Check if pnpm is installed
Write-Host "[2/3] Checking pnpm installation..." -ForegroundColor Yellow

$pnpmCheck = Get-Command pnpm -ErrorAction SilentlyContinue

if (-not $pnpmCheck) {
    Write-Host "Error: pnpm not installed" -ForegroundColor Red
    Write-Host "Please run: npm install -g pnpm" -ForegroundColor Yellow
    exit 1
}

$pnpmVersion = & pnpm --version
Write-Host "Success: pnpm version $pnpmVersion" -ForegroundColor Green
Write-Host ""

# Start dev server
Write-Host "[3/3] Starting dev server..." -ForegroundColor Yellow
Write-Host ""

# Start Vite with specified port and host
& pnpm run dev --port $TargetPort --host $ViteHost
