#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
cd "$SCRIPT_DIR"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker no está instalado. Instale Docker Engine y el complemento Docker Compose, y vuelva a ejecutar este archivo." >&2
  exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "No se encontró Docker Compose v2. Instale el complemento Docker Compose y vuelva a ejecutar este archivo." >&2
  exit 1
fi

if [ ! -f .env ]; then
  if ! command -v openssl >/dev/null 2>&1; then
    echo "OpenSSL es necesario para generar secretos locales. Instálelo y vuelva a ejecutar este archivo." >&2
    exit 1
  fi

  umask 077
  {
    printf 'POSTGRES_PASSWORD=%s\n' "$(openssl rand -hex 32)"
    printf 'JWT_SECRET=%s\n' "$(openssl rand -hex 48)"
  } > .env
  echo "Se creó .env con secretos aleatorios locales."
fi

docker compose up --build -d
printf '\nRRHH-Simple está iniciando. Abra http://127.0.0.1:4000\n'
