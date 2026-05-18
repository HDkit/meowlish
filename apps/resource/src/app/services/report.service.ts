import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClient, Report } from '@prisma-client/resource';
import { DATABASE_SERVICE } from '@server/database';
import { resource } from '@server/generated';

@Injectable()
export class ReportService {
	constructor(@Inject(DATABASE_SERVICE) private readonly prisma: PrismaClient) {}

	private async mapToResponse(report: Report): Promise<resource.ReportResponse> {
		const files = await this.prisma.reportFile.findMany({
			where: { reportId: report.id },
			select: { fileId: true },
		});

		return {
			id: report.id,
			reportedBy: report.reportedBy,
			type: report.type,
			status: report.status,
			title: report.title,
			description: report.description,
			targetType: report.targetType ?? undefined,
			targetId: report.targetId ?? undefined,
			resolvedBy: report.resolvedBy ?? undefined,
			adminResponse: report.adminResponse ?? undefined,
			fileIds: files.map(f => f.fileId),
			createdAt: report.createdAt.toISOString(),
			updatedAt: report.updatedAt.toISOString(),
		};
	}

	async createReport(data: resource.CreateReportRequest): Promise<resource.ReportResponse> {
		const report = await this.prisma.report.create({
			data: {
				reportedBy: data.reportedBy as string,
				type: data.type as string,
				title: data.title as string,
				description: data.description as string,
				targetType: data.targetType ?? null,
				targetId: data.targetId ?? null,
				files:
					data.fileIds && data.fileIds.length > 0 ?
						{ create: data.fileIds.map(fid => ({ fileId: fid })) }
					:	undefined,
			},
		});
		return this.mapToResponse(report);
	}

	async getReport(id: string): Promise<resource.ReportResponse> {
		const report = await this.prisma.report.findUnique({ where: { id: id } });
		if (!report) {
			throw new NotFoundException('Report not found');
		}
		return this.mapToResponse(report);
	}

	async updateReport(data: resource.UpdateReportRequest): Promise<resource.ReportResponse> {
		const report = await this.prisma.report.findUnique({ where: { id: data.id } });
		if (!report) {
			throw new NotFoundException('Report not found');
		}
		const updated = await this.prisma.report.update({
			where: { id: data.id },
			data: {
				status: data.status ?? report.status,
				resolvedBy: data.resolvedBy ?? report.resolvedBy,
				adminResponse: data.adminResponse ?? report.adminResponse,
			},
		});
		return this.mapToResponse(updated);
	}

	async deleteReport(id: string): Promise<void> {
		const report = await this.prisma.report.findUnique({ where: { id: id } });
		if (!report) {
			throw new NotFoundException('Report not found');
		}
		await this.prisma.report.delete({ where: { id: id } });
	}

	async listReports(data: resource.ListReportsRequest): Promise<resource.ListReportsResponse> {
		const page = data.page || 1;
		const limit = data.limit || 10;
		const skip = (page - 1) * limit;

		const where: Record<string, unknown> = {};
		if (data.reportedBy) where.reportedBy = data.reportedBy;
		if (data.type) where.type = data.type;
		if (data.status) where.status = data.status;
		if (data.targetType) where.targetType = data.targetType;
		if (data.targetId) where.targetId = data.targetId;

		const [reports, totalCount] = await Promise.all([
			this.prisma.report.findMany({
				where: where,
				skip: skip,
				take: limit,
				orderBy: { createdAt: 'desc' },
			}),
			this.prisma.report.count({ where: where }),
		]);

		return {
			reports: await Promise.all(reports.map(r => this.mapToResponse(r))),
			totalCount: totalCount,
		};
	}

	async addFileToReport(data: resource.AddFileToReportRequest): Promise<void> {
		const report = await this.prisma.report.findUnique({ where: { id: data.reportId } });
		if (!report) {
			throw new NotFoundException('Report not found');
		}
		await this.prisma.reportFile.create({
			data: { reportId: data.reportId as string, fileId: data.fileId as string },
		});
	}

	async removeFileFromReport(data: resource.RemoveFileFromReportRequest): Promise<void> {
		await this.prisma.reportFile.delete({
			where: {
				reportId_fileId: {
					reportId: data.reportId as string,
					fileId: data.fileId as string,
				},
			},
		});
	}
}
