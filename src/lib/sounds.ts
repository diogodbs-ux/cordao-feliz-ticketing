// Beeps via Web Audio API — sem assets, sem latência.
let ctx: AudioContext | null = null;
function ac(): AudioContext | null {
  try {
    if (!ctx) ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    return ctx;
  } catch { return null; }
}

function tone(freq: number, durMs: number, type: OscillatorType = 'sine', gain = 0.18, delayMs = 0) {
  const a = ac(); if (!a) return;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type; o.frequency.value = freq;
  o.connect(g); g.connect(a.destination);
  const t0 = a.currentTime + delayMs / 1000;
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + 0.01);
  g.gain.linearRampToValueAtTime(0, t0 + durMs / 1000);
  o.start(t0); o.stop(t0 + durMs / 1000 + 0.02);
}

/** Alerta de superlotação — duplo bip agudo. */
export function beepSuperlotacao() {
  tone(880, 180, 'square', 0.22, 0);
  tone(660, 220, 'square', 0.22, 220);
}

/** Notificação PCD — sequência suave 3 notas. */
export function beepPCD() {
  tone(523, 130, 'sine', 0.18, 0);
  tone(659, 130, 'sine', 0.18, 140);
  tone(784, 220, 'sine', 0.2, 290);
}

/** Confirmação leve. */
export function beepOk() { tone(660, 90, 'sine', 0.14, 0); }
