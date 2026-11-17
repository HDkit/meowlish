import { HydrateQuery } from '../../../../app/queries/auth.hydrate.query';
import { HydrateQueryHandler } from '../../../../app/queries/handlers/hydrate.handler';
import { of } from 'rxjs';

describe('HydrateQueryHandler avatar URLs', () => {
	it('viewing any avatar URL still works', async () => {
		// Another user's identity, with an avatar they uploaded: no uploader check on read.
		const readRepo = {
			hydrate: jest.fn().mockResolvedValue({ id: 'someone-else', avatarUrl: 'their-file' }),
		};
		const fileService = {
			getUrls: jest.fn(() => of({ urls: { 'their-file': 'https://cdn/public/their-file' } })),
		};
		const handler = new HydrateQueryHandler(
			readRepo as never,
			{
				getService: () => fileService,
			} as never,
		);
		handler.onModuleInit();

		await expect(handler.execute(new HydrateQuery({ id: 'someone-else' }))).resolves.toMatchObject({
			avatarUrl: 'https://cdn/public/their-file',
		});
		expect(fileService.getUrls).toHaveBeenCalledWith({ ids: ['their-file'] });
	});
});
