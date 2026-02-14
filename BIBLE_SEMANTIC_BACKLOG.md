# Bible Semantic — Shipped and Backlog

**Last updated:** February 13, 2026

## Shipped (Current Behavior)

- **Semantic verse-by-content (Bible only)**  
  - OpenAI embeddings for Bible Follow (paraphrased verse advance) and for opening a verse by spoken content.  
  - Env: `BIBLE_SEMANTIC_FOLLOW_ENABLED=true`, `OPENAI_API_KEY` (or `BIBLE_EMBEDDING_API_KEY`).

- **Full-Bible open by content**  
  - Keyword search on `bible_verses.search_text` (words from buffer) → up to 80 candidates → semantic rerank (`findVerseByContent`).  
  - Fallback to 15 well-known verses when keyword search returns nothing (e.g. ESV not in DB).

- **Jump within same chapter**  
  - When following a passage (e.g. Psalm 23), saying content of another verse in the same chapter (e.g. verse 4) jumps the display to that verse (semantic match + debounce).

- **Reference detection improvements**  
  - Chapter-only: "Luke 1", "Luke chapter 1", "Romans 5" → open verse 1 of that chapter.  
  - Book soundalikes: e.g. "roman", "romen" → Romans; "genisis", "revelations", "philipians", "colosians", "galations", "corinthans" added.  
  - Fuzzy book match: if no alias matches, `string-similarity` (≥ 0.82) against book names/aliases to resolve book, then parse chapter/verse.

- **Cross-chapter/cross-book jump by content (attempted)**  
  - Handler runs full-Bible verse-by-content when in Bible Follow; if best match is a different verse (any book/chapter), debounce and jump.  
  - In practice, **in-chapter jump works; cross-chapter/cross-book jump is not yet reliable** and is on the backlog.

---

## Backlog (To Improve)

1. **Improve cross-chapter / cross-book jump by content**  
   - Goal: When user says rephrased content of a verse in another chapter or book (e.g. Romans 8:28 while on Romans 1), reliably jump to that verse.  
   - Current: In-chapter jump works; cross-chapter/cross-book often does not.  
   - Ideas: Tune threshold, candidate set, or run full-Bible path more often; consider precomputed verse embeddings (pgvector) for lower latency and better recall.

2. **Reduce Bible verse latency**  
   - User-reported: Bible verse path feels slow.  
   - Goal: Measure and optimize without breaking behavior.  
   - Ideas: Throttle embedding calls (e.g. don’t run on every transcript chunk), cache embeddings for current/next verse in session, or move to precomputed verse embeddings so only the buffer is embedded at request time.

3. **Brainstorm: Open-source semantic instead of/in addition to OpenAI**  
   - Goal: Explore running a small open-source embedding/semantic model (e.g. from Hugging Face) inside Node.js or an Edge Function to reduce cost or latency, or for on-prem.  
   - To do: Identify a suitable model (e.g. sentence-transformers style), check runnability in Node/Edge, and document options for a future session.

---

## Key Files

- `backend/src/services/bibleEmbeddingService.ts` — embeddings, `findVerseByContent`, `getBibleFollowSemanticScores`
- `backend/src/services/bibleService.ts` — `findBibleReference`, `searchVerseCandidatesByWords`, chapter-only, fuzzy book
- `backend/src/data/bibleBooks.ts` — book aliases and soundalikes
- `backend/src/websocket/handler.ts` — Bible Follow, verse-by-content open, in-chapter jump, cross-chapter jump path
- `README.md`, `ENV_SETUP.md` — env for `BIBLE_SEMANTIC_FOLLOW_ENABLED`, `OPENAI_API_KEY`
