insert into public.bible_versions (name, abbrev, language, is_default)
select 'English Standard Version', 'ESV', 'en', false
where not exists (
  select 1 from public.bible_versions where abbrev = 'ESV'
);
