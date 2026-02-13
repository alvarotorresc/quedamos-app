import { describe, it, expect, vi, beforeEach } from 'vitest';
import { eventsService } from './events';
import { api } from '../lib/api';

vi.mock('../lib/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

describe('eventsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should get all events for group', async () => {
    vi.mocked(api.get).mockResolvedValue([]);
    await eventsService.getAll('g1');
    expect(api.get).toHaveBeenCalledWith('/groups/g1/events');
  });

  it('should get event by id', async () => {
    vi.mocked(api.get).mockResolvedValue({ id: 'e1' });
    await eventsService.getById('g1', 'e1');
    expect(api.get).toHaveBeenCalledWith('/groups/g1/events/e1');
  });

  it('should create event', async () => {
    vi.mocked(api.post).mockResolvedValue({ id: 'e1' });
    await eventsService.create('g1', { title: 'Test', date: '2026-03-01' });
    expect(api.post).toHaveBeenCalledWith('/groups/g1/events', { title: 'Test', date: '2026-03-01' });
  });

  it('should respond to event', async () => {
    vi.mocked(api.post).mockResolvedValue({});
    await eventsService.respond('g1', 'e1', 'confirmed');
    expect(api.post).toHaveBeenCalledWith('/groups/g1/events/e1/respond', { status: 'confirmed' });
  });

  it('should respond with declined', async () => {
    vi.mocked(api.post).mockResolvedValue({});
    await eventsService.respond('g1', 'e1', 'declined');
    expect(api.post).toHaveBeenCalledWith('/groups/g1/events/e1/respond', { status: 'declined' });
  });
});
