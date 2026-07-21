import { Injectable } from '@angular/core';

import { Project, UpdateProjectInput } from '../../models/project';
import {
  ManualPaymentInput,
} from '../../models/project-payment-record';
import { ActivityRepositoryService } from '../repositories/activity-repository.service';
import { ProjectRepositoryService } from '../repositories/project-repository.service';

@Injectable({
  providedIn: 'root',
})
export class ProjectWorkflowService {
  constructor(
    private readonly projectRepository: ProjectRepositoryService,
    private readonly activityRepository: ActivityRepositoryService
  ) {}

  async refreshProjectPaymentStatuses(projectId?: string): Promise<void> {
    await this.projectRepository.refreshProjectPaymentStatuses(projectId);
  }

  async updateProject(
    project: Project,
    updates: UpdateProjectInput
  ): Promise<Project> {
    const updated = await this.projectRepository.updateProject(
      project.project_id,
      updates
    );

    const statusChanged = updates.status && updates.status !== project.status;
    await this.activityRepository.createProjectActivity({
      project_id: project.project_id,
      activity_type: statusChanged ? 'status_changed' : 'updated',
      activity_label: statusChanged ? 'Project status changed' : 'Project updated',
      description: statusChanged
        ? `Status changed from ${project.status} to ${updates.status}.`
        : 'Project information was updated.',
      metadata: {
        changed_fields: Object.keys(updates),
        previous_status: project.status,
        next_status: updates.status ?? project.status,
      },
    });

    return updated;
  }

  async recordPayment(
    project: Project,
    payload: Omit<ManualPaymentInput, 'project_id' | 'command_key'> & { command_key?: string; confirm_overpayment?: boolean }
  ): Promise<{ result: { state: 'recorded' | 'duplicate_warning' | 'overpayment_warning'; transaction?: unknown; suspectedReference?: string; overpaymentAmount?: number }; project: Project | null }> {
    this.assertValidPayment(payload);
    const { data, error } = await this.projectRepository.client.rpc('record_manual_payment', {
      p_project_id: project.project_id, p_obligation_id: payload.obligation_id,
      p_amount_cents: Math.round(payload.amount * 100), p_method: payload.payment_method,
      p_received_at: payload.received_at, p_note: payload.notes?.trim() || null,
      p_suspected_reference: payload.suspected_reference || null,
      p_override_reason: payload.duplicate_override_reason?.trim() || null,
      p_command_key: payload.command_key || crypto.randomUUID(), p_confirm_overpayment: payload.confirm_overpayment ?? false,
    });
    if (error) throw error;
    return {
      result: data as { state: 'recorded' | 'duplicate_warning' | 'overpayment_warning'; transaction?: unknown; suspectedReference?: string; overpaymentAmount?: number },
      project: await this.projectRepository.getProjectById(project.project_id),
    };
  }

  private assertValidPayment(
    payload: Omit<ManualPaymentInput, 'project_id' | 'command_key'>
  ): void {
    if (!payload.obligation_id) throw new Error('Choose a payment obligation.');
    if (!payload.payment_method) throw new Error('Choose a payment method.');
    if (payload.amount <= 0) throw new Error('Enter an amount paid greater than zero.');
    if (!payload.received_at) throw new Error('Choose the date payment was received.');
  }
}
