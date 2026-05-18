import { NotificationController } from '../presentation/controllers/notification.controller';
import { NotificationService } from '../../app/services/notification.service';
import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppLoggerService } from '@server/logger';

describe('NotificationController', () => {
  let controller: NotificationController;
  let notificationService: NotificationService;

  const mockNotification = {
    id: 'notif-1',
    recipientId: 'user-1',
    type: 'INFO',
    title: 'Test Notification',
    message: 'This is a test notification',
    data: undefined,
    isRead: false,
    readAt: undefined,
    createdAt: new Date().toISOString(),
  };

  const mockNotificationService = {
    createNotification: jest.fn(),
    getNotification: jest.fn(),
    deleteNotification: jest.fn(),
    listNotifications: jest.fn(),
    markAsRead: jest.fn(),
    markAllAsRead: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationController],
      providers: [
        { provide: NotificationService, useValue: mockNotificationService },
        { provide: 'winston', useValue: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn(), verbose: jest.fn() } },
        { provide: AppLoggerService, useFactory: () => new AppLoggerService({ info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn(), verbose: jest.fn() } as never) },
      ],
    }).compile();

    controller = module.get(NotificationController);
    notificationService = module.get(NotificationService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createNotification', () => {
    it('executes command and returns notification', async () => {
      mockNotificationService.createNotification.mockResolvedValue(mockNotification);

      const result = await controller.createNotification({
        recipientId: 'user-1',
        type: 'INFO',
        title: 'Test Notification',
        message: 'This is a test notification',
      });

      expect(result).toEqual(mockNotification);
      expect(mockNotificationService.createNotification).toHaveBeenCalledWith({
        recipientId: 'user-1',
        type: 'INFO',
        title: 'Test Notification',
        message: 'This is a test notification',
      });
    });

    it('validates with optional data field', async () => {
      const notifWithData = { ...mockNotification, data: '{"priority":"high","category":"system"}' };
      mockNotificationService.createNotification.mockResolvedValue(notifWithData);

      const result = await controller.createNotification({
        recipientId: 'user-2',
        type: 'ALERT',
        title: 'Alert',
        message: 'Something happened',
        data: '{"priority":"high","category":"system"}',
      });

      expect(result.data).toBe('{"priority":"high","category":"system"}');
      expect(mockNotificationService.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({ data: '{"priority":"high","category":"system"}' }),
      );
    });
  });

  describe('getNotification', () => {
    it('returns notification', async () => {
      mockNotificationService.getNotification.mockResolvedValue(mockNotification);

      const result = await controller.getNotification({ id: 'notif-1' });

      expect(result).toEqual(mockNotification);
      expect(mockNotificationService.getNotification).toHaveBeenCalledWith('notif-1');
    });

    it('throws NotFoundException when not found', async () => {
      mockNotificationService.getNotification.mockRejectedValue(new NotFoundException('Notification not found'));

      await expect(controller.getNotification({ id: 'nonexistent' })).rejects.toThrow(NotFoundException);
      expect(mockNotificationService.getNotification).toHaveBeenCalledWith('nonexistent');
    });
  });

  describe('deleteNotification', () => {
    it('executes command', async () => {
      mockNotificationService.deleteNotification.mockResolvedValue(undefined);

      await controller.deleteNotification({ id: 'notif-1' });

      expect(mockNotificationService.deleteNotification).toHaveBeenCalledWith('notif-1');
    });

    it('handles not found error', async () => {
      mockNotificationService.deleteNotification.mockRejectedValue(new NotFoundException('Notification not found'));

      await expect(controller.deleteNotification({ id: 'nonexistent' })).rejects.toThrow(NotFoundException);
    });
  });

  describe('listNotifications', () => {
    const paginatedResult = {
      notifications: [
        { id: 'notif-1', recipientId: 'user-1', type: 'INFO', title: 'Hello', message: 'Welcome', isRead: false, createdAt: new Date().toISOString() },
      ],
      totalCount: 1,
      unreadCount: 1,
    };

    it('returns paginated list', async () => {
      mockNotificationService.listNotifications.mockResolvedValue(paginatedResult);

      const result = await controller.listNotifications({
        recipientId: 'user-1',
        page: 1,
        limit: 10,
      });

      expect(result.notifications).toHaveLength(1);
      expect(result.totalCount).toBe(1);
      expect(mockNotificationService.listNotifications).toHaveBeenCalledWith({
        recipientId: 'user-1',
        page: 1,
        limit: 10,
      });
    });

    it('respects default pagination when page and limit are omitted', async () => {
      const defaultResult = { notifications: [], totalCount: 0, unreadCount: 0 };
      mockNotificationService.listNotifications.mockResolvedValue(defaultResult);

      await controller.listNotifications({ recipientId: 'user-1' });

      expect(mockNotificationService.listNotifications).toHaveBeenCalledWith({
        recipientId: 'user-1',
      });
    });

    it('filters by type', async () => {
      mockNotificationService.listNotifications.mockResolvedValue({ notifications: [], totalCount: 0, unreadCount: 0 });

      await controller.listNotifications({ recipientId: 'user-1', type: 'ALERT' });

      expect(mockNotificationService.listNotifications).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'ALERT' }),
      );
    });

    it('filters by isRead', async () => {
      mockNotificationService.listNotifications.mockResolvedValue({ notifications: [], totalCount: 0, unreadCount: 0 });

      await controller.listNotifications({ recipientId: 'user-1', isRead: false });

      expect(mockNotificationService.listNotifications).toHaveBeenCalledWith(
        expect.objectContaining({ isRead: false }),
      );
    });
  });

  describe('markAsRead', () => {
    it('executes command and returns updated notification', async () => {
      const updatedNotif = { ...mockNotification, isRead: true, readAt: new Date().toISOString() };
      mockNotificationService.markAsRead.mockResolvedValue(updatedNotif);

      const result = await controller.markAsRead({ id: 'notif-1' });

      expect(result.isRead).toBe(true);
      expect(result.readAt).toBeDefined();
      expect(mockNotificationService.markAsRead).toHaveBeenCalledWith('notif-1');
    });

    it('returns isRead=true', async () => {
      const readNotif = { ...mockNotification, isRead: true, readAt: new Date().toISOString() };
      mockNotificationService.markAsRead.mockResolvedValue(readNotif);

      const result = await controller.markAsRead({ id: 'notif-1' });

      expect(result.isRead).toBe(true);
    });
  });

  describe('markAllAsRead', () => {
    it('executes command', async () => {
      mockNotificationService.markAllAsRead.mockResolvedValue(undefined);

      await controller.markAllAsRead({ recipientId: 'user-1' });

      expect(mockNotificationService.markAllAsRead).toHaveBeenCalledWith('user-1');
    });

    it('uses recipientId from request', async () => {
      mockNotificationService.markAllAsRead.mockResolvedValue(undefined);

      await controller.markAllAsRead({ recipientId: 'user-42' });

      expect(mockNotificationService.markAllAsRead).toHaveBeenCalledWith('user-42');
    });
  });

  describe('Control Flow', () => {
    it('creates multiple notifications in sequence', async () => {
      const notif1 = { ...mockNotification, id: 'notif-seq-1', title: 'First' };
      const notif2 = { ...mockNotification, id: 'notif-seq-2', title: 'Second' };
      const notif3 = { ...mockNotification, id: 'notif-seq-3', title: 'Third' };

      mockNotificationService.createNotification
        .mockResolvedValueOnce(notif1)
        .mockResolvedValueOnce(notif2)
        .mockResolvedValueOnce(notif3);

      const result1 = await controller.createNotification({
        recipientId: 'user-1', type: 'INFO', title: 'First', message: 'First notification',
      });
      const result2 = await controller.createNotification({
        recipientId: 'user-1', type: 'INFO', title: 'Second', message: 'Second notification',
      });
      const result3 = await controller.createNotification({
        recipientId: 'user-1', type: 'INFO', title: 'Third', message: 'Third notification',
      });

      expect(result1.title).toBe('First');
      expect(result2.title).toBe('Second');
      expect(result3.title).toBe('Third');
      expect(mockNotificationService.createNotification).toHaveBeenCalledTimes(3);
    });
  });
});
