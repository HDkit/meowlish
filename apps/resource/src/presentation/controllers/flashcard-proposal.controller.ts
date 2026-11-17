import { FlashcardProposalService } from '../../app/services/flashcard-proposal.service';
import { AcceptFlashCardProposalReqDto } from '../dtos/req/flash-card-proposal/accept-flash-card-proposal.req.dto';
import { CreateFlashCardProposalReqDto } from '../dtos/req/flash-card-proposal/create-flash-card-proposal.req.dto';
import { GetFlashCardProposalReqDto } from '../dtos/req/flash-card-proposal/get-flash-card-proposal.req.dto';
import { ListFlashCardProposalsReqDto } from '../dtos/req/flash-card-proposal/list-flash-card-proposals.req.dto';
import { RejectFlashCardProposalReqDto } from '../dtos/req/flash-card-proposal/reject-flash-card-proposal.req.dto';
import { WithdrawFlashCardProposalReqDto } from '../dtos/req/flash-card-proposal/withdraw-flash-card-proposal.req.dto';
import { toRequester } from '../dtos/req/requester.req.dto';
import {
	FlashCardProposalDetailDto,
	FlashCardProposalDto,
	ListFlashCardProposalsDto,
} from '../dtos/res/flash-card-proposal.res.dto';
import { Controller, SerializeOptions, UseFilters } from '@nestjs/common';
import { Payload } from '@nestjs/microservices';
import { resource } from '@server/generated';
import { GlobalRpcExceptionFilter } from '@server/utils';

@UseFilters(GlobalRpcExceptionFilter)
@resource.FlashCardProposalServiceControllerMethods()
@Controller()
export class FlashcardProposalController implements resource.FlashCardProposalServiceController {
	constructor(private readonly proposalService: FlashcardProposalService) {}

	@SerializeOptions({ type: FlashCardProposalDto, strategy: 'exposeAll' })
	async createFlashCardProposal(
		@Payload() data: CreateFlashCardProposalReqDto,
	): Promise<FlashCardProposalDto> {
		return this.proposalService.createFlashCardProposal(data, toRequester(data));
	}

	@SerializeOptions({ type: ListFlashCardProposalsDto, strategy: 'exposeAll' })
	async listFlashCardProposals(
		@Payload() data: ListFlashCardProposalsReqDto,
	): Promise<ListFlashCardProposalsDto> {
		return this.proposalService.listFlashCardProposals(data, toRequester(data));
	}

	@SerializeOptions({ type: FlashCardProposalDetailDto, strategy: 'exposeAll' })
	async getFlashCardProposal(
		@Payload() data: GetFlashCardProposalReqDto,
	): Promise<FlashCardProposalDetailDto> {
		return this.proposalService.getFlashCardProposal(data.id, toRequester(data));
	}

	@SerializeOptions({ type: FlashCardProposalDto, strategy: 'exposeAll' })
	async acceptFlashCardProposal(
		@Payload() data: AcceptFlashCardProposalReqDto,
	): Promise<FlashCardProposalDto> {
		return this.proposalService.acceptFlashCardProposal(data, toRequester(data));
	}

	@SerializeOptions({ type: FlashCardProposalDto, strategy: 'exposeAll' })
	async rejectFlashCardProposal(
		@Payload() data: RejectFlashCardProposalReqDto,
	): Promise<FlashCardProposalDto> {
		return this.proposalService.rejectFlashCardProposal(
			data.id,
			data.decisionNote,
			toRequester(data),
		);
	}

	@SerializeOptions({ type: FlashCardProposalDto, strategy: 'exposeAll' })
	async withdrawFlashCardProposal(
		@Payload() data: WithdrawFlashCardProposalReqDto,
	): Promise<FlashCardProposalDto> {
		return this.proposalService.withdrawFlashCardProposal(data.id, toRequester(data));
	}
}
