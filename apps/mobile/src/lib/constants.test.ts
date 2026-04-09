import { describe, it, expect } from 'vitest';
import {
  getMemberColorByUserId,
  getMemberGradientByUserId,
  getMemberGlowByUserId,
  MEMBER_COLORS,
  MEMBER_GRADIENTS,
  MEMBER_GLOWS,
} from './constants';

describe('getMemberColorByUserId', () => {
  it('returns a color from the MEMBER_COLORS palette', () => {
    const color = getMemberColorByUserId('user-abc-123');
    expect(MEMBER_COLORS).toContain(color);
  });

  it('returns the same color for the same userId', () => {
    const color1 = getMemberColorByUserId('user-xyz-789');
    const color2 = getMemberColorByUserId('user-xyz-789');
    expect(color1).toBe(color2);
  });

  it('is stable regardless of call order', () => {
    const colorA1 = getMemberColorByUserId('user-a');
    const colorB = getMemberColorByUserId('user-b');
    const colorA2 = getMemberColorByUserId('user-a');
    expect(colorA1).toBe(colorA2);
    // colorB is just used to interleave calls
    expect(MEMBER_COLORS).toContain(colorB);
  });

  it('distributes across multiple colors for different userIds', () => {
    const ids = ['id-1', 'id-2', 'id-3', 'id-4', 'id-5', 'id-6', 'id-7', 'id-8', 'id-9', 'id-10'];
    const colors = new Set(ids.map(getMemberColorByUserId));
    // With 10 different IDs and 6 colors, we expect at least 3 different colors
    expect(colors.size).toBeGreaterThanOrEqual(3);
  });
});

describe('getMemberGradientByUserId', () => {
  it('returns a gradient from the MEMBER_GRADIENTS palette', () => {
    const gradient = getMemberGradientByUserId('user-abc-123');
    expect(MEMBER_GRADIENTS).toContain(gradient);
  });

  it('returns the same gradient for the same userId', () => {
    expect(getMemberGradientByUserId('user-x')).toBe(getMemberGradientByUserId('user-x'));
  });
});

describe('getMemberGlowByUserId', () => {
  it('returns a glow from the MEMBER_GLOWS palette', () => {
    const glow = getMemberGlowByUserId('user-abc-123');
    expect(MEMBER_GLOWS).toContain(glow);
  });

  it('returns the same glow for the same userId', () => {
    expect(getMemberGlowByUserId('user-x')).toBe(getMemberGlowByUserId('user-x'));
  });
});
