-- Migration 0005: editable brew-sheet process values on recipes
-- Adds a JSONB `process` map holding the Brew Sheet's planned, editable fields
-- (strike temp, mash/sparge volumes, boil/vorlauf/runoff times, pH targets,
-- whirlpool/knockout temps). A single JSONB column keeps the field set fluid —
-- adding/removing a reading needs no further migration. Idempotent — safe to run
-- once on the live DB in the Supabase SQL editor.

alter table recipes
  add column if not exists process jsonb;
