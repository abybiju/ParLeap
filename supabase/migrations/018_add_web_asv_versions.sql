-- Add WEB and ASV as selectable Bible versions (text fetched on-demand from Bible-API.com).
insert into public.bible_versions (name, abbrev, language, is_default)
values
  ('World English Bible', 'WEB', 'en', false),
  ('American Standard Version', 'ASV', 'en', false)
on conflict (abbrev) do nothing;
