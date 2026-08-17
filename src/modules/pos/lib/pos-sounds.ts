/**
 * Short POS feedback tones via Web Audio (no asset files).
 * Safe to call from client event handlers; no-ops on SSR / blocked audio.
 */

let sharedCtx: AudioContext | null = null;
let listenersBound = false;
let busyUntil = 0;

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

/** Bind a first-gesture unlock so Safari/Chrome actually play later tones. */
export function unlockPosAudio() {
  if (typeof window === "undefined") return;
  const ctx = getAudioContext();
  if (ctx?.state === "suspended") {
    void ctx.resume().catch(() => undefined);
  }
  if (listenersBound) return;
  listenersBound = true;
  const warm = () => {
    const audio = getAudioContext();
    if (audio?.state === "suspended") {
      void audio.resume().catch(() => undefined);
    }
  };
  window.addEventListener("pointerdown", warm, { capture: true });
  window.addEventListener("keydown", warm, { capture: true });
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
  amp.gain.exponentialRampToValueAtTime(gain, startAt + 0.012);
  amp.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
  osc.connect(amp);
  amp.connect(ctx.destination);
  osc.start(startAt);
  osc.stop(startAt + duration + 0.02);
}

function play(
  schedule: (ctx: AudioContext, t0: number) => number,
  { force = false }: { force?: boolean } = {}
) {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    if (!force && ctx.currentTime < busyUntil) return;
    const t0 = ctx.currentTime;
    const duration = schedule(ctx, t0);
    busyUntil = Math.max(busyUntil, t0 + duration);
  } catch {
    // Ignore autoplay / AudioContext errors
  }
}

/** Barcode / scan hit — short click, distinct from checkout success. */
export function playPosScanSound() {
  play((ctx, t0) => {
    tone(ctx, { frequency: 1200, startAt: t0, duration: 0.055, gain: 0.06 });
    return 0.07;
  });
}

/** Checkout / collect success — two rising chimes. */
export function playPosSuccessSound() {
  play((ctx, t0) => {
    tone(ctx, { frequency: 880, startAt: t0, duration: 0.1, gain: 0.07 });
    tone(ctx, { frequency: 1320, startAt: t0 + 0.11, duration: 0.14, gain: 0.08 });
    return 0.27;
  });
}

/** Checkout / validation failure — short descending buzz. */
export function playPosErrorSound() {
  play((ctx, t0) => {
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
    return 0.32;
  });
}

/** New kitchen / online order — three-note alert, can interrupt quieter tones. */
export function playPosNewOrderSound() {
  play(
    (ctx, t0) => {
      tone(ctx, { frequency: 660, startAt: t0, duration: 0.12, gain: 0.08 });
      tone(ctx, { frequency: 880, startAt: t0 + 0.14, duration: 0.12, gain: 0.085 });
      tone(ctx, { frequency: 1174, startAt: t0 + 0.28, duration: 0.18, gain: 0.09 });
      return 0.5;
    },
    { force: true }
  );
}
