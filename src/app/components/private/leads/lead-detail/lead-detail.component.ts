import { CommonModule, Location } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { EntityDetailShellComponent } from '../../../../shared/components/private/entity-detail-shell/entity-detail-shell.component';
import { StatusBadgeComponent } from '../../../../shared/components/private/status-badge/status-badge.component';
import { LoadingStateBlockComponent } from '../../../../shared/components/private/loading-state-block/loading-state-block.component';
import { ErrorStateBlockComponent } from '../../../../shared/components/private/error-state-block/error-state-block.component';

import { LeadRepositoryService } from '../../../../core/supabase/repositories/lead-repository.service';
import { ActivityRepositoryService } from '../../../../core/supabase/repositories/activity-repository.service';
import { LeadWorkflowService } from '../../../../core/supabase/services/lead-workflow.service';

import { Lead } from '../../../../core/models/lead';
import { LeadActivity } from '../../../../core/models/lead-activity';
import { LeadSummaryCardComponent } from '../components/lead-summary-card/lead-summary-card.component';
import { LeadStatusSelectorComponent } from '../components/lead-status-selector/lead-status-selector.component';
import { LeadDeclineModalComponent } from '../components/lead-decline-modal/lead-decline-modal.component';
import { LeadStatus } from '../../../../core/models/lead-status';
import { InternalUserRepositoryService } from '../../../../core/supabase/repositories/internal-user-repository.service';
import { InternalUser } from '../../../../core/models/internal-user';
import {
  TaskListItem,
  TaskListPanelComponent,
} from '../../../../shared/components/private/task-list-panel/task-list-panel.component';
import {
  LeadConvertModalComponent,
  LeadConvertPayload,
} from '../components/lead-convert-modal/lead-convert-modal.component';
import { ConfirmDialogComponent } from '../../../../shared/components/private/confirm-dialog/confirm-dialog.component';

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
  ],
  templateUrl: './lead-detail.component.html',
  styleUrl: './lead-detail.component.scss',
})
export class LeadDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private location = inject(Location);
  private leadRepository = inject(LeadRepositoryService);
  private activityRepository = inject(ActivityRepositoryService);
  private leadWorkflow = inject(LeadWorkflowService);
  private internalUserRepository = inject(InternalUserRepositoryService);

  loading = signal(true);
  error = signal<string | null>(null);
  actionLoading = signal(false);

  lead = signal<Lead | null>(null);
  activities = signal<LeadActivity[]>([]);

  declineModalOpen = signal(false);

  internalUsers = signal<InternalUser[]>([]);
  leadTasks = signal<TaskListItem[]>([]);

  convertModalOpen = signal(false);
  convertLoading = signal(false);

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

    return this.leadWorkflow.isConsultationButtonDisabled(lead.status);
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
      const [lead, activities] = await Promise.all([
        this.leadRepository.getLeadById(leadId),
        this.activityRepository.getLeadActivity(leadId),
      ]);

      if (!lead) {
        this.error.set('We could not find this lead record.');
        this.lead.set(null);
        this.activities.set([]);
        return;
      }

      this.lead.set(lead);
      this.activities.set(activities);
    } catch (error) {
      console.error('[LeadDetailComponent] loadLeadDetail error:', error);
      this.error.set('We were unable to load this lead right now.');
      this.lead.set(null);
      this.activities.set([]);
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
      const [lead, activities] = await Promise.all([
        this.leadRepository.getLeadById(leadId),
        this.activityRepository.getLeadActivity(leadId),
      ]);

      this.lead.set(lead);
      this.activities.set(activities);
    } catch (error) {
      console.error('[LeadDetailComponent] refreshLeadDetail error:', error);
    }
  }

  goBack(): void {
    this.location.back();
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
      case 'accepted':
        return 'success';
      case 'declined':
        return 'danger';
      case 'converted':
        return 'success';
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

  getInitials(): string {
    const lead = this.lead();
    if (!lead) return '--';

    return `${lead.first_name.charAt(0)}${lead.last_name.charAt(0)}`.toUpperCase();
  }

  getPartnerName(): string {
    const lead = this.lead();
    if (!lead) return 'Not provided';

    const first = lead.partner_first_name?.trim() || '';
    const last = lead.partner_last_name?.trim() || '';
    const full = `${first} ${last}`.trim();

    return full || 'Not provided';
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
      case 'note':
        return 'bg-stone-100 text-stone-700';
      case 'status_change':
        return 'bg-emerald-100 text-emerald-700';
      default:
        return 'bg-stone-100 text-stone-700';
    }
  }

  async handleConsultationAction(): Promise<void> {
    const lead = this.lead();
    if (!lead || this.actionLoading()) return;

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

  async markContacted(): Promise<void> {
    const lead = this.lead();
    if (!lead || this.actionLoading()) return;

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

  openTask(task: TaskListItem): void {
    console.log('Open task', task);
  }

  createTaskFromLead(): void {
    console.log('Create task from lead');
  }

  convertLead(): void {
    this.openConvertModal();
  }

  editLead(): void {
    console.log('Edit lead');
  }

  addInternalNote(): void {
    console.log('Add internal note');
  }

  openConvertModal(): void {
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

      await this.leadWorkflow.updateStatus(lead, 'converted');

      await this.activityRepository.createLeadActivity({
        lead_id: lead.lead_id,
        activity_type: 'status_change',
        activity_label: 'Lead converted',
        activity_description:
          payload.notes || 'Lead was converted from the lead detail workflow.',
        metadata: {
          previous_status: lead.status,
          next_status: 'converted',
          notes: payload.notes || null,
          create_primary_contact: payload.createPrimaryContact,
          create_project_shell: payload.createProjectShell,
        },
      });

      this.convertModalOpen.set(false);
      await this.refreshLeadDetail();
    } catch (error) {
      console.error('[LeadDetailComponent] confirmConvert error:', error);
      this.error.set('We were unable to convert this lead.');
    } finally {
      this.convertLoading.set(false);
    }
  }

  openDeclineModal(): void {
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
    if (!lead || this.actionLoading() || lead.status === nextStatus) return;

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
}