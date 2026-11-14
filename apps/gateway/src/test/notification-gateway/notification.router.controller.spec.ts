import { NOTIFICATION_CLIENT } from '../../notification-gateway/constants/notification';
import { NotificationGatewayController } from '../../notification-gateway/notification.router.controller';
import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { type Server } from 'node:http';
import request from 'supertest';

describe('NotificationGatewayController preferences', () => {
	let app: INestApplication;
	const getPreferences = jest.fn().mockReturnValue({ identityId: 'jwt-user' });
	const updatePreferences = jest.fn().mockReturnValue({ identityId: 'jwt-user' });
	const getNotification = jest.fn().mockReturnValue({});

	beforeAll(async () => {
		const moduleRef = await Test.createTestingModule({
			controllers: [NotificationGatewayController],
			providers: [
				{
					provide: NOTIFICATION_CLIENT,
					useValue: {
						getService: (name: string) =>
							name.includes('Preferences') ?
								{ getPreferences: getPreferences, updatePreferences: updatePreferences }
							:	{ getNotification: getNotification },
					},
				},
			],
		}).compile();
		app = moduleRef.createNestApplication();
		app.use((req: { user?: unknown }, _res: unknown, next: () => void) => {
			req.user = { sub: 'jwt-user' };
			next();
		});
		app.useGlobalPipes(
			new ValidationPipe({ transform: true, whitelist: true, forbidUnknownValues: true }),
		);
		await app.init();
	});
	afterAll(() => app.close());
	const server = (): Server => app.getHttpServer() as Server;
	beforeEach(() => jest.clearAllMocks());

	it('GET /preferences uses the JWT identity and is not routed to :id', async () => {
		await request(server()).get('/preferences').expect(200);
		expect(getPreferences).toHaveBeenCalledWith({ identityId: 'jwt-user' });
		expect(getNotification).not.toHaveBeenCalled();
	});

	it('PATCH /preferences ignores a body identityId', async () => {
		await request(server())
			.patch('/preferences')
			.send({ identityId: 'attacker', emailEnabled: false })
			.expect(200);
		expect(updatePreferences).toHaveBeenCalledWith(
			expect.objectContaining({ identityId: 'jwt-user', emailEnabled: false }),
		);
	});

	it('PATCH /preferences rejects non-boolean flags', async () => {
		await request(server()).patch('/preferences').send({ pushEnabled: 'x' }).expect(400);
		expect(updatePreferences).not.toHaveBeenCalled();
	});
});
