import { Transform } from 'class-transformer';

/**
 * Query arrays: `?x=a` arrives as a string and `?x=a&x=b` as an array. Always yields a string array
 * (empty when the parameter is absent), so a single value doesn't break a repeated gRPC field.
 */
export const ToStringArray = () =>
	Transform(({ value }: { value: unknown }) =>
		value === undefined || value === '' ? []
		: Array.isArray(value) ? (value as unknown[])
		: [value],
	);
