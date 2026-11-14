import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class GetChatLogQueryDto {
	@IsOptional()
	@IsString()
	@ApiPropertyOptional({ description: 'Only messages sent by this user' })
	uid?: string;

	@IsOptional()
	@IsString()
	@ApiPropertyOptional({
		description:
			'nextCursor (older messages) or prevCursor (newer messages) of a previous page; empty when there is no such page',
	})
	cursor?: string;

	@Type(() => Number)
	@IsInt()
	@IsOptional()
	@Max(100)
	@Min(1)
	@ApiPropertyOptional({ type: Number, default: 10 })
	limit?: number;
}
