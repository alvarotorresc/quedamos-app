import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

// This file exercises the REAL framer-motion useReducedMotion() (not the global
// component-testing Proxy mock in src/test/setup.ts), so it can assert the actual
// prefers-reduced-motion wiring. Undo the global mock for this file only.
vi.unmock('framer-motion');

import { spring, useMotionSafe } from './motion';

describe('spring presets', () => {
  it('exposes gentle, snappy, and bouncy spring configs with the exact tuning', () => {
    expect(spring.gentle).toEqual({ type: 'spring', stiffness: 170, damping: 20 });
    expect(spring.snappy).toEqual({ type: 'spring', stiffness: 380, damping: 26 });
    expect(spring.bouncy).toEqual({ type: 'spring', stiffness: 300, damping: 15 });
  });
});

describe('useMotionSafe', () => {
  it('returns false when the device prefers reduced motion', () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockImplementation((query: string) => ({
        matches: true,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    );

    const { result } = renderHook(() => useMotionSafe());

    expect(result.current).toBe(false);
  });
});
