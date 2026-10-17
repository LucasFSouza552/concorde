# Compila o helper nativo de captura (WASAPI Process Loopback).
# Requer Visual Studio Build Tools (MSVC) com vcvars64.bat.
#
#   powershell -ExecutionPolicy Bypass -File build.ps1        # so o capturador
#   powershell -ExecutionPolicy Bypass -File build.ps1 -Test  # + gerador de tom

param(
    [switch]$Test
)

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
$resDir = [System.IO.Path]::GetFullPath((Join-Path $root "..\..\resources\loopback"))
$buildDir = Join-Path $root "build"
New-Item -ItemType Directory -Force -Path $resDir | Out-Null
New-Item -ItemType Directory -Force -Path $buildDir | Out-Null

$vcvars = $null
$vswhere = Join-Path ${env:ProgramFiles(x86)} "Microsoft Visual Studio\Installer\vswhere.exe"
if (Test-Path $vswhere) {
    $vsPath = & $vswhere -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath
    if ($vsPath) {
        $cand = Join-Path $vsPath "VC\Auxiliary\Build\vcvars64.bat"
        if (Test-Path $cand) { $vcvars = $cand }
    }
}
if (-not $vcvars) {
    $fallback = "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvars64.bat"
    if (Test-Path $fallback) { $vcvars = $fallback }
}
if (-not $vcvars) { throw "vcvars64.bat nao encontrado (instale VS Build Tools com C++)." }

$commonFlags = "/nologo /O2 /EHsc /MT /std:c++17 /DNDEBUG"
$libs = "onecoreuap.lib ole32.lib user32.lib"

function Build-Native([string]$src, [string]$out) {
    Write-Output "compilando $(Split-Path $src -Leaf) -> $out"
    $obj = Join-Path $buildDir ((Split-Path $src -Leaf) -replace '\.cpp$', '.obj')
    $cmd = "call `"$vcvars`" >nul 2>&1 && cl $commonFlags `"$src`" /Fe:`"$out`" /Fo:`"$obj`" /link $libs"
    & cmd /c $cmd
    if ($LASTEXITCODE -ne 0) { throw "falha ao compilar $src" }
}

Build-Native (Join-Path $root "capture.cpp") (Join-Path $resDir "concorde-loopback-capture.exe")

if ($Test) {
    Build-Native (Join-Path $root "test\tone.cpp") (Join-Path $buildDir "tone.exe")
}

Write-Output "OK -> $resDir\concorde-loopback-capture.exe"
