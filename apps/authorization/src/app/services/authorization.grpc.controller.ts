import {
	type IOwnershipRepository,
	IOwnershipRepositoryToken,
} from '../../domain/repositories/ownership.repository';
import { CheckOwnershipReqDto } from '../../presentation/dtos/req/check-ownership.req.dto';
import { CheckOwnershipResponseDto } from '../../presentation/dtos/res/check-ownership.res.dto';
import { Controller, Inject, SerializeOptions, UseFilters } from '@nestjs/common';
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

	@SerializeOptions({ type: CheckOwnershipResponseDto, strategy: 'exposeAll' })
	async checkOwnership(
		@Payload() request: CheckOwnershipReqDto,
	): Promise<CheckOwnershipResponseDto> {
		const isOwner = await this.ownershipRepository.checkOwnership(
			request.resourceType,
			request.resourceId,
			request.userId,
		);
		return { isOwner: isOwner };
	}
}
