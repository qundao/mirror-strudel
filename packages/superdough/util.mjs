import { logger } from './logger.mjs';

// currently duplicate with core util.mjs to skip dependency
// TODO: add separate util module?

export const LN2 = Math.LN2;

export const tokenizeNote = (note) => {
  if (typeof note !== 'string') {
    return [];
  }
  const [pc, acc = '', oct] = note.match(/^([a-gA-G])([#bsf]*)(-?[0-9]*)$/)?.slice(1) || [];
  if (!pc) {
    return [];
  }
  return [pc, acc, oct ? Number(oct) : undefined];
};
const chromas = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };
const accs = { '#': 1, b: -1, s: 1, f: -1 };

export const getAccidentalsOffset = (accidentals) => {
  return accidentals?.split('').reduce((o, char) => o + accs[char], 0) || 0;
};

export const noteToMidi = (note, defaultOctave = 3) => {
  const [pc, acc, oct = defaultOctave] = tokenizeNote(note);
  if (!pc) {
    throw new Error('not a note: "' + note + '"');
  }
  const chroma = chromas[pc.toLowerCase()];
  const offset = getAccidentalsOffset(acc);
  return (Number(oct) + 1) * 12 + chroma + offset;
};
export const midiToFreq = (n) => {
  return Math.pow(2, (n - 69) / 12) * 440;
};

export const freqToMidi = (freq) => {
  return (12 * Math.log(freq / 440)) / LN2 + 69;
};

export const valueToMidi = (value, fallbackValue) => {
  if (typeof value !== 'object') {
    throw new Error('valueToMidi: expected object value');
  }
  let { freq, note } = value;
  if (typeof freq === 'number') {
    return freqToMidi(freq);
  }
  if (typeof note === 'string') {
    return noteToMidi(note);
  }
  if (typeof note === 'number') {
    return note;
  }
  if (!fallbackValue) {
    throw new Error('valueToMidi: expected freq or note to be set');
  }
  return fallbackValue;
};

export function nanFallback(value, fallback = 0, silent) {
  if (isNaN(Number(value))) {
    !silent && logger(`"${value}" is not a number, falling back to ${fallback}`, 'warning');
    return fallback;
  }
  return value;
}
// modulo that works with negative numbers e.g. _mod(-1, 3) = 2. Works on numbers (rather than patterns of numbers, as @mod@ from pattern.mjs does)
export const _mod = (n, m) => ((n % m) + m) % m;

// round to nearest int, negative numbers will output a subtracted index
export const getSoundIndex = (n, numSounds) => {
  return _mod(Math.round(nanFallback(n, 0)), numSounds);
};

export function cycleToSeconds(cycle, cps) {
  return cycle / cps;
}

export function secondsToCycle(t, cps) {
  return t * cps;
}

// deduces relevant info for sample loading from hap.value and sample definition
// it encapsulates the core sampler logic into a pure and synchronous function
// hapValue: Hap.value, bank: sample bank definition for sound "s" (values in strudel.json format)
export function getCommonSampleInfo(hapValue, bank) {
  const { s, n = 0 } = hapValue;
  let midi = valueToMidi(hapValue, 36);
  let transpose = midi - 36; // C3 is middle C;
  let url;
  let index = 0;
  if (Array.isArray(bank)) {
    index = getSoundIndex(n, bank.length);
    url = bank[index];
  } else {
    const midiDiff = (noteA) => noteToMidi(noteA) - midi;
    // object format will expect keys as notes
    const closest = Object.keys(bank)
      .filter((k) => !k.startsWith('_'))
      .reduce(
        (closest, key, j) => (!closest || Math.abs(midiDiff(key)) < Math.abs(midiDiff(closest)) ? key : closest),
        null,
      );
    transpose = -midiDiff(closest); // semitones to repitch
    index = getSoundIndex(n, bank[closest].length);
    url = bank[closest][index];
  }
  const label = `${s}:${index}`;
  return { transpose, url, index, midi, label };
}

/** Selects entries from `source` and renames them via `map` */
export const pickAndRename = (source, map) => {
  return Object.fromEntries(Object.entries(map).map(([newKey, oldKey]) => [newKey, source[oldKey]]));
};

// Optimized / numerical functions (ideal for hot dsp loops)

// Optimized clamp (~1.7x faster than Math.max/min approach)
export const clamp = (num, min, max) => {
  if (num < min) return min;
  if (num > max) return max;
  return num;
};
export const mod = (n, m) => ((n % m) + m) % m;
export const lerp = (a, b, n) => n * (b - a) + a;
export const frac = (x) => x - Math.floor(x);

// Fast integer ops for non-negative values
export const ffloor = (x) => x | 0;
export const fround = (x) => ffloor(x + 0.5);
export const fceil = (x) => ffloor(x + 1);
export const ffrac = (x) => x - ffloor(x);

export const fastexpm1 = (x) => x * (1 + x + 0.5 * x * x); // Taylor approximation

export const fastpow2 = (x) => {
  // Taylor approximation of 2 ^ x
  const a = x * LN2;
  return 1 + a * (1 + a * (0.5 + a / 6));
};

export const applySemitoneDetuneToFrequency = (frequency, detune) => {
  return frequency * Math.pow(2, detune / 12);
};

export const applyFastDetune = (frequency, detune) => {
  if (detune < 4) return frequency * fastpow2(detune / 12);
  return applySemitoneDetuneToFrequency(frequency, detune);
};
