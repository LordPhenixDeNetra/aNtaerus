import asyncio
import json
import sys
import websockets
import httpx
from datetime import datetime


async def get_dev_token() -> str:
    print("[1] GET dev-token ...", flush=True)
    async with httpx.AsyncClient(timeout=10) as c:
        r = await c.post(
            "http://localhost:8080/api/v1/auth/dev-token",
            json={"subject": "diag-user-2"},
        )
        r.raise_for_status()
        j = r.json()
        token = j["token"]
    print(f"    JWT len={len(token)} OK", flush=True)
    return token


async def main():
    print("=== DIAG NOUVEAU GATEWAY WS (aNtaerus bin/gateway.exe) ===")
    print(f"Time: {datetime.now()}\n", flush=True)

    token = await get_dev_token()
    uri = f"ws://localhost:8080/api/v1/ws?token={token}"
    print(f"[2] Connexion WS ...", flush=True)

    tok_seen = 0
    complete_seen = False
    error_seen = False
    t0 = asyncio.get_event_loop().time()
    first_tok_t = None

    try:
        async with websockets.connect(uri, close_timeout=5, open_timeout=15) as ws:
            print(f"    WS OPEN (t+0s)", flush=True)

            async def read_loop(deadline_s: float):
                nonlocal tok_seen, complete_seen, error_seen, first_tok_t
                try:
                    while True:
                        remaining = deadline_s - (asyncio.get_event_loop().time() - t0)
                        if remaining <= 0:
                            return
                        try:
                            msg = await asyncio.wait_for(ws.recv(), timeout=min(5.0, remaining))
                        except asyncio.TimeoutError:
                            continue
                        t = asyncio.get_event_loop().time() - t0
                        try:
                            m = json.loads(msg)
                        except Exception:
                            print(f"    [t={t:0.1f}s] NON-JSON: {msg[:200]}", flush=True)
                            continue
                        ty = m.get("type")
                        if ty == "chat.token":
                            tok_seen += 1
                            txt = str(m.get("payload", {}).get("token", ""))
                            if tok_seen == 1:
                                first_tok_t = t
                                print(
                                    f"    [t={t:0.1f}s] *** chat.token #1 ***: '{txt[:80]}'",
                                    flush=True,
                                )
                            elif tok_seen % 25 == 0:
                                print(
                                    f"    [t={t:0.1f}s] chat.token #{tok_seen} ({len(txt)}c) ...",
                                    flush=True,
                                )
                        elif ty == "chat.complete":
                            complete_seen = True
                            txt = str(m.get("payload", {}).get("message", ""))
                            print(
                                f"    [t={t:0.1f}s] *** chat.complete *** (len={len(txt)}): '{txt[:400]}'",
                                flush=True,
                            )
                            return
                        elif ty == "chat.error":
                            error_seen = True
                            msg2 = str(m.get("payload", {}).get("message", ""))
                            code = str(m.get("payload", {}).get("code", ""))
                            print(
                                f"    [t={t:0.1f}s] *** chat.error *** code={code} msg={msg2[:400]}",
                                flush=True,
                            )
                            return
                        elif ty == "system.alert":
                            lvl = m.get("payload", {}).get("level", "")
                            msg2 = str(m.get("payload", {}).get("message", ""))
                            print(
                                f"    [t={t:0.1f}s] system.alert [{lvl}]: {msg2[:200]}",
                                flush=True,
                            )
                            if "Brain chat" in msg2 or "deadline" in msg2:
                                error_seen = True
                                return
                        elif ty == "health.heartbeat":
                            svcs = m.get("payload", {}).get("services", [])
                            names = ", ".join(f"{s.get('name')}={s.get('status')}" for s in svcs)
                            print(f"    [t={t:0.1f}s] heartbeat: {names}", flush=True)
                        else:
                            s = json.dumps(m, ensure_ascii=False)
                            if len(s) > 200:
                                s = s[:200] + "..."
                            print(f"    [t={t:0.1f}s] {ty}: {s}", flush=True)
                except websockets.ConnectionClosed as e:
                    print(f"    [t={asyncio.get_event_loop().time()-t0:0.1f}s] WS CLOSED code={e.code} reason={e.reason}", flush=True)
                    return
                except Exception as e:
                    print(f"    [t={asyncio.get_event_loop().time()-t0:0.1f}s] read_loop EXC: {type(e).__name__}: {e}", flush=True)
                    return

            ts = datetime.now().isoformat(timespec="milliseconds").replace("+00:00", "Z")
            env = {
                "type": "chat.message",
                "timestamp": ts,
                "payload": {
                    "sessionId": "diag-session-ws-002",
                    "message": "Salut ! Reponds en une phrase TRES COURTE (max 15 mots).",
                },
            }
            send_str = json.dumps(env, ensure_ascii=False)
            print(f"\n[3] SEND chat.message...", flush=True)
            await ws.send(send_str)
            print(f"    OK envoye. Attente stream 30s max.\n", flush=True)

            reader = asyncio.create_task(read_loop(30.0))
            try:
                await asyncio.wait_for(reader, timeout=35)
            except asyncio.TimeoutError:
                pass
            if not reader.done():
                reader.cancel()
                try:
                    await reader
                except Exception:
                    pass
    except Exception as e:
        print(f"[FATAL] {type(e).__name__}: {e}", flush=True)
        import traceback
        traceback.print_exc(limit=4)

    dt = asyncio.get_event_loop().time() - t0
    print(f"\n=== RESUME ===")
    print(f"  duree: {dt:0.1f}s  tokens={tok_seen}  1er_token={'N/A' if first_tok_t is None else f'{first_tok_t:0.1f}s'}  complete={complete_seen}  error={error_seen}")
    if complete_seen:
        print("\n  >>> GATEWAY NOUVEAU FONCTIONNE ! Si tu ne vois rien dans UI, bug = COTE REACT FRONTEND.")
        sys.exit(0)
    elif error_seen:
        print("\n  >>> ECHEC gateway renvoie erreur.")
        sys.exit(2)
    else:
        print("\n  >>> AUCUNE REPONSE (bloque). Bug persiste dans gateway.")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
