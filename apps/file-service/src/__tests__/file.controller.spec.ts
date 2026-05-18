import { FileController } from '../presentation/controllers/file.controller';
import { FileService } from '../app/services/file.service';
import { Test, TestingModule } from '@nestjs/testing';
import { AppLoggerService } from '@server/logger';

describe('FileController', () => {
  let controller: FileController;
  let fileService: jest.Mocked<FileService>;

  beforeEach(async () => {
    const mockFileService = {
      getPresignedUrl: jest.fn(),
      getFilesUrls: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [FileController],
      providers: [
        { provide: 'winston', useValue: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn(), verbose: jest.fn() } },
        { provide: AppLoggerService, useFactory: () => new AppLoggerService({ info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn(), verbose: jest.fn() } as never) },
        { provide: FileService, useValue: mockFileService },
      ],
    }).compile();

    controller = module.get(FileController);
    fileService = module.get(FileService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getPresignedUrl', () => {
    it('returns presigned URL with valid params', async () => {
      const mockResponse = {
        id: 'file-1',
        uploadUrl: 'https://minio.example.com/upload',
        formData: { key: 'file-1', 'Content-Type': 'image/png' },
        fileName: 'photo.png',
      };
      fileService.getPresignedUrl.mockResolvedValue(mockResponse);

      const result = await controller.getPresignedUrl({
        contentType: 'image/png',
        fileName: 'photo.png',
        fileSize: 5 * 1024 * 1024,
        isPublicFile: true,
      });

      expect(result).toEqual(mockResponse);
      expect(fileService.getPresignedUrl).toHaveBeenCalledWith(
        { contentType: 'image/png', fileName: 'photo.png', fileSize: 5 * 1024 * 1024 },
        true,
      );
    });

    it('rejects invalid MIME type', async () => {
      fileService.getPresignedUrl.mockRejectedValue(
        new Error('Invalid file type. Allowed types: image/jpeg, image/png, application/pdf, video/mp4, audio/mpeg'),
      );

      await expect(
        controller.getPresignedUrl({
          contentType: 'application/x-shockwave-flash',
          fileName: 'bad.swf',
          fileSize: 1024,
          isPublicFile: false,
        }),
      ).rejects.toThrow('Invalid file type');
      expect(fileService.getPresignedUrl).toHaveBeenCalled();
    });

    it('rejects file size over 10MB', async () => {
      const oversized = 10 * 1024 * 1024 + 1;
      fileService.getPresignedUrl.mockRejectedValue(
        new Error('File is too large. Maximum allowed size is 10MB.'),
      );

      await expect(
        controller.getPresignedUrl({
          contentType: 'image/jpeg',
          fileName: 'large.jpg',
          fileSize: oversized,
          isPublicFile: false,
        }),
      ).rejects.toThrow('File is too large');
      expect(fileService.getPresignedUrl).toHaveBeenCalledWith(
        { contentType: 'image/jpeg', fileName: 'large.jpg', fileSize: oversized },
        false,
      );
    });

    it('validates isPublicFile boolean', async () => {
      const mockResponse = {
        id: 'file-2',
        uploadUrl: 'https://minio.example.com/upload',
        formData: { key: 'file-2' },
        fileName: 'doc.pdf',
      };
      fileService.getPresignedUrl.mockResolvedValue(mockResponse);

      await controller.getPresignedUrl({
        contentType: 'application/pdf',
        fileName: 'doc.pdf',
        fileSize: 1024,
        isPublicFile: true,
      });
      expect(fileService.getPresignedUrl).toHaveBeenCalledWith(
        expect.any(Object),
        true,
      );

      await controller.getPresignedUrl({
        contentType: 'application/pdf',
        fileName: 'doc.pdf',
        fileSize: 1024,
        isPublicFile: false,
      });
      expect(fileService.getPresignedUrl).toHaveBeenCalledWith(
        expect.any(Object),
        false,
      );
    });
  });

  describe('getUrls', () => {
    it('returns URLs for given file IDs', async () => {
      const mockUrls = {
        'file-1': 'https://minio.example.com/public/file-1',
        'file-2': 'https://minio.example.com/private/file-2',
      };
      fileService.getFilesUrls.mockResolvedValue(mockUrls);

      const result = await controller.getUrls({ ids: ['file-1', 'file-2'] });

      expect(result.urls).toEqual(mockUrls);
      expect(fileService.getFilesUrls).toHaveBeenCalledWith(['file-1', 'file-2']);
    });
  });
});
