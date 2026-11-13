import { GetUserSkillStatsQuery } from '../../practice/exam.get-user-skill-stats.query';
import {
	GetUserSkillStatsQueryHandler,
	skillStatsAttemptLimit,
} from './get-user-skill-stats.handler';

describe('GetUserSkillStatsQueryHandler', () => {
	it("builds the stats from the requester's latest attempts", async () => {
		const repo = {
			getUserSkillStatsSource: jest
				.fn()
				.mockResolvedValue({ attempts: [], objective: [], writing: [], tags: [] }),
		};
		const handler = new GetUserSkillStatsQueryHandler(repo as never);
		const stats = await handler.execute(new GetUserSkillStatsQuery({ userId: 'u1' }));
		expect(repo.getUserSkillStatsSource).toHaveBeenCalledWith('u1', skillStatsAttemptLimit);
		expect(stats.skills).toHaveLength(4);
	});
});
