import asyncio
import json
import sys
from datetime import datetime
import httpx

async def main():
    print("=== DIAGNOSTIC BRAIN PYTHON DIRECT /llm/session-stream ===")
    print(f"Time: {datetime.now()}")

    try:
        health = httpx.get("http://localhost:8000/health", timeout=5)
        print(f"[1] Brain health: {health.status_code} - {health.text[:200]}")
    except Exception as e:
        print(f"[1] FAIL Brain health DOWN: {e}")
        sys.exit(1)

    payload = {
        "sessionId": "diag-direct-001",
        "message": "Salut ! Reponds en UNE phrase TRES COURTE (max 10 mots).",
    }
    print(f"\n[2] POST /llm/session-stream: {json.dumps(payload, ensure_ascii=False)}")
    print("[...] Attente stream SSE 45s max...\n")

    t0 = asyncio.get_event_loop().time()
    total_events = 0
    first_token_t = None
    last_data_t = t0
    full_text = ""

    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(45.0, connect=5.0)) as client:
            async with client.stream(
                "POST",
                "http://localhost:8000/llm/session-stream",
                json=payload,
                headers={"Content-Type": "application/json", "Accept": "text/event-stream"},
            ) as resp:
                print(f"[2a] HTTP Status: {resp.status_code}")
                if resp.status_code != 200:
                    txt = await resp.aread()
                    print(f"  FAIL body: {txt[:1000]}")
                    sys.exit(2)
                print(f"[2b] Headers: {dict(resp.headers)}")
                current_event = ""
                current_data = ""
                async for raw_line in resp.aiter_lines():
                    line = raw_line.strip()
                    now = asyncio.get_event_loop().time()
                    if not line:
                        if current_event and current_data:
                            total_events += 1
                            if first_token_t is None:
                                first_token_t = now
                            last_data_t = now
                            try:
                                data = json.loads(current_data)
                            except Exception:
                                data = {"raw": current_data}

                            if current_event == "token":
                                txt = str(data.get("text", ""))
                                full_text += txt
                                if total_events == 1:
                                    print(f"  [t={now-t0:0.1f}s] event#{total_events} {current_event} **PREMIER TOKEN** '{txt[:60]}'")
                                elif total_events % 25 == 0:
                                    print(f"  [t={now-t0:0.1f}s] event#{total_events} {current_event} ({len(full_text)} chars) ...'{txt[:30]}'")
                            elif current_event == "complete":
                                txt = str(data.get("text", ""))
                                print(f"  [t={now-t0:0.1f}s] event#{total_events} {current_event} REPONSE FINALE ({len(txt)} chars): '{txt[:300]}'")
                            elif current_event == "error":
                                print(f"  [t={now-t0:0.1f}s] event#{total_events} {current_event} {json.dumps(data, ensure_ascii=False)[:300]}")
                            else:
                                print(f"  [t={now-t0:0.1f}s] event#{total_events} {current_event} {current_data[:300]}")
                        current_event = ""
                        current_data = ""
                        continue
                    if line.startswith("event:"):
                        current_event = line[len("event:"):].strip()
                    elif line.startswith("data:"):
                        current_data = line[len("data:"):].strip()
    except Exception as e:
        dt = asyncio.get_event_loop().time() - t0
        print(f"\n  EXCEPTION apres {dt:0.1f}s: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc(limit=3)

    dt = asyncio.get_event_loop().time() - t0
    print(f"\n=== RESUME BRAIN DIRECT ===")
    print(f"  Duree: {dt:0.1f}s")
    print(f"  Events SSE recus: {total_events}")
    print(f"  1er token delai: {'N/A' if first_token_t is None else str(first_token_t-t0)[:5]+'s'}")
    print(f"  Full text length: {len(full_text)}")
    if full_text:
        print(f"  Full text: {full_text[:500]}{'...' if len(full_text)>500 else ''}")

    if total_events == 0:
        print(f"\n  RESULTAT: BRAIN NE REPOND PAS. C'est LA RAISON du bug 'pas de reponse'.")
        sys.exit(10)
    elif first_token_t is None:
        print(f"\n  RESULTAT: BRAIN renvoie events mais AUCUN token/complete.")
        sys.exit(11)
    else:
        print(f"\n  RESULTAT: BRAIN MARCHE. BUG = GATEWAY GO (ou ancien binaire non recompile).")
        sys.exit(0)

if __name__ == "__main__":
    asyncio.run(main())
