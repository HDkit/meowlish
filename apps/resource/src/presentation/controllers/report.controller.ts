import { ReportService } from '../../app/services/report.service';
import { Controller } from '@nestjs/common';
import { resource } from '@server/generated';

@resource.ReportServiceControllerMethods()
@Controller()
export class ReportController implements resource.ReportServiceController {
	constructor(private readonly reportService: ReportService) {}

	async createReport(data: resource.CreateReportRequest): Promise<resource.ReportResponse> {
		return this.reportService.createReport(data);
	}

	async getReport(data: resource.GetReportRequest): Promise<resource.ReportResponse> {
		return this.reportService.getReport(data.id as string);
	}

	async updateReport(data: resource.UpdateReportRequest): Promise<resource.ReportResponse> {
		return this.reportService.updateReport(data);
	}

	async deleteReport(data: resource.DeleteReportRequest): Promise<void> {
		await this.reportService.deleteReport(data.id as string);
	}

	async listReports(data: resource.ListReportsRequest): Promise<resource.ListReportsResponse> {
		return this.reportService.listReports(data);
	}

	async addFileToReport(data: resource.AddFileToReportRequest): Promise<void> {
		await this.reportService.addFileToReport(data);
	}

	async removeFileFromReport(data: resource.RemoveFileFromReportRequest): Promise<void> {
		await this.reportService.removeFileFromReport(data);
	}
}
