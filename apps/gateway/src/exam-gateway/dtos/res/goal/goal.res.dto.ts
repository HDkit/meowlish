import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

export class GoalResDto {
	@Expose()
	@ApiPropertyOptional({ type: String, format: 'date-time' })
	date!: Date;

	@Expose()
	@ApiProperty({ type: Number })
	target!: number;

	@Expose()
	@ApiProperty()
	type!: string;

	@Expose()
	@ApiProperty()
	uid!: string;
}
