/**
 * Bible Embedding Service
 *
 * Provides semantic (vector) similarity for Bible Follow: compares transcript
 * buffer to current/next verse text via embeddings so paraphrased speech
 * ("I won't lack" vs "I shall not want") still matches. Used only for Bible
 * verse advance; lyrics remain on fuzzy string matching.
 */

const OPENAI_EMBEDDINGS_URL = 'https://api.openai.com/v1/embeddings';
const DEFAULT_MODEL = 'text-embedding-3-small';

function getApiKey(): string | null {
  return (
    process.env.BIBLE_EMBEDDING_API_KEY ||
    process.env.OPENAI_API_KEY ||
    null
  );
}

export function isBibleSemanticFollowEnabled(): boolean {
  if (process.env.BIBLE_SEMANTIC_FOLLOW_ENABLED === 'false') return false;
  return process.env.BIBLE_SEMANTIC_FOLLOW_ENABLED === 'true' && !!getApiKey();
}

interface EmbeddingResponse {
  data: Array<{ embedding: number[] }>;
}

/**
 * Embed one or more texts via OpenAI embeddings API (batch).
 * Returns array of embedding vectors or null on failure/misconfiguration.
 */
export async function embedTexts(texts: string[]): Promise<number[][] | null> {
  const apiKey = getApiKey();
  if (!apiKey) return null;

  const model = process.env.BIBLE_EMBEDDING_MODEL || DEFAULT_MODEL;
  const filtered = texts.map((t) => t.trim()).filter((t) => t.length > 0);
  if (filtered.length === 0) return null;

  try {
    const res = await fetch(OPENAI_EMBEDDINGS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        input: filtered,
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      console.warn(
        `[BibleEmbedding] API error ${res.status}: ${errBody.slice(0, 200)}`
      );
      return null;
    }

    const data = (await res.json()) as EmbeddingResponse;
    if (!data?.data?.length || data.data.length !== filtered.length) {
      return null;
    }

    return data.data.map((d) => d.embedding);
  } catch (e) {
    console.warn('[BibleEmbedding] Request failed:', e);
    return null;
  }
}

/**
 * Cosine similarity between two vectors (assume same length).
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

export interface BibleFollowSemanticScores {
  currentScore: number;
  nextScore: number;
}

/**
 * Get semantic similarity scores: buffer vs current verse, buffer vs next verse.
 * Returns null if embedding is not configured or request fails (caller should
 * fall back to lexical getMatchScore).
 */
export async function getBibleFollowSemanticScores(
  buffer: string,
  currentVerseText: string,
  nextVerseText: string
): Promise<BibleFollowSemanticScores | null> {
  const trimmedBuffer = buffer.trim();
  if (!trimmedBuffer || !currentVerseText.trim() || !nextVerseText.trim()) {
    return null;
  }

  const embeddings = await embedTexts([
    trimmedBuffer,
    currentVerseText.trim(),
    nextVerseText.trim(),
  ]);

  if (!embeddings || embeddings.length !== 3) {
    return null;
  }

  const [bufVec, currentVec, nextVec] = embeddings;
  const currentScore = cosineSimilarity(bufVec, currentVec);
  const nextScore = cosineSimilarity(bufVec, nextVec);

  return { currentScore, nextScore };
}
