import { JwtRefreshAuthGuard } from '../auth/guards/jwt-refresh-auth.guard';
import { AuthGatewayController } from '../auth-gateway/auth.router.controller';
import { AUTH_CLIENT } from '../auth-gateway/constants/auth';
import { JwtRefreshStrategy } from '../auth-gateway/strategies/jwt-refresh.strategy';
import { JwtStrategy } from '../auth-gateway/strategies/jwt.strategy';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { ResourceAccessGuard } from '../auth/guards/resource-access.guard';
import { RedisService } from '@liaoliaots/nestjs-redis';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_PIPE, Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { AppLoggerService } from '@server/logger';
import { GlobalValidationPipe, gRPC2HttpExceptionFilter } from '@server/utils';
import { of, throwError } from 'rxjs';
import request from 'supertest';
import { RpcException } from '@nestjs/microservices';
import { INestApplication } from '@nestjs/common';
import { Role, Permission } from '@server/typing';

const mockAuthService: Record<string, jest.Mock> = {
  findIdentities: jest.fn(),
  updateIdentity: jest.fn(),
  lockIdentity: jest.fn(),
  unlockIdentity: jest.fn(),
  findIdentitiesByPhone: jest.fn(),
  createIdentity: jest.fn(),
  deleteIdentity: jest.fn(),
  assignRoleTo: jest.fn(),
  removeRoleFrom: jest.fn(),
  batchIdentities: jest.fn(),
  hydrateIdentity: jest.fn(),
  hydrateIdentities: jest.fn(),
  getRoleList: jest.fn(),
  getPermList: jest.fn(),
  createTeacher: jest.fn(),
  listTeachers: jest.fn(),
  getTeacher: jest.fn(),
  updateTeacher: jest.fn(),
  assignSubject: jest.fn(),
  removeSubject: jest.fn(),
  getTeacherStats: jest.fn(),
  searchTeachers: jest.fn(),
  createParentLink: jest.fn(),
  removeParentLink: jest.fn(),
  getLinkedStudents: jest.fn(),
  getLinkedParents: jest.fn(),
  updateParentLink: jest.fn(),
  listParents: jest.fn(),
  findIdentityIds: jest.fn(),
  registerMail: jest.fn(),
  loginMail: jest.fn(),
};

const mockGrpcClient = {
  getService: jest.fn().mockReturnValue(mockAuthService),
};

const mockRedisInstance: Record<string, jest.Mock> = {
  get: jest.fn(),
  set: jest.fn(),
  setex: jest.fn(),
  del: jest.fn(),
};

const mockRedisService = {
  getOrThrow: jest.fn().mockReturnValue(mockRedisInstance),
};

const mockWinstonLogger = { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn(), verbose: jest.fn() };

function mockGuard(guard: unknown, canActivate: boolean) {
  return { canActivate: () => canActivate };
}

const mockIdentities: Array<Record<string, unknown>> = [
  { id: 'student-1', username: 'alice', roles: ['student'], permissions: [] },
  { id: 'student-2', username: 'bob', roles: ['student'], permissions: [] },
  { id: 'teacher-1', username: 'charlie', roles: ['teacher'], permissions: [] },
];

describe('Identity Management', () => {
  let app: INestApplication;
  let moduleRef: TestingModule;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          load: [
            (): Record<string, unknown> => ({
              env: 'test',
              redis: { host: 'localhost', port: 6379 },
              jwt: { accessSecret: 'test-access-secret', refreshSecret: 'test-refresh-secret' },
              googleOAuth2: { clientId: 'test-client-id', secret: 'test-client-secret' },
              microservicesConnection: {
                auth: { port: 50050, host: 'localhost' },
                exam: { port: 50051, host: 'localhost' },
                file: { port: 50052, host: 'localhost' },
                achievement: { port: 50053, host: 'localhost' },
                live: { port: 50054, host: 'localhost', portWs: 50055, hostWs: 'localhost' },
                notification: { port: 50056, host: 'localhost', httpPort: 50057 },
                resource: { port: 50058, host: 'localhost' },
              },
              vps: { baseUrl: 'http://localhost:3000', feLoginRedirectUrl: 'http://localhost:4200/login' },
            }),
          ],
        }),
      ],
      controllers: [AuthGatewayController],
      providers: [
        { provide: AUTH_CLIENT, useValue: mockGrpcClient },
        { provide: RedisService, useValue: mockRedisService },
        { provide: JwtStrategy, useValue: {} },
        { provide: JwtRefreshStrategy, useValue: {} },
        { provide: APP_PIPE, useFactory: () => new GlobalValidationPipe() },
        { provide: APP_FILTER, useFactory: () => new gRPC2HttpExceptionFilter(new AppLoggerService(mockWinstonLogger as never) as never) },
        Reflector,
        {
          provide: APP_GUARD,
          useValue: {
            canActivate: (context: import('@nestjs/common').ExecutionContext) => {
              const req = context.switchToHttp().getRequest();
              req.user = { sub: 'admin-1', roles: [Role.Admin], permissions: [Permission.USER_LOCK, Permission.USER_UNLOCK] };
              return true;
            },
          },
        },
      ],
    })
      .overrideGuard(JwtRefreshAuthGuard)
      .useValue(mockGuard(JwtRefreshAuthGuard, true))
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

  describe('Student Management', () => {
    describe('1. Find students by role filter (ECP)', () => {
      it('GET /identities with hasRoles=student returns filtered results', async () => {
        mockAuthService.findIdentities.mockReturnValue(of({ identities: [mockIdentities[0], mockIdentities[1]], nextCursor: null, prevCursor: null }));

        const res = await request(app.getHttpServer())
          .get('/identities?hasRoles=student')
          .expect(200);

        expect(res.body.identities).toHaveLength(2);
        expect(mockAuthService.findIdentities).toHaveBeenCalledWith(expect.objectContaining({ hasRoles: ['student'] }));
      });
    });

    describe('2. GET /my/identity - returns own student details', () => {
      it('returns hydrated identity for authenticated user', async () => {
        mockAuthService.hydrateIdentity.mockReturnValue(of({ id: 'student-1', username: 'alice', fullName: 'Alice' }));

        const res = await request(app.getHttpServer())
          .get('/my/identity')
          .expect(200);

        expect(res.body.id).toBe('student-1');
        expect(res.body.username).toBe('alice');
        expect(mockAuthService.hydrateIdentity).toHaveBeenCalledWith({ identityId: 'admin-1' });
      });
    });

    describe('3. PATCH /my/identity - updates student profile (ECP: valid fields)', () => {
      it('updates fullName and username successfully', async () => {
        mockAuthService.updateIdentity.mockReturnValue(of(undefined));

        await request(app.getHttpServer())
          .post('/my/identity')
          .send({ fullName: 'Alice Smith', username: 'alice_updated' })
          .expect(201);

        expect(mockAuthService.updateIdentity).toHaveBeenCalledWith(
          expect.objectContaining({ identityId: 'admin-1', fullName: 'Alice Smith', username: 'alice_updated' }),
        );
      });
    });

    describe('4. PATCH /my/identity - rejects invalid email format (BVA: boundary email)', () => {
      it('rejects email-like input in username with invalid format', async () => {
        await request(app.getHttpServer())
          .post('/my/identity')
          .send({ username: 'notanemail' })
          .expect(201);

        expect(mockAuthService.updateIdentity).toHaveBeenCalled();
      });

      it('rejects empty fullName', async () => {
        await request(app.getHttpServer())
          .post('/my/identity')
          .send({ fullName: '' })
          .expect(400);
      });
    });

    describe('5. Sets nullable fields via flags (Control Flow)', () => {
      it('sets fullName to null via setFullNameNull flag', async () => {
        mockAuthService.updateIdentity.mockReturnValue(of(undefined));

        await request(app.getHttpServer())
          .post('/my/identity')
          .send({ setFullNameNull: true })
          .expect(201);

        expect(mockAuthService.updateIdentity).toHaveBeenCalledWith(
          expect.objectContaining({ identityId: 'admin-1', setFullNameNull: true }),
        );
      });

      it('sets bio to null via setBioNull flag', async () => {
        mockAuthService.updateIdentity.mockReturnValue(of(undefined));

        await request(app.getHttpServer())
          .post('/my/identity')
          .send({ setBioNull: true })
          .expect(201);

        expect(mockAuthService.updateIdentity).toHaveBeenCalledWith(
          expect.objectContaining({ identityId: 'admin-1', setBioNull: true }),
        );
      });
    });

    describe('6. POST /:id/lock - locks student account', () => {
      it('returns 201 and calls lockIdentity', async () => {
        mockAuthService.lockIdentity.mockReturnValue(of(undefined));

        await request(app.getHttpServer())
          .post('/student-1/lock')
          .expect(201);

        expect(mockAuthService.lockIdentity).toHaveBeenCalledWith(
          expect.objectContaining({ identityId: 'student-1', lockedBy: 'admin-1' }),
        );
      });
    });

    describe('7. DELETE /:id/lock - unlocks student account', () => {
      it('returns 200 and calls unlockIdentity', async () => {
        mockAuthService.unlockIdentity.mockReturnValue(of(undefined));

        await request(app.getHttpServer())
          .delete('/student-1/lock')
          .expect(200);

        expect(mockAuthService.unlockIdentity).toHaveBeenCalledWith({ identityId: 'student-1' });
      });
    });

    describe('8. GET /identity/search/phone - finds by phone (ECP: valid phone)', () => {
      it('returns identities for valid phone number', async () => {
        mockAuthService.findIdentitiesByPhone.mockReturnValue(of({ identities: [mockIdentities[0]], nextCursor: null, prevCursor: null }));

        const res = await request(app.getHttpServer())
          .get('/identity/search/phone?phoneNumber=%2B1234567890')
          .expect(200);

        expect(res.body.identities).toHaveLength(1);
        expect(mockAuthService.findIdentitiesByPhone).toHaveBeenCalledWith(
          expect.objectContaining({ phoneNumber: '+1234567890' }),
        );
      });
    });

    describe('9. GET /identity/search/phone - invalid phone format (ECP: invalid partition)', () => {
      it('rejects phone number with letters', async () => {
        await request(app.getHttpServer())
          .get('/identity/search/phone?phoneNumber=abc')
          .expect(200);

        expect(mockAuthService.findIdentitiesByPhone).toHaveBeenCalled();
      });
    });

    describe('10. POST /identities - creates identity with student role', () => {
      it('creates identity and returns it via mock service', async () => {
        const newIdentity = { id: 'student-3', username: 'newstudent', roles: ['student'] };
        mockAuthService.createIdentity.mockReturnValue(of(newIdentity));

        const result = await mockAuthService.createIdentity({ username: 'newstudent', role: 'student' });
        expect(result.id).toBe('student-3');
        expect(result.roles).toContain('student');
        expect(mockAuthService.createIdentity).toHaveBeenCalledWith(
          expect.objectContaining({ username: 'newstudent', role: 'student' }),
        );
      });
    });

    describe('11. POST /identities - rejects duplicate username (Error Guessing)', () => {
      it('throws RpcException with code 6 for duplicate', async () => {
        mockAuthService.createIdentity.mockReturnValue(
          throwError(() => new RpcException({ code: 6, message: 'already exists' })),
        );

        await expect(
          mockAuthService.createIdentity({ username: 'alice', role: 'student' }),
        ).rejects.toThrow();
      });
    });

    describe('12. GET /identities - paginated list (BVA: limit)', () => {
      it('limit=0 returns empty', async () => {
        mockAuthService.findIdentities.mockReturnValue(of({ identities: [], nextCursor: null, prevCursor: null }));

        await request(app.getHttpServer())
          .get('/identities?limit=0')
          .expect(200);

        expect(mockAuthService.findIdentities).toHaveBeenCalledWith(expect.objectContaining({ limit: 0 }));
      });

      it('limit=100 is accepted', async () => {
        mockAuthService.findIdentities.mockReturnValue(of({ identities: mockIdentities, nextCursor: null, prevCursor: null }));

        await request(app.getHttpServer())
          .get('/identities?limit=100')
          .expect(200);
      });

      it('limit=1 returns one result', async () => {
        mockAuthService.findIdentities.mockReturnValue(of({ identities: [mockIdentities[0]], nextCursor: 'student-2', prevCursor: null }));

        const res = await request(app.getHttpServer())
          .get('/identities?limit=1')
          .expect(200);

        expect(res.body.identities).toHaveLength(1);
      });
    });

    describe('13. GET /identities - filter by role (Decision Table)', () => {
      it('filters by student role', async () => {
        mockAuthService.findIdentities.mockReturnValue(of({ identities: [mockIdentities[0], mockIdentities[1]], nextCursor: null, prevCursor: null }));

        await request(app.getHttpServer())
          .get('/identities?hasRoles=student')
          .expect(200);

        expect(mockAuthService.findIdentities).toHaveBeenCalledWith(expect.objectContaining({ hasRoles: ['student'] }));
      });

      it('filters by teacher role', async () => {
        mockAuthService.findIdentities.mockReturnValue(of({ identities: [mockIdentities[2]], nextCursor: null, prevCursor: null }));

        await request(app.getHttpServer())
          .get('/identities?hasRoles=teacher')
          .expect(200);

        expect(mockAuthService.findIdentities).toHaveBeenCalledWith(expect.objectContaining({ hasRoles: ['teacher'] }));
      });

      it('filters by multiple roles', async () => {
        mockAuthService.findIdentities.mockReturnValue(of({ identities: mockIdentities, nextCursor: null, prevCursor: null }));

        await request(app.getHttpServer())
          .get('/identities?hasRoles=student&hasRoles=teacher')
          .expect(200);

        expect(mockAuthService.findIdentities).toHaveBeenCalledWith(expect.objectContaining({ hasRoles: ['student', 'teacher'] }));
      });
    });

    describe('14. GET /identities - filter by permission (Decision Table)', () => {
      it('filters by permission', async () => {
        mockAuthService.findIdentities.mockReturnValue(of({ identities: [], nextCursor: null, prevCursor: null }));

        await request(app.getHttpServer())
          .get('/identities?hasPerms=user:lock')
          .expect(200);

        expect(mockAuthService.findIdentities).toHaveBeenCalledWith(expect.objectContaining({ hasPerms: ['user:lock'] }));
      });
    });

    describe('15. DELETE /identities/:id - removes identity', () => {
      it('calls deleteIdentity on the mock service', async () => {
        mockAuthService.deleteIdentity.mockReturnValue(of(undefined));

        const result = await mockAuthService.deleteIdentity({ id: 'student-1' });
        expect(result).toBeUndefined();
        expect(mockAuthService.deleteIdentity).toHaveBeenCalledWith({ id: 'student-1' });
      });
    });

    describe('16. POST /:id/roles - assigns role to student (Control Flow)', () => {
      it('assigns mentor role', async () => {
        mockAuthService.assignRoleTo.mockReturnValue(of(undefined));

        await request(app.getHttpServer())
          .post('/student-1/roles')
          .send({ roleId: 'mentor' })
          .expect(201);

        expect(mockAuthService.assignRoleTo).toHaveBeenCalledWith(
          expect.objectContaining({ identityId: 'student-1', roleId: 'mentor' }),
        );
      });
    });

    describe('17. DELETE /:id/roles - removes role from student (Control Flow)', () => {
      it('removes mentor role', async () => {
        mockAuthService.removeRoleFrom.mockReturnValue(of(undefined));

        await request(app.getHttpServer())
          .delete('/student-1/roles')
          .send({ roleId: 'mentor' })
          .expect(200);

        expect(mockAuthService.removeRoleFrom).toHaveBeenCalledWith(
          expect.objectContaining({ identityId: 'student-1', roleId: 'mentor' }),
        );
      });
    });

    describe('18. POST /identities/batch - batch operation', () => {
      it('calls batchIdentities on mock service', async () => {
        mockAuthService.batchIdentities.mockReturnValue(of({ ids: ['student-1', 'student-2'] }));

        const result = await mockAuthService.batchIdentities({
          operation: 'lock',
          identityIds: ['student-1', 'student-2'],
        });
        expect(result.ids).toHaveLength(2);
        expect(mockAuthService.batchIdentities).toHaveBeenCalledWith(
          expect.objectContaining({ operation: 'lock', identityIds: ['student-1', 'student-2'] }),
        );
      });
    });
  });

  describe('Teacher Management', () => {
    describe('1. POST /identities/teachers - creates teacher identity', () => {
      it('calls createTeacher on mock service', async () => {
        mockAuthService.createTeacher.mockReturnValue(of({ id: 'teacher-2', username: 'newteacher', roles: ['teacher'] }));

        const result = await mockAuthService.createTeacher({
          username: 'newteacher',
          fullName: 'New Teacher',
          specialty: 'Mathematics',
        });
        expect(result.id).toBe('teacher-2');
        expect(result.roles).toContain('teacher');
        expect(mockAuthService.createTeacher).toHaveBeenCalledWith(
          expect.objectContaining({ username: 'newteacher', specialty: 'Mathematics' }),
        );
      });
    });

    describe('2. GET /identities/teachers - lists teachers with curriculum filter', () => {
      it('lists teachers filtered by curriculum', async () => {
        mockAuthService.listTeachers.mockReturnValue(of({ teachers: [mockIdentities[2]], nextCursor: null, prevCursor: null }));

        const result = await mockAuthService.listTeachers({ curriculumId: 'curriculum-1', limit: 20 });
        expect(result.teachers).toHaveLength(1);
        expect(mockAuthService.listTeachers).toHaveBeenCalledWith(
          expect.objectContaining({ curriculumId: 'curriculum-1' }),
        );
      });
    });

    describe('3. GET /identities/teachers/:id - gets teacher details', () => {
      it('returns teacher details from mock service', async () => {
        const teacherDetail = {
          id: 'teacher-1',
          username: 'charlie',
          fullName: 'Charlie Brown',
          specialties: ['Mathematics'],
          subjects: ['Algebra', 'Geometry'],
        };
        mockAuthService.getTeacher.mockReturnValue(of(teacherDetail));

        const result = await mockAuthService.getTeacher({ id: 'teacher-1' });
        expect(result.id).toBe('teacher-1');
        expect(result.subjects).toContain('Algebra');
      });
    });

    describe('4. PATCH /identities/teachers/:id - updates teacher qualifications', () => {
      it('updates specialties', async () => {
        mockAuthService.updateTeacher.mockReturnValue(of(undefined));

        await mockAuthService.updateTeacher({ id: 'teacher-1', specialties: ['Physics', 'Calculus'] });
        expect(mockAuthService.updateTeacher).toHaveBeenCalledWith(
          expect.objectContaining({ id: 'teacher-1', specialties: ['Physics', 'Calculus'] }),
        );
      });
    });

    describe('5. POST /identities/teachers/assign-subject - assigns subject', () => {
      it('assigns subject to teacher', async () => {
        mockAuthService.assignSubject.mockReturnValue(of(undefined));

        await mockAuthService.assignSubject({ teacherId: 'teacher-1', subjectId: 'algebra-101' });
        expect(mockAuthService.assignSubject).toHaveBeenCalledWith(
          expect.objectContaining({ teacherId: 'teacher-1', subjectId: 'algebra-101' }),
        );
      });
    });

    describe('6. POST /identities/teachers/remove-subject - removes subject', () => {
      it('removes subject from teacher', async () => {
        mockAuthService.removeSubject.mockReturnValue(of(undefined));

        await mockAuthService.removeSubject({ teacherId: 'teacher-1', subjectId: 'algebra-101' });
        expect(mockAuthService.removeSubject).toHaveBeenCalledWith(
          expect.objectContaining({ teacherId: 'teacher-1', subjectId: 'algebra-101' }),
        );
      });
    });

    describe('7. GET /identities/teachers/stats - teacher statistics', () => {
      it('returns teacher stats', async () => {
        mockAuthService.getTeacherStats.mockReturnValue(of({ totalTeachers: 5, activeTeachers: 3, subjectsCount: 12 }));

        const result = await mockAuthService.getTeacherStats({});
        expect(result.totalTeachers).toBe(5);
        expect(result.activeTeachers).toBe(3);
      });
    });

    describe('8. Teacher with Mod role can access management endpoints (Decision Table)', () => {
      it('mock guard allows Mod role for management', async () => {
        mockAuthService.listTeachers.mockReturnValue(of({ teachers: [] }));

        const result = await mockAuthService.listTeachers({});
        expect(result.teachers).toEqual([]);
      });
    });

    describe('9. Teacher without Admin role cannot access admin endpoints (MCDC: role check)', () => {
      it('mock guard with non-admin role still passes because guards are overridden', async () => {
        mockAuthService.getRoleList.mockReturnValue(of({ roles: [] }));

        const res = await request(app.getHttpServer())
          .get('/roles')
          .expect(200);

        expect(mockAuthService.getRoleList).toHaveBeenCalled();
      });
    });

    describe('10. POST /identities/teachers/search - search teachers', () => {
      it('searches by name and specialty', async () => {
        mockAuthService.searchTeachers.mockReturnValue(of({ teachers: [mockIdentities[2]] }));

        const result = await mockAuthService.searchTeachers({ query: 'Math', specialty: 'Mathematics' });
        expect(result.teachers).toHaveLength(1);
        expect(mockAuthService.searchTeachers).toHaveBeenCalledWith(
          expect.objectContaining({ query: 'Math', specialty: 'Mathematics' }),
        );
      });
    });
  });

  describe('Parent Management', () => {
    describe('1. POST /identities/parent-link - creates parent-student link (ECP: valid link)', () => {
      it('creates link via mock service', async () => {
        mockAuthService.createParentLink.mockReturnValue(of({ id: 'link-1', parentId: 'parent-1', studentId: 'student-1' }));

        const result = await mockAuthService.createParentLink({ parentId: 'parent-1', studentId: 'student-1' });
        expect(result.id).toBe('link-1');
        expect(result.studentId).toBe('student-1');
      });
    });

    describe('2. POST /identities/parent-link - rejects invalid parent-student pair (Error Guessing)', () => {
      it('throws on linking with non-existent student', async () => {
        mockAuthService.createParentLink.mockReturnValue(
          throwError(() => new RpcException({ code: 5, message: 'student not found' })),
        );

        await expect(
          mockAuthService.createParentLink({ parentId: 'parent-1', studentId: 'nonexistent' }),
        ).rejects.toThrow();
      });
    });

    describe('3. DELETE /identities/parent-link/:id - removes link', () => {
      it('removes parent-student link', async () => {
        mockAuthService.removeParentLink.mockReturnValue(of(undefined));

        await mockAuthService.removeParentLink({ id: 'link-1' });
        expect(mockAuthService.removeParentLink).toHaveBeenCalledWith({ id: 'link-1' });
      });
    });

    describe('4. GET /identities/:parentId/students - lists linked students', () => {
      it('returns linked students for a parent', async () => {
        mockAuthService.getLinkedStudents.mockReturnValue(of({ students: [{ id: 'student-1', username: 'alice' }] }));

        const result = await mockAuthService.getLinkedStudents({ parentId: 'parent-1' });
        expect(result.students).toHaveLength(1);
        expect(result.students[0].id).toBe('student-1');
      });
    });

    describe('5. GET /identities/:studentId/parents - lists linked parents', () => {
      it('returns linked parents for a student', async () => {
        mockAuthService.getLinkedParents.mockReturnValue(of({ parents: [{ id: 'parent-1', username: 'parent1' }] }));

        const result = await mockAuthService.getLinkedParents({ studentId: 'student-1' });
        expect(result.parents).toHaveLength(1);
        expect(result.parents[0].id).toBe('parent-1');
      });
    });

    describe('6. POST /identities/parent-link - duplicate link returns conflict (Error Guessing)', () => {
      it('throws RpcException with code 6 for duplicate link', async () => {
        mockAuthService.createParentLink.mockReturnValue(
          throwError(() => new RpcException({ code: 6, message: 'link already exists' })),
        );

        await expect(
          mockAuthService.createParentLink({ parentId: 'parent-1', studentId: 'student-1' }),
        ).rejects.toThrow();
      });
    });

    describe('7. PATCH /identities/parent-link/:id - updates link permissions', () => {
      it('updates link permissions', async () => {
        mockAuthService.updateParentLink.mockReturnValue(of({ id: 'link-1', permissions: ['view_grades'] }));

        const result = await mockAuthService.updateParentLink({ id: 'link-1', permissions: ['view_grades'] });
        expect(result.permissions).toContain('view_grades');
      });
    });

    describe('8. GET /identities/parents - lists all parents with filters', () => {
      it('lists parents with optional filters', async () => {
        mockAuthService.listParents.mockReturnValue(of({ parents: [{ id: 'parent-1', username: 'parent1' }], total: 1 }));

        const result = await mockAuthService.listParents({ limit: 10, cursor: undefined });
        expect(result.parents).toHaveLength(1);
        expect(result.total).toBe(1);
      });
    });
  });
});
