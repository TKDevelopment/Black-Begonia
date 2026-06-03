import { TestBed } from '@angular/core/testing';

import { testLead } from '../../testing/workflow-fixtures';
import { ActivityRepositoryService } from '../repositories/activity-repository.service';
import { ContactRepositoryService } from '../repositories/contact-repository.service';
import { LeadRepositoryService } from '../repositories/lead-repository.service';
import { ProjectContactRepositoryService } from '../repositories/project-contact-repository.service';
import { ProjectRepositoryService } from '../repositories/project-repository.service';
import { LeadConversionService } from './lead-conversion.service';

describe('LeadConversionServiceService', () => {
  let service: LeadConversionService;
  let contactRepository: jasmine.SpyObj<ContactRepositoryService>;
  let projectRepository: jasmine.SpyObj<ProjectRepositoryService>;
  let projectContactRepository: jasmine.SpyObj<ProjectContactRepositoryService>;
  let leadRepository: jasmine.SpyObj<LeadRepositoryService>;
  let activityRepository: jasmine.SpyObj<ActivityRepositoryService>;

  beforeEach(() => {
    contactRepository = jasmine.createSpyObj<ContactRepositoryService>(
      'ContactRepositoryService',
      ['createContact'],
    );
    projectRepository = jasmine.createSpyObj<ProjectRepositoryService>(
      'ProjectRepositoryService',
      ['createProject'],
    );
    projectContactRepository = jasmine.createSpyObj<ProjectContactRepositoryService>(
      'ProjectContactRepositoryService',
      ['createProjectContact'],
    );
    leadRepository = jasmine.createSpyObj<LeadRepositoryService>(
      'LeadRepositoryService',
      ['updateLead'],
    );
    activityRepository = jasmine.createSpyObj<ActivityRepositoryService>(
      'ActivityRepositoryService',
      ['createLeadActivity'],
    );
    projectContactRepository.createProjectContact.and.resolveTo();
    leadRepository.updateLead.and.resolveTo({ ...testLead, status: 'converted' });
    activityRepository.createLeadActivity.and.resolveTo();

    TestBed.configureTestingModule({
      providers: [
        { provide: ContactRepositoryService, useValue: contactRepository },
        { provide: ProjectRepositoryService, useValue: projectRepository },
        { provide: ProjectContactRepositoryService, useValue: projectContactRepository },
        { provide: LeadRepositoryService, useValue: leadRepository },
        { provide: ActivityRepositoryService, useValue: activityRepository },
      ],
    });
    service = TestBed.inject(LeadConversionService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should convert an accepted proposal lead into contacts, a project, links, and activity', async () => {
    const acceptedLead = {
      ...testLead,
      status: 'proposal_accepted' as const,
      planner_name: 'Casey Planner',
      planner_email: 'CASEY@example.com',
      planner_phone: '555-010-2000',
    };
    const primaryContact = {
      contact_id: 'contact-primary',
      first_name: acceptedLead.first_name,
      last_name: acceptedLead.last_name,
    };
    const partnerContact = {
      contact_id: 'contact-partner',
      first_name: acceptedLead.partner_first_name,
      last_name: acceptedLead.partner_last_name,
    };
    const plannerContact = {
      contact_id: 'contact-planner',
      first_name: 'Casey',
      last_name: 'Planner',
    };
    const project = {
      project_id: 'project-1',
      project_name: 'Avery Wedding',
    };
    contactRepository.createContact.and.returnValues(
      Promise.resolve(primaryContact as any),
      Promise.resolve(partnerContact as any),
      Promise.resolve(plannerContact as any),
    );
    projectRepository.createProject.and.resolveTo(project as any);

    const result = await service.convertLead(acceptedLead, {
      project_name: 'Avery Wedding',
      internal_notes: 'Ready to book.',
    });

    expect(result).toEqual({
      project: project as any,
      primaryContact: primaryContact as any,
      partnerContact: partnerContact as any,
      plannerContact: plannerContact as any,
    });
    expect(contactRepository.createContact).toHaveBeenCalledWith(
      jasmine.objectContaining({
        contact_type: 'client',
        created_from_lead_id: acceptedLead.lead_id,
      }),
    );
    expect(contactRepository.createContact).toHaveBeenCalledWith(
      jasmine.objectContaining({
        contact_type: 'partner',
        created_from_lead_id: acceptedLead.lead_id,
      }),
    );
    expect(contactRepository.createContact).toHaveBeenCalledWith(
      jasmine.objectContaining({
        contact_type: 'planner',
        email: 'casey@example.com',
        phone: '555-010-2000',
      }),
    );
    expect(projectRepository.createProject).toHaveBeenCalledWith(
      jasmine.objectContaining({
        project_name: 'Avery Wedding',
        status: 'inquiry_converted',
        source_lead_id: acceptedLead.lead_id,
        primary_contact_id: primaryContact.contact_id,
      }),
    );
    expect(projectContactRepository.createProjectContact).toHaveBeenCalledWith({
      project_id: project.project_id,
      contact_id: primaryContact.contact_id,
      relationship_type: 'client',
      is_primary: true,
    });
    expect(projectContactRepository.createProjectContact).toHaveBeenCalledWith({
      project_id: project.project_id,
      contact_id: partnerContact.contact_id,
      relationship_type: 'partner',
    });
    expect(projectContactRepository.createProjectContact).toHaveBeenCalledWith({
      project_id: project.project_id,
      contact_id: plannerContact.contact_id,
      relationship_type: 'planner',
    });
    expect(leadRepository.updateLead).toHaveBeenCalledWith(
      acceptedLead.lead_id,
      jasmine.objectContaining({
        status: 'converted',
        converted_project_id: project.project_id,
        converted_primary_contact_id: primaryContact.contact_id,
      }),
    );
    expect(activityRepository.createLeadActivity).toHaveBeenCalledWith(
      jasmine.objectContaining({
        activity_type: 'converted',
        activity_description: 'Ready to book.',
        metadata: jasmine.objectContaining({
          project_id: project.project_id,
          primary_contact_id: primaryContact.contact_id,
          partner_contact_id: partnerContact.contact_id,
          planner_contact_id: plannerContact.contact_id,
        }),
      }),
    );
  });

  it('should reject conversion unless the proposal was accepted', async () => {
    await expectAsync(
      service.convertLead(testLead, { project_name: 'Blocked' }),
    ).toBeRejectedWithError(
      'Only accepted Floral Proposal leads can be converted to projects.',
    );

    expect(contactRepository.createContact).not.toHaveBeenCalled();
    expect(projectRepository.createProject).not.toHaveBeenCalled();
  });

  it('should not update the lead when project creation fails', async () => {
    const acceptedLead = { ...testLead, status: 'proposal_accepted' as const };
    contactRepository.createContact.and.resolveTo({
      contact_id: 'contact-primary',
    } as any);
    projectRepository.createProject.and.rejectWith(new Error('project failed'));

    await expectAsync(
      service.convertLead(acceptedLead, { project_name: 'Broken Project' }),
    ).toBeRejectedWithError('project failed');

    expect(leadRepository.updateLead).not.toHaveBeenCalled();
    expect(activityRepository.createLeadActivity).not.toHaveBeenCalled();
  });

  it('should build a default project name from lead details', () => {
    const name = service.buildDefaultProjectName({
      ...testLead,
      service_type: 'wedding full service',
      event_date: '2026-10-24',
    });

    expect(name).toContain('Avery Bloom');
    expect(name).toContain('Wedding Full Service');
    expect(name).toContain('2026');
  });
});
