import { GoalService } from '../../app/services/goal.service';
import { DeleteGoalDto } from '../dtos/req/goal/delete-goal.req.dto';
import { GetGoalDto } from '../dtos/req/goal/get-goal.rerq.dto';
import { SetGoalDto } from '../dtos/req/goal/set-goal.req.dto';
import { UpdateGoalDto } from '../dtos/req/goal/update-goal.req.dto';
import { GoalResDto } from '../dtos/res/goal/goal.res.dto';
import { Controller, SerializeOptions, UseFilters } from '@nestjs/common';
import { Payload } from '@nestjs/microservices';
import { exam } from '@server/generated';
import { GlobalRpcExceptionFilter } from '@server/utils';

@UseFilters(GlobalRpcExceptionFilter)
@exam.GoalServiceControllerMethods()
@Controller()
export class GoalController implements exam.GoalServiceController {
	constructor(private readonly goalService: GoalService) {}

	@SerializeOptions({ type: GoalResDto })
	async setGoal(@Payload() request: SetGoalDto): Promise<GoalResDto> {
		return await this.goalService.setGoal(request);
	}

	async deleteGoal(@Payload() request: DeleteGoalDto): Promise<void> {
		return await this.goalService.deleteGoal(request.uid);
	}

	@SerializeOptions({ type: GoalResDto })
	async updateGoal(@Payload() request: UpdateGoalDto): Promise<GoalResDto> {
		return await this.goalService.updateGoal(request);
	}

	@SerializeOptions({ type: GoalResDto })
	async getGoal(@Payload() request: GetGoalDto): Promise<GoalResDto> {
		return await this.goalService.getGoal(request.uid);
	}
}
