-- FoodMe database. Paste into Supabase > SQL Editor and run once.
-- Row Level Security means each signed-in person can only ever reach their own rows.

create table if not exists public.recipes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title       text not null check (char_length(title) between 1 and 200),
  servings    int  check (servings > 0),
  minutes     int  check (minutes >= 0),
  ingredients text[] not null default '{}',   -- one line per ingredient, as typed or imported
  steps       text not null default '',       -- one step per line
  source_url  text,
  image_url   text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.meal_plan (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day        date not null,
  slot       text not null check (slot in ('breakfast', 'lunch', 'dinner')),
  recipe_id  uuid not null references public.recipes (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.grocery_items (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 200),
  amount     text not null default '',
  checked    boolean not null default false,
  from_plan  boolean not null default false,  -- true = generated from meals, replaced on rebuild
  created_at timestamptz not null default now()
);

create index if not exists recipes_user_idx       on public.recipes (user_id);
create index if not exists meal_plan_user_day_idx on public.meal_plan (user_id, day);
create index if not exists meal_plan_recipe_idx   on public.meal_plan (recipe_id);
create index if not exists grocery_user_idx       on public.grocery_items (user_id);

alter table public.recipes       enable row level security;
alter table public.meal_plan     enable row level security;
alter table public.grocery_items enable row level security;

grant select, insert, update, delete on public.recipes, public.meal_plan, public.grocery_items to authenticated;

drop policy if exists "own recipes" on public.recipes;
create policy "own recipes" on public.recipes for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "own meals" on public.meal_plan;
create policy "own meals" on public.meal_plan for all to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.recipes r where r.id = recipe_id and r.user_id = (select auth.uid()))
  );

drop policy if exists "own groceries" on public.grocery_items;
create policy "own groceries" on public.grocery_items for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create or replace function public.touch_updated_at() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists recipes_touch on public.recipes;
create trigger recipes_touch before update on public.recipes
  for each row execute function public.touch_updated_at();

-- Profiles: the name shown around the app. Safe to re-run this whole file; it keeps existing data.
create table if not exists public.profiles (
  id           uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 50),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.profiles enable row level security;
grant select, insert, update on public.profiles to authenticated;

drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles for all to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- Lets a signed-in person delete their own account. Their rows go with it (on delete cascade).
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'not signed in';
  end if;
  delete from auth.users where id = me;
end $$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
