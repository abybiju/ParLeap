# Verify Bible books per version in the database

Use this to check that `bible_verses` contains all expected books for each ingested version (e.g. KJV). If a book like Daniel is missing for a version, verse lookup will fail for that book.

## SQL (run in Supabase SQL Editor)

List books present per version, with verse counts:

```sql
SELECT
  v.id AS version_id,
  v.name AS version_name,
  v.abbrev AS version_abbrev,
  b.name AS book_name,
  COUNT(*) AS verse_count
FROM bible_verses bv
JOIN bible_versions v ON v.id = bv.version_id
JOIN bible_books b ON b.id = bv.book_id
GROUP BY v.id, v.name, v.abbrev, b.id, b.name
ORDER BY v.abbrev, b."order";
```

Expected: 66 books per version if the ingest used the full JSON. If a version has fewer than 66 books, re-run the ingest script with a complete source file.

## Quick check for a single book (e.g. Daniel)

```sql
SELECT v.abbrev, b.name, COUNT(*) AS verses
FROM bible_verses bv
JOIN bible_versions v ON v.id = bv.version_id
JOIN bible_books b ON b.id = bv.book_id
WHERE b.name = 'Daniel'
GROUP BY v.abbrev, b.name;
```

If no rows are returned for a version, Daniel (or that book) was not ingested for that version.

## Note on ESV

When the selected version is ESV, verses are fetched on demand from the ESV API; they are not stored in `bible_verses`. So the SQL above only applies to ingested versions (e.g. KJV).
