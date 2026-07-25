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

lock_service() {
  local service="$1"
  if gcloud run services get-iam-policy "${service}" \
    --project="${PROJECT_ID}" \
    --region="${REGION}" \
    --flatten='bindings[].members' \
    --filter='bindings.role=roles/run.invoker AND bindings.members=allUsers' \
    --format='value(bindings.members)' | grep -q allUsers; then
    gcloud run services remove-iam-policy-binding "${service}" \
      --project="${PROJECT_ID}" \
      --region="${REGION}" \
      --member=allUsers \
      --role=roles/run.invoker >/dev/null
  fi
  gcloud run services update "${service}" \
    --project="${PROJECT_ID}" \
    --region="${REGION}" \
    --invoker-iam-check \
    --min-instances=0
}

lock_service "${BACKEND}"
lock_service "${FRONTEND}"
echo "Glance is private and scales to zero."
