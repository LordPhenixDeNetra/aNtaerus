$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $root ".env"

function Get-DotEnvValues {
    param(
        [string]$FilePath
    )

    $values = @{}
    if (-not (Test-Path $FilePath)) {
        return $values
    }

    foreach ($line in Get-Content -Path $FilePath) {
        $trimmed = $line.Trim()
        if (-not $trimmed -or $trimmed.StartsWith("#")) {
            continue
        }

        $parts = $trimmed -split "=", 2
        if ($parts.Count -ne 2) {
            continue
        }

        $key = $parts[0].Trim()
        $value = $parts[1].Trim()
        if ($value.Length -ge 2) {
            $isDoubleQuoted = $value.StartsWith('"') -and $value.EndsWith('"')
            $isSingleQuoted = $value.StartsWith("'") -and $value.EndsWith("'")
            if ($isDoubleQuoted -or $isSingleQuoted) {
                $value = $value.Substring(1, $value.Length - 2)
            }
        }

        $values[$key] = $value
    }

    return $values
}

function Get-ConfiguredValue {
    param(
        [hashtable]$DotEnv,
        [string[]]$Names
    )

    foreach ($name in $Names) {
        $runtimeValue = [Environment]::GetEnvironmentVariable($name)
        if (-not [string]::IsNullOrWhiteSpace($runtimeValue)) {
            return $runtimeValue
        }

        if ($DotEnv.ContainsKey($name) -and -not [string]::IsNullOrWhiteSpace($DotEnv[$name])) {
            return $DotEnv[$name]
        }
    }

    return $null
}

function Test-Is64BitPEFile {
    param(
        [string]$FilePath
    )

    try {
        $stream = [System.IO.File]::Open($FilePath, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, [System.IO.FileShare]::ReadWrite)
        $reader = [System.IO.BinaryReader]::new($stream)

        try {
            $stream.Position = 0x3C
            $peHeaderOffset = $reader.ReadInt32()
            $stream.Position = $peHeaderOffset + 4
            $machine = $reader.ReadUInt16()
            return $machine -eq 0x8664
        }
        finally {
            $reader.Dispose()
            $stream.Dispose()
        }
    } catch {
        return $false
    }
}

function Resolve-LibClangDirectory {
    param(
        [string]$Candidate
    )

    if ([string]::IsNullOrWhiteSpace($Candidate)) {
        return $null
    }

    $trimmed = $Candidate.Trim()
    if ((Test-Path -Path $trimmed -PathType Leaf) -and ([System.IO.Path]::GetFileName($trimmed) -ieq "libclang.dll")) {
        if (Test-Is64BitPEFile -FilePath $trimmed) {
            return Split-Path -Parent $trimmed
        }

        return $null
    }

    $dllPath = Join-Path $trimmed "libclang.dll"
    if (Test-Path -Path $dllPath -PathType Leaf) {
        if (Test-Is64BitPEFile -FilePath $dllPath) {
            return $trimmed
        }

        return $null
    }

    return $null
}

function Get-CommonLibClangDirectories {
    $programFiles = [Environment]::GetFolderPath("ProgramFiles")
    return @(
        (Join-Path $programFiles "LLVM\\bin"),
        (Join-Path $programFiles "Microsoft Visual Studio\\2022\\Community\\VC\\Tools\\Llvm\\x64\\bin"),
        (Join-Path $programFiles "Microsoft Visual Studio\\2022\\Professional\\VC\\Tools\\Llvm\\x64\\bin"),
        (Join-Path $programFiles "Microsoft Visual Studio\\2022\\Enterprise\\VC\\Tools\\Llvm\\x64\\bin"),
        (Join-Path $programFiles "Microsoft Visual Studio\\2022\\BuildTools\\VC\\Tools\\Llvm\\x64\\bin")
    )
}

$voiceFeatureEnabled = $true

function Initialize-EngineBuildEnvironment {
    param(
        [ref]$VoiceEnabledRef
    )
    $dotEnv = Get-DotEnvValues -FilePath $envFile

    foreach ($mapping in @(
            @{ Target = "ONNX_RUNTIME_DIR"; Sources = @("ONNX_RUNTIME_DIR", "ANTAERUS_ENGINE_ONNX_RUNTIME_DIR") },
            @{ Target = "ONNX_INCLUDE_PATH"; Sources = @("ONNX_INCLUDE_PATH", "ANTAERUS_ENGINE_ONNX_INCLUDE_PATH") }
        )) {
        $configuredValue = Get-ConfiguredValue -DotEnv $dotEnv -Names $mapping.Sources
        if (-not [string]::IsNullOrWhiteSpace($configuredValue)) {
            [Environment]::SetEnvironmentVariable($mapping.Target, $configuredValue)
        }
    }

    $configuredLibClang = Get-ConfiguredValue -DotEnv $dotEnv -Names @(
        "LIBCLANG_PATH",
        "ANTAERUS_ENGINE_LIBCLANG_PATH"
    )

    if (-not [string]::IsNullOrWhiteSpace($configuredLibClang)) {
        $resolvedLibClang = Resolve-LibClangDirectory -Candidate $configuredLibClang
        if (-not $resolvedLibClang) {
            Write-Warning "[aNtaerus] LIBCLANG_PATH pointe vers '$configuredLibClang' mais libclang.dll absent/invalide 64 bits. Feature 'voice' DESACTIVEE, demarrage en mode core. Pour la voix : installez LLVM (winget install LLVM.LLVM) puis relancez dev-all."
            $VoiceEnabledRef.Value = $false
            return
        }

        [Environment]::SetEnvironmentVariable("LIBCLANG_PATH", $resolvedLibClang)
        return
    }

    foreach ($candidate in Get-CommonLibClangDirectories) {
        $resolvedLibClang = Resolve-LibClangDirectory -Candidate $candidate
        if ($resolvedLibClang) {
            [Environment]::SetEnvironmentVariable("LIBCLANG_PATH", $resolvedLibClang)
            return
        }
    }

    Write-Warning "[aNtaerus] Aucun libclang.dll 64 bits trouve (LLVM). Feature 'voice' DESACTIVEE, demarrage en mode core. Correctif : winget install LLVM.LLVM, ou renseignez ANTAERUS_ENGINE_LIBCLANG_PATH dans antaerus/.env."
    $VoiceEnabledRef.Value = $false
}

Initialize-EngineBuildEnvironment -VoiceEnabledRef ([ref]$voiceFeatureEnabled)
Set-Location (Join-Path $root "providers\\engine_rust")

if ($voiceFeatureEnabled) {
    Write-Host "[aNtaerus] Démarrage engine_rust AVEC feature 'voice' (libclang OK)." -ForegroundColor Cyan
    cargo run --features voice
} else {
    Write-Host "[aNtaerus] Démarrage engine_rust mode CORE (sans voice). Endpoint /health sera joignable sur http://localhost:7000." -ForegroundColor Yellow
    cargo run
}
