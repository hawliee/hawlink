# Development validation

The deployed application is the single root `index.html`; these files are development checks only.

Browser checks: `node --test tests/browser.test.cjs` with Playwright installed and Chromium at `/usr/bin/chromium` (or set `CHROMIUM_PATH`). They use a plain temporary static server, isolated browser contexts, and an in-memory Supabase protocol mock. No test uploads go to a real account. They cover moving/resizing, links, uploads/paste, local persistence, backups, mobile width, account sign-in, private-object requests, cross-session polling, revision conflicts, refresh and sign-out.

The environment's managed Chromium blocks `file://` navigation, so direct file opening was not executed here. All UI checks were run through a plain static HTTP host with no backend. Neither an actual GitHub Pages deployment nor an actual Supabase project has been verified.

The SQL was also run twice successfully against PostgreSQL 17 with disposable Supabase-like `auth` and `storage` fixtures, followed by assertions proving owner access, other-account isolation, anonymous isolation, and a private bucket. These fixtures are not a real Supabase installation; final service integration still needs verification against the owner's project.

To repeat policy checks, create an empty disposable PostgreSQL database, then run these files with `psql -v ON_ERROR_STOP=1` in this order:

1. `tests/policy-fixtures.sql` (test scaffolding only; never run on your real project)
2. `supabase-setup.sql`
3. `supabase-setup.sql` again to check repeatability
4. `tests/policy-assertions.sql`
