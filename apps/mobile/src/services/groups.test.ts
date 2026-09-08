import { describe, it, expect, vi, beforeEach } from 'vitest';
import { groupsService } from './groups';
import { api } from '../lib/api';

vi.mock('../lib/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('groupsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should get all groups', async () => {
    vi.mocked(api.get).mockResolvedValue([]);
    await groupsService.getAll();
    expect(api.get).toHaveBeenCalledWith('/groups');
  });

  it('should get group by id', async () => {
    vi.mocked(api.get).mockResolvedValue({ id: 'g1' });
    await groupsService.getById('g1');
    expect(api.get).toHaveBeenCalledWith('/groups/g1');
  });

  it('should create group', async () => {
    vi.mocked(api.post).mockResolvedValue({ id: 'g1' });
    await groupsService.create({ name: 'Test', emoji: '👥' });
    expect(api.post).toHaveBeenCalledWith('/groups', { name: 'Test', emoji: '👥' });
  });

  // B3: renombrar el grupo o cambiarle el emoji, cosa de cualquier admin.
  it('should update a group', async () => {
    vi.mocked(api.patch).mockResolvedValue({ id: 'g1' });
    await groupsService.update('g1', { name: 'La cuadrilla', emoji: '🏔️' });
    expect(api.patch).toHaveBeenCalledWith('/groups/g1', {
      name: 'La cuadrilla',
      emoji: '🏔️',
    });
  });

  it('should send only the fields being changed', async () => {
    vi.mocked(api.patch).mockResolvedValue({ id: 'g1' });
    await groupsService.update('g1', { emoji: '🏔️' });
    expect(api.patch).toHaveBeenCalledWith('/groups/g1', { emoji: '🏔️' });
  });

  it('should join group', async () => {
    vi.mocked(api.post).mockResolvedValue({ id: 'g1' });
    await groupsService.join('12345678');
    expect(api.post).toHaveBeenCalledWith('/groups/join', { inviteCode: '12345678' });
  });

  it('should leave group', async () => {
    vi.mocked(api.delete).mockResolvedValue({ success: true });
    await groupsService.leave('g1');
    expect(api.delete).toHaveBeenCalledWith('/groups/g1/leave');
  });

  it('should get invite info', async () => {
    vi.mocked(api.get).mockResolvedValue({ inviteCode: '12345678' });
    await groupsService.getInvite('g1');
    expect(api.get).toHaveBeenCalledWith('/groups/g1/invite');
  });

  it('should refresh invite', async () => {
    vi.mocked(api.post).mockResolvedValue({ inviteCode: '87654321' });
    await groupsService.refreshInvite('g1');
    expect(api.post).toHaveBeenCalledWith('/groups/g1/invite/refresh', {});
  });
});
