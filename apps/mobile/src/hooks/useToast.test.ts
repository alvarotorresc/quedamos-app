import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

const present = vi.fn();
vi.mock('@ionic/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@ionic/react')>();
  return { ...actual, useIonToast: () => [present, vi.fn()] };
});

import { useToast } from './useToast';

describe('useToast', () => {
  it('presents a danger toast with the translated message key', () => {
    const { result } = renderHook(() => useToast());

    result.current.showError('errors.createEventFailed');

    expect(present).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'errors.createEventFailed', // global i18n mock: t(key) => key
        color: 'danger',
        duration: 3000,
        position: 'top',
      }),
    );
  });

  it('presenta un toast success con la clave traducida', () => {
    const { result } = renderHook(() => useToast());

    result.current.showSuccess('mazo.answered');

    expect(present).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'mazo.answered', // global i18n mock: t(key) => key
        color: 'success',
        duration: 3000,
        position: 'top',
      }),
    );
  });
});
