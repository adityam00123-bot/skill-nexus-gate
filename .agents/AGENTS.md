# Supabase Migration Rules
- When writing Supabase SQL migrations that create new tables, always include explicit GRANT statements for `service_role` (e.g. SELECT, INSERT, UPDATE) and `authenticated` (e.g. SELECT) as needed.
- Do not rely solely on RLS policies, as they do not grant underlying table permissions in Supabase. You must GRANT permissions manually in the same migration file.
