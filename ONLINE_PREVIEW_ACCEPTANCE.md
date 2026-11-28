# V7.0 Alpha 35 — Online preview / release gate

## Verified baseline

The isolated GitHub test branch has a Node test suite, a strict TypeScript + Vite build, a `dist/` asset gate, and an HTTP smoke test of the production preview server. A green CI run verifies only these automated checks; it **does not** verify real Supabase access, RLS, workflow writes, or browser responsiveness.

**This repo is public. Never commit `.env.local`, any `sb_secret_` or `service_role` value, student records, screenshots containing personal information, or SQL dumps.**

## Stage A — Offline-safe, no login/no writes (recommended first)

Use the `v7-build-review` artifact from a **green** GitHub Actions run on `test/v7-build-verification`. Extract its `dist/` folder and upload only the *contents* of `dist/` to a static hosting preview (e.g. Cloudflare Pages direct upload).

The CI workflow deliberately builds with:

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
VITE_ENABLE_WORKFLOW_WRITES=false
```

With empty connection parameters, the app displays a *Supabase configuration missing* screen. This is **expected** for Stage A and is useful for checking that the static site, HTTPS, JS/CSS assets, and mobile browser load. Stage A cannot show real users or students. Do not share it as a functioning class management system.

Do not use `localhost`, `npm run dev`, or repository `index.html` as a published URL. Static hosts receive the **built** `dist/`, never the React source folder.

## Stage B — Separate read-only preview (requires approval and browser verification)

Configure **build-time** environment variables on the static hosting provider:

- `VITE_SUPABASE_URL`: verified project public API URL
- `VITE_SUPABASE_PUBLISHABLE_KEY`: browser-safe publishable key only
- `VITE_ENABLE_WORKFLOW_WRITES=false`: leave this **false**

Vite embeds variables with `VITE_` into JS at **build time**. Rebuild after changing the values; changing the hosting environment after uploading a prebuilt `dist/` will not retrofit the compiled JS.

Prefer a separate staging Supabase project and test accounts, because read-only application controls do not replace server-side RLS and privacy protections. If the existing production project must be used, do not open access to students until class-by-class RLS and identity boundaries are verified.

**Do not enable writes simply because a preview works.** The attendance submission/review path still needs two-account RLS tests, disabled-account tests, and transaction acceptance in a safe test environment. Never run proposed SQL migrations on production without review.

## Checks before sharing a test link

1. Open the HTTPS preview from a desktop browser and two different mobile browsers or networks; check asset loading and layout.
2. Check missing Supabase configuration is explicit in Stage A. In Stage B, check a valid login and an invalid login, with all write actions disabled.
3. Validate a teacher account sees only authorized classes. Validate cadre account sees only delegated class(es), and account switching hides prior data.
4. Validate a disabled/delegated-revoked account can no longer read old data. Repeat after background/foreground app transitions.
5. Verify logout clears sensitive UI and browser reload does not restore cross-account data.
6. Review browser console/network logs; redact access tokens, personal information, and student names before sharing.
7. Test at desktop width and common mobile widths, with touch keyboard, pagination, filtering and return-from-background behavior.
8. Confirm repository branch remains `test/v7-build-verification`; no automatic public deployment from `main` is configured.

## Rollback and acceptance

Keep the existing class management site as the production system. Before any cutover, establish a rollback plan for hosting, account grants, and database migrations. A green CI run plus a functioning preview are **necessary but not sufficient** for production release.
