import {
	type IOwnershipRepository,
	IOwnershipRepositoryToken,
} from '../../domain/repositories/ownership.repository';
import { CheckOwnershipReqDto } from '../../presentation/dtos/req/check-ownership.req.dto';
import { RegisterOwnershipReqDto } from '../../presentation/dtos/req/register-ownership.req.dto';
import { RemoveOwnershipReqDto } from '../../presentation/dtos/req/remove-ownership.req.dto';
import { Controller, Inject, UseFilters } from '@nestjs/common';
import { Payload } from '@nestjs/microservices';
import { authorization } from '@server/generated';
import { GlobalRpcExceptionFilter } from '@server/utils';

@UseFilters(GlobalRpcExceptionFilter)
@authorization.AuthorizationServiceControllerMethods()
@Controller()
export class AuthorizationGrpcController implements authorization.AuthorizationServiceController {
	constructor(
		@Inject(IOwnershipRepositoryToken) private readonly ownershipRepository: IOwnershipRepository,
	) {}

	async checkOwnership(
		@Payload() request: CheckOwnershipReqDto,
	): Promise<authorization.CheckOwnershipResponse> {
		const isOwner = await this.ownershipRepository.checkOwnership(
			request.resourceType,
			request.resourceId,
			request.userId,
		);
		return { isOwner: isOwner };
	}

	async registerOwnership(@Payload() request: RegisterOwnershipReqDto): Promise<void> {
		await this.ownershipRepository.registerOwnership(
			request.resourceType,
			request.resourceId,
			request.ownerId,
		);
	}

	async removeOwnership(@Payload() request: RemoveOwnershipReqDto): Promise<void> {
		await this.ownershipRepository.removeOwnership(request.resourceType, request.resourceId);
	}
}
