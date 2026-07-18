import { Injectable, signal } from '@angular/core';

import { Project } from '../../models/project';
import {
  ActiveProposalDocumentState,
  ActiveProposalSnapshotState,
  EditableProposalSnapshotV2,
  ProjectProposalRevisionWorkspace,
  ProposalRevisionSaveState,
  SaveProjectProposalRevisionWorkspaceInput,
} from '../../models/project-proposal-revision-workspace';
import { ProjectProposalDocumentVersion } from '../../models/project-proposal-document-version';
import { ProjectProposalInvoiceSnapshot } from '../../models/project-proposal-invoice-snapshot';
import { ProjectRepositoryService } from '../repositories/project-repository.service';
import { ProjectProposalDocumentVersionRepositoryService } from '../repositories/project-proposal-document-version-repository.service';
import { ProjectProposalInvoiceSnapshotRepositoryService } from '../repositories/project-proposal-invoice-snapshot-repository.service';
import { ProjectProposalRevisionWorkspaceRepositoryService } from '../repositories/project-proposal-revision-workspace-repository.service';
import { SupabaseService } from '../clients/supabase.service';
import { FloralProposalBuilderService } from './floral-proposal-builder.service';

export interface LoadedProjectProposalRevision {
  project: Project;
  activeSnapshot: ProjectProposalInvoiceSnapshot;
  documentState: ActiveProposalDocumentState;
  workspace: ProjectProposalRevisionWorkspace;
  compatibilityWarning: string | null;
}

@Injectable({ providedIn: 'root' })
export class ProjectProposalRevisionService {
  readonly saveState = signal<ProposalRevisionSaveState>('idle');
  readonly saveError = signal<string | null>(null);

  private autosaveTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingSave: (() => Promise<ProjectProposalRevisionWorkspace>) | null = null;
  private saveChain = Promise.resolve<ProjectProposalRevisionWorkspace | null>(null);

  constructor(
    private readonly projectRepository: ProjectRepositoryService,
    private readonly snapshotRepository: ProjectProposalInvoiceSnapshotRepositoryService,
    private readonly documentRepository: ProjectProposalDocumentVersionRepositoryService,
    private readonly workspaceRepository: ProjectProposalRevisionWorkspaceRepositoryService,
    private readonly builderService: FloralProposalBuilderService,
    private readonly supabaseService: SupabaseService
  ) {}

  isEligibleStatus(status: Project['status']): boolean {
    return status === 'awaiting_deposit'
      || status === 'booked'
      || status === 'awaiting_final_payment'
      || status === 'final_prep';
  }

  resolveSnapshotState(
    project: Project,
    snapshots: ProjectProposalInvoiceSnapshot[]
  ): ActiveProposalSnapshotState {
    if (!this.isEligibleStatus(project.status)) {
      return {
        state: 'ineligible_project_status',
        repairMessage: 'Completed or canceled projects cannot start a proposal revision.',
      };
    }
    const active = snapshots.filter((snapshot) => snapshot.is_active);
    if (!active.length) {
      return { state: 'missing_snapshot', repairMessage: 'This project has no active proposal snapshot.' };
    }
    if (active.length !== 1) {
      return {
        state: 'conflicting_snapshots',
        repairMessage: 'This project has conflicting active proposal snapshots and needs data repair.',
      };
    }
    const snapshot = active[0];
    if (
      !project.active_proposal_invoice_snapshot_id
      || project.active_proposal_invoice_snapshot_id !== snapshot.project_proposal_invoice_snapshot_id
      || snapshot.project_id !== project.project_id
    ) {
      return {
        state: 'broken_snapshot_reference',
        repairMessage: 'The project active proposal pointer does not match its active snapshot.',
      };
    }
    return { state: 'valid', snapshot };
  }

  resolveDocumentState(
    project: Project,
    activeSnapshot: ProjectProposalInvoiceSnapshot,
    documents: ProjectProposalDocumentVersion[]
  ): ActiveProposalDocumentState {
    if (!project.active_proposal_document_version_id) {
      return { state: 'missing_document', repairMessage: 'No active proposal PDF is linked to this project.' };
    }
    const document = documents.find(
      (candidate) =>
        candidate.project_proposal_document_version_id === project.active_proposal_document_version_id
    );
    if (!document || document.project_id !== project.project_id) {
      return {
        state: 'broken_document_reference',
        repairMessage: 'The linked active proposal PDF could not be found.',
      };
    }
    if (!document.is_active || document.status !== 'submitted') {
      return {
        state: 'inactive_document_reference',
        repairMessage: 'The linked proposal PDF is not active.',
      };
    }
    if (
      document.invoice_snapshot_id !== activeSnapshot.project_proposal_invoice_snapshot_id
      || document.version !== activeSnapshot.version
    ) {
      return {
        state: 'mismatched_snapshot_document_pair',
        repairMessage: 'The active proposal PDF does not match the active financial snapshot.',
      };
    }
    return { state: 'valid', document };
  }

  async loadOrInitialize(projectId: string): Promise<LoadedProjectProposalRevision> {
    const project = await this.projectRepository.getProjectById(projectId);
    if (!project) throw new Error('This project could not be found.');

    const [snapshots, documents, existingWorkspace] = await Promise.all([
      this.snapshotRepository.getProjectSnapshots(projectId),
      this.documentRepository.getProjectDocumentVersions(projectId),
      this.workspaceRepository.getForProject(projectId),
    ]);
    const snapshotState = this.resolveSnapshotState(project, snapshots);
    if (snapshotState.state !== 'valid') throw new Error(snapshotState.repairMessage);

    const activeSnapshot = snapshotState.snapshot;
    const documentState = this.resolveDocumentState(project, activeSnapshot, documents);
    if (existingWorkspace) {
      if (existingWorkspace.baseline_invoice_snapshot_id !== activeSnapshot.project_proposal_invoice_snapshot_id) {
        throw new Error('The active proposal changed after this saved revision was created. Discard it before starting again.');
      }
      return { project, activeSnapshot, documentState, workspace: existingWorkspace, compatibilityWarning: null };
    }

    const adaptation = this.builderService.adaptProjectSnapshot(activeSnapshot.snapshot, {
      subtotal: activeSnapshot.subtotal,
      taxRate: activeSnapshot.tax_rate,
      taxAmount: activeSnapshot.tax_amount,
      totalAmount: activeSnapshot.total_amount,
      retainerAmount: activeSnapshot.retainer_amount,
      finalBalanceAmount: activeSnapshot.final_balance_amount,
      retainerDueDate: activeSnapshot.retainer_due_date,
      finalBalanceDueDate: activeSnapshot.final_balance_due_date,
    });
    if (!adaptation.valid || !adaptation.draft) {
      throw new Error(adaptation.repairMessage ?? 'The active proposal snapshot cannot initialize a revision.');
    }
    const user = await this.supabaseService.getUser();
    const input = this.workspaceInput(
      project,
      activeSnapshot,
      adaptation.draft,
      user?.id ?? null
    );
    const workspace = await this.workspaceRepository.createOrGet(input);
    return {
      project,
      activeSnapshot,
      documentState,
      workspace,
      compatibilityWarning: adaptation.warning ?? null,
    };
  }

  queueAutosave(
    workspace: ProjectProposalRevisionWorkspace,
    draft: EditableProposalSnapshotV2,
    updatedBy?: string | null
  ): void {
    if (this.autosaveTimer) clearTimeout(this.autosaveTimer);
    this.saveState.set('saving');
    this.saveError.set(null);
    this.pendingSave = () => this.saveWorkspace(workspace, draft, updatedBy ?? null);
    this.autosaveTimer = setTimeout(() => void this.flushAutosave(), 750);
  }

  async flushAutosave(): Promise<ProjectProposalRevisionWorkspace | null> {
    if (this.autosaveTimer) {
      clearTimeout(this.autosaveTimer);
      this.autosaveTimer = null;
    }
    const save = this.pendingSave;
    this.pendingSave = null;
    if (!save) return this.saveChain;

    this.saveChain = this.saveChain.catch(() => null).then(async () => {
      try {
        const result = await save();
        this.saveState.set('saved');
        this.saveError.set(null);
        return result;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'The revision could not be saved.';
        this.saveState.set('error');
        this.saveError.set(message);
        throw error;
      }
    });
    return this.saveChain;
  }

  async retryAutosave(
    workspace: ProjectProposalRevisionWorkspace,
    draft: EditableProposalSnapshotV2,
    updatedBy?: string | null
  ): Promise<ProjectProposalRevisionWorkspace | null> {
    this.pendingSave = () => this.saveWorkspace(workspace, draft, updatedBy ?? null);
    this.saveState.set('saving');
    this.saveError.set(null);
    return this.flushAutosave();
  }

  async prepareSubmission(
    workspace: ProjectProposalRevisionWorkspace,
    fileName: string,
    updatedBy?: string | null
  ): Promise<ProjectProposalRevisionWorkspace> {
    const existingKey = workspace.pending_submission_key;
    if (existingKey && workspace.pending_pdf_storage_path && workspace.pending_pdf_file_name === fileName) {
      return workspace;
    }
    const key = crypto.randomUUID();
    const sanitized = fileName.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, '-');
    const storagePath = `projects/${workspace.project_id}/proposal-revisions/${key}-${sanitized}`;
    return this.workspaceRepository.update(
      workspace.project_proposal_revision_workspace_id,
      workspace.project_id,
      {
        pending_submission_key: key,
        pending_pdf_storage_path: storagePath,
        pending_pdf_file_name: fileName,
        updated_by: updatedBy ?? null,
      }
    );
  }

  async discard(workspace: ProjectProposalRevisionWorkspace): Promise<void> {
    if (this.autosaveTimer) clearTimeout(this.autosaveTimer);
    this.autosaveTimer = null;
    this.pendingSave = null;
    await this.workspaceRepository.discard(
      workspace.project_proposal_revision_workspace_id,
      workspace.project_id
    );
    this.saveState.set('idle');
  }

  private saveWorkspace(
    workspace: ProjectProposalRevisionWorkspace,
    draft: EditableProposalSnapshotV2,
    updatedBy: string | null
  ): Promise<ProjectProposalRevisionWorkspace> {
    return this.workspaceRepository.update(
      workspace.project_proposal_revision_workspace_id,
      workspace.project_id,
      {
        draft_snapshot: draft,
        schema_version: draft.schema_version,
        subtotal: draft.totals.subtotal,
        tax_rate: draft.tax_region.tax_rate,
        tax_amount: draft.totals.taxAmount,
        total_amount: draft.totals.totalAmount,
        retainer_amount: draft.financial_terms.retainer_amount,
        final_balance_amount: draft.financial_terms.final_balance_amount,
        retainer_due_date: draft.financial_terms.retainer_due_date ?? null,
        final_balance_due_date: draft.financial_terms.final_balance_due_date ?? null,
        pending_submission_key: null,
        pending_pdf_storage_path: null,
        pending_pdf_file_name: null,
        updated_by: updatedBy,
      }
    );
  }

  private workspaceInput(
    project: Project,
    snapshot: ProjectProposalInvoiceSnapshot,
    draft: EditableProposalSnapshotV2,
    userId: string | null
  ): SaveProjectProposalRevisionWorkspaceInput {
    return {
      project_id: project.project_id,
      baseline_invoice_snapshot_id: snapshot.project_proposal_invoice_snapshot_id,
      source_lead_id: snapshot.source_lead_id ?? project.source_lead_id ?? null,
      schema_version: draft.schema_version,
      draft_snapshot: draft,
      subtotal: draft.totals.subtotal,
      tax_rate: draft.tax_region.tax_rate,
      tax_amount: draft.totals.taxAmount,
      total_amount: draft.totals.totalAmount,
      retainer_amount: draft.financial_terms.retainer_amount,
      final_balance_amount: draft.financial_terms.final_balance_amount,
      retainer_due_date: draft.financial_terms.retainer_due_date ?? null,
      final_balance_due_date: draft.financial_terms.final_balance_due_date ?? null,
      pending_submission_key: null,
      pending_pdf_storage_path: null,
      pending_pdf_file_name: null,
      created_by: userId,
      updated_by: userId,
    };
  }
}
