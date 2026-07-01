delete from public.audit_events
where entity_type = 'message';

delete from public.messages;

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
      )
  );
$$;

drop policy if exists messages_select_authorized on public.messages;
create policy messages_select_participant
on public.messages for select
to authenticated
using (
  public.is_contest_member(contest_id)
  and (
    recipient_id is null
    or sender_id = (select auth.uid())
    or recipient_id = (select auth.uid())
  )
);

drop policy if exists messages_delete_sender_or_admin on public.messages;
create policy messages_delete_sender
on public.messages for delete
to authenticated
using (sender_id = (select auth.uid()));

drop policy if exists notifications_select_owner_or_admin on public.notifications;
create policy notifications_select_owner
on public.notifications for select
to authenticated
using (user_id = (select auth.uid()));
