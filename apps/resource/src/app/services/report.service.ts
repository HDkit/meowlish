import {
	type ReportListReadModel,
	type ReportReadModel,
} from '../../domain/read-models/report.read-model';
import { isFinalReportStatus } from '../../enums/report-status.enum';
import { ResourceEventsPublisher } from '../events/resource-events.publisher';
import { toSkipTake } from '../types/pagination';
import {
	type CreateReportInput,
	type ListReportsInput,
	type UpdateReportInput,
} from '../types/report.input';
import { type Requester } from '../types/requester';
import { FileOwnershipService } from './file-ownership.service';
import { TransactionHost, Transactional } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, PrismaClient, Report, ReportFile } from '@prisma-client/resource';

type ReportWithFiles = Report & { files: Pick<ReportFile, 'fileId'>[] };

const withFiles = { files: { select: { fileId: true } } } satisfies Prisma.ReportInclude;

@Injectable()
export class ReportService {
	constructor(
		private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaClient>>,
		private readonly events: ResourceEventsPublisher,
		private readonly fileOwnership: FileOwnershipService,
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
			// Rows from before C30 may name a staff member on an open report: not a resolver.
			resolvedBy: isFinalReportStatus(report.status) ? (report.resolvedBy ?? undefined) : undefined,
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

	/** `SELECT … FOR UPDATE` on the report row, so a concurrent resolution waits for this change. */
	private async lockReport(id: string): Promise<void> {
		await this.txHost.tx.$queryRaw`SELECT id FROM reports WHERE id = ${id} FOR UPDATE`;
	}

	/** Resolved (or otherwise finished) reports are frozen: 409 for any change. */
	private assertOpen(report: Pick<Report, 'status'>): void {
		if (isFinalReportStatus(report.status)) {
			throw new ConflictException(
				`This report is already ${report.status} and can no longer be changed`,
			);
		}
	}

	/**
	 * The uploader check (a gRPC call) runs before the transaction opens, so no DB transaction waits
	 * on it. `mayAttachAnyFile` (admins) skips it, as on `addFileToReport`.
	 */
	async createReport(data: CreateReportInput): Promise<ReportReadModel> {
		const fileIds = [...new Set(data.fileIds)];
		if (!data.mayAttachAnyFile) await this.fileOwnership.assertOwnedBy(fileIds, data.reportedBy);
		return this.insertReport(data, fileIds);
	}

	@Transactional()
	private async insertReport(data: CreateReportInput, fileIds: string[]): Promise<ReportReadModel> {
		const report = await this.txHost.tx.report.create({
			data: {
				reportedBy: data.reportedBy,
				type: data.type,
				title: data.title,
				description: data.description,
				targetType: data.targetType ?? null,
				targetId: data.targetId ?? null,
				files:
					fileIds.length > 0 ? { create: fileIds.map(fileId => ({ fileId: fileId })) } : undefined,
			},
			include: withFiles,
		});
		// Sequential: the outbox rows share one interactive transaction.
		for (const fileId of fileIds) await this.events.fileAdded(fileId);
		await this.events.reportCreated({
			reportId: report.id,
			reportedBy: report.reportedBy,
			type: report.type,
			title: report.title,
			targetType: report.targetType,
			targetId: report.targetId,
		});
		return this.toReadModel(report);
	}

	async getReport(id: string, requester: Requester): Promise<ReportReadModel> {
		return this.toReadModel(await this.findVisibleReport(id, requester));
	}

	/**
	 * A report is resolved once, by one person: after it reaches a final status (`isFinalReportStatus`)
	 * every update is 409, staff included. The row is locked first, so of two staff members resolving
	 * at once the second waits, then sees the final status and gets 409. `resolvedBy` is set only by
	 * the move into a final status (to the caller); while the report is open it stays null.
	 */
	@Transactional()
	async updateReport(data: UpdateReportInput): Promise<ReportReadModel> {
		await this.lockReport(data.id);
		const report = await this.txHost.tx.report.findUnique({ where: { id: data.id } });
		if (!report) throw new NotFoundException('Report not found');
		this.assertOpen(report);

		const status = data.status ?? report.status;
		const updated = await this.txHost.tx.report.update({
			where: { id: data.id },
			data: {
				status: status,
				resolvedBy: isFinalReportStatus(status) ? (data.resolvedBy ?? null) : null,
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

	@Transactional()
	async deleteReport(id: string): Promise<void> {
		const files = await this.txHost.tx.reportFile.findMany({
			where: { reportId: id },
			select: { fileId: true },
		});
		const { count } = await this.txHost.tx.report.deleteMany({ where: { id: id } });
		if (count === 0) throw new NotFoundException('Report not found');
		// the attachments go with the report (cascade): release their references
		await this.events.filesRemoved(files.map(f => ({ id: f.fileId, count: 1 })));
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

	/**
	 * `mayAttachAnyFile` (admins) skips the uploader check; everyone else attaches only their own
	 * uploads. The check (a gRPC call) runs before the transaction opens.
	 */
	async addFileToReport(
		reportId: string,
		fileId: string,
		requester: Requester,
		mayAttachAnyFile = false,
	): Promise<void> {
		this.assertOpen(await this.findVisibleReport(reportId, requester));
		if (!mayAttachAnyFile) await this.fileOwnership.assertOwnedBy([fileId], requester.id);
		await this.attachFile(reportId, fileId, requester);
	}

	@Transactional()
	private async attachFile(reportId: string, fileId: string, requester: Requester): Promise<void> {
		// again inside the transaction, locked: the report may have been deleted or resolved meanwhile
		await this.lockReport(reportId);
		this.assertOpen(await this.findVisibleReport(reportId, requester));
		const { count } = await this.txHost.tx.reportFile.createMany({
			data: [{ reportId: reportId, fileId: fileId }],
			skipDuplicates: true,
		});
		// only a new attachment adds a reference (re-attaching is a no-op)
		if (count > 0) await this.events.fileAdded(fileId);
	}

	@Transactional()
	async removeFileFromReport(
		reportId: string,
		fileId: string,
		requester: Requester,
	): Promise<void> {
		await this.lockReport(reportId);
		this.assertOpen(await this.findVisibleReport(reportId, requester));
		const { count } = await this.txHost.tx.reportFile.deleteMany({
			where: { reportId: reportId, fileId: fileId },
		});
		if (count === 0) throw new NotFoundException('File is not attached to this report');
		await this.events.filesRemoved([{ id: fileId, count: 1 }]);
	}
}
