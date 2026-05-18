import { AuthController } from '../presentation/controllers/auth.controller';
import { CommandBus, CqrsModule, QueryBus } from '@nestjs/cqrs';
import { Test, TestingModule } from '@nestjs/testing';
import { AppLoggerService } from '@server/logger';

describe('AuthGrpcController', () => {
  let controller: AuthController;
  let commandBus: CommandBus;
  let queryBus: QueryBus;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [CqrsModule.forRoot()],
      controllers: [AuthController],
      providers: [
        { provide: 'winston', useValue: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn(), verbose: jest.fn() } },
        { provide: AppLoggerService, useFactory: () => new AppLoggerService({ info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn(), verbose: jest.fn() } as never) },
      ],
    }).compile();

    controller = module.get(AuthController);
    commandBus = module.get(CommandBus);
    queryBus = module.get(QueryBus);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('registerMail', () => {
    it('executes command and returns tokens', async () => {
      const mockTokens = { accessToken: 'access-token', refreshToken: 'refresh-token' };
      jest.spyOn(commandBus, 'execute').mockResolvedValue(mockTokens);

      const result = await controller.registerMail({
        mail: 'a@b.com',
        username: 'test',
        password: 'Abc123!',
      });

      expect(result).toEqual(mockTokens);
      expect(commandBus.execute).toHaveBeenCalled();
    });
  });

  describe('loginMail', () => {
    it('executes command and returns tokens', async () => {
      const mockTokens = { accessToken: 'access-token', refreshToken: 'refresh-token' };
      jest.spyOn(commandBus, 'execute').mockResolvedValue(mockTokens);

      const result = await controller.loginMail({
        mail: 'a@b.com',
        password: 'Abc123!',
      });

      expect(result).toEqual(mockTokens);
      expect(commandBus.execute).toHaveBeenCalled();
    });
  });

  describe('refresh', () => {
    it('executes command and returns tokens', async () => {
      const mockTokens = { accessToken: 'new-access-token', refreshToken: 'new-refresh-token' };
      jest.spyOn(commandBus, 'execute').mockResolvedValue(mockTokens);

      const result = await controller.refresh({ identityId: 'uid1' });

      expect(result).toEqual(mockTokens);
      expect(commandBus.execute).toHaveBeenCalled();
    });
  });

  describe('validateRefresh', () => {
    it('executes command and returns claims', async () => {
      const mockClaims = { sub: 'uid1', roles: ['user'], permissions: [] };
      jest.spyOn(commandBus, 'execute').mockResolvedValue(mockClaims);

      const result = await controller.validateRefresh({ identityId: 'uid1', iat: 1234567890 });
      expect(result).toEqual(mockClaims);
    });
  });

  describe('validateAccess', () => {
    it('executes command', async () => {
      jest.spyOn(commandBus, 'execute').mockResolvedValue(undefined);
      await controller.validateAccess({ identityId: 'uid1', iat: 1234567890 });
      expect(commandBus.execute).toHaveBeenCalled();
    });
  });

  describe('logOutAll', () => {
    it('executes command', async () => {
      jest.spyOn(commandBus, 'execute').mockResolvedValue(undefined);
      await controller.logOutAll({ identityId: 'uid1' });
      expect(commandBus.execute).toHaveBeenCalled();
    });
  });

  describe('registerOrLoginGoogle', () => {
    it('executes command and returns tokens', async () => {
      const mockTokens = { accessToken: 'google-access-token', refreshToken: 'google-refresh-token' };
      jest.spyOn(commandBus, 'execute').mockResolvedValue(mockTokens);

      const result = await controller.registerOrLoginGoogle({
        identifier: 'google-123',
        username: 'googleuser',
      });

      expect(result).toEqual(mockTokens);
      expect(commandBus.execute).toHaveBeenCalled();
    });
  });

  describe('addMailCredential', () => {
    it('executes command', async () => {
      jest.spyOn(commandBus, 'execute').mockResolvedValue(undefined);

      await controller.addMailCredential({
        identityId: 'uid1',
        mail: 'a@b.com',
        password: 'Abc12345!',
      });

      expect(commandBus.execute).toHaveBeenCalled();
    });
  });

  describe('addGoogleCredential', () => {
    it('executes command', async () => {
      jest.spyOn(commandBus, 'execute').mockResolvedValue(undefined);

      await controller.addGoogleCredential({
        identifier: 'google-456',
        identityId: 'uid1',
      });

      expect(commandBus.execute).toHaveBeenCalled();
    });
  });

  describe('removeCredential', () => {
    it('executes command', async () => {
      jest.spyOn(commandBus, 'execute').mockResolvedValue(undefined);

      await controller.removeCredential({ identityId: 'uid1', id: 'cred-1' });

      expect(commandBus.execute).toHaveBeenCalled();
    });
  });

  describe('getCredentials', () => {
    it('returns credentials', async () => {
      const mockCreds = [{ id: 'cred1', mail: 'a@b.com' }];
      jest.spyOn(queryBus, 'execute').mockResolvedValue(mockCreds);

      const result = await controller.getCredentials({ identityId: 'uid1' });
      expect(result.credentials).toEqual(mockCreds);
    });
  });

  describe('assignRoleTo', () => {
    it('executes command', async () => {
      jest.spyOn(commandBus, 'execute').mockResolvedValue(undefined);

      await controller.assignRoleTo({ identityId: 'uid1', roleId: 'role-1' });

      expect(commandBus.execute).toHaveBeenCalled();
    });
  });

  describe('removeRoleFrom', () => {
    it('executes command', async () => {
      jest.spyOn(commandBus, 'execute').mockResolvedValue(undefined);

      await controller.removeRoleFrom({ identityId: 'uid1', roleId: 'role-1' });

      expect(commandBus.execute).toHaveBeenCalled();
    });
  });

  describe('findIdentities', () => {
    it('returns identities', async () => {
      const mockResult = { identities: [{ id: 'uid1', username: 'test' }] };
      jest.spyOn(queryBus, 'execute').mockResolvedValue(mockResult);

      const result = await controller.findIdentities({ hasPerms: [], hasRoles: [] });
      expect(result).toEqual(mockResult);
    });
  });

  describe('findIdentityIds', () => {
    it('returns identity ids', async () => {
      const mockResult = { ids: ['uid1', 'uid2'], nextCursor: null, prevCursor: null };
      jest.spyOn(queryBus, 'execute').mockResolvedValue(mockResult);

      const result = await controller.findIdentityIds({});
      expect(result).toEqual(mockResult);
    });
  });

  describe('getRoleList', () => {
    it('returns role list', async () => {
      const mockRoles = [{ id: 'role-1', name: 'user', permissions: [] }];
      jest.spyOn(queryBus, 'execute').mockResolvedValue(mockRoles);

      const result = await controller.getRoleList();
      expect(result.roles).toEqual(mockRoles);
      expect(queryBus.execute).toHaveBeenCalled();
    });
  });

  describe('getPermList', () => {
    it('returns permission list', async () => {
      const mockPerms = ['read', 'write'];
      jest.spyOn(queryBus, 'execute').mockResolvedValue(mockPerms);

      const result = await controller.getPermList();
      expect(result.perms).toEqual(mockPerms);
      expect(queryBus.execute).toHaveBeenCalled();
    });
  });

  describe('updateIdentity', () => {
    it('executes command', async () => {
      jest.spyOn(commandBus, 'execute').mockResolvedValue(undefined);

      await controller.updateIdentity({ identityId: 'uid1', username: 'newname' });

      expect(commandBus.execute).toHaveBeenCalled();
    });

    it('executes command with nullable fields', async () => {
      jest.spyOn(commandBus, 'execute').mockResolvedValue(undefined);

      await controller.updateIdentity({
        identityId: 'uid1',
        setFullNameNull: true,
        setBioNull: true,
      });

      expect(commandBus.execute).toHaveBeenCalled();
    });
  });

  describe('updateMailPassword', () => {
    it('executes command', async () => {
      jest.spyOn(commandBus, 'execute').mockResolvedValue(undefined);

      await controller.updateMailPassword({
        identityId: 'uid1',
        id: 'cred-1',
        password: 'NewStr0ng!Pass',
      });

      expect(commandBus.execute).toHaveBeenCalled();
    });
  });

  describe('hydrateIdentities', () => {
    it('returns hydrated identities', async () => {
      const mockHydrated = [{ id: 'uid1', username: 'test', roles: ['user'] }];
      jest.spyOn(queryBus, 'execute').mockResolvedValue(mockHydrated);

      const result = await controller.hydrateIdentities({ identityIds: ['uid1'] });
      expect(result.identities).toEqual(mockHydrated);
    });
  });

  describe('hydrateIdentity', () => {
    it('returns hydrated identity', async () => {
      const mockIdentity = { id: 'uid1', username: 'test', roles: ['user'] };
      jest.spyOn(queryBus, 'execute').mockResolvedValue(mockIdentity);

      const result = await controller.hydrateIdentity({ identityId: 'uid1' });
      expect(result).toEqual(mockIdentity);
    });
  });

  describe('lockIdentity / unlockIdentity', () => {
    it('lockIdentity executes command', async () => {
      jest.spyOn(commandBus, 'execute').mockResolvedValue(undefined);
      await controller.lockIdentity({ identityId: 'uid1', lockedBy: 'admin1' });
      expect(commandBus.execute).toHaveBeenCalled();
    });

    it('unlockIdentity executes command', async () => {
      jest.spyOn(commandBus, 'execute').mockResolvedValue(undefined);
      await controller.unlockIdentity({ identityId: 'uid1' });
      expect(commandBus.execute).toHaveBeenCalled();
    });
  });

  describe('findIdentitiesByPhone', () => {
    it('returns identities by phone', async () => {
      const mockResult = { identities: [{ id: 'uid1', username: 'test' }], nextCursor: null, prevCursor: null };
      jest.spyOn(queryBus, 'execute').mockResolvedValue(mockResult);

      const result = await controller.findIdentitiesByPhone({
        phoneNumber: '+1234567890',
      });

      expect(result).toEqual(mockResult);
    });

    it('supports cursor and limit', async () => {
      const mockResult = { identities: [], nextCursor: null, prevCursor: null };
      jest.spyOn(queryBus, 'execute').mockResolvedValue(mockResult);

      await controller.findIdentitiesByPhone({
        phoneNumber: '+1234567890',
        cursor: 'abc',
        limit: 10,
      });

      expect(queryBus.execute).toHaveBeenCalled();
    });
  });

  describe('connectGoogleCalendar', () => {
    it('connects and returns token response', async () => {
      const mockToken = { accessToken: 'at', refreshToken: 'rt', expiresAt: 12345, scopes: 'calendar' };
      jest.spyOn(commandBus, 'execute').mockResolvedValue(undefined);
      jest.spyOn(queryBus, 'execute').mockResolvedValue(mockToken);

      const result = await controller.connectGoogleCalendar({
        identityId: 'uid1',
        accessToken: 'at',
        refreshToken: 'rt',
        expiresAt: 12345,
        scopes: 'calendar',
      });

      expect(result).toEqual(mockToken);
    });
  });

  describe('disconnectGoogleCalendar', () => {
    it('executes command', async () => {
      jest.spyOn(commandBus, 'execute').mockResolvedValue(undefined);

      await controller.disconnectGoogleCalendar({ identityId: 'uid1' });

      expect(commandBus.execute).toHaveBeenCalled();
    });
  });

  describe('getGoogleCalendarToken', () => {
    it('returns token', async () => {
      const mockToken = { accessToken: 'at', refreshToken: 'rt', expiresAt: 12345, scopes: 'calendar' };
      jest.spyOn(queryBus, 'execute').mockResolvedValue(mockToken);

      const result = await controller.getGoogleCalendarToken({ identityId: 'uid1' });

      expect(result).toEqual(mockToken);
    });
  });

  describe('refreshGoogleCalendarToken', () => {
    it('returns token', async () => {
      const mockToken = { accessToken: 'at', refreshToken: 'rt', expiresAt: 12345, scopes: 'calendar' };
      jest.spyOn(queryBus, 'execute').mockResolvedValue(mockToken);

      const result = await controller.refreshGoogleCalendarToken({ identityId: 'uid1' });

      expect(result).toEqual(mockToken);
    });
  });
});
