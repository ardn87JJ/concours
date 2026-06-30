create extension if not exists pgcrypto with schema extensions;

create type public.user_role as enum ('admin', 'manager', 'volunteer');
create type public.task_status as enum ('todo', 'in_progress', 'done', 'blocked');
create type public.task_priority as enum ('low', 'normal', 'high', 'urgent');
create type public.notification_type as enum ('assignment', 'comment', 'message', 'status', 'deadline');
create type public.audit_action as enum ('create', 'update', 'delete', 'comment', 'assign', 'status', 'message', 'import');
create type public.audit_entity_type as enum ('task', 'user', 'message', 'category', 'contest');

create table public.contests (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  location text not null default '',
  start_date date not null,
  end_date date not null,
  description text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date)
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (length(trim(display_name)) > 0),
  contact text not null default '',
  initials text not null check (length(initials) between 1 and 3),
  color text not null default '#476a9d',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.contest_members (
  contest_id uuid not null references public.contests(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.user_role not null default 'volunteer',
  created_at timestamptz not null default now(),
  primary key (contest_id, user_id)
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  contest_id uuid not null references public.contests(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  color text not null default '#347ca5',
  icon text not null default '📌',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, contest_id),
  unique (contest_id, name)
);

create table public.manager_categories (
  contest_id uuid not null,
  category_id uuid not null,
  user_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (category_id, user_id),
  foreign key (category_id, contest_id)
    references public.categories(id, contest_id) on delete cascade,
  foreign key (contest_id, user_id)
    references public.contest_members(contest_id, user_id) on delete cascade
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  contest_id uuid not null references public.contests(id) on delete cascade,
  category_id uuid not null,
  title text not null check (length(trim(title)) > 0),
  description text not null default '',
  status public.task_status not null default 'todo',
  priority public.task_priority not null default 'normal',
  start_date date,
  due_date date not null,
  due_time time,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, contest_id),
  foreign key (category_id, contest_id)
    references public.categories(id, contest_id) on delete restrict,
  check (start_date is null or due_date >= start_date)
);

create table public.task_assignees (
  contest_id uuid not null,
  task_id uuid not null,
  user_id uuid not null,
  assigned_at timestamptz not null default now(),
  primary key (task_id, user_id),
  foreign key (task_id, contest_id)
    references public.tasks(id, contest_id) on delete cascade,
  foreign key (contest_id, user_id)
    references public.contest_members(contest_id, user_id) on delete cascade
);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  contest_id uuid not null,
  task_id uuid not null,
  author_id uuid,
  text text not null check (length(trim(text)) > 0),
  created_at timestamptz not null default now(),
  foreign key (task_id, contest_id)
    references public.tasks(id, contest_id) on delete cascade,
  foreign key (contest_id, author_id)
    references public.contest_members(contest_id, user_id) on delete set null (author_id)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  contest_id uuid not null references public.contests(id) on delete cascade,
  sender_id uuid not null,
  recipient_id uuid,
  text text not null check (length(trim(text)) > 0),
  created_at timestamptz not null default now(),
  unique (id, contest_id),
  foreign key (contest_id, sender_id)
    references public.contest_members(contest_id, user_id) on delete cascade,
  foreign key (contest_id, recipient_id)
    references public.contest_members(contest_id, user_id) on delete cascade,
  check (recipient_id is null or recipient_id <> sender_id)
);

create table public.message_reads (
  contest_id uuid not null,
  message_id uuid not null,
  user_id uuid not null,
  read_at timestamptz not null default now(),
  primary key (message_id, user_id),
  foreign key (message_id, contest_id)
    references public.messages(id, contest_id) on delete cascade,
  foreign key (contest_id, user_id)
    references public.contest_members(contest_id, user_id) on delete cascade
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  contest_id uuid not null references public.contests(id) on delete cascade,
  user_id uuid not null,
  type public.notification_type not null,
  title text not null,
  text text not null,
  task_id uuid references public.tasks(id) on delete cascade,
  message_id uuid references public.messages(id) on delete cascade,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  foreign key (contest_id, user_id)
    references public.contest_members(contest_id, user_id) on delete cascade
);

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  contest_id uuid not null references public.contests(id) on delete cascade,
  actor_id uuid,
  action public.audit_action not null,
  entity_type public.audit_entity_type not null,
  entity_id uuid,
  description text not null,
  created_at timestamptz not null default now(),
  foreign key (contest_id, actor_id)
    references public.contest_members(contest_id, user_id) on delete set null (actor_id)
);

create index contest_members_user_id_idx on public.contest_members(user_id);
create index categories_contest_id_idx on public.categories(contest_id);
create index manager_categories_user_id_idx on public.manager_categories(user_id);
create index tasks_contest_due_idx on public.tasks(contest_id, due_date, due_time);
create index tasks_category_id_idx on public.tasks(category_id);
create index task_assignees_user_id_idx on public.task_assignees(user_id);
create index comments_task_created_idx on public.comments(task_id, created_at);
create index messages_contest_created_idx on public.messages(contest_id, created_at);
create index messages_recipient_idx on public.messages(recipient_id, created_at);
create index notifications_user_created_idx on public.notifications(user_id, created_at desc);
create index audit_events_contest_created_idx on public.audit_events(contest_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger contests_set_updated_at
before update on public.contests
for each row execute function public.set_updated_at();

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger categories_set_updated_at
before update on public.categories
for each row execute function public.set_updated_at();

create trigger tasks_set_updated_at
before update on public.tasks
for each row execute function public.set_updated_at();

alter table public.contests enable row level security;
alter table public.profiles enable row level security;
alter table public.contest_members enable row level security;
alter table public.categories enable row level security;
alter table public.manager_categories enable row level security;
alter table public.tasks enable row level security;
alter table public.task_assignees enable row level security;
alter table public.comments enable row level security;
alter table public.messages enable row level security;
alter table public.message_reads enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_events enable row level security;

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
grant usage on schema public to service_role;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on function public.set_updated_at() to service_role;
