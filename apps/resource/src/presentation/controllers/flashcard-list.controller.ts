import { FlashcardForkService } from '../../app/services/flashcard-fork.service';
import { FlashcardListService } from '../../app/services/flashcard-list.service';
import { AddCardToListReqDto } from '../dtos/req/add-card-to-list.req.dto';
import { CreateFlashCardListReqDto } from '../dtos/req/create-flash-card-list.req.dto';
import { DeleteFlashCardListReqDto } from '../dtos/req/delete-flash-card-list.req.dto';
import { ForkFlashCardListReqDto } from '../dtos/req/fork-flash-card-list.req.dto';
import { GetFlashCardListDiffReqDto } from '../dtos/req/get-flash-card-list-diff.req.dto';
import { GetFlashCardListReqDto } from '../dtos/req/get-flash-card-list.req.dto';
import { ListCardsInListReqDto } from '../dtos/req/list-cards-in-list.req.dto';
import { ListFlashCardListsReqDto } from '../dtos/req/list-flash-card-lists.req.dto';
import { PullFlashCardListUpstreamReqDto } from '../dtos/req/pull-flash-card-list-upstream.req.dto';
import { toRequester } from '../dtos/req/requester.req.dto';
import { UpdateFlashCardListReqDto } from '../dtos/req/update-flash-card-list.req.dto';
import {
	FlashCardListDetailDto,
	FlashCardListDto,
	ListFlashCardListsDto,
} from '../dtos/res/flash-card-list.res.dto';
import {
	FlashCardListDiffDto,
	PullFlashCardListUpstreamDto,
} from '../dtos/res/flash-card-proposal.res.dto';
import { ListFlashCardsDto } from '../dtos/res/flash-card.res.dto';
import { Controller, SerializeOptions, UseFilters } from '@nestjs/common';
import { Payload } from '@nestjs/microservices';
import { resource } from '@server/generated';
import { GlobalRpcExceptionFilter } from '@server/utils';

@UseFilters(GlobalRpcExceptionFilter)
@resource.FlashCardListServiceControllerMethods()
@Controller()
export class FlashcardListController implements resource.FlashCardListServiceController {
	constructor(
		private readonly flashcardListService: FlashcardListService,
		private readonly flashcardForkService: FlashcardForkService,
	) {}

	@SerializeOptions({ type: FlashCardListDto, strategy: 'exposeAll' })
	async createFlashCardList(@Payload() data: CreateFlashCardListReqDto): Promise<FlashCardListDto> {
		return this.flashcardListService.createFlashCardList(data);
	}

	@SerializeOptions({ type: FlashCardListDetailDto, strategy: 'exposeAll' })
	async getFlashCardList(@Payload() data: GetFlashCardListReqDto): Promise<FlashCardListDetailDto> {
		return this.flashcardListService.getFlashCardList(data.id, toRequester(data));
	}

	@SerializeOptions({ type: FlashCardListDto, strategy: 'exposeAll' })
	async updateFlashCardList(@Payload() data: UpdateFlashCardListReqDto): Promise<FlashCardListDto> {
		return this.flashcardListService.updateFlashCardList(data, toRequester(data));
	}

	async deleteFlashCardList(@Payload() data: DeleteFlashCardListReqDto): Promise<void> {
		await this.flashcardListService.deleteFlashCardList(data.id, toRequester(data));
	}

	@SerializeOptions({ type: ListFlashCardListsDto, strategy: 'exposeAll' })
	async listFlashCardLists(
		@Payload() data: ListFlashCardListsReqDto,
	): Promise<ListFlashCardListsDto> {
		return this.flashcardListService.listFlashCardLists(data, toRequester(data));
	}

	async addCardToList(@Payload() data: AddCardToListReqDto): Promise<void> {
		await this.flashcardListService.addCardToList(data.listId, data.flashCardId, toRequester(data));
	}

	@SerializeOptions({ type: ListFlashCardsDto, strategy: 'exposeAll' })
	async listCardsInList(@Payload() data: ListCardsInListReqDto): Promise<ListFlashCardsDto> {
		return this.flashcardListService.listCardsInList(data, toRequester(data));
	}

	@SerializeOptions({ type: FlashCardListDto, strategy: 'exposeAll' })
	async forkFlashCardList(@Payload() data: ForkFlashCardListReqDto): Promise<FlashCardListDto> {
		return this.flashcardForkService.forkFlashCardList(data.id, toRequester(data));
	}

	@SerializeOptions({ type: FlashCardListDiffDto, strategy: 'exposeAll' })
	async getFlashCardListDiff(
		@Payload() data: GetFlashCardListDiffReqDto,
	): Promise<FlashCardListDiffDto> {
		return this.flashcardForkService.getFlashCardListDiff(data.id, toRequester(data));
	}

	@SerializeOptions({ type: PullFlashCardListUpstreamDto, strategy: 'exposeAll' })
	async pullFlashCardListUpstream(
		@Payload() data: PullFlashCardListUpstreamReqDto,
	): Promise<PullFlashCardListUpstreamDto> {
		return this.flashcardForkService.pullFlashCardListUpstream(data.id, toRequester(data));
	}
}
