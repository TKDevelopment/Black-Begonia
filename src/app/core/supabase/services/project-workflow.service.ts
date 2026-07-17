import { Injectable } from '@angular/core';

import { Project, UpdateProjectInput } from '../../models/project';
import {
  ProjectPaymentRecord,
  UpsertProjectPaymentRecordInput,
} from '../../models/project-payment-record';
import { ActivityRepositoryService } from '../repositories/activity-repository.service';
import { ProjectPaymentRecordRepositoryService } from '../repositories/project-payment-record-repository.service';
import { ProjectRepositoryService } from '../repositories/project-repository.service';

@Injectable({
  providedIn: 'root',
})
export class ProjectWorkflowService {
  constructor(
    private readonly projectRepository: ProjectRepositoryService,
    private readonly paymentRecordRepository: ProjectPaymentRecordRepositoryService,
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
    payload: Omit<UpsertProjectPaymentRecordInput, 'project_id'>
  ): Promise<{ payment: ProjectPaymentRecord; project: Project | null }> {
    this.assertValidPayment(payload);

    const payment = await this.paymentRecordRepository.upsertPaymentRecord({
      ...payload,
      project_id: project.project_id,
    });

    await this.activityRepository.createProjectActivity({
      project_id: project.project_id,
      activity_type: 'payment_recorded',
      activity_label:
        payload.payment_kind === 'deposit'
          ? 'Deposit payment recorded'
          : 'Final payment recorded',
      description: `${this.formatPaymentKind(payload.payment_kind)} payment was recorded.`,
      metadata: {
        payment_kind: payload.payment_kind,
        payment_status: payload.status,
        payment_method: payload.payment_method ?? null,
        amount_due: payload.amount_due,
        amount_paid: payload.amount_paid ?? 0,
      },
    });

    if (payment.status === 'paid') {
      const nextStatus =
        payment.payment_kind === 'deposit' ? 'booked' : 'final_prep';
      if (project.status !== 'completed' && project.status !== 'canceled') {
        await this.projectRepository.updateProject(project.project_id, {
          status: nextStatus,
          booked_at:
            nextStatus === 'booked' && !project.booked_at
              ? new Date().toISOString()
              : project.booked_at ?? null,
        });
      }
    }

    await this.refreshProjectPaymentStatuses(project.project_id);
    return {
      payment,
      project: await this.projectRepository.getProjectById(project.project_id),
    };
  }

  private assertValidPayment(
    payload: Omit<UpsertProjectPaymentRecordInput, 'project_id'>
  ): void {
    if (payload.status === 'paid') {
      if (!payload.payment_method) {
        throw new Error('Choose a payment method for paid records.');
      }

      if ((payload.amount_paid ?? 0) <= 0) {
        throw new Error('Enter an amount paid greater than zero.');
      }
    }
  }

  private formatPaymentKind(kind: string): string {
    return kind.replace(/_/g, ' ');
  }
}
