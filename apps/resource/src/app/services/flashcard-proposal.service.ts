import { type CardContent, withFields } from '../../domain/flash-card-fork/card-content';
import {
	type EvaluatedChanges,
	type ListChanges,
	countConflicts,
	evaluateChanges,
	isEmptyChanges,
	notEvaluated,
} from '../../domain/flash-card-fork/list-diff';
import { parseListChanges } from '../../domain/flash-card-fork/proposal-changes';
import {
	type FlashCardProposalDetailReadModel,
	type FlashCardProposalReadModel,
	type FlashCardProposalsPageReadModel,
} from '../../domain/read-models/flash-card-proposal.read-model';
import { FlashCardProposalStatus } from '@server/typing';
import { ResourceEventsPublisher } from '../events/resource-events.publisher';
import {
	cardContentData,
	toCardContent,
	toChangesJson,
	toListChangesReadModel,
	toSnapshotJson,
} from '../mappers/flash-card-fork.mapper';
import {
	type AcceptFlashCardProposalInput,
	type CreateFlashCardProposalInput,
	type ListFlashCardProposalsInput,
} from '../types/flash-card-proposal.input';
import { toSkipTake } from '../types/pagination';
import { type Requester } from '../types/requester';
import { FlashcardForkService } from './flashcard-fork.service';
import { TransactionHost, Transactional } from '@nestjs-cls/transactional';
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import {
	BadRequestException,
	ConflictException,
	ForbiddenException,
	Injectable,
	NotFoundException,
} from '@nestjs/common';
import { FlashCardListProposal, Prisma, PrismaClient } from '@prisma-client/resource';
import { randomUUID } from 'node:crypto';

const WITH_LISTS = {
	target: { select: { id: true, name: true, authorId: true } },
	source: { select: { id: true, name: true } },
} satisfies Prisma.FlashCardListProposalInclude;

type ProposalWithLists = FlashCardListProposal & {
	target: { id: string; name: string; authorId: string };
	source: { id: string; name: string } | null;
};

/** Proposals the requester may see: their own, those on their lists, or all when privileged. */
const visibleProposalsWhere = (requester: Requester): Prisma.FlashCardListProposalWhereInput =>
	requester.privileged ?
		{}
	:	{ OR: [{ authorId: requester.id }, { target: { authorId: requester.id } }] };

const canDecide = (proposal: ProposalWithLists, requester: Requester): boolean =>
	requester.privileged || proposal.target.authorId === requester.id;

/** Proposals to apply a copy's changes to its original (like pull requests). */
@Injectable()
export class FlashcardProposalService {
	constructor(
		private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaClient>>,
		private readonly events: ResourceEventsPublisher,
		private readonly forks: FlashcardForkService,
	) {}

	private toReadModel(proposal: ProposalWithLists): FlashCardProposalReadModel {
		const changes = parseListChanges(proposal.changes);
		return {
			id: proposal.id,
			sourceListId: proposal.source?.id,
			sourceListName: proposal.source?.name,
			targetListId: proposal.target.id,
			targetListName: proposal.target.name,
			targetOwnerId: proposal.target.authorId,
			authorId: proposal.authorId,
			title: proposal.title,
			message: proposal.message,
			status: proposal.status,
			addedCount: changes.added.length,
			modifiedCount: changes.modified.length,
			removedCount: changes.removed.length,
			decidedAt: proposal.decidedAt?.toISOString(),
			decidedBy: proposal.decidedBy ?? undefined,
			decisionNote: proposal.decisionNote ?? undefined,
			createdAt: proposal.createdAt.toISOString(),
			updatedAt: proposal.updatedAt.toISOString(),
		};
	}

	/** 404 for proposals the requester may not see, so their ids don't leak. */
	private async findVisible(id: string, requester: Requester): Promise<ProposalWithLists> {
		const proposal = await this.txHost.tx.flashCardListProposal.findFirst({
			where: { id: id, ...visibleProposalsWhere(requester) },
			include: WITH_LISTS,
		});
		if (!proposal) throw new NotFoundException('Proposal not found');
		return proposal;
	}

	/** Moves an open proposal to its final status; the conditional update also locks the row. */
	private async close(
		proposal: ProposalWithLists,
		status: FlashCardProposalStatus,
		requester: Requester,
		note: string | undefined,
	): Promise<ProposalWithLists> {
		const { count } = await this.txHost.tx.flashCardListProposal.updateMany({
			where: { id: proposal.id, status: FlashCardProposalStatus.Open },
			data: {
				status: status,
				decidedAt: new Date(),
				decidedBy: requester.id,
				decisionNote: note?.trim() || null,
			},
		});
		if (count === 0) throw new ConflictException('This proposal is no longer open');
		return this.txHost.tx.flashCardListProposal.findUniqueOrThrow({
			where: { id: proposal.id },
			include: WITH_LISTS,
		});
	}

	/** The original's cards that the changes touch, as they are now. */
	private async currentCards(
		targetListId: string,
		changes: ListChanges,
	): Promise<Map<string, CardContent>> {
		const ids = [
			...changes.modified.map(c => c.targetCardId),
			...changes.removed.map(c => c.targetCardId),
		];
		if (ids.length === 0) return new Map();
		const cards = await this.txHost.tx.flashCard.findMany({
			where: { id: { in: ids }, listId: targetListId },
		});
		return new Map(cards.map(c => [c.id, toCardContent(c)]));
	}

	@Transactional()
	async createFlashCardProposal(
		data: CreateFlashCardProposalInput,
		requester: Requester,
	): Promise<FlashCardProposalReadModel> {
		const pair = await this.forks.findForkWithOriginal(data.sourceListId, requester);
		if (pair.original.authorId === requester.id) {
			throw new BadRequestException('You cannot propose changes to your own list');
		}
		const open = await this.txHost.tx.flashCardListProposal.findFirst({
			where: {
				sourceListId: pair.fork.id,
				targetListId: pair.original.id,
				status: FlashCardProposalStatus.Open,
			},
			select: { id: true },
		});
		if (open) throw new ConflictException('An open proposal already exists for this list');

		const changes = this.forks.diffOf(pair);
		if (isEmptyChanges(changes)) {
			throw new BadRequestException('There are no changes to propose');
		}

		const created = await this.txHost.tx.flashCardListProposal.create({
			data: {
				sourceListId: pair.fork.id,
				targetListId: pair.original.id,
				authorId: requester.id,
				title: data.title.trim(),
				message: data.message?.trim() ?? '',
				status: FlashCardProposalStatus.Open,
				changes: toChangesJson(changes),
			},
			include: WITH_LISTS,
		});
		await this.events.flashCardProposalCreated({
			proposalId: created.id,
			targetListId: created.target.id,
			targetListName: created.target.name,
			targetOwnerId: created.target.authorId,
			authorId: created.authorId,
			title: created.title,
		});
		return this.toReadModel(created);
	}

	async listFlashCardProposals(
		data: ListFlashCardProposalsInput,
		requester: Requester,
	): Promise<FlashCardProposalsPageReadModel> {
		const filters: Prisma.FlashCardListProposalWhereInput = {};
		if (data.targetListId) filters.targetListId = data.targetListId;
		if (data.sourceListId) filters.sourceListId = data.sourceListId;
		if (data.status) filters.status = data.status;
		if (data.mine) filters.authorId = requester.id;
		const where: Prisma.FlashCardListProposalWhereInput = {
			AND: [filters, visibleProposalsWhere(requester)],
		};

		const [proposals, totalCount] = await Promise.all([
			this.txHost.tx.flashCardListProposal.findMany({
				where: where,
				include: WITH_LISTS,
				...toSkipTake(data),
				orderBy: { createdAt: 'desc' },
			}),
			this.txHost.tx.flashCardListProposal.count({ where: where }),
		]);
		return { proposals: proposals.map(p => this.toReadModel(p)), totalCount: totalCount };
	}

	async getFlashCardProposal(
		id: string,
		requester: Requester,
	): Promise<FlashCardProposalDetailReadModel> {
		const proposal = await this.findVisible(id, requester);
		const changes = parseListChanges(proposal.changes);
		const isOpen = proposal.status === String(FlashCardProposalStatus.Open);
		// Conflicts only matter while the proposal can still be accepted.
		const evaluated: EvaluatedChanges =
			isOpen ?
				evaluateChanges(changes, await this.currentCards(proposal.targetListId, changes))
			:	notEvaluated(changes);
		return {
			...this.toReadModel(proposal),
			changes: toListChangesReadModel(evaluated),
			conflictCount: countConflicts(evaluated),
			canDecide: isOpen && canDecide(proposal, requester),
			canWithdraw: isOpen && proposal.authorId === requester.id,
		};
	}

	/**
	 * Applies the proposal to the original in one transaction: creates the added cards (owned by
	 * the list owner), updates the changed fields of modified cards and deletes removed cards.
	 * Cards the owner changed since the proposal (conflicts) need a resolution each: apply the
	 * proposal's version, or keep the owner's.
	 */
	@Transactional()
	async acceptFlashCardProposal(
		data: AcceptFlashCardProposalInput,
		requester: Requester,
	): Promise<FlashCardProposalReadModel> {
		const proposal = await this.findVisible(data.id, requester);
		if (!canDecide(proposal, requester)) {
			throw new ForbiddenException('Only the list owner can accept this proposal');
		}
		const closed = await this.close(
			proposal,
			FlashCardProposalStatus.Accepted,
			requester,
			data.decisionNote,
		);

		const changes = parseListChanges(proposal.changes);
		const evaluated = evaluateChanges(
			changes,
			await this.currentCards(proposal.targetListId, changes),
		);
		const resolutions = new Map(data.resolutions.map(r => [r.targetCardId, r.apply]));
		const unresolved = [...evaluated.modified, ...evaluated.removed].filter(
			c => c.conflict && !resolutions.has(c.targetCardId),
		);
		if (unresolved.length > 0) {
			throw new ConflictException('This proposal has unresolved conflicts');
		}
		const shouldApply = (change: { conflict: boolean; targetCardId: string }): boolean =>
			!change.conflict || resolutions.get(change.targetCardId) === true;

		const ownerId = proposal.target.authorId;
		const sourceListId = proposal.sourceListId;
		const created: string[] = [];
		for (const change of evaluated.added) {
			const id = randomUUID();
			await this.txHost.tx.flashCard.create({
				data: {
					id: id,
					...cardContentData(change.card),
					authorId: ownerId,
					listId: proposal.targetListId,
				},
			});
			created.push(id);
			// Link the proposer's card to the new one, so the copy no longer shows it as added.
			if (sourceListId) {
				await this.txHost.tx.flashCard.updateMany({
					where: { id: change.sourceCardId, listId: sourceListId },
					data: { originCardId: id, originSnapshot: toSnapshotJson(change.card) },
				});
			}
		}
		for (const id of created) await this.events.resourceCreated('flashcard', id, ownerId);

		for (const change of evaluated.modified) {
			if (!change.current || !shouldApply(change)) continue;
			const merged = withFields(change.current, change.proposed, change.fields);
			await this.txHost.tx.flashCard.update({
				where: { id: change.targetCardId },
				data: cardContentData(merged),
			});
			if (sourceListId) {
				await this.txHost.tx.flashCard.updateMany({
					where: { id: change.sourceCardId, listId: sourceListId },
					data: { originSnapshot: toSnapshotJson(merged) },
				});
			}
		}

		const removed = evaluated.removed
			.filter(c => c.current && shouldApply(c))
			.map(c => c.targetCardId);
		if (removed.length > 0) {
			await this.txHost.tx.flashCard.deleteMany({
				where: { id: { in: removed }, listId: proposal.targetListId },
			});
			await this.events.resourcesDeleted('flashcard', removed);
		}

		await this.publishDecision(closed, requester);
		return this.toReadModel(closed);
	}

	@Transactional()
	async rejectFlashCardProposal(
		id: string,
		decisionNote: string | undefined,
		requester: Requester,
	): Promise<FlashCardProposalReadModel> {
		const proposal = await this.findVisible(id, requester);
		if (!canDecide(proposal, requester)) {
			throw new ForbiddenException('Only the list owner can reject this proposal');
		}
		const closed = await this.close(
			proposal,
			FlashCardProposalStatus.Rejected,
			requester,
			decisionNote,
		);
		await this.publishDecision(closed, requester);
		return this.toReadModel(closed);
	}

	@Transactional()
	async withdrawFlashCardProposal(
		id: string,
		requester: Requester,
	): Promise<FlashCardProposalReadModel> {
		const proposal = await this.findVisible(id, requester);
		if (proposal.authorId !== requester.id) {
			throw new ForbiddenException('Only the proposer can withdraw this proposal');
		}
		const closed = await this.close(
			proposal,
			FlashCardProposalStatus.Withdrawn,
			requester,
			undefined,
		);
		return this.toReadModel(closed);
	}

	private async publishDecision(proposal: ProposalWithLists, requester: Requester): Promise<void> {
		await this.events.flashCardProposalDecided({
			proposalId: proposal.id,
			targetListId: proposal.target.id,
			targetListName: proposal.target.name,
			authorId: proposal.authorId,
			title: proposal.title,
			status: proposal.status,
			decidedBy: requester.id,
			decisionNote: proposal.decisionNote,
		});
	}
}
