#!/bin/sh
# Create/upgrade every service's schema in its own database, then seed it.
#   pnpm db:setup            # migrate + seed
#   pnpm db:setup --no-seed  # migrate only
#
# Connects to the Postgres from docker/docker-compose.db.yaml using the
# POSTGRES_* values in docker/.env (override with env vars). Databases are
# created by docker/postgres/init-databases.sql on first start.
set -e
cd "$(dirname "$0")/.."

if [ -f docker/.env ]; then
	# shellcheck disable=SC1091
	set -a; . docker/.env; set +a
fi
PGHOST=${POSTGRES_HOST:-localhost}
PGPORT=${POSTGRES_PORT:-5432}
PGUSER=${POSTGRES_USER:-postgres}
PGPASS=${POSTGRES_PASSWORD:-12345}
SEED=1
[ "$1" = "--no-seed" ] && SEED=0

# app:database — order matters for seeding: authorization's seed reads the
# exam/resource/live databases, notification's seed reads auth.
if [ "$SEED" = 1 ]; then
	# placeholder media for the file ids the seeds reference (+ upload to MinIO)
	node scripts/dev-media/generate.mjs || echo "!! dev media upload failed (is MinIO up?); file-service seed still indexes eng-media/"
fi

SERVICES="auth:auth_db exam:exam_db achievement:achievement_db resource:resource_db live:live_db notification:notification_db authorization:authorization_db file-service:file_db"

for entry in $SERVICES; do
	app=${entry%%:*}
	db=${entry#*:}
	export POSTGRES_URL="postgresql://$PGUSER:$PGPASS@$PGHOST:$PGPORT/$db?schema=public"
	export POSTGRES_HOST=$PGHOST POSTGRES_PORT=$PGPORT POSTGRES_USER=$PGUSER POSTGRES_PASSWORD=$PGPASS POSTGRES_DB=$db
	echo "==> $app ($db)"
	(
		cd "apps/$app"
		pnpm exec prisma generate >/dev/null
		if [ -d prisma/migrations ]; then
			pnpm exec prisma migrate deploy
		else
			pnpm exec prisma db push --skip-generate
		fi
		if [ "$SEED" = 1 ]; then
			pnpm exec prisma db seed || echo "!! seed for $app failed"
		fi
	)
done
