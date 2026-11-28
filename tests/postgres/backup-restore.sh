#!/usr/bin/env bash
set -euo pipefail
# Synthetic-only backup/restore rehearsal. Fails closed if pointed at another DB.
if [[ "${PGDATABASE:-}" != "v7_contract_test" || "${PGUSER:-}" != "postgres" ]]; then
 echo "Refusing backup/restore outside the disposable V7 contract database" >&2
 exit 2
fi
backup="$(mktemp /tmp/v7-synthetic-XXXXXX.dump)"
trap 'rm -f "$backup"' EXIT
before="$(psql -X -v ON_ERROR_STOP=1 -At -c 'select count(*) from public.attendance')"
if [[ "$before" != "2" ]]; then echo "Unexpected synthetic row count before backup: $before" >&2;exit 1;fi
pg_dump -Fc --no-owner --file="$backup" v7_contract_test
if [[ ! -s "$backup" ]]; then echo "Synthetic backup archive empty" >&2;exit 1;fi
# Deliberately destroy one record ONLY inside the disposable test database.
psql -X -v ON_ERROR_STOP=1 -q -c "delete from public.attendance where on_date='2026-11-28'"
damaged="$(psql -X -v ON_ERROR_STOP=1 -At -c 'select count(*) from public.attendance')"
if [[ "$damaged" != "1" ]]; then echo "Synthetic destruction drill failed: $damaged rows" >&2;exit 1;fi
createdb --template=template0 v7_restored_contract
pg_restore --exit-on-error --no-owner --dbname=v7_restored_contract "$backup"
restored="$(PGDATABASE=v7_restored_contract psql -X -v ON_ERROR_STOP=1 -At -c 'select count(*) from public.attendance')"
leaves="$(PGDATABASE=v7_restored_contract psql -X -v ON_ERROR_STOP=1 -At -c "select count(*) from public.cadre_submissions where entry_type='请假'")"
orphans="$(PGDATABASE=v7_restored_contract psql -X -v ON_ERROR_STOP=1 -At -c "select count(*) from public.attendance a left join public.students s on s.id=a.student_id where s.id is null")"
rls="$(PGDATABASE=v7_restored_contract psql -X -v ON_ERROR_STOP=1 -At -c "select relrowsecurity from pg_class where oid='public.cadre_submissions'::regclass")"
if [[ "$restored" != "2" || "$leaves" != "2" || "$orphans" != "0" || "$rls" != "t" ]]; then
 echo "Backup restore validation failed; attendance=$restored leave=$leaves orphans=$orphans RLS=$rls" >&2
 exit 1
fi
echo "PASS: synthetic backup restored a deliberately deleted attendance row in a fresh PostgreSQL DB; leave rows, references and RLS intact."
