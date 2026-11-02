#!/usr/bin/env bash
# GrantsNow images, one per version and environment (docs/docker-deployment.md).
# Usage: scripts/docker.sh build [env]                build grantsnow-<env>:<version>
#        scripts/docker.sh deploy [env] [version]     run it with .env.<env>.secrets and wait for health
#        scripts/docker.sh <tag|status|logs|stop> [env]
# env: dev|demo|uat|stage|prod, default GRANTSNOW_ENV in .env; version: default package.json's.
set -euo pipefail
cd "$(dirname "$0")/.."
version=$(node -p 'require("./package.json").version')
port=${PORT:-3000}
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

deploy() {
  local env=$1 image="grantsnow-$1:${2:-$version}" name="grantsnow-$1"
  [ -f ".env.$env.secrets" ] || die "Missing .env.$env.secrets: copy .env.secrets.example and fill it in."
  "${d[@]}" image inspect "$image" >/dev/null 2>&1 || die "No image $image: run scripts/docker.sh build $env first."
  "${d[@]}" rm -f "$name" >/dev/null 2>&1 || true
  "${d[@]}" run -d --name "$name" --restart unless-stopped -p "$port:3000" --env-file ".env.$env.secrets" "$image" >/dev/null
  for _ in $(seq 1 30); do
    curl -sf -o /dev/null "http://127.0.0.1:$port/api/health" &&
      { echo "$env runs $image on http://localhost:$port (health ok)"; return; }
    sleep 1
  done
  echo "$env is not healthy after 30s; last log lines:" >&2
  "${d[@]}" logs --tail 20 "$name" >&2
  exit 1
}

cmd=${1:-}
env=
case "${2:-}" in dev | demo | uat | stage | prod) env=$2 ;; esac
# With the environment named, the version is the third argument; without it, the second.
ver=${3:-}
[ -n "$env" ] || ver=${2:-}
case "$cmd" in
  build | deploy | tag | status | logs | stop) env=$(target "$env") ;;
  *) die "Usage: $0 <build [env]|deploy [env] [version]|tag|status|logs|stop [env]>" ;;
esac
case "$cmd" in
  build) build "$env" ;;
  deploy) deploy "$env" "$ver" ;;
  tag) echo "grantsnow-$env:$version" ;;
  status) "${d[@]}" ps -a --filter "name=^grantsnow-$env$" --format '{{.Names}}  {{.Image}}  {{.Status}}  {{.Ports}}' ;;
  logs) "${d[@]}" logs -f "grantsnow-$env" ;;
  stop) "${d[@]}" rm -f "grantsnow-$env" ;;
esac
