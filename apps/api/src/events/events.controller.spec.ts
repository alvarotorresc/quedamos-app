import { Test, TestingModule } from '@nestjs/testing';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';
import { AuthGuard } from '../auth/auth.guard';
import { createTestEvent, createTestUser } from '../common/test-utils';

const mockEventsService = {
  findAllForGroup: jest.fn(),
  findById: jest.fn(),
  create: jest.fn(),
  respond: jest.fn(),
};

const mockAuthGuard = { canActivate: jest.fn().mockReturnValue(true) };

describe('EventsController', () => {
  let controller: EventsController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [EventsController],
      providers: [{ provide: EventsService, useValue: mockEventsService }],
    })
      .overrideGuard(AuthGuard)
      .useValue(mockAuthGuard)
      .compile();

    controller = module.get<EventsController>(EventsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    it('should call eventsService.findAllForGroup with groupId and userId', async () => {
      const events = [
        { ...createTestEvent(), createdBy: createTestUser(), attendees: [] },
        { ...createTestEvent({ id: 'event-2', title: 'Event 2' }), createdBy: createTestUser(), attendees: [] },
      ];
      mockEventsService.findAllForGroup.mockResolvedValue(events);

      const result = await controller.findAll('group-1', { id: 'user-1' });

      expect(result).toEqual(events);
      expect(mockEventsService.findAllForGroup).toHaveBeenCalledWith('group-1', 'user-1');
      expect(mockEventsService.findAllForGroup).toHaveBeenCalledTimes(1);
    });

    it('should return empty array when no events exist', async () => {
      mockEventsService.findAllForGroup.mockResolvedValue([]);

      const result = await controller.findAll('group-1', { id: 'user-1' });

      expect(result).toEqual([]);
    });
  });

  describe('findOne', () => {
    it('should call eventsService.findById with groupId, eventId, and userId', async () => {
      const event = { ...createTestEvent(), createdBy: createTestUser(), attendees: [] };
      mockEventsService.findById.mockResolvedValue(event);

      const result = await controller.findOne('group-1', 'event-1', { id: 'user-1' });

      expect(result).toEqual(event);
      expect(mockEventsService.findById).toHaveBeenCalledWith('group-1', 'event-1', 'user-1');
      expect(mockEventsService.findById).toHaveBeenCalledTimes(1);
    });
  });

  describe('create', () => {
    it('should call eventsService.create with groupId, userId, and dto', async () => {
      const dto = { title: 'Beach Day', date: '2026-07-15', time: '10:00' };
      const created = {
        ...createTestEvent({ title: 'Beach Day' }),
        createdBy: createTestUser(),
        attendees: [],
      };
      mockEventsService.create.mockResolvedValue(created);

      const result = await controller.create('group-1', { id: 'user-1' }, dto);

      expect(result).toEqual(created);
      expect(mockEventsService.create).toHaveBeenCalledWith('group-1', 'user-1', dto);
      expect(mockEventsService.create).toHaveBeenCalledTimes(1);
    });

    it('should pass dto with optional fields to service', async () => {
      const dto = {
        title: 'Dinner',
        date: '2026-07-20',
        description: 'Group dinner downtown',
        location: 'Restaurant ABC',
        time: '20:00',
      };
      mockEventsService.create.mockResolvedValue(createTestEvent());

      await controller.create('group-1', { id: 'user-1' }, dto);

      expect(mockEventsService.create).toHaveBeenCalledWith('group-1', 'user-1', dto);
    });
  });

  describe('respond', () => {
    it('should call eventsService.respond with groupId, eventId, userId, and dto', async () => {
      const dto = { status: 'confirmed' as const };
      const event = { ...createTestEvent(), createdBy: createTestUser(), attendees: [] };
      mockEventsService.respond.mockResolvedValue(event);

      const result = await controller.respond('group-1', 'event-1', { id: 'user-1' }, dto);

      expect(result).toEqual(event);
      expect(mockEventsService.respond).toHaveBeenCalledWith('group-1', 'event-1', 'user-1', dto);
      expect(mockEventsService.respond).toHaveBeenCalledTimes(1);
    });

    it('should pass declined status to service', async () => {
      const dto = { status: 'declined' as const };
      mockEventsService.respond.mockResolvedValue(createTestEvent());

      await controller.respond('group-1', 'event-1', { id: 'user-1' }, dto);

      expect(mockEventsService.respond).toHaveBeenCalledWith('group-1', 'event-1', 'user-1', dto);
    });
  });
});
