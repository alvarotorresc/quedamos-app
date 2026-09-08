import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock supabase before importing api
vi.mock('./supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { access_token: 'test-token' } },
      }),
      refreshSession: vi.fn(),
    },
  },
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

// Import after mocking
const { api, ApiError, setSessionExpiredHandler, resetSessionExpiredNotice } = await import('./api');
const { supabase } = await import('./supabase');

function unauthorized() {
  return {
    ok: false,
    status: 401,
    json: () => Promise.resolve({ message: 'Unauthorized' }),
  };
}

function okResponse(body: unknown = {}) {
  return { ok: true, status: 200, json: () => Promise.resolve(body) };
}

describe('api', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    setSessionExpiredHandler(null);
    resetSessionExpiredNotice();
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: { access_token: 'test-token' } },
    } as unknown as Awaited<ReturnType<typeof supabase.auth.getSession>>);
    vi.mocked(supabase.auth.refreshSession).mockReset();
  });

  it('should make GET request with auth header', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: 'test' }),
    });

    const result = await api.get('/test');

    expect(result).toEqual({ data: 'test' });
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/test'),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer test-token',
        }),
      }),
    );
  });

  it('should make POST request with body', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: '1' }),
    });

    const result = await api.post('/items', { name: 'test' });

    expect(result).toEqual({ id: '1' });
    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ name: 'test' }),
      }),
    );
  });

  it('should make PUT request', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });

    await api.put('/items/1', { name: 'updated' });

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ method: 'PUT' }),
    );
  });

  it('should make DELETE request', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    });

    await api.delete('/items/1');

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('should throw error on non-ok response', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
      json: () => Promise.resolve({ message: 'Not found' }),
    });

    await expect(api.get('/missing')).rejects.toMatchObject({ status: 404 });
    await expect(api.get('/missing')).rejects.toThrow('Not found');
  });

  it('should throw generic error when response body is not JSON', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.reject(new Error('parse error')),
    });

    await expect(api.get('/error')).rejects.toThrow('Error');
  });

  it('should throw ApiError with status code on non-ok response', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 409,
      json: () => Promise.resolve({ message: 'Conflict' }),
    });

    await expect(api.get('/conflict')).rejects.toMatchObject({ status: 409 });
    await expect(api.get('/conflict')).rejects.toBeInstanceOf(ApiError);
  });

  it('should include Content-Type header', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });

    await api.get('/test');

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
        }),
      }),
    );
  });
});

describe('api session expiry', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    setSessionExpiredHandler(null);
    resetSessionExpiredNotice();
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: { access_token: 'test-token' } },
    } as unknown as Awaited<ReturnType<typeof supabase.auth.getSession>>);
    vi.mocked(supabase.auth.refreshSession).mockReset();
  });

  it('refreshes the session once and replays the request when the API answers 401', async () => {
    mockFetch.mockResolvedValueOnce(unauthorized()).mockResolvedValueOnce(okResponse({ ok: true }));
    vi.mocked(supabase.auth.refreshSession).mockResolvedValue({
      data: { session: { access_token: 'fresh-token' } },
      error: null,
    } as unknown as Awaited<ReturnType<typeof supabase.auth.refreshSession>>);
    vi.mocked(supabase.auth.getSession)
      .mockResolvedValueOnce({
        data: { session: { access_token: 'test-token' } },
      } as unknown as Awaited<ReturnType<typeof supabase.auth.getSession>>)
      .mockResolvedValue({
        data: { session: { access_token: 'fresh-token' } },
      } as unknown as Awaited<ReturnType<typeof supabase.auth.getSession>>);
    const onExpired = vi.fn();
    setSessionExpiredHandler(onExpired);

    const result = await api.get('/me');

    expect(result).toEqual({ ok: true });
    expect(supabase.auth.refreshSession).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockFetch.mock.calls[1][1].headers.Authorization).toBe('Bearer fresh-token');
    expect(onExpired).not.toHaveBeenCalled();
  });

  it('signals an expired session and throws when the replay is rejected too', async () => {
    mockFetch.mockResolvedValue(unauthorized());
    vi.mocked(supabase.auth.refreshSession).mockResolvedValue({
      data: { session: { access_token: 'fresh-token' } },
      error: null,
    } as unknown as Awaited<ReturnType<typeof supabase.auth.refreshSession>>);
    const onExpired = vi.fn();
    setSessionExpiredHandler(onExpired);

    await expect(api.get('/me')).rejects.toMatchObject({ status: 401 });

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(onExpired).toHaveBeenCalledTimes(1);
  });

  it('signals an expired session without replaying when the refresh fails', async () => {
    mockFetch.mockResolvedValue(unauthorized());
    vi.mocked(supabase.auth.refreshSession).mockResolvedValue({
      data: { session: null },
      error: new Error('refresh_token_not_found'),
    } as unknown as Awaited<ReturnType<typeof supabase.auth.refreshSession>>);
    const onExpired = vi.fn();
    setSessionExpiredHandler(onExpired);

    await expect(api.get('/me')).rejects.toMatchObject({ status: 401 });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(onExpired).toHaveBeenCalledTimes(1);
  });

  it('shares a single refresh across a burst of 401s', async () => {
    mockFetch.mockResolvedValueOnce(unauthorized()).mockResolvedValueOnce(unauthorized());
    mockFetch.mockResolvedValue(okResponse({ ok: true }));
    let resolveRefresh: (value: unknown) => void = () => {};
    vi.mocked(supabase.auth.refreshSession).mockReturnValue(
      new Promise((resolve) => {
        resolveRefresh = resolve;
      }) as ReturnType<typeof supabase.auth.refreshSession>,
    );

    const both = Promise.all([api.get('/a'), api.get('/b')]);
    await new Promise((resolve) => setTimeout(resolve, 0));
    resolveRefresh({ data: { session: { access_token: 'fresh-token' } }, error: null });
    await both;

    expect(supabase.auth.refreshSession).toHaveBeenCalledTimes(1);
  });

  it('reports an expired session only once until a request succeeds again', async () => {
    mockFetch.mockResolvedValue(unauthorized());
    vi.mocked(supabase.auth.refreshSession).mockResolvedValue({
      data: { session: null },
      error: new Error('refresh_token_not_found'),
    } as unknown as Awaited<ReturnType<typeof supabase.auth.refreshSession>>);
    const onExpired = vi.fn();
    setSessionExpiredHandler(onExpired);

    await expect(api.get('/a')).rejects.toMatchObject({ status: 401 });
    await expect(api.get('/b')).rejects.toMatchObject({ status: 401 });
    expect(onExpired).toHaveBeenCalledTimes(1);

    mockFetch.mockResolvedValue(okResponse({ ok: true }));
    await api.get('/c');

    mockFetch.mockResolvedValue(unauthorized());
    await expect(api.get('/d')).rejects.toMatchObject({ status: 401 });
    expect(onExpired).toHaveBeenCalledTimes(2);
  });

  it('stays quiet on a 401 when there was no session to expire', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: null },
    } as unknown as Awaited<ReturnType<typeof supabase.auth.getSession>>);
    mockFetch.mockResolvedValue(unauthorized());
    const onExpired = vi.fn();
    setSessionExpiredHandler(onExpired);

    await expect(api.get('/public')).rejects.toMatchObject({ status: 401 });

    expect(supabase.auth.refreshSession).not.toHaveBeenCalled();
    expect(onExpired).not.toHaveBeenCalled();
  });
});
