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
5. **Auth → Providers:** enable **Email (magic link)** to start. Add **Google**
   later (needs a Google Cloud OAuth client) once the rest is proven.

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
