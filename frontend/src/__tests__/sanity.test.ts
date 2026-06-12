import { describe, it, expect } from 'vitest';

describe('test harness', () => {
  it('runs a trivial assertion', () => {
    expect(1 + 1).toBe(2);
  });
});
