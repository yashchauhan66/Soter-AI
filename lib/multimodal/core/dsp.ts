/**
 * Minimal signal analysis for uncompressed audio.
 *
 * This exists for one finding: energy in a band humans cannot hear. Inaudible
 * carriers are how an audio file gives a voice agent an instruction its owner
 * never hears, and the only honest way to report it is to measure the spectrum
 * rather than guess from a file size.
 *
 * A real FFT is used because the alternative — inferring "high frequency content"
 * from a difference filter — cannot name a band, and a finding that cannot name
 * its band is not evidence. Compressed formats are never guessed at: without a
 * codec the waveform is unavailable, and the scan says so.
 */

export interface PcmFormat {
  channels: number;
  sampleRate: number;
  bitsPerSample: number;
  /** True for IEEE float samples (WAV format tag 3), false for signed integer PCM. */
  float: boolean;
}

export interface BandEnergyResult {
  /** Share (0-1) of spectral energy above `cutoffHz`. */
  highBandShare: number;
  /** Share (0-1) of spectral energy in the speech band, for contrast. */
  speechBandShare: number;
  /** How many analysis windows contributed. Zero means no measurement was made. */
  windows: number;
  sampleRate: number;
  cutoffHz: number;
}

const WINDOW_SIZE = 2048;
const MAX_WINDOWS = 12;

/**
 * Decode interleaved PCM to a mono Float32Array in -1..1, taking at most
 * `maxSamples` frames. Only the sample formats that appear in WAV and AIFF files
 * are handled; anything else returns null so the caller can disclose the gap.
 */
export function decodePcmMono(
  bytes: Uint8Array,
  format: PcmFormat,
  maxSamples = WINDOW_SIZE * MAX_WINDOWS * 4,
  bigEndian = false,
): Float32Array | null {
  const { channels, bitsPerSample, float } = format;
  if (channels <= 0 || channels > 32) return null;
  const bytesPerSample = bitsPerSample / 8;
  if (!Number.isInteger(bytesPerSample) || bytesPerSample < 1 || bytesPerSample > 4) return null;
  if (float && bitsPerSample !== 32) return null;

  const frameBytes = bytesPerSample * channels;
  const frames = Math.min(Math.floor(bytes.length / frameBytes), maxSamples);
  if (frames < WINDOW_SIZE) return null;

  const out = new Float32Array(frames);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const little = !bigEndian;
  for (let frame = 0; frame < frames; frame += 1) {
    let sum = 0;
    for (let channel = 0; channel < channels; channel += 1) {
      const at = frame * frameBytes + channel * bytesPerSample;
      sum += readSample(view, at, bitsPerSample, float, little);
    }
    out[frame] = sum / channels;
  }
  return out;
}

function readSample(view: DataView, at: number, bits: number, float: boolean, little: boolean): number {
  if (float) return view.getFloat32(at, little);
  if (bits === 8) return (view.getUint8(at) - 128) / 128;
  if (bits === 16) return view.getInt16(at, little) / 32768;
  if (bits === 24) {
    const b0 = view.getUint8(at);
    const b1 = view.getUint8(at + 1);
    const b2 = view.getUint8(at + 2);
    const raw = little ? (b2 << 16) | (b1 << 8) | b0 : (b0 << 16) | (b1 << 8) | b2;
    const signed = raw >= 0x800000 ? raw - 0x1000000 : raw;
    return signed / 8388608;
  }
  if (bits === 32) return view.getInt32(at, little) / 2147483648;
  return 0;
}

/**
 * Share of spectral energy above `cutoffHz`, averaged over windows spread across
 * the signal. Windows are spread rather than taken from the head so a payload
 * placed late in the file is still sampled.
 */
export function measureBandEnergy(samples: Float32Array, sampleRate: number, cutoffHz = 17_500): BandEnergyResult {
  const result: BandEnergyResult = {
    highBandShare: 0,
    speechBandShare: 0,
    windows: 0,
    sampleRate,
    cutoffHz,
  };
  // Above Nyquist there is no band to measure, so no claim is made.
  if (sampleRate <= cutoffHz * 2 || samples.length < WINDOW_SIZE) return result;

  const usable = Math.floor(samples.length / WINDOW_SIZE);
  const windows = Math.min(usable, MAX_WINDOWS);
  const stride = Math.max(1, Math.floor(usable / windows));
  const binWidth = sampleRate / WINDOW_SIZE;
  const cutoffBin = Math.ceil(cutoffHz / binWidth);
  const speechLow = Math.floor(300 / binWidth);
  const speechHigh = Math.ceil(3400 / binWidth);

  let highTotal = 0;
  let speechTotal = 0;
  let allTotal = 0;
  const real = new Float64Array(WINDOW_SIZE);
  const imag = new Float64Array(WINDOW_SIZE);

  for (let w = 0; w < windows; w += 1) {
    const start = w * stride * WINDOW_SIZE;
    if (start + WINDOW_SIZE > samples.length) break;
    for (let i = 0; i < WINDOW_SIZE; i += 1) {
      // Hann window: without it, the rectangular window's spectral leakage puts
      // energy in the high band that is an artefact of the cut, not of the audio.
      const hann = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (WINDOW_SIZE - 1));
      real[i] = samples[start + i] * hann;
      imag[i] = 0;
    }
    fftInPlace(real, imag);
    for (let bin = 1; bin < WINDOW_SIZE / 2; bin += 1) {
      const power = real[bin] * real[bin] + imag[bin] * imag[bin];
      allTotal += power;
      if (bin >= cutoffBin) highTotal += power;
      if (bin >= speechLow && bin <= speechHigh) speechTotal += power;
    }
    result.windows += 1;
  }

  if (allTotal > 0) {
    result.highBandShare = highTotal / allTotal;
    result.speechBandShare = speechTotal / allTotal;
  }
  return result;
}

/** In-place iterative radix-2 FFT. `real.length` must be a power of two. */
function fftInPlace(real: Float64Array, imag: Float64Array): void {
  const n = real.length;
  for (let i = 1, j = 0; i < n; i += 1) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      const tr = real[i];
      real[i] = real[j];
      real[j] = tr;
      const ti = imag[i];
      imag[i] = imag[j];
      imag[j] = ti;
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const angle = (-2 * Math.PI) / len;
    const wr = Math.cos(angle);
    const wi = Math.sin(angle);
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < len / 2; k += 1) {
        const ar = real[i + k];
        const ai = imag[i + k];
        const br = real[i + k + len / 2] * cr - imag[i + k + len / 2] * ci;
        const bi = real[i + k + len / 2] * ci + imag[i + k + len / 2] * cr;
        real[i + k] = ar + br;
        imag[i + k] = ai + bi;
        real[i + k + len / 2] = ar - br;
        imag[i + k + len / 2] = ai - bi;
        const nextCr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = nextCr;
      }
    }
  }
}

/** IEEE 754 80-bit extended float, the sample rate format AIFF uses. */
export function readExtendedFloat80(bytes: Uint8Array, offset: number): number | null {
  if (offset + 10 > bytes.length) return null;
  const signAndExponent = (bytes[offset] << 8) | bytes[offset + 1];
  const sign = signAndExponent & 0x8000 ? -1 : 1;
  const exponent = signAndExponent & 0x7fff;
  let mantissa = 0;
  for (let i = 0; i < 8; i += 1) mantissa = mantissa * 256 + bytes[offset + 2 + i];
  if (exponent === 0 && mantissa === 0) return 0;
  if (exponent === 0x7fff) return null;
  return sign * mantissa * 2 ** (exponent - 16383 - 63);
}
