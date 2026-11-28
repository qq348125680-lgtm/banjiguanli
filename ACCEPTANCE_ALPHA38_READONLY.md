# V7.0 Alpha 38 — Read-only sign-in readiness (2026-11-28)

## Scope and evidence

This report was produced from **read-only inspection** of the existing Supabase project metadata and the V7 test-branch adapter source. It does not establish that real user sessions have passed authorization tests. No database writes or migration operations were performed.

### Current database observations

The following ten public tables have RLS enabled: `classes`, `students`, `class_delegates`, `cadre_submissions`, `operation_audit`, `attendance`, `leave_requests`, `incidents`, `point_events`, and `duty_assignments`.

Metadata inspection also found:
- `classes` and `students`: owner-scoped policies; delegates are not automatically authorized to read the student roster.
- `class_delegates`: delegates can read their own delegation records.
- `cadre_submissions`: policies distinguish submitter read/insert and class-owner access; actual behavior must be tested using distinct signed-in accounts.
- `operation_audit`: class owner read policy.
- No database functions named `public.v7_cadre_roster` or `public.v7_review_attendance` existed during inspection.

Therefore **cadre roster and review are not ready for production**, notwithstanding CI/build success.

### Release blockers

1. Validate SELECT paths using two isolated test identities (class owner, enabled delegate), including unrelated class and revoked delegate; never use service_role keys in a browser.
2. Create/review a safe delegate-roster interface only in an independent staging environment, with minimum student fields. Do not expose all student, guardian, or phone columns.
3. Review the proposed review transaction and implement in staging only after testing authorization, atomicity, idempotency, rejected requests, and audit trail; do not apply `sql/alpha9_PROPOSED_NOT_APPLIED.sql` to production.
4. Confirm all privileged functions EXECUTE grants and invoker/definer behavior before granting access.
5. Validate disabled-account behavior and data clearing after login/logout/account/class switching, network recovery and tab foreground changes.
6. Keep `VITE_ENABLE_WORKFLOW_WRITES=false` until the two-account staging acceptance suite passes.
7. Production teachers must retain access to their existing working system throughout the trial.

### Safe preview state

GitHub Pages is a public **technical preview**, built with empty Supabase URL/key and writes disabled. This is intended to display an informational page; it **cannot authenticate or display real students**.

Do not add the production Supabase URL/key to the GitHub Pages workflow merely to make login appear. A publishable key can be used in browser code only when the actual RLS and grants have been verified.

### Next acceptance evidence to collect

- Screenshot/record of signed-in class owner: only assigned classes, masked/least-privilege roster, no write buttons.
- Screenshot/record of authorized delegate: only delegated class, restricted roster, own submissions.
- Negative results for an unrelated account, a disabled delegate, and a stale session.
- GitHub Actions passes: Node tests, static typecheck, Vite build, asset checks and smoke test.
- Rollback plan and confirmation that `main` and the existing Supabase project remain unchanged.

No real students' names or personal identifiers should be attached to a public GitHub issue or commit.
