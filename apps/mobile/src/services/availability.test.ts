import { describe, it, expect, vi, beforeEach } from 'vitest';
import { availabilityService } from './availability';
import { api } from '../lib/api';

vi.mock('../lib/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('availabilityService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should get all availability for group', async () => {
    vi.mocked(api.get).mockResolvedValue([]);
    await availabilityService.getAll('g1');
    expect(api.get).toHaveBeenCalledWith('/groups/g1/availability');
  });

  it('should get my availability', async () => {
    vi.mocked(api.get).mockResolvedValue([]);
    await availabilityService.getMine('g1');
    expect(api.get).toHaveBeenCalledWith('/groups/g1/availability/me');
  });

  it('should create availability', async () => {
    vi.mocked(api.post).mockResolvedValue({});
    await availabilityService.create('g1', { date: '2026-03-01', type: 'day' });
    expect(api.post).toHaveBeenCalledWith('/groups/g1/availability', {
      date: '2026-03-01',
      type: 'day',
    });
  });

  it('should update availability', async () => {
    vi.mocked(api.put).mockResolvedValue({});
    await availabilityService.update('g1', '2026-03-01', { date: '2026-03-01', type: 'slots', slots: ['Mañana'] });
    expect(api.put).toHaveBeenCalledWith('/groups/g1/availability/2026-03-01', expect.any(Object));
  });

  it('should delete availability', async () => {
    vi.mocked(api.delete).mockResolvedValue({ success: true });
    await availabilityService.delete('g1', '2026-03-01');
    expect(api.delete).toHaveBeenCalledWith('/groups/g1/availability/2026-03-01');
  });
});
