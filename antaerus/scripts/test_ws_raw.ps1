$ErrorActionPreference = "Continue"
$DebugPreference = "Continue"

Write-Host "=== DIAGNOSTIC WS RAW aNtaerus ===" -ForegroundColor Cyan

try {
    Write-Host "`n[1/4] GET dev JWT token from gateway..."
    $devTokenResp = Invoke-RestMethod -Uri "http://localhost:8080/api/v1/auth/dev-token" -Method POST -Body (@{subject="ws-diag-user"} | ConvertTo-Json) -ContentType "application/json" -TimeoutSec 10
    $token = $devTokenResp.token
    Write-Host "OK JWT obtenu (len=$($token.Length))" -ForegroundColor Green
} catch {
    Write-Host "FAIL GET JWT: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        Write-Host "  Body: $($reader.ReadToEnd())" -ForegroundColor DarkRed
    }
    exit 1
}

try {
    Write-Host "`n[2/4] Connexion WS avec le token..."
    $wsUrl = "ws://localhost:8080/api/v1/ws?token=" + [System.Uri]::EscapeDataString($token)
    $cts = New-Object System.Threading.CancellationTokenSource
    $ws = New-Object System.Net.WebSockets.ClientWebSocket
    $ws.Options.KeepAliveInterval = [TimeSpan]::FromSeconds(10)
    $connectTask = $ws.ConnectAsync([System.Uri]$wsUrl, $cts.Token)
    if (-not $connectTask.Wait(10000)) {
        throw "Connexion WS timeout 10s"
    }
    Write-Host "OK WS CONNECTE (State=$($ws.State))" -ForegroundColor Green
} catch {
    Write-Host "FAIL CONNEXION WS: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

try {
    Write-Host "`n[3/4] Lecture 3 premiers messages (heartbeat?) - 5s attente..."
    $buffer = New-Object byte[] 262144
    $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
    $msgCount = 0
    while ($stopwatch.Elapsed.TotalSeconds -lt 5 -and $ws.State -eq [System.Net.WebSockets.WebSocketState]::Open) {
        $memStream = New-Object System.IO.MemoryStream
        do {
            $seg = [System.ArraySegment[byte]]::new($buffer)
            $recvTask = $ws.ReceiveAsync($seg, $cts.Token)
            $ok = $recvTask.Wait([Math]::Max(100, [int](5000 - $stopwatch.Elapsed.TotalMilliseconds)))
            if (-not $ok) { break }
            $res = $recvTask.Result
            $memStream.Write($buffer, 0, $res.Count)
        } while (-not $recvTask.Result.EndOfMessage -and $ws.State -eq [System.Net.WebSockets.WebSocketState]::Open)
        if ($memStream.Length -gt 0) {
            $msg = [System.Text.Encoding]::UTF8.GetString($memStream.ToArray())
            $msgCount++
            Write-Host "  RECV #$msgCount : $msg" -ForegroundColor DarkCyan
        }
        $memStream.Dispose()
    }
    Write-Host "  Lu $msgCount messages intro."
} catch {
    Write-Host "WARN lecture intro: $($_.Exception.Message)" -ForegroundColor DarkYellow
}

Write-Host "`n[4/4] ENVOI message: chat.message 'Salut (diagnostic WS raw)' session=diag-session-001"
$ts = [DateTimeOffset]::UtcNow.ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
$sendPayload = @{
    type = "chat.message"
    timestamp = $ts
    payload = @{
        sessionId = "diag-session-001"
        message   = "Salut (diagnostic WS raw). Repond en une phrase courte."
    }
} | ConvertTo-Json -Depth 10 -Compress
$sendBytes = [System.Text.Encoding]::UTF8.GetBytes($sendPayload)
$sendSeg = [System.ArraySegment[byte]]::new($sendBytes)
$sendTask = $ws.SendAsync($sendSeg, [System.Net.WebSockets.WebSocketMessageType]::Text, $true, $cts.Token)
if (-not $sendTask.Wait(5000)) { throw "Send timeout" }
Write-Host "OK ENVOYE. Attente STREAMING pendant 90s MAX..." -ForegroundColor Yellow

$stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
$totalRecv = 0
$tokenCount = 0
$gotComplete = $false
$gotError = $false
$gotHeartbeat = $false
$buffer = New-Object byte[] 524288

while ($stopwatch.Elapsed.TotalSeconds -lt 90 -and $ws.State -eq [System.Net.WebSockets.WebSocketState]::Open -and -not $gotComplete -and -not $gotError) {
    $memStream = New-Object System.IO.MemoryStream
    try {
        do {
            $seg = [System.ArraySegment[byte]]::new($buffer)
            $recvTask = $ws.ReceiveAsync($seg, $cts.Token)
            $remainingMs = [Math]::Max(500, [int](90000 - $stopwatch.Elapsed.TotalMilliseconds))
            $ok = $recvTask.Wait($remainingMs)
            if (-not $ok) { break }
            $res = $recvTask.Result
            if ($res.MessageType -eq [System.Net.WebSockets.WebSocketMessageType]::Close) {
                Write-Host "  RECV FRAME CLOSE" -ForegroundColor DarkRed
                break
            }
            $memStream.Write($buffer, 0, $res.Count)
        } while (-not $recvTask.Result.EndOfMessage -and $ws.State -eq [System.Net.WebSockets.WebSocketState]::Open)
    } catch {
        Write-Host "  ERREUR recv loop: $($_.Exception.Message)" -ForegroundColor Red
        break
    }
    if ($memStream.Length -eq 0) {
        if ($stopwatch.Elapsed.TotalSeconds -gt 20 -and $totalRecv -eq 0) {
            Write-Host "  [t=$($stopwatch.Elapsed.ToString('s\.f'))s] > 20s AUCUN message recu apres envoi ! BUG GATEWAY BLOQUANT." -ForegroundColor Red
        }
        continue
    }
    $msg = [System.Text.Encoding]::UTF8.GetString($memStream.ToArray())
    $totalRecv++
    $t = $stopwatch.Elapsed.ToString('s\.f')

    try {
        $parsed = $msg | ConvertFrom-Json
        $type = $parsed.type
        switch -Regex ($type) {
            "chat\.token" {
                $tokenCount++
                $trunc = if ($parsed.payload.token.Length -gt 40) { $parsed.payload.token.Substring(0,40) + "..." } else { $parsed.payload.token }
                if ($tokenCount -eq 1) { Write-Host "  [t=${t}s] #$totalRecv [$type] **PREMIER TOKEN**: '$trunc'" -ForegroundColor Cyan }
                elseif ($tokenCount % 25 -eq 0) { Write-Host "  [t=${t}s] #$totalRecv [$type] ($tokenCount tokens) '$trunc'" -ForegroundColor DarkCyan }
            }
            "chat\.complete" {
                $gotComplete = $true
                $ans = if ($parsed.payload.message.Length -gt 200) { $parsed.payload.message.Substring(0,200) + "..." } else { $parsed.payload.message }
                Write-Host "  [t=${t}s] #$totalRecv [$type] REPONSE FINALE (len=$($parsed.payload.message.Length)): '$ans'" -ForegroundColor Green
            }
            "chat\.error" {
                $gotError = $true
                Write-Host "  [t=${t}s] #$totalRecv [$type] CODE=$($parsed.payload.code) MSG=$($parsed.payload.message)" -ForegroundColor Red
            }
            "system\.alert" {
                Write-Host "  [t=${t}s] #$totalRecv [$type] LEVEL=$($parsed.payload.level): $($parsed.payload.message)" -ForegroundColor Yellow
                if ($parsed.payload.message -match "Brain chat stream|context deadline") {
                    Write-Host "    -> ERREUR STREAM DETECTEE" -ForegroundColor DarkRed
                }
            }
            "health\.heartbeat" {
                if (-not $gotHeartbeat) {
                    $names = ($parsed.payload.services | ForEach-Object { "$($_.Name)=$($_.Status)" }) -join ", "
                    Write-Host "  [t=${t}s] #$totalRecv [$type] $names" -ForegroundColor DarkGray
                    $gotHeartbeat = $true
                }
            }
            default {
                if ($msg.Length -gt 150) { $msg = $msg.Substring(0,150) + "..." }
                Write-Host "  [t=${t}s] #$totalRecv [$type] $msg" -ForegroundColor Gray
            }
        }
    } catch {
        if ($msg.Length -gt 200) { $msg = $msg.Substring(0,200) + "..." }
        Write-Host "  [t=${t}s] #$totalRecv (non-json) $msg" -ForegroundColor DarkGray
    }
    $memStream.Dispose()
}

Write-Host "`n=== RESUME DIAGNOSTIC ===" -ForegroundColor Cyan
Write-Host "  Duree totale: $($stopwatch.Elapsed.ToString('s\.f'))s"
Write-Host "  Messages recus: $totalRecv  (chat.tokens=$tokenCount, complete=$gotComplete, error=$gotError, hb=$gotHeartbeat)"

if ($gotComplete) {
    Write-Host "  RESULTAT: OK Gateway repond correctement. BUG = COTE FRONTEND React." -ForegroundColor Green
} elseif ($gotError) {
    Write-Host "  RESULTAT: ECHEC Gateway renvoie chat.error. Voir logs brain_python." -ForegroundColor Red
} else {
    Write-Host "  RESULTAT: ECHEC AUCUNE REPONSE GATEWAY. BUG readPump bloque OU timeout brain." -ForegroundColor Red
    Write-Host "  Verifier: (1) gateway est bien recompilé avec les patchs? (2) brain /llm/session-stream marche?"
}

try { $ws.CloseAsync([System.Net.WebSockets.WebSocketCloseStatus]::NormalClosure, "diag done", $cts.Token).Wait(2000) } catch {}
try { $ws.Dispose() } catch {}
$cts.Dispose()
