import { ExamManagementController } from '../presentation/controllers/exam-management.controller';
import { ExamStatus } from '../enums/exam-status.enum';
import { CommandBus, CqrsModule, QueryBus } from '@nestjs/cqrs';
import { Test, TestingModule } from '@nestjs/testing';
import { AppLoggerService } from '@server/logger';

describe('ExamManagementController', () => {
  let controller: ExamManagementController;
  let commandBus: CommandBus;
  let queryBus: QueryBus;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [CqrsModule.forRoot()],
      controllers: [ExamManagementController],
      providers: [
        { provide: 'winston', useValue: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn(), verbose: jest.fn() } },
        { provide: AppLoggerService, useFactory: () => new AppLoggerService({ info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn(), verbose: jest.fn() } as never) },
      ],
    }).compile();

    controller = module.get(ExamManagementController);
    commandBus = module.get(CommandBus);
    queryBus = module.get(QueryBus);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createExam', () => {
    it('executes command and returns id', async () => {
      jest.spyOn(commandBus, 'execute').mockResolvedValue({ id: 'exam-1' });

      const result = await controller.createExam({
        createdBy: 'user-1',
        title: 'Math Test',
        description: 'Algebra',
        duration: 60,
      });

      expect(result.id).toBe('exam-1');
      expect(commandBus.execute).toHaveBeenCalled();
    });
  });

  describe('createSection', () => {
    it('executes command and returns id', async () => {
      jest.spyOn(commandBus, 'execute').mockResolvedValue({ id: 'sec-1' });

      const result = await controller.createSection({ examId: 'exam-1' });

      expect(result.id).toBe('sec-1');
    });
  });

  describe('createQuestion', () => {
    it('executes command and returns id', async () => {
      jest.spyOn(commandBus, 'execute').mockResolvedValue({ id: 'q-1' });

      const result = await controller.createQuestion({ sectionId: 'sec-1', index: 0 });

      expect(result.id).toBe('q-1');
    });
  });

  describe('updateExam', () => {
    it('executes command', async () => {
      jest.spyOn(commandBus, 'execute').mockResolvedValue(undefined);

      await controller.updateExam({ id: 'exam-1', title: 'Updated', addTags: [], removeTags: [] });

      expect(commandBus.execute).toHaveBeenCalled();
    });
  });

  describe('updateSection', () => {
    it('executes command', async () => {
      jest.spyOn(commandBus, 'execute').mockResolvedValue(undefined);

      await controller.updateSection({ id: 'sec-1', name: 'Updated', addTags: [], removeTags: [], addFiles: [], removeFiles: [] });

      expect(commandBus.execute).toHaveBeenCalled();
    });
  });

  describe('updateQuestion', () => {
    it('executes command', async () => {
      jest.spyOn(commandBus, 'execute').mockResolvedValue(undefined);

      await controller.updateQuestion({ id: 'q-1', content: 'Updated', addChoices: [], deleteChoicesIds: [], updateChoices: [], addTags: [], removeTags: [], addFiles: [], removeFiles: [] });

      expect(commandBus.execute).toHaveBeenCalled();
    });
  });

  describe('deleteExam', () => {
    it('executes command', async () => {
      jest.spyOn(commandBus, 'execute').mockResolvedValue(undefined);

      await controller.deleteExam({ id: 'exam-1' });

      expect(commandBus.execute).toHaveBeenCalled();
    });
  });

  describe('deleteSection', () => {
    it('executes command', async () => {
      jest.spyOn(commandBus, 'execute').mockResolvedValue(undefined);

      await controller.deleteSection({ id: 'sec-1' });

      expect(commandBus.execute).toHaveBeenCalled();
    });
  });

  describe('deleteQuestion', () => {
    it('executes command', async () => {
      jest.spyOn(commandBus, 'execute').mockResolvedValue(undefined);

      await controller.deleteQuestion({ id: 'q-1' });

      expect(commandBus.execute).toHaveBeenCalled();
    });
  });

  describe('moveSection', () => {
    it('executes command', async () => {
      jest.spyOn(commandBus, 'execute').mockResolvedValue(undefined);

      await controller.moveSection({ id: 'sec-1', index: 2 });

      expect(commandBus.execute).toHaveBeenCalled();
    });
  });

  describe('moveQuestion', () => {
    it('executes command', async () => {
      jest.spyOn(commandBus, 'execute').mockResolvedValue(undefined);

      await controller.moveQuestion({ id: 'q-1', index: 3, sectionId: 'sec-2' });

      expect(commandBus.execute).toHaveBeenCalled();
    });
  });

  describe('reviewExam', () => {
    it('executes command', async () => {
      jest.spyOn(commandBus, 'execute').mockResolvedValue(undefined);

      await controller.reviewExam({ id: 'exam-1', status: ExamStatus.Approved });

      expect(commandBus.execute).toHaveBeenCalled();
    });
  });

  describe('findExams', () => {
    it('returns exams', async () => {
      const mockResult = { exams: [{ id: 'exam-1', title: 'Test' }], nextCursor: null, prevCursor: null };
      jest.spyOn(queryBus, 'execute').mockResolvedValue(mockResult);

      const result = await controller.findExams({});

      expect(result.exams).toHaveLength(1);
    });
  });

  describe('getExamDetails', () => {
    it('returns exam details', async () => {
      const mockResult = { id: 'exam-1', title: 'Test', sectionIds: [] };
      jest.spyOn(queryBus, 'execute').mockResolvedValue(mockResult);

      const result = await controller.getExamDetails({ examId: 'exam-1' });

      expect(result.id).toBe('exam-1');
    });
  });

  describe('getSectionDetails', () => {
    it('returns section details', async () => {
      const mockResult = { id: 'sec-1', name: 'Section 1' };
      jest.spyOn(queryBus, 'execute').mockResolvedValue(mockResult);

      const result = await controller.getSectionDetails({ sectionId: 'sec-1' });

      expect(result.id).toBe('sec-1');
    });
  });

  describe('getQuestionDetails', () => {
    it('returns question details', async () => {
      const mockResult = { id: 'q-1', content: '2+2?' };
      jest.spyOn(queryBus, 'execute').mockResolvedValue(mockResult);

      const result = await controller.getQuestionDetails({ questionId: 'q-1' });

      expect(result.id).toBe('q-1');
    });
  });

  describe('getExamCounts', () => {
    it('returns counts', async () => {
      const mockCounts = { total: 10, approved: 5, pending: 3, rejected: 2 };
      jest.spyOn(queryBus, 'execute').mockResolvedValue(mockCounts);

      const result = await controller.getExamCounts();

      expect(result.total).toBe(10);
    });
  });
});
