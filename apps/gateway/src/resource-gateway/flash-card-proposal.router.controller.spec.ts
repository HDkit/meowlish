import { RESOURCE_CLIENT } from './constants/resource';
import { FlashCardProposalGatewayController } from './flash-card-proposal.router.controller';
import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { type Server } from 'node:http';
import request from 'supertest';

describe('FlashCardProposalGatewayController', () => {
	let app: INestApplication;
	let roles: string[] = [];
	const grpc = {
		forkFlashCardList: jest.fn().mockReturnValue({ id: 'fork' }),
		getFlashCardListDiff: jest.fn().mockReturnValue({}),
		pullFlashCardListUpstream: jest.fn().mockReturnValue({}),
		createFlashCardProposal: jest.fn().mockReturnValue({ id: 'p1' }),
		listFlashCardProposals: jest.fn().mockReturnValue({ proposals: [], totalCount: 0 }),
		getFlashCardProposal: jest.fn().mockReturnValue({ id: 'p1' }),
		acceptFlashCardProposal: jest.fn().mockReturnValue({ id: 'p1' }),
		rejectFlashCardProposal: jest.fn().mockReturnValue({ id: 'p1' }),
		withdrawFlashCardProposal: jest.fn().mockReturnValue({ id: 'p1' }),
	};

	beforeAll(async () => {
		const moduleRef = await Test.createTestingModule({
			controllers: [FlashCardProposalGatewayController],
			providers: [{ provide: RESOURCE_CLIENT, useValue: { getService: () => grpc } }],
		}).compile();
		app = moduleRef.createNestApplication();
		app.use((req: { user?: unknown }, _res: unknown, next: () => void) => {
			req.user = { sub: 'jwt-user', roles: roles };
			next();
		});
		app.useGlobalPipes(
			new ValidationPipe({ transform: true, whitelist: true, forbidUnknownValues: true }),
		);
		await app.init();
	});
	afterAll(() => app.close());
	const server = (): Server => app.getHttpServer() as Server;
	beforeEach(() => {
		jest.clearAllMocks();
		roles = [];
	});

	it('forks as the JWT user', async () => {
		await request(server()).post('/flash-card-lists/l1/fork').expect(201);
		expect(grpc.forkFlashCardList).toHaveBeenCalledWith({
			id: 'l1',
			requesterId: 'jwt-user',
			privileged: false,
		});
	});

	it('proposes from the path copy as the JWT user, whatever the body claims', async () => {
		await request(server())
			.post('/flash-card-lists/fork/proposals')
			.send({ title: 'Sửa nghĩa', message: 'Xem giúp', requesterId: 'attacker' })
			.expect(201);
		expect(grpc.createFlashCardProposal).toHaveBeenCalledWith({
			title: 'Sửa nghĩa',
			message: 'Xem giúp',
			sourceListId: 'fork',
			requesterId: 'jwt-user',
			privileged: false,
		});
		await request(server()).post('/flash-card-lists/fork/proposals').send({}).expect(400);
	});

	it('forwards admins as privileged and passes conflict resolutions on accept', async () => {
		roles = ['admin'];
		await request(server())
			.post('/flash-card-proposals/p1/accept')
			.send({ resolutions: [{ targetCardId: 'c1', apply: false }] })
			.expect(200);
		expect(grpc.acceptFlashCardProposal).toHaveBeenCalledWith({
			decisionNote: undefined,
			resolutions: [{ targetCardId: 'c1', apply: false }],
			id: 'p1',
			requesterId: 'jwt-user',
			privileged: true,
		});
		await request(server())
			.post('/flash-card-proposals/p1/accept')
			.send({ resolutions: [{ targetCardId: 'c1' }] })
			.expect(400);
	});

	it('validates list filters', async () => {
		await request(server())
			.get('/flash-card-proposals?targetListId=l1&status=OPEN&mine=true&limit=5')
			.expect(200);
		expect(grpc.listFlashCardProposals).toHaveBeenCalledWith({
			targetListId: 'l1',
			status: 'OPEN',
			mine: true,
			limit: 5,
			requesterId: 'jwt-user',
			privileged: false,
		});
		await request(server()).get('/flash-card-proposals?status=MERGED').expect(400);
	});
});
