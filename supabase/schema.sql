-- Database for the Syssi Demnati museum.
-- Run once in Supabase: SQL Editor > New query > paste this file > Run.

-- Likes: one per work per browser, no account needed
create table if not exists public.likes (
  work text not null,
  device uuid not null,
  created_at timestamptz not null default now(),
  primary key (work, device)
);
alter table public.likes enable row level security;
-- No direct access: likes only go through the functions below.

create or replace function public.toggle_like(p_work text, p_device uuid)
returns table (liked boolean, count int)
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from likes l where l.work = p_work and l.device = p_device) then
    delete from likes l where l.work = p_work and l.device = p_device;
    liked := false;
  else
    insert into likes (work, device) values (p_work, p_device);
    liked := true;
  end if;
  select count(*)::int into count from likes l where l.work = p_work;
  return next;
end $$;

create or replace function public.like_counts()
returns table (work text, n int)
language sql security definer set search_path = public stable as $$
  select work, count(*)::int from likes group by work;
$$;

create or replace function public.my_likes(p_device uuid)
returns table (work text)
language sql security definer set search_path = public stable as $$
  select work from likes where device = p_device;
$$;

-- Reviews: visitors signed in with their email
create table if not exists public.reviews (
  id bigint generated always as identity primary key,
  work text not null,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  rating int not null check (rating between 1 and 5),
  body text not null check (char_length(body) between 1 and 600),
  created_at timestamptz not null default now()
);
create index if not exists reviews_work_idx on public.reviews (work, created_at desc);
alter table public.reviews enable row level security;

drop policy if exists "reviews are public" on public.reviews;
create policy "reviews are public" on public.reviews for select using (true);
drop policy if exists "signed-in visitors post their own reviews" on public.reviews;
create policy "signed-in visitors post their own reviews" on public.reviews
  for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "visitors delete their own reviews" on public.reviews;
create policy "visitors delete their own reviews" on public.reviews
  for delete to authenticated using (user_id = auth.uid());

-- Hide who wrote what: only these columns are readable
revoke select on public.reviews from anon, authenticated;
grant select (id, work, name, rating, body, created_at) on public.reviews to anon, authenticated;
grant insert (work, name, rating, body) on public.reviews to authenticated;

create or replace function public.review_stats()
returns table (work text, n int, avg numeric)
language sql security definer set search_path = public stable as $$
  select work, count(*)::int, round(avg(rating), 1) from reviews group by work;
$$;

-- Subscribers: who wants an email for new works and new exhibitions
create table if not exists public.subscribers (
  user_id uuid primary key default auth.uid() references auth.users on delete cascade,
  email text not null default (auth.jwt() ->> 'email'),
  works boolean not null default true,
  expos boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.subscribers enable row level security;

drop policy if exists "visitors manage their own subscription" on public.subscribers;
create policy "visitors manage their own subscription" on public.subscribers
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- The email always comes from the sign-in, never from the browser
revoke insert, update on public.subscribers from authenticated;
grant insert (works, expos) on public.subscribers to authenticated;
grant update (works, expos) on public.subscribers to authenticated;

grant execute on function public.toggle_like(text, uuid) to anon, authenticated;
grant execute on function public.like_counts() to anon, authenticated;
grant execute on function public.my_likes(uuid) to anon, authenticated;
grant execute on function public.review_stats() to anon, authenticated;
