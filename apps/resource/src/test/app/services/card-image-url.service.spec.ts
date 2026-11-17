import { CardImageUrlService } from '../../../app/services/card-image-url.service';
import { of, throwError } from 'rxjs';

const setup = (getUrls: jest.Mock) => {
	const client = { getService: jest.fn().mockReturnValue({ getUrls: getUrls }) };
	const service = new CardImageUrlService(client as never);
	service.onModuleInit();
	return service;
};

describe('CardImageUrlService', () => {
	it('resolves all image files of a response with one GetUrls call', async () => {
		const getUrls = jest
			.fn()
			.mockReturnValue(of({ urls: { f1: 'https://cdn/public/f1', f2: 'https://cdn/public/f2' } }));
		const items = [
			{ imageFileId: 'f1' },
			{ imageFileId: 'f2' },
			{ imageFileId: 'f1' },
			{ image: 'https://example.com/legacy.png' },
			undefined,
		];
		await setup(getUrls).resolve(items);
		expect(getUrls).toHaveBeenCalledTimes(1);
		expect(getUrls).toHaveBeenCalledWith({ ids: ['f1', 'f2'] });
		expect(items.map(i => i?.image)).toEqual([
			'https://cdn/public/f1',
			'https://cdn/public/f2',
			'https://cdn/public/f1',
			'https://example.com/legacy.png',
			undefined,
		]);
	});

	it('makes no call when nothing has an image file', async () => {
		const getUrls = jest.fn();
		await setup(getUrls).resolve([{ image: 'https://example.com/a.png' }, {}]);
		expect(getUrls).not.toHaveBeenCalled();
	});

	it('leaves unknown files, and every file when file-service fails, without a URL', async () => {
		const items = [{ imageFileId: 'gone' }];
		await setup(jest.fn().mockReturnValue(of({ urls: {} }))).resolve(items);
		expect(items[0]).toEqual({ imageFileId: 'gone', image: undefined });

		const failing = [{ imageFileId: 'f1' }];
		await setup(jest.fn().mockReturnValue(throwError(() => new Error('down')))).resolve(failing);
		expect(failing[0]).toEqual({ imageFileId: 'f1', image: undefined });
	});
});
