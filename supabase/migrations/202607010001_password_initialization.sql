alter table public.profiles
add column if not exists password_initialized boolean not null default false;

update public.profiles as profile
set password_initialized = true
where exists (
  select 1
  from public.contest_members as membership
  where membership.user_id = profile.id
    and membership.role = 'admin'
);

drop function if exists public.list_login_profiles(uuid);

create function public.list_login_profiles(target_contest_id uuid)
returns table (
  id uuid,
  display_name text,
  role public.user_role,
  initials text,
  color text,
  password_initialized boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    profile.id,
    profile.display_name,
    membership.role,
    profile.initials,
    profile.color,
    profile.password_initialized
  from public.contest_members as membership
  join public.profiles as profile on profile.id = membership.user_id
  where membership.contest_id = target_contest_id
  order by profile.display_name;
$$;

grant execute on function public.list_login_profiles(uuid) to anon, authenticated;
