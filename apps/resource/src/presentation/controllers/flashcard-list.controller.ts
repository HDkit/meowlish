import { FlashcardListService } from '../../app/services/flashcard-list.service';
import { Controller } from '@nestjs/common';
import { resource } from '@server/generated';

@resource.FlashCardListServiceControllerMethods()
@Controller()
export class FlashcardListController implements resource.FlashCardListServiceController {
	constructor(private readonly flashcardListService: FlashcardListService) {}

	async createFlashCardList(
		data: resource.CreateFlashCardListRequest,
	): Promise<resource.FlashCardListResponse> {
		return this.flashcardListService.createFlashCardList(data);
	}

	async getFlashCardList(
		data: resource.GetFlashCardListRequest,
	): Promise<resource.FlashCardListDetailResponse> {
		return this.flashcardListService.getFlashCardList(data.id as string);
	}

	async updateFlashCardList(
		data: resource.UpdateFlashCardListRequest,
	): Promise<resource.FlashCardListResponse> {
		return this.flashcardListService.updateFlashCardList(data);
	}

	async deleteFlashCardList(data: resource.DeleteFlashCardListRequest): Promise<void> {
		await this.flashcardListService.deleteFlashCardList(data.id as string);
	}

	async listFlashCardLists(
		data: resource.ListFlashCardListsRequest,
	): Promise<resource.ListFlashCardListsResponse> {
		return this.flashcardListService.listFlashCardLists(data);
	}

	async addCardToList(data: resource.AddCardToListRequest): Promise<void> {
		await this.flashcardListService.addCardToList(data);
	}

	async removeCardFromList(data: resource.RemoveCardFromListRequest): Promise<void> {
		await this.flashcardListService.removeCardFromList(data);
	}

	async listCardsInList(
		data: resource.ListCardsInListRequest,
	): Promise<resource.ListFlashCardsResponse> {
		return this.flashcardListService.listCardsInList(data);
	}
}
