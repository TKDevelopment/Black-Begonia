import { TestBed } from '@angular/core/testing';

import { testContact, testProject } from '../../testing/workflow-fixtures';
import {
  createSupabaseClientWithQuery,
  supabaseFailure,
  supabaseSuccess,
} from '../../testing/supabase-testing';
import { SupabaseService } from '../clients/supabase.service';
import { ContactRepositoryService } from './contact-repository.service';

describe('ContactRepositoryService', () => {
  let service: ContactRepositoryService;
  let supabaseService: jasmine.SpyObj<SupabaseService>;
  let consoleErrorSpy: jasmine.Spy;

  beforeEach(() => {
    supabaseService = jasmine.createSpyObj<SupabaseService>('SupabaseService', ['getClient']);

    TestBed.configureTestingModule({
      providers: [
        ContactRepositoryService,
        { provide: SupabaseService, useValue: supabaseService },
      ],
    });

    service = TestBed.inject(ContactRepositoryService);
    consoleErrorSpy = spyOn(console, 'error');
  });

  it('loads contacts ordered by last and first name', async () => {
    const { client, query } = createSupabaseClientWithQuery(supabaseSuccess([testContact]));
    supabaseService.getClient.and.returnValue(client as never);

    const contacts = await service.getContacts();

    expect(client.from).toHaveBeenCalledWith('contacts');
    expect(query.select).toHaveBeenCalledWith(jasmine.stringMatching('contact_id'));
    expect(query.order).toHaveBeenCalledWith('last_name', { ascending: true });
    expect(query.order).toHaveBeenCalledWith('first_name', { ascending: true });
    expect(contacts).toEqual([testContact]);
  });

  it('returns an empty list when contact loading has no rows', async () => {
    const { client } = createSupabaseClientWithQuery(supabaseSuccess(null));
    supabaseService.getClient.and.returnValue(client as never);

    await expectAsync(service.getContacts()).toBeResolvedTo([]);
  });

  it('logs and returns an empty list when contact loading fails', async () => {
    const response = supabaseFailure('contacts failed');
    const { client } = createSupabaseClientWithQuery(response);
    supabaseService.getClient.and.returnValue(client as never);

    await expectAsync(service.getContacts()).toBeResolvedTo([]);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[ContactRepositoryService] getContacts error:',
      response.error
    );
  });

  it('loads a contact by id', async () => {
    const { client, query } = createSupabaseClientWithQuery(supabaseSuccess(testContact));
    supabaseService.getClient.and.returnValue(client as never);

    const contact = await service.getContactById(testContact.contact_id);

    expect(query.eq).toHaveBeenCalledWith('contact_id', testContact.contact_id);
    expect(query.single).toHaveBeenCalled();
    expect(contact).toEqual(testContact);
  });

  it('normalizes create payloads before inserting', async () => {
    const { client, query } = createSupabaseClientWithQuery(supabaseSuccess(testContact));
    supabaseService.getClient.and.returnValue(client as never);

    await service.createContact({
      first_name: ' Rowan ',
      last_name: ' Client ',
      email: ' ROWAN.CLIENT@EXAMPLE.TEST ',
      phone: ' 555-0110 ',
      secondary_phone: ' ',
      preferred_contact_method: 'email',
      address_line_1: ' 100 Test Lane ',
      address_line_2: '',
      city: ' Austin ',
      state: ' TX ',
      postal_code: ' 78701 ',
      country: '',
      contact_type: 'client',
      notes: ' Synthetic contact fixture. ',
      created_from_lead_id: 'lead-test-001',
    });

    expect(query.insert).toHaveBeenCalledWith({
      first_name: 'Rowan',
      last_name: 'Client',
      email: 'rowan.client@example.test',
      phone: '555-0110',
      secondary_phone: null,
      preferred_contact_method: 'email',
      address_line_1: '100 Test Lane',
      address_line_2: null,
      city: 'Austin',
      state: 'TX',
      postal_code: '78701',
      country: 'US',
      contact_type: 'client',
      notes: 'Synthetic contact fixture.',
      created_from_lead_id: 'lead-test-001',
    });
    expect(query.single).toHaveBeenCalled();
  });

  it('throws when creating a contact fails', async () => {
    const response = supabaseFailure('insert failed');
    const { client } = createSupabaseClientWithQuery(response);
    supabaseService.getClient.and.returnValue(client as never);

    await expectAsync(
      service.createContact({ first_name: 'Rowan', last_name: 'Client' })
    ).toBeRejectedWith(response.error as Error);
  });

  it('updates a contact with an updated timestamp', async () => {
    jasmine.clock().install();
    jasmine.clock().mockDate(new Date('2026-06-02T15:00:00.000Z'));
    const { client, query } = createSupabaseClientWithQuery(supabaseSuccess(testContact));
    supabaseService.getClient.and.returnValue(client as never);

    await service.updateContact(testContact.contact_id, { notes: 'Updated' });

    expect(query.update).toHaveBeenCalledWith({
      notes: 'Updated',
      updated_at: '2026-06-02T15:00:00.000Z',
    });
    expect(query.eq).toHaveBeenCalledWith('contact_id', testContact.contact_id);
    jasmine.clock().uninstall();
  });

  it('loads related projects and filters empty joins', async () => {
    const { client, query } = createSupabaseClientWithQuery(
      supabaseSuccess([{ project: testProject }, { project: null }])
    );
    supabaseService.getClient.and.returnValue(client as never);

    const projects = await service.getRelatedProjects(testContact.contact_id);

    expect(client.from).toHaveBeenCalledWith('project_contacts');
    expect(query.eq).toHaveBeenCalledWith('contact_id', testContact.contact_id);
    expect(projects).toEqual([testProject]);
  });
});
