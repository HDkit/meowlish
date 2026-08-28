export interface GoogleCalendarTokenModel {
	identityId: string;
	accessToken: string;
	refreshToken: string;
	expiresAt: Date;
	scopes: string;
}

export interface IGoogleCalendarTokenRepository {
	findByIdentityId(identityId: string): Promise<GoogleCalendarTokenModel | null>;
	upsert(token: GoogleCalendarTokenModel): Promise<void>;
	delete(identityId: string): Promise<void>;
}

export const IGoogleCalendarTokenRepositoryToken = Symbol('IGoogleCalendarTokenRepository');
