import { describe, it, expect, vi, beforeEach } from 'vitest';
import { accountService } from './account';
import { api } from '../lib/api';

vi.mock('../lib/api', () => ({
  api: {
    get: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('accountService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deleteAccount calls DELETE /auth/me', async () => {
    const result = { success: true, groupsDeleted: 1, groupsTransferred: 0 };
    vi.mocked(api.delete).mockResolvedValue(result);

    await expect(accountService.deleteAccount()).resolves.toEqual(result);
    expect(api.delete).toHaveBeenCalledWith('/auth/me');
  });

  it('exportData calls GET /auth/me/export', async () => {
    const dump = { profile: { id: 'user-1' } };
    vi.mocked(api.get).mockResolvedValue(dump);

    await expect(accountService.exportData()).resolves.toEqual(dump);
    expect(api.get).toHaveBeenCalledWith('/auth/me/export');
  });
});
