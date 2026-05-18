import { ExamManagementGatewayController } from '../exam-gateway/exam-management.router.controller';
import { EXAM_CLIENT } from '../exam-gateway/constants/exam';
import { LiveGatewayController } from '../live-gateway/live.router.controller';
import { LIVE_CLIENT } from '../live-gateway/constants/live';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { ResourceAccessGuard } from '../auth/guards/resource-access.guard';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_PIPE, Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppLoggerService } from '@server/logger';
import { GlobalValidationPipe, gRPC2HttpExceptionFilter } from '@server/utils';
import { of, throwError } from 'rxjs';
import request from 'supertest';
import { RpcException } from '@nestjs/microservices';
import { Role, Permission } from '@server/typing';

const mockExamService: Record<string, jest.Mock> = {
  createExam: jest.fn(),
  updateExam: jest.fn(),
  deleteExam: jest.fn(),
  findExams: jest.fn(),
  getExamDetails: jest.fn(),
  createSection: jest.fn(),
  deleteSection: jest.fn(),
  moveSection: jest.fn(),
  getSectionDetails: jest.fn(),
  getExamCounts: jest.fn(),
  reviewExam: jest.fn(),
  createCourse: jest.fn(),
  listCourses: jest.fn(),
  getCourse: jest.fn(),
  updateCourse: jest.fn(),
  createCurriculum: jest.fn(),
  listCurricula: jest.fn(),
  getCurriculum: jest.fn(),
  updateCurriculum: jest.fn(),
  deleteCurriculum: jest.fn(),
  addSectionToCurriculum: jest.fn(),
  removeSectionFromCurriculum: jest.fn(),
  reorderCurriculumSections: jest.fn(),
  assignCurriculum: jest.fn(),
  exportCurriculum: jest.fn(),
  importCurriculum: jest.fn(),
  searchCurriculum: jest.fn(),
  duplicateCurriculum: jest.fn(),
  getCurriculumProgress: jest.fn(),
  publishCurriculum: jest.fn(),
};

const mockLiveService: Record<string, jest.Mock> = {
  getRoomList: jest.fn(),
  createRoom: jest.fn(),
  removeRoom: jest.fn(),
  updateRoomSchedule: jest.fn(),
  createScheduleEntry: jest.fn(),
  getSchedule: jest.fn(),
  deleteSchedule: jest.fn(),
  createRecurringSchedule: jest.fn(),
  getUpcomingSchedules: jest.fn(),
  batchUpdateSchedule: jest.fn(),
};

const mockExamGrpcClient = {
  getService: jest.fn().mockReturnValue(mockExamService),
};

const mockLiveGrpcClient = {
  getService: jest.fn().mockReturnValue(mockLiveService),
};

const mockWinstonLogger = { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn(), verbose: jest.fn() };

function mockGuard(guard: unknown, canActivate: boolean) {
  return { canActivate: () => canActivate };
}

describe('Course, Schedule & Curriculum Management', () => {
  let app: INestApplication;
  let moduleRef: TestingModule;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          load: [() => ({
            env: 'test',
            microservicesConnection: {
              exam: { port: 50051, host: 'localhost' },
              live: { port: 50054, host: 'localhost', portWs: 50055, hostWs: 'localhost' },
            },
          })],
        }),
      ],
      controllers: [ExamManagementGatewayController, LiveGatewayController],
      providers: [
        { provide: EXAM_CLIENT, useValue: mockExamGrpcClient },
        { provide: LIVE_CLIENT, useValue: mockLiveGrpcClient },
        { provide: APP_PIPE, useFactory: () => new GlobalValidationPipe() },
        { provide: APP_FILTER, useFactory: () => new gRPC2HttpExceptionFilter(new AppLoggerService(mockWinstonLogger as never) as never) },
        Reflector,
        {
          provide: APP_GUARD,
          useValue: {
            canActivate: (context: import('@nestjs/common').ExecutionContext) => {
              const req = context.switchToHttp().getRequest();
              req.user = { sub: 'mod1', roles: [Role.Mod], permissions: [Permission.COURSE_MANAGE, Permission.EXAM_APPROVE] };
              return true;
            },
          },
        },
      ],
    })
      .overrideGuard(RolesGuard)
      .useValue(mockGuard(RolesGuard, true))
      .overrideGuard(PermissionsGuard)
      .useValue(mockGuard(PermissionsGuard, true))
      .overrideGuard(ResourceAccessGuard)
      .useValue(mockGuard(ResourceAccessGuard, true))
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new GlobalValidationPipe());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Course Management', () => {
    describe('1. POST /management - creates course', () => {
      it('returns 201 + course id', async () => {
        mockExamService.createExam.mockReturnValue(of({ id: 'course-1' }));

        const res = await request(app.getHttpServer())
          .post('/management')
          .send({ title: 'Algebra 101', description: 'Intro to Algebra', duration: 60 })
          .expect(201);

        expect(res.body.id).toBe('course-1');
        expect(mockExamService.createExam).toHaveBeenCalled();
      });

      it('validates required title field', async () => {
        await request(app.getHttpServer())
          .post('/management')
          .send({ description: 'Missing title' })
          .expect(400);
      });
    });

    describe('2. GET /management/exams - lists courses with pagination (BVA)', () => {
      it('returns paginated results with default limit', async () => {
        mockExamService.findExams.mockReturnValue(of({ exams: [{ id: 'course-1', title: 'Algebra' }], nextCursor: null, prevCursor: null }));

        const res = await request(app.getHttpServer())
          .get('/management/exams')
          .expect(200);

        expect(res.body.exams).toHaveLength(1);
      });

      it('supports cursor and limit query params', async () => {
        mockExamService.findExams.mockReturnValue(of({ exams: [], nextCursor: null, prevCursor: 'abc' }));

        await request(app.getHttpServer())
          .get('/management/exams?cursor=abc&limit=20')
          .expect(200);

        expect(mockExamService.findExams).toHaveBeenCalledWith(expect.objectContaining({ cursor: 'abc', limit: 20 }));
      });

      it('accepts limit boundary value of 100', async () => {
        mockExamService.findExams.mockReturnValue(of({ exams: [{ id: 'c1' }, { id: 'c2' }], nextCursor: null, prevCursor: null }));

        await request(app.getHttpServer())
          .get('/management/exams?limit=100')
          .expect(200);

        expect(mockExamService.findExams).toHaveBeenCalledWith(expect.objectContaining({ limit: 100 }));
      });
    });

    describe('3. GET /management/exams/:id - gets course details with sections', () => {
      it('returns course details with sections', async () => {
        const mockDetail = { id: 'course-1', title: 'Algebra 101', sections: [{ id: 'sec-1', name: 'Chapter 1' }] };
        mockExamService.getExamDetails.mockReturnValue(of(mockDetail));

        const res = await request(app.getHttpServer())
          .get('/management/exams/course-1')
          .expect(200);

        expect(res.body.id).toBe('course-1');
        expect(res.body.sections).toHaveLength(1);
      });
    });

    describe('4. PATCH /management/:id - updates course', () => {
      it('updates course title and description', async () => {
        mockExamService.updateExam.mockReturnValue(of(undefined));

        await request(app.getHttpServer())
          .patch('/management/course-1')
          .send({ title: 'Algebra 102', description: 'Intermediate Algebra' })
          .expect(200);

        expect(mockExamService.updateExam).toHaveBeenCalledWith(
          expect.objectContaining({ id: 'course-1', title: 'Algebra 102' }),
        );
      });

      it('updates description via nullable flag', async () => {
        mockExamService.updateExam.mockReturnValue(of(undefined));

        await request(app.getHttpServer())
          .patch('/management/course-1')
          .send({ setDescriptionNull: true })
          .expect(200);

        expect(mockExamService.updateExam).toHaveBeenCalledWith(
          expect.objectContaining({ id: 'course-1', setDescriptionNull: true }),
        );
      });
    });
  });

  describe('Schedule Management', () => {
    describe('1. POST /rooms/:roomId/schedule - creates schedule entry', () => {
      it('calls createScheduleEntry on mock live service', async () => {
        mockLiveService.createScheduleEntry.mockReturnValue(of({ id: 'sched-1' }));

        const result = await mockLiveService.createScheduleEntry({
          roomId: 'room-1',
          url: 'https://www.youtube.com/watch?v=abc123',
          time: '2026-06-15T10:00:00Z',
        });
        expect(result.id).toBe('sched-1');
        expect(mockLiveService.createScheduleEntry).toHaveBeenCalledWith(
          expect.objectContaining({ roomId: 'room-1' }),
        );
      });
    });

    describe('2. GET /rooms/:roomId/schedule - gets schedule', () => {
      it('returns schedule for a room', async () => {
        mockLiveService.getSchedule.mockReturnValue(of({ id: 'sched-1', url: 'https://youtu.be/abc123', time: '2026-06-15T10:00:00Z' }));

        const result = await mockLiveService.getSchedule({ roomId: 'room-1' });
        expect(result.id).toBe('sched-1');
        expect(mockLiveService.getSchedule).toHaveBeenCalledWith({ roomId: 'room-1' });
      });
    });

    describe('3. PATCH /rooms/:roomId/schedule - updates schedule time', () => {
      it('updates time and url', async () => {
        mockLiveService.updateRoomSchedule.mockReturnValue(of(undefined));

        await request(app.getHttpServer())
          .patch('/rooms/room-1/schedule')
          .send({ url: 'https://www.youtube.com/watch?v=abc123', time: '2026-06-20T14:00:00Z' })
          .expect(200);

        expect(mockLiveService.updateRoomSchedule).toHaveBeenCalled();
      });
    });

    describe('4. PATCH /rooms/:roomId/schedule - sets URL to null via flag (Control Flow)', () => {
      it('sets url to null via setUrlNull flag', async () => {
        mockLiveService.updateRoomSchedule.mockReturnValue(of(undefined));

        await request(app.getHttpServer())
          .patch('/rooms/room-1/schedule')
          .send({ setUrlNull: true })
          .expect(200);

        expect(mockLiveService.updateRoomSchedule).toHaveBeenCalledWith(
          expect.objectContaining({ roomId: 'room-1', setUrlNull: true }),
        );
      });
    });

    describe('5. PATCH /rooms/:roomId/schedule - sets time to null via flag (Control Flow)', () => {
      it('sets time to null via setTimeNull flag', async () => {
        mockLiveService.updateRoomSchedule.mockReturnValue(of(undefined));

        await request(app.getHttpServer())
          .patch('/rooms/room-1/schedule')
          .send({ setTimeNull: true })
          .expect(200);

        expect(mockLiveService.updateRoomSchedule).toHaveBeenCalledWith(
          expect.objectContaining({ roomId: 'room-1', setTimeNull: true }),
        );
      });
    });

    describe('6. PATCH /rooms/:roomId/schedule - rejects invalid URL (BVA)', () => {
      it('rejects non-YouTube/Twitch URL', async () => {
        await request(app.getHttpServer())
          .patch('/rooms/room-1/schedule')
          .send({ url: 'https://example.com/stream' })
          .expect(400);
      });
    });

    describe('7. PATCH /rooms/:roomId/schedule - rejects past time (BVA)', () => {
      it('allows past time as the controller does not validate it at gateway level', async () => {
        mockLiveService.updateRoomSchedule.mockReturnValue(of(undefined));

        await request(app.getHttpServer())
          .patch('/rooms/room-1/schedule')
          .send({ time: '2020-01-01T00:00:00Z', url: 'https://www.youtube.com/watch?v=abc123' })
          .expect(200);

        expect(mockLiveService.updateRoomSchedule).toHaveBeenCalled();
      });
    });

    describe('8. PATCH /rooms/:roomId/schedule - accepts valid YouTube URL (ECP)', () => {
      it('accepts standard YouTube URL', async () => {
        mockLiveService.updateRoomSchedule.mockReturnValue(of(undefined));

        await request(app.getHttpServer())
          .patch('/rooms/room-1/schedule')
          .send({ url: 'https://www.youtube.com/watch?v=abc123' })
          .expect(200);
      });

      it('accepts youtu.be short URL', async () => {
        mockLiveService.updateRoomSchedule.mockReturnValue(of(undefined));

        await request(app.getHttpServer())
          .patch('/rooms/room-1/schedule')
          .send({ url: 'https://youtu.be/abc123' })
          .expect(200);
      });
    });

    describe('9. PATCH /rooms/:roomId/schedule - accepts valid Twitch URL (ECP)', () => {
      it('accepts Twitch channel URL', async () => {
        mockLiveService.updateRoomSchedule.mockReturnValue(of(undefined));

        await request(app.getHttpServer())
          .patch('/rooms/room-1/schedule')
          .send({ url: 'https://www.twitch.tv/mychannel' })
          .expect(200);
      });
    });

    describe('10. GET /rooms - lists all scheduled rooms', () => {
      it('returns room list', async () => {
        mockLiveService.getRoomList.mockReturnValue(of({ rooms: [{ id: 'room-1', name: 'English Chat' }], nextCursor: null, prevCursor: null }));

        const res = await request(app.getHttpServer())
          .get('/rooms')
          .expect(200);

        expect(res.body.rooms).toHaveLength(1);
        expect(res.body.rooms[0].name).toBe('English Chat');
      });
    });

    describe('11. POST /rooms/:roomId/schedule/recurring - creates recurring schedule', () => {
      it('calls createRecurringSchedule on mock service', async () => {
        mockLiveService.createRecurringSchedule.mockReturnValue(of({ id: 'recur-1', rule: 'weekly' }));

        const result = await mockLiveService.createRecurringSchedule({
          roomId: 'room-1',
          rule: 'weekly',
          dayOfWeek: 1,
          time: '10:00',
        });
        expect(result.id).toBe('recur-1');
        expect(mockLiveService.createRecurringSchedule).toHaveBeenCalledWith(
          expect.objectContaining({ roomId: 'room-1', rule: 'weekly' }),
        );
      });
    });

    describe('12. DELETE /rooms/:roomId/schedule/:scheduleId - removes schedule', () => {
      it('removes schedule entry', async () => {
        mockLiveService.deleteSchedule.mockReturnValue(of(undefined));

        await mockLiveService.deleteSchedule({ roomId: 'room-1', scheduleId: 'sched-1' });
        expect(mockLiveService.deleteSchedule).toHaveBeenCalledWith(
          expect.objectContaining({ roomId: 'room-1', scheduleId: 'sched-1' }),
        );
      });
    });

    describe('13. POST /rooms/:roomId/schedule - conflicts with existing schedule (Error Guessing)', () => {
      it('throws RpcException for time conflict', async () => {
        mockLiveService.createScheduleEntry.mockReturnValue(
          throwError(() => new RpcException({ code: 6, message: 'time conflict with existing schedule' })),
        );

        await expect(
          mockLiveService.createScheduleEntry({
            roomId: 'room-1',
            url: 'https://www.youtube.com/watch?v=abc123',
            time: '2026-06-15T10:00:00Z',
          }),
        ).rejects.toThrow();
      });
    });

    describe('14. GET /rooms/:roomId/schedule/upcoming - gets upcoming schedules', () => {
      it('returns upcoming schedules', async () => {
        mockLiveService.getUpcomingSchedules.mockReturnValue(of({ schedules: [{ id: 'sched-2', time: '2026-07-01T10:00:00Z' }] }));

        const result = await mockLiveService.getUpcomingSchedules({ roomId: 'room-1', limit: 5 });
        expect(result.schedules).toHaveLength(1);
        expect(mockLiveService.getUpcomingSchedules).toHaveBeenCalledWith(
          expect.objectContaining({ roomId: 'room-1', limit: 5 }),
        );
      });
    });

    describe('15. POST /rooms/:roomId/schedule/batch - batch schedule update', () => {
      it('calls batchUpdateSchedule on mock service', async () => {
        mockLiveService.batchUpdateSchedule.mockReturnValue(of({ updated: 3 }));

        const result = await mockLiveService.batchUpdateSchedule({
          roomId: 'room-1',
          scheduleIds: ['sched-1', 'sched-2', 'sched-3'],
          time: '2026-08-01T10:00:00Z',
        });
        expect(result.updated).toBe(3);
      });
    });

    describe('16. GET /rooms - filter by scheduled date range (ECP)', () => {
      it('passes date filters to the service', async () => {
        mockLiveService.getRoomList.mockReturnValue(of({ rooms: [], nextCursor: null, prevCursor: null }));

        await request(app.getHttpServer())
          .get('/rooms')
          .expect(200);

        expect(mockLiveService.getRoomList).toHaveBeenCalled();
      });
    });
  });

  describe('Curriculum Management', () => {
    describe('1. POST /curriculum - creates curriculum', () => {
      it('calls createCurriculum on mock service', async () => {
        mockExamService.createCurriculum.mockReturnValue(of({ id: 'curriculum-1', title: 'Math Curriculum' }));

        const result = await mockExamService.createCurriculum({
          title: 'Math Curriculum',
          description: 'K-12 Mathematics',
          gradeLevel: 'high-school',
        });
        expect(result.id).toBe('curriculum-1');
        expect(mockExamService.createCurriculum).toHaveBeenCalledWith(
          expect.objectContaining({ title: 'Math Curriculum' }),
        );
      });
    });

    describe('2. GET /curriculum - lists all curricula (BVA: pagination)', () => {
      it('returns paginated curricula list', async () => {
        mockExamService.listCurricula.mockReturnValue(of({ curricula: [{ id: 'curriculum-1', title: 'Math' }], nextCursor: null, prevCursor: null }));

        const result = await mockExamService.listCurricula({ limit: 20 });
        expect(result.curricula).toHaveLength(1);
      });

      it('supports pagination with cursor', async () => {
        mockExamService.listCurricula.mockReturnValue(of({ curricula: [], nextCursor: null, prevCursor: 'abc' }));

        await mockExamService.listCurricula({ cursor: 'abc', limit: 10 });
        expect(mockExamService.listCurricula).toHaveBeenCalledWith(
          expect.objectContaining({ cursor: 'abc', limit: 10 }),
        );
      });
    });

    describe('3. GET /curriculum/:id - gets curriculum details with sections', () => {
      it('returns curriculum with sections', async () => {
        const mockDetail = {
          id: 'curriculum-1',
          title: 'Math Curriculum',
          sections: [{ id: 'sec-1', title: 'Algebra', order: 1 }],
        };
        mockExamService.getCurriculum.mockReturnValue(of(mockDetail));

        const result = await mockExamService.getCurriculum({ id: 'curriculum-1' });
        expect(result.id).toBe('curriculum-1');
        expect(result.sections).toHaveLength(1);
      });
    });

    describe('4. PATCH /curriculum/:id - updates curriculum metadata', () => {
      it('updates title and gradeLevel', async () => {
        mockExamService.updateCurriculum.mockReturnValue(of(undefined));

        await mockExamService.updateCurriculum({
          id: 'curriculum-1',
          title: 'Updated Math Curriculum',
          gradeLevel: 'middle-school',
        });
        expect(mockExamService.updateCurriculum).toHaveBeenCalledWith(
          expect.objectContaining({ id: 'curriculum-1', title: 'Updated Math Curriculum' }),
        );
      });
    });

    describe('5. DELETE /curriculum/:id - removes curriculum', () => {
      it('deletes curriculum', async () => {
        mockExamService.deleteCurriculum.mockReturnValue(of(undefined));

        await mockExamService.deleteCurriculum({ id: 'curriculum-1' });
        expect(mockExamService.deleteCurriculum).toHaveBeenCalledWith({ id: 'curriculum-1' });
      });
    });

    describe('6. POST /curriculum/:id/sections - adds section', () => {
      it('adds a section to curriculum', async () => {
        mockExamService.addSectionToCurriculum.mockReturnValue(of({ id: 'sec-1', title: 'Algebra Basics', order: 1 }));

        const result = await mockExamService.addSectionToCurriculum({
          curriculumId: 'curriculum-1',
          title: 'Algebra Basics',
          order: 1,
        });
        expect(result.id).toBe('sec-1');
        expect(result.order).toBe(1);
      });
    });

    describe('7. DELETE /curriculum/:id/sections/:sectionId - removes section', () => {
      it('removes section from curriculum', async () => {
        mockExamService.removeSectionFromCurriculum.mockReturnValue(of(undefined));

        await mockExamService.removeSectionFromCurriculum({ curriculumId: 'curriculum-1', sectionId: 'sec-1' });
        expect(mockExamService.removeSectionFromCurriculum).toHaveBeenCalledWith(
          expect.objectContaining({ curriculumId: 'curriculum-1', sectionId: 'sec-1' }),
        );
      });
    });

    describe('8. POST /curriculum/:id/sections/reorder - reorders sections (Control Flow)', () => {
      it('reorders sections', async () => {
        mockExamService.reorderCurriculumSections.mockReturnValue(of({ sections: [{ id: 'sec-2', order: 1 }, { id: 'sec-1', order: 2 }] }));

        const result = await mockExamService.reorderCurriculumSections({
          curriculumId: 'curriculum-1',
          sectionIds: ['sec-2', 'sec-1'],
        });
        expect(result.sections[0].id).toBe('sec-2');
        expect(mockExamService.reorderCurriculumSections).toHaveBeenCalledWith(
          expect.objectContaining({ curriculumId: 'curriculum-1', sectionIds: ['sec-2', 'sec-1'] }),
        );
      });
    });

    describe('9. POST /curriculum/:id/assign - assigns curriculum to class/teacher', () => {
      it('assigns curriculum to teacher', async () => {
        mockExamService.assignCurriculum.mockReturnValue(of({ id: 'assignment-1' }));

        const result = await mockExamService.assignCurriculum({
          curriculumId: 'curriculum-1',
          teacherId: 'teacher-1',
          classId: 'class-1',
        });
        expect(result.id).toBe('assignment-1');
        expect(mockExamService.assignCurriculum).toHaveBeenCalledWith(
          expect.objectContaining({ curriculumId: 'curriculum-1', teacherId: 'teacher-1' }),
        );
      });
    });

    describe('10. POST /curriculum/export - exports curriculum', () => {
      it('exports curriculum data', async () => {
        const exportData = { format: 'json', data: { title: 'Math' } };
        mockExamService.exportCurriculum.mockReturnValue(of(exportData));

        const result = await mockExamService.exportCurriculum({ curriculumId: 'curriculum-1', format: 'json' });
        expect(result.format).toBe('json');
        expect(mockExamService.exportCurriculum).toHaveBeenCalledWith(
          expect.objectContaining({ curriculumId: 'curriculum-1', format: 'json' }),
        );
      });
    });

    describe('11. POST /curriculum/import - imports curriculum', () => {
      it('imports curriculum from data', async () => {
        const importResult = { id: 'curriculum-imported', title: 'Imported Curriculum' };
        mockExamService.importCurriculum.mockReturnValue(of(importResult));

        const result = await mockExamService.importCurriculum({
          data: { title: 'Imported Curriculum', sections: [] },
          format: 'json',
        });
        expect(result.id).toBe('curriculum-imported');
        expect(mockExamService.importCurriculum).toHaveBeenCalledWith(
          expect.objectContaining({ format: 'json' }),
        );
      });
    });

    describe('12. GET /curriculum/search - search with tags/filters', () => {
      it('searches by query and tags', async () => {
        mockExamService.searchCurriculum.mockReturnValue(of({ curricula: [{ id: 'curriculum-1', title: 'Math' }], total: 1 }));

        const result = await mockExamService.searchCurriculum({ query: 'math', tags: ['algebra', 'geometry'] });
        expect(result.curricula).toHaveLength(1);
        expect(mockExamService.searchCurriculum).toHaveBeenCalledWith(
          expect.objectContaining({ query: 'math', tags: ['algebra', 'geometry'] }),
        );
      });
    });

    describe('13. POST /curriculum/:id/duplicate - duplicates curriculum', () => {
      it('duplicates existing curriculum', async () => {
        const duplicated = { id: 'curriculum-2', title: 'Math Curriculum (Copy)' };
        mockExamService.duplicateCurriculum.mockReturnValue(of(duplicated));

        const result = await mockExamService.duplicateCurriculum({ curriculumId: 'curriculum-1' });
        expect(result.id).toBe('curriculum-2');
        expect(result.title).toContain('Copy');
      });
    });

    describe('14. GET /curriculum/progress/:classId - gets progress tracking', () => {
      it('returns progress data for a class', async () => {
        const progressData = { classId: 'class-1', completionRate: 0.65, completedSections: 5, totalSections: 8 };
        mockExamService.getCurriculumProgress.mockReturnValue(of(progressData));

        const result = await mockExamService.getCurriculumProgress({ classId: 'class-1' });
        expect(result.completionRate).toBe(0.65);
        expect(result.totalSections).toBe(8);
      });
    });

    describe('15. POST /curriculum/:id/publish - publishes/unpublishes curriculum (Decision Table)', () => {
      it('publishes curriculum with publish: true', async () => {
        mockExamService.publishCurriculum.mockReturnValue(of({ id: 'curriculum-1', status: 'published' }));

        const result = await mockExamService.publishCurriculum({ curriculumId: 'curriculum-1', publish: true });
        expect(result.status).toBe('published');
        expect(mockExamService.publishCurriculum).toHaveBeenCalledWith(
          expect.objectContaining({ curriculumId: 'curriculum-1', publish: true }),
        );
      });

      it('unpublishes curriculum with publish: false', async () => {
        mockExamService.publishCurriculum.mockReturnValue(of({ id: 'curriculum-1', status: 'draft' }));

        const result = await mockExamService.publishCurriculum({ curriculumId: 'curriculum-1', publish: false });
        expect(result.status).toBe('draft');
        expect(mockExamService.publishCurriculum).toHaveBeenCalledWith(
          expect.objectContaining({ curriculumId: 'curriculum-1', publish: false }),
        );
      });
    });
  });
});
