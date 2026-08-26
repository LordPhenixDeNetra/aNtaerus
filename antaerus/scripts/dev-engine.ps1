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
            # =============================================================
            # AVERTISSEMENT SEULEMENT, NE PLUS DESACTIVER VOICE !
            # Auparavant: $VoiceEnabledRef.Value = $false
            # Maintenant: voice = STT micro (cpal/silero/whisper). Cargo va faire le check de build lui-même.
            # Si whisper-rs-sys plante (libclang missing), on fallback sur CORE SANS features plus bas.
            # =============================================================
            Write-Warning "[aNtaerus] LIBCLANG_PATH pointe vers '$configuredLibClang' mais libclang.dll absent/invalide 64 bits. Tentative build STT voice quand-meme (whisper-rs-sys risque de rater E0080). Si echec: fallback mode core."
        } else {
            [Environment]::SetEnvironmentVariable("LIBCLANG_PATH", $resolvedLibClang)
        }
        return
    }

    foreach ($candidate in Get-CommonLibClangDirectories) {
        $resolvedLibClang = Resolve-LibClangDirectory -Candidate $candidate
        if ($resolvedLibClang) {
            [Environment]::SetEnvironmentVariable("LIBCLANG_PATH", $resolvedLibClang)
            return
        }
    }

    Write-Warning "[aNtaerus] Aucun libclang.dll 64 bits trouve (LLVM). Tentative build STT voice quand-meme (risque E0080 whisper bindings). Si echec: fallback mode core. Correctif: winget install LLVM.LLVM v18, puis renseignez ANTAERUS_ENGINE_LIBCLANG_PATH dans antaerus/.env."
    # (JAMAIS $VoiceEnabledRef.Value = $false — cargo va decider.)
}

# ====== NOUVELLE REGLE: Voice est TOUJOURS active par DEFAUT ! ==========
# (Cargo features reorganise: voice = STT micro (cpal/silero/whisper). TTS piper optionnel.)
# Fallback est gere plus bas: si cargo run --features voice echoue (pas de LLVM/libclang/cmake/MSBuild), on tombe CORE.
$voiceFeatureEnabled = $true
Initialize-EngineBuildEnvironment -VoiceEnabledRef ([ref]$voiceFeatureEnabled)
$voiceFeatureEnabled = $true   # FORCE TRUE FINAL. Ignore les anciens warnings.
Set-Location (Join-Path $root "providers\\engine_rust")

# ===== AUTO-LOAD MSVC Build Tools environment (cl.exe, stdbool.h, linker) =====
# Si l'utilisateur a lance depuis un PS normal (pas "Developer PowerShell for VS 2022"), on importe INCLUDE/LIB/PATH via VsDevShell.
if (-not (Get-Command "cl.exe" -ErrorAction SilentlyContinue)) {
    $vsWhere = Join-Path ${env:ProgramFiles(x86)} "Microsoft Visual Studio\Installer\vswhere.exe"
    if (Test-Path $vsWhere) {
        $vsInstallPath = & $vsWhere -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath
        if ($vsInstallPath -and (Test-Path (Join-Path $vsInstallPath "Common7\Tools\Microsoft.VisualStudio.DevShell.dll"))) {
            Write-Host "[aNtaerus] DevShell: Chargement environnement MSVC Build Tools depuis `"$vsInstallPath`"..." -ForegroundColor Gray
            Import-Module (Join-Path $vsInstallPath "Common7\Tools\Microsoft.VisualStudio.DevShell.dll") -ErrorAction SilentlyContinue
            try {
                Enter-VsDevShell -VsInstallPath:$vsInstallPath -SkipAutomaticLocation -DevCmdArguments "-arch=x64 -host_arch=x64 -no_logo" | Out-Null
            } catch {
                Write-Warning "[aNtaerus] DevShell auto-load echoue. Pour eviter 'stdbool.h missing' ou 'cmake VS generator fail', relancez scripts/dev-all.ps1 depuis: Menu Demarrer > 'Developer PowerShell for VS 2022'."
            }
        }
    }
}

# ===== Runtime PATH: ONNX Runtime DLL (onnxruntime.dll doit etre trouvable avant lancement) =====
$ovrd = [Environment]::GetEnvironmentVariable("ONNX_RUNTIME_DIR")
if (-not $ovrd) { $ovrd = [Environment]::GetEnvironmentVariable("ANTAERUS_ENGINE_ONNX_RUNTIME_DIR") }
if ($ovrd) {
    $onnxLibDir = Join-Path $ovrd "lib"
    if (Test-Path (Join-Path $onnxLibDir "onnxruntime.dll")) {
        $env:PATH = "$onnxLibDir;$env:PATH"
        [Environment]::SetEnvironmentVariable("PATH", $env:PATH)
        Write-Host "[aNtaerus] PATH ONNX Runtime (DLL): $onnxLibDir" -ForegroundColor Gray
    }
}

# ===== clang / LLVM PATH (pour trouver clang.exe + bindgen.exe utilise libclang) =====
$llvmBin = [Environment]::GetEnvironmentVariable("LIBCLANG_PATH")
if ($llvmBin -and (Test-Path (Join-Path $llvmBin "clang.exe"))) {
    if ($env:PATH -notlike "*$llvmBin*") {
        $env:PATH = "$llvmBin;$env:PATH"
        [Environment]::SetEnvironmentVariable("PATH", $env:PATH)
        Write-Host "[aNtaerus] PATH LLVM/clang: $llvmBin" -ForegroundColor Gray
    }
}

# ===== CRITICAL: INCLUDE paths MSVC pour bindgen (resout 'stdbool.h file not found' dans whisper-rs-sys/piper1-rs-sys) =====
# Si on NE resout PAS stdbool.h => build.rs utilise "bundled bindings.rs, which may be out of date"
# => TAILLE struct whisper_full_params mismatch => error[E0080]: attempt to compute `1_usize - 296_usize` overflow
# Bindgen ne lit PAS la variable env $INCLUDE automatiquement. Il faut passer -I<path> via BINDGEN_EXTRA_CLANG_ARGS.
$clangIncludeArgs = New-Object System.Collections.Generic.List[string]
$includeRaw = [Environment]::GetEnvironmentVariable("INCLUDE")
if ($includeRaw) {
    foreach ($ipath in ($includeRaw -split ';' | Where-Object { $_ -and (Test-Path $_) })) {
        [void]$clangIncludeArgs.Add("-I`"$ipath`"")
    }
}
# On ajoute aussi le dossier INCLUDE de whisper/ggml pour eviter "ggml.h not found"
$whisperLocalInc = Join-Path (Get-Location) "src"
if (Test-Path $whisperLocalInc) { [void]$clangIncludeArgs.Add("-I`"$whisperLocalInc`"") }

if ($clangIncludeArgs.Count -gt 0) {
    $bindgenArgs = $clangIncludeArgs -join " "
    [Environment]::SetEnvironmentVariable("BINDGEN_EXTRA_CLANG_ARGS", $bindgenArgs)
    [Environment]::SetEnvironmentVariable("BINDGEN_EXTRA_CLANG_ARGS_x86_64_pc_windows_msvc", $bindgenArgs)
    Write-Host "[aNtaerus] BINDGEN_EXTRA_CLANG_ARGS => $($clangIncludeArgs.Count) -I flags injectes (resout stdbool.h missing)" -ForegroundColor Gray
}

# ===== (PRE-REQUIS) Chemins de base (utilises par X0 Cargo.lock, X1 Target dir, et plus bas) =====
$engineRoot = Join-Path $root "providers\\engine_rust"
$cargoToml = Join-Path $engineRoot "Cargo.toml"

# ===== (X0) CRITICAL: Suppression Cargo.lock si modifications dependencies/features Cargo.toml (resoud versions STALE whisper-rs 0.14 vs 0.15 et ort-sys compile sans raison) =====
$cargoLock = Join-Path $engineRoot "Cargo.lock"
if (Test-Path $cargoLock) {
    $lockTime = (Get-Item $cargoLock).LastWriteTime
    $tomlTime = (Get-Item $cargoToml -ErrorAction Stop).LastWriteTime
    $srcDirty = $false
    $mostRecentRs = Get-ChildItem -Recurse (Join-Path $engineRoot "src") -Include "*.rs" -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if ($mostRecentRs -and $mostRecentRs.LastWriteTime -gt $lockTime) { $srcDirty = $true }
    if ($tomlTime -gt $lockTime -or $srcDirty) {
        try {
            Remove-Item -Force $cargoLock -ErrorAction Stop
            Write-Host "[aNtaerus] Clean Cargo.lock (Cargo.toml ou sources Rust modifies apres generation Lock => resolution features/dependances FRESH)." -ForegroundColor Gray
        } catch {
            Write-Warning "[aNtaerus] Cargo.lock verrouille, nettoyage ignore."
        }
    }
}

# ===== (X1) CRITICAL MAX_PATH Windows: CARGO_TARGET_DIR en chemin ULTRA COURT C:\b\er (3 chars!) + FORCE CLEAN SI SOURCE MODIFIÉE =====
$shortTarget = "C:\b\er"
$needClean = $false
if (-not (Test-Path $shortTarget)) {
    $needClean = $false  # Premier build, pas de stale build
} else {
    # Check si Cargo.toml a ete modifie apres la creation du build directory (ou tout src/*.rs)
    try {
        $buildTime = (Get-Item $shortTarget -ErrorAction Stop).LastWriteTime
        $cargoTime = (Get-Item $cargoToml -ErrorAction Stop).LastWriteTime
        if ($cargoTime -gt $buildTime) { $needClean = $true }
        if (-not $needClean) {
            # Check 50 fichiers .rs src les plus recents (header lib.rs/bootstrap/main.rs)
            $recentRs = Get-ChildItem -Recurse -Path (Join-Path $engineRoot "src") -Include "*.rs" -ErrorAction SilentlyContinue |
                Sort-Object LastWriteTime -Descending | Select-Object -First 25
            foreach ($rsf in $recentRs) {
                if ($rsf.LastWriteTime -gt $buildTime) { $needClean = $true; break }
            }
        }
    } catch {}
}
# --- (X1b) CRITICAL PERMISSIONS FIX: SI besoin clean ou exist -> suppression forcee + ACL FullControl ---
if ((Test-Path $shortTarget) -and $needClean) {
    try {
        Remove-Item -Recurse -Force $shortTarget -ErrorAction Stop | Out-Null
        Write-Host "[aNtaerus] Clean FORCE CARGO_TARGET_DIR $shortTarget (Cargo.toml ou sources Rust modifiees depuis dernier build -> evite ancien binaire stale)." -ForegroundColor Gray
    } catch {
        Write-Warning "[aNtaerus] Impossible supprimer $shortTarget (process engine_rust.exe encore en cours !). Kill avec scripts/stop-all.ps1 PUIS reessayer."
        exit 1
    }
}
if (-not (Test-Path $shortTarget)) {
    New-Item -ItemType Directory -Force -Path $shortTarget | Out-Null
}
# --- (X1c) Donner ACL FullControl a TOUT LE MONDE sur $shortTarget (evite MSBuild running SYSTEM Acces refuse) ---
try {
    $acl = Get-Acl -Path $shortTarget -ErrorAction Stop
    $rule = New-Object System.Security.AccessControl.FileSystemAccessRule("Everyone","FullControl","ContainerInherit,ObjectInherit","None","Allow")
    $acl.SetAccessRule($rule)
    Set-Acl -Path $shortTarget -AclObject $acl -ErrorAction Stop
} catch {
    Write-Verbose "[aNtaerus] ACL FullControl skip (pas admin ou non necessaire)."
}
$env:CARGO_TARGET_DIR = $shortTarget
[Environment]::SetEnvironmentVariable("CARGO_TARGET_DIR", $shortTarget)
Write-Host "[aNtaerus] CARGO_TARGET_DIR = $shortTarget (court, ACL FullControl, evite MAX_PATH/MSBuild/MSB3191)." -ForegroundColor Gray

# ===== (X2) CRITICAL PERMANENT "fatal: not a git repository" dans CMake ggml/piper/espeak: VRAI git.exe COMPILE C (pas .bat) — CMake find_program(GIT) prefere .EXE avant .BAT =====
# Anciennement git.bat: find_program(GIT) ignore souvent .BAT si PATHEXT=.EXE;.COM;.BAT => appelle vrai git.exe => fatal not a git.
# Solution ROBUSTE 100%: compiler un petit C file -> vrai git.exe minimal avec MSVC cl.exe (charge dans DevShell). Sortie correcte exit 0.
$antaerusProgramData = Join-Path $env:ProgramData "antaerus\bin"
New-Item -ItemType Directory -Force -Path $antaerusProgramData | Out-Null
try {
    $aclGlobal = Get-Acl -Path $antaerusProgramData -ErrorAction Stop
    $ruleGlobal = New-Object System.Security.AccessControl.FileSystemAccessRule("Everyone","FullControl","ContainerInherit,ObjectInherit","None","Allow")
    $aclGlobal.SetAccessRule($ruleGlobal)
    Set-Acl -Path $antaerusProgramData -AclObject $aclGlobal -ErrorAction Stop
} catch {}
$fakeGitExe = Join-Path $antaerusProgramData "git.exe"
$fakeGitCSrc = Join-Path $antaerusProgramData "fake_git.c"

# Contenu C: argv[1] == "rev-parse" => SHA1 zeros, "describe" => v0.0.0-fake, submodule/status/log/branch => stdout vide exit 0, sinon essayer vrai git.exe du PATH (pas notre dossier).
$fakeGitCContent = @'
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <windows.h>

int main(int argc, char **argv) {
    if (argc < 2) {
        return 0;
    }
    const char *cmd = argv[1];
    if (_stricmp(cmd, "rev-parse") == 0) {
        printf("0000000000000000000000000000000000000000\n");
        return 0;
    }
    if (_stricmp(cmd, "describe") == 0) {
        printf("v0.0.0-fake\n");
        return 0;
    }
    if (_stricmp(cmd, "submodule") == 0 ||
        _stricmp(cmd, "status")    == 0 ||
        _stricmp(cmd, "log")       == 0 ||
        _stricmp(cmd, "branch")    == 0) {
        return 0;
    }
    if (_stricmp(cmd, "--version") == 0) {
        printf("git version 2.999.fake\n");
        return 0;
    }
    // Fallback: try REAL git.exe further down PATH (skipping our own folder).
    char currentExePath[MAX_PATH];
    GetModuleFileNameA(NULL, currentExePath, MAX_PATH);
    char *lastSlash = strrchr(currentExePath, '\\');
    if (lastSlash) *lastSlash = '\0'; // our folder path

    char pathBuffer[8192];
    char *pathEnv = getenv("PATH");
    if (!pathEnv) return 0;
    strncpy(pathBuffer, pathEnv, sizeof(pathBuffer)-1);
    pathBuffer[sizeof(pathBuffer)-1] = '\0';

    char *saveptr = NULL;
    char *tok = strtok_s(pathBuffer, ";", &saveptr);
    while (tok) {
        if (_stricmp(tok, currentExePath) != 0) {
            char candidate[MAX_PATH];
            snprintf(candidate, sizeof(candidate), "%s\\git.exe", tok);
            DWORD attr = GetFileAttributesA(candidate);
            if (attr != INVALID_FILE_ATTRIBUTES && !(attr & FILE_ATTRIBUTE_DIRECTORY)) {
                // Build command line
                char cmdLine[32768];
                cmdLine[0] = '\0';
                for (int i = 1; i < argc; i++) {
                    if (i > 1) strcat_s(cmdLine, sizeof(cmdLine), " ");
                    strcat_s(cmdLine, sizeof(cmdLine), "\"");
                    strcat_s(cmdLine, sizeof(cmdLine), argv[i]);
                    strcat_s(cmdLine, sizeof(cmdLine), "\"");
                }
                STARTUPINFOA si;
                PROCESS_INFORMATION pi;
                ZeroMemory(&si, sizeof(si));
                si.cb = sizeof(si);
                ZeroMemory(&pi, sizeof(pi));
                if (CreateProcessA(candidate, cmdLine, NULL, NULL, TRUE, 0, NULL, NULL, &si, &pi)) {
                    WaitForSingleObject(pi.hProcess, INFINITE);
                    DWORD exitCode = 0;
                    GetExitCodeProcess(pi.hProcess, &exitCode);
                    CloseHandle(pi.hProcess);
                    CloseHandle(pi.hThread);
                    return (int)exitCode;
                }
                return 0;
            }
        }
        tok = strtok_s(NULL, ";", &saveptr);
    }
    return 0;
}
'@
Set-Content -Path $fakeGitCSrc -Value $fakeGitCContent -Encoding ASCII -Force

# --- Compiler VRAI git.exe avec MSVC cl.exe DE JAIS CHARGE (DevShell VS Build Tools). Si cl.exe pas dispo: fallback .bat ---
$clAvail = Get-Command "cl.exe" -ErrorAction SilentlyContinue
if ($clAvail) {
    Write-Host "[aNtaerus] Compilation VRAI fake git.exe (C/MSVC) dans $antaerusProgramData ..." -ForegroundColor Gray
    Push-Location $antaerusProgramData
    try {
        # Compile sans runtime dependances lourdes: /O1 minimal, /GS- buffer security off pour size, link kernel32.lib
        & cl.exe /nologo /O1 /GS- /MD fake_git.c /link /OUT:git.exe kernel32.lib user32.lib advapi32.lib 2>&1 | Out-Null
        if ((Test-Path $fakeGitExe) -and (Get-Item $fakeGitExe).Length -gt 1000) {
            Write-Host "[aNtaerus] Fake GIT.EXE (MSVC compile) OK: $fakeGitExe" -ForegroundColor Green
        } else {
            throw "cl.exe n'a pas produit git.exe valide"
        }
    } catch {
        Write-Warning "[aNtaerus] Echec compilation fake_git.c: $($_.Exception.Message). Fallback git.bat."
        # fallback .bat
        $fakeGitBat = Join-Path $antaerusProgramData "git.bat"
        $fakeGitBatContent = @'
@echo off
setlocal enabledelayedexpansion
set "CMD=%~1"
set "MYDIR=%~dp0"
if "%MYDIR:~-1%"=="\" set "MYDIR=%MYDIR:~0,-1%"
if /I "%CMD%"=="rev-parse" (echo 0000000000000000000000000000000000000000& exit /b 0)
if /I "%CMD%"=="describe" (echo v0.0.0-fake& exit /b 0)
if /I "%CMD%"=="submodule" exit /b 0
if /I "%CMD%"=="status" exit /b 0
if /I "%CMD%"=="log" exit /b 0
if /I "%CMD%"=="branch" (echo fake& exit /b 0)
if /I "%CMD%"=="--version" (echo git version 2.999.fake& exit /b 0)
set "REALGIT="
for %%i in (git.exe) do set "REALGIT=%%~$PATH:i"
if defined REALGIT (
    set "NEWPATH=!PATH:%MYDIR%;=!"
    set "PATH=!NEWPATH!"
    call git %*
    exit /b !ERRORLEVEL!
)
exit /b 0
'@
        Set-Content -Path $fakeGitBat -Value $fakeGitBatContent -Encoding ASCII -Force
    }
    Pop-Location
} else {
    Write-Warning "[aNtaerus] cl.exe introuvable, impossible compiler fake git.exe => fallback minimal .gitattributes placeholder."
}
# Placer antaerusProgramData TOUT AU DEBUT du PATH du process (prioritaire) — GIT.EXE avant Program Files\Git\cmd
$env:PATH = "$antaerusProgramData;$env:PATH"
# EN PLUS: definir GIT_EXEC_PATH global (certains CMake utilisent $ENV:GIT_EXEC_PATH avant find_program)
[Environment]::SetEnvironmentVariable("GIT_EXEC_PATH", $antaerusProgramData)
Write-Host "[aNtaerus] Fake GIT PERMANENT en tete PATH: $antaerusProgramData (vrai GIT.EXE si compilé sinon git.bat) + GIT_EXEC_PATH defini. -> plus de fatal: not a git repository." -ForegroundColor Gray

# ===== (X3) Workaround whisper.cpp CMake warnings: GGML_CCACHE=OFF (evite ccache warning inutile) =====
[Environment]::SetEnvironmentVariable("GGML_CCACHE", "OFF")

# ===== IMPORTANT: INTERDIRE formellement fallback bundled => SI generate bindings ECHEC => ERROR plutot que warning + bundled perime =====
# Note: whisper-rs build.rs -> "if env::var(WHISPER_DONT_GENERATE_BINDINGS).is_ok() { SKIP generation }". On NE SET PAS cette var => on FORCE generation.
[Environment]::SetEnvironmentVariable("WHISPER_DONT_GENERATE_BINDINGS", $null)

if ($voiceFeatureEnabled) {
    Write-Host
    Write-Host "======================================================================" -ForegroundColor Cyan
    Write-Host "aNtaerus dev-engine: LANCEMENT BUILD AVEC VOIX STT (recommande)" -ForegroundColor Cyan
    Write-Host "  Commande = cargo run --features voice" -ForegroundColor Gray
    Write-Host "  Cargo.toml: voice = cpal+silero+whisper (STT micro, pas TTS piper)" -ForegroundColor Gray
    Write-Host "======================================================================" -ForegroundColor Cyan
    Write-Host
    # ===== (X4) BUILD DIRECT feature "voice" = STT micro seulement (cpal + silero + whisper). PAS piper_tts (echoue sur MSVC) =====
    cargo run --features voice
    $code = $LASTEXITCODE
    if ($code -ne 0) {
        Write-Host
        Write-Host "============================================================================================================" -ForegroundColor Red
        Write-Host "  ECHEC BUILD VOIX STT !                                                                                    " -ForegroundColor Red -BackgroundColor Black
        Write-Host "  Le moteur va demarrer en MODE CORE (SANS micro, SANS voix).                                              " -ForegroundColor Red -BackgroundColor Black
        Write-Host "                                                                                                            " -ForegroundColor Red -BackgroundColor Black
        Write-Host "  DEBUG ETAPES POUR RESOUDRE:                                                                               " -ForegroundColor Red -BackgroundColor Black
        Write-Host "    1) LLVM 18.1.8 installe ? => winget install LLVM.LLVM                                                   " -ForegroundColor Red -BackgroundColor Black
        Write-Host "    2) Verif ANTAERUS_ENGINE_LIBCLANG_PATH=C:\Program Files\LLVM-18\bin dans antaerus/.env                  " -ForegroundColor Red -BackgroundColor Black
        Write-Host "    3) CMake installe ? => winget install Kitware.CMake                                                     " -ForegroundColor Red -BackgroundColor Black
        Write-Host "    4) VS Build Tools workload VCTools installe ? => winget install Microsoft.VisualStudio.Workload.VCTools " -ForegroundColor Red -BackgroundColor Black
        Write-Host "============================================================================================================" -ForegroundColor Red
        Write-Host
        Write-Warning "[aNtaerus] Fallback mode CORE demarre. (La voix/Micro NE MARCHERA PAS tant que build voice echoue !)"
        cargo run
    }
} else {
    Write-Host "[aNtaerus] Demarrage engine_rust mode CORE (sans voice). Endpoint /health joignable sur http://localhost:7000." -ForegroundColor Yellow
    cargo run
}
