import { FileGatewayModule } from '../file-gateway/file.router.module';
import { FILE_CLIENT } from '../file-gateway/constants/file';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { ResourceAccessGuard } from '../auth/guards/resource-access.guard';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_PIPE, Reflector, RouterModule } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppLoggerService } from '@server/logger';
import { GlobalValidationPipe, gRPC2HttpExceptionFilter } from '@server/utils';
import { of } from 'rxjs';
import request from 'supertest';
import { Role, Permission } from '@server/typing';

const mockFileService: Record<string, jest.Mock> = {
  getPresignedUrl: jest.fn(),
};

const mockGrpcClient = {
  getService: jest.fn().mockReturnValue(mockFileService),
};

const mockWinstonLogger = { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn(), verbose: jest.fn() };

function mockGuard(guard: unknown, canActivate: boolean, user?: Record<string, unknown>) {
  return {
    canActivate: (context: import('@nestjs/common').ExecutionContext) => {
      if (user) {
        const req = context.switchToHttp().getRequest();
        req.user = { ...req.user, ...user };
      }
      return canActivate;
    },
  };
}

describe('File (4.9)', () => {
  let app: INestApplication;
  let moduleRef: TestingModule;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          load: [() => ({ env: 'test', microservicesConnection: { file: { port: 50054, host: 'localhost' } } })],
        }),
        FileGatewayModule,
        RouterModule.register([
          {
            path: '/files',
            module: FileGatewayModule,
          },
        ]),
      ],
      providers: [
        { provide: APP_PIPE, useFactory: () => new GlobalValidationPipe() },
        { provide: APP_FILTER, useFactory: () => new gRPC2HttpExceptionFilter(new AppLoggerService(mockWinstonLogger as never) as never) },
        Reflector,
        {
          provide: APP_GUARD,
          useValue: {
            canActivate: (context: import('@nestjs/common').ExecutionContext) => {
              const req = context.switchToHttp().getRequest();
              req.user = { sub: 'user-1', roles: [Role.Mod], permissions: [Permission.EXAM_APPROVE] };
              return true;
            },
          },
        },
      ],
    })
      .overrideProvider(FILE_CLIENT)
      .useValue(mockGrpcClient)
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

  describe('4.9.1 Get presigned URL', () => {
    it('POST /files returns 201 with upload URL', async () => {
      const mockResponse = {
        id: 'file-1',
        fileName: 'photo.jpg',
        uploadUrl: 'https://storage.example.com/upload/abc123',
        formData: { key: 'value' },
      };
      mockFileService.getPresignedUrl.mockReturnValue(of(mockResponse));

      const res = await request(app.getHttpServer())
        .post('/files')
        .send({
          isPublicFile: true,
          fileName: 'photo.jpg',
          fileSize: 1024000,
          contentType: 'image/jpeg',
        })
        .expect(201);

      expect(res.body.id).toBe('file-1');
      expect(res.body.uploadUrl).toBe('https://storage.example.com/upload/abc123');
    });

    it('POST /files validates required fields', async () => {
      await request(app.getHttpServer())
        .post('/files')
        .send({ fileName: 'photo.jpg' })
        .expect(400);
    });

    it('POST /files rejects invalid MIME type', async () => {
      await request(app.getHttpServer())
        .post('/files')
        .send({
          isPublicFile: true,
          fileName: 'photo.jpg',
          fileSize: 1024000,
          contentType: 'not-a-mime',
        })
        .expect(400);
    });

    it('POST /files rejects non-boolean isPublicFile', async () => {
      await request(app.getHttpServer())
        .post('/files')
        .send({
          isPublicFile: 'yes',
          fileName: 'photo.jpg',
          fileSize: 1024000,
          contentType: 'image/jpeg',
        })
        .expect(400);
    });

    it('POST /files rejects non-numeric fileSize', async () => {
      await request(app.getHttpServer())
        .post('/files')
        .send({
          isPublicFile: true,
          fileName: 'photo.jpg',
          fileSize: 'big',
          contentType: 'image/jpeg',
        })
        .expect(400);
    });
  });
});
