import { FlashcardListService } from '../../app/services/flashcard-list.service';
import { AddCardToListReqDto } from '../dtos/req/add-card-to-list.req.dto';
import { CreateFlashCardListReqDto } from '../dtos/req/create-flash-card-list.req.dto';
import { DeleteFlashCardListReqDto } from '../dtos/req/delete-flash-card-list.req.dto';
import { GetFlashCardListReqDto } from '../dtos/req/get-flash-card-list.req.dto';
import { ListCardsInListReqDto } from '../dtos/req/list-cards-in-list.req.dto';
import { ListFlashCardListsReqDto } from '../dtos/req/list-flash-card-lists.req.dto';
import { RemoveCardFromListReqDto } from '../dtos/req/remove-card-from-list.req.dto';
import { UpdateFlashCardListReqDto } from '../dtos/req/update-flash-card-list.req.dto';
import { Controller, UseFilters } from '@nestjs/common';
import { Payload } from '@nestjs/microservices';
import { resource } from '@server/generated';
import { GlobalRpcExceptionFilter } from '@server/utils';

@UseFilters(GlobalRpcExceptionFilter)
@resource.FlashCardListServiceControllerMethods()
@Controller()
export class FlashcardListController implements resource.FlashCardListServiceController {
	constructor(private readonly flashcardListService: FlashcardListService) {}

	async createFlashCardList(
		@Payload() data: CreateFlashCardListReqDto,
	): Promise<resource.FlashCardListResponse> {
		return this.flashcardListService.createFlashCardList(data);
	}

	async getFlashCardList(
		@Payload() data: GetFlashCardListReqDto,
	): Promise<resource.FlashCardListDetailResponse> {
		return this.flashcardListService.getFlashCardList(data.id);
	}

	async updateFlashCardList(
		@Payload() data: UpdateFlashCardListReqDto,
	): Promise<resource.FlashCardListResponse> {
		return this.flashcardListService.updateFlashCardList(data);
	}

	async deleteFlashCardList(@Payload() data: DeleteFlashCardListReqDto): Promise<void> {
		await this.flashcardListService.deleteFlashCardList(data.id);
	}

	async listFlashCardLists(
		@Payload() data: ListFlashCardListsReqDto,
	): Promise<resource.ListFlashCardListsResponse> {
		return this.flashcardListService.listFlashCardLists(data);
	}

	async addCardToList(@Payload() data: AddCardToListReqDto): Promise<void> {
		await this.flashcardListService.addCardToList(data);
	}

	async removeCardFromList(@Payload() data: RemoveCardFromListReqDto): Promise<void> {
		await this.flashcardListService.removeCardFromList(data);
	}

	async listCardsInList(
		@Payload() data: ListCardsInListReqDto,
	): Promise<resource.ListFlashCardsResponse> {
		return this.flashcardListService.listCardsInList(data);
	}
}
