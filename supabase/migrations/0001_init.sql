-- ListenLore initial schema
-- Milestones (curated anchors) + moments (employee submissions) + shared people,
-- graph-shaped so the timeline and the node view render the same data.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Admins: emails allowed to manage milestones and moderate anything.
-- ---------------------------------------------------------------------------
create table public.admins (
  email text primary key
);

insert into public.admins (email) values ('brannon@listenlabs.ai');

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.admins
    where email = (auth.jwt() ->> 'email')
  );
$$;

-- ---------------------------------------------------------------------------
-- Categories: stored as data so they can be renamed/extended without code.
-- ---------------------------------------------------------------------------
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  label text not null,
  sort integer not null default 0
);

insert into public.categories (slug, label, sort) values
  ('company',     'Company',     0),
  ('fundraising', 'Fundraising', 1),
  ('product',     'Product',     2),
  ('brand',       'Brand',       3),
  ('events',      'Events',      4),
  ('team',        'Team',        5),
  ('customers',   'Customers',   6);

-- ---------------------------------------------------------------------------
-- People: authors and taggees. Linked to an auth user once that person signs
-- in; rows can exist before sign-in (seeded from the source spreadsheet).
-- ---------------------------------------------------------------------------
create table public.people (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text unique,
  auth_user_id uuid unique references auth.users (id) on delete set null,
  avatar_url text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Milestones: admin-curated anchors on the timeline.
-- date_precision records how exact date_start is, so the UI can render
-- approximate dates honestly instead of pinning them to a fake day.
-- ---------------------------------------------------------------------------
create table public.milestones (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  blurb text,
  story text,
  category_id uuid references public.categories (id),
  date_start date,
  date_end date,
  date_precision text not null default 'day'
    check (date_precision in ('day', 'month', 'year', 'approx')),
  location text,
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Moments: employee submissions, optionally attached to a milestone.
-- created_by is the auth user who owns edit/delete rights.
-- ---------------------------------------------------------------------------
create table public.moments (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text,
  category_id uuid references public.categories (id),
  milestone_id uuid references public.milestones (id) on delete set null,
  author_person_id uuid references public.people (id),
  created_by uuid references auth.users (id) on delete set null,
  event_date date,
  date_precision text not null default 'approx'
    check (date_precision in ('day', 'month', 'year', 'approx')),
  location text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index moments_milestone_idx on public.moments (milestone_id);
create index moments_event_date_idx on public.moments (event_date);

-- People tagged in a moment (many-to-many).
create table public.moment_people (
  moment_id uuid not null references public.moments (id) on delete cascade,
  person_id uuid not null references public.people (id) on delete cascade,
  primary key (moment_id, person_id)
);

-- ---------------------------------------------------------------------------
-- Media: files in the private storage bucket, attached to a milestone or a
-- moment. The app serves them via signed URLs after sign-in.
-- ---------------------------------------------------------------------------
create table public.media (
  id uuid primary key default gen_random_uuid(),
  owner_type text not null check (owner_type in ('milestone', 'moment')),
  milestone_id uuid references public.milestones (id) on delete cascade,
  moment_id uuid references public.moments (id) on delete cascade,
  storage_path text not null,
  caption text,
  width integer,
  height integer,
  sort integer not null default 0,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  check (
    (owner_type = 'milestone' and milestone_id is not null and moment_id is null) or
    (owner_type = 'moment' and moment_id is not null and milestone_id is null)
  )
);

create index media_milestone_idx on public.media (milestone_id);
create index media_moment_idx on public.media (moment_id);

-- ---------------------------------------------------------------------------
-- Row-level security. Reads require sign-in (the whole app is employees-only);
-- writes: anyone signed in can add moments, only owners/admins can change them,
-- only admins can touch milestones and categories.
-- ---------------------------------------------------------------------------
alter table public.admins enable row level security;
alter table public.categories enable row level security;
alter table public.people enable row level security;
alter table public.milestones enable row level security;
alter table public.moments enable row level security;
alter table public.moment_people enable row level security;
alter table public.media enable row level security;

create policy "read categories" on public.categories
  for select to authenticated using (true);
create policy "admin write categories" on public.categories
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "read people" on public.people
  for select to authenticated using (true);
create policy "insert people" on public.people
  for insert to authenticated with check (true);
create policy "update own person or admin" on public.people
  for update to authenticated
  using (auth_user_id = auth.uid() or public.is_admin())
  with check (auth_user_id = auth.uid() or public.is_admin());

create policy "read published milestones" on public.milestones
  for select to authenticated using (published or public.is_admin());
create policy "admin write milestones" on public.milestones
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "read moments" on public.moments
  for select to authenticated using (true);
create policy "insert own moments" on public.moments
  for insert to authenticated with check (created_by = auth.uid());
create policy "update own moments or admin" on public.moments
  for update to authenticated
  using (created_by = auth.uid() or public.is_admin())
  with check (created_by = auth.uid() or public.is_admin());
create policy "delete own moments or admin" on public.moments
  for delete to authenticated
  using (created_by = auth.uid() or public.is_admin());

create policy "read moment_people" on public.moment_people
  for select to authenticated using (true);
create policy "write moment_people via own moment" on public.moment_people
  for all to authenticated
  using (exists (
    select 1 from public.moments m
    where m.id = moment_id and (m.created_by = auth.uid() or public.is_admin())
  ))
  with check (exists (
    select 1 from public.moments m
    where m.id = moment_id and (m.created_by = auth.uid() or public.is_admin())
  ));

create policy "read media" on public.media
  for select to authenticated using (true);
create policy "insert own media" on public.media
  for insert to authenticated with check (created_by = auth.uid());
create policy "update own media or admin" on public.media
  for update to authenticated
  using (created_by = auth.uid() or public.is_admin())
  with check (created_by = auth.uid() or public.is_admin());
create policy "delete own media or admin" on public.media
  for delete to authenticated
  using (created_by = auth.uid() or public.is_admin());

-- Admin emails are only readable by admins themselves.
create policy "admins read admins" on public.admins
  for select to authenticated using (public.is_admin());

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger milestones_touch before update on public.milestones
  for each row execute function public.touch_updated_at();
create trigger moments_touch before update on public.moments
  for each row execute function public.touch_updated_at();
