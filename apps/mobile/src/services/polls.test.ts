import { describe, it, expect, vi, beforeEach } from 'vitest';
import { pollsService } from './polls';
import { api } from '../lib/api';

vi.mock('../lib/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

describe('pollsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should list the polls of a group', async () => {
    vi.mocked(api.get).mockResolvedValue([]);
    await pollsService.list('g1');
    expect(api.get).toHaveBeenCalledWith('/groups/g1/polls');
  });

  it('should create a poll for a whole day', async () => {
    vi.mocked(api.post).mockResolvedValue({ id: 'p1' });
    await pollsService.create('g1', { date: '2026-09-05' });
    expect(api.post).toHaveBeenCalledWith('/groups/g1/polls', { date: '2026-09-05' });
  });

  it('should answer a poll', async () => {
    vi.mocked(api.post).mockResolvedValue({ id: 'p1' });
    await pollsService.respond('g1', 'p1', 'yes');
    expect(api.post).toHaveBeenCalledWith('/groups/g1/polls/p1/respond', { answer: 'yes' });
  });

  // B4: la ruta ya existía en la API pero la app no la llamaba desde ningún sitio.
  it('should close a poll', async () => {
    vi.mocked(api.post).mockResolvedValue({ id: 'p1', status: 'closed' });
    await pollsService.close('g1', 'p1');
    expect(api.post).toHaveBeenCalledWith('/groups/g1/polls/p1/close', {});
  });
});
