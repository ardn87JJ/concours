alter table public.contests
  add column color text not null default '#1f5746'
  check (color ~ '^#[0-9A-Fa-f]{6}$');

grant update (color) on public.contests to authenticated;
