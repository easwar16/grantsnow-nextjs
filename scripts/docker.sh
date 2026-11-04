#!/usr/bin/env bash
# GrantsNow images, one per version and environment (docs/docker-deployment.md).
#
# Usage: scripts/docker.sh <command> [env] [version]
#
# Local images
#   build   [env]            Build image grantsnow-<env>:<version>, .env.<env> baked in without secrets (refuses an existing one).
#   rmi     [env] [version]  Delete the local image and its registry tag, so build can make that version again.
#   tag     [env]            Print the image name for this environment and version.
#
# Local container
#   secrets [env]            Add the secret keys to .env.<env>, a new SESSION_PASSWORD if missing; name the empty ones.
#   deploy  [env] [version]  Run it as container grantsnow-<env> with .env.<env> (secrets) on PORT 3000; wait for health.
#   status  [env]            Show the container's image, state and ports.
#   logs    [env]            Follow the container's log (Ctrl+C to stop).
#   stop    [env]            Stop and remove the container (the image stays).
#
# Azure registry (REGISTRY, default gncontaineregistry.azurecr.io; az acr login first)
#   push    [env] [version]  Tag the local image for the registry and push it.
#   remove  [env] [version]  Delete that version from the registry (az asks to confirm).
#
# Azure Container App (AZ_APP, default gn-migration-ca; AZ_GROUP, default Grantsnow-Migration; az login first)
#   azure-secrets [env]      Store the secrets from .env.<env> as Container App secrets and wire them to the container.
#   release [env] [version]  Point the Container App at that pushed version (a new revision).
#
#   help                     Show this list.
#
# env: dev|demo|uat|stage|prod, default GRANTSNOW_ENV in .env. version: default package.json's.
set -euo pipefail
cd "$(dirname "$0")/.."
version=$(node -p 'require("./package.json").version')
port=${PORT:-3000}
# The Azure Container Registry the Container Apps pull from.
registry=${REGISTRY:-gncontaineregistry.azurecr.io}
# The Azure Container App that runs the image.
az_app=${AZ_APP:-gn-migration-ca}
az_group=${AZ_GROUP:-Grantsnow-Migration}
# A shell opened before joining the docker group has no socket access; sudo asks for the password instead.
d=(docker)
docker info >/dev/null 2>&1 || d=(sudo docker)

die() { echo "$*" >&2; exit 1; }
# The environment named on the command line, or else the one .env selects.
target() {
  local e=${1:-}
  [ -n "$e" ] || [ ! -f .env ] || e=$(sed -n 's/^GRANTSNOW_ENV=//p' .env | tr -d "[:space:]\"'")
  case "$e" in dev | demo | uat | stage | prod) echo "$e" ;; *) die "Environment must be dev, demo, uat, stage or prod (argument or GRANTSNOW_ENV in .env)." ;; esac
}

build() {
  local env=$1 image="grantsnow-$1:$version"
  [ -f ".env.$env" ] || die "Missing .env.$env."
  # A version is built once per environment; a new build needs a new version (npm version patch|minor|major).
  "${d[@]}" image inspect "$image" >/dev/null 2>&1 &&
    die "$image already exists: bump the version, or remove it first (docker rmi $image)."
  "${d[@]}" build -t "$image" --build-arg GRANTSNOW_ENV="$env" \
    --label grantsnow.env="$env" \
    --label org.opencontainers.image.version="$version" \
    --label org.opencontainers.image.revision="$(git rev-parse HEAD)" \
    --label org.opencontainers.image.created="$(date -u +%FT%TZ)" .
  echo "Built $image"
}

# The secrets live in .env.<env> beside the settings (baked without them; passed to the container at run time).
secret_keys=(SESSION_PASSWORD IDCS_CLIENT_SECRET ORDS_BASE_CLIENT_ID ORDS_BASE_CLIENT_SECRET ORDS_APPS_CLIENT_ID
  ORDS_APPS_CLIENT_SECRET GN_OIC_USER GN_OIC_PASSWORD)
# Adds the missing secret keys to .env.<env>, a random SESSION_PASSWORD if it has none, and names the empty ones.
secrets() {
  local file=".env.$1" key password empty=
  [ -f "$file" ] || die "Missing $file."
  for key in "${secret_keys[@]}"; do
    grep -q "^$key=" "$file" || printf '%s=\n' "$key" >>"$file"
  done
  if ! grep -qE '^SESSION_PASSWORD=.{32,}' "$file"; then
    password=$(node -e 'console.log(require("crypto").randomBytes(36).toString("base64url"))')
    sed -i "s|^SESSION_PASSWORD=.*|SESSION_PASSWORD=$password|" "$file"
    echo "Added a new SESSION_PASSWORD to $file."
  fi
  chmod 600 "$file"
  # Names only: the values never reach the terminal.
  for key in "${secret_keys[@]}"; do grep -qE "^$key=[^[:space:]]" "$file" || empty+="$key "; done
  [ -z "$empty" ] && echo "$file has every secret." || echo "Still to fill in $file: $empty"
}
# What a container needs from .env.<env>: a SESSION_PASSWORD of at least 32 characters.
check_secrets() {
  local file=".env.$1" length
  [ -f "$file" ] || die "Missing $file."
  length=$(sed -n 's/^SESSION_PASSWORD=//p' "$file" | tr -d "\"'" | tail -1 | tr -d '\n' | wc -c)
  [ "$length" -ge 32 ] || die "SESSION_PASSWORD in $file is missing or shorter than 32 characters (scripts/docker.sh secrets $1 makes one)."
}

deploy() {
  local env=$1 image="grantsnow-$1:${2:-$version}" name="grantsnow-$1"
  check_secrets "$env"
  "${d[@]}" image inspect "$image" >/dev/null 2>&1 || die "No image $image: run scripts/docker.sh build $env first."
  "${d[@]}" rm -f "$name" >/dev/null 2>&1 || true
  "${d[@]}" run -d --name "$name" --restart unless-stopped -p "$port:3000" --env-file ".env.$env" "$image" >/dev/null
  for _ in $(seq 1 30); do
    curl -sf -o /dev/null "http://127.0.0.1:$port/api/health" &&
      { echo "$env runs $image on http://localhost:$port (health ok)"; return; }
    sleep 1
  done
  echo "$env is not healthy after 30s; last log lines:" >&2
  "${d[@]}" logs --tail 20 "$name" >&2
  exit 1
}

# The local image, tagged with the registry's name and pushed; the Container App then runs that tag.
push() {
  local image="grantsnow-$1:${2:-$version}"
  "${d[@]}" image inspect "$image" >/dev/null 2>&1 || die "No image $image: run scripts/docker.sh build $1 first."
  "${d[@]}" tag "$image" "$registry/$image"
  "${d[@]}" push "$registry/$image" || die "Push failed: sign in first (az acr login --name ${registry%%.*})."
  echo "Pushed $registry/$image"
}

# Deletes one version from the registry; az asks before deleting. A revision still running it keeps running, but
# cannot pull it again (a restart or a new replica fails), so point the Container App at another tag first.
remove() {
  local image="grantsnow-$1:${2:-$version}"
  command -v az >/dev/null || die "The Azure CLI (az) is needed: https://aka.ms/azcli"
  az acr repository delete --name "${registry%%.*}" --image "$image"
}

# The local image and its registry-tagged copy; a container still using it must be stopped first.
rmi() {
  local image="grantsnow-$1:${2:-$version}"
  "${d[@]}" image inspect "$image" >/dev/null 2>&1 || die "No local image $image."
  "${d[@]}" ps -a --filter "ancestor=$image" --format '{{.Names}}' | grep -q . &&
    die "A container uses $image: run scripts/docker.sh stop $1 first."
  "${d[@]}" rmi "$image" >/dev/null
  "${d[@]}" rmi "$registry/$image" >/dev/null 2>&1 || true
  echo "Removed $image"
}

# The image carries no secrets, so the Container App holds them: each non-empty secret key in .env.<env> becomes a
# Container App secret (lower-case name) and an environment variable that refers to it. Values never reach the terminal.
azure_secrets() {
  local file=".env.$1" key value name secrets=() refs=()
  command -v az >/dev/null || die "The Azure CLI (az) is needed: https://aka.ms/azcli"
  [ -f "$file" ] || die "Missing $file."
  for key in "${secret_keys[@]}"; do
    value=$(sed -n "s/^$key=//p" "$file" | tail -1)
    [ -n "$value" ] || continue
    name=$(echo "$key" | tr 'A-Z_' 'a-z-')
    secrets+=("$name=$value")
    refs+=("$key=secretref:$name")
  done
  [ ${#secrets[@]} -gt 0 ] || die "No secrets set in $file."
  az containerapp secret set --name "$az_app" --resource-group "$az_group" --secrets "${secrets[@]}" >/dev/null
  az containerapp update --name "$az_app" --resource-group "$az_group" --set-env-vars "${refs[@]}" >/dev/null
  echo "$az_app now holds: ${refs[*]%%=*}"
}
# A new revision of the Container App running that pushed image.
release() {
  local image="$registry/grantsnow-$1:${2:-$version}"
  command -v az >/dev/null || die "The Azure CLI (az) is needed: https://aka.ms/azcli"
  az containerapp update --name "$az_app" --resource-group "$az_group" --image "$image" >/dev/null
  echo "$az_app now runs $image"
}
usage() { sed -n '2,/^# env:/s/^# \{0,1\}//p' "$0"; }

cmd=${1:-}
case "$cmd" in help | -h | --help | "") usage; exit 0 ;; esac
env=
case "${2:-}" in dev | demo | uat | stage | prod) env=$2 ;; esac
# With the environment named, the version is the third argument; without it, the second.
ver=${3:-}
[ -n "$env" ] || ver=${2:-}
case "$cmd" in
  build | deploy | push | remove | rmi | azure-secrets | release | secrets | tag | status | logs | stop) env=$(target "$env") ;;
  *) { echo "Unknown command: $cmd" >&2; usage >&2; exit 1; } ;;
esac
case "$cmd" in
  build) build "$env" ;;
  deploy) deploy "$env" "$ver" ;;
  push) push "$env" "$ver" ;;
  remove) remove "$env" "$ver" ;;
  rmi) rmi "$env" "$ver" ;;
  azure-secrets) azure_secrets "$env" ;;
  release) release "$env" "$ver" ;;
  secrets) secrets "$env" ;;
  tag) echo "grantsnow-$env:$version" ;;
  status) "${d[@]}" ps -a --filter "name=^grantsnow-$env$" --format '{{.Names}}  {{.Image}}  {{.Status}}  {{.Ports}}' ;;
  logs) "${d[@]}" logs -f "grantsnow-$env" ;;
  stop) "${d[@]}" rm -f "grantsnow-$env" ;;
esac
