/**
 * BIBLE_CONTROL handler tests: operator project / step / hold / undo through the WS router,
 * plus MANUAL_OVERRIDE Prev/Next routing to verse navigation while in Bible mode.
 */

import { handleMessage, handleClose } from '../../websocket/handler';
import type { WebSocket } from 'ws';

jest.mock('../../services/eventService', () => ({
  fetchEventData: jest.fn(),
  fetchEventItemById: jest.fn(),
}));

jest.mock('../../services/sttService', () => ({
  transcribeAudioChunk: jest.fn(),
  createStreamingRecognition: jest.fn(),
  sttProvider: 'mock',
  isElevenLabsConfigured: () => false,
  isGoogleCloudConfigured: () => false,
}));

jest.mock('../../services/matcherService', () => ({
  findBestMatch: jest.fn(),
  findBestMatchAcrossAllSongs: jest.fn(),
  createSongContext: jest.fn(() => ({})),
  validateConfig: jest.fn(() => ({ valid: true })),
}));

jest.mock('../../services/bibleTriggerService', () => ({
  createBibleTriggerDetector: jest.fn(() => ({ start: jest.fn(), stop: jest.fn(), pushAudio: jest.fn() })),
}));

jest.mock('../../services/bibleEmbeddingService', () => ({
  isBibleSemanticFollowEnabled: () => false,
  getBibleFollowSemanticScores: jest.fn(),
  findVerseByContent: jest.fn(),
}));

// John 3 has 36 verses in this fixture; John 4:1 exists so NEXT rolls into the next chapter.
jest.mock('../../services/bibleService', () => {
  const actual = jest.requireActual('../../services/bibleService');
  return {
    ...actual,
    getDefaultBibleVersionId: jest.fn(async () => 'version-kjv'),
    getBibleVersionIdByAbbrev: jest.fn(async () => 'version-kjv'),
    detectBibleVersionCommand: jest.fn(() => null),
    searchVerseCandidatesByWords: jest.fn(async () => []),
    fetchBibleVerse: jest.fn(async (ref: { book: string; chapter: number; verse: number }) => {
      if (ref.book !== 'John') return null;
      if (ref.chapter === 3 && ref.verse >= 1 && ref.verse <= 36) {
        return { book: 'John', chapter: 3, verse: ref.verse, text: `John 3:${ref.verse} text`, versionAbbrev: 'KJV' };
      }
      if (ref.chapter === 4 && ref.verse === 1) {
        return { book: 'John', chapter: 4, verse: 1, text: 'John 4:1 text', versionAbbrev: 'KJV' };
      }
      return null;
    }),
  };
});

const EVENT_ID = '123e4567-e89b-12d3-a456-426614174099';
const USER_ID = 'user-1';

type Sent = { type: string; payload: Record<string, unknown> };

function makeSocket() {
  const sent: Sent[] = [];
  const socket = {
    readyState: 1,
    OPEN: 1,
    send: jest.fn((raw: string) => sent.push(JSON.parse(raw))),
    close: jest.fn(),
    on: jest.fn(),
  };
  return { socket: socket as unknown as WebSocket, sent };
}

function lastOfType(sent: Sent[], type: string): Sent | undefined {
  return [...sent].reverse().find((m) => m.type === type);
}

async function send(socket: WebSocket, msg: unknown): Promise<void> {
  await handleMessage(socket, JSON.stringify(msg), USER_ID);
}

describe('BIBLE_CONTROL', () => {
  let socket: WebSocket;
  let sent: Sent[];

  beforeEach(async () => {
    jest.clearAllMocks();
    const { fetchEventData } = await import('../../services/eventService');
    (fetchEventData as jest.Mock).mockResolvedValue({
      id: EVENT_ID,
      name: 'Test Event',
      bibleMode: true,
      bibleVersionId: 'version-kjv',
      songs: [{ id: 'song-1', title: 'Song 1', lines: ['Line 1', 'Line 2'] }],
      setlistItems: [{ id: 'item-1', type: 'SONG', songId: 'song-1' }],
    });
    ({ socket, sent } = makeSocket());
    await send(socket, { type: 'START_SESSION', payload: { eventId: EVENT_ID } });
    expect(lastOfType(sent, 'SESSION_STARTED')).toBeDefined();
    sent.length = 0;
  });

  afterEach(() => {
    handleClose(socket);
  });

  it('PROJECT_REF projects the verse and reports status with no undo history', async () => {
    await send(socket, { type: 'BIBLE_CONTROL', payload: { action: 'PROJECT_REF', ref: { book: 'John', chapter: 3, verse: 16 } } });
    const display = lastOfType(sent, 'DISPLAY_UPDATE');
    expect(display?.payload.songId).toBe('bible:John:3:16');
    expect(display?.payload.isAutoAdvance).toBe(false);
    expect(display?.payload.nextVerseRef).toBe('John 3:17');
    const status = lastOfType(sent, 'BIBLE_STATUS');
    expect(status?.payload).toMatchObject({ currentLabel: 'John 3:16', source: 'manual', hold: false, canUndo: false, historyDepth: 0 });
  });

  it('NEXT_VERSE / PREV_VERSE step verses and build undo history', async () => {
    await send(socket, { type: 'BIBLE_CONTROL', payload: { action: 'PROJECT_REF', ref: { book: 'John', chapter: 3, verse: 16 } } });
    await send(socket, { type: 'BIBLE_CONTROL', payload: { action: 'NEXT_VERSE' } });
    expect(lastOfType(sent, 'DISPLAY_UPDATE')?.payload.songId).toBe('bible:John:3:17');
    expect(lastOfType(sent, 'BIBLE_STATUS')?.payload).toMatchObject({ currentLabel: 'John 3:17', canUndo: true, historyDepth: 1 });

    await send(socket, { type: 'BIBLE_CONTROL', payload: { action: 'PREV_VERSE' } });
    expect(lastOfType(sent, 'DISPLAY_UPDATE')?.payload.songId).toBe('bible:John:3:16');
    expect(lastOfType(sent, 'BIBLE_STATUS')?.payload).toMatchObject({ currentLabel: 'John 3:16', historyDepth: 2 });
  });

  it('NEXT_VERSE rolls into the next chapter at the end of a chapter', async () => {
    await send(socket, { type: 'BIBLE_CONTROL', payload: { action: 'PROJECT_REF', ref: { book: 'John', chapter: 3, verse: 36 } } });
    await send(socket, { type: 'BIBLE_CONTROL', payload: { action: 'NEXT_VERSE' } });
    expect(lastOfType(sent, 'DISPLAY_UPDATE')?.payload.songId).toBe('bible:John:4:1');
  });

  it('PREV_VERSE at verse 1 reports an error and keeps the verse', async () => {
    await send(socket, { type: 'BIBLE_CONTROL', payload: { action: 'PROJECT_REF', ref: { book: 'John', chapter: 3, verse: 1 } } });
    sent.length = 0;
    await send(socket, { type: 'BIBLE_CONTROL', payload: { action: 'PREV_VERSE' } });
    expect(lastOfType(sent, 'ERROR')?.payload.code).toBe('BIBLE_RANGE');
    expect(lastOfType(sent, 'DISPLAY_UPDATE')).toBeUndefined();
  });

  it('MANUAL_OVERRIDE NEXT_SLIDE/PREV_SLIDE step verses while a verse is on screen in Bible mode', async () => {
    await send(socket, { type: 'BIBLE_CONTROL', payload: { action: 'PROJECT_REF', ref: { book: 'John', chapter: 3, verse: 16 } } });
    await send(socket, { type: 'MANUAL_OVERRIDE', payload: { action: 'NEXT_SLIDE' } });
    expect(lastOfType(sent, 'DISPLAY_UPDATE')?.payload.songId).toBe('bible:John:3:17');
    await send(socket, { type: 'MANUAL_OVERRIDE', payload: { action: 'PREV_SLIDE' } });
    expect(lastOfType(sent, 'DISPLAY_UPDATE')?.payload.songId).toBe('bible:John:3:16');
  });

  it('HOLD toggles and is reported in status; UNDO restores the previous verse without growing history', async () => {
    await send(socket, { type: 'BIBLE_CONTROL', payload: { action: 'PROJECT_REF', ref: { book: 'John', chapter: 3, verse: 16 } } });
    await send(socket, { type: 'BIBLE_CONTROL', payload: { action: 'NEXT_VERSE' } });

    await send(socket, { type: 'BIBLE_CONTROL', payload: { action: 'HOLD', hold: true } });
    expect(lastOfType(sent, 'BIBLE_STATUS')?.payload.hold).toBe(true);
    await send(socket, { type: 'BIBLE_CONTROL', payload: { action: 'HOLD' } });
    expect(lastOfType(sent, 'BIBLE_STATUS')?.payload.hold).toBe(false);

    await send(socket, { type: 'BIBLE_CONTROL', payload: { action: 'UNDO' } });
    expect(lastOfType(sent, 'DISPLAY_UPDATE')?.payload.songId).toBe('bible:John:3:16');
    expect(lastOfType(sent, 'BIBLE_STATUS')?.payload).toMatchObject({ currentLabel: 'John 3:16', source: 'undo', canUndo: false, historyDepth: 0 });

    sent.length = 0;
    await send(socket, { type: 'BIBLE_CONTROL', payload: { action: 'UNDO' } });
    expect(lastOfType(sent, 'ERROR')?.payload.code).toBe('BIBLE_NO_HISTORY');
  });
});
