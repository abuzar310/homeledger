-- HomeLedger V1 schema
-- Household-scoped expenses with room for family members later.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'My Home',
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.household_members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'owner' check (role in ('owner', 'member')),
  created_at timestamptz not null default now(),
  unique (household_id, user_id)
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references public.households (id) on delete cascade,
  name text not null,
  group_name text not null,
  color text not null default '#6B645C',
  sort_order int not null default 0,
  is_system boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.subcategories (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references public.households (id) on delete cascade,
  category_id uuid not null references public.categories (id) on delete cascade,
  name text not null,
  sort_order int not null default 0,
  is_system boolean not null default false
);

create table public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references public.households (id) on delete cascade,
  name text not null,
  sort_order int not null default 0,
  is_system boolean not null default false
);

create table public.merchants (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null,
  normalized_name text not null,
  default_category_id uuid references public.categories (id) on delete set null,
  default_subcategory_id uuid references public.subcategories (id) on delete set null,
  default_channel text,
  created_at timestamptz not null default now(),
  unique (household_id, normalized_name)
);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  member_id uuid references public.household_members (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null,
  name text not null,
  amount numeric(12, 2) not null check (amount >= 0),
  occurred_on date not null default (timezone('Asia/Kolkata', now()))::date,
  category_id uuid references public.categories (id) on delete set null,
  subcategory_id uuid references public.subcategories (id) on delete set null,
  merchant_id uuid references public.merchants (id) on delete set null,
  payment_method_id uuid references public.payment_methods (id) on delete set null,
  purchase_channel text check (
    purchase_channel in ('online', 'offline', 'food_delivery', 'restaurant', 'store', 'other')
  ),
  notes text,
  needs_review boolean not null default false,
  categorization_source text not null default 'none'
    check (categorization_source in ('none', 'rule', 'merchant', 'ai', 'user')),
  categorization_confidence numeric(4, 3),
  client_request_id uuid unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.transaction_items (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.transactions (id) on delete cascade,
  name text not null,
  amount numeric(12, 2) not null check (amount >= 0),
  category_id uuid references public.categories (id) on delete set null,
  subcategory_id uuid references public.subcategories (id) on delete set null,
  sort_order int not null default 0
);

create table public.receipts (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  transaction_id uuid references public.transactions (id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  created_at timestamptz not null default now()
);

create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  category_id uuid references public.categories (id) on delete cascade,
  year_month date not null,
  amount numeric(12, 2) not null check (amount >= 0),
  unique (household_id, category_id, year_month)
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

create index households_created_by_idx on public.households (created_by);
create index household_members_user_idx on public.household_members (user_id);
create index categories_household_idx on public.categories (household_id, sort_order);
create index subcategories_category_idx on public.subcategories (category_id, sort_order);
create index merchants_household_name_idx on public.merchants (household_id, normalized_name);
create index payment_methods_household_idx on public.payment_methods (household_id, sort_order);
create index transactions_household_date_idx on public.transactions (household_id, occurred_on desc, created_at desc);
create index transactions_household_category_idx on public.transactions (household_id, category_id);
create index transactions_household_merchant_idx on public.transactions (household_id, merchant_id);
create index transaction_items_tx_idx on public.transaction_items (transaction_id);
create index receipts_tx_idx on public.receipts (transaction_id);
create index budgets_household_month_idx on public.budgets (household_id, year_month);

-- ---------------------------------------------------------------------------
-- updated_at
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger transactions_set_updated_at
before update on public.transactions
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Membership helpers
-- ---------------------------------------------------------------------------

create or replace function public.is_household_member(hid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.household_members
    where household_id = hid
      and user_id = auth.uid()
  );
$$;

create or replace function public.current_member_id(hid uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id
  from public.household_members
  where household_id = hid
    and user_id = auth.uid()
  limit 1;
$$;

create or replace function public.ensure_household()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  hid uuid;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;

  select household_id
    into hid
  from public.household_members
  where user_id = auth.uid()
  order by created_at
  limit 1;

  if hid is not null then
    return hid;
  end if;

  insert into public.households (name, created_by)
  values ('My Home', auth.uid())
  returning id into hid;

  insert into public.household_members (household_id, user_id, role)
  values (hid, auth.uid(), 'owner');

  return hid;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  hid uuid;
begin
  insert into public.households (name, created_by)
  values ('My Home', new.id)
  returning id into hid;

  insert into public.household_members (household_id, user_id, role)
  values (hid, new.id, 'owner');

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

grant execute on function public.ensure_household() to authenticated;
grant execute on function public.is_household_member(uuid) to authenticated;
grant execute on function public.current_member_id(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.categories enable row level security;
alter table public.subcategories enable row level security;
alter table public.payment_methods enable row level security;
alter table public.merchants enable row level security;
alter table public.transactions enable row level security;
alter table public.transaction_items enable row level security;
alter table public.receipts enable row level security;
alter table public.budgets enable row level security;

create policy households_select on public.households
  for select to authenticated
  using (public.is_household_member(id));

create policy households_update on public.households
  for update to authenticated
  using (public.is_household_member(id))
  with check (public.is_household_member(id));

create policy household_members_select on public.household_members
  for select to authenticated
  using (user_id = auth.uid() or public.is_household_member(household_id));

create policy categories_select on public.categories
  for select to authenticated
  using (household_id is null or public.is_household_member(household_id));

create policy categories_insert on public.categories
  for insert to authenticated
  with check (household_id is not null and public.is_household_member(household_id) and is_system = false);

create policy categories_update on public.categories
  for update to authenticated
  using (household_id is not null and public.is_household_member(household_id) and is_system = false)
  with check (household_id is not null and public.is_household_member(household_id) and is_system = false);

create policy categories_delete on public.categories
  for delete to authenticated
  using (household_id is not null and public.is_household_member(household_id) and is_system = false);

create policy subcategories_select on public.subcategories
  for select to authenticated
  using (household_id is null or public.is_household_member(household_id));

create policy subcategories_insert on public.subcategories
  for insert to authenticated
  with check (household_id is not null and public.is_household_member(household_id) and is_system = false);

create policy subcategories_update on public.subcategories
  for update to authenticated
  using (household_id is not null and public.is_household_member(household_id) and is_system = false)
  with check (household_id is not null and public.is_household_member(household_id) and is_system = false);

create policy subcategories_delete on public.subcategories
  for delete to authenticated
  using (household_id is not null and public.is_household_member(household_id) and is_system = false);

create policy payment_methods_select on public.payment_methods
  for select to authenticated
  using (household_id is null or public.is_household_member(household_id));

create policy payment_methods_insert on public.payment_methods
  for insert to authenticated
  with check (household_id is not null and public.is_household_member(household_id) and is_system = false);

create policy payment_methods_update on public.payment_methods
  for update to authenticated
  using (household_id is not null and public.is_household_member(household_id) and is_system = false)
  with check (household_id is not null and public.is_household_member(household_id) and is_system = false);

create policy payment_methods_delete on public.payment_methods
  for delete to authenticated
  using (household_id is not null and public.is_household_member(household_id) and is_system = false);

create policy merchants_all on public.merchants
  for all to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

create policy transactions_all on public.transactions
  for all to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

create policy transaction_items_all on public.transaction_items
  for all to authenticated
  using (
    exists (
      select 1 from public.transactions t
      where t.id = transaction_id
        and public.is_household_member(t.household_id)
    )
  )
  with check (
    exists (
      select 1 from public.transactions t
      where t.id = transaction_id
        and public.is_household_member(t.household_id)
    )
  );

create policy receipts_all on public.receipts
  for all to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

create policy budgets_all on public.budgets
  for all to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

-- ---------------------------------------------------------------------------
-- Storage
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false)
on conflict (id) do nothing;

create policy receipts_storage_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'receipts'
    and public.is_household_member((split_part(name, '/', 1))::uuid)
  );

create policy receipts_storage_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'receipts'
    and public.is_household_member((split_part(name, '/', 1))::uuid)
  );

create policy receipts_storage_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'receipts'
    and public.is_household_member((split_part(name, '/', 1))::uuid)
  );

-- ---------------------------------------------------------------------------
-- System catalogs
-- ---------------------------------------------------------------------------

insert into public.categories (id, household_id, name, group_name, color, sort_order, is_system) values
  ('11111111-1111-1111-1111-111111111001', null, 'Groceries', 'Food & Groceries', '#3F7D5A', 10, true),
  ('11111111-1111-1111-1111-111111111002', null, 'Dining & Food', 'Food & Groceries', '#C46A3A', 20, true),
  ('11111111-1111-1111-1111-111111111003', null, 'Kitchen', 'Home', '#6A7F4E', 30, true),
  ('11111111-1111-1111-1111-111111111004', null, 'Household', 'Home', '#7A6A4E', 40, true),
  ('11111111-1111-1111-1111-111111111005', null, 'Shopping', 'Shopping', '#3F6B8A', 50, true),
  ('11111111-1111-1111-1111-111111111006', null, 'Utilities', 'Bills & Utilities', '#4A6B8C', 60, true),
  ('11111111-1111-1111-1111-111111111007', null, 'Transport', 'Transport', '#4E6E82', 70, true),
  ('11111111-1111-1111-1111-111111111008', null, 'Health', 'Health', '#8A4E5C', 80, true),
  ('11111111-1111-1111-1111-111111111009', null, 'Education', 'Education', '#5A5E8A', 90, true),
  ('11111111-1111-1111-1111-111111111010', null, 'Entertainment', 'Entertainment', '#6B5A8A', 100, true),
  ('11111111-1111-1111-1111-111111111011', null, 'Financial', 'Financial', '#5C6B5A', 110, true),
  ('11111111-1111-1111-1111-111111111012', null, 'Other', 'Other', '#6B645C', 120, true);

insert into public.subcategories (id, household_id, category_id, name, sort_order, is_system) values
  ('22222222-2222-2222-2222-222222222001', null, '11111111-1111-1111-1111-111111111001', 'Groceries', 1, true),
  ('22222222-2222-2222-2222-222222222002', null, '11111111-1111-1111-1111-111111111001', 'Vegetables', 2, true),
  ('22222222-2222-2222-2222-222222222003', null, '11111111-1111-1111-1111-111111111001', 'Fruits', 3, true),
  ('22222222-2222-2222-2222-222222222004', null, '11111111-1111-1111-1111-111111111001', 'Dairy', 4, true),
  ('22222222-2222-2222-2222-222222222005', null, '11111111-1111-1111-1111-111111111001', 'Meat', 5, true),
  ('22222222-2222-2222-2222-222222222006', null, '11111111-1111-1111-1111-111111111001', 'Snacks', 6, true),
  ('22222222-2222-2222-2222-222222222007', null, '11111111-1111-1111-1111-111111111001', 'Staples', 7, true),
  ('22222222-2222-2222-2222-222222222008', null, '11111111-1111-1111-1111-111111111002', 'Dining Out', 1, true),
  ('22222222-2222-2222-2222-222222222009', null, '11111111-1111-1111-1111-111111111002', 'Food Delivery', 2, true),
  ('22222222-2222-2222-2222-222222222010', null, '11111111-1111-1111-1111-111111111003', 'Kitchen', 1, true),
  ('22222222-2222-2222-2222-222222222011', null, '11111111-1111-1111-1111-111111111004', 'Cleaning', 1, true),
  ('22222222-2222-2222-2222-222222222012', null, '11111111-1111-1111-1111-111111111004', 'Household Supplies', 2, true),
  ('22222222-2222-2222-2222-222222222013', null, '11111111-1111-1111-1111-111111111004', 'Furniture', 3, true),
  ('22222222-2222-2222-2222-222222222014', null, '11111111-1111-1111-1111-111111111004', 'Appliances', 4, true),
  ('22222222-2222-2222-2222-222222222015', null, '11111111-1111-1111-1111-111111111004', 'Repairs & Maintenance', 5, true),
  ('22222222-2222-2222-2222-222222222016', null, '11111111-1111-1111-1111-111111111005', 'Online Shopping', 1, true),
  ('22222222-2222-2222-2222-222222222017', null, '11111111-1111-1111-1111-111111111005', 'Clothing', 2, true),
  ('22222222-2222-2222-2222-222222222018', null, '11111111-1111-1111-1111-111111111005', 'Electronics', 3, true),
  ('22222222-2222-2222-2222-222222222019', null, '11111111-1111-1111-1111-111111111005', 'Personal Care', 4, true),
  ('22222222-2222-2222-2222-222222222020', null, '11111111-1111-1111-1111-111111111005', 'Other Shopping', 5, true),
  ('22222222-2222-2222-2222-222222222021', null, '11111111-1111-1111-1111-111111111006', 'Electricity', 1, true),
  ('22222222-2222-2222-2222-222222222022', null, '11111111-1111-1111-1111-111111111006', 'Water', 2, true),
  ('22222222-2222-2222-2222-222222222023', null, '11111111-1111-1111-1111-111111111006', 'Gas', 3, true),
  ('22222222-2222-2222-2222-222222222024', null, '11111111-1111-1111-1111-111111111006', 'Internet', 4, true),
  ('22222222-2222-2222-2222-222222222025', null, '11111111-1111-1111-1111-111111111006', 'Mobile', 5, true),
  ('22222222-2222-2222-2222-222222222026', null, '11111111-1111-1111-1111-111111111006', 'DTH / TV', 6, true),
  ('22222222-2222-2222-2222-222222222027', null, '11111111-1111-1111-1111-111111111007', 'Fuel', 1, true),
  ('22222222-2222-2222-2222-222222222028', null, '11111111-1111-1111-1111-111111111007', 'Taxi / Cab', 2, true),
  ('22222222-2222-2222-2222-222222222029', null, '11111111-1111-1111-1111-111111111007', 'Public Transport', 3, true),
  ('22222222-2222-2222-2222-222222222030', null, '11111111-1111-1111-1111-111111111007', 'Parking / Toll', 4, true),
  ('22222222-2222-2222-2222-222222222031', null, '11111111-1111-1111-1111-111111111007', 'Vehicle Maintenance', 5, true),
  ('22222222-2222-2222-2222-222222222032', null, '11111111-1111-1111-1111-111111111008', 'Medicine', 1, true),
  ('22222222-2222-2222-2222-222222222033', null, '11111111-1111-1111-1111-111111111008', 'Doctor', 2, true),
  ('22222222-2222-2222-2222-222222222034', null, '11111111-1111-1111-1111-111111111008', 'Hospital', 3, true),
  ('22222222-2222-2222-2222-222222222035', null, '11111111-1111-1111-1111-111111111008', 'Other Health', 4, true),
  ('22222222-2222-2222-2222-222222222036', null, '11111111-1111-1111-1111-111111111009', 'Education', 1, true),
  ('22222222-2222-2222-2222-222222222037', null, '11111111-1111-1111-1111-111111111009', 'Books', 2, true),
  ('22222222-2222-2222-2222-222222222038', null, '11111111-1111-1111-1111-111111111009', 'Courses', 3, true),
  ('22222222-2222-2222-2222-222222222039', null, '11111111-1111-1111-1111-111111111009', 'Other', 4, true),
  ('22222222-2222-2222-2222-222222222040', null, '11111111-1111-1111-1111-111111111010', 'Subscriptions', 1, true),
  ('22222222-2222-2222-2222-222222222041', null, '11111111-1111-1111-1111-111111111010', 'Movies', 2, true),
  ('22222222-2222-2222-2222-222222222042', null, '11111111-1111-1111-1111-111111111010', 'Games', 3, true),
  ('22222222-2222-2222-2222-222222222043', null, '11111111-1111-1111-1111-111111111010', 'Other', 4, true),
  ('22222222-2222-2222-2222-222222222044', null, '11111111-1111-1111-1111-111111111011', 'EMI', 1, true),
  ('22222222-2222-2222-2222-222222222045', null, '11111111-1111-1111-1111-111111111011', 'Insurance', 2, true),
  ('22222222-2222-2222-2222-222222222046', null, '11111111-1111-1111-1111-111111111011', 'Bank Charges', 3, true),
  ('22222222-2222-2222-2222-222222222047', null, '11111111-1111-1111-1111-111111111011', 'Other', 4, true),
  ('22222222-2222-2222-2222-222222222048', null, '11111111-1111-1111-1111-111111111012', 'Other', 1, true);

insert into public.payment_methods (id, household_id, name, sort_order, is_system) values
  ('33333333-3333-3333-3333-333333333001', null, 'UPI', 1, true),
  ('33333333-3333-3333-3333-333333333002', null, 'Cash', 2, true),
  ('33333333-3333-3333-3333-333333333003', null, 'Credit Card', 3, true),
  ('33333333-3333-3333-3333-333333333004', null, 'Debit Card', 4, true),
  ('33333333-3333-3333-3333-333333333005', null, 'Bank Transfer', 5, true),
  ('33333333-3333-3333-3333-333333333006', null, 'Other', 6, true);
