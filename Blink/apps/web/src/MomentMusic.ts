/**
 * Blink Originals: short procedurally synthesized, royalty-free-in-app loops.
 * The Moment stores a track ID rather than a commercial copyrighted recording.
 * Playback is a background soundtrack alongside the original photo/video.
 */
export type MusicTrack = { id: string; title: string; mood: string; emoji: string; notes: number[]; bpm: number; wave: 'sine'|'triangle'|'square' };
export const MUSIC_TRACKS: MusicTrack[] = [
  { id: 'sunny-pop', title: 'Sunny Pop', mood: 'Upbeat', emoji: '☀️', bpm: 114, wave: 'triangle', notes: [60,64,67,72,67,64,65,69,72,69,67,64,60,64,67,72] },
  { id: 'dream-cloud', title: 'Dream Cloud', mood: 'Soft ambient', emoji: '☁️', bpm: 84, wave: 'sine', notes: [57,60,64,69,64,60,55,59,62,67,62,59,57,60,64,69] },
  { id: 'neon-night', title: 'Neon Night', mood: 'Electronic', emoji: '🌃', bpm: 128, wave: 'square', notes: [48,55,60,63,60,55,50,57,62,65,62,57,48,55,60,67] },
  { id: 'golden-hour', title: 'Golden Hour', mood: 'Warm vibes', emoji: '🌅', bpm: 96, wave: 'triangle', notes: [52,56,59,64,59,56,54,57,61,66,61,57,52,56,59,64] },
  { id: 'little-steps', title: 'Little Steps', mood: 'Playful', emoji: '✨', bpm: 122, wave: 'sine', notes: [72,74,76,79,76,74,72,69,71,74,76,78,76,74,71,72] },
  { id: 'soft-waves', title: 'Soft Waves', mood: 'Calm', emoji: '🌊', bpm: 80, wave: 'sine', notes: [55,59,62,67,62,59,53,57,60,65,60,57,55,59,62,67] },
];
export const musicTrack = (id: string | null | undefined) =>
  MUSIC_TRACKS.find((entry) => entry.id === id);

const sounds = new Map<string, string>();
function sampleWave(phase: number, wave: MusicTrack['wave']) {
  if (wave === 'square') return Math.tanh(3.2 * Math.sin(phase));
  if (wave === 'triangle') return 2 / Math.PI * Math.asin(Math.sin(phase));
  return Math.sin(phase);
}
/** Offline deterministic synthesis; no third-party audio or licensing required. */
export async function makeMusicUrl(id: string): Promise<string> {
  const cached = sounds.get(id);
  if (cached) return cached;
  const track = musicTrack(id);
  if (!track) throw new Error('Selected soundtrack is not available.');
  const rate = 22050, seconds = 16, frames = rate * seconds;
  const pcm = new Int16Array(frames);
  const step = 60 / track.bpm / 2;
  for (let i = 0; i < frames; i++) {
    const t = i / rate;
    const index = Math.floor(t / step) % track.notes.length;
    const local = t % step;
    const envelope = Math.min(1, local * 35) * Math.pow(Math.max(0, 1 - local / step), .9);
    const freq = 440 * Math.pow(2, (track.notes[index] - 69) / 12);
    const lead = sampleWave(2 * Math.PI * freq * t, track.wave) * envelope * .24;
    const bassNote = track.notes[Math.floor(index / 4) * 4] - 24;
    const bassFreq = 440 * Math.pow(2, (bassNote - 69) / 12);
    const bass = Math.sin(2 * Math.PI * bassFreq * t) * .15 * (.55 + .45 * Math.cos(2 * Math.PI * t / (step * 8)));
    const beatPos = t % (step * 2);
    const kick = Math.sin(2 * Math.PI * (80 - 38 * Math.min(beatPos / .13, 1)) * beatPos) * Math.exp(-beatPos * 23) * .19;
    const val = Math.max(-.9, Math.min(.9, lead + bass + kick));
    pcm[i] = Math.round(val * 32767);
  }
  const buffer = new ArrayBuffer(44 + frames * 2);
  const view = new DataView(buffer);
  const put = (off: number, value: string) => {
    for (let i = 0; i < value.length; i++) view.setUint8(off + i, value.charCodeAt(i));
  };
  put(0, 'RIFF'); view.setUint32(4, 36 + frames * 2, true); put(8, 'WAVE'); put(12, 'fmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, rate, true); view.setUint32(28, rate * 2, true);
  view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  put(36, 'data'); view.setUint32(40, frames * 2, true);
  for (let i = 0; i < frames; i++) view.setInt16(44 + i * 2, pcm[i], true);
  const url = URL.createObjectURL(new Blob([buffer], { type: 'audio/wav' }));
  sounds.set(id, url);
  return url;
}
