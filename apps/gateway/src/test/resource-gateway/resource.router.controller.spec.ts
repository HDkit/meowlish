import { IS_PUBLIC_KEY } from '../../auth/decorators/public.decorator';
import { RESOURCE_ACCESS_KEY } from '../../auth/decorators/resource-access.decorator';
import { RESOURCE_CLIENT } from '../../resource-gateway/constants/resource';
import { ResourceGatewayController } from '../../resource-gateway/resource.router.controller';
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

describe('ResourceGatewayController flash cards (C32)', () => {
	let app: INestApplication;
	let roles: string[] = [];
	const cards = {
		createFlashCard: jest.fn().mockReturnValue({ id: 'card1' }),
		updateFlashCard: jest.fn().mockReturnValue({ id: 'card1' }),
		deleteFlashCard: jest.fn().mockReturnValue({}),
	};

	beforeAll(async () => {
		const moduleRef = await Test.createTestingModule({
			controllers: [ResourceGatewayController],
			providers: [{ provide: RESOURCE_CLIENT, useValue: { getService: () => cards } }],
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

	it('no longer uses @ResourceAccess on card update/delete', () => {
		const proto = ResourceGatewayController.prototype as unknown as Record<string, object>;
		for (const route of ['updateFlashCard', 'deleteFlashCard']) {
			expect(Reflect.getMetadata(RESOURCE_ACCESS_KEY, proto[route])).toBeUndefined();
		}
	});

	it('forwards the JWT user on update, whatever the body claims', async () => {
		await request(server())
			.patch('/flash-cards/card1')
			.send({ word: 'apple', requesterId: 'attacker', privileged: true })
			.expect(200);
		expect(cards.updateFlashCard).toHaveBeenCalledWith({
			word: 'apple',
			examples: [],
			tags: [],
			replaceExamples: false,
			replaceTags: false,
			id: 'card1',
			requesterId: 'jwt-user',
			privileged: false,
			mayAttachAnyFile: false,
		});
	});

	it('takes an image as an uploaded file id, never a URL, and lets only admins attach any file', async () => {
		await request(server())
			.post('/flash-cards')
			.send({
				word: 'apple',
				definition: 'quả táo',
				listId: 'l1',
				imageFileId: 'f1',
				image: 'https://evil.example/x.png',
				mayAttachAnyFile: true,
			})
			.expect(201);
		expect(cards.createFlashCard).toHaveBeenCalledWith({
			word: 'apple',
			definition: 'quả táo',
			listId: 'l1',
			imageFileId: 'f1',
			examples: [],
			tags: [],
			authorId: 'jwt-user',
			mayAttachAnyFile: false,
		});

		roles = ['admin'];
		await request(server()).patch('/flash-cards/card1').send({ imageFileId: '' }).expect(200);
		expect(cards.updateFlashCard).toHaveBeenCalledWith(
			expect.objectContaining({ imageFileId: '', mayAttachAnyFile: true, privileged: true }),
		);
	});

	it('forwards only admins as privileged on delete', async () => {
		roles = ['mod'];
		await request(server()).delete('/flash-cards/card1').expect(200);
		expect(cards.deleteFlashCard).toHaveBeenLastCalledWith({
			id: 'card1',
			requesterId: 'jwt-user',
			privileged: false,
		});

		roles = ['admin'];
		await request(server()).delete('/flash-cards/card1').expect(200);
		expect(cards.deleteFlashCard).toHaveBeenLastCalledWith({
			id: 'card1',
			requesterId: 'jwt-user',
			privileged: true,
		});
	});
});

describe('ResourceGatewayController blog visibility', () => {
	const proto = ResourceGatewayController.prototype as unknown as Record<string, object>;
	const isPublic = (route: string): unknown => Reflect.getMetadata(IS_PUBLIC_KEY, proto[route]);

	it('lets anonymous visitors read blogs, tags and comments', () => {
		for (const route of ['listBlogs', 'getBlog', 'listBlogTags', 'listBlogComments']) {
			expect(isPublic(route)).toBe(true);
		}
	});

	it('still requires a session to write blogs and comments', () => {
		for (const route of [
			'createBlog',
			'updateBlog',
			'deleteBlog',
			'createBlogComment',
			'updateBlogComment',
			'deleteBlogComment',
		]) {
			expect(isPublic(route)).toBeUndefined();
		}
	});
});
