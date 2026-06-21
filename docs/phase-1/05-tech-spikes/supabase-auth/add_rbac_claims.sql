-- Draft reference SQL for the Supabase custom access-token hook (ADR-019).
-- NOT applied by the migration runner: this file lives outside supabase/migrations/
-- on purpose so the drizzle-kit journal does not pick it up. The #79 cut-over
-- promotes this into a numbered migration and registers the hook in the Supabase
-- dashboard (Authentication > Hooks > Customize Access Token). See the spike
-- write-up for the production-wiring step.
--
-- Purpose: inject a LIGHTWEIGHT claim set (role codes, account status, dept ids)
-- into the JWT app_metadata so RLS becomes correct-but-bypassed-in-v1 defense in
-- depth (ADR-019 keeps the service-role connection; the authenticated-key + live
-- RLS path is deferred to v2). The full 38+-code permission catalogue is NOT put
-- in the token (ADR-019 rejects claims-only); the app resolves permissions per
-- request via loadSessionContext, which stays the source of truth.
--
-- Resolution mirrors src/lib/rbac/session-context.ts:
--   role_codes : user_role -> roles.code
--   status     : latest parent_verification_request.status (parents only)
--   dept_ids   : staff_profile.dept_id  UNION  department-scoped user_role.scope_id

create or replace function public.add_rbac_claims(event jsonb)
returns jsonb
language plpgsql
stable
as $$
declare
  v_user_id uuid := (event ->> 'user_id')::uuid;
  v_role_codes text[];
  v_dept_ids text[];
  v_status text;
  v_is_parent boolean;
  v_latest_status text;
  v_claims jsonb;
begin
  -- role codes: every role assigned to the user, by code
  select coalesce(array_agg(distinct r.code), '{}')
  into v_role_codes
  from public.user_role ur
  join public.roles r on r.id = ur.role_id
  where ur.user_id = v_user_id;

  -- dept ids: staff_profile.dept_id plus any department-scoped role assignment
  select coalesce(array_agg(distinct d), '{}')
  into v_dept_ids
  from (
    select sp.dept_id::text as d
    from public.staff_profile sp
    where sp.user_id = v_user_id
      and sp.dept_id is not null
    union
    select ur.scope_id::text as d
    from public.user_role ur
    where ur.user_id = v_user_id
      and ur.scope_type = 'department'
  ) depts;

  -- status: ACTIVE for everyone except parents, whose status follows the latest
  -- parent_verification_request (approved -> ACTIVE, rejected -> SUSPENDED,
  -- otherwise PENDING_VERIFICATION). Mirrors resolveStatus/loadParentStatus.
  v_is_parent := 'parent' = any(v_role_codes);

  if not v_is_parent then
    v_status := 'ACTIVE';
  else
    select pvr.status
    into v_latest_status
    from public.parent_verification_request pvr
    where pvr.user_id = v_user_id
    order by pvr.created_at desc
    limit 1;

    v_status := case
      when v_latest_status is null then 'ACTIVE'
      when v_latest_status = 'approved' then 'ACTIVE'
      when v_latest_status = 'rejected' then 'SUSPENDED'
      else 'PENDING_VERIFICATION'
    end;
  end if;

  v_claims := coalesce(event -> 'claims', '{}'::jsonb);

  v_claims := jsonb_set(
    v_claims,
    '{app_metadata}',
    coalesce(v_claims -> 'app_metadata', '{}'::jsonb)
      || jsonb_build_object(
        'role_codes', to_jsonb(v_role_codes),
        'status', to_jsonb(v_status),
        'dept_ids', to_jsonb(v_dept_ids)
      )
  );

  return jsonb_set(event, '{claims}', v_claims);
end;
$$;

-- The hook role must be able to run the function and read the RBAC tables.
grant execute on function public.add_rbac_claims(jsonb) to supabase_auth_admin;
grant usage on schema public to supabase_auth_admin;
grant select on
  public.user_role,
  public.roles,
  public.staff_profile,
  public.parent_verification_request
to supabase_auth_admin;
