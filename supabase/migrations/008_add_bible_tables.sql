create table if not exists public.bible_versions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  abbrev text not null,
  language text not null default 'en',
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists bible_versions_abbrev_idx on public.bible_versions (abbrev);

create table if not exists public.bible_books (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  abbrev text not null,
  book_order int not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists bible_books_name_idx on public.bible_books (name);
create unique index if not exists bible_books_abbrev_idx on public.bible_books (abbrev);
create unique index if not exists bible_books_order_idx on public.bible_books (book_order);

create table if not exists public.bible_verses (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.bible_versions(id) on delete cascade,
  book_id uuid not null references public.bible_books(id) on delete cascade,
  chapter int not null,
  verse int not null,
  text text not null,
  search_text text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists bible_verses_ref_idx on public.bible_verses (version_id, book_id, chapter, verse);
create index if not exists bible_verses_search_idx on public.bible_verses (search_text);

alter table public.events
  add column if not exists bible_mode boolean not null default false;

alter table public.events
  add column if not exists bible_version_id uuid references public.bible_versions(id);
