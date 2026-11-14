import { ExamStatus } from '../../../../enums/exam-status.enum';
import { ApiProperty } from '@nestjs/swagger';
import { exam } from '@server/generated';
import { IsEnum } from 'class-validator';

export class ReviewExamDto implements Omit<exam.ReviewExamDto, 'id'> {
	@IsEnum(ExamStatus)
	@ApiProperty({ enum: ExamStatus })
	status!: ExamStatus;
}
