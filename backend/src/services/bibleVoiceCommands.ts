/**
 * Spoken mode-switch commands for Smart Bible Listen.
 *
 * "open (the) bible"  → switch the session into Bible mode
 * "close (the) bible" → switch back to song mode
 *
 * ElevenLabs transcripts are cumulative per utterance, so one text can contain BOTH
 * commands ("open bible … close bible"). The LAST spoken command wins — decided by
 * occurrence position, not match order.
 */

const OPEN_RE = /\bopen\s+(?:\w+\s+)?bibles?\b/gi;
const CLOSE_RE = /\bclose\s+(?:\w+\s+)?bibles?\b/gi;

export type BibleVoiceCommand = 'OPEN' | 'CLOSE';

/** Last position a global regex matches in text, or -1. */
function lastMatchIndex(re: RegExp, text: string): number {
  re.lastIndex = 0;
  let last = -1;
  for (let m = re.exec(text); m !== null; m = re.exec(text)) {
    last = m.index;
    if (m.index === re.lastIndex) re.lastIndex++; // safety against zero-width loops
  }
  return last;
}

/**
 * Detect the effective spoken mode command in a transcript, if any.
 * Returns the LATER of "open bible"/"close bible" when both appear.
 */
export function detectBibleVoiceCommand(text: string): BibleVoiceCommand | null {
  if (!text) return null;
  const openIdx = lastMatchIndex(OPEN_RE, text);
  const closeIdx = lastMatchIndex(CLOSE_RE, text);
  if (openIdx < 0 && closeIdx < 0) return null;
  return openIdx > closeIdx ? 'OPEN' : 'CLOSE';
}
