import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';

export class BlogDto {
	@Expose()
	@ApiProperty()
	id!: string;

	@Expose()
	@ApiProperty()
	title!: string;

	@Expose()
	@ApiProperty()
	content!: string;

	@Expose()
	@ApiProperty()
	authorId!: string;

	@Expose()
	@ApiProperty({ type: [String] })
	tags!: string[];

	@Expose()
	@ApiProperty({ type: String, format: 'date-time' })
	createdAt!: Date;

	@Expose()
	@ApiProperty({ type: String, format: 'date-time' })
	updatedAt!: Date;
}

export class ListBlogsDto {
	@Expose()
	@Type(() => BlogDto)
	@ApiProperty({ type: () => [BlogDto] })
	blogs!: BlogDto[];

	@Expose()
	@ApiProperty({ type: Number })
	totalCount!: number;
}
