import { describe, it, expect } from 'vitest';
import { floatTo16BitPCM } from '../pcm';

describe('floatTo16BitPCM', () => {
  it('converts float32 [-1,1] to int16 little-endian', () => {
    const out = floatTo16BitPCM(new Float32Array([0, 1, -1]));
    const view = new DataView(out);
    expect(view.getInt16(0, true)).toBe(0);
    expect(view.getInt16(2, true)).toBe(32767);
    expect(view.getInt16(4, true)).toBe(-32768);
  });

  it('clamps values outside [-1,1]', () => {
    const out = floatTo16BitPCM(new Float32Array([2, -2]));
    const view = new DataView(out);
    expect(view.getInt16(0, true)).toBe(32767);
    expect(view.getInt16(2, true)).toBe(-32768);
  });

  it('produces a buffer of 2 bytes per sample', () => {
    const out = floatTo16BitPCM(new Float32Array([0.5, -0.5, 0.25]));
    expect(out.byteLength).toBe(6);
  });
});
