#!/usr/bin/env bash
# One command to bring up everything the live demo needs, then check it.
# Safe to run repeatedly: it only starts what is not already running.
#   ./scripts/demo-start.sh
set -u
cd "$(dirname "$0")/.."
LOG="${TMPDIR:-/tmp}"
OLLAMA_BIN="${OLLAMA_BIN:-$(command -v ollama || echo "$HOME/ollama-demo/ollama")}"
ok()   { printf '  ✅ %s\n' "$1"; }
warn() { printf '  ⚠️  %s\n' "$1"; FAILED=1; }
FAILED=0

echo "1/4 Local Gemma (Ollama)"
if ! curl -sf localhost:11434/api/version >/dev/null; then
  nohup "$OLLAMA_BIN" serve >"$LOG/kagaz-ollama.log" 2>&1 &
  for _ in 1 2 3 4 5 6 7 8; do curl -sf localhost:11434/api/version >/dev/null && break; sleep 1; done
fi
if curl -sf localhost:11434/api/version >/dev/null; then ok "Ollama is up"; else warn "Ollama did not start (binary: $OLLAMA_BIN)"; fi
MODELS=$(curl -sf localhost:11434/api/tags || echo '{}')
echo "$MODELS" | grep -q 'gemma4:e2b' && ok "gemma4:e2b present" || warn "missing model: run  $OLLAMA_BIN pull gemma4:e2b"
echo "$MODELS" | grep -q 'embeddinggemma' && ok "embeddinggemma present" || warn "missing model: run  $OLLAMA_BIN pull embeddinggemma"

echo "2/4 Warming Gemma (so the first offline answer is not a cold start)"
curl -sf localhost:11434/api/generate -d '{"model":"gemma4:e2b","prompt":"hi","stream":false,"keep_alive":"120m","options":{"num_predict":1}}' >/dev/null \
  && ok "Gemma loaded and kept warm for 2 h" || warn "could not warm Gemma"

echo "3/4 App (Vite dev server with Online + Offline AI enabled)"
if ! curl -sf localhost:5173/ >/dev/null; then
  (cd apps/kagaz && VITE_CLOUD_AI=1 VITE_OLLAMA_URL=http://localhost:11434 nohup pnpm exec vite --port 5173 >"$LOG/kagaz-vite.log" 2>&1 &)
  for _ in $(seq 1 30); do curl -sf localhost:5173/ >/dev/null && break; sleep 1; done
fi
curl -sf localhost:5173/ >/dev/null && ok "App is serving on http://localhost:5173" || warn "App did not start (see $LOG/kagaz-vite.log)"

echo "4/4 Google Cloud (Online mode)"
HEALTH=$(curl -sf localhost:5173/api/ai/health || true)
if echo "$HEALTH" | grep -q '"ok":true'; then ok "Vertex AI reachable through the proxy"; else warn "Vertex AI not reachable — run: gcloud auth application-default login"; fi

echo
if [ "$FAILED" = 0 ]; then
  echo "READY. Open http://localhost:5173 in Chrome (use DevTools → device toolbar for a phone view)."
  echo "Sample files: ~/Desktop/kagaz-demo-files   ·   Runbook: docs/guides/demo-runbook.md"
else
  echo "NOT READY — fix the ⚠️ items above, then run this script again."
  exit 1
fi
