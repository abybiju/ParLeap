-- background_media_type: 'image' | 'video' | null. Null = treat as image (backward compat).
alter table public.events
add column if not exists background_media_type text;
