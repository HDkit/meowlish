import { SetGoalDto } from '../../../../../exam-gateway/dtos/req/goal/set-goal.req.dto';
import { UpdateGoalDto } from '../../../../../exam-gateway/dtos/req/goal/update-goal.req.dto';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';

// C25: half bands get through the gateway; the per-type scale is checked by the exam service.

const errorsFor = (cls: typeof SetGoalDto | typeof UpdateGoalDto, target: unknown) =>
	validateSync(
		plainToInstance(cls, { date: '2027-01-01T00:00:00.000Z', target: target, type: 'IELTS' }),
	).map(e => e.property);

describe.each([SetGoalDto, UpdateGoalDto])('%p target (C25)', cls => {
	it.each([6.5, 0, 990])('accepts %p', target => {
		expect(errorsFor(cls, target)).toEqual([]);
	});

	it.each([-1, 990.5, '7', Number.NaN])('rejects %p', target => {
		expect(errorsFor(cls, target)).toEqual(['target']);
	});
});
