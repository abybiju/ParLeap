/**
 * Client-side OCR for "Grab Text" using Tesseract.js.
 * Maps extracted text to announcement structured text (title, subtitle, date, lines).
 * Best for clear, straight, Latin text.
 */

import type { AnnouncementStructuredText } from '@/lib/types/setlist';

/** Rough date pattern (e.g. "Feb 15, 2026" or "15/02/2026") */
const DATE_LIKE = /^\d{1,4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,4}$|^(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2},?\s+\d{4}$/i;

function looksLikeDate(s: string): boolean {
  const t = s.trim();
  if (t.length > 30) return false;
  return DATE_LIKE.test(t) || /^\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i.test(t);
}

/**
 * Maps raw line strings from OCR into structured fields.
 * Heuristic: first line = title, second = subtitle, third = date if date-like else line, rest = lines.
 */
export function mapOcrLinesToStructuredText(lines: string[]): AnnouncementStructuredText {
  const trimmed = lines.map((l) => (l ?? '').trim()).filter(Boolean);
  if (trimmed.length === 0) {
    return {};
  }
  const title = trimmed[0] ?? '';
  const subtitle = trimmed[1] ?? undefined;
  const rest = trimmed.slice(2);
  const dateIdx = rest.findIndex((l) => looksLikeDate(l));
  const date = dateIdx >= 0 ? rest[dateIdx] : undefined;
  const linesOut = dateIdx >= 0 ? [...rest.slice(0, dateIdx), ...rest.slice(dateIdx + 1)] : rest;
  return {
    title: title || undefined,
    subtitle: subtitle || undefined,
    date: date || undefined,
    lines: linesOut.length > 0 ? linesOut : undefined,
  };
}

export interface GrabTextResult {
  structuredText: AnnouncementStructuredText;
  rawText: string;
  confidence: number;
}

/**
 * Runs Tesseract.js on an image (File or URL). Use in browser only.
 * Loads Tesseract dynamically to avoid SSR/Node issues.
 */
export async function grabTextFromImage(source: File | string): Promise<GrabTextResult> {
  const Tesseract = await import('tesseract.js');
  const worker = await Tesseract.createWorker('eng', 1, {
    logger: () => {},
  });
  try {
    const result = await worker.recognize(source);
    const text = (result.data.text ?? '').trim();
    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    const structuredText = mapOcrLinesToStructuredText(lines);
    const confidence = result.data.confidence ?? 0;
    return {
      structuredText,
      rawText: text,
      confidence,
    };
  } finally {
    await worker.terminate();
  }
}
