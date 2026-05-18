import { ExamPracticeController } from '../presentation/controllers/exam-practice.controller';
import { IPracticeReadRepositoryToken } from '../domain/repositories/practice.read.repository';
import { SortDirection } from '@server/typing';
import { CommandBus, CqrsModule, QueryBus } from '@nestjs/cqrs';
import { Test, TestingModule } from '@nestjs/testing';
import { AppLoggerService } from '@server/logger';

describe('ExamPracticeController', () => {
  let controller: ExamPracticeController;
  let commandBus: CommandBus;
  let queryBus: QueryBus;

  const mockPracticeReadRepository = {};

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [CqrsModule],
      controllers: [ExamPracticeController],
      providers: [
        { provide: AppLoggerService, useValue: { log: jest.fn() } },
        { provide: IPracticeReadRepositoryToken, useValue: mockPracticeReadRepository },
      ],
    }).compile();

    controller = module.get<ExamPracticeController>(ExamPracticeController);
    commandBus = module.get<CommandBus>(CommandBus);
    queryBus = module.get<QueryBus>(QueryBus);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('attempt', () => {
    it('executes command and returns created attempt id', async () => {
      jest.spyOn(commandBus, 'execute').mockResolvedValue({ id: 'attempt-1' });

      const result = await controller.attempt({
        examId: 'exam-1',
        userId: 'user-1',
        options: { sectionIds: [] },
      });

      expect(result).toEqual({ id: 'attempt-1' });
      expect(commandBus.execute).toHaveBeenCalled();
    });
  });

  describe('endAttempt', () => {
    it('executes command', async () => {
      jest.spyOn(commandBus, 'execute').mockResolvedValue(undefined);

      await controller.endAttempt({ attemptId: 'attempt-1' });

      expect(commandBus.execute).toHaveBeenCalled();
    });
  });

  describe('answer', () => {
    it('executes command', async () => {
      jest.spyOn(commandBus, 'execute').mockResolvedValue(undefined);

      await controller.answer({ attemptId: 'attempt-1', questionId: 'q-1', answer: 'A' });

      expect(commandBus.execute).toHaveBeenCalled();
    });
  });

  describe('removeAnswer', () => {
    it('executes command', async () => {
      jest.spyOn(commandBus, 'execute').mockResolvedValue(undefined);

      await controller.removeAnswer({ attemptId: 'attempt-1', questionId: 'q-1', answer: 'A' });

      expect(commandBus.execute).toHaveBeenCalled();
    });
  });

  describe('toggleFlag', () => {
    it('executes command and returns flag state', async () => {
      jest.spyOn(commandBus, 'execute').mockResolvedValue({ state: true });

      const result = await controller.toggleFlag({ attemptId: 'attempt-1', questionId: 'q-1' });

      expect(result).toEqual({ state: true });
      expect(commandBus.execute).toHaveBeenCalled();
    });
  });

  describe('addNote', () => {
    it('executes command', async () => {
      jest.spyOn(commandBus, 'execute').mockResolvedValue(undefined);

      await controller.addNote({ attemptId: 'attempt-1', questionId: 'q-1', note: 'my note' });

      expect(commandBus.execute).toHaveBeenCalled();
    });
  });

  describe('findExams', () => {
    it('returns exams', async () => {
      jest.spyOn(queryBus, 'execute').mockResolvedValue({
        exams: [],
        nextCursor: '',
        prevCursor: '',
      });

      const result = await controller.findExams({});

      expect(result).toEqual({ exams: [], nextCursor: '', prevCursor: '' });
    });
  });

  describe('getExamDetails', () => {
    it('returns exam details', async () => {
      jest.spyOn(queryBus, 'execute').mockResolvedValue({
        id: 'exam-1',
        name: 'Exam 1',
        duration: 60,
        attemptsCount: 0,
        sections: [],
        tags: [],
        updatedAt: new Date(),
      });

      const result = await controller.getExamDetails({ examId: 'exam-1' });

      expect(result.id).toBe('exam-1');
      expect(queryBus.execute).toHaveBeenCalled();
    });
  });

  describe('getDetailedQuestionInfo', () => {
    it('returns question details', async () => {
      jest.spyOn(queryBus, 'execute').mockResolvedValue({
        id: 'q-1',
        content: 'Question?',
        explanation: 'Explanation',
        fileUrls: [],
        points: 1,
        sectionContext: [],
        type: 'MCQ',
      });

      const result = await controller.getDetailedQuestionInfo({ questionId: 'q-1' });

      expect(result.id).toBe('q-1');
      expect(queryBus.execute).toHaveBeenCalled();
    });
  });

  describe('getExamStats', () => {
    it('returns exam stats', async () => {
      jest.spyOn(queryBus, 'execute').mockResolvedValue({
        averageDuration: 30,
        averageScoreInPercentage: 75,
        questions: [],
      });

      const result = await controller.getExamStats({ examId: 'exam-1' });

      expect(result.averageDuration).toBe(30);
      expect(queryBus.execute).toHaveBeenCalled();
    });
  });

  describe('getAttemptSavedData', () => {
    it('returns attempt saved data', async () => {
      jest.spyOn(queryBus, 'execute').mockResolvedValue({
        durationLimit: 60,
        responses: [],
        sections: [],
        startedAt: new Date(),
      });

      const result = await controller.getAttemptSavedData({ attemptId: 'attempt-1' });

      expect(result.durationLimit).toBe(60);
      expect(queryBus.execute).toHaveBeenCalled();
    });
  });

  describe('getAttemptReview', () => {
    it('returns attempt review', async () => {
      jest.spyOn(queryBus, 'execute').mockResolvedValue({
        durationLimit: 60,
        endedAt: new Date(),
        responses: [],
        sections: [],
        startedAt: new Date(),
      });

      const result = await controller.getAttemptReview({ attemptId: 'attempt-1' });

      expect(result.durationLimit).toBe(60);
      expect(queryBus.execute).toHaveBeenCalled();
    });
  });

  describe('getUsersAttemptSummary', () => {
    it('returns user calendar data', async () => {
      jest.spyOn(queryBus, 'execute').mockResolvedValue({ history: {} });

      const result = await controller.getUsersAttemptSummary({
        uid: 'user-1',
        range: { from: new Date('2024-01-01'), to: new Date('2024-12-31') },
      });

      expect(result).toEqual({ history: {} });
      expect(queryBus.execute).toHaveBeenCalled();
    });
  });

  describe('getUsersAttemptHistory', () => {
    it('returns attempts history', async () => {
      jest.spyOn(queryBus, 'execute').mockResolvedValue({
        attempts: [],
        nextCursor: '',
        prevCursor: '',
      });

      const result = await controller.getUsersAttemptHistory({
        uid: 'user-1',
        sortBy: { key: 'startedAt', direction: SortDirection.ASC },
      });

      expect(result).toEqual({ attempts: [], nextCursor: '', prevCursor: '' });
      expect(queryBus.execute).toHaveBeenCalled();
    });
  });

  describe('getUserStats', () => {
    it('returns user stats', async () => {
      jest.spyOn(queryBus, 'execute').mockResolvedValue({
        attemptCounts: 5,
        averageScoreInPercentage: 80,
        tagInfos: [],
      });

      const result = await controller.getUserStats({ uid: 'user-1' });

      expect(result.attemptCounts).toBe(5);
      expect(queryBus.execute).toHaveBeenCalled();
    });
  });
});
