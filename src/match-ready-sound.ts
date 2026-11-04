// React Bits Sound Lab presets, rendered locally with their default recipes.
import { getMatchReadySound, type MatchReadySound } from './match-ready-sound-preference';
const storageKey = 'rbgs.match-ready.sounds';
const played = new Set<string>();
let context: AudioContext | null = null;
const buffers = new Map<MatchReadySound, Promise<AudioBuffer>>();
let restored = false;

function audioContext(): AudioContext | null {
  try {
    const Audio = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Audio) return null;
    context ??= new Audio({ latencyHint: 'interactive' });
    return context;
  } catch { return null; }
}

function audioBuffer(audio: AudioContext, sound = getMatchReadySound()): Promise<AudioBuffer> {
  let buffer = buffers.get(sound);
  if (!buffer) {
    const version = sound === 'petal' ? '?length=2' : '';
    buffer = fetch(`/media/notification/match-ready-${sound}.wav${version}`, { cache: 'force-cache' }).then(response => {
      if (!response.ok) throw new Error('Match ready sound unavailable');
      return response.arrayBuffer();
    }).then(bytes => audio.decodeAudioData(bytes)).catch(error => {
      buffers.delete(sound);
      throw error;
    });
    buffers.set(sound, buffer);
  }
  return buffer;
}

/** Explicit preview does not consume a proposal's once-only notification. */
export function previewMatchReadySound(sound: MatchReadySound): () => void {
  let cancelled = false;
  let source: AudioBufferSourceNode | undefined;
  const audio = audioContext();
  const expiresAt = Date.now() + 5000;
  if (audio) {
    void Promise.all([audioBuffer(audio, sound), audio.resume()]).then(([decoded]) => {
      if (cancelled || Date.now() >= expiresAt || audio.state !== 'running') return;
      source = audio.createBufferSource();
      source.buffer = decoded;
      source.connect(audio.destination);
      source.onended = () => source?.disconnect();
      source.start();
    }).catch(() => undefined);
  }
  return () => { cancelled = true; source?.stop(); };
}

function restorePlayed() {
  if (restored) return;
  restored = true;
  try {
    const saved: unknown = JSON.parse(sessionStorage.getItem(storageKey) ?? '[]');
    if (Array.isArray(saved)) saved.slice(-40).forEach(key => { if (typeof key === 'string') played.add(key); });
  } catch { /* Audio also works when browser storage is unavailable. */ }
}

/** Unlock during a real interaction, before an asynchronous match notification arrives. */
export function prepareMatchReadySound(): () => void {
  const unlock = () => {
    const audio = audioContext();
    if (!audio) return;
    void audio.resume().catch(() => undefined);
    void audioBuffer(audio).catch(() => undefined);
  };
  window.addEventListener('pointerdown', unlock, true);
  window.addEventListener('keydown', unlock, true);
  return () => {
    window.removeEventListener('pointerdown', unlock, true);
    window.removeEventListener('keydown', unlock, true);
  };
}

/** Cancel pending playback when a proposal closes; never play a late, expired alert. */
export function playMatchReadySound(key: string, expiresAt: number): () => void {
  let cancelled = false;
  restorePlayed();
  const play = async () => {
    if (played.has(key) || Date.now() >= expiresAt) return;
    const audio = audioContext();
    if (!audio) return;
    const decoded = audioBuffer(audio);
    // resume may wait for a gesture under the browser's autoplay policy.
    // Handle both promises immediately so a failed fetch never leaks a rejection.
    const [sound] = await Promise.all([decoded, audio.resume()]);
    if (cancelled || played.has(key) || audio.state !== 'running' || Date.now() >= expiresAt) return;
    const source = audio.createBufferSource();
    source.buffer = sound;
    source.connect(audio.destination);
    source.onended = () => source.disconnect();
    source.start();
    played.add(key);
    if (played.size > 40) played.delete(played.values().next().value!);
    try { sessionStorage.setItem(storageKey, JSON.stringify([...played])); } catch { /* Keep in-memory deduplication. */ }
  };
  void play().catch(() => undefined);
  return () => { cancelled = true; };
}
