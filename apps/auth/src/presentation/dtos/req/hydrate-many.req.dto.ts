import { auth } from '@server/generated';
import { IsArray, IsString } from 'class-validator';

export class HydrateManyDto implements auth.HydrateIdentitiesDto {
	@IsArray()
	@IsString({ each: true })
	identityIds!: string[];
}
