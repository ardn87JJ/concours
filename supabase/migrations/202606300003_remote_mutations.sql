grant update on public.contest_members to authenticated;
grant insert on public.notifications to authenticated;

create policy contest_members_update_admin
on public.contest_members for update
to authenticated
using (public.has_contest_role(contest_id, array['admin']::public.user_role[]))
with check (public.has_contest_role(contest_id, array['admin']::public.user_role[]));

create policy profiles_update_admin_contest
on public.profiles for update
to authenticated
using (
  id = (select auth.uid())
  or exists (
    select 1
    from public.contest_members admin_membership
    join public.contest_members target_membership
      on target_membership.contest_id = admin_membership.contest_id
    where admin_membership.user_id = (select auth.uid())
      and admin_membership.role = 'admin'
      and target_membership.user_id = profiles.id
  )
)
with check (
  id = (select auth.uid())
  or exists (
    select 1
    from public.contest_members admin_membership
    join public.contest_members target_membership
      on target_membership.contest_id = admin_membership.contest_id
    where admin_membership.user_id = (select auth.uid())
      and admin_membership.role = 'admin'
      and target_membership.user_id = profiles.id
  )
);

create policy notifications_insert_member
on public.notifications for insert
to authenticated
with check (public.is_contest_member(contest_id));
