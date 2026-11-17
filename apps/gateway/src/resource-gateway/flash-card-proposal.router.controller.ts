import { requesterOf } from '../auth/functions/requester';
import { type AuthenticatedRequest } from '../types/authenticated-request';
import { RESOURCE_CLIENT } from './constants/resource';
import { AcceptFlashCardProposalDto } from './dtos/req/flash-card-proposal/accept-flash-card-proposal.req.dto';
import { CreateFlashCardProposalDto } from './dtos/req/flash-card-proposal/create-flash-card-proposal.req.dto';
import { ListFlashCardProposalsQueryDto } from './dtos/req/flash-card-proposal/list-flash-card-proposals.query.dto';
import { RejectFlashCardProposalDto } from './dtos/req/flash-card-proposal/reject-flash-card-proposal.req.dto';
import { FlashCardListDto } from './dtos/res/flash-card-list.dto';
import {
	FlashCardListDiffDto,
	FlashCardProposalDetailDto,
	FlashCardProposalDto,
	ListFlashCardProposalsDto,
	PullFlashCardListUpstreamDto,
} from './dtos/res/flash-card-proposal.dto';
import {
	Body,
	Controller,
	Get,
	HttpCode,
	Inject,
	OnModuleInit,
	Param,
	Post,
	Query,
	Req,
	SerializeOptions,
} from '@nestjs/common';
import { type ClientGrpc } from '@nestjs/microservices';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { resource } from '@server/generated';
import { Role } from '@server/typing';
import { ApiResponseEntity } from '@server/utils';

/** Admins may see and decide every proposal (they already manage every flash card list). */
const FLASH_CARD_ADMIN_ROLES = [Role.Admin] as const;

/**
 * Saved copies of public flash card lists and proposals to change the original (like forks and
 * pull requests). The resource service decides who may do what from the forwarded requester and
 * answers NOT_FOUND for lists and proposals that are not yours.
 */
@ApiBearerAuth()
@ApiTags('Flash card copies & proposals')
@Controller()
export class FlashCardProposalGatewayController implements OnModuleInit {
	private flashCardListService!: resource.FlashCardListServiceClient;
	private proposalService!: resource.FlashCardProposalServiceClient;

	constructor(@Inject(RESOURCE_CLIENT) private readonly resourceClient: ClientGrpc) {}

	onModuleInit() {
		this.flashCardListService = this.resourceClient.getService<resource.FlashCardListServiceClient>(
			resource.FLASH_CARD_LIST_SERVICE_NAME,
		);
		this.proposalService = this.resourceClient.getService<resource.FlashCardProposalServiceClient>(
			resource.FLASH_CARD_PROPOSAL_SERVICE_NAME,
		);
	}

	// ── Copies ───────────────────────────────────────────────────────────────

	@Post('flash-card-lists/:id/fork')
	@ApiOperation({
		summary: "Save a private copy of someone else's public list (with copies of its cards)",
	})
	@ApiResponseEntity(FlashCardListDto)
	@SerializeOptions({ type: FlashCardListDto, strategy: 'exposeAll' })
	forkFlashCardList(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
		return this.flashCardListService.forkFlashCardList({
			id: id,
			...requesterOf(req.user, FLASH_CARD_ADMIN_ROLES),
		});
	}

	@Get('flash-card-lists/:id/diff')
	@ApiOperation({
		summary: 'Compare your copy with its original: cards added, modified and removed in the copy',
	})
	@ApiResponseEntity(FlashCardListDiffDto)
	@SerializeOptions({ type: FlashCardListDiffDto, strategy: 'exposeAll' })
	getFlashCardListDiff(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
		return this.flashCardListService.getFlashCardListDiff({
			id: id,
			...requesterOf(req.user, FLASH_CARD_ADMIN_ROLES),
		});
	}

	@Post('flash-card-lists/:id/pull')
	@ApiOperation({
		summary: 'Update your copy from its original (cards you changed are left as they are)',
	})
	@ApiResponseEntity(PullFlashCardListUpstreamDto)
	@HttpCode(200)
	@SerializeOptions({ type: PullFlashCardListUpstreamDto, strategy: 'exposeAll' })
	pullFlashCardListUpstream(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
		return this.flashCardListService.pullFlashCardListUpstream({
			id: id,
			...requesterOf(req.user, FLASH_CARD_ADMIN_ROLES),
		});
	}

	// ── Proposals ────────────────────────────────────────────────────────────

	@Post('flash-card-lists/:id/proposals')
	@ApiOperation({ summary: "Propose your copy's changes to its original list" })
	@ApiResponseEntity(FlashCardProposalDto)
	@SerializeOptions({ type: FlashCardProposalDto, strategy: 'exposeAll' })
	createFlashCardProposal(
		@Req() req: AuthenticatedRequest,
		@Param('id') id: string,
		@Body() body: CreateFlashCardProposalDto,
	) {
		return this.proposalService.createFlashCardProposal({
			...body,
			sourceListId: id,
			...requesterOf(req.user, FLASH_CARD_ADMIN_ROLES),
		});
	}

	@Get('flash-card-proposals')
	@ApiOperation({
		summary: 'List proposals you made or received (filter by original, copy or status)',
	})
	@ApiResponseEntity(ListFlashCardProposalsDto)
	@SerializeOptions({ type: ListFlashCardProposalsDto, strategy: 'exposeAll' })
	listFlashCardProposals(
		@Req() req: AuthenticatedRequest,
		@Query() query: ListFlashCardProposalsQueryDto,
	) {
		return this.proposalService.listFlashCardProposals({
			...query,
			...requesterOf(req.user, FLASH_CARD_ADMIN_ROLES),
		});
	}

	@Get('flash-card-proposals/:proposalId')
	@ApiOperation({
		summary: 'Get a proposal with its changes (and conflicts with the original, while open)',
	})
	@ApiResponseEntity(FlashCardProposalDetailDto)
	@SerializeOptions({ type: FlashCardProposalDetailDto, strategy: 'exposeAll' })
	getFlashCardProposal(@Req() req: AuthenticatedRequest, @Param('proposalId') proposalId: string) {
		return this.proposalService.getFlashCardProposal({
			id: proposalId,
			...requesterOf(req.user, FLASH_CARD_ADMIN_ROLES),
		});
	}

	@Post('flash-card-proposals/:proposalId/accept')
	@ApiOperation({
		summary: 'Accept a proposal and apply it to your list (list owner or admin)',
	})
	@ApiResponseEntity(FlashCardProposalDto)
	@HttpCode(200)
	@SerializeOptions({ type: FlashCardProposalDto, strategy: 'exposeAll' })
	acceptFlashCardProposal(
		@Req() req: AuthenticatedRequest,
		@Param('proposalId') proposalId: string,
		@Body() body: AcceptFlashCardProposalDto,
	) {
		return this.proposalService.acceptFlashCardProposal({
			decisionNote: body.decisionNote,
			resolutions: body.resolutions ?? [],
			id: proposalId,
			...requesterOf(req.user, FLASH_CARD_ADMIN_ROLES),
		});
	}

	@Post('flash-card-proposals/:proposalId/reject')
	@ApiOperation({ summary: 'Reject a proposal, with an optional note (list owner or admin)' })
	@ApiResponseEntity(FlashCardProposalDto)
	@HttpCode(200)
	@SerializeOptions({ type: FlashCardProposalDto, strategy: 'exposeAll' })
	rejectFlashCardProposal(
		@Req() req: AuthenticatedRequest,
		@Param('proposalId') proposalId: string,
		@Body() body: RejectFlashCardProposalDto,
	) {
		return this.proposalService.rejectFlashCardProposal({
			...body,
			id: proposalId,
			...requesterOf(req.user, FLASH_CARD_ADMIN_ROLES),
		});
	}

	@Post('flash-card-proposals/:proposalId/withdraw')
	@ApiOperation({ summary: 'Withdraw your open proposal' })
	@ApiResponseEntity(FlashCardProposalDto)
	@HttpCode(200)
	@SerializeOptions({ type: FlashCardProposalDto, strategy: 'exposeAll' })
	withdrawFlashCardProposal(
		@Req() req: AuthenticatedRequest,
		@Param('proposalId') proposalId: string,
	) {
		return this.proposalService.withdrawFlashCardProposal({
			id: proposalId,
			...requesterOf(req.user, FLASH_CARD_ADMIN_ROLES),
		});
	}
}
