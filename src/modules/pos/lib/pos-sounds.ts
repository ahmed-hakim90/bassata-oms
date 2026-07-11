/**
 * Short POS feedback tones via Web Audio (no asset files).
 * Safe to call from client event handlers; no-ops on SSR / blocked audio.
 */

let sharedCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AudioCtx =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return null;
  if (!sharedCtx) sharedCtx = new AudioCtx();
  if (sharedCtx.state === "suspended") {
    void sharedCtx.resume().catch(() => undefined);
  }
  return sharedCtx;
}

function tone(
  ctx: AudioContext,
  {
    frequency,
    startAt,
    duration,
    type = "sine",
    gain = 0.08,
  }: {
    frequency: number;
    startAt: number;
    duration: number;
    type?: OscillatorType;
    gain?: number;
  }
) {
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  osc.type = type;
  osc.frequency.value = frequency;
  amp.gain.setValueAtTime(0.0001, startAt);
  amp.gain.exponentialRampToValueAtTime(gain, startAt + 0.015);
  amp.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
  osc.connect(amp);
  amp.connect(ctx.destination);
  osc.start(startAt);
  osc.stop(startAt + duration + 0.02);
}

/** Checkout / collect success — two rising chimes. */
export function playPosSuccessSound() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const t0 = ctx.currentTime;
    tone(ctx, { frequency: 880, startAt: t0, duration: 0.1, gain: 0.07 });
    tone(ctx, { frequency: 1320, startAt: t0 + 0.11, duration: 0.14, gain: 0.08 });
  } catch {
    // Ignore autoplay / AudioContext errors
  }
}

/** Checkout / validation failure — short descending buzz. */
export function playPosErrorSound() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const t0 = ctx.currentTime;
    tone(ctx, {
      frequency: 220,
      startAt: t0,
      duration: 0.16,
      type: "square",
      gain: 0.05,
    });
    tone(ctx, {
      frequency: 165,
      startAt: t0 + 0.12,
      duration: 0.18,
      type: "square",
      gain: 0.045,
    });
  } catch {
    // Ignore autoplay / AudioContext errors
  }
}
