#!/bin/sh
set -e

python manage.py migrate --noinput
python manage.py ensure_admin_from_env
python manage.py collectstatic --noinput || true

exec "$@"
