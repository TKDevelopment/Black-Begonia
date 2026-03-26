import { Injectable } from '@angular/core';
import { ActivityLogRepositoryService } from '../repositories/activity-log-repository.service';
import { Contact, CreateContactInput } from '../../models/contact';
import { ContactRepositoryService } from '../repositories/contact-repository.service';
import { CreateProjectContactInput } from '../../models/project-contact';
import { ProjectContactRepositoryService } from '../repositories/project-contact-repository.service';

@Injectable({
  providedIn: 'root',
})
export class ContactService {
  constructor(
    private contactRepository: ContactRepositoryService,
    private activityLogRepository: ActivityLogRepositoryService,
    private projectContactRepository: ProjectContactRepositoryService
  ) {}

  async createContact(payload: CreateContactInput): Promise<Contact> {
    const contact = await this.contactRepository.createContact(payload);

    await this.activityLogRepository.createActivityLog({
      entity_type: 'contact',
      entity_id: contact.contact_id,
      activity_type: 'created',
      activity_label: 'Contact created',
      description: 'Contact record created from the CRM.',
      metadata: {
        contact_type: contact.contact_type,
        created_from_lead_id: contact.created_from_lead_id,
      },
    });

    return contact;
  }

  async updateContact(contactId: string, updates: Partial<Contact>, previous: Contact): Promise<Contact> {
    const contact = await this.contactRepository.updateContact(contactId, updates);

    const changedFields = Object.keys(updates).filter(
      (key) => (previous as any)[key] !== (updates as any)[key]
    );

    await this.activityLogRepository.createActivityLog({
      entity_type: 'contact',
      entity_id: contact.contact_id,
      activity_type: 'updated',
      activity_label: 'Contact updated',
      description: changedFields.length
        ? `Updated fields: ${changedFields.join(', ')}.`
        : 'Contact record updated from the CRM.',
      metadata: {
        changed_fields: changedFields,
      },
    });

    return contact;
  }

  async archiveContact(contact: Contact): Promise<Contact> {
    const archivedContact = await this.contactRepository.updateContact(contact.contact_id, {
      is_archived: true,
      archived_at: new Date().toISOString(),
    });

    await this.activityLogRepository.createActivityLog({
      entity_type: 'contact',
      entity_id: archivedContact.contact_id,
      activity_type: 'updated',
      activity_label: 'Contact archived',
      description: 'Contact record archived from the CRM.',
      metadata: {
        archived_at: archivedContact.archived_at,
      },
    });

    return archivedContact;
  }

  async restoreContact(contact: Contact): Promise<Contact> {
    const restoredContact = await this.contactRepository.updateContact(contact.contact_id, {
      is_archived: false,
      archived_at: null,
    });

    await this.activityLogRepository.createActivityLog({
      entity_type: 'contact',
      entity_id: restoredContact.contact_id,
      activity_type: 'updated',
      activity_label: 'Contact restored',
      description: 'Contact record restored from the archive.',
    });

    return restoredContact;
  }

  async linkContactToProject(contact: Contact, payload: CreateProjectContactInput): Promise<void> {
    await this.projectContactRepository.createProjectContact(payload);

    await this.activityLogRepository.createActivityLog({
      entity_type: 'contact',
      entity_id: contact.contact_id,
      activity_type: 'updated',
      activity_label: 'Project link created',
      description: 'Contact linked to an existing project.',
      metadata: {
        project_id: payload.project_id,
        relationship_type: payload.relationship_type,
        is_primary: payload.is_primary ?? false,
      },
    });
  }
}
