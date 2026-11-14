import { ApiProperty } from '@nestjs/swagger';
import { exam } from '@server/generated';
import { Type } from 'class-transformer';
import { IsDate, ValidateNested } from 'class-validator';

class TimeRangeDto implements exam.GetUsersAttemptSummaryDto_Range {
	@Type(() => Date)
	@IsDate()
	@ApiProperty({ type: String, format: 'date-time' })
	from!: Date;

	@Type(() => Date)
	@IsDate()
	@ApiProperty({ type: String, format: 'date-time' })
	to!: Date;
}

export class GetUserCalendarDto implements Omit<exam.GetUsersAttemptSummaryDto, 'uid'> {
	@Type(() => TimeRangeDto)
	@ValidateNested()
	@ApiProperty({ type: () => TimeRangeDto })
	range!: TimeRangeDto;
}
