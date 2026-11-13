import { RESOURCE_CLIENT } from './constants/resource';
import { ForumGatewayController } from './forum.router.controller';
import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { type Server } from 'node:http';
import request from 'supertest';

describe('ForumGatewayController', () => {
	let app: INestApplication;
	let roles: string[] = [];
	const forum = {
		listForumCategories: jest.fn().mockReturnValue({ categories: [] }),
		listForumThreads: jest.fn().mockReturnValue({ threads: [], totalCount: 0 }),
		createForumThread: jest.fn().mockReturnValue({ id: 't1' }),
		createForumReply: jest.fn().mockReturnValue({ id: 'r1' }),
		deleteForumReply: jest.fn().mockReturnValue({}),
	};

	beforeAll(async () => {
		const moduleRef = await Test.createTestingModule({
			controllers: [ForumGatewayController],
			providers: [{ provide: RESOURCE_CLIENT, useValue: { getService: () => forum } }],
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

	it('opens a thread as the JWT user, ignoring identity fields in the body', async () => {
		await request(server())
			.post('/forum/categories/ielts/threads')
			.send({ title: 'Hi', body: 'Text', requesterId: 'attacker', privileged: true })
			.expect(201);
		expect(forum.createForumThread).toHaveBeenCalledWith({
			title: 'Hi',
			body: 'Text',
			categoryId: 'ielts',
			requesterId: 'jwt-user',
			privileged: false,
		});
	});

	it('marks moderators and admins as privileged', async () => {
		roles = ['mod'];
		await request(server()).delete('/forum/replies/r1').expect(200);
		expect(forum.deleteForumReply).toHaveBeenCalledWith({
			id: 'r1',
			requesterId: 'jwt-user',
			privileged: true,
		});
	});

	it('rejects an empty reply body', async () => {
		await request(server()).post('/forum/threads/t1/replies').send({ body: '' }).expect(400);
		expect(forum.createForumReply).not.toHaveBeenCalled();
	});

	it('passes search and bounded paging to the thread list', async () => {
		await request(server())
			.get('/forum/categories/toeic/threads?search=part%207&page=2&limit=20')
			.expect(200);
		expect(forum.listForumThreads).toHaveBeenCalledWith({
			search: 'part 7',
			page: 2,
			limit: 20,
			categoryId: 'toeic',
		});
		await request(server()).get('/forum/categories/toeic/threads?limit=500').expect(400);
	});
});
