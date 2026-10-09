-- Blogger Studio initial database schema
-- Apply only to a dedicated new Supabase project.
-- User-owned data is isolated with RLS. No service-role secrets belong in the browser.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.blogs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text not null default '',
  slug text not null,
  language text not null default 'ar',
  timezone text not null default 'Africa/Casablanca',
  custom_domain text,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(owner_id, slug)
);

create table if not exists public.blog_members (
  blog_id uuid not null references public.blogs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'editor' check (role in ('owner','admin','editor','author','moderator','viewer')),
  created_at timestamptz not null default now(),
  primary key (blog_id, user_id)
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  blog_id uuid not null references public.blogs(id) on delete cascade,
  name text not null,
  slug text not null,
  description text not null default '',
  created_at timestamptz not null default now(),
  unique(blog_id, slug)
);

create table if not exists public.tags (
  id uuid primary key default gen_random_uuid(),
  blog_id uuid not null references public.blogs(id) on delete cascade,
  name text not null,
  slug text not null,
  unique(blog_id, slug)
);

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  blog_id uuid not null references public.blogs(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete restrict,
  category_id uuid references public.categories(id) on delete set null,
  title text not null default '',
  slug text not null,
  excerpt text not null default '',
  content jsonb not null default '{}'::jsonb,
  content_html text not null default '',
  featured_image text,
  status text not null default 'draft' check (status in ('draft','review','scheduled','published','archived','trash')),
  visibility text not null default 'public' check (visibility in ('public','private','password')),
  password_hash text,
  scheduled_at timestamptz,
  published_at timestamptz,
  canonical_url text,
  seo_title text,
  seo_description text,
  seo_keywords text[] not null default '{}',
  robots_index boolean not null default true,
  robots_follow boolean not null default true,
  og_title text,
  og_description text,
  og_image text,
  schema_type text not null default 'BlogPosting',
  reading_time_minutes integer not null default 0 check (reading_time_minutes >= 0),
  view_count bigint not null default 0 check (view_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(blog_id, slug)
);

create table if not exists public.post_tags (
  post_id uuid not null references public.posts(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  primary key(post_id, tag_id)
);

create table if not exists public.pages (
  id uuid primary key default gen_random_uuid(),
  blog_id uuid not null references public.blogs(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete restrict,
  title text not null default '',
  slug text not null,
  content jsonb not null default '{}'::jsonb,
  content_html text not null default '',
  status text not null default 'draft' check (status in ('draft','published','archived')),
  seo_title text,
  seo_description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(blog_id, slug)
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  parent_id uuid references public.comments(id) on delete cascade,
  author_user_id uuid references auth.users(id) on delete set null,
  author_name text not null default '',
  author_email text,
  body text not null,
  status text not null default 'pending' check (status in ('pending','approved','spam','trash')),
  ip_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.media_assets (
  id uuid primary key default gen_random_uuid(),
  blog_id uuid not null references public.blogs(id) on delete cascade,
  uploaded_by uuid not null references auth.users(id) on delete restrict,
  storage_path text not null,
  original_name text not null,
  mime_type text,
  size_bytes bigint not null default 0 check (size_bytes >= 0),
  alt_text text not null default '',
  width integer,
  height integer,
  created_at timestamptz not null default now(),
  unique(blog_id, storage_path)
);

create table if not exists public.redirects (
  id uuid primary key default gen_random_uuid(),
  blog_id uuid not null references public.blogs(id) on delete cascade,
  source_path text not null,
  target_url text not null,
  status_code integer not null default 301 check (status_code in (301,302,307,308)),
  created_at timestamptz not null default now(),
  unique(blog_id, source_path)
);

create table if not exists public.navigation_menus (
  id uuid primary key default gen_random_uuid(),
  blog_id uuid not null references public.blogs(id) on delete cascade,
  name text not null,
  items jsonb not null default '[]'::jsonb,
  location text not null default 'header',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.audit_events (
  id bigint generated always as identity primary key,
  blog_id uuid references public.blogs(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists blogs_owner_id_idx on public.blogs(owner_id);
create index if not exists blog_members_user_id_idx on public.blog_members(user_id);
create index if not exists posts_blog_status_published_idx on public.posts(blog_id, status, published_at desc);
create index if not exists posts_blog_updated_idx on public.posts(blog_id, updated_at desc);
create index if not exists comments_post_status_idx on public.comments(post_id, status, created_at desc);
create index if not exists media_blog_created_idx on public.media_assets(blog_id, created_at desc);
create index if not exists audit_blog_created_idx on public.audit_events(blog_id, created_at desc);

-- Membership helper is SECURITY DEFINER to avoid recursive RLS on blog_members.
create or replace function public.user_can_access_blog(target_blog uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.blog_members bm
    where bm.blog_id = target_blog and bm.user_id = (select auth.uid())
  ) or exists (
    select 1 from public.blogs b
    where b.id = target_blog and b.owner_id = (select auth.uid())
  );
$$;

create or replace function public.user_owns_blog(target_blog uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.blogs b
    where b.id = target_blog and b.owner_id = (select auth.uid())
  );
$$;

alter table public.profiles enable row level security;
alter table public.blogs enable row level security;
alter table public.blog_members enable row level security;
alter table public.categories enable row level security;
alter table public.tags enable row level security;
alter table public.posts enable row level security;
alter table public.post_tags enable row level security;
alter table public.pages enable row level security;
alter table public.comments enable row level security;
alter table public.media_assets enable row level security;
alter table public.redirects enable row level security;
alter table public.navigation_menus enable row level security;
alter table public.audit_events enable row level security;

create policy "profiles_select_self" on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy "profiles_insert_self" on public.profiles for insert to authenticated with check (id = (select auth.uid()));
create policy "profiles_update_self" on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy "blogs_select_member" on public.blogs for select to authenticated using (owner_id = (select auth.uid()) or public.user_can_access_blog(id));
create policy "blogs_insert_owner" on public.blogs for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "blogs_update_owner" on public.blogs for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "blogs_delete_owner" on public.blogs for delete to authenticated using (owner_id = (select auth.uid()));

create policy "members_select_blog" on public.blog_members for select to authenticated using (user_id = (select auth.uid()) or public.user_can_access_blog(blog_id));
create policy "members_owner_manage" on public.blog_members for all to authenticated using (public.user_owns_blog(blog_id)) with check (public.user_owns_blog(blog_id));

create policy "categories_member_all" on public.categories for all to authenticated using (public.user_can_access_blog(blog_id)) with check (public.user_can_access_blog(blog_id));
create policy "tags_member_all" on public.tags for all to authenticated using (public.user_can_access_blog(blog_id)) with check (public.user_can_access_blog(blog_id));
create policy "posts_member_all" on public.posts for all to authenticated using (public.user_can_access_blog(blog_id)) with check (public.user_can_access_blog(blog_id));
create policy "post_tags_member_all" on public.post_tags for all to authenticated using (exists (select 1 from public.posts p where p.id = post_id and public.user_can_access_blog(p.blog_id))) with check (exists (select 1 from public.posts p where p.id = post_id and public.user_can_access_blog(p.blog_id)));
create policy "pages_member_all" on public.pages for all to authenticated using (public.user_can_access_blog(blog_id)) with check (public.user_can_access_blog(blog_id));
create policy "comments_member_all" on public.comments for all to authenticated using (exists (select 1 from public.posts p where p.id = post_id and public.user_can_access_blog(p.blog_id))) with check (exists (select 1 from public.posts p where p.id = post_id and public.user_can_access_blog(p.blog_id)));
create policy "media_member_all" on public.media_assets for all to authenticated using (public.user_can_access_blog(blog_id)) with check (public.user_can_access_blog(blog_id));
create policy "redirects_member_all" on public.redirects for all to authenticated using (public.user_can_access_blog(blog_id)) with check (public.user_can_access_blog(blog_id));
create policy "menus_member_all" on public.navigation_menus for all to authenticated using (public.user_can_access_blog(blog_id)) with check (public.user_can_access_blog(blog_id));
create policy "audit_member_select" on public.audit_events for select to authenticated using (blog_id is not null and public.user_can_access_blog(blog_id));
create policy "audit_member_insert" on public.audit_events for insert to authenticated with check (actor_id = (select auth.uid()) and (blog_id is null or public.user_can_access_blog(blog_id)));

-- Intentionally no anonymous policies yet: public-facing publishing endpoints require a separately designed read-only layer.
-- Before production: add role-aware permission checks for owner/admin/editor/author/moderator;
-- implement Storage bucket policies; add updated_at triggers; review function EXECUTE grants and test RLS.
