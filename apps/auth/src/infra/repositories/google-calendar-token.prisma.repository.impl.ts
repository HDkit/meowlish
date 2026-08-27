import {
	type GoogleCalendarTokenModel,
	type IGoogleCalendarTokenRepository,
} from '../../domain/repositories/google-calendar-token.repository';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma-client/auth';

@Injectable()
export class GoogleCalendarTokenPrismaRepositoryImpl implements IGoogleCalendarTokenRepository {
	constructor(private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaClient>>) {}

	async findByIdentityId(identityId: string): Promise<GoogleCalendarTokenModel | null> {
		const token = await this.txHost.tx.googleCalendarToken.findUnique({
			where: { identityId: identityId },
		});
		if (!token) return null;
		return {
			identityId: token.identityId,
			accessToken: token.accessToken,
			refreshToken: token.refreshToken,
			expiresAt: token.expiresAt,
			scopes: token.scopes,
		};
	}

	async upsert(model: GoogleCalendarTokenModel): Promise<void> {
		await this.txHost.tx.googleCalendarToken.upsert({
			where: { identityId: model.identityId },
			update: {
				accessToken: model.accessToken,
				refreshToken: model.refreshToken,
				expiresAt: model.expiresAt,
				scopes: model.scopes,
			},
			create: {
				identityId: model.identityId,
				accessToken: model.accessToken,
				refreshToken: model.refreshToken,
				expiresAt: model.expiresAt,
				scopes: model.scopes,
			},
		});
	}

	async delete(identityId: string): Promise<void> {
		await this.txHost.tx.googleCalendarToken.deleteMany({
			where: { identityId: identityId },
		});
	}
}
