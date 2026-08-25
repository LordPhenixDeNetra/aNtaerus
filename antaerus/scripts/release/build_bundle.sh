#!/usr/bin/env bash
# Build bundle aNtaerus Linux / macOS (darwin).
# Regles: stdlib seulement (bash, curl, sha256sum, tar).
#   - build web (vite), gateway go (statique), engine rust (release)
#   - python 3.11 standalone + venv relocalisable
#   - telechargements modeles Whisper/Piper/YOLOv8 + SHA256
#   - ecriture manifest.json + entry points + checksums

set -euo pipefail

VERSION="${VERSION:-0.6.0-dev}"
OUTPUT_ROOT="${OUTPUT_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)/bundle}"
SKIP_DOWNLOADS="${SKIP_DOWNLOADS:-0}"
SKIP_RUST="${SKIP_RUST:-0}"
SKIP_GO="${SKIP_GO:-0}"
SKIP_WEB="${SKIP_WEB:-0}"
SKIP_PYTHON="${SKIP_PYTHON:-0}"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
BUNDLE_ROOT="${OUTPUT_ROOT}"
WEB_ROOT="${REPO_ROOT}/antaerus/interfaces/web"
GATEWAY_ROOT="${REPO_ROOT}/antaerus/interfaces/gateway_go"
BRAIN_ROOT="${REPO_ROOT}/antaerus/providers/brain_python"
RUST_ROOT="${REPO_ROOT}/antaerus/providers/engine_rust"
BUNDLE_BIN="${BUNDLE_ROOT}/bin"
BUNDLE_WEB="${BUNDLE_ROOT}/web"
BUNDLE_BRAIN="${BUNDLE_ROOT}/brain"
BUNDLE_MODELS="${BUNDLE_ROOT}/models"
BUNDLE_PYTHON="${BUNDLE_ROOT}/python"
BUNDLE_VENV="${BUNDLE_ROOT}/.venv"

mkdir -p "${BUNDLE_BIN}" "${BUNDLE_WEB}" "${BUNDLE_BRAIN}" "${BUNDLE_MODELS}" "${BUNDLE_PYTHON}" "${BUNDLE_VENV}"

declare -A CHECKSUMS

os_arch() {
  local os
  os="$(uname -s | tr '[:upper:]' '[:lower:]')"
  local arch
  arch="$(uname -m | tr '[:upper:]' '[:lower:]')"
  case "${arch}" in
    x86_64) arch="x86_64" ;;
    aarch64|arm64) arch="aarch64" ;;
  esac
  echo "${os}-${arch}"
}

step() { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }

add_checksum() {
  local file="$1"
  [ -f "${file}" ] || return 0
  local rel
  rel="$(realpath --relative-to="${BUNDLE_ROOT}" "${file}" 2>/dev/null || python3 -c "import os,sys;print(os.path.relpath(sys.argv[1],sys.argv[2]))" "${file}" "${BUNDLE_ROOT}")"
  local hash
  if command -v sha256sum >/dev/null 2>&1; then
    hash="$(sha256sum "${file}" | awk '{print $1}')"
  else
    hash="$(shasum -a 256 "${file}" | awk '{print $1}')"
  fi
  CHECKSUMS["${rel}"]="${hash}"
}

download() {
  local url="$1" dest="$2" expected="${3:-}"
  if [ -f "${dest}" ]; then
    if [ -n "${expected}" ]; then
      local actual
      if command -v sha256sum >/dev/null 2>&1; then
        actual="$(sha256sum "${dest}" | awk '{print $1}')"
      else
        actual="$(shasum -a 256 "${dest}" | awk '{print $1}')"
      fi
      if [ "${actual}" = "${expected}" ]; then
        echo "    [skip] ${dest}"
        return 0
      fi
      echo "    [update] ${dest}"
      rm -f "${dest}"
    else
      echo "    [skip] ${dest}"
      return 0
    fi
  fi
  echo "    [dl] ${url}"
  mkdir -p "$(dirname "${dest}")"
  if command -v curl >/dev/null 2>&1; then
    curl -fSL --retry 3 --connect-timeout 30 -o "${dest}" "${url}" || {
      echo "WARN: echec ${url}" >&2
      return 1
    }
  elif command -v wget >/dev/null 2>&1; then
    wget -q --tries=3 --timeout=60 -O "${dest}" "${url}" || {
      echo "WARN: echec ${url}" >&2
      return 1
    }
  else
    echo "ERROR: ni curl ni wget installes" >&2
    return 1
  fi
  return 0
}

OSARCH="$(os_arch)"

# --- web ---
if [ "${SKIP_WEB}" != "1" ]; then
  step "Build frontend Vite"
  pushd "${WEB_ROOT}" >/dev/null
  [ -d node_modules ] || npm ci
  npm run check
  npm run build
  popd >/dev/null
  cp -R "${WEB_ROOT}/dist/." "${BUNDLE_WEB}/"
  while IFS= read -r f; do add_checksum "${f}"; done < <(find "${BUNDLE_WEB}" -type f)
fi

# --- Go ---
if [ "${SKIP_GO}" != "1" ] && command -v go >/dev/null 2>&1; then
  step "Build gateway Go statique"
  pushd "${GATEWAY_ROOT}" >/dev/null
  CGO_ENABLED=0 go build -trimpath -ldflags="-s -w -X main.version=${VERSION}" \
    -o "${BUNDLE_BIN}/antaerus-gateway" ./cmd/gateway
  go test ./...
  popd >/dev/null
  add_checksum "${BUNDLE_BIN}/antaerus-gateway"
fi

# --- Rust ---
if [ "${SKIP_RUST}" != "1" ] && command -v cargo >/dev/null 2>&1; then
  step "Build engine Rust release"
  pushd "${RUST_ROOT}" >/dev/null
  cargo build --release
  if [ -f "target/release/antaerus-engine" ]; then
    cp -f "target/release/antaerus-engine" "${BUNDLE_BIN}/antaerus-engine"
    add_checksum "${BUNDLE_BIN}/antaerus-engine"
  fi
  popd >/dev/null
fi

# --- Python standalone ---
if [ "${SKIP_PYTHON}" != "1" ]; then
  step "Python standalone + venv relocalisable"
  case "${OSARCH}" in
    linux-x86_64)
      PY_URL="https://github.com/indygreg/python-build-standalone/releases/download/20240415/cpython-3.11.9+20240415-x8664-unknown-linux-gnu-install_only.tar.gz"
      ;;
    linux-aarch64)
      PY_URL="https://github.com/indygreg/python-build-standalone/releases/download/20240415/cpython-3.11.9+20240415-aarch64-linux-gnu-install_only.tar.gz"
      ;;
    darwin-x86_64)
      PY_URL="https://github.com/indygreg/python-build-standalone/releases/download/20240415/cpython-3.11.9+20240415-x86_64-apple-darwin-install_only.tar.gz"
      ;;
    darwin-aarch64)
      PY_URL="https://github.com/indygreg/python-build-standalone/releases/download/20240415/cpython-3.11.9+20240415-aarch64-apple-darwin-install_only.tar.gz"
      ;;
    *)
      echo "WARN: arch inconnue ${OSARCH}, skip Python standalone" >&2
      PY_URL=""
      ;;
  esac
  if [ -n "${PY_URL}" ] && [ "${SKIP_DOWNLOADS}" != "1" ]; then
    PY_TGZ="${BUNDLE_PYTHON}/python-3.11.tar.gz"
    download "${PY_URL}" "${PY_TGZ}" || true
    if [ -f "${PY_TGZ}" ] && [ ! -x "${BUNDLE_PYTHON}/3.11/bin/python3" ]; then
      tar -xzf "${PY_TGZ}" -C "${BUNDLE_PYTHON}" --strip-components=1 2>/dev/null || true
      [ -d "${BUNDLE_PYTHON}/python" ] && mv "${BUNDLE_PYTHON}/python" "${BUNDLE_PYTHON}/3.11" 2>/dev/null || true
    fi
  fi
  PY_SYS="$(command -v python3 || true)"
  if [ -n "${PY_SYS}" ]; then
    if [ ! -x "${BUNDLE_VENV}/bin/python" ]; then
      "${PY_SYS}" -m venv "${BUNDLE_VENV}" --without-pip || "${PY_SYS}" -m venv "${BUNDLE_VENV}"
    fi
    "${BUNDLE_VENV}/bin/python" -m ensurepip --upgrade 2>/dev/null || true
    "${BUNDLE_VENV}/bin/python" -m pip install --upgrade pip setuptools wheel >/dev/null
    if [ -f "${BRAIN_ROOT}/requirements.txt" ]; then
      "${BUNDLE_VENV}/bin/python" -m pip install -r "${BRAIN_ROOT}/requirements.txt" >/dev/null
    fi
  else
    echo "WARN: python3 absent, venv non construit" >&2
  fi
  cp -R "${BRAIN_ROOT}/src/antaerus_brain" "${BUNDLE_BRAIN}/"
  [ -f "${BRAIN_ROOT}/bootstrap.py" ] && cp -f "${BRAIN_ROOT}/bootstrap.py" "${BUNDLE_BRAIN}/bootstrap.py" || true
fi

# --- modeles ---
if [ "${SKIP_DOWNLOADS}" != "1" ]; then
  step "Preparation telechargements modeles"
  download "https://openaipublic.azureedge.net/main/whisper/models/37/f5a50d2e77f5f2ef9a3f9a1cb66ef42f1f6f683e1a7e08c935a68ecabbd9d0f8/base.pt" \
    "${BUNDLE_MODELS}/whisper-base.pt" || true
  download "https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_US/lessac/medium/en_US-lessac-medium.onnx?download=true" \
    "${BUNDLE_MODELS}/en_US-lessac-medium.onnx" || true
  download "https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_US/lessac/medium/en_US-lessac-medium.onnx.json?download=true" \
    "${BUNDLE_MODELS}/en_US-lessac-medium.onnx.json" || true
  download "https://github.com/ultralytics/assets/releases/download/v0.0.0/yolov8n.pt" \
    "${BUNDLE_MODELS}/yolov8n.pt" || true
  while IFS= read -r f; do add_checksum "${f}"; done < <(find "${BUNDLE_MODELS}" -maxdepth 1 -type f)
fi

# --- .env.example ---
cp -f "${REPO_ROOT}/antaerus/.env.example" "${BUNDLE_ROOT}/.env.example"
add_checksum "${BUNDLE_ROOT}/.env.example"

# --- ruff/mypy brain ---
step "Qualimetrie Python brain M6 (ruff, mypy, pytest)"
if [ -n "${PY_SYS:-}" ] && [ -x "${BUNDLE_VENV}/bin/python" ]; then
  pushd "${BRAIN_ROOT}" >/dev/null
  "${BUNDLE_VENV}/bin/python" -m pip install ruff mypy pytest pytest-asyncio aiosqlite >/dev/null 2>&1 || true
  "${BUNDLE_VENV}/bin/python" -m ruff check src/antaerus_brain/memory src/antaerus_brain/api/memory_plus.py || true
  "${BUNDLE_VENV}/bin/python" -m mypy src/antaerus_brain/memory src/antaerus_brain/api/memory_plus.py --ignore-missing-imports || true
  popd >/dev/null
fi

# --- build manifest.json ---
TAKEN_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

py_version() { if [ -x "${BUNDLE_VENV}/bin/python" ]; then "${BUNDLE_VENV}/bin/python" -V 2>&1 | tr -d '\n'; else echo "n/a"; fi; }
go_version() { command -v go >/dev/null 2>&1 && go version | tr -d '\n' || echo "n/a"; }
rust_version() { command -v rustc >/dev/null 2>&1 && rustc -V | tr -d '\n' || echo "n/a"; }

checksums_json() {
  local first=1
  printf "{"
  for k in "${!CHECKSUMS[@]}"; do
    [ "${first}" = "0" ] && printf ","
    first=0
    printf '"%s":"%s"' "${k}" "${CHECKSUMS[$k]}"
  done
  printf "}"
}

# utiliser python3 si dispo pour JSON propre
if command -v python3 >/dev/null 2>&1; then
  python3 - "$VERSION" "$OSARCH" "$TAKEN_AT" "$(go_version)" "$(rust_version)" "$(py_version)" "$(checksums_json)" "${BUNDLE_ROOT}/manifest.json" <<'PY'
import json, sys
v, arch, ts, go_v, rust_v, py_v, cs, out = sys.argv[1:9]
checksums = json.loads(cs) if cs else {}
manifest = {
  "name": "aNtaerus",
  "version": v,
  "architecture": arch,
  "takenAt": ts,
  "layers": {"web": "vite dist", "gateway": go_v, "brain": py_v, "engine": rust_v},
  "modelsPlaceholders": ["whisper-base.pt", "en_US-lessac-medium.onnx", "en_US-lessac-medium.onnx.json", "yolov8n.pt"],
  "entryPoints": {
    "web": "./web/index.html",
    "gateway": "./bin/antaerus-gateway",
    "engine": "./bin/antaerus-engine",
    "brain": "./.venv/bin/python ./brain/bootstrap.py",
  },
  "checksums": checksums,
  "constraints": {"newDependencies": "0", "architecture": "4 couches React -> Go -> Python -> Rust"},
}
with open(out, "w", encoding="utf-8") as f:
  json.dump(manifest, f, indent=2, ensure_ascii=False)
PY
else
  cat > "${BUNDLE_ROOT}/manifest.json" <<EOF
{
  "name": "aNtaerus",
  "version": "${VERSION}",
  "architecture": "${OSARCH}",
  "takenAt": "${TAKEN_AT}",
  "checksums": $(checksums_json)
}
EOF
fi

printf '\n\033[1;32m[DONE]\033[0m Bundle ecrit : %s\n' "${BUNDLE_ROOT}"
echo "  manifest : ${BUNDLE_ROOT}/manifest.json"
echo "  fichiers signes : ${#CHECKSUMS[@]}"
