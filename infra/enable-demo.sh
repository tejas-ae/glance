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

enable_service() {
  gcloud run services update "$1" \
    --project="${PROJECT_ID}" \
    --region="${REGION}" \
    --no-invoker-iam-check \
    --min-instances=1 \
    --max-instances=1 \
    --session-affinity \
    --timeout=3600
}

enable_service "${BACKEND}"
enable_service "${FRONTEND}"
"${ROOT_DIR}/infra/verify.sh"
echo "Glance is public for the demo. Run infra/lock.sh afterward."
