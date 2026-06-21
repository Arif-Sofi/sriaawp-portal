-- Draft reference SQL for the auth.users -> app-profile provisioning trigger
-- (ADR-018). NOT applied by the migration runner: this file lives outside
-- supabase/migrations/ so the drizzle-kit journal does not pick it up. The #79
-- cut-over promotes it into a numbered migration.
--
-- NAMING RECONCILIATION (#79 must resolve this):
--   ADR-018 names "public.profiles" as the 1:1 anchor to auth.users.id. The
--   CURRENT app schema (src/db/schema/auth.ts) does NOT have a table named
--   "profiles": the anchor is the "users" table (uuid PK), with per-role detail
--   in parent_profile / staff_profile / student_profile (each FK'd to users.id).
--   This trigger is written against the REAL table name (public.users) and
--   reuses NEW.id as the PK so every downstream FK (user_role.user_id,
--   *_profile.user_id, family_link, parent_verification_request.user_id)
--   survives without a data migration, exactly as ADR-018 requires. #79 decides
--   whether to rename public.users -> public.profiles or to keep "users" and
--   treat the ADR-018 "profiles" name as the logical/ERD label.
--
-- The Auth.js adapter columns (name, email, emailVerified, image) already exist
-- on public.users; we map auth.users.email -> users.email and the OAuth display
-- name (raw_user_meta_data->>'name') -> users.name. The insert is idempotent via
-- ON CONFLICT so a re-fired trigger or a backfill cannot duplicate a row.

create or replace function public.provision_app_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, name, email_verified, created_at, updated_at)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'name', new.raw_user_meta_data ->> 'full_name'),
    new.email_confirmed_at,
    now(),
    now()
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.provision_app_user();

-- NOTE: public.users.email_verified is column "emailVerified" in the Drizzle
-- schema (camelCase, quoted in DDL). Adjust the identifier to match the actual
-- migration 0000 DDL when promoting this file; the Drizzle definition declares
-- timestamp("emailVerified", ...). The reconciliation in #79 should normalise
-- this casing alongside the users-vs-profiles naming decision.
