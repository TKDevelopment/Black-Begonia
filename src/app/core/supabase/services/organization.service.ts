import { Injectable } from '@angular/core';
import { ActivityLogRepositoryService } from '../repositories/activity-log-repository.service';
import { CreateOrganizationInput, Organization } from '../../models/organization';
import { OrganizationRepositoryService } from '../repositories/organization-repository.service';
import { CreateProjectOrganizationInput } from '../../models/project-organization';
import { ProjectOrganizationRepositoryService } from '../repositories/project-organization-repository.service';

@Injectable({
  providedIn: 'root',
})
export class OrganizationService {
  constructor(
    private organizationRepository: OrganizationRepositoryService,
    private activityLogRepository: ActivityLogRepositoryService,
    private projectOrganizationRepository: ProjectOrganizationRepositoryService
  ) {}

  async createOrganization(payload: CreateOrganizationInput): Promise<Organization> {
    const organization = await this.organizationRepository.createOrganization(payload);

    await this.activityLogRepository.createActivityLog({
      entity_type: 'organization',
      entity_id: organization.organization_id,
      activity_type: 'created',
      activity_label: 'Organization created',
      description: 'Organization record created from the CRM.',
      metadata: {
        organization_type: organization.organization_type,
        created_from_lead_id: organization.created_from_lead_id,
      },
    });

    return organization;
  }

  async updateOrganization(
    organizationId: string,
    updates: Partial<Organization>,
    previous: Organization
  ): Promise<Organization> {
    const organization = await this.organizationRepository.updateOrganization(
      organizationId,
      updates
    );

    const changedFields = Object.keys(updates).filter(
      (key) => (previous as any)[key] !== (updates as any)[key]
    );

    await this.activityLogRepository.createActivityLog({
      entity_type: 'organization',
      entity_id: organization.organization_id,
      activity_type: 'updated',
      activity_label: 'Organization updated',
      description: changedFields.length
        ? `Updated fields: ${changedFields.join(', ')}.`
        : 'Organization record updated from the CRM.',
      metadata: {
        changed_fields: changedFields,
      },
    });

    return organization;
  }

  async archiveOrganization(organization: Organization): Promise<Organization> {
    const archivedOrganization = await this.organizationRepository.updateOrganization(
      organization.organization_id,
      {
        is_archived: true,
        archived_at: new Date().toISOString(),
      }
    );

    await this.activityLogRepository.createActivityLog({
      entity_type: 'organization',
      entity_id: archivedOrganization.organization_id,
      activity_type: 'updated',
      activity_label: 'Organization archived',
      description: 'Organization record archived from the CRM.',
      metadata: {
        archived_at: archivedOrganization.archived_at,
      },
    });

    return archivedOrganization;
  }

  async restoreOrganization(organization: Organization): Promise<Organization> {
    const restoredOrganization = await this.organizationRepository.updateOrganization(
      organization.organization_id,
      {
        is_archived: false,
        archived_at: null,
      }
    );

    await this.activityLogRepository.createActivityLog({
      entity_type: 'organization',
      entity_id: restoredOrganization.organization_id,
      activity_type: 'updated',
      activity_label: 'Organization restored',
      description: 'Organization record restored from the archive.',
    });

    return restoredOrganization;
  }

  async linkOrganizationToProject(
    organization: Organization,
    payload: CreateProjectOrganizationInput
  ): Promise<void> {
    await this.projectOrganizationRepository.createProjectOrganization(payload);

    await this.activityLogRepository.createActivityLog({
      entity_type: 'organization',
      entity_id: organization.organization_id,
      activity_type: 'updated',
      activity_label: 'Project link created',
      description: 'Organization linked to an existing project.',
      metadata: {
        project_id: payload.project_id,
        relationship_type: payload.relationship_type,
      },
    });
  }
}
