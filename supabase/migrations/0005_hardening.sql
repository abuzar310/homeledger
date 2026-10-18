-- 0005 hardening: join codes that expire and can't be guessed, joining that never deletes a home
-- that was set up, owner tools for members, a daily AI quota, honest expense authorship, and no
-- anonymous EXECUTE on HomeLedger's definer functions.
--
-- Re-runnable, one transaction. Touches only HomeLedger objects in public: the honeybite schema,
-- the public.hb_* shop functions and the rls_auto_enable event trigger are left alone.

begin;

-- 1. Join codes ---------------------------------------------------------------------------------

alter table public.households add column if not exists join_code_expires_at timestamptz;

-- Codes shared before this keep working for a week; after that the owner gets a new long one.
update public.households
   set join_code_expires_at = now() + interval '7 days'
 where join_code is not null
   and join_code_expires_at is null;

-- 10 symbols from a 32-letter alphabet without 0/O/1/I: about 10^15 codes.
create or replace function public.new_join_code()
returns text
language plpgsql
volatile
set search_path = public, extensions
as $$
declare
  alphabet constant text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  bytes bytea := extensions.gen_random_bytes(10);
  code text := '';
begin
  for i in 0..9 loop
    code := code || substr(alphabet, (get_byte(bytes, i) % 32) + 1, 1);
  end loop;
  return code;
end;
$$;

create or replace function public.ensure_join_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  hid uuid;
  code text;
  expires timestamptz;
  member_role text;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;

  hid := public.ensure_household();

  select role into member_role
  from public.household_members
  where household_id = hid
    and user_id = auth.uid();

  if member_role is distinct from 'owner' then
    raise exception 'Only the owner can share the household code';
  end if;

  select join_code, join_code_expires_at into code, expires from public.households where id = hid;
  if code is not null and expires > now() then
    return code;
  end if;

  loop
    code := public.new_join_code();
    exit when not exists (select 1 from public.households where join_code = code);
  end loop;

  update public.households
     set join_code = code,
         join_code_expires_at = now() + interval '7 days'
   where id = hid;
  return code;
end;
$$;

-- Failed join tries, so guessing codes is slow. Only the definer functions read or write it.
create table if not exists public.join_attempts (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  at timestamptz not null default now()
);
create index if not exists join_attempts_user_at_idx on public.join_attempts (user_id, at);
alter table public.join_attempts enable row level security;
revoke all on public.join_attempts from anon, authenticated;

-- Returns the joined household, or null when the code is wrong or expired (that try is counted).
create or replace function public.join_household(code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  hid uuid;
  old_hid uuid;
  label text;
  misses int;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;

  delete from public.join_attempts where user_id = auth.uid() and at < now() - interval '1 day';
  select count(*) into misses
  from public.join_attempts
  where user_id = auth.uid()
    and at > now() - interval '1 hour';
  if misses >= 10 then
    raise exception 'Too many tries. Wait an hour and try again.';
  end if;

  select id into hid
  from public.households
  where join_code = upper(trim(code))
    and join_code_expires_at > now();

  if hid is null then
    insert into public.join_attempts (user_id) values (auth.uid());
    return null;
  end if;

  select full_name into label from public.profiles where id = auth.uid();

  insert into public.household_members (household_id, user_id, role, display_name)
  values (hid, auth.uid(), 'member', label)
  on conflict (household_id, user_id) do nothing;

  -- Tidy away the joiner's old home only if it was never used: no expenses, bills, budgets,
  -- stores, own categories or payment methods, and nobody else in it.
  for old_hid in
    select household_id
    from public.household_members
    where user_id = auth.uid()
      and household_id <> hid
  loop
    if not exists (select 1 from public.transactions where household_id = old_hid)
       and not exists (select 1 from public.recurring_expenses where household_id = old_hid)
       and not exists (select 1 from public.budgets where household_id = old_hid)
       and not exists (select 1 from public.merchants where household_id = old_hid)
       and not exists (select 1 from public.categories where household_id = old_hid)
       and not exists (select 1 from public.subcategories where household_id = old_hid)
       and not exists (select 1 from public.payment_methods where household_id = old_hid)
       and (select count(*) from public.household_members where household_id = old_hid) <= 1 then
      delete from public.households where id = old_hid;
    end if;
  end loop;

  return hid;
end;
$$;

-- Clients may rename a home; its code, expiry and creator change only through the functions above.
create or replace function public.households_guard()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user in ('authenticated', 'anon') then
    new.join_code := old.join_code;
    new.join_code_expires_at := old.join_code_expires_at;
    new.created_by := old.created_by;
  end if;
  return new;
end;
$$;

drop trigger if exists households_guard on public.households;
create trigger households_guard
before update on public.households
for each row execute function public.households_guard();

-- 2. Members ------------------------------------------------------------------------------------

create or replace function public.remove_member(p_member uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target public.household_members;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;

  select * into target from public.household_members where id = p_member;
  if target.id is null then
    raise exception 'That member was not found';
  end if;
  if not exists (
    select 1 from public.household_members
    where household_id = target.household_id and user_id = auth.uid() and role = 'owner'
  ) then
    raise exception 'Only the owner can remove members';
  end if;
  if target.user_id = auth.uid() then
    raise exception 'Use Leave household to leave';
  end if;

  -- Their expenses stay; their member link on them becomes empty (foreign key set null).
  delete from public.household_members where id = target.id;
end;
$$;

create or replace function public.leave_household(p_household uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  mine public.household_members;
  others int;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;

  select * into mine from public.household_members where household_id = p_household and user_id = auth.uid();
  if mine.id is null then
    raise exception 'You are not in that home';
  end if;

  select count(*) into others from public.household_members where household_id = p_household and user_id <> auth.uid();
  if others = 0 then
    raise exception 'You are the only member of this home';
  end if;

  -- A home always keeps an owner: hand it to the longest-standing other member.
  if mine.role = 'owner' and not exists (
    select 1 from public.household_members
    where household_id = p_household and role = 'owner' and user_id <> auth.uid()
  ) then
    update public.household_members
       set role = 'owner'
     where id = (
       select id from public.household_members
       where household_id = p_household and user_id <> auth.uid()
       order by created_at
       limit 1
     );
  end if;

  delete from public.household_members where id = mine.id;
end;
$$;

-- 3. AI quota -----------------------------------------------------------------------------------

create table if not exists public.ai_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  route text not null,
  count int not null default 0,
  primary key (user_id, day, route)
);
alter table public.ai_usage enable row level security;
revoke all on public.ai_usage from anon, authenticated;

-- Counts one AI call for the signed-in user; false once today's limit (India time) is used up.
create or replace function public.bump_ai_usage(p_route text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  cap int := case p_route when 'categorize' then 200 when 'receipt' then 30 when 'insight' then 50 else 0 end;
  today date := (now() at time zone 'Asia/Kolkata')::date;
  used int;
begin
  if auth.uid() is null or cap = 0 then
    return false;
  end if;

  insert into public.ai_usage as u (user_id, day, route, count)
  values (auth.uid(), today, p_route, 1)
  on conflict (user_id, day, route) do update set count = u.count + 1
  returning u.count into used;

  return used <= cap;
end;
$$;

-- 4. Expenses: who added them, and only this home's categories and stores -----------------------

create or replace function public.transactions_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if auth.uid() is not null then
      new.created_by := auth.uid();
      new.member_id := (
        select id from public.household_members
        where household_id = new.household_id and user_id = auth.uid()
        limit 1
      );
    end if;
  else
    new.household_id := old.household_id;
    new.created_by := old.created_by;
    -- Removing a member clears the link (set null); it never moves to someone else.
    if new.member_id is not null then
      new.member_id := old.member_id;
    end if;
  end if;

  if new.category_id is not null and exists (
    select 1 from public.categories
    where id = new.category_id and household_id is not null and household_id <> new.household_id
  ) then
    raise exception 'That category belongs to another home';
  end if;
  if new.subcategory_id is not null and exists (
    select 1 from public.subcategories
    where id = new.subcategory_id and household_id is not null and household_id <> new.household_id
  ) then
    raise exception 'That subcategory belongs to another home';
  end if;
  if new.payment_method_id is not null and exists (
    select 1 from public.payment_methods
    where id = new.payment_method_id and household_id is not null and household_id <> new.household_id
  ) then
    raise exception 'That payment method belongs to another home';
  end if;
  if new.merchant_id is not null and exists (
    select 1 from public.merchants
    where id = new.merchant_id and household_id <> new.household_id
  ) then
    raise exception 'That store belongs to another home';
  end if;

  return new;
end;
$$;

drop trigger if exists transactions_guard on public.transactions;
create trigger transactions_guard
before insert or update on public.transactions
for each row execute function public.transactions_guard();

-- 5. Who may call what --------------------------------------------------------------------------
-- Signed-in users only. (Trigger functions can't be called directly, so they are left as they are.)

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.ensure_household()',
    'public.ensure_join_code()',
    'public.join_household(text)',
    'public.is_household_member(uuid)',
    'public.current_member_id(uuid)',
    'public.remove_member(uuid)',
    'public.leave_household(uuid)',
    'public.bump_ai_usage(text)'
  ] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end;
$$;

revoke execute on function public.new_join_code() from public, anon, authenticated;

commit;
