create or replace function public.send_message(
  target_contest_id uuid,
  target_recipient_id uuid,
  message_text text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  new_message_id uuid := extensions.gen_random_uuid();
begin
  if actor_id is null then
    raise exception 'Session requise.';
  end if;

  if length(trim(message_text)) = 0 then
    raise exception 'Le message ne peut pas être vide.';
  end if;

  if not exists (
    select 1
    from public.contest_members
    where contest_id = target_contest_id
      and user_id = actor_id
  ) then
    raise exception 'Vous ne faites pas partie de ce concours.';
  end if;

  if target_recipient_id is not null then
    if target_recipient_id = actor_id then
      raise exception 'Vous ne pouvez pas vous envoyer un message.';
    end if;
    if not exists (
      select 1
      from public.contest_members
      where contest_id = target_contest_id
        and user_id = target_recipient_id
    ) then
      raise exception 'Le destinataire ne fait pas partie de ce concours.';
    end if;
  end if;

  insert into public.messages (
    id, contest_id, sender_id, recipient_id, text
  )
  values (
    new_message_id,
    target_contest_id,
    actor_id,
    target_recipient_id,
    trim(message_text)
  );

  insert into public.message_reads (
    contest_id, message_id, user_id
  )
  values (
    target_contest_id, new_message_id, actor_id
  );

  insert into public.notifications (
    id, contest_id, user_id, type, title, text, message_id
  )
  select
    extensions.gen_random_uuid(),
    target_contest_id,
    membership.user_id,
    'message'::public.notification_type,
    case
      when target_recipient_id is null then 'Nouveau message dans le canal général'
      else 'Nouveau message privé'
    end,
    left(trim(message_text), 90),
    new_message_id
  from public.contest_members as membership
  where membership.contest_id = target_contest_id
    and membership.user_id <> actor_id
    and (
      target_recipient_id is null
      or membership.user_id = target_recipient_id
    );

  insert into public.audit_events (
    id, contest_id, actor_id, action, entity_type, entity_id, description
  )
  values (
    extensions.gen_random_uuid(),
    target_contest_id,
    actor_id,
    'message',
    'message',
    new_message_id,
    case
      when target_recipient_id is null then 'a écrit dans le canal général'
      else 'a envoyé un message privé'
    end
  );

  return new_message_id;
end;
$$;

revoke execute on function public.send_message(uuid, uuid, text) from public, anon;
grant execute on function public.send_message(uuid, uuid, text) to authenticated;
