import { AuthenticatedRequest } from '../../types/authenticated-request';
import { AUTHORIZATION_CLIENT } from '../../authorization-gateway/constants/authorization';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import {
	RESOURCE_ACCESS_KEY,
	type ResourceAccessOptions,
} from '../decorators/resource-access.decorator';
import {
	CanActivate,
	ExecutionContext,
	ForbiddenException,
	Inject,
	Injectable,
	OnModuleInit,
	Optional,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { type ClientGrpc } from '@nestjs/microservices';
import { authorization } from '@server/generated';
import { parseEnum } from '@server/utils';
import { Role } from '@server/typing';
import { lastValueFrom } from 'rxjs';

@Injectable()
export class ResourceAccessGuard implements CanActivate, OnModuleInit {
	private authorizationService?: authorization.AuthorizationServiceClient;

	constructor(
		private readonly reflector: Reflector,
		@Optional() @Inject(AUTHORIZATION_CLIENT) private readonly authorizationClient?: ClientGrpc,
	) {}

	onModuleInit() {
		if (this.authorizationClient) {
			this.authorizationService =
				this.authorizationClient.getService<authorization.AuthorizationServiceClient>(
					authorization.AUTHORIZATION_SERVICE_NAME,
				);
		}
	}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
			context.getHandler(),
			context.getClass(),
		]);
		if (isPublic) return true;

		const accessOptions = this.reflector.getAllAndOverride<ResourceAccessOptions>(
			RESOURCE_ACCESS_KEY,
			[context.getHandler(), context.getClass()],
		);
		if (!accessOptions) return true;

		const { user } = context.switchToHttp().getRequest<Partial<AuthenticatedRequest>>();
		if (!user) throw new Error('Requires JwtAuthGuard on this route');

		const userRoles = user.roles ?? [];
		const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
		const resourceId = request.params[accessOptions.resourceIdParam] as string;

		for (const rule of accessOptions.rules) {
			const hasRole = rule.roles.some((role) => userRoles.includes(parseEnum(Role, role)));
			if (!hasRole) continue;

			if (!rule.requireOwnership) return true;

			if (!resourceId) continue;

			if (!this.authorizationService) {
				throw new Error('Authorization service not available for ownership check');
			}

			const result = await lastValueFrom(
				this.authorizationService.checkOwnership({
					userId: user.sub,
					resourceType: accessOptions.resourceType,
					resourceId,
				}),
			);

			if (result.isOwner) return true;
		}

		throw new ForbiddenException(
			'Access denied. You do not have the required role or ownership for this resource.',
		);
	}
}
