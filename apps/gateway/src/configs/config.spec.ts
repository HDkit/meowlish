import { envFileSchema } from './config';

describe('gateway config', () => {
	const parse = (v: string | undefined) => envFileSchema.shape.trustProxy.parse(v);

	it('parses TRUST_PROXY as false, true or a hop count', () => {
		expect(parse(undefined)).toBe(false);
		expect(parse('false')).toBe(false);
		expect(parse('true')).toBe(true);
		expect(parse('1')).toBe(1);
		expect(parse('2')).toBe(2);
	});

	it('splits CORS_ORIGINS, trims, and drops wildcards', () => {
		const parseOrigins = (v: string) => envFileSchema.shape.corsOrigins.parse(v);
		expect(parseOrigins('http://localhost:6767, http://localhost:5173/, *')).toEqual([
			'http://localhost:6767',
			'http://localhost:5173',
		]);
		expect(parseOrigins('')).toEqual([]);
	});
});
