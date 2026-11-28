#!/usr/bin/env bash
set -uo pipefail
# Real parallel PostgreSQL transactions against SYNTHETIC fixture only.
# Both approve the same pending request. Exactly one must commit.
cmd="BEGIN; SET LOCAL ROLE authenticated; SET LOCAL request.jwt.claim.sub='11111111-1111-4111-8111-111111111111'; SELECT public.v7_review_attendance('cccccccc-cccc-4ccc-8ccc-000000000004','approve','并发验收'); COMMIT;"
psql -X -v ON_ERROR_STOP=1 -c "$cmd" >/tmp/v7-approve-a.log 2>&1 &
pid_a=$!
psql -X -v ON_ERROR_STOP=1 -c "$cmd" >/tmp/v7-approve-b.log 2>&1 &
pid_b=$!
wait "$pid_a"; code_a=$?
wait "$pid_b"; code_b=$?
if ! { { [[ "$code_a" -eq 0 ]] && [[ "$code_b" -ne 0 ]]; } || { [[ "$code_b" -eq 0 ]] && [[ "$code_a" -ne 0 ]]; }; }; then
 echo "Expected exactly one approved transaction, got exit codes $code_a / $code_b" >&2
 cat /tmp/v7-approve-a.log /tmp/v7-approve-b.log >&2
 exit 1
fi
posted="$(psql -X -v ON_ERROR_STOP=1 -At -c "select count(*) from public.attendance where student_id='aaaaaaaa-0000-4000-8000-000000000001' and on_date='2026-12-01'")"
approved="$(psql -X -v ON_ERROR_STOP=1 -At -c "select count(*) from public.cadre_submissions where id='cccccccc-cccc-4ccc-8ccc-000000000004' and status='已通过'")"
if [[ "$posted" != "1" || "$approved" != "1" ]]; then
 echo "Concurrent approval did not leave exactly one posted attendance and one approved request" >&2
 exit 1
fi
echo "PASS: parallel approvals serialized (one commit, one rejection); posted=1, approved=1"
