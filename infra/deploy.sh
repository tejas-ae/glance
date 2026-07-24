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
BUILD_ACCOUNT="${BUILD_SERVICE_ACCOUNT:-glance-build}"
RUNTIME_ACCOUNT="${RUNTIME_SERVICE_ACCOUNT:-glance-runtime}"
BUILD_EMAIL="${BUILD_ACCOUNT}@${PROJECT_ID}.iam.gserviceaccount.com"
RUNTIME_EMAIL="${RUNTIME_ACCOUNT}@${PROJECT_ID}.iam.gserviceaccount.com"
EXPLAIN_MODEL="${MODEL_EXPLAIN:?Set MODEL_EXPLAIN in .env}"
EXPLAIN_FALLBACK_MODEL="${MODEL_EXPLAIN_FALLBACK:?Set MODEL_EXPLAIN_FALLBACK in .env}"
TTS_MODEL="${MODEL_TTS:?Set MODEL_TTS in .env}"
LIVE_MODEL="${MODEL_LIVE:?Set MODEL_LIVE in .env}"

gcloud run deploy "${BACKEND}" \
  --project="${PROJECT_ID}" \
  --region="${REGION}" \
  --source="${ROOT_DIR}/backend" \
  --build-service-account="projects/${PROJECT_ID}/serviceAccounts/${BUILD_EMAIL}" \
  --service-account="${RUNTIME_EMAIL}" \
  --no-invoker-iam-check \
  --min-instances=1 \
  --max-instances=1 \
  --session-affinity \
  --timeout=3600 \
  --set-env-vars="MOCK_MODE=${MOCK_MODE:-true},ENABLE_LIVE=${ENABLE_LIVE:-false},MODEL_EXPLAIN=${EXPLAIN_MODEL},MODEL_EXPLAIN_FALLBACK=${EXPLAIN_FALLBACK_MODEL},MODEL_TTS=${TTS_MODEL},MODEL_LIVE=${LIVE_MODEL},GOOGLE_CLOUD_PROJECT=${PROJECT_ID},GOOGLE_CLOUD_LOCATION=${GOOGLE_CLOUD_LOCATION:-global},AUDIO_WINDOW_S=${AUDIO_WINDOW_S:-60},FIRESTORE_COLLECTION=${FIRESTORE_COLLECTION:-rooms}"

BACKEND_URL="$(gcloud run services describe "${BACKEND}" \
  --project="${PROJECT_ID}" \
  --region="${REGION}" \
  --format='value(status.url)')"
BACKEND_WS_URL="${BACKEND_URL/https:/wss:}/ws"

gcloud run deploy "${FRONTEND}" \
  --project="${PROJECT_ID}" \
  --region="${REGION}" \
  --source="${ROOT_DIR}/frontend" \
  --build-service-account="projects/${PROJECT_ID}/serviceAccounts/${BUILD_EMAIL}" \
  --service-account="${RUNTIME_EMAIL}" \
  --no-invoker-iam-check \
  --min-instances=1 \
  --max-instances=1 \
  --session-affinity \
  --timeout=3600 \
  --set-build-env-vars="NEXT_PUBLIC_BACKEND_HTTP_URL=${BACKEND_URL},NEXT_PUBLIC_BACKEND_WS_URL=${BACKEND_WS_URL},NEXT_PUBLIC_AUDIO_WINDOW_S=${AUDIO_WINDOW_S:-60}" \
  --set-env-vars="NEXT_PUBLIC_BACKEND_HTTP_URL=${BACKEND_URL},NEXT_PUBLIC_BACKEND_WS_URL=${BACKEND_WS_URL},NEXT_PUBLIC_AUDIO_WINDOW_S=${AUDIO_WINDOW_S:-60}"

FRONTEND_URL="$(gcloud run services describe "${FRONTEND}" \
  --project="${PROJECT_ID}" \
  --region="${REGION}" \
  --format='value(status.url)')"

echo "Backend: ${BACKEND_URL}"
echo "Frontend: ${FRONTEND_URL}"
