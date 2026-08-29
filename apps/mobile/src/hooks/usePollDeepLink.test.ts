import { act, renderHook } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { usePollDeepLink } from './usePollDeepLink';

function setUrl(pathAndQuery: string) {
  window.history.replaceState(null, '', pathAndQuery);
}

describe('usePollDeepLink', () => {
  beforeEach(() => {
    setUrl('/tabs/calendar');
  });

  it('lee pollId y answer de la URL al montar', () => {
    setUrl('/tabs/calendar?pollId=00000000-0000-0000-0000-000000000001&answer=yes');

    const { result } = renderHook(() => usePollDeepLink());

    expect(result.current.focusPollId).toBe('00000000-0000-0000-0000-000000000001');
    expect(result.current.presetAnswer).toBe('yes');
  });

  it('sin pollId ni answer en la URL devuelve ambos a null', () => {
    setUrl('/tabs/calendar');

    const { result } = renderHook(() => usePollDeepLink());

    expect(result.current.focusPollId).toBeNull();
    expect(result.current.presetAnswer).toBeNull();
  });

  it('con pollId pero sin answer, presetAnswer queda en null', () => {
    setUrl('/tabs/calendar?pollId=00000000-0000-0000-0000-000000000002');

    const { result } = renderHook(() => usePollDeepLink());

    expect(result.current.focusPollId).toBe('00000000-0000-0000-0000-000000000002');
    expect(result.current.presetAnswer).toBeNull();
  });

  it('un valor de answer distinto de yes/no se ignora sin auto-envío', () => {
    setUrl('/tabs/calendar?pollId=00000000-0000-0000-0000-000000000003&answer=maybe');

    const { result } = renderHook(() => usePollDeepLink());

    expect(result.current.focusPollId).toBe('00000000-0000-0000-0000-000000000003');
    expect(result.current.presetAnswer).toBeNull();
  });

  it('clear() limpia el estado y quita pollId/answer de la URL, preservando otros params', () => {
    setUrl('/tabs/calendar?foo=bar&pollId=00000000-0000-0000-0000-000000000004&answer=no');

    const { result } = renderHook(() => usePollDeepLink());
    expect(result.current.focusPollId).toBe('00000000-0000-0000-0000-000000000004');

    act(() => {
      result.current.clear();
    });

    expect(result.current.focusPollId).toBeNull();
    expect(result.current.presetAnswer).toBeNull();
    expect(window.location.pathname).toBe('/tabs/calendar');
    const params = new URLSearchParams(window.location.search);
    expect(params.get('pollId')).toBeNull();
    expect(params.get('answer')).toBeNull();
    expect(params.get('foo')).toBe('bar');
  });

  it('clear() sin params previos no rompe nada', () => {
    setUrl('/tabs/calendar');
    const { result } = renderHook(() => usePollDeepLink());

    expect(() => {
      act(() => {
        result.current.clear();
      });
    }).not.toThrow();

    expect(window.location.pathname).toBe('/tabs/calendar');
  });
});
