import { describe, it, expect, vi, beforeEach } from 'vitest';
import { api } from '../lib/api';
import { inboxService } from './inbox';

vi.mock('../lib/api', () => ({
  api: { get: vi.fn().mockResolvedValue({}), post: vi.fn().mockResolvedValue({}) },
}));

describe('inboxService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lists without query params when nothing is asked for', async () => {
    await inboxService.list();

    expect(api.get).toHaveBeenCalledWith('/notifications');
  });

  it('carries the page size and the cursor', async () => {
    await inboxService.list({ limit: 10, cursor: 'n1' });

    expect(api.get).toHaveBeenCalledWith('/notifications?limit=10&cursor=n1');
  });

  it('escapes a cursor that is not URL-safe', async () => {
    await inboxService.list({ cursor: 'a b&c' });

    expect(api.get).toHaveBeenCalledWith('/notifications?cursor=a+b%26c');
  });

  it('marks everything read', async () => {
    await inboxService.readAll();

    expect(api.post).toHaveBeenCalledWith('/notifications/read-all', {});
  });

  it('marks one notice read', async () => {
    await inboxService.read('n1');

    expect(api.post).toHaveBeenCalledWith('/notifications/n1/read', {});
  });

  it('escapes the id of a single read', async () => {
    await inboxService.read('a/b');

    expect(api.post).toHaveBeenCalledWith('/notifications/a%2Fb/read', {});
  });
});
