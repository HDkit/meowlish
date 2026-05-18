import { BadgeController } from '../presentation/controllers/badge.controller';
import { CommandBus, CqrsModule, QueryBus } from '@nestjs/cqrs';
import { Test, TestingModule } from '@nestjs/testing';
import { AppLoggerService } from '@server/logger';

describe('BadgeController', () => {
  let controller: BadgeController;
  let queryBus: QueryBus;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [CqrsModule.forRoot()],
      controllers: [BadgeController],
      providers: [
        { provide: 'winston', useValue: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn(), verbose: jest.fn() } },
        { provide: AppLoggerService, useFactory: () => new AppLoggerService({ info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn(), verbose: jest.fn() } as never) },
      ],
    }).compile();

    controller = module.get(BadgeController);
    queryBus = module.get(QueryBus);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getAll', () => {
    it('returns all badges', async () => {
      const mockBadges = {
        badges: [
          { name: 'first-login', displayName: 'First Login', description: 'Log in for the first time' },
          { name: 'streak-7', displayName: 'Weekly Streak', description: '7-day login streak' },
        ],
      };
      jest.spyOn(queryBus, 'execute').mockResolvedValue(mockBadges);

      const result = await controller.getAll();

      expect(result).toEqual(mockBadges);
      expect(queryBus.execute).toHaveBeenCalled();
    });
  });

  describe('getUsersBadges', () => {
    it('returns user badges with pagination', async () => {
      const mockResult = {
        badges: [
          { id: 'ub-1', name: 'first-login', displayName: 'First Login', description: 'Log in for the first time', date: new Date('2025-01-01') },
        ],
        nextCursor: 'cursor-abc',
        prevCursor: null,
      };
      jest.spyOn(queryBus, 'execute').mockResolvedValue(mockResult);

      const result = await controller.getUsersBadges({
        userId: 'user-1',
        cursor: 'cursor-abc',
        limit: 10,
      });

      expect(result).toEqual(mockResult);
      expect(queryBus.execute).toHaveBeenCalled();
    });

    it('rejects negative limit', async () => {
      jest.spyOn(queryBus, 'execute').mockRejectedValue(new Error('Limit must be a positive number'));

      await expect(
        controller.getUsersBadges({
          userId: 'user-1',
          limit: -1,
        }),
      ).rejects.toThrow('positive number');
      expect(queryBus.execute).toHaveBeenCalled();
    });

    it('validates userId required', async () => {
      jest.spyOn(queryBus, 'execute').mockRejectedValue(new Error('userId is required'));

      await expect(
        controller.getUsersBadges({} as never),
      ).rejects.toThrow('userId');
      expect(queryBus.execute).toHaveBeenCalled();
    });
  });

  describe('getUsersProgress', () => {
    it('returns login and submission progress', async () => {
      const mockProgress = {
        loginProgress: { longestStreak: 30, streak: 5, total: 100 },
        submissionProgress: { goodScore: 40, perfectScore: 10, total: 50 },
      };
      jest.spyOn(queryBus, 'execute').mockResolvedValue(mockProgress);

      const result = await controller.getUsersProgess({ userId: 'user-1' });

      expect(result).toEqual(mockProgress);
      expect(queryBus.execute).toHaveBeenCalled();
    });
  });
});
