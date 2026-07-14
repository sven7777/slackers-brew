# Supabase setup

Backend for the hosted, multi-brewer version of the app (roadmap Step 3).
Model: **one shared brewery, invite-only**. See [schema.sql](schema.sql) for the
data model and row-level-security rationale.

## One-time setup

1. **Create the project** at [supabase.com](https://supabase.com) — region closest
   to the brewers, save the database password, free tier is fine.
2. **Run [schema.sql](schema.sql)** in the SQL Editor (paste → Run).
3. **Add brewers** to the allowlist (Table Editor → `members`, or SQL):
   ```sql
   insert into members (email) values ('you@example.com');
   ```
4. **Auth → URL Configuration:**
   - Site URL: `https://brew.slackersbrewing.com`
   - Redirect URLs: add `https://brew.slackersbrewing.com` and `http://localhost:5173`
5. **Auth → Providers:** enable **Email (magic link)** to start, and **Google**
   for one-click sign-in without the magic-link email rate limit (see below).

## Migrations

Schema/data changes after the initial `schema.sql` live in
[migrations/](migrations/) as ordered `NNNN_name.sql` files. They are applied
to the live database **automatically by CI**: merging to `main` runs the
`migrate` job in [.github/workflows/deploy.yml](../.github/workflows/deploy.yml)
(`supabase link` + `supabase db push`). The CLI keeps a migration-history table
on the remote, so only unseen files run — merges with no new migration are a
no-op. Keep migrations additive and idempotent where possible, since they run
unattended against production.

Secrets the workflow needs (repo → Settings → Secrets and variables → Actions):
`SUPABASE_ACCESS_TOKEN` (personal access token), `SUPABASE_DB_PASSWORD`,
`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and `DREAMHOST_SSH_KEY`
(deploy key for the sftp upload).

One-time bootstrap (already done): migrations 0001–0005 predate this workflow
and were hand-run in the SQL Editor, so the workflow was first run manually
(workflow_dispatch) with `repair_baseline: true`, which marks them as applied
in the history table without re-running them.

## Backups

The Supabase free tier has no built-in backups, so
[.github/workflows/backup.yml](../.github/workflows/backup.yml) dumps the live
database nightly (`supabase db dump`: roles, schema, and data) and commits the
result to the **private** [slackers-brew-backups](https://github.com/sven7777/slackers-brew-backups)
repo — commits only land on nights something changed, so its history is a
daily changelog of the DB, and restoring means checking out the last good
commit (restore procedure in that repo's README). Uses the same
`SUPABASE_ACCESS_TOKEN`/`SUPABASE_DB_PASSWORD` secrets plus
`BACKUP_DEPLOY_KEY` (write deploy key for the backups repo). Runs can also be
triggered manually from the Actions tab.

## Google sign-in (roadmap Step 7)

The login screen shows a **Continue with Google** button. It only works once the
Google provider is enabled in Supabase, backed by a Google Cloud OAuth client.
The invite-only allowlist still gates entry — signing in with Google does not
grant access unless the email is in `members`.

1. **Google Cloud Console** ([console.cloud.google.com](https://console.cloud.google.com)):
   - Create (or pick) a project → **APIs & Services → OAuth consent screen**:
     User type **External**, fill app name + support email, add yourself as a
     test user (or publish the app), save.
   - **APIs & Services → Credentials → Create Credentials → OAuth client ID**,
     type **Web application**.
   - **Authorized redirect URI:** the Supabase callback —
     `https://<project>.supabase.co/auth/v1/callback` (find the exact URL in
     Supabase → Auth → Providers → Google).
   - Copy the **Client ID** and **Client secret**.
2. **Supabase → Auth → Providers → Google:** toggle on, paste the Client ID and
   Client secret, save.
3. The app's existing Auth redirect URLs (Site URL + `http://localhost:5173`)
   already cover where users land after sign-in — no app change needed.

## Frontend config

The app reads these at build time (anon key is safe to ship — RLS protects the
data). Set them in a `.env` (gitignored) and in the DreamHost build:

```
VITE_SUPABASE_URL=https://<project>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon public key>
```

## Migration from localStorage

Export current data via the in-app backup (Settings tab → Export), then import
it into these tables. The per-row shape here maps from the backup's `malts`,
`hops`, `yeast`, `adj`, `recipes`, and `settings` keys.
