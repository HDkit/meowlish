import { FlashcardService } from '../../app/services/flashcard.service';
import { Controller } from '@nestjs/common';
import { resource } from '@server/generated';

@resource.FlashCardServiceControllerMethods()
@Controller()
export class FlashcardController implements resource.FlashCardServiceController {
	constructor(private readonly flashcardService: FlashcardService) {}

	async createFlashCard(
		data: resource.CreateFlashCardRequest,
	): Promise<resource.FlashCardResponse> {
		return this.flashcardService.createFlashCard(data);
	}

	async getFlashCard(data: resource.GetFlashCardRequest): Promise<resource.FlashCardResponse> {
		return this.flashcardService.getFlashCard(data.id as string);
	}

	async updateFlashCard(
		data: resource.UpdateFlashCardRequest,
	): Promise<resource.FlashCardResponse> {
		return this.flashcardService.updateFlashCard(data);
	}

	async deleteFlashCard(data: resource.DeleteFlashCardRequest): Promise<void> {
		await this.flashcardService.deleteFlashCard(data.id as string);
	}

	async listFlashCards(
		data: resource.ListFlashCardsRequest,
	): Promise<resource.ListFlashCardsResponse> {
		return this.flashcardService.listFlashCards(data);
	}
}
