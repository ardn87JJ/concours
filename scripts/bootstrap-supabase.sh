#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT_DIR/.env.local"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Fichier .env.local introuvable à la racine du projet." >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

if [[ -z "${VITE_SUPABASE_URL:-}" || -z "${VITE_SUPABASE_PUBLISHABLE_KEY:-}" ]]; then
  echo "VITE_SUPABASE_URL et VITE_SUPABASE_PUBLISHABLE_KEY sont requis." >&2
  exit 1
fi

read -r -p "Nom du concours : " contest_name
read -r -p "Lieu : " contest_location
read -r -p "Date de début (AAAA-MM-JJ) : " contest_start_date
read -r -p "Date de fin (AAAA-MM-JJ) : " contest_end_date
read -r -p "Description (facultative) : " contest_description
read -r -p "Nom de l’administrateur : " admin_name
read -r -p "Contact administrateur (facultatif) : " admin_contact
read -r -s -p "Mot de passe administrateur (6 caractères minimum) : " admin_password
echo

if (( ${#admin_password} < 6 )); then
  echo "Le mot de passe doit contenir au moins 6 caractères." >&2
  exit 1
fi

payload="$(
  jq -n \
    --arg contestName "$contest_name" \
    --arg contestLocation "$contest_location" \
    --arg contestStartDate "$contest_start_date" \
    --arg contestEndDate "$contest_end_date" \
    --arg contestDescription "$contest_description" \
    --arg adminName "$admin_name" \
    --arg adminContact "$admin_contact" \
    --arg adminPassword "$admin_password" \
    '{
      contestName: $contestName,
      contestLocation: $contestLocation,
      contestStartDate: $contestStartDate,
      contestEndDate: $contestEndDate,
      contestDescription: $contestDescription,
      adminName: $adminName,
      adminContact: $adminContact,
      adminPassword: $adminPassword
    }'
)"

response="$(
  curl --fail-with-body --silent --show-error \
    --request POST "$VITE_SUPABASE_URL/functions/v1/bootstrap-admin" \
    --header "apikey: $VITE_SUPABASE_PUBLISHABLE_KEY" \
    --header "Content-Type: application/json" \
    --data "$payload"
)"

echo "$response" | jq .
echo "Initialisation Supabase terminée."
