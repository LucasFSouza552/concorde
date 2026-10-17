# Testes de captura e isolamento (sem Electron).
#   powershell -ExecutionPolicy Bypass -File isolate.ps1
#
# T1 positivo: captura do proprio tom         -> peak ~= amp
# T2 isolamento x processo silencioso          -> peak ~= 0
# T3 isolamento entre dois apps com audio      -> captura de B nao contem o tom de A

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
$cap  = [System.IO.Path]::GetFullPath((Join-Path $root "..\..\..\resources\loopback\concorde-loopback-capture.exe"))
$tone = Join-Path $root "..\build\tone.exe"
if (-not (Test-Path $cap))  { throw "capturador nao encontrado: $cap" }
if (-not (Test-Path $tone)) { throw "tone.exe nao encontrado (rode build.ps1 -Test)" }

$tmp = Join-Path $env:TEMP "concorde-loopback-test"
New-Item -ItemType Directory -Force -Path $tmp | Out-Null

function Analyze([string]$file) {
    $bytes = [System.IO.File]::ReadAllBytes($file)
    $nl = [Array]::IndexOf($bytes, [byte]10)
    if ($nl -lt 0) { return @{ error = "sem header"; peak = -1 } }
    $h = ([System.Text.Encoding]::ASCII.GetString($bytes, 0, $nl)) | ConvertFrom-Json
    $len = $bytes.Length - $nl - 1
    $pcm = New-Object byte[] $len
    [Array]::Copy($bytes, $nl + 1, $pcm, 0, $len)
    $peak = 0.0
    if ($h.encoding -eq "f32le") {
        for ($i = 0; $i + 4 -le $len; $i += 4) {
            $a = [Math]::Abs([BitConverter]::ToSingle($pcm, $i)); if ($a -gt $peak) { $peak = $a }
        }
    } elseif ($h.encoding -eq "s16le") {
        for ($i = 0; $i + 2 -le $len; $i += 2) {
            $a = [Math]::Abs([BitConverter]::ToInt16($pcm, $i) / 32768.0); if ($a -gt $peak) { $peak = $a }
        }
    }
    $frameBytes = ($h.bits / 8) * $h.channels
    return @{
        rate = $h.rate; channels = $h.channels; encoding = $h.encoding
        frames = [int]($len / $frameBytes); peak = [Math]::Round($peak, 4)
    }
}

function Capture([int]$procId, [string]$out) {
    & cmd /c "`"$cap`" --pid $procId --seconds 2 > `"$out`""
    if ($LASTEXITCODE -ne 0) { Write-Output "  (capturador saiu com codigo $LASTEXITCODE)" }
}

function Start-Tone([string]$id, [double]$amp, [double]$freq, [int]$sec) {
    Start-Process -FilePath $tone -ArgumentList "--seconds", "$sec", "--freq", "$freq", "--amp", "$amp", "--id", "$id" -PassThru
}

Write-Output "== T1: positivo (capturar o proprio tom A, amp 0.05) =="
$t1 = Start-Tone "A" 0.05 440 4
Start-Sleep -Milliseconds 400
Capture $t1.Id "$tmp\t1.bin"
$r1 = Analyze "$tmp\t1.bin"

Write-Output "== T2: tom A tocando, capturar processo SILENCIOSO (esperado ~0) =="
$silent = Start-Process powershell -ArgumentList "-NoProfile","-Command","Start-Sleep 6" -PassThru
$a2 = Start-Tone "A" 0.05 440 5
Start-Sleep -Milliseconds 500
Capture $silent.Id "$tmp\t2.bin"
$r2 = Analyze "$tmp\t2.bin"

Write-Output "== T3: dois apps com audio (A amp .05, B amp .02) =="
$a3 = Start-Tone "A" 0.05 440 5
$b3 = Start-Tone "B" 0.02 660 5
Start-Sleep -Milliseconds 500
Capture $a3.Id "$tmp\t3a.bin"
Capture $b3.Id "$tmp\t3b.bin"
$ra = Analyze "$tmp\t3a.bin"
$rb = Analyze "$tmp\t3b.bin"

Get-Process tone -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue

Write-Output ""
Write-Output "RESULTADOS (formato: $($r1.rate)Hz/$($r1.channels)ch/$($r1.encoding))"
Write-Output ("  T1  captura tom A (amp .05)     : peak={0}  frames={1}" -f $r1.peak, $r1.frames)
Write-Output ("  T2  tom A x proc silencioso     : peak={0}  (esperado ~0)" -f $r2.peak)
Write-Output ("  T3a captura A (amp .05)         : peak={0}" -f $ra.peak)
Write-Output ("  T3b captura B (amp .02)         : peak={0}  (deve ser ~0.02, NAO 0.05)" -f $rb.peak)
Write-Output ""
$pass1 = ($r1.peak -gt 0.03 -and $r1.peak -lt 0.08)
$pass2 = ($r2.peak -lt 0.005)
$pass3 = ($ra.peak -gt 0.03 -and $ra.peak -lt 0.08 -and $rb.peak -gt 0.012 -and $rb.peak -lt 0.03)
Write-Output ("  T1 positivo .......... {0}" -f ($(if ($pass1) { "PASS" } else { "FAIL" })))
Write-Output ("  T2 isolamento global . {0}" -f ($(if ($pass2) { "PASS" } else { "FAIL" })))
Write-Output ("  T3 isolamento por app  {0}" -f ($(if ($pass3) { "PASS" } else { "FAIL" })))
if ($pass1 -and $pass2 -and $pass3) { Write-Output "  ==> ISOLAMENTO CONFIRMADO" } else { Write-Output "  ==> REVISAR" }
