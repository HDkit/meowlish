import { type Requester } from '../../../app/types/requester';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

/**
 * Identity of the caller, filled in by the gateway from the JWT (never from client input).
 * Extended by every request whose result depends on who is asking.
 */
export class RequesterReqDto {
	@IsString()
	requesterId!: string;

	@IsBoolean()
	@IsOptional()
	privileged?: boolean;
}

export const toRequester = (dto: RequesterReqDto): Requester => ({
	id: dto.requesterId,
	privileged: dto.privileged ?? false,
});
