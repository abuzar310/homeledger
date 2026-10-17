-- Production-readiness: active household, member insert, household budgets, receipt replace.

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
  order by created_at desc
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

-- Join and signup go through security-definer functions. Clients must not self-insert.
drop policy if exists household_members_insert on public.household_members;

create unique index if not exists budgets_household_month_uncategorized_idx
  on public.budgets (household_id, year_month)
  where category_id is null;

drop policy if exists receipts_storage_update on storage.objects;
create policy receipts_storage_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'receipts'
    and public.is_household_member((split_part(name, '/', 1))::uuid)
  )
  with check (
    bucket_id = 'receipts'
    and public.is_household_member((split_part(name, '/', 1))::uuid)
  );
