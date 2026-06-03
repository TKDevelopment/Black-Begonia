import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';

import { testActivityLogEntry, testLead, testOrganization, testProject } from '../../../core/testing/workflow-fixtures';
import {
  createParamMapSubject,
  createRouterSpy,
  createToastSpy,
  expectToast,
  flushCrmPromises,
} from '../../../core/testing/crm-testing';
import { ActivityLogRepositoryService } from '../../../core/supabase/repositories/activity-log-repository.service';
import { LeadRepositoryService } from '../../../core/supabase/repositories/lead-repository.service';
import { OrganizationRepositoryService } from '../../../core/supabase/repositories/organization-repository.service';
import { ProjectRepositoryService } from '../../../core/supabase/repositories/project-repository.service';
import { OrganizationService } from '../../../core/supabase/services/organization.service';
import { ToastService } from '../../../core/services/toast.service';
import { OrganizationsComponent } from './organizations.component';

describe('OrganizationsComponent', () => {
  let component: OrganizationsComponent;
  let fixture: ComponentFixture<OrganizationsComponent>;
  let routeParams: ReturnType<typeof createParamMapSubject>;
  let router: jasmine.SpyObj<Router>;
  let organizationRepository: jasmine.SpyObj<OrganizationRepositoryService>;
  let activityLogRepository: jasmine.SpyObj<ActivityLogRepositoryService>;
  let leadRepository: jasmine.SpyObj<LeadRepositoryService>;
  let projectRepository: jasmine.SpyObj<ProjectRepositoryService>;
  let organizationService: jasmine.SpyObj<OrganizationService>;
  let toast: jasmine.SpyObj<ToastService>;

  const archivedOrganization = {
    ...testOrganization,
    organization_id: 'organization-archived-001',
    name: 'Archived Planner',
    organization_type: 'planner' as const,
    is_archived: true,
    created_at: '2026-06-03T12:00:00.000Z',
  };

  beforeEach(async () => {
    routeParams = createParamMapSubject();
    router = createRouterSpy();
    router.navigate.and.resolveTo(true);
    organizationRepository = jasmine.createSpyObj<OrganizationRepositoryService>(
      'OrganizationRepositoryService',
      ['getOrganizations', 'getOrganizationById', 'getRelatedProjects']
    );
    activityLogRepository = jasmine.createSpyObj<ActivityLogRepositoryService>(
      'ActivityLogRepositoryService',
      ['getEntityActivity']
    );
    leadRepository = jasmine.createSpyObj<LeadRepositoryService>('LeadRepositoryService', [
      'getLeadById',
    ]);
    projectRepository = jasmine.createSpyObj<ProjectRepositoryService>('ProjectRepositoryService', [
      'getProjects',
    ]);
    organizationService = jasmine.createSpyObj<OrganizationService>('OrganizationService', [
      'createOrganization',
      'updateOrganization',
      'archiveOrganization',
      'restoreOrganization',
      'linkOrganizationToProject',
    ]);
    toast = createToastSpy();

    organizationRepository.getOrganizations.and.resolveTo([
      testOrganization,
      archivedOrganization,
    ]);
    organizationRepository.getOrganizationById.and.resolveTo(testOrganization);
    organizationRepository.getRelatedProjects.and.resolveTo([testProject]);
    activityLogRepository.getEntityActivity.and.resolveTo([testActivityLogEntry]);
    leadRepository.getLeadById.and.resolveTo(testLead);
    projectRepository.getProjects.and.resolveTo([testProject]);

    await TestBed.configureTestingModule({
      imports: [OrganizationsComponent],
      providers: [
        { provide: ActivatedRoute, useValue: { paramMap: routeParams.asObservable() } },
        { provide: Router, useValue: router },
        { provide: OrganizationRepositoryService, useValue: organizationRepository },
        { provide: ActivityLogRepositoryService, useValue: activityLogRepository },
        { provide: LeadRepositoryService, useValue: leadRepository },
        { provide: ProjectRepositoryService, useValue: projectRepository },
        { provide: OrganizationService, useValue: organizationService },
        { provide: ToastService, useValue: toast },
      ],
    })
      .overrideComponent(OrganizationsComponent, { set: { template: '' } })
      .compileComponents();

    fixture = TestBed.createComponent(OrganizationsComponent);
    component = fixture.componentInstance;
  });

  it('loads organizations for list view and exposes empty state when no rows return', async () => {
    await component.loadOrganizations();

    expect(component.loading()).toBeFalse();
    expect(component.organizations()).toEqual([testOrganization, archivedOrganization]);

    organizationRepository.getOrganizations.and.resolveTo([]);
    await component.loadOrganizations();

    expect(component.organizations()).toEqual([]);
  });

  it('sets a list error and clears organizations when repository loading fails', async () => {
    spyOn(console, 'error');
    organizationRepository.getOrganizations.and.rejectWith(new Error('orgs unavailable'));

    await component.loadOrganizations();

    expect(component.loading()).toBeFalse();
    expect(component.organizations()).toEqual([]);
    expect(component.error()).toBe('We were unable to load organizations right now.');
  });

  it('filters organizations by search, type, archive status, and sort order', () => {
    component.organizations.set([testOrganization, archivedOrganization]);

    component.onSearchChange('archived');
    component.onFilterChange({ key: 'organization_type', value: 'planner' });
    component.onFilterChange({ key: 'archive', value: 'archived' });
    component.onFilterChange({ key: 'sort', value: 'created_desc' });

    expect(component.filteredOrganizations()).toEqual([archivedOrganization]);

    component.resetFilters();
    expect(component.typeFilter()).toBe('all');
    expect(component.archiveFilter()).toBe('active');
  });

  it('loads detail data including projects, activity, and source lead', async () => {
    await component.loadOrganizationDetail(testOrganization.organization_id);

    expect(component.detailLoading()).toBeFalse();
    expect(component.organization()).toEqual(testOrganization);
    expect(component.relatedProjects()).toEqual([testProject]);
    expect(component.activityLog()).toEqual([testActivityLogEntry]);
    expect(component.createdFromLead()).toEqual(testLead);
  });

  it('sets detail empty state when an organization cannot be found', async () => {
    organizationRepository.getOrganizationById.and.resolveTo(null);

    await component.loadOrganizationDetail('missing-organization');

    expect(component.organization()).toBeNull();
    expect(component.relatedProjects()).toEqual([]);
    expect(component.detailError()).toBe('We could not find this organization record.');
  });

  it('routes through ngOnInit for list and detail views', async () => {
    component.ngOnInit();
    await flushCrmPromises();
    expect(organizationRepository.getOrganizations).toHaveBeenCalled();

    routeParams.next(new Map([['organizationId', testOrganization.organization_id]]) as never);
    await flushCrmPromises();
    expect(organizationRepository.getOrganizationById).toHaveBeenCalledWith(
      testOrganization.organization_id
    );
    expect(component.isDetailView()).toBeTrue();
  });

  it('creates organizations, closes the modal, shows feedback, and navigates to detail', async () => {
    organizationService.createOrganization.and.resolveTo(testOrganization);
    component.createModalOpen.set(true);

    await component.createOrganization({
      name: testOrganization.name,
      organization_type: 'venue',
    });

    expect(component.createModalOpen()).toBeFalse();
    expectToast(toast, 'Organization created successfully.');
    expect(router.navigate).toHaveBeenCalledWith([
      '/admin/organizations',
      testOrganization.organization_id,
    ]);
  });

  it('saves edits, reloads detail, and shows success feedback', async () => {
    component.organization.set(testOrganization);
    component.editModalOpen.set(true);
    organizationService.updateOrganization.and.resolveTo(testOrganization);

    await component.saveOrganizationEdits({
      name: testOrganization.name,
      organization_type: 'venue',
    });

    expect(organizationService.updateOrganization).toHaveBeenCalledWith(
      testOrganization.organization_id,
      jasmine.any(Object),
      testOrganization
    );
    expect(component.editModalOpen()).toBeFalse();
    expectToast(toast, 'Organization updated successfully.');
  });

  it('archives, restores, and reports failures with toast feedback', async () => {
    spyOn(window, 'confirm').and.returnValue(true);
    component.organization.set(testOrganization);
    organizationService.archiveOrganization.and.resolveTo(testOrganization);
    organizationService.restoreOrganization.and.resolveTo(testOrganization);

    await component.archiveCurrentOrganization();
    expect(organizationService.archiveOrganization).toHaveBeenCalledWith(testOrganization);
    expectToast(toast, 'Organization archived.');

    await component.restoreCurrentOrganization();
    expect(organizationService.restoreOrganization).toHaveBeenCalledWith(testOrganization);
    expectToast(toast, 'Organization restored.');

    organizationService.archiveOrganization.and.rejectWith(new Error('archive failed'));
    await component.archiveCurrentOrganization();
    expectToast(toast, 'We were unable to archive the organization right now.', 'error');
  });

  it('loads project choices and links an organization to a project', async () => {
    component.organization.set(testOrganization);
    organizationService.linkOrganizationToProject.and.resolveTo(undefined);

    component.openLinkProjectModal();
    await flushCrmPromises();
    expect(projectRepository.getProjects).toHaveBeenCalled();
    expect(component.linkProjectModalOpen()).toBeTrue();

    await component.linkOrganizationToProject({
      project_id: testProject.project_id,
      relationship_type: 'venue',
    });

    expect(organizationService.linkOrganizationToProject).toHaveBeenCalledWith(
      testOrganization,
      {
        organization_id: testOrganization.organization_id,
        project_id: testProject.project_id,
        relationship_type: 'venue',
      }
    );
    expectToast(toast, 'Organization linked to project.');
  });
});
