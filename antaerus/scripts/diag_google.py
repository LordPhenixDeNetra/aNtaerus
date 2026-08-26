#!/usr/bin/env python3
"""Diagnostique Google OAuth (Gmail/Calendar) pour aNtaerus.

Valide l'ordre de chargement :
  1. Variables d'environnement (.env) :
     ANTAERUS_GOOGLE_CLIENT_ID / ANTAERUS_GOOGLE_CLIENT_SECRET / ANTAERUS_GOOGLE_REFRESH_TOKEN
  2. Fichiers references dans .env (fallback) :
     ANTAERUS_GOOGLE_CREDENTIALS_FILE (cle `web` OU `installed`)
     ANTAERUS_GOOGLE_TOKEN_FILE (cle `refresh_token`)

Puis affiche :
  - l'etat du chargement
  - la disponibilite Gmail/Calendar (outil ToolAvailability)
  - si refresh_token manque : l'URL OAuth a ouvrir pour s'authentifier et recuperer `code=...`
"""
from __future__ import annotations

import json
import sys
from pathlib import Path
from urllib.parse import urlencode, urlparse, parse_qs

ROOT = Path(__file__).resolve().parents[1]
ENV_PATH = ROOT / ".env"


def load_dotenv(env_path: Path) -> None:
    """Charge .env dans os.environ (sans ecraser les variables deja definies)."""
    import os

    if not env_path.is_file():
        return
    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in {"'", '"'}:
            value = value[1:-1]
        os.environ.setdefault(key, value)


def _resolve(raw_value: str, fallback: Path) -> Path:
    if not raw_value.strip():
        return fallback
    candidate = Path(raw_value)
    if candidate.is_absolute():
        return candidate
    return (ROOT / candidate).resolve()


def load_credentials_from_file() -> tuple[str, str, str, str, bool]:
    """Return (client_id, client_secret, redirect_uri_from_file, refresh_token, is_installed_type).

    (Miroir exact de antaerus_brain.config._load_google_secrets + redirect_uri + type detection.)
    """
    import os

    client_id_file = ""
    client_secret_file = ""
    redirect_uri_file = ""
    is_installed = False
    credentials_file_raw = os.environ.get("ANTAERUS_GOOGLE_CREDENTIALS_FILE", "")
    if credentials_file_raw:
        credentials_path = _resolve(
            credentials_file_raw, ROOT / "config" / "google_credentials.json"
        )
        print(f"[i] lecture credentials file: {credentials_path} (exists={credentials_path.is_file()})")
        if credentials_path.is_file():
            try:
                data = json.loads(credentials_path.read_text(encoding="utf-8"))
            except Exception as exc:  # noqa: BLE001
                print(f"[x] impossible de parser {credentials_path}: {exc}")
                data = None
            if isinstance(data, dict):
                top_keys = ", ".join(data.keys())
                print(f"[i]   top-level keys: {top_keys}")
                is_installed = "installed" in data
                obj = data.get("installed") or data.get("web") or {}
                if isinstance(obj, dict):
                    client_id_file = str(obj.get("client_id") or "").strip()
                    client_secret_file = str(obj.get("client_secret") or "").strip()
                    ruris = obj.get("redirect_uris") or []
                    if isinstance(ruris, list) and ruris:
                        redirect_uri_file = str(ruris[0]).strip()

    refresh_token_file = ""
    token_file_raw = os.environ.get("ANTAERUS_GOOGLE_TOKEN_FILE", "")
    if token_file_raw:
        token_path = _resolve(token_file_raw, ROOT / "config" / "google_token.json")
        print(f"[i] lecture token file: {token_path} (exists={token_path.is_file()})")
        if token_path.is_file():
            try:
                token_data = json.loads(token_path.read_text(encoding="utf-8"))
            except Exception as exc:  # noqa: BLE001
                print(f"[x] impossible de parser {token_path}: {exc}")
                token_data = None
            if isinstance(token_data, dict):
                refresh_token_file = str(token_data.get("refresh_token") or "").strip()

    return client_id_file, client_secret_file, redirect_uri_file, refresh_token_file, is_installed


def build_oauth_url(client_id: str, redirect_uri: str, scope: str) -> str:
    params = {
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": scope,
        "access_type": "offline",
        "prompt": "consent",
    }
    return "https://accounts.google.com/o/oauth2/v2/auth?" + urlencode(params)


def exchange_code_to_tokens(
    code: str, client_id: str, client_secret: str, redirect_uri: str
) -> dict | None:
    """POST oauth2.googleapis.com/token — renvoie {"access_token","refresh_token","expires_in",...} ou None."""
    import urllib.request
    import urllib.parse
    import urllib.error

    payload = urllib.parse.urlencode(
        {
            "code": code,
            "client_id": client_id,
            "client_secret": client_secret,
            "redirect_uri": redirect_uri,
            "grant_type": "authorization_code",
        }
    ).encode("utf-8")
    req = urllib.request.Request(
        "https://oauth2.googleapis.com/token",
        data=payload,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:  # noqa: S310
            body = resp.read().decode("utf-8")
            return json.loads(body)
    except urllib.error.HTTPError as exc:
        err_body = ""
        try:
            err_body = exc.read().decode("utf-8", errors="replace")
        except Exception:  # noqa: BLE001
            pass
        print(f"[x] echec echange code OAuth -> token: HTTP {exc.code} {exc.reason}")
        if err_body:
            try:
                parsed = json.loads(err_body)
                print(
                    f"    Google erreur: {parsed.get('error')!r} | "
                    f"description: {parsed.get('error_description')!r}"
                )
            except Exception:  # noqa: BLE001
                print(f"    Corps brut: {err_body[:600]}")
        return None
    except Exception as exc:  # noqa: BLE001
        print(f"[x] echec echange code OAuth -> token: {exc}")
        return None


def save_token_file(token_path: Path, tokens: dict) -> Path:
    """Écrit google_token.json avec refresh_token (+ access_token en clair, pas de souci)."""
    token_path = token_path.resolve()
    token_path.parent.mkdir(parents=True, exist_ok=True)
    existing = {}
    if token_path.is_file():
        try:
            existing = json.loads(token_path.read_text(encoding="utf-8"))
        except Exception:  # noqa: BLE001
            existing = {}
    merged = {**existing, **tokens}
    token_path.write_text(json.dumps(merged, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"[v] token sauvegarde: {token_path}")
    return token_path


def main() -> int:
    import os

    load_dotenv(ENV_PATH)

    file_cid, file_csec, file_ruri, file_rtok, is_installed = load_credentials_from_file()
    final_cid = os.environ.get("ANTAERUS_GOOGLE_CLIENT_ID", "") or file_cid
    final_csec = os.environ.get("ANTAERUS_GOOGLE_CLIENT_SECRET", "") or file_csec
    final_rtok = os.environ.get("ANTAERUS_GOOGLE_REFRESH_TOKEN", "") or file_rtok
    # Pour Application bureau ("installed"): PRIORITE urn:ietf:wg:oauth:2.0:oob (Google affiche un code a copier, AUCUNE verification redirect URI)
    # Pour Application Web ("web"): priority .env > credentials.redirect_uris[0] > http://localhost/oauth/google/callback
    env_ruri = os.environ.get("ANTAERUS_GOOGLE_REDIRECT_URI", "")
    if is_installed:
        redirect_uri = (
            env_ruri
            or "urn:ietf:wg:oauth:2.0:oob"
            or file_ruri
            or "http://localhost"
        )
    else:
        redirect_uri = (
            env_ruri
            or file_ruri
            or "http://localhost/oauth/google/callback"
        )

    sep = "-" * 72
    print(sep)
    print("DIAGNOSTIC GOOGLE OAUTH aNtaerus")
    print(sep)
    print(f"CLIENT_ID:     {'OK (' + str(len(final_cid)) + ' chars)' if final_cid else 'VIDE (defaut: credentials.json web.client_id OU installed.client_id)'}")
    print(f"CLIENT_SECRET: {'OK (' + str(len(final_csec)) + ' chars)' if final_csec else 'VIDE (defaut: credentials.json web.client_secret OU installed.client_secret)'}")
    print(f"REFRESH_TOKEN: {'OK (' + str(len(final_rtok)) + ' chars)' if final_rtok else 'VIDE (defaut: google_token.json refresh_token) - il faut faire OAuth 1 fois.'}")
    print(f"REDIRECT_URI:  {redirect_uri}")
    print(sep)

    if not final_cid:
        print("[x] Gmail/Calendar = INDIPONIBLE: google client id not configured (.env OU credentials.json)")
        return 1
    if not final_csec:
        print("[x] Gmail/Calendar = INDIPONIBLE: google client secret not configured (.env OU credentials.json)")
        return 1
    if not final_rtok:
        gmail_scope = (
            "https://www.googleapis.com/auth/gmail.readonly "
            "https://www.googleapis.com/auth/gmail.send "
            "https://www.googleapis.com/auth/userinfo.email"
        )
        cal_scope = (
            "https://www.googleapis.com/auth/calendar.readonly "
            "https://www.googleapis.com/auth/calendar.events "
            "https://www.googleapis.com/auth/userinfo.email"
        )
        gmail_url = build_oauth_url(final_cid, redirect_uri, gmail_scope)
        cal_url = build_oauth_url(final_cid, redirect_uri, cal_scope)
        print("[!] REFRESH_TOKEN MANQUE — il faut faire l'OAuth flow manuel :")
        print()
        print("  (a) Ouvre ce lien (gmail + userinfo.profile) :")
        print(f"      {gmail_url}")
        print()
        print("  (b) OU celui-ci (calendar + userinfo.profile) :")
        print(f"      {cal_url}")
        print()
        if redirect_uri.startswith("urn:ietf:wg:oauth:2.0"):
            print("  (c) Connecte-toi avec le bon compte Google, clique sur 'Autoriser'.")
            print("      Google affiche un ecran 'Copie ton code d'autorisation' avec un bouton COPIER.")
            print()
            print("  (d) Copie le code AFFICHE PAR GOOGLE (longue chaine, environ 70-200 caracteres)")
            print()
        else:
            print("  (c) Connecte-toi avec le bon compte Google - tu obtiens une page d'ERREUR 'Impossible d'acceder a ce site'")
            print("      (normal : le redirect_uri localhost n'a pas de serveur qui ecoute chez toi).")
            print()
            print("  (d) Dans la barre d'adresse, recupere : ...?code=XXXX&scope=...")
            print("      Copie le code=XXXX (tout ce qui est apres ?code= ET avant &scope=).")
            print()
        print("  (e) Reviens ici et relance :")
        print('      python scripts/diag_google.py --code "TON_CODE_ICI"')
        print()
        return 0

    print("[v] GmailTool AVAILABILITY = enabled=True, available=True")
    print("[v] CalendarTool AVAILABILITY = enabled=True, available=True")
    print("[i] Pour verifier un access_token, utiliser:")
    print("    antaerus_brain.tools.gmail._exchange_google_refresh_token(cid, csec, rtok, 15)")
    return 0


def run_with_code(code: str) -> int:
    """Flux (e): quand user passe --code "...XXXX..." apres avoir fait OAuth manuel."""
    import os

    load_dotenv(ENV_PATH)
    file_cid, file_csec, file_ruri, _, is_installed = load_credentials_from_file()
    final_cid = os.environ.get("ANTAERUS_GOOGLE_CLIENT_ID", "") or file_cid
    final_csec = os.environ.get("ANTAERUS_GOOGLE_CLIENT_SECRET", "") or file_csec
    env_ruri = os.environ.get("ANTAERUS_GOOGLE_REDIRECT_URI", "")
    if is_installed:
        redirect_uri = (
            env_ruri
            or "urn:ietf:wg:oauth:2.0:oob"
            or file_ruri
            or "http://localhost"
        )
    else:
        redirect_uri = (
            env_ruri
            or file_ruri
            or "http://localhost/oauth/google/callback"
        )
    token_file_raw = os.environ.get("ANTAERUS_GOOGLE_TOKEN_FILE", "")
    token_path = _resolve(token_file_raw, ROOT / "config" / "google_token.json")

    print(f"[i] echange code OAuth (len={len(code)}) contre tokens...")
    tokens = exchange_code_to_tokens(code, final_cid, final_csec, redirect_uri)
    if not tokens:
        return 1
    rtok = tokens.get("refresh_token") or ""
    if not rtok:
        print("[!] Pas de refresh_token dans la reponse (tu as deja fait OAuth sans offline access ?)")
        print("    => relance l'URL OAuth du diag precedent et choisis 'autoriser hors-ligne' (prompt=consent est dans l'URL).")
        print("    Reponse brute recue:", json.dumps(tokens, indent=2, ensure_ascii=False))
        return 2
    save_token_file(token_path, tokens)
    print("[v] TERMINE - au prochain demarrage brain_python :")
    print("    - config.py charge google_refresh_token depuis config/google_token.json")
    print("    - GmailTool._availability() -> enabled=True, available=True")
    return 0


if __name__ == "__main__":
    if len(sys.argv) >= 3 and sys.argv[1] in {"--code", "-c"}:
        sys.exit(run_with_code(sys.argv[2]))
    sys.exit(main())
