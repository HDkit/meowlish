import { exam } from '@server/generated';
import { IsString } from 'class-validator';

export class GetUserSkillStatsDto implements exam.GetUserSkillStatsDto {
	@IsString()
	uid!: string;
}
