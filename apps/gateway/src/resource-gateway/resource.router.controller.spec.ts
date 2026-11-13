import { RESOURCE_CLIENT } from './constants/resource';
import { ResourceGatewayController } from './resource.router.controller';
import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { type Server } from 'node:http';
import request from 'supertest';

describe('ResourceGatewayController blog comments', () => {
	let app: INestApplication;
	let roles: string[] = [];
	const comments = {
		listBlogComments: jest
			.fn()
			.mockReturnValue({ comments: [], totalThreads: 0, totalComments: 0 }),
		createBlogComment: jest.fn().mockReturnValue({ id: 'c1' }),
		updateBlogComment: jest.fn().mockReturnValue({ id: 'c1' }),
		deleteBlogComment: jest.fn().mockReturnValue({}),
	};

	beforeAll(async () => {
		const moduleRef = await Test.createTestingModule({
			controllers: [ResourceGatewayController],
			providers: [{ provide: RESOURCE_CLIENT, useValue: { getService: () => comments } }],
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

	it('comments as the JWT user, whatever the body claims', async () => {
		await request(server())
			.post('/blogs/b1/comments')
			.send({ content: 'Hay quá', parentId: 'c0', requesterId: 'attacker', privileged: true })
			.expect(201);
		expect(comments.createBlogComment).toHaveBeenCalledWith({
			content: 'Hay quá',
			parentId: 'c0',
			blogId: 'b1',
			requesterId: 'jwt-user',
			privileged: false,
		});
	});

	it('forwards admins as privileged on delete', async () => {
		roles = ['admin'];
		await request(server()).delete('/blog-comments/c1').expect(200);
		expect(comments.deleteBlogComment).toHaveBeenCalledWith({
			id: 'c1',
			requesterId: 'jwt-user',
			privileged: true,
		});
	});

	it('bounds the page size and rejects empty comments', async () => {
		await request(server()).get('/blogs/b1/comments?page=2&limit=5').expect(200);
		expect(comments.listBlogComments).toHaveBeenCalledWith({ page: 2, limit: 5, blogId: 'b1' });
		await request(server()).get('/blogs/b1/comments?limit=51').expect(400);
		await request(server()).patch('/blog-comments/c1').send({ content: '' }).expect(400);
		expect(comments.updateBlogComment).not.toHaveBeenCalled();
	});
});
