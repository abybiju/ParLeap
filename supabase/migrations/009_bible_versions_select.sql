alter table public.bible_versions enable row level security;

create policy "Bible versions are readable by authenticated users"
  on public.bible_versions
  for select
  using (auth.role() = 'authenticated');
