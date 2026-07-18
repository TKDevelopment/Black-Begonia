import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { Project, ProjectStatus } from '../../../../core/models/project';
import { Lead } from '../../../../core/models/lead';
import { ActivityLogEntry } from '../../../../core/models/activity-log';
import { ProjectPaymentRecord } from '../../../../core/models/project-payment-record';
import { ProjectProposalDocumentVersion } from '../../../../core/models/project-proposal-document-version';
import { ProjectProposalInvoiceSnapshot } from '../../../../core/models/project-proposal-invoice-snapshot';
import { ProjectRepositoryService } from '../../../../core/supabase/repositories/project-repository.service';
import { LeadRepositoryService } from '../../../../core/supabase/repositories/lead-repository.service';
import { ProjectPaymentRecordRepositoryService } from '../../../../core/supabase/repositories/project-payment-record-repository.service';
import { ActivityRepositoryService } from '../../../../core/supabase/repositories/activity-repository.service';
import { ProjectProposalDocumentVersionRepositoryService } from '../../../../core/supabase/repositories/project-proposal-document-version-repository.service';
import { ProjectProposalInvoiceSnapshotRepositoryService } from '../../../../core/supabase/repositories/project-proposal-invoice-snapshot-repository.service';
import { ProjectWorkflowService } from '../../../../core/supabase/services/project-workflow.service';
import { ProjectProposalRevisionService } from '../../../../core/supabase/services/project-proposal-revision.service';
import { SupabaseService } from '../../../../core/supabase/clients/supabase.service';
import { formatDateOnlyForDisplay } from '../../../../core/utils/date-only';
import { CrmPageHeaderComponent } from '../../../../shared/components/private/crm-page-header/crm-page-header.component';
import { ErrorStateBlockComponent } from '../../../../shared/components/private/error-state-block/error-state-block.component';
import { LoadingStateBlockComponent } from '../../../../shared/components/private/loading-state-block/loading-state-block.component';
import { StatusBadgeComponent } from '../../../../shared/components/private/status-badge/status-badge.component';
import { ProjectFinancialSummaryCardComponent } from '../components/project-financial-summary-card/project-financial-summary-card.component';
import { ProjectPaymentLogModalComponent, ProjectPaymentLogPayload } from '../components/project-payment-log-modal/project-payment-log-modal.component';
import { ProjectActivityPanelComponent } from '../components/project-activity-panel/project-activity-panel.component';
import { ProjectProposalDocumentsSectionComponent } from '../components/project-proposal-documents-section/project-proposal-documents-section.component';
import {
  ProjectEditModalComponent,
  ProjectEditPayload,
} from '../components/project-edit-modal/project-edit-modal.component';

@Component({
  selector: 'app-project-details',
  standalone: true,
  imports: [
    CommonModule,
    CrmPageHeaderComponent,
    ErrorStateBlockComponent,
    LoadingStateBlockComponent,
    StatusBadgeComponent,
    ProjectFinancialSummaryCardComponent,
    ProjectPaymentLogModalComponent,
    ProjectActivityPanelComponent,
    ProjectProposalDocumentsSectionComponent,
    ProjectEditModalComponent,
  ],
  templateUrl: './project-details.component.html',
  styleUrl: './project-details.component.scss',
})
export class ProjectDetailsComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly projectRepository = inject(ProjectRepositoryService);
  private readonly leadRepository = inject(LeadRepositoryService);
  private readonly paymentRepository = inject(ProjectPaymentRecordRepositoryService);
  private readonly activityRepository = inject(ActivityRepositoryService);
  private readonly documentRepository = inject(ProjectProposalDocumentVersionRepositoryService);
  private readonly snapshotRepository = inject(ProjectProposalInvoiceSnapshotRepositoryService);
  private readonly projectWorkflow = inject(ProjectWorkflowService);
  private readonly proposalRevision = inject(ProjectProposalRevisionService);
  private readonly supabaseService = inject(SupabaseService);

  readonly loading = signal(true);
  readonly documentsLoading = signal(false);
  readonly savingPayment = signal(false);
  readonly savingProject = signal(false);
  readonly error = signal<string | null>(null);
  readonly sectionError = signal<string | null>(null);
  readonly editModalOpen = signal(false);
  readonly paymentModalOpen = signal(false);

  readonly project = signal<Project | null>(null);
  readonly sourceLead = signal<Lead | null>(null);
  readonly payments = signal<ProjectPaymentRecord[]>([]);
  readonly activities = signal<ActivityLogEntry[]>([]);
  readonly documents = signal<ProjectProposalDocumentVersion[]>([]);
  readonly snapshots = signal<ProjectProposalInvoiceSnapshot[]>([]);

  readonly snapshotState = computed(() => {
    const project = this.project();
    return project
      ? this.proposalRevision.resolveSnapshotState(project, this.snapshots())
      : { state: 'load_error' as const, repairMessage: 'Project details are still loading.' };
  });

  readonly activeSnapshot = computed(() => {
    const state = this.snapshotState();
    return state.state === 'valid' ? state.snapshot : null;
  });

  readonly documentState = computed(() => {
    const project = this.project();
    const snapshot = this.activeSnapshot();
    if (!project || !snapshot) {
      return { state: 'load_error' as const, repairMessage: 'A valid active snapshot is required before opening the active PDF.' };
    }
    return this.proposalRevision.resolveDocumentState(project, snapshot, this.documents());
  });

  readonly activeDocument = computed(() => {
    const state = this.documentState();
    return state.state === 'valid' ? state.document : null;
  });

  readonly revisionDisabledReason = computed(() => {
    const state = this.snapshotState();
    return state.state === 'valid' ? null : state.repairMessage;
  });

  readonly documentDisabledReason = computed(() => {
    const state = this.documentState();
    return state.state === 'valid' ? null : state.repairMessage;
  });

  readonly sortedPayments = computed(() => {
    return [...this.payments()].sort((a, b) => {
      const left = this.paymentSortDate(a);
      const right = this.paymentSortDate(b);
      return right - left;
    });
  });

  async ngOnInit(): Promise<void> {
    await this.loadProjectDetails();
  }

  async loadProjectDetails(): Promise<void> {
    const projectId = this.route.snapshot.paramMap.get('projectId');
    if (!projectId) {
      this.error.set('We could not determine which project to open.');
      this.loading.set(false);
      return;
    }

    this.loading.set(true);
    this.error.set(null);
    this.sectionError.set(null);

    try {
      const project = await this.projectRepository.getProjectById(projectId);
      if (!project) {
        this.error.set('This project could not be found.');
        return;
      }

      this.project.set(project);
      this.sourceLead.set(await this.loadSourceLead(project));
      await this.loadSections(project.project_id);
    } catch (error) {
      console.error('[ProjectDetailsComponent] loadProjectDetails error:', error);
      this.error.set('We could not load this project right now.');
    } finally {
      this.loading.set(false);
    }
  }

  private async loadSourceLead(project: Project): Promise<Lead | null> {
    if (!project.source_lead_id) {
      return null;
    }

    try {
      return await this.leadRepository.getLeadById(project.source_lead_id);
    } catch (error) {
      console.error('[ProjectDetailsComponent] loadSourceLead error:', error);
      this.sectionError.set('Some customer and planner details could not be loaded.');
      return null;
    }
  }

  async loadSections(projectId: string): Promise<void> {
    this.documentsLoading.set(true);

    const [payments, activities, documents, snapshots] = await Promise.all([
      this.paymentRepository.getProjectPaymentRecords(projectId).catch((error) => {
        console.error('[ProjectDetailsComponent] payments error:', error);
        this.sectionError.set('Some financial records could not be loaded.');
        return [];
      }),
      this.activityRepository.getProjectActivity(projectId).catch((error) => {
        console.error('[ProjectDetailsComponent] activity error:', error);
        this.sectionError.set('Some project activity could not be loaded.');
        return [];
      }),
      this.documentRepository.getProjectDocumentVersions(projectId).catch((error) => {
        console.error('[ProjectDetailsComponent] documents error:', error);
        this.sectionError.set('Some proposal documents could not be loaded.');
        return [];
      }),
      this.snapshotRepository.getProjectSnapshots(projectId).catch((error) => {
        console.error('[ProjectDetailsComponent] snapshots error:', error);
        this.sectionError.set('Some financial snapshots could not be loaded.');
        return [];
      }),
    ]);

    this.payments.set(payments);
    this.activities.set(activities);
    this.documents.set(documents);
    this.snapshots.set(snapshots);
    this.documentsLoading.set(false);
  }

  async savePayment(payload: ProjectPaymentLogPayload): Promise<void> {
    const project = this.project();
    if (!project || this.savingPayment()) return;

    this.savingPayment.set(true);
    this.sectionError.set(null);

    try {
      const result = await this.projectWorkflow.recordPayment(project, payload);
      if (result.project) {
        this.project.set(result.project);
      }
      this.paymentModalOpen.set(false);
      await this.loadSections(project.project_id);
    } catch (error) {
      console.error('[ProjectDetailsComponent] savePayment error:', error);
      this.sectionError.set(error instanceof Error ? error.message : 'We could not save the payment.');
    } finally {
      this.savingPayment.set(false);
    }
  }

  async saveProject(updates: ProjectEditPayload): Promise<void> {
    const project = this.project();
    if (!project || this.savingProject()) return;

    const {
      event_start_time,
      ceremony_start_time,
      reception_start_time,
      ...projectUpdates
    } = updates;

    this.savingProject.set(true);
    this.sectionError.set(null);

    try {
      this.project.set(await this.projectWorkflow.updateProject(project, projectUpdates));

      const hasTimingUpdate = [
        event_start_time,
        ceremony_start_time,
        reception_start_time,
      ].some((value) => value !== undefined);

      if (project.source_lead_id && hasTimingUpdate) {
        const updatedLead = await this.leadRepository.updateLead(project.source_lead_id, {
          event_start_time,
          ceremony_start_time,
          reception_start_time,
        });
        this.sourceLead.set(updatedLead);

        await this.activityRepository.createProjectActivity({
          project_id: project.project_id,
          activity_type: 'updated',
          activity_label: 'Project timing updated',
          description: 'Ceremony and reception timing was updated.',
          metadata: {
            event_start_time,
            ceremony_start_time,
            reception_start_time,
          },
        });
      }

      this.editModalOpen.set(false);
      await this.loadSections(project.project_id);
    } catch (error) {
      console.error('[ProjectDetailsComponent] saveProject error:', error);
      this.sectionError.set('We could not save project updates right now.');
    } finally {
      this.savingProject.set(false);
    }
  }

  reviseProposal(): void {
    const project = this.project();
    const disabledReason = this.revisionDisabledReason();
    if (!project || disabledReason) {
      this.sectionError.set(disabledReason ?? 'This project cannot start a proposal revision.');
      return;
    }
    void this.router.navigate(['/admin/projects', project.project_id, 'proposal-revision']);
  }

  async openActivePdf(): Promise<void> {
    const document = this.activeDocument();
    if (!document) {
      this.sectionError.set('No active proposal PDF is available for this project.');
      return;
    }

    await this.openDocument(document);
  }

  async openDocument(document: ProjectProposalDocumentVersion): Promise<void> {
    const { data, error } = await this.supabaseService
      .getClient()
      .storage
      .from(document.storage_bucket)
      .createSignedUrl(document.storage_path, 60 * 10);

    if (error || !data?.signedUrl) {
      this.sectionError.set('We could not open this proposal document right now.');
      return;
    }

    window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  }

  backToProjects(): void {
    void this.router.navigate(['/admin/projects']);
  }

  formatDate(value: string | null | undefined): string {
    return formatDateOnlyForDisplay(value, 'No date set', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  formatDateTime(value: string | null | undefined): string {
    if (!value) {
      return 'Not recorded';
    }

    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(value));
  }

  formatCurrency(value: number | null | undefined): string {
    if (value === null || value === undefined || Number.isNaN(Number(value))) {
      return 'Unavailable';
    }

    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(Number(value));
  }

  formatPaymentKind(value: string | null | undefined): string {
    if (value === 'final_payment') {
      return 'Final Payment';
    }

    return this.formatDisplayValue(value);
  }

  formatPaymentMethod(value: string | null | undefined): string {
    return value ? this.formatDisplayValue(value) : 'Not set';
  }

  formatTime(value: string | null | undefined): string {
    if (!value) {
      return 'Not set';
    }

    const [hourText, minuteText = '0'] = value.split(':');
    const hour = Number(hourText);
    const minute = Number(minuteText);
    if (Number.isNaN(hour) || Number.isNaN(minute)) {
      return value;
    }

    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(2000, 0, 1, hour, minute));
  }

  formatAddress(parts: Array<string | null | undefined>): string {
    const value = parts
      .map((part) => part?.trim())
      .filter((part): part is string => !!part)
      .join(', ');

    return value || 'Not set';
  }

  formatPersonName(
    firstName: string | null | undefined,
    lastName: string | null | undefined
  ): string {
    const value = [firstName, lastName]
      .map((part) => part?.trim())
      .filter((part): part is string => !!part)
      .join(' ');

    return value || 'Not set';
  }

  formatPhone(value: string | null | undefined): string {
    const digits = String(value ?? '').replace(/\D/g, '');
    const normalized = digits.length > 10 && digits.startsWith('1')
      ? digits.slice(1)
      : digits;

    if (normalized.length !== 10) {
      return value?.trim() || 'Not set';
    }

    return `(${normalized.slice(0, 3)}) ${normalized.slice(3, 6)}-${normalized.slice(6)}`;
  }

  formatDisplayValue(value: string | null | undefined): string {
    if (!value) return 'Not set';
    return value.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
  }

  getProjectStatusTone(
    status: ProjectStatus
  ): 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'purple' {
    switch (status) {
      case 'awaiting_deposit':
        return 'warning';
      case 'booked':
        return 'success';
      case 'awaiting_final_payment':
        return 'danger';
      case 'final_prep':
        return 'purple';
      case 'completed':
        return 'success';
      case 'canceled':
      default:
        return 'neutral';
    }
  }

  private paymentSortDate(payment: ProjectPaymentRecord): number {
    const value = payment.paid_date ?? payment.due_date ?? payment.created_at;
    return value ? new Date(value).getTime() : 0;
  }
}
