import { ReportService } from '../../app/services/report.service';
import { AddFileToReportReqDto } from '../dtos/req/add-file-to-report.req.dto';
import { CreateReportReqDto } from '../dtos/req/create-report.req.dto';
import { DeleteReportReqDto } from '../dtos/req/delete-report.req.dto';
import { GetReportReqDto } from '../dtos/req/get-report.req.dto';
import { ListReportsReqDto } from '../dtos/req/list-reports.req.dto';
import { RemoveFileFromReportReqDto } from '../dtos/req/remove-file-from-report.req.dto';
import { UpdateReportReqDto } from '../dtos/req/update-report.req.dto';
import { Controller, UseFilters } from '@nestjs/common';
import { Payload } from '@nestjs/microservices';
import { resource } from '@server/generated';
import { GlobalRpcExceptionFilter } from '@server/utils';

@UseFilters(GlobalRpcExceptionFilter)
@resource.ReportServiceControllerMethods()
@Controller()
export class ReportController implements resource.ReportServiceController {
	constructor(private readonly reportService: ReportService) {}

	async createReport(@Payload() data: CreateReportReqDto): Promise<resource.ReportResponse> {
		return this.reportService.createReport(data);
	}

	async getReport(@Payload() data: GetReportReqDto): Promise<resource.ReportResponse> {
		return this.reportService.getReport(data.id);
	}

	async updateReport(@Payload() data: UpdateReportReqDto): Promise<resource.ReportResponse> {
		return this.reportService.updateReport(data);
	}

	async deleteReport(@Payload() data: DeleteReportReqDto): Promise<void> {
		await this.reportService.deleteReport(data.id);
	}

	async listReports(@Payload() data: ListReportsReqDto): Promise<resource.ListReportsResponse> {
		return this.reportService.listReports(data);
	}

	async addFileToReport(@Payload() data: AddFileToReportReqDto): Promise<void> {
		await this.reportService.addFileToReport(data);
	}

	async removeFileFromReport(@Payload() data: RemoveFileFromReportReqDto): Promise<void> {
		await this.reportService.removeFileFromReport(data);
	}
}
