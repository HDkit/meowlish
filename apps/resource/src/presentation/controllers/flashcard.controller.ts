import { FlashcardService } from '../../app/services/flashcard.service';
import { CreateFlashCardReqDto } from '../dtos/req/create-flash-card.req.dto';
import { DeleteFlashCardReqDto } from '../dtos/req/delete-flash-card.req.dto';
import { GetFlashCardReqDto } from '../dtos/req/get-flash-card.req.dto';
import { ListFlashCardsReqDto } from '../dtos/req/list-flash-cards.req.dto';
import { UpdateFlashCardReqDto } from '../dtos/req/update-flash-card.req.dto';
import { FlashCardDto, ListFlashCardsDto } from '../dtos/res/flash-card.res.dto';
import { Controller, SerializeOptions, UseFilters } from '@nestjs/common';
import { Payload } from '@nestjs/microservices';
import { resource } from '@server/generated';
import { GlobalRpcExceptionFilter } from '@server/utils';

@UseFilters(GlobalRpcExceptionFilter)
@resource.FlashCardServiceControllerMethods()
@Controller()
export class FlashcardController implements resource.FlashCardServiceController {
	constructor(private readonly flashcardService: FlashcardService) {}

	@SerializeOptions({ type: FlashCardDto, strategy: 'exposeAll' })
	async createFlashCard(@Payload() data: CreateFlashCardReqDto): Promise<FlashCardDto> {
		return this.flashcardService.createFlashCard(data);
	}

	@SerializeOptions({ type: FlashCardDto, strategy: 'exposeAll' })
	async getFlashCard(@Payload() data: GetFlashCardReqDto): Promise<FlashCardDto> {
		return this.flashcardService.getFlashCard(data.id);
	}

	@SerializeOptions({ type: FlashCardDto, strategy: 'exposeAll' })
	async updateFlashCard(@Payload() data: UpdateFlashCardReqDto): Promise<FlashCardDto> {
		return this.flashcardService.updateFlashCard(data);
	}

	async deleteFlashCard(@Payload() data: DeleteFlashCardReqDto): Promise<void> {
		await this.flashcardService.deleteFlashCard(data.id);
	}

	@SerializeOptions({ type: ListFlashCardsDto, strategy: 'exposeAll' })
	async listFlashCards(@Payload() data: ListFlashCardsReqDto): Promise<ListFlashCardsDto> {
		return this.flashcardService.listFlashCards(data);
	}
}
