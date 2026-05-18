import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { ResourceAccessGuard } from '../auth/guards/resource-access.guard';
import { AUTHORIZATION_CLIENT } from '../authorization-gateway/constants/authorization';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { of } from 'rxjs';
import { Role, Permission } from '@server/typing';

interface MockContextOptions {
  isPublic?: boolean;
  roles?: Role[];
  permissions?: Permission[];
  resourceAccess?: unknown;
  user?: Record<string, unknown>;
  params?: Record<string, string>;
}

function mockContext(overrides: MockContextOptions = {}): ExecutionContext {
  const {
    isPublic = false,
    user = { sub: 'uid1', roles: [], permissions: [] },
    params = {},
  } = overrides;

  return {
    getHandler: jest.fn(),
    getClass: jest.fn(),
    switchToHttp: () => ({
      getRequest: () => ({ user, params }),
      getResponse: jest.fn(),
    }),
  } as unknown as ExecutionContext;
}

describe('Guards Integration (4.4)', () => {
  let jwtAuthGuard: JwtAuthGuard;
  let rolesGuard: RolesGuard;
  let permissionsGuard: PermissionsGuard;
  let resourceAccessGuard: ResourceAccessGuard;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        Reflector,
        JwtAuthGuard,
        RolesGuard,
        PermissionsGuard,
        ResourceAccessGuard,
        {
          provide: AUTHORIZATION_CLIENT,
          useValue: {
            getService: jest.fn().mockReturnValue({
              checkOwnership: jest.fn().mockReturnValue(of({ isOwner: false })),
            }),
          },
        },
      ],
    }).compile();

    jwtAuthGuard = module.get(JwtAuthGuard);
    rolesGuard = module.get(RolesGuard);
    permissionsGuard = module.get(PermissionsGuard);
    resourceAccessGuard = module.get(ResourceAccessGuard);
    resourceAccessGuard.onModuleInit();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('4.4.1 JwtAuthGuard', () => {
    it('passes for @IsPublic() routes', async () => {
      const reflector = (jwtAuthGuard as unknown as { reflector: Reflector }).reflector;
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true);

      const ctx = mockContext();
      const result = await jwtAuthGuard.canActivate(ctx);
      expect(result).toBe(true);
    });

    it('calls super.canActivate for non-public routes', async () => {
      const reflector = (jwtAuthGuard as unknown as { reflector: Reflector }).reflector;
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
      const ctx = mockContext();

      await expect(jwtAuthGuard.canActivate(ctx)).rejects.toThrow();
    });
  });

  describe('4.4.2 RolesGuard', () => {
    it('passes for @IsPublic() routes', () => {
      const reflector = (rolesGuard as unknown as { reflector: Reflector }).reflector;
      jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key: unknown) => {
        if (key === 'isPublic') return true;
        return undefined;
      });

      const ctx = mockContext();
      expect(rolesGuard.canActivate(ctx)).toBe(true);
    });

    it('passes when no roles are required', () => {
      const reflector = (rolesGuard as unknown as { reflector: Reflector }).reflector;
      jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key: unknown) => {
        if (key === 'isPublic') return false;
        return undefined;
      });

      const ctx = mockContext();
      expect(rolesGuard.canActivate(ctx)).toBe(true);
    });

    it('passes for user with Admin role', () => {
      const reflector = (rolesGuard as unknown as { reflector: Reflector }).reflector;
      jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key: unknown) => {
        if (key === 'isPublic') return false;
        if (key === 'roles') return [Role.Admin];
        return undefined;
      });

      const ctx = mockContext({ user: { sub: 'uid1', roles: [Role.Admin], permissions: [] } });
      expect(rolesGuard.canActivate(ctx)).toBe(true);
    });

    it('blocks user without required role', () => {
      const reflector = (rolesGuard as unknown as { reflector: Reflector }).reflector;
      jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key: unknown) => {
        if (key === 'isPublic') return false;
        if (key === 'roles') return [Role.Admin];
        return undefined;
      });

      const ctx = mockContext({ user: { sub: 'uid1', roles: [Role.User], permissions: [] } });
      expect(() => rolesGuard.canActivate(ctx)).toThrow(ForbiddenException);
    });

    it('passes for Mod with required role', () => {
      const reflector = (rolesGuard as unknown as { reflector: Reflector }).reflector;
      jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key: unknown) => {
        if (key === 'isPublic') return false;
        if (key === 'roles') return [Role.Mod];
        return undefined;
      });

      const ctx = mockContext({ user: { sub: 'uid1', roles: [Role.Mod], permissions: [] } });
      expect(rolesGuard.canActivate(ctx)).toBe(true);
    });
  });

  describe('4.4.3 PermissionsGuard', () => {
    it('passes for @IsPublic() routes', () => {
      const reflector = (permissionsGuard as unknown as { reflector: Reflector }).reflector;
      jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key: unknown) => {
        if (key === 'isPublic') return true;
        return undefined;
      });

      const ctx = mockContext();
      expect(permissionsGuard.canActivate(ctx)).toBe(true);
    });

    it('passes when no permissions are required', () => {
      const reflector = (permissionsGuard as unknown as { reflector: Reflector }).reflector;
      jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key: unknown) => {
        if (key === 'isPublic') return false;
        return undefined;
      });

      const ctx = mockContext();
      expect(permissionsGuard.canActivate(ctx)).toBe(true);
    });

    it('passes for user with required permission', () => {
      const reflector = (permissionsGuard as unknown as { reflector: Reflector }).reflector;
      jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key: unknown) => {
        if (key === 'isPublic') return false;
        if (key === 'permissions') return [Permission.USER_LOCK];
        return undefined;
      });

      const ctx = mockContext({
        user: { sub: 'uid1', roles: [Role.Admin], permissions: [Permission.USER_LOCK] },
      });
      expect(permissionsGuard.canActivate(ctx)).toBe(true);
    });

    it('blocks user without required permission', () => {
      const reflector = (permissionsGuard as unknown as { reflector: Reflector }).reflector;
      jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key: unknown) => {
        if (key === 'isPublic') return false;
        if (key === 'permissions') return [Permission.USER_LOCK];
        return undefined;
      });

      const ctx = mockContext({
        user: { sub: 'uid1', roles: [Role.User], permissions: [] },
      });
      expect(() => permissionsGuard.canActivate(ctx)).toThrow(ForbiddenException);
    });
  });

  describe('4.4.4 ResourceAccessGuard', () => {
    const resourceAccessOptions = {
      resourceType: 'exam',
      resourceIdParam: 'id',
      rules: [
        { roles: [Role.Admin] },
        { roles: [Role.Mod], requireOwnership: true },
      ],
    };

    it('4.4.1 Admin has access without ownership', async () => {
      const reflector = (resourceAccessGuard as unknown as { reflector: Reflector }).reflector;
      jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key: unknown) => {
        if (key === 'isPublic') return false;
        if (key === 'resource_access') return resourceAccessOptions;
        return undefined;
      });

      const ctx = mockContext({
        user: { sub: 'uid1', roles: [Role.Admin], permissions: [] },
        params: { id: 'exam1' },
      });

      const result = await resourceAccessGuard.canActivate(ctx);
      expect(result).toBe(true);
    });

    it('4.4.3 Mod who does not own resource is denied', async () => {
      const reflector = (resourceAccessGuard as unknown as { reflector: Reflector }).reflector;
      jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key: unknown) => {
        if (key === 'isPublic') return false;
        if (key === 'resource_access') return resourceAccessOptions;
        return undefined;
      });

      const ctx = mockContext({
        user: { sub: 'uid1', roles: [Role.Mod], permissions: [] },
        params: { id: 'exam2' },
      });

      await expect(resourceAccessGuard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
    });

    it('4.4.4 Learner is denied', async () => {
      const reflector = (resourceAccessGuard as unknown as { reflector: Reflector }).reflector;
      jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key: unknown) => {
        if (key === 'isPublic') return false;
        if (key === 'resource_access') return resourceAccessOptions;
        return undefined;
      });

      const ctx = mockContext({
        user: { sub: 'uid1', roles: [Role.User], permissions: [] },
        params: { id: 'exam1' },
      });

      await expect(resourceAccessGuard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
    });
  });
});
