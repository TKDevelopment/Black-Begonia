import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { EntityDetailShellComponent } from '../../../../shared/components/private/entity-detail-shell/entity-detail-shell.component';
import { StatusBadgeComponent } from '../../../../shared/components/private/status-badge/status-badge.component';
import { LoadingStateBlockComponent } from '../../../../shared/components/private/loading-state-block/loading-state-block.component';
import { ErrorStateBlockComponent } from '../../../../shared/components/private/error-state-block/error-state-block.component';

import { LeadRepositoryService } from '../../../../core/supabase/repositories/lead-repository.service';
import { ActivityRepositoryService } from '../../../../core/supabase/repositories/activity-repository.service';
import { LeadWorkflowService } from '../../../../core/supabase/services/lead-workflow.service';
import { FloralProposalWorkflowService } from '../../../../core/supabase/services/floral-proposal-workflow.service';
import { LeadInspirationUrlRepositoryService } from '../../../../core/supabase/repositories/lead-inspiration-url-repository.service';

import { Lead } from '../../../../core/models/lead';
import { LeadActivity } from '../../../../core/models/lead-activity';
import { FloralProposal } from '../../../../core/models/floral-proposal';
import { FloralProposalResponseSummary } from '../../../../core/models/floral-proposal';
import { LeadInspirationUrl } from '../../../../core/models/lead-inspiration-url';
import { LeadSummaryCardComponent } from '../components/lead-summary-card/lead-summary-card.component';
import { LeadStatusSelectorComponent } from '../components/lead-status-selector/lead-status-selector.component';
import { LeadDeclineModalComponent } from '../components/lead-decline-modal/lead-decline-modal.component';
import { LeadStatus } from '../../../../core/models/lead-status';
import { InternalUserRepositoryService } from '../../../../core/supabase/repositories/internal-user-repository.service';
import { InternalUser } from '../../../../core/models/internal-user';
import { Task } from '../../../../core/models/task';
import {
  TaskListItem,
  TaskListPanelComponent,
} from '../../../../shared/components/private/task-list-panel/task-list-panel.component';
import {
  LeadConvertModalComponent,
  LeadConvertPayload,
} from '../components/lead-convert-modal/lead-convert-modal.component';
import { ConfirmDialogComponent } from '../../../../shared/components/private/confirm-dialog/confirm-dialog.component';
import { LeadProposalHistoryCardComponent } from '../components/lead-proposal-history-card/lead-proposal-history-card.component';
import { LeadUpsertModalComponent } from '../components/lead-upsert-modal/lead-upsert-modal.component';
import { LeadUpsertPayload } from '../components/lead-upsert-modal/lead-upsert.types';
import { ToastService } from '../../../../core/services/toast.service';
import { CrmThemeService } from '../../../../core/services/crm-theme.service';
import {
  ConvertLeadInput,
  LeadConversionService,
} from '../../../../core/supabase/services/lead-conversion.service';
import { TaskWorkflowService } from '../../../../core/supabase/services/task-workflow.service';
import {
  TaskUpsertModalComponent,
  TaskUpsertPayload,
} from '../../tasks/components/task-upsert-modal/task-upsert-modal.component';

type BadgeTone =
  | 'neutral'
  | 'info'
  | 'success'
  | 'warning'
  | 'danger'
  | 'purple';

@Component({
  selector: 'app-lead-detail',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    EntityDetailShellComponent,
    StatusBadgeComponent,
    LoadingStateBlockComponent,
    ErrorStateBlockComponent,
    LeadSummaryCardComponent,
    LeadStatusSelectorComponent,
    LeadDeclineModalComponent,
    TaskListPanelComponent,
    LeadConvertModalComponent,
    ConfirmDialogComponent,
    LeadProposalHistoryCardComponent,
    LeadUpsertModalComponent,
    TaskUpsertModalComponent,
  ],
  templateUrl: './lead-detail.component.html',
  styleUrl: './lead-detail.component.scss',
})
export class LeadDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private leadRepository = inject(LeadRepositoryService);
  private activityRepository = inject(ActivityRepositoryService);
  private leadWorkflow = inject(LeadWorkflowService);
  private proposalWorkflow = inject(FloralProposalWorkflowService);
  private inspirationUrlRepository = inject(LeadInspirationUrlRepositoryService);
  private internalUserRepository = inject(InternalUserRepositoryService);
  private leadConversionService = inject(LeadConversionService);
  private taskWorkflow = inject(TaskWorkflowService);
  private toast = inject(ToastService);
  readonly crmThemeService = inject(CrmThemeService);

  loading = signal(true);
  error = signal<string | null>(null);
  actionLoading = signal(false);
  inspirationUploadLoading = signal(false);
  inspirationDropActive = signal(false);
  deletingInspirationId = signal<string | null>(null);

  lead = signal<Lead | null>(null);
  activities = signal<LeadActivity[]>([]);
  proposals = signal<FloralProposal[]>([]);
  inspirationUrls = signal<LeadInspirationUrl[]>([]);

  declineModalOpen = signal(false);
  proposalModalOpen = signal(false);
  proposalSubmitting = signal(false);
  proposalResending = signal(false);
  selectedProposalId = signal<string | null>(null);

  internalUsers = signal<InternalUser[]>([]);
  leadTasks = signal<Task[]>([]);
  taskLoading = signal(false);
  taskSaving = signal(false);
  taskModalOpen = signal(false);
  taskModalMode = signal<'create' | 'edit'>('create');
  selectedTask = signal<Task | null>(null);

  convertModalOpen = signal(false);
  convertLoading = signal(false);

  editModalOpen = signal(false);
  editSaving = signal(false);
  noteSaving = signal(false);
  noteDraft = signal('');
  noteDraftError = signal<string | null>(null);
  editingNoteId = signal<string | null>(null);
  editingNoteDraft = signal('');
  editingNoteError = signal<string | null>(null);
  deletingNoteId = signal<string | null>(null);

  confirmDialogOpen = signal(false);

  private currentLeadId = signal<string | null>(null);

  assignedUserName = computed(() => {
    const lead = this.lead();
    if (!lead?.assigned_user_id) return 'Unassigned';

    const user = this.internalUsers().find(
      (item) => item.id === lead.assigned_user_id
    );

    if (!user) return 'Unassigned';

    const fullName = `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim();
    return fullName || user.email;
  });

  allowedStatuses = computed(() => {
    const lead = this.lead();
    if (!lead) return [] as LeadStatus[];
    return this.leadWorkflow.getAllowedNextStatuses(lead.status);
  });

  proposalResponses = computed<Record<string, FloralProposalResponseSummary[]>>(() => {
    const summaries = this.activities()
      .map((activity) => this.mapActivityToProposalResponse(activity))
      .filter((summary): summary is FloralProposalResponseSummary => summary !== null);

    return summaries.reduce<Record<string, FloralProposalResponseSummary[]>>((acc, summary) => {
      acc[summary.proposal_id] = [...(acc[summary.proposal_id] ?? []), summary].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      return acc;
    }, {});
  });

  noteActivities = computed(() =>
    this.activities().filter((activity) => activity.activity_type === 'note_added')
  );

  timelineActivities = computed(() =>
    this.activities().filter((activity) => activity.activity_type !== 'note_added')
  );

  title = computed(() => {
    const lead = this.lead();
    if (!lead) return 'Lead Details';
    return `${lead.first_name} ${lead.last_name}`;
  });

  subtitle = computed(() => {
    const lead = this.lead();
    if (!lead) return 'Lead record';
    return `${lead.event_type || lead.service_type} Inquiry`;
  });

  consultationButtonLabel = computed(() => {
    const lead = this.lead();
    if (!lead) return 'Schedule Consultation';

    return this.leadWorkflow.getConsultationButtonLabel(lead.status);
  });

  consultationButtonDisabled = computed(() => {
    const lead = this.lead();

    if (!lead) return true;
    if (this.actionLoading()) return true;
    if (this.proposalSubmitting()) return true;
    if (this.isLeadReadOnly()) return true;

    return this.leadWorkflow.isConsultationButtonDisabled(lead.status);
  });

  canSubmitProposal = computed(() => {
    const lead = this.lead();
    return !!lead && !this.isLeadReadOnly() && this.proposalWorkflow.canSubmitProposal(lead.status);
  });

  isLeadLocked = computed(() => this.lead()?.status === 'converted');
  isLeadReadOnly = computed(() => {
    const status = this.lead()?.status;
    return status === 'converted' || status === 'declined' || status === 'closed_unbooked';
  });
  canReopenClosedUnbookedLead = computed(() => {
    const lead = this.lead();
    return !!lead && lead.status === 'closed_unbooked' && !this.actionLoading();
  });

  canResendProposalAccess = computed(() => {
    const lead = this.lead();
    return !!lead && !this.isLeadReadOnly();
  });

  showQuickActionConvertButton = computed(() => {
    return false;
  });

  ngOnInit(): void {
    const leadId = this.route.snapshot.paramMap.get('leadId');

    if (!leadId) {
      void this.router.navigate(['/admin/leads']);
      return;
    }

    this.currentLeadId.set(leadId);
    void this.initializePage(leadId);
  }

  async initializePage(leadId: string): Promise<void> {
    await Promise.all([this.loadLeadDetail(leadId), this.loadInternalUsers()]);
  }

  async loadInternalUsers(): Promise<void> {
    try {
      const users = await this.internalUserRepository.getInternalUsers();
      this.internalUsers.set(users);
    } catch (error) {
      console.error('[LeadDetailComponent] loadInternalUsers error:', error);
      this.internalUsers.set([]);
    }
  }

  async loadLeadDetail(leadId: string): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    try {
      const [lead, activities, proposals, inspirationUrls, tasks] = await Promise.all([
        this.leadRepository.getLeadById(leadId),
        this.activityRepository.getLeadActivity(leadId),
        this.proposalWorkflow.getLeadProposals(leadId),
        this.inspirationUrlRepository.getInspirationUrlsByLeadId(leadId),
        this.taskWorkflow.getTasksByLeadId(leadId),
      ]);

      if (!lead) {
        this.error.set('We could not find this lead record.');
        this.lead.set(null);
        this.activities.set([]);
        this.proposals.set([]);
        this.inspirationUrls.set([]);
        this.leadTasks.set([]);
        this.selectedProposalId.set(null);
        return;
      }

      this.lead.set(lead);
      this.activities.set(activities);
      this.proposals.set(proposals);
      this.inspirationUrls.set(inspirationUrls);
      this.leadTasks.set(tasks);
      this.syncSelectedProposal(proposals);
    } catch (error) {
      console.error('[LeadDetailComponent] loadLeadDetail error:', error);
      this.error.set('We were unable to load this lead right now.');
      this.lead.set(null);
      this.activities.set([]);
      this.proposals.set([]);
      this.inspirationUrls.set([]);
      this.leadTasks.set([]);
      this.selectedProposalId.set(null);
    } finally {
      this.loading.set(false);
    }
  }

  async retryLoad(): Promise<void> {
    const leadId = this.currentLeadId();
    if (!leadId) return;

    await this.loadLeadDetail(leadId);
  }

  async refreshLeadDetail(): Promise<void> {
    const leadId = this.currentLeadId();
    if (!leadId) return;

    try {
      const [lead, activities, proposals, inspirationUrls, tasks] = await Promise.all([
        this.leadRepository.getLeadById(leadId),
        this.activityRepository.getLeadActivity(leadId),
        this.proposalWorkflow.getLeadProposals(leadId),
        this.inspirationUrlRepository.getInspirationUrlsByLeadId(leadId),
        this.taskWorkflow.getTasksByLeadId(leadId),
      ]);

      this.lead.set(lead);
      this.activities.set(activities);
      this.proposals.set(proposals);
      this.inspirationUrls.set(inspirationUrls);
      this.leadTasks.set(tasks);
      this.syncSelectedProposal(proposals);
    } catch (error) {
      console.error('[LeadDetailComponent] refreshLeadDetail error:', error);
    }
  }

  goBack(): void {
    void this.router.navigate(['/admin/leads']);
  }

  openInspirationUrl(url: string): void {
    const normalizedUrl = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    window.open(normalizedUrl, '_blank', 'noopener,noreferrer');
  }

  openInspirationPicker(input: HTMLInputElement): void {
    if (this.isLeadReadOnly() || this.inspirationUploadLoading()) return;
    input.click();
  }

  onInspirationDragOver(event: DragEvent): void {
    if (this.isLeadReadOnly()) return;
    event.preventDefault();
    this.inspirationDropActive.set(true);
  }

  onInspirationDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.inspirationDropActive.set(false);
  }

  onInspirationDrop(event: DragEvent): void {
    if (this.isLeadReadOnly()) return;
    event.preventDefault();
    this.inspirationDropActive.set(false);

    const files = event.dataTransfer?.files;
    if (!files?.length) return;

    void this.uploadInspirationPhotos(files);
  }

  onInspirationFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    const files = input?.files;

    if (!files?.length) return;

    void this.uploadInspirationPhotos(files).finally(() => {
      if (input) {
        input.value = '';
      }
    });
  }

  async deleteInspirationPhoto(inspiration: LeadInspirationUrl): Promise<void> {
    const lead = this.lead();
    if (!lead || this.isLeadReadOnly()) return;
    if (this.deletingInspirationId() === inspiration.lead_inspiration_url_id) return;

    try {
      this.deletingInspirationId.set(inspiration.lead_inspiration_url_id);
      await this.inspirationUrlRepository.deleteInspirationPhoto(inspiration);

      await this.activityRepository.createLeadActivity({
        lead_id: lead.lead_id,
        activity_type: 'updated',
        activity_label: 'Inspiration photo deleted',
        activity_description: `Deleted inspiration photo link: ${inspiration.url}.`,
        metadata: {
          deleted_from: 'crm_lead_detail',
          lead_inspiration_url_id: inspiration.lead_inspiration_url_id,
        },
      });

      await this.refreshLeadDetail();
      this.toast.showToast('Inspiration photo deleted.', 'success');
    } catch (error) {
      console.error('[LeadDetailComponent] deleteInspirationPhoto error:', error);
      this.error.set(
        error instanceof Error
          ? error.message
          : 'We were unable to delete the inspiration photo right now.'
      );
    } finally {
      this.deletingInspirationId.set(null);
    }
  }

  getLeadStatusTone(status: Lead['status']): BadgeTone {
    switch (status) {
      case 'new':
        return 'info';
      case 'contacted':
        return 'neutral';
      case 'consultation_scheduled':
        return 'warning';
      case 'nurturing':
        return 'purple';
      case 'proposal_submitted':
        return 'warning';
      case 'proposal_declined':
        return 'danger';
      case 'proposal_accepted':
      case 'accepted':
      case 'converted':
        return 'success';
      case 'declined':
        return 'danger';
      case 'closed_unbooked':
        return 'neutral';
      default:
        return 'neutral';
    }
  }

  formatDate(value: string | null | undefined): string {
    if (!value) return 'Not set';

    return new Intl.DateTimeFormat('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    }).format(new Date(value));
  }

  formatDateTime(value: string | null | undefined): string {
    if (!value) return 'Not available';

    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(value));
  }

  formatCurrency(value: number | null | undefined): string {
    if (value == null) return 'Not provided';

    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(value);
  }

  getBudgetRange(): string {
    const lead = this.lead();
    if (!lead) return 'Not provided';

    return lead.budget_range ?? 'Not provided';
  }

  getActivityIconClasses(type: string): string {
    switch (type) {
      case 'created':
        return 'bg-blue-100 text-blue-700';
      case 'email':
        return 'bg-purple-100 text-purple-700';
      case 'call':
        return 'bg-amber-100 text-amber-700';
      case 'updated':
      case 'note_added':
        return 'bg-stone-100 text-stone-700';
      case 'proposal_viewed':
        return 'bg-blue-100 text-blue-700';
      case 'task_created':
        return 'bg-purple-100 text-purple-700';
      case 'task_completed':
        return 'bg-emerald-100 text-emerald-700';
      case 'status_change':
      case 'status_changed':
      case 'contact_attempted':
      case 'consultation_scheduled':
      case 'declined':
      case 'accepted':
      case 'converted':
        return 'bg-emerald-100 text-emerald-700';
      default:
        return 'bg-stone-100 text-stone-700';
    }
  }

  getActivityIconPath(type: string): string {
    switch (type) {
      case 'created':
        return 'M12 5v14m7-7H5';
      case 'email':
        return 'M4 6h16v12H4zm0 0 8 6 8-6';
      case 'call':
        return 'M5.5 4.5h3l1.5 4-2 1.5a15 15 0 0 0 6 6L15.5 14l4 1.5v3a1 1 0 0 1-1 1A15.5 15.5 0 0 1 4.5 5.5a1 1 0 0 1 1-1Z';
      case 'proposal_viewed':
        return 'M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Zm9.5-3.25A3.25 3.25 0 1 0 12 15.25 3.25 3.25 0 0 0 12 8.75Z';
      case 'task_created':
      case 'task_completed':
        return 'M9 11.5 11 13.5 15 9.5M7 4.5h10a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-11a2 2 0 0 1 2-2Zm-2 4H3m2 4H3';
      case 'status_change':
      case 'status_changed':
      case 'contact_attempted':
      case 'consultation_scheduled':
      case 'declined':
      case 'accepted':
      case 'converted':
        return 'M12 4v4l3 3m5-1a8 8 0 1 1-2.34-5.66';
      case 'updated':
      case 'note_added':
      default:
        return 'M8 7.5h8M8 12h8m-8 4.5h5M5.5 7.5h.01M5.5 12h.01M5.5 16.5h.01';
    }
  }

  async handleConsultationAction(): Promise<void> {
    const lead = this.lead();
    if (!lead || this.actionLoading()) return;
    if (this.isLeadReadOnly()) return;

    if (lead.status === 'proposal_accepted') {
      this.openConvertModal();
      return;
    }

    if (this.proposalWorkflow.canSubmitProposal(lead.status)) {
      void this.router.navigate(['/admin/leads', lead.lead_id, 'floral-proposal-builder']);
      return;
    }

    try {
      this.actionLoading.set(true);

      if (lead.status === 'consultation_scheduled') {
        await this.leadWorkflow.completeConsultation(lead);
      } else {
        await this.leadWorkflow.scheduleConsultation(lead);
      }

      await this.refreshLeadDetail();
    } catch (error) {
      console.error('[LeadDetailComponent] handleConsultationAction error:', error);
      this.error.set('We were unable to update the consultation workflow.');
    } finally {
      this.actionLoading.set(false);
    }
  }

  openProposalModal(): void {
    const lead = this.lead();
    if (!lead || this.isLeadReadOnly()) return;
    void this.router.navigate(['/admin/leads', lead.lead_id, 'floral-proposal-builder']);
  }

  closeProposalModal(): void {
    this.proposalModalOpen.set(false);
  }

  async submitProposal(_file: File): Promise<void> {
    this.openProposalModal();
  }

  async resendProposalAccess(proposalId: string): Promise<void> {
    if (!proposalId || this.proposalResending() || this.isLeadReadOnly()) return;

    try {
      this.proposalResending.set(true);
      await this.proposalWorkflow.resendProposalAccessEmail(proposalId);
      await this.refreshLeadDetail();
      this.toast.showToast('Proposal access email resent.', 'success');
    } catch (error) {
      console.error('[LeadDetailComponent] resendProposalAccess error:', error);
      this.error.set(
        error instanceof Error
          ? error.message
          : 'We were unable to resend proposal access right now.'
      );
    } finally {
      this.proposalResending.set(false);
    }
  }

  selectProposal(proposalId: string): void {
    this.selectedProposalId.set(proposalId);
  }

  openProposal(url: string): void {
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  async markContacted(): Promise<void> {
    const lead = this.lead();
    if (!lead || this.actionLoading() || this.isLeadReadOnly()) return;

    try {
      this.actionLoading.set(true);
      await this.leadWorkflow.markContacted(lead.lead_id);
      await this.refreshLeadDetail();
    } catch (error) {
      console.error('[LeadDetailComponent] markContacted error:', error);
      this.error.set('We were unable to update this lead.');
    } finally {
      this.actionLoading.set(false);
    }
  }

  async openTask(task: TaskListItem): Promise<void> {
    if (this.taskSaving()) return;

    try {
      this.taskLoading.set(true);
      const fullTask = await this.taskWorkflow.getTaskById(task.task_id);

      if (!fullTask) {
        this.toast.showToast('We could not find that task.', 'error');
        return;
      }

      this.selectedTask.set(fullTask);
      this.taskModalMode.set('edit');
      this.taskModalOpen.set(true);
    } catch (error) {
      console.error('[LeadDetailComponent] openTask error:', error);
      this.error.set('We were unable to open this task right now.');
    } finally {
      this.taskLoading.set(false);
    }
  }

  createTaskFromLead(): void {
    if (this.isLeadReadOnly()) return;
    this.selectedTask.set(null);
    this.taskModalMode.set('create');
    this.taskModalOpen.set(true);
  }

  closeTaskModal(force = false): void {
    if (this.taskSaving() && !force) return;
    this.taskModalOpen.set(false);
    this.taskModalMode.set('create');
    this.selectedTask.set(null);
  }

  async saveTask(payload: TaskUpsertPayload): Promise<void> {
    const lead = this.lead();
    if (!lead || this.taskSaving()) return;

    try {
      this.taskSaving.set(true);

      if (this.taskModalMode() === 'create') {
        await this.taskWorkflow.createTask({
          ...payload,
          related_entity_type: 'lead',
          related_entity_id: lead.lead_id,
          lead_id: lead.lead_id,
          project_id: null,
        });
        this.toast.showToast('Task created.', 'success');
      } else {
        const selectedTask = this.selectedTask();
        if (!selectedTask) return;

        await this.taskWorkflow.updateTask(selectedTask, payload);
        this.toast.showToast('Task updated.', 'success');
      }

      this.closeTaskModal(true);
      await this.refreshLeadDetail();
    } catch (error) {
      console.error('[LeadDetailComponent] saveTask error:', error);
      this.error.set('We were unable to save the task right now.');
    } finally {
      this.taskSaving.set(false);
    }
  }

  convertLead(): void {
    if (this.isLeadReadOnly()) return;
    this.openConvertModal();
  }

  editLead(): void {
    if (this.isLeadReadOnly()) return;
    this.editModalOpen.set(true);
  }

  closeEditModal(): void {
    this.editModalOpen.set(false);
  }

  async saveLeadEdits(payload: LeadUpsertPayload): Promise<void> {
    const lead = this.lead();
    if (!lead || this.editSaving()) return;

    const updates: Partial<Lead> = {
      event_type: payload.event_type,
      service_type: payload.service_type,
      first_name: payload.first_name,
      last_name: payload.last_name,
      partner_first_name: payload.event_type === 'wedding' ? payload.partner_first_name ?? null : null,
      partner_last_name: payload.event_type === 'wedding' ? payload.partner_last_name ?? null : null,
      planner_name: payload.event_type === 'wedding' ? payload.planner_name ?? null : null,
      planner_phone: payload.event_type === 'wedding' ? payload.planner_phone ?? null : null,
      planner_email: payload.event_type === 'wedding' ? payload.planner_email ?? null : null,
      email: payload.email,
      phone: payload.phone ?? null,
      preferred_contact_method: payload.preferred_contact_method ?? null,
      event_date: payload.event_date ?? null,
      ceremony_venue_name: payload.event_type === 'wedding' ? payload.ceremony_venue_name ?? null : null,
      ceremony_venue_city: payload.event_type === 'wedding' ? payload.ceremony_venue_city ?? null : null,
      ceremony_venue_state: payload.event_type === 'wedding' ? payload.ceremony_venue_state ?? null : null,
      reception_venue_name: payload.event_type === 'wedding' ? payload.reception_venue_name ?? null : null,
      reception_venue_city: payload.event_type === 'wedding' ? payload.reception_venue_city ?? null : null,
      reception_venue_state: payload.event_type === 'wedding' ? payload.reception_venue_state ?? null : null,
      budget_range: payload.event_type === 'wedding' ? payload.budget_range ?? null : null,
      guest_count: payload.event_type === 'wedding' ? payload.guest_count ?? null : null,
      inquiry_message: payload.inquiry_message ?? null,
      source: payload.source ?? 'other',
    };

    const changedFields = this.getChangedFields(lead, updates);

    try {
      this.editSaving.set(true);
      await this.leadRepository.updateLead(lead.lead_id, updates);

      await this.activityRepository.createLeadActivity({
        lead_id: lead.lead_id,
        activity_type: 'updated',
        activity_label: 'Lead details updated',
        activity_description: changedFields.length
          ? `Updated fields: ${changedFields.join(', ')}.`
          : 'Lead details were saved from the CRM edit flow.',
        metadata: {
          changed_fields: changedFields,
          updated_from: 'crm_lead_detail',
        },
      });

      this.editModalOpen.set(false);
      await this.refreshLeadDetail();
      this.toast.showToast('Lead updated successfully.', 'success');
    } catch (error) {
      console.error('[LeadDetailComponent] saveLeadEdits error:', error);
      this.error.set('We were unable to save lead updates right now.');
    } finally {
      this.editSaving.set(false);
    }
  }

  startEditingNote(note: LeadActivity): void {
    this.editingNoteId.set(note.lead_activity_id);
    this.editingNoteDraft.set(note.activity_description ?? '');
    this.editingNoteError.set(null);
  }

  cancelEditingNote(): void {
    this.editingNoteId.set(null);
    this.editingNoteDraft.set('');
    this.editingNoteError.set(null);
  }

  async saveInternalNote(): Promise<void> {
    const lead = this.lead();
    if (!lead || this.noteSaving()) return;
    const note = this.noteDraft().trim();

    if (!note) {
      this.noteDraftError.set('Please enter a note before saving.');
      return;
    }

    try {
      this.noteSaving.set(true);
      this.noteDraftError.set(null);
      await this.activityRepository.createLeadActivity({
        lead_id: lead.lead_id,
        activity_type: 'note_added',
        activity_label: 'Internal note',
        activity_description: note,
        metadata: {
          note_source: 'crm_lead_detail',
          note_kind: 'internal',
        },
      });

      this.noteDraft.set('');
      await this.refreshLeadDetail();
      this.toast.showToast('Internal note added.', 'success');
    } catch (error) {
      console.error('[LeadDetailComponent] saveInternalNote error:', error);
      this.error.set('We were unable to save the internal note.');
    } finally {
      this.noteSaving.set(false);
    }
  }

  async saveEditedNote(note: LeadActivity): Promise<void> {
    const draft = this.editingNoteDraft().trim();

    if (!draft) {
      this.editingNoteError.set('Please enter a note before saving.');
      return;
    }

    try {
      this.noteSaving.set(true);
      this.editingNoteError.set(null);
      await this.activityRepository.updateLeadActivity(note.lead_activity_id, {
        activity_label: 'Internal note',
        activity_description: draft,
        metadata: {
          ...(note.metadata ?? {}),
          note_source: 'crm_lead_detail',
          note_kind: 'internal',
          edited_at: new Date().toISOString(),
        },
      });

      this.cancelEditingNote();
      await this.refreshLeadDetail();
      this.toast.showToast('Internal note updated.', 'success');
    } catch (error) {
      console.error('[LeadDetailComponent] saveEditedNote error:', error);
      this.error.set('We were unable to update the internal note.');
    } finally {
      this.noteSaving.set(false);
    }
  }

  async deleteNote(note: LeadActivity): Promise<void> {
    if (this.deletingNoteId() === note.lead_activity_id) return;

    try {
      this.deletingNoteId.set(note.lead_activity_id);
      await this.activityRepository.deleteLeadActivity(note.lead_activity_id);

      if (this.editingNoteId() === note.lead_activity_id) {
        this.cancelEditingNote();
      }

      await this.refreshLeadDetail();
      this.toast.showToast('Internal note deleted.', 'success');
    } catch (error) {
      console.error('[LeadDetailComponent] deleteNote error:', error);
      this.error.set('We were unable to delete the internal note.');
    } finally {
      this.deletingNoteId.set(null);
    }
  }

  openConvertModal(): void {
    if (this.isLeadReadOnly()) return;
    this.convertModalOpen.set(true);
  }

  closeConvertModal(): void {
    this.convertModalOpen.set(false);
  }

  async confirmConvert(payload: LeadConvertPayload): Promise<void> {
    const lead = this.lead();
    if (!lead || this.convertLoading()) return;

    try {
      this.convertLoading.set(true);
      const result = await this.leadConversionService.convertLead(
        lead,
        payload as ConvertLeadInput
      );

      this.convertModalOpen.set(false);
      await this.refreshLeadDetail();
      this.toast.showToast(
        `Lead converted to project "${result.project.project_name}".`,
        'success'
      );
    } catch (error) {
      console.error('[LeadDetailComponent] confirmConvert error:', error);
      this.error.set('We were unable to convert this lead.');
    } finally {
      this.convertLoading.set(false);
    }
  }

  openDeclineModal(): void {
    if (this.isLeadReadOnly()) return;
    this.declineModalOpen.set(true);
  }

  closeDeclineModal(): void {
    this.declineModalOpen.set(false);
  }

  async confirmDecline(reason: string): Promise<void> {
    const lead = this.lead();
    if (!lead || this.actionLoading()) return;

    try {
      this.actionLoading.set(true);
      await this.leadWorkflow.declineLead(lead.lead_id, reason);
      this.declineModalOpen.set(false);
      await this.refreshLeadDetail();
    } catch (error) {
      console.error('[LeadDetailComponent] confirmDecline error:', error);
      this.error.set('We were unable to decline this lead.');
    } finally {
      this.actionLoading.set(false);
    }
  }

  async updateLeadStatus(nextStatus: LeadStatus): Promise<void> {
    const lead = this.lead();
    if (!lead || this.actionLoading() || lead.status === nextStatus || this.isLeadReadOnly()) return;

    try {
      this.actionLoading.set(true);
      await this.leadWorkflow.updateStatus(lead, nextStatus);
      await this.refreshLeadDetail();
    } catch (error) {
      console.error('[LeadDetailComponent] updateLeadStatus error:', error);
      this.error.set('We were unable to update the lead status.');
    } finally {
      this.actionLoading.set(false);
    }
  }

  async reopenClosedUnbookedLead(): Promise<void> {
    const lead = this.lead();
    if (!lead || lead.status !== 'closed_unbooked' || this.actionLoading()) return;

    try {
      this.actionLoading.set(true);
      await this.leadWorkflow.reopenClosedUnbookedLead(lead);
      await this.refreshLeadDetail();
      this.toast.showToast('Lead reopened and moved back to Nurturing.', 'success');
    } catch (error) {
      console.error('[LeadDetailComponent] reopenClosedUnbookedLead error:', error);
      this.error.set('We were unable to reopen this lead right now.');
    } finally {
      this.actionLoading.set(false);
    }
  }

  private async uploadInspirationPhotos(files: FileList): Promise<void> {
    const lead = this.lead();
    if (!lead || this.inspirationUploadLoading() || this.isLeadReadOnly()) return;

    const imageFiles = Array.from(files).filter((file) =>
      file.type.toLowerCase().startsWith('image/')
    );

    if (!imageFiles.length) {
      this.toast.showToast('Please upload image files only.', 'error');
      return;
    }

    try {
      this.inspirationUploadLoading.set(true);

      await Promise.all(
        imageFiles.map((file) =>
          this.inspirationUrlRepository.uploadInspirationPhoto(lead.lead_id, file)
        )
      );

      await this.activityRepository.createLeadActivity({
        lead_id: lead.lead_id,
        activity_type: 'updated',
        activity_label: 'Inspiration photos uploaded',
        activity_description:
          imageFiles.length === 1
            ? `Uploaded 1 inspiration photo: ${imageFiles[0].name}.`
            : `Uploaded ${imageFiles.length} inspiration photos.`,
        metadata: {
          uploaded_from: 'crm_lead_detail',
          uploaded_count: imageFiles.length,
        },
      });

      await this.refreshLeadDetail();
      this.toast.showToast(
        imageFiles.length === 1
          ? 'Inspiration photo uploaded.'
          : 'Inspiration photos uploaded.',
        'success'
      );
    } catch (error) {
      console.error('[LeadDetailComponent] uploadInspirationPhotos error:', error);
      this.error.set(
        error instanceof Error
          ? error.message
          : 'We were unable to upload inspiration photos right now.'
      );
    } finally {
      this.inspirationUploadLoading.set(false);
      this.inspirationDropActive.set(false);
    }
  }

  private syncSelectedProposal(proposals: FloralProposal[]): void {
    const currentSelection = this.selectedProposalId();
    const nextSelection = proposals.find(
      (proposal) => proposal.floral_proposal_id === currentSelection
    )?.floral_proposal_id;

    this.selectedProposalId.set(nextSelection ?? proposals[0]?.floral_proposal_id ?? null);
  }

  private mapActivityToProposalResponse(
    activity: LeadActivity
  ): FloralProposalResponseSummary | null {
    const metadata = activity.metadata as Record<string, unknown> | null;
    const proposalId = typeof metadata?.['floral_proposal_id'] === 'string'
      ? metadata['floral_proposal_id']
      : null;
    const responseAction = metadata?.['response_action'];

    if (!proposalId || (responseAction !== 'accept' && responseAction !== 'decline')) {
      return null;
    }

    const feedbackValue = metadata?.['feedback'];

    return {
      proposal_id: proposalId,
      action: responseAction,
      feedback: typeof feedbackValue === 'string' && feedbackValue.trim().length
        ? feedbackValue
        : null,
      created_at: activity.created_at,
    };
  }

  private getChangedFields(lead: Lead, updates: Partial<Lead>): string[] {
    const labels: Record<string, string> = {
      event_type: 'event type',
      service_type: 'service type',
      first_name: 'first name',
      last_name: 'last name',
      partner_first_name: 'partner first name',
      partner_last_name: 'partner last name',
      planner_name: 'planner name',
      planner_phone: 'planner phone',
      planner_email: 'planner email',
      email: 'email',
      phone: 'phone',
      preferred_contact_method: 'preferred contact',
      event_date: 'event date',
      ceremony_venue_name: 'ceremony venue',
      ceremony_venue_city: 'ceremony city',
      ceremony_venue_state: 'ceremony state',
      reception_venue_name: 'reception venue',
      reception_venue_city: 'reception city',
      reception_venue_state: 'reception state',
      budget_range: 'budget range',
      guest_count: 'guest count',
      inquiry_message: 'inquiry message',
      source: 'source',
    };

    const currentValues = lead as unknown as Record<string, unknown>;

    return Object.entries(updates)
      .filter(([key, value]) => currentValues[key] !== value)
      .map(([key]) => labels[key] ?? key.replace(/_/g, ' '));
  }

  get relatedTaskItems(): TaskListItem[] {
    return this.leadTasks().map((task) => ({
      task_id: task.task_id,
      title: task.title,
      status: task.status,
      due_at: task.due_at ?? null,
      assignee_name: task.assigned_user
        ? `${task.assigned_user.first_name ?? ''} ${task.assigned_user.last_name ?? ''}`.trim() ||
          task.assigned_user.email
        : null,
    }));
  }
}









