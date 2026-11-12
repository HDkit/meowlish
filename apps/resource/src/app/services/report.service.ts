import {
	type ReportListReadModel,
	type ReportReadModel,
} from '../../domain/read-models/report.read-model';
import { ResourceEventsPublisher } from '../events/resource-events.publisher';
import { toSkipTake } from '../types/pagination';
import {
	type CreateReportInput,
	type ListReportsInput,
	type UpdateReportInput,
} from '../types/report.input';
import { type Requester } from '../types/requester';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, PrismaClient, Report, ReportFile } from '@prisma-client/resource';

type ReportWithFiles = Report & { files: Pick<ReportFile, 'fileId'>[] };

const withFiles = { files: { select: { fileId: true } } } satisfies Prisma.ReportInclude;

@Injectable()
export class ReportService {
	constructor(
		private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaClient>>,
		private readonly events: ResourceEventsPublisher,
	) {}

	private toReadModel(report: ReportWithFiles): ReportReadModel {
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
			fileIds: report.files.map(f => f.fileId),
			createdAt: report.createdAt.toISOString(),
			updatedAt: report.updatedAt.toISOString(),
		};
	}

	/** Reports are visible to their reporter and to privileged staff only; others get 404. */
	private async findVisibleReport(id: string, requester: Requester): Promise<ReportWithFiles> {
		const report = await this.txHost.tx.report.findUnique({
			where: { id: id },
			include: withFiles,
		});
		if (!report || (!requester.privileged && report.reportedBy !== requester.id)) {
			throw new NotFoundException('Report not found');
		}
		return report;
	}

	async createReport(data: CreateReportInput): Promise<ReportReadModel> {
		const report = await this.txHost.tx.report.create({
			data: {
				reportedBy: data.reportedBy,
				type: data.type,
				title: data.title,
				description: data.description,
				targetType: data.targetType ?? null,
				targetId: data.targetId ?? null,
				files:
					data.fileIds.length > 0 ?
						{ create: [...new Set(data.fileIds)].map(fileId => ({ fileId: fileId })) }
					:	undefined,
			},
			include: withFiles,
		});
		return this.toReadModel(report);
	}

	async getReport(id: string, requester: Requester): Promise<ReportReadModel> {
		return this.toReadModel(await this.findVisibleReport(id, requester));
	}

	async updateReport(data: UpdateReportInput): Promise<ReportReadModel> {
		const report = await this.txHost.tx.report.findUnique({ where: { id: data.id } });
		if (!report) throw new NotFoundException('Report not found');

		const updated = await this.txHost.tx.report.update({
			where: { id: data.id },
			data: {
				status: data.status ?? report.status,
				resolvedBy: data.resolvedBy ?? report.resolvedBy,
				adminResponse: data.adminResponse ?? report.adminResponse,
			},
			include: withFiles,
		});

		if (updated.status !== report.status) {
			await this.events.reportStatusChanged({
				reportId: updated.id,
				reportedBy: updated.reportedBy,
				status: updated.status,
				title: updated.title,
			});
		}
		return this.toReadModel(updated);
	}

	async deleteReport(id: string): Promise<void> {
		const { count } = await this.txHost.tx.report.deleteMany({ where: { id: id } });
		if (count === 0) throw new NotFoundException('Report not found');
	}

	async listReports(data: ListReportsInput, requester: Requester): Promise<ReportListReadModel> {
		const where: Prisma.ReportWhereInput = {
			// Non-privileged requesters only ever see their own reports, whatever filter they send.
			reportedBy: requester.privileged ? data.reportedBy : requester.id,
			type: data.type,
			status: data.status,
			targetType: data.targetType,
			targetId: data.targetId,
		};

		const [reports, totalCount] = await Promise.all([
			this.txHost.tx.report.findMany({
				where: where,
				include: withFiles,
				...toSkipTake(data),
				orderBy: { createdAt: 'desc' },
			}),
			this.txHost.tx.report.count({ where: where }),
		]);

		return { reports: reports.map(r => this.toReadModel(r)), totalCount: totalCount };
	}

	async addFileToReport(reportId: string, fileId: string, requester: Requester): Promise<void> {
		await this.findVisibleReport(reportId, requester);
		await this.txHost.tx.reportFile.upsert({
			where: { reportId_fileId: { reportId: reportId, fileId: fileId } },
			update: {},
			create: { reportId: reportId, fileId: fileId },
		});
	}

	async removeFileFromReport(
		reportId: string,
		fileId: string,
		requester: Requester,
	): Promise<void> {
		await this.findVisibleReport(reportId, requester);
		const { count } = await this.txHost.tx.reportFile.deleteMany({
			where: { reportId: reportId, fileId: fileId },
		});
		if (count === 0) throw new NotFoundException('File is not attached to this report');
	}
}
