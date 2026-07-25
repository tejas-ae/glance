#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if [[ -f "${ROOT_DIR}/.env" ]]; then
  set -a
  source "${ROOT_DIR}/.env"
  set +a
fi

PROJECT_ID="${GOOGLE_CLOUD_PROJECT:?Set GOOGLE_CLOUD_PROJECT first}"
REGION="${GOOGLE_CLOUD_REGION:-us-central1}"
BACKEND="${BACKEND_SERVICE:-glance-backend}"
FRONTEND="${FRONTEND_SERVICE:-glance-frontend}"
BACKEND_URL="${BACKEND_URL:-$(gcloud run services describe "${BACKEND}" \
  --project="${PROJECT_ID}" --region="${REGION}" --format='value(status.url)')}"
FRONTEND_URL="${FRONTEND_URL:-$(gcloud run services describe "${FRONTEND}" \
  --project="${PROJECT_ID}" --region="${REGION}" --format='value(status.url)')}"

check_http() {
  local name="$1"
  local url="$2"
  local status
  status="$(curl -sS -o /dev/null -w '%{http_code}' "${url}")"
  if [[ "${status}" != "200" ]]; then
    echo "${name} verification failed: HTTP ${status}" >&2
    exit 1
  fi
  echo "${name}: HTTP ${status}"
}

check_http "Backend health" "${BACKEND_URL}/health"
check_http "Frontend" "${FRONTEND_URL}/"
node "${ROOT_DIR}/infra/verify_ws.mjs" "${BACKEND_URL/https:/wss:}/ws"
echo "Glance deployment is ready."
