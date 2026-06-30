create or replace function public.is_contest_member(target_contest_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.contest_members
    where contest_id = target_contest_id
      and user_id = (select auth.uid())
  );
$$;

create or replace function public.has_contest_role(target_contest_id uuid, allowed_roles public.user_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.contest_members
    where contest_id = target_contest_id
      and user_id = (select auth.uid())
      and role = any(allowed_roles)
  );
$$;

create or replace function public.manages_category(target_category_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.manager_categories
    where category_id = target_category_id
      and user_id = (select auth.uid())
  );
$$;

create or replace function public.is_task_assignee(target_task_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.task_assignees
    where task_id = target_task_id
      and user_id = (select auth.uid())
  );
$$;

create or replace function public.can_manage_task(target_task_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.tasks
    where id = target_task_id
      and (
        public.has_contest_role(contest_id, array['admin']::public.user_role[])
        or public.manages_category(category_id)
      )
  );
$$;

create or replace function public.can_read_message(target_message_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.messages
    where id = target_message_id
      and public.is_contest_member(contest_id)
      and (
        recipient_id is null
        or sender_id = (select auth.uid())
        or recipient_id = (select auth.uid())
        or public.has_contest_role(contest_id, array['admin']::public.user_role[])
      )
  );
$$;

create or replace function public.list_login_contests()
returns table (
  id uuid,
  name text,
  location text,
  start_date date,
  end_date date
)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.name, c.location, c.start_date, c.end_date
  from public.contests c
  order by c.start_date desc, c.name;
$$;

create or replace function public.list_login_profiles(target_contest_id uuid)
returns table (
  id uuid,
  display_name text,
  role public.user_role,
  initials text,
  color text
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.display_name, cm.role, p.initials, p.color
  from public.contest_members cm
  join public.profiles p on p.id = cm.user_id
  where cm.contest_id = target_contest_id
  order by p.display_name;
$$;

create or replace function public.bootstrap_workspace(
  new_user_id uuid,
  contest_name text,
  contest_location text,
  contest_start_date date,
  contest_end_date date,
  contest_description text,
  admin_name text,
  admin_contact text,
  admin_initials text,
  admin_color text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_contest_id uuid;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('attelage-pilot-bootstrap'));

  if exists (select 1 from public.contests) then
    raise exception 'Le projet a déjà été initialisé.';
  end if;

  if not exists (select 1 from auth.users where id = new_user_id) then
    raise exception 'Le compte Auth administrateur est introuvable.';
  end if;

  insert into public.contests (name, location, start_date, end_date, description)
  values (
    trim(contest_name),
    trim(contest_location),
    contest_start_date,
    contest_end_date,
    coalesce(contest_description, '')
  )
  returning id into new_contest_id;

  insert into public.profiles (id, display_name, contact, initials, color)
  values (
    new_user_id,
    trim(admin_name),
    coalesce(trim(admin_contact), ''),
    upper(trim(admin_initials)),
    coalesce(nullif(admin_color, ''), '#345f50')
  );

  insert into public.contest_members (contest_id, user_id, role)
  values (new_contest_id, new_user_id, 'admin');

  insert into public.categories (contest_id, name, color, icon)
  values
    (new_contest_id, 'Terrain & pistes', '#2f7459', '🌿'),
    (new_contest_id, 'Boxes & chevaux', '#a8663b', '🐴'),
    (new_contest_id, 'Bénévoles', '#d38a28', '🤝'),
    (new_contest_id, 'Sécurité', '#c64c4c', '🛡️'),
    (new_contest_id, 'Jury & officiels', '#7555a5', '⚖️'),
    (new_contest_id, 'Restauration', '#d6637d', '☕'),
    (new_contest_id, 'Communication', '#347ca5', '📣'),
    (new_contest_id, 'Matériel & logistique', '#5c6570', '🔧');

  return new_contest_id;
end;
$$;

create or replace function public.enforce_task_update_permissions()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('postgres', 'service_role', 'supabase_admin') then
    return new;
  end if;

  if public.has_contest_role(old.contest_id, array['admin']::public.user_role[]) then
    return new;
  end if;

  if public.manages_category(old.category_id) then
    if new.contest_id <> old.contest_id or new.category_id <> old.category_id
      or new.created_by is distinct from old.created_by
      or new.created_at is distinct from old.created_at then
      raise exception 'Un responsable ne peut pas déplacer une tâche vers un autre périmètre.';
    end if;
    return new;
  end if;

  if public.is_task_assignee(old.id) then
    if new.contest_id is distinct from old.contest_id
      or new.category_id is distinct from old.category_id
      or new.title is distinct from old.title
      or new.description is distinct from old.description
      or new.priority is distinct from old.priority
      or new.start_date is distinct from old.start_date
      or new.due_date is distinct from old.due_date
      or new.due_time is distinct from old.due_time
      or new.created_by is distinct from old.created_by
      or new.created_at is distinct from old.created_at then
      raise exception 'Un membre assigné peut uniquement modifier le statut.';
    end if;
    return new;
  end if;

  raise exception 'Modification de tâche non autorisée.';
end;
$$;

create trigger tasks_enforce_update_permissions
before update on public.tasks
for each row execute function public.enforce_task_update_permissions();

grant usage on schema public to anon, authenticated;

grant execute on function public.list_login_contests() to anon, authenticated;
grant execute on function public.list_login_profiles(uuid) to anon, authenticated;

grant execute on function public.is_contest_member(uuid) to authenticated;
grant execute on function public.has_contest_role(uuid, public.user_role[]) to authenticated;
grant execute on function public.manages_category(uuid) to authenticated;
grant execute on function public.is_task_assignee(uuid) to authenticated;
grant execute on function public.can_manage_task(uuid) to authenticated;
grant execute on function public.can_read_message(uuid) to authenticated;
revoke execute on function public.enforce_task_update_permissions() from public;

revoke execute on function public.bootstrap_workspace(
  uuid, text, text, date, date, text, text, text, text, text
) from public, anon, authenticated;
grant execute on function public.bootstrap_workspace(
  uuid, text, text, date, date, text, text, text, text, text
) to service_role;

grant select on public.contests, public.profiles, public.contest_members,
  public.categories, public.manager_categories, public.tasks,
  public.task_assignees, public.comments, public.messages,
  public.message_reads, public.notifications, public.audit_events
to authenticated;

grant update (display_name, contact, initials, color) on public.profiles to authenticated;
grant update (name, location, start_date, end_date, description) on public.contests to authenticated;
grant insert, update, delete on public.categories to authenticated;
grant insert, update, delete on public.manager_categories to authenticated;
grant insert, update, delete on public.tasks to authenticated;
grant insert, delete on public.task_assignees to authenticated;
grant insert, delete on public.comments to authenticated;
grant insert, delete on public.messages to authenticated;
grant insert on public.message_reads to authenticated;
grant update (read_at) on public.message_reads to authenticated;
grant update (read_at) on public.notifications to authenticated;
grant insert on public.audit_events to authenticated;

create policy contests_select_member
on public.contests for select
to authenticated
using (public.is_contest_member(id));

create policy contests_update_admin
on public.contests for update
to authenticated
using (public.has_contest_role(id, array['admin']::public.user_role[]))
with check (public.has_contest_role(id, array['admin']::public.user_role[]));

create policy profiles_select_shared_contest
on public.profiles for select
to authenticated
using (
  id = (select auth.uid())
  or exists (
    select 1
    from public.contest_members own_membership
    join public.contest_members target_membership
      on target_membership.contest_id = own_membership.contest_id
    where own_membership.user_id = (select auth.uid())
      and target_membership.user_id = profiles.id
  )
);

create policy profiles_update_self
on public.profiles for update
to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

create policy contest_members_select_member
on public.contest_members for select
to authenticated
using (public.is_contest_member(contest_id));

create policy categories_select_member
on public.categories for select
to authenticated
using (public.is_contest_member(contest_id));

create policy categories_insert_admin
on public.categories for insert
to authenticated
with check (public.has_contest_role(contest_id, array['admin']::public.user_role[]));

create policy categories_update_admin
on public.categories for update
to authenticated
using (public.has_contest_role(contest_id, array['admin']::public.user_role[]))
with check (public.has_contest_role(contest_id, array['admin']::public.user_role[]));

create policy categories_delete_admin
on public.categories for delete
to authenticated
using (public.has_contest_role(contest_id, array['admin']::public.user_role[]));

create policy manager_categories_select_member
on public.manager_categories for select
to authenticated
using (public.is_contest_member(contest_id));

create policy manager_categories_insert_admin
on public.manager_categories for insert
to authenticated
with check (public.has_contest_role(contest_id, array['admin']::public.user_role[]));

create policy manager_categories_update_admin
on public.manager_categories for update
to authenticated
using (public.has_contest_role(contest_id, array['admin']::public.user_role[]))
with check (public.has_contest_role(contest_id, array['admin']::public.user_role[]));

create policy manager_categories_delete_admin
on public.manager_categories for delete
to authenticated
using (public.has_contest_role(contest_id, array['admin']::public.user_role[]));

create policy tasks_select_member
on public.tasks for select
to authenticated
using (public.is_contest_member(contest_id));

create policy tasks_insert_admin
on public.tasks for insert
to authenticated
with check (
  public.has_contest_role(contest_id, array['admin']::public.user_role[])
  and created_by = (select auth.uid())
);

create policy tasks_update_authorized
on public.tasks for update
to authenticated
using (
  public.has_contest_role(contest_id, array['admin']::public.user_role[])
  or public.manages_category(category_id)
  or public.is_task_assignee(id)
)
with check (
  public.has_contest_role(contest_id, array['admin']::public.user_role[])
  or public.manages_category(category_id)
  or public.is_task_assignee(id)
);

create policy tasks_delete_admin
on public.tasks for delete
to authenticated
using (public.has_contest_role(contest_id, array['admin']::public.user_role[]));

create policy task_assignees_select_member
on public.task_assignees for select
to authenticated
using (public.is_contest_member(contest_id));

create policy task_assignees_insert_manager
on public.task_assignees for insert
to authenticated
with check (public.can_manage_task(task_id));

create policy task_assignees_delete_manager
on public.task_assignees for delete
to authenticated
using (public.can_manage_task(task_id));

create policy comments_select_member
on public.comments for select
to authenticated
using (public.is_contest_member(contest_id));

create policy comments_insert_member
on public.comments for insert
to authenticated
with check (
  public.is_contest_member(contest_id)
  and author_id = (select auth.uid())
);

create policy comments_delete_author_or_admin
on public.comments for delete
to authenticated
using (
  author_id = (select auth.uid())
  or public.has_contest_role(contest_id, array['admin']::public.user_role[])
);

create policy messages_select_authorized
on public.messages for select
to authenticated
using (
  public.is_contest_member(contest_id)
  and (
    recipient_id is null
    or sender_id = (select auth.uid())
    or recipient_id = (select auth.uid())
    or public.has_contest_role(contest_id, array['admin']::public.user_role[])
  )
);

create policy messages_insert_self
on public.messages for insert
to authenticated
with check (
  public.is_contest_member(contest_id)
  and sender_id = (select auth.uid())
);

create policy messages_delete_sender_or_admin
on public.messages for delete
to authenticated
using (
  sender_id = (select auth.uid())
  or public.has_contest_role(contest_id, array['admin']::public.user_role[])
);

create policy message_reads_select_authorized
on public.message_reads for select
to authenticated
using (public.can_read_message(message_id));

create policy message_reads_insert_self
on public.message_reads for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and public.can_read_message(message_id)
);

create policy message_reads_update_self
on public.message_reads for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy notifications_select_owner_or_admin
on public.notifications for select
to authenticated
using (
  user_id = (select auth.uid())
  or public.has_contest_role(contest_id, array['admin']::public.user_role[])
);

create policy notifications_update_owner
on public.notifications for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy audit_events_select_admin
on public.audit_events for select
to authenticated
using (public.has_contest_role(contest_id, array['admin']::public.user_role[]));

create policy audit_events_insert_self
on public.audit_events for insert
to authenticated
with check (
  actor_id = (select auth.uid())
  and public.is_contest_member(contest_id)
);

do $$
declare
  table_name text;
begin
  foreach table_name in array array['tasks', 'comments', 'messages', 'notifications']
  loop
    if not exists (
      select 1
      from pg_catalog.pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = table_name
    ) then
      execute format('alter publication supabase_realtime add table public.%I', table_name);
    end if;
  end loop;
end;
$$;
