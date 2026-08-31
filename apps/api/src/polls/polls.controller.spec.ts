import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { ParseUUIDPipe } from '@nestjs/common';
import { ROUTE_ARGS_METADATA, GUARDS_METADATA } from '@nestjs/common/constants';
import { PollsController } from './polls.controller';
import { PollsService } from './polls.service';
import { AuthGuard } from '../auth/auth.guard';
import { createTestUser } from '../common/test-utils';

// `@Throttle({ default: { ttl, limit } })` stores its metadata under these two keys —
// `THROTTLER:LIMIT`/`THROTTLER:TTL` concatenated with the options key ('default') — on
// the decorated method. Not part of @nestjs/throttler's public export surface, so the
// literal keys are used directly (confirmed against the installed package's source).
const THROTTLER_LIMIT_DEFAULT = 'THROTTLER:LIMITdefault';
const THROTTLER_TTL_DEFAULT = 'THROTTLER:TTLdefault';

function createTestPoll(overrides: Record<string, unknown> = {}) {
  return {
    id: 'poll-1',
    groupId: 'group-1',
    createdById: 'user-1',
    date: new Date('2026-02-13'),
    slot: null,
    status: 'open',
    createdAt: new Date('2026-01-01'),
    createdBy: createTestUser(),
    responses: [],
    ...overrides,
  };
}

const mockPollsService = {
  create: jest.fn(),
  findAllForGroup: jest.fn(),
  respond: jest.fn(),
  close: jest.fn(),
};

const mockAuthGuard = { canActivate: jest.fn().mockReturnValue(true) };

/**
 * Pipes attached to a `@Param(name, ...pipes)` decorator live in Nest's
 * `ROUTE_ARGS_METADATA`, keyed `${RouteParamtypes.PARAM}:${index}` (PARAM = 5) on the
 * controller class, per method name.
 */
function paramPipesAtIndex(method: string, index: number): unknown[] {
  const meta = Reflect.getMetadata(ROUTE_ARGS_METADATA, PollsController, method) as
    | Record<string, { index: number; pipes: unknown[] }>
    | undefined;
  const entry = Object.values(meta ?? {}).find(
    (candidate) => candidate.index === index && Array.isArray(candidate.pipes),
  );
  return entry?.pipes ?? [];
}

describe('PollsController', () => {
  let controller: PollsController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PollsController],
      providers: [{ provide: PollsService, useValue: mockPollsService }],
    })
      .overrideGuard(AuthGuard)
      .useValue(mockAuthGuard)
      .compile();

    controller = module.get<PollsController>(PollsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('aplica AuthGuard a todas las rutas (nivel de controller)', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, PollsController) as unknown[] | undefined;
    expect(guards).toContain(AuthGuard);
  });

  describe('create', () => {
    it('delega en pollsService.create con groupId, userId y dto', async () => {
      const dto = { date: '2026-02-13' };
      const poll = createTestPoll();
      mockPollsService.create.mockResolvedValue(poll);

      const result = await controller.create('group-1', { id: 'user-1' }, dto);

      expect(result).toEqual(poll);
      expect(mockPollsService.create).toHaveBeenCalledWith('group-1', 'user-1', dto);
      expect(mockPollsService.create).toHaveBeenCalledTimes(1);
    });

    it('pasa la franja opcional al dto', async () => {
      const dto = { date: '2026-02-13', slot: 'Tarde' };
      mockPollsService.create.mockResolvedValue(createTestPoll({ slot: 'Tarde' }));

      await controller.create('group-1', { id: 'user-1' }, dto);

      expect(mockPollsService.create).toHaveBeenCalledWith('group-1', 'user-1', dto);
    });

    it('está limitada a 10 llamadas por minuto', () => {
      expect(Reflect.getMetadata(THROTTLER_LIMIT_DEFAULT, PollsController.prototype.create)).toBe(
        10,
      );
      expect(Reflect.getMetadata(THROTTLER_TTL_DEFAULT, PollsController.prototype.create)).toBe(
        60000,
      );
    });

    it('valida groupId como UUID', () => {
      expect(paramPipesAtIndex('create', 0)).toContain(ParseUUIDPipe);
    });
  });

  describe('findAll', () => {
    it('delega en pollsService.findAllForGroup con groupId y userId', async () => {
      const polls = [createTestPoll(), createTestPoll({ id: 'poll-2' })];
      mockPollsService.findAllForGroup.mockResolvedValue(polls);

      const result = await controller.findAll('group-1', { id: 'user-1' });

      expect(result).toEqual(polls);
      expect(mockPollsService.findAllForGroup).toHaveBeenCalledWith('group-1', 'user-1');
      expect(mockPollsService.findAllForGroup).toHaveBeenCalledTimes(1);
    });

    it('devuelve vacío cuando no hay sondeos', async () => {
      mockPollsService.findAllForGroup.mockResolvedValue([]);

      const result = await controller.findAll('group-1', { id: 'user-1' });

      expect(result).toEqual([]);
    });

    it('valida groupId como UUID', () => {
      expect(paramPipesAtIndex('findAll', 0)).toContain(ParseUUIDPipe);
    });
  });

  describe('respond', () => {
    it('delega en pollsService.respond con groupId, pollId, userId y dto', async () => {
      const dto = { answer: 'yes' as const };
      const poll = createTestPoll({ responses: [{ userId: 'user-1', answer: 'yes' }] });
      mockPollsService.respond.mockResolvedValue(poll);

      const result = await controller.respond('group-1', 'poll-1', { id: 'user-1' }, dto);

      expect(result).toEqual(poll);
      expect(mockPollsService.respond).toHaveBeenCalledWith('group-1', 'poll-1', 'user-1', dto);
      expect(mockPollsService.respond).toHaveBeenCalledTimes(1);
    });

    it('está limitada a 20 llamadas por minuto', () => {
      expect(Reflect.getMetadata(THROTTLER_LIMIT_DEFAULT, PollsController.prototype.respond)).toBe(
        20,
      );
      expect(Reflect.getMetadata(THROTTLER_TTL_DEFAULT, PollsController.prototype.respond)).toBe(
        60000,
      );
    });

    it('valida groupId y pollId como UUID', () => {
      expect(paramPipesAtIndex('respond', 0)).toContain(ParseUUIDPipe);
      expect(paramPipesAtIndex('respond', 1)).toContain(ParseUUIDPipe);
    });
  });

  describe('close', () => {
    it('delega en pollsService.close con groupId, pollId y userId', async () => {
      const poll = createTestPoll({ status: 'closed' });
      mockPollsService.close.mockResolvedValue(poll);

      const result = await controller.close('group-1', 'poll-1', { id: 'user-1' });

      expect(result).toEqual(poll);
      expect(mockPollsService.close).toHaveBeenCalledWith('group-1', 'poll-1', 'user-1');
      expect(mockPollsService.close).toHaveBeenCalledTimes(1);
    });

    // I5: close was the only mutating polls route without @Throttle — matched to
    // create's profile (10/60s): both are low-cardinality, infrequent actions (one
    // creator action per poll), unlike respond's per-member-per-poll cadence (20/60s).
    it('está limitada a 10 llamadas por minuto, igual que create (antes no tenía límite propio)', () => {
      expect(Reflect.getMetadata(THROTTLER_LIMIT_DEFAULT, PollsController.prototype.close)).toBe(
        10,
      );
      expect(Reflect.getMetadata(THROTTLER_TTL_DEFAULT, PollsController.prototype.close)).toBe(
        60000,
      );
    });

    it('valida groupId y pollId como UUID', () => {
      expect(paramPipesAtIndex('close', 0)).toContain(ParseUUIDPipe);
      expect(paramPipesAtIndex('close', 1)).toContain(ParseUUIDPipe);
    });
  });
});
