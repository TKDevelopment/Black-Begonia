import { Injectable } from '@angular/core';
import { Lead } from '../../models/lead';
import { Contact } from '../../models/contact';
import { Project } from '../../models/project';
import { ContactRepositoryService } from '../repositories/contact-repository.service';
import { ProjectRepositoryService } from '../repositories/project-repository.service';
import { ProjectContactRepositoryService } from '../repositories/project-contact-repository.service';
import { LeadRepositoryService } from '../repositories/lead-repository.service';
import { ActivityRepositoryService } from '../repositories/activity-repository.service';

export interface ConvertLeadInput {
  project_name: string;
  internal_notes?: string | null;
}

export interface ConvertLeadResult {
  project: Project;
  primaryContact: Contact;
  partnerContact: Contact | null;
  plannerContact: Contact | null;
}

@Injectable({
  providedIn: 'root',
})
export class LeadConversionService {
  constructor(
    private contactRepository: ContactRepositoryService,
    private projectRepository: ProjectRepositoryService,
    private projectContactRepository: ProjectContactRepositoryService,
    private leadRepository: LeadRepositoryService,
    private activityRepository: ActivityRepositoryService
  ) {}

  async convertLead(
    lead: Lead,
    payload: ConvertLeadInput
  ): Promise<ConvertLeadResult> {
    if (lead.status !== 'proposal_accepted') {
      throw new Error('Only accepted Floral Proposal leads can be converted to projects.');
    }

    const primaryContact = await this.contactRepository.createContact({
      first_name: lead.first_name,
      last_name: lead.last_name,
      email: lead.email,
      phone: lead.phone ?? null,
      preferred_contact_method: lead.preferred_contact_method ?? null,
      contact_type: 'client',
      notes: 'Primary client contact created from lead conversion.',
      created_from_lead_id: lead.lead_id,
    });

    const partnerContact = await this.createPartnerContactIfPresent(lead);
    const plannerContact = await this.createPlannerContactIfPresent(lead);

    const project = await this.projectRepository.createProject({
      project_name: payload.project_name,
      service_type: lead.service_type,
      event_type: lead.event_type ?? null,
      event_date: lead.event_date ?? null,
      ceremony_venue_name: lead.ceremony_venue_name ?? null,
      ceremony_venue_city: lead.ceremony_venue_city ?? null,
      ceremony_venue_state: lead.ceremony_venue_state ?? null,
      reception_venue_name: lead.reception_venue_name ?? null,
      reception_venue_city: lead.reception_venue_city ?? null,
      reception_venue_state: lead.reception_venue_state ?? null,
      budget_range: lead.budget_range ?? null,
      guest_count: lead.guest_count ?? null,
      style_notes: lead.inquiry_message ?? null,
      internal_notes: payload.internal_notes ?? null,
      status: 'inquiry_converted',
      source_lead_id: lead.lead_id,
      primary_contact_id: primaryContact.contact_id,
      assigned_user_id: lead.assigned_user_id ?? null,
    });

    await this.projectContactRepository.createProjectContact({
      project_id: project.project_id,
      contact_id: primaryContact.contact_id,
      relationship_type: 'client',
      is_primary: true,
    });

    if (partnerContact) {
      await this.projectContactRepository.createProjectContact({
        project_id: project.project_id,
        contact_id: partnerContact.contact_id,
        relationship_type: 'partner',
      });
    }

    if (plannerContact) {
      await this.projectContactRepository.createProjectContact({
        project_id: project.project_id,
        contact_id: plannerContact.contact_id,
        relationship_type: 'planner',
      });
    }

    const convertedAt = new Date().toISOString();

    await this.leadRepository.updateLead(lead.lead_id, {
      status: 'converted',
      converted_project_id: project.project_id,
      converted_primary_contact_id: primaryContact.contact_id,
      converted_at: convertedAt,
    });

    await this.activityRepository.createLeadActivity({
      lead_id: lead.lead_id,
      activity_type: 'converted',
      activity_label: 'Lead converted to project',
      activity_description:
        payload.internal_notes?.trim() ||
        `Lead converted into project "${project.project_name}".`,
      metadata: {
        previous_status: lead.status,
        next_status: 'converted',
        project_id: project.project_id,
        primary_contact_id: primaryContact.contact_id,
        partner_contact_id: partnerContact?.contact_id ?? null,
        planner_contact_id: plannerContact?.contact_id ?? null,
      },
    });

    return {
      project,
      primaryContact,
      partnerContact,
      plannerContact,
    };
  }

  buildDefaultProjectName(lead: Lead): string {
    const eventLabel = this.titleCase(lead.service_type || 'event');
    const clientLabel = `${lead.first_name} ${lead.last_name}`.trim();
    const dateLabel = lead.event_date
      ? new Intl.DateTimeFormat('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        }).format(new Date(lead.event_date))
      : null;

    return [clientLabel, eventLabel, dateLabel].filter(Boolean).join(' • ');
  }

  private async createPartnerContactIfPresent(lead: Lead): Promise<Contact | null> {
    const firstName = lead.partner_first_name?.trim() ?? '';
    const lastName = lead.partner_last_name?.trim() ?? '';

    if (!firstName && !lastName) {
      return null;
    }

    return this.contactRepository.createContact({
      first_name: firstName || 'Partner',
      last_name: lastName || lead.last_name,
      contact_type: 'partner',
      notes: 'Partner contact created from lead conversion.',
      created_from_lead_id: lead.lead_id,
    });
  }

  private async createPlannerContactIfPresent(lead: Lead): Promise<Contact | null> {
    const plannerName = lead.planner_name?.trim() ?? '';
    const plannerEmail = lead.planner_email?.trim().toLowerCase() ?? '';
    const plannerPhone = lead.planner_phone?.trim() ?? '';

    if (!plannerName && !plannerEmail && !plannerPhone) {
      return null;
    }

    const { firstName, lastName } = this.splitFullName(plannerName);

    return this.contactRepository.createContact({
      first_name: firstName,
      last_name: lastName,
      email: plannerEmail || null,
      phone: plannerPhone || null,
      contact_type: 'planner',
      notes: 'Planner contact created from lead conversion.',
      created_from_lead_id: lead.lead_id,
    });
  }

  private splitFullName(name: string): { firstName: string; lastName: string } {
    const trimmed = name.trim();

    if (!trimmed) {
      return {
        firstName: 'Event',
        lastName: 'Planner',
      };
    }

    const parts = trimmed.split(/\s+/);

    if (parts.length === 1) {
      return {
        firstName: parts[0],
        lastName: 'Planner',
      };
    }

    return {
      firstName: parts[0],
      lastName: parts.slice(1).join(' '),
    };
  }

  private titleCase(value: string): string {
    return value.replace(/\b\w/g, (char) => char.toUpperCase());
  }
}

