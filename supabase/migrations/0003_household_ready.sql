-- Recurring bills, join codes, notification prefs. Household-scoped + RLS.

alter table public.households
  add column if not exists join_code text;

create unique index if not exists households_join_code_idx
  on public.households (join_code)
  where join_code is not null;

alter table public.household_members
  add column if not exists display_name text;

create table if not exists public.recurring_expenses (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null,
  amount numeric(12, 2) not null check (amount >= 0),
  category_id uuid references public.categories (id) on delete set null,
  payment_method_id uuid references public.payment_methods (id) on delete set null,
  cadence text not null default 'monthly' check (cadence in ('monthly')),
  day_of_month int not null check (day_of_month between 1 and 28),
  next_on date not null,
  notes text,
  last_created_on date,
  created_at timestamptz not null default now()
);

create index if not exists recurring_household_next_idx
  on public.recurring_expenses (household_id, next_on);

create table if not exists public.notification_prefs (
  user_id uuid primary key references auth.users (id) on delete cascade,
  household_id uuid references public.households (id) on delete cascade,
  recurring_reminders boolean not null default true,
  monthly_summary boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.recurring_expenses enable row level security;
alter table public.notification_prefs enable row level security;

drop policy if exists recurring_all on public.recurring_expenses;
create policy recurring_all on public.recurring_expenses
  for all to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

drop policy if exists notification_prefs_own on public.notification_prefs;
create policy notification_prefs_own on public.notification_prefs
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists household_members_insert on public.household_members;
create policy household_members_insert on public.household_members
  for insert to authenticated
  with check (user_id = auth.uid() or public.is_household_member(household_id));

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using (
    id = auth.uid()
    or exists (
      select 1
      from public.household_members mine
      join public.household_members theirs
        on mine.household_id = theirs.household_id
      where mine.user_id = auth.uid()
        and theirs.user_id = profiles.id
    )
  );

create or replace function public.ensure_join_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  hid uuid;
  code text;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;

  hid := public.ensure_household();

  select join_code into code from public.households where id = hid;
  if code is not null then
    return code;
  end if;

  code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
  update public.households set join_code = code where id = hid;
  return code;
end;
$$;

create or replace function public.join_household(code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  hid uuid;
  old_hid uuid;
  txs int;
  members int;
  label text;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;

  select id into hid
  from public.households
  where join_code = upper(trim(code));

  if hid is null then
    raise exception 'That household code was not found';
  end if;

  select full_name into label from public.profiles where id = auth.uid();

  insert into public.household_members (household_id, user_id, role, display_name)
  values (hid, auth.uid(), 'member', label)
  on conflict (household_id, user_id) do nothing;

  for old_hid in
    select household_id
    from public.household_members
    where user_id = auth.uid()
      and household_id <> hid
  loop
    select count(*) into txs from public.transactions where household_id = old_hid;
    select count(*) into members from public.household_members where household_id = old_hid;
    if txs = 0 and members <= 1 then
      delete from public.households where id = old_hid;
    end if;
  end loop;

  return hid;
end;
$$;

grant execute on function public.ensure_join_code() to authenticated;
grant execute on function public.join_household(text) to authenticated;
