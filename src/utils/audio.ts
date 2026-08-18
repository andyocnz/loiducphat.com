// Web Audio API Synthesizer for Zen Singing Bowl / Bell sound

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    audioCtx = new AudioContextClass();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

/**
 * Plays a serene Tibetan Singing Bowl / Zen Bell sound
 * @param frequency Base frequency in Hz (e.g. 261.63 Hz for C4, 432 Hz for healing tone)
 */
export function playSingingBowl(frequency = 432) {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    // Primary bell oscillator
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const osc3 = ctx.createOscillator();

    const gain1 = ctx.createGain();
    const gain2 = ctx.createGain();
    const gain3 = ctx.createGain();
    const masterGain = ctx.createGain();

    // Harmonics for rich bowl overtone
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(frequency, now);

    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(frequency * 2.76, now); // Overtone multiplier

    osc3.type = 'sine';
    osc3.frequency.setValueAtTime(frequency * 5.4, now); // High overtone shimmer

    // Envelopes: soft attack, long serene decay
    const duration = 4.5;

    gain1.gain.setValueAtTime(0.001, now);
    gain1.gain.exponentialRampToValueAtTime(0.4, now + 0.08);
    gain1.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    gain2.gain.setValueAtTime(0.001, now);
    gain2.gain.exponentialRampToValueAtTime(0.15, now + 0.05);
    gain2.gain.exponentialRampToValueAtTime(0.0001, now + duration * 0.7);

    gain3.gain.setValueAtTime(0.001, now);
    gain3.gain.exponentialRampToValueAtTime(0.05, now + 0.03);
    gain3.gain.exponentialRampToValueAtTime(0.0001, now + duration * 0.4);

    masterGain.gain.setValueAtTime(0.7, now);

    // Connect nodes
    osc1.connect(gain1);
    osc2.connect(gain2);
    osc3.connect(gain3);

    gain1.connect(masterGain);
    gain2.connect(masterGain);
    gain3.connect(masterGain);

    masterGain.connect(ctx.destination);

    // Start & Stop
    osc1.start(now);
    osc2.start(now);
    osc3.start(now);

    osc1.stop(now + duration);
    osc2.stop(now + duration);
    osc3.stop(now + duration);
  } catch (err) {
    console.warn('Audio play error:', err);
  }
}
