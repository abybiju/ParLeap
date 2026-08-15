import { detectBibleVoiceCommand } from '../../services/bibleVoiceCommands';

describe('detectBibleVoiceCommand', () => {
  it('detects the open command in plain and article forms', () => {
    expect(detectBibleVoiceCommand('open bible')).toBe('OPEN');
    expect(detectBibleVoiceCommand('Open the Bible')).toBe('OPEN');
    expect(detectBibleVoiceCommand('please open your bibles')).toBe('OPEN');
    expect(detectBibleVoiceCommand('now open bible John chapter three verse sixteen')).toBe('OPEN');
  });

  it('detects the close command', () => {
    expect(detectBibleVoiceCommand('close bible')).toBe('CLOSE');
    expect(detectBibleVoiceCommand('okay close the bible')).toBe('CLOSE');
  });

  it('returns null when no command is present', () => {
    expect(detectBibleVoiceCommand('')).toBeNull();
    expect(detectBibleVoiceCommand('amazing grace how sweet the sound')).toBeNull();
    expect(detectBibleVoiceCommand('the bible says we should love one another')).toBeNull();
    expect(detectBibleVoiceCommand('open your hearts to the lord')).toBeNull();
    // "open" and "bible" far apart must not combine
    expect(detectBibleVoiceCommand('open the door and read the bible later')).toBeNull();
  });

  it('later command wins when a cumulative transcript contains both', () => {
    expect(detectBibleVoiceCommand('open bible John three sixteen close the bible')).toBe('CLOSE');
    expect(detectBibleVoiceCommand('close the bible alright open bible again')).toBe('OPEN');
  });
});
