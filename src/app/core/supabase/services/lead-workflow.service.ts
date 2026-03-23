import { Injectable } from '@angular/core';
import { Lead } from '../../models/lead';
import { LeadStatus } from '../../models/lead-status';
import { LeadRepositoryService } from '../repositories/lead-repository.service';
import { ActivityRepositoryService } from '../repositories/activity-repository.service';

@Injectable({
  providedIn: 'root',
})
export class LeadWorkflowService {
  constructor(
    private leadRepository: LeadRepositoryService,
    private activityRepository: ActivityRepositoryService
  ) {}

  async markContacted(leadId: string): Promise<Lead> {
    const now = new Date().toISOString();

    const updatedLead = await this.leadRepository.updateLead(leadId, {
      status: 'contacted',
      last_contacted_at: now,
    });

    await this.activityRepository.createLeadActivity({
      lead_id: leadId,
      activity_type: 'status_changed',
      activity_label: 'Lead marked as contacted',
      activity_description: 'Lead status moved to Contacted.',
      metadata: {
        next_status: 'contacted',
        last_contacted_at: now,
      },
    });

    return updatedLead;
  }

  async updateStatus(lead: Lead, nextStatus: LeadStatus): Promise<Lead> {
    this.assertValidStatusTransition(lead.status, nextStatus);

    const updatedLead = await this.leadRepository.updateLead(lead.lead_id, {
      status: nextStatus,
    });

    await this.activityRepository.createLeadActivity({
      lead_id: lead.lead_id,
      activity_type: 'status_changed',
      activity_label: `Lead status changed to ${this.formatStatusLabel(nextStatus)}`,
      activity_description: `Lead moved from ${this.formatStatusLabel(
        lead.status
      )} to ${this.formatStatusLabel(nextStatus)}.`,
      metadata: {
        previous_status: lead.status,
        next_status: nextStatus,
      },
    });

    return updatedLead;
  }

  async declineLead(leadId: string, reason: string): Promise<Lead> {
    const now = new Date().toISOString();

    const updatedLead = await this.leadRepository.updateLead(leadId, {
      status: 'declined',
      decline_reason: reason,
      declined_at: now,
    });

    await this.activityRepository.createLeadActivity({
      lead_id: leadId,
      activity_type: 'status_changed',
      activity_label: 'Lead declined',
      activity_description: reason || 'Lead was declined.',
      metadata: {
        next_status: 'declined',
        declined_at: now,
        decline_reason: reason || null,
      },
    });

    return updatedLead;
  }

  async scheduleConsultation(lead: Lead): Promise<Lead> {
    if (!this.canScheduleConsultation(lead.status)) {
      throw new Error(
        `Cannot schedule consultation from status "${lead.status}".`
      );
    }

    const now = new Date().toISOString();

    const updatedLead = await this.leadRepository.updateLead(lead.lead_id, {
      status: 'consultation_scheduled',
      consultation_scheduled_at: now,
      last_contacted_at: now,
    });

    await this.activityRepository.createLeadActivity({
      lead_id: lead.lead_id,
      activity_type: 'status_changed',
      activity_label: 'Consultation scheduled',
      activity_description: 'Lead moved to Consultation Scheduled.',
      metadata: {
        previous_status: lead.status,
        next_status: 'consultation_scheduled',
        consultation_scheduled_at: now,
      },
    });

    return updatedLead;
  }

  async completeConsultation(lead: Lead): Promise<Lead> {
    if (lead.status !== 'consultation_scheduled') {
      throw new Error(
        `Cannot complete consultation from status "${lead.status}".`
      );
    }

    const now = new Date().toISOString();

    const updatedLead = await this.leadRepository.updateLead(lead.lead_id, {
      status: 'nurturing',
      consultation_completed_at: now,
    });

    await this.activityRepository.createLeadActivity({
      lead_id: lead.lead_id,
      activity_type: 'status_changed',
      activity_label: 'Consultation completed',
      activity_description:
        'Consultation completed and lead moved to Nurturing.',
      metadata: {
        previous_status: lead.status,
        next_status: 'nurturing',
        consultation_completed_at: now,
      },
    });

    return updatedLead;
  }

  canScheduleConsultation(status: LeadStatus): boolean {
    return status === 'new' || status === 'contacted';
  }

  isConsultationButtonDisabled(status: LeadStatus): boolean {
    return false;
  }

  getConsultationButtonLabel(status: LeadStatus): string {
    if (status === 'consultation_scheduled') {
      return 'Consultation Completed';
    }

    return 'Schedule Consultation';
  }

  getAllowedNextStatuses(currentStatus: LeadStatus): LeadStatus[] {
    switch (currentStatus) {
      case 'new':
        return [
          'new',
          'contacted',
          'consultation_scheduled',
          'declined',
          'closed_unbooked',
        ];
      case 'contacted':
        return [
          'contacted',
          'consultation_scheduled',
          'declined',
          'closed_unbooked',
        ];
      case 'consultation_scheduled':
        return ['consultation_scheduled', 'nurturing', 'declined'];
      case 'nurturing':
        return ['nurturing', 'accepted', 'declined', 'closed_unbooked'];
      case 'accepted':
        return ['accepted', 'converted'];
      case 'declined':
        return ['declined'];
      case 'converted':
        return ['converted'];
      case 'closed_unbooked':
        return ['closed_unbooked'];
      default:
        return [currentStatus];
    }
  }

  private assertValidStatusTransition(
    currentStatus: LeadStatus,
    nextStatus: LeadStatus
  ): void {
    const allowed = this.getAllowedNextStatuses(currentStatus);
    if (!allowed.includes(nextStatus)) {
      throw new Error(
        `Invalid lead status transition from "${currentStatus}" to "${nextStatus}".`
      );
    }
  }

  private formatStatusLabel(status: LeadStatus): string {
    return status
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (char: string) => char.toUpperCase());
  }
}