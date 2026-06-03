import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';

import { testActivityLogEntry, testContact, testLead, testProject } from '../../../core/testing/workflow-fixtures';
import {
  createParamMapSubject,
  createRouterSpy,
  createToastSpy,
  expectToast,
  flushCrmPromises,
} from '../../../core/testing/crm-testing';
import { ActivityLogRepositoryService } from '../../../core/supabase/repositories/activity-log-repository.service';
import { ContactRepositoryService } from '../../../core/supabase/repositories/contact-repository.service';
import { LeadRepositoryService } from '../../../core/supabase/repositories/lead-repository.service';
import { ProjectRepositoryService } from '../../../core/supabase/repositories/project-repository.service';
import { ContactService } from '../../../core/supabase/services/contact.service';
import { ToastService } from '../../../core/services/toast.service';
import { ContactsComponent } from './contacts.component';

describe('ContactsComponent', () => {
  let component: ContactsComponent;
  let fixture: ComponentFixture<ContactsComponent>;
  let routeParams: ReturnType<typeof createParamMapSubject>;
  let router: jasmine.SpyObj<Router>;
  let contactRepository: jasmine.SpyObj<ContactRepositoryService>;
  let activityLogRepository: jasmine.SpyObj<ActivityLogRepositoryService>;
  let leadRepository: jasmine.SpyObj<LeadRepositoryService>;
  let projectRepository: jasmine.SpyObj<ProjectRepositoryService>;
  let contactService: jasmine.SpyObj<ContactService>;
  let toast: jasmine.SpyObj<ToastService>;

  const archivedContact = {
    ...testContact,
    contact_id: 'contact-archived-001',
    first_name: 'Archived',
    last_name: 'Client',
    is_archived: true,
    contact_type: 'partner' as const,
    created_at: '2026-06-03T12:00:00.000Z',
  };

  beforeEach(async () => {
    routeParams = createParamMapSubject();
    router = createRouterSpy();
    router.navigate.and.resolveTo(true);
    contactRepository = jasmine.createSpyObj<ContactRepositoryService>('ContactRepositoryService', [
      'getContacts',
      'getContactById',
      'getRelatedProjects',
    ]);
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
    contactService = jasmine.createSpyObj<ContactService>('ContactService', [
      'createContact',
      'updateContact',
      'archiveContact',
      'restoreContact',
      'linkContactToProject',
    ]);
    toast = createToastSpy();

    contactRepository.getContacts.and.resolveTo([testContact, archivedContact]);
    contactRepository.getContactById.and.resolveTo(testContact);
    contactRepository.getRelatedProjects.and.resolveTo([testProject]);
    activityLogRepository.getEntityActivity.and.resolveTo([testActivityLogEntry]);
    leadRepository.getLeadById.and.resolveTo(testLead);
    projectRepository.getProjects.and.resolveTo([testProject]);

    await TestBed.configureTestingModule({
      imports: [ContactsComponent],
      providers: [
        { provide: ActivatedRoute, useValue: { paramMap: routeParams.asObservable() } },
        { provide: Router, useValue: router },
        { provide: ContactRepositoryService, useValue: contactRepository },
        { provide: ActivityLogRepositoryService, useValue: activityLogRepository },
        { provide: LeadRepositoryService, useValue: leadRepository },
        { provide: ProjectRepositoryService, useValue: projectRepository },
        { provide: ContactService, useValue: contactService },
        { provide: ToastService, useValue: toast },
      ],
    })
      .overrideComponent(ContactsComponent, { set: { template: '' } })
      .compileComponents();

    fixture = TestBed.createComponent(ContactsComponent);
    component = fixture.componentInstance;
  });

  it('loads contacts for the list view and exposes empty state when no rows return', async () => {
    await component.loadContacts();

    expect(component.loading()).toBeFalse();
    expect(component.error()).toBeNull();
    expect(component.contacts()).toEqual([testContact, archivedContact]);

    contactRepository.getContacts.and.resolveTo([]);
    await component.loadContacts();

    expect(component.contacts()).toEqual([]);
  });

  it('sets a list error and clears contacts when repository loading fails', async () => {
    spyOn(console, 'error');
    contactRepository.getContacts.and.rejectWith(new Error('contacts unavailable'));

    await component.loadContacts();

    expect(component.loading()).toBeFalse();
    expect(component.contacts()).toEqual([]);
    expect(component.error()).toBe('We were unable to load contacts right now.');
  });

  it('filters contacts by search, type, archive status, and sort order', () => {
    component.contacts.set([testContact, archivedContact]);

    component.onSearchChange('archived');
    component.onFilterChange({ key: 'contact_type', value: 'partner' });
    component.onFilterChange({ key: 'archive', value: 'archived' });
    component.onFilterChange({ key: 'sort', value: 'created_desc' });

    expect(component.filteredContacts()).toEqual([archivedContact]);

    component.resetFilters();
    expect(component.searchTerm()).toBe('');
    expect(component.archiveFilter()).toBe('active');
  });

  it('loads detail data including linked projects, activity, and source lead', async () => {
    await component.loadContactDetail(testContact.contact_id);

    expect(component.detailLoading()).toBeFalse();
    expect(component.contact()).toEqual(testContact);
    expect(component.relatedProjects()).toEqual([testProject]);
    expect(component.activityLog()).toEqual([testActivityLogEntry]);
    expect(component.createdFromLead()).toEqual(testLead);
  });

  it('sets detail empty state when a contact cannot be found', async () => {
    contactRepository.getContactById.and.resolveTo(null);

    await component.loadContactDetail('missing-contact');

    expect(component.contact()).toBeNull();
    expect(component.relatedProjects()).toEqual([]);
    expect(component.detailError()).toBe('We could not find this contact record.');
  });

  it('routes through ngOnInit for list and detail views', async () => {
    component.ngOnInit();
    await flushCrmPromises();
    expect(contactRepository.getContacts).toHaveBeenCalled();

    routeParams.next(new Map([['contactId', testContact.contact_id]]) as never);
    await flushCrmPromises();
    expect(contactRepository.getContactById).toHaveBeenCalledWith(testContact.contact_id);
    expect(component.isDetailView()).toBeTrue();
  });

  it('creates contacts, closes the modal, shows feedback, and navigates to detail', async () => {
    contactService.createContact.and.resolveTo(testContact);
    component.createModalOpen.set(true);

    await component.createContact({
      first_name: 'Rowan',
      last_name: 'Client',
      contact_type: 'client',
    });

    expect(component.createModalOpen()).toBeFalse();
    expectToast(toast, 'Contact created successfully.');
    expect(router.navigate).toHaveBeenCalledWith(['/admin/contacts', testContact.contact_id]);
  });

  it('saves edits, reloads detail, and shows success feedback', async () => {
    component.contact.set(testContact);
    component.editModalOpen.set(true);
    contactService.updateContact.and.resolveTo(testContact);

    await component.saveContactEdits({
      first_name: 'Rowan',
      last_name: 'Client',
      contact_type: 'client',
    });

    expect(contactService.updateContact).toHaveBeenCalledWith(
      testContact.contact_id,
      jasmine.any(Object),
      testContact
    );
    expect(component.editModalOpen()).toBeFalse();
    expectToast(toast, 'Contact updated successfully.');
  });

  it('archives, restores, and reports failures with toast feedback', async () => {
    spyOn(window, 'confirm').and.returnValue(true);
    component.contact.set(testContact);
    contactService.archiveContact.and.resolveTo(testContact);
    contactService.restoreContact.and.resolveTo(testContact);

    await component.archiveCurrentContact();
    expect(contactService.archiveContact).toHaveBeenCalledWith(testContact);
    expectToast(toast, 'Contact archived.');

    await component.restoreCurrentContact();
    expect(contactService.restoreContact).toHaveBeenCalledWith(testContact);
    expectToast(toast, 'Contact restored.');

    contactService.archiveContact.and.rejectWith(new Error('archive failed'));
    await component.archiveCurrentContact();
    expectToast(toast, 'We were unable to archive the contact right now.', 'error');
  });

  it('loads project choices and links a contact to a project', async () => {
    component.contact.set(testContact);
    contactService.linkContactToProject.and.resolveTo(undefined);

    component.openLinkProjectModal();
    await flushCrmPromises();
    expect(projectRepository.getProjects).toHaveBeenCalled();
    expect(component.linkProjectModalOpen()).toBeTrue();

    await component.linkContactToProject({
      project_id: testProject.project_id,
      relationship_type: 'client',
      is_primary: true,
    });

    expect(contactService.linkContactToProject).toHaveBeenCalledWith(testContact, {
      contact_id: testContact.contact_id,
      project_id: testProject.project_id,
      relationship_type: 'client',
      is_primary: true,
    });
    expectToast(toast, 'Contact linked to project.');
  });
});
