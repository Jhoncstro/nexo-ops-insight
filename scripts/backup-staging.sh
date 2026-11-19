#!/usr/bin/env bash
set -euo pipefail
# Manual only. PG* connection variables must identify a staging database.
: "${NEXUS_BACKUP_TARGET:?Set NEXUS_BACKUP_TARGET=staging after verifying the connection}"
[ "$NEXUS_BACKUP_TARGET" = staging ] || { echo 'Only staging backups are supported by this script.' >&2; exit 1; }
: "${PGHOST:?Set PGHOST}" "${PGDATABASE:?Set PGDATABASE}" "${PGUSER:?Set PGUSER}"
[ "$#" -eq 1 ] || { echo 'Usage: scripts/backup-staging.sh /secure/path/backup.dump' >&2; exit 1; }
[ ! -e "$1" ] || { echo 'Destination already exists.' >&2; exit 1; }
umask 077
pg_dump --format=custom --no-owner --no-acl --file="$1"
pg_restore --list "$1" > /dev/null
echo 'Backup created and archive index checked. A restore drill is still required.'
