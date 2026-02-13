# Community Templates & SongSelect File Import (Feb 12, 2026)

## What We Shipped
- **Community Templates (structure-only)** stored in Supabase:
  - Table: `community_templates` with `ccli_number`, `line_count`, `slides` (start/end), `sections` (labels), `structure_hash`, `status` (pending/active/flagged), `usage_count`.
  - Votes table: `template_votes`; view `template_stats` for score/usage.
  - Unique index on `(ccli_number, structure_hash)` so identical structures increment `usage_count` instead of duplicating rows.
- **Auto-apply on import/save**:
  - Best template is chosen when `ccli_number` + `line_count` match and `score >= 0` (fallback to `>= -5` if nothing else).
  - Auto-apply happens in the backend song compiler and in the Song Editor preview.
  - Usage ping sent when a template is applied (or upserted) to keep popularity accurate.
- **Swap Template dialog**:
  - Lists available templates with score, usage, slide count; apply button updates preview immediately.
  - Shows warning when only low-score templates exist.
- **Auto-submit on Save** (silent):
  - When a song with `ccli_number` is saved, the current slide breaks + section labels are hashed and upserted into `community_templates` in the background (fire-and-forget).
  - If the structure already exists, only `usage_count` increments.
- **File import (no API needed)**:
  - Drag/drop or browse `.usr` or `.txt` SongSelect exports in the Song Editor.
  - Client-side parser extracts title/artist/CCLI/lyrics; auto-fills the form and immediately auto-applies a community template if available.
  - PDF intentionally **not supported**.

## How Selection Works
1. Require exact `line_count` match.
2. Rank by `score` (upvotes - downvotes), then `usage_count`, then `created_at`.
3. Auto-apply only if `score >= 0` (fallback to `>= -5` when no better option exists).
4. Structures with `score < -5` are effectively suppressed from auto-apply.

## APIs & Services
- **Backend service:** `backend/src/services/templateService.ts`
  - `submitTemplate`, `fetchTemplates`, `incrementTemplateUsage`, `applyTemplateToLines`, `structureHash`.
- **Endpoints:** `POST /api/templates` (submit), `GET /api/templates?ccli=...&lineCount=...` (list), `POST /api/templates/:id/vote`, `POST /api/templates/:id/usage`.
- **Frontend helpers:** `frontend/lib/api/templates.ts`, `frontend/lib/parsers/songselect.ts`, `frontend/lib/slideServiceProxy.ts`.

## Testing Checklist
- Song Editor: enter CCLI + paste lyrics ⇒ should auto-apply top template and show badge.
- Swap dialog: should list template with score/uses; applying should update preview and toast success.
- Save song: should succeed quickly; background upsert should not block UI. Verify new template row/usage in Supabase.
- File import: drag a valid `.usr` file ⇒ title/artist/CCLI/lyrics populated and template applied.

## Known Limitations / Follow-ups
- slideServiceProxy imports backend service directly; verify Next.js build keeps the path stable.
- Templates are single-language; no locale dimension yet.
- PDF import intentionally out-of-scope.
- No UI yet to flag/report bad templates (score downvotes handle this partially).
- Active issue (Feb 13, 2026): in production, some CCLI+lyrics inputs still show `None applied` even when template data exists. Crash is fixed, but auto-format behavior is not consistently applying in Song Editor preview.
  - Recent hardening commits: `033b75c`, `e2aaf79`.
  - Backend normalization commit: `1de8451` (maps `template_id -> id` and normalizes legacy `slides` payloads).
  - Next debug step: compare `GET /api/templates?ccli=<id>&lineCount=<n>` response shape against the exact editor lyric line count at runtime.

## Quick Supabase References
- Tables: `community_templates`, `template_votes`; view `template_stats`.
- Policies: RLS enabled; select allowed for authenticated users. Upserts go through backend API (service key).
- Unique index: `(ccli_number, structure_hash)` prevents duplicates; `structure_hash` = hashed slides/sections blob.
