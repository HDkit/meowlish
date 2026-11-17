import { ApiPropertyOptional } from '@nestjs/swagger';
import { exam } from '@server/generated';
import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsPositive, IsString, ValidateNested } from 'class-validator';

class OptionsDto implements exam.AttemptDto_Options {
	@IsNumber()
	@IsOptional()
	@IsPositive()
	@ApiPropertyOptional({ type: Number })
	duration?: number;

	@IsOptional()
	@IsString({ each: true })
	@ApiPropertyOptional({ type: [String] })
	sectionIds: string[] = [];
}

export class AttemptDto implements Omit<exam.AttemptDto, 'userId' | 'examId'> {
	@Type(() => OptionsDto)
	@IsOptional()
	@ValidateNested()
	@ApiPropertyOptional({ type: () => OptionsDto })
	options?: OptionsDto;
}
