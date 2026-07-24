#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${GOOGLE_CLOUD_PROJECT:?Set GOOGLE_CLOUD_PROJECT first}"
REGION="${GOOGLE_CLOUD_REGION:-us-central1}"
REPOSITORY="${ARTIFACT_REPOSITORY:-glance}"
BUILD_ACCOUNT="${BUILD_SERVICE_ACCOUNT:-glance-build}"
RUNTIME_ACCOUNT="${RUNTIME_SERVICE_ACCOUNT:-glance-runtime}"
BUILD_EMAIL="${BUILD_ACCOUNT}@${PROJECT_ID}.iam.gserviceaccount.com"
RUNTIME_EMAIL="${RUNTIME_ACCOUNT}@${PROJECT_ID}.iam.gserviceaccount.com"

gcloud config set project "${PROJECT_ID}"
gcloud services enable \
  aiplatform.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  firestore.googleapis.com \
  run.googleapis.com

if ! gcloud artifacts repositories describe "${REPOSITORY}" \
  --location="${REGION}" >/dev/null 2>&1; then
  gcloud artifacts repositories create "${REPOSITORY}" \
    --repository-format=docker \
    --location="${REGION}" \
    --description="Glance Cloud Run images"
fi

if ! gcloud firestore databases describe --database="(default)" \
  >/dev/null 2>&1; then
  gcloud firestore databases create \
    --database="(default)" \
    --location="${REGION}" \
    --type=firestore-native
fi

if ! gcloud iam service-accounts describe "${BUILD_EMAIL}" >/dev/null 2>&1; then
  gcloud iam service-accounts create "${BUILD_ACCOUNT}" \
    --display-name="Glance build"
fi

if ! gcloud iam service-accounts describe "${RUNTIME_EMAIL}" >/dev/null 2>&1; then
  gcloud iam service-accounts create "${RUNTIME_ACCOUNT}" \
    --display-name="Glance runtime"
fi

gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${BUILD_EMAIL}" \
  --role="roles/run.builder" \
  --condition=None

gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${RUNTIME_EMAIL}" \
  --role="roles/aiplatform.user" \
  --condition=None

gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${RUNTIME_EMAIL}" \
  --role="roles/datastore.user" \
  --condition=None

echo "Glance cloud resources are ready in ${PROJECT_ID}/${REGION}."
