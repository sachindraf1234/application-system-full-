#!/usr/bin/env bash
# secrets/vault.sh - seal / open the repo's secret files.
#
#   secrets/vault.sh seal   # encrypt plaintext secrets into secrets/vault/*.enc (safe to commit)
#   secrets/vault.sh open   # decrypt them back to the git-ignored paths the modules read
#   secrets/vault.sh status # show which secrets are sealed / present in plaintext
#
# The key is NOT in the repo. It lives in $ARENA_SECRETS_KEY (default /home/user/.arena_secrets.key,
# chmod 600). Keep a copy of that key somewhere safe: without it the .enc files cannot be opened.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VAULT="$ROOT/secrets/vault"
KEY="${ARENA_SECRETS_KEY:-/home/user/.arena_secrets.key}"

# name -> plaintext locations (space separated, relative to repo root)
declare -A TARGETS=(
  [transarabian-data-env]="modules/transarabian-agent/transarabian-agent/data/env.txt modules/transarabian-agent/uploads/env.txt"
  [ngrok-config]="modules/transarabian-agent/config/ngrok/ngrok.yml"
  [mail-monitor-env]="modules/transarabian-agent/.env"
)

enc() { openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt -pass "file:$KEY" "$@"; }

cmd="${1:-status}"
[ -f "$KEY" ] || { echo "missing key file: $KEY" >&2; exit 2; }
for name in "${!TARGETS[@]}"; do
  first="${TARGETS[$name]%% *}"
  case "$cmd" in
    seal)
      if [ -f "$ROOT/$first" ]; then
        enc -in "$ROOT/$first" -out "$VAULT/$name.enc"
        echo "sealed  $name"
      else
        echo "skip    $name (no plaintext at $first)"
      fi ;;
    open)
      [ -f "$VAULT/$name.enc" ] || { echo "no vault file for $name"; continue; }
      for p in ${TARGETS[$name]}; do
        mkdir -p "$(dirname "$ROOT/$p")"
        enc -d -in "$VAULT/$name.enc" -out "$ROOT/$p"
        chmod 600 "$ROOT/$p"
        echo "opened  $p"
      done ;;
    status)
      [ -f "$VAULT/$name.enc" ] && s=sealed || s="NOT sealed"
      [ -f "$ROOT/$first" ] && p=plaintext-present || p=plaintext-absent
      echo "$name: $s, $p" ;;
    *) echo "usage: $0 seal|open|status" >&2; exit 1 ;;
  esac
done
