import { describe, it, expect, vi } from 'vitest';
import { api } from '../lib/api';
import { widgetService } from './widget';

vi.mock('../lib/api', () => ({
  api: { post: vi.fn().mockResolvedValue({ token: 'qw_x' }), delete: vi.fn().mockResolvedValue({ success: true }) },
}));

describe('widgetService', () => {
  it('issues via POST /widget/token', async () => {
    await expect(widgetService.issueToken()).resolves.toEqual({ token: 'qw_x' });
    expect(api.post).toHaveBeenCalledWith('/widget/token', {});
  });

  it('revokes via DELETE /widget/token', async () => {
    await expect(widgetService.revokeToken()).resolves.toEqual({ success: true });
    expect(api.delete).toHaveBeenCalledWith('/widget/token');
  });
});
