import { GetAttemptDataQuery } from '../../practice/exam.get-attempt-data.query';
import { GetAttemptDataQueryHandler } from './get-attempt-data.handler';
import { ConflictException, NotFoundException } from '@nestjs/common';

const make = (owner: string | null) => {
	const repo = {
		getAttemptSavedData: jest.fn().mockResolvedValue(null),
		getAttemptOwner: jest.fn().mockResolvedValue(owner),
	};
	return new GetAttemptDataQueryHandler(repo as never, {} as never);
};

const query = () => new GetAttemptDataQuery({ attemptId: 'a1' });

describe('GetAttemptDataQueryHandler', () => {
	it('a finished attempt is 409, so the client can show its result', async () => {
		await expect(make('u1').execute(query())).rejects.toBeInstanceOf(ConflictException);
	});

	it('a missing attempt is still 404', async () => {
		await expect(make(null).execute(query())).rejects.toBeInstanceOf(NotFoundException);
	});
});
