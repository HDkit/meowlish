import { live } from '@server/generated';
import { Type } from 'class-transformer';
import { IsDate, IsInt, IsOptional, IsPositive, IsString, Max } from 'class-validator';

class DateRangeDto implements live.GetChatLogRequest_DateRange {
	@Type(() => Date)
	@IsDate()
	from!: Date;

	@Type(() => Date)
	@IsDate()
	to!: Date;
}

export class GetChatLogDto implements live.GetChatLogRequest {
	@IsString()
	roomId!: string;

	@IsOptional()
	uid?: string;

	@Type(() => DateRangeDto)
	@IsOptional()
	dateRange?: DateRangeDto;

	@IsInt()
	@IsOptional()
	@IsPositive()
	@Max(100)
	limit?: number;

	@IsOptional()
	@IsString()
	cursor?: string;
}
