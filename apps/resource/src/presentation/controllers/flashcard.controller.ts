import { FlashcardService } from '../../app/services/flashcard.service';
import { CreateFlashCardReqDto } from '../dtos/req/create-flash-card.req.dto';
import { DeleteFlashCardReqDto } from '../dtos/req/delete-flash-card.req.dto';
import { GetFlashCardReqDto } from '../dtos/req/get-flash-card.req.dto';
import { ListFlashCardsReqDto } from '../dtos/req/list-flash-cards.req.dto';
import { UpdateFlashCardReqDto } from '../dtos/req/update-flash-card.req.dto';
import { Controller, UseFilters } from '@nestjs/common';
import { Payload } from '@nestjs/microservices';
import { resource } from '@server/generated';
import { GlobalRpcExceptionFilter } from '@server/utils';

@UseFilters(GlobalRpcExceptionFilter)
@resource.FlashCardServiceControllerMethods()
@Controller()
export class FlashcardController implements resource.FlashCardServiceController {
	constructor(private readonly flashcardService: FlashcardService) {}

	async createFlashCard(
		@Payload() data: CreateFlashCardReqDto,
	): Promise<resource.FlashCardResponse> {
		return this.flashcardService.createFlashCard(data);
	}

	async getFlashCard(@Payload() data: GetFlashCardReqDto): Promise<resource.FlashCardResponse> {
		return this.flashcardService.getFlashCard(data.id as string);
	}

	async updateFlashCard(
		@Payload() data: UpdateFlashCardReqDto,
	): Promise<resource.FlashCardResponse> {
		return this.flashcardService.updateFlashCard(data);
	}

	async deleteFlashCard(@Payload() data: DeleteFlashCardReqDto): Promise<void> {
		await this.flashcardService.deleteFlashCard(data.id as string);
	}

	async listFlashCards(
		@Payload() data: ListFlashCardsReqDto,
	): Promise<resource.ListFlashCardsResponse> {
		return this.flashcardService.listFlashCards(data);
	}
}
